import "server-only";

import {
  EventBoostSource,
  EventBoostStatus,
  Prisma,
} from "@prisma/client";

import { AdminPromotionError } from "@/lib/admin/promotions/admin-promotion-errors";
import { prisma } from "@/lib/prisma";

export type AdminPromotionSort =
  | "recent"
  | "oldest"
  | "starts_soon"
  | "ends_soon"
  | "priority_desc"
  | "priority_asc";

export type GetAdminPromotionsInput = Readonly<{
  search?: string | null;
  status?: EventBoostStatus | "all";
  source?: EventBoostSource | "all";
  organizerId?: string | null;
  country?: string | null;
  startsFrom?: Date | string | null;
  startsTo?: Date | string | null;
  sort?: AdminPromotionSort;
  page?: number;
  pageSize?: number;
}>;

export type AdminPromotionListItem = Readonly<{
  id: string;
  organizerId: string;
  eventId: string;
  subscriptionId: string | null;
  source: EventBoostSource;
  status: EventBoostStatus;
  priorityScore: number;
  startsAt: Date;
  endsAt: Date;
  activatedAt: Date | null;
  pausedAt: Date | null;
  canceledAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  event: {
    id: string;
    title: string;
    slug: string;
    coverImage: string | null;
    status: string;
    city: string;
    country: string;
    startsAt: Date;
    endsAt: Date | null;
    isFeatured: boolean;
  };
  organizer: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    country: string;
    businessName: string | null;
  };
  subscription: {
    id: string;
    status: string;
    plan: {
      id: string;
      code: string;
      name: string;
      price: string;
      currency: string;
      priorityScore: number;
    };
    successfulPayment: {
      id: string;
      amount: string;
      currency: string;
      provider: string;
      providerReference: string | null;
      paidAt: Date | null;
    } | null;
  } | null;
}>;

export type GetAdminPromotionsResult = Readonly<{
  promotions: readonly AdminPromotionListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  options: {
    countries: readonly string[];
    organizers: readonly { id: string; name: string }[];
  };
}>;

function clean(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function parseDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AdminPromotionError({
      code: "ADMIN_PROMOTION_PERIOD_INVALID",
      message: "Une date de filtre est invalide.",
      status: 400,
    });
  }

  return date;
}

export function buildAdminPromotionWhere(
  input: GetAdminPromotionsInput,
): Prisma.EventBoostWhereInput {
  const where: Prisma.EventBoostWhereInput = {};
  const search = clean(input.search);
  const organizerId = clean(input.organizerId);
  const country = clean(input.country);
  const startsFrom = parseDate(input.startsFrom);
  const startsTo = parseDate(input.startsTo);

  if (input.status && input.status !== "all") where.status = input.status;
  if (input.source && input.source !== "all") where.source = input.source;
  if (organizerId) where.organizerId = organizerId;

  if (country) {
    where.event = {
      is: {
        country: { equals: country, mode: "insensitive" },
      },
    };
  }

  if (startsFrom || startsTo) {
    where.startsAt = {
      ...(startsFrom ? { gte: startsFrom } : {}),
      ...(startsTo ? { lte: startsTo } : {}),
    };
  }

  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      {
        event: {
          is: {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } },
              { city: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      },
      {
        organizer: {
          is: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
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
  sort: AdminPromotionSort | undefined,
): Prisma.EventBoostOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "starts_soon":
      return [{ startsAt: "asc" }, { createdAt: "desc" }];
    case "ends_soon":
      return [{ endsAt: "asc" }, { createdAt: "desc" }];
    case "priority_asc":
      return [{ priorityScore: "asc" }, { createdAt: "desc" }];
    case "priority_desc":
      return [{ priorityScore: "desc" }, { createdAt: "desc" }];
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

export async function getAdminPromotions(
  input: GetAdminPromotionsInput = {},
): Promise<GetAdminPromotionsResult> {
  const page =
    Number.isInteger(input.page) && Number(input.page) > 0
      ? Number(input.page)
      : 1;

  const pageSize = Math.min(
    Number.isInteger(input.pageSize) && Number(input.pageSize) > 0
      ? Number(input.pageSize)
      : 20,
    100,
  );

  const where = buildAdminPromotionWhere(input);

  try {
    const [totalItems, rows, organizers, countries] = await Promise.all([
      prisma.eventBoost.count({ where }),

      prisma.eventBoost.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: buildOrderBy(input.sort),
        select: {
          id: true,
          organizerId: true,
          eventId: true,
          subscriptionId: true,
          source: true,
          status: true,
          priorityScore: true,
          startsAt: true,
          endsAt: true,
          activatedAt: true,
          pausedAt: true,
          canceledAt: true,
          cancellationReason: true,
          createdAt: true,
          updatedAt: true,
          event: {
            select: {
              id: true,
              title: true,
              slug: true,
              coverImage: true,
              status: true,
              city: true,
              country: true,
              startsAt: true,
              endsAt: true,
              isFeatured: true,
            },
          },
          organizer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              country: true,
              organizerProfile: {
                select: { businessName: true },
              },
            },
          },
          subscription: {
            select: {
              id: true,
              status: true,
              plan: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  price: true,
                  currency: true,
                  priorityScore: true,
                },
              },
              payments: {
                where: { status: "SUCCESS" },
                orderBy: { paidAt: "desc" },
                take: 1,
                select: {
                  id: true,
                  amount: true,
                  currency: true,
                  provider: true,
                  providerReference: true,
                  paidAt: true,
                },
              },
            },
          },
        },
      }),

      prisma.user.findMany({
        where: {
          role: "ORGANIZER",
          organizerEventBoosts: { some: {} },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          organizerProfile: {
            select: { businessName: true },
          },
        },
      }),

      prisma.event.findMany({
        where: { boosts: { some: {} } },
        distinct: ["country"],
        orderBy: { country: "asc" },
        select: { country: true },
      }),
    ]);

    const promotions: AdminPromotionListItem[] = rows.map((row) => {
      const payment = row.subscription?.payments[0] ?? null;

      return {
        ...row,
        organizer: {
          id: row.organizer.id,
          fullName: `${row.organizer.firstName} ${row.organizer.lastName}`
            .replace(/\s+/g, " ")
            .trim(),
          email: row.organizer.email,
          phone: row.organizer.phone,
          country: row.organizer.country,
          businessName:
            row.organizer.organizerProfile?.businessName ?? null,
        },
        subscription: row.subscription
          ? {
              id: row.subscription.id,
              status: row.subscription.status,
              plan: {
                ...row.subscription.plan,
                price: row.subscription.plan.price.toFixed(2),
              },
              successfulPayment: payment
                ? {
                    ...payment,
                    amount: payment.amount.toFixed(2),
                  }
                : null,
            }
          : null,
      };
    });

    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

    return {
      promotions,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
      options: {
        countries: countries.map((item) => item.country),
        organizers: organizers.map((organizer) => ({
          id: organizer.id,
          name:
            organizer.organizerProfile?.businessName ||
            `${organizer.firstName} ${organizer.lastName}`
              .replace(/\s+/g, " ")
              .trim(),
        })),
      },
    };
  } catch (error) {
    if (error instanceof AdminPromotionError) throw error;

    throw new AdminPromotionError({
      code: "ADMIN_PROMOTION_QUERY_FAILED",
      message: "Impossible de charger les promotions d’événements.",
      status: 500,
      cause: error,
    });
  }
}
