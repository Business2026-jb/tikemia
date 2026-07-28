import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import {
  PaymentStatus,
  Prisma,
  UserRole,
} from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createFedaPayHostedCheckout,
} from "@/lib/payments/providers/fedapay/fedapay-client";
import {
  getFedaPayConfig,
} from "@/lib/payments/providers/fedapay/config";
import {
  PaymentError,
  PaymentValidationError,
  getPaymentError,
  getPaymentErrorLogContext,
} from "@/lib/payments/payment-errors";
import { prisma } from "@/lib/prisma";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const DEFAULT_CLIENT_SESSION_COOKIE_NAME =
  "tikemia_client_session";

const LEGACY_SESSION_COOKIE_NAME =
  "tikemia_session";

const PAYMENT_PROVIDER =
  "FEDAPAY";

const paymentMethodSchema =
  z.enum([
    "FEDAPAY_CHECKOUT",
    "MOBILE_MONEY",
    "CARD",
    "MTN_MOMO",
    "MOOV_MONEY",
    "CELTIIS_CASH",
    "ORANGE_MONEY",
    "WAVE",
    "VISA",
    "MASTERCARD",
  ]);

const createPaymentSchema =
  z
    .object({
      orderId:
        z
          .string()
          .trim()
          .min(
            1,
            "La commande est obligatoire.",
          )
          .max(
            100,
            "L’identifiant de la commande est invalide.",
          ),

      checkoutToken:
        z
          .string()
          .trim()
          .min(
            32,
            "Le jeton de checkout est invalide.",
          )
          .max(
            500,
            "Le jeton de checkout est trop long.",
          )
          .optional(),

      paymentMethod:
        paymentMethodSchema
          .optional()
          .default(
            "FEDAPAY_CHECKOUT",
          ),

      idempotencyKey:
        z
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

type CreatePaymentInput =
  z.infer<
    typeof createPaymentSchema
  >;

type AuthenticatedCustomer = {
  id: string;
  email: string;
};

function jsonResponse(
  body:
    Record<
      string,
      unknown
    >,
  status = 200,
) {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, max-age=0",

        Pragma:
          "no-cache",

        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
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
  token:
    string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      token,
    )
    .digest(
      "hex",
    );
}

function secureHashEquals(
  left:
    string,
  right:
    string,
): boolean {
  const leftBuffer =
    Buffer.from(
      left,
      "utf8",
    );

  const rightBuffer =
    Buffer.from(
      right,
      "utf8",
    );

  if (
    leftBuffer.length !==
    rightBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    leftBuffer,
    rightBuffer,
  );
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
      ].filter(
        Boolean,
      ),
    ),
  );
}

async function getAuthenticatedCustomer(): Promise<
  AuthenticatedCustomer | null
> {
  const cookieStore =
    await cookies();

  let sessionToken =
    "";

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

    if (
      sessionToken
    ) {
      break;
    }
  }

  if (
    !sessionToken
  ) {
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
        id:
          true,

        expiresAt:
          true,

        user: {
          select: {
            id:
              true,

            email:
              true,

            role:
              true,

            emailVerified:
              true,

            isActive:
              true,
          },
        },
      },
    });

  if (
    !session
  ) {
    return null;
  }

  if (
    session.expiresAt.getTime() <=
    Date.now()
  ) {
    await prisma.session
      .delete({
        where: {
          id:
            session.id,
        },
      })
      .catch(
        () =>
          undefined,
      );

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

    email:
      session.user.email
        .trim()
        .toLowerCase(),
  };
}

function getPaymentIdempotencyKey({
  input,
  orderId,
}: {
  input:
    CreatePaymentInput;
  orderId:
    string;
}): string {
  return (
    normalizeText(
      input.idempotencyKey,
    ) ||
    `fedapay_order_${orderId}`
  );
}

function buildReturnUrl({
  baseUrl,
  paymentId,
  orderId,
}: {
  baseUrl:
    string;
  paymentId:
    string;
  orderId:
    string;
}): string {
  const url =
    new URL(
      baseUrl,
    );

  url.searchParams.set(
    "paymentId",
    paymentId,
  );

  url.searchParams.set(
    "orderId",
    orderId,
  );

  return url.toString();
}

