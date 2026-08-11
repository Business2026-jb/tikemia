import "server-only";

import { getMonerooConfig } from "./config";

import {
  MonerooApiError,
  MonerooAuthenticationError,
  MonerooPaymentNotFoundError,
  MonerooRequestError,
  MonerooResponseError,
  MonerooTimeoutError,
  MonerooValidationError,
} from "./moneroo-errors";

import {
  getMonerooCheckoutUrl,
  isMonerooApiResponse,
  isMonerooInitializePaymentData,
  isMonerooInitializePayoutData,
  isMonerooPaymentData,
  isMonerooPayoutData,
  isRecord,
  type MonerooApiErrorPayload,
  type MonerooInitializePaymentInput,
  type MonerooInitializePaymentResponse,
  type MonerooInitializePayoutInput,
  type MonerooInitializePayoutResponse,
  type MonerooPaymentData,
  type MonerooRequestOptions,
  type MonerooRetrievePaymentResponse,
  type MonerooRetrievePayoutResponse,
  type MonerooVerifyPaymentResponse,
} from "./moneroo-types";

type HttpMethod = "GET" | "POST";

type MonerooRequestParameters = Readonly<{
  method: HttpMethod;
  endpoint: string;
  body?: unknown;
  signal?: AbortSignal;
  idempotencyKey?: string;
}>;

type SafeMonerooCustomer = Readonly<{
  email: string;
  first_name: string;
  last_name: string;
}>;

type SafeMonerooInitializePayload = Readonly<{
  amount: number;
  currency: string;
  description: string;
  return_url: string;
  customer: SafeMonerooCustomer;
}>;

type SafeMonerooPayoutRecipient = Readonly<
  Record<string, string | number | boolean>
>;

type SafeMonerooInitializePayoutPayload = Readonly<{
  amount: number;
  currency: string;
  description: string;
  method: string;
  customer: SafeMonerooCustomer;
  recipient: SafeMonerooPayoutRecipient;
  metadata?: Readonly<
    Record<string, string | number | boolean | null>
  >;
}>;

function normalizeRequiredText(
  value: string | null | undefined,
  message: string,
): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new MonerooValidationError(message);
  }

  return normalizedValue;
}

function normalizeEmail(
  value: string | null | undefined,
): string {
  const normalizedEmail = normalizeRequiredText(
    value,
    "L’adresse e-mail du client est obligatoire.",
  ).toLowerCase();

  if (
    normalizedEmail.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      normalizedEmail,
    )
  ) {
    throw new MonerooValidationError(
      "L’adresse e-mail du client n’est pas valide.",
    );
  }

  return normalizedEmail;
}

function normalizeCurrency(
  value: string | null | undefined,
): string {
  const normalizedCurrency =
    normalizeRequiredText(
      value,
      "La devise du paiement Moneroo est obligatoire.",
    ).toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(
      normalizedCurrency,
    )
  ) {
    throw new MonerooValidationError(
      "La devise Moneroo doit respecter le format ISO 4217 sur trois lettres.",
    );
  }

  return normalizedCurrency;
}

function normalizeReturnUrl(
  value: string | null | undefined,
): string {
  const normalizedUrl =
    normalizeRequiredText(
      value,
      "L’URL de retour Moneroo est obligatoire.",
    );

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(
      normalizedUrl,
    );
  } catch {
    throw new MonerooValidationError(
      "L’URL de retour Moneroo n’est pas valide.",
    );
  }

  if (
    parsedUrl.protocol !== "http:" &&
    parsedUrl.protocol !== "https:"
  ) {
    throw new MonerooValidationError(
      "L’URL de retour Moneroo doit utiliser HTTP ou HTTPS.",
    );
  }

  if (
    process.env.NODE_ENV ===
      "production" &&
    parsedUrl.protocol !== "https:"
  ) {
    throw new MonerooValidationError(
      "L’URL de retour Moneroo doit utiliser HTTPS en production.",
    );
  }

  return parsedUrl.toString();
}

