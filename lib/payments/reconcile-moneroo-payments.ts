import "server-only";

import {
  PaymentStatus,
  Prisma,
} from "@prisma/client";

import {
  completeSuccessfulPayment,
} from "@/lib/payments/complete-successful-payment";
import {
  getPaymentErrorLogContext,
} from "@/lib/payments/payment-errors";
import {
  verifyMonerooPayment,
} from "@/lib/payments/verify-moneroo-payment";
import { prisma } from "@/lib/prisma";

const MONEROO_PROVIDER = "MONEROO";

const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 100;
const DEFAULT_MINIMUM_AGE_MS = 60_000;

export type ReconcileMonerooPaymentsInput = Readonly<{
  limit?: number;
  minimumAgeMs?: number;
  signal?: AbortSignal;
}>;

export type ReconciledMonerooPayment = Readonly<{
  paymentId: string;
  orderId: string;
  providerTransactionId: string;
  previousStatus: PaymentStatus;
  verifiedStatus: PaymentStatus | null;
  action:
    | "COMPLETED"
    | "UPDATED"
    | "UNCHANGED"
    | "SKIPPED"
    | "FAILED";
  errorCode: string | null;
  errorMessage: string | null;
}>;

export type ReconcileMonerooPaymentsResult = Readonly<{
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  selected: number;
  processed: number;
  completed: number;
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;
  results: readonly ReconciledMonerooPayment[];
}>;

export class MonerooReconciliationError extends Error {
  readonly code: string;
  readonly causeValue: unknown;

  constructor(
    message: string,
    code: string,
    causeValue?: unknown,
  ) {
    super(message, {
      cause: causeValue,
    });

    this.name = "MonerooReconciliationError";
    this.code = code;
    this.causeValue = causeValue;

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }
}

function normalizeBatchSize(
  value: number | undefined,
): number {
  if (value === undefined) {
    return DEFAULT_BATCH_SIZE;
  }

  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_BATCH_SIZE
  ) {
    throw new MonerooReconciliationError(
      `La limite doit être un entier compris entre 1 et ${MAX_BATCH_SIZE}.`,
      "MONEROO_RECONCILIATION_LIMIT_INVALID",
    );
  }

  return value;
}

function normalizeMinimumAgeMs(
  value: number | undefined,
): number {
  if (value === undefined) {
    return DEFAULT_MINIMUM_AGE_MS;
  }

  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > 24 * 60 * 60 * 1_000
  ) {
    throw new MonerooReconciliationError(
      "minimumAgeMs doit être un entier compris entre 0 et 86400000.",
      "MONEROO_RECONCILIATION_MINIMUM_AGE_INVALID",
    );
  }

  return value;
}

function assertNotAborted(
  signal: AbortSignal | undefined,
): void {
  if (signal?.aborted) {
    throw new MonerooReconciliationError(
      "La réconciliation Moneroo a été annulée.",
      "MONEROO_RECONCILIATION_ABORTED",
      signal.reason,
    );
  }
}

function isPendingStatus(
  status: PaymentStatus,
): boolean {
  return (
    status === PaymentStatus.PENDING ||
    status === PaymentStatus.PROCESSING
  );
}

function serializeError(
  error: unknown,
): Readonly<{
  code: string;
  message: string;
}> {
  if (
    error instanceof
    MonerooReconciliationError
  ) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      code:
        "MONEROO_RECONCILIATION_PAYMENT_FAILED",
      message: error.message,
    };
  }

  return {
    code:
      "MONEROO_RECONCILIATION_PAYMENT_FAILED",
    message:
      "Une erreur inconnue est survenue pendant la réconciliation.",
  };
}

