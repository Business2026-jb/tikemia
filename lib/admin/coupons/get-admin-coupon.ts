import "server-only";

import { AdminCouponError } from "@/lib/admin/coupons/admin-coupon-errors";
import { prisma } from "@/lib/prisma";

function normalizeCouponId(couponId: string): string {
  const normalized = couponId.trim();

  if (!normalized) {
    throw new AdminCouponError({
      code: "ADMIN_COUPON_ID_REQUIRED",
      message: "L’identifiant du code promo est obligatoire.",
      status: 400,
    });
  }

  return normalized;
}

export async function getAdminCoupon(couponId: string) {
  const id = normalizeCouponId(couponId);

  try {
    const coupon = await prisma.promoCode.findUnique({
      where: { id },
      select: {
        id: true,
        organizerId: true,
        eventId: true,
        campaignId: true,
        code: true,
        description: true,
        discountType: true,
        discountValue: true,
        minimumOrderAmount: true,
        maximumDiscount: true,
        maximumUses: true,
        usesPerCustomer: true,
        currentUses: true,
        startsAt: true,
        expiresAt: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
            coverImage: true,
            status: true,
            city: true,
            country: true,
            countryCode: true,
            currency: true,
            venueName: true,
            startsAt: true,
            endsAt: true,
          },
        },
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            country: true,
            countryCode: true,
            emailVerified: true,
            isActive: true,
            organizerProfile: {
              select: {
                businessName: true,
                logo: true,
                avatar: true,
                description: true,
              },
            },
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
            status: true,
            channel: true,
            startsAt: true,
            endsAt: true,
          },
        },
        usages: {
          orderBy: { usedAt: "desc" },
          take: 100,
          select: {
            id: true,
            orderId: true,
            customerId: true,
            customerEmail: true,
            discountAmount: true,
            currency: true,
            usedAt: true,
            order: {
              select: {
                reference: true,
                status: true,
                total: true,
                paidAt: true,
              },
            },
          },
        },
        attributions: {
          orderBy: { attributedAt: "desc" },
          take: 100,
          select: {
            id: true,
            orderId: true,
            revenue: true,
            ticketsCount: true,
            discountAmount: true,
            currency: true,
            attributedAt: true,
          },
        },
      },
    });

    if (!coupon) {
      throw new AdminCouponError({
        code: "ADMIN_COUPON_NOT_FOUND",
        message: "Ce code promo est introuvable.",
        status: 404,
      });
    }

    const auditLogs = await prisma.adminAuditLog.findMany({
      where: {
        targetType: "PROMO_CODE",
        targetId: coupon.id,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        action: true,
        reason: true,
        metadata: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        admin: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return {
      ...coupon,
      discountValue: coupon.discountValue.toFixed(2),
      minimumOrderAmount:
        coupon.minimumOrderAmount?.toFixed(2) ?? null,
      maximumDiscount:
        coupon.maximumDiscount?.toFixed(2) ?? null,
      organizer: {
        ...coupon.organizer,
        fullName:
          `${coupon.organizer.firstName} ${coupon.organizer.lastName}`
            .replace(/\s+/g, " ")
            .trim(),
        profile: coupon.organizer.organizerProfile,
      },
      usages: coupon.usages.map((usage) => ({
        ...usage,
        discountAmount: usage.discountAmount.toFixed(2),
        order: {
          ...usage.order,
          total: usage.order.total.toFixed(2),
        },
      })),
      attributions: coupon.attributions.map((attribution) => ({
        ...attribution,
        revenue: attribution.revenue.toFixed(2),
        discountAmount: attribution.discountAmount.toFixed(2),
      })),
      auditLogs,
    };
  } catch (error) {
    if (error instanceof AdminCouponError) throw error;

    throw new AdminCouponError({
      code: "ADMIN_COUPON_QUERY_FAILED",
      message: "Impossible de charger le dossier du code promo.",
      status: 500,
      cause: error,
    });
  }
}
