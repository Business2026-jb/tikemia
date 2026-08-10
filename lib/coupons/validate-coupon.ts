import "server-only";

import {
  Prisma,
  PromoCodeStatus,
} from "@prisma/client";

import { calculateCouponDiscount } from "@/lib/coupons/calculate-coupon-discount";
import { CouponError } from "@/lib/coupons/coupon-errors";
import { normalizeCouponCode } from "@/lib/coupons/normalize-coupon-code";
import { prisma } from "@/lib/prisma";

export type ValidateCouponInput = Readonly<{
  eventId: string;
  code: string;
  subtotal: Prisma.Decimal.Value;
  platformFee?: Prisma.Decimal.Value | null;
  currency: string;
  customerId?: string | null;
  customerEmail?: string | null;
  orderId?: string | null;
  now?: Date;
}>;

export type ValidatedCoupon = Readonly<{
  coupon: {
    id: string;
    organizerId: string;
    eventId: string;
    campaignId: string | null;
    code: string;
    description: string | null;
    discountType: string;
    discountValue: string;
    minimumOrderAmount: string | null;
    maximumDiscount: string | null;
    maximumUses: number | null;
    usesPerCustomer: number | null;
    currentUses: number;
    startsAt: Date | null;
    expiresAt: Date | null;
    currency: string;
  };
  amounts: {
    subtotal: string;
    platformFee: string;
    discountAmount: string;
    discountedSubtotal: string;
    discountedPlatformFee: string;
    total: string;
    currency: string;
  };
}>;

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new CouponError({
      code: "COUPON_CODE_INVALID",
      message: `${label} est obligatoire.`,
      status: 400,
    });
  }

  return normalized;
}

export async function validateCoupon(
  input: ValidateCouponInput,
): Promise<ValidatedCoupon> {
  const eventId = normalizeRequired(
    input.eventId,
    "L’identifiant de l’événement",
  );
  const currency = normalizeRequired(
    input.currency,
    "La devise",
  ).toUpperCase();
  const normalizedCode = normalizeCouponCode(input.code);
  const now = input.now ?? new Date();

  const subtotal = new Prisma.Decimal(input.subtotal);
  const platformFee = new Prisma.Decimal(input.platformFee ?? 0);

  if (subtotal.isNegative() || platformFee.isNegative()) {
    throw new CouponError({
      code: "COUPON_ORDER_NOT_ELIGIBLE",
      message: "Le montant de la commande est invalide.",
      status: 422,
    });
  }

  const coupon = await prisma.promoCode.findUnique({
    where: {
      eventId_code: {
        eventId,
        code: normalizedCode,
      },
    },
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
      event: {
        select: {
          id: true,
          currency: true,
          status: true,
        },
      },
    },
  });

  if (!coupon) {
    throw new CouponError({
      code: "COUPON_NOT_FOUND",
      message: "Ce code promo est introuvable.",
      status: 404,
    });
  }

  if (coupon.eventId !== eventId) {
    throw new CouponError({
      code: "COUPON_EVENT_MISMATCH",
      message:
        "Ce code promo ne s’applique pas à cet événement.",
      status: 409,
    });
  }

  if (coupon.event.currency.toUpperCase() !== currency) {
    throw new CouponError({
      code: "COUPON_CURRENCY_MISMATCH",
      message:
        "La devise du code promo ne correspond pas à la commande.",
      status: 409,
    });
  }

  if (
    coupon.status !== PromoCodeStatus.ACTIVE ||
    !coupon.isActive
  ) {
    throw new CouponError({
      code: "COUPON_NOT_ACTIVE",
      message: "Ce code promo n’est pas actif.",
      status: 409,
    });
  }

  if (coupon.startsAt && coupon.startsAt > now) {
    throw new CouponError({
      code: "COUPON_NOT_STARTED",
      message: "Ce code promo n’est pas encore disponible.",
      status: 409,
      details: {
        startsAt: coupon.startsAt.toISOString(),
      },
    });
  }

  if (coupon.expiresAt && coupon.expiresAt <= now) {
    throw new CouponError({
      code: "COUPON_EXPIRED",
      message: "Ce code promo a expiré.",
      status: 409,
      details: {
        expiresAt: coupon.expiresAt.toISOString(),
      },
    });
  }

  if (
    coupon.maximumUses !== null &&
    coupon.currentUses >= coupon.maximumUses
  ) {
    throw new CouponError({
      code: "COUPON_USAGE_LIMIT_REACHED",
      message:
        "La limite d’utilisation de ce code promo est atteinte.",
      status: 409,
    });
  }

  if (
    coupon.minimumOrderAmount &&
    subtotal.lessThan(coupon.minimumOrderAmount)
  ) {
    throw new CouponError({
      code: "COUPON_MINIMUM_NOT_REACHED",
      message:
        `Le montant minimum requis est de ${coupon.minimumOrderAmount.toFixed(2)} ${currency}.`,
      status: 409,
      details: {
        minimumOrderAmount:
          coupon.minimumOrderAmount.toFixed(2),
      },
    });
  }

  const customerEmail =
    input.customerEmail?.trim().toLowerCase() || null;
  const customerId = input.customerId?.trim() || null;

  if (coupon.usesPerCustomer !== null &&
      (customerEmail || customerId)) {
    const customerUsageCount =
      await prisma.promoCodeUsage.count({
        where: {
          promoCodeId: coupon.id,
          OR: [
            ...(customerId
              ? [{ customerId }]
              : []),
            ...(customerEmail
              ? [{ customerEmail }]
              : []),
          ],
        },
      });

    if (customerUsageCount >= coupon.usesPerCustomer) {
      throw new CouponError({
        code: "COUPON_CUSTOMER_LIMIT_REACHED",
        message:
          "Vous avez atteint la limite d’utilisation de ce code promo.",
        status: 409,
      });
    }
  }

  if (input.orderId) {
    const alreadyUsed =
      await prisma.promoCodeUsage.findUnique({
        where: {
          promoCodeId_orderId: {
            promoCodeId: coupon.id,
            orderId: input.orderId,
          },
        },
        select: {
          id: true,
        },
      });

    if (alreadyUsed) {
      throw new CouponError({
        code: "COUPON_ALREADY_USED",
        message:
          "Ce code promo a déjà été utilisé pour cette commande.",
        status: 409,
      });
    }
  }

  const calculation = calculateCouponDiscount({
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    subtotal,
    platformFee,
    maximumDiscount: coupon.maximumDiscount,
  });

  return {
    coupon: {
      id: coupon.id,
      organizerId: coupon.organizerId,
      eventId: coupon.eventId,
      campaignId: coupon.campaignId,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue.toFixed(2),
      minimumOrderAmount:
        coupon.minimumOrderAmount?.toFixed(2) ?? null,
      maximumDiscount:
        coupon.maximumDiscount?.toFixed(2) ?? null,
      maximumUses: coupon.maximumUses,
      usesPerCustomer: coupon.usesPerCustomer,
      currentUses: coupon.currentUses,
      startsAt: coupon.startsAt,
      expiresAt: coupon.expiresAt,
      currency,
    },
    amounts: {
      subtotal: subtotal.toFixed(2),
      platformFee: platformFee.toFixed(2),
      discountAmount:
        calculation.discountAmount.toFixed(2),
      discountedSubtotal:
        calculation.discountedSubtotal.toFixed(2),
      discountedPlatformFee:
        calculation.discountedPlatformFee.toFixed(2),
      total: calculation.finalTotal.toFixed(2),
      currency,
    },
  };
}
