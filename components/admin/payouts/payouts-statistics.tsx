"use client";

import {
  Banknote,
  CheckCircle2,
  Clock3,
  FileQuestion,
  LoaderCircle,
  WalletCards,
  XCircle,
} from "lucide-react";

import type {
  AdminPayoutStatistics,
} from "@/lib/admin/payouts/get-admin-payout-statistics";

function formatMoney(
  amount: string,
  currency: string,
): string {
  const numeric =
    Number(amount);

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return `${amount} ${currency}`;
  }

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      },
    ).format(
      numeric,
    );
  } catch {
    return `${numeric.toLocaleString(
      "fr-FR",
    )} ${currency}`;
  }
}

function formatMoneyMap(
  values:
    Readonly<
      Record<string, string>
    >,
): string {
  const entries =
    Object.entries(
      values,
    );

  if (
    entries.length ===
    0
  ) {
    return "0";
  }

  return entries
    .map(
      ([
        currency,
        amount,
      ]) =>
        formatMoney(
          amount,
          currency,
        ),
    )
    .join(" · ");
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value:
    | string
    | number;
  helper: string;
  icon:
    | typeof WalletCards
    | typeof Clock3
    | typeof LoaderCircle
    | typeof CheckCircle2
    | typeof XCircle
    | typeof FileQuestion
    | typeof Banknote;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#071019] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            {label}
          </p>

          <p className="mt-2 break-words text-xl font-black text-white">
            {value}
          </p>

          <p className="mt-1 text-xs leading-5 text-neutral-600">
            {helper}
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-neutral-400">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export default function PayoutsStatistics({
  statistics,
  loading,
}: {
  statistics:
    | AdminPayoutStatistics
    | null;
  loading: boolean;
}) {
  if (
    !statistics &&
    loading
  ) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({
          length: 8,
        }).map(
          (
            _,
            index,
          ) => (
            <div
              key={
                index
              }
              className="h-32 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025]"
            />
          ),
        )}
      </div>
    );
  }

  if (!statistics) {
    return null;
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Demandes"
        value={
          statistics.totalRequests
        }
        helper="Nombre total selon les filtres actifs."
        icon={
          WalletCards
        }
      />

      <StatCard
        label="Montants demandés"
        value={formatMoneyMap(
          statistics.requestedByCurrency,
        )}
        helper="Valeur totale des demandes."
        icon={
          Banknote
        }
      />

      <StatCard
        label="En attente"
        value={
          statistics.pendingRequests
        }
        helper="Demandes à examiner."
        icon={
          Clock3
        }
      />

      <StatCard
        label="En traitement"
        value={
          statistics.processingRequests
        }
        helper={formatMoneyMap(
          statistics.processingByCurrency,
        )}
        icon={
          LoaderCircle
        }
      />

      <StatCard
        label="Payés"
        value={
          statistics.paidRequests
        }
        helper={formatMoneyMap(
          statistics.paidByCurrency,
        )}
        icon={
          CheckCircle2
        }
      />

      <StatCard
        label="Refusés"
        value={
          statistics.rejectedRequests
        }
        helper={formatMoneyMap(
          statistics.rejectedByCurrency,
        )}
        icon={
          XCircle
        }
      />

      <StatCard
        label="Informations requises"
        value={
          statistics.informationRequiredRequests
        }
        helper="Dossiers nécessitant un complément."
        icon={
          FileQuestion
        }
      />

      <StatCard
        label="Frais"
        value={formatMoneyMap(
          statistics.feesByCurrency,
        )}
        helper="Frais liés aux retraits."
        icon={
          Banknote
        }
      />
    </section>
  );
}
