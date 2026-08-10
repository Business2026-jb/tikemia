import "server-only";

import {
  EventStatus,
  OrderStatus,
  Prisma,
} from "@prisma/client";

import {
  AdminEventError,
} from "@/lib/admin/events/admin-event-errors";
import {
  prisma,
} from "@/lib/prisma";

export type AdminEventSort =
  | "recent"
  | "oldest"
  | "starts_soon"
  | "starts_later"
  | "most_sales"
  | "highest_revenue"
  | "title_asc"
  | "title_desc";

export type GetAdminEventsInput =
  Readonly<{
    search?: string | null;
    status?: EventStatus | "all";
    country?: string | null;
    sort?: AdminEventSort;
    page?: number;
    pageSize?: number;
  }>;

export type AdminEventListItem =
  Readonly<{
    id: string;
    title: string;
    slug: string;
    shortDescription: string | null;
    coverImage: string | null;
    venueName: string;
    city: string;
    country: string;
    countryCode: string;
    startsAt: Date;
    endsAt: Date | null;
    currency: string;
    capacity: number;
    status: EventStatus;
    isFree: boolean;
    isFeatured: boolean;
    publishedAt: Date | null;
    submittedAt: Date | null;
    reviewedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;

    category:
      | Readonly<{
          id: string;
          name: string;
          slug: string;
        }>
      | null;

    organizer: Readonly<{
      id: string;
      fullName: string;
      email: string;
      phone: string;
      isActive: boolean;
      businessName: string | null;
      logo: string | null;
      avatar: string | null;
      hasBlueBadge: boolean;
    }>;

    statistics: Readonly<{
      ticketTypes: number;
      orders: number;
      paidOrders: number;
      tickets: number;
      soldTickets: number;
      favorites: number;
      reports: number;
      revenue: string;
      platformFees: string;
    }>;
  }>;

export type GetAdminEventsResult =
  Readonly<{
    events: readonly AdminEventListItem[];

    countries: readonly string[];

    pagination: Readonly<{
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasPreviousPage: boolean;
      hasNextPage: boolean;
    }>;

    filters: Readonly<{
      search: string;
      status: EventStatus | "all";
      country: string;
      sort: AdminEventSort;
    }>;

    summary: Readonly<{
      totalEvents: number;
      pendingEvents: number;
      publishedEvents: number;
      suspendedEvents: number;
      totalPaidOrders: number;
      totalSoldTickets: number;
      revenueByCurrency: Readonly<
        Record<string, string>
      >;
    }>;
  }>;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const PAID_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PARTIALLY_REFUNDED,
  OrderStatus.REFUNDED,
];

type EventFinancialStatistics = {
  paidOrders: number;
  revenue: Prisma.Decimal;
  platformFees: Prisma.Decimal;
};

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return (
    value
      ?.replace(
        /\s+/g,
        " ",
      )
      .trim() ?? ""
  );
}

function positiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (
    value === undefined ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    return fallback;
  }

  return value;
}

function normalizeSort(
  value:
    | AdminEventSort
    | undefined,
): AdminEventSort {
  switch (value) {
    case "oldest":
    case "starts_soon":
    case "starts_later":
    case "most_sales":
    case "highest_revenue":
    case "title_asc":
    case "title_desc":
      return value;

    case "recent":
    default:
      return "recent";
  }
}

function buildWhere({
  search,
  status,
  country,
}: {
  search: string;
  status: EventStatus | "all";
  country: string;
}): Prisma.EventWhereInput {
  const where: Prisma.EventWhereInput = {};

  if (status !== "all") {
    where.status = status;
  }

  if (country) {
    where.country = {
      equals: country,
      mode: "insensitive",
    };
  }

  if (search) {
    where.OR = [
      {
        id: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        title: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        slug: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        city: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        country: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        venueName: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        organizer: {
          is: {
            OR: [
              {
                firstName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                lastName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                email: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                organizerProfile: {
                  is: {
                    businessName: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                },
              },
            ],
          },
        },
      },
    ];
  }

  return where;
}

function buildOrderBy(
  sort: AdminEventSort,
): Prisma.EventOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [
        {
          createdAt: "asc",
        },
        {
          id: "asc",
        },
      ];

    case "starts_soon":
      return [
        {
          startsAt: "asc",
        },
        {
          createdAt: "desc",
        },
      ];

    case "starts_later":
      return [
        {
          startsAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ];

    case "title_asc":
      return [
        {
          title: "asc",
        },
        {
          id: "asc",
        },
      ];

    case "title_desc":
      return [
        {
          title: "desc",
        },
        {
          id: "desc",
        },
      ];

    case "most_sales":
    case "highest_revenue":
    case "recent":
    default:
      return [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ];
  }
}

