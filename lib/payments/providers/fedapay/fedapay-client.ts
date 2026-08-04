import "server-only";

import {
  getFedaPayConfig,
  type FedaPayConfig,
} from "@/lib/payments/providers/fedapay/config";
import {
  PaymentProviderError,
  PaymentValidationError,
  getPaymentErrorLogContext,
} from "@/lib/payments/payment-errors";

export type FedaPayTransactionStatus =
  | "pending"
  | "approved"
  | "canceled"
  | "declined"
  | "refunded"
  | "transferred"
  | "unknown";

export type FedaPayCustomerInput = {
  id?: number;
  email?: string;
  firstname?: string;
  lastname?: string;
  phoneNumber?: {
    number: string;
    country: string;
  };
};

export type CreateFedaPayTransactionInput = {
  amount: number;
  currency: string;
  description: string;
  callbackUrl?: string;
  customer?: FedaPayCustomerInput;
  metadata?: Record<string, unknown>;
};

export type FedaPayTransaction = {
  id: number;
  reference: string;
  amount: number;
  description: string;
  callbackUrl: string | null;
  status: FedaPayTransactionStatus;
  rawStatus: string;
  customerId: number | null;
  currencyId: number | null;
  mode: string | null;
  metadata: Record<string, unknown> | null;
  commission: number | null;
  fees: number | null;
  fixedCommission: number | null;
  amountTransferred: number | null;
  amountDebited: number | null;
  receiptUrl: string | null;
  paymentMethodId: number | null;
  transactionKey: string | null;
  merchantReference: string | null;
  accountId: number | null;
  balanceId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  approvedAt: string | null;
  canceledAt: string | null;
  declinedAt: string | null;
  refundedAt: string | null;
  transferredAt: string | null;
  deletedAt: string | null;
  lastErrorCode: string | null;
  customMetadata: Record<string, unknown> | null;
  raw: Record<string, unknown>;
};

export type FedaPayPaymentLink = {
  token: string;
  url: string;
};

type FedaPayRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

type FedaPayErrorPayload = {
  message?: unknown;
  error?: unknown;
  errors?: unknown;
  code?: unknown;
};

const MAX_ERROR_BODY_LENGTH =
  4_000;

const PAYMENT_LINK_RETRY_DELAYS_MS =
  [
    0,
    500,
    1_500,
    3_000,
  ] as const;

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeCurrency(
  value:
    string,
): string {
  const currency =
    normalizeText(
      value,
    ).toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(
      currency,
    )
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        "La devise du paiement est invalide.",

      status:
        400,

      details: {
        field:
          "currency",
      },
    });
  }

  return currency;
}

function normalizePositiveInteger({
  value,
  field,
}: {
  value:
    number;
  field:
    string;
}): number {
  if (
    !Number.isSafeInteger(
      value,
    ) ||
    value <=
      0
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        `${field} doit être un entier strictement positif.`,

      status:
        400,

      details: {
        field,
      },
    });
  }

  return value;
}

function normalizeTransactionId(
  value:
    number,
): number {
  return normalizePositiveInteger({
    value,
    field:
      "transactionId",
  });
}

function normalizeDescription(
  value:
    string,
): string {
  const description =
    normalizeText(
      value,
    );

  if (
    description.length <
      3 ||
    description.length >
      255
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        "La description du paiement doit contenir entre 3 et 255 caractères.",

      status:
        400,

      details: {
        field:
          "description",
      },
    });
  }

  return description;
}

