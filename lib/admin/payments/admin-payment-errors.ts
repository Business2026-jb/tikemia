import "server-only";

export type AdminPaymentErrorCode =
  | "ADMIN_PAYMENT_ID_REQUIRED"
  | "ADMIN_PAYMENT_NOT_FOUND"
  | "ADMIN_PAYMENT_QUERY_INVALID"
  | "ADMIN_PAYMENT_DATE_INVALID"
  | "ADMIN_PAYMENT_EXPORT_FAILED";

export class AdminPaymentError extends Error {
  readonly code: AdminPaymentErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor({
    code,
    message,
    status = 400,
    details,
    cause,
  }: {
    code: AdminPaymentErrorCode;
    message: string;
    status?: number;
    details?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(message, { cause });

    this.name = "AdminPaymentError";
    this.code = code;
    this.status = status;
    this.details = details;

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }
}

export function serializeAdminPaymentError(
  error: unknown,
): {
  code:
    | AdminPaymentErrorCode
    | "ADMIN_PAYMENT_INTERNAL_ERROR";
  message: string;
  status: number;
  details?: Record<string, unknown>;
} {
  if (error instanceof AdminPaymentError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    code: "ADMIN_PAYMENT_INTERNAL_ERROR",
    message:
      "Une erreur est survenue pendant le traitement des paiements.",
    status: 500,
  };
}
