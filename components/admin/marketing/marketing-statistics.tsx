"use client";

import {
  Archive,
  BarChart3,
  CheckCircle2,
  Clock3,
  Eye,
  FilePenLine,
  MousePointerClick,
  PauseCircle,
  ShoppingCart,
  Ticket,
  WalletCards,
} from "lucide-react";

export type MarketingStatisticsData = Readonly<{
  totalCampaigns: number;
  draftCampaigns: number;
  scheduledCampaigns: number;
  activeCampaigns: number;
  pausedCampaigns: number;
  completedCampaigns: number;
  archivedCampaigns: number;
  totalVisits: number;
  totalOrders: number;
  totalTickets: number;
  conversionRate: number;
  budgetsByCurrency: Readonly<Record<string, string>>;
  revenueByCurrency: Readonly<Record<string, string>>;
  discountsByCurrency: Readonly<Record<string, string>>;
}>;

function formatMoneyMap(values: Readonly<Record<string, string>>) {
  const entries = Object.entries(values);

  if (entries.length === 0) return "0";

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
  icon: typeof BarChart3;
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

export default function MarketingStatistics({
  statistics,
  loading,
}: {
  statistics: MarketingStatisticsData | null;
  loading: boolean;
}) {
  if (!statistics && loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, index) => (
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
      <Card
        label="Total"
        value={statistics.totalCampaigns}
        helper="Toutes les campagnes selon les filtres."
        icon={BarChart3}
      />
      <Card
        label="Brouillons"
        value={statistics.draftCampaigns}
        helper="Campagnes non encore actives."
        icon={FilePenLine}
      />
      <Card
        label="Programmées"
        value={statistics.scheduledCampaigns}
        helper="Diffusion planifiée."
        icon={Clock3}
      />
      <Card
        label="Actives"
        value={statistics.activeCampaigns}
        helper="Campagnes actuellement diffusées."
        icon={CheckCircle2}
      />
      <Card
        label="Suspendues"
        value={statistics.pausedCampaigns}
        helper="Diffusion temporairement arrêtée."
        icon={PauseCircle}
      />
      <Card
        label="Terminées"
        value={statistics.completedCampaigns}
        helper="Campagnes arrivées à leur terme."
        icon={Archive}
      />
      <Card
        label="Visites"
        value={statistics.totalVisits}
        helper="Trafic attribué aux campagnes."
        icon={Eye}
      />
      <Card
        label="Commandes"
        value={statistics.totalOrders}
        helper={`${statistics.conversionRate.toLocaleString("fr-FR")} % de conversion.`}
        icon={ShoppingCart}
      />
      <Card
        label="Billets"
        value={statistics.totalTickets}
        helper="Billets attribués aux campagnes."
        icon={Ticket}
      />
      <Card
        label="Budgets"
        value={formatMoneyMap(statistics.budgetsByCurrency)}
        helper="Budgets marketing enregistrés."
        icon={WalletCards}
      />
      <Card
        label="Revenus"
        value={formatMoneyMap(statistics.revenueByCurrency)}
        helper="Revenus attribués."
        icon={MousePointerClick}
      />
      <Card
        label="Remises"
        value={formatMoneyMap(statistics.discountsByCurrency)}
        helper="Réductions liées aux campagnes."
        icon={WalletCards}
      />
    </section>
  );
}