function normalizeAbsoluteUrl({
  value,
  field,
}: {
  value:
    string;
  field:
    string;
}): string {
  let parsedUrl:
    URL;

  try {
    parsedUrl =
      new URL(
        value,
      );
  } catch {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        `${field} doit contenir une URL absolue valide.`,

      status:
        400,

      details: {
        field,
      },
    });
  }

  if (
    parsedUrl.protocol !==
      "https:" &&
    !(
      process.env.NODE_ENV !==
        "production" &&
      parsedUrl.protocol ===
        "http:" &&
      (
        parsedUrl.hostname ===
          "localhost" ||
        parsedUrl.hostname ===
          "127.0.0.1"
      )
    )
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        `${field} doit utiliser HTTPS.`,

      status:
        400,

      details: {
        field,
      },
    });
  }

  parsedUrl.hash =
    "";

  return parsedUrl.toString();
}

function sanitizeMetadataValue(
  value:
    unknown,
  depth = 0,
): unknown {
  if (depth > 4) {
    return "[TRUNCATED]";
  }

  if (
    value ===
      null ||
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
          sanitizeMetadataValue(
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
    return Object.fromEntries(
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
          ]) => [
            key,
            sanitizeMetadataValue(
              item,
              depth +
                1,
            ),
          ]),
    );
  }

  return String(
    value,
  );
}

function sanitizeMetadata(
  metadata:
    Record<string, unknown>
    | undefined,
): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }

  const sanitized =
    sanitizeMetadataValue(
      metadata,
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

  return sanitized as Record<
    string,
    unknown
  >;
}

function normalizeCustomer(
  customer:
    FedaPayCustomerInput
    | undefined,
): Record<string, unknown> | undefined {
  if (!customer) {
    return undefined;
  }

  if (
    customer.id !==
      undefined
  ) {
    return {
      id:
        normalizePositiveInteger({
          value:
            customer.id,

          field:
            "customer.id",
        }),
    };
  }

  const email =
    normalizeText(
      customer.email,
    ).toLowerCase();

  const firstname =
    normalizeText(
      customer.firstname,
    );

  const lastname =
    normalizeText(
      customer.lastname,
    );

  if (
    !email ||
    !firstname ||
    !lastname
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        "Le prénom, le nom et l’adresse e-mail du client sont obligatoires.",

      status:
        400,

      details: {
        field:
          "customer",
      },
    });
  }

  /*
   * Le numéro saisi sur Tikemia sert uniquement aux communications,
   * à la livraison des billets et au suivi de la commande.
   *
   * Il n’est volontairement pas transmis à FedaPay, car le client
   * peut payer avec un autre numéro Mobile Money ou par carte bancaire.
   * Le numéro de paiement est demandé directement sur la page FedaPay.
   */
  return {
    email,
    firstname,
    lastname,
  };
}

function isRecord(
  value:
    unknown,
): value is Record<
  string,
  unknown
> {
  return (
    Boolean(
      value,
    ) &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value,
    )
  );
}

function readString(
  record:
    Record<string, unknown>,
  key:
    string,
): string | null {
  const value =
    record[
      key
    ];

  return typeof value ===
    "string"
    ? value
    : null;
}

function readNumber(
  record:
    Record<string, unknown>,
  key:
    string,
): number | null {
  const value =
    record[
      key
    ];

  if (
    typeof value ===
      "number" &&
    Number.isFinite(
      value,
    )
  ) {
    return value;
  }

  if (
    typeof value ===
      "string" &&
    value.trim() !==
      ""
  ) {
    const parsed =
      Number(
        value,
      );

    return Number.isFinite(
      parsed,
    )
      ? parsed
      : null;
  }

  return null;
}

function readObject(
  record:
    Record<string, unknown>,
  key:
    string,
): Record<string, unknown> | null {
  const value =
    record[
      key
    ];

  return isRecord(
    value,
  )
    ? value
    : null;
}

function unwrapRecordPayload({
  payload,
  preferredKeys,
}: {
  payload:
    unknown;
  preferredKeys:
    readonly string[];
}): Record<string, unknown> | null {
  if (
    !isRecord(
      payload,
    )
  ) {
    return null;
  }

  for (
    const key of
    preferredKeys
  ) {
    const nested =
      readObject(
        payload,
        key,
      );

    if (
      nested
    ) {
      return nested;
    }
  }

  return payload;
}

