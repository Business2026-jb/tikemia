"use client";

import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  RefreshCcw,
  XCircle,
} from "lucide-react";

import type { AdminPaymentStatistics } from "@/lib/admin/payments/get-admin-payment-statistics";

function formatMoney(amount: string, currency: string) {
  const numeric = Number(amount);

  if (!Number.isFinite(numeric)) {
    return `${amount} ${currency}`;
  }

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `${numeric.toLocaleString("fr-FR")} ${currency}`;
  }
}

function formatMoneyMap(values: Readonly<Record<string, string>>) {
  const entries = Object.entries(values);

  if (entries.length === 0) {
    return "0";
  }

  return entries
    .map(([currency, amount]) => formatMoney(amount, currency))
    .join(" · ");
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: typeof CreditCard;
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

export default function PaymentsStatistics({
  statistics,
  loading,
}: {
  statistics: AdminPaymentStatistics | null;
  loading: boolean;
}) {
  if (!statistics && loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025]"
          />
        ))}
      </div>
    );
  }

  if (!statistics) return null;

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Transactions"
        value={statistics.totalTransactions}
        helper="Nombre total selon les filtres actifs."
        icon={CreditCard}
      />
      <StatCard
        label="Montants encaissés"
        value={formatMoneyMap(statistics.collectedByCurrency)}
        helper={`${statistics.successfulTransactions} transaction(s) réussie(s).`}
        icon={Banknote}
      />
      <StatCard
        label="En attente"
        value={statistics.pendingTransactions}
        helper={`${statistics.processingTransactions} paiement(s) en traitement.`}
        icon={Clock3}
      />
      <StatCard
        label="Réussis"
        value={statistics.successfulTransactions}
        helper="Paiements confirmés avec succès."
        icon={CheckCircle2}
      />
      <StatCard
        label="Échecs"
        value={statistics.failedTransactions}
        helper="Transactions signalées comme échouées."
        icon={XCircle}
      />
      <StatCard
        label="Remboursements"
        value={formatMoneyMap(statistics.refundedByCurrency)}
        helper={`${statistics.refundedTransactions} paiement(s) remboursé(s).`}
        icon={RefreshCcw}
      />
      <StatCard
        label="Frais plateforme"
        value={formatMoneyMap(statistics.platformFeesByCurrency)}
        helper="Frais Tikemia liés aux paiements encaissés."
        icon={Banknote}
      />
      <StatCard
        label="Litiges"
        value={statistics.disputedTransactions}
        helper={`${statistics.cancelledTransactions} paiement(s) annulé(s) ou expiré(s).`}
        icon={AlertTriangle}
      />
    </section>
  );
}
