import "server-only";

import type { PaymentStatus } from "@prisma/client";

import {
  initializeMonerooPayment,
  retrieveMonerooPayment,
  verifyMonerooPayment,
} from "./moneroo-client";
import { MonerooResponseError } from "./moneroo-errors";
import { mapMonerooStatusToPaymentStatus } from "./moneroo-status";
import {
  getMonerooCheckoutUrl,
  type MonerooInitializePaymentInput,
  type MonerooInitializePaymentResponse,
  type MonerooMetadata,
  type MonerooPaymentData,
  type MonerooRequestOptions,
  type MonerooRetrievePaymentResponse,
  type MonerooVerifyPaymentResponse,
} from "./moneroo-types";

export const MONEROO_PROVIDER_NAME =
  "MONEROO" as const;

export type MonerooProviderName =
  typeof MONEROO_PROVIDER_NAME;

export type CreateMonerooCheckoutInput =
  Readonly<{
    amount: number;
    currency: string;
    description: string;
    returnUrl: string;

    customer: Readonly<{
      email: string;
      firstName: string;
      lastName: string;

      /*
       * Ces informations restent enregistrées dans Tikemia.
       *
       * Elles ne sont volontairement pas transmises à Moneroo
       * afin qu’elles ne puissent jamais bloquer l’ouverture
       * de la page de paiement hébergée.
       */
      phone?: string | null;
      address?: string | null;
      city?: string | null;
      countryCode?: string | null;
    }>;

    metadata?: MonerooMetadata;
  }>;

export type MonerooCheckoutResult =
  Readonly<{
    provider: MonerooProviderName;
    providerTransactionId: string;
    providerReference: string | null;
    checkoutUrl: string;
    status: PaymentStatus;
    rawStatus: string;
    raw: MonerooInitializePaymentResponse;
  }>;

export type MonerooPaymentResult =
  Readonly<{
    provider: MonerooProviderName;
    providerTransactionId: string;
    providerReference: string | null;
    amount: number;
    currency: string;
    status: PaymentStatus;
    rawStatus: string;
    isProcessed: boolean;
    processedAt: string | null;
    gateway: string | null;
    paymentMethod: string | null;
    metadata: Record<string, unknown> | null;

    raw:
      | MonerooRetrievePaymentResponse
      | MonerooVerifyPaymentResponse;
  }>;

function normalizeOptionalText(
  value: string | null | undefined,
): string | undefined {
  const normalizedValue =
    value?.trim();

  return normalizedValue || undefined;
}

function requireInputText(
  value: string | null | undefined,
  fieldName: string,
): string {
  const normalizedValue =
    value?.trim();

  if (!normalizedValue) {
    throw new MonerooResponseError(
      `La valeur ${fieldName} est obligatoire pour créer le paiement Moneroo.`,
    );
  }

  return normalizedValue;
}

function requireResponseText(
  value: string | null | undefined,
  fieldName: string,
): string {
  const normalizedValue =
    value?.trim();

  if (!normalizedValue) {
    throw new MonerooResponseError(
      `La réponse Moneroo ne contient pas de valeur valide pour ${fieldName}.`,
    );
  }

  return normalizedValue;
}

function normalizeEmail(
  value: string | null | undefined,
): string {
  const normalizedValue =
    requireInputText(
      value,
      "customer.email",
    ).toLowerCase();

  if (
    normalizedValue.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      normalizedValue,
    )
  ) {
    throw new MonerooResponseError(
      "L’adresse e-mail du client n’est pas valide.",
    );
  }

  return normalizedValue;
}

function normalizeInputCurrency(
  value: string,
): string {
  const normalizedValue =
    value.trim().toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(
      normalizedValue,
    )
  ) {
    throw new MonerooResponseError(
      "La devise du paiement Moneroo n’est pas valide.",
    );
  }

  return normalizedValue;
}

function normalizeResponseCurrency(
  value: unknown,
): string {
  if (
    typeof value === "string" &&
    value.trim()
  ) {
    return value
      .trim()
      .toUpperCase();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof value.code === "string" &&
    value.code.trim()
  ) {
    return value.code
      .trim()
      .toUpperCase();
  }

  throw new MonerooResponseError(
    "La réponse Moneroo ne contient pas une devise valide.",
  );
}

