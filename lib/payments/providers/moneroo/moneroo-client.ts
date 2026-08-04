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
  isMonerooPaymentData,
  isRecord,
  type MonerooApiErrorPayload,
  type MonerooInitializePaymentInput,
  type MonerooInitializePaymentResponse,
  type MonerooMetadata,
  type MonerooPaymentData,
  type MonerooRequestOptions,
  type MonerooRetrievePaymentResponse,
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
  metadata?: MonerooMetadata;
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
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
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
  const normalizedCurrency = normalizeRequiredText(
    value,
    "La devise du paiement Moneroo est obligatoire.",
  ).toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
    throw new MonerooValidationError(
      "La devise Moneroo doit respecter le format ISO 4217 sur trois lettres.",
    );
  }

  return normalizedCurrency;
}

function normalizeReturnUrl(
  value: string | null | undefined,
): string {
  const normalizedUrl = normalizeRequiredText(
    value,
    "L’URL de retour Moneroo est obligatoire.",
  );

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(normalizedUrl);
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
    process.env.NODE_ENV === "production" &&
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
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue.length > 255) {
    throw new MonerooValidationError(
      "La clé d’idempotence Moneroo est trop longue.",
    );
  }

  return normalizedValue;
}

function validatePaymentId(
  paymentId: string,
): string {
  const normalizedPaymentId = paymentId.trim();

  if (!normalizedPaymentId) {
    throw new MonerooValidationError(
      "L’identifiant du paiement Moneroo est obligatoire.",
    );
  }

  if (normalizedPaymentId.length > 255) {
    throw new MonerooValidationError(
      "L’identifiant du paiement Moneroo est trop long.",
    );
  }

  return encodeURIComponent(normalizedPaymentId);
}

function validateInitializePaymentInput(
  input: MonerooInitializePaymentInput,
): void {
  if (
    !Number.isFinite(input.amount) ||
    input.amount <= 0
  ) {
    throw new MonerooValidationError(
      "Le montant du paiement Moneroo doit être supérieur à zéro.",
    );
  }

  if (!Number.isSafeInteger(input.amount)) {
    throw new MonerooValidationError(
      "Le montant envoyé à Moneroo doit être un entier positif.",
    );
  }

  normalizeCurrency(input.currency);

  const description = normalizeRequiredText(
    input.description,
    "La description du paiement Moneroo est obligatoire.",
  );

  if (description.length > 1_000) {
    throw new MonerooValidationError(
      "La description du paiement Moneroo est trop longue.",
    );
  }

  normalizeReturnUrl(input.return_url);

  if (
    !input.customer ||
    typeof input.customer !== "object"
  ) {
    throw new MonerooValidationError(
      "Les informations essentielles du client sont obligatoires.",
    );
  }

  normalizeEmail(input.customer.email);

  const firstName = normalizeRequiredText(
    input.customer.first_name,
    "Le prénom du client est obligatoire.",
  );

  if (firstName.length > 120) {
    throw new MonerooValidationError(
      "Le prénom du client est trop long.",
    );
  }

  const lastName = normalizeRequiredText(
    input.customer.last_name,
    "Le nom du client est obligatoire.",
  );

  if (lastName.length > 120) {
    throw new MonerooValidationError(
      "Le nom du client est trop long.",
    );
  }
}

/**
 * Construit strictement le payload réellement envoyé à Moneroo.
 *
 * Le téléphone, l’adresse, la ville et le code pays restent enregistrés
 * dans Tikemia, mais ne sont pas transmis au processeur.
 */
