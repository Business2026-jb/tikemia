import "server-only";

import type { PaymentStatus } from "@prisma/client";

import {
  initializeMonerooPayment,
  retrieveMonerooPayment,
  verifyMonerooPayment,
} from "./moneroo-client";
import { MonerooResponseError } from "./moneroo-errors";
import { mapMonerooStatusToPaymentStatus } from "./moneroo-status";
import type {
  MonerooInitializePaymentInput,
  MonerooInitializePaymentResponse,
  MonerooMetadata,
  MonerooPaymentData,
  MonerooRequestOptions,
  MonerooRetrievePaymentResponse,
  MonerooVerifyPaymentResponse,
} from "./moneroo-types";

export const MONEROO_PROVIDER_NAME = "MONEROO" as const;

export type MonerooProviderName = typeof MONEROO_PROVIDER_NAME;

export type CreateMonerooCheckoutInput = Readonly<{
  amount: number;
  currency: string;
  description: string;
  returnUrl: string;
  customer: Readonly<{
    email: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    countryCode?: string | null;
  }>;
  metadata?: MonerooMetadata;
}>;

export type MonerooCheckoutResult = Readonly<{
  provider: MonerooProviderName;
  providerTransactionId: string;
  providerReference: string | null;
  checkoutUrl: string;
  status: PaymentStatus;
  rawStatus: string;
  raw: MonerooInitializePaymentResponse;
}>;

export type MonerooPaymentResult = Readonly<{
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
  raw: MonerooRetrievePaymentResponse | MonerooVerifyPaymentResponse;
}>;

function normalizeOptionalText(
  value: string | null | undefined,
): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue || undefined;
}

function requireText(
  value: string | null | undefined,
  fieldName: string,
): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new MonerooResponseError(
      `La réponse Moneroo ne contient pas de valeur valide pour ${fieldName}.`,
    );
  }

  return normalizedValue;
}

function normalizeCurrency(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim().toUpperCase();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof value.code === "string" &&
    value.code.trim()
  ) {
    return value.code.trim().toUpperCase();
  }

  throw new MonerooResponseError(
    "La réponse Moneroo ne contient pas une devise valide.",
  );
}

function normalizeAmount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim() &&
    Number.isFinite(Number(value))
  ) {
    return Number(value);
  }

  throw new MonerooResponseError(
    "La réponse Moneroo ne contient pas un montant valide.",
  );
}

function readNestedString(
  source: Record<string, unknown> | null | undefined,
  keys: readonly string[],
): string | null {
  if (!source) {
    return null;
  }

  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function extractGateway(data: MonerooPaymentData): string | null {
  const directGateway =
    typeof data.gateway === "string" ? data.gateway.trim() : "";

  if (directGateway) {
    return directGateway;
  }

  const capture =
    typeof data.capture === "object" &&
    data.capture !== null &&
    !Array.isArray(data.capture)
      ? (data.capture as Record<string, unknown>)
      : null;

  return (
    readNestedString(capture, ["gateway", "provider", "name"]) ??
    readNestedString(data.context ?? null, ["gateway", "provider"])
  );
}

function extractPaymentMethod(data: MonerooPaymentData): string | null {
  const directMethod =
    typeof data.method === "string" ? data.method.trim() : "";

  if (directMethod) {
    return directMethod;
  }

  const capture =
    typeof data.capture === "object" &&
    data.capture !== null &&
    !Array.isArray(data.capture)
      ? (data.capture as Record<string, unknown>)
      : null;

  return (
    readNestedString(capture, ["method", "payment_method", "paymentMethod"]) ??
    readNestedString(data.context ?? null, [
      "payment_method",
      "payment_method_type",
      "method",
    ])
  );
}

function mapPaymentResult(
  response: MonerooRetrievePaymentResponse | MonerooVerifyPaymentResponse,
): MonerooPaymentResult {
  const data = response.data;
  const providerTransactionId = requireText(data.id, "data.id");
  const rawStatus = requireText(data.status, "data.status");

  return Object.freeze({
    provider: MONEROO_PROVIDER_NAME,
    providerTransactionId,
    providerReference: normalizeOptionalText(data.reference) ?? null,
    amount: normalizeAmount(data.amount),
    currency: normalizeCurrency(data.currency),
    status: mapMonerooStatusToPaymentStatus(rawStatus),
    rawStatus,
    isProcessed: data.is_processed === true,
    processedAt: normalizeOptionalText(data.processed_at) ?? null,
    gateway: extractGateway(data),
    paymentMethod: extractPaymentMethod(data),
    metadata: data.metadata ?? null,
    raw: response,
  });
}

function toInitializePaymentInput(
  input: CreateMonerooCheckoutInput,
): MonerooInitializePaymentInput {
  return {
    amount: input.amount,
    currency: input.currency.trim().toUpperCase(),
    description: input.description.trim(),
    return_url: input.returnUrl.trim(),
    customer: {
      email: input.customer.email.trim().toLowerCase(),
      first_name: input.customer.firstName.trim(),
      last_name: input.customer.lastName.trim(),
      phone: normalizeOptionalText(input.customer.phone),
      address: normalizeOptionalText(input.customer.address),
      city: normalizeOptionalText(input.customer.city),
      country_code: normalizeOptionalText(
        input.customer.countryCode,
      )?.toUpperCase(),
    },
    metadata: input.metadata,
  };
}

export async function createMonerooCheckout(
  input: CreateMonerooCheckoutInput,
  options: MonerooRequestOptions = {},
): Promise<MonerooCheckoutResult> {
  const response = await initializeMonerooPayment(
    toInitializePaymentInput(input),
    options,
  );

  const providerTransactionId = requireText(response.data.id, "data.id");
  const checkoutUrl = requireText(response.data.link, "data.link");
  const rawStatus = requireText(response.data.status, "data.status");

  return Object.freeze({
    provider: MONEROO_PROVIDER_NAME,
    providerTransactionId,
    providerReference: normalizeOptionalText(response.data.reference) ?? null,
    checkoutUrl,
    status: mapMonerooStatusToPaymentStatus(rawStatus),
    rawStatus,
    raw: response,
  });
}

export async function getMonerooPayment(
  paymentId: string,
  options: Pick<MonerooRequestOptions, "signal"> = {},
): Promise<MonerooPaymentResult> {
  const response = await retrieveMonerooPayment(paymentId, options);

  return mapPaymentResult(response);
}

export async function verifyMonerooProviderPayment(
  paymentId: string,
  options: Pick<MonerooRequestOptions, "signal"> = {},
): Promise<MonerooPaymentResult> {
  const response = await verifyMonerooPayment(paymentId, options);

  return mapPaymentResult(response);
}

export const monerooProvider = Object.freeze({
  name: MONEROO_PROVIDER_NAME,
  createCheckout: createMonerooCheckout,
  getPayment: getMonerooPayment,
  verifyPayment: verifyMonerooProviderPayment,
});
