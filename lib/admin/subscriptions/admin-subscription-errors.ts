import "server-only";

export type AdminSubscriptionErrorCode =
  | "ADMIN_SUBSCRIPTION_ID_REQUIRED"
  | "ADMIN_SUBSCRIPTION_NOT_FOUND"
  | "ADMIN_SUBSCRIPTION_PLAN_NOT_FOUND"
  | "ADMIN_SUBSCRIPTION_QUERY_FAILED"
  | "ADMIN_SUBSCRIPTION_ACTION_NOT_ALLOWED"
  | "ADMIN_SUBSCRIPTION_ALREADY_ACTIVE"
  | "ADMIN_SUBSCRIPTION_ALREADY_PAUSED"
  | "ADMIN_SUBSCRIPTION_ALREADY_CANCELLED"
  | "ADMIN_SUBSCRIPTION_INVALID_DATE"
  | "ADMIN_SUBSCRIPTION_INVALID_DURATION"
  | "ADMIN_SUBSCRIPTION_REASON_REQUIRED"
  | "ADMIN_SUBSCRIPTION_EXPORT_FAILED";

export class AdminSubscriptionError extends Error {
  readonly code: AdminSubscriptionErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor({
    code,
    message,
    status = 400,
    details,
    cause,
  }: {
    code: AdminSubscriptionErrorCode;
    message: string;
    status?: number;
    details?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(message, {
      cause,
    });

    this.name =
      "AdminSubscriptionError";

    this.code =
      code;

    this.status =
      status;

    this.details =
      details;

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }
}

export function serializeAdminSubscriptionError(
  error: unknown,
): {
  code:
    | AdminSubscriptionErrorCode
    | "ADMIN_SUBSCRIPTION_INTERNAL_ERROR";
  message: string;
  status: number;
  details?: Record<string, unknown>;
} {
  if (
    error instanceof
    AdminSubscriptionError
  ) {
    return {
      code:
        error.code,
      message:
        error.message,
      status:
        error.status,
      details:
        error.details,
    };
  }

  return {
    code:
      "ADMIN_SUBSCRIPTION_INTERNAL_ERROR",
    message:
      "Une erreur est survenue pendant le traitement de l’abonnement.",
    status:
      500,
  };
}
