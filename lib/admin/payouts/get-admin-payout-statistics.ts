import "server-only";

import {
  PayoutStatus,
  Prisma,
} from "@prisma/client";

import {
  AdminPayoutError,
} from "@/lib/admin/payouts/admin-payout-errors";
import {
  buildAdminPayoutWhere,
  type GetAdminPayoutsInput,
} from "@/lib/admin/payouts/get-admin-payouts";
import {
  prisma,
} from "@/lib/prisma";

export type AdminPayoutStatistics =
  Readonly<{
    totalRequests: number;
    pendingRequests: number;
    processingRequests: number;
    paidRequests: number;
    rejectedRequests: number;
    informationRequiredRequests: number;

    requestedByCurrency:
      Readonly<Record<string, string>>;

    processingByCurrency:
      Readonly<Record<string, string>>;

    paidByCurrency:
      Readonly<Record<string, string>>;

    rejectedByCurrency:
      Readonly<Record<string, string>>;

    feesByCurrency:
      Readonly<Record<string, string>>;

    requestsByDestinationType:
      Readonly<Record<string, number>>;
  }>;

function addDecimal(
  target:
    Record<
      string,
      Prisma.Decimal
    >,
  currency: string,
  amount: Prisma.Decimal,
): void {
  target[currency] =
    (
      target[currency] ??
      new Prisma.Decimal(0)
    ).plus(amount);
}

function serializeDecimals(
  values:
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
      currency,
      amount,
    ] of Object.entries(
      values,
    )
  ) {
    result[currency] =
      amount.toFixed(2);
  }

  return result;
}

export async function getAdminPayoutStatistics(
  input: GetAdminPayoutsInput = {},
): Promise<AdminPayoutStatistics> {
  const where =
    buildAdminPayoutWhere(
      input,
    );

  try {
    const payouts =
      await prisma.payout.findMany({
        where,

        select: {
          amount: true,
          fee: true,
          currency: true,
          status: true,
          destinationType: true,
          adminNote: true,
        },
      });

    const requestedByCurrency:
      Record<
        string,
        Prisma.Decimal
      > =
      {};

    const processingByCurrency:
      Record<
        string,
        Prisma.Decimal
      > =
      {};

    const paidByCurrency:
      Record<
        string,
        Prisma.Decimal
      > =
      {};

    const rejectedByCurrency:
      Record<
        string,
        Prisma.Decimal
      > =
      {};

    const feesByCurrency:
      Record<
        string,
        Prisma.Decimal
      > =
      {};

    const requestsByDestinationType:
      Record<string, number> =
      {};

    let pendingRequests = 0;
    let processingRequests = 0;
    let paidRequests = 0;
    let rejectedRequests = 0;
    let informationRequiredRequests = 0;

    for (const payout of payouts) {
      addDecimal(
        requestedByCurrency,
        payout.currency,
        payout.amount,
      );

      addDecimal(
        feesByCurrency,
        payout.currency,
        payout.fee,
      );

      if (
        payout.destinationType
      ) {
        requestsByDestinationType[
          payout.destinationType
        ] =
          (
            requestsByDestinationType[
              payout.destinationType
            ] ??
            0
          ) + 1;
      }

      if (
        payout.adminNote?.startsWith(
          "[INFORMATION_REQUIRED]",
        )
      ) {
        informationRequiredRequests += 1;
      }

      switch (payout.status) {
        case PayoutStatus.PENDING:
          pendingRequests += 1;
          break;

        case PayoutStatus.PROCESSING:
          processingRequests += 1;

          addDecimal(
            processingByCurrency,
            payout.currency,
            payout.amount,
          );
          break;

        case PayoutStatus.PAID:
          paidRequests += 1;

          addDecimal(
            paidByCurrency,
            payout.currency,
            payout.amount,
          );
          break;

        case PayoutStatus.REJECTED:
          rejectedRequests += 1;

          addDecimal(
            rejectedByCurrency,
            payout.currency,
            payout.amount,
          );
          break;

        default:
          break;
      }
    }

    return {
      totalRequests:
        payouts.length,
      pendingRequests,
      processingRequests,
      paidRequests,
      rejectedRequests,
      informationRequiredRequests,
      requestedByCurrency:
        serializeDecimals(
          requestedByCurrency,
        ),
      processingByCurrency:
        serializeDecimals(
          processingByCurrency,
        ),
      paidByCurrency:
        serializeDecimals(
          paidByCurrency,
        ),
      rejectedByCurrency:
        serializeDecimals(
          rejectedByCurrency,
        ),
      feesByCurrency:
        serializeDecimals(
          feesByCurrency,
        ),
      requestsByDestinationType,
    };
  } catch (error) {
    if (
      error instanceof
      AdminPayoutError
    ) {
      throw error;
    }

    throw new AdminPayoutError({
      code:
        "ADMIN_PAYOUT_QUERY_INVALID",
      message:
        "Impossible de calculer les statistiques des retraits.",
      status: 500,
      cause: error,
    });
  }
}
