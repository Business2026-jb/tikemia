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

export type ActivateAdminSubscriptionInput =
  Readonly<{
    subscriptionId: string;
    adminId: string;
    startsAt?: Date | string | null;
    endsAt?: Date | string | null;
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

function optionalDate(
  value:
    | Date
    | string
    | null
    | undefined,
): Date | null {
  if (!value) {
    return null;
  }

  const date =
    value instanceof Date
      ? new Date(
          value.getTime(),
        )
      : new Date(
          value,
        );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new AdminSubscriptionError({
      code:
        "ADMIN_SUBSCRIPTION_INVALID_DATE",
      message:
        "Une date d’activation est invalide.",
      status:
        400,
    });
  }

  return date;
}

export async function activateAdminSubscription(
  input:
    ActivateAdminSubscriptionInput,
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
              startsAt:
                true,
              endsAt:
                true,
              organizerId:
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
                  durationDays:
                    true,
                  price:
                    true,
                  currency:
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
          SubscriptionStatus.ACTIVE
        ) {
          throw new AdminSubscriptionError({
            code:
              "ADMIN_SUBSCRIPTION_ALREADY_ACTIVE",
            message:
              "Cet abonnement est déjà actif.",
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
              "Un abonnement annulé ne peut pas être réactivé directement.",
            status:
              409,
          });
        }

        const startsAt =
          optionalDate(
            input.startsAt,
          ) ??
          subscription.startsAt ??
          new Date();

        const providedEndsAt =
          optionalDate(
            input.endsAt,
          );

        const endsAt =
          providedEndsAt ??
          subscription.endsAt ??
          new Date(
            startsAt.getTime() +
              subscription.plan.durationDays *
                24 *
                60 *
                60 *
                1000,
          );

        if (
          endsAt <=
          startsAt
        ) {
          throw new AdminSubscriptionError({
            code:
              "ADMIN_SUBSCRIPTION_INVALID_DATE",
            message:
              "La date de fin doit être postérieure à la date de début.",
            status:
              422,
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
                SubscriptionStatus.ACTIVE,
              startsAt,
              endsAt,
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
            {
              ...subscription.plan,
              price:
                subscription.plan.price.toFixed(
                  2,
                ),
            },
          previousStatus:
            subscription.status,
          status:
            SubscriptionStatus.ACTIVE,
          startsAt,
          endsAt,
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
        "Impossible d’activer cet abonnement.",
      status:
        500,
      cause:
        error,
    });
  }
}
