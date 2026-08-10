import "server-only";

import {
  OrderStatus,
  PaymentStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type AdminOrderSort =
  | "NEWEST"
  | "OLDEST"
  | "TOTAL_DESC"
  | "TOTAL_ASC";

export type GetAdminOrdersInput = Readonly<{
  search?: string | null;
  status?: OrderStatus | "all" | null;
  paymentStatus?: PaymentStatus | "all" | null;
  paymentMethod?: string | null;
  organizerId?: string | null;
  eventId?: string | null;
  currency?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  sort?: AdminOrderSort | null;
  page?: number | null;
  pageSize?: number | null;
}>;

export type AdminOrderListItem = Readonly<{
  id: string;
  reference: string;

  customer: {
    id: string | null;
    name: string;
    email: string;
    phone: string;
  };

  event: {
    id: string;
    title: string;
    slug: string;
    coverImage: string | null;
    city: string;
    country: string;
    startsAt: string;
  };

  organizer: {
    id: string;
    name: string;
    email: string;
    businessName: string | null;
  };

  amounts: {
    subtotal: string;
    platformFee: string;
    total: string;
    currency: string;
  };

  status: OrderStatus;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;

  payment: {
    id: string;
    provider: string;
    providerReference: string | null;
    method: string;
    amount: string;
    currency: string;
    status: PaymentStatus;
    failureReason: string | null;
    paidAt: string | null;
    createdAt: string;
  } | null;

  items: ReadonlyArray<{
    id: string;
    ticketTypeId: string;
    ticketTypeName: string;
    quantity: number;
    unitPrice: string;
    subtotal: string;
    platformFee: string;
    total: string;
  }>;

  tickets: {
    total: number;
    valid: number;
    used: number;
    cancelled: number;
    refunded: number;
  };
}>;

export type GetAdminOrdersResult = Readonly<{
  orders: AdminOrderListItem[];

  statistics: {
    totalOrders: number;
    pendingOrders: number;
    paidOrders: number;
    cancelledOrders: number;
    refundedOrders: number;
    failedOrders: number;

    grossPaidAmount: string;
    platformFees: string;
    netOrganizerAmount: string;

    /*
     * Les statistiques monétaires ne sont additionnées que lorsqu'une
     * seule devise est sélectionnée. Sinon elles restent à zéro pour
     * éviter d'additionner des monnaies différentes.
     */
    currency: string | null;
  };

  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };

  options: {
    statuses: OrderStatus[];
    paymentStatuses: PaymentStatus[];
    currencies: string[];
    paymentMethods: string[];
  };

  appliedFilters: {
    search: string;
    status: OrderStatus | "all";
    paymentStatus: PaymentStatus | "all";
    paymentMethod: string;
    organizerId: string;
    eventId: string;
    currency: string;
    dateFrom: string;
    dateTo: string;
    sort: AdminOrderSort;
  };
}>;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function normalizeText(
  value: string | null | undefined,
): string {
  return (
    value
      ?.replace(/\s+/g, " ")
      .trim() ?? ""
  );
}

function normalizePage(
  value: number | null | undefined,
): number {
  if (
    !Number.isFinite(value) ||
    !value ||
    value < 1
  ) {
    return DEFAULT_PAGE;
  }

  return Math.floor(value);
}

function normalizePageSize(
  value: number | null | undefined,
): number {
  if (
    !Number.isFinite(value) ||
    !value ||
    value < 1
  ) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(
    Math.floor(value),
    MAX_PAGE_SIZE,
  );
}

function parseDateStart(
  value: string,
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

  return date;
}

function parseDateEnd(
  value: string,
): Date | null {
  if (!value) {
    return null;
  }

  /*
   * Pour un filtre HTML <input type="date">, on inclut toute la journée.
   * Pour une date ISO complète, la valeur est utilisée telle quelle.
   */
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    const date =
      new Date(
        `${value}T23:59:59.999Z`,
      );

    return Number.isNaN(
      date.getTime(),
    )
      ? null
      : date;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return date;
}

function decimalToString(
  value:
    | Prisma.Decimal
    | null
    | undefined,
): string {
  return (
    value?.toFixed(2) ??
    "0.00"
  );
}

function buildOrganizerName({
  firstName,
  lastName,
  businessName,
}: {
  firstName: string;
  lastName: string;
  businessName:
    | string
    | null;
}): string {
  const normalizedBusinessName =
    normalizeText(
      businessName,
    );

  if (normalizedBusinessName) {
    return normalizedBusinessName;
  }

  const fullName =
    `${firstName} ${lastName}`
      .replace(/\s+/g, " ")
      .trim();

  return (
    fullName ||
    "Organisateur Tikemia"
  );
}

