export type RefundErrorCode =
  | "REFUND_INVALID_INPUT"
  | "REFUND_NOT_ELIGIBLE"
  | "REFUND_WINDOW_EXPIRED"
  | "REFUND_TICKET_ALREADY_USED"
  | "REFUND_AMOUNT_INVALID"
  | "REFUND_PROVIDER_UNSUPPORTED"
  | "REFUND_PROVIDER_NOT_IMPLEMENTED"
  | "REFUND_PROVIDER_REQUEST_FAILED"
  | "REFUND_EMAIL_CONFIGURATION_ERROR"
  | "REFUND_EMAIL_SEND_FAILED";

export class RefundError extends Error {
  readonly code: RefundErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor({
    code,
    message,
    status = 400,
    retryable = false,
    cause,
  }: {
    code: RefundErrorCode;
    message: string;
    status?: number;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(message);
    this.name = "RefundError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isRefundError(error: unknown): error is RefundError {
  return error instanceof RefundError;
}
