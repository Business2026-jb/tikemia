export type MonerooErrorDetails = Readonly<{
  status?: number;
  code?: string | null;
  endpoint?: string;
  method?: string;
  responseBody?: unknown;
  cause?: unknown;
}>;

export class MonerooError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly endpoint: string | null;
  readonly method: string | null;
  readonly responseBody: unknown;

  constructor(
    message: string,
    code: string,
    details: MonerooErrorDetails = {},
  ) {
    super(message, { cause: details.cause });

    this.name = new.target.name;
    this.code = code;
    this.status = details.status ?? null;
    this.endpoint = details.endpoint ?? null;
    this.method = details.method ?? null;
    this.responseBody = details.responseBody;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class MonerooConfigurationError extends MonerooError {
  readonly environmentVariable: string | null;

  constructor(message: string, environmentVariable?: string, cause?: unknown) {
    super(message, "MONEROO_CONFIGURATION_ERROR", { cause });
    this.environmentVariable = environmentVariable ?? null;
  }
}

export class MonerooRequestError extends MonerooError {
  constructor(message: string, details: MonerooErrorDetails = {}) {
    super(message, "MONEROO_REQUEST_ERROR", details);
  }
}

export class MonerooTimeoutError extends MonerooError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number, details: MonerooErrorDetails = {}) {
    super(
      `La requête Moneroo a dépassé le délai maximal de ${timeoutMs} ms.`,
      "MONEROO_REQUEST_TIMEOUT",
      details,
    );
    this.timeoutMs = timeoutMs;
  }
}

export class MonerooApiError extends MonerooError {
  constructor(message: string, details: MonerooErrorDetails = {}) {
    super(message, "MONEROO_API_ERROR", details);
  }
}

export class MonerooAuthenticationError extends MonerooApiError {
  constructor(details: MonerooErrorDetails = {}) {
    super(
      "Moneroo a refusé l'authentification. Vérifie la clé secrète utilisée.",
      { ...details, code: "MONEROO_AUTHENTICATION_ERROR" },
    );
    this.name = "MonerooAuthenticationError";
  }
}

export class MonerooValidationError extends MonerooApiError {
  constructor(message: string, details: MonerooErrorDetails = {}) {
    super(message, { ...details, code: "MONEROO_VALIDATION_ERROR" });
    this.name = "MonerooValidationError";
  }
}

export class MonerooPaymentNotFoundError extends MonerooApiError {
  readonly paymentId: string;

  constructor(paymentId: string, details: MonerooErrorDetails = {}) {
    super(`Le paiement Moneroo ${paymentId} est introuvable.`, {
      ...details,
      code: "MONEROO_PAYMENT_NOT_FOUND",
    });
    this.name = "MonerooPaymentNotFoundError";
    this.paymentId = paymentId;
  }
}

export class MonerooResponseError extends MonerooError {
  constructor(message: string, details: MonerooErrorDetails = {}) {
    super(message, "MONEROO_RESPONSE_INVALID", details);
  }
}

export class MonerooWebhookSignatureError extends MonerooError {
  constructor(
    message = "La signature du webhook Moneroo est invalide.",
    cause?: unknown,
  ) {
    super(message, "MONEROO_WEBHOOK_SIGNATURE_INVALID", { cause });
  }
}
