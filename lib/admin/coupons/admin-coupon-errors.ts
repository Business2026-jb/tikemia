import "server-only";

export type AdminCouponErrorCode =
  | "ADMIN_COUPON_ID_REQUIRED"
  | "ADMIN_COUPON_NOT_FOUND"
  | "ADMIN_COUPON_QUERY_FAILED"
  | "ADMIN_COUPON_ACTION_NOT_ALLOWED"
  | "ADMIN_COUPON_REASON_REQUIRED"
  | "ADMIN_COUPON_PERIOD_INVALID"
  | "ADMIN_COUPON_VALUE_INVALID"
  | "ADMIN_COUPON_LIMIT_INVALID"
  | "ADMIN_COUPON_EXPORT_FAILED";

export class AdminCouponError extends Error {
  readonly code: AdminCouponErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown> | null;

  constructor({
    code,
    message,
    status = 400,
    details = null,
    cause,
  }: {
    code: AdminCouponErrorCode;
    message: string;
    status?: number;
    details?: Record<string, unknown> | null;
    cause?: unknown;
  }) {
    super(message, { cause });
    this.name = "AdminCouponError";
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function serializeAdminCouponError(error: unknown) {
  if (error instanceof AdminCouponError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    code: "ADMIN_COUPON_QUERY_FAILED",
    message: "Une erreur est survenue pendant le traitement du code promo.",
    status: 500,
    details: null,
  };
}
