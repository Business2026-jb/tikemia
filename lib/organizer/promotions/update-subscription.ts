import "server-only";

import {
  EventBoostStatus,
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
} from "@prisma/client";

import {
  activateOrganizerSubscriptionSchema,
  cancelOrganizerSubscriptionSchema,
  createOrganizerSubscriptionSchema,
  formatPromotionValidationErrors,
  renewOrganizerSubscriptionSchema,
  updateAutoRenewSchema,
  type ActivateOrganizerSubscriptionInput,
  type CancelOrganizerSubscriptionInput,
  type CreateOrganizerSubscriptionInput,
  type RenewOrganizerSubscriptionInput,
  type UpdateAutoRenewInput,
} from "@/lib/organizer/promotions/promotion-schemas";
import { prisma } from "@/lib/prisma";

const ACTIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] =
  [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.PAST_DUE,
    SubscriptionStatus.PAUSED,
  ];

const REUSABLE_PENDING_SUBSCRIPTION_MAX_AGE_MS =
  30 * 60 * 1000;

export type UpdatedOrganizerSubscription = {
  id: string;
  organizerId: string;
  planId: string;
  status: SubscriptionStatus;
  startsAt: string | null;
  endsAt: string | null;
  trialEndsAt: string | null;
  autoRenew: boolean;
  canceledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;

  plan: {
    id: string;
    code: string;
    name: string;
    price: number;
    currency: string;
    durationDays: number;
    maxBoostedEvents: number;
    priorityScore: number;
  };
};

export type UpdateSubscriptionResult = {
  message: string;
  subscription: UpdatedOrganizerSubscription;
  redirectTo?: string;
  blueBadgeGranted?: boolean;
};

export class UpdateSubscriptionError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: Record<string, string[]>;
  readonly redirectTo?: string;

  constructor({
    code,
    message,
    status = 400,
    fields,
    redirectTo,
  }: {
    code: string;
    message: string;
    status?: number;
    fields?: Record<string, string[]>;
    redirectTo?: string;
  }) {
    super(message);

    this.name = "UpdateSubscriptionError";
    this.code = code;
    this.status = status;
    this.fields = fields;
    this.redirectTo = redirectTo;
  }
}

type SubscriptionWithPlan = Prisma.OrganizerSubscriptionGetPayload<{
  include: {
    plan: {
      select: {
        id: true;
        code: true;
        name: true;
        price: true;
        currency: true;
        durationDays: true;
        maxBoostedEvents: true;
        priorityScore: true;
      };
    };
  };
}>;

function toIsoString(
  value: Date | null | undefined,
): string | null {
  return value ? value.toISOString() : null;
}

function decimalToNumber(
  value: Prisma.Decimal | number | string,
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSubscription(
  subscription: SubscriptionWithPlan,
): UpdatedOrganizerSubscription {
  return {
    id: subscription.id,
    organizerId: subscription.organizerId,
    planId: subscription.planId,
    status: subscription.status,
    startsAt: toIsoString(subscription.startsAt),
    endsAt: toIsoString(subscription.endsAt),
    trialEndsAt: toIsoString(subscription.trialEndsAt),
    autoRenew: subscription.autoRenew,
    canceledAt: toIsoString(subscription.canceledAt),
    cancellationReason:
      subscription.cancellationReason,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),

    plan: {
      id: subscription.plan.id,
      code: subscription.plan.code,
      name: subscription.plan.name,
      price: decimalToNumber(subscription.plan.price),
      currency: subscription.plan.currency
        .trim()
        .toUpperCase(),
      durationDays: subscription.plan.durationDays,
      maxBoostedEvents:
        subscription.plan.maxBoostedEvents,
      priorityScore: subscription.plan.priorityScore,
    },
  };
}

function calculateSubscriptionEndDate({
  startsAt,
  durationDays,
}: {
  startsAt: Date;
  durationDays: number;
}): Date {
  const endsAt = new Date(startsAt);

  endsAt.setUTCDate(
    endsAt.getUTCDate() + Math.max(durationDays, 1),
  );

  return endsAt;
}

