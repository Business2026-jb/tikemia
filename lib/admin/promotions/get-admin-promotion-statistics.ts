import "server-only";

import {
  EventBoostStatus,
  Prisma,
} from "@prisma/client";

import { AdminPromotionError } from "@/lib/admin/promotions/admin-promotion-errors";
import {
  buildAdminPromotionWhere,
  type GetAdminPromotionsInput,
} from "@/lib/admin/promotions/get-admin-promotions";
import { prisma } from "@/lib/prisma";

export async function getAdminPromotionStatistics(
  input: GetAdminPromotionsInput = {},
) {
  const where = buildAdminPromotionWhere(input);

  try {
    const [boosts, payments] = await Promise.all([
      prisma.eventBoost.findMany({
        where,
        select: {
          status: true,
          startsAt: true,
          endsAt: true,
          priorityScore: true,
        },
      }),

      prisma.subscriptionPayment.findMany({
        where: {
          status: "SUCCESS",
          subscription: {
            is: {
              boosts: {
                some: where,
              },
            },
          },
        },
        select: {
          amount: true,
          currency: true,
        },
      }),
    ]);

    const now = new Date();
    const revenue: Record<string, Prisma.Decimal> = {};

    for (const payment of payments) {
      revenue[payment.currency] =
        (revenue[payment.currency] ??
          new Prisma.Decimal(0)).plus(payment.amount);
    }

    return {
      totalPromotions: boosts.length,
      awaitingReviewPromotions: boosts.filter(
        (item) => item.status === EventBoostStatus.SCHEDULED,
      ).length,
      scheduledPromotions: boosts.filter(
        (item) => item.status === EventBoostStatus.SCHEDULED,
      ).length,
      activePromotions: boosts.filter(
        (item) =>
          item.status === EventBoostStatus.ACTIVE &&
          item.startsAt <= now &&
          item.endsAt > now,
      ).length,
      pausedPromotions: boosts.filter(
        (item) => item.status === EventBoostStatus.PAUSED,
      ).length,
      cancelledPromotions: boosts.filter(
        (item) => item.status === EventBoostStatus.CANCELLED,
      ).length,
      expiredPromotions: boosts.filter(
        (item) =>
          item.status === EventBoostStatus.EXPIRED ||
          item.endsAt <= now,
      ).length,
      averagePriority:
        boosts.length === 0
          ? 0
          : Math.round(
              boosts.reduce(
                (total, item) => total + item.priorityScore,
                0,
              ) / boosts.length,
            ),
      revenueByCurrency: Object.fromEntries(
        Object.entries(revenue).map(([currency, amount]) => [
          currency,
          amount.toFixed(2),
        ]),
      ),
    };
  } catch (error) {
    throw new AdminPromotionError({
      code: "ADMIN_PROMOTION_QUERY_FAILED",
      message: "Impossible de calculer les statistiques des promotions.",
      status: 500,
      cause: error,
    });
  }
}