async function reconcileOnePayment({
  paymentId,
  orderId,
  providerTransactionId,
  previousStatus,
  signal,
}: {
  paymentId: string;
  orderId: string;
  providerTransactionId: string;
  previousStatus: PaymentStatus;
  signal?: AbortSignal;
}): Promise<ReconciledMonerooPayment> {
  assertNotAborted(signal);

  try {
    const latestPayment =
      await prisma.payment.findUnique({
        where: {
          id: paymentId,
        },
        select: {
          id: true,
          orderId: true,
          provider: true,
          providerTransactionId: true,
          status: true,
        },
      });

    if (!latestPayment) {
      return Object.freeze({
        paymentId,
        orderId,
        providerTransactionId,
        previousStatus,
        verifiedStatus: null,
        action: "SKIPPED",
        errorCode:
          "PAYMENT_NOT_FOUND",
        errorMessage:
          "Le paiement n’existe plus.",
      });
    }

    if (
      latestPayment.provider !==
      MONEROO_PROVIDER
    ) {
      return Object.freeze({
        paymentId,
        orderId,
        providerTransactionId,
        previousStatus,
        verifiedStatus:
          latestPayment.status,
        action: "SKIPPED",
        errorCode:
          "PAYMENT_PROVIDER_CHANGED",
        errorMessage:
          "Le fournisseur du paiement a changé.",
      });
    }

    if (
      !isPendingStatus(
        latestPayment.status,
      )
    ) {
      return Object.freeze({
        paymentId,
        orderId,
        providerTransactionId,
        previousStatus,
        verifiedStatus:
          latestPayment.status,
        action: "SKIPPED",
        errorCode: null,
        errorMessage: null,
      });
    }

    if (
      !latestPayment
        .providerTransactionId
    ) {
      return Object.freeze({
        paymentId,
        orderId,
        providerTransactionId,
        previousStatus,
        verifiedStatus: null,
        action: "FAILED",
        errorCode:
          "MONEROO_TRANSACTION_ID_MISSING",
        errorMessage:
          "L’identifiant de transaction Moneroo est absent.",
      });
    }

    const verified =
      await verifyMonerooPayment({
        paymentId:
          latestPayment.id,
        providerTransactionId:
          latestPayment
            .providerTransactionId,
        signal,
      });

    if (
      verified.status ===
      PaymentStatus.SUCCESS
    ) {
      await completeSuccessfulPayment({
        paymentId:
          verified.paymentId,
        providerTransactionId:
          verified.providerTransactionId,
        providerReference:
          verified.providerReference,
        gateway:
          verified.gateway,
        paymentMethod:
          verified.paymentMethod,
        paidAt:
          verified.verifiedAt,
      });

      return Object.freeze({
        paymentId:
          verified.paymentId,
        orderId:
          verified.orderId,
        providerTransactionId:
          verified.providerTransactionId,
        previousStatus,
        verifiedStatus:
          verified.status,
        action: "COMPLETED",
        errorCode: null,
        errorMessage: null,
      });
    }

    if (
      verified.status ===
      previousStatus
    ) {
      return Object.freeze({
        paymentId:
          verified.paymentId,
        orderId:
          verified.orderId,
        providerTransactionId:
          verified.providerTransactionId,
        previousStatus,
        verifiedStatus:
          verified.status,
        action: "UNCHANGED",
        errorCode: null,
        errorMessage: null,
      });
    }

    return Object.freeze({
      paymentId:
        verified.paymentId,
      orderId:
        verified.orderId,
      providerTransactionId:
        verified.providerTransactionId,
      previousStatus,
      verifiedStatus:
        verified.status,
      action: "UPDATED",
      errorCode: null,
      errorMessage: null,
    });
  } catch (error) {
    const serializedError =
      serializeError(error);

    console.error(
      "[MONEROO_PAYMENT_RECONCILIATION_ITEM_ERROR]",
      {
        paymentId,
        orderId,
        providerTransactionId,
        previousStatus,
        ...getPaymentErrorLogContext(
          error,
        ),
      },
    );

    return Object.freeze({
      paymentId,
      orderId,
      providerTransactionId,
      previousStatus,
      verifiedStatus: null,
      action: "FAILED",
      errorCode:
        serializedError.code,
      errorMessage:
        serializedError.message,
    });
  }
}

export async function reconcileMonerooPayments(
  input: ReconcileMonerooPaymentsInput = {},
): Promise<ReconcileMonerooPaymentsResult> {
  const startedAt = new Date();

  const limit = normalizeBatchSize(
    input.limit,
  );
  const minimumAgeMs =
    normalizeMinimumAgeMs(
      input.minimumAgeMs,
    );

  assertNotAborted(input.signal);

  const eligibleBefore = new Date(
    startedAt.getTime() -
      minimumAgeMs,
  );

  const payments =
    await prisma.payment.findMany({
      where: {
        provider:
          MONEROO_PROVIDER,
        status: {
          in: [
            PaymentStatus.PENDING,
            PaymentStatus.PROCESSING,
          ],
        },
        providerTransactionId: {
          not: null,
        },
        updatedAt: {
          lte: eligibleBefore,
        },
      },
      orderBy: [
        {
          updatedAt: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
      take: limit,
      select: {
        id: true,
        orderId: true,
        providerTransactionId:
          true,
        status: true,
      },
    });

  const results:
    ReconciledMonerooPayment[] = [];

  for (const payment of payments) {
    assertNotAborted(input.signal);

    if (
      !payment.providerTransactionId
    ) {
      results.push(
        Object.freeze({
          paymentId: payment.id,
          orderId: payment.orderId,
          providerTransactionId:
            "",
          previousStatus:
            payment.status,
          verifiedStatus: null,
          action: "FAILED",
          errorCode:
            "MONEROO_TRANSACTION_ID_MISSING",
          errorMessage:
            "L’identifiant de transaction Moneroo est absent.",
        }),
      );

      continue;
    }

    const result =
      await reconcileOnePayment({
        paymentId: payment.id,
        orderId: payment.orderId,
        providerTransactionId:
          payment.providerTransactionId,
        previousStatus:
          payment.status,
        signal: input.signal,
      });

    results.push(result);
  }

  const finishedAt = new Date();

  const completed = results.filter(
    (result) =>
      result.action === "COMPLETED",
  ).length;

  const updated = results.filter(
    (result) =>
      result.action === "UPDATED",
  ).length;

  const unchanged = results.filter(
    (result) =>
      result.action === "UNCHANGED",
  ).length;

  const skipped = results.filter(
    (result) =>
      result.action === "SKIPPED",
  ).length;

  const failed = results.filter(
    (result) =>
      result.action === "FAILED",
  ).length;

  return Object.freeze({
    startedAt,
    finishedAt,
    durationMs:
      finishedAt.getTime() -
      startedAt.getTime(),
    selected: payments.length,
    processed: results.length,
    completed,
    updated,
    unchanged,
    skipped,
    failed,
    results: Object.freeze(results),
  });
}