function normalizeIdempotencyKey(
  value: string | null | undefined,
): string | null {
  const normalizedValue =
    value?.trim();

  if (!normalizedValue) {
    return null;
  }

  if (
    normalizedValue.length > 255
  ) {
    throw new MonerooValidationError(
      "La clé d’idempotence Moneroo est trop longue.",
    );
  }

  return normalizedValue;
}

function validatePaymentId(
  paymentId: string,
): string {
  const normalizedPaymentId =
    paymentId.trim();

  if (!normalizedPaymentId) {
    throw new MonerooValidationError(
      "L’identifiant du paiement Moneroo est obligatoire.",
    );
  }

  if (
    normalizedPaymentId.length > 255
  ) {
    throw new MonerooValidationError(
      "L’identifiant du paiement Moneroo est trop long.",
    );
  }

  return encodeURIComponent(
    normalizedPaymentId,
  );
}

function validatePayoutId(
  payoutId: string,
): string {
  const normalizedPayoutId =
    payoutId.trim();

  if (!normalizedPayoutId) {
    throw new MonerooValidationError(
      "L’identifiant du transfert Moneroo est obligatoire.",
    );
  }

  if (
    normalizedPayoutId.length >
    255
  ) {
    throw new MonerooValidationError(
      "L’identifiant du transfert Moneroo est trop long.",
    );
  }

  return encodeURIComponent(
    normalizedPayoutId,
  );
}

function normalizePayoutMethod(
  value: string | null | undefined,
): string {
  const normalizedMethod =
    normalizeRequiredText(
      value,
      "La méthode de transfert Moneroo est obligatoire.",
    ).toLowerCase();

  if (
    normalizedMethod.length >
      120 ||
    !/^[a-z0-9][a-z0-9_-]*$/.test(
      normalizedMethod,
    )
  ) {
    throw new MonerooValidationError(
      "La méthode de transfert Moneroo n’est pas valide.",
    );
  }

  return normalizedMethod;
}

function createSafePayoutRecipient(
  value: unknown,
): SafeMonerooPayoutRecipient {
  if (!isRecord(value)) {
    throw new MonerooValidationError(
      "Les informations du bénéficiaire du remboursement sont obligatoires.",
    );
  }

  const entries =
    Object.entries(value)
      .filter(
        (
          entry,
        ): entry is [
          string,
          string | number | boolean
        ] => {
          const [
            key,
            entryValue,
          ] = entry;

          if (!key.trim()) {
            return false;
          }

          if (
            typeof entryValue ===
              "string"
          ) {
            return Boolean(
              entryValue.trim(),
            );
          }

          return (
            typeof entryValue ===
              "number" &&
              Number.isFinite(
                entryValue,
              )
          ) ||
            typeof entryValue ===
              "boolean";
        },
      )
      .map(
        ([
          key,
          entryValue,
        ]) => [
          key.trim(),
          typeof entryValue ===
            "string"
            ? entryValue.trim()
            : entryValue,
        ] as const,
      );

  if (
    entries.length ===
    0
  ) {
    throw new MonerooValidationError(
      "Les informations du bénéficiaire du remboursement sont incomplètes.",
    );
  }

  return Object.freeze(
    Object.fromEntries(
      entries,
    ),
  );
}

function createSafePayoutMetadata(
  value: unknown,
): Readonly<
  Record<
    string,
    string | number | boolean | null
  >
