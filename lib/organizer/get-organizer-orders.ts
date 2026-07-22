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

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 100;

const ORDER_STATUSES: readonly OrderStatus[] = [
  "PENDING",
  "PAID",
  "CANCELLED",
  "REFUNDED",
  "FAILED",
];

const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "PENDING",
  "SUCCESS",
  "FAILED",
  "REFUNDED",
];

export type OrganizerOrdersSort =
  | "NEWEST"
  | "OLDEST"
  | "AMOUNT_HIGH"
  | "AMOUNT_LOW";

export type GetOrganizerOrdersParams = {
  organizerId: string;
  page?: number;
  pageSize?: number;
  search?: string | null;
  eventId?: string | null;
  status?: string | null;
  currency?: string | null;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  dateFrom?: string | Date | null;
  dateTo?: string | Date | null;
  sort?: OrganizerOrdersSort;
};

export type OrganizerOrdersCurrencyTotal = {
  currency: SupportedCurrencyCode;
  ordersCount: number;
  paidOrdersCount: number;
  ticketsCount: number;
  subtotal: number;
  platformFees: number;
  grossTotal: number;
  organizerNet: number;
};

export type OrganizerOrdersSummary = {
  totalOrders: number;
  paidOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  refundedOrders: number;
  failedOrders: number;

  totalTickets: number;
  validTickets: number;
  usedTickets: number;
  cancelledTickets: number;
  refundedTickets: number;

  uniqueCustomers: number;
  guestOrders: number;
  registeredCustomerOrders: number;

  totalsByCurrency: OrganizerOrdersCurrencyTotal[];
};

export type OrganizerOrderListItem = {
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

  customer: {
    id: string | null;
    name: string;
    email: string;
    phone: string;
    country: string | null;
    countryCode: string | null;
    isGuest: boolean;
  };

  event: {
    id: string;
    title: string;
    slug: string;
    coverImage: string | null;
    startsAt: string;
    endsAt: string | null;
    venueName: string;
    city: string;
    country: string;
    countryCode: string;
    timezone: string;
    currency: SupportedCurrencyCode;
  };

  payment: {
    id: string;
    provider: string;
    providerReference: string | null;
    method: string;
    amount: number;
    currency: SupportedCurrencyCode;
    status: PaymentStatus;
    failureReason: string | null;
    paidAt: string | null;
  } | null;

  items: Array<{
    id: string;
    ticketTypeId: string;
    ticketTypeName: string;
    ticketTypeDescription: string | null;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    platformFee: number;
    total: number;
  }>;

  ticketSummary: {
    total: number;
    valid: number;
    used: number;
    cancelled: number;
    refunded: number;
  };
};

export type GetOrganizerOrdersResult = {
  generatedAt: string;

  summary: OrganizerOrdersSummary;
  orders: OrganizerOrderListItem[];

  filters: {
    events: Array<{
      id: string;
      title: string;
      slug: string;
      currency: SupportedCurrencyCode;
      startsAt: string;
    }>;

    currencies: Array<{
      code: SupportedCurrencyCode;
      name: string;
      symbol: string;
      fractionDigits: number;
    }>;

    orderStatuses: OrderStatus[];
    paymentStatuses: PaymentStatus[];
    paymentMethods: string[];
  };

  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };

  appliedFilters: {
    search: string;
    eventId: string | null;
    status: OrderStatus | null;
    currency: SupportedCurrencyCode | null;
    paymentStatus: PaymentStatus | null;
    paymentMethod: string | null;
    dateFrom: string | null;
    dateTo: string | null;
    sort: OrganizerOrdersSort;
  };
};

export class GetOrganizerOrdersError extends Error {
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

    this.name = "GetOrganizerOrdersError";
    this.code = code;
    this.status = status;
  }
}

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  const normalized = normalizeText(value);

  return normalized || null;
}

function normalizeInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return fallback;
  }

  return Math.min(
    Math.max(
      Math.trunc(value),
      minimum,
    ),
    maximum,
  );
}

function normalizeOrderStatus(
  value: string | null | undefined,
): OrderStatus | null {
  const normalized =
    value?.trim().toUpperCase() ?? "";

  return ORDER_STATUSES.includes(
    normalized as OrderStatus,
  )
    ? (normalized as OrderStatus)
    : null;
}

