import {
  createHash,
} from "node:crypto";

import {
  MarketingCampaignStatus,
  Prisma,
  UserRole,
} from "@prisma/client";
import { cookies } from "next/headers";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createCampaignTrackingLink,
} from "@/lib/marketing/create-tracking-link";
import {
  createCampaignTrackingCode,
} from "@/lib/marketing/create-tracking-code";
import {
  createMarketingCampaignSchema,
  marketingCampaignQuerySchema,
} from "@/lib/organizer/marketing/marketing-schemas";
import { prisma } from "@/lib/prisma";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const MAX_TRACKING_CODE_ATTEMPTS =
  5;

type AuthenticatedOrganizer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

class MarketingCampaignRouteError extends Error {
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
      "MarketingCampaignRouteError";

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
    | null
    | undefined,
): number | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  return value.toNumber();
}

function serializeCampaign<
  T extends {
    id: string;
    organizerId: string;
    eventId: string;
    name: string;
    description: string | null;
    channel: string;
    status: string;
    source: string | null;
    medium: string | null;
    content: string | null;
    trackingCode: string;
    trackingUrl: string;
    budget: Prisma.Decimal | null;
    currency: string;
    goalType: string | null;
    goalValue: Prisma.Decimal | null;
    startsAt: Date | null;
    endsAt: Date | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
>(
  campaign: T,
) {
  return {
    ...campaign,

    budget:
      decimalToNumber(
        campaign.budget,
      ),

    goalValue:
      decimalToNumber(
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

    createdAt:
      campaign.createdAt.toISOString(),

    updatedAt:
      campaign.updatedAt.toISOString(),
  };
}

function getSearchParamsObject(
  request:
    NextRequest,
): Record<
  string,
  string
> {
  const output:
    Record<
      string,
      string
    > = {};

  request.nextUrl.searchParams.forEach(
    (
      value,
      key,
    ) => {
      output[key] =
        value;
    },
  );

  return output;
}

function createValidationErrorDetails(
  issues: Array<{
    path:
      PropertyKey[];
    message:
      string;
  }>,
) {
  return issues.map(
    (
      issue,
    ) => ({
      field:
        issue.path
          .map(String)
          .join(".") ||
        "form",

      message:
        issue.message,
    }),
  );
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

  if (
    !rawSessionToken
  ) {
    throw new MarketingCampaignRouteError({
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
          },
        },
      },
    });

  if (
    !session
  ) {
    throw new MarketingCampaignRouteError({
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
            "[MARKETING_CAMPAIGNS_EXPIRED_SESSION_DELETE_ERROR]",
            error,
          );
        },
      );

    throw new MarketingCampaignRouteError({
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
    throw new MarketingCampaignRouteError({
      status:
        403,

      code:
        "FORBIDDEN",

      message:
        "Ce compte n’est pas autorisé à gérer des campagnes marketing.",
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
  };
}

async function createUniqueTrackingCode({
  organizerId,
  eventId,
  source,
  channel,
}: {
  organizerId:
    string;
  eventId:
    string;
  source:
    string | null;
  channel:
    string;
}): Promise<string> {
  for (
    let attempt =
      0;
    attempt <
    MAX_TRACKING_CODE_ATTEMPTS;
    attempt +=
      1
  ) {
    const trackingCode =
      createCampaignTrackingCode({
        organizerId,
        eventId,
        source,
        channel,
      });

    const existing =
      await prisma.marketingCampaign.findUnique({
        where: {
          trackingCode,
        },

        select: {
          id:
            true,
        },
      });

    if (
      !existing
    ) {
      return trackingCode;
    }
  }

  throw new MarketingCampaignRouteError({
    status:
      500,

    code:
      "TRACKING_CODE_GENERATION_FAILED",

    message:
      "Impossible de générer un code de suivi unique. Réessayez.",
  });
}

function buildCampaignWhere({
  organizerId,
  query,
}: {
  organizerId:
    string;
  query:
    ReturnType<
      typeof marketingCampaignQuerySchema.parse
    >;
}): Prisma.MarketingCampaignWhereInput {
  const search =
    query.search ??
    null;

  const dateFilters:
    Prisma.MarketingCampaignWhereInput[] = [];

  if (
    query.startsAt
  ) {
    dateFilters.push({
      OR: [
        {
          startsAt:
            null,
        },
        {
          startsAt: {
            gte:
              query.startsAt,
          },
        },
      ],
    });
  }

  if (
    query.endsAt
  ) {
    dateFilters.push({
      OR: [
        {
          endsAt:
            null,
        },
        {
          endsAt: {
            lte:
              query.endsAt,
          },
        },
      ],
    });
  }

  return {
    organizerId,

    ...(query.eventId
      ? {
          eventId:
            query.eventId,
        }
      : {}),

    ...(query.status
      ? {
          status:
            query.status,
        }
      : query.includeArchived
        ? {}
        : {
            status: {
              not:
                MarketingCampaignStatus.ARCHIVED,
            },
          }),

    ...(query.channel
      ? {
          channel:
            query.channel,
        }
      : {}),

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
              medium: {
                contains:
                  search,
                mode:
                  "insensitive",
              },
            },
            {
              trackingCode: {
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

    ...(dateFilters.length >
    0
      ? {
          AND:
            dateFilters,
        }
      : {}),
  };
}

function buildCampaignOrderBy({
  sortBy,
  sortDirection,
}: {
  sortBy:
    ReturnType<
      typeof marketingCampaignQuerySchema.parse
    >["sortBy"];

  sortDirection:
    "asc" |
    "desc";
}): Prisma.MarketingCampaignOrderByWithRelationInput[] {
  return [
    {
      [sortBy]:
        sortDirection,
    },

    {
      id:
        sortDirection,
    },
  ];
}

function handleRouteError(
  error:
    unknown,
) {
  if (
    error instanceof
    MarketingCampaignRouteError
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

  if (
    error instanceof
    Prisma.PrismaClientKnownRequestError
  ) {
    if (
      error.code ===
      "P2002"
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error: {
            code:
              "CAMPAIGN_CONFLICT",

            message:
              "Une campagne utilise déjà l’une de ces informations uniques.",
          },
        },
        {
          status:
            409,
        },
      );
    }

    if (
      error.code ===
      "P2025"
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error: {
            code:
              "RESOURCE_NOT_FOUND",

            message:
              "La ressource demandée est introuvable.",
          },
        },
        {
          status:
            404,
        },
      );
    }
  }

  console.error(
    "[ORGANIZER_MARKETING_CAMPAIGNS_ROUTE_ERROR]",
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
          "Une erreur interne est survenue. Réessayez dans quelques instants.",
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

    const queryResult =
      marketingCampaignQuerySchema.safeParse(
        getSearchParamsObject(
          request,
        ),
      );

    if (
      !queryResult.success
    ) {
      throw new MarketingCampaignRouteError({
        status:
          400,

        code:
          "INVALID_QUERY",

        message:
          "Les filtres de recherche sont invalides.",

        details:
          createValidationErrorDetails(
            queryResult.error.issues,
          ),
      });
    }

    const query =
      queryResult.data;

    const where =
      buildCampaignWhere({
        organizerId:
          organizer.id,

        query,
      });

    const skip =
      (
        query.page -
        1
      ) *
      query.pageSize;

    const [
      campaigns,
      total,
    ] =
      await prisma.$transaction([
        prisma.marketingCampaign.findMany({
          where,

          skip,

          take:
            query.pageSize,

          orderBy:
            buildCampaignOrderBy({
              sortBy:
                query.sortBy,

              sortDirection:
                query.sortDirection,
            }),

          include: {
            event: {
              select: {
                id:
                  true,

                title:
                  true,

                slug:
                  true,

                startsAt:
                  true,

                endsAt:
                  true,

                currency:
                  true,

                status:
                  true,
              },
            },

            _count: {
              select: {
                visits:
                  true,

                attributions:
                  true,

                promoCodes:
                  true,
              },
            },
          },
        }),

        prisma.marketingCampaign.count({
          where,
        }),
      ]);

    const pageCount =
      Math.max(
        Math.ceil(
          total /
          query.pageSize,
        ),
        1,
      );

    return NextResponse.json(
      {
        ok:
          true,

        data: {
          campaigns:
            campaigns.map(
              (
                campaign,
              ) => ({
                ...serializeCampaign(
                  campaign,
                ),

                event: {
                  ...campaign.event,

                  startsAt:
                    campaign.event.startsAt.toISOString(),

                  endsAt:
                    campaign.event.endsAt
                      ?.toISOString() ??
                    null,
                },
              }),
            ),

          pagination: {
            page:
              query.page,

            pageSize:
              query.pageSize,

            total,

            pageCount,

            hasPreviousPage:
              query.page >
              1,

            hasNextPage:
              query.page <
              pageCount,
          },

          filters: {
            search:
              query.search ??
              "",

            eventId:
              query.eventId ??
              null,

            status:
              query.status ??
              null,

            channel:
              query.channel ??
              null,

            period:
              query.period,

            startsAt:
              query.startsAt
                ?.toISOString() ??
              null,

            endsAt:
              query.endsAt
                ?.toISOString() ??
              null,

            sortBy:
              query.sortBy,

            sortDirection:
              query.sortDirection,

            includeArchived:
              query.includeArchived,
          },
        },
      },
      {
        status:
          200,

        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
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

export async function POST(
  request:
    NextRequest,
) {
  try {
    const organizer =
      await getAuthenticatedOrganizer();

    let body:
      unknown;

    try {
      body =
        await request.json();
    } catch {
      throw new MarketingCampaignRouteError({
        status:
          400,

        code:
          "INVALID_JSON",

        message:
          "Le corps de la requête doit être un JSON valide.",
      });
    }

    const validationResult =
      createMarketingCampaignSchema.safeParse(
        body,
      );

    if (
      !validationResult.success
    ) {
      throw new MarketingCampaignRouteError({
        status:
          422,

        code:
          "VALIDATION_ERROR",

        message:
          "Certaines informations de la campagne sont invalides.",

        details:
          createValidationErrorDetails(
            validationResult.error.issues,
          ),
      });
    }

    const input =
      validationResult.data;

    const event =
      await prisma.event.findFirst({
        where: {
          id:
            input.eventId,

          organizerId:
            organizer.id,
        },

        select: {
          id:
            true,

          title:
            true,

          slug:
            true,

          currency:
            true,

          status:
            true,
        },
      });

    if (
      !event
    ) {
      throw new MarketingCampaignRouteError({
        status:
          404,

        code:
          "EVENT_NOT_FOUND",

        message:
          "L’événement sélectionné est introuvable ou ne vous appartient pas.",
      });
    }

    const trackingCode =
      await createUniqueTrackingCode({
        organizerId:
          organizer.id,

        eventId:
          event.id,

        source:
          input.source ??
          null,

        channel:
          input.channel,
      });

    const trackingLink =
      createCampaignTrackingLink({
        eventSlug:
          event.slug,

        eventId:
          event.id,

        organizerId:
          organizer.id,

        trackingCode,

        source:
          input.source ??
          null,

        medium:
          input.medium ??
          null,

        campaign:
          input.name,

        content:
          input.content ??
          null,

        channel:
          input.channel,
      });

    const createdCampaign =
      await prisma.$transaction(
        async (
          transaction,
        ) => {
          const campaign =
            await transaction.marketingCampaign.create({
              data: {
                organizerId:
                  organizer.id,

                eventId:
                  event.id,

                name:
                  input.name,

                description:
                  input.description ??
                  null,

                channel:
                  input.channel,

                status:
                  input.status,

                source:
                  input.source ??
                  null,

                medium:
                  input.medium ??
                  null,

                content:
                  input.content ??
                  null,

                trackingCode:
                  trackingLink.trackingCode,

                trackingUrl:
                  trackingLink.url,

                budget:
                  input.budget ??
                  null,

                currency:
                  input.currency ||
                  event.currency,

                goalType:
                  input.goalType ??
                  null,

                goalValue:
                  input.goalValue ??
                  null,

                startsAt:
                  input.startsAt ??
                  null,

                endsAt:
                  input.endsAt ??
                  null,

                isActive:
                  input.isActive,
              },

              include: {
                event: {
                  select: {
                    id:
                      true,

                    title:
                      true,

                    slug:
                      true,

                    startsAt:
                      true,

                    endsAt:
                      true,

                    currency:
                      true,

                    status:
                      true,
                  },
                },

                _count: {
                  select: {
                    visits:
                      true,

                    attributions:
                      true,

                    promoCodes:
                      true,
                  },
                },
              },
            });

          await transaction.organizerActivity.create({
            data: {
              organizerId:
                organizer.id,

              eventId:
                event.id,

              type:
                "EVENT_CREATED",

              title:
                "Campagne marketing créée",

              description:
                `La campagne « ${campaign.name} » a été créée pour l’événement « ${event.title} ».`,

              metadata: {
                campaignId:
                  campaign.id,

                channel:
                  campaign.channel,

                trackingCode:
                  campaign.trackingCode,
              },
            },
          });

          return campaign;
        },
      );

    return NextResponse.json(
      {
        ok:
          true,

        message:
          "La campagne marketing a été créée avec succès.",

        data: {
          campaign: {
            ...serializeCampaign(
              createdCampaign,
            ),

            event: {
              ...createdCampaign.event,

              startsAt:
                createdCampaign.event.startsAt.toISOString(),

              endsAt:
                createdCampaign.event.endsAt
                  ?.toISOString() ??
                null,
            },
          },
        },
      },
      {
        status:
          201,

        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
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