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

export type ExtendAdminSubscriptionInput =
  Readonly<{
    subscriptionId: string;
    adminId: string;
    additionalDays: number;
    reactivateIfExpired?: boolean;
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

export async function extendAdminSubscription(
  input:
    ExtendAdminSubscriptionInput,
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

  if (
    !Number.isInteger(
      input.additionalDays,
    ) ||
    input.additionalDays <
      1 ||
    input.additionalDays >
      3650
  ) {
    throw new AdminSubscriptionError({
      code:
        "ADMIN_SUBSCRIPTION_INVALID_DURATION",
      message:
        "La prolongation doit être comprise entre 1 et 3650 jours.",
      status:
        422,
    });
  }

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
          SubscriptionStatus.CANCELLED
        ) {
          throw new AdminSubscriptionError({
            code:
              "ADMIN_SUBSCRIPTION_ACTION_NOT_ALLOWED",
            message:
              "Un abonnement annulé ne peut pas être prolongé.",
            status:
              409,
          });
        }

        const now =
          new Date();

        const baseDate =
          subscription.endsAt &&
          subscription.endsAt >
            now
            ? subscription.endsAt
            : now;

        const endsAt =
          new Date(
            baseDate.getTime() +
              input.additionalDays *
                24 *
                60 *
                60 *
                1000,
          );

        const status =
          subscription.status ===
            SubscriptionStatus.EXPIRED &&
          input.reactivateIfExpired !==
            false
            ? SubscriptionStatus.ACTIVE
            : subscription.status;

        const startsAt =
          subscription.startsAt ??
          now;

        const updated =
          await transaction.organizerSubscription.updateMany({
            where: {
              id:
                subscription.id,
              status:
                subscription.status,
              endsAt:
                subscription.endsAt,
            },

            data: {
              endsAt,
              startsAt,
              status,
              canceledAt:
                null,
              cancellationReason:
                null,
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
          status,
          previousEndsAt:
            subscription.endsAt,
          endsAt,
          additionalDays:
            input.additionalDays,
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
        "Impossible de prolonger cet abonnement.",
      status:
        500,
      cause:
        error,
    });
  }
}
