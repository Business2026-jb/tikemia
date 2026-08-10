import "server-only";

import {
  Prisma,
  PromoCodeStatus,
} from "@prisma/client";

import { AdminCouponError } from "@/lib/admin/coupons/admin-coupon-errors";
import {
  buildAdminCouponWhere,
  type GetAdminCouponsInput,
} from "@/lib/admin/coupons/get-admin-coupons";
import { prisma } from "@/lib/prisma";

export async function getAdminCouponStatistics(
  input: GetAdminCouponsInput = {},
) {
  const where = buildAdminCouponWhere(input);

  try {
    const [coupons, usages] = await Promise.all([
      prisma.promoCode.findMany({
        where,
        select: {
          status: true,
          isActive: true,
          currentUses: true,
          maximumUses: true,
          startsAt: true,
          expiresAt: true,
        },
      }),
      prisma.promoCodeUsage.findMany({
        where: {
          promoCode: {
            is: where,
          },
        },
        select: {
          discountAmount: true,
          currency: true,
        },
      }),
    ]);

    const now = new Date();
    const discountsByCurrency: Record<string, Prisma.Decimal> = {};
    let totalDiscount = new Prisma.Decimal(0);

    for (const usage of usages) {
      totalDiscount = totalDiscount.plus(usage.discountAmount);
      discountsByCurrency[usage.currency] = (
        discountsByCurrency[usage.currency] ?? new Prisma.Decimal(0)
      ).plus(usage.discountAmount);
    }

    return {
      totalCoupons: coupons.length,
      activeCoupons: coupons.filter(
        (coupon) =>
          coupon.status === PromoCodeStatus.ACTIVE &&
          coupon.isActive &&
          (!coupon.startsAt || coupon.startsAt <= now) &&
          (!coupon.expiresAt || coupon.expiresAt > now),
      ).length,
      scheduledCoupons: coupons.filter(
        (coupon) =>
          coupon.status === PromoCodeStatus.SCHEDULED ||
          Boolean(coupon.startsAt && coupon.startsAt > now),
      ).length,
      disabledCoupons: coupons.filter(
        (coupon) =>
          coupon.status === PromoCodeStatus.DISABLED ||
          !coupon.isActive,
      ).length,
      archivedCoupons: coupons.filter(
        (coupon) => coupon.status === PromoCodeStatus.ARCHIVED,
      ).length,
      expiredCoupons: coupons.filter(
        (coupon) =>
          coupon.status === PromoCodeStatus.EXPIRED ||
          Boolean(coupon.expiresAt && coupon.expiresAt <= now),
      ).length,
      totalUses: coupons.reduce(
        (total, coupon) => total + coupon.currentUses,
        0,
      ),
      usageRecords: usages.length,
      exhaustedCoupons: coupons.filter(
        (coupon) =>
          coupon.maximumUses !== null &&
          coupon.currentUses >= coupon.maximumUses,
      ).length,
      totalDiscount: totalDiscount.toFixed(2),
      discountsByCurrency: Object.fromEntries(
        Object.entries(discountsByCurrency).map(
          ([currency, amount]) => [
            currency,
            amount.toFixed(2),
          ],
        ),
      ),
    };
  } catch (error) {
    if (error instanceof AdminCouponError) throw error;

    throw new AdminCouponError({
      code: "ADMIN_COUPON_QUERY_FAILED",
      message:
        "Impossible de calculer les statistiques des codes promo.",
      status: 500,
      cause: error,
    });
  }
}
