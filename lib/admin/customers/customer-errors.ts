import "server-only";

export type AdminCustomerErrorCode =
  | "ADMIN_CUSTOMER_ID_REQUIRED"
  | "ADMIN_CUSTOMER_NOT_FOUND"
  | "ADMIN_CUSTOMER_IDENTIFIER_INVALID"
  | "ADMIN_CUSTOMERS_QUERY_INVALID"
  | "ADMIN_CUSTOMERS_EXPORT_FAILED";

export class AdminCustomerError extends Error {
  readonly code: AdminCustomerErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor({
    message,
    code,
    status = 400,
    details,
    cause,
  }: {
    message: string;
    code: AdminCustomerErrorCode;
    status?: number;
    details?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(message, { cause });

    this.name = "AdminCustomerError";
    this.code = code;
    this.status = status;
    this.details = details;

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }
}

export function serializeAdminCustomerError(
  error: unknown,
): {
  code: AdminCustomerErrorCode | "ADMIN_CUSTOMERS_INTERNAL_ERROR";
  message: string;
  status: number;
  details?: Record<string, unknown>;
} {
  if (error instanceof AdminCustomerError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
      details: error.details,
    };
  }

  return {
    code: "ADMIN_CUSTOMERS_INTERNAL_ERROR",
    message:
      "Une erreur est survenue pendant le traitement des clients.",
    status: 500,
  };
}
