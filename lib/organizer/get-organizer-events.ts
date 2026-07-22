import "server-only";

import { createHash } from "node:crypto";

import {
  EventStatus,
  Prisma,
  UserRole,
} from "@prisma/client";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DEFAULT_CURRENCY = "XOF";

export type OrganizerEventSort =
  | "recent"
  | "oldest"
  | "starts-soon"
  | "starts-late"
  | "title-asc"
  | "title-desc";

export type GetOrganizerEventsInput = {
  page?: number;
  pageSize?: number;
  search?: string | null;
  status?: EventStatus | null;
  statuses?: readonly EventStatus[];
  categoryId?: string | null;
  countryCode?: string | null;
  currency?: string | null;
  from?: Date | string | null;
  to?: Date | string | null;
  sort?: OrganizerEventSort;
  includeCounts?: boolean;
};

export type OrganizerEventCategoryItem = {
  id: string;
  name: string;
  slug: string;
};

export type OrganizerEventImageItem = {
  id: string;
  publicUrl: string;
  isCover: boolean;
  position: number;
};

export type OrganizerEventCounts = {
  ticketTypes: number;
  orders: number;
  tickets: number;
};

export type OrganizerEventItem = {
  id: string;
  organizerId: string;
  categoryId: string | null;

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
  endsAt: string;
  salesStartAt: string | null;
  salesEndAt: string | null;

  currency: string;
  platformFeeRate: number;
  capacity: number;
  status: EventStatus;

  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;

  category: OrganizerEventCategoryItem | null;
  images: OrganizerEventImageItem[];
  counts: OrganizerEventCounts;
};

export type OrganizerEventsPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type GetOrganizerEventsResult = {
  organizerId: string;
  events: OrganizerEventItem[];
  pagination: OrganizerEventsPagination;
};

export type GetOrganizerEventsErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_QUERY"
  | "LOAD_FAILED";

export class GetOrganizerEventsError extends Error {
  readonly code: GetOrganizerEventsErrorCode;
  readonly status: number;

  constructor({
    code,
    status,
    message,
  }: {
    code: GetOrganizerEventsErrorCode;
    status: number;
    message: string;
  }) {
    super(message);

    this.name = "GetOrganizerEventsError";
    this.code = code;
    this.status = status;
  }
}

function hashSessionToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1
  ) {
    return fallback;
  }

  return value;
}

function normalizePageSize(
  value: number | undefined,
): number {
  return Math.min(
    normalizePositiveInteger(
      value,
      DEFAULT_PAGE_SIZE,
    ),
    MAX_PAGE_SIZE,
  );
}

function normalizeOptionalText(
  value: string | null | undefined,
  maximumLength: number,
): string {
  return value
    ?.trim()
    .slice(0, maximumLength) ?? "";
}

function normalizeCurrency(
  value: string | null | undefined,
): string {
  const normalized =
    normalizeOptionalText(
      value,
      3,
    ).toUpperCase();

  return /^[A-Z]{3}$/.test(normalized)
    ? normalized
    : "";
}

function normalizeCountryCode(
  value: string | null | undefined,
): string {
  return normalizeOptionalText(
    value,
    3,
  ).toUpperCase();
}

function parseOptionalDate(
  value: Date | string | null | undefined,
  label: string,
): Date | null {
  if (!value) {
    return null;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new GetOrganizerEventsError({
      code: "INVALID_QUERY",
      status: 400,
      message:
        `La valeur de ${label} n’est pas une date valide.`,
    });
  }

  return date;
}

function getOrderBy(
  sort: OrganizerEventSort,
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

    case "starts-soon":
      return [
        {
          startsAt: "asc",
        },
        {
          createdAt: "desc",
        },
      ];

    case "starts-late":
      return [
        {
          startsAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ];

    case "title-asc":
      return [
        {
          title: "asc",
        },
        {
          createdAt: "desc",
        },
      ];

    case "title-desc":
      return [
        {
          title: "desc",
        },
        {
          createdAt: "desc",
        },
      ];

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

async function getAuthenticatedOrganizerId(): Promise<string> {
  const cookieStore =
    await cookies();

  const sessionCookieName =
    process.env.SESSION_COOKIE_NAME?.trim() ||
    "tikemia_session";

  const rawSessionToken =
    cookieStore.get(
      sessionCookieName,
    )?.value;

  if (!rawSessionToken) {
    throw new GetOrganizerEventsError({
      code: "UNAUTHORIZED",
      status: 401,
      message:
        "Votre session a expiré. Connectez-vous de nouveau.",
    });
  }

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash:
          hashSessionToken(
            rawSessionToken,
          ),
      },
      select: {
        id: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            role: true,
            emailVerified: true,
            isActive: true,
          },
        },
      },
    });

  if (!session) {
    throw new GetOrganizerEventsError({
      code: "UNAUTHORIZED",
      status: 401,
      message:
        "Votre session n’est plus valide. Connectez-vous de nouveau.",
    });
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

    throw new GetOrganizerEventsError({
      code: "UNAUTHORIZED",
      status: 401,
      message:
        "Votre session a expiré. Connectez-vous de nouveau.",
    });
  }

  if (
    session.user.role !==
    UserRole.ORGANIZER
  ) {
    throw new GetOrganizerEventsError({
      code: "FORBIDDEN",
      status: 403,
      message:
        "Ce compte ne correspond pas à un espace organisateur.",
    });
  }

  if (
    !session.user.isActive ||
    !session.user.emailVerified
  ) {
    throw new GetOrganizerEventsError({
      code: "FORBIDDEN",
      status: 403,
      message:
        "Votre compte organisateur ne peut pas accéder à cette ressource.",
    });
  }

  return session.user.id;
}

