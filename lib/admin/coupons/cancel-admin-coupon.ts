import "server-only";

import {
  Prisma,
  PromoCodeStatus,
} from "@prisma/client";

import { AdminCouponError } from "@/lib/admin/coupons/admin-coupon-errors";
import { prisma } from "@/lib/prisma";

function required(value: string, label: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    throw new AdminCouponError({
      code:
        label === "Le motif"
          ? "ADMIN_COUPON_REASON_REQUIRED"
          : "ADMIN_COUPON_ACTION_NOT_ALLOWED",
      message: `${label} est obligatoire.`,
      status: 400,
    });
  }

  return normalized;
}

function optional(value?: string | null): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  return normalized || null;
}

async function audit(
  tx: Prisma.TransactionClient,
  input: {
    adminId: string;
    couponId: string;
    organizerId: string;
    eventId: string;
    action: string;
    previousStatus: PromoCodeStatus;
    newStatus: PromoCodeStatus;
    reason?: string | null;
    metadata?: Prisma.InputJsonValue;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
) {
  await tx.adminAuditLog.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      targetType: "PROMO_CODE",
      targetId: input.couponId,
      reason: optional(input.reason),
      metadata: {
        couponId: input.couponId,
        organizerId: input.organizerId,
        eventId: input.eventId,
        previousStatus: input.previousStatus,
        newStatus: input.newStatus,
        ...(input.metadata &&
        typeof input.metadata === "object" &&
        !Array.isArray(input.metadata)
          ? input.metadata
          : {}),
      } satisfies Prisma.InputJsonValue,
      ipAddress: optional(input.ipAddress),
      userAgent: optional(input.userAgent),
    },
  });
}

export type CancelAdminCouponInput = Readonly<{
  couponId: string;
  adminId: string;
  reason: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}>;

export async function cancelAdminCoupon(
  input: CancelAdminCouponInput,
) {
  const couponId = required(
    input.couponId,
    "L’identifiant du code promo",
  );
  const adminId = required(
    input.adminId,
    "L’identifiant administrateur",
  );
  const reason = required(input.reason, "Le motif");

  return prisma.$transaction(async (tx) => {
    const coupon = await tx.promoCode.findUnique({
      where: { id: couponId },
      include: {
        event: {
          select: { title: true },
        },
        organizer: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
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

    if (coupon.status === PromoCodeStatus.ARCHIVED) {
      throw new AdminCouponError({
        code: "ADMIN_COUPON_ACTION_NOT_ALLOWED",
        message: "Ce code promo est déjà archivé.",
        status: 409,
      });
    }

    await tx.promoCode.update({
      where: { id: coupon.id },
      data: {
        status: PromoCodeStatus.ARCHIVED,
        isActive: false,
      },
    });

    await audit(tx, {
      adminId,
      couponId: coupon.id,
      organizerId: coupon.organizerId,
      eventId: coupon.eventId,
      action: "COUPON_CANCELLED",
      previousStatus: coupon.status,
      newStatus: PromoCodeStatus.ARCHIVED,
      reason,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      couponId: coupon.id,
      code: coupon.code,
      eventId: coupon.eventId,
      eventTitle: coupon.event.title,
      organizerId: coupon.organizerId,
      organizerEmail: coupon.organizer.email,
      organizerName:
        `${coupon.organizer.firstName} ${coupon.organizer.lastName}`
          .replace(/\s+/g, " ")
          .trim(),
      previousStatus: coupon.status,
      status: PromoCodeStatus.ARCHIVED,
      reason,
    };
  });
}
