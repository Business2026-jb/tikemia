import { CouponError } from "@/lib/coupons/coupon-errors";

const MAX_COUPON_CODE_LENGTH = 100;

export function normalizeCouponCode(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();

  if (!normalized) {
    throw new CouponError({
      code: "COUPON_CODE_REQUIRED",
      message: "Le code promo est obligatoire.",
      status: 400,
    });
  }

  if (normalized.length > MAX_COUPON_CODE_LENGTH) {
    throw new CouponError({
      code: "COUPON_CODE_INVALID",
      message: "Le code promo est trop long.",
      status: 400,
    });
  }

  if (!/^[A-Z0-9_-]+$/.test(normalized)) {
    throw new CouponError({
      code: "COUPON_CODE_INVALID",
      message:
        "Le code promo contient des caractères non autorisés.",
      status: 400,
    });
  }

  return normalized;
}