function buildProviderMetadata({
  paymentId,
  orderId,
  orderReference,
  currency,
  paymentMethod,
}: {
  paymentId:
    string;
  orderId:
    string;
  orderReference:
    string;
  currency:
    string;
  paymentMethod:
    string;
}): Record<
  string,
  unknown
> {
  return {
    source:
      "TIKEMIA",

    paymentId,

    orderId,

    orderReference,

    currency,

    requestedPaymentMethod:
      paymentMethod,
  };
}

function decimalToProviderAmount(
  amount:
    Prisma.Decimal,
  currency:
    string,
): number {
  const normalizedCurrency =
    currency
      .trim()
      .toUpperCase();

  const decimalPlaces =
    amount.decimalPlaces();

  if (
    normalizedCurrency ===
      "XOF" &&
    decimalPlaces >
      0
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_AMOUNT_MISMATCH",

      message:
        "Le montant XOF de la commande doit être un nombre entier.",

      status:
        409,

      details: {
        amount:
          amount.toFixed(
            2,
          ),

        currency:
          normalizedCurrency,
      },
    });
  }

  const numericAmount =
    amount.toNumber();

  if (
    !Number.isSafeInteger(
      numericAmount,
    ) ||
    numericAmount <=
      0
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_AMOUNT_MISMATCH",

      message:
        "Le montant de la commande ne peut pas être envoyé au prestataire.",

      status:
        409,

      details: {
        amount:
          amount.toFixed(
            2,
          ),

        currency:
          normalizedCurrency,
      },
    });
  }

  return numericAmount;
}

function assertOrderCanBePaid({
  order,
  now,
}: {
  order: {
    id: string;
    status: string;
    reservationExpiresAt: Date | null;
    total: Prisma.Decimal;
  };
  now:
    Date;
}): void {
  if (
    order.status ===
      "PAID"
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_ORDER_ALREADY_PAID",

      message:
        "Cette commande est déjà payée.",

      status:
        409,

      orderId:
        order.id,
    });
  }

  if (
    order.status ===
      "CANCELLED" ||
    order.status ===
      "EXPIRED" ||
    order.status ===
      "REFUNDED" ||
    order.status ===
      "PARTIALLY_REFUNDED"
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_ORDER_NOT_PAYABLE",

      message:
        "Cette commande ne peut plus être payée.",

      status:
        409,

      orderId:
        order.id,

      details: {
        orderStatus:
          order.status,
      },
    });
  }

  if (
    order.reservationExpiresAt &&
    order.reservationExpiresAt.getTime() <=
      now.getTime()
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_RESERVATION_EXPIRED",

      message:
        "La réservation des billets a expiré. Recommencez la commande.",

      status:
        409,

      orderId:
        order.id,
    });
  }

  if (
    order.total.lte(
      0,
    )
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_AMOUNT_MISMATCH",

      message:
        "Le montant de cette commande est invalide.",

      status:
        409,

      orderId:
        order.id,
    });
  }
}

function assertRequesterCanPayOrder({
  order,
  customer,
  checkoutToken,
}: {
  order: {
    id: string;
    customerId: string | null;
    checkoutTokenHash: string | null;
  };
  customer:
    AuthenticatedCustomer | null;
  checkoutToken:
    string | undefined;
}): void {
  if (
    customer
  ) {
    if (
      order.customerId !==
      customer.id
    ) {
      throw new PaymentValidationError({
        code:
          "PAYMENT_ORDER_OWNERSHIP_MISMATCH",

        message:
          "Cette commande n’appartient pas à votre compte.",

        status:
          403,

        orderId:
          order.id,
      });
    }

    return;
  }

  if (
    order.customerId
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_UNAUTHORIZED",

      message:
        "Connectez-vous pour payer cette commande.",

      status:
        401,

      orderId:
        order.id,
    });
  }

  const normalizedCheckoutToken =
    normalizeText(
      checkoutToken,
    );

  if (
    !normalizedCheckoutToken ||
    !order.checkoutTokenHash
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_UNAUTHORIZED",

      message:
        "Le jeton sécurisé de la commande est obligatoire.",

      status:
        401,

      orderId:
        order.id,
    });
  }

  const suppliedTokenHash =
    hashToken(
      normalizedCheckoutToken,
    );

  if (
    !secureHashEquals(
      suppliedTokenHash,
      order.checkoutTokenHash,
    )
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_FORBIDDEN",

      message:
        "Le jeton sécurisé de cette commande est invalide.",

      status:
        403,

      orderId:
        order.id,
    });
  }
}