async function getAvailablePlan(
  tx: Prisma.TransactionClient,
  planId: string,
) {
  const plan = await tx.subscriptionPlan.findUnique({
    where: {
      id: planId,
    },
    select: {
      id: true,
      code: true,
      name: true,
      price: true,
      currency: true,
      durationDays: true,
      maxBoostedEvents: true,
      priorityScore: true,
      isActive: true,
      isPublic: true,
    },
  });

  if (!plan) {
    throw new UpdateSubscriptionError({
      code: "SUBSCRIPTION_PLAN_NOT_FOUND",
      status: 404,
      message:
        "La formule Premium demandée est introuvable.",
    });
  }

  if (!plan.isActive || !plan.isPublic) {
    throw new UpdateSubscriptionError({
      code: "SUBSCRIPTION_PLAN_UNAVAILABLE",
      status: 409,
      message:
        "Cette formule Premium n’est plus disponible.",
    });
  }

  return plan;
}

async function getOwnedSubscription(
  tx: Prisma.TransactionClient,
  {
    organizerId,
    subscriptionId,
  }: {
    organizerId: string;
    subscriptionId: string;
  },
) {
  const subscription =
    await tx.organizerSubscription.findFirst({
      where: {
        id: subscriptionId,
        organizerId,
      },
      include: {
        plan: {
          select: {
            id: true,
            code: true,
            name: true,
            price: true,
            currency: true,
            durationDays: true,
            maxBoostedEvents: true,
            priorityScore: true,
          },
        },
      },
    });

  if (!subscription) {
    throw new UpdateSubscriptionError({
      code: "SUBSCRIPTION_NOT_FOUND",
      status: 404,
      message:
        "L’abonnement Premium demandé est introuvable.",
    });
  }

  return subscription;
}

async function getLatestOrganizerSubscription(
  tx: Prisma.TransactionClient,
  organizerId: string,
) {
  return tx.organizerSubscription.findFirst({
    where: {
      organizerId,
    },
    orderBy: [
      {
        createdAt: "desc",
      },
      {
        id: "desc",
      },
    ],
    include: {
      plan: {
        select: {
          id: true,
          code: true,
          name: true,
          price: true,
          currency: true,
          durationDays: true,
          maxBoostedEvents: true,
          priorityScore: true,
        },
      },
    },
  });
}

async function expireOutdatedSubscriptions(
  tx: Prisma.TransactionClient,
  organizerId: string,
  now: Date,
) {
  await tx.organizerSubscription.updateMany({
    where: {
      organizerId,
      status: {
        in: ACTIVE_SUBSCRIPTION_STATUSES,
      },
      endsAt: {
        lte: now,
      },
    },
    data: {
      status: SubscriptionStatus.EXPIRED,
      autoRenew: false,
    },
  });

  await tx.eventBoost.updateMany({
    where: {
      organizerId,
      status: {
        in: [
          EventBoostStatus.SCHEDULED,
          EventBoostStatus.ACTIVE,
          EventBoostStatus.PAUSED,
        ],
      },
      endsAt: {
        lte: now,
      },
    },
    data: {
      status: EventBoostStatus.EXPIRED,
    },
  });
}

