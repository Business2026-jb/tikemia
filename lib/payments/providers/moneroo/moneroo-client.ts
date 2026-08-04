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
  isMonerooApiResponse,
  isMonerooPaymentData,
  isRecord,
  type MonerooApiErrorPayload,
  type MonerooInitializePaymentInput,
  type MonerooInitializePaymentResponse,
  type MonerooPaymentData,
  type MonerooRequestOptions,
  type MonerooRetrievePaymentResponse,
  type MonerooVerifyPaymentResponse,
} from "./moneroo-types";

type HttpMethod = "GET" | "POST";

type MonerooRequestParameters = {
  method: HttpMethod;
  endpoint: string;
  body?: unknown;
  signal?: AbortSignal;
  idempotencyKey?: string;
};

function validatePaymentId(paymentId: string): string {
  const normalizedPaymentId = paymentId.trim();

  if (!normalizedPaymentId) {
    throw new MonerooValidationError(
      "L'identifiant du paiement Moneroo est obligatoire.",
    );
  }

  return encodeURIComponent(normalizedPaymentId);
}

function validateInitializePaymentInput(
  input: MonerooInitializePaymentInput,
): void {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new MonerooValidationError(
      "Le montant du paiement Moneroo doit être supérieur à zéro.",
    );
  }

  if (!Number.isInteger(input.amount)) {
    throw new MonerooValidationError(
      "Le montant envoyé à Moneroo doit être un entier.",
    );
  }

  if (!input.currency?.trim()) {
    throw new MonerooValidationError(
      "La devise du paiement Moneroo est obligatoire.",
    );
  }

  if (!/^[A-Z]{3}$/.test(input.currency.trim().toUpperCase())) {
    throw new MonerooValidationError(
      "La devise Moneroo doit respecter le format ISO 4217 sur trois lettres.",
    );
  }

  if (!input.description?.trim()) {
    throw new MonerooValidationError(
      "La description du paiement Moneroo est obligatoire.",
    );
  }

  try {
    const returnUrl = new URL(input.return_url);

    if (!["http:", "https:"].includes(returnUrl.protocol)) {
      throw new Error("Unsupported protocol");
    }
  } catch {
    throw new MonerooValidationError("L'URL de retour Moneroo est invalide.");
  }

  if (!input.customer?.email?.trim()) {
    throw new MonerooValidationError(
      "L'adresse e-mail du client est obligatoire.",
    );
  }

  if (!input.customer.first_name?.trim()) {
    throw new MonerooValidationError("Le prénom du client est obligatoire.");
  }

  if (!input.customer.last_name?.trim()) {
    throw new MonerooValidationError("Le nom du client est obligatoire.");
  }
}

function getErrorMessage(payload: unknown, fallbackMessage: string): string {
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
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return fallbackMessage;
}

async function readResponseBody(response: Response): Promise<unknown> {
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
    controller.abort();
  }, timeoutMs);

  const handleExternalAbort = () => {
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener("abort", handleExternalAbort, {
        once: true,
      });
    }
  }

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", handleExternalAbort);
    },
  };
}