> | undefined {
  if (
    value === undefined ||
    value === null
  ) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new MonerooValidationError(
      "Les métadonnées du transfert Moneroo ne sont pas valides.",
    );
  }

  const entries =
    Object.entries(value)
      .filter(
        (
          entry,
        ): entry is [
          string,
          string | number | boolean | null
        ] => {
          const [
            key,
            entryValue,
          ] = entry;

          if (!key.trim()) {
            return false;
          }

          return (
            entryValue ===
              null ||
            typeof entryValue ===
              "string" ||
            (
              typeof entryValue ===
                "number" &&
              Number.isFinite(
                entryValue,
              )
            ) ||
            typeof entryValue ===
              "boolean"
          );
        },
      )
      .map(
        ([
          key,
          entryValue,
        ]) => [
          key.trim(),
          typeof entryValue ===
            "string"
            ? entryValue.trim()
            : entryValue,
        ] as const,
      );

  return entries.length > 0
    ? Object.freeze(
        Object.fromEntries(
          entries,
        ),
      )
    : undefined;
}

function validateInitializePayoutInput(
  input: MonerooInitializePayoutInput,
): void {
  if (
    !Number.isFinite(
      input.amount,
    ) ||
    input.amount <= 0
  ) {
    throw new MonerooValidationError(
      "Le montant du remboursement Moneroo doit être supérieur à zéro.",
    );
  }

  if (
    !Number.isSafeInteger(
      input.amount,
    )
  ) {
    throw new MonerooValidationError(
      "Le montant envoyé à Moneroo doit être un entier positif.",
    );
  }

  normalizeCurrency(
    input.currency,
  );

  const description =
    normalizeRequiredText(
      input.description,
      "La description du remboursement Moneroo est obligatoire.",
    );

  if (
    description.length >
    1_000
  ) {
    throw new MonerooValidationError(
      "La description du remboursement Moneroo est trop longue.",
    );
  }

  normalizePayoutMethod(
    input.method,
  );

  if (
    !input.customer ||
    typeof input.customer !==
      "object"
  ) {
    throw new MonerooValidationError(
      "Les informations essentielles du bénéficiaire sont obligatoires.",
    );
  }

  normalizeEmail(
    input.customer.email,
  );

  const firstName =
    normalizeRequiredText(
      input.customer.first_name,
      "Le prénom du bénéficiaire est obligatoire.",
    );

  if (
    firstName.length >
    120
  ) {
    throw new MonerooValidationError(
      "Le prénom du bénéficiaire est trop long.",
    );
  }

  const lastName =
    normalizeRequiredText(
      input.customer.last_name,
      "Le nom du bénéficiaire est obligatoire.",
    );

  if (
    lastName.length >
    120
  ) {
    throw new MonerooValidationError(
      "Le nom du bénéficiaire est trop long.",
    );
  }

  createSafePayoutRecipient(
    input.recipient,
  );

  createSafePayoutMetadata(
    input.metadata,
  );
}

function createSafeInitializePayoutPayload(
  input: MonerooInitializePayoutInput,
): SafeMonerooInitializePayoutPayload {
  validateInitializePayoutInput(
    input,
  );

  const metadata =
    createSafePayoutMetadata(
      input.metadata,
    );

  return Object.freeze({
    amount:
      input.amount,

    currency:
      normalizeCurrency(
        input.currency,
      ),

    description:
      normalizeRequiredText(
        input.description,
        "La description du remboursement Moneroo est obligatoire.",
      ),

    method:
      normalizePayoutMethod(
        input.method,
      ),

    customer: {
      email:
        normalizeEmail(
          input.customer.email,
        ),

      first_name:
        normalizeRequiredText(
          input.customer.first_name,
          "Le prénom du bénéficiaire est obligatoire.",
        ),

      last_name:
        normalizeRequiredText(
          input.customer.last_name,
          "Le nom du bénéficiaire est obligatoire.",
        ),
    },

    recipient:
      createSafePayoutRecipient(
        input.recipient,
      ),

    ...(metadata
      ? {
          metadata,
        }
      : {}),
  });
}

