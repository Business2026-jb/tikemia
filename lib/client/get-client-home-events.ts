import "server-only";

import {
  EventStatus,
  Prisma,
  TicketStatus,
} from "@prisma/client";

import {
  prisma,
} from "@/lib/prisma";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 48;
const DEFAULT_FEATURED_LIMIT = 5;
const MAX_FEATURED_LIMIT = 12;
const DEFAULT_CURRENCY = "XOF";

export type ClientHomeEventSort =
  | "soonest"
  | "latest"
  | "popular"
  | "price-low"
  | "price-high";

export type GetClientHomeEventsInput = {
  page?: number;
  pageSize?: number;
  featuredLimit?: number;

  search?: string | null;
  category?: string | null;
  city?: string | null;
  countryCode?: string | null;
  dateFrom?: Date | string | null;
  dateTo?: Date | string | null;

  sort?: ClientHomeEventSort;
};

export type ClientHomeOrganizer = {
  id: string;
  name: string;
  businessName: string | null;
  displayName: string;
  logo: string | null;
  avatar: string | null;
  hasBlueBadge: boolean;
};

export type ClientHomeCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  eventCount: number;
};

export type ClientHomeEventImage = {
  id: string;
  publicUrl: string;
  isCover: boolean;
  position: number;
};

export type ClientHomeEventPrice = {
  amount: number;
  currency: string;
  isFree: boolean;
};

export type ClientHomeEventAvailability = {
  capacity: number;
  reservedTickets: number;
  availableTickets: number;
  soldOut: boolean;
};

export type ClientHomeEvent = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;

  coverImage: string | null;
  images: ClientHomeEventImage[];

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
  status: EventStatus;

  isFeatured: boolean;
  publishedAt: string | null;

  category: Omit<ClientHomeCategory, "eventCount"> | null;
  organizer: ClientHomeOrganizer;

  price: ClientHomeEventPrice;
  availability: ClientHomeEventAvailability;

  paidOrdersCount: number;
  soldTicketsCount: number;
};

export type ClientHomeCityOption = {
  city: string;
  country: string;
  countryCode: string;
  eventCount: number;
};

export type ClientHomePagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type ClientHomeAppliedFilters = {
  search: string;
  category: string | null;
  city: string | null;
  countryCode: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  sort: ClientHomeEventSort;
};

export type GetClientHomeEventsResult = {
  generatedAt: string;

  featuredEvents: ClientHomeEvent[];
  events: ClientHomeEvent[];

  categories: ClientHomeCategory[];
  cities: ClientHomeCityOption[];

  pagination: ClientHomePagination;
  filters: ClientHomeAppliedFilters;

  totals: {
    publishedEvents: number;
    featuredEvents: number;
    categories: number;
    cities: number;
  };
};

export class GetClientHomeEventsError extends Error {
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

    this.name = "GetClientHomeEventsError";
    this.code = code;
    this.status = status;
  }
}

const eventSelect = {
  id: true,
  slug: true,
  title: true,
  shortDescription: true,

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
  capacity: true,
  status: true,
  isFree: true,
  isFeatured: true,
  publishedAt: true,

  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      icon: true,
    },
  },

  organizer: {
    select: {
      id: true,
      firstName: true,
      lastName: true,

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

  images: {
    orderBy: [
      {
        isCover: "desc" as const,
      },
      {
        position: "asc" as const,
      },
    ],
    select: {
      id: true,
      publicUrl: true,
      isCover: true,
      position: true,
    },
  },

  ticketTypes: {
    where: {
      isActive: true,
    },
    orderBy: {
      price: "asc" as const,
    },
    select: {
      id: true,
      price: true,
      quantity: true,
      saleStartsAt: true,
      saleEndsAt: true,
    },
  },

  orders: {
    where: {
      status: "PAID" as const,
    },
    select: {
      id: true,
    },
  },
} satisfies Prisma.EventSelect;

type SelectedEvent =
  Prisma.EventGetPayload<{
    select: typeof eventSelect;
  }>;

function normalizeText(
  value: string | null | undefined,
  maximumLength: number,
): string {
  return (
    value
      ?.trim()
      .slice(0, maximumLength) ??
    ""
  );
}

function normalizePositiveInteger({
  value,
  fallback,
  maximum,
}: {
  value: number | undefined;
  fallback: number;
  maximum: number;
}): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1
  ) {
    return fallback;
  }

  return Math.min(value, maximum);
}

