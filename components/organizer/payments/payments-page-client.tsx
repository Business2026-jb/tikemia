"use client";

import {
  useCallback,
  useState,
} from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

import PaymentMethodsBreakdown from "@/components/organizer/payments/payment-methods-breakdown";
import PaymentsListClient from "@/components/organizer/payments/payments-list-client";
import PaymentsRevenueChart from "@/components/organizer/payments/payments-revenue-chart";
import PaymentsSummary from "@/components/organizer/payments/payments-summary";
import PaymentsToolbar from "@/components/organizer/payments/payments-toolbar";
import PayoutsSummary from "@/components/organizer/payments/payouts-summary";
import PayoutsTable from "@/components/organizer/payments/payouts-table";
import PayoutsToolbar from "@/components/organizer/payments/payouts-toolbar";
import RequestPayoutDialog from "@/components/organizer/payments/request-payout-dialog";
import type {
  OrganizerPaymentsData,
} from "@/lib/organizer/get-organizer-payments";

type PaymentsPageClientProps = {
  data: OrganizerPaymentsData;
  initialRequestPayoutOpen?: boolean;
};

function readNonNegativeEnvironmentNumber(
  value: string | undefined,
  fallback: number,
): number {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  ) &&
    parsed >= 0
    ? parsed
    : fallback;
}

export default function PaymentsPageClient({
  data,
  initialRequestPayoutOpen = false,
}: PaymentsPageClientProps) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const searchParams =
    useSearchParams();

  const [
    requestPayoutOpen,
    setRequestPayoutOpen,
  ] = useState(
    initialRequestPayoutOpen,
  );

  const minimumPayoutAmount =
    readNonNegativeEnvironmentNumber(
      process.env
        .NEXT_PUBLIC_PAYOUT_MINIMUM_AMOUNT,
      5_000,
    );

  const fixedPayoutFee =
    readNonNegativeEnvironmentNumber(
      process.env
        .NEXT_PUBLIC_PAYOUT_FIXED_FEE,
      0,
    );

  const percentagePayoutFee =
    Math.min(
      readNonNegativeEnvironmentNumber(
        process.env
          .NEXT_PUBLIC_PAYOUT_PERCENTAGE_FEE,
        0,
      ),
      100,
    );

  const updatePayoutQuery =
    useCallback(
      (
        open: boolean,
      ) => {
        const params =
          new URLSearchParams(
            searchParams.toString(),
          );

        if (open) {
          params.set(
            "payout",
            "request",
          );
        } else {
          params.delete(
            "payout",
          );
        }

        const query =
          params.toString();

        router.replace(
          query
            ? `${pathname}?${query}`
            : pathname,
          {
            scroll:
              false,
          },
        );
      },
      [
        pathname,
        router,
        searchParams,
      ],
    );

  const openRequestPayout =
    useCallback(() => {
      setRequestPayoutOpen(
        true,
      );

      updatePayoutQuery(
        true,
      );
    }, [
      updatePayoutQuery,
    ]);

  const closeRequestPayout =
    useCallback(() => {
      setRequestPayoutOpen(
        false,
      );

      updatePayoutQuery(
        false,
      );
    }, [
      updatePayoutQuery,
    ]);

  const handlePayoutSuccess =
    useCallback(() => {
      router.refresh();
    }, [router]);

  return (
    <>
      <div className="w-full min-w-0 space-y-6">
        <PaymentsToolbar
          filters={
            data.filters
          }
          appliedFilters={
            data.appliedFilters
          }
          pagination={
            data.pagination
          }
          period={
            data.period
          }
          generatedAt={
            data.generatedAt
          }
          exportBaseUrl="/api/organizer/payments/export"
          onRequestPayout={
            openRequestPayout
          }
        />

        <PaymentsSummary
          summary={
            data.summary
          }
          trends={
            data.trends
          }
          currency={
            data.currency
          }
        />

        <div className="grid w-full min-w-0 gap-6 2xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,0.75fr)]">
          <PaymentsRevenueChart
            data={
              data.chart
            }
            currency={
              data.currency
            }
            period={
              data.period
            }
          />

          <PaymentMethodsBreakdown
            data={
              data.paymentMethods
            }
            currency={
              data.currency
            }
          />
        </div>

        <PaymentsListClient
          payments={
            data.payments
          }
          currency={
            data.currency
          }
          pagination={
            data.pagination
          }
          title="Historique des paiements"
          description="Consultez les transactions, commandes, clients, événements, commissions et revenus nets."
          emptyTitle="Aucun paiement trouvé"
          emptyDescription="Aucune transaction ne correspond actuellement aux filtres sélectionnés."
        />

        <section
          id="retraits"
          className="w-full min-w-0 space-y-6 scroll-mt-24"
        >
          <PayoutsSummary
            summary={
              data.summary
            }
            currency={
              data.currency
            }
          />

          <PayoutsToolbar
            payouts={
              data.payouts
            }
            summary={
              data.summary
            }
            currency={
              data.currency
            }
            appliedFilters={
              data.appliedFilters
            }
            payoutStatuses={
              data.filters
                .payoutStatuses
            }
            generatedAt={
              data.generatedAt
            }
            exportBaseUrl="/api/organizer/payments/export"
            onRequestPayout={
              openRequestPayout
            }
          />

          <PayoutsTable
            payouts={
              data.payouts
            }
            currency={
              data.currency
            }
            title="Demandes de retrait"
            description="Suivez les montants demandés, frais, montants nets et statuts de traitement."
            emptyTitle="Aucun retrait trouvé"
            emptyDescription="Les demandes de retrait apparaîtront ici dès leur création."
          />
        </section>
      </div>

      <RequestPayoutDialog
        open={
          requestPayoutOpen
        }
        onClose={
          closeRequestPayout
        }
        availableBalance={
          data.summary
            .availableBalance
        }
        currency={
          data.currency
        }
        minimumAmount={
          minimumPayoutAmount
        }
        maximumAmount={
          data.summary
            .availableBalance
        }
        fixedFee={
          fixedPayoutFee
        }
        percentageFee={
          percentagePayoutFee
        }
        submitEndpoint="/api/organizer/payments/payouts/request"
        onSuccess={
          handlePayoutSuccess
        }
      />
    </>
  );
}