export async function createOrganizerSubscription({
  organizerId,
  input,
}: {
  organizerId: string;
  input: CreateOrganizerSubscriptionInput;
}): Promise<UpdateSubscriptionResult> {
  const parsed =
    createOrganizerSubscriptionSchema.safeParse(input);

  if (!parsed.success) {
    throw new UpdateSubscriptionError({
      code: "INVALID_SUBSCRIPTION_DATA",
      status: 400,
      message:
        "Les informations de souscription sont invalides.",
      fields: formatPromotionValidationErrors(
        parsed.error,
      ),
    });
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const now = new Date();

        await expireOutdatedSubscriptions(
          tx,
          organizerId,
          now,
        );

        const plan = await getAvailablePlan(
          tx,
          parsed.data.planId,
        );

        const existingActiveSubscription =
          await tx.organizerSubscription.findFirst({
            where: {
              organizerId,
              status: {
                in: ACTIVE_SUBSCRIPTION_STATUSES,
              },
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
            select: {
              id: true,
            },
          });

        if (existingActiveSubscription) {
          throw new UpdateSubscriptionError({
            code: "ACTIVE_SUBSCRIPTION_EXISTS",
            status: 409,
            message:
              "Vous possédez déjà un abonnement Premium actif. Utilisez le renouvellement ou le changement de formule.",
          });
        }

        const reusablePendingSubscription =
          await tx.organizerSubscription.findFirst({
            where: {
              organizerId,
              planId: plan.id,
              status: SubscriptionStatus.PENDING,
              createdAt: {
                gte: new Date(
                  now.getTime() -
                    REUSABLE_PENDING_SUBSCRIPTION_MAX_AGE_MS,
                ),
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            include: {
              plan: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  price: true,
                  currency: true,
                  durationDays: true,
                  maxBoostedEvents: true,
                  priorityScore: true,
                },
              },
            },
          });

        if (reusablePendingSubscription) {
          const updatedPendingSubscription =
            await tx.organizerSubscription.update({
              where: {
                id: reusablePendingSubscription.id,
              },
              data: {
                autoRenew: parsed.data.autoRenew,
                cancellationReason: null,
                canceledAt: null,
              },
              include: {
                plan: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    price: true,
                    currency: true,
                    durationDays: true,
                    maxBoostedEvents: true,
                    priorityScore: true,
                  },
                },
              },
            });

          return {
            message:
              "Votre demande de souscription existante a été récupérée.",
            subscription: normalizeSubscription(
              updatedPendingSubscription,
            ),
            redirectTo: `/organizer/promotions/checkout?subscriptionId=${encodeURIComponent(
              updatedPendingSubscription.id,
            )}`,
          };
        }

        const subscription =
          await tx.organizerSubscription.create({
            data: {
              organizerId,
              planId: plan.id,
              status: SubscriptionStatus.PENDING,
              autoRenew: parsed.data.autoRenew,
            },
            include: {
              plan: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  price: true,
                  currency: true,
                  durationDays: true,
                  maxBoostedEvents: true,
                  priorityScore: true,
                },
              },
            },
          });

        return {
          message:
            "Votre demande de souscription Premium a été créée.",
          subscription:
            normalizeSubscription(subscription),
          redirectTo: `/organizer/promotions/checkout?subscriptionId=${encodeURIComponent(
            subscription.id,
          )}`,
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error) {
    if (error instanceof UpdateSubscriptionError) {
      throw error;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new UpdateSubscriptionError({
        code: "SUBSCRIPTION_ALREADY_EXISTS",
        status: 409,
        message:
          "Une demande de souscription identique existe déjà.",
      });
    }

    console.error(
      "[CREATE_ORGANIZER_SUBSCRIPTION_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV === "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    throw new UpdateSubscriptionError({
      code: "CREATE_SUBSCRIPTION_FAILED",
      status: 500,
      message:
        "Impossible de créer l’abonnement Premium pour le moment.",
    });
  }
}