function buildOrderBy(
  sort: AdminOrderSort,
): Prisma.OrderOrderByWithRelationInput[] {
  switch (sort) {
    case "OLDEST":
      return [
        {
          createdAt:
            "asc",
        },
        {
          id:
            "asc",
        },
      ];

    case "TOTAL_DESC":
      return [
        {
          total:
            "desc",
        },
        {
          createdAt:
            "desc",
        },
      ];

    case "TOTAL_ASC":
      return [
        {
          total:
            "asc",
        },
        {
          createdAt:
            "desc",
        },
      ];

    case "NEWEST":
    default:
      return [
        {
          createdAt:
            "desc",
        },
        {
          id:
            "desc",
        },
      ];
  }
}

function buildWhere({
  search,
  status,
  paymentStatus,
  paymentMethod,
  organizerId,
  eventId,
  currency,
  dateFrom,
  dateTo,
}: {
  search: string;
  status:
    | OrderStatus
    | "all";
  paymentStatus:
    | PaymentStatus
    | "all";
  paymentMethod: string;
  organizerId: string;
  eventId: string;
  currency: string;
  dateFrom: Date | null;
  dateTo: Date | null;
}): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] =
    [];

  if (search) {
    and.push({
      OR: [
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
            is: {
              title: {
                contains:
                  search,
                mode:
                  "insensitive",
              },
            },
          },
        },
        {
          event: {
            is: {
              organizer: {
                is: {
                  OR: [
                    {
                      firstName: {
                        contains:
                          search,
                        mode:
                          "insensitive",
                      },
                    },
                    {
                      lastName: {
                        contains:
                          search,
                        mode:
                          "insensitive",
                      },
                    },
                    {
                      email: {
                        contains:
                          search,
                        mode:
                          "insensitive",
                      },
                    },
                    {
                      organizerProfile: {
                        is: {
                          businessName: {
                            contains:
                              search,
                            mode:
                              "insensitive",
                          },
                        },
                      },
                    },
                  ],
                },
              },
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
      ],
    });
  }

  if (
    status !==
    "all"
  ) {
    and.push({
      status,
    });
  }

  if (
    paymentStatus !==
    "all"
  ) {
    and.push({
      payment: {
        is: {
          status:
            paymentStatus,
        },
      },
    });
  }

  if (paymentMethod) {
    and.push({
      payment: {
        is: {
          method: {
            equals:
              paymentMethod,
            mode:
              "insensitive",
          },
        },
      },
    });
  }

  if (organizerId) {
    and.push({
      event: {
        is: {
          organizerId,
        },
      },
    });
  }

  if (eventId) {
    and.push({
      eventId,
    });
  }

  if (currency) {
    and.push({
      currency,
    });
  }

  if (
    dateFrom ||
    dateTo
  ) {
    and.push({
      createdAt: {
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
      },
    });
  }

  if (
    and.length === 0
  ) {
    return {};
  }

  if (
    and.length === 1
  ) {
    return and[0] ?? {};
  }

  return {
    AND:
      and,
  };
}

const orderSelect =
  Prisma.validator<Prisma.OrderSelect>()({
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

    event: {
      select: {
        id:
          true,
        title:
          true,
        slug:
          true,
        coverImage:
          true,
        city:
          true,
        country:
          true,
        startsAt:
          true,

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
        paidAt:
          true,
        createdAt:
          true,
      },
    },

    items: {
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
            name:
              true,
          },
        },
      },

      orderBy: {
        id:
          "asc",
      },
    },

    tickets: {
      select: {
        status:
          true,
      },
    },
  });

type SelectedOrder =
  Prisma.OrderGetPayload<{
    select:
      typeof orderSelect;
  }>;

