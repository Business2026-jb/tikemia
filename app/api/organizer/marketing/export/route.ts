import { createHash } from "node:crypto";

import {
  Prisma,
  UserRole,
} from "@prisma/client";
import { cookies } from "next/headers";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const DEFAULT_EXPORT_TYPE =
  "all";

const DEFAULT_EXPORT_FORMAT =
  "csv";

const MAX_EXPORT_ROWS =
  10_000;

type ExportType =
  | "campaigns"
  | "promo-codes"
  | "all";

type ExportFormat =
  | "csv"
  | "json";

type AuthenticatedOrganizer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  businessName: string | null;
};

type ExportFilters = {
  type: ExportType;
  format: ExportFormat;
  eventId: string | null;
  campaignId: string | null;
  search: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  includeArchived: boolean;
};

class MarketingExportRouteError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor({
    status,
    code,
    message,
    details,
  }: {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  }) {
    super(message);

    this.name =
      "MarketingExportRouteError";

    this.status =
      status;

    this.code =
      code;

    this.details =
      details;
  }
}

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
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function parseBoolean(
  value:
    | string
    | null,
  fallback = false,
): boolean {
  if (value === null) {
    return fallback;
  }

  const normalized =
    value.trim().toLowerCase();

  if (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes"
  ) {
    return true;
  }

  if (
    normalized === "false" ||
    normalized === "0" ||
    normalized === "no"
  ) {
    return false;
  }

  return fallback;
}

function parseDate(
  value:
    | string
    | null,
  fieldName: string,
): Date | null {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new MarketingExportRouteError({
      status:
        400,
      code:
        "INVALID_EXPORT_DATE",
      message:
        `La date « ${fieldName} » est invalide.`,
      details: {
        field:
          fieldName,
      },
    });
  }

  return date;
}

function parseExportType(
  value:
    | string
    | null,
): ExportType {
  const normalized =
    normalizeText(value)
      .toLowerCase();

  if (
    normalized === "campaigns" ||
    normalized === "promo-codes" ||
    normalized === "all"
  ) {
    return normalized;
  }

  return DEFAULT_EXPORT_TYPE;
}

function parseExportFormat(
  value:
    | string
    | null,
): ExportFormat {
  const normalized =
    normalizeText(value)
      .toLowerCase();

  if (
    normalized === "csv" ||
    normalized === "json"
  ) {
    return normalized;
  }

  return DEFAULT_EXPORT_FORMAT;
}

function parseFilters(
  request:
    NextRequest,
): ExportFilters {
  const searchParams =
    request.nextUrl.searchParams;

  const startsAt =
    parseDate(
      searchParams.get("startsAt"),
      "startsAt",
    );

  const endsAt =
    parseDate(
      searchParams.get("endsAt"),
      "endsAt",
    );

  if (
    startsAt &&
    endsAt &&
    endsAt.getTime() <
      startsAt.getTime()
  ) {
    throw new MarketingExportRouteError({
      status:
        400,
      code:
        "INVALID_EXPORT_PERIOD",
      message:
        "La date de fin doit être postérieure ou égale à la date de début.",
    });
  }

  return {
    type:
      parseExportType(
        searchParams.get("type"),
      ),

    format:
      parseExportFormat(
        searchParams.get("format"),
      ),

    eventId:
      normalizeOptionalText(
        searchParams.get("eventId"),
      ),

    campaignId:
      normalizeOptionalText(
        searchParams.get("campaignId"),
      ),

    search:
      normalizeOptionalText(
        searchParams.get("search"),
      ),

    startsAt,

    endsAt,

    includeArchived:
      parseBoolean(
        searchParams.get(
          "includeArchived",
        ),
        false,
      ),
  };
}

function decimalToNumber(
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

  return typeof value === "number"
    ? value
    : value.toNumber();
}

function sanitizeFileName(
  value: string,
): string {
  const normalized =
    value
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .replace(
        /[^a-zA-Z0-9_-]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      )
      .slice(0, 80);

  return normalized ||
    "tikemia-marketing";
}

function formatDateForFileName(
  date:
    Date,
): string {
  return date
    .toISOString()
    .slice(0, 10);
}

function formatDateTime(
  value:
    Date |
    null |
    undefined,
): string {
  return value
    ? value.toISOString()
    : "";
}

