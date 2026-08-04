import {
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

import {
  Prisma,
  UserRole,
} from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  PaymentError,
  PaymentValidationError,
  getPaymentError,
  getPaymentErrorLogContext,
} from "@/lib/payments/payment-errors";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_CLIENT_SESSION_COOKIE_NAME =
  "tikemia_client_session";

const LEGACY_SESSION_COOKIE_NAME =
  "tikemia_session";

const DEFAULT_RESERVATION_MINUTES = 15;
const MIN_RESERVATION_MINUTES = 5;
const MAX_RESERVATION_MINUTES = 60;

const MAX_DISTINCT_TICKET_TYPES = 20;
const MAX_TOTAL_TICKETS_PER_ORDER = 50;
const MAX_TRANSACTION_RETRIES = 3;

const checkoutOrderSchema = z
  .object({
    eventId: z
      .string()
      .trim()
      .min(
        1,
        "L’événement est obligatoire.",
      )
      .max(
        100,
        "L’identifiant de l’événement est invalide.",
      ),

    items: z
      .array(
        z
          .object({
            ticketTypeId: z
              .string()
              .trim()
              .min(
                1,
                "Le type de billet est obligatoire.",
              )
              .max(
                100,
                "L’identifiant du type de billet est invalide.",
              ),

            quantity: z
              .number()
              .int(
                "La quantité doit être un nombre entier.",
              )
              .min(
                1,
                "La quantité minimale est de 1 billet.",
              )
              .max(
                MAX_TOTAL_TICKETS_PER_ORDER,
                `La quantité maximale est de ${MAX_TOTAL_TICKETS_PER_ORDER} billets.`,
              ),
          })
          .strict(),
      )
      .min(
        1,
        "Sélectionnez au moins un billet.",
      )
      .max(
        MAX_DISTINCT_TICKET_TYPES,
        "Trop de types de billets ont été sélectionnés.",
      ),

    customer: z
      .object({
        firstName: z
          .string()
          .trim()
          .min(
            2,
            "Le prénom est obligatoire.",
          )
          .max(
            80,
            "Le prénom est trop long.",
          ),

        lastName: z
          .string()
          .trim()
          .min(
            2,
            "Le nom est obligatoire.",
          )
          .max(
            80,
            "Le nom est trop long.",
          ),

        email: z
          .string()
          .trim()
          .email(
            "L’adresse e-mail est invalide.",
          )
          .max(
            190,
            "L’adresse e-mail est trop longue.",
          )
          .transform((value) =>
            value.toLowerCase(),
          ),

        phone: z
          .string()
          .trim()
          .min(
            6,
            "Le numéro de téléphone est obligatoire.",
          )
          .max(
            40,
            "Le numéro de téléphone est trop long.",
          ),

        countryCode: z
          .string()
          .trim()
          .toUpperCase()
          .regex(
            /^[A-Z]{2}$/,
            "Le pays sélectionné est invalide.",
          )
          .optional(),
      })
      .strict(),

    idempotencyKey: z
      .string()
      .trim()
      .min(
        16,
        "La clé d’idempotence est trop courte.",
      )
      .max(
        200,
        "La clé d’idempotence est trop longue.",
      )
      .regex(
        /^[A-Za-z0-9._:-]+$/,
        "La clé d’idempotence contient des caractères invalides.",
      )
      .optional(),
  })
  .strict();

type CheckoutOrderInput = z.infer<
  typeof checkoutOrderSchema
>;

type AuthenticatedCustomer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode: string;
};

type ConsolidatedItem = {
  ticketTypeId: string;
  quantity: number;
};

type NormalizedCustomerData = {
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  countryCode: string;
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,

    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, max-age=0",

      Pragma: "no-cache",
      Expires: "0",

      "X-Content-Type-Options":
        "nosniff",
    },
  });
}

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function hashToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

/**
 * La durée de réservation appartient au checkout Tikemia,
 * et non à FedaPay ou Moneroo.
 *
 * Variables acceptées :
 *
 * PAYMENT_RESERVATION_MINUTES="15"
 *
 * ou, pour compatibilité :
 *
 * CHECKOUT_RESERVATION_MINUTES="15"
 */
