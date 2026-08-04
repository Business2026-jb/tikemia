import { PaymentStatus } from "@prisma/client";

import type { MonerooPaymentStatus } from "./moneroo-types";

const MONEROO_STATUS_TO_PAYMENT_STATUS: Readonly<
  Record<string, PaymentStatus>
> = Object.freeze({
  initiated: PaymentStatus.PENDING,
  pending: PaymentStatus.PENDING,
  processing: PaymentStatus.PROCESSING,
  success: PaymentStatus.SUCCESS,
  successful: PaymentStatus.SUCCESS,
  succeeded: PaymentStatus.SUCCESS,
  paid: PaymentStatus.SUCCESS,
  completed: PaymentStatus.SUCCESS,
  failed: PaymentStatus.FAILED,
  error: PaymentStatus.FAILED,
  declined: PaymentStatus.FAILED,
  cancelled: PaymentStatus.CANCELLED,
  canceled: PaymentStatus.CANCELLED,
  expired: PaymentStatus.EXPIRED,
  refunded: PaymentStatus.REFUNDED,
  partially_refunded: PaymentStatus.PARTIALLY_REFUNDED,
  disputed: PaymentStatus.DISPUTED,
});

export function normalizeMonerooStatus(
  status: MonerooPaymentStatus | null | undefined,
): string {
  return typeof status === "string" ? status.trim().toLowerCase() : "";
}

export function mapMonerooStatusToPaymentStatus(
  status: MonerooPaymentStatus | null | undefined,
): PaymentStatus {
  const normalizedStatus = normalizeMonerooStatus(status);

  return (
    MONEROO_STATUS_TO_PAYMENT_STATUS[normalizedStatus] ??
    PaymentStatus.PROCESSING
  );
}

export function isMonerooPaymentSuccessful(
  status: MonerooPaymentStatus | null | undefined,
): boolean {
  return mapMonerooStatusToPaymentStatus(status) === PaymentStatus.SUCCESS;
}

export function isMonerooPaymentPending(
  status: MonerooPaymentStatus | null | undefined,
): boolean {
  const mappedStatus = mapMonerooStatusToPaymentStatus(status);

  return (
    mappedStatus === PaymentStatus.PENDING ||
    mappedStatus === PaymentStatus.PROCESSING
  );
}

export function isMonerooPaymentFinal(
  status: MonerooPaymentStatus | null | undefined,
): boolean {
  const mappedStatus = mapMonerooStatusToPaymentStatus(status);

  return (
    mappedStatus === PaymentStatus.SUCCESS ||
    mappedStatus === PaymentStatus.FAILED ||
    mappedStatus === PaymentStatus.CANCELLED ||
    mappedStatus === PaymentStatus.EXPIRED ||
    mappedStatus === PaymentStatus.REFUNDED ||
    mappedStatus === PaymentStatus.PARTIALLY_REFUNDED ||
    mappedStatus === PaymentStatus.DISPUTED
  );
}