function escapeCsvCell(
  value:
    unknown,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const text =
    value instanceof Date
      ? value.toISOString()
      : String(value);

  if (
    /[",\r\n;]/.test(text)
  ) {
    return `"${text.replace(
      /"/g,
      '""',
    )}"`;
  }

  return text;
}

function rowsToCsv(
  rows:
    readonly Record<
      string,
      unknown
    >[],
): string {
  if (
    rows.length === 0
  ) {
    return "";
  }

  const headers =
    Array.from(
      new Set(
        rows.flatMap(
          (
            row,
          ) =>
            Object.keys(row),
        ),
      ),
    );

  const lines = [
    headers
      .map(escapeCsvCell)
      .join(";"),
    ...rows.map(
      (
        row,
      ) =>
        headers
          .map(
            (
              header,
            ) =>
              escapeCsvCell(
                row[header],
              ),
          )
          .join(";"),
    ),
  ];

  return `\uFEFF${lines.join(
    "\r\n",
  )}`;
}

async function getAuthenticatedOrganizer(): Promise<AuthenticatedOrganizer> {
  const cookieStore =
    await cookies();

  const cookieName =
    normalizeText(
      process.env
        .SESSION_COOKIE_NAME,
    ) ||
    SESSION_COOKIE_FALLBACK_NAME;

  const rawSessionToken =
    cookieStore.get(
      cookieName,
    )?.value;

  if (!rawSessionToken) {
    throw new MarketingExportRouteError({
      status:
        401,
      code:
        "UNAUTHENTICATED",
      message:
        "Votre session organisateur est introuvable. Veuillez vous reconnecter.",
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
    throw new MarketingExportRouteError({
      status:
        401,
      code:
        "SESSION_NOT_FOUND",
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
          error:
            unknown,
        ) => {
          console.error(
            "[MARKETING_EXPORT_EXPIRED_SESSION_DELETE_ERROR]",
            error,
          );
        },
      );

    throw new MarketingExportRouteError({
      status:
        401,
      code:
        "SESSION_EXPIRED",
      message:
        "Votre session a expiré. Veuillez vous reconnecter.",
    });
  }

  if (
    session.user.role !==
      UserRole.ORGANIZER ||
    !session.user.emailVerified ||
    !session.user.isActive
  ) {
    throw new MarketingExportRouteError({
      status:
        403,
      code:
        "FORBIDDEN",
      message:
        "Ce compte n’est pas autorisé à exporter les données marketing.",
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
      session.user
        .organizerProfile
        ?.businessName ??
      null,
  };
}

function buildCampaignWhere({
  organizerId,
  filters,
}: {
  organizerId:
    string;
  filters:
    ExportFilters;
}): Prisma.MarketingCampaignWhereInput {
  const andFilters:
    Prisma.MarketingCampaignWhereInput[] =
    [];

  if (
    filters.startsAt
  ) {
    andFilters.push({
      OR: [
        {
          startsAt:
            null,
        },
        {
          startsAt: {
            gte:
              filters.startsAt,
          },
        },
      ],
    });
  }

  if (
    filters.endsAt
  ) {
    andFilters.push({
      OR: [
        {
          endsAt:
            null,
        },
        {
          endsAt: {
            lte:
              filters.endsAt,
          },
        },
      ],
    });
  }

  return {
    organizerId,

    ...(filters.eventId
      ? {
          eventId:
            filters.eventId,
        }
      : {}),

    ...(filters.campaignId
      ? {
          id:
            filters.campaignId,
        }
      : {}),

    ...(!filters.includeArchived
      ? {
          status: {
            not:
              "ARCHIVED",
          },
        }
      : {}),

    ...(filters.search
      ? {
          OR: [
            {
              name: {
                contains:
                  filters.search,
                mode:
                  "insensitive",
              },
            },
            {
              description: {
                contains:
                  filters.search,
                mode:
                  "insensitive",
              },
            },
            {
              source: {
                contains:
                  filters.search,
                mode:
                  "insensitive",
              },
            },
            {
              trackingCode: {
                contains:
                  filters.search,
                mode:
                  "insensitive",
              },
            },
            {
              event: {
                title: {
                  contains:
                    filters.search,
                  mode:
                    "insensitive",
                },
              },
            },
          ],
        }
      : {}),

    ...(andFilters.length >
    0
      ? {
          AND:
            andFilters,
        }
      : {}),
  };
}

function buildPromoCodeWhere({
  organizerId,
  filters,
}: {
  organizerId:
    string;
  filters:
    ExportFilters;
}): Prisma.PromoCodeWhereInput {
  const andFilters:
    Prisma.PromoCodeWhereInput[] =
    [];

  if (
    filters.startsAt
  ) {
    andFilters.push({
      OR: [
        {
          startsAt:
            null,
        },
        {
          startsAt: {
            gte:
              filters.startsAt,
          },
        },
      ],
    });
  }

  if (
    filters.endsAt
  ) {
    andFilters.push({
      OR: [
        {
          expiresAt:
            null,
        },
        {
          expiresAt: {
            lte:
              filters.endsAt,
          },
        },
      ],
    });
  }

  return {
    organizerId,

    ...(filters.eventId
      ? {
          eventId:
            filters.eventId,
        }
      : {}),

    ...(filters.campaignId
      ? {
          campaignId:
            filters.campaignId,
        }
      : {}),

    ...(!filters.includeArchived
      ? {
          status: {
            not:
              "ARCHIVED",
          },
        }
      : {}),

    ...(filters.search
      ? {
          OR: [
            {
              code: {
                contains:
                  filters.search,
                mode:
                  "insensitive",
              },
            },
            {
              description: {
                contains:
                  filters.search,
                mode:
                  "insensitive",
              },
            },
            {
              event: {
                title: {
                  contains:
                    filters.search,
                  mode:
                    "insensitive",
                },
              },
            },
            {
              campaign: {
                is: {
                  name: {
                    contains:
                      filters.search,
                    mode:
                      "insensitive",
                  },
                },
              },
            },
          ],
        }
      : {}),

    ...(andFilters.length >
    0
      ? {
          AND:
            andFilters,
        }
      : {}),
  };
}

async function getCampaignRows({
  organizerId,
  filters,
}: {
  organizerId:
    string;
  filters:
    ExportFilters;
}): Promise<
  Record<
    string,
    unknown
  >[]
> {
  const campaigns =
    await prisma.marketingCampaign.findMany({
      where:
        buildCampaignWhere({
          organizerId,
          filters,
        }),

      take:
        MAX_EXPORT_ROWS,

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

      include: {
        event: {
          select: {
            title:
              true,
            slug:
              true,
            currency:
              true,
          },
        },

        visits: {
          select: {
            id:
              true,
          },
        },

        attributions: {
          select: {
            revenue:
              true,
            ticketsCount:
              true,
          },
        },

        promoCodes: {
          select: {
            id:
              true,
          },
        },
      },
    });

  return campaigns.map(
    (
      campaign,
    ) => {
      const orders =
        campaign.attributions.length;

      const tickets =
        campaign.attributions.reduce(
          (
            total,
            attribution,
          ) =>
            total +
            attribution.ticketsCount,
          0,
        );

      const revenue =
        campaign.attributions.reduce(
          (
            total,
            attribution,
          ) =>
            total +
            (
              decimalToNumber(
                attribution.revenue,
              ) ??
              0
            ),
          0,
        );

      const visits =
        campaign.visits.length;

      const conversionRate =
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
          : 0;

      return {
        type:
          "campaign",

        id:
          campaign.id,

        event:
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
          decimalToNumber(
            campaign.budget,
          ),

        currency:
          campaign.currency,

        goalType:
          campaign.goalType,

        goalValue:
          decimalToNumber(
            campaign.goalValue,
          ),

        startsAt:
          formatDateTime(
            campaign.startsAt,
          ),

        endsAt:
          formatDateTime(
            campaign.endsAt,
          ),

        isActive:
          campaign.isActive,

        visits,

        orders,

        tickets,

        revenue:
          Number(
            revenue.toFixed(2),
          ),

        conversionRate,

        promoCodes:
          campaign.promoCodes.length,

        createdAt:
          campaign.createdAt.toISOString(),

        updatedAt:
          campaign.updatedAt.toISOString(),
      };
    },
  );
}

async function getPromoCodeRows({
  organizerId,
  filters,
}: {
  organizerId:
    string;
  filters:
    ExportFilters;
}): Promise<
  Record<
    string,
    unknown
  >[]
> {
  const promoCodes =
    await prisma.promoCode.findMany({
      where:
        buildPromoCodeWhere({
          organizerId,
          filters,
        }),

      take:
        MAX_EXPORT_ROWS,

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

      include: {
        event: {
          select: {
            title:
              true,
            slug:
              true,
            currency:
              true,
          },
        },

        campaign: {
          select: {
            id:
              true,
            name:
              true,
          },
        },

        usages: {
          select: {
            discountAmount:
              true,
          },
        },

        attributions: {
          select: {
            revenue:
              true,
          },
        },
      },
    });

  return promoCodes.map(
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
            (
              decimalToNumber(
                usage.discountAmount,
              ) ??
              0
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
            (
              decimalToNumber(
                attribution.revenue,
              ) ??
              0
            ),
          0,
        );

      return {
        type:
          "promo-code",

        id:
          promoCode.id,

        event:
          promoCode.event.title,

        eventSlug:
          promoCode.event.slug,

        campaign:
          promoCode.campaign
            ?.name ??
          "",

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
          decimalToNumber(
            promoCode.minimumOrderAmount,
          ),

        maximumDiscount:
          decimalToNumber(
            promoCode.maximumDiscount,
          ),

        maximumUses:
          promoCode.maximumUses,

        usesPerCustomer:
          promoCode.usesPerCustomer,

        currentUses:
          promoCode.currentUses,

        usages:
          promoCode.usages.length,

        discountsGranted:
          Number(
            discountsGranted.toFixed(2),
          ),

        attributedOrders:
          promoCode.attributions.length,

        attributedRevenue:
          Number(
            attributedRevenue.toFixed(2),
          ),

        currency:
          promoCode.event.currency,

        startsAt:
          formatDateTime(
            promoCode.startsAt,
          ),

        expiresAt:
          formatDateTime(
            promoCode.expiresAt,
          ),

        status:
          promoCode.status,

        isActive:
          promoCode.isActive,

        createdAt:
          promoCode.createdAt.toISOString(),

        updatedAt:
          promoCode.updatedAt.toISOString(),
      };
    },
  );
}

function handleRouteError(
  error:
    unknown,
) {
  if (
    error instanceof
    MarketingExportRouteError
  ) {
    return NextResponse.json(
      {
        ok:
          false,

        error: {
          code:
            error.code,

          message:
            error.message,

          details:
            error.details,
        },
      },
      {
        status:
          error.status,
      },
    );
  }

  console.error(
    "[ORGANIZER_MARKETING_EXPORT_ROUTE_ERROR]",
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

  return NextResponse.json(
    {
      ok:
        false,

      error: {
        code:
          "INTERNAL_SERVER_ERROR",

        message:
          "Impossible d’exporter les données marketing pour le moment.",
      },
    },
    {
      status:
        500,
    },
  );
}

export async function GET(
  request:
    NextRequest,
) {
  try {
    const organizer =
      await getAuthenticatedOrganizer();

    const filters =
      parseFilters(
        request,
      );

    const [
      campaignRows,
      promoCodeRows,
    ] =
      await Promise.all([
        filters.type ===
          "promo-codes"
          ? Promise.resolve([])
          : getCampaignRows({
              organizerId:
                organizer.id,
              filters,
            }),

        filters.type ===
          "campaigns"
          ? Promise.resolve([])
          : getPromoCodeRows({
              organizerId:
                organizer.id,
              filters,
            }),
      ]);

    const exportDate =
      new Date();

    const organizerName =
      organizer.businessName ||
      `${organizer.firstName}-${organizer.lastName}`;

    const baseFileName =
      sanitizeFileName(
        [
          "tikemia-marketing",
          organizerName,
          filters.type,
          formatDateForFileName(
            exportDate,
          ),
        ].join("-"),
      );

    if (
      filters.format ===
      "json"
    ) {
      const payload = {
        exportedAt:
          exportDate.toISOString(),

        organizer: {
          id:
            organizer.id,

          firstName:
            organizer.firstName,

          lastName:
            organizer.lastName,

          email:
            organizer.email,

          businessName:
            organizer.businessName,
        },

        filters: {
          ...filters,

          startsAt:
            filters.startsAt
              ?.toISOString() ??
            null,

          endsAt:
            filters.endsAt
              ?.toISOString() ??
            null,
        },

        campaigns:
          campaignRows,

        promoCodes:
          promoCodeRows,

        totals: {
          campaigns:
            campaignRows.length,

          promoCodes:
            promoCodeRows.length,

          rows:
            campaignRows.length +
            promoCodeRows.length,
        },
      };

      return new NextResponse(
        JSON.stringify(
          payload,
          null,
          2,
        ),
        {
          status:
            200,

          headers: {
            "Content-Type":
              "application/json; charset=utf-8",

            "Content-Disposition":
              `attachment; filename="${baseFileName}.json"`,

            "Cache-Control":
              "private, no-store, max-age=0",

            "X-Content-Type-Options":
              "nosniff",
          },
        },
      );
    }

    const sections:
      string[] = [];

    if (
      campaignRows.length >
      0
    ) {
      sections.push(
        "CAMPAGNES",
        rowsToCsv(
          campaignRows,
        ),
      );
    }

    if (
      promoCodeRows.length >
      0
    ) {
      if (
        sections.length >
        0
      ) {
        sections.push(
          "",
          "",
        );
      }

      sections.push(
        "CODES PROMO",
        rowsToCsv(
          promoCodeRows,
        ).replace(
          /^\uFEFF/,
          "",
        ),
      );
    }

    if (
      sections.length ===
      0
    ) {
      sections.push(
        "\uFEFFAucune donnée marketing à exporter.",
      );
    }

    const csvContent =
      sections.join(
        "\r\n",
      );

    return new NextResponse(
      csvContent,
      {
        status:
          200,

        headers: {
          "Content-Type":
            "text/csv; charset=utf-8",

          "Content-Disposition":
            `attachment; filename="${baseFileName}.csv"`,

          "Cache-Control":
            "private, no-store, max-age=0",

          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  } catch (
    error
  ) {
    return handleRouteError(
      error,
    );
  }
}