"server-only";

import {
  createHash,
} from "node:crypto";

import {
  MarketingCampaignStatus,
  MarketingChannel,
  PromoCodeStatus,
  Prisma,
} from "@prisma/client";
import { cookies } from "next/headers";

import {
  calculateMarketingSources,
  calculateMarketingSummary,
  calculateMarketingTimeline,
  compareMarketingSummaries,
  type MarketingCalculationInput,
  type MarketingSourceMetrics,
  type MarketingSummaryComparison,
  type MarketingSummaryMetrics,
  type MarketingTimelineGroup,
  type MarketingTimelinePoint,
} from "@/lib/marketing/calculate-marketing-metrics";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const DEFAULT_PERIOD =
  "30d";

const DEFAULT_CAMPAIGN_LIMIT =
  20;

const DEFAULT_PROMO_CODE_LIMIT =
  20;

const MAX_LIST_LIMIT =
  100;

export type OrganizerMarketingPeriodPreset =
  | "7d"
  | "30d"
  | "90d"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

export type OrganizerMarketingQuery = {
  period?: OrganizerMarketingPeriodPreset;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;

  eventId?: string | null;
  campaignId?: string | null;

  channel?: MarketingChannel | null;
  campaignStatus?: MarketingCampaignStatus | null;
  promoCodeStatus?: PromoCodeStatus | null;

  search?: string | null;

  groupBy?: MarketingTimelineGroup;

  campaignLimit?: number;
  promoCodeLimit?: number;

  includeArchived?: boolean;
  includePreviousPeriod?: boolean;
};

export type OrganizerMarketingEventOption = {
  id: string;
  title: string;
  slug: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  currency: string;
};

export type OrganizerMarketingCampaignItem = {
  id: string;
  eventId: string;
  eventTitle: string;
  eventSlug: string;

  name: string;
  description: string | null;

  channel: MarketingChannel;
  status: MarketingCampaignStatus;

  source: string | null;
  medium: string | null;
  content: string | null;

  trackingCode: string;
  trackingUrl: string;

  budget: number | null;
  currency: string;

  goalType: string | null;
  goalValue: number | null;

  startsAt: string | null;
  endsAt: string | null;

  isActive: boolean;

  visits: number;
  orders: number;
  tickets: number;
  revenue: number;
  conversionRate: number;
  averageOrderValue: number;

  createdAt: string;
  updatedAt: string;
};

export type OrganizerMarketingPromoCodeItem = {
  id: string;
  eventId: string;
  eventTitle: string;
  campaignId: string | null;
  campaignName: string | null;

  code: string;
  description: string | null;

  discountType: string;
  discountValue: number;

  minimumOrderAmount: number | null;
  maximumDiscount: number | null;

  maximumUses: number | null;
  usesPerCustomer: number | null;
  currentUses: number;

  startsAt: string | null;
  expiresAt: string | null;

  status: PromoCodeStatus;
  isActive: boolean;

  usages: number;
  discountsGranted: number;
  attributedOrders: number;
  attributedRevenue: number;

  createdAt: string;
  updatedAt: string;
};

export type OrganizerMarketingData = {
  organizer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    businessName: string | null;
  };

  filters: {
    period: OrganizerMarketingPeriodPreset;
    startsAt: string;
    endsAt: string;

    previousStartsAt: string;
    previousEndsAt: string;

    eventId: string | null;
    campaignId: string | null;
    channel: MarketingChannel | null;
    campaignStatus: MarketingCampaignStatus | null;
    promoCodeStatus: PromoCodeStatus | null;
    search: string;
    groupBy: MarketingTimelineGroup;
  };

  summary: MarketingSummaryMetrics;
  previousSummary: MarketingSummaryMetrics;
  comparison: MarketingSummaryComparison;

  timeline: MarketingTimelinePoint[];
  sources: MarketingSourceMetrics[];

  campaigns: OrganizerMarketingCampaignItem[];
  promoCodes: OrganizerMarketingPromoCodeItem[];
  events: OrganizerMarketingEventOption[];

  totals: {
    campaigns: number;
    activeCampaigns: number;
    promoCodes: number;
    activePromoCodes: number;
  };

  generatedAt: string;
};

