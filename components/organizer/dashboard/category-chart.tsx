"use client";

import {
  ArrowRight,
  ChartPie,
  CircleDollarSign,
  TicketCheck,
} from "lucide-react";
import { useId, useMemo, useState } from "react";

import {
  getCurrencyDefinition,
  isSupportedCurrencyCode,
  type SupportedCurrencyCode,
} from "@/lib/localization/currencies";
import {
  formatMoney,
  getCurrencyDecimals,
} from "@/lib/localization/format-money";
import type { DashboardCategoryItem } from "@/lib/organizer/get-organizer-dashboard";

type CategoryChartProps = {
  data: DashboardCategoryItem[];
  currency: SupportedCurrencyCode;
};

type CategoryColor = {
  stroke: string;
  text: string;
  background: string;
  border: string;
};

const CATEGORY_COLORS: CategoryColor[] = [
  {
    stroke: "#84cc16",
    text: "text-lime-400",
    background: "bg-lime-400/10",
    border: "border-lime-400/25",
  },
  {
    stroke: "#22c55e",
    text: "text-emerald-400",
    background: "bg-emerald-400/10",
    border: "border-emerald-400/25",
  },
  {
    stroke: "#f97316",
    text: "text-orange-400",
    background: "bg-orange-400/10",
    border: "border-orange-400/25",
  },
  {
    stroke: "#facc15",
    text: "text-yellow-400",
    background: "bg-yellow-400/10",
    border: "border-yellow-400/25",
  },
  {
    stroke: "#38bdf8",
    text: "text-sky-400",
    background: "bg-sky-400/10",
    border: "border-sky-400/25",
  },
  {
    stroke: "#a78bfa",
    text: "text-violet-400",
    background: "bg-violet-400/10",
    border: "border-violet-400/25",
  },
];

function formatCompactMoney(
  value: number,
  currency: SupportedCurrencyCode,
): string {
  const safeValue =
    Number.isFinite(value)
      ? value
      : 0;

  const definition =
    getCurrencyDefinition(
      currency,
    );

  const fractionDigits =
    Math.min(
      getCurrencyDecimals(
        currency,
      ),
      1,
    );

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency,
        currencyDisplay:
          "narrowSymbol",
        notation:
          "compact",
        minimumFractionDigits:
          0,
        maximumFractionDigits:
          fractionDigits,
      },
    ).format(
      safeValue,
    );
  } catch {
    const formattedValue =
      new Intl.NumberFormat(
        "fr-FR",
        {
          notation:
            "compact",
          maximumFractionDigits:
            fractionDigits,
        },
      ).format(
        safeValue,
      );

    return `${formattedValue} ${
      definition?.symbol ??
      currency
    }`;
  }
}