async function markPaymentAttemptFailed({
  paymentId,
  attemptId,
  orderId,
  error,
}: {
  paymentId:
    string;
  attemptId:
    string;
  orderId:
    string;
  error:
    PaymentError;
}): Promise<void> {
  const now =
    new Date();

  await prisma
    .$transaction([
      prisma.payment.updateMany({
        where: {
          id:
            paymentId,

          status: {
            in: [
              PaymentStatus.PENDING,
              PaymentStatus.PROCESSING,
            ],
          },
        },

        data: {
          status:
            PaymentStatus.FAILED,

          failureCode:
            error.code,

          failureReason:
            error.exposeMessage
              ? error.message
              : "Le prestataire de paiement n’a pas pu préparer la transaction.",

          failedAt:
            now,
        },
      }),

      prisma.paymentAttempt.updateMany({
        where: {
          id:
            attemptId,

          status: {
            in: [
              PaymentStatus.PENDING,
              PaymentStatus.PROCESSING,
            ],
          },
        },

        data: {
          status:
            PaymentStatus.FAILED,

          failureCode:
            error.code,

          failureReason:
            error.exposeMessage
              ? error.message
              : "La tentative de paiement n’a pas pu être préparée.",

          failedAt:
            now,
        },
      }),

      prisma.order.updateMany({
        where: {
          id:
            orderId,

          status:
            "PROCESSING",
        },

        data: {
          status:
            "PENDING",
        },
      }),
    ])
    .catch(
      (
        persistenceError,
      ) => {
        console.error(
          "[CLIENT_PAYMENT_FAILURE_PERSIST_ERROR]",
          getPaymentErrorLogContext(
            persistenceError,
          ),
        );
      },
    );
}