export class GetOrganizerMarketingError extends Error {
  readonly code: string;
  readonly status: number;
  readonly cause?: unknown;

  constructor({
    code,
    message,
    status = 500,
    cause,
  }: {
    code: string;
    message: string;
    status?: number;
    cause?: unknown;
  }) {
    super(message);

    this.name =
      "GetOrganizerMarketingError";

    this.code =
      code;

    this.status =
      status;

    this.cause =
      cause;
  }
}

type ConnectedOrganizer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  businessName: string | null;
};

type ResolvedPeriod = {
  startsAt: Date;
  endsAt: Date;
  previousStartsAt: Date;
  previousEndsAt: Date;
};

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeOptionalText(
  value:
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    normalizeText(value);

  return normalized || null;
}

function hashSessionToken(
  token: string,
): string {
  return createHash(
    "sha256",
  )
    .update(token)
    .digest("hex");
}

function decimalToNumber(
  value:
    | Prisma.Decimal
    | number
    | null
    | undefined,
): number {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  return typeof value ===
    "number"
    ? value
    : value.toNumber();
}

function optionalDecimalToNumber(
  value:
    | Prisma.Decimal
    | number
    | null
    | undefined,
): number | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  return decimalToNumber(
    value,
  );
}

function normalizeLimit(
  value:
    | number
    | null
    | undefined,
  fallback: number,
): number {
  if (
    typeof value !==
      "number" ||
    !Number.isFinite(value)
  ) {
    return fallback;
  }

  return Math.max(
    1,
    Math.min(
      Math.floor(value),
      MAX_LIST_LIMIT,
    ),
  );
}

function parseDate(
  value:
    | Date
    | string
    | null
    | undefined,
  field: string,
): Date | null {
  if (!value) {
    return null;
  }

  const parsed =
    value instanceof Date
      ? new Date(
          value.getTime(),
        )
      : new Date(value);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    throw new GetOrganizerMarketingError({
      code:
        "INVALID_MARKETING_DATE",

      status:
        400,

      message:
        `La date « ${field} » est invalide.`,
    });
  }

  return parsed;
}

function startOfDay(
  value: Date,
): Date {
  const result =
    new Date(value);

  result.setHours(
    0,
    0,
    0,
    0,
  );

  return result;
}

function endOfDay(
  value: Date,
): Date {
  const result =
    new Date(value);

  result.setHours(
    23,
    59,
    59,
    999,
  );

  return result;
}

function startOfMonth(
  value: Date,
): Date {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    1,
    0,
    0,
    0,
    0,
  );
}

function endOfMonth(
  value: Date,
): Date {
  return new Date(
    value.getFullYear(),
    value.getMonth() +
      1,
    0,
    23,
    59,
    59,
    999,
  );
}

function startOfYear(
  value: Date,
): Date {
  return new Date(
    value.getFullYear(),
    0,
    1,
    0,
    0,
    0,
    0,
  );
}

