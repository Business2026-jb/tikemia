import "server-only";

import {
  MarketingCampaignStatus,
  MarketingChannel,
  Prisma,
} from "@prisma/client";

import { AdminMarketingError } from "@/lib/admin/marketing/admin-marketing-errors";
import type { MarketingAuditPriority } from "@/lib/admin/marketing/create-marketing-audit-log";
import { prisma } from "@/lib/prisma";

export type AdminMarketingSort =
  | "recent"
  | "oldest"
  | "budget_desc"
  | "budget_asc"
  | "visits_desc"
  | "orders_desc"
  | "revenue_desc"
  | "ending_soon";

export type GetAdminMarketingCampaignsInput = Readonly<{
  search?: string | null;
  status?: MarketingCampaignStatus | "all";
  channel?: MarketingChannel | "all";
  organizerId?: string | null;
  eventId?: string | null;
  country?: string | null;
  startsFrom?: Date | string | null;
  startsTo?: Date | string | null;
  sort?: AdminMarketingSort;
  page?: number;
  pageSize?: number;
}>;

export type AdminMarketingCampaignListItem = Readonly<{
  id: string;
  organizerId: string;
  eventId: string;
  name: string;
  description: string | null;
  channel: MarketingChannel;
  status: MarketingCampaignStatus;
  source: string | null;
  medium: string | null;
  content: string | null;
  trackingCode: string;
  trackingUrl: string;
  budget: string | null;
  currency: string;
  goalType: string | null;
  goalValue: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  priority: MarketingAuditPriority;
  event: {
    id: string;
    title: string;
    slug: string;
    coverImage: string | null;
    status: string;
    city: string;
    country: string;
    currency: string;
    startsAt: Date;
    endsAt: Date | null;
  };
  organizer: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    country: string;
    businessName: string | null;
  };
  metrics: {
    visits: number;
    orders: number;
    tickets: number;
    revenue: string;
    discountAmount: string;
    conversionRate: number;
  };
}>;

export type GetAdminMarketingCampaignsResult = Readonly<{
  campaigns: readonly AdminMarketingCampaignListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  options: {
    organizers: readonly {
      id: string;
      name: string;
    }[];
    events: readonly {
      id: string;
      title: string;
    }[];
    countries: readonly string[];
  };
}>;

function normalizeText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && Number(value) > 0
    ? Number(value)
    : fallback;
}

function parseOptionalDate(
  value: Date | string | null | undefined,
): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AdminMarketingError({
      code: "ADMIN_MARKETING_PERIOD_INVALID",
      message: "Une date de filtre est invalide.",
      status: 422,
    });
  }

  return date;
}

