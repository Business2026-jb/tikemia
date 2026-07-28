export type PaymentErrorCode =
  | "PAYMENT_CONFIGURATION_ERROR"
  | "PAYMENT_PROVIDER_UNAVAILABLE"
  | "PAYMENT_PROVIDER_REQUEST_FAILED"
  | "PAYMENT_PROVIDER_RESPONSE_INVALID"
  | "PAYMENT_PROVIDER_AUTHENTICATION_FAILED"
  | "PAYMENT_PROVIDER_RATE_LIMITED"
  | "PAYMENT_PROVIDER_TIMEOUT"
  | "PAYMENT_PROVIDER_TRANSACTION_NOT_FOUND"
  | "PAYMENT_PROVIDER_TRANSACTION_INVALID"
  | "PAYMENT_WEBHOOK_INVALID"
  | "PAYMENT_WEBHOOK_SIGNATURE_INVALID"
  | "PAYMENT_WEBHOOK_EVENT_ALREADY_PROCESSED"
  | "PAYMENT_WEBHOOK_EVENT_UNSUPPORTED"
  | "PAYMENT_ORDER_NOT_FOUND"
  | "PAYMENT_ORDER_NOT_PAYABLE"
  | "PAYMENT_ORDER_ALREADY_PAID"
  | "PAYMENT_ORDER_EXPIRED"
  | "PAYMENT_ORDER_OWNERSHIP_MISMATCH"
  | "PAYMENT_AMOUNT_MISMATCH"
  | "PAYMENT_CURRENCY_MISMATCH"
  | "PAYMENT_REFERENCE_MISMATCH"
  | "PAYMENT_TRANSACTION_MISMATCH"
  | "PAYMENT_STATUS_INVALID"
  | "PAYMENT_RESERVATION_NOT_FOUND"
  | "PAYMENT_RESERVATION_EXPIRED"
  | "PAYMENT_RESERVATION_CONFLICT"
  | "PAYMENT_STOCK_INSUFFICIENT"
  | "PAYMENT_IDEMPOTENCY_CONFLICT"
  | "PAYMENT_FINALIZATION_FAILED"
  | "PAYMENT_TICKET_ISSUANCE_FAILED"
  | "PAYMENT_REFUND_FAILED"
  | "PAYMENT_UNAUTHORIZED"
  | "PAYMENT_FORBIDDEN"
  | "PAYMENT_INVALID_REQUEST"
  | "PAYMENT_INTERNAL_ERROR";

export type PaymentErrorDetails = Readonly<
  Record<string, unknown>
>;

export type PaymentErrorOptions = {
  code: PaymentErrorCode;
  message: string;
  status?: number;
  retryable?: boolean;
  exposeMessage?: boolean;
  provider?: string | null;
  providerReference?: string | null;
  paymentId?: string | null;
  orderId?: string | null;
  details?: PaymentErrorDetails;
  cause?: unknown;
};

export type SerializedPaymentError = {
  success: false;

  error: {
    code: PaymentErrorCode;
    message: string;
    retryable: boolean;
    provider: string | null;
    providerReference: string | null;
    paymentId: string | null;
    orderId: string | null;
    details?: PaymentErrorDetails;
  };
};

const DEFAULT_PAYMENT_ERROR_MESSAGE =
  "Une erreur est survenue pendant le traitement du paiement.";

const SENSITIVE_DETAIL_KEYS = new Set([
  "authorization",
  "cookie",
  "cookies",
  "secret",
  "secretkey",
  "secret_key",
  "apikey",
  "api_key",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "signature",
  "webhooksecret",
  "webhook_secret",
  "cardnumber",
  "card_number",
  "pan",
  "cvv",
  "cvc",
  "password",
]);

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeNullableText(
  value:
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    normalizeText(
      value,
    );

  return normalized || null;
}

function normalizeStatus(
  value:
    number
    | undefined,
): number {
  if (
    Number.isInteger(
      value,
    ) &&
    value! >= 400 &&
    value! <= 599
  ) {
    return value!;
  }

  return 500;
}

