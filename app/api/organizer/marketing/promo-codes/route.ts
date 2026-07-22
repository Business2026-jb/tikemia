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
  createPromoCodeSchema,
  promoCodeQuerySchema,
} from "@/lib/organizer/marketing/marketing-schemas";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE_FALLBACK_NAME = "tikemia_session";

type AuthenticatedOrganizer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

class PromoCodesRouteError extends Error {
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

    this.name = "PromoCodesRouteError";
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

function getSearchParamsObject(
  request: NextRequest,
): Record<string, string> {
  const output: Record<string, string> = {};

  request.nextUrl.searchParams.forEach(
    (value, key) => {
      output[key] = value;
    },
  );

  return output;
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

async function getAuthenticatedOrganizer(): Promise<AuthenticatedOrganizer> {
  const cookieStore = await cookies();

  const cookieName =
    normalizeText(
      process.env.SESSION_COOKIE_NAME,
    ) ||
    SESSION_COOKIE_FALLBACK_NAME;

  const rawSessionToken =
    cookieStore.get(cookieName)?.value;

  if (!rawSessionToken) {
    throw new PromoCodesRouteError({
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
    throw new PromoCodesRouteError({
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
          "[PROMO_CODES_EXPIRED_SESSION_DELETE_ERROR]",
          error,
        );
      });

    throw new PromoCodesRouteError({
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
    throw new PromoCodesRouteError({
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

function buildPromoCodeWhere({
  organizerId,
  query,
}: {
  organizerId: string;
  query: ReturnType<
    typeof promoCodeQuerySchema.parse
  >;
}): Prisma.PromoCodeWhereInput {
  const andFilters:
    Prisma.PromoCodeWhereInput[] = [];

  if (query.startsAt) {
    andFilters.push({
      OR: [
        {
          startsAt: null,
        },
        {
          startsAt: {
            gte: query.startsAt,
          },
        },
      ],
    });
  }

  if (query.endsAt) {
    andFilters.push({
      OR: [
        {
          expiresAt: null,
        },
        {
          expiresAt: {
            lte: query.endsAt,
          },
        },
      ],
    });
  }

  if (!query.includeExpired) {
    andFilters.push({
      OR: [
        {
          expiresAt: null,
        },
        {
          expiresAt: {
            gte: new Date(),
          },
        },
      ],
    });
  }

  return {
    organizerId,

    ...(query.eventId
      ? {
          eventId: query.eventId,
        }
      : {}),

    ...(query.campaignId
      ? {
          campaignId:
            query.campaignId,
        }
      : {}),

    ...(query.status
      ? {
          status: query.status,
        }
      : query.includeArchived
        ? {}
        : {
            status: {
              not:
                PromoCodeStatus.ARCHIVED,
            },
          }),

    ...(query.discountType
      ? {
          discountType:
            query.discountType,
        }
      : {}),

    ...(query.search
      ? {
          OR: [
            {
              code: {
                contains:
                  query.search,
                mode:
                  "insensitive",
              },
            },
            {
              description: {
                contains:
                  query.search,
                mode:
                  "insensitive",
              },
            },
            {
              event: {
                title: {
                  contains:
                    query.search,
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
                      query.search,
                    mode:
                      "insensitive",
                  },
                },
              },
            },
          ],
        }
      : {}),

    ...(andFilters.length > 0
      ? {
          AND: andFilters,
        }
      : {}),
  };
}

function buildOrderBy({
  sortBy,
  sortDirection,
}: {
  sortBy: ReturnType<
    typeof promoCodeQuerySchema.parse
  >["sortBy"];
  sortDirection: "asc" | "desc";
}): Prisma.PromoCodeOrderByWithRelationInput[] {
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
  error: unknown,
) {
  if (
    error instanceof
    PromoCodesRouteError
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
              "Ce code promo existe déjà pour cet organisateur.",
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
              "RESOURCE_NOT_FOUND",
            message:
              "La ressource demandée est introuvable.",
          },
        },
        {
          status: 404,
        },
      );
    }
  }

  console.error(
    "[ORGANIZER_MARKETING_PROMO_CODES_ROUTE_ERROR]",
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
  request: NextRequest,
) {
  try {
    const organizer =
      await getAuthenticatedOrganizer();

    const queryResult =
      promoCodeQuerySchema.safeParse(
        getSearchParamsObject(
          request,
        ),
      );

    if (!queryResult.success) {
      throw new PromoCodesRouteError({
        status: 400,
        code: "INVALID_QUERY",
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
      buildPromoCodeWhere({
        organizerId:
          organizer.id,
        query,
      });

    const skip =
      (query.page - 1) *
      query.pageSize;

    const [
      promoCodes,
      total,
    ] =
      await prisma.$transaction([
        prisma.promoCode.findMany({
          where,

          skip,

          take:
            query.pageSize,

          orderBy:
            buildOrderBy({
              sortBy:
                query.sortBy,
              sortDirection:
                query.sortDirection,
            }),

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
        }),

        prisma.promoCode.count({
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
        ok: true,

        data: {
          promoCodes:
            promoCodes.map(
              (promoCode) => ({
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
              query.page > 1,

            hasNextPage:
              query.page <
              pageCount,
          },

          filters: {
            search:
              query.search ?? "",

            eventId:
              query.eventId ?? null,

            campaignId:
              query.campaignId ?? null,

            status:
              query.status ?? null,

            discountType:
              query.discountType ?? null,

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

            includeExpired:
              query.includeExpired,
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

export async function POST(
  request: NextRequest,
) {
  try {
    const organizer =
      await getAuthenticatedOrganizer();

    let body: unknown;

    try {
      body =
        await request.json();
    } catch {
      throw new PromoCodesRouteError({
        status: 400,
        code: "INVALID_JSON",
        message:
          "Le corps de la requête doit être un JSON valide.",
      });
    }

    const validationResult =
      createPromoCodeSchema.safeParse(
        body,
      );

    if (!validationResult.success) {
      throw new PromoCodesRouteError({
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

    const event =
      await prisma.event.findFirst({
        where: {
          id:
            input.eventId,

          organizerId:
            organizer.id,
        },

        select: {
          id: true,
          title: true,
          slug: true,
          currency: true,
          startsAt: true,
          endsAt: true,
          status: true,
        },
      });

    if (!event) {
      throw new PromoCodesRouteError({
        status: 404,
        code: "EVENT_NOT_FOUND",
        message:
          "L’événement sélectionné est introuvable ou ne vous appartient pas.",
      });
    }

    let campaign:
      | {
          id: string;
          name: string;
          eventId: string;
          status: string;
          channel: string;
        }
      | null = null;

    if (input.campaignId) {
      campaign =
        await prisma.marketingCampaign.findFirst({
          where: {
            id:
              input.campaignId,

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

      if (!campaign) {
        throw new PromoCodesRouteError({
          status: 404,
          code:
            "CAMPAIGN_NOT_FOUND",
          message:
            "La campagne sélectionnée est introuvable ou ne vous appartient pas.",
        });
      }

      if (
        campaign.eventId !==
        event.id
      ) {
        throw new PromoCodesRouteError({
          status: 422,
          code:
            "CAMPAIGN_EVENT_MISMATCH",
          message:
            "La campagne sélectionnée n’est pas liée à cet événement.",
        });
      }
    }

    const existingPromoCode =
      await prisma.promoCode.findFirst({
        where: {
          organizerId:
            organizer.id,

          code:
            input.code,
        },

        select: {
          id: true,
        },
      });

    if (existingPromoCode) {
      throw new PromoCodesRouteError({
        status: 409,
        code:
          "PROMO_CODE_ALREADY_EXISTS",
        message:
          "Ce code promo existe déjà dans votre espace organisateur.",
      });
    }

    const createdPromoCode =
      await prisma.promoCode.create({
        data: {
          organizerId:
            organizer.id,

          eventId:
            event.id,

          campaignId:
            campaign?.id ?? null,

          code:
            input.code,

          description:
            input.description ?? null,

          discountType:
            input.discountType,

          discountValue:
            input.discountValue,

          minimumOrderAmount:
            input.minimumOrderAmount ??
            null,

          maximumDiscount:
            input.maximumDiscount ??
            null,

          maximumUses:
            input.maximumUses ?? null,

          usesPerCustomer:
            input.usesPerCustomer ??
            null,

          currentUses: 0,

          startsAt:
            input.startsAt ?? null,

          expiresAt:
            input.expiresAt ?? null,

          status:
            input.status,

          isActive:
            input.isActive,
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
          "Le code promo a été créé avec succès.",

        data: {
          promoCode: {
            ...serializePromoCode(
              createdPromoCode,
            ),

            event: {
              ...createdPromoCode.event,

              startsAt:
                createdPromoCode.event.startsAt.toISOString(),

              endsAt:
                createdPromoCode.event.endsAt
                  ?.toISOString() ??
                null,
            },

            campaign:
              createdPromoCode.campaign,
          },
        },
      },
      {
        status: 201,

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