export async function activateOrganizerSubscription({
  organizerId,
  input,
}: {
  organizerId: string;
  input: ActivateOrganizerSubscriptionInput;
}): Promise<UpdateSubscriptionResult> {
  const parsed =
    activateOrganizerSubscriptionSchema.safeParse(input);

  if (!parsed.success) {
    throw new UpdateSubscriptionError({
      code: "INVALID_ACTIVATION_DATA",
      status: 400,
      message:
        "Les informations d’activation sont invalides.",
      fields: formatPromotionValidationErrors(
        parsed.error,
      ),
    });
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const now = parsed.data.paidAt;

        await expireOutdatedSubscriptions(
          tx,
          organizerId,
          now,
        );

        const subscription =
          await getOwnedSubscription(tx, {
            organizerId,
            subscriptionId:
              parsed.data.subscriptionId,
          });

        const payment =
          await tx.subscriptionPayment.findFirst({
            where: {
              id: parsed.data.paymentId,
              organizerId,
              subscriptionId: subscription.id,
            },
          });

        if (!payment) {
          throw new UpdateSubscriptionError({
            code: "SUBSCRIPTION_PAYMENT_NOT_FOUND",
            status: 404,
            message:
              "Le paiement associé à cet abonnement est introuvable.",
          });
        }

        if (
          payment.status !== PaymentStatus.SUCCESS
        ) {
          throw new UpdateSubscriptionError({
            code: "PAYMENT_NOT_CONFIRMED",
            status: 409,
            message:
              "Le paiement doit être confirmé avant l’activation de l’abonnement.",
          });
        }

        if (
          subscription.status ===
            SubscriptionStatus.ACTIVE &&
          subscription.endsAt &&
          subscription.endsAt.getTime() > now.getTime()
        ) {
          return {
            message:
              "L’abonnement Premium est déjà actif.",
            subscription:
              normalizeSubscription(subscription),
            blueBadgeGranted: false,
          };
        }

        const startsAt = now;
        const endsAt =
          calculateSubscriptionEndDate({
            startsAt,
            durationDays:
              subscription.plan.durationDays,
          });

        await tx.organizerSubscription.updateMany({
          where: {
            organizerId,
            id: {
              not: subscription.id,
            },
            status: {
              in: ACTIVE_SUBSCRIPTION_STATUSES,
            },
          },
          data: {
            status: SubscriptionStatus.CANCELLED,
            autoRenew: false,
            canceledAt: now,
            cancellationReason:
              "Remplacé par un nouvel abonnement Premium actif.",
          },
        });

        const organizerProfile =
          await tx.organizerProfile.findUnique({
            where: {
              userId: organizerId,
            },
            select: {
              hasBlueBadge: true,
              blueBadgeGrantedAt: true,
              firstSubscribedAt: true,
            },
          });

        if (!organizerProfile) {
          throw new UpdateSubscriptionError({
            code: "ORGANIZER_PROFILE_NOT_FOUND",
            status: 404,
            message:
              "Le profil organisateur est introuvable.",
          });
        }

        const shouldGrantBlueBadge =
          !organizerProfile.hasBlueBadge;

        if (
          parsed.data.providerReference &&
          payment.providerReference !==
            parsed.data.providerReference
        ) {
          await tx.subscriptionPayment.update({
            where: {
              id: payment.id,
            },
            data: {
              providerReference:
                parsed.data.providerReference,
              paidAt: now,
              metadata:
                parsed.data.metadata === undefined
                  ? undefined
                  : (parsed.data.metadata as Prisma.InputJsonValue),
            },
          });
        }

        await tx.organizerProfile.update({
          where: {
            userId: organizerId,
          },
          data: {
            hasBlueBadge: true,
            blueBadgeGrantedAt:
              organizerProfile.blueBadgeGrantedAt ??
              now,
            firstSubscribedAt:
              organizerProfile.firstSubscribedAt ??
              now,
          },
        });

        const activatedSubscription =
          await tx.organizerSubscription.update({
            where: {
              id: subscription.id,
            },
            data: {
              status: SubscriptionStatus.ACTIVE,
              startsAt,
              endsAt,
              canceledAt: null,
              cancellationReason: null,
            },
            include: {
              plan: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  price: true,
                  currency: true,
                  durationDays: true,
                  maxBoostedEvents: true,
                  priorityScore: true,
                },
              },
            },
          });

        return {
          message:
            "Votre abonnement Premium est maintenant actif.",
          subscription:
            normalizeSubscription(
              activatedSubscription,
            ),
          blueBadgeGranted:
            shouldGrantBlueBadge,
          redirectTo:
            "/organizer/promotions",
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error) {
    if (error instanceof UpdateSubscriptionError) {
      throw error;
    }

    console.error(
      "[ACTIVATE_ORGANIZER_SUBSCRIPTION_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV === "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    throw new UpdateSubscriptionError({
      code: "ACTIVATE_SUBSCRIPTION_FAILED",
      status: 500,
      message:
        "Impossible d’activer l’abonnement Premium pour le moment.",
    });
  }
}