function resolvePeriod({
  period,
  startsAt,
  endsAt,
}: {
  period:
    OrganizerMarketingPeriodPreset;
  startsAt:
    | Date
    | string
    | null
    | undefined;
  endsAt:
    | Date
    | string
    | null
    | undefined;
}): ResolvedPeriod {
  const now =
    new Date();

  let currentStartsAt:
    Date;

  let currentEndsAt:
    Date;

  if (
    period ===
    "custom"
  ) {
    const parsedStartsAt =
      parseDate(
        startsAt,
        "startsAt",
      );

    const parsedEndsAt =
      parseDate(
        endsAt,
        "endsAt",
      );

    if (
      !parsedStartsAt &&
      !parsedEndsAt
    ) {
      throw new GetOrganizerMarketingError({
        code:
          "CUSTOM_MARKETING_PERIOD_REQUIRED",

        status:
          400,

        message:
          "Une période personnalisée doit contenir au moins une date.",
      });
    }

    currentStartsAt =
      startOfDay(
        parsedStartsAt ??
        parsedEndsAt ??
        now,
      );

    currentEndsAt =
      endOfDay(
        parsedEndsAt ??
        parsedStartsAt ??
        now,
      );
  } else if (
    period ===
    "this_month"
  ) {
    currentStartsAt =
      startOfMonth(
        now,
      );

    currentEndsAt =
      endOfDay(
        now,
      );
  } else if (
    period ===
    "last_month"
  ) {
    const previousMonth =
      new Date(
        now.getFullYear(),
        now.getMonth() -
          1,
        1,
      );

    currentStartsAt =
      startOfMonth(
        previousMonth,
      );

    currentEndsAt =
      endOfMonth(
        previousMonth,
      );
  } else if (
    period ===
    "this_year"
  ) {
    currentStartsAt =
      startOfYear(
        now,
      );

    currentEndsAt =
      endOfDay(
        now,
      );
  } else {
    const days =
      period ===
        "7d"
        ? 7
        : period ===
            "90d"
          ? 90
          : 30;

    currentEndsAt =
      endOfDay(
        now,
      );

    currentStartsAt =
      startOfDay(
        new Date(
          now.getTime() -
            (
              days -
              1
            ) *
              24 *
              60 *
              60 *
              1_000,
        ),
      );
  }

  if (
    currentEndsAt.getTime() <
    currentStartsAt.getTime()
  ) {
    throw new GetOrganizerMarketingError({
      code:
        "INVALID_MARKETING_PERIOD",

      status:
        400,

      message:
        "La date de fin doit être postérieure ou égale à la date de début.",
    });
  }

  const duration =
    currentEndsAt.getTime() -
    currentStartsAt.getTime();

  const previousEndsAt =
    new Date(
      currentStartsAt.getTime() -
        1,
    );

  const previousStartsAt =
    new Date(
      previousEndsAt.getTime() -
        duration,
    );

  return {
    startsAt:
      currentStartsAt,

    endsAt:
      currentEndsAt,

    previousStartsAt,

    previousEndsAt,
  };
}

async function getConnectedOrganizer(): Promise<ConnectedOrganizer> {
  const cookieStore =
    await cookies();

  const cookieName =
    normalizeText(
      process.env
        .SESSION_COOKIE_NAME,
    ) ||
    SESSION_COOKIE_FALLBACK_NAME;

  const sessionToken =
    cookieStore.get(
      cookieName,
    )?.value;

  if (!sessionToken) {
    throw new GetOrganizerMarketingError({
      code:
        "UNAUTHENTICATED",

      status:
        401,

      message:
        "Votre session organisateur est introuvable. Veuillez vous reconnecter.",
    });
  }

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash:
          hashSessionToken(
            sessionToken,
          ),
      },

      select: {
        id:
          true,

        expiresAt:
          true,

        user: {
          select: {
            id:
              true,

            firstName:
              true,

            lastName:
              true,

            email:
              true,

            role:
              true,

            emailVerified:
              true,

            isActive:
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
    });

  if (!session) {
    throw new GetOrganizerMarketingError({
      code:
        "SESSION_NOT_FOUND",

      status:
        401,

      message:
        "Votre session n’est plus valide. Veuillez vous reconnecter.",
    });
  }

  if (
    session.expiresAt.getTime() <=
    Date.now()
  ) {
    await prisma.session
      .delete({
        where: {
          id:
            session.id,
        },
      })
      .catch(
        (
          error: unknown,
        ) => {
          console.error(
            "[MARKETING_EXPIRED_SESSION_DELETE_ERROR]",
            error instanceof Error
              ? error.message
              : error,
          );
        },
      );

    throw new GetOrganizerMarketingError({
      code:
        "SESSION_EXPIRED",

      status:
        401,

      message:
        "Votre session a expiré. Veuillez vous reconnecter.",
    });
  }

  if (
    session.user.role !==
      "ORGANIZER" ||
    !session.user.emailVerified ||
    !session.user.isActive
  ) {
    throw new GetOrganizerMarketingError({
      code:
        "FORBIDDEN",

      status:
        403,

      message:
        "Ce compte n’est pas autorisé à accéder aux données marketing.",
    });
  }

  return {
    id:
      session.user.id,

    firstName:
      session.user.firstName,

    lastName:
      session.user.lastName,

    email:
      session.user.email,

    businessName:
      session.user.organizerProfile
        ?.businessName ??
      null,
  };
}

