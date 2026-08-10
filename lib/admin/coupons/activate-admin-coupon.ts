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

export type ActivateAdminCouponInput = Readonly<{
  couponId: string;
  adminId: string;
  startsAt?: Date | string | null;
  expiresAt?: Date | string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}>;

function dateOrNull(
  value: Date | string | null | undefined,
): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AdminCouponError({
      code: "ADMIN_COUPON_PERIOD_INVALID",
      message: "Une date du code promo est invalide.",
      status: 422,
    });
  }

  return date;
}

export async function activateAdminCoupon(
  input: ActivateAdminCouponInput,
) {
  const couponId = required(
    input.couponId,
    "L’identifiant du code promo",
  );
  const adminId = required(
    input.adminId,
    "L’identifiant administrateur",
  );

  return prisma.$transaction(
    async (tx) => {
      const coupon = await tx.promoCode.findUnique({
        where: { id: couponId },
        include: {
          event: {
            select: {
              title: true,
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

      if (
        coupon.status === PromoCodeStatus.ARCHIVED ||
        coupon.status === PromoCodeStatus.EXPIRED
      ) {
        throw new AdminCouponError({
          code: "ADMIN_COUPON_ACTION_NOT_ALLOWED",
          message:
            "Un code promo archivé ou expiré ne peut pas être activé.",
          status: 409,
        });
      }

      if (
        coupon.maximumUses !== null &&
        coupon.currentUses >= coupon.maximumUses
      ) {
        throw new AdminCouponError({
          code: "ADMIN_COUPON_LIMIT_INVALID",
          message:
            "Ce code promo a déjà atteint sa limite d’utilisation.",
          status: 409,
        });
      }

      const now = new Date();
      const startsAt =
        dateOrNull(input.startsAt) ??
        coupon.startsAt ??
        now;
      const expiresAt =
        dateOrNull(input.expiresAt) ??
        coupon.expiresAt;

      if (expiresAt && expiresAt <= startsAt) {
        throw new AdminCouponError({
          code: "ADMIN_COUPON_PERIOD_INVALID",
          message:
            "La date d’expiration doit être postérieure à la date de début.",
          status: 422,
        });
      }

      const status =
        startsAt > now
          ? PromoCodeStatus.SCHEDULED
          : PromoCodeStatus.ACTIVE;

      await tx.promoCode.update({
        where: { id: coupon.id },
        data: {
          status,
          isActive: true,
          startsAt,
          expiresAt,
        },
      });

      await audit(tx, {
        adminId,
        couponId: coupon.id,
        organizerId: coupon.organizerId,
        eventId: coupon.eventId,
        action: "COUPON_ACTIVATED",
        previousStatus: coupon.status,
        newStatus: status,
        metadata: {
          startsAt: startsAt.toISOString(),
          expiresAt: expiresAt?.toISOString() ?? null,
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
        startsAt,
        expiresAt,
      };
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 15_000,
    },
  );
}