export async function cancelOrganizerSubscription({
  organizerId,
  input,
}: {
  organizerId: string;
  input: CancelOrganizerSubscriptionInput;
}): Promise<UpdateSubscriptionResult> {
  const parsed =
    cancelOrganizerSubscriptionSchema.safeParse(input);

  if (!parsed.success) {
    throw new UpdateSubscriptionError({
      code: "INVALID_CANCELLATION_DATA",
      status: 400,
      message:
        "Les informations de résiliation sont invalides.",
      fields: formatPromotionValidationErrors(
        parsed.error,
      ),
    });
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const now = new Date();

        const subscription =
          parsed.data.subscriptionId
            ? await getOwnedSubscription(tx, {
                organizerId,
                subscriptionId:
                  parsed.data.subscriptionId,
              })
            : await getLatestOrganizerSubscription(
                tx,
                organizerId,
              );

        if (!subscription) {
          throw new UpdateSubscriptionError({
            code: "SUBSCRIPTION_NOT_FOUND",
            status: 404,
            message:
              "Aucun abonnement Premium n’a été trouvé.",
          });
        }

        if (
          subscription.status ===
          SubscriptionStatus.CANCELLED
        ) {
          return {
            message:
              "Cet abonnement est déjà résilié.",
            subscription:
              normalizeSubscription(subscription),
          };
        }

        if (
          parsed.data.cancelAtPeriodEnd &&
          subscription.status ===
            SubscriptionStatus.ACTIVE &&
          subscription.endsAt &&
          subscription.endsAt.getTime() >
            now.getTime()
        ) {
          const scheduledCancellation =
            await tx.organizerSubscription.update({
              where: {
                id: subscription.id,
              },
              data: {
                autoRenew: false,
                cancellationReason:
                  parsed.data.reason ??
                  "Résiliation programmée à la fin de la période.",
              },
              include: {
                plan: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    price: true,
                    currency: true,
                    durationDays: true,
                    maxBoostedEvents: true,
                    priorityScore: true,
                  },
                },
              },
            });

          return {
            message:
              "Le renouvellement automatique est désactivé. L’abonnement restera actif jusqu’à sa date d’expiration.",
            subscription:
              normalizeSubscription(
                scheduledCancellation,
              ),
          };
        }

        await tx.eventBoost.updateMany({
          where: {
            organizerId,
            subscriptionId: subscription.id,
            status: {
              in: [
                EventBoostStatus.SCHEDULED,
                EventBoostStatus.ACTIVE,
                EventBoostStatus.PAUSED,
              ],
            },
          },
          data: {
            status: EventBoostStatus.CANCELLED,
            canceledAt: now,
            cancellationReason:
              parsed.data.reason ??
              "Abonnement Premium résilié.",
          },
        });

        const cancelledSubscription =
          await tx.organizerSubscription.update({
            where: {
              id: subscription.id,
            },
            data: {
              status: SubscriptionStatus.CANCELLED,
              autoRenew: false,
              canceledAt: now,
              cancellationReason:
                parsed.data.reason ??
                "Abonnement résilié par l’organisateur.",
            },
            include: {
              plan: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  price: true,
                  currency: true,
                  durationDays: true,
                  maxBoostedEvents: true,
                  priorityScore: true,
                },
              },
            },
          });

        return {
          message:
            "L’abonnement Premium a été résilié.",
          subscription:
            normalizeSubscription(
              cancelledSubscription,
            ),
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error) {
    if (error instanceof UpdateSubscriptionError) {
      throw error;
    }

    console.error(
      "[CANCEL_ORGANIZER_SUBSCRIPTION_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV === "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    throw new UpdateSubscriptionError({
      code: "CANCEL_SUBSCRIPTION_FAILED",
      status: 500,
      message:
        "Impossible de résilier l’abonnement Premium pour le moment.",
    });
  }
}