function normalizePaymentStatus(
  value: string | null | undefined,
): PaymentStatus | null {
  const normalized =
    value?.trim().toUpperCase() ?? "";

  return PAYMENT_STATUSES.includes(
    normalized as PaymentStatus,
  )
    ? (normalized as PaymentStatus)
    : null;
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

function parseDate(
  value: string | Date | null | undefined,
  endOfDay = false,
): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  if (
    endOfDay &&
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      value.trim(),
    )
  ) {
    date.setHours(
      23,
      59,
      59,
      999,
    );
  }

  return date;
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

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
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

function getOrderBy(
  sort: OrganizerOrdersSort,
): Prisma.OrderOrderByWithRelationInput[] {
  if (sort === "OLDEST") {
    return [
      { createdAt: "asc" },
      { id: "asc" },
    ];
  }

  if (sort === "AMOUNT_HIGH") {
    return [
      { total: "desc" },
      { createdAt: "desc" },
    ];
  }

  if (sort === "AMOUNT_LOW") {
    return [
      { total: "asc" },
      { createdAt: "desc" },
    ];
  }

  return [
    { createdAt: "desc" },
    { id: "desc" },
  ];
}

function buildWhere({
  organizerId,
  search,
  eventId,
  status,
  currency,
  paymentStatus,
  paymentMethod,
  dateFrom,
  dateTo,
}: {
  organizerId: string;
  search: string;
  eventId: string | null;
  status: OrderStatus | null;
  currency: SupportedCurrencyCode | null;
  paymentStatus: PaymentStatus | null;
  paymentMethod: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
}): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {
    event: {
      organizerId,
    },
  };

  if (eventId) {
    where.eventId = eventId;
  }

  if (status) {
    where.status = status;
  }

  if (currency) {
    where.currency = currency;
  }

  if (
    paymentStatus ||
    paymentMethod
  ) {
    where.payment = {
      is: {
        ...(paymentStatus
          ? {
              status:
                paymentStatus,
            }
          : {}),

        ...(paymentMethod
          ? {
              method: {
                equals:
                  paymentMethod,

                mode:
                  "insensitive",
              },
            }
          : {}),
      },
    };
  }

  if (
    dateFrom ||
    dateTo
  ) {
    where.createdAt = {
      ...(dateFrom
        ? {
            gte:
              dateFrom,
          }
        : {}),

      ...(dateTo
        ? {
            lte:
              dateTo,
          }
        : {}),
    };
  }

  if (search) {
    where.OR = [
      {
        reference: {
          contains:
            search,

          mode:
            "insensitive",
        },
      },
      {
        customerName: {
          contains:
            search,

          mode:
            "insensitive",
        },
      },
      {
        customerEmail: {
          contains:
            search,

          mode:
            "insensitive",
        },
      },
      {
        customerPhone: {
          contains:
            search,

          mode:
            "insensitive",
        },
      },
      {
        event: {
          title: {
            contains:
              search,

            mode:
              "insensitive",
          },
        },
      },
      {
        payment: {
          is: {
            providerReference: {
              contains:
                search,

              mode:
                "insensitive",
            },
          },
        },
      },
    ];
  }

  return where;
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

function buildCurrencyTotals({
  orders,
  tickets,
}: {
  orders: Array<{
    currency: string;
    status: OrderStatus;
    subtotal: Prisma.Decimal;
    platformFee: Prisma.Decimal;
    total: Prisma.Decimal;
  }>;

  tickets: Array<{
    status: TicketStatus;
    order: {
      currency: string;
    };
  }>;
}): OrganizerOrdersCurrencyTotal[] {
  const map =
    new Map<
      SupportedCurrencyCode,
      OrganizerOrdersCurrencyTotal
    >();

  function ensure(
    currency: SupportedCurrencyCode,
  ) {
    const current =
      map.get(currency);

    if (current) {
      return current;
    }

    const created: OrganizerOrdersCurrencyTotal = {
      currency,
      ordersCount:
        0,
      paidOrdersCount:
        0,
      ticketsCount:
        0,
      subtotal:
        0,
      platformFees:
        0,
      grossTotal:
        0,
      organizerNet:
        0,
    };

    map.set(
      currency,
      created,
    );

    return created;
  }

  for (const order of orders) {
    const currency =
      resolveCurrency(
        order.currency,
      );

    const total =
      ensure(currency);

    total.ordersCount += 1;

    if (order.status !== "PAID") {
      continue;
    }

    total.paidOrdersCount += 1;

    const subtotal =
      decimalToNumber(
        order.subtotal,
      );

    const fee =
      decimalToNumber(
        order.platformFee,
      );

    total.subtotal +=
      subtotal;

    total.platformFees +=
      fee;

    total.grossTotal +=
      decimalToNumber(
        order.total,
      );

    total.organizerNet +=
      Math.max(
        subtotal - fee,
        0,
      );
  }

  for (const ticket of tickets) {
    if (
      ticket.status !== "VALID" &&
      ticket.status !== "USED"
    ) {
      continue;
    }

    ensure(
      resolveCurrency(
        ticket.order.currency,
      ),
    ).ticketsCount += 1;
  }

  return Array.from(
    map.values(),
  )
    .map(
      (item) => ({
        ...item,

        subtotal:
          normalizeMoney(
            item.subtotal,
            item.currency,
          ),

        platformFees:
          normalizeMoney(
            item.platformFees,
            item.currency,
          ),

        grossTotal:
          normalizeMoney(
            item.grossTotal,
            item.currency,
          ),

        organizerNet:
          normalizeMoney(
            item.organizerNet,
            item.currency,
          ),
      }),
    )
    .sort(
      (first, second) =>
        first.currency.localeCompare(
          second.currency,
        ),
    );
}