export async function POST(
  request:
    Request,
) {
  let paymentId:
    string | null =
    null;

  let attemptId:
    string | null =
    null;

  let orderId:
    string | null =
    null;

  try {
    let rawBody:
      unknown;

    try {
      rawBody =
        await request.json();
    } catch {
      return jsonResponse(
        {
          success:
            false,

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
      createPaymentSchema.safeParse(
        rawBody,
      );

    if (
      !parsedBody.success
    ) {
      return jsonResponse(
        {
          success:
            false,

          error: {
            code:
              "PAYMENT_INVALID_REQUEST",

            message:
              parsedBody.error
                .issues[0]
                ?.message ??
              "Les informations du paiement sont invalides.",

            field:
              parsedBody.error
                .issues[0]
                ?.path
                .join(
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

    orderId =
      input.orderId;

    const [
      customer,
      config,
    ] =
      await Promise.all([
        getAuthenticatedCustomer(),

        Promise.resolve(
          getFedaPayConfig(),
        ),
      ]);

    const now =
      new Date();

    const order =
      await prisma.order.findUnique({
        where: {
          id:
            input.orderId,
        },

        select: {
          id:
            true,

          reference:
            true,

          customerId:
            true,

          customerName:
            true,

          customerEmail:
            true,

          customerPhone:
            true,

          checkoutTokenHash:
            true,

          currency:
            true,

          total:
            true,

          status:
            true,

          reservationExpiresAt:
            true,

          event: {
            select: {
              id:
                true,

              title:
                true,

              countryCode:
                true,
            },
          },

          payment: {
            select: {
              id:
                true,

              provider:
                true,

              providerTransactionId:
                true,

              providerReference:
                true,

              method:
                true,

              status:
                true,

              amount:
                true,

              currency:
                true,

              checkoutUrl:
                true,

              expiresAt:
                true,

              idempotencyKey:
                true,
            },
          },

          reservations: {
            where: {
              status:
                "PENDING",
            },

            select: {
              id:
                true,

              expiresAt:
                true,
            },
          },
        },
      });

    if (
      !order
    ) {
      throw new PaymentValidationError({
        code:
          "PAYMENT_ORDER_NOT_FOUND",

        message:
          "La commande est introuvable.",

        status:
          404,

        orderId:
          input.orderId,
      });
    }

    assertRequesterCanPayOrder({
      order,

      customer,

      checkoutToken:
        input.checkoutToken,
    });

    assertOrderCanBePaid({
      order,
      now,
    });

    if (
      order.reservations.length ===
      0
    ) {
      throw new PaymentValidationError({
        code:
          "PAYMENT_RESERVATION_NOT_FOUND",

        message:
          "Aucune réservation active n’est associée à cette commande.",

        status:
          409,

        orderId:
          order.id,
      });
    }

    if (
      order.reservations.some(
        (
          reservation,
        ) =>
          reservation.expiresAt.getTime() <=
          now.getTime(),
      )
    ) {
      throw new PaymentValidationError({
        code:
          "PAYMENT_RESERVATION_EXPIRED",

        message:
          "La réservation des billets a expiré. Recommencez la commande.",

        status:
          409,

        orderId:
          order.id,
      });
    }

    if (
      order.payment?.status ===
        PaymentStatus.SUCCESS
    ) {
      return jsonResponse({
        success:
          true,

        code:
          "PAYMENT_ALREADY_SUCCESSFUL",

        message:
          "Cette commande est déjà payée.",

        payment: {
          id:
            order.payment.id,

          status:
            order.payment.status,

          orderId:
            order.id,

          orderReference:
            order.reference,
        },
      });
    }

    if (
      order.payment &&
      (
        order.payment.status ===
          PaymentStatus.PENDING ||
        order.payment.status ===
          PaymentStatus.PROCESSING
      ) &&
      order.payment.checkoutUrl &&
      (
        !order.payment.expiresAt ||
        order.payment.expiresAt.getTime() >
          now.getTime()
      )
    ) {
      return jsonResponse({
        success:
          true,

        code:
          "PAYMENT_ALREADY_PREPARED",

        message:
          "Le paiement est déjà prêt.",

        payment: {
          id:
            order.payment.id,

          status:
            order.payment.status,

          provider:
            order.payment.provider,

          method:
            order.payment.method,

          checkoutUrl:
            order.payment.checkoutUrl,

          expiresAt:
            order.payment.expiresAt
              ?.toISOString() ??
            null,

          orderId:
            order.id,

          orderReference:
            order.reference,
        },
      });
    }

    const paymentIdempotencyKey =
      getPaymentIdempotencyKey({
        input,
        orderId:
          order.id,
      });

    const providerAmount =
      decimalToProviderAmount(
        order.total,
        order.currency,
      );

    const paymentExpiresAt =
      order.reservationExpiresAt ??
      new Date(
        now.getTime() +
          config.reservationMinutes *
            60_000,
      );

    const prepared =
      await prisma.$transaction(
        async (
          transaction,
        ) => {
          const payment =
            order.payment
              ? await transaction
                  .payment
                  .update({
                    where: {
                      id:
                        order.payment.id,
                    },

                    data: {
                      provider:
                        PAYMENT_PROVIDER,

                      method:
                        input.paymentMethod,

                      amount:
                        order.total,

                      currency:
                        order.currency,

                      status:
                        PaymentStatus.PROCESSING,

                      checkoutUrl:
                        null,

                      returnUrl:
                        null,

                      cancelUrl:
                        null,

                      idempotencyKey:
                        paymentIdempotencyKey,

                      failureCode:
                        null,

                      failureReason:
                        null,

                      initiatedAt:
                        now,

                      processingAt:
                        now,

                      expiresAt:
                        paymentExpiresAt,

                      failedAt:
                        null,

                      cancelledAt:
                        null,
                    },

                    select: {
                      id:
                        true,
                    },
                  })
              : await transaction
                  .payment
                  .create({
                    data: {
                      orderId:
                        order.id,

                      provider:
                        PAYMENT_PROVIDER,

                      method:
                        input.paymentMethod,

                      amount:
                        order.total,

                      currency:
                        order.currency,

                      status:
                        PaymentStatus.PROCESSING,

                      idempotencyKey:
                        paymentIdempotencyKey,

                      customerEmail:
                        order.customerEmail,

                      customerPhone:
                        order.customerPhone,

                      initiatedAt:
                        now,

                      processingAt:
                        now,

                      expiresAt:
                        paymentExpiresAt,

                      metadata: {
                        orderReference:
                          order.reference,

                        eventId:
                          order.event.id,

                        requestedPaymentMethod:
                          input.paymentMethod,
                      },
                    },

                    select: {
                      id:
                        true,
                    },
                  });

          const existingAttempt =
            await transaction
              .paymentAttempt
              .findUnique({
                where: {
                  idempotencyKey:
                    paymentIdempotencyKey,
                },

                select: {
                  id:
                    true,
                },
              });

          const attempt =
            existingAttempt
              ? await transaction
                  .paymentAttempt
                  .update({
                    where: {
                      id:
                        existingAttempt.id,
                    },

                    data: {
                      paymentId:
                        payment.id,

                      provider:
                        PAYMENT_PROVIDER,

                      method:
                        input.paymentMethod,

                      amount:
                        order.total,

                      currency:
                        order.currency,

                      status:
                        PaymentStatus.PROCESSING,

                      checkoutUrl:
                        null,

                      providerReference:
                        null,

                      providerTransactionId:
                        null,

                      failureCode:
                        null,

                      failureReason:
                        null,

                      initiatedAt:
                        now,

                      processingAt:
                        now,

                      expiresAt:
                        paymentExpiresAt,

                      failedAt:
                        null,

                      cancelledAt:
                        null,

                      requestPayload: {
                        orderId:
                          order.id,

                        orderReference:
                          order.reference,

                        requestedPaymentMethod:
                          input.paymentMethod,

                        amount:
                          order.total.toFixed(
                            2,
                          ),

                        currency:
                          order.currency,
                      },
                    },

                    select: {
                      id:
                        true,
                    },
                  })
              : await transaction
                  .paymentAttempt
                  .create({
                    data: {
                      paymentId:
                        payment.id,

                      provider:
                        PAYMENT_PROVIDER,

                      method:
                        input.paymentMethod,

                      amount:
                        order.total,

                      currency:
                        order.currency,

                      status:
                        PaymentStatus.PROCESSING,

                      idempotencyKey:
                        paymentIdempotencyKey,

                      initiatedAt:
                        now,

                      processingAt:
                        now,

                      expiresAt:
                        paymentExpiresAt,

                      requestPayload: {
                        orderId:
                          order.id,

                        orderReference:
                          order.reference,

                        requestedPaymentMethod:
                          input.paymentMethod,

                        amount:
                          order.total.toFixed(
                            2,
                          ),

                        currency:
                          order.currency,
                      },
                    },

                    select: {
                      id:
                        true,
                    },
                  });

          await transaction
            .order
            .update({
              where: {
                id:
                  order.id,
              },

              data: {
                status:
                  "PROCESSING",
              },
            });

          return {
            paymentId:
              payment.id,

            attemptId:
              attempt.id,
          };
        },
        {
          isolationLevel:
            Prisma
              .TransactionIsolationLevel
              .Serializable,

          maxWait:
            10_000,

          timeout:
            20_000,
        },
      );

    paymentId =
      prepared.paymentId;

    attemptId =
      prepared.attemptId;

    const returnUrl =
      buildReturnUrl({
        baseUrl:
          config.successUrl,

        paymentId,

        orderId:
          order.id,
      });

    const cancelUrl =
      buildReturnUrl({
        baseUrl:
          config.cancelUrl,

        paymentId,

        orderId:
          order.id,
      });

    const customerNameParts =
      order.customerName
        .trim()
        .split(
          /\s+/,
        )
        .filter(
          Boolean,
        );

    const firstName =
      customerNameParts[0] ??
      "Client";

    const lastName =
      customerNameParts
        .slice(
          1,
        )
        .join(
          " ",
        ) ||
      "Tikemia";

    const hostedCheckout =
      await createFedaPayHostedCheckout({
        transaction: {
          amount:
            providerAmount,

          currency:
            order.currency,

          description:
            `Commande Tikemia ${order.reference} — ${order.event.title}`,

          callbackUrl:
            returnUrl,

          customer: {
            email:
              order.customerEmail,

            firstname:
              firstName,

            lastname:
              lastName,

            ...(order.customerPhone
              ? {
                  phoneNumber: {
                    number:
                      order.customerPhone,

                    country:
                      normalizeText(
                        order.event.countryCode,
                      ).toUpperCase() ||
                      "BJ",
                  },
                }
              : {}),

          },

          metadata:
            buildProviderMetadata({
              paymentId,

              orderId:
                order.id,

              orderReference:
                order.reference,

              currency:
                order.currency,

              paymentMethod:
                input.paymentMethod,
            }),
        },

        idempotencyKey:
          paymentIdempotencyKey,
      });

    const providerTransactionId =
      String(
        hostedCheckout
          .transaction
          .id,
      );

    const providerReference =
      hostedCheckout
        .transaction
        .reference;

    const checkoutUrl =
      hostedCheckout
        .paymentLink
        .url;

    await prisma.$transaction(
      async (
        transaction,
      ) => {
        await transaction
          .payment
          .update({
            where: {
              id:
                paymentId!,
            },

            data: {
              providerTransactionId,

              providerReference,

              checkoutUrl,

              returnUrl,

              cancelUrl,

              status:
                PaymentStatus.PENDING,

              metadata: {
                orderReference:
                  order.reference,

                eventId:
                  order.event.id,

                requestedPaymentMethod:
                  input.paymentMethod,

                fedapayTransactionId:
                  hostedCheckout
                    .transaction
                    .id,

                fedapayToken:
                  hostedCheckout
                    .paymentLink
                    .token,
              },
            },
          });

        await transaction
          .paymentAttempt
          .update({
            where: {
              id:
                attemptId!,
            },

            data: {
              providerTransactionId,

              providerReference,

              checkoutUrl,

              status:
                PaymentStatus.PENDING,

              responsePayload: {
                transactionId:
                  hostedCheckout
                    .transaction
                    .id,

                transactionReference:
                  providerReference,

                transactionStatus:
                  hostedCheckout
                    .transaction
                    .rawStatus,

                checkoutUrl,

                token:
                  hostedCheckout
                    .paymentLink
                    .token,
              },
            },
          });

        await transaction
          .order
          .update({
            where: {
              id:
                order.id,
            },

            data: {
              status:
                "PENDING",
            },
          });
      },
      {
        isolationLevel:
          Prisma
            .TransactionIsolationLevel
            .Serializable,

        maxWait:
          10_000,

        timeout:
          20_000,
      },
    );

    return jsonResponse(
      {
        success:
          true,

        message:
          "Le paiement sécurisé a été préparé.",

        payment: {
          id:
            paymentId,

          orderId:
            order.id,

          orderReference:
            order.reference,

          provider:
            PAYMENT_PROVIDER,

          method:
            input.paymentMethod,

          status:
            PaymentStatus.PENDING,

          amount:
            order.total.toFixed(
              2,
            ),

          currency:
            order.currency,

          checkoutUrl,

          returnUrl,

          cancelUrl,

          expiresAt:
            paymentExpiresAt.toISOString(),
        },
      },
      201,
    );
  } catch (
    error
  ) {
    const paymentError =
      getPaymentError(
        error,
        {
          code:
            "PAYMENT_INTERNAL_ERROR",

          message:
            "Impossible de préparer le paiement pour le moment.",

          status:
            500,

          exposeMessage:
            false,

          provider:
            PAYMENT_PROVIDER,

          paymentId,

          orderId,
        },
      );

    console.error(
      "[CLIENT_PAYMENT_CREATE_ERROR]",
      getPaymentErrorLogContext(
        paymentError,
      ),
    );

    if (
      paymentId &&
      attemptId &&
      orderId
    ) {
      await markPaymentAttemptFailed({
        paymentId,
        attemptId,
        orderId,
        error:
          paymentError,
      });
    }

    return jsonResponse(
      paymentError.toJSON() as unknown as Record<
        string,
        unknown
      >,
      paymentError.status,
    );
  }
}