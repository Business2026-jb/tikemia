import { createHash } from "node:crypto";

import {
  Prisma,
  PromoCodeStatus,
  UserRole,
} from "@prisma/client";
import { cookies } from "next/headers";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  updatePromoCodeSchema,
} from "@/lib/organizer/marketing/marketing-schemas";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type AuthenticatedOrganizer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

class PromoCodeRouteError extends Error {
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

    this.name = "PromoCodeRouteError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function hashSessionToken(
  token: string,
): string {
  return createHash("sha256")
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

  return typeof value === "number"
    ? value
    : value.toNumber();
}

function createValidationErrorDetails(
  issues: Array<{
    path: PropertyKey[];
    message: string;
  }>,
) {
  return issues.map((issue) => ({
    field:
      issue.path
        .map(String)
        .join(".") || "form",
    message: issue.message,
  }));
}

function serializePromoCode<
  T extends {
    id: string;
    organizerId: string;
    eventId: string;
    campaignId: string | null;
    code: string;
    description: string | null;
    discountType: string;
    discountValue:
      | Prisma.Decimal
      | number;
    minimumOrderAmount:
      | Prisma.Decimal
      | number
      | null;
    maximumDiscount:
      | Prisma.Decimal
      | number
      | null;
    maximumUses: number | null;
    usesPerCustomer: number | null;
    currentUses: number;
    startsAt: Date | null;
    expiresAt: Date | null;
    status: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
>(
  promoCode: T,
) {
  return {
    ...promoCode,

    discountValue:
      decimalToNumber(
        promoCode.discountValue,
      ) ?? 0,

    minimumOrderAmount:
      decimalToNumber(
        promoCode.minimumOrderAmount,
      ),

    maximumDiscount:
      decimalToNumber(
        promoCode.maximumDiscount,
      ),

    startsAt:
      promoCode.startsAt
        ?.toISOString() ?? null,

    expiresAt:
      promoCode.expiresAt
        ?.toISOString() ?? null,

    createdAt:
      promoCode.createdAt.toISOString(),

    updatedAt:
      promoCode.updatedAt.toISOString(),
  };
}

async function getPromoCodeId(
  context: RouteContext,
): Promise<string> {
  const { id } = await context.params;

  const normalizedId =
    normalizeText(id);

  if (!normalizedId) {
    throw new PromoCodeRouteError({
      status: 400,
      code: "PROMO_CODE_ID_REQUIRED",
      message:
        "L’identifiant du code promo est obligatoire.",
    });
  }

  return normalizedId;
}

async function getAuthenticatedOrganizer(): Promise<AuthenticatedOrganizer> {
  const cookieStore =
    await cookies();

  const cookieName =
    normalizeText(
      process.env.SESSION_COOKIE_NAME,
    ) ||
    SESSION_COOKIE_FALLBACK_NAME;

  const rawSessionToken =
    cookieStore.get(cookieName)?.value;

  if (!rawSessionToken) {
    throw new PromoCodeRouteError({
      status: 401,
      code: "UNAUTHENTICATED",
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
        id: true,
        expiresAt: true,

        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            emailVerified: true,
            isActive: true,
          },
        },
      },
    });

  if (!session) {
    throw new PromoCodeRouteError({
      status: 401,
      code: "SESSION_NOT_FOUND",
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
          id: session.id,
        },
      })
      .catch((error: unknown) => {
        console.error(
          "[PROMO_CODE_EXPIRED_SESSION_DELETE_ERROR]",
          error,
        );
      });

    throw new PromoCodeRouteError({
      status: 401,
      code: "SESSION_EXPIRED",
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
    throw new PromoCodeRouteError({
      status: 403,
      code: "FORBIDDEN",
      message:
        "Ce compte n’est pas autorisé à gérer les codes promo.",
    });
  }

  return {
    id: session.user.id,
    firstName: session.user.firstName,
    lastName: session.user.lastName,
    email: session.user.email,
  };
}