export async function getOrganizerEvents(
  input: GetOrganizerEventsInput = {},
): Promise<GetOrganizerEventsResult> {
  try {
    const organizerId =
      await getAuthenticatedOrganizerId();

    const page =
      normalizePositiveInteger(
        input.page,
        DEFAULT_PAGE,
      );

    const pageSize =
      normalizePageSize(
        input.pageSize,
      );

    const search =
      normalizeOptionalText(
        input.search,
        120,
      );

    const categoryId =
      normalizeOptionalText(
        input.categoryId,
        191,
      );

    const countryCode =
      normalizeCountryCode(
        input.countryCode,
      );

    const currency =
      normalizeCurrency(
        input.currency,
      );

    const from =
      parseOptionalDate(
        input.from,
        "la date de début",
      );

    const to =
      parseOptionalDate(
        input.to,
        "la date de fin",
      );

    if (
      from &&
      to &&
      from.getTime() >
        to.getTime()
    ) {
      throw new GetOrganizerEventsError({
        code: "INVALID_QUERY",
        status: 400,
        message:
          "La date de début ne peut pas être postérieure à la date de fin.",
      });
    }

    const requestedStatuses =
      input.statuses?.length
        ? Array.from(
            new Set(
              input.statuses,
            ),
          )
        : input.status
          ? [input.status]
          : [];

    const where: Prisma.EventWhereInput = {
      organizerId,

      ...(requestedStatuses.length
        ? {
            status: {
              in: requestedStatuses,
            },
          }
        : {}),

      ...(categoryId
        ? {
            categoryId,
          }
        : {}),

      ...(countryCode
        ? {
            countryCode,
          }
        : {}),

      ...(currency
        ? {
            currency,
          }
        : {}),

      ...(
        from ||
        to
          ? {
              startsAt: {
                ...(from
                  ? {
                      gte: from,
                    }
                  : {}),
                ...(to
                  ? {
                      lte: to,
                    }
                  : {}),
              },
            }
          : {}
      ),

      ...(search
        ? {
            OR: [
              {
                title: {
                  contains: search,
                  mode:
                    Prisma.QueryMode.insensitive,
                },
              },
              {
                slug: {
                  contains: search,
                  mode:
                    Prisma.QueryMode.insensitive,
                },
              },
              {
                city: {
                  contains: search,
                  mode:
                    Prisma.QueryMode.insensitive,
                },
              },
              {
                country: {
                  contains: search,
                  mode:
                    Prisma.QueryMode.insensitive,
                },
              },
              {
                venueName: {
                  contains: search,
                  mode:
                    Prisma.QueryMode.insensitive,
                },
              },
            ],
          }
        : {}),
    };

    const includeCounts =
      input.includeCounts !== false;

    const skip =
      (page - 1) * pageSize;

    const [events, total] =
      await Promise.all([
        prisma.event.findMany({
          where,
          select: {
            id: true,
            organizerId: true,
            categoryId: true,

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
              select: {
                id: true,
                publicUrl: true,
                isCover: true,
                position: true,
              },
            },

            _count: includeCounts
              ? {
                  select: {
                    ticketTypes: true,
                    orders: true,
                    tickets: true,
                  },
                }
              : false,
          },
          orderBy:
            getOrderBy(
              input.sort ??
                "recent",
            ),
          skip,
          take: pageSize,
        }),

        prisma.event.count({
          where,
        }),
      ]);

    const normalizedEvents:
      OrganizerEventItem[] =
      events.map((event) => {
        const counts =
          "_count" in event &&
          event._count
            ? {
                ticketTypes:
                  event._count
                    .ticketTypes,
                orders:
                  event._count
                    .orders,
                tickets:
                  event._count
                    .tickets,
              }
            : {
                ticketTypes: 0,
                orders: 0,
                tickets: 0,
              };

        return {
          id: event.id,
          organizerId:
            event.organizerId,
          categoryId:
            event.categoryId,

          title: event.title,
          slug: event.slug,
          description:
            event.description,

          coverImage:
            event.coverImage ??
            event.images.find(
              (image) =>
                image.isCover,
            )?.publicUrl ??
            event.images[0]
              ?.publicUrl ??
            null,

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
            event.startsAt
              .toISOString(),
          endsAt:
            event.endsAt
              ?.toISOString() ??
            "",

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

          platformFeeRate:
            event.platformFeeRate
              .toNumber(),

          capacity:
            event.capacity,

          status:
            event.status,

          publishedAt:
            event.publishedAt
              ?.toISOString() ??
            null,

          createdAt:
            event.createdAt
              .toISOString(),

          updatedAt:
            event.updatedAt
              .toISOString(),

          category:
            event.category,

          images:
            event.images,

          counts,
        };
      });

    const totalPages =
      total === 0
        ? 0
        : Math.ceil(
            total / pageSize,
          );

    return {
      organizerId,
      events:
        normalizedEvents,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasPreviousPage:
          page > 1,
        hasNextPage:
          page < totalPages,
      },
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
        ? {
            name: error.name,
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

    throw new GetOrganizerEventsError({
      code: "LOAD_FAILED",
      status: 500,
      message:
        "Impossible de charger les événements pour le moment.",
    });
  }
}

export default getOrganizerEvents;