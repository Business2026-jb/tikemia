import "server-only";

import { createHash } from "node:crypto";

import {
  type EventStatus,
  Prisma,
} from "@prisma/client";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 12;
const MAXIMUM_PAGE_SIZE = 50;
const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const EVENT_STATUSES: readonly EventStatus[] = [
  "DRAFT",
  "PENDING",
  "PUBLISHED",
  "SUSPENDED",
  "CANCELLED",
  "COMPLETED",
];

export type OrganizerEventsStatusFilter =
  | EventStatus
  | "ALL";

export type OrganizerEventsSort =
  | "created-desc"
  | "created-asc"
  | "updated-desc"
  | "updated-asc"
  | "start-desc"
  | "start-asc"
  | "title-asc"
  | "title-desc";

export type GetOrganizerEventsInput = {
  search?: string;
  status?: OrganizerEventsStatusFilter;
  sort?: OrganizerEventsSort;
  page?: number;
  pageSize?: number;
};

export type OrganizerEventListImage = {
  id: string;
  publicUrl: string;
  position: number;
  isCover: boolean;
};

export type OrganizerEventListCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
} | null;

export type OrganizerEventListItem = {
  id: string;
  title: string;
  slug: string;
  description: string;
  coverImage: string | null;

  category: OrganizerEventListCategory;
  image: OrganizerEventListImage | null;

  venueName: string;
  address: string;
  city: string;
  country: string;
  countryCode: string;
  timezone: string;

  startsAt: string;
  endsAt: string | null;
  salesStartAt: string | null;
  salesEndAt: string | null;

  currency: string;
  platformFeePercent: number;
  capacity: number;
  status: EventStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;

  ticketTypesCount: number;
  minimumTicketPrice: number;
  maximumTicketPrice: number;

  ticketsSold: number;
  placesRemaining: number;
  salesProgressPercent: number;

  paidOrdersCount: number;
  grossRevenue: number;
  platformFee: number;
  organizerNetRevenue: number;

  canEdit: boolean;
  canDelete: boolean;
  canCancel: boolean;
};

export type OrganizerEventsStatusCounts = {
  all: number;
  draft: number;
  pending: number;
  published: number;
  suspended: number;
  cancelled: number;
  completed: number;
};

export type OrganizerEventsSummary = {
  totalEvents: number;
  activeEvents: number;
  totalCapacity: number;
  totalTicketsSold: number;
  totalPlacesRemaining: number;
  totalPaidOrders: number;
  grossRevenue: number;
  platformFee: number;
  organizerNetRevenue: number;
};

export type OrganizerEventsPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type GetOrganizerEventsResult = {
  organizer: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string;
    businessName: string | null;
  };

  filters: {
    search: string;
    status: OrganizerEventsStatusFilter;
    sort: OrganizerEventsSort;
  };

  statusCounts: OrganizerEventsStatusCounts;
  summary: OrganizerEventsSummary;
  pagination: OrganizerEventsPagination;
  events: OrganizerEventListItem[];
};

export class GetOrganizerEventsError extends Error {
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
    this.name = "GetOrganizerEventsError";
    this.code = code;
    this.status = status;
  }
}

function hashSessionToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return fallback;
  }

  const normalizedValue = Math.trunc(value);

  return normalizedValue > 0
    ? normalizedValue
    : fallback;
}

function normalizePage(
  value: number | undefined,
): number {
  return normalizePositiveInteger(
    value,
    DEFAULT_PAGE,
  );
}

function normalizePageSize(
  value: number | undefined,
): number {
  return Math.min(
    normalizePositiveInteger(
      value,
      DEFAULT_PAGE_SIZE,
    ),
    MAXIMUM_PAGE_SIZE,
  );
}

function normalizeSearch(
  value: string | undefined,
): string {
  return value?.trim().slice(0, 120) ?? "";
}

function normalizeStatus(
  value: OrganizerEventsStatusFilter | undefined,
): OrganizerEventsStatusFilter {
  if (!value || value === "ALL") {
    return "ALL";
  }

  return EVENT_STATUSES.includes(value)
    ? value
    : "ALL";
}

function normalizeSort(
  value: OrganizerEventsSort | undefined,
): OrganizerEventsSort {
  const supportedSorts: OrganizerEventsSort[] = [
    "created-desc",
    "created-asc",
    "updated-desc",
    "updated-asc",
    "start-desc",
    "start-asc",
    "title-asc",
    "title-desc",
  ];

  return value && supportedSorts.includes(value)
    ? value
    : "created-desc";
}