function getReservationMinutes(): number {
  const rawValue =
    normalizeText(
      process.env
        .PAYMENT_RESERVATION_MINUTES,
    ) ||
    normalizeText(
      process.env
        .CHECKOUT_RESERVATION_MINUTES,
    );

  if (!rawValue) {
    return DEFAULT_RESERVATION_MINUTES;
  }

  const parsedValue =
    Number.parseInt(
      rawValue,
      10,
    );

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue <
      MIN_RESERVATION_MINUTES ||
    parsedValue >
      MAX_RESERVATION_MINUTES
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_CONFIGURATION_ERROR",

      message:
        `La durée de réservation doit être comprise entre ${MIN_RESERVATION_MINUTES} et ${MAX_RESERVATION_MINUTES} minutes.`,

      status: 500,

      exposeMessage: false,
      retryable: false,

      details: {
        configuredValue:
          rawValue,
      },
    });
  }

  return parsedValue;
}

function getSessionCookieNames(): string[] {
  return Array.from(
    new Set(
      [
        normalizeText(
          process.env
            .CLIENT_SESSION_COOKIE_NAME,
        ),

        normalizeText(
          process.env
            .SESSION_COOKIE_NAME,
        ),

        DEFAULT_CLIENT_SESSION_COOKIE_NAME,
        LEGACY_SESSION_COOKIE_NAME,
      ].filter(Boolean),
    ),
  );
}

async function getAuthenticatedCustomer(): Promise<
  AuthenticatedCustomer | null
> {
  const cookieStore =
    await cookies();

  let sessionToken = "";

  for (
    const cookieName of
    getSessionCookieNames()
  ) {
    sessionToken =
      normalizeText(
        cookieStore.get(
          cookieName,
        )?.value,
      );

    if (sessionToken) {
      break;
    }
  }

  if (!sessionToken) {
    return null;
  }

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash:
          hashToken(
            sessionToken,
          ),
      },

      select: {
        id: true,
        expiresAt: true,

        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            countryCode: true,
            role: true,
            emailVerified: true,
            isActive: true,
          },
        },
      },
    });

  if (!session) {
    return null;
  }

  if (
    session.expiresAt.getTime() <=
    Date.now()
  ) {
    await prisma.session
      .delete({
        where: {
          id: session.id,
        },
      })
      .catch(() => undefined);

    return null;
  }

  if (
    session.user.role !==
      UserRole.CUSTOMER ||
    !session.user.emailVerified ||
    !session.user.isActive
  ) {
    return null;
  }

  return {
    id:
      session.user.id,

    firstName:
      normalizeText(
        session.user.firstName,
      ),

    lastName:
      normalizeText(
        session.user.lastName,
      ),

    email:
      normalizeText(
        session.user.email,
      ).toLowerCase(),

    phone:
      normalizeText(
        session.user.phone,
      ),

    countryCode:
      normalizeText(
        session.user.countryCode,
      ).toUpperCase(),
  };
}

function consolidateItems(
  items:
    CheckoutOrderInput["items"],
): ConsolidatedItem[] {
  const quantities =
    new Map<string, number>();

  for (const item of items) {
    quantities.set(
      item.ticketTypeId,

      (
        quantities.get(
          item.ticketTypeId,
        ) ?? 0
      ) + item.quantity,
    );
  }

  const consolidated =
    Array.from(
      quantities,
      ([
        ticketTypeId,
        quantity,
      ]) => ({
        ticketTypeId,
        quantity,
      }),
    );

  const totalQuantity =
    consolidated.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.quantity,
      0,
    );

  if (
    totalQuantity >
    MAX_TOTAL_TICKETS_PER_ORDER
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        `Une commande ne peut pas dépasser ${MAX_TOTAL_TICKETS_PER_ORDER} billets.`,

      status: 400,

      details: {
        totalQuantity,
      },
    });
  }

  return consolidated;
}

function getIdempotencyKey({
  request,
  body,
}: {
  request: Request;
  body: CheckoutOrderInput;
}): string {
  const headerValue =
    normalizeText(
      request.headers.get(
        "idempotency-key",
      ),
    );

  const bodyValue =
    normalizeText(
      body.idempotencyKey,
    );

  const value =
    headerValue ||
    bodyValue;

  if (value) {
    const parsed = z
      .string()
      .min(16)
      .max(200)
      .regex(
        /^[A-Za-z0-9._:-]+$/,
      )
      .safeParse(value);

    if (!parsed.success) {
      throw new PaymentValidationError({
        code:
          "PAYMENT_INVALID_REQUEST",

        message:
          "La clé d’idempotence de la commande est invalide.",

        status: 400,
      });
    }

    return parsed.data;
  }

  return `checkout_${randomBytes(
    24,
  ).toString("hex")}`;
}

