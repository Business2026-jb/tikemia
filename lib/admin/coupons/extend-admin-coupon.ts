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

export type ExtendAdminCouponInput = Readonly<{
  couponId: string;
  adminId: string;
  additionalDays: number;
  reactivateIfExpired?: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
}>;

export async function extendAdminCoupon(
  input: ExtendAdminCouponInput,
) {
  const couponId = required(
    input.couponId,
    "L’identifiant du code promo",
  );
  const adminId = required(
    input.adminId,
    "L’identifiant administrateur",
  );

  if (
    !Number.isInteger(input.additionalDays) ||
    input.additionalDays < 1 ||
    input.additionalDays > 3650
  ) {
    throw new AdminCouponError({
      code: "ADMIN_COUPON_PERIOD_INVALID",
      message:
        "La prolongation doit être comprise entre 1 et 3650 jours.",
      status: 422,
    });
  }

  return prisma.$transaction(async (tx) => {
    const coupon = await tx.promoCode.findUnique({
      where: { id: couponId },
      include: {
        event: {
          select: {
            title: true,
            startsAt: true,
            endsAt: true,
          },
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
        message:
          "Un code promo archivé ne peut pas être prolongé.",
        status: 409,
      });
    }

    const now = new Date();
    const baseDate =
      coupon.expiresAt && coupon.expiresAt > now
        ? coupon.expiresAt
        : now;

    const proposedExpiresAt = new Date(
      baseDate.getTime() +
        input.additionalDays * 24 * 60 * 60 * 1000,
    );

    const eventLimit =
      coupon.event.endsAt ?? coupon.event.startsAt;

    const expiresAt =
      proposedExpiresAt > eventLimit
        ? eventLimit
        : proposedExpiresAt;

    if (expiresAt <= baseDate) {
      throw new AdminCouponError({
        code: "ADMIN_COUPON_PERIOD_INVALID",
        message:
          "La nouvelle date ne peut pas dépasser la fin de l’événement.",
        status: 409,
      });
    }

    const shouldReactivate =
      Boolean(input.reactivateIfExpired) &&
      (
        coupon.status === PromoCodeStatus.EXPIRED ||
        coupon.status === PromoCodeStatus.DISABLED
      );

    const status = shouldReactivate
      ? PromoCodeStatus.ACTIVE
      : coupon.status;

    await tx.promoCode.update({
      where: { id: coupon.id },
      data: {
        expiresAt,
        status,
        isActive: shouldReactivate
          ? true
          : coupon.isActive,
      },
    });

    await audit(tx, {
      adminId,
      couponId: coupon.id,
      organizerId: coupon.organizerId,
      eventId: coupon.eventId,
      action: "COUPON_EXTENDED",
      previousStatus: coupon.status,
      newStatus: status,
      metadata: {
        previousExpiresAt:
          coupon.expiresAt?.toISOString() ?? null,
        expiresAt: expiresAt.toISOString(),
        requestedAdditionalDays:
          input.additionalDays,
        reactivated: shouldReactivate,
      },
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
      status,
      previousExpiresAt: coupon.expiresAt,
      expiresAt,
      additionalDays: Math.ceil(
        (expiresAt.getTime() - baseDate.getTime()) /
          (24 * 60 * 60 * 1000),
      ),
    };
  });
}
