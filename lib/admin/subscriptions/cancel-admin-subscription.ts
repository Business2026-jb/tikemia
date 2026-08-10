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

export type CancelAdminSubscriptionInput =
  Readonly<{
    subscriptionId: string;
    adminId: string;
    reason: string;
    disableAutoRenew?: boolean;
  }>;

function required(
  value: string,
  label: string,
): string {
  const normalized =
    value
      .replace(/\s+/g, " ")
      .trim();

  if (!normalized) {
    throw new AdminSubscriptionError({
      code:
        label === "Le motif"
          ? "ADMIN_SUBSCRIPTION_REASON_REQUIRED"
          : "ADMIN_SUBSCRIPTION_ACTION_NOT_ALLOWED",
      message:
        `${label} est obligatoire.`,
      status:
        400,
    });
  }

  return normalized;
}

export async function cancelAdminSubscription(
  input:
    CancelAdminSubscriptionInput,
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

  const reason =
    required(
      input.reason,
      "Le motif",
    );

  try {
    return await prisma.$transaction(
      async (
        transaction,
      ) => {
        const subscription =
          await transaction.organizerSubscription.findUnique({
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
              startsAt:
                true,
              endsAt:
                true,
              autoRenew:
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
                },
              },
            },
          });

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
          subscription.status ===
          SubscriptionStatus.CANCELLED
        ) {
          throw new AdminSubscriptionError({
            code:
              "ADMIN_SUBSCRIPTION_ALREADY_CANCELLED",
            message:
              "Cet abonnement est déjà annulé.",
            status:
              409,
          });
        }

        const canceledAt =
          new Date();

        const updated =
          await transaction.organizerSubscription.updateMany({
            where: {
              id:
                subscription.id,
              status:
                subscription.status,
            },

            data: {
              status:
                SubscriptionStatus.CANCELLED,
              canceledAt,
              cancellationReason:
                reason,
              autoRenew:
                input.disableAutoRenew ===
                false
                  ? subscription.autoRenew
                  : false,
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
          plan:
            subscription.plan,
          previousStatus:
            subscription.status,
          status:
            SubscriptionStatus.CANCELLED,
          reason,
          canceledAt,
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
        "Impossible d’annuler cet abonnement.",
      status:
        500,
      cause:
        error,
    });
  }
}