function getCheckoutTokenSecret(): string {
  const secret =
    normalizeText(
      process.env
        .CHECKOUT_TOKEN_SECRET,
    ) ||
    normalizeText(
      process.env
        .SESSION_SECRET,
    );

  if (secret.length < 32) {
    throw new PaymentError({
      code:
        "PAYMENT_CONFIGURATION_ERROR",

      message:
        "La configuration sécurisée du checkout est incomplète.",

      status: 500,

      exposeMessage: false,
      retryable: false,
    });
  }

  return secret;
}

function createCheckoutToken(
  idempotencyKey: string,
): string {
  return createHmac(
    "sha256",
    getCheckoutTokenSecret(),
  )
    .update(
      `tikemia:checkout:${idempotencyKey}`,
    )
    .digest("base64url");
}

function createOrderReference(): string {
  const date =
    new Date();

  const datePart = [
    date.getUTCFullYear(),

    String(
      date.getUTCMonth() + 1,
    ).padStart(2, "0"),

    String(
      date.getUTCDate(),
    ).padStart(2, "0"),
  ].join("");

  const randomPart =
    randomBytes(5)
      .toString("hex")
      .toUpperCase();

  return `TKM-${datePart}-${randomPart}`;
}

function normalizeCustomerData({
  customer,
  authenticatedCustomer,
}: {
  customer:
    CheckoutOrderInput["customer"];

  authenticatedCustomer:
    AuthenticatedCustomer | null;
}): NormalizedCustomerData {
  const submittedFirstName =
    normalizeText(
      customer.firstName,
    );

  const submittedLastName =
    normalizeText(
      customer.lastName,
    );

  const submittedEmail =
    normalizeText(
      customer.email,
    ).toLowerCase();

  const submittedPhone =
    normalizeText(
      customer.phone,
    );

  const submittedCountryCode =
    normalizeText(
      customer.countryCode,
    ).toUpperCase();

  if (authenticatedCustomer) {
    /*
     * Le compte connecté reste propriétaire de la commande.
     *
     * En revanche, si certaines informations du profil sont absentes,
     * les valeurs validées dans le formulaire peuvent servir de secours.
     * Cela empêche un ancien profil incomplet de casser le checkout.
     */
    const firstName =
      normalizeText(
        authenticatedCustomer.firstName,
      ) ||
      submittedFirstName;

    const lastName =
      normalizeText(
        authenticatedCustomer.lastName,
      ) ||
      submittedLastName;

    return {
      customerId:
        authenticatedCustomer.id,

      customerName:
        `${firstName} ${lastName}`
          .replace(
            /\s+/g,
            " ",
          )
          .trim(),

      customerEmail:
        normalizeText(
          authenticatedCustomer.email,
        ).toLowerCase() ||
        submittedEmail,

      customerPhone:
        normalizeText(
          authenticatedCustomer.phone,
        ) ||
        submittedPhone,

      countryCode:
        normalizeText(
          authenticatedCustomer.countryCode,
        ).toUpperCase() ||
        submittedCountryCode,
    };
  }

  return {
    customerId: null,

    customerName:
      `${submittedFirstName} ${submittedLastName}`
        .replace(
          /\s+/g,
          " ",
        )
        .trim(),

    customerEmail:
      submittedEmail,

    customerPhone:
      submittedPhone,

    countryCode:
      submittedCountryCode,
  };
}

function calculatePlatformFee({
  subtotal,
  rate,
}: {
  subtotal:
    Prisma.Decimal;

  rate:
    Prisma.Decimal;
}): Prisma.Decimal {
  return subtotal
    .mul(rate)
    .div(100)
    .toDecimalPlaces(
      2,
      Prisma.Decimal
        .ROUND_HALF_UP,
    );
}