function getOrderBy(
  sort: OrganizerEventsSort,
): Prisma.EventOrderByWithRelationInput[] {
  switch (sort) {
    case "created-asc":
      return [
        { createdAt: "asc" },
        { id: "asc" },
      ];

    case "updated-desc":
      return [
        { updatedAt: "desc" },
        { id: "desc" },
      ];

    case "updated-asc":
      return [
        { updatedAt: "asc" },
        { id: "asc" },
      ];

    case "start-desc":
      return [
        { startsAt: "desc" },
        { id: "desc" },
      ];

    case "start-asc":
      return [
        { startsAt: "asc" },
        { id: "asc" },
      ];

    case "title-asc":
      return [
        { title: "asc" },
        { createdAt: "desc" },
      ];

    case "title-desc":
      return [
        { title: "desc" },
        { createdAt: "desc" },
      ];

    case "created-desc":
    default:
      return [
        { createdAt: "desc" },
        { id: "desc" },
      ];
  }
}

function decimalToNumber(
  value:
    | Prisma.Decimal
    | number
    | string
    | null
    | undefined,
): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : 0;
}

function calculatePercentage(
  value: number,
  total: number,
): number {
  if (total <= 0) {
    return 0;
  }

  return Math.min(
    Math.max(
      Math.round((value / total) * 100),
      0,
    ),
    100,
  );
}

async function getAuthenticatedOrganizer() {
  const cookieStore = await cookies();

  const sessionCookieName =
    process.env.SESSION_COOKIE_NAME?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;

  const sessionToken =
    cookieStore.get(sessionCookieName)?.value;

  if (!sessionToken) {
    throw new GetOrganizerEventsError({
      code: "UNAUTHORIZED",
      status: 401,
      message:
        "Votre session est absente ou expirée.",
    });
  }

  const session = await prisma.session.findUnique({
    where: {
      tokenHash: hashSessionToken(sessionToken),
    },

    select: {
      id: true,
      expiresAt: true,

      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          emailVerified: true,
          isActive: true,

          organizerProfile: {
            select: {
              businessName: true,
            },
          },
        },
      },
    },
  });

  if (!session) {
    throw new GetOrganizerEventsError({
      code: "INVALID_SESSION",
      status: 401,
      message:
        "Votre session n’est plus valide.",
    });
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session
      .delete({
        where: {
          id: session.id,
        },
      })
      .catch((error: unknown) => {
        console.error(
          "[GET_ORGANIZER_EVENTS_EXPIRED_SESSION_DELETE_ERROR]",
          error instanceof Error
            ? error.message
            : error,
        );
      });

    throw new GetOrganizerEventsError({
      code: "EXPIRED_SESSION",
      status: 401,
      message:
        "Votre session a expiré. Reconnectez-vous.",
    });
  }

  if (
    session.user.role !== "ORGANIZER" ||
    !session.user.emailVerified ||
    !session.user.isActive
  ) {
    throw new GetOrganizerEventsError({
      code: "FORBIDDEN",
      status: 403,
      message:
        "Votre compte organisateur ne peut pas accéder à cette page.",
    });
  }

  return session.user;
}

