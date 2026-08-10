"use client";

import {
  Archive,
  BadgePercent,
  CheckCircle2,
  Clock3,
  PauseCircle,
  ShoppingCart,
  TicketPercent,
  WalletCards,
} from "lucide-react";

export type CouponStatisticsData = {
  totalCoupons: number;
  activeCoupons: number;
  scheduledCoupons: number;
  disabledCoupons: number;
  archivedCoupons: number;
  expiredCoupons: number;
  totalUses: number;
  usageRecords: number;
  exhaustedCoupons: number;
  totalDiscount: string;
  discountsByCurrency: Readonly<Record<string, string>>;
};

function formatMoneyMap(
  values:
    Readonly<Record<string, string>>,
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
  icon: typeof TicketPercent;
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

export default function CouponsStatistics({
  statistics,
  loading,
}: {
  statistics:
    CouponStatisticsData | null;
  loading:
    boolean;
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
        label="Total"
        value={statistics.totalCoupons}
        helper="Nombre total selon les filtres."
        icon={TicketPercent}
      />

      <Card
        label="Actifs"
        value={statistics.activeCoupons}
        helper="Coupons actuellement utilisables."
        icon={CheckCircle2}
      />

      <Card
        label="Programmés"
        value={statistics.scheduledCoupons}
        helper="Coupons dont le démarrage est planifié."
        icon={Clock3}
      />

      <Card
        label="Suspendus"
        value={statistics.disabledCoupons}
        helper="Coupons temporairement désactivés."
        icon={PauseCircle}
      />

      <Card
        label="Archivés"
        value={statistics.archivedCoupons}
        helper="Coupons définitivement annulés."
        icon={Archive}
      />

      <Card
        label="Utilisations"
        value={statistics.totalUses}
        helper={`${statistics.usageRecords} enregistrement(s) d’utilisation.`}
        icon={ShoppingCart}
      />

      <Card
        label="Épuisés"
        value={statistics.exhaustedCoupons}
        helper="Coupons ayant atteint leur limite."
        icon={BadgePercent}
      />

      <Card
        label="Réductions"
        value={formatMoneyMap(
          statistics.discountsByCurrency,
        )}
        helper="Montant total accordé aux clients."
        icon={WalletCards}
      />
    </section>
  );
}
