import "server-only";

import {
  Prisma,
  SubscriptionStatus,
} from "@prisma/client";

import {
  AdminSubscriptionError,
} from "@/lib/admin/subscriptions/admin-subscription-errors";
import {
  prisma,
} from "@/lib/prisma";

export type ChangeAdminSubscriptionPlanInput =
  Readonly<{
    subscriptionId: string;
    adminId: string;
    planId: string;
    resetPeriod?: boolean;
  }>;

function required(
  value: string,
  label: string,
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new AdminSubscriptionError({
      code:
        "ADMIN_SUBSCRIPTION_ACTION_NOT_ALLOWED",
      message:
        `${label} est obligatoire.`,
      status:
        400,
    });
  }

  return normalized;
}

export async function changeAdminSubscriptionPlan(
  input:
    ChangeAdminSubscriptionPlanInput,
) {
  const subscriptionId =
    required(
      input.subscriptionId,
      "L’identifiant de l’abonnement",
    );

  const adminId =
    required(
      input.adminId,
      "L’identifiant administrateur",
    );

  const planId =
    required(
      input.planId,
      "Le nouveau plan",
    );

  try {
    return await prisma.$transaction(
      async (
        transaction,
      ) => {
        const [
          subscription,
          newPlan,
        ] =
          await Promise.all([
            transaction.organizerSubscription.findUnique({
              where: {
                id:
                  subscriptionId,
              },

              select: {
                id:
                  true,
                status:
                  true,
                organizerId:
                  true,
                planId:
                  true,
                startsAt:
                  true,
                endsAt:
                  true,

                organizer: {
                  select: {
                    firstName:
                      true,
                    lastName:
                      true,
                    email:
                      true,
                  },
                },

                plan: {
                  select: {
                    id:
                      true,
                    code:
                      true,
                    name:
                      true,
                    price:
                      true,
                    currency:
                      true,
                    durationDays:
                      true,
                  },
                },
              },
            }),

            transaction.subscriptionPlan.findUnique({
              where: {
                id:
                  planId,
              },

              select: {
                id:
                  true,
                code:
                  true,
                name:
                  true,
                price:
                  true,
                currency:
                  true,
                durationDays:
                  true,
                billingPeriod:
                  true,
                maxBoostedEvents:
                  true,
                priorityScore:
                  true,
                features:
                  true,
                isActive:
                  true,
              },
            }),
          ]);

        if (!subscription) {
          throw new AdminSubscriptionError({
            code:
              "ADMIN_SUBSCRIPTION_NOT_FOUND",
            message:
              "Cet abonnement est introuvable.",
            status:
              404,
          });
        }

        if (
          !newPlan ||
          !newPlan.isActive
        ) {
          throw new AdminSubscriptionError({
            code:
              "ADMIN_SUBSCRIPTION_PLAN_NOT_FOUND",
            message:
              "Le nouveau plan est introuvable ou désactivé.",
            status:
              404,
          });
        }

        if (
          subscription.planId ===
          newPlan.id
        ) {
          throw new AdminSubscriptionError({
            code:
              "ADMIN_SUBSCRIPTION_ACTION_NOT_ALLOWED",
            message:
              "Cet abonnement utilise déjà ce plan.",
            status:
              409,
          });
        }

        if (
          subscription.status ===
          SubscriptionStatus.CANCELLED
        ) {
          throw new AdminSubscriptionError({
            code:
              "ADMIN_SUBSCRIPTION_ACTION_NOT_ALLOWED",
            message:
              "Le plan d’un abonnement annulé ne peut pas être modifié.",
            status:
              409,
          });
        }

        const now =
          new Date();

        const startsAt =
          input.resetPeriod
            ? now
            : subscription.startsAt;

        const endsAt =
          input.resetPeriod
            ? new Date(
                now.getTime() +
                  newPlan.durationDays *
                    24 *
                    60 *
                    60 *
                    1000,
              )
            : subscription.endsAt;

        const updated =
          await transaction.organizerSubscription.updateMany({
            where: {
              id:
                subscription.id,
              planId:
                subscription.planId,
              status:
                subscription.status,
            },

            data: {
              planId:
                newPlan.id,
              startsAt,
              endsAt,
            },
          });

        if (
          updated.count !==
          1
        ) {
          throw new AdminSubscriptionError({
            code:
              "ADMIN_SUBSCRIPTION_ACTION_NOT_ALLOWED",
            message:
              "Cet abonnement vient d’être modifié par un autre administrateur.",
            status:
              409,
          });
        }

        return {
          subscriptionId:
            subscription.id,
          organizerId:
            subscription.organizerId,
          organizerEmail:
            subscription.organizer.email,
          organizerName:
            `${subscription.organizer.firstName} ${subscription.organizer.lastName}`
              .replace(
                /\s+/g,
                " ",
              )
              .trim(),
          previousPlan: {
            ...subscription.plan,
            price:
              subscription.plan.price.toFixed(
                2,
              ),
          },
          newPlan: {
            ...newPlan,
            price:
              newPlan.price.toFixed(
                2,
              ),
          },
          status:
            subscription.status,
          startsAt,
          endsAt,
          resetPeriod:
            Boolean(
              input.resetPeriod,
            ),
          adminId,
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
        maxWait:
          5_000,
        timeout:
          15_000,
      },
    );
  } catch (error) {
    if (
      error instanceof
      AdminSubscriptionError
    ) {
      throw error;
    }

    throw new AdminSubscriptionError({
      code:
        "ADMIN_SUBSCRIPTION_ACTION_NOT_ALLOWED",
      message:
        "Impossible de changer le plan de cet abonnement.",
      status:
        500,
      cause:
        error,
    });
  }
}