async function requestMoneroo<T>(
  parameters: MonerooRequestParameters,
  validateData: (value: unknown) => value is T,
): Promise<T> {
  const config = getMonerooConfig();
  const url = `${config.apiBaseUrl}${parameters.endpoint}`;
  const abortContext = createAbortContext(
    config.requestTimeoutMs,
    parameters.signal,
  );

  try {
    const headers = new Headers({
      Accept: "application/json",
      Authorization: `Bearer ${config.secretKey}`,
      "Content-Type": "application/json",
    });

    if (parameters.idempotencyKey?.trim()) {
      headers.set("Idempotency-Key", parameters.idempotencyKey.trim());
    }

    const response = await fetch(url, {
      method: parameters.method,
      headers,
      body:
        parameters.body === undefined
          ? undefined
          : JSON.stringify(parameters.body),
      cache: "no-store",
      signal: abortContext.signal,
    });

    const responseBody = await readResponseBody(response);

    if (!response.ok) {
      const details = {
        status: response.status,
        endpoint: parameters.endpoint,
        method: parameters.method,
        responseBody,
      };

      if (response.status === 401 || response.status === 403) {
        throw new MonerooAuthenticationError(details);
      }

      if (response.status === 404) {
        const paymentId =
          parameters.endpoint.split("/").filter(Boolean).at(-1) ?? "inconnu";

        throw new MonerooPaymentNotFoundError(paymentId, details);
      }

      const message = getErrorMessage(
        responseBody,
        `Moneroo a retourné une erreur HTTP ${response.status}.`,
      );

      if (response.status === 400 || response.status === 422) {
        throw new MonerooValidationError(message, details);
      }

      throw new MonerooApiError(message, details);
    }

    if (!validateData(responseBody)) {
      throw new MonerooResponseError(
        "La réponse reçue de Moneroo ne respecte pas le format attendu.",
        {
          status: response.status,
          endpoint: parameters.endpoint,
          method: parameters.method,
          responseBody,
        },
      );
    }

    return responseBody;
  } catch (error) {
    if (
      error instanceof MonerooApiError ||
      error instanceof MonerooResponseError
    ) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      if (abortContext.didTimeout()) {
        throw new MonerooTimeoutError(config.requestTimeoutMs, {
          endpoint: parameters.endpoint,
          method: parameters.method,
          cause: error,
        });
      }

      throw new MonerooRequestError("La requête Moneroo a été annulée.", {
        endpoint: parameters.endpoint,
        method: parameters.method,
        cause: error,
      });
    }

    throw new MonerooRequestError(
      "Impossible de communiquer avec l'API Moneroo.",
      {
        endpoint: parameters.endpoint,
        method: parameters.method,
        cause: error,
      },
    );
  } finally {
    abortContext.cleanup();
  }
}

function isPaymentApiResponse(value: unknown): value is {
  success: boolean;
  message?: string | null;
  data: MonerooPaymentData;
} {
  return isMonerooApiResponse(value, isMonerooPaymentData);
}

export async function initializeMonerooPayment(
  input: MonerooInitializePaymentInput,
  options: MonerooRequestOptions = {},
): Promise<MonerooInitializePaymentResponse> {
  validateInitializePaymentInput(input);

  const normalizedInput: MonerooInitializePaymentInput = {
    ...input,
    amount: input.amount,
    currency: input.currency.trim().toUpperCase(),
    description: input.description.trim(),
    return_url: input.return_url.trim(),
    customer: {
      ...input.customer,
      email: input.customer.email.trim().toLowerCase(),
      first_name: input.customer.first_name.trim(),
      last_name: input.customer.last_name.trim(),
      phone: input.customer.phone?.trim() || undefined,
      address: input.customer.address?.trim() || undefined,
      city: input.customer.city?.trim() || undefined,
      country_code:
        input.customer.country_code?.trim().toUpperCase() || undefined,
    },
  };

  const response = await requestMoneroo<MonerooInitializePaymentResponse>(
    {
      method: "POST",
      endpoint: "/v1/payments/initialize",
      body: normalizedInput,
      signal: options.signal,
      idempotencyKey: options.idempotencyKey,
    },
    isPaymentApiResponse,
  );

  if (!response.data.link?.trim()) {
    throw new MonerooResponseError(
      "Moneroo n'a retourné aucun lien de paiement.",
      {
        endpoint: "/v1/payments/initialize",
        method: "POST",
        responseBody: response,
      },
    );
  }

  return response;
}

export async function retrieveMonerooPayment(
  paymentId: string,
  options: Pick<MonerooRequestOptions, "signal"> = {},
): Promise<MonerooRetrievePaymentResponse> {
  const encodedPaymentId = validatePaymentId(paymentId);

  return requestMoneroo<MonerooRetrievePaymentResponse>(
    {
      method: "GET",
      endpoint: `/v1/payments/${encodedPaymentId}`,
      signal: options.signal,
    },
    isPaymentApiResponse,
  );
}

export async function verifyMonerooPayment(
  paymentId: string,
  options: Pick<MonerooRequestOptions, "signal"> = {},
): Promise<MonerooVerifyPaymentResponse> {
  const encodedPaymentId = validatePaymentId(paymentId);

  return requestMoneroo<MonerooVerifyPaymentResponse>(
    {
      method: "GET",
      endpoint: `/v1/payments/${encodedPaymentId}/verify`,
      signal: options.signal,
    },
    isPaymentApiResponse,
  );
}

export function serializeMonerooErrorPayload(
  payload: unknown,
): MonerooApiErrorPayload | null {
  return isRecord(payload) ? (payload as MonerooApiErrorPayload) : null;
}