function formatPercentage(value: number): string {
  return `${value.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;
}

function normalizePercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 100);
}

export default function CategoryChart({
  data,
  currency,
}: CategoryChartProps) {
  const chartId =
    useId().replaceAll(
      ":",
      "",
    );

  const resolvedCurrency =
    isSupportedCurrencyCode(
      currency,
    )
      ? currency
      : "XOF";

  const currencyDefinition =
    getCurrencyDefinition(
      resolvedCurrency,
    );
  const [activeIndex, setActiveIndex] = useState<number | null>(
    null,
  );

  const chartData = useMemo(() => {
    const validItems = data
      .filter(
        (item) =>
          Number.isFinite(item.grossRevenue) &&
          item.grossRevenue >= 0,
      )
      .map((item) => ({
        ...item,
        grossRevenue: Number(item.grossRevenue) || 0,
        netRevenue: Number(item.netRevenue) || 0,
        ticketsSold: Number(item.ticketsSold) || 0,
        percentage: normalizePercentage(item.percentage),
      }))
      .sort((a, b) => b.grossRevenue - a.grossRevenue);

    const visibleItems = validItems.slice(0, 5);
    const remainingItems = validItems.slice(5);

    if (remainingItems.length > 0) {
      const otherGrossRevenue = remainingItems.reduce(
        (sum, item) => sum + item.grossRevenue,
        0,
      );

      const otherNetRevenue = remainingItems.reduce(
        (sum, item) => sum + item.netRevenue,
        0,
      );

      const otherTicketsSold = remainingItems.reduce(
        (sum, item) => sum + item.ticketsSold,
        0,
      );

      const otherPercentage = remainingItems.reduce(
        (sum, item) => sum + item.percentage,
        0,
      );

      visibleItems.push({
        categoryId: null,
        categoryName: "Autres catégories",
        grossRevenue: otherGrossRevenue,
        netRevenue: otherNetRevenue,
        ticketsSold: otherTicketsSold,
        percentage: normalizePercentage(otherPercentage),
      });
    }

    return visibleItems;
  }, [data]);

  const totals = useMemo(
    () =>
      chartData.reduce(
        (current, item) => ({
          grossRevenue:
            current.grossRevenue + item.grossRevenue,
          netRevenue: current.netRevenue + item.netRevenue,
          ticketsSold:
            current.ticketsSold + item.ticketsSold,
        }),
        {
          grossRevenue: 0,
          netRevenue: 0,
          ticketsSold: 0,
        },
      ),
    [chartData],
  );

  const radius = 74;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercentage = 0;

  const segments = chartData.map((item, index) => {
    const percentage = normalizePercentage(item.percentage);
    const length = (percentage / 100) * circumference;
    const offset =
      -(accumulatedPercentage / 100) * circumference;

    accumulatedPercentage += percentage;

    return {
      item,
      index,
      length,
      offset,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    };
  });

  const hasData =
    chartData.length > 0 && totals.grossRevenue > 0;

  const activeCategory =
    activeIndex === null
      ? null
      : chartData[activeIndex] ?? null;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
      <header className="flex flex-col gap-4 border-b border-white/[0.07] px-4 py-5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <ChartPie className="h-5 w-5 text-lime-400" />

            <h2 className="text-lg font-black tracking-[-0.02em] text-white">
              Revenus par catégorie
            </h2>
          </div>

          <p className="mt-1.5 text-sm text-neutral-500">
            Répartition des ventes payées selon les catégories
            de vos événements dans la devise sélectionnée.
          </p>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/[0.06] px-3 py-1.5 text-xs font-black text-orange-300">
          <CircleDollarSign className="h-3.5 w-3.5" />

          <span>
            {resolvedCurrency}
          </span>

          <span className="font-normal opacity-70">
            {currencyDefinition?.symbol ??
              resolvedCurrency}
          </span>
        </div>
      </header>

      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="relative flex min-h-[292px] items-center justify-center border-b border-white/[0.07] px-4 py-6 lg:border-b-0 lg:border-r">
          <div
            aria-hidden="true"
            className="absolute h-44 w-44 rounded-full bg-emerald-500/[0.07] blur-[65px]"
          />

          <div className="relative">
            <svg
              viewBox="0 0 200 200"
              role="img"
              aria-label="Répartition des revenus par catégorie"
              className="h-[218px] w-[218px] sm:h-[236px] sm:w-[236px]"
            >
              <defs>
                <filter
                  id={`shadow-${chartId}`}
                  x="-20%"
                  y="-20%"
                  width="140%"
                  height="140%"
                >
                  <feDropShadow
                    dx="0"
                    dy="4"
                    stdDeviation="5"
                    floodColor="#000000"
                    floodOpacity="0.3"
                  />
                </filter>
              </defs>

              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="22"
              />

              {hasData &&
                segments.map((segment) => {
                  const isActive =
                    activeIndex === segment.index;

                  return (
                    <circle
                      key={`${segment.item.categoryId ?? "other"}-${segment.index}`}
                      cx="100"
                      cy="100"
                      r={radius}
                      fill="none"
                      stroke={segment.color.stroke}
                      strokeWidth={isActive ? "27" : "22"}
                      strokeLinecap="round"
                      strokeDasharray={`${segment.length} ${
                        circumference - segment.length
                      }`}
                      strokeDashoffset={segment.offset}
                      transform="rotate(-90 100 100)"
                      filter={`url(#shadow-${chartId})`}
                      className="cursor-pointer transition-all duration-200"
                      onMouseEnter={() =>
                        setActiveIndex(segment.index)
                      }
                      onMouseLeave={() =>
                        setActiveIndex(null)
                      }
                    />
                  );
                })}
            </svg>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-9 text-center">
              {activeCategory ? (
                <>
                  <p className="max-w-[145px] truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                    {activeCategory.categoryName}
                  </p>

                  <p className="mt-2 text-xl font-black tracking-[-0.03em] text-white">
                    {formatPercentage(
                      activeCategory.percentage,
                    )}
                  </p>

                  <p className="mt-1 max-w-[145px] truncate text-xs text-neutral-600">
                    {formatCompactMoney(
                      activeCategory.grossRevenue,
                      resolvedCurrency,
                    )}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-600">
                    Revenu total
                  </p>

                  <p className="mt-2 max-w-[155px] break-words text-xl font-black tracking-[-0.03em] text-white">
                    {formatCompactMoney(
                      totals.grossRevenue,
                      resolvedCurrency,
                    )}
                  </p>

                  <p className="mt-1 text-xs text-neutral-600">
                    Toutes catégories
                  </p>
                </>
              )}
            </div>
          </div>

          {!hasData && (
            <div className="absolute bottom-5 left-1/2 w-[calc(100%-32px)] max-w-[280px] -translate-x-1/2 rounded-xl border border-white/[0.07] bg-[#071014]/95 px-4 py-3 text-center">
              <p className="text-xs font-semibold text-neutral-300">
                Aucune catégorie vendue
              </p>

              <p className="mt-1 text-[11px] leading-4 text-neutral-600">
                Les catégories apparaîtront après la première
                commande payée.
              </p>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5">
          {chartData.length > 0 ? (
            <div className="space-y-2.5">
              {chartData.map((item, index) => {
                const color =
                  CATEGORY_COLORS[
                    index % CATEGORY_COLORS.length
                  ];

                const isActive = activeIndex === index;

                return (
                  <article
                    key={`${item.categoryId ?? "other"}-${index}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                    className={`group rounded-xl border p-3.5 transition ${
                      isActive
                        ? `${color.border} ${color.background}`
                        : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.11] hover:bg-white/[0.035]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
                        style={{
                          backgroundColor: color.stroke,
                          boxShadow: `0 0 12px ${color.stroke}55`,
                        }}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-white">
                              {item.categoryName}
                            </p>

                            <p className="mt-1 text-[11px] text-neutral-600">
                              {item.ticketsSold.toLocaleString(
                                "fr-FR",
                              )}{" "}
                              billet
                              {item.ticketsSold > 1 ? "s" : ""}{" "}
                              vendu
                              {item.ticketsSold > 1 ? "s" : ""}
                            </p>
                          </div>

                          <div className="shrink-0 sm:text-right">
                            <p
                              className={`text-sm font-black ${color.text}`}
                            >
                              {formatMoney({
                                amount:
                                  item.grossRevenue,

                                currency:
                                  resolvedCurrency,
                              })}
                            </p>

                            <p className="mt-1 text-[11px] font-semibold text-neutral-500">
                              {formatPercentage(
                                item.percentage,
                              )}
                            </p>

                            <p className="mt-1 text-[10px] text-neutral-600">
                              Net :{" "}
                              <span className="font-bold text-neutral-400">
                                {formatMoney({
                                  amount:
                                    item.netRevenue,

                                  currency:
                                    resolvedCurrency,
                                })}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full transition-[width] duration-700"
                            style={{
                              width: `${normalizePercentage(
                                item.percentage,
                              )}%`,
                              backgroundColor: color.stroke,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-white/[0.015] px-5 text-center">
              <div>
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07]">
                  <ChartPie className="h-5 w-5 text-lime-400" />
                </div>

                <p className="mt-3 text-sm font-bold text-white">
                  Aucune donnée disponible
                </p>

                <p className="mx-auto mt-1 max-w-[300px] text-xs leading-5 text-neutral-600">
                  Créez un événement avec une catégorie et
                  commencez à vendre des billets.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-white/[0.07] px-4 py-3 sm:px-5">
        <p className="text-[11px] leading-5 text-neutral-600">
          Les catégories affichées correspondent uniquement aux commandes payées en{" "}
          <span className="font-bold text-neutral-400">
            {resolvedCurrency}
          </span>
          . Les autres devises restent séparées dans le tableau de bord.
        </p>
      </div>

      <div className="grid border-t border-white/[0.07] sm:grid-cols-3">
        <SummaryMetric
          label="Revenus bruts"
          value={formatMoney({
            amount:
              totals.grossRevenue,

            currency:
              resolvedCurrency,
          })}
          icon={CircleDollarSign}
        />

        <SummaryMetric
          label="Revenus nets"
          value={formatMoney({
            amount:
              totals.netRevenue,

            currency:
              resolvedCurrency,
          })}
          icon={ArrowRight}
          emphasis
        />

        <SummaryMetric
          label="Billets vendus"
          value={totals.ticketsSold.toLocaleString("fr-FR")}
          icon={TicketCheck}
        />
      </div>
    </section>
  );
}

type SummaryMetricProps = {
  label: string;
  value: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  emphasis?: boolean;
};

function SummaryMetric({
  label,
  value,
  icon: Icon,
  emphasis = false,
}: SummaryMetricProps) {
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
          emphasis
            ? "border-emerald-500/25 bg-emerald-500/10"
            : "border-white/[0.08] bg-white/[0.03]"
        }`}
      >
        <Icon
          className={`h-4 w-4 ${
            emphasis ? "text-lime-400" : "text-neutral-500"
          }`}
        />
      </div>

      <div className="min-w-0">
        <p className="truncate text-[11px] text-neutral-600">
          {label}
        </p>

        <p
          className={`mt-1 truncate text-sm font-black ${
            emphasis ? "text-lime-400" : "text-white"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}