function normalizeCountryCode(
  value: string | null | undefined,
): string {
  const normalized =
    normalizeText(value, 3).toUpperCase();

  return /^[A-Z]{2,3}$/.test(normalized)
    ? normalized
    : "";
}

function normalizeSort(
  value: ClientHomeEventSort | undefined,
): ClientHomeEventSort {
  switch (value) {
    case "latest":
    case "popular":
    case "price-low":
    case "price-high":
      return value;

    default:
      return "soonest";
  }
}

function parseOptionalDate({
  value,
  label,
  endOfDay = false,
}: {
  value: Date | string | null | undefined;
  label: string;
  endOfDay?: boolean;
}): Date | null {
  if (!value) {
    return null;
  }

  const date =
    value instanceof Date
      ? new Date(value)
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new GetClientHomeEventsError({
      code: "INVALID_DATE",
      status: 400,
      message: `${label} n’est pas une date valide.`,
    });
  }

  if (
    endOfDay &&
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

function buildPublicEventWhere({
  now,
  search,
  category,
  city,
  countryCode,
  dateFrom,
  dateTo,
}: {
  now: Date;
  search: string;
  category: string;
  city: string;
  countryCode: string;
  dateFrom: Date | null;
  dateTo: Date | null;
}): Prisma.EventWhereInput {
  return {
    status: EventStatus.PUBLISHED,

    startsAt: {
      gte: dateFrom ?? now,
      ...(dateTo
        ? {
            lte: dateTo,
          }
        : {}),
    },

    organizer: {
      is: {
        isActive: true,
      },
    },

    ...(category
      ? {
          category: {
            is: {
              isActive: true,
              OR: [
                {
                  id: category,
                },
                {
                  slug: category,
                },
              ],
            },
          },
        }
      : {}),

    ...(city
      ? {
          city: {
            equals: city,
            mode: Prisma.QueryMode.insensitive,
          },
        }
      : {}),

    ...(countryCode
      ? {
          countryCode,
        }
      : {}),

    ...(search
      ? {
          OR: [
            {
              title: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              shortDescription: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              venueName: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              city: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              country: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              category: {
                is: {
                  name: {
                    contains: search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
            },
            {
              organizer: {
                is: {
                  OR: [
                    {
                      firstName: {
                        contains: search,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                    {
                      lastName: {
                        contains: search,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                    {
                      organizerProfile: {
                        is: {
                          businessName: {
                            contains: search,
                            mode: Prisma.QueryMode.insensitive,
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };
}

function getEventOrderBy(
  sort: ClientHomeEventSort,
): Prisma.EventOrderByWithRelationInput[] {
  switch (sort) {
    case "latest":
      return [
        {
          publishedAt: "desc",
        },
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ];

    case "popular":
      return [
        {
          orders: {
            _count: "desc",
          },
        },
        {
          startsAt: "asc",
        },
        {
          id: "asc",
        },
      ];

    case "price-low":
    case "price-high":
      /*
       * Prisma ne trie pas directement un événement selon le prix minimum
       * d'une relation TicketType. Le tri exact est donc finalisé en mémoire
       * après la récupération de la page.
       */
      return [
        {
          startsAt: "asc",
        },
        {
          id: "asc",
        },
      ];

    default:
      return [
        {
          startsAt: "asc",
        },
        {
          publishedAt: "desc",
        },
        {
          id: "asc",
        },
      ];
  }
}

function getOrganizerDisplayName(
  event: SelectedEvent,
): ClientHomeOrganizer {
  const firstName =
    event.organizer.firstName.trim();

  const lastName =
    event.organizer.lastName.trim();

  const name =
    `${firstName} ${lastName}`
      .replace(/\s+/g, " ")
      .trim() ||
    "Organisateur Tikemia";

  const businessName =
    event.organizer.organizerProfile
      ?.businessName?.trim() ||
    null;

  return {
    id: event.organizer.id,
    name,
    businessName,
    displayName:
      businessName || name,
    logo:
      event.organizer.organizerProfile
        ?.logo ??
      null,
    avatar:
      event.organizer.organizerProfile
        ?.avatar ??
      null,
    hasBlueBadge:
      event.organizer.organizerProfile
        ?.hasBlueBadge ??
      false,
  };
}

function getMinimumPrice(
  event: SelectedEvent,
): ClientHomeEventPrice {
  if (event.isFree) {
    return {
      amount: 0,
      currency:
        event.currency
          .trim()
          .toUpperCase() ||
        DEFAULT_CURRENCY,
      isFree: true,
    };
  }

  const minimumPrice =
    event.ticketTypes.reduce<number | null>(
      (currentMinimum, ticketType) => {
        const price =
          ticketType.price.toNumber();

        if (currentMinimum === null) {
          return price;
        }

        return Math.min(
          currentMinimum,
          price,
        );
      },
      null,
    );

  return {
    amount: minimumPrice ?? 0,
    currency:
      event.currency
        .trim()
        .toUpperCase() ||
      DEFAULT_CURRENCY,
    isFree: false,
  };
}

function getCoverImage(
  event: SelectedEvent,
): string | null {
  return (
    event.coverImage ??
    event.images.find(
      (image) =>
        image.isCover,
    )?.publicUrl ??
    event.images[0]?.publicUrl ??
    null
  );
}

function mapEvent({
  event,
  reservedTickets,
}: {
  event: SelectedEvent;
  reservedTickets: number;
}): ClientHomeEvent {
  const capacity =
    Math.max(
      event.capacity,
      0,
    );

  const availableTickets =
    capacity > 0
      ? Math.max(
          capacity -
            reservedTickets,
          0,
        )
      : Math.max(
          event.ticketTypes.reduce(
            (total, ticketType) =>
              total +
              Math.max(
                ticketType.quantity,
                0,
              ),
            0,
          ) -
            reservedTickets,
          0,
        );

  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    shortDescription:
      event.shortDescription,

    coverImage:
      getCoverImage(event),

    images:
      event.images,

    venueName:
      event.venueName,

    address:
      event.address,

    city:
      event.city,

    country:
      event.country,

    countryCode:
      event.countryCode,

    timezone:
      event.timezone,

    startsAt:
      event.startsAt.toISOString(),

    endsAt:
      event.endsAt?.toISOString() ??
      null,

    salesStartAt:
      event.salesStartAt
        ?.toISOString() ??
      null,

    salesEndAt:
      event.salesEndAt
        ?.toISOString() ??
      null,

    currency:
      event.currency
        .trim()
        .toUpperCase() ||
      DEFAULT_CURRENCY,

    status:
      event.status,

    isFeatured:
      event.isFeatured,

    publishedAt:
      event.publishedAt
        ?.toISOString() ??
      null,

    category:
      event.category,

    organizer:
      getOrganizerDisplayName(
        event,
      ),

    price:
      getMinimumPrice(
        event,
      ),

    availability: {
      capacity,
      reservedTickets,
      availableTickets,
      soldOut:
        availableTickets <= 0,
    },

    paidOrdersCount:
      event.orders.length,

    soldTicketsCount:
      reservedTickets,
  };
}

function sortEventsByPrice(
  events: ClientHomeEvent[],
  sort: ClientHomeEventSort,
): ClientHomeEvent[] {
  if (
    sort !== "price-low" &&
    sort !== "price-high"
  ) {
    return events;
  }

  return [...events].sort(
    (first, second) => {
      const direction =
        sort === "price-low"
          ? 1
          : -1;

      const priceDifference =
        (
          first.price.amount -
          second.price.amount
        ) * direction;

      if (priceDifference !== 0) {
        return priceDifference;
      }

      return (
        new Date(
          first.startsAt,
        ).getTime() -
        new Date(
          second.startsAt,
        ).getTime()
      );
    },
  );
}

async function loadReservedTicketCounts(
  eventIds: string[],
): Promise<Map<string, number>> {
  if (eventIds.length === 0) {
    return new Map();
  }

  const groupedTickets =
    await prisma.ticket.groupBy({
      by: [
        "eventId",
      ],

      where: {
        eventId: {
          in: eventIds,
        },

        status: {
          in: [
            TicketStatus.VALID,
            TicketStatus.USED,
          ],
        },
      },

      _count: {
        _all: true,
      },
    });

  return new Map(
    groupedTickets.map(
      (item) => [
        item.eventId,
        item._count._all,
      ],
    ),
  );
}

async function loadCategoryOptions(
  now: Date,
): Promise<ClientHomeCategory[]> {
  const categories =
    await prisma.eventCategory.findMany({
      where: {
        isActive: true,
      },

      orderBy: {
        name: "asc",
      },

      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,

        _count: {
          select: {
            events: {
              where: {
                status:
                  EventStatus.PUBLISHED,

                startsAt: {
                  gte: now,
                },

                organizer: {
                  is: {
                    isActive: true,
                  },
                },
              },
            },
          },
        },
      },
    });

  return categories
    .map(
      (category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        icon: category.icon,
        eventCount:
          category._count.events,
      }),
    )
    .filter(
      (category) =>
        category.eventCount > 0,
    );
}

async function loadCityOptions(
  now: Date,
): Promise<ClientHomeCityOption[]> {
  const cities =
    await prisma.event.groupBy({
      by: [
        "city",
        "country",
        "countryCode",
      ],

      where: {
        status:
          EventStatus.PUBLISHED,

        startsAt: {
          gte: now,
        },

        organizer: {
          is: {
            isActive: true,
          },
        },
      },

      _count: {
        _all: true,
      },

      orderBy: {
        _count: {
          city: "desc",
        },
      },

      take: 40,
    });

  return cities.map(
    (item) => ({
      city: item.city,
      country: item.country,
      countryCode:
        item.countryCode,
      eventCount:
        item._count._all,
    }),
  );
}

export async function getClientHomeEvents(
  input: GetClientHomeEventsInput = {},
): Promise<GetClientHomeEventsResult> {
  const now =
    new Date();

  const page =
    normalizePositiveInteger({
      value:
        input.page,
      fallback:
        DEFAULT_PAGE,
      maximum:
        Number.MAX_SAFE_INTEGER,
    });

  const pageSize =
    normalizePositiveInteger({
      value:
        input.pageSize,
      fallback:
        DEFAULT_PAGE_SIZE,
      maximum:
        MAX_PAGE_SIZE,
    });

  const featuredLimit =
    normalizePositiveInteger({
      value:
        input.featuredLimit,
      fallback:
        DEFAULT_FEATURED_LIMIT,
      maximum:
        MAX_FEATURED_LIMIT,
    });

  const search =
    normalizeText(
      input.search,
      120,
    );

  const category =
    normalizeText(
      input.category,
      100,
    );

  const city =
    normalizeText(
      input.city,
      100,
    );

  const countryCode =
    normalizeCountryCode(
      input.countryCode,
    );

  const dateFrom =
    parseOptionalDate({
      value:
        input.dateFrom,
      label:
        "La date de début",
    });

  const dateTo =
    parseOptionalDate({
      value:
        input.dateTo,
      label:
        "La date de fin",
      endOfDay:
        true,
    });

  if (
    dateFrom &&
    dateTo &&
    dateFrom.getTime() >
      dateTo.getTime()
  ) {
    throw new GetClientHomeEventsError({
      code:
        "INVALID_DATE_RANGE",

      status:
        400,

      message:
        "La date de début ne peut pas être postérieure à la date de fin.",
    });
  }

  const sort =
    normalizeSort(
      input.sort,
    );

  const publicWhere =
    buildPublicEventWhere({
      now,
      search,
      category,
      city,
      countryCode,
      dateFrom,
      dateTo,
    });

  const featuredWhere: Prisma.EventWhereInput = {
    ...publicWhere,
    isFeatured: true,
  };

  const skip =
    (page - 1) *
    pageSize;

  try {
    const [
      rawFeaturedEvents,
      rawEvents,
      totalItems,
      categories,
      cities,
      totalPublishedEvents,
      totalFeaturedEvents,
    ] =
      await Promise.all([
        prisma.event.findMany({
          where:
            featuredWhere,

          select:
            eventSelect,

          orderBy: [
            {
              startsAt: "asc",
            },
            {
              publishedAt: "desc",
            },
          ],

          take:
            featuredLimit,
        }),

        prisma.event.findMany({
          where:
            publicWhere,

          select:
            eventSelect,

          orderBy:
            getEventOrderBy(
              sort,
            ),

          skip,
          take:
            pageSize,
        }),

        prisma.event.count({
          where:
            publicWhere,
        }),

        loadCategoryOptions(
          now,
        ),

        loadCityOptions(
          now,
        ),

        prisma.event.count({
          where: {
            status:
              EventStatus.PUBLISHED,

            startsAt: {
              gte: now,
            },

            organizer: {
              is: {
                isActive: true,
              },
            },
          },
        }),

        prisma.event.count({
          where: {
            status:
              EventStatus.PUBLISHED,

            isFeatured:
              true,

            startsAt: {
              gte: now,
            },

            organizer: {
              is: {
                isActive: true,
              },
            },
          },
        }),
      ]);

    const eventIds =
      Array.from(
        new Set(
          [
            ...rawFeaturedEvents,
            ...rawEvents,
          ].map(
            (event) =>
              event.id,
          ),
        ),
      );

    const reservedTicketCounts =
      await loadReservedTicketCounts(
        eventIds,
      );

    const featuredEvents =
      rawFeaturedEvents.map(
        (event) =>
          mapEvent({
            event,
            reservedTickets:
              reservedTicketCounts.get(
                event.id,
              ) ?? 0,
          }),
      );

    const events =
      sortEventsByPrice(
        rawEvents.map(
          (event) =>
            mapEvent({
              event,
              reservedTickets:
                reservedTicketCounts.get(
                  event.id,
                ) ?? 0,
            }),
        ),
        sort,
      );

    const totalPages =
      totalItems === 0
        ? 0
        : Math.ceil(
            totalItems /
              pageSize,
          );

    return {
      generatedAt:
        new Date().toISOString(),

      featuredEvents,
      events,

      categories,
      cities,

      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasPreviousPage:
          page > 1,
        hasNextPage:
          page < totalPages,
      },

      filters: {
        search,
        category:
          category || null,
        city:
          city || null,
        countryCode:
          countryCode ||
          null,
        dateFrom:
          dateFrom?.toISOString() ??
          null,
        dateTo:
          dateTo?.toISOString() ??
          null,
        sort,
      },

      totals: {
        publishedEvents:
          totalPublishedEvents,

        featuredEvents:
          totalFeaturedEvents,

        categories:
          categories.length,

        cities:
          cities.length,
      },
    };
  } catch (error) {
    if (
      error instanceof
      GetClientHomeEventsError
    ) {
      throw error;
    }

    console.error(
      "[GET_CLIENT_HOME_EVENTS_ERROR]",
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

    throw new GetClientHomeEventsError({
      code:
        "CLIENT_HOME_EVENTS_LOAD_FAILED",

      status:
        500,

      message:
        "Impossible de charger les événements pour le moment.",
    });
  }
}

export default getClientHomeEvents;