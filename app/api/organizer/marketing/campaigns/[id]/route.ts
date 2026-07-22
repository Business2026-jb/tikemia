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
  updateMarketingCampaignSchema,
} from "@/lib/organizer/marketing/marketing-schemas";
import { prisma } from "@/lib/prisma";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

type RouteContext = {
  params:
    Promise<{
      id: string;
    }>;
};

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

  return typeof value ===
    "number"
    ? value
    : value.toNumber();
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
    budget:
      Prisma.Decimal |
      number |
      null;
    currency: string;
    goalType: string | null;
    goalValue:
      Prisma.Decimal |
      number |
      null;
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

async function getCampaignId(
  context:
    RouteContext,
): Promise<string> {
  const {
    id,
  } =
    await context.params;

  const normalizedId =
    normalizeText(id);

  if (
    !normalizedId
  ) {
    throw new MarketingCampaignRouteError({
      status:
        400,

      code:
        "CAMPAIGN_ID_REQUIRED",

      message:
        "L’identifiant de la campagne est obligatoire.",
    });
  }

  return normalizedId;
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
            "[MARKETING_CAMPAIGN_EXPIRED_SESSION_DELETE_ERROR]",
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

async function getOwnedCampaign({
  campaignId,
  organizerId,
}: {
  campaignId:
    string;
  organizerId:
    string;
}) {
  const campaign =
    await prisma.marketingCampaign.findFirst({
      where: {
        id:
          campaignId,

        organizerId,
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

  if (
    !campaign
  ) {
    throw new MarketingCampaignRouteError({
      status:
        404,

      code:
        "CAMPAIGN_NOT_FOUND",

      message:
        "Cette campagne est introuvable ou ne vous appartient pas.",
    });
  }

  return campaign;
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
              "CAMPAIGN_NOT_FOUND",

            message:
              "La campagne demandée est introuvable.",
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
    "[ORGANIZER_MARKETING_CAMPAIGN_ROUTE_ERROR]",
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
  _request:
    NextRequest,
  context:
    RouteContext,
) {
  try {
    const organizer =
      await getAuthenticatedOrganizer();

    const campaignId =
      await getCampaignId(
        context,
      );

    const campaign =
      await getOwnedCampaign({
        campaignId,

        organizerId:
          organizer.id,
      });

    return NextResponse.json(
      {
        ok:
          true,

        data: {
          campaign: {
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

export async function PATCH(
  request:
    NextRequest,
  context:
    RouteContext,
) {
  try {
    const organizer =
      await getAuthenticatedOrganizer();

    const campaignId =
      await getCampaignId(
        context,
      );

    const currentCampaign =
      await getOwnedCampaign({
        campaignId,

        organizerId:
          organizer.id,
      });

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
      updateMarketingCampaignSchema.safeParse(
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

    const targetEventId =
      input.eventId ??
      currentCampaign.eventId;

    const targetEvent =
      targetEventId ===
      currentCampaign.eventId
        ? currentCampaign.event
        : await prisma.event.findFirst({
            where: {
              id:
                targetEventId,

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

              startsAt:
                true,

              endsAt:
                true,

              currency:
                true,

              status:
                true,
            },
          });

    if (
      !targetEvent
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

    const nextName =
      input.name ??
      currentCampaign.name;

    const nextSource =
      input.source ===
      undefined
        ? currentCampaign.source
        : input.source;

    const nextMedium =
      input.medium ===
      undefined
        ? currentCampaign.medium
        : input.medium;

    const nextContent =
      input.content ===
      undefined
        ? currentCampaign.content
        : input.content;

    const nextChannel =
      input.channel ??
      currentCampaign.channel;

    const trackingDataChanged =
      targetEvent.id !==
        currentCampaign.eventId ||
      nextName !==
        currentCampaign.name ||
      nextSource !==
        currentCampaign.source ||
      nextMedium !==
        currentCampaign.medium ||
      nextContent !==
        currentCampaign.content ||
      nextChannel !==
        currentCampaign.channel;

    const nextTrackingUrl =
      trackingDataChanged
        ? createCampaignTrackingLink({
            eventSlug:
              targetEvent.slug,

            eventId:
              targetEvent.id,

            organizerId:
              organizer.id,

            campaignId:
              currentCampaign.id,

            trackingCode:
              currentCampaign.trackingCode,

            source:
              nextSource,

            medium:
              nextMedium,

            campaign:
              nextName,

            content:
              nextContent,

            channel:
              nextChannel,
          }).url
        : currentCampaign.trackingUrl;

    const updatedCampaign =
      await prisma.marketingCampaign.update({
        where: {
          id:
            currentCampaign.id,
        },

        data: {
          ...(input.eventId !==
          undefined
            ? {
                eventId:
                  input.eventId,
              }
            : {}),

          ...(input.name !==
          undefined
            ? {
                name:
                  input.name,
              }
            : {}),

          ...(input.description !==
          undefined
            ? {
                description:
                  input.description,
              }
            : {}),

          ...(input.channel !==
          undefined
            ? {
                channel:
                  input.channel,
              }
            : {}),

          ...(input.status !==
          undefined
            ? {
                status:
                  input.status,
              }
            : {}),

          ...(input.source !==
          undefined
            ? {
                source:
                  input.source,
              }
            : {}),

          ...(input.medium !==
          undefined
            ? {
                medium:
                  input.medium,
              }
            : {}),

          ...(input.content !==
          undefined
            ? {
                content:
                  input.content,
              }
            : {}),

          ...(input.budget !==
          undefined
            ? {
                budget:
                  input.budget,
              }
            : {}),

          ...(input.currency !==
          undefined
            ? {
                currency:
                  input.currency,
              }
            : {}),

          ...(input.goalType !==
          undefined
            ? {
                goalType:
                  input.goalType,
              }
            : {}),

          ...(input.goalValue !==
          undefined
            ? {
                goalValue:
                  input.goalValue,
              }
            : {}),

          ...(input.startsAt !==
          undefined
            ? {
                startsAt:
                  input.startsAt,
              }
            : {}),

          ...(input.endsAt !==
          undefined
            ? {
                endsAt:
                  input.endsAt,
              }
            : {}),

          ...(input.isActive !==
          undefined
            ? {
                isActive:
                  input.isActive,
              }
            : {}),

          ...(trackingDataChanged
            ? {
                trackingUrl:
                  nextTrackingUrl,
              }
            : {}),
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

    return NextResponse.json(
      {
        ok:
          true,

        message:
          "La campagne marketing a été mise à jour avec succès.",

        data: {
          campaign: {
            ...serializeCampaign(
              updatedCampaign,
            ),

            event: {
              ...updatedCampaign.event,

              startsAt:
                updatedCampaign.event.startsAt.toISOString(),

              endsAt:
                updatedCampaign.event.endsAt
                  ?.toISOString() ??
                null,
            },
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

export async function DELETE(
  _request:
    NextRequest,
  context:
    RouteContext,
) {
  try {
    const organizer =
      await getAuthenticatedOrganizer();

    const campaignId =
      await getCampaignId(
        context,
      );

    const campaign =
      await getOwnedCampaign({
        campaignId,

        organizerId:
          organizer.id,
      });

    const hasRelatedData =
      campaign._count.visits >
        0 ||
      campaign._count.attributions >
        0 ||
      campaign._count.promoCodes >
        0;

    if (
      hasRelatedData
    ) {
      const archivedCampaign =
        await prisma.marketingCampaign.update({
          where: {
            id:
              campaign.id,
          },

          data: {
            status:
              MarketingCampaignStatus.ARCHIVED,

            isActive:
              false,
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

      return NextResponse.json(
        {
          ok:
            true,

          message:
            "La campagne possède déjà des données liées. Elle a été archivée au lieu d’être supprimée.",

          data: {
            action:
              "archived",

            campaign: {
              ...serializeCampaign(
                archivedCampaign,
              ),

              event: {
                ...archivedCampaign.event,

                startsAt:
                  archivedCampaign.event.startsAt.toISOString(),

                endsAt:
                  archivedCampaign.event.endsAt
                    ?.toISOString() ??
                  null,
              },
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
    }

    await prisma.marketingCampaign.delete({
      where: {
        id:
          campaign.id,
      },
    });

    return NextResponse.json(
      {
        ok:
          true,

        message:
          "La campagne marketing a été supprimée définitivement.",

        data: {
          action:
            "deleted",

          campaignId:
            campaign.id,
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