export async function getOrganizerOrders({
  organizerId,
  page = DEFAULT_PAGE,
  pageSize = DEFAULT_PAGE_SIZE,
  search,
  eventId,
  status,
  currency,
  paymentStatus,
  paymentMethod,
  dateFrom,
  dateTo,
  sort = "NEWEST",
}: GetOrganizerOrdersParams): Promise<GetOrganizerOrdersResult> {
  const cleanOrganizerId =
    organizerId.trim();

  if (!cleanOrganizerId) {
    throw new GetOrganizerOrdersError({
      code:
        "ORGANIZER_ID_REQUIRED",

      status:
        400,

      message:
        "L’identifiant de l’organisateur est obligatoire.",
    });
  }

  const normalizedPage =
    normalizeInteger(
      page,
      DEFAULT_PAGE,
      1,
      1_000_000,
    );

  const normalizedPageSize =
    normalizeInteger(
      pageSize,
      DEFAULT_PAGE_SIZE,
      1,
      MAX_PAGE_SIZE,
    );

  const normalizedSearch =
    normalizeText(search);

  const normalizedEventId =
    normalizeOptionalText(
      eventId,
    );

  const normalizedStatus =
    normalizeOrderStatus(
      status,
    );

  const normalizedCurrency =
    normalizeCurrency(
      currency,
    );

  const normalizedPaymentStatus =
    normalizePaymentStatus(
      paymentStatus,
    );

  const normalizedPaymentMethod =
    normalizeOptionalText(
      paymentMethod,
    );

  const normalizedDateFrom =
    parseDate(dateFrom);

  const normalizedDateTo =
    parseDate(
      dateTo,
      true,
    );

  if (
    normalizedDateFrom &&
    normalizedDateTo &&
    normalizedDateFrom.getTime() >
      normalizedDateTo.getTime()
  ) {
    throw new GetOrganizerOrdersError({
      code:
        "INVALID_DATE_RANGE",

      status:
        422,

      message:
        "La date de début ne peut pas être postérieure à la date de fin.",
    });
  }

  const where =
    buildWhere({
      organizerId:
        cleanOrganizerId,

      search:
        normalizedSearch,

      eventId:
        normalizedEventId,

      status:
        normalizedStatus,

      currency:
        normalizedCurrency,

      paymentStatus:
        normalizedPaymentStatus,

      paymentMethod:
        normalizedPaymentMethod,

      dateFrom:
        normalizedDateFrom,

      dateTo:
        normalizedDateTo,
    });

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
        },
      });

    if (!organizer) {
      throw new GetOrganizerOrdersError({
        code:
          "ORGANIZER_NOT_FOUND",
        status:
          404,
        message:
          "Le compte organisateur est introuvable.",
      });
    }

    if (!organizer.isActive) {
      throw new GetOrganizerOrdersError({
        code:
          "ORGANIZER_DISABLED",
        status:
          403,
        message:
          "Ce compte organisateur est désactivé.",
      });
    }

    const totalItems =
      await prisma.order.count({
        where,
      });

    const totalPages =
      Math.max(
        Math.ceil(
          totalItems /
            normalizedPageSize,
        ),
        1,
      );

    const safePage =
      Math.min(
        normalizedPage,
        totalPages,
      );

    const [
      orders,
      statusGroups,
      summaryOrders,
      summaryTickets,
      uniqueCustomers,
      guestOrders,
      registeredCustomerOrders,
      filterEvents,
      filterCurrencies,
      filterPaymentMethods,
    ] = await Promise.all([
      prisma.order.findMany({
        where,

        orderBy:
          getOrderBy(sort),

        skip:
          (safePage - 1) *
          normalizedPageSize,

        take:
          normalizedPageSize,

        select: {
          id: true,
          reference: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          currency: true,
          subtotal: true,
          platformFee: true,
          total: true,
          status: true,
          paidAt: true,
          createdAt: true,
          updatedAt: true,

          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              country: true,
              countryCode: true,
            },
          },

          event: {
            select: {
              id: true,
              title: true,
              slug: true,
              coverImage: true,
              startsAt: true,
              endsAt: true,
              venueName: true,
              city: true,
              country: true,
              countryCode: true,
              timezone: true,
              currency: true,
            },
          },

          payment: {
            select: {
              id: true,
              provider: true,
              providerReference: true,
              method: true,
              amount: true,
              currency: true,
              status: true,
              failureReason: true,
              paidAt: true,
            },
          },

          items: {
            orderBy: {
              id:
                "asc",
            },

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
                  description: true,
                },
              },
            },
          },

          tickets: {
            select: {
              status:
                true,
            },
          },
        },
      }),

      prisma.order.groupBy({
        by: [
          "status",
        ],
        where,
        _count: {
          _all:
            true,
        },
      }),

      prisma.order.findMany({
        where,
        select: {
          currency: true,
          status: true,
          subtotal: true,
          platformFee: true,
          total: true,
        },
      }),

      prisma.ticket.findMany({
        where: {
          order: {
            is:
              where,
          },
        },
        select: {
          status: true,
          order: {
            select: {
              currency:
                true,
            },
          },
        },
      }),

      prisma.order.findMany({
        where,
        distinct: [
          "customerEmail",
        ],
        select: {
          customerEmail:
            true,
        },
      }),

      prisma.order.count({
        where: {
          AND: [
            where,
            {
              customerId:
                null,
            },
          ],
        },
      }),

      prisma.order.count({
        where: {
          AND: [
            where,
            {
              customerId: {
                not:
                  null,
              },
            },
          ],
        },
      }),

      prisma.event.findMany({
        where: {
          organizerId:
            cleanOrganizerId,
        },

        orderBy: [
          {
            startsAt:
              "desc",
          },
          {
            title:
              "asc",
          },
        ],

        select: {
          id: true,
          title: true,
          slug: true,
          currency: true,
          startsAt: true,
        },
      }),

      prisma.order.findMany({
        where: {
          event: {
            organizerId:
              cleanOrganizerId,
          },
        },

        distinct: [
          "currency",
        ],

        orderBy: {
          currency:
            "asc",
        },

        select: {
          currency:
            true,
        },
      }),

      prisma.payment.findMany({
        where: {
          order: {
            event: {
              organizerId:
                cleanOrganizerId,
            },
          },
        },

        distinct: [
          "method",
        ],

        orderBy: {
          method:
            "asc",
        },

        select: {
          method:
            true,
        },
      }),
    ]);

    const statusCount =
      new Map<OrderStatus, number>(
        statusGroups.map(
          (item) => [
            item.status,
            item._count._all,
          ],
        ),
      );

    const ticketCount =
      new Map<TicketStatus, number>();

    for (const ticket of summaryTickets) {
      ticketCount.set(
        ticket.status,
        (
          ticketCount.get(
            ticket.status,
          ) ?? 0
        ) + 1,
      );
    }

    const currencyCodes =
      Array.from(
        new Set(
          filterCurrencies
            .map(
              (item) =>
                normalizeCurrency(
                  item.currency,
                ),
            )
            .filter(
              (
                item,
              ): item is SupportedCurrencyCode =>
                Boolean(item),
            ),
        ),
      );

    return {
      generatedAt:
        new Date().toISOString(),

      summary: {
        totalOrders:
          totalItems,

        paidOrders:
          statusCount.get(
            "PAID",
          ) ?? 0,

        pendingOrders:
          statusCount.get(
            "PENDING",
          ) ?? 0,

        cancelledOrders:
          statusCount.get(
            "CANCELLED",
          ) ?? 0,

        refundedOrders:
          statusCount.get(
            "REFUNDED",
          ) ?? 0,

        failedOrders:
          statusCount.get(
            "FAILED",
          ) ?? 0,

        totalTickets:
          summaryTickets.length,

        validTickets:
          ticketCount.get(
            "VALID",
          ) ?? 0,

        usedTickets:
          ticketCount.get(
            "USED",
          ) ?? 0,

        cancelledTickets:
          ticketCount.get(
            "CANCELLED",
          ) ?? 0,

        refundedTickets:
          ticketCount.get(
            "REFUNDED",
          ) ?? 0,

        uniqueCustomers:
          uniqueCustomers.length,

        guestOrders,
        registeredCustomerOrders,

        totalsByCurrency:
          buildCurrencyTotals({
            orders:
              summaryOrders,
            tickets:
              summaryTickets,
          }),
      },

      orders:
        orders.map(
          (order) => {
            const orderCurrency =
              resolveCurrency(
                order.currency,
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

            const ticketSummary =
              buildTicketSummary(
                order.tickets,
              );

            return {
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

              total:
                normalizeMoney(
                  decimalToNumber(
                    order.total,
                  ),
                  orderCurrency,
                ),

              organizerNet:
                normalizeMoney(
                  Math.max(
                    subtotal -
                      platformFee,
                    0,
                  ),
                  orderCurrency,
                ),

              paidAt:
                order.paidAt
                  ?.toISOString() ??
                null,

              createdAt:
                order.createdAt.toISOString(),

              updatedAt:
                order.updatedAt.toISOString(),

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
              },

              event: {
                id:
                  order.event.id,
                title:
                  order.event.title,
                slug:
                  order.event.slug,
                coverImage:
                  order.event.coverImage,
                startsAt:
                  order.event.startsAt.toISOString(),
                endsAt:
                  order.event.endsAt
                    ?.toISOString() ??
                  null,
                venueName:
                  order.event.venueName,
                city:
                  order.event.city,
                country:
                  order.event.country,
                countryCode:
                  order.event.countryCode,
                timezone:
                  order.event.timezone,
                currency:
                  resolveCurrency(
                    order.event.currency,
                  ),
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
                        normalizeMoney(
                          decimalToNumber(
                            order.payment.amount,
                          ),
                          resolveCurrency(
                            order.payment.currency,
                          ),
                        ),
                      currency:
                        resolveCurrency(
                          order.payment.currency,
                        ),
                      status:
                        order.payment.status,
                      failureReason:
                        order.payment.failureReason,
                      paidAt:
                        order.payment.paidAt
                          ?.toISOString() ??
                        null,
                    }
                  : null,

              items:
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
                  }),
                ),

              ticketSummary,
            };
          },
        ),

      filters: {
        events:
          filterEvents.map(
            (event) => ({
              id:
                event.id,
              title:
                event.title,
              slug:
                event.slug,
              currency:
                resolveCurrency(
                  event.currency,
                ),
              startsAt:
                event.startsAt.toISOString(),
            }),
          ),

        currencies:
          currencyCodes.map(
            (code) => {
              const definition =
                getCurrencyDefinition(
                  code,
                );

              return {
                code,
                name:
                  definition?.name ??
                  code,
                symbol:
                  definition?.symbol ??
                  code,
                fractionDigits:
                  definition?.decimals ??
                  2,
              };
            },
          ),

        orderStatuses: [
          ...ORDER_STATUSES,
        ],

        paymentStatuses: [
          ...PAYMENT_STATUSES,
        ],

        paymentMethods:
          Array.from(
            new Set(
              filterPaymentMethods
                .map(
                  (item) =>
                    item.method.trim(),
                )
                .filter(Boolean),
            ),
          ),
      },

      pagination: {
        page:
          safePage,
        pageSize:
          normalizedPageSize,
        totalItems,
        totalPages,
        hasPreviousPage:
          safePage > 1,
        hasNextPage:
          safePage <
          totalPages,
      },

      appliedFilters: {
        search:
          normalizedSearch,
        eventId:
          normalizedEventId,
        status:
          normalizedStatus,
        currency:
          normalizedCurrency,
        paymentStatus:
          normalizedPaymentStatus,
        paymentMethod:
          normalizedPaymentMethod,
        dateFrom:
          normalizedDateFrom
            ?.toISOString() ??
          null,
        dateTo:
          normalizedDateTo
            ?.toISOString() ??
          null,
        sort,
      },
    };
  } catch (error) {
    if (
      error instanceof
      GetOrganizerOrdersError
    ) {
      throw error;
    }

    console.error(
      "[GET_ORGANIZER_ORDERS_ERROR]",
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

    throw new GetOrganizerOrdersError({
      code:
        "GET_ORGANIZER_ORDERS_FAILED",
      status:
        500,
      message:
        "Impossible de charger les commandes organisateur pour le moment.",
    });
  }
}