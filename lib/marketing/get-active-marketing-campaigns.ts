import "server-only";

import type {
  MarketingChannel,
  Prisma,
} from "@prisma/client";

import { isMarketingCampaignActive } from "@/lib/marketing/is-marketing-campaign-active";
import {
  resolveMarketingPriorities,
  sortByMarketingPriority,
  type MarketingPriority,
} from "@/lib/marketing/resolve-marketing-priority";
import { prisma } from "@/lib/prisma";

export type GetActiveMarketingCampaignsInput = Readonly<{
  eventId?: string | null;
  organizerId?: string | null;
  channel?: MarketingChannel | null;
  country?: string | null;
  city?: string | null;
  limit?: number;
  now?: Date;
}>;

export type ActiveMarketingCampaign = Readonly<{
  id: string;
  organizerId: string;
  eventId: string;
  name: string;
  description: string | null;
  channel: MarketingChannel;
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
  createdAt: Date;
  priority: MarketingPriority;
  event: {
    id: string;
    title: string;
    slug: string;
    shortDescription: string | null;
    coverImage: string | null;
    venueName: string;
    city: string;
    country: string;
    countryCode: string;
    currency: string;
    isFree: boolean;
    isFeatured: boolean;
    startsAt: Date;
    endsAt: Date | null;
    category: {
      id: string;
      name: string;
      slug: string;
    } | null;
    lowestPrice: string | null;
    availableTickets: number;
  };
  organizer: {
    id: string;
    fullName: string;
    businessName: string | null;
    logo: string | null;
  };
}>;

function normalizeOptional(
  value: string | null | undefined,
): string | null {
  const normalized =
    value?.replace(/\s+/g, " ").trim() ?? "";

  return normalized || null;
}

function normalizeLimit(
  value: number | undefined,
): number {
  if (!Number.isInteger(value)) {
    return 20;
  }

  return Math.min(
    Math.max(Number(value), 1),
    100,
  );
}

export async function getActiveMarketingCampaigns(
  input: GetActiveMarketingCampaignsInput = {},
): Promise<readonly ActiveMarketingCampaign[]> {
  const now = input.now ?? new Date();
  const limit = normalizeLimit(input.limit);
  const eventId = normalizeOptional(input.eventId);
  const organizerId = normalizeOptional(input.organizerId);
  const country = normalizeOptional(input.country);
  const city = normalizeOptional(input.city);

  const where: Prisma.MarketingCampaignWhereInput = {
    isActive: true,
    status: {
      in: ["ACTIVE", "SCHEDULED"],
    },
    AND: [
      {
        OR: [
          {
            startsAt: null,
          },
          {
            startsAt: {
              lte: now,
            },
          },
        ],
      },
      {
        OR: [
          {
            endsAt: null,
          },
          {
            endsAt: {
              gt: now,
            },
          },
        ],
      },
    ],
    event: {
      is: {
        status: "PUBLISHED",
        ...(country
          ? {
              country: {
                equals: country,
                mode: "insensitive",
              },
            }
          : {}),
        ...(city
          ? {
              city: {
                equals: city,
                mode: "insensitive",
              },
            }
          : {}),
      },
    },
    ...(eventId
      ? {
          eventId,
        }
      : {}),
    ...(organizerId
      ? {
          organizerId,
        }
      : {}),
    ...(input.channel
      ? {
          channel: input.channel,
        }
      : {}),
  };

  const rows = await prisma.marketingCampaign.findMany({
    where,
    orderBy: [
      {
        createdAt: "desc",
      },
      {
        id: "desc",
      },
    ],
    take: Math.min(limit * 4, 200),
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
      event: {
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
          currency: true,
          isFree: true,
          isFeatured: true,
          status: true,
          startsAt: true,
          endsAt: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          ticketTypes: {
            where: {
              isActive: true,
              OR: [
                {
                  saleStartsAt: null,
                },
                {
                  saleStartsAt: {
                    lte: now,
                  },
                },
              ],
              AND: [
                {
                  OR: [
                    {
                      saleEndsAt: null,
                    },
                    {
                      saleEndsAt: {
                        gt: now,
                      },
                    },
                  ],
                },
              ],
            },
            select: {
              price: true,
              quantity: true,
              sold: true,
              reserved: true,
            },
          },
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
            },
          },
        },
      },
    },
  });

  const validRows = rows.filter((row) =>
    isMarketingCampaignActive(
      {
        status: row.status,
        isActive: row.isActive,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        eventStatus: row.event.status,
        eventStartsAt: row.event.startsAt,
        eventEndsAt: row.event.endsAt,
      },
      now,
    ),
  );

  const priorities = await resolveMarketingPriorities(
    validRows.map((row) => row.id),
  );

  const campaigns: ActiveMarketingCampaign[] =
    validRows.map((row) => {
      const activeTicketTypes =
        row.event.ticketTypes;

      const lowestPrice =
        activeTicketTypes.length > 0
          ? activeTicketTypes.reduce(
              (lowest, ticketType) =>
                ticketType.price.lessThan(lowest)
                  ? ticketType.price
                  : lowest,
              activeTicketTypes[0].price,
            )
          : null;

      const availableTickets =
        activeTicketTypes.reduce(
          (total, ticketType) =>
            total +
            Math.max(
              ticketType.quantity -
                ticketType.sold -
                ticketType.reserved,
              0,
            ),
          0,
        );

      return {
        id: row.id,
        organizerId: row.organizerId,
        eventId: row.eventId,
        name: row.name,
        description: row.description,
        channel: row.channel,
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
        createdAt: row.createdAt,
        priority:
          priorities.get(row.id) ?? "NORMAL",
        event: {
          id: row.event.id,
          title: row.event.title,
          slug: row.event.slug,
          shortDescription:
            row.event.shortDescription,
          coverImage: row.event.coverImage,
          venueName: row.event.venueName,
          city: row.event.city,
          country: row.event.country,
          countryCode: row.event.countryCode,
          currency: row.event.currency,
          isFree: row.event.isFree,
          isFeatured: row.event.isFeatured,
          startsAt: row.event.startsAt,
          endsAt: row.event.endsAt,
          category: row.event.category,
          lowestPrice:
            lowestPrice?.toFixed(2) ?? null,
          availableTickets,
        },
        organizer: {
          id: row.organizer.id,
          fullName:
            `${row.organizer.firstName} ${row.organizer.lastName}`
              .replace(/\s+/g, " ")
              .trim(),
          businessName:
            row.organizer.organizerProfile
              ?.businessName ?? null,
          logo:
            row.organizer.organizerProfile?.logo ??
            null,
        },
      };
    });

  return sortByMarketingPriority(
    campaigns,
  ).slice(0, limit);
}