function normalizeInputAmount(
  value: number,
): number {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new MonerooResponseError(
      "Le montant du paiement Moneroo doit être supérieur à zéro.",
    );
  }

  if (
    !Number.isSafeInteger(value)
  ) {
    throw new MonerooResponseError(
      "Le montant envoyé à Moneroo doit être un entier positif.",
    );
  }

  return value;
}

function normalizeResponseAmount(
  value: unknown,
): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string"
  ) {
    const normalizedValue =
      value
        .trim()
        .replace(",", ".");

    if (
      normalizedValue &&
      Number.isFinite(
        Number(normalizedValue),
      )
    ) {
      return Number(
        normalizedValue,
      );
    }
  }

  throw new MonerooResponseError(
    "La réponse Moneroo ne contient pas un montant valide.",
  );
}

function normalizeReturnUrl(
  value: string,
): string {
  const normalizedValue =
    requireInputText(
      value,
      "returnUrl",
    );

  let url: URL;

  try {
    url = new URL(
      normalizedValue,
    );
  } catch {
    throw new MonerooResponseError(
      "L’URL de retour du paiement Moneroo n’est pas valide.",
    );
  }

  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:"
  ) {
    throw new MonerooResponseError(
      "L’URL de retour Moneroo doit utiliser HTTP ou HTTPS.",
    );
  }

  if (
    process.env.NODE_ENV ===
      "production" &&
    url.protocol !== "https:"
  ) {
    throw new MonerooResponseError(
      "L’URL de retour Moneroo doit utiliser HTTPS en production.",
    );
  }

  return url.toString();
}