function getTransactionPayload(
  payload:
    unknown,
): Record<string, unknown> | null {
  return unwrapRecordPayload({
    payload,

    preferredKeys: [
      "transaction",
      "v1/transaction",
      "data",
      "resource",
      "response",
      "result",
    ],
  });
}

function getPaymentLinkPayload(
  payload:
    unknown,
): Record<string, unknown> | null {
  return unwrapRecordPayload({
    payload,

    preferredKeys: [
      "payment_link",
      "paymentLink",
      "v1/token",
      "token",
      "data",
      "resource",
      "response",
      "result",
    ],
  });
}

function normalizeTransactionStatus(
  value:
    string | null,
): FedaPayTransactionStatus {
  switch (
    normalizeText(
      value,
    ).toLowerCase()
  ) {
    case "pending":
      return "pending";

    case "approved":
      return "approved";

    case "canceled":
    case "cancelled":
      return "canceled";

    case "declined":
    case "failed":
      return "declined";

    case "refunded":
      return "refunded";

    case "transferred":
      return "transferred";

    default:
      return "unknown";
  }
}

function parseTransaction(
  payload:
    unknown,
): FedaPayTransaction {
  const transactionPayload =
    getTransactionPayload(
      payload,
    );

  if (
    !transactionPayload
  ) {
    throw new PaymentProviderError({
      code:
        "PAYMENT_PROVIDER_RESPONSE_INVALID",

      message:
        "FedaPay a retourné une transaction invalide.",

      status:
        502,

      provider:
        "FEDAPAY",
    });
  }

  const id =
    readNumber(
      transactionPayload,
      "id",
    );

  const reference =
    readString(
      transactionPayload,
      "reference",
    );

  const amount =
    readNumber(
      transactionPayload,
      "amount",
    );

  const description =
    readString(
      transactionPayload,
      "description",
    );

  const rawStatus =
    readString(
      transactionPayload,
      "status",
    );

  if (
    id ===
      null ||
    !reference ||
    amount ===
      null ||
    !description ||
    !rawStatus
  ) {
    throw new PaymentProviderError({
      code:
        "PAYMENT_PROVIDER_RESPONSE_INVALID",

      message:
        "La réponse de transaction FedaPay est incomplète.",

      status:
        502,

      provider:
        "FEDAPAY",

      details: {
        hasId:
          id !==
          null,

        hasReference:
          Boolean(
            reference,
          ),

        hasAmount:
          amount !==
          null,

        hasDescription:
          Boolean(
            description,
          ),

        hasStatus:
          Boolean(
            rawStatus,
          ),
      },
    });
  }

  return {
    id,
    reference,
    amount,
    description,

    callbackUrl:
      readString(
        transactionPayload,
        "callback_url",
      ),

    status:
      normalizeTransactionStatus(
        rawStatus,
      ),

    rawStatus,

    customerId:
      readNumber(
        transactionPayload,
        "customer_id",
      ),

    currencyId:
      readNumber(
        transactionPayload,
        "currency_id",
      ),

    mode:
      readString(
        transactionPayload,
        "mode",
      ),

    metadata:
      readObject(
        transactionPayload,
        "metadata",
      ),

    commission:
      readNumber(
        transactionPayload,
        "commission",
      ),

    fees:
      readNumber(
        transactionPayload,
        "fees",
      ),

    fixedCommission:
      readNumber(
        transactionPayload,
        "fixed_commission",
      ),

    amountTransferred:
      readNumber(
        transactionPayload,
        "amount_transferred",
      ),

    amountDebited:
      readNumber(
        transactionPayload,
        "amount_debited",
      ),

    receiptUrl:
      readString(
        transactionPayload,
        "receipt_url",
      ),

    paymentMethodId:
      readNumber(
        transactionPayload,
        "payment_method_id",
      ),

    transactionKey:
      readString(
        transactionPayload,
        "transaction_key",
      ),

    merchantReference:
      readString(
        transactionPayload,
        "merchant_reference",
      ),

    accountId:
      readNumber(
        transactionPayload,
        "account_id",
      ),

    balanceId:
      readNumber(
        transactionPayload,
        "balance_id",
      ),

    createdAt:
      readString(
        transactionPayload,
        "created_at",
      ),

    updatedAt:
      readString(
        transactionPayload,
        "updated_at",
      ),

    approvedAt:
      readString(
        transactionPayload,
        "approved_at",
      ),

    canceledAt:
      readString(
        transactionPayload,
        "canceled_at",
      ),

    declinedAt:
      readString(
        transactionPayload,
        "declined_at",
      ),

    refundedAt:
      readString(
        transactionPayload,
        "refunded_at",
      ),

    transferredAt:
      readString(
        transactionPayload,
        "transferred_at",
      ),

    deletedAt:
      readString(
        transactionPayload,
        "deleted_at",
      ),

    lastErrorCode:
      readString(
        transactionPayload,
        "last_error_code",
      ),

    customMetadata:
      readObject(
        transactionPayload,
        "custom_metadata",
      ),

    raw:
      transactionPayload,
  };
}

