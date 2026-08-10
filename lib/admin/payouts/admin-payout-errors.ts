import "server-only";

export type AdminPayoutErrorCode =
  | "ADMIN_PAYOUT_ID_REQUIRED"
  | "ADMIN_PAYOUT_NOT_FOUND"
  | "ADMIN_PAYOUT_QUERY_INVALID"
  | "ADMIN_PAYOUT_DATE_INVALID"
  | "ADMIN_PAYOUT_ACTION_NOT_ALLOWED"
  | "ADMIN_PAYOUT_ALREADY_PROCESSED"
  | "ADMIN_PAYOUT_REASON_REQUIRED"
  | "ADMIN_PAYOUT_INFORMATION_REQUIRED"
  | "ADMIN_PAYOUT_EXPORT_FAILED";

export class AdminPayoutError extends Error {
  readonly code: AdminPayoutErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor({
    code,
    message,
    status = 400,
    details,
    cause,
  }: {
    code: AdminPayoutErrorCode;
    message: string;
    status?: number;
    details?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(message, { cause });

    this.name = "AdminPayoutError";
    this.code = code;
    this.status = status;
    this.details = details;

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }
}

export function serializeAdminPayoutError(
  error: unknown,
): {
  code:
    | AdminPayoutErrorCode
    | "ADMIN_PAYOUT_INTERNAL_ERROR";
  message: string;
  status: number;
  details?: Record<string, unknown>;
} {
  if (error instanceof AdminPayoutError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    code: "ADMIN_PAYOUT_INTERNAL_ERROR",
    message:
      "Une erreur est survenue pendant le traitement de la demande de retrait.",
    status: 500,
  };
}
