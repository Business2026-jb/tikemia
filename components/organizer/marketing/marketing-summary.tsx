"use client";

import type { LucideIcon } from "lucide-react";
import {
  BadgePercent,
  ChartNoAxesCombined,
  CircleDollarSign,
  MousePointerClick,
  ReceiptText,
  ShoppingCart,
  TicketCheck,
  TrendingDown,
  TrendingUp,
  UsersRound,
} from "lucide-react";

import type {
  MarketingMetricComparison,
  MarketingSummaryComparison,
  MarketingSummaryMetrics,
} from "@/lib/marketing/calculate-marketing-metrics";

export type MarketingSummaryProps = {
  summary: MarketingSummaryMetrics;
  comparison?: MarketingSummaryComparison | null;
  currency?: string;
  locale?: string;
  title?: string;
  description?: string;
  className?: string;
};

type SummaryCardDefinition = {
  key:
    | "visits"
    | "orders"
    | "tickets"
    | "revenue"
    | "conversionRate"
    | "averageOrderValue"
    | "promoCodeUses"
    | "discountsGranted";
  label: string;
  description: string;
  icon: LucideIcon;
  format: "number" | "money" | "percentage";
  accentClassName: string;
  iconClassName: string;
};

const SUMMARY_CARDS: readonly SummaryCardDefinition[] = [
  {
    key: "visits",
    label: "Visites générées",
    description: "Trafic issu de vos liens et campagnes",
    icon: MousePointerClick,
    format: "number",
    accentClassName:
      "from-cyan-500/10 via-cyan-500/[0.035] to-transparent",
    iconClassName:
      "border-cyan-400/20 bg-cyan-400/10 text-cyan-300",
  },
  {
    key: "orders",
    label: "Commandes attribuées",
    description: "Achats reliés à vos actions marketing",
    icon: ShoppingCart,
    format: "number",
    accentClassName:
      "from-violet-500/10 via-violet-500/[0.035] to-transparent",
    iconClassName:
      "border-violet-400/20 bg-violet-400/10 text-violet-300",
  },
  {
    key: "tickets",
    label: "Billets vendus",
    description: "Billets générés par le marketing",
    icon: TicketCheck,
    format: "number",
    accentClassName:
      "from-emerald-500/10 via-emerald-500/[0.035] to-transparent",
    iconClassName:
      "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  },
  {
    key: "revenue",
    label: "Revenus marketing",
    description: "Chiffre d’affaires attribué",
    icon: CircleDollarSign,
    format: "money",
    accentClassName:
      "from-amber-500/10 via-amber-500/[0.035] to-transparent",
    iconClassName:
      "border-amber-400/20 bg-amber-400/10 text-amber-300",
  },
  {
    key: "conversionRate",
    label: "Taux de conversion",
    description: "Part des visites devenues commandes",
    icon: ChartNoAxesCombined,
    format: "percentage",
    accentClassName:
      "from-blue-500/10 via-blue-500/[0.035] to-transparent",
    iconClassName:
      "border-blue-400/20 bg-blue-400/10 text-blue-300",
  },
  {
    key: "averageOrderValue",
    label: "Panier moyen",
    description: "Valeur moyenne par commande",
    icon: ReceiptText,
    format: "money",
    accentClassName:
      "from-fuchsia-500/10 via-fuchsia-500/[0.035] to-transparent",
    iconClassName:
      "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-300",
  },
  {
    key: "promoCodeUses",
    label: "Codes promo utilisés",
    description: "Nombre d’utilisations sur la période",
    icon: BadgePercent,
    format: "number",
    accentClassName:
      "from-orange-500/10 via-orange-500/[0.035] to-transparent",
    iconClassName:
      "border-orange-400/20 bg-orange-400/10 text-orange-300",
  },
  {
    key: "discountsGranted",
    label: "Réductions accordées",
    description: "Valeur totale des remises appliquées",
    icon: UsersRound,
    format: "money",
    accentClassName:
      "from-rose-500/10 via-rose-500/[0.035] to-transparent",
    iconClassName:
      "border-rose-400/20 bg-rose-400/10 text-rose-300",
  },
] as const;

function joinClassNames(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}

function toSafeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(Math.max(toSafeNumber(value), 0));
}