function createSafeInitializePayload(
  input: MonerooInitializePaymentInput,
): SafeMonerooInitializePayload {
  validateInitializePaymentInput(input);

  return Object.freeze({
    amount: input.amount,

    currency: normalizeCurrency(
      input.currency,
    ),

    description: normalizeRequiredText(
      input.description,
      "La description du paiement Moneroo est obligatoire.",
    ),

    return_url: normalizeReturnUrl(
      input.return_url,
    ),

    customer: {
      email: normalizeEmail(
        input.customer.email,
      ),

      first_name: normalizeRequiredText(
        input.customer.first_name,
        "Le prénom du client est obligatoire.",
      ),

      last_name: normalizeRequiredText(
        input.customer.last_name,
        "Le nom du client est obligatoire.",
      ),
    },

    ...(input.metadata
      ? {
          metadata: input.metadata,
        }
      : {}),
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

  for (const candidate of candidateMessages) {
    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  if (
    isRecord(payload.error) &&
    typeof payload.error.message === "string" &&
    payload.error.message.trim()
  ) {
    return payload.error.message.trim();
  }

  return fallbackMessage;
}

async function readResponseBody(
  response: Response,
): Promise<unknown> {
  const rawBody = await response.text();

  if (!rawBody.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as unknown;
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
  const controller = new AbortController();

  let timedOut = false;

  const timeout = setTimeout(() => {
    timedOut = true;

    controller.abort(
      new DOMException(
        "La requête Moneroo a dépassé le délai autorisé.",
        "AbortError",
      ),
    );
  }, timeoutMs);

  const handleExternalAbort = () => {
    controller.abort(
      externalSignal?.reason,
    );
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
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
    signal: controller.signal,

    didTimeout: () => timedOut,

    cleanup: () => {
      clearTimeout(timeout);

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
    error instanceof DOMException &&
    error.name === "AbortError"
  );
}

async function requestMoneroo<T>(
  parameters: MonerooRequestParameters,
  validateData: (
    value: unknown,
  ) => value is T,
): Promise<T> {
  const config = getMonerooConfig();

  const endpoint =
    parameters.endpoint.startsWith("/")
      ? parameters.endpoint
      : `/${parameters.endpoint}`;

  const url =
    `${config.apiBaseUrl}${endpoint}`;

  const abortContext = createAbortContext(
    config.requestTimeoutMs,
    parameters.signal,
  );

  try {
    const headers = new Headers({
      Accept: "application/json",

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

    const response = await fetch(url, {
      method: parameters.method,

      headers,

      body:
        parameters.body === undefined
          ? undefined
          : JSON.stringify(
              parameters.body,
            ),

      cache: "no-store",

      signal: abortContext.signal,
    });

    const responseBody =
      await readResponseBody(
        response,
      );

    if (!response.ok) {
      const details = {
        status: response.status,
        endpoint,
        method: parameters.method,
        responseBody,
      };

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        throw new MonerooAuthenticationError(
          details,
        );
      }

      if (response.status === 404) {
        const paymentId =
          endpoint
            .split("/")
            .filter(Boolean)
            .at(-1) ??
          "inconnu";

        throw new MonerooPaymentNotFoundError(
          paymentId,
          details,
        );
      }

      const message = getErrorMessage(
        responseBody,
        `Moneroo a retourné une erreur HTTP ${response.status}.`,
      );

      if (
        response.status === 400 ||
        response.status === 422
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

    if (!validateData(responseBody)) {
      if (
        process.env.NODE_ENV ===
        "development"
      ) {
        console.error(
          "[MONEROO_UNEXPECTED_RESPONSE]",
          JSON.stringify(
            {
              status: response.status,
              endpoint,
              method: parameters.method,
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
          status: response.status,
          endpoint,
          method: parameters.method,
          responseBody,
        },
      );
    }

    return responseBody;
  } catch (error) {
    if (
      error instanceof MonerooApiError ||
      error instanceof MonerooResponseError ||
      error instanceof MonerooRequestError
    ) {
      throw error;
    }

    if (isAbortError(error)) {
      if (
        abortContext.didTimeout()
      ) {
        throw new MonerooTimeoutError(
          config.requestTimeoutMs,
          {
            endpoint,
            method: parameters.method,
            cause: error,
          },
        );
      }

      throw new MonerooRequestError(
        "La requête Moneroo a été annulée.",
        {
          endpoint,
          method: parameters.method,
          cause: error,
        },
      );
    }

    throw new MonerooRequestError(
      "Impossible de communiquer avec l’API Moneroo.",
      {
        endpoint,
        method: parameters.method,
        cause: error,
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
        method: "POST",

        endpoint:
          "/v1/payments/initialize",

        body: safePayload,

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
   * Les variantes checkoutUrl et link restent acceptées pour préserver
   * la compatibilité avec d’autres réponses.
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
   * Normalisation interne.
   *
   * Les anciens fichiers Tikemia qui lisent encore data.link continueront
   * donc de fonctionner, même si Moneroo retourne data.checkout_url.
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

export function serializeMonerooErrorPayload(
  payload: unknown,
): MonerooApiErrorPayload | null {
  return isRecord(payload)
    ? (payload as MonerooApiErrorPayload)
    : null;
}