async function releaseExpiredReservations({
  transaction,
  ticketTypeIds,
  now,
}: {
  transaction:
    Prisma.TransactionClient;

  ticketTypeIds:
    string[];

  now:
    Date;
}) {
  const expiredReservations =
    await transaction
      .ticketReservation
      .findMany({
        where: {
          ticketTypeId: {
            in: ticketTypeIds,
          },

          status: "PENDING",

          expiresAt: {
            lte: now,
          },
        },

        select: {
          id: true,
          ticketTypeId: true,
          quantity: true,
        },
      });

  if (
    expiredReservations.length ===
    0
  ) {
    return;
  }

  const quantitiesByTicketType =
    new Map<string, number>();

  for (
    const reservation of
    expiredReservations
  ) {
    quantitiesByTicketType.set(
      reservation.ticketTypeId,

      (
        quantitiesByTicketType.get(
          reservation.ticketTypeId,
        ) ?? 0
      ) +
        reservation.quantity,
    );
  }

  for (
    const [
      ticketTypeId,
      quantity,
    ] of quantitiesByTicketType
  ) {
    const ticketType =
      await transaction
        .ticketType
        .findUnique({
          where: {
            id: ticketTypeId,
          },

          select: {
            reserved: true,
          },
        });

    if (ticketType) {
      await transaction
        .ticketType
        .update({
          where: {
            id: ticketTypeId,
          },

          data: {
            reserved:
              Math.max(
                0,
                ticketType.reserved -
                  quantity,
              ),
          },
        });
    }
  }

  await transaction
    .ticketReservation
    .updateMany({
      where: {
        id: {
          in:
            expiredReservations.map(
              (
                reservation,
              ) =>
                reservation.id,
            ),
        },

        status: "PENDING",
      },

      data: {
        status: "EXPIRED",
        releasedAt: now,
      },
    });
}