function formatMoney(
  value: number,
  currency: string,
  locale: string,
): string {
  const amount = Math.max(toSafeNumber(value), 0);

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits:
        currency === "XOF" || currency === "XAF" ? 0 : 2,
      maximumFractionDigits:
        currency === "XOF" || currency === "XAF" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${formatNumber(amount, locale)} ${currency}`;
  }
}

function formatPercentage(value: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(toSafeNumber(value))} %`;
}

function formatMetricValue({
  value,
  format,
  currency,
  locale,
}: {
  value: number;
  format: SummaryCardDefinition["format"];
  currency: string;
  locale: string;
}): string {
  if (format === "money") {
    return formatMoney(value, currency, locale);
  }

  if (format === "percentage") {
    return formatPercentage(value, locale);
  }

  return formatNumber(value, locale);
}

function formatComparisonValue(
  comparison: MarketingMetricComparison,
  locale: string,
): string {
  if (comparison.percentageChange === null) {
    return comparison.current > 0
      ? "Nouvelle progression"
      : "Aucune évolution";
  }

  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(Math.abs(comparison.percentageChange))} %`;
}

function ComparisonBadge({
  comparison,
  locale,
}: {
  comparison?: MarketingMetricComparison | null;
  locale: string;
}) {
  if (!comparison) {
    return (
      <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[10px] font-semibold text-neutral-500">
        Période actuelle
      </span>
    );
  }

  if (comparison.trend === "up") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-2.5 py-1 text-[10px] font-bold text-emerald-300">
        <TrendingUp className="h-3 w-3" />
        {formatComparisonValue(comparison, locale)}
      </span>
    );
  }

  if (comparison.trend === "down") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/20 bg-rose-400/[0.08] px-2.5 py-1 text-[10px] font-bold text-rose-300">
        <TrendingDown className="h-3 w-3" />
        {formatComparisonValue(comparison, locale)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[10px] font-semibold text-neutral-500">
      Stable
    </span>
  );
}

function SummaryCard({
  card,
  value,
  comparison,
  currency,
  locale,
}: {
  card: SummaryCardDefinition;
  value: number;
  comparison?: MarketingMetricComparison | null;
  currency: string;
  locale: string;
}) {
  const Icon = card.icon;

  return (
    <article className="group relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081014] p-4 shadow-[0_18px_55px_rgba(0,0,0,0.18)] transition duration-200 hover:-translate-y-0.5 hover:border-white/[0.13] sm:p-5">
      <div
        className={joinClassNames(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90",
          card.accentClassName,
        )}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div
            className={joinClassNames(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
              card.iconClassName,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>

          <ComparisonBadge comparison={comparison} locale={locale} />
        </div>

        <div className="mt-5 min-w-0">
          <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.12em] text-neutral-500">
            {card.label}
          </p>

          <p className="mt-2 break-words text-2xl font-black tracking-[-0.04em] text-white sm:text-[1.7rem]">
            {formatMetricValue({
              value,
              format: card.format,
              currency,
              locale,
            })}
          </p>

          <p className="mt-2 text-xs leading-5 text-neutral-500">
            {card.description}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function MarketingSummary({
  summary,
  comparison = null,
  currency = "XOF",
  locale = "fr-FR",
  title = "Vue d’ensemble marketing",
  description =
    "Suivez les visites, ventes, revenus et performances générés par vos campagnes.",
  className,
}: MarketingSummaryProps) {
  const safeCurrency = currency.trim().toUpperCase() || "XOF";

  return (
    <section
      aria-labelledby="marketing-summary-title"
      className={joinClassNames("w-full min-w-0", className)}
    >
      <div className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
            Performances
          </p>

          <h2
            id="marketing-summary-title"
            className="mt-1 text-xl font-black tracking-[-0.03em] text-white sm:text-2xl"
          >
            {title}
          </h2>

          <p className="mt-1 max-w-3xl text-xs leading-5 text-neutral-500 sm:text-sm">
            {description}
          </p>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-neutral-400">
          <ChartNoAxesCombined className="h-4 w-4 text-emerald-400" />
          Données en temps réel
        </div>
      </div>

      <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SUMMARY_CARDS.map((card) => (
          <SummaryCard
            key={card.key}
            card={card}
            value={summary[card.key]}
            comparison={comparison?.[card.key]}
            currency={safeCurrency}
            locale={locale}
          />
        ))}
      </div>
    </section>
  );
}