function readNestedString(
  source:
    | Record<string, unknown>
    | null
    | undefined,
  keys: readonly string[],
): string | null {
  if (!source) {
    return null;
  }

  for (const key of keys) {
    const value =
      source[key];

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return null;
}

function extractGateway(
  data: MonerooPaymentData,
): string | null {
  const directGateway =
    typeof data.gateway === "string"
      ? data.gateway.trim()
      : "";

  if (directGateway) {
    return directGateway;
  }

  const capture =
    typeof data.capture === "object" &&
    data.capture !== null &&
    !Array.isArray(data.capture)
      ? (data.capture as Record<
          string,
          unknown
        >)
      : null;

  return (
    readNestedString(
      capture,
      [
        "gateway",
        "provider",
        "name",
      ],
    ) ??
    readNestedString(
      data.context ?? null,
      [
        "gateway",
        "provider",
      ],
    )
  );
}

function extractPaymentMethod(
  data: MonerooPaymentData,
): string | null {
  const directMethod =
    typeof data.method === "string"
      ? data.method.trim()
      : "";

  if (directMethod) {
    return directMethod;
  }

  const capture =
    typeof data.capture === "object" &&
    data.capture !== null &&
    !Array.isArray(data.capture)
      ? (data.capture as Record<
          string,
          unknown
        >)
      : null;

  return (
    readNestedString(
      capture,
      [
        "method",
        "payment_method",
        "paymentMethod",
      ],
    ) ??
    readNestedString(
      data.context ?? null,
      [
        "payment_method",
        "paymentMethod",
        "payment_method_type",
        "method",
      ],
    )
  );
}

function extractProcessedState(
  data: MonerooPaymentData,
): boolean {
  return (
    data.is_processed === true ||
    data.isProcessed === true
  );
}

function extractProcessedAt(
  data: MonerooPaymentData,
): string | null {
  return (
    normalizeOptionalText(
      data.processed_at,
    ) ??
    normalizeOptionalText(
      data.processedAt,
    ) ??
    null
  );
}

function mapPaymentResult(
  response:
    | MonerooRetrievePaymentResponse
    | MonerooVerifyPaymentResponse,
): MonerooPaymentResult {
  const data =
    response.data;

  const providerTransactionId =
    requireResponseText(
      data.id,
      "data.id",
    );

  const rawStatus =
    requireResponseText(
      data.status,
      "data.status",
    );

  return Object.freeze({
    provider:
      MONEROO_PROVIDER_NAME,

    providerTransactionId,

    providerReference:
      normalizeOptionalText(
        data.reference,
      ) ?? null,

    amount:
      normalizeResponseAmount(
        data.amount,
      ),

    currency:
      normalizeResponseCurrency(
        data.currency,
      ),

    status:
      mapMonerooStatusToPaymentStatus(
        rawStatus,
      ),

    rawStatus,

    isProcessed:
      extractProcessedState(
        data,
      ),

    processedAt:
      extractProcessedAt(
        data,
      ),

    gateway:
      extractGateway(
        data,
      ),

    paymentMethod:
      extractPaymentMethod(
        data,
      ),

    metadata:
      data.metadata ?? null,

    raw:
      response,
  });
}

/**
 * Construit uniquement les informations nécessaires à Moneroo.
 *
 * Les informations suivantes ne sont pas envoyées :
 *
 * - téléphone ;
 * - adresse ;
 * - ville ;
 * - code pays.
 *
 * Elles restent enregistrées dans Tikemia pour la commande,
 * les billets, le support et les notifications.
 */
function toInitializePaymentInput(
  input: CreateMonerooCheckoutInput,
): MonerooInitializePaymentInput {
  const firstName =
    requireInputText(
      input.customer.firstName,
      "customer.firstName",
    );

  const lastName =
    requireInputText(
      input.customer.lastName,
      "customer.lastName",
    );

  const description =
    requireInputText(
      input.description,
      "description",
    );

  return {
    amount:
      normalizeInputAmount(
        input.amount,
      ),

    currency:
      normalizeInputCurrency(
        input.currency,
      ),

    description,

    return_url:
      normalizeReturnUrl(
        input.returnUrl,
      ),

    customer: {
      email:
        normalizeEmail(
          input.customer.email,
        ),

      first_name:
        firstName,

      last_name:
        lastName,
    },

    ...(input.metadata
      ? {
          metadata:
            input.metadata,
        }
      : {}),
  };
}

export async function createMonerooCheckout(
  input: CreateMonerooCheckoutInput,
  options: MonerooRequestOptions = {},
): Promise<MonerooCheckoutResult> {
  const initializeInput =
    toInitializePaymentInput(
      input,
    );

  const response =
    await initializeMonerooPayment(
      initializeInput,
      options,
    );

  const providerTransactionId =
    requireResponseText(
      response.data.id,
      "data.id",
    );

  /*
   * La réponse réelle de Moneroo utilise actuellement :
   *
   * data.checkout_url
   *
   * Le helper accepte aussi checkoutUrl et link pour préserver
   * la compatibilité avec les autres formats.
   */
  const checkoutUrl =
    getMonerooCheckoutUrl(
      response.data,
    );

  if (!checkoutUrl) {
    throw new MonerooResponseError(
      "La réponse Moneroo ne contient aucun lien de paiement exploitable.",
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
   * L’initialisation ne retourne pas forcément de statut.
   * Dans ce cas, le paiement vient d’être initialisé.
   */
  const rawStatus =
    normalizeOptionalText(
      response.data.status,
    ) ?? "initiated";

  return Object.freeze({
    provider:
      MONEROO_PROVIDER_NAME,

    providerTransactionId,

    providerReference:
      normalizeOptionalText(
        response.data.reference,
      ) ?? null,

    checkoutUrl,

    status:
      mapMonerooStatusToPaymentStatus(
        rawStatus,
      ),

    rawStatus,

    raw:
      response,
  });
}

export async function getMonerooPayment(
  paymentId: string,
  options: Pick<
    MonerooRequestOptions,
    "signal"
  > = {},
): Promise<MonerooPaymentResult> {
  const normalizedPaymentId =
    requireInputText(
      paymentId,
      "paymentId",
    );

  const response =
    await retrieveMonerooPayment(
      normalizedPaymentId,
      options,
    );

  return mapPaymentResult(
    response,
  );
}

export async function verifyMonerooProviderPayment(
  paymentId: string,
  options: Pick<
    MonerooRequestOptions,
    "signal"
  > = {},
): Promise<MonerooPaymentResult> {
  const normalizedPaymentId =
    requireInputText(
      paymentId,
      "paymentId",
    );

  const response =
    await verifyMonerooPayment(
      normalizedPaymentId,
      options,
    );

  return mapPaymentResult(
    response,
  );
}

export const monerooProvider =
  Object.freeze({
    name:
      MONEROO_PROVIDER_NAME,

    createCheckout:
      createMonerooCheckout,

    getPayment:
      getMonerooPayment,

    verifyPayment:
      verifyMonerooProviderPayment,
  });