async function findExistingOrder({
  idempotencyKey,
  authenticatedCustomer,
  guestEmail,
}: {
  idempotencyKey: string;

  authenticatedCustomer:
    AuthenticatedCustomer | null;

  guestEmail: string;
}) {
  const order =
    await prisma.order.findUnique({
      where: {
        idempotencyKey,
      },

      select: {
        id: true,
        reference: true,
        customerId: true,
        customerEmail: true,
        status: true,
        currency: true,
        subtotal: true,
        platformFee: true,
        total: true,
        reservationExpiresAt: true,
        checkoutTokenHash: true,

        event: {
          select: {
            id: true,
            slug: true,
            title: true,
          },
        },

        items: {
          select: {
            id: true,
            ticketTypeId: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
            platformFee: true,
            total: true,

            ticketType: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

  if (!order) {
    return null;
  }

  const belongsToRequester =
    authenticatedCustomer
      ? order.customerId ===
        authenticatedCustomer.id
      : order.customerId ===
          null &&
        order.customerEmail
          .toLowerCase() ===
          guestEmail.toLowerCase();

  if (!belongsToRequester) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_IDEMPOTENCY_CONFLICT",

      message:
        "Cette clé d’idempotence est déjà utilisée par une autre commande.",

      status: 409,
      orderId: order.id,
    });
  }

  return order;
}

function serializeOrder(
  order: {
    id: string;
    reference: string;
    status: string;
    currency: string;
    subtotal: Prisma.Decimal;
    platformFee: Prisma.Decimal;
    total: Prisma.Decimal;
    reservationExpiresAt: Date | null;

    event: {
      id: string;
      slug: string;
      title: string;
    };

    items: Array<{
      id: string;
      ticketTypeId: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      subtotal: Prisma.Decimal;
      platformFee: Prisma.Decimal;
      total: Prisma.Decimal;

      ticketType: {
        name: string;
      };
    }>;
  },

  checkoutToken: string,
) {
  return {
    id: order.id,
    reference:
      order.reference,
    status:
      order.status,
    currency:
      order.currency,

    subtotal:
      order.subtotal.toFixed(2),

    platformFee:
      order.platformFee.toFixed(2),

    total:
      order.total.toFixed(2),

    reservationExpiresAt:
      order.reservationExpiresAt
        ?.toISOString() ??
      null,

    checkoutToken,

    event:
      order.event,

    items:
      order.items.map((item) => ({
        id: item.id,

        ticketTypeId:
          item.ticketTypeId,

        ticketTypeName:
          item.ticketType.name,

        quantity:
          item.quantity,

        unitPrice:
          item.unitPrice.toFixed(2),

        subtotal:
          item.subtotal.toFixed(2),

        platformFee:
          item.platformFee.toFixed(2),

        total:
          item.total.toFixed(2),
      })),
  };
}

async function createOrderInTransaction({
  input,
  items,
  authenticatedCustomer,
  idempotencyKey,
  checkoutToken,
}: {
  input:
    CheckoutOrderInput;

  items:
    ConsolidatedItem[];

  authenticatedCustomer:
    AuthenticatedCustomer | null;

  idempotencyKey:
    string;

  checkoutToken:
    string;
}) {
  const reservationMinutes =
    getReservationMinutes();

  const now =
    new Date();

  const reservationExpiresAt =
    new Date(
      now.getTime() +
        reservationMinutes *
          60_000,
    );

  const ticketTypeIds =
    items.map(
      (item) =>
        item.ticketTypeId,
    );

  const customerData =
    normalizeCustomerData({
      customer:
        input.customer,

      authenticatedCustomer,
    });

  return prisma.$transaction(
    async (transaction) => {
      await releaseExpiredReservations({
        transaction,
        ticketTypeIds,
        now,
      });

      const event =
        await transaction
          .event
          .findFirst({
            where: {
              id:
                input.eventId,

              status:
                "PUBLISHED",
            },

            select: {
              id: true,
              slug: true,
              title: true,
              currency: true,
              platformFeeRate: true,
              salesStartAt: true,
              salesEndAt: true,
              startsAt: true,

              ticketTypes: {
                where: {
                  id: {
                    in:
                      ticketTypeIds,
                  },
                },

                select: {
                  id: true,
                  name: true,
                  price: true,
                  quantity: true,
                  sold: true,
                  reserved: true,
                  maxPerOrder: true,
                  saleStartsAt: true,
                  saleEndsAt: true,
                  isActive: true,
                },
              },
            },
          });

      if (!event) {
        throw new PaymentValidationError({
          code:
            "PAYMENT_ORDER_NOT_FOUND",

          message:
            "Cet événement est introuvable ou indisponible.",

          status: 404,
        });
      }

      if (
        event.salesStartAt &&
        event.salesStartAt >
          now
      ) {
        throw new PaymentValidationError({
          code:
            "PAYMENT_ORDER_NOT_PAYABLE",

          message:
            "La vente des billets n’a pas encore commencé.",

          status: 409,
        });
      }

      if (
        event.salesEndAt &&
        event.salesEndAt <=
          now
      ) {
        throw new PaymentValidationError({
          code:
            "PAYMENT_ORDER_EXPIRED",

          message:
            "La vente des billets est terminée.",

          status: 409,
        });
      }

      if (
        event.startsAt <=
        now
      ) {
        throw new PaymentValidationError({
          code:
            "PAYMENT_ORDER_EXPIRED",

          message:
            "Cet événement a déjà commencé et ne peut plus être commandé.",

          status: 409,
        });
      }

      if (
        event.ticketTypes.length !==
        ticketTypeIds.length
      ) {
        throw new PaymentValidationError({
          code:
            "PAYMENT_INVALID_REQUEST",

          message:
            "Un ou plusieurs types de billets sont invalides.",

          status: 400,
        });
      }

      const ticketTypesById =
        new Map(
          event.ticketTypes.map(
            (ticketType) => [
              ticketType.id,
              ticketType,
            ],
          ),
        );

      let subtotal =
        new Prisma.Decimal(0);

      const calculatedItems =
        items.map((item) => {
          const ticketType =
            ticketTypesById.get(
              item.ticketTypeId,
            );

          if (!ticketType) {
            throw new PaymentValidationError({
              code:
                "PAYMENT_INVALID_REQUEST",

              message:
                "Le type de billet sélectionné est invalide.",

              status: 400,
            });
          }

          if (!ticketType.isActive) {
            throw new PaymentValidationError({
              code:
                "PAYMENT_ORDER_NOT_PAYABLE",

              message:
                `Le billet « ${ticketType.name} » n’est pas disponible à la vente.`,

              status: 409,
            });
          }

          if (
            ticketType.saleStartsAt &&
            ticketType.saleStartsAt >
              now
          ) {
            throw new PaymentValidationError({
              code:
                "PAYMENT_ORDER_NOT_PAYABLE",

              message:
                `La vente du billet « ${ticketType.name} » n’a pas encore commencé.`,

              status: 409,
            });
          }

          if (
            ticketType.saleEndsAt &&
            ticketType.saleEndsAt <=
              now
          ) {
            throw new PaymentValidationError({
              code:
                "PAYMENT_ORDER_EXPIRED",

              message:
                `La vente du billet « ${ticketType.name} » est terminée.`,

              status: 409,
            });
          }

          if (
            item.quantity >
            ticketType.maxPerOrder
          ) {
            throw new PaymentValidationError({
              code:
                "PAYMENT_INVALID_REQUEST",

              message:
                `Vous pouvez acheter au maximum ${ticketType.maxPerOrder} billet(s) de type « ${ticketType.name} » par commande.`,

              status: 400,
            });
          }

          const availableQuantity =
            Math.max(
              0,
              ticketType.quantity -
                ticketType.sold -
                ticketType.reserved,
            );

          if (
            item.quantity >
            availableQuantity
          ) {
            throw new PaymentValidationError({
              code:
                "PAYMENT_STOCK_INSUFFICIENT",

              message:
                `Il ne reste pas assez de billets « ${ticketType.name} ». Quantité disponible : ${availableQuantity}.`,

              status: 409,
              retryable: false,

              details: {
                ticketTypeId:
                  ticketType.id,

                requestedQuantity:
                  item.quantity,

                availableQuantity,
              },
            });
          }

          const itemSubtotal =
            ticketType.price
              .mul(
                item.quantity,
              )
              .toDecimalPlaces(
                2,
                Prisma.Decimal
                  .ROUND_HALF_UP,
              );

          const itemPlatformFee =
            calculatePlatformFee({
              subtotal:
                itemSubtotal,

              rate:
                event.platformFeeRate,
            });

          const itemTotal =
            itemSubtotal
              .plus(
                itemPlatformFee,
              )
              .toDecimalPlaces(
                2,
                Prisma.Decimal
                  .ROUND_HALF_UP,
              );

          subtotal =
            subtotal.plus(
              itemSubtotal,
            );

          return {
            ticketType,

            quantity:
              item.quantity,

            unitPrice:
              ticketType.price,

            subtotal:
              itemSubtotal,

            platformFee:
              itemPlatformFee,

            total:
              itemTotal,
          };
        });

      subtotal =
        subtotal.toDecimalPlaces(
          2,
          Prisma.Decimal
            .ROUND_HALF_UP,
        );

      const platformFee =
        calculatePlatformFee({
          subtotal,

          rate:
            event.platformFeeRate,
        });

      const total =
        subtotal
          .plus(
            platformFee,
          )
          .toDecimalPlaces(
            2,
            Prisma.Decimal
              .ROUND_HALF_UP,
          );

      const order =
        await transaction
          .order
          .create({
            data: {
              reference:
                createOrderReference(),

              eventId:
                event.id,

              customerId:
                customerData.customerId,

              customerName:
                customerData.customerName,

              customerEmail:
                customerData.customerEmail,

              customerPhone:
                customerData.customerPhone,

              currency:
                event.currency
                  .trim()
                  .toUpperCase(),

              subtotal,
              platformFee,
              total,

              status:
                "PENDING",

              checkoutTokenHash:
                hashToken(
                  checkoutToken,
                ),

              idempotencyKey,

              reservationExpiresAt,

              checkoutStartedAt:
                now,

              items: {
                create:
                  calculatedItems.map(
                    (item) => ({
                      ticketTypeId:
                        item.ticketType.id,

                      quantity:
                        item.quantity,

                      unitPrice:
                        item.unitPrice,

                      subtotal:
                        item.subtotal,

                      platformFee:
                        item.platformFee,

                      total:
                        item.total,
                    }),
                  ),
              },

              reservations: {
                create:
                  calculatedItems.map(
                    (item) => ({
                      ticketTypeId:
                        item.ticketType.id,

                      quantity:
                        item.quantity,

                      status:
                        "PENDING",

                      expiresAt:
                        reservationExpiresAt,
                    }),
                  ),
              },
            },

            select: {
              id: true,
              reference: true,
              status: true,
              currency: true,
              subtotal: true,
              platformFee: true,
              total: true,
              reservationExpiresAt: true,

              event: {
                select: {
                  id: true,
                  slug: true,
                  title: true,
                },
              },

              items: {
                select: {
                  id: true,
                  ticketTypeId: true,
                  quantity: true,
                  unitPrice: true,
                  subtotal: true,
                  platformFee: true,
                  total: true,

                  ticketType: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          });

      for (
        const item of
        calculatedItems
      ) {
        await transaction
          .ticketType
          .update({
            where: {
              id:
                item.ticketType.id,
            },

            data: {
              reserved: {
                increment:
                  item.quantity,
              },
            },
          });
      }

      return order;
    },
    {
      isolationLevel:
        Prisma
          .TransactionIsolationLevel
          .Serializable,

      timeout: 20_000,
      maxWait: 10_000,
    },
  );
}

async function createOrderWithRetry(
  parameters:
    Parameters<
      typeof createOrderInTransaction
    >[0],
) {
  let lastError:
    unknown;

  for (
    let attempt = 1;
    attempt <=
    MAX_TRANSACTION_RETRIES;
    attempt += 1
  ) {
    try {
      return await createOrderInTransaction(
        parameters,
      );
    } catch (error) {
      lastError = error;

      const shouldRetry =
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code ===
          "P2034";

      if (
        !shouldRetry ||
        attempt ===
          MAX_TRANSACTION_RETRIES
      ) {
        throw error;
      }

      await new Promise<void>(
        (resolve) =>
          setTimeout(
            resolve,
            attempt * 100,
          ),
      );
    }
  }

  throw lastError;
}

export async function POST(
  request: Request,
) {
  try {
    let rawBody:
      unknown;

    try {
      rawBody =
        await request.json();
    } catch {
      return jsonResponse(
        {
          success: false,

          error: {
            code:
              "PAYMENT_INVALID_REQUEST",

            message:
              "La requête envoyée est invalide.",
          },
        },
        400,
      );
    }

    const parsedBody =
      checkoutOrderSchema.safeParse(
        rawBody,
      );

    if (!parsedBody.success) {
      return jsonResponse(
        {
          success: false,

          error: {
            code:
              "PAYMENT_INVALID_REQUEST",

            message:
              parsedBody.error
                .issues[0]
                ?.message ??
              "Les informations de la commande sont invalides.",

            field:
              parsedBody.error
                .issues[0]
                ?.path.join(
                  ".",
                ) ??
              null,
          },
        },
        400,
      );
    }

    const input =
      parsedBody.data;

    const authenticatedCustomer =
      await getAuthenticatedCustomer();

    const items =
      consolidateItems(
        input.items,
      );

    const idempotencyKey =
      getIdempotencyKey({
        request,
        body: input,
      });

    const checkoutToken =
      createCheckoutToken(
        idempotencyKey,
      );

    const existingOrder =
      await findExistingOrder({
        idempotencyKey,

        authenticatedCustomer,

        guestEmail:
          input.customer.email,
      });

    if (existingOrder) {
      return jsonResponse({
        success: true,

        code:
          "ORDER_ALREADY_CREATED",

        message:
          "Cette commande a déjà été préparée.",

        order:
          serializeOrder(
            existingOrder,
            checkoutToken,
          ),
      });
    }

    try {
      const order =
        await createOrderWithRetry({
          input,
          items,
          authenticatedCustomer,
          idempotencyKey,
          checkoutToken,
        });

      return jsonResponse(
        {
          success: true,

          code:
            "ORDER_CREATED",

          message:
            "Commande préparée. Les billets sont temporairement réservés jusqu’à la fin du délai indiqué.",

          order:
            serializeOrder(
              order,
              checkoutToken,
            ),
        },
        201,
      );
    } catch (error) {
      /*
       * Protection contre deux requêtes simultanées utilisant
       * exactement la même clé d’idempotence.
       */
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code ===
          "P2002"
      ) {
        const orderCreatedByConcurrentRequest =
          await findExistingOrder({
            idempotencyKey,

            authenticatedCustomer,

            guestEmail:
              input.customer.email,
          });

        if (
          orderCreatedByConcurrentRequest
        ) {
          return jsonResponse({
            success: true,

            code:
              "ORDER_ALREADY_CREATED",

            message:
              "Cette commande a déjà été préparée.",

            order:
              serializeOrder(
                orderCreatedByConcurrentRequest,
                checkoutToken,
              ),
          });
        }
      }

      throw error;
    }
  } catch (error) {
    const paymentError =
      getPaymentError(error, {
        code:
          "PAYMENT_INTERNAL_ERROR",

        message:
          "Impossible de préparer cette commande pour le moment.",

        status: 500,

        exposeMessage: false,
      });

    console.error(
      "[CLIENT_CHECKOUT_ORDER_CREATE_ERROR]",

      getPaymentErrorLogContext(
        paymentError,
      ),
    );

    return jsonResponse(
      paymentError.toJSON() as unknown as Record<
        string,
        unknown
      >,

      paymentError.status,
    );
  }
}