function mapOrder(
  order: SelectedOrder,
): AdminOrderListItem {
  let validTickets =
    0;
  let usedTickets =
    0;
  let cancelledTickets =
    0;
  let refundedTickets =
    0;

  for (
    const ticket of
    order.tickets
  ) {
    switch (
      ticket.status
    ) {
      case "VALID":
        validTickets +=
          1;
        break;

      case "USED":
        usedTickets +=
          1;
        break;

      case "CANCELLED":
        cancelledTickets +=
          1;
        break;

      case "REFUNDED":
        refundedTickets +=
          1;
        break;
    }
  }

  const organizer =
    order.event.organizer;

  const businessName =
    organizer.organizerProfile
      ?.businessName ??
    null;

  return {
    id:
      order.id,

    reference:
      order.reference,

    customer: {
      id:
        order.customerId,

      name:
        order.customerName,

      email:
        order.customerEmail,

      phone:
        order.customerPhone,
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

      city:
        order.event.city,

      country:
        order.event.country,

      startsAt:
        order.event.startsAt.toISOString(),
    },

    organizer: {
      id:
        organizer.id,

      name:
        buildOrganizerName({
          firstName:
            organizer.firstName,

          lastName:
            organizer.lastName,

          businessName,
        }),

      email:
        organizer.email,

      businessName,
    },

    amounts: {
      subtotal:
        decimalToString(
          order.subtotal,
        ),

      platformFee:
        decimalToString(
          order.platformFee,
        ),

      total:
        decimalToString(
          order.total,
        ),

      currency:
        order.currency,
    },

    status:
      order.status,

    paidAt:
      order.paidAt
        ?.toISOString() ??
      null,

    createdAt:
      order.createdAt
        .toISOString(),

    updatedAt:
      order.updatedAt
        .toISOString(),

    payment:
      order.payment
        ? {
            id:
              order.payment.id,

            provider:
              order.payment
                .provider,

            providerReference:
              order.payment
                .providerReference,

            method:
              order.payment
                .method,

            amount:
              decimalToString(
                order.payment
                  .amount,
              ),

            currency:
              order.payment
                .currency,

            status:
              order.payment
                .status,

            failureReason:
              order.payment
                .failureReason,

            paidAt:
              order.payment
                .paidAt
                ?.toISOString() ??
              null,

            createdAt:
              order.payment
                .createdAt
                .toISOString(),
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
            item.ticketType
              .name,

          quantity:
            item.quantity,

          unitPrice:
            decimalToString(
              item.unitPrice,
            ),

          subtotal:
            decimalToString(
              item.subtotal,
            ),

          platformFee:
            decimalToString(
              item.platformFee,
            ),

          total:
            decimalToString(
              item.total,
            ),
        }),
      ),

    tickets: {
      total:
        order.tickets.length,

      valid:
        validTickets,

      used:
        usedTickets,

      cancelled:
        cancelledTickets,

      refunded:
        refundedTickets,
    },
  };
}

