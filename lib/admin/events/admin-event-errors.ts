import "server-only";

export type AdminEventErrorCode =
  | "ADMIN_EVENT_ID_REQUIRED"
  | "ADMIN_EVENT_NOT_FOUND"
  | "ADMIN_EVENT_QUERY_INVALID"
  | "ADMIN_EVENT_ACTION_INVALID"
  | "ADMIN_EVENT_ACTION_NOT_ALLOWED"
  | "ADMIN_EVENT_REASON_REQUIRED"
  | "ADMIN_EVENT_DELETE_NOT_ALLOWED"
  | "ADMIN_EVENT_DELETE_BLOCKED"
  | "ADMIN_EVENT_ADMIN_ID_REQUIRED";

export class AdminEventError extends Error {
  readonly code: AdminEventErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor({
    code,
    message,
    status = 400,
    details,
    cause,
  }: {
    code: AdminEventErrorCode;
    message: string;
    status?: number;
    details?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(message, {
      cause,
    });

    this.name =
      "AdminEventError";

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

export function serializeAdminEventError(
  error: unknown,
): {
  code:
    | AdminEventErrorCode
    | "ADMIN_EVENT_INTERNAL_ERROR";
  message: string;
  status: number;
  details?: Record<string, unknown>;
} {
  if (
    error instanceof
    AdminEventError
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
      "ADMIN_EVENT_INTERNAL_ERROR",

    message:
      "Une erreur est survenue pendant le traitement de l’événement.",

    status:
      500,
  };
}