export function buildAdminMarketingWhere(
  input: GetAdminMarketingCampaignsInput,
): Prisma.MarketingCampaignWhereInput {
  const search = normalizeText(input.search);
  const organizerId = normalizeText(input.organizerId);
  const eventId = normalizeText(input.eventId);
  const country = normalizeText(input.country);
  const startsFrom = parseOptionalDate(input.startsFrom);
  const startsTo = parseOptionalDate(input.startsTo);

  const where: Prisma.MarketingCampaignWhereInput = {};

  if (input.status && input.status !== "all") {
    where.status = input.status;
  }

  if (input.channel && input.channel !== "all") {
    where.channel = input.channel;
  }

  if (organizerId) {
    where.organizerId = organizerId;
  }

  if (eventId) {
    where.eventId = eventId;
  }

  if (country) {
    where.event = {
      is: {
        country: {
          equals: country,
          mode: "insensitive",
        },
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
      {
        name: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        trackingCode: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        source: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        medium: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        event: {
          is: {
            OR: [
              {
                title: {
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
            ],
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

function resolveOrderBy(
  sort: AdminMarketingSort | undefined,
): Prisma.MarketingCampaignOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];

    case "budget_desc":
      return [{ budget: "desc" }, { createdAt: "desc" }];

    case "budget_asc":
      return [{ budget: "asc" }, { createdAt: "desc" }];

    case "ending_soon":
      return [{ endsAt: "asc" }, { createdAt: "desc" }];

    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

function readPriority(
  metadata: Prisma.JsonValue | null,
): MarketingAuditPriority {
  if (
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata)
  ) {
    const payload = metadata.payload;

    if (
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      typeof payload.priority === "string" &&
      ["LOW", "NORMAL", "HIGH", "URGENT"].includes(payload.priority)
    ) {
      return payload.priority as MarketingAuditPriority;
    }
  }

  return "NORMAL";
}

export async function getAdminMarketingCampaigns(
  input: GetAdminMarketingCampaignsInput = {},
): Promise<GetAdminMarketingCampaignsResult> {
  const page = positiveInteger(input.page, 1);
  const pageSize = Math.min(positiveInteger(input.pageSize, 20), 100);
  const where = buildAdminMarketingWhere(input);

  try {
    const [totalItems, rows, organizers, events, countries] =
      await Promise.all([
        prisma.marketingCampaign.count({ where }),

        prisma.marketingCampaign.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: resolveOrderBy(input.sort),
          select: {
            id: true,
            organizerId: true,
            eventId: true,
            name: true,
            description: true,
            channel: true,
            status: true,
            source: true,
            medium: true,
            content: true,
            trackingCode: true,
            trackingUrl: true,
            budget: true,
            currency: true,
            goalType: true,
            goalValue: true,
            startsAt: true,
            endsAt: true,
            isActive: true,
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
                currency: true,
                startsAt: true,
                endsAt: true,
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
                  select: {
                    businessName: true,
                  },
                },
              },
            },
            visits: {
              select: {
                id: true,
              },
            },
            attributions: {
              select: {
                revenue: true,
                ticketsCount: true,
                discountAmount: true,
              },
            },
          },
        }),

        prisma.user.findMany({
          where: {
            role: "ORGANIZER",
            marketingCampaigns: {
              some: {},
            },
          },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
          select: {
            id: true,
            firstName: true,
            lastName: true,
            organizerProfile: {
              select: {
                businessName: true,
              },
            },
          },
        }),

        prisma.event.findMany({
          where: {
            marketingCampaigns: {
              some: {},
            },
          },
          orderBy: {
            title: "asc",
          },
          select: {
            id: true,
            title: true,
          },
        }),

        prisma.event.findMany({
          where: {
            marketingCampaigns: {
              some: {},
            },
          },
          distinct: ["country"],
          orderBy: {
            country: "asc",
          },
          select: {
            country: true,
          },
        }),
      ]);

    const campaignIds = rows.map((row) => row.id);

    const priorityLogs =
      campaignIds.length > 0
        ? await prisma.adminAuditLog.findMany({
            where: {
              targetType: "MARKETING_CAMPAIGN",
              targetId: {
                in: campaignIds,
              },
              action: "MARKETING_PRIORITY_UPDATED",
            },
            orderBy: {
              createdAt: "desc",
            },
            select: {
              targetId: true,
              metadata: true,
            },
          })
        : [];

    const priorityByCampaign = new Map<string, MarketingAuditPriority>();

    for (const log of priorityLogs) {
      if (log.targetId && !priorityByCampaign.has(log.targetId)) {
        priorityByCampaign.set(log.targetId, readPriority(log.metadata));
      }
    }

    let campaigns: AdminMarketingCampaignListItem[] = rows.map((row) => {
      const revenue = row.attributions.reduce(
        (total, attribution) => total.plus(attribution.revenue),
        new Prisma.Decimal(0),
      );

      const discountAmount = row.attributions.reduce(
        (total, attribution) => total.plus(attribution.discountAmount),
        new Prisma.Decimal(0),
      );

      const tickets = row.attributions.reduce(
        (total, attribution) => total + attribution.ticketsCount,
        0,
      );

      const orders = row.attributions.length;
      const visits = row.visits.length;

      return {
        id: row.id,
        organizerId: row.organizerId,
        eventId: row.eventId,
        name: row.name,
        description: row.description,
        channel: row.channel,
        status: row.status,
        source: row.source,
        medium: row.medium,
        content: row.content,
        trackingCode: row.trackingCode,
        trackingUrl: row.trackingUrl,
        budget: row.budget?.toFixed(2) ?? null,
        currency: row.currency,
        goalType: row.goalType,
        goalValue: row.goalValue?.toFixed(2) ?? null,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        priority: priorityByCampaign.get(row.id) ?? "NORMAL",
        event: row.event,
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
        metrics: {
          visits,
          orders,
          tickets,
          revenue: revenue.toFixed(2),
          discountAmount: discountAmount.toFixed(2),
          conversionRate:
            visits > 0
              ? Number(((orders / visits) * 100).toFixed(2))
              : 0,
        },
      };
    });

    if (input.sort === "visits_desc") {
      campaigns = campaigns.sort(
        (a, b) => b.metrics.visits - a.metrics.visits,
      );
    }

    if (input.sort === "orders_desc") {
      campaigns = campaigns.sort(
        (a, b) => b.metrics.orders - a.metrics.orders,
      );
    }

    if (input.sort === "revenue_desc") {
      campaigns = campaigns.sort(
        (a, b) => Number(b.metrics.revenue) - Number(a.metrics.revenue),
      );
    }

    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

    return {
      campaigns,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
      options: {
        organizers: organizers.map((organizer) => ({
          id: organizer.id,
          name:
            organizer.organizerProfile?.businessName ||
            `${organizer.firstName} ${organizer.lastName}`
              .replace(/\s+/g, " ")
              .trim(),
        })),
        events,
        countries: countries.map((item) => item.country),
      },
    };
  } catch (error) {
    if (error instanceof AdminMarketingError) {
      throw error;
    }

    throw new AdminMarketingError({
      code: "ADMIN_MARKETING_QUERY_FAILED",
      message: "Impossible de charger les campagnes marketing.",
      status: 500,
      cause: error,
    });
  }
}
