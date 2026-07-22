import "server-only";

import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  TicketStatus,
} from "@prisma/client";

import {
  DEFAULT_CURRENCY_CODE,
  getCurrencyDefinition,
  isSupportedCurrencyCode,
  type SupportedCurrencyCode,
} from "@/lib/localization/currencies";
import {
  roundMoneyAmount,
} from "@/lib/localization/format-money";
import { prisma } from "@/lib/prisma";

export type OrganizerOrderDetailTicket = {
  id: string;
  code: string;
  qrCodeValue: string;
  status: TicketStatus;

  holder: {
    name: string;
    email: string;
    phone: string | null;
  };

  ticketType: {
    id: string;
    name: string;
    description: string | null;
  };

  usedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrganizerOrderDetailItem = {
  id: string;
  ticketTypeId: string;
  ticketTypeName: string;
  ticketTypeDescription: string | null;

  quantity: number;
  unitPrice: number;
  subtotal: number;
  platformFee: number;
  total: number;

  tickets: OrganizerOrderDetailTicket[];
};

export type OrganizerOrderDetailPayment = {
  id: string;
  provider: string;
  providerReference: string | null;
  method: string;

  amount: number;
  currency: SupportedCurrencyCode;
  status: PaymentStatus;

  failureReason: string | null;
  metadata: Prisma.JsonValue | null;

  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
} | null;

export type OrganizerOrderDetails = {
  id: string;
  reference: string;
  status: OrderStatus;

  currency: SupportedCurrencyCode;
  subtotal: number;
  platformFee: number;
  total: number;
  organizerNet: number;

  paidAt: string | null;
  createdAt: string;
  updatedAt: string;

  organizer: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;

    profile: {
      businessName: string | null;
      logo: string | null;
      avatar: string | null;
    } | null;
  };

  customer: {
    id: string | null;
    name: string;
    email: string;
    phone: string;
    country: string | null;
    countryCode: string | null;
    isGuest: boolean;
    accountActive: boolean | null;
    emailVerified: boolean | null;
  };

  event: {
    id: string;
    title: string;
    slug: string;
    description: string;
    coverImage: string | null;

    venueName: string;
    address: string;
    city: string;
    country: string;
    countryCode: string;
    timezone: string;

    startsAt: string;
    endsAt: string | null;

    currency: SupportedCurrencyCode;
    platformFeeRate: number;
    status: string;

    category: {
      id: string;
      name: string;
      slug: string;
    } | null;
  };

  payment: OrganizerOrderDetailPayment;
  items: OrganizerOrderDetailItem[];
  tickets: OrganizerOrderDetailTicket[];

  ticketSummary: {
    total: number;
    valid: number;
    used: number;
    cancelled: number;
    refunded: number;
  };

  integrity: {
    orderCurrencyMatchesEvent: boolean;
    paymentCurrencyMatchesOrder: boolean | null;
    paymentAmountMatchesOrderTotal: boolean | null;
    itemQuantitiesMatchTickets: boolean;
    hasFinancialInconsistency: boolean;
  };
};

export type GetOrganizerOrderDetailsResult = {
  generatedAt: string;
  order: OrganizerOrderDetails;
};

export class GetOrganizerOrderDetailsError extends Error {
  readonly code: string;
  readonly status: number;

