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

export type UpdateAdminCouponInput = Readonly<{
  couponId: string;
  adminId: string;
  description?: string | null;
  discountValue?: string | number | null;
  minimumOrderAmount?: string | number | null;
  maximumDiscount?: string | number | null;
  maximumUses?: number | null;
  usesPerCustomer?: number | null;
  startsAt?: Date | string | null;
  expiresAt?: Date | string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}>;

function decimalOrNull(
  value: string | number | null | undefined,
  label: string,
): Prisma.Decimal | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  try {
    const decimal = new Prisma.Decimal(value);

    if (decimal.isNegative()) {
      throw new Error();
    }

    return decimal;
  } catch {
    throw new AdminCouponError({
      code: "ADMIN_COUPON_VALUE_INVALID",
      message: `${label} est invalide.`,
      status: 422,
    });
  }
}

function dateOrNull(
  value: Date | string | null | undefined,
  label: string,
): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const date = value instanceof Date
    ? value
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AdminCouponError({
      code: "ADMIN_COUPON_PERIOD_INVALID",
      message: `${label} est invalide.`,
      status: 422,
    });
  }

  return date;
}

export async function updateAdminCoupon(
  input: UpdateAdminCouponInput,
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
          message:
            "Un code promo archivé ne peut plus être modifié.",
          status: 409,
        });
      }

      const discountValue = decimalOrNull(
        input.discountValue,
        "La valeur de réduction",
      );

      if (
        discountValue === null ||
        (
          discountValue !== undefined &&
          discountValue.lte(0)
        )
      ) {
        throw new AdminCouponError({
          code: "ADMIN_COUPON_VALUE_INVALID",
          message:
            "La valeur de réduction doit être supérieure à zéro.",
          status: 422,
        });
      }

      const nextDiscountValue =
        discountValue ?? coupon.discountValue;

      if (
        coupon.discountType === "PERCENTAGE" &&
        nextDiscountValue.gt(100)
      ) {
        throw new AdminCouponError({
          code: "ADMIN_COUPON_VALUE_INVALID",
          message:
            "Une réduction en pourcentage ne peut pas dépasser 100 %.",
          status: 422,
        });
      }

      const minimumOrderAmount = decimalOrNull(
        input.minimumOrderAmount,
        "Le montant minimum",
      );

      const maximumDiscount = decimalOrNull(
        input.maximumDiscount,
        "Le plafond de réduction",
      );

      const maximumUses =
        input.maximumUses === undefined
          ? coupon.maximumUses
          : input.maximumUses;

      const usesPerCustomer =
        input.usesPerCustomer === undefined
          ? coupon.usesPerCustomer
          : input.usesPerCustomer;

      if (
        maximumUses !== null &&
        (
          !Number.isInteger(maximumUses) ||
          maximumUses < coupon.currentUses
        )
      ) {
        throw new AdminCouponError({
          code: "ADMIN_COUPON_LIMIT_INVALID",
          message:
            "La limite totale ne peut pas être inférieure aux utilisations déjà enregistrées.",
          status: 422,
        });
      }

      if (
        usesPerCustomer !== null &&
        (
          !Number.isInteger(usesPerCustomer) ||
          usesPerCustomer < 1
        )
      ) {
        throw new AdminCouponError({
          code: "ADMIN_COUPON_LIMIT_INVALID",
          message:
            "La limite par client doit être un entier supérieur à zéro.",
          status: 422,
        });
      }

      if (
        maximumUses !== null &&
        usesPerCustomer !== null &&
        usesPerCustomer > maximumUses
      ) {
        throw new AdminCouponError({
          code: "ADMIN_COUPON_LIMIT_INVALID",
          message:
            "La limite par client ne peut pas dépasser la limite totale.",
          status: 422,
        });
      }

      const startsAtInput = dateOrNull(
        input.startsAt,
        "La date de début",
      );

      const expiresAtInput = dateOrNull(
        input.expiresAt,
        "La date d’expiration",
      );

      const startsAt =
        startsAtInput === undefined
          ? coupon.startsAt
          : startsAtInput;

      const expiresAt =
        expiresAtInput === undefined
          ? coupon.expiresAt
          : expiresAtInput;

      if (
        startsAt &&
        expiresAt &&
        expiresAt <= startsAt
      ) {
        throw new AdminCouponError({
          code: "ADMIN_COUPON_PERIOD_INVALID",
          message:
            "La date d’expiration doit être postérieure à la date de début.",
          status: 422,
        });
      }

      const updated = await tx.promoCode.update({
        where: { id: coupon.id },
        data: {
          description:
            input.description === undefined
              ? coupon.description
              : optional(input.description),
          discountValue:
            discountValue ?? coupon.discountValue,
          minimumOrderAmount:
            minimumOrderAmount === undefined
              ? coupon.minimumOrderAmount
              : minimumOrderAmount,
          maximumDiscount:
            maximumDiscount === undefined
              ? coupon.maximumDiscount
              : maximumDiscount,
          maximumUses,
          usesPerCustomer,
          startsAt,
          expiresAt,
        },
      });

      await audit(tx, {
        adminId,
        couponId: coupon.id,
        organizerId: coupon.organizerId,
        eventId: coupon.eventId,
        action: "COUPON_UPDATED",
        previousStatus: coupon.status,
        newStatus: updated.status,
        metadata: {
          discountValue:
            updated.discountValue.toFixed(2),
          minimumOrderAmount:
            updated.minimumOrderAmount?.toFixed(2) ?? null,
          maximumDiscount:
            updated.maximumDiscount?.toFixed(2) ?? null,
          maximumUses: updated.maximumUses,
          usesPerCustomer: updated.usesPerCustomer,
          startsAt:
            updated.startsAt?.toISOString() ?? null,
          expiresAt:
            updated.expiresAt?.toISOString() ?? null,
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
        status: updated.status,
        discountValue:
          updated.discountValue.toFixed(2),
        minimumOrderAmount:
          updated.minimumOrderAmount?.toFixed(2) ?? null,
        maximumDiscount:
          updated.maximumDiscount?.toFixed(2) ?? null,
        maximumUses: updated.maximumUses,
        usesPerCustomer: updated.usesPerCustomer,
        startsAt: updated.startsAt,
        expiresAt: updated.expiresAt,
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
