import "server-only";

import {
  Prisma,
  SubscriptionStatus,
} from "@prisma/client";

import {
  AdminSubscriptionError,
} from "@/lib/admin/subscriptions/admin-subscription-errors";
import {
  buildAdminSubscriptionWhere,
  type GetAdminSubscriptionsInput,
} from "@/lib/admin/subscriptions/get-admin-subscriptions";
import {
  prisma,
} from "@/lib/prisma";

export type AdminSubscriptionStatistics =
  Readonly<{
    totalSubscriptions: number;
    pendingSubscriptions: number;
    activeSubscriptions: number;
    pastDueSubscriptions: number;
    pausedSubscriptions: number;
    cancelledSubscriptions: number;
    expiredSubscriptions: number;
    autoRenewSubscriptions: number;
    endingSoonSubscriptions: number;
    revenueByCurrency:
      Readonly<
        Record<
          string,
          string
        >
      >;
    subscriptionsByPlan:
      readonly {
        planId: string;
        code: string;
        name: string;
        count: number;
      }[];
  }>;

function serializeDecimals(
  values:
    Record<
      string,
      Prisma.Decimal
    >,
): Record<string, string> {
  const result:
    Record<string, string> =
    {};

  for (
    const [
      currency,
      amount,
    ] of Object.entries(
      values,
    )
  ) {
    result[currency] =
      amount.toFixed(
        2,
      );
  }

  return result;
}

export async function getAdminSubscriptionStatistics(
  input:
    GetAdminSubscriptionsInput = {},
): Promise<AdminSubscriptionStatistics> {
  const where =
    buildAdminSubscriptionWhere(
      input,
    );

  try {
    const [
      subscriptions,
      payments,
    ] =
      await Promise.all([
        prisma.organizerSubscription.findMany({
          where,

          select: {
            id:
              true,
            status:
              true,
            autoRenew:
              true,
            endsAt:
              true,

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
        }),

        prisma.subscriptionPayment.findMany({
          where: {
            status:
              "SUCCESS",

            subscription: {
              is:
                where,
            },
          },

          select: {
            amount:
              true,
            currency:
              true,
          },
        }),
      ]);

    const now =
      new Date();

    const soon =
      new Date(
        now.getTime() +
          30 *
            24 *
            60 *
            60 *
            1000,
      );

    const revenueByCurrency:
      Record<
        string,
        Prisma.Decimal
      > =
      {};

    for (const payment of payments) {
      revenueByCurrency[
        payment.currency
      ] =
        (
          revenueByCurrency[
            payment.currency
          ] ??
          new Prisma.Decimal(
            0,
          )
        ).plus(
          payment.amount,
        );
    }

    const planMap =
      new Map<
        string,
        {
          planId: string;
          code: string;
          name: string;
          count: number;
        }
      >();

    for (
      const subscription of
      subscriptions
    ) {
      const current =
        planMap.get(
          subscription.plan.id,
        );

      if (current) {
        current.count +=
          1;
      } else {
        planMap.set(
          subscription.plan.id,
          {
            planId:
              subscription.plan.id,
            code:
              subscription.plan.code,
            name:
              subscription.plan.name,
            count:
              1,
          },
        );
      }
    }

    return {
      totalSubscriptions:
        subscriptions.length,
      pendingSubscriptions:
        subscriptions.filter(
          (
            item,
          ) =>
            item.status ===
            SubscriptionStatus.PENDING,
        ).length,
      activeSubscriptions:
        subscriptions.filter(
          (
            item,
          ) =>
            item.status ===
            SubscriptionStatus.ACTIVE,
        ).length,
      pastDueSubscriptions:
        subscriptions.filter(
          (
            item,
          ) =>
            item.status ===
            SubscriptionStatus.PAST_DUE,
        ).length,
      pausedSubscriptions:
        subscriptions.filter(
          (
            item,
          ) =>
            item.status ===
            SubscriptionStatus.PAUSED,
        ).length,
      cancelledSubscriptions:
        subscriptions.filter(
          (
            item,
          ) =>
            item.status ===
            SubscriptionStatus.CANCELLED,
        ).length,
      expiredSubscriptions:
        subscriptions.filter(
          (
            item,
          ) =>
            item.status ===
            SubscriptionStatus.EXPIRED,
        ).length,
      autoRenewSubscriptions:
        subscriptions.filter(
          (
            item,
          ) =>
            item.autoRenew,
        ).length,
      endingSoonSubscriptions:
        subscriptions.filter(
          (
            item,
          ) =>
            item.endsAt &&
            item.endsAt >=
              now &&
            item.endsAt <=
              soon,
        ).length,
      revenueByCurrency:
        serializeDecimals(
          revenueByCurrency,
        ),
      subscriptionsByPlan:
        Array.from(
          planMap.values(),
        ).sort(
          (
            left,
            right,
          ) =>
            right.count -
            left.count,
        ),
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
        "Impossible de calculer les statistiques des abonnements.",
      status:
        500,
      cause:
        error,
    });
  }
}
