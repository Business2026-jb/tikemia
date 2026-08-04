import "server-only";

import { getPaymentProvider } from "./provider-router";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
} from "./payment-provider-types";

function normalizeRequiredText(
  value: string,
  fieldName: string,
): string {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error(
      `${fieldName} est obligatoire pour créer le paiement.`,
    );
  }

  return normalizedValue;
}

function validateCreatePaymentInput(
  input: CreatePaymentInput,
): void {
  if (
    !Number.isSafeInteger(input.amount) ||
    input.amount <= 0
  ) {
    throw new Error(
      "Le montant du paiement doit être un entier positif.",
    );
  }

  const currency =
    input.currency.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error(
      "La devise du paiement doit respecter le format ISO 4217.",
    );
  }

  normalizeRequiredText(
    input.description,
    "La description",
  );
  normalizeRequiredText(
    input.returnUrl,
    "L'URL de retour",
  );
  normalizeRequiredText(
    input.customer.email,
    "L'adresse e-mail du client",
  );
  normalizeRequiredText(
    input.customer.firstName,
    "Le prénom du client",
  );
  normalizeRequiredText(
    input.customer.lastName,
    "Le nom du client",
  );
}

export async function createPayment(
  input: CreatePaymentInput,
): Promise<CreatePaymentResult> {
  validateCreatePaymentInput(input);

  const provider =
    getPaymentProvider(input.provider);

  return provider.createCheckout({
    amount: input.amount,
    currency:
      input.currency.trim().toUpperCase(),
    description: input.description.trim(),
    returnUrl: input.returnUrl.trim(),
    customer: {
      email:
        input.customer.email
          .trim()
          .toLowerCase(),
      firstName:
        input.customer.firstName.trim(),
      lastName:
        input.customer.lastName.trim(),
      phone:
        input.customer.phone?.trim() ||
        undefined,
      address:
        input.customer.address?.trim() ||
        undefined,
      city:
        input.customer.city?.trim() ||
        undefined,
      countryCode:
        input.customer.countryCode
          ?.trim()
          .toUpperCase() ||
        undefined,
    },
    metadata: input.metadata,
    idempotencyKey:
      input.idempotencyKey?.trim() ||
      undefined,
    signal: input.signal,
  });
}