function validateInitializePaymentInput(
  input: MonerooInitializePaymentInput,
): void {
  if (
    !Number.isFinite(
      input.amount,
    ) ||
    input.amount <= 0
  ) {
    throw new MonerooValidationError(
      "Le montant du paiement Moneroo doit être supérieur à zéro.",
    );
  }

  if (
    !Number.isSafeInteger(
      input.amount,
    )
  ) {
    throw new MonerooValidationError(
      "Le montant envoyé à Moneroo doit être un entier positif.",
    );
  }

  normalizeCurrency(
    input.currency,
  );

  const description =
    normalizeRequiredText(
      input.description,
      "La description du paiement Moneroo est obligatoire.",
    );

  if (
    description.length >
    1_000
  ) {
    throw new MonerooValidationError(
      "La description du paiement Moneroo est trop longue.",
    );
  }

  normalizeReturnUrl(
    input.return_url,
  );

  if (
    !input.customer ||
    typeof input.customer !==
      "object"
  ) {
    throw new MonerooValidationError(
      "Les informations essentielles du client sont obligatoires.",
    );
  }

  normalizeEmail(
    input.customer.email,
  );

  const firstName =
    normalizeRequiredText(
      input.customer.first_name,
      "Le prénom du client est obligatoire.",
    );

  if (
    firstName.length > 120
  ) {
    throw new MonerooValidationError(
      "Le prénom du client est trop long.",
    );
  }

  const lastName =
    normalizeRequiredText(
      input.customer.last_name,
      "Le nom du client est obligatoire.",
    );

  if (
    lastName.length > 120
  ) {
    throw new MonerooValidationError(
      "Le nom du client est trop long.",
    );
  }
}

/**
 * Construit strictement le payload réellement envoyé
 * à Moneroo lors de l'initialisation.
 *
 * IMPORTANT :
 *
 * Les informations internes Tikemia qui ne sont pas
 * nécessaires à Moneroo ne doivent pas être transmises.
 *
 * Cela concerne notamment :
 * - metadata ;
 * - téléphone ;
 * - adresse ;
 * - ville ;
 * - code pays.
 *
 * Ces informations restent disponibles dans Tikemia.
 */
function createSafeInitializePayload(
  input: MonerooInitializePaymentInput,
): SafeMonerooInitializePayload {
  validateInitializePaymentInput(
    input,
  );

  return Object.freeze({
    amount: input.amount,

    currency:
      normalizeCurrency(
        input.currency,
      ),

    description:
      normalizeRequiredText(
        input.description,
        "La description du paiement Moneroo est obligatoire.",
      ),

    return_url:
      normalizeReturnUrl(
        input.return_url,
      ),

    customer: {
      email:
        normalizeEmail(
          input.customer.email,
        ),

      first_name:
        normalizeRequiredText(
          input.customer.first_name,
          "Le prénom du client est obligatoire.",
        ),

      last_name:
        normalizeRequiredText(
          input.customer.last_name,
          "Le nom du client est obligatoire.",
        ),
    },
  });
}