function getOrCreateEventFinancialStatistics(
  map: Map<
    string,
    EventFinancialStatistics
  >,
  eventId: string,
): EventFinancialStatistics {
  const existing = map.get(eventId);

  if (existing) {
    return existing;
  }

  const created: EventFinancialStatistics = {
    paidOrders: 0,
    revenue: new Prisma.Decimal(0),
    platformFees: new Prisma.Decimal(0),
  };

  map.set(
    eventId,
    created,
  );

  return created;
}

export async function getAdminEvents(
  input: GetAdminEventsInput = {},
): Promise<GetAdminEventsResult> {
  const search = normalizeText(
    input.search,
  );

  const country = normalizeText(
    input.country,
  );

  const status: EventStatus | "all" =
    input.status &&
    input.status !== "all"
      ? input.status
      : "all";

  const sort = normalizeSort(
    input.sort,
  );

  const page = positiveInteger(
    input.page,
    DEFAULT_PAGE,
  );

  const pageSize = Math.min(
    positiveInteger(
      input.pageSize,
      DEFAULT_PAGE_SIZE,
    ),
    MAX_PAGE_SIZE,
  );

  const where = buildWhere({
    search,
    status,
    country,
  });

  try {
    const [
      totalItems,
      rawEvents,
      countriesResult,
      totalEvents,
      pendingEvents,
      publishedEvents,
      suspendedEvents,
      allPaidOrders,
      totalSoldTickets,
    ] = await Promise.all([
      prisma.event.count({
        where,
      }),

      prisma.event.findMany({
        where,

        skip:
          (page - 1) *
          pageSize,

        take:
          pageSize,

        orderBy:
          buildOrderBy(sort),

        select: {
          id: true,
          title: true,
          slug: true,
          shortDescription: true,
          coverImage: true,
          venueName: true,
          city: true,
          country: true,
          countryCode: true,
          startsAt: true,
          endsAt: true,
          currency: true,
          capacity: true,
          status: true,
          isFree: true,
          isFeatured: true,
          publishedAt: true,
          submittedAt: true,
          reviewedAt: true,
          createdAt: true,
          updatedAt: true,

          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },

          organizer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              isActive: true,

              organizerProfile: {
                select: {
                  businessName: true,
                  logo: true,
                  avatar: true,
                  hasBlueBadge: true,
                },
              },
            },
          },

          _count: {
            select: {
              ticketTypes: true,
              orders: true,
              tickets: true,
              eventFavorites: true,
              platformReports: true,
            },
          },
        },
      }),

      prisma.event.findMany({
        distinct: [
          "country",
        ],

        orderBy: {
          country: "asc",
        },

        select: {
          country: true,
        },
      }),

      prisma.event.count(),

      prisma.event.count({
        where: {
          status:
            EventStatus.PENDING,
        },
      }),

      prisma.event.count({
        where: {
          status:
            EventStatus.PUBLISHED,
        },
      }),

      prisma.event.count({
        where: {
          status:
            EventStatus.SUSPENDED,
        },
      }),

      prisma.order.findMany({
        where: {
          status: {
            in:
              PAID_ORDER_STATUSES,
          },
        },

        select: {
          eventId: true,
          currency: true,
          total: true,
          platformFee: true,
        },
      }),

      prisma.ticket.count(),
    ]);

    const eventIds = rawEvents.map(
      (event) => event.id,
    );

    const pagePaidOrders =
      eventIds.length > 0
        ? await prisma.order.findMany({
            where: {
              eventId: {
                in: eventIds,
              },

              status: {
                in:
                  PAID_ORDER_STATUSES,
              },
            },

            select: {
              eventId: true,
              total: true,
              platformFee: true,
            },
          })
        : [];

    const pageTickets =
      eventIds.length > 0
        ? await prisma.ticket.findMany({
            where: {
              eventId: {
                in: eventIds,
              },
            },

            select: {
              eventId: true,
            },
          })
        : [];

    const financialStatisticsByEvent =
      new Map<
        string,
        EventFinancialStatistics
      >();

    for (
      const order of pagePaidOrders
    ) {
      const statistics =
        getOrCreateEventFinancialStatistics(
          financialStatisticsByEvent,
          order.eventId,
        );

      statistics.paidOrders += 1;

      statistics.revenue =
        statistics.revenue.plus(
          order.total,
        );

      statistics.platformFees =
        statistics.platformFees.plus(
          order.platformFee,
        );
    }

    const soldTicketsByEvent =
      new Map<string, number>();

    for (
      const ticket of pageTickets
    ) {
      soldTicketsByEvent.set(
        ticket.eventId,
        (
          soldTicketsByEvent.get(
            ticket.eventId,
          ) ?? 0
        ) + 1,
      );
    }

    let events: AdminEventListItem[] =
      rawEvents.map(
        (event) => {
          const financialStatistics =
            financialStatisticsByEvent.get(
              event.id,
            );

          const fullName =
            `${event.organizer.firstName} ${event.organizer.lastName}`
              .replace(
                /\s+/g,
                " ",
              )
              .trim();

          return {
            id:
              event.id,

            title:
              event.title,

            slug:
              event.slug,

            shortDescription:
              event.shortDescription,

            coverImage:
              event.coverImage,

            venueName:
              event.venueName,

            city:
              event.city,

            country:
              event.country,

            countryCode:
              event.countryCode,

            startsAt:
              event.startsAt,

            endsAt:
              event.endsAt,

            currency:
              event.currency,

            capacity:
              event.capacity,

            status:
              event.status,

            isFree:
              event.isFree,

            isFeatured:
              event.isFeatured,

            publishedAt:
              event.publishedAt,

            submittedAt:
              event.submittedAt,

            reviewedAt:
              event.reviewedAt,

            createdAt:
              event.createdAt,

            updatedAt:
              event.updatedAt,

            category:
              event.category,

            organizer: {
              id:
                event.organizer.id,

              fullName,

              email:
                event.organizer.email,

              phone:
                event.organizer.phone,

              isActive:
                event.organizer.isActive,

              businessName:
                event.organizer
                  .organizerProfile
                  ?.businessName ??
                null,

              logo:
                event.organizer
                  .organizerProfile
                  ?.logo ??
                null,

              avatar:
                event.organizer
                  .organizerProfile
                  ?.avatar ??
                null,

              hasBlueBadge:
                event.organizer
                  .organizerProfile
                  ?.hasBlueBadge ??
                false,
            },

            statistics: {
              ticketTypes:
                event._count
                  .ticketTypes,

              orders:
                event._count
                  .orders,

              paidOrders:
                financialStatistics
                  ?.paidOrders ??
                0,

              tickets:
                event._count
                  .tickets,

              soldTickets:
                soldTicketsByEvent.get(
                  event.id,
                ) ?? 0,

              favorites:
                event._count
                  .eventFavorites,

              reports:
                event._count
                  .platformReports,

              revenue:
                financialStatistics
                  ?.revenue
                  .toFixed(2) ??
                "0.00",

              platformFees:
                financialStatistics
                  ?.platformFees
                  .toFixed(2) ??
                "0.00",
            },
          };
        },
      );

    if (sort === "most_sales") {
      events = [
        ...events,
      ].sort(
        (
          left,
          right,
        ) =>
          right.statistics
            .soldTickets -
          left.statistics
            .soldTickets,
      );
    }

    if (
      sort ===
      "highest_revenue"
    ) {
      events = [
        ...events,
      ].sort(
        (
          left,
          right,
        ) =>
          Number(
            right.statistics
              .revenue,
          ) -
          Number(
            left.statistics
              .revenue,
          ),
      );
    }

    const revenueByCurrency =
      new Map<
        string,
        Prisma.Decimal
      >();

    let totalPaidOrders = 0;

    for (
      const order of allPaidOrders
    ) {
      totalPaidOrders += 1;

      const currentAmount =
        revenueByCurrency.get(
          order.currency,
        ) ??
        new Prisma.Decimal(0);

      revenueByCurrency.set(
        order.currency,
        currentAmount.plus(
          order.total,
        ),
      );
    }

    const serializedRevenueByCurrency:
      Record<string, string> =
      {};

    for (
      const [
        currency,
        amount,
      ] of revenueByCurrency
    ) {
      serializedRevenueByCurrency[
        currency
      ] =
        amount.toFixed(2);
    }

    const totalPages =
      totalItems === 0
        ? 0
        : Math.ceil(
            totalItems /
              pageSize,
          );

    return {
      events,

      countries:
        countriesResult
          .map(
            (item) =>
              item.country.trim(),
          )
          .filter(
            (
              item,
              index,
              values,
            ) =>
              item.length > 0 &&
              values.indexOf(
                item,
              ) === index,
          ),

      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,

        hasPreviousPage:
          page > 1,

        hasNextPage:
          page <
          totalPages,
      },

      filters: {
        search,
        status,
        country,
        sort,
      },

      summary: {
        totalEvents,
        pendingEvents,
        publishedEvents,
        suspendedEvents,
        totalPaidOrders,
        totalSoldTickets,

        revenueByCurrency:
          serializedRevenueByCurrency,
      },
    };
  } catch (error) {
    if (
      error instanceof
      AdminEventError
    ) {
      throw error;
    }

    throw new AdminEventError({
      code:
        "ADMIN_EVENT_QUERY_INVALID",

      message:
        "Impossible de charger les événements Tikemia.",

      status:
        500,

      cause:
        error,
    });
  }
}