function parsePaymentLink(
  payload:
    unknown,
): FedaPayPaymentLink {
  const paymentLinkPayload =
    getPaymentLinkPayload(
      payload,
    );

  if (
    !paymentLinkPayload
  ) {
    throw new PaymentProviderError({
      code:
        "PAYMENT_PROVIDER_RESPONSE_INVALID",

      message:
        "FedaPay a retourné un lien de paiement invalide.",

      status:
        502,

      provider:
        "FEDAPAY",
    });
  }

  const token =
    readString(
      paymentLinkPayload,
      "token",
    );

  const rawUrl =
    readString(
      paymentLinkPayload,
      "url",
    );

  if (
    !token ||
    !rawUrl
  ) {
    throw new PaymentProviderError({
      code:
        "PAYMENT_PROVIDER_RESPONSE_INVALID",

      message:
        "Le token ou l’URL de paiement FedaPay est absent.",

      status:
        502,

      provider:
        "FEDAPAY",
    });
  }

  let parsedUrl:
    URL;

  try {
    parsedUrl =
      new URL(
        rawUrl,
      );
  } catch {
    throw new PaymentProviderError({
      code:
        "PAYMENT_PROVIDER_RESPONSE_INVALID",

      message:
        "L’URL de paiement retournée par FedaPay est invalide.",

      status:
        502,

      provider:
        "FEDAPAY",
    });
  }

  if (
    parsedUrl.protocol !==
      "https:"
  ) {
    throw new PaymentProviderError({
      code:
        "PAYMENT_PROVIDER_RESPONSE_INVALID",

      message:
        "L’URL de paiement FedaPay doit utiliser HTTPS.",

      status:
        502,

      provider:
        "FEDAPAY",
    });
  }

  return {
    token,
    url:
      parsedUrl.toString(),
  };
}

function extractProviderMessage(
  payload:
    unknown,
  fallback:
    string,
): string {
  if (
    !isRecord(
      payload,
    )
  ) {
    return fallback;
  }

  const typedPayload =
    payload as FedaPayErrorPayload;

  const directMessage =
    typeof typedPayload
      .message ===
      "string"
      ? typedPayload
          .message
      : null;

  if (directMessage) {
    return directMessage;
  }

  if (
    typeof typedPayload
      .error ===
      "string"
  ) {
    return typedPayload
      .error;
  }

  if (
    isRecord(
      typedPayload.error,
    )
  ) {
    const nestedMessage =
      readString(
        typedPayload.error,
        "message",
      );

    if (nestedMessage) {
      return nestedMessage;
    }
  }

  return fallback;
}

