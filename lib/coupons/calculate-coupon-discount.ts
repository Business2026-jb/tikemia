import "server-only";

import {
  Prisma,
  PromoDiscountType,
} from "@prisma/client";

import { CouponError } from "@/lib/coupons/coupon-errors";

export type CalculateCouponDiscountInput = Readonly<{
  discountType: PromoDiscountType;
  discountValue: Prisma.Decimal.Value;
  subtotal: Prisma.Decimal.Value;
  platformFee?: Prisma.Decimal.Value | null;
  maximumDiscount?: Prisma.Decimal.Value | null;
}>;

export type CouponDiscountCalculation = Readonly<{
  discountAmount: Prisma.Decimal;
  discountedSubtotal: Prisma.Decimal;
  discountedPlatformFee: Prisma.Decimal;
  finalTotal: Prisma.Decimal;
}>;

function decimal(value: Prisma.Decimal.Value): Prisma.Decimal {
  try {
    return new Prisma.Decimal(value);
  } catch {
    throw new CouponError({
      code: "COUPON_DISCOUNT_INVALID",
      message: "Le montant de la réduction est invalide.",
      status: 422,
    });
  }
}

function clamp(
  value: Prisma.Decimal,
  minimum: Prisma.Decimal,
  maximum: Prisma.Decimal,
): Prisma.Decimal {
  if (value.lessThan(minimum)) return minimum;
  if (value.greaterThan(maximum)) return maximum;
  return value;
}

export function calculateCouponDiscount(
  input: CalculateCouponDiscountInput,
): CouponDiscountCalculation {
  const zero = new Prisma.Decimal(0);
  const subtotal = decimal(input.subtotal);
  const platformFee = decimal(input.platformFee ?? 0);
  const discountValue = decimal(input.discountValue);

  if (subtotal.isNegative() || platformFee.isNegative()) {
    throw new CouponError({
      code: "COUPON_DISCOUNT_INVALID",
      message: "Le montant de la commande est invalide.",
      status: 422,
    });
  }

  if (discountValue.isNegative()) {
    throw new CouponError({
      code: "COUPON_DISCOUNT_INVALID",
      message: "La valeur de la réduction est invalide.",
      status: 422,
    });
  }

  let rawDiscount = zero;

  switch (input.discountType) {
    case PromoDiscountType.PERCENTAGE: {
      if (discountValue.greaterThan(100)) {
        throw new CouponError({
          code: "COUPON_DISCOUNT_INVALID",
          message:
            "Le pourcentage de réduction ne peut pas dépasser 100 %.",
          status: 422,
        });
      }

      rawDiscount = subtotal
        .mul(discountValue)
        .div(100);
      break;
    }

    case PromoDiscountType.FIXED_AMOUNT: {
      rawDiscount = discountValue;
      break;
    }

    case PromoDiscountType.SERVICE_FEE: {
      rawDiscount = platformFee;
      break;
    }

    default: {
      throw new CouponError({
        code: "COUPON_DISCOUNT_INVALID",
        message: "Le type de réduction est invalide.",
        status: 422,
      });
    }
  }

  if (input.maximumDiscount !== null &&
      input.maximumDiscount !== undefined) {
    const maximumDiscount = decimal(input.maximumDiscount);

    if (maximumDiscount.isNegative()) {
      throw new CouponError({
        code: "COUPON_DISCOUNT_INVALID",
        message:
          "Le plafond de réduction est invalide.",
        status: 422,
      });
    }

    rawDiscount = Prisma.Decimal.min(
      rawDiscount,
      maximumDiscount,
    );
  }

  if (input.discountType === PromoDiscountType.SERVICE_FEE) {
    const discountedPlatformFee = clamp(
      platformFee.minus(rawDiscount),
      zero,
      platformFee,
    );

    return {
      discountAmount: platformFee.minus(discountedPlatformFee),
      discountedSubtotal: subtotal,
      discountedPlatformFee,
      finalTotal: subtotal.plus(discountedPlatformFee),
    };
  }

  const discountAmount = clamp(
    rawDiscount,
    zero,
    subtotal,
  );

  const discountedSubtotal = subtotal.minus(discountAmount);

  return {
    discountAmount,
    discountedSubtotal,
    discountedPlatformFee: platformFee,
    finalTotal: discountedSubtotal.plus(platformFee),
  };
}