async function getOwnedPromoCode({
  promoCodeId,
  organizerId,
}: {
  promoCodeId: string;
  organizerId: string;
}) {
  const promoCode =
    await prisma.promoCode.findFirst({
      where: {
        id: promoCodeId,
        organizerId,
      },

      include: {
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
            startsAt: true,
            endsAt: true,
            currency: true,
            status: true,
          },
        },

        campaign: {
          select: {
            id: true,
            name: true,
            eventId: true,
            status: true,
            channel: true,
          },
        },

        _count: {
          select: {
            usages: true,
            attributions: true,
          },
        },
      },
    });

  if (!promoCode) {
    throw new PromoCodeRouteError({
      status: 404,
      code: "PROMO_CODE_NOT_FOUND",
      message:
        "Ce code promo est introuvable ou ne vous appartient pas.",
    });
  }

  return promoCode;
}

function handleRouteError(
  error: unknown,
) {
  if (
    error instanceof
    PromoCodeRouteError
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      {
        status: error.status,
      },
    );
  }

  if (
    error instanceof
    Prisma.PrismaClientKnownRequestError
  ) {
    if (
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code:
              "PROMO_CODE_CONFLICT",
            message:
              "Ce code promo existe déjà dans votre espace organisateur.",
          },
        },
        {
          status: 409,
        },
      );
    }

    if (
      error.code === "P2025"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code:
              "PROMO_CODE_NOT_FOUND",
            message:
              "Le code promo demandé est introuvable.",
          },
        },
        {
          status: 404,
        },
      );
    }
  }

  console.error(
    "[ORGANIZER_MARKETING_PROMO_CODE_ROUTE_ERROR]",
    error instanceof Error
      ? {
          name: error.name,
          message: error.message,
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
      ok: false,
      error: {
        code:
          "INTERNAL_SERVER_ERROR",
        message:
          "Une erreur interne est survenue. Réessayez dans quelques instants.",
      },
    },
    {
      status: 500,
    },
  );
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const organizer =
      await getAuthenticatedOrganizer();

    const promoCodeId =
      await getPromoCodeId(
        context,
      );

    const promoCode =
      await getOwnedPromoCode({
        promoCodeId,
        organizerId:
          organizer.id,
      });

    return NextResponse.json(
      {
        ok: true,

        data: {
          promoCode: {
            ...serializePromoCode(
              promoCode,
            ),

            event: {
              ...promoCode.event,

              startsAt:
                promoCode.event.startsAt.toISOString(),

              endsAt:
                promoCode.event.endsAt
                  ?.toISOString() ??
                null,
            },

            campaign:
              promoCode.campaign,
          },
        },
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    return handleRouteError(
      error,
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const organizer =
      await getAuthenticatedOrganizer();

    const promoCodeId =
      await getPromoCodeId(
        context,
      );

    const currentPromoCode =
      await getOwnedPromoCode({
        promoCodeId,
        organizerId:
          organizer.id,
      });

    let body: unknown;

    try {
      body =
        await request.json();
    } catch {
      throw new PromoCodeRouteError({
        status: 400,
        code: "INVALID_JSON",
        message:
          "Le corps de la requête doit être un JSON valide.",
      });
    }

    const validationResult =
      updatePromoCodeSchema.safeParse(
        body,
      );

    if (!validationResult.success) {
      throw new PromoCodeRouteError({
        status: 422,
        code: "VALIDATION_ERROR",
        message:
          "Certaines informations du code promo sont invalides.",
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
      currentPromoCode.eventId;

    const targetEvent =
      targetEventId ===
      currentPromoCode.eventId
        ? currentPromoCode.event
        : await prisma.event.findFirst({
            where: {
              id: targetEventId,
              organizerId:
                organizer.id,
            },

            select: {
              id: true,
              title: true,
              slug: true,
              startsAt: true,
              endsAt: true,
              currency: true,
              status: true,
            },
          });

    if (!targetEvent) {
      throw new PromoCodeRouteError({
        status: 404,
        code: "EVENT_NOT_FOUND",
        message:
          "L’événement sélectionné est introuvable ou ne vous appartient pas.",
      });
    }

    const targetCampaignId =
      input.campaignId ===
      undefined
        ? currentPromoCode.campaignId
        : input.campaignId;

    let targetCampaign:
      | {
          id: string;
          name: string;
          eventId: string;
          status: string;
          channel: string;
        }
      | null = null;

    if (targetCampaignId) {
      targetCampaign =
        await prisma.marketingCampaign.findFirst({
          where: {
            id: targetCampaignId,
            organizerId:
              organizer.id,
          },

          select: {
            id: true,
            name: true,
            eventId: true,
            status: true,
            channel: true,
          },
        });

      if (!targetCampaign) {
        throw new PromoCodeRouteError({
          status: 404,
          code:
            "CAMPAIGN_NOT_FOUND",
          message:
            "La campagne sélectionnée est introuvable ou ne vous appartient pas.",
        });
      }

      if (
        targetCampaign.eventId !==
        targetEvent.id
      ) {
        throw new PromoCodeRouteError({
          status: 422,
          code:
            "CAMPAIGN_EVENT_MISMATCH",
          message:
            "La campagne sélectionnée n’est pas liée à cet événement.",
        });
      }
    }

    if (
      input.code !==
        undefined &&
      input.code !==
        currentPromoCode.code
    ) {
      const existingPromoCode =
        await prisma.promoCode.findFirst({
          where: {
            organizerId:
              organizer.id,

            code:
              input.code,

            id: {
              not:
                currentPromoCode.id,
            },
          },

          select: {
            id: true,
          },
        });

      if (existingPromoCode) {
        throw new PromoCodeRouteError({
          status: 409,
          code:
            "PROMO_CODE_ALREADY_EXISTS",
          message:
            "Ce code promo existe déjà dans votre espace organisateur.",
        });
      }
    }

    const nextMaximumUses =
      input.maximumUses ===
      undefined
        ? currentPromoCode.maximumUses
        : input.maximumUses;

    if (
      nextMaximumUses !==
        null &&
      nextMaximumUses <
        currentPromoCode.currentUses
    ) {
      throw new PromoCodeRouteError({
        status: 422,
        code:
          "MAXIMUM_USES_BELOW_CURRENT_USES",
        message:
          "La limite globale ne peut pas être inférieure au nombre d’utilisations déjà enregistrées.",
        details: [
          {
            field:
              "maximumUses",
            message:
              `Ce code a déjà été utilisé ${currentPromoCode.currentUses} fois.`,
          },
        ],
      });
    }

    const updatedPromoCode =
      await prisma.promoCode.update({
        where: {
          id:
            currentPromoCode.id,
        },

        data: {
          ...(input.eventId !==
          undefined
            ? {
                eventId:
                  input.eventId,
              }
            : {}),

          ...(input.campaignId !==
          undefined
            ? {
                campaignId:
                  input.campaignId,
              }
            : {}),

          ...(input.code !==
          undefined
            ? {
                code:
                  input.code,
              }
            : {}),

          ...(input.description !==
          undefined
            ? {
                description:
                  input.description,
              }
            : {}),

          ...(input.discountType !==
          undefined
            ? {
                discountType:
                  input.discountType,
              }
            : {}),

          ...(input.discountValue !==
          undefined
            ? {
                discountValue:
                  input.discountValue,
              }
            : {}),

          ...(input.minimumOrderAmount !==
          undefined
            ? {
                minimumOrderAmount:
                  input.minimumOrderAmount,
              }
            : {}),

          ...(input.maximumDiscount !==
          undefined
            ? {
                maximumDiscount:
                  input.maximumDiscount,
              }
            : {}),

          ...(input.maximumUses !==
          undefined
            ? {
                maximumUses:
                  input.maximumUses,
              }
            : {}),

          ...(input.usesPerCustomer !==
          undefined
            ? {
                usesPerCustomer:
                  input.usesPerCustomer,
              }
            : {}),

          ...(input.startsAt !==
          undefined
            ? {
                startsAt:
                  input.startsAt,
              }
            : {}),

          ...(input.expiresAt !==
          undefined
            ? {
                expiresAt:
                  input.expiresAt,
              }
            : {}),

          ...(input.status !==
          undefined
            ? {
                status:
                  input.status,
              }
            : {}),

          ...(input.isActive !==
          undefined
            ? {
                isActive:
                  input.isActive,
              }
            : {}),
        },

        include: {
          event: {
            select: {
              id: true,
              title: true,
              slug: true,
              startsAt: true,
              endsAt: true,
              currency: true,
              status: true,
            },
          },

          campaign: {
            select: {
              id: true,
              name: true,
              eventId: true,
              status: true,
              channel: true,
            },
          },

          _count: {
            select: {
              usages: true,
              attributions: true,
            },
          },
        },
      });

    return NextResponse.json(
      {
        ok: true,

        message:
          "Le code promo a été mis à jour avec succès.",

        data: {
          promoCode: {
            ...serializePromoCode(
              updatedPromoCode,
            ),

            event: {
              ...updatedPromoCode.event,

              startsAt:
                updatedPromoCode.event.startsAt.toISOString(),

              endsAt:
                updatedPromoCode.event.endsAt
                  ?.toISOString() ??
                null,
            },

            campaign:
              updatedPromoCode.campaign,
          },
        },
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    return handleRouteError(
      error,
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const organizer =
      await getAuthenticatedOrganizer();

    const promoCodeId =
      await getPromoCodeId(
        context,
      );

    const promoCode =
      await getOwnedPromoCode({
        promoCodeId,
        organizerId:
          organizer.id,
      });

    const hasRelatedData =
      promoCode._count.usages >
        0 ||
      promoCode._count.attributions >
        0 ||
      promoCode.currentUses >
        0;

    if (hasRelatedData) {
      const archivedPromoCode =
        await prisma.promoCode.update({
          where: {
            id:
              promoCode.id,
          },

          data: {
            status:
              PromoCodeStatus.ARCHIVED,

            isActive:
              false,
          },

          include: {
            event: {
              select: {
                id: true,
                title: true,
                slug: true,
                startsAt: true,
                endsAt: true,
                currency: true,
                status: true,
              },
            },

            campaign: {
              select: {
                id: true,
                name: true,
                eventId: true,
                status: true,
                channel: true,
              },
            },

            _count: {
              select: {
                usages: true,
                attributions: true,
              },
            },
          },
        });

      return NextResponse.json(
        {
          ok: true,

          message:
            "Ce code promo possède déjà des données liées. Il a été archivé au lieu d’être supprimé.",

          data: {
            action:
              "archived",

            promoCode: {
              ...serializePromoCode(
                archivedPromoCode,
              ),

              event: {
                ...archivedPromoCode.event,

                startsAt:
                  archivedPromoCode.event.startsAt.toISOString(),

                endsAt:
                  archivedPromoCode.event.endsAt
                    ?.toISOString() ??
                  null,
              },

              campaign:
                archivedPromoCode.campaign,
            },
          },
        },
        {
          status: 200,

          headers: {
            "Cache-Control":
              "private, no-store, max-age=0",
          },
        },
      );
    }

    await prisma.promoCode.delete({
      where: {
        id:
          promoCode.id,
      },
    });

    return NextResponse.json(
      {
        ok: true,

        message:
          "Le code promo a été supprimé définitivement.",

        data: {
          action:
            "deleted",

          promoCodeId:
            promoCode.id,
        },
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    return handleRouteError(
      error,
    );
  }
}