async function readResponsePayload(
  response:
    Response,
): Promise<unknown> {
  const contentType =
    response.headers.get(
      "content-type",
    ) ??
    "";

  const responseText =
    await response
      .text()
      .catch(
        () =>
          "",
      );

  if (
    !responseText
  ) {
    return null;
  }

  const normalizedText =
    responseText.trim();

  const shouldTryJson =
    contentType.includes(
      "application/json",
    ) ||
    contentType.includes(
      "+json",
    ) ||
    normalizedText.startsWith(
      "{",
    ) ||
    normalizedText.startsWith(
      "[",
    );

  if (
    shouldTryJson
  ) {
    try {
      return JSON.parse(
        normalizedText,
      ) as unknown;
    } catch {
      /*
       * Certaines réponses FedaPay peuvent annoncer un type non JSON
       * ou contenir une chaîne JSON. On tente un second décodage.
       */
      try {
        const firstPass =
          JSON.parse(
            JSON.stringify(
              normalizedText,
            ),
          );

        if (
          typeof firstPass ===
            "string"
        ) {
          return JSON.parse(
            firstPass,
          ) as unknown;
        }
      } catch {
        // La réponse restera disponible comme texte limité.
      }
    }
  }

  return normalizedText.slice(
    0,
    MAX_ERROR_BODY_LENGTH,
  );
}

function createProviderErrorFromResponse({
  response,
  payload,
  providerReference,
}: {
  response:
    Response;
  payload:
    unknown;
  providerReference?:
    string | null;
}): PaymentProviderError {
  const status =
    response.status;

  const fallbackMessage =
    status ===
      401
      ? "L’authentification auprès de FedaPay a échoué."
      : status ===
          404
        ? "La transaction FedaPay est introuvable."
        : status ===
            429
          ? "FedaPay limite temporairement les requêtes."
          : status >=
              500
            ? "FedaPay est temporairement indisponible."
            : "La requête envoyée à FedaPay a été refusée.";

  const code =
    status ===
      401
      ? "PAYMENT_PROVIDER_AUTHENTICATION_FAILED"
      : status ===
          404
        ? "PAYMENT_PROVIDER_TRANSACTION_NOT_FOUND"
        : status ===
            429
          ? "PAYMENT_PROVIDER_RATE_LIMITED"
          : status >=
              500
            ? "PAYMENT_PROVIDER_UNAVAILABLE"
            : "PAYMENT_PROVIDER_REQUEST_FAILED";

  return new PaymentProviderError({
    code,

    message:
      extractProviderMessage(
        payload,
        fallbackMessage,
      ),

    status:
      status >=
        400 &&
      status <=
        599
        ? status
        : 502,

    retryable:
      status ===
        408 ||
      status ===
        425 ||
      status ===
        429 ||
      status >=
        500,

    exposeMessage:
      status !==
      401,

    provider:
      "FEDAPAY",

    providerReference,

    details: {
      providerStatus:
        status,

      providerStatusText:
        response.statusText,
    },
  });
}

