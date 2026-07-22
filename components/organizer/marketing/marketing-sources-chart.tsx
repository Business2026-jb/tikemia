"use client";

import {
  BarChart3,
  ChevronDown,
  CircleDollarSign,
  MousePointerClick,
  ShoppingCart,
  TicketCheck,
  TrendingUp,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

import type {
  MarketingSourceMetrics,
} from "@/lib/marketing/calculate-marketing-metrics";

export type MarketingSourcesMetric =
  | "visits"
  | "orders"
  | "tickets"
  | "revenue"
  | "conversionRate"
  | "revenueShare";

export type MarketingSourcesChartProps = {
  data:
    readonly MarketingSourceMetrics[];

  metric?:
    MarketingSourcesMetric;

  currency?: string;
  locale?: string;

  title?: string;
  description?: string;

  maximumItems?: number;

  isLoading?: boolean;
  className?: string;

  onMetricChange?:
    (
      metric:
        MarketingSourcesMetric,
    ) => void;
};

type MetricDefinition = {
  key:
    MarketingSourcesMetric;

  label:
    string;

  shortLabel:
    string;

  format:
    | "number"
    | "money"
    | "percentage";

  icon:
    typeof MousePointerClick;
};

type NormalizedSource = {
  key: string;
  label: string;

  visits: number;
  orders: number;
  tickets: number;
  revenue: number;
  conversionRate: number;
  revenueShare: number;

  value: number;
  percentageOfMaximum: number;
  percentageOfTotal: number;
};

const METRICS:
  readonly MetricDefinition[] = [
    {
      key:
        "visits",

      label:
        "Visites",

      shortLabel:
        "visites",

      format:
        "number",

      icon:
        MousePointerClick,
    },
    {
      key:
        "orders",

      label:
        "Commandes",

      shortLabel:
        "commandes",

      format:
        "number",

      icon:
        ShoppingCart,
    },
    {
      key:
        "tickets",

      label:
        "Billets vendus",

      shortLabel:
        "billets",

      format:
        "number",

      icon:
        TicketCheck,
    },
    {
      key:
        "revenue",

      label:
        "Revenus",

      shortLabel:
        "revenus",

      format:
        "money",

      icon:
        CircleDollarSign,
    },
    {
      key:
        "conversionRate",

      label:
        "Taux de conversion",

      shortLabel:
        "conversion",

      format:
        "percentage",

      icon:
        TrendingUp,
    },
    {
      key:
        "revenueShare",

      label:
        "Part des revenus",

      shortLabel:
        "part des revenus",

      format:
        "percentage",

      icon:
        BarChart3,
    },
  ] as const;

function joinClassNames(
  ...values:
    Array<
      string |
      false |
      null |
      undefined
    >
): string {
  return values
    .filter(Boolean)
    .join(" ");
}

function toSafeNumber(
  value: number,
): number {
  return Number.isFinite(
    value,
  )
    ? Math.max(
        value,
        0,
      )
    : 0;
}

function formatNumber(
  value: number,
  locale: string,
  maximumFractionDigits =
    0,
): string {
  return new Intl.NumberFormat(
    locale,
    {
      maximumFractionDigits,
    },
  ).format(
    toSafeNumber(
      value,
    ),
  );
}

function formatMoney(
  value: number,
  currency: string,
  locale: string,
  compact =
    false,
): string {
  const amount =
    toSafeNumber(
      value,
    );

  try {
    return new Intl.NumberFormat(
      locale,
      {
        style:
          "currency",

        currency,

        notation:
          compact
            ? "compact"
            : "standard",

        minimumFractionDigits:
          currency ===
            "XOF" ||
          currency ===
            "XAF"
            ? 0
            : 2,

        maximumFractionDigits:
          compact
            ? 1
            : currency ===
                  "XOF" ||
                currency ===
                  "XAF"
              ? 0
              : 2,
      },
    ).format(
      amount,
    );
  } catch {
    return `${formatNumber(
      amount,
      locale,
      compact
        ? 1
        : 0,
    )} ${currency}`;
  }
}

function formatMetricValue({
  value,
  metric,
  currency,
  locale,
  compact =
    false,
}: {
  value: number;
  metric:
    MetricDefinition;
  currency: string;
  locale: string;
  compact?: boolean;
}): string {
  if (
    metric.format ===
    "money"
  ) {
    return formatMoney(
      value,
      currency,
      locale,
      compact,
    );
  }

  if (
    metric.format ===
    "percentage"
  ) {
    return `${formatNumber(
      value,
      locale,
      2,
    )} %`;
  }

  return formatNumber(
    value,
    locale,
    compact
      ? 1
      : 0,
  );
}

function normalizeMaximumItems(
  value: number,
): number {
  if (
    !Number.isFinite(
      value,
    )
  ) {
    return 8;
  }

  return Math.max(
    1,
    Math.min(
      Math.floor(
        value,
      ),
      20,
    ),
  );
}

function getSourceInitials(
  label: string,
): string {
  const words =
    label
      .trim()
      .split(
        /\s+/,
      )
      .filter(
        Boolean,
      );

  if (
    words.length ===
    0
  ) {
    return "?";
  }

  return words
    .slice(
      0,
      2,
    )
    .map(
      (
        word,
      ) =>
        word
          .charAt(
            0,
          )
          .toUpperCase(),
    )
    .join("");
}

function LoadingState() {
  return (
    <div
      aria-label="Chargement des sources marketing"
      className="space-y-3"
    >
      {[
        94,
        82,
        69,
        55,
        43,
        34,
      ].map(
        (
          width,
          index,
        ) => (
          <div
            key={
              `${width}-${index}`
            }
            className="animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/[0.06]" />

              <div className="min-w-0 flex-1">
                <div className="h-3 w-28 rounded bg-white/[0.06]" />

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.04]">
                  <div
                    className="h-full rounded-full bg-white/[0.07]"
                    style={{
                      width:
                        `${width}%`,
                    }}
                  />
                </div>
              </div>

              <div className="h-5 w-16 rounded bg-white/[0.06]" />
            </div>
          </div>
        ),
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.018] px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300">
        <BarChart3 className="h-6 w-6" />
      </div>

      <h3 className="mt-4 text-base font-black text-white">
        Aucune source disponible
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
        Les sources de trafic apparaîtront ici dès que vos liens marketing commenceront à recevoir des visites.
      </p>
    </div>
  );
}

function SourceRow({
  source,
  rank,
  selectedMetric,
  currency,
  locale,
}: {
  source:
    NormalizedSource;

  rank:
    number;

  selectedMetric:
    MetricDefinition;

  currency:
    string;

  locale:
    string;
}) {
  return (
    <article className="group rounded-xl border border-white/[0.07] bg-white/[0.022] p-3.5 transition hover:border-white/[0.12] hover:bg-white/[0.035]">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/[0.07] text-xs font-black text-emerald-300">
          {getSourceInitials(
            source.label,
          )}

          <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-[#071014] bg-[#111c21] px-1 text-[9px] font-black text-neutral-400">
            {rank}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-extrabold text-white">
                {
                  source.label
                }
              </h3>

              <p className="mt-0.5 text-[11px] font-medium text-neutral-500">
                {formatNumber(
                  source.visits,
                  locale,
                )}{" "}
                visites ·{" "}
                {formatNumber(
                  source.orders,
                  locale,
                )}{" "}
                commandes
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-sm font-black text-white">
                {formatMetricValue({
                  value:
                    source.value,

                  metric:
                    selectedMetric,

                  currency,

                  locale,
                })}
              </p>

              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                {
                  selectedMetric.shortLabel
                }
              </p>
            </div>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.045]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-300 transition-[width] duration-500"
              style={{
                width:
                  `${Math.max(
                    source.percentageOfMaximum,
                    source.value >
                      0
                      ? 2
                      : 0,
                  )}%`,
              }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-semibold text-neutral-600">
            <span>
              {formatNumber(
                source.tickets,
                locale,
              )}{" "}
              billets
            </span>

            <span>
              {formatNumber(
                source.conversionRate,
                locale,
                2,
              )}{" "}
              % conversion
            </span>

            <span>
              {formatNumber(
                source.percentageOfTotal,
                locale,
                1,
              )}{" "}
              % du total
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function MarketingSourcesChart({
  data,
  metric:
    controlledMetric,
  currency = "XOF",
  locale = "fr-FR",
  title =
    "Sources de trafic",
  description =
    "Identifiez les canaux qui génèrent le plus de visites, de ventes et de revenus.",
  maximumItems = 8,
  isLoading =
    false,
  className,
  onMetricChange,
}: MarketingSourcesChartProps) {
  const [
    internalMetric,
    setInternalMetric,
  ] =
    useState<MarketingSourcesMetric>(
      controlledMetric ??
        "revenue",
    );

  const selectedMetricKey =
    controlledMetric ??
    internalMetric;

  const selectedMetric =
    METRICS.find(
      (
        metric,
      ) =>
        metric.key ===
        selectedMetricKey,
    ) ??
    METRICS[0];

  const normalizedCurrency =
    currency
      .trim()
      .toUpperCase() ||
    "XOF";

  const normalizedMaximumItems =
    normalizeMaximumItems(
      maximumItems,
    );

  const chart =
    useMemo(
      () => {
        const normalized =
          data
            .map(
              (
                source,
              ) => ({
                key:
                  source.key,

                label:
                  source.label,

                visits:
                  toSafeNumber(
                    source.visits,
                  ),

                orders:
                  toSafeNumber(
                    source.orders,
                  ),

                tickets:
                  toSafeNumber(
                    source.tickets,
                  ),

                revenue:
                  toSafeNumber(
                    source.revenue,
                  ),

                conversionRate:
                  toSafeNumber(
                    source.conversionRate,
                  ),

                revenueShare:
                  toSafeNumber(
                    source.revenueShare,
                  ),

                value:
                  toSafeNumber(
                    source[
                      selectedMetricKey
                    ],
                  ),
              }),
            )
            .sort(
              (
                left,
                right,
              ) =>
                right.value -
                  left.value ||
                right.revenue -
                  left.revenue ||
                right.visits -
                  left.visits,
            )
            .slice(
              0,
              normalizedMaximumItems,
            );

        const maximum =
          normalized.reduce(
            (
              current,
              source,
            ) =>
              Math.max(
                current,
                source.value,
              ),
            0,
          );

        const total =
          normalized.reduce(
            (
              current,
              source,
            ) =>
              current +
              source.value,
            0,
          );

        const sources:
          NormalizedSource[] =
          normalized.map(
            (
              source,
            ) => ({
              ...source,

              percentageOfMaximum:
                maximum >
                0
                  ? (
                      source.value /
                      maximum
                    ) *
                    100
                  : 0,

              percentageOfTotal:
                total >
                0
                  ? (
                      source.value /
                      total
                    ) *
                    100
                  : 0,
            }),
          );

        const leader =
          sources[0] ??
          null;

        const totalVisits =
          sources.reduce(
            (
              current,
              source,
            ) =>
              current +
              source.visits,
            0,
          );

        const totalOrders =
          sources.reduce(
            (
              current,
              source,
            ) =>
              current +
              source.orders,
            0,
          );

        const totalRevenue =
          sources.reduce(
            (
              current,
              source,
            ) =>
              current +
              source.revenue,
            0,
          );

        return {
          sources,
          leader,
          total,
          totalVisits,
          totalOrders,
          totalRevenue,
        };
      },
      [
        data,
        normalizedMaximumItems,
        selectedMetricKey,
      ],
    );

  const MetricIcon =
    selectedMetric.icon;

  function handleMetricChange(
    metric:
      MarketingSourcesMetric,
  ) {
    if (
      controlledMetric ===
      undefined
    ) {
      setInternalMetric(
        metric,
      );
    }

    onMetricChange?.(
      metric,
    );
  }

  return (
    <section
      aria-labelledby="marketing-sources-title"
      className={joinClassNames(
        "w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071014] shadow-[0_20px_65px_rgba(0,0,0,0.2)]",
        className,
      )}
    >
      <div className="border-b border-white/[0.07] p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300">
                <MetricIcon className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                  Acquisition
                </p>

                <h2
                  id="marketing-sources-title"
                  className="truncate text-lg font-black tracking-[-0.025em] text-white sm:text-xl"
                >
                  {title}
                </h2>
              </div>
            </div>

            <p className="mt-2 max-w-3xl text-xs leading-5 text-neutral-500 sm:text-sm">
              {description}
            </p>
          </div>

          <label className="relative min-w-0 sm:min-w-[200px]">
            <span className="sr-only">
              Métrique de classement
            </span>

            <select
              value={
                selectedMetricKey
              }
              onChange={(
                event,
              ) => {
                handleMetricChange(
                  event.target.value as MarketingSourcesMetric,
                );
              }}
              className="h-11 w-full appearance-none rounded-xl border border-white/[0.08] bg-[#0a1216] px-3 pr-9 text-sm font-bold text-neutral-200 outline-none focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10"
            >
              {METRICS.map(
                (
                  metric,
                ) => (
                  <option
                    key={
                      metric.key
                    }
                    value={
                      metric.key
                    }
                  >
                    {
                      metric.label
                    }
                  </option>
                ),
              )}
            </select>

            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          </label>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
              Source principale
            </p>

            <p className="mt-1.5 truncate text-base font-black text-white">
              {chart.leader
                ?.label ??
                "Aucune"}
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
              Visites
            </p>

            <p className="mt-1.5 text-lg font-black tracking-[-0.03em] text-white">
              {formatNumber(
                chart.totalVisits,
                locale,
              )}
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
              Commandes
            </p>

            <p className="mt-1.5 text-lg font-black tracking-[-0.03em] text-white">
              {formatNumber(
                chart.totalOrders,
                locale,
              )}
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
              Revenus attribués
            </p>

            <p className="mt-1.5 text-lg font-black tracking-[-0.03em] text-white">
              {formatMoney(
                chart.totalRevenue,
                normalizedCurrency,
                locale,
                true,
              )}
            </p>
          </div>
        </div>

        {isLoading ? (
          <LoadingState />
        ) : chart.sources.length ===
          0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {chart.sources.map(
              (
                source,
                index,
              ) => (
                <SourceRow
                  key={
                    source.key
                  }
                  source={
                    source
                  }
                  rank={
                    index +
                    1
                  }
                  selectedMetric={
                    selectedMetric
                  }
                  currency={
                    normalizedCurrency
                  }
                  locale={
                    locale
                  }
                />
              ),
            )}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 border-t border-white/[0.06] pt-4 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Le classement utilise uniquement les sources présentes dans la période et les filtres sélectionnés.
          </span>

          <span className="inline-flex items-center gap-2 whitespace-nowrap font-semibold text-neutral-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Classement par{" "}
            {
              selectedMetric.shortLabel
            }
          </span>
        </div>
      </div>
    </section>
  );
}