export async function getOrganizerEvents(
  input: GetOrganizerEventsInput = {},
): Promise<GetOrganizerEventsResult> {
  try {
    const organizer =
      await getAuthenticatedOrganizer();

    const search = normalizeSearch(input.search);
    const status = normalizeStatus(input.status);
    const sort = normalizeSort(input.sort);
    const requestedPage = normalizePage(input.page);
    const pageSize = normalizePageSize(
      input.pageSize,
    );

    const baseWhere: Prisma.EventWhereInput = {
      organizerId: organizer.id,

      ...(search
        ? {
            OR: [
              {
                title: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                description: {
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
                category: {
                  is: {
                    name: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const filteredWhere: Prisma.EventWhereInput = {
      ...baseWhere,

      ...(status !== "ALL"
        ? {
            status,
          }
        : {}),
    };

    const [
      totalItems,
      groupedStatusCounts,
      allOrganizerEvents,
      allPaidOrders,
      allSoldTicketsCount,
    ] = await Promise.all([
      prisma.event.count({
        where: filteredWhere,
      }),

      prisma.event.groupBy({
        by: ["status"],

        where: baseWhere,

        _count: {
          _all: true,
        },
      }),

      prisma.event.findMany({
        where: {
          organizerId: organizer.id,
        },

        select: {
          id: true,
          capacity: true,
          status: true,
        },
      }),

      prisma.order.aggregate({
        where: {
          status: "PAID",

          event: {
            organizerId: organizer.id,
          },
        },

        _count: {
          _all: true,
        },

        _sum: {
          subtotal: true,
          platformFee: true,
        },
      }),

      prisma.ticket.count({
        where: {
          status: {
            in: ["VALID", "USED"],
          },

          event: {
            organizerId: organizer.id,
          },
        },
      }),
    ]);

    const totalPages = Math.max(
      Math.ceil(totalItems / pageSize),
      1,
    );

    const page = Math.min(
      requestedPage,
      totalPages,
    );

    const skip = (page - 1) * pageSize;

    const events = await prisma.event.findMany({
      where: filteredWhere,
      orderBy: getOrderBy(sort),
      skip,
      take: pageSize,

      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        coverImage: true,

        venueName: true,
        address: true,
        city: true,
        country: true,
        countryCode: true,
        timezone: true,

        startsAt: true,
        endsAt: true,
        salesStartAt: true,
        salesEndAt: true,

        currency: true,
        platformFeeRate: true,
        capacity: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,

        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
          },
        },

        images: {
          orderBy: [
            {
              isCover: "desc",
            },
            {
              position: "asc",
            },
          ],

          take: 1,

          select: {
            id: true,
            publicUrl: true,
            position: true,
            isCover: true,
          },
        },

        ticketTypes: {
          orderBy: {
            createdAt: "asc",
          },

          select: {
            id: true,
            price: true,
            quantity: true,
          },
        },
      },
    });

    const eventIds = events.map(
      (event) => event.id,
    );

    const [
      soldTicketsByEvent,
      paidOrdersByEvent,
    ] =
      eventIds.length > 0
        ? await Promise.all([
            prisma.ticket.groupBy({
              by: ["eventId"],

              where: {
                eventId: {
                  in: eventIds,
                },

                status: {
                  in: ["VALID", "USED"],
                },
              },

              _count: {
                _all: true,
              },
            }),

            prisma.order.groupBy({
              by: ["eventId"],

              where: {
                eventId: {
                  in: eventIds,
                },

                status: "PAID",
              },

              _count: {
                _all: true,
              },

              _sum: {
                subtotal: true,
                platformFee: true,
              },
            }),
          ])
        : [[], []];

    const soldTicketsMap = new Map(
      soldTicketsByEvent.map((item) => [
        item.eventId,
        item._count._all,
      ]),
    );

    const paidOrdersMap = new Map(
      paidOrdersByEvent.map((item) => [
        item.eventId,
        {
          count: item._count._all,
          grossRevenue: decimalToNumber(
            item._sum.subtotal,
          ),
          platformFee: decimalToNumber(
            item._sum.platformFee,
          ),
        },
      ]),
    );

    const eventItems: OrganizerEventListItem[] =
      events.map((event) => {
        const ticketsSold =
          soldTicketsMap.get(event.id) ?? 0;

        const placesRemaining = Math.max(
          event.capacity - ticketsSold,
          0,
        );

        const orderMetrics =
          paidOrdersMap.get(event.id) ?? {
            count: 0,
            grossRevenue: 0,
            platformFee: 0,
          };

        const prices = event.ticketTypes.map(
          (ticketType) =>
            decimalToNumber(ticketType.price),
        );

        const minimumTicketPrice =
          prices.length > 0
            ? Math.min(...prices)
            : 0;

        const maximumTicketPrice =
          prices.length > 0
            ? Math.max(...prices)
            : 0;

        const organizerNetRevenue =
          orderMetrics.grossRevenue -
          orderMetrics.platformFee;

        const image = event.images[0] ?? null;

        const hasPaidOrders =
          orderMetrics.count > 0;

        const canDelete =
          !hasPaidOrders &&
          ticketsSold === 0 &&
          ["DRAFT", "PENDING"].includes(
            event.status,
          );

        const canEdit = [
          "DRAFT",
          "PENDING",
          "PUBLISHED",
          "SUSPENDED",
        ].includes(event.status);

        const canCancel = [
          "PENDING",
          "PUBLISHED",
          "SUSPENDED",
        ].includes(event.status);

        return {
          id: event.id,
          title: event.title,
          slug: event.slug,
          description: event.description,
          coverImage:
            image?.publicUrl ??
            event.coverImage ??
            null,

          category: event.category,
          image,

          venueName: event.venueName,
          address: event.address,
          city: event.city,
          country: event.country,
          countryCode: event.countryCode,
          timezone: event.timezone,

          startsAt:
            event.startsAt.toISOString(),

          endsAt:
            event.endsAt?.toISOString() ??
            null,

          salesStartAt:
            event.salesStartAt?.toISOString() ??
            null,

          salesEndAt:
            event.salesEndAt?.toISOString() ??
            null,

          currency: event.currency,

          platformFeePercent:
            decimalToNumber(
              event.platformFeeRate,
            ),

          capacity: event.capacity,
          status: event.status,

          publishedAt:
            event.publishedAt?.toISOString() ??
            null,

          createdAt:
            event.createdAt.toISOString(),

          updatedAt:
            event.updatedAt.toISOString(),

          ticketTypesCount:
            event.ticketTypes.length,

          minimumTicketPrice,
          maximumTicketPrice,

          ticketsSold,
          placesRemaining,

          salesProgressPercent:
            calculatePercentage(
              ticketsSold,
              event.capacity,
            ),

          paidOrdersCount:
            orderMetrics.count,

          grossRevenue:
            orderMetrics.grossRevenue,

          platformFee:
            orderMetrics.platformFee,

          organizerNetRevenue,

          canEdit,
          canDelete,
          canCancel,
        };
      });

    const statusCountsMap = new Map(
      groupedStatusCounts.map((item) => [
        item.status,
        item._count._all,
      ]),
    );

    const statusCounts: OrganizerEventsStatusCounts =
      {
        all: groupedStatusCounts.reduce(
          (total, item) =>
            total + item._count._all,
          0,
        ),

        draft:
          statusCountsMap.get("DRAFT") ?? 0,

        pending:
          statusCountsMap.get("PENDING") ?? 0,

        published:
          statusCountsMap.get("PUBLISHED") ?? 0,

        suspended:
          statusCountsMap.get("SUSPENDED") ?? 0,

        cancelled:
          statusCountsMap.get("CANCELLED") ?? 0,

        completed:
          statusCountsMap.get("COMPLETED") ?? 0,
      };

    const totalCapacity =
      allOrganizerEvents.reduce(
        (total, event) =>
          total + event.capacity,
        0,
      );

    const totalPlacesRemaining = Math.max(
      totalCapacity - allSoldTicketsCount,
      0,
    );

    const grossRevenue = decimalToNumber(
      allPaidOrders._sum.subtotal,
    );

    const platformFee = decimalToNumber(
      allPaidOrders._sum.platformFee,
    );

    const organizerNetRevenue =
      grossRevenue - platformFee;

    const activeEvents =
      allOrganizerEvents.filter((event) =>
        ["PENDING", "PUBLISHED"].includes(
          event.status,
        ),
      ).length;

    const firstName =
      organizer.firstName.trim();

    const lastName =
      organizer.lastName.trim();

    const businessName =
      organizer.organizerProfile
        ?.businessName?.trim() || null;

    return {
      organizer: {
        id: organizer.id,
        firstName,
        lastName,

        displayName:
          businessName ||
          `${firstName} ${lastName}`.trim(),

        businessName,
      },

      filters: {
        search,
        status,
        sort,
      },

      statusCounts,

      summary: {
        totalEvents:
          allOrganizerEvents.length,

        activeEvents,
        totalCapacity,
        totalTicketsSold:
          allSoldTicketsCount,

        totalPlacesRemaining,

        totalPaidOrders:
          allPaidOrders._count._all,

        grossRevenue,
        platformFee,
        organizerNetRevenue,
      },

      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },

      events: eventItems,
    };
  } catch (error) {
    if (
      error instanceof
      GetOrganizerEventsError
    ) {
      throw error;
    }

    console.error(
      "[GET_ORGANIZER_EVENTS_ERROR]",
      error instanceof Error
        ? error.message
        : error,
    );

    throw new GetOrganizerEventsError({
      code: "GET_EVENTS_FAILED",
      status: 500,
      message:
        "Impossible de charger vos événements pour le moment.",
    });
  }
}