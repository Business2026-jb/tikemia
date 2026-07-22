"use client";

import {
  BarChart3,
  CircleDollarSign,
  Medal,
  ReceiptText,
  TicketCheck,
  TrendingUp,
} from "lucide-react";
import React, { type ComponentType } from "react";

import type {
  OrganizerStatisticsData,
  StatisticsDistributionItem,
} from "@/lib/organizer/get-organizer-statistics";

type CategoryPerformanceChartProps = {
  data: OrganizerStatisticsData["revenueByCategory"];
  currency: OrganizerStatisticsData["currency"];
  title?: string;
  description?: string;
  maxItems?: number;
};

type MetricMode =
  | "grossRevenue"
  | "netRevenue"
  | "ticketsSold"
  | "count";

type MetricDefinition = {
  key: MetricMode;
  label: string;
  shortLabel: string;
  icon: ComponentType<{
    className?: string;
  }>;
  kind: "money" | "number";
};

const METRIC_OPTIONS: MetricDefinition[] = [
  {
    key: "grossRevenue",
    label: "Chiffre d’affaires brut",
    shortLabel: "Revenu brut",
    icon: CircleDollarSign,
    kind: "money",
  },
  {
    key: "netRevenue",
    label: "Revenu net",
    shortLabel: "Revenu net",
    icon: TrendingUp,
    kind: "money",
  },
  {
    key: "ticketsSold",
    label: "Billets vendus",
    shortLabel: "Billets",
    icon: TicketCheck,
    kind: "number",
  },
  {
    key: "count",
    label: "Commandes payées",
    shortLabel: "Commandes",
    icon: ReceiptText,
    kind: "number",
  },
];

function safeNumber(value: number): number {
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(safeNumber(value));
}

function formatPercentage(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;

  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(Math.max(safeValue, 0))} %`;
}

function formatMoney(
  value: number,
  currency: string,
): string {
  const safeValue = safeNumber(value);

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits:
        currency === "XOF" || currency === "XAF"
          ? 0
          : 2,
    }).format(safeValue);
  } catch {
    return `${formatNumber(safeValue)} ${currency}`;
  }
}

function getMetricValue(
  item: StatisticsDistributionItem,
  metric: MetricMode,
): number {
  return safeNumber(item[metric]);
}

function getMetricDefinition(
  metric: MetricMode,
): MetricDefinition {
  return (
    METRIC_OPTIONS.find(
      (definition) => definition.key === metric,
    ) ?? METRIC_OPTIONS[0]
  );
}

function formatMetricValue({
  value,
  metric,
  currency,
}: {
  value: number;
  metric: MetricMode;
  currency: string;
}): string {
  const definition = getMetricDefinition(metric);

  return definition.kind === "money"
    ? formatMoney(value, currency)
    : formatNumber(value);
}

function getRankStyles(rank: number): {
  wrapper: string;
  text: string;
} {
  if (rank === 1) {
    return {
      wrapper:
        "border-amber-500/25 bg-amber-500/10",
      text: "text-amber-300",
    };
  }

  if (rank === 2) {
    return {
      wrapper:
        "border-neutral-400/20 bg-neutral-400/[0.08]",
      text: "text-neutral-300",
    };
  }

  if (rank === 3) {
    return {
      wrapper:
        "border-orange-700/25 bg-orange-700/[0.08]",
      text: "text-orange-300",
    };
  }

  return {
    wrapper:
      "border-white/[0.07] bg-white/[0.025]",
    text: "text-neutral-500",
  };
}

function CategoryRow({
  item,
  index,
  metric,
  maximum,
  currency,
}: {
  item: StatisticsDistributionItem;
  index: number;
  metric: MetricMode;
  maximum: number;
  currency: string;
}) {
  const value = getMetricValue(item, metric);
  const width =
    maximum > 0
      ? Math.min(Math.max((value / maximum) * 100, 0), 100)
      : 0;

  const rank = index + 1;
  const rankStyles = getRankStyles(rank);

  return (
    <article className="group min-w-0 rounded-2xl border border-white/[0.065] bg-white/[0.015] p-4 transition hover:border-white/[0.12] hover:bg-white/[0.025]">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-black ${rankStyles.wrapper} ${rankStyles.text}`}
        >
          {rank <= 3 ? (
            <Medal className="h-4 w-4" />
          ) : (
            rank
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black text-white">
                {item.label}
              </h3>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-neutral-600">
                <span>
                  {formatNumber(item.ticketsSold)} billet
                  {item.ticketsSold > 1 ? "s" : ""}
                </span>

                <span>
                  {formatNumber(item.count)} commande
                  {item.count > 1 ? "s" : ""}
                </span>

                <span>
                  {formatPercentage(item.percentage)} du revenu
                </span>
              </div>
            </div>

            <div className="shrink-0 sm:text-right">
              <p className="text-sm font-black text-emerald-300">
                {formatMetricValue({
                  value,
                  metric,
                  currency,
                })}
              </p>

              <p className="mt-1 text-[10px] text-neutral-600">
                {getMetricDefinition(metric).shortLabel}
              </p>
            </div>
          </div>

          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/[0.055]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-lime-400 to-orange-400 transition-all duration-500"
              style={{
                width: `${width}%`,
              }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[340px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.012] px-5 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.025]">
        <BarChart3 className="h-7 w-7 text-neutral-600" />
      </div>

      <h3 className="mt-5 text-lg font-black text-white">
        Aucune donnée par catégorie
      </h3>

      <p className="mt-2 max-w-lg text-sm leading-6 text-neutral-500">
        Les performances par catégorie apparaîtront ici dès qu’une commande
        payée sera enregistrée sur vos événements.
      </p>
    </div>
  );
}

