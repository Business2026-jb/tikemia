export type ScannerErrorCode =
  | "SCANNER_UNAUTHENTICATED"
  | "SCANNER_FORBIDDEN"
  | "SCANNER_SESSION_EXPIRED"
  | "SCANNER_EVENT_NOT_FOUND"
  | "SCANNER_ASSIGNMENT_NOT_FOUND"
  | "SCANNER_ASSIGNMENT_DISABLED"
  | "SCANNER_EVENT_NOT_SCANNABLE"
  | "SCANNER_QR_REQUIRED"
  | "SCANNER_QR_INVALID"
  | "SCANNER_TICKET_NOT_FOUND"
  | "SCANNER_WRONG_EVENT"
  | "SCANNER_TICKET_ALREADY_USED"
  | "SCANNER_TICKET_CANCELLED"
  | "SCANNER_TICKET_REFUNDED"
  | "SCANNER_TICKET_REVOKED"
  | "SCANNER_TICKET_EXPIRED"
  | "SCANNER_SCAN_CONFLICT"
  | "SCANNER_DATABASE_ERROR"
  | "SCANNER_INTERNAL_ERROR";

export class ScannerError extends Error {
  readonly code: ScannerErrorCode;
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
    code: ScannerErrorCode;
    message: string;
    status?: number;
    retryable?: boolean;
    details?: Record<string, unknown> | null;
    cause?: unknown;
  }) {
    super(message, {
      cause,
    });

    this.name = "ScannerError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.details = details;

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }
}

export class ScannerAuthenticationError extends ScannerError {
  constructor(
    message =
      "Connectez-vous à votre espace scanner.",
  ) {
    super({
      code:
        "SCANNER_UNAUTHENTICATED",
      message,
      status:
        401,
      retryable:
        false,
    });

    this.name =
      "ScannerAuthenticationError";
  }
}

export class ScannerAuthorizationError extends ScannerError {
  constructor(
    message =
      "Vous n’êtes pas autorisé à scanner cet événement.",
    details:
      | Record<string, unknown>
      | null = null,
  ) {
    super({
      code:
        "SCANNER_FORBIDDEN",
      message,
      status:
        403,
      retryable:
        false,
      details,
    });

    this.name =
      "ScannerAuthorizationError";
  }
}

export function isScannerError(
  error: unknown,
): error is ScannerError {
  return error instanceof ScannerError;
}

export function serializeScannerError(
  error: unknown,
): {
  code: ScannerErrorCode;
  message: string;
  status: number;
  retryable: boolean;
  details: Record<string, unknown> | null;
} {
  if (
    error instanceof ScannerError
  ) {
    return {
      code:
        error.code,
      message:
        error.message,
      status:
        error.status,
      retryable:
        error.retryable,
      details:
        error.details,
    };
  }

  return {
    code:
      "SCANNER_INTERNAL_ERROR",
    message:
      "Une erreur interne est survenue pendant le scannage.",
    status:
      500,
    retryable:
      true,
    details:
      null,
  };
}