  constructor({
    code,
    message,
    status = 500,
  }: {
    code: string;
    message: string;
    status?: number;
  }) {
    super(message);

    this.name =
      "GetOrganizerOrderDetailsError";
    this.code = code;
    this.status = status;
  }
}

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function decimalToNumber(
  value:
    | Prisma.Decimal
    | number
    | string
    | null
    | undefined,
): number {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function normalizeCurrency(
  value: string | null | undefined,
): SupportedCurrencyCode | null {
  const normalized =
    value?.trim().toUpperCase() ?? "";

  if (
    !isSupportedCurrencyCode(
      normalized,
    )
  ) {
    return null;
  }

  return getCurrencyDefinition(
    normalized,
  )?.active
    ? normalized
    : null;
}

function resolveCurrency(
  value: string | null | undefined,
): SupportedCurrencyCode {
  return (
    normalizeCurrency(value) ??
    DEFAULT_CURRENCY_CODE
  );
}

function normalizeMoney(
  value: number,
  currency: SupportedCurrencyCode,
): number {
  return roundMoneyAmount({
    amount: value,
    currency,
  });
}

function isSameMoney(
  first: number,
  second: number,
  currency: SupportedCurrencyCode,
): boolean {
  return (
    normalizeMoney(
      first,
      currency,
    ) ===
    normalizeMoney(
      second,
      currency,
    )
  );
}

function buildTicketSummary(
  tickets: Array<{
    status: TicketStatus;
  }>,
) {
  const summary = {
    total:
      tickets.length,
    valid:
      0,
    used:
      0,
    cancelled:
      0,
    refunded:
      0,
  };

  for (const ticket of tickets) {
    if (ticket.status === "VALID") {
      summary.valid += 1;
    } else if (
      ticket.status === "USED"
    ) {
      summary.used += 1;
    } else if (
      ticket.status === "CANCELLED"
    ) {
      summary.cancelled += 1;
    } else if (
      ticket.status === "REFUNDED"
    ) {
      summary.refunded += 1;
    }
  }

  return summary;
}

export async function getOrganizerOrderDetails({
  organizerId,
  orderId,
}: {
  organizerId: string;
  orderId: string;
}): Promise<GetOrganizerOrderDetailsResult> {
  const cleanOrganizerId =
    organizerId.trim();

  const cleanOrderId =
    orderId.trim();

  if (!cleanOrganizerId) {
    throw new GetOrganizerOrderDetailsError({
      code:
        "ORGANIZER_ID_REQUIRED",
      status:
        400,
      message:
        "L’identifiant de l’organisateur est obligatoire.",
    });
  }

  if (!cleanOrderId) {
    throw new GetOrganizerOrderDetailsError({
      code:
        "ORDER_ID_REQUIRED",
      status:
        400,
      message:
        "L’identifiant de la commande est obligatoire.",
    });
  }

  try {
    const organizer =
      await prisma.user.findFirst({
        where: {
          id:
            cleanOrganizerId,
          role:
            "ORGANIZER",
        },

        select: {
          id:
            true,
          isActive:
            true,
          emailVerified:
            true,
        },
      });

    if (!organizer) {
      throw new GetOrganizerOrderDetailsError({
        code:
          "ORGANIZER_NOT_FOUND",
        status:
          404,
        message:
          "Le compte organisateur est introuvable.",
      });
    }

    if (
      !organizer.isActive ||
      !organizer.emailVerified
    ) {
      throw new GetOrganizerOrderDetailsError({
        code:
          "ORGANIZER_FORBIDDEN",
        status:
          403,
        message:
          "Ce compte organisateur ne peut pas consulter cette commande.",
      });
    }

    const order =
      await prisma.order.findFirst({
        where: {
          id:
            cleanOrderId,

          event: {
            organizerId:
              cleanOrganizerId,
          },
        },

        select: {
          id:
            true,
          reference:
            true,
          customerName:
            true,
          customerEmail:
            true,
          customerPhone:
            true,
          currency:
            true,
          subtotal:
            true,
          platformFee:
            true,
          total:
            true,
          status:
            true,
          paidAt:
            true,
          createdAt:
            true,
          updatedAt:
            true,

          customer: {
            select: {
              id:
                true,
              firstName:
                true,
              lastName:
                true,
              email:
                true,
              phone:
                true,
              country:
                true,
              countryCode:
                true,
              emailVerified:
                true,
              isActive:
                true,
            },
          },

          event: {
            select: {
              id:
                true,
              title:
                true,
              slug:
                true,
              description:
                true,
              coverImage:
                true,
              venueName:
                true,
              address:
                true,
              city:
                true,
              country:
                true,
              countryCode:
                true,
              timezone:
                true,
              startsAt:
                true,
              endsAt:
                true,
              currency:
                true,
              platformFeeRate:
                true,
              status:
                true,

              category: {
                select: {
                  id:
                    true,
                  name:
                    true,
                  slug:
                    true,
                },
              },

              organizer: {
                select: {
                  id:
                    true,
                  firstName:
                    true,
                  lastName:
                    true,
                  email:
                    true,

                  organizerProfile: {
                    select: {
                      businessName:
                        true,
                      logo:
                        true,
                      avatar:
                        true,
                    },
                  },
                },
              },
            },
          },

          payment: {
            select: {
              id:
                true,
              provider:
                true,
              providerReference:
                true,
              method:
                true,
              amount:
                true,
              currency:
                true,
              status:
                true,
              failureReason:
                true,
              metadata:
                true,
              paidAt:
                true,
              createdAt:
                true,
              updatedAt:
                true,
            },
          },

          items: {
            orderBy: {
              id:
                "asc",
            },

            select: {
              id:
                true,
              ticketTypeId:
                true,
              quantity:
                true,
              unitPrice:
                true,
              subtotal:
                true,
              platformFee:
                true,
              total:
                true,

              ticketType: {
                select: {
                  id:
                    true,
                  name:
                    true,
                  description:
                    true,
                },
              },

              tickets: {
                orderBy: {
                  createdAt:
                    "asc",
                },

                select: {
                  id:
                    true,
                  code:
                    true,
                  qrCodeValue:
                    true,
                  holderName:
                    true,
                  holderEmail:
                    true,
                  holderPhone:
                    true,
                  status:
                    true,
                  usedAt:
                    true,
                  createdAt:
                    true,
                  updatedAt:
                    true,

                  ticketType: {
                    select: {
                      id:
                        true,
                      name:
                        true,
                      description:
                        true,
                    },
                  },
                },
              },
            },
          },

          tickets: {
            orderBy: {
              createdAt:
                "asc",
            },

            select: {
              id:
                true,
              code:
                true,
              qrCodeValue:
                true,
              holderName:
                true,
              holderEmail:
                true,
              holderPhone:
                true,
              status:
                true,
              usedAt:
                true,
              createdAt:
                true,
              updatedAt:
                true,

              ticketType: {
                select: {
                  id:
                    true,
                  name:
                    true,
                  description:
                    true,
                },
              },
            },
          },
        },
      });

    if (!order) {
      throw new GetOrganizerOrderDetailsError({
        code:
          "ORDER_NOT_FOUND",
        status:
          404,
        message:
          "Cette commande est introuvable ou n’appartient pas à cet organisateur.",
      });
    }

    const orderCurrency =
      resolveCurrency(
        order.currency,
      );

    const eventCurrency =
      resolveCurrency(
        order.event.currency,
      );

    const subtotal =
      normalizeMoney(
        decimalToNumber(
          order.subtotal,
        ),
        orderCurrency,
      );

    const platformFee =
      normalizeMoney(
        decimalToNumber(
          order.platformFee,
        ),
        orderCurrency,
      );

    const total =
      normalizeMoney(
        decimalToNumber(
          order.total,
        ),
        orderCurrency,
      );

    const organizerNet =
      normalizeMoney(
        Math.max(
          subtotal -
            platformFee,
          0,
        ),
        orderCurrency,
      );

    const mapTicket = (
      ticket: {
        id: string;
        code: string;
        qrCodeValue: string;
        holderName: string;
        holderEmail: string;
        holderPhone: string | null;
        status: TicketStatus;
        usedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        ticketType: {
          id: string;
          name: string;
          description: string | null;
        };
      },
    ): OrganizerOrderDetailTicket => ({
      id:
        ticket.id,
      code:
        ticket.code,
      qrCodeValue:
        ticket.qrCodeValue,
      status:
        ticket.status,

      holder: {
        name:
          normalizeText(
            ticket.holderName,
          ) ||
          "Détenteur Tikemia",

        email:
          normalizeText(
            ticket.holderEmail,
          ),

        phone:
          normalizeText(
            ticket.holderPhone,
          ) ||
          null,
      },

      ticketType: {
        id:
          ticket.ticketType.id,
        name:
          ticket.ticketType.name,
        description:
          ticket.ticketType.description,
      },

      usedAt:
        ticket.usedAt?.toISOString() ??
        null,

      createdAt:
        ticket.createdAt.toISOString(),

      updatedAt:
        ticket.updatedAt.toISOString(),
    });

    const tickets =
      order.tickets.map(
        mapTicket,
      );

    const items =
      order.items.map(
        (item) => ({
          id:
            item.id,
          ticketTypeId:
            item.ticketTypeId,
          ticketTypeName:
            item.ticketType.name,
          ticketTypeDescription:
            item.ticketType.description,
          quantity:
            item.quantity,

          unitPrice:
            normalizeMoney(
              decimalToNumber(
                item.unitPrice,
              ),
              orderCurrency,
            ),

          subtotal:
            normalizeMoney(
              decimalToNumber(
                item.subtotal,
              ),
              orderCurrency,
            ),

          platformFee:
            normalizeMoney(
              decimalToNumber(
                item.platformFee,
              ),
              orderCurrency,
            ),

          total:
            normalizeMoney(
              decimalToNumber(
                item.total,
              ),
              orderCurrency,
            ),

          tickets:
            item.tickets.map(
              mapTicket,
            ),
        }),
      );

    const paymentCurrency =
      order.payment
        ? resolveCurrency(
            order.payment.currency,
          )
        : null;

    const paymentAmount =
      order.payment
        ? normalizeMoney(
            decimalToNumber(
              order.payment.amount,
            ),
            paymentCurrency ??
              orderCurrency,
          )
        : null;

    const orderCurrencyMatchesEvent =
      orderCurrency ===
      eventCurrency;

    const paymentCurrencyMatchesOrder =
      order.payment
        ? paymentCurrency ===
          orderCurrency
        : null;

    const paymentAmountMatchesOrder =
      order.payment
        ? isSameMoney(
            paymentAmount ?? 0,
            total,
            orderCurrency,
          )
        : null;

    const itemQuantitiesMatchTickets =
      items.every(
        (item) =>
          item.quantity ===
          item.tickets.length,
      );

    const hasFinancialInconsistency =
      !orderCurrencyMatchesEvent ||
      paymentCurrencyMatchesOrder ===
        false ||
      paymentAmountMatchesOrder ===
        false ||
      !itemQuantitiesMatchTickets;

    const organizerFullName =
      `${order.event.organizer.firstName} ${order.event.organizer.lastName}`
        .replace(/\s+/g, " ")
        .trim();

    return {
      generatedAt:
        new Date().toISOString(),

      order: {
        id:
          order.id,
        reference:
          order.reference,
        status:
          order.status,

        currency:
          orderCurrency,
        subtotal,
        platformFee,
        total,
        organizerNet,

        paidAt:
          order.paidAt?.toISOString() ??
          null,

        createdAt:
          order.createdAt.toISOString(),

        updatedAt:
          order.updatedAt.toISOString(),

        organizer: {
          id:
            order.event.organizer.id,
          firstName:
            order.event.organizer.firstName,
          lastName:
            order.event.organizer.lastName,
          fullName:
            organizerFullName ||
            "Organisateur Tikemia",
          email:
            order.event.organizer.email,

          profile:
            order.event.organizer.organizerProfile
              ? {
                  businessName:
                    order.event.organizer.organizerProfile.businessName,

                  logo:
                    order.event.organizer.organizerProfile.logo,

                  avatar:
                    order.event.organizer.organizerProfile.avatar,
                }
              : null,
        },

        customer: {
          id:
            order.customer?.id ??
            null,

          name:
            normalizeText(
              order.customerName,
            ) ||
            (
              order.customer
                ? `${order.customer.firstName} ${order.customer.lastName}`.trim()
                : "Acheteur invité"
            ),

          email:
            normalizeText(
              order.customerEmail,
            ) ||
            order.customer?.email ||
            "",

          phone:
            normalizeText(
              order.customerPhone,
            ) ||
            order.customer?.phone ||
            "",

          country:
            order.customer?.country ??
            null,

          countryCode:
            order.customer?.countryCode ??
            null,

          isGuest:
            !order.customer,

          accountActive:
            order.customer?.isActive ??
            null,

          emailVerified:
            order.customer?.emailVerified ??
            null,
        },

        event: {
          id:
            order.event.id,
          title:
            order.event.title,
          slug:
            order.event.slug,
          description:
            order.event.description,
          coverImage:
            order.event.coverImage,

          venueName:
            order.event.venueName,
          address:
            order.event.address,
          city:
            order.event.city,
          country:
            order.event.country,
          countryCode:
            order.event.countryCode,
          timezone:
            order.event.timezone,

          startsAt:
            order.event.startsAt.toISOString(),

          endsAt:
            order.event.endsAt?.toISOString() ??
            null,

          currency:
            eventCurrency,

          platformFeeRate:
            decimalToNumber(
              order.event.platformFeeRate,
            ),

          status:
            order.event.status,

          category:
            order.event.category
              ? {
                  id:
                    order.event.category.id,
                  name:
                    order.event.category.name,
                  slug:
                    order.event.category.slug,
                }
              : null,
        },

        payment:
          order.payment
            ? {
                id:
                  order.payment.id,
                provider:
                  order.payment.provider,
                providerReference:
                  order.payment.providerReference,
                method:
                  order.payment.method,
                amount:
                  paymentAmount ?? 0,
                currency:
                  paymentCurrency ??
                  orderCurrency,
                status:
                  order.payment.status,
                failureReason:
                  order.payment.failureReason,
                metadata:
                  order.payment.metadata,
                paidAt:
                  order.payment.paidAt?.toISOString() ??
                  null,
                createdAt:
                  order.payment.createdAt.toISOString(),
                updatedAt:
                  order.payment.updatedAt.toISOString(),
              }
            : null,

        items,
        tickets,

        ticketSummary:
          buildTicketSummary(
            order.tickets,
          ),

        integrity: {
          orderCurrencyMatchesEvent,
          paymentCurrencyMatchesOrder,

          paymentAmountMatchesOrderTotal:
            paymentAmountMatchesOrder,

          itemQuantitiesMatchTickets,
          hasFinancialInconsistency,
        },
      },
    };
  } catch (error) {
    if (
      error instanceof
      GetOrganizerOrderDetailsError
    ) {
      throw error;
    }

    console.error(
      "[GET_ORGANIZER_ORDER_DETAILS_ERROR]",
      error instanceof Error
        ? {
            name:
              error.name,
            message:
              error.message,
            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    throw new GetOrganizerOrderDetailsError({
      code:
        "GET_ORGANIZER_ORDER_DETAILS_FAILED",
      status:
        500,
      message:
        "Impossible de charger les détails de cette commande pour le moment.",
    });
  }
}