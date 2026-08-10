import "server-only";

import {
  PaymentStatus,
  Prisma,
} from "@prisma/client";

import {
  AdminPaymentError,
} from "@/lib/admin/payments/admin-payment-errors";
import {
  buildAdminPaymentWhere,
  type GetAdminPaymentsInput,
} from "@/lib/admin/payments/get-admin-payments";
import {
  prisma,
} from "@/lib/prisma";

export type AdminPaymentStatistics =
  Readonly<{
    totalTransactions: number;
    successfulTransactions: number;
    pendingTransactions: number;
    processingTransactions: number;
    failedTransactions: number;
    cancelledTransactions: number;
    refundedTransactions: number;
    disputedTransactions: number;

    collectedByCurrency:
      Readonly<Record<string, string>>;

    platformFeesByCurrency:
      Readonly<Record<string, string>>;

    refundedByCurrency:
      Readonly<Record<string, string>>;

    transactionsByProvider:
      Readonly<Record<string, number>>;

    collectedByProvider:
      Readonly<
        Record<
          string,
          Readonly<Record<string, string>>
        >
      >;
  }>;

const SUCCESS_STATUSES: PaymentStatus[] = [
  PaymentStatus.SUCCESS,
  PaymentStatus.PARTIALLY_REFUNDED,
  PaymentStatus.REFUNDED,
];

function increment(
  record: Record<string, number>,
  key: string,
): void {
  record[key] =
    (record[key] ?? 0) + 1;
}

function addDecimal(
  record:
    Record<
      string,
      Prisma.Decimal
    >,
  key: string,
  amount: Prisma.Decimal,
): void {
  record[key] =
    (
      record[key] ??
      new Prisma.Decimal(0)
    ).plus(amount);
}

function serializeDecimals(
  record:
    Record<
      string,
      Prisma.Decimal
    >,
): Record<string, string> {
  const result:
    Record<string, string> =
    {};

  for (
    const [
      key,
      value,
    ] of Object.entries(record)
  ) {
    result[key] =
      value.toFixed(2);
  }

  return result;
}

export async function getAdminPaymentStatistics(
  input: GetAdminPaymentsInput = {},
): Promise<AdminPaymentStatistics> {
  const where =
    buildAdminPaymentWhere(
      input,
    );

  try {
    const payments =
      await prisma.payment.findMany({
        where,

        select: {
          provider: true,
          currency: true,
          amount: true,
          status: true,

          order: {
            select: {
              platformFee: true,
            },
          },

          refunds: {
            select: {
              amount: true,
              currency: true,
            },
          },
        },
      });

    const collectedByCurrency:
      Record<
        string,
        Prisma.Decimal
      > =
      {};

    const platformFeesByCurrency:
      Record<
        string,
        Prisma.Decimal
      > =
      {};

    const refundedByCurrency:
      Record<
        string,
        Prisma.Decimal
      > =
      {};

    const transactionsByProvider:
      Record<string, number> =
      {};

    const collectedByProvider:
      Record<
        string,
        Record<
          string,
          Prisma.Decimal
        >
      > =
      {};

    let successfulTransactions = 0;
    let pendingTransactions = 0;
    let processingTransactions = 0;
    let failedTransactions = 0;
    let cancelledTransactions = 0;
    let refundedTransactions = 0;
    let disputedTransactions = 0;

    for (const payment of payments) {
      increment(
        transactionsByProvider,
        payment.provider,
      );

      switch (payment.status) {
        case PaymentStatus.SUCCESS:
          successfulTransactions += 1;
          break;

        case PaymentStatus.PENDING:
          pendingTransactions += 1;
          break;

        case PaymentStatus.PROCESSING:
          processingTransactions += 1;
          break;

        case PaymentStatus.FAILED:
          failedTransactions += 1;
          break;

        case PaymentStatus.CANCELLED:
        case PaymentStatus.EXPIRED:
          cancelledTransactions += 1;
          break;

        case PaymentStatus.PARTIALLY_REFUNDED:
        case PaymentStatus.REFUNDED:
          refundedTransactions += 1;
          break;

        case PaymentStatus.DISPUTED:
          disputedTransactions += 1;
          break;

        default:
          break;
      }

      if (
        SUCCESS_STATUSES.includes(
          payment.status,
        )
      ) {
        addDecimal(
          collectedByCurrency,
          payment.currency,
          payment.amount,
        );

        addDecimal(
          platformFeesByCurrency,
          payment.currency,
          payment.order.platformFee,
        );

        collectedByProvider[
          payment.provider
        ] ??=
          {};

        addDecimal(
          collectedByProvider[
            payment.provider
          ],
          payment.currency,
          payment.amount,
        );
      }

      for (
        const refund of
        payment.refunds
      ) {
        addDecimal(
          refundedByCurrency,
          refund.currency,
          refund.amount,
        );
      }
    }

    const serializedByProvider:
      Record<
        string,
        Record<string, string>
      > =
      {};

    for (
      const [
        provider,
        currencies,
      ] of Object.entries(
        collectedByProvider,
      )
    ) {
      serializedByProvider[
        provider
      ] =
        serializeDecimals(
          currencies,
        );
    }

    return {
      totalTransactions:
        payments.length,
      successfulTransactions,
      pendingTransactions,
      processingTransactions,
      failedTransactions,
      cancelledTransactions,
      refundedTransactions,
      disputedTransactions,
      collectedByCurrency:
        serializeDecimals(
          collectedByCurrency,
        ),
      platformFeesByCurrency:
        serializeDecimals(
          platformFeesByCurrency,
        ),
      refundedByCurrency:
        serializeDecimals(
          refundedByCurrency,
        ),
      transactionsByProvider,
      collectedByProvider:
        serializedByProvider,
    };
  } catch (error) {
    if (
      error instanceof
      AdminPaymentError
    ) {
      throw error;
    }

    throw new AdminPaymentError({
      code:
        "ADMIN_PAYMENT_QUERY_INVALID",
      message:
        "Impossible de calculer les statistiques des paiements.",
      status: 500,
      cause: error,
    });
  }
}