async function requestFedaPay<T>({
  config,
  path,
  options = {},
  parser,
  providerReference,
}: {
  config:
    FedaPayConfig;
  path:
    string;
  options?:
    FedaPayRequestOptions;
  parser:
    (
      payload:
        unknown,
    ) => T;
  providerReference?:
    string | null;
}): Promise<T> {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      config.requestTimeoutMs,
    );

  const externalSignal =
    options.signal;

  const abortFromExternalSignal =
    () =>
      controller.abort();

  if (externalSignal) {
    if (
      externalSignal.aborted
    ) {
      controller.abort();
    } else {
      externalSignal.addEventListener(
        "abort",
        abortFromExternalSignal,
        {
          once:
            true,
        },
      );
    }
  }

  try {
    const headers =
      new Headers({
        Accept:
          "application/json",

        Authorization:
          `Bearer ${config.secretKey}`,

        "User-Agent":
          config.userAgent,
      });

    if (
      options.body
    ) {
      headers.set(
        "Content-Type",
        "application/json",
      );
    }

    if (
      options.idempotencyKey
    ) {
      headers.set(
        "Idempotency-Key",
        options.idempotencyKey,
      );
    }

    const response =
      await fetch(
        `${config.apiBaseUrl}${path}`,
        {
          method:
            options.method ??
            "GET",

          headers,

          body:
            options.body
              ? JSON.stringify(
                  options.body,
                )
              : undefined,

          signal:
            controller.signal,

          cache:
            "no-store",
        },
      );

    const payload =
      await readResponsePayload(
        response,
      );

    if (
      process.env.NODE_ENV !==
      "production"
    ) {
      console.info(
        "[FEDAPAY_RAW_RESPONSE]",
        {
          environment:
            config.environment,

          apiBaseUrl:
            config.apiBaseUrl,

          method:
            options.method ??
            "GET",

          path,

          status:
            response.status,

          statusText:
            response.statusText,

          payload,
        },
      );
    }

    if (
      !response.ok
    ) {
      throw createProviderErrorFromResponse({
        response,
        payload,
        providerReference,
      });
    }

    return parser(
      payload,
    );
  } catch (error) {
    if (
      error instanceof
      PaymentProviderError ||
    error instanceof
      PaymentValidationError
    ) {
      throw error;
    }

    if (
      error instanceof
        DOMException &&
      error.name ===
        "AbortError"
    ) {
      throw new PaymentProviderError({
        code:
          "PAYMENT_PROVIDER_TIMEOUT",

        message:
          "FedaPay n’a pas répondu dans le délai autorisé.",

        status:
          504,

        retryable:
          true,

        provider:
          "FEDAPAY",

        providerReference,

        cause:
          error,
      });
    }

    console.error(
      "[FEDAPAY_CLIENT_REQUEST_ERROR]",
      getPaymentErrorLogContext(
        error,
      ),
    );

    throw new PaymentProviderError({
      code:
        "PAYMENT_PROVIDER_REQUEST_FAILED",

      message:
        "Impossible de communiquer avec FedaPay pour le moment.",

      status:
        502,

      retryable:
        true,

      provider:
        "FEDAPAY",

      providerReference,

      exposeMessage:
        false,

      cause:
        error,
    });
  } finally {
    clearTimeout(
      timeout,
    );

    if (
      externalSignal
    ) {
      externalSignal.removeEventListener(
        "abort",
        abortFromExternalSignal,
      );
    }
  }
}

export async function createFedaPayTransaction(
  input:
    CreateFedaPayTransactionInput,
  options?: {
    idempotencyKey?: string;
    signal?: AbortSignal;
  },
): Promise<FedaPayTransaction> {
  const config =
    getFedaPayConfig();

  const amount =
    normalizePositiveInteger({
      value:
        input.amount,

      field:
        "amount",
    });

  const currency =
    normalizeCurrency(
      input.currency,
    );

  const description =
    normalizeDescription(
      input.description,
    );

  const callbackUrl =
    normalizeAbsoluteUrl({
      value:
        input.callbackUrl ??
        config.webhookUrl,

      field:
        "callbackUrl",
    });

  const customer =
    normalizeCustomer(
      input.customer,
    );

  const metadata =
    sanitizeMetadata(
      input.metadata,
    );

  const body:
    Record<string, unknown> = {
      amount,

      currency: {
        iso:
          currency,
      },

      description,

      callback_url:
        callbackUrl,

      ...(customer
        ? {
            customer,
          }
        : {}),

      ...(metadata
        ? {
            custom_metadata:
              metadata,
          }
        : {}),
  };

  return requestFedaPay({
    config,

    path:
      "/transactions",

    options: {
      method:
        "POST",

      body,

      idempotencyKey:
        normalizeText(
          options
            ?.idempotencyKey,
        ) ||
        undefined,

      signal:
        options?.signal,
    },

    parser:
      parseTransaction,
  });
}