function shouldRetryByStatus(
  status:
    number,
): boolean {
  return (
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}

function sanitizeUnknownValue(
  value:
    unknown,
  depth = 0,
): unknown {
  if (depth > 4) {
    return "[TRUNCATED]";
  }

  if (
    value === null ||
    typeof value ===
      "string" ||
    typeof value ===
      "number" ||
    typeof value ===
      "boolean"
  ) {
    return value;
  }

  if (
    value instanceof
    Date
  ) {
    return value.toISOString();
  }

  if (
    value instanceof
    Error
  ) {
    return {
      name:
        value.name,

      message:
        value.message,
    };
  }

  if (
    Array.isArray(
      value,
    )
  ) {
    return value
      .slice(
        0,
        50,
      )
      .map(
        (
          item,
        ) =>
          sanitizeUnknownValue(
            item,
            depth +
              1,
          ),
      );
  }

  if (
    typeof value ===
      "object"
  ) {
    const sanitizedEntries =
      Object.entries(
        value as Record<
          string,
          unknown
        >,
      )
        .slice(
          0,
          100,
        )
        .map(
          ([
            key,
            item,
          ]) => {
            const normalizedKey =
              key
                .replace(
                  /[^a-zA-Z0-9_]/g,
                  "",
                )
                .toLowerCase();

            if (
              SENSITIVE_DETAIL_KEYS.has(
                normalizedKey,
              )
            ) {
              return [
                key,
                "[REDACTED]",
              ];
            }

            return [
              key,
              sanitizeUnknownValue(
                item,
                depth +
                  1,
              ),
            ];
          },
        );

    return Object.fromEntries(
      sanitizedEntries,
    );
  }

  return String(
    value,
  );
}

function sanitizeDetails(
  details:
    PaymentErrorDetails
    | undefined,
): PaymentErrorDetails | undefined {
  if (!details) {
    return undefined;
  }

  const sanitized =
    sanitizeUnknownValue(
      details,
    );

  if (
    !sanitized ||
    typeof sanitized !==
      "object" ||
    Array.isArray(
      sanitized,
    )
  ) {
    return undefined;
  }

  return sanitized as PaymentErrorDetails;
}

export class PaymentError extends Error {
  readonly code:
    PaymentErrorCode;

  readonly status:
    number;

  readonly retryable:
    boolean;

  readonly exposeMessage:
    boolean;

  readonly provider:
    string | null;

  readonly providerReference:
    string | null;

  readonly paymentId:
    string | null;

  readonly orderId:
    string | null;

  readonly details:
    PaymentErrorDetails | undefined;

  override readonly cause:
    unknown;

  constructor({
    code,
    message,
    status,
    retryable,
    exposeMessage = true,
    provider,
    providerReference,
    paymentId,
    orderId,
    details,
    cause,
  }: PaymentErrorOptions) {
    const normalizedMessage =
      normalizeText(
        message,
      ) ||
      DEFAULT_PAYMENT_ERROR_MESSAGE;

    super(
      normalizedMessage,
    );

    this.name =
      "PaymentError";

    this.code =
      code;

    this.status =
      normalizeStatus(
        status,
      );

    this.retryable =
      retryable ??
      shouldRetryByStatus(
        this.status,
      );

    this.exposeMessage =
      exposeMessage;

    this.provider =
      normalizeNullableText(
        provider,
      );

    this.providerReference =
      normalizeNullableText(
        providerReference,
      );

    this.paymentId =
      normalizeNullableText(
        paymentId,
      );

    this.orderId =
      normalizeNullableText(
        orderId,
      );

    this.details =
      sanitizeDetails(
        details,
      );

    this.cause =
      cause;
  }

  toJSON(): SerializedPaymentError {
    return {
      success:
        false,

      error: {
        code:
          this.code,

        message:
          this.exposeMessage
            ? this.message
            : DEFAULT_PAYMENT_ERROR_MESSAGE,

        retryable:
          this.retryable,

        provider:
          this.provider,

        providerReference:
          this.providerReference,

        paymentId:
          this.paymentId,

        orderId:
          this.orderId,

        ...(this.details
          ? {
              details:
                this.details,
            }
          : {}),
      },
    };
  }
}

export class PaymentProviderError extends PaymentError {
  constructor(
    options: Omit<
      PaymentErrorOptions,
      "code"
    > & {
      code?:
        Extract<
          PaymentErrorCode,
          | "PAYMENT_PROVIDER_UNAVAILABLE"
          | "PAYMENT_PROVIDER_REQUEST_FAILED"
          | "PAYMENT_PROVIDER_RESPONSE_INVALID"
          | "PAYMENT_PROVIDER_AUTHENTICATION_FAILED"
          | "PAYMENT_PROVIDER_RATE_LIMITED"
          | "PAYMENT_PROVIDER_TIMEOUT"
          | "PAYMENT_PROVIDER_TRANSACTION_NOT_FOUND"
          | "PAYMENT_PROVIDER_TRANSACTION_INVALID"
        >;
    },
  ) {
    super({
      ...options,

      code:
        options.code ??
        "PAYMENT_PROVIDER_REQUEST_FAILED",
    });

    this.name =
      "PaymentProviderError";
  }
}

export class PaymentWebhookError extends PaymentError {
  constructor(
    options: Omit<
      PaymentErrorOptions,
      "code"
    > & {
      code?:
        Extract<
          PaymentErrorCode,
          | "PAYMENT_WEBHOOK_INVALID"
          | "PAYMENT_WEBHOOK_SIGNATURE_INVALID"
          | "PAYMENT_WEBHOOK_EVENT_ALREADY_PROCESSED"
          | "PAYMENT_WEBHOOK_EVENT_UNSUPPORTED"
        >;
    },
  ) {
    super({
      ...options,

      code:
        options.code ??
        "PAYMENT_WEBHOOK_INVALID",
    });

    this.name =
      "PaymentWebhookError";
  }
}

export class PaymentValidationError extends PaymentError {
  constructor(
    options: Omit<
      PaymentErrorOptions,
      "code"
    > & {
      code?:
        Extract<
          PaymentErrorCode,
          | "PAYMENT_INVALID_REQUEST"
          | "PAYMENT_AMOUNT_MISMATCH"
          | "PAYMENT_CURRENCY_MISMATCH"
          | "PAYMENT_REFERENCE_MISMATCH"
          | "PAYMENT_TRANSACTION_MISMATCH"
          | "PAYMENT_STATUS_INVALID"
          | "PAYMENT_ORDER_NOT_FOUND"
          | "PAYMENT_ORDER_NOT_PAYABLE"
          | "PAYMENT_ORDER_ALREADY_PAID"
          | "PAYMENT_ORDER_EXPIRED"
          | "PAYMENT_ORDER_OWNERSHIP_MISMATCH"
          | "PAYMENT_RESERVATION_NOT_FOUND"
          | "PAYMENT_RESERVATION_EXPIRED"
          | "PAYMENT_RESERVATION_CONFLICT"
          | "PAYMENT_STOCK_INSUFFICIENT"
          | "PAYMENT_IDEMPOTENCY_CONFLICT"
          | "PAYMENT_UNAUTHORIZED"
          | "PAYMENT_FORBIDDEN"
        >;
    },
  ) {
    super({
      ...options,

      code:
        options.code ??
        "PAYMENT_INVALID_REQUEST",

      status:
        options.status ??
        400,

      retryable:
        options.retryable ??
        false,
    });

    this.name =
      "PaymentValidationError";
  }
}

export function isPaymentError(
  error:
    unknown,
): error is PaymentError {
  return (
    error instanceof
    PaymentError
  );
}

export function getPaymentError(
  error:
    unknown,
  fallback?: Partial<
    PaymentErrorOptions
  >,
): PaymentError {
  if (
    isPaymentError(
      error,
    )
  ) {
    return error;
  }

  const message =
    error instanceof
      Error
      ? error.message
      : DEFAULT_PAYMENT_ERROR_MESSAGE;

  return new PaymentError({
    code:
      fallback?.code ??
      "PAYMENT_INTERNAL_ERROR",

    message:
      fallback?.message ??
      message,

    status:
      fallback?.status ??
      500,

    retryable:
      fallback?.retryable,

    exposeMessage:
      fallback?.exposeMessage ??
      false,

    provider:
      fallback?.provider,

    providerReference:
      fallback?.providerReference,

    paymentId:
      fallback?.paymentId,

    orderId:
      fallback?.orderId,

    details:
      fallback?.details,

    cause:
      error,
  });
}

export function serializePaymentError(
  error:
    unknown,
  fallback?: Partial<
    PaymentErrorOptions
  >,
): SerializedPaymentError {
  return getPaymentError(
    error,
    fallback,
  ).toJSON();
}

export function getPaymentErrorLogContext(
  error:
    unknown,
): Record<
  string,
  unknown
> {
  const paymentError =
    getPaymentError(
      error,
      {
        exposeMessage:
          false,
      },
    );

  return {
    name:
      paymentError.name,

    code:
      paymentError.code,

    message:
      paymentError.message,

    status:
      paymentError.status,

    retryable:
      paymentError.retryable,

    provider:
      paymentError.provider,

    providerReference:
      paymentError.providerReference,

    paymentId:
      paymentError.paymentId,

    orderId:
      paymentError.orderId,

    details:
      paymentError.details,

    cause:
      paymentError.cause instanceof
        Error
        ? {
            name:
              paymentError.cause.name,

            message:
              paymentError.cause.message,
          }
        : sanitizeUnknownValue(
            paymentError.cause,
          ),
  };
}