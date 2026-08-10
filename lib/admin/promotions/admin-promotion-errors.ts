import "server-only";

export type AdminPromotionErrorCode =
  | "ADMIN_PROMOTION_ID_REQUIRED"
  | "ADMIN_PROMOTION_NOT_FOUND"
  | "ADMIN_PROMOTION_QUERY_FAILED"
  | "ADMIN_PROMOTION_ACTION_NOT_ALLOWED"
  | "ADMIN_PROMOTION_EVENT_NOT_PUBLISHED"
  | "ADMIN_PROMOTION_PERIOD_INVALID"
  | "ADMIN_PROMOTION_PRIORITY_INVALID"
  | "ADMIN_PROMOTION_REASON_REQUIRED"
  | "ADMIN_PROMOTION_EXPORT_FAILED";

export class AdminPromotionError extends Error {
  readonly code: AdminPromotionErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor({
    code,
    message,
    status = 400,
    details,
    cause,
  }: {
    code: AdminPromotionErrorCode;
    message: string;
    status?: number;
    details?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(message, { cause });
    this.name = "AdminPromotionError";
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function serializeAdminPromotionError(error: unknown) {
  if (error instanceof AdminPromotionError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
      details: error.details ?? null,
    };
  }

  return {
    code: "ADMIN_PROMOTION_INTERNAL_ERROR",
    message: "Une erreur est survenue pendant le traitement de la promotion.",
    status: 500,
    details: null,
  };
}