function waitForRetry(
  delayMs:
    number,
  signal?:
    AbortSignal,
): Promise<void> {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      if (
        signal?.aborted
      ) {
        reject(
          new DOMException(
            "La requête a été annulée.",
            "AbortError",
          ),
        );

        return;
      }

      let timeout:
        ReturnType<
          typeof setTimeout
        >;

      const handleAbort =
        () => {
          clearTimeout(
            timeout,
          );

          signal?.removeEventListener(
            "abort",
            handleAbort,
          );

          reject(
            new DOMException(
              "La requête a été annulée.",
              "AbortError",
            ),
          );
        };

      timeout =
        setTimeout(
          () => {
            signal?.removeEventListener(
              "abort",
              handleAbort,
            );

            resolve();
          },
          delayMs,
        );

      signal?.addEventListener(
        "abort",
        handleAbort,
        {
          once:
            true,
        },
      );
    },
  );
}

function isFedaPayTransactionNotFoundError(
  error:
    unknown,
): boolean {
  return (
    error instanceof
      PaymentProviderError &&
    error.code ===
      "PAYMENT_PROVIDER_TRANSACTION_NOT_FOUND"
  );
}

export async function createFedaPayPaymentLink(
  transactionId:
    number,
  options?: {
    signal?: AbortSignal;
    retryDelaysMs?: readonly number[];
  },
): Promise<FedaPayPaymentLink> {
  const config =
    getFedaPayConfig();

  const normalizedTransactionId =
    normalizeTransactionId(
      transactionId,
    );

  const retryDelaysMs =
    options?.retryDelaysMs ??
    PAYMENT_LINK_RETRY_DELAYS_MS;

  let lastError:
    unknown = null;

  for (
    let attemptIndex =
      0;
    attemptIndex <
    retryDelaysMs.length;
    attemptIndex +=
      1
  ) {
    const delayMs =
      retryDelaysMs[
        attemptIndex
      ] ??
      0;

    if (
      delayMs >
      0
    ) {
      await waitForRetry(
        delayMs,
        options?.signal,
      );
    }

    try {
      return await requestFedaPay({
        config,

        path:
          `/transactions/${normalizedTransactionId}/token`,

        options: {
          method:
            "POST",

          signal:
            options?.signal,
        },

        parser:
          parsePaymentLink,

        providerReference:
          String(
            normalizedTransactionId,
          ),
      });
    } catch (
      error
    ) {
      lastError =
        error;

      const hasAnotherAttempt =
        attemptIndex <
        retryDelaysMs.length -
          1;

      if (
        !hasAnotherAttempt ||
        !isFedaPayTransactionNotFoundError(
          error,
        )
      ) {
        throw error;
      }
    }
  }

  if (
    lastError
  ) {
    throw lastError;
  }

  throw new PaymentProviderError({
    code:
      "PAYMENT_PROVIDER_REQUEST_FAILED",

    message:
      "Impossible de générer le lien de paiement FedaPay.",

    status:
      502,

    retryable:
      true,

    provider:
      "FEDAPAY",

    providerReference:
      String(
        normalizedTransactionId,
      ),
  });
}

export async function getFedaPayTransaction(
  transactionId:
    number,
  options?: {
    signal?: AbortSignal;
  },
): Promise<FedaPayTransaction> {
  const config =
    getFedaPayConfig();

  const normalizedTransactionId =
    normalizeTransactionId(
      transactionId,
    );

  return requestFedaPay({
    config,

    path:
      `/transactions/${normalizedTransactionId}`,

    options: {
      method:
        "GET",

      signal:
        options?.signal,
    },

    parser:
      parseTransaction,

    providerReference:
      String(
        normalizedTransactionId,
      ),
  });
}

