import "server-only";

import {
  fedapayProvider,
} from "@/lib/payments/providers/fedapay/fedapay-provider";
import {
  monerooProvider,
} from "@/lib/payments/providers/moneroo/moneroo-provider";
import type {
  CreateProviderCheckoutInput,
  PaymentProviderAdapter,
  PaymentProviderName,
  ProviderCheckoutResult,
} from "@/lib/payments/payment-provider-types";

const monerooPaymentProvider: PaymentProviderAdapter =
  Object.freeze({
    name: "MONEROO",

    async createCheckout(
      input: CreateProviderCheckoutInput,
    ): Promise<ProviderCheckoutResult> {
      const result =
        await monerooProvider.createCheckout(
          {
            amount: input.amount,
            currency: input.currency,
            description: input.description,
            returnUrl: input.returnUrl,

            customer: {
              email: input.customer.email,
              firstName:
                input.customer.firstName,
              lastName:
                input.customer.lastName,
              phone:
                input.customer.phone,
              address:
                input.customer.address,
              city:
                input.customer.city,
              countryCode:
                input.customer.countryCode,
            },

            metadata:
              input.metadata,
          },
          {
            signal:
              input.signal,

            idempotencyKey:
              input.idempotencyKey,
          },
        );

      return Object.freeze({
        provider:
          "MONEROO" as const,

        providerTransactionId:
          result.providerTransactionId,

        providerReference:
          result.providerReference,

        checkoutUrl:
          result.checkoutUrl,

        status:
          result.status,

        rawStatus:
          result.rawStatus,

        raw:
          result.raw,
      });
    },
  });

const PROVIDERS: Readonly<
  Record<
    PaymentProviderName,
    PaymentProviderAdapter
  >
> = Object.freeze({
  FEDAPAY:
    fedapayProvider,

  MONEROO:
    monerooPaymentProvider,
});

function normalizeProviderName(
  value:
    | string
    | null
    | undefined,
): PaymentProviderName | null {
  const normalizedValue =
    value
      ?.trim()
      .toUpperCase();

  if (
    normalizedValue ===
      "MONEROO" ||
    normalizedValue ===
      "FEDAPAY"
  ) {
    return normalizedValue;
  }

  return null;
}

export function getDefaultPaymentProviderName():
  PaymentProviderName {
  return (
    normalizeProviderName(
      process.env
        .PAYMENT_PRIMARY_PROVIDER,
    ) ??
    "MONEROO"
  );
}

export function getPaymentProvider(
  providerName?:
    PaymentProviderName,
): PaymentProviderAdapter {
  const resolvedProviderName =
    providerName ??
    getDefaultPaymentProviderName();

  return PROVIDERS[
    resolvedProviderName
  ];
}

export function isPaymentProviderName(
  value:
    unknown,
): value is PaymentProviderName {
  return (
    typeof value ===
      "string" &&
    normalizeProviderName(
      value,
    ) !== null
  );
}