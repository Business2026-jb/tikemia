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

export type SuspendAdminSubscriptionInput =
  Readonly<{
    subscriptionId: string;
    adminId: string;
    reason: string;
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

export async function suspendAdminSubscription(
  input:
    SuspendAdminSubscriptionInput,
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
          SubscriptionStatus.PAUSED
        ) {
          throw new AdminSubscriptionError({
            code:
              "ADMIN_SUBSCRIPTION_ALREADY_PAUSED",
            message:
              "Cet abonnement est déjà suspendu.",
            status:
              409,
          });
        }

        if (
          subscription.status ===
            SubscriptionStatus.CANCELLED ||
          subscription.status ===
            SubscriptionStatus.EXPIRED
        ) {
          throw new AdminSubscriptionError({
            code:
              "ADMIN_SUBSCRIPTION_ACTION_NOT_ALLOWED",
            message:
              "Cet abonnement ne peut plus être suspendu.",
            status:
              409,
          });
        }

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
                SubscriptionStatus.PAUSED,
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
            SubscriptionStatus.PAUSED,
          startsAt:
            subscription.startsAt,
          endsAt:
            subscription.endsAt,
          reason,
          adminId,
          suspendedAt:
            new Date(),
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
        "Impossible de suspendre cet abonnement.",
      status:
        500,
      cause:
        error,
    });
  }
}
