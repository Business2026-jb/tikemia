import type { PaymentStatus } from "@prisma/client";

export const PAYMENT_PROVIDER_NAMES = [
  "MONEROO",
  "FEDAPAY",
] as const;

export type PaymentProviderName =
  (typeof PAYMENT_PROVIDER_NAMES)[number];

export type PaymentMethod =
  | "MONEROO_CHECKOUT"
  | "FEDAPAY_CHECKOUT"
  | "MOBILE_MONEY"
  | "CARD"
  | "MTN_MOMO"
  | "MOOV_MONEY"
  | "CELTIIS_CASH"
  | "ORANGE_MONEY"
  | "WAVE"
  | "VISA"
  | "MASTERCARD";

export type PaymentMetadataValue =
  | string
  | number
  | boolean
  | null;

export type PaymentMetadata =
  Record<string, PaymentMetadataValue>;

export type CreateProviderCheckoutCustomer = Readonly<{
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  countryCode?: string | null;
}>;

export type CreateProviderCheckoutInput = Readonly<{
  amount: number;
  currency: string;
  description: string;
  returnUrl: string;
  customer: CreateProviderCheckoutCustomer;
  metadata?: PaymentMetadata;
  idempotencyKey?: string;
  signal?: AbortSignal;
}>;

export type ProviderCheckoutResult = Readonly<{
  provider: PaymentProviderName;
  providerTransactionId: string;
  providerReference: string | null;
  checkoutUrl: string;
  status: PaymentStatus;
  rawStatus: string;
  raw: unknown;
}>;

export interface PaymentProviderAdapter {
  readonly name: PaymentProviderName;

  createCheckout(
    input: CreateProviderCheckoutInput,
  ): Promise<ProviderCheckoutResult>;
}

export type CreatePaymentInput =
  CreateProviderCheckoutInput &
    Readonly<{
      provider?: PaymentProviderName;
    }>;

export type CreatePaymentResult =
  ProviderCheckoutResult;
