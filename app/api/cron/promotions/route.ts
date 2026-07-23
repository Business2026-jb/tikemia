import {
  EventBoostStatus,
  EventStatus,
  Prisma,
  SubscriptionStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const ACTIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.PAUSED,
];

const RUNNING_BOOST_STATUSES: EventBoostStatus[] = [
  EventBoostStatus.SCHEDULED,
  EventBoostStatus.ACTIVE,
  EventBoostStatus.PAUSED,
];

type PromotionsCronSuccessResponse = {
  success: true;
  message: string;
  data: {
    executedAt: string;
    durationMs: number;
    subscriptions: {
      expired: number;
    };
    promotions: {
      activated: number;
      expired: number;
      expiredBecauseOfSubscription: number;
      expiredBecauseOfEvent: number;
    };
  };
};

type PromotionsCronErrorResponse = {
  success: false;
  code: string;
  message: string;
};

type PromotionsCronResponse =
  | PromotionsCronSuccessResponse
  | PromotionsCronErrorResponse;

type PromotionsCronResult = {
  subscriptionsExpired: number;
  promotionsActivated: number;
  promotionsExpired: number;
  promotionsExpiredBecauseOfSubscription: number;
  promotionsExpiredBecauseOfEvent: number;
};

function noStoreHeaders(): HeadersInit {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff",
  };
}

function jsonResponse(
  body: PromotionsCronResponse,
  status: number,
): NextResponse<PromotionsCronResponse> {
  return NextResponse.json(body, {
    status,
    headers: noStoreHeaders(),
  });
}

function getCronSecret(): string | null {
  const secret =
    process.env.CRON_SECRET?.trim();

  return secret || null;
}

function getBearerToken(
  request: Request,
): string | null {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, token] =
    authorization.trim().split(/\s+/, 2);

  if (
    scheme?.toLowerCase() !== "bearer" ||
    !token
  ) {
    return null;
  }

  return token.trim() || null;
}

function getProvidedSecret(
  request: Request,
): string | null {
  return (
    getBearerToken(request) ??
    request.headers
      .get("x-cron-secret")
      ?.trim() ??
    null
  );
}

function constantTimeEquals(
  first: string,
  second: string,
): boolean {
  if (first.length !== second.length) {
    return false;
  }

  let difference = 0;

  for (
    let index = 0;
    index < first.length;
    index += 1
  ) {
    difference |=
      first.charCodeAt(index) ^
      second.charCodeAt(index);
  }

  return difference === 0;
}

function authorizeCronRequest(
  request: Request,
):
  | {
      authorized: true;
    }
  | {
      authorized: false;
      response: NextResponse<PromotionsCronResponse>;
    } {
  const expectedSecret =
    getCronSecret();

  if (!expectedSecret) {
    console.error(
      "[PROMOTIONS_CRON_SECRET_MISSING]",
      "La variable CRON_SECRET n’est pas configurée.",
    );

    return {
      authorized: false,
      response: jsonResponse(
        {
          success: false,
          code:
            "CRON_SECRET_NOT_CONFIGURED",
          message:
            "Le service automatique des promotions n’est pas configuré.",
        },
        503,
      ),
    };
  }

  const providedSecret =
    getProvidedSecret(request);

  if (
    !providedSecret ||
    !constantTimeEquals(
      providedSecret,
      expectedSecret,
    )
  ) {
    return {
      authorized: false,
      response: jsonResponse(
        {
          success: false,
          code: "UNAUTHORIZED",
          message:
            "Vous n’êtes pas autorisé à exécuter cette tâche.",
        },
        401,
      ),
    };
  }

  return {
    authorized: true,
  };
}