export default function CategoryPerformanceChart({
  data,
  currency,
  title = "Performance par catégorie",
  description =
    "Comparez les revenus, les billets vendus et les commandes de chaque catégorie d’événement.",
  maxItems = 10,
}: CategoryPerformanceChartProps) {
  const safeMaxItems = Number.isInteger(maxItems)
    ? Math.max(maxItems, 1)
    : 10;

  const [selectedMetric, setSelectedMetric] =
    React.useState<MetricMode>("grossRevenue");

  const sortedData = React.useMemo(
    () =>
      [...data]
        .sort(
          (first, second) =>
            getMetricValue(second, selectedMetric) -
            getMetricValue(first, selectedMetric),
        )
        .slice(0, safeMaxItems),
    [data, safeMaxItems, selectedMetric],
  );

  const maximumValue = React.useMemo(
    () =>
      sortedData.reduce(
        (maximum, item) =>
          Math.max(
            maximum,
            getMetricValue(item, selectedMetric),
          ),
        0,
      ),
    [selectedMetric, sortedData],
  );

  const totals = React.useMemo(
    () =>
      data.reduce(
        (result, item) => ({
          grossRevenue:
            result.grossRevenue +
            safeNumber(item.grossRevenue),
          netRevenue:
            result.netRevenue +
            safeNumber(item.netRevenue),
          ticketsSold:
            result.ticketsSold +
            safeNumber(item.ticketsSold),
          count:
            result.count +
            safeNumber(item.count),
        }),
        {
          grossRevenue: 0,
          netRevenue: 0,
          ticketsSold: 0,
          count: 0,
        },
      ),
    [data],
  );

  const leadingCategory = sortedData[0] ?? null;

  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.045),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.035),transparent_28%)]" />

      <div className="relative flex w-full min-w-0 flex-col gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-5 xl:flex-row xl:items-center xl:justify-between xl:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08]">
            <BarChart3 className="h-4 w-4 text-emerald-300" />
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-base font-black text-white sm:text-lg">
              {title}
            </h2>

            <p className="mt-1 text-xs leading-5 text-neutral-500">
              {description}
            </p>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 xl:w-auto">
          {METRIC_OPTIONS.map((metric) => {
            const Icon = metric.icon;
            const active = selectedMetric === metric.key;

            return (
              <button
                key={metric.key}
                type="button"
                onClick={() =>
                  setSelectedMetric(metric.key)
                }
                aria-pressed={active}
                className={`inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition ${
                  active
                    ? "border-emerald-500/30 bg-emerald-500/[0.09] text-emerald-300"
                    : "border-white/[0.08] bg-white/[0.02] text-neutral-500 hover:border-white/[0.13] hover:bg-white/[0.04] hover:text-neutral-300"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />

                <span className="truncate">
                  {metric.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative grid w-full min-w-0 gap-3 border-b border-white/[0.07] px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4 xl:px-6">
        <SummaryMetric
          label="Catégories"
          value={formatNumber(data.length)}
          description="Catégories avec activité"
          tone="neutral"
        />

        <SummaryMetric
          label="Revenu brut"
          value={formatMoney(
            totals.grossRevenue,
            currency,
          )}
          description="Total des catégories"
          tone="lime"
        />

        <SummaryMetric
          label="Revenu net"
          value={formatMoney(
            totals.netRevenue,
            currency,
          )}
          description="Après commissions"
          tone="green"
        />

        <SummaryMetric
          label="Billets vendus"
          value={formatNumber(
            totals.ticketsSold,
          )}
          description={`${formatNumber(
            totals.count,
          )} commandes payées`}
          tone="orange"
        />
      </div>

      <div className="relative w-full min-w-0 p-4 sm:p-5 xl:p-6">
        {sortedData.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid w-full min-w-0 gap-3 xl:grid-cols-2">
            {sortedData.map((item, index) => (
              <CategoryRow
                key={item.key}
                item={item}
                index={index}
                metric={selectedMetric}
                maximum={maximumValue}
                currency={currency}
              />
            ))}
          </div>
        )}
      </div>

      {leadingCategory && (
        <div className="relative flex w-full min-w-0 flex-col gap-3 border-t border-white/[0.07] bg-[#050c10] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 xl:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/[0.08]">
              <Medal className="h-4 w-4 text-amber-300" />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                Catégorie dominante
              </p>

              <p className="mt-1 truncate text-sm font-black text-white">
                {leadingCategory.label}
              </p>
            </div>
          </div>

          <div className="shrink-0 sm:text-right">
            <p className="text-sm font-black text-emerald-300">
              {formatMetricValue({
                value: getMetricValue(
                  leadingCategory,
                  selectedMetric,
                ),
                metric: selectedMetric,
                currency,
              })}
            </p>

            <p className="mt-1 text-[10px] text-neutral-600">
              {getMetricDefinition(selectedMetric).label}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function SummaryMetric({
  label,
  value,
  description,
  tone,
}: {
  label: string;
  value: string;
  description: string;
  tone:
    | "neutral"
    | "lime"
    | "green"
    | "orange";
}) {
  const styles = {
    neutral:
      "border-white/[0.08] bg-white/[0.025] text-neutral-300",
    lime:
      "border-lime-500/20 bg-lime-500/[0.055] text-lime-300",
    green:
      "border-emerald-500/20 bg-emerald-500/[0.055] text-emerald-300",
    orange:
      "border-orange-500/20 bg-orange-500/[0.055] text-orange-300",
  }[tone];

  return (
    <article
      className={`min-w-0 rounded-xl border px-3 py-3 ${styles}`}
    >
      <p className="truncate text-[9px] font-bold uppercase tracking-[0.1em] opacity-70">
        {label}
      </p>

      <p className="mt-1.5 truncate text-sm font-black">
        {value}
      </p>

      <p className="mt-1 truncate text-[9px] text-neutral-600">
        {description}
      </p>
    </article>
  );
}