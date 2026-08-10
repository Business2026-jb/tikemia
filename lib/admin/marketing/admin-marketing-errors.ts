import "server-only";

export type AdminMarketingErrorCode =
  | "ADMIN_MARKETING_ID_REQUIRED"
  | "ADMIN_MARKETING_NOT_FOUND"
  | "ADMIN_MARKETING_QUERY_FAILED"
  | "ADMIN_MARKETING_ACTION_INVALID"
  | "ADMIN_MARKETING_ACTION_NOT_ALLOWED"
  | "ADMIN_MARKETING_REASON_REQUIRED"
  | "ADMIN_MARKETING_PERIOD_INVALID"
  | "ADMIN_MARKETING_BUDGET_INVALID"
  | "ADMIN_MARKETING_PRIORITY_INVALID"
  | "ADMIN_MARKETING_EXPORT_FAILED";

export class AdminMarketingError extends Error {
  readonly code: AdminMarketingErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor({
    code,
    message,
    status = 400,
    details,
    cause,
  }: {
    code: AdminMarketingErrorCode;
    message: string;
    status?: number;
    details?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(message, { cause });

    this.name = "AdminMarketingError";
    this.code = code;
    this.status = status;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function serializeAdminMarketingError(error: unknown) {
  if (error instanceof AdminMarketingError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
      details: error.details ?? null,
    };
  }

  return {
    code: "ADMIN_MARKETING_INTERNAL_ERROR",
    message:
      "Une erreur est survenue pendant le traitement de la campagne marketing.",
    status: 500,
    details: null,
  };
}