async function runPromotionsMaintenance(
  now: Date,
): Promise<PromotionsCronResult> {
  return prisma.$transaction(
    async (tx) => {
      /*
       * 1. Expiration des abonnements arrivés à terme.
       *
       * Le badge bleu de l’organisateur n’est jamais retiré :
       * il reste définitivement acquis après le premier paiement confirmé.
       */
      const expiredSubscriptions =
        await tx.organizerSubscription.updateMany({
          where: {
            status: {
              in: ACTIVE_SUBSCRIPTION_STATUSES,
            },
            endsAt: {
              not: null,
              lte: now,
            },
          },
          data: {
            status:
              SubscriptionStatus.EXPIRED,
            autoRenew: false,
          },
        });

      /*
       * 2. Expiration des promotions dont la propre période est terminée.
       */
      const expiredPromotions =
        await tx.eventBoost.updateMany({
          where: {
            status: {
              in: RUNNING_BOOST_STATUSES,
            },
            endsAt: {
              lte: now,
            },
          },
          data: {
            status:
              EventBoostStatus.EXPIRED,
          },
        });

      /*
       * 3. Expiration des promotions rattachées à un abonnement
       * résilié ou expiré, même si leur date de fin n’est pas encore passée.
       */
      const expiredBecauseOfSubscription =
        await tx.eventBoost.updateMany({
          where: {
            status: {
              in: RUNNING_BOOST_STATUSES,
            },
            subscription: {
              is: {
                status: {
                  in: [
                    SubscriptionStatus.CANCELLED,
                    SubscriptionStatus.EXPIRED,
                  ],
                },
              },
            },
          },
          data: {
            status:
              EventBoostStatus.EXPIRED,
          },
        });

      /*
       * 4. Expiration des promotions dont l’événement a été annulé,
       * terminé, archivé ou n’est plus publié.
       */
      const expiredBecauseOfEvent =
        await tx.eventBoost.updateMany({
          where: {
            status: {
              in: RUNNING_BOOST_STATUSES,
            },
            event: {
              is: {
                OR: [
                  {
                    status: {
                      in: [
                        EventStatus.CANCELLED,
                        EventStatus.COMPLETED,
                        EventStatus.ARCHIVED,
                      ],
                    },
                  },
                  {
                    endsAt: {
                      not: null,
                      lte: now,
                    },
                  },
                ],
              },
            },
          },
          data: {
            status:
              EventBoostStatus.EXPIRED,
          },
        });

      /*
       * 5. Activation des promotions programmées dont la date de début
       * est atteinte, uniquement si :
       * - la date de fin n’est pas dépassée ;
       * - l’événement est toujours publié ;
       * - l’abonnement est encore actif et non expiré.
       */
      const activatedPromotions =
        await tx.eventBoost.updateMany({
          where: {
            status:
              EventBoostStatus.SCHEDULED,
            startsAt: {
              lte: now,
            },
            endsAt: {
              gt: now,
            },
            event: {
              is: {
                status:
                  EventStatus.PUBLISHED,
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
            },
            subscription: {
              is: {
                status:
                  SubscriptionStatus.ACTIVE,
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
            },
          },
          data: {
            status:
              EventBoostStatus.ACTIVE,
            activatedAt: now,
            pausedAt: null,
            canceledAt: null,
            cancellationReason: null,
          },
        });

      return {
        subscriptionsExpired:
          expiredSubscriptions.count,
        promotionsActivated:
          activatedPromotions.count,
        promotionsExpired:
          expiredPromotions.count,
        promotionsExpiredBecauseOfSubscription:
          expiredBecauseOfSubscription.count,
        promotionsExpiredBecauseOfEvent:
          expiredBecauseOfEvent.count,
      };
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel
          .Serializable,
      timeout: 50_000,
      maxWait: 10_000,
    },
  );
}

async function handleCronRequest(
  request: Request,
): Promise<
  NextResponse<PromotionsCronResponse>
> {
  const authorization =
    authorizeCronRequest(request);

  if (!authorization.authorized) {
    return authorization.response;
  }

  const startedAt = Date.now();
  const now = new Date();

  try {
    const result =
      await runPromotionsMaintenance(
        now,
      );

    const durationMs =
      Date.now() - startedAt;

    console.info(
      "[PROMOTIONS_CRON_COMPLETED]",
      {
        executedAt:
          now.toISOString(),
        durationMs,
        ...result,
      },
    );

    return jsonResponse(
      {
        success: true,
        message:
          "La maintenance automatique des promotions a été exécutée avec succès.",
        data: {
          executedAt:
            now.toISOString(),
          durationMs,
          subscriptions: {
            expired:
              result.subscriptionsExpired,
          },
          promotions: {
            activated:
              result.promotionsActivated,
            expired:
              result.promotionsExpired,
            expiredBecauseOfSubscription:
              result.promotionsExpiredBecauseOfSubscription,
            expiredBecauseOfEvent:
              result.promotionsExpiredBecauseOfEvent,
          },
        },
      },
      200,
    );
  } catch (error) {
    console.error(
      "[PROMOTIONS_CRON_ERROR]",
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

    return jsonResponse(
      {
        success: false,
        code:
          "PROMOTIONS_CRON_FAILED",
        message:
          "Impossible d’exécuter la maintenance automatique des promotions.",
      },
      500,
    );
  }
}

/*
 * Vercel Cron appelle généralement la route avec GET.
 */
export async function GET(
  request: Request,
): Promise<
  NextResponse<PromotionsCronResponse>
> {
  return handleCronRequest(request);
}

/*
 * POST est aussi accepté pour une exécution manuelle sécurisée
 * depuis un service interne ou un outil d’administration.
 */
export async function POST(
  request: Request,
): Promise<
  NextResponse<PromotionsCronResponse>
> {
  return handleCronRequest(request);
}