"use client";

import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock3,
  CreditCard,
  PauseCircle,
  Repeat2,
  Sparkles,
} from "lucide-react";

import type { AdminSubscriptionStatistics } from "@/lib/admin/subscriptions/get-admin-subscription-statistics";

function formatMoney(
  amount: string,
  currency: string,
): string {
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

function formatMoneyMap(
  values: Readonly<Record<string, string>>,
): string {
  const entries = Object.entries(values);

  return entries.length === 0
    ? "0"
    : entries
        .map(([currency, amount]) =>
          formatMoney(amount, currency),
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
  value: string | number;
  helper: string;
  icon: typeof Sparkles;
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

export default function SubscriptionsStatistics({
  statistics,
  loading,
}: {
  statistics: AdminSubscriptionStatistics | null;
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
        label="Abonnements"
        value={statistics.totalSubscriptions}
        helper="Nombre total selon les filtres."
        icon={Sparkles}
      />

      <StatCard
        label="Actifs"
        value={statistics.activeSubscriptions}
        helper="Plans donnant actuellement accès aux privilèges."
        icon={CheckCircle2}
      />

      <StatCard
        label="En attente"
        value={statistics.pendingSubscriptions}
        helper="Abonnements pas encore activés."
        icon={Clock3}
      />

      <StatCard
        label="Paiement en retard"
        value={statistics.pastDueSubscriptions}
        helper="Abonnements nécessitant une régularisation."
        icon={AlertTriangle}
      />

      <StatCard
        label="Suspendus"
        value={statistics.pausedSubscriptions}
        helper="Privilèges temporairement désactivés."
        icon={PauseCircle}
      />

      <StatCard
        label="Annulés / expirés"
        value={
          statistics.cancelledSubscriptions +
          statistics.expiredSubscriptions
        }
        helper={`${statistics.cancelledSubscriptions} annulé(s), ${statistics.expiredSubscriptions} expiré(s).`}
        icon={Ban}
      />

      <StatCard
        label="Renouvellement auto"
        value={statistics.autoRenewSubscriptions}
        helper={`${statistics.endingSoonSubscriptions} expiration(s) dans les 30 jours.`}
        icon={Repeat2}
      />

      <StatCard
        label="Revenus"
        value={formatMoneyMap(
          statistics.revenueByCurrency,
        )}
        helper="Paiements d’abonnements confirmés."
        icon={CreditCard}
      />
    </section>
  );
}
