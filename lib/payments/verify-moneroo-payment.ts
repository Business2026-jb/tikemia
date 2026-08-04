import "server-only";

import {
  PaymentStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  verifyMonerooProviderPayment,
  type MonerooPaymentResult,
} from "@/lib/payments/providers/moneroo/moneroo-provider";
import { MonerooError } from "@/lib/payments/providers/moneroo/moneroo-errors";

const MONEROO_PROVIDER = "MONEROO";

export type VerifyMonerooPaymentInput = Readonly<{
  paymentId?: string;
  orderId?: string;
  providerTransactionId?: string;
  signal?: AbortSignal;
}>;

export type VerifiedMonerooPayment = Readonly<{
  paymentId: string;
  orderId: string;
  provider: typeof MONEROO_PROVIDER;
  providerTransactionId: string;
  providerReference: string | null;
  amount: Prisma.Decimal;
  currency: string;
  status: PaymentStatus;
  rawStatus: string;
  gateway: string | null;
  paymentMethod: string | null;
  isSuccessful: boolean;
  isFinal: boolean;
  verifiedAt: Date;
}>;

export class MonerooPaymentVerificationError extends Error {
  readonly code: string;
  readonly causeValue: unknown;

  constructor(
    message: string,
    code: string,
    causeValue?: unknown,
  ) {
    super(message, { cause: causeValue });

    this.name = "MonerooPaymentVerificationError";
    this.code = code;
    this.causeValue = causeValue;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  const normalizedValue = value?.trim();

  return normalizedValue || null;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isFinalPaymentStatus(status: PaymentStatus): boolean {
  return (
    status === PaymentStatus.SUCCESS ||
    status === PaymentStatus.FAILED ||
    status === PaymentStatus.CANCELLED ||
    status === PaymentStatus.EXPIRED ||
    status === PaymentStatus.PARTIALLY_REFUNDED ||
    status === PaymentStatus.REFUNDED ||
    status === PaymentStatus.DISPUTED
  );
}

function extractMetadataText(
  metadata: Record<string, unknown> | null,
  key: string,
): string | null {
  if (!metadata) {
    return null;
  }

  const value = metadata[key];

  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function serializeVerificationError(error: unknown): Readonly<{
  code: string;
  message: string;
  payload: Prisma.InputJsonValue;
}> {
  if (error instanceof MonerooPaymentVerificationError) {
    return {
      code: error.code,
      message: error.message,
      payload: toJsonValue({
        name: error.name,
        code: error.code,
        message: error.message,
      }),
    };
  }

  if (error instanceof MonerooError) {
    return {
      code: error.code,
      message: error.message,
      payload: toJsonValue({
        name: error.name,
        code: error.code,
        status: error.status,
        endpoint: error.endpoint,
        method: error.method,
        responseBody: error.responseBody,
      }),
    };
  }

  if (error instanceof Error) {
    return {
      code: "MONEROO_PAYMENT_VERIFICATION_FAILED",
      message: error.message,
      payload: toJsonValue({
        name: error.name,
        message: error.message,
      }),
    };
  }

  return {
    code: "MONEROO_PAYMENT_VERIFICATION_FAILED",
    message: "Une erreur inconnue est survenue pendant la vérification du paiement.",
    payload: toJsonValue({
      value: String(error),
    }),
  };
}

async function findPayment(input: VerifyMonerooPaymentInput) {
  const paymentId = normalizeOptionalText(input.paymentId);
  const orderId = normalizeOptionalText(input.orderId);
  const providerTransactionId = normalizeOptionalText(
    input.providerTransactionId,
  );

  if (!paymentId && !orderId && !providerTransactionId) {
    throw new MonerooPaymentVerificationError(
      "Un identifiant de paiement, de commande ou de transaction Moneroo est obligatoire.",
      "MONEROO_PAYMENT_LOOKUP_INVALID",
    );
  }

  return prisma.payment.findFirst({
    where: paymentId
      ? {
          id: paymentId,
        }
      : orderId
        ? {
            orderId,
          }
        : {
            providerTransactionId:
              providerTransactionId as string,
          },
    select: {
      id: true,
      orderId: true,
      provider: true,
      providerReference: true,
      providerTransactionId: true,
      amount: true,
      currency: true,
      status: true,
      order: {
        select: {
          id: true,
          reference: true,
          total: true,
          currency: true,
        },
      },
      attempts: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          id: true,
          providerTransactionId: true,
        },
      },
    },
  });
}

function assertVerifiedPaymentMatchesTikemia(
  payment: {
    orderId: string;
    amount: Prisma.Decimal;
    currency: string;
    order: {
      id: string;
      reference: string;
      total: Prisma.Decimal;
      currency: string;
    };
  },
  providerResult: MonerooPaymentResult,
): void {
  const providerAmount = new Prisma.Decimal(
    providerResult.amount,
  );

  if (!payment.amount.equals(providerAmount)) {
    throw new MonerooPaymentVerificationError(
      "Le montant retourné par Moneroo ne correspond pas au paiement Tikemia.",
      "MONEROO_PAYMENT_AMOUNT_MISMATCH",
    );
  }

  if (!payment.order.total.equals(providerAmount)) {
    throw new MonerooPaymentVerificationError(
      "Le montant retourné par Moneroo ne correspond pas au total de la commande.",
      "MONEROO_ORDER_AMOUNT_MISMATCH",
    );
  }

  const providerCurrency =
    providerResult.currency.trim().toUpperCase();
  const paymentCurrency =
    payment.currency.trim().toUpperCase();
  const orderCurrency =
    payment.order.currency.trim().toUpperCase();

  if (
    providerCurrency !== paymentCurrency ||
    providerCurrency !== orderCurrency
  ) {
    throw new MonerooPaymentVerificationError(
      "La devise retournée par Moneroo ne correspond pas à la commande Tikemia.",
      "MONEROO_PAYMENT_CURRENCY_MISMATCH",
    );
  }

  const metadataOrderId = extractMetadataText(
    providerResult.metadata,
    "orderId",
  );

  if (
    metadataOrderId &&
    metadataOrderId !== payment.orderId
  ) {
    throw new MonerooPaymentVerificationError(
      "L'identifiant de commande retourné par Moneroo est incorrect.",
      "MONEROO_ORDER_ID_MISMATCH",
    );
  }

  const metadataOrderReference = extractMetadataText(
    providerResult.metadata,
    "orderReference",
  );

  if (
    metadataOrderReference &&
    metadataOrderReference !== payment.order.reference
  ) {
    throw new MonerooPaymentVerificationError(
      "La référence de commande retournée par Moneroo est incorrecte.",
      "MONEROO_ORDER_REFERENCE_MISMATCH",
    );
  }
}

async function recordVerificationFailure(
  paymentId: string,
  attemptId: string | null,
  error: unknown,
): Promise<void> {
  const serializedError = serializeVerificationError(error);
  const failedAt = new Date();

  const operations: Prisma.PrismaPromise<unknown>[] = [
    prisma.payment.update({
      where: {
        id: paymentId,
      },
      data: {
        failureCode: serializedError.code,
        failureReason: serializedError.message,
        failedAt,
      },
    }),
  ];

  if (attemptId) {
    operations.push(
      prisma.paymentAttempt.update({
        where: {
          id: attemptId,
        },
        data: {
          failureCode: serializedError.code,
          failureReason: serializedError.message,
          responsePayload: serializedError.payload,
          failedAt,
        },
      }),
    );
  }

  await prisma.$transaction(operations);
}

export async function verifyMonerooPayment(
  input: VerifyMonerooPaymentInput,
): Promise<VerifiedMonerooPayment> {
  const payment = await findPayment(input);

  if (!payment) {
    throw new MonerooPaymentVerificationError(
      "Le paiement Tikemia demandé est introuvable.",
      "PAYMENT_NOT_FOUND",
    );
  }

  if (payment.provider !== MONEROO_PROVIDER) {
    throw new MonerooPaymentVerificationError(
      "Ce paiement n'est pas un paiement Moneroo.",
      "PAYMENT_PROVIDER_INVALID",
    );
  }

  const providerTransactionId =
    normalizeOptionalText(payment.providerTransactionId) ??
    normalizeOptionalText(input.providerTransactionId);

  if (!providerTransactionId) {
    throw new MonerooPaymentVerificationError(
      "L'identifiant de transaction Moneroo est absent.",
      "MONEROO_TRANSACTION_ID_MISSING",
    );
  }

  const attemptId = payment.attempts[0]?.id ?? null;

  let providerResult: MonerooPaymentResult;

  try {
    providerResult = await verifyMonerooProviderPayment(
      providerTransactionId,
      {
        signal: input.signal,
      },
    );

    assertVerifiedPaymentMatchesTikemia(
      payment,
      providerResult,
    );
  } catch (error) {
    await recordVerificationFailure(
      payment.id,
      attemptId,
      error,
    );

    if (error instanceof MonerooPaymentVerificationError) {
      throw error;
    }

    const serializedError = serializeVerificationError(error);

    throw new MonerooPaymentVerificationError(
      serializedError.message,
      serializedError.code,
      error,
    );
  }

  const verifiedAt = new Date();
  const paidAt =
    providerResult.status === PaymentStatus.SUCCESS
      ? verifiedAt
      : null;
  const failedAt =
    providerResult.status === PaymentStatus.FAILED
      ? verifiedAt
      : null;
  const cancelledAt =
    providerResult.status === PaymentStatus.CANCELLED
      ? verifiedAt
      : null;

  const providerMetadata = toJsonValue({
    orderId: payment.order.id,
    orderReference: payment.order.reference,
    gateway: providerResult.gateway,
    paymentMethod: providerResult.paymentMethod,
    monerooStatus: providerResult.rawStatus,
    verifiedAt: verifiedAt.toISOString(),
    providerMetadata: providerResult.metadata,
  });

  const operations: Prisma.PrismaPromise<unknown>[] = [
    prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        providerTransactionId:
          providerResult.providerTransactionId,
        providerReference:
          providerResult.providerReference ??
          payment.providerReference,
        status: providerResult.status,
        metadata: providerMetadata,
        processingAt:
          providerResult.status === PaymentStatus.PROCESSING
            ? verifiedAt
            : undefined,
        paidAt,
        failedAt,
        cancelledAt,
        failureCode: null,
        failureReason: null,
      },
    }),
  ];

  if (attemptId) {
    operations.push(
      prisma.paymentAttempt.update({
        where: {
          id: attemptId,
        },
        data: {
          providerTransactionId:
            providerResult.providerTransactionId,
          providerReference:
            providerResult.providerReference ??
            payment.providerReference,
          status: providerResult.status,
          responsePayload: toJsonValue(providerResult.raw),
          processingAt:
            providerResult.status ===
            PaymentStatus.PROCESSING
              ? verifiedAt
              : undefined,
          paidAt,
          failedAt,
          cancelledAt,
          failureCode: null,
          failureReason: null,
        },
      }),
    );
  }

  await prisma.$transaction(operations);

  return Object.freeze({
    paymentId: payment.id,
    orderId: payment.orderId,
    provider: MONEROO_PROVIDER,
    providerTransactionId:
      providerResult.providerTransactionId,
    providerReference: providerResult.providerReference,
    amount: new Prisma.Decimal(providerResult.amount),
    currency: providerResult.currency,
    status: providerResult.status,
    rawStatus: providerResult.rawStatus,
    gateway: providerResult.gateway,
    paymentMethod: providerResult.paymentMethod,
    isSuccessful:
      providerResult.status === PaymentStatus.SUCCESS,
    isFinal: isFinalPaymentStatus(providerResult.status),
    verifiedAt,
  });
}
