import "server-only";

import {
  AdminSubscriptionError,
} from "@/lib/admin/subscriptions/admin-subscription-errors";
import {
  prisma,
} from "@/lib/prisma";

function normalizeSubscriptionId(
  subscriptionId: string,
): string {
  const normalized =
    subscriptionId.trim();

  if (!normalized) {
    throw new AdminSubscriptionError({
      code:
        "ADMIN_SUBSCRIPTION_ID_REQUIRED",
      message:
        "L’identifiant de l’abonnement est obligatoire.",
      status:
        400,
    });
  }

  return normalized;
}

export async function getAdminSubscription(
  subscriptionId: string,
) {
  const id =
    normalizeSubscriptionId(
      subscriptionId,
    );

  try {
    const subscription =
      await prisma.organizerSubscription.findUnique({
        where: {
          id,
        },

        select: {
          id:
            true,
          organizerId:
            true,
          planId:
            true,
          status:
            true,
          startsAt:
            true,
          endsAt:
            true,
          trialEndsAt:
            true,
          autoRenew:
            true,
          canceledAt:
            true,
          cancellationReason:
            true,
          createdAt:
            true,
          updatedAt:
            true,

          organizer: {
            select: {
              id:
                true,
              firstName:
                true,
              lastName:
                true,
              email:
                true,
              phone:
                true,
              country:
                true,
              countryCode:
                true,
              dialCode:
                true,
              emailVerified:
                true,
              isActive:
                true,
              createdAt:
                true,

              organizerProfile: {
                select: {
                  businessName:
                    true,
                  logo:
                    true,
                  avatar:
                    true,
                  description:
                    true,
                },
              },
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
              description:
                true,
              price:
                true,
              currency:
                true,
              billingPeriod:
                true,
              durationDays:
                true,
              maxBoostedEvents:
                true,
              priorityScore:
                true,
              features:
                true,
              isActive:
                true,
              isPublic:
                true,
              sortOrder:
                true,
              createdAt:
                true,
              updatedAt:
                true,
            },
          },

          payments: {
            orderBy: {
              createdAt:
                "desc",
            },

            take:
              100,

            select: {
              id:
                true,
              amount:
                true,
              currency:
                true,
              provider:
                true,
              providerReference:
                true,
              status:
                true,
              failureReason:
                true,
              metadata:
                true,
              paidAt:
                true,
              createdAt:
                true,
              updatedAt:
                true,
            },
          },

          boosts: {
            orderBy: {
              createdAt:
                "desc",
            },

            take:
              100,

            select: {
              id:
                true,
              eventId:
                true,
              source:
                true,
              status:
                true,
              priorityScore:
                true,
              startsAt:
                true,
              endsAt:
                true,
              activatedAt:
                true,
              pausedAt:
                true,
              canceledAt:
                true,
              cancellationReason:
                true,
              createdAt:
                true,
              updatedAt:
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

    const successfulPayments =
      subscription.payments.filter(
        (
          payment,
        ) =>
          payment.status ===
          "SUCCESS",
      );

    const totalPaid =
      successfulPayments.reduce(
        (
          total,
          payment,
        ) =>
          total.plus(
            payment.amount,
          ),
        subscription.plan.price
          .mul(
            0,
          ),
      );

    return {
      id:
        subscription.id,
      organizerId:
        subscription.organizerId,
      planId:
        subscription.planId,
      status:
        subscription.status,
      startsAt:
        subscription.startsAt,
      endsAt:
        subscription.endsAt,
      trialEndsAt:
        subscription.trialEndsAt,
      autoRenew:
        subscription.autoRenew,
      canceledAt:
        subscription.canceledAt,
      cancellationReason:
        subscription.cancellationReason,
      createdAt:
        subscription.createdAt,
      updatedAt:
        subscription.updatedAt,

      organizer: {
        id:
          subscription.organizer.id,
        firstName:
          subscription.organizer.firstName,
        lastName:
          subscription.organizer.lastName,
        fullName:
          `${subscription.organizer.firstName} ${subscription.organizer.lastName}`
            .replace(
              /\s+/g,
              " ",
            )
            .trim(),
        email:
          subscription.organizer.email,
        phone:
          subscription.organizer.phone,
        country:
          subscription.organizer.country,
        countryCode:
          subscription.organizer.countryCode,
        dialCode:
          subscription.organizer.dialCode,
        emailVerified:
          subscription.organizer.emailVerified,
        isActive:
          subscription.organizer.isActive,
        createdAt:
          subscription.organizer.createdAt,
        profile:
          subscription.organizer
            .organizerProfile,
      },

      plan: {
        ...subscription.plan,
        price:
          subscription.plan.price.toFixed(
            2,
          ),
      },

      paymentSummary: {
        totalPayments:
          subscription.payments.length,
        successfulPayments:
          successfulPayments.length,
        totalPaid:
          totalPaid.toFixed(
            2,
          ),
        currency:
          subscription.plan.currency,
      },

      payments:
        subscription.payments.map(
          (
            payment,
          ) => ({
            ...payment,
            amount:
              payment.amount.toFixed(
                2,
              ),
          }),
        ),

      boostSummary: {
        total:
          subscription.boosts.length,
        active:
          subscription.boosts.filter(
            (
              boost,
            ) =>
              boost.status ===
              "ACTIVE",
          ).length,
        scheduled:
          subscription.boosts.filter(
            (
              boost,
            ) =>
              boost.status ===
              "SCHEDULED",
          ).length,
      },

      boosts:
        subscription.boosts,
    };
  } catch (error) {
    if (
      error instanceof
      AdminSubscriptionError
    ) {
      throw error;
    }

    throw new AdminSubscriptionError({
      code:
        "ADMIN_SUBSCRIPTION_QUERY_FAILED",
      message:
        "Impossible de charger le dossier de l’abonnement.",
      status:
        500,
      cause:
        error,
    });
  }
}