export function isFedaPayTransactionApproved(
  transaction:
    FedaPayTransaction,
): boolean {
  return (
    transaction.status ===
    "approved"
  );
}

export function assertFedaPayTransactionMatches({
  transaction,
  expectedAmount,
  expectedCurrency,
  expectedReference,
}: {
  transaction:
    FedaPayTransaction;
  expectedAmount:
    number;
  expectedCurrency?:
    string;
  expectedReference?:
    string;
}): void {
  const normalizedExpectedAmount =
    normalizePositiveInteger({
      value:
        expectedAmount,

      field:
        "expectedAmount",
    });

  if (
    transaction.amount !==
    normalizedExpectedAmount
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_AMOUNT_MISMATCH",

      message:
        "Le montant confirmé par FedaPay ne correspond pas au montant attendu.",

      status:
        409,

      provider:
        "FEDAPAY",

      providerReference:
        transaction.reference,

      details: {
        expectedAmount:
          normalizedExpectedAmount,

        providerAmount:
          transaction.amount,
      },
    });
  }

  if (
    expectedReference
  ) {
    const normalizedExpectedReference =
      normalizeText(
        expectedReference,
      );

    const referenceMatches =
      transaction.reference ===
        normalizedExpectedReference ||
      transaction.merchantReference ===
        normalizedExpectedReference ||
      transaction.customMetadata
        ?.orderReference ===
        normalizedExpectedReference;

    if (
      !referenceMatches
    ) {
      throw new PaymentValidationError({
        code:
          "PAYMENT_REFERENCE_MISMATCH",

        message:
          "La référence confirmée par FedaPay ne correspond pas à la commande Tikemia.",

        status:
          409,

        provider:
          "FEDAPAY",

        providerReference:
          transaction.reference,

        details: {
          expectedReference:
            normalizedExpectedReference,

          providerReference:
            transaction.reference,

          merchantReference:
            transaction.merchantReference,
        },
      });
    }
  }

  if (
    expectedCurrency
  ) {
    /*
     * L’endpoint de consultation retourne actuellement currency_id
     * plutôt que l’ISO de la devise. La comparaison stricte de devise
     * doit donc aussi s’appuyer sur la devise déjà enregistrée dans
     * Payment et sur les métadonnées Tikemia envoyées à la création.
     */
    const normalizedExpectedCurrency =
      normalizeCurrency(
        expectedCurrency,
      );

    const metadataCurrency =
      typeof transaction
        .customMetadata
        ?.currency ===
        "string"
        ? transaction
            .customMetadata
            .currency
            .trim()
            .toUpperCase()
        : null;

    if (
      metadataCurrency &&
      metadataCurrency !==
        normalizedExpectedCurrency
    ) {
      throw new PaymentValidationError({
        code:
          "PAYMENT_CURRENCY_MISMATCH",

        message:
          "La devise confirmée par FedaPay ne correspond pas à la commande Tikemia.",

        status:
          409,

        provider:
          "FEDAPAY",

        providerReference:
          transaction.reference,

        details: {
          expectedCurrency:
            normalizedExpectedCurrency,

          providerCurrency:
            metadataCurrency,
        },
      });
    }
  }
}

export async function createFedaPayHostedCheckout({
  transaction,
  idempotencyKey,
  signal,
}: {
  transaction:
    CreateFedaPayTransactionInput;
  idempotencyKey?:
    string;
  signal?:
    AbortSignal;
}): Promise<{
  transaction:
    FedaPayTransaction;
  paymentLink:
    FedaPayPaymentLink;
}> {
  const createdTransaction =
    await createFedaPayTransaction(
      transaction,
      {
        idempotencyKey,
        signal,
      },
    );

  const paymentLink =
    await createFedaPayPaymentLink(
      createdTransaction.id,
      {
        signal,
      },
    );

  return {
    transaction:
      createdTransaction,

    paymentLink,
  };
}