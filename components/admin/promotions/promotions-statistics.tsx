"use client";

import {
  Ban,
  CheckCircle2,
  Clock3,
  Gauge,
  Megaphone,
  PauseCircle,
  TimerOff,
  WalletCards,
} from "lucide-react";

type Statistics = {
  totalPromotions: number;
  scheduledPromotions: number;
  activePromotions: number;
  pausedPromotions: number;
  cancelledPromotions: number;
  expiredPromotions: number;
  awaitingReviewPromotions: number;
  averagePriority: number;
  revenueByCurrency: Readonly<Record<string, string>>;
};

function formatMoneyMap(
  values: Readonly<Record<string, string>>,
) {
  const entries =
    Object.entries(values);

  if (
    entries.length ===
    0
  ) {
    return "0";
  }

  return entries
    .map(
      ([currency, value]) =>
        `${Number(value).toLocaleString("fr-FR")} ${currency}`,
    )
    .join(" · ");
}

function Card({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: typeof Megaphone;
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

export default function PromotionsStatistics({
  statistics,
  loading,
}: {
  statistics: Statistics | null;
  loading: boolean;
}) {
  if (
    !statistics &&
    loading
  ) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({
          length:
            8,
        }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025]"
          />
        ))}
      </div>
    );
  }

  if (!statistics) {
    return null;
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card
        label="Promotions"
        value={statistics.totalPromotions}
        helper="Nombre total selon les filtres."
        icon={Megaphone}
      />

      <Card
        label="À valider"
        value={statistics.awaitingReviewPromotions}
        helper="Demandes programmées en attente de contrôle."
        icon={Clock3}
      />

      <Card
        label="Actives"
        value={statistics.activePromotions}
        helper="Événements actuellement mis en avant."
        icon={CheckCircle2}
      />

      <Card
        label="Programmées"
        value={statistics.scheduledPromotions}
        helper="Promotions dont le démarrage est planifié."
        icon={Clock3}
      />

      <Card
        label="Suspendues"
        value={statistics.pausedPromotions}
        helper="Mises en avant temporairement arrêtées."
        icon={PauseCircle}
      />

      <Card
        label="Annulées"
        value={statistics.cancelledPromotions}
        helper="Campagnes définitivement annulées."
        icon={Ban}
      />

      <Card
        label="Expirées"
        value={statistics.expiredPromotions}
        helper={`Priorité moyenne : ${statistics.averagePriority}`}
        icon={TimerOff}
      />

      <Card
        label="Revenus"
        value={formatMoneyMap(
          statistics.revenueByCurrency,
        )}
        helper="Paiements liés aux promotions."
        icon={WalletCards}
      />
    </section>
  );
}
