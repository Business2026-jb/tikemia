import "server-only";

export type CouponErrorCode =
  | "COUPON_CODE_REQUIRED"
  | "COUPON_CODE_INVALID"
  | "COUPON_NOT_FOUND"
  | "COUPON_NOT_ACTIVE"
  | "COUPON_NOT_STARTED"
  | "COUPON_EXPIRED"
  | "COUPON_USAGE_LIMIT_REACHED"
  | "COUPON_CUSTOMER_LIMIT_REACHED"
  | "COUPON_MINIMUM_NOT_REACHED"
  | "COUPON_EVENT_MISMATCH"
  | "COUPON_CURRENCY_MISMATCH"
  | "COUPON_ORDER_NOT_FOUND"
  | "COUPON_ORDER_NOT_ELIGIBLE"
  | "COUPON_ALREADY_USED"
  | "COUPON_DISCOUNT_INVALID"
  | "COUPON_APPLY_FAILED"
  | "COUPON_REMOVE_FAILED"
  | "COUPON_USAGE_FAILED";

export class CouponError extends Error {
  readonly code: CouponErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly details: Record<string, unknown> | null;

  constructor({
    code,
    message,
    status = 400,
    retryable = false,
    details = null,
    cause,
  }: {
    code: CouponErrorCode;
    message: string;
    status?: number;
    retryable?: boolean;
    details?: Record<string, unknown> | null;
    cause?: unknown;
  }) {
    super(message, { cause });

    this.name = "CouponError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function serializeCouponError(error: unknown) {
  if (error instanceof CouponError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
      retryable: error.retryable,
      details: error.details,
    };
  }

  return {
    code: "COUPON_APPLY_FAILED" as const,
    message:
      "Une erreur est survenue pendant le traitement du code promo.",
    status: 500,
    retryable: true,
    details: null,
  };
}
