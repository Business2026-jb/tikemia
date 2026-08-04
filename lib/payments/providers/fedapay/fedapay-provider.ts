import "server-only";

import { PaymentStatus } from "@prisma/client";

import {
  createFedaPayHostedCheckout,
} from "./fedapay-client";
import type {
  CreateProviderCheckoutInput,
  PaymentProviderAdapter,
  ProviderCheckoutResult,
} from "@/lib/payments/payment-provider-types";

export const FEDAPAY_PROVIDER_NAME =
  "FEDAPAY" as const;

function normalizeRequiredText(
  value: string,
  fieldName: string,
): string {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error(
      `${fieldName} est obligatoire pour créer le paiement FedaPay.`,
    );
  }

  return normalizedValue;
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue || undefined;
}

function normalizeAmount(amount: number): number {
  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "Le montant FedaPay doit être un entier positif.",
    );
  }

  return amount;
}

function normalizeCurrency(currency: string): string {
  const normalizedCurrency =
    currency.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
    throw new Error(
      "La devise FedaPay doit respecter le format ISO 4217.",
    );
  }

  return normalizedCurrency;
}

function mapFedaPayStatus(
  status: string | null | undefined,
): PaymentStatus {
  const normalizedStatus =
    status?.trim().toLowerCase() ?? "";

  if (
    normalizedStatus === "approved" ||
    normalizedStatus === "success" ||
    normalizedStatus === "successful" ||
    normalizedStatus === "paid" ||
    normalizedStatus === "completed"
  ) {
    return PaymentStatus.SUCCESS;
  }

  if (
    normalizedStatus === "failed" ||
    normalizedStatus === "declined"
  ) {
    return PaymentStatus.FAILED;
  }

  if (
    normalizedStatus === "cancelled" ||
    normalizedStatus === "canceled"
  ) {
    return PaymentStatus.CANCELLED;
  }

  if (normalizedStatus === "expired") {
    return PaymentStatus.EXPIRED;
  }

  if (
    normalizedStatus === "processing" ||
    normalizedStatus === "transferred"
  ) {
    return PaymentStatus.PROCESSING;
  }

  return PaymentStatus.PENDING;
}

export async function createFedaPayProviderCheckout(
  input: CreateProviderCheckoutInput,
): Promise<ProviderCheckoutResult> {
  const amount = normalizeAmount(input.amount);
  const currency = normalizeCurrency(input.currency);
  const description = normalizeRequiredText(
    input.description,
    "La description",
  );
  const returnUrl = normalizeRequiredText(
    input.returnUrl,
    "L'URL de retour",
  );
  const email = normalizeRequiredText(
    input.customer.email,
    "L'adresse e-mail du client",
  ).toLowerCase();
  const firstName = normalizeRequiredText(
    input.customer.firstName,
    "Le prénom du client",
  );
  const lastName = normalizeRequiredText(
    input.customer.lastName,
    "Le nom du client",
  );

  const hostedCheckout =
    await createFedaPayHostedCheckout({
      transaction: {
        amount,
        currency,
        description,
        callbackUrl: returnUrl,
        customer: {
          email,
          firstname: firstName,
          lastname: lastName,
        },
        metadata: input.metadata,
      },
      idempotencyKey:
        normalizeOptionalText(
          input.idempotencyKey,
        ),
      signal: input.signal,
    });

  const providerTransactionId = String(
    hostedCheckout.transaction.id,
  );
  const providerReference =
    hostedCheckout.transaction.reference?.trim() ||
    null;
  const checkoutUrl =
    hostedCheckout.paymentLink.url;
  const rawStatus =
    hostedCheckout.transaction.rawStatus?.trim() ||
    "pending";

  return Object.freeze({
    provider: FEDAPAY_PROVIDER_NAME,
    providerTransactionId,
    providerReference,
    checkoutUrl,
    status: mapFedaPayStatus(rawStatus),
    rawStatus,
    raw: hostedCheckout,
  });
}

export const fedapayProvider: PaymentProviderAdapter =
  Object.freeze({
    name: FEDAPAY_PROVIDER_NAME,
    createCheckout:
      createFedaPayProviderCheckout,
  });