function buildCampaignWhere({
  organizerId,
  query,
  period,
}: {
  organizerId:
    string;
  query:
    OrganizerMarketingQuery;
  period:
    ResolvedPeriod;
}): Prisma.MarketingCampaignWhereInput {
  const search =
    normalizeOptionalText(
      query.search,
    );

  return {
    organizerId,

    ...(query.eventId
      ? {
          eventId:
            query.eventId,
        }
      : {}),

    ...(query.campaignId
      ? {
          id:
            query.campaignId,
        }
      : {}),

    ...(query.channel
      ? {
          channel:
            query.channel,
        }
      : {}),

    ...(query.campaignStatus
      ? {
          status:
            query.campaignStatus,
        }
      : query.includeArchived
        ? {}
        : {
            status: {
              not:
                MarketingCampaignStatus.ARCHIVED,
            },
          }),

    ...(search
      ? {
          OR: [
            {
              name: {
                contains:
                  search,
                mode:
                  "insensitive",
              },
            },
            {
              description: {
                contains:
                  search,
                mode:
                  "insensitive",
              },
            },
            {
              source: {
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
          ],
        }
      : {}),

    OR: [
      {
        startsAt:
          null,
      },
      {
        startsAt: {
          lte:
            period.endsAt,
        },
      },
    ],
  };
}

function buildPromoCodeWhere({
  organizerId,
  query,
}: {
  organizerId:
    string;
  query:
    OrganizerMarketingQuery;
}): Prisma.PromoCodeWhereInput {
  const search =
    normalizeOptionalText(
      query.search,
    );

  return {
    organizerId,

    ...(query.eventId
      ? {
          eventId:
            query.eventId,
        }
      : {}),

    ...(query.campaignId
      ? {
          campaignId:
            query.campaignId,
        }
      : {}),

    ...(query.promoCodeStatus
      ? {
          status:
            query.promoCodeStatus,
        }
      : query.includeArchived
        ? {}
        : {
            status: {
              not:
                PromoCodeStatus.ARCHIVED,
            },
          }),

    ...(search
      ? {
          OR: [
            {
              code: {
                contains:
                  search,
                mode:
                  "insensitive",
              },
            },
            {
              description: {
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
          ],
        }
      : {}),
  };
}

function buildMetricVisitWhere({
  organizerId,
  query,
  startsAt,
  endsAt,
}: {
  organizerId:
    string;
  query:
    OrganizerMarketingQuery;
  startsAt:
    Date;
  endsAt:
    Date;
}): Prisma.MarketingCampaignVisitWhereInput {
  return {
    organizerId,

    visitedAt: {
      gte:
        startsAt,

      lte:
        endsAt,
    },

    ...(query.eventId
      ? {
          eventId:
            query.eventId,
        }
      : {}),

    ...(query.campaignId
      ? {
          campaignId:
            query.campaignId,
        }
      : {}),

    ...(query.channel
      ? {
          campaign: {
            channel:
              query.channel,
          },
        }
      : {}),
  };
}

function buildMetricAttributionWhere({
  organizerId,
  query,
  startsAt,
  endsAt,
}: {
  organizerId:
    string;
  query:
    OrganizerMarketingQuery;
  startsAt:
    Date;
  endsAt:
    Date;
}): Prisma.MarketingAttributionWhereInput {
  return {
    organizerId,

    attributedAt: {
      gte:
        startsAt,

      lte:
        endsAt,
    },

    ...(query.eventId
      ? {
          eventId:
            query.eventId,
        }
      : {}),

    ...(query.campaignId
      ? {
          campaignId:
            query.campaignId,
        }
      : {}),

    ...(query.channel
      ? {
          campaign: {
            channel:
              query.channel,
          },
        }
      : {}),
  };
}

function buildMetricPromoUsageWhere({
  organizerId,
  query,
  startsAt,
  endsAt,
}: {
  organizerId:
    string;
  query:
    OrganizerMarketingQuery;
  startsAt:
    Date;
  endsAt:
    Date;
}): Prisma.PromoCodeUsageWhereInput {
  return {
    usedAt: {
      gte:
        startsAt,

      lte:
        endsAt,
    },

    promoCode: {
      organizerId,

      ...(query.eventId
        ? {
            eventId:
              query.eventId,
          }
        : {}),

      ...(query.campaignId
        ? {
            campaignId:
              query.campaignId,
          }
        : {}),
    },
  };
}

export async function getOrganizerMarketing(
  query:
    OrganizerMarketingQuery = {},
): Promise<OrganizerMarketingData> {
  try {
    const organizer =
      await getConnectedOrganizer();

    const periodPreset =
      query.period ??
      DEFAULT_PERIOD;

    const groupBy =
      query.groupBy ??
      "day";

    const resolvedPeriod =
      resolvePeriod({
        period:
          periodPreset,

        startsAt:
          query.startsAt,

        endsAt:
          query.endsAt,
      });

    const campaignLimit =
      normalizeLimit(
        query.campaignLimit,
        DEFAULT_CAMPAIGN_LIMIT,
      );

    const promoCodeLimit =
      normalizeLimit(
        query.promoCodeLimit,
        DEFAULT_PROMO_CODE_LIMIT,
      );

    const currentVisitWhere =
      buildMetricVisitWhere({
        organizerId:
          organizer.id,

        query,

        startsAt:
          resolvedPeriod.startsAt,

        endsAt:
          resolvedPeriod.endsAt,
      });

    const previousVisitWhere =
      buildMetricVisitWhere({
        organizerId:
          organizer.id,

        query,

        startsAt:
          resolvedPeriod.previousStartsAt,

        endsAt:
          resolvedPeriod.previousEndsAt,
      });

    const currentAttributionWhere =
      buildMetricAttributionWhere({
        organizerId:
          organizer.id,

        query,

        startsAt:
          resolvedPeriod.startsAt,

        endsAt:
          resolvedPeriod.endsAt,
      });

    const previousAttributionWhere =
      buildMetricAttributionWhere({
        organizerId:
          organizer.id,

        query,

        startsAt:
          resolvedPeriod.previousStartsAt,

        endsAt:
          resolvedPeriod.previousEndsAt,
      });

    const currentPromoUsageWhere =
      buildMetricPromoUsageWhere({
        organizerId:
          organizer.id,

        query,

        startsAt:
          resolvedPeriod.startsAt,

        endsAt:
          resolvedPeriod.endsAt,
      });

    const previousPromoUsageWhere =
      buildMetricPromoUsageWhere({
        organizerId:
          organizer.id,

        query,

        startsAt:
          resolvedPeriod.previousStartsAt,

        endsAt:
          resolvedPeriod.previousEndsAt,
      });

    const [
      currentVisits,
      previousVisits,
      currentAttributions,
      previousAttributions,
      currentPromoUsages,
      previousPromoUsages,
      campaigns,
      promoCodes,
      events,
      totalCampaigns,
      activeCampaigns,
      totalPromoCodes,
      activePromoCodes,
    ] =
      await Promise.all([
        prisma.marketingCampaignVisit.findMany({
          where:
            currentVisitWhere,

          select: {
            id:
              true,

            campaignId:
              true,

            eventId:
              true,

            source:
              true,

            medium:
              true,

            visitedAt:
              true,

            campaign: {
              select: {
                channel:
                  true,
              },
            },
          },

          orderBy: {
            visitedAt:
              "asc",
          },
        }),

        prisma.marketingCampaignVisit.findMany({
          where:
            previousVisitWhere,

          select: {
            id:
              true,

            campaignId:
              true,

            eventId:
              true,

            source:
              true,

            medium:
              true,

            visitedAt:
              true,

            campaign: {
              select: {
                channel:
                  true,
              },
            },
          },
        }),

        prisma.marketingAttribution.findMany({
          where:
            currentAttributionWhere,

          select: {
            id:
              true,

            campaignId:
              true,

            eventId:
              true,

            promoCodeId:
              true,

            source:
              true,

            medium:
              true,

            revenue:
              true,

            ticketsCount:
              true,

            discountAmount:
              true,

            currency:
              true,

            attributedAt:
              true,
          },

          orderBy: {
            attributedAt:
              "asc",
          },
        }),

        prisma.marketingAttribution.findMany({
          where:
            previousAttributionWhere,

          select: {
            id:
              true,

            campaignId:
              true,

            eventId:
              true,

            promoCodeId:
              true,

            source:
              true,

            medium:
              true,

            revenue:
              true,

            ticketsCount:
              true,

            discountAmount:
              true,

            currency:
              true,

            attributedAt:
              true,
          },
        }),

        prisma.promoCodeUsage.findMany({
          where:
            currentPromoUsageWhere,

          select: {
            id:
              true,

            promoCodeId:
              true,

            orderId:
              true,

            discountAmount:
              true,

            currency:
              true,

            usedAt:
              true,
          },
        }),

        prisma.promoCodeUsage.findMany({
          where:
            previousPromoUsageWhere,

          select: {
            id:
              true,

            promoCodeId:
              true,

            orderId:
              true,

            discountAmount:
              true,

            currency:
              true,

            usedAt:
              true,
          },
        }),

        prisma.marketingCampaign.findMany({
          where:
            buildCampaignWhere({
              organizerId:
                organizer.id,

              query,

              period:
                resolvedPeriod,
            }),

          take:
            campaignLimit,

          orderBy: [
            {
              createdAt:
                "desc",
            },
            {
              id:
                "desc",
            },
          ],

          select: {
            id:
              true,

            eventId:
              true,

            name:
              true,

            description:
              true,

            channel:
              true,

            status:
              true,

            source:
              true,

            medium:
              true,

            content:
              true,

            trackingCode:
              true,

            trackingUrl:
              true,

            budget:
              true,

            currency:
              true,

            goalType:
              true,

            goalValue:
              true,

            startsAt:
              true,

            endsAt:
              true,

            isActive:
              true,

            createdAt:
              true,

            updatedAt:
              true,

            event: {
              select: {
                title:
                  true,

                slug:
                  true,
              },
            },

            visits: {
              where: {
                visitedAt: {
                  gte:
                    resolvedPeriod.startsAt,

                  lte:
                    resolvedPeriod.endsAt,
                },
              },

              select: {
                id:
                  true,
              },
            },

            attributions: {
              where: {
                attributedAt: {
                  gte:
                    resolvedPeriod.startsAt,

                  lte:
                    resolvedPeriod.endsAt,
                },
              },

              select: {
                revenue:
                  true,

                ticketsCount:
                  true,
              },
            },
          },
        }),

        prisma.promoCode.findMany({
          where:
            buildPromoCodeWhere({
              organizerId:
                organizer.id,

              query,
            }),

          take:
            promoCodeLimit,

          orderBy: [
            {
              createdAt:
                "desc",
            },
            {
              id:
                "desc",
            },
          ],

          select: {
            id:
              true,

            eventId:
              true,

            campaignId:
              true,

            code:
              true,

            description:
              true,

            discountType:
              true,

            discountValue:
              true,

            minimumOrderAmount:
              true,

            maximumDiscount:
              true,

            maximumUses:
              true,

            usesPerCustomer:
              true,

            currentUses:
              true,

            startsAt:
              true,

            expiresAt:
              true,

            status:
              true,

            isActive:
              true,

            createdAt:
              true,

            updatedAt:
              true,

            event: {
              select: {
                title:
                  true,
              },
            },

            campaign: {
              select: {
                name:
                  true,
              },
            },

            usages: {
              where: {
                usedAt: {
                  gte:
                    resolvedPeriod.startsAt,

                  lte:
                    resolvedPeriod.endsAt,
                },
              },

              select: {
                discountAmount:
                  true,
              },
            },

            attributions: {
              where: {
                attributedAt: {
                  gte:
                    resolvedPeriod.startsAt,

                  lte:
                    resolvedPeriod.endsAt,
                },
              },

              select: {
                revenue:
                  true,
              },
            },
          },
        }),

        prisma.event.findMany({
          where: {
            organizerId:
              organizer.id,
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
            id:
              true,

            title:
              true,

            slug:
              true,

            status:
              true,

            startsAt:
              true,

            endsAt:
              true,

            currency:
              true,
          },
        }),

        prisma.marketingCampaign.count({
          where: {
            organizerId:
              organizer.id,
          },
        }),

        prisma.marketingCampaign.count({
          where: {
            organizerId:
              organizer.id,

            status:
              MarketingCampaignStatus.ACTIVE,

            isActive:
              true,
          },
        }),

        prisma.promoCode.count({
          where: {
            organizerId:
              organizer.id,
          },
        }),

        prisma.promoCode.count({
          where: {
            organizerId:
              organizer.id,

            status:
              PromoCodeStatus.ACTIVE,

            isActive:
              true,
          },
        }),
      ]);

    const currentData:
      MarketingCalculationInput = {
      visits:
        currentVisits.map(
          (
            visit,
          ) => ({
            id:
              visit.id,

            campaignId:
              visit.campaignId,

            eventId:
              visit.eventId,

            source:
              visit.source,

            medium:
              visit.medium,

            channel:
              visit.campaign.channel,

            visitedAt:
              visit.visitedAt,
          }),
        ),

      attributions:
        currentAttributions,

      promoCodeUsages:
        currentPromoUsages,
    };

    const previousData:
      MarketingCalculationInput = {
      visits:
        previousVisits.map(
          (
            visit,
          ) => ({
            id:
              visit.id,

            campaignId:
              visit.campaignId,

            eventId:
              visit.eventId,

            source:
              visit.source,

            medium:
              visit.medium,

            channel:
              visit.campaign.channel,

            visitedAt:
              visit.visitedAt,
          }),
        ),

      attributions:
        previousAttributions,

      promoCodeUsages:
        previousPromoUsages,
    };

    const comparisonResult =
      query.includePreviousPeriod ===
        false
        ? {
            current:
              calculateMarketingSummary(
                currentData,
              ),

            previous:
              calculateMarketingSummary(
                {
                  visits:
                    [],

                  attributions:
                    [],

                  promoCodeUsages:
                    [],
                },
              ),

            comparison:
              compareMarketingSummaries({
                current:
                  currentData,

                previous: {
                  visits:
                    [],

                  attributions:
                    [],

                  promoCodeUsages:
                    [],
                },
              }).comparison,
          }
        : compareMarketingSummaries({
            current:
              currentData,

            previous:
              previousData,
          });

    const timeline =
      calculateMarketingTimeline({
        visits:
          currentData.visits,

        attributions:
          currentData.attributions,

        period: {
          startsAt:
            resolvedPeriod.startsAt,

          endsAt:
            resolvedPeriod.endsAt,
        },

        groupBy,
      });

    const sources =
      calculateMarketingSources({
        visits:
          currentData.visits,

        attributions:
          currentData.attributions,
      });

    const campaignItems:
      OrganizerMarketingCampaignItem[] =
      campaigns.map(
        (
          campaign,
        ) => {
          const campaignRevenue =
            campaign.attributions.reduce(
              (
                total,
                attribution,
              ) =>
                total +
                decimalToNumber(
                  attribution.revenue,
                ),
              0,
            );

          const campaignTickets =
            campaign.attributions.reduce(
              (
                total,
                attribution,
              ) =>
                total +
                attribution.ticketsCount,
              0,
            );

          const visits =
            campaign.visits.length;

          const orders =
            campaign.attributions.length;

          return {
            id:
              campaign.id,

            eventId:
              campaign.eventId,

            eventTitle:
              campaign.event.title,

            eventSlug:
              campaign.event.slug,

            name:
              campaign.name,

            description:
              campaign.description,

            channel:
              campaign.channel,

            status:
              campaign.status,

            source:
              campaign.source,

            medium:
              campaign.medium,

            content:
              campaign.content,

            trackingCode:
              campaign.trackingCode,

            trackingUrl:
              campaign.trackingUrl,

            budget:
              optionalDecimalToNumber(
                campaign.budget,
              ),

            currency:
              campaign.currency,

            goalType:
              campaign.goalType,

            goalValue:
              optionalDecimalToNumber(
                campaign.goalValue,
              ),

            startsAt:
              campaign.startsAt
                ?.toISOString() ??
              null,

            endsAt:
              campaign.endsAt
                ?.toISOString() ??
              null,

            isActive:
              campaign.isActive,

            visits,

            orders,

            tickets:
              campaignTickets,

            revenue:
              campaignRevenue,

            conversionRate:
              visits > 0
                ? Number(
                    (
                      (
                        orders /
                        visits
                      ) *
                      100
                    ).toFixed(2),
                  )
                : 0,

            averageOrderValue:
              orders > 0
                ? Number(
                    (
                      campaignRevenue /
                      orders
                    ).toFixed(2),
                  )
                : 0,

            createdAt:
              campaign.createdAt.toISOString(),

            updatedAt:
              campaign.updatedAt.toISOString(),
          };
        },
      );

    const promoCodeItems:
      OrganizerMarketingPromoCodeItem[] =
      promoCodes.map(
        (
          promoCode,
        ) => {
          const discountsGranted =
            promoCode.usages.reduce(
              (
                total,
                usage,
              ) =>
                total +
                decimalToNumber(
                  usage.discountAmount,
                ),
              0,
            );

          const attributedRevenue =
            promoCode.attributions.reduce(
              (
                total,
                attribution,
              ) =>
                total +
                decimalToNumber(
                  attribution.revenue,
                ),
              0,
            );

          return {
            id:
              promoCode.id,

            eventId:
              promoCode.eventId,

            eventTitle:
              promoCode.event.title,

            campaignId:
              promoCode.campaignId,

            campaignName:
              promoCode.campaign
                ?.name ??
              null,

            code:
              promoCode.code,

            description:
              promoCode.description,

            discountType:
              promoCode.discountType,

            discountValue:
              decimalToNumber(
                promoCode.discountValue,
              ),

            minimumOrderAmount:
              optionalDecimalToNumber(
                promoCode.minimumOrderAmount,
              ),

            maximumDiscount:
              optionalDecimalToNumber(
                promoCode.maximumDiscount,
              ),

            maximumUses:
              promoCode.maximumUses,

            usesPerCustomer:
              promoCode.usesPerCustomer,

            currentUses:
              promoCode.currentUses,

            startsAt:
              promoCode.startsAt
                ?.toISOString() ??
              null,

            expiresAt:
              promoCode.expiresAt
                ?.toISOString() ??
              null,

            status:
              promoCode.status,

            isActive:
              promoCode.isActive,

            usages:
              promoCode.usages.length,

            discountsGranted,

            attributedOrders:
              promoCode.attributions.length,

            attributedRevenue,

            createdAt:
              promoCode.createdAt.toISOString(),

            updatedAt:
              promoCode.updatedAt.toISOString(),
          };
        },
      );

    return {
      organizer,

      filters: {
        period:
          periodPreset,

        startsAt:
          resolvedPeriod.startsAt.toISOString(),

        endsAt:
          resolvedPeriod.endsAt.toISOString(),

        previousStartsAt:
          resolvedPeriod.previousStartsAt.toISOString(),

        previousEndsAt:
          resolvedPeriod.previousEndsAt.toISOString(),

        eventId:
          query.eventId ??
          null,

        campaignId:
          query.campaignId ??
          null,

        channel:
          query.channel ??
          null,

        campaignStatus:
          query.campaignStatus ??
          null,

        promoCodeStatus:
          query.promoCodeStatus ??
          null,

        search:
          normalizeText(
            query.search,
          ),

        groupBy,
      },

      summary:
        comparisonResult.current,

      previousSummary:
        comparisonResult.previous,

      comparison:
        comparisonResult.comparison,

      timeline,

      sources,

      campaigns:
        campaignItems,

      promoCodes:
        promoCodeItems,

      events:
        events.map(
          (
            event,
          ) => ({
            id:
              event.id,

            title:
              event.title,

            slug:
              event.slug,

            status:
              event.status,

            startsAt:
              event.startsAt.toISOString(),

            endsAt:
              event.endsAt
                ?.toISOString() ??
              null,

            currency:
              event.currency,
          }),
        ),

      totals: {
        campaigns:
          totalCampaigns,

        activeCampaigns,

        promoCodes:
          totalPromoCodes,

        activePromoCodes,
      },

      generatedAt:
        new Date().toISOString(),
    };
  } catch (error) {
    if (
      error instanceof
      GetOrganizerMarketingError
    ) {
      throw error;
    }

    console.error(
      "[GET_ORGANIZER_MARKETING_ERROR]",
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

    throw new GetOrganizerMarketingError({
      code:
        "ORGANIZER_MARKETING_LOAD_FAILED",

      status:
        500,

      message:
        "Impossible de charger les données marketing de l’organisateur.",

      cause:
        error,
    });
  }
}

export default getOrganizerMarketing;