export async function renewOrganizerSubscription({
  organizerId,
  input,
}: {
  organizerId: string;
  input: RenewOrganizerSubscriptionInput;
}): Promise<UpdateSubscriptionResult> {
  const parsed =
    renewOrganizerSubscriptionSchema.safeParse(input);

  if (!parsed.success) {
    throw new UpdateSubscriptionError({
      code: "INVALID_RENEWAL_DATA",
      status: 400,
      message:
        "Les informations de renouvellement sont invalides.",
      fields: formatPromotionValidationErrors(
        parsed.error,
      ),
    });
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const currentSubscription =
          parsed.data.subscriptionId
            ? await getOwnedSubscription(tx, {
                organizerId,
                subscriptionId:
                  parsed.data.subscriptionId,
              })
            : await getLatestOrganizerSubscription(
                tx,
                organizerId,
              );

        if (!currentSubscription) {
          throw new UpdateSubscriptionError({
            code: "SUBSCRIPTION_NOT_FOUND",
            status: 404,
            message:
              "Aucun abonnement Premium à renouveler n’a été trouvé.",
          });
        }

        const targetPlanId =
          parsed.data.planId ??
          currentSubscription.planId;

        const targetPlan =
          await getAvailablePlan(
            tx,
            targetPlanId,
          );

        const pendingRenewal =
          await tx.organizerSubscription.findFirst({
            where: {
              organizerId,
              planId: targetPlan.id,
              status: SubscriptionStatus.PENDING,
              id: {
                not: currentSubscription.id,
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            include: {
              plan: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  price: true,
                  currency: true,
                  durationDays: true,
                  maxBoostedEvents: true,
                  priorityScore: true,
                },
              },
            },
          });

        if (pendingRenewal) {
          return {
            message:
              "Une demande de renouvellement est déjà en attente de paiement.",
            subscription:
              normalizeSubscription(
                pendingRenewal,
              ),
            redirectTo: `/organizer/promotions/checkout?subscriptionId=${encodeURIComponent(
              pendingRenewal.id,
            )}&mode=renew`,
          };
        }

        const renewedSubscription =
          await tx.organizerSubscription.create({
            data: {
              organizerId,
              planId: targetPlan.id,
              status: SubscriptionStatus.PENDING,
              autoRenew:
                parsed.data.autoRenew ??
                currentSubscription.autoRenew,
            },
            include: {
              plan: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  price: true,
                  currency: true,
                  durationDays: true,
                  maxBoostedEvents: true,
                  priorityScore: true,
                },
              },
            },
          });

        return {
          message:
            "La demande de renouvellement Premium a été créée.",
          subscription:
            normalizeSubscription(
              renewedSubscription,
            ),
          redirectTo: `/organizer/promotions/checkout?subscriptionId=${encodeURIComponent(
            renewedSubscription.id,
          )}&mode=renew`,
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error) {
    if (error instanceof UpdateSubscriptionError) {
      throw error;
    }

    console.error(
      "[RENEW_ORGANIZER_SUBSCRIPTION_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV === "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    throw new UpdateSubscriptionError({
      code: "RENEW_SUBSCRIPTION_FAILED",
      status: 500,
      message:
        "Impossible de renouveler l’abonnement Premium pour le moment.",
    });
  }
}

export async function updateOrganizerSubscriptionAutoRenew({
  organizerId,
  input,
}: {
  organizerId: string;
  input: UpdateAutoRenewInput;
}): Promise<UpdateSubscriptionResult> {
  const parsed =
    updateAutoRenewSchema.safeParse(input);

  if (!parsed.success) {
    throw new UpdateSubscriptionError({
      code: "INVALID_AUTO_RENEW_DATA",
      status: 400,
      message:
        "Les informations de renouvellement automatique sont invalides.",
      fields: formatPromotionValidationErrors(
        parsed.error,
      ),
    });
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const subscription =
          parsed.data.subscriptionId
            ? await getOwnedSubscription(tx, {
                organizerId,
                subscriptionId:
                  parsed.data.subscriptionId,
              })
            : await getLatestOrganizerSubscription(
                tx,
                organizerId,
              );

        if (!subscription) {
          throw new UpdateSubscriptionError({
            code: "SUBSCRIPTION_NOT_FOUND",
            status: 404,
            message:
              "Aucun abonnement Premium n’a été trouvé.",
          });
        }

        if (
          subscription.status ===
            SubscriptionStatus.CANCELLED ||
          subscription.status ===
            SubscriptionStatus.EXPIRED
        ) {
          throw new UpdateSubscriptionError({
            code: "SUBSCRIPTION_NOT_RENEWABLE",
            status: 409,
            message:
              "Le renouvellement automatique ne peut pas être modifié pour un abonnement résilié ou expiré.",
          });
        }

        const updatedSubscription =
          await tx.organizerSubscription.update({
            where: {
              id: subscription.id,
            },
            data: {
              autoRenew:
                parsed.data.autoRenew,
              ...(parsed.data.autoRenew
                ? {
                    cancellationReason: null,
                  }
                : {}),
            },
            include: {
              plan: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  price: true,
                  currency: true,
                  durationDays: true,
                  maxBoostedEvents: true,
                  priorityScore: true,
                },
              },
            },
          });

        return {
          message:
            parsed.data.autoRenew
              ? "Le renouvellement automatique est activé."
              : "Le renouvellement automatique est désactivé.",
          subscription:
            normalizeSubscription(
              updatedSubscription,
            ),
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error) {
    if (error instanceof UpdateSubscriptionError) {
      throw error;
    }

    console.error(
      "[UPDATE_ORGANIZER_SUBSCRIPTION_AUTO_RENEW_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV === "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    throw new UpdateSubscriptionError({
      code: "UPDATE_AUTO_RENEW_FAILED",
      status: 500,
      message:
        "Impossible de modifier le renouvellement automatique pour le moment.",
    });
  }
}