export async function getAdminOrders(
  input: GetAdminOrdersInput = {},
): Promise<GetAdminOrdersResult> {
  const search =
    normalizeText(
      input.search,
    );

  const status =
    input.status ??
    "all";

  const paymentStatus =
    input.paymentStatus ??
    "all";

  const paymentMethod =
    normalizeText(
      input.paymentMethod,
    );

  const organizerId =
    normalizeText(
      input.organizerId,
    );

  const eventId =
    normalizeText(
      input.eventId,
    );

  const currency =
    normalizeText(
      input.currency,
    ).toUpperCase();

  const dateFromText =
    normalizeText(
      input.dateFrom,
    );

  const dateToText =
    normalizeText(
      input.dateTo,
    );

  const dateFrom =
    parseDateStart(
      dateFromText,
    );

  const dateTo =
    parseDateEnd(
      dateToText,
    );

  const sort =
    input.sort ??
    "NEWEST";

  const page =
    normalizePage(
      input.page,
    );

  const pageSize =
    normalizePageSize(
      input.pageSize,
    );

  const where =
    buildWhere({
      search,
      status,
      paymentStatus,
      paymentMethod,
      organizerId,
      eventId,
      currency,
      dateFrom,
      dateTo,
    });

  /*
   * Les compteurs de statut utilisent les mêmes filtres de recherche,
   * organisateur, événement, devise, paiement et période que la liste,
   * mais pas le filtre Order.status lui-même. Cela permet à l'Admin
   * de toujours voir la répartition complète des statuts.
   */
  const statisticsWhere =
    buildWhere({
      search,
      status:
        "all",
      paymentStatus,
      paymentMethod,
      organizerId,
      eventId,
      currency,
      dateFrom,
      dateTo,
    });

  const skip =
    (page - 1) *
    pageSize;

  const [
    rawOrders,
    totalItems,
    totalStatisticsOrders,
    pendingOrders,
    paidOrders,
    cancelledOrders,
    refundedOrders,
    failedOrders,
    currencyRows,
    paymentMethodRows,
  ] =
    await prisma.$transaction([
      prisma.order.findMany({
        where,

        select:
          orderSelect,

        orderBy:
          buildOrderBy(
            sort,
          ),

        skip,

        take:
          pageSize,
      }),

      prisma.order.count({
        where,
      }),

      prisma.order.count({
        where:
          statisticsWhere,
      }),

      prisma.order.count({
        where: {
          AND: [
            statisticsWhere,
            {
              status:
                OrderStatus.PENDING,
            },
          ],
        },
      }),

      prisma.order.count({
        where: {
          AND: [
            statisticsWhere,
            {
              status:
                OrderStatus.PAID,
            },
          ],
        },
      }),

      prisma.order.count({
        where: {
          AND: [
            statisticsWhere,
            {
              status:
                OrderStatus.CANCELLED,
            },
          ],
        },
      }),

      prisma.order.count({
        where: {
          AND: [
            statisticsWhere,
            {
              status:
                OrderStatus.REFUNDED,
            },
          ],
        },
      }),

      prisma.order.count({
        where: {
          AND: [
            statisticsWhere,
            {
              status:
                OrderStatus.FAILED,
            },
          ],
        },
      }),

      prisma.order.findMany({
        select: {
          currency:
            true,
        },

        distinct: [
          "currency",
        ],

        orderBy: {
          currency:
            "asc",
        },
      }),

      prisma.payment.findMany({
        select: {
          method:
            true,
        },

        distinct: [
          "method",
        ],

        orderBy: {
          method:
            "asc",
        },
      }),
    ]);

  /*
   * On ne somme jamais plusieurs devises ensemble.
   * Si aucune devise n'est explicitement sélectionnée, on ne présente
   * un total financier que lorsque les résultats filtrés n'utilisent
   * effectivement qu'une seule devise.
   */
  const filteredCurrencies =
    await prisma.order.findMany({
      where:
        statisticsWhere,

      select: {
        currency:
          true,
      },

      distinct: [
        "currency",
      ],

      take:
        2,
  });

  const statisticsCurrency =
    currency ||
    (
      filteredCurrencies.length ===
      1
        ? filteredCurrencies[0]
            ?.currency ??
          null
        : null
    );

  let grossPaidAmount =
    "0.00";
  let platformFees =
    "0.00";
  let netOrganizerAmount =
    "0.00";

  if (
    statisticsCurrency
  ) {
    const paidAggregate =
      await prisma.order.aggregate({
        where: {
          AND: [
            statisticsWhere,
            {
              status:
                OrderStatus.PAID,

              currency:
                statisticsCurrency,
            },
          ],
        },

        _sum: {
          total:
            true,

          platformFee:
            true,
        },
      });

    const gross =
      paidAggregate._sum
        .total ??
      new Prisma.Decimal(0);

    const fees =
      paidAggregate._sum
        .platformFee ??
      new Prisma.Decimal(0);

    const net =
      gross.minus(
        fees,
      );

    grossPaidAmount =
      decimalToString(
        gross,
      );

    platformFees =
      decimalToString(
        fees,
      );

    netOrganizerAmount =
      decimalToString(
        net,
      );
  }

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalItems /
          pageSize,
      ),
    );

  return {
    orders:
      rawOrders.map(
        mapOrder,
      ),

    statistics: {
      totalOrders:
        totalStatisticsOrders,

      pendingOrders,

      paidOrders,

      cancelledOrders,

      refundedOrders,

      failedOrders,

      grossPaidAmount,

      platformFees,

      netOrganizerAmount,

      currency:
        statisticsCurrency,
    },

    pagination: {
      page,

      pageSize,

      totalItems,

      totalPages,
    },

    options: {
      statuses:
        Object.values(
          OrderStatus,
        ),

      paymentStatuses:
        Object.values(
          PaymentStatus,
        ),

      currencies:
        currencyRows
          .map(
            (row) =>
              row.currency,
          )
          .filter(
            (
              value,
              index,
              values,
            ) =>
              Boolean(value) &&
              values.indexOf(
                value,
              ) ===
                index,
          ),

      paymentMethods:
        paymentMethodRows
          .map(
            (row) =>
              row.method,
          )
          .filter(
            (
              value,
              index,
              values,
            ) =>
              Boolean(
                value,
              ) &&
              values.indexOf(
                value,
              ) ===
                index,
          ),
    },

    appliedFilters: {
      search,

      status,

      paymentStatus,

      paymentMethod,

      organizerId,

      eventId,

      currency,

      dateFrom:
        dateFromText,

      dateTo:
        dateToText,

      sort,
    },
  };
}