function getErrorMessage(
  payload: unknown,
  fallbackMessage: string,
): string {
  if (!isRecord(payload)) {
    return fallbackMessage;
  }

  const candidateMessages = [
    payload.message,
    payload.error,
    payload.detail,
    payload.description,
  ];

  for (
    const candidate of
    candidateMessages
  ) {
    if (
      typeof candidate ===
        "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  if (
    isRecord(
      payload.error,
    ) &&
    typeof payload.error
      .message === "string" &&
    payload.error.message.trim()
  ) {
    return payload.error.message.trim();
  }

  return fallbackMessage;
}

async function readResponseBody(
  response: Response,
): Promise<unknown> {
  const rawBody =
    await response.text();

  if (!rawBody.trim()) {
    return null;
  }

  try {
    return JSON.parse(
      rawBody,
    ) as unknown;
  } catch {
    return rawBody;
  }
}

function createAbortContext(
  timeoutMs: number,
  externalSignal?: AbortSignal,
): {
  signal: AbortSignal;
  cleanup: () => void;
  didTimeout: () => boolean;
} {
  const controller =
    new AbortController();

  let timedOut = false;

  const timeout =
    setTimeout(() => {
      timedOut = true;

      controller.abort(
        new DOMException(
          "La requête Moneroo a dépassé le délai autorisé.",
          "AbortError",
        ),
      );
    }, timeoutMs);

  const handleExternalAbort =
    () => {
      controller.abort(
        externalSignal?.reason,
      );
    };

  if (externalSignal) {
    if (
      externalSignal.aborted
    ) {
      controller.abort(
        externalSignal.reason,
      );
    } else {
      externalSignal.addEventListener(
        "abort",
        handleExternalAbort,
        {
          once: true,
        },
      );
    }
  }

  return {
    signal:
      controller.signal,

    didTimeout: () =>
      timedOut,

    cleanup: () => {
      clearTimeout(
        timeout,
      );

      externalSignal?.removeEventListener(
        "abort",
        handleExternalAbort,
      );
    },
  };
}

function isAbortError(
  error: unknown,
): boolean {
  return (
    error instanceof
      DOMException &&
    error.name ===
      "AbortError"
  );
}

async function requestMoneroo<T>(
  parameters: MonerooRequestParameters,
  validateData: (
    value: unknown,
  ) => value is T,
): Promise<T> {
  const config =
    getMonerooConfig();

  const endpoint =
    parameters.endpoint.startsWith(
      "/",
    )
      ? parameters.endpoint
      : `/${parameters.endpoint}`;

  const url =
    `${config.apiBaseUrl}${endpoint}`;

  const abortContext =
    createAbortContext(
      config.requestTimeoutMs,
      parameters.signal,
    );

  try {
    const headers =
      new Headers({
        Accept:
          "application/json",

        Authorization:
          `Bearer ${config.secretKey}`,

        "Content-Type":
          "application/json",
      });

    const idempotencyKey =
      normalizeIdempotencyKey(
        parameters.idempotencyKey,
      );

    if (idempotencyKey) {
      headers.set(
        "Idempotency-Key",
        idempotencyKey,
      );
    }

    const response =
      await fetch(url, {
        method:
          parameters.method,

        headers,

        body:
          parameters.body ===
          undefined
            ? undefined
            : JSON.stringify(
                parameters.body,
              ),

        cache:
          "no-store",

        signal:
          abortContext.signal,
      });

    const responseBody =
      await readResponseBody(
        response,
      );

    if (!response.ok) {
      const details = {
        status:
          response.status,

        endpoint,

        method:
          parameters.method,

        responseBody,
      };

      if (
        response.status ===
          401 ||
        response.status ===
          403
      ) {
        throw new MonerooAuthenticationError(
          details,
        );
      }

      if (
        response.status ===
        404
      ) {
        const resourceId =
          endpoint
            .split("/")
            .filter(Boolean)
            .at(-1) ??
          "inconnu";

        if (
          endpoint.startsWith(
            "/v1/payouts/",
          )
        ) {
          throw new MonerooResponseError(
            `Le transfert Moneroo « ${resourceId} » est introuvable.`,
            details,
          );
        }

        throw new MonerooPaymentNotFoundError(
          resourceId,
          details,
        );
      }

      const message =
        getErrorMessage(
          responseBody,
          `Moneroo a retourné une erreur HTTP ${response.status}.`,
        );

      if (
        response.status ===
          400 ||
        response.status ===
          422
      ) {
        throw new MonerooValidationError(
          message,
          details,
        );
      }

      throw new MonerooApiError(
        message,
        details,
      );
    }

    if (
      !validateData(
        responseBody,
      )
    ) {
      if (
        process.env.NODE_ENV ===
        "development"
      ) {
        console.error(
          "[MONEROO_UNEXPECTED_RESPONSE]",
          JSON.stringify(
            {
              status:
                response.status,

              endpoint,

              method:
                parameters.method,

              responseBody,
            },
            null,
            2,
          ),
        );
      }

      throw new MonerooResponseError(
        "La réponse reçue de Moneroo ne respecte pas le format attendu.",
        {
          status:
            response.status,

          endpoint,

          method:
            parameters.method,

          responseBody,
        },
      );
    }

    return responseBody;
  } catch (error) {
    if (
      error instanceof
        MonerooApiError ||
      error instanceof
        MonerooResponseError ||
      error instanceof
        MonerooRequestError
    ) {
      throw error;
    }

    if (
      isAbortError(error)
    ) {
      if (
        abortContext.didTimeout()
      ) {
        throw new MonerooTimeoutError(
          config.requestTimeoutMs,
          {
            endpoint,

            method:
              parameters.method,

            cause:
              error,
          },
        );
      }

      throw new MonerooRequestError(
        "La requête Moneroo a été annulée.",
        {
          endpoint,

          method:
            parameters.method,

          cause:
            error,
        },
      );
    }

    throw new MonerooRequestError(
      "Impossible de communiquer avec l’API Moneroo.",
      {
        endpoint,

        method:
          parameters.method,

        cause:
          error,
      },
    );
  } finally {
    abortContext.cleanup();
  }
}

function isInitializePaymentApiResponse(
  value: unknown,
): value is MonerooInitializePaymentResponse {
  return isMonerooApiResponse(
    value,
    isMonerooInitializePaymentData,
  );
}

function isRetrievePaymentApiResponse(
  value: unknown,
): value is MonerooRetrievePaymentResponse {
  return isMonerooApiResponse(
    value,
    isMonerooPaymentData,
  );
}

function isVerifyPaymentApiResponse(
  value: unknown,
): value is MonerooVerifyPaymentResponse {
  return isMonerooApiResponse(
    value,
    isMonerooPaymentData,
  );
}

function isInitializePayoutApiResponse(
  value: unknown,
): value is MonerooInitializePayoutResponse {
  return isMonerooApiResponse(
    value,
    isMonerooInitializePayoutData,
  );
}

function isRetrievePayoutApiResponse(
  value: unknown,
): value is MonerooRetrievePayoutResponse {
  return isMonerooApiResponse(
    value,
    isMonerooPayoutData,
  );
}

function isVerifyPayoutApiResponse(
  value: unknown,
): value is MonerooRetrievePayoutResponse {
  return isMonerooApiResponse(
    value,
    isMonerooPayoutData,
  );
}

export async function initializeMonerooPayment(
  input: MonerooInitializePaymentInput,
  options: MonerooRequestOptions = {},
): Promise<MonerooInitializePaymentResponse> {
  const safePayload =
    createSafeInitializePayload(
      input,
    );

  const response =
    await requestMoneroo<MonerooInitializePaymentResponse>(
      {
        method:
          "POST",

        endpoint:
          "/v1/payments/initialize",

        body:
          safePayload,

        signal:
          options.signal,

        idempotencyKey:
          options.idempotencyKey,
      },

      isInitializePaymentApiResponse,
    );

  /*
   * Moneroo retourne actuellement :
   *
   * data.checkout_url
   *
   * Les variantes checkoutUrl et link restent
   * acceptées pour préserver la compatibilité.
   */
  const checkoutUrl =
    getMonerooCheckoutUrl(
      response.data,
    );

  if (!checkoutUrl) {
    throw new MonerooResponseError(
      "Moneroo n’a retourné aucun lien de paiement.",
      {
        endpoint:
          "/v1/payments/initialize",

        method:
          "POST",

        responseBody:
          response,
      },
    );
  }

  /*
   * Normalisation interne Tikemia.
   *
   * Les anciens fichiers qui utilisent encore
   * data.link continueront donc de fonctionner.
   */
  const normalizedResponse:
    MonerooInitializePaymentResponse =
    {
      ...response,

      data: {
        ...response.data,

        checkout_url:
          response.data
            .checkout_url ??
          checkoutUrl,

        link:
          checkoutUrl,
      },
    };

  return normalizedResponse;
}

export async function retrieveMonerooPayment(
  paymentId: string,
  options: Pick<
    MonerooRequestOptions,
    "signal"
  > = {},
): Promise<MonerooRetrievePaymentResponse> {
  const encodedPaymentId =
    validatePaymentId(
      paymentId,
    );

  return requestMoneroo<MonerooRetrievePaymentResponse>(
    {
      method:
        "GET",

      endpoint:
        `/v1/payments/${encodedPaymentId}`,

      signal:
        options.signal,
    },

    isRetrievePaymentApiResponse,
  );
}

export async function verifyMonerooPayment(
  paymentId: string,
  options: Pick<
    MonerooRequestOptions,
    "signal"
  > = {},
): Promise<MonerooVerifyPaymentResponse> {
  const encodedPaymentId =
    validatePaymentId(
      paymentId,
    );

  return requestMoneroo<MonerooVerifyPaymentResponse>(
    {
      method:
        "GET",

      endpoint:
        `/v1/payments/${encodedPaymentId}/verify`,

      signal:
        options.signal,
    },

    isVerifyPaymentApiResponse,
  );
}

/**
 * Initialise un transfert Moneroo.
 *
 * Cette fonction est volontairement séparée du flux Payment existant.
 * Elle peut être utilisée par le moteur de remboursement Tikemia.
 *
 * Endpoint officiel Moneroo :
 * POST /v1/payouts/initialize
 */
export async function initializeMonerooPayout(
  input: MonerooInitializePayoutInput,
  options: MonerooRequestOptions = {},
): Promise<MonerooInitializePayoutResponse> {
  const safePayload =
    createSafeInitializePayoutPayload(
      input,
    );

  return requestMoneroo<MonerooInitializePayoutResponse>(
    {
      method:
        "POST",

      endpoint:
        "/v1/payouts/initialize",

      body:
        safePayload,

      signal:
        options.signal,

      idempotencyKey:
        options.idempotencyKey,
    },

    isInitializePayoutApiResponse,
  );
}

/**
 * Récupère l'état courant d'un transfert Moneroo.
 *
 * Endpoint officiel Moneroo :
 * GET /v1/payouts/{payoutId}
 */
export async function retrieveMonerooPayout(
  payoutId: string,
  options: Pick<
    MonerooRequestOptions,
    "signal"
  > = {},
): Promise<MonerooRetrievePayoutResponse> {
  const encodedPayoutId =
    validatePayoutId(
      payoutId,
    );

  return requestMoneroo<MonerooRetrievePayoutResponse>(
    {
      method:
        "GET",

      endpoint:
        `/v1/payouts/${encodedPayoutId}`,

      signal:
        options.signal,
    },

    isRetrievePayoutApiResponse,
  );
}

/**
 * Vérifie côté serveur un transfert Moneroo.
 *
 * Endpoint officiel Moneroo :
 * GET /v1/payouts/{payoutId}/verify
 */
export async function verifyMonerooPayout(
  payoutId: string,
  options: Pick<
    MonerooRequestOptions,
    "signal"
  > = {},
): Promise<MonerooRetrievePayoutResponse> {
  const encodedPayoutId =
    validatePayoutId(
      payoutId,
    );

  return requestMoneroo<MonerooRetrievePayoutResponse>(
    {
      method:
        "GET",

      endpoint:
        `/v1/payouts/${encodedPayoutId}/verify`,

      signal:
        options.signal,
    },

    isVerifyPayoutApiResponse,
  );
}

export function serializeMonerooErrorPayload(
  payload: unknown,
): MonerooApiErrorPayload | null {
  return isRecord(payload)
    ? (payload as MonerooApiErrorPayload)
    : null;
}