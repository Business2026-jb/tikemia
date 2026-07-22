"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  Eye,
  EyeOff,
  HandCoins,
  ReceiptText,
  RefreshCcw,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  useMemo,
  useState,
  type ComponentType,
} from "react";

import type {
  OrganizerPaymentsData,
  OrganizerPaymentsChartPoint,
} from "@/lib/organizer/get-organizer-payments";

type PaymentsRevenueChartProps = {
  data: OrganizerPaymentsData["chart"];
  currency: OrganizerPaymentsData["currency"];
  period?: OrganizerPaymentsData["period"];
  title?: string;
  description?: string;
};

type MoneyMetricKey =
  | "grossRevenue"
  | "platformFees"
  | "organizerNet"
  | "refundedAmount"
  | "payoutRequested"
  | "payoutProcessed";

type MetricDefinition = {
  key: MoneyMetricKey;
  label: string;
  shortLabel: string;
  description: string;
  icon: ComponentType<{
    className?: string;
  }>;
  stroke: string;
  fill: string;
  toneClassName: string;
};

type ChartRow = OrganizerPaymentsChartPoint & {
  shortDate: string;
  fullDate: string;
};

type CustomTooltipEntry = {
  dataKey?: string | number;
  value?: number | string | null;
  payload?: ChartRow;
  color?: string;
  name?: string | number;
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: CustomTooltipEntry[];
  label?: string | number;
  currency: string;
};

const METRICS: MetricDefinition[] = [
  {
    key: "grossRevenue",
    label: "Revenu brut",
    shortLabel: "Brut",
    description:
      "Total généré par les paiements réussis.",
    icon: CircleDollarSign,
    stroke: "#84cc16",
    fill: "rgba(132, 204, 22, 0.16)",
    toneClassName:
      "border-lime-500/20 bg-lime-500/[0.06] text-lime-300",
  },
  {
    key: "organizerNet",
    label: "Revenu net",
    shortLabel: "Net",
    description:
      "Montant organisateur après commissions.",
    icon: Banknote,
    stroke: "#22c55e",
    fill: "rgba(34, 197, 94, 0.13)",
    toneClassName:
      "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300",
  },
  {
    key: "platformFees",
    label: "Commissions Tikemia",
    shortLabel: "Commissions",
    description:
      "Frais de plateforme calculés sur les ventes.",
    icon: ReceiptText,
    stroke: "#f97316",
    fill: "rgba(249, 115, 22, 0.12)",
    toneClassName:
      "border-orange-500/20 bg-orange-500/[0.06] text-orange-300",
  },
  {
    key: "refundedAmount",
    label: "Remboursements",
    shortLabel: "Remboursé",
    description:
      "Sommes retournées aux acheteurs.",
    icon: RefreshCcw,
    stroke: "#a855f7",
    fill: "rgba(168, 85, 247, 0.11)",
    toneClassName:
      "border-violet-500/20 bg-violet-500/[0.06] text-violet-300",
  },
  {
    key: "payoutRequested",
    label: "Retraits demandés",
    shortLabel: "Demandés",
    description:
      "Montants demandés par l’organisateur.",
    icon: WalletCards,
    stroke: "#38bdf8",
    fill: "rgba(56, 189, 248, 0.11)",
    toneClassName:
      "border-sky-500/20 bg-sky-500/[0.06] text-sky-300",
  },
  {
    key: "payoutProcessed",
    label: "Retraits traités",
    shortLabel: "Traités",
    description:
      "Montants déjà versés à l’organisateur.",
    icon: HandCoins,
    stroke: "#f59e0b",
    fill: "rgba(245, 158, 11, 0.11)",
    toneClassName:
      "border-amber-500/20 bg-amber-500/[0.06] text-amber-300",
  },
];

const DEFAULT_VISIBLE_METRICS: MoneyMetricKey[] = [
  "grossRevenue",
  "organizerNet",
  "platformFees",
];

function safeNumber(value: number): number {
  return Number.isFinite(value)
    ? Math.max(value, 0)
    : 0;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(safeNumber(value));
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
        currency === "XOF" ||
        currency === "XAF"
          ? 0
          : 2,
    }).format(safeValue);
  } catch {
    return `${formatNumber(safeValue)} ${currency}`;
  }
}

function formatCompactMoney(
  value: number,
  currency: string,
): string {
  const safeValue = safeNumber(value);

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: 1,
    }).format(safeValue);
  } catch {
    return new Intl.NumberFormat("fr-FR", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(safeValue);
  }
}

function formatShortDate(
  value: string,
): string {
  const date = new Date(
    value.includes("T")
      ? value
      : `${value}T12:00:00`,
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatFullDate(
  value: string,
): string {
  const date = new Date(
    value.includes("T")
      ? value
      : `${value}T12:00:00`,
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getMetricDefinition(
  key: string,
): MetricDefinition | undefined {
  return METRICS.find(
    (metric) =>
      metric.key === key,
  );
}

function CustomTooltip({
  active,
  payload,
  label,
  currency,
}: CustomTooltipProps) {
  if (
    !active ||
    !payload ||
    payload.length === 0
  ) {
    return null;
  }

  const row =
    payload[0]?.payload;

  return (
    <div className="min-w-[245px] rounded-2xl border border-white/[0.1] bg-[#050c10]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
      <p className="text-xs font-black capitalize text-white">
        {row?.fullDate ??
          String(label ?? "")}
      </p>

      <div className="mt-3 space-y-2.5">
        {payload.map(
          (
            entry,
            index,
          ) => {
            const dataKey =
              typeof entry.dataKey ===
              "string"
                ? entry.dataKey
                : String(
                    entry.dataKey ?? "",
                  );

            const metric =
              getMetricDefinition(
                dataKey,
              );

            if (!metric) {
              return null;
            }

            const numericValue =
              typeof entry.value ===
              "number"
                ? entry.value
                : Number(
                    entry.value ?? 0,
                  );

            const value =
              Number.isFinite(
                numericValue,
              )
                ? numericValue
                : 0;

            return (
              <div
                key={`${dataKey}-${index}`}
                className="flex items-center justify-between gap-5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        metric.stroke,
                    }}
                  />

                  <span className="truncate text-[11px] text-neutral-400">
                    {metric.label}
                  </span>
                </div>

                <strong className="shrink-0 text-xs font-black text-white">
                  {formatMoney(
                    value,
                    currency,
                  )}
                </strong>
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}

function MetricToggle({
  metric,
  active,
  onToggle,
}: {
  metric: MetricDefinition;
  active: boolean;
  onToggle: (
    key: MoneyMetricKey,
  ) => void;
}) {
  const Icon = metric.icon;

  return (
    <button
      type="button"
      onClick={() =>
        onToggle(metric.key)
      }
      aria-pressed={active}
      className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
        active
          ? metric.toneClassName
          : "border-white/[0.075] bg-white/[0.018] text-neutral-500 hover:border-white/[0.13] hover:bg-white/[0.035] hover:text-neutral-300"
      }`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-[#050c10]">
        <Icon className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-bold">
          {metric.shortLabel}
        </p>

        <p className="mt-0.5 truncate text-[9px] opacity-65">
          {active
            ? "Visible"
            : "Masqué"}
        </p>
      </div>

      {active ? (
        <Eye className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <EyeOff className="h-3.5 w-3.5 shrink-0" />
      )}
    </button>
  );
}

function QuickMetric({
  label,
  value,
  description,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  description: string;
  icon: ComponentType<{
    className?: string;
  }>;
  tone:
    | "green"
    | "orange"
    | "blue"
    | "violet";
}) {
  const styles = {
    green:
      "border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-300",
    orange:
      "border-orange-500/20 bg-orange-500/[0.05] text-orange-300",
    blue:
      "border-sky-500/20 bg-sky-500/[0.05] text-sky-300",
    violet:
      "border-violet-500/20 bg-violet-500/[0.05] text-violet-300",
  }[tone];

  return (
    <article
      className={`flex min-w-0 items-center gap-3 rounded-xl border px-3 py-3 ${styles}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-[#071014]">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="truncate text-[9px] font-bold uppercase tracking-[0.1em] opacity-70">
          {label}
        </p>

        <p className="mt-1 truncate text-sm font-black">
          {value}
        </p>

        <p className="mt-1 truncate text-[9px] text-neutral-600">
          {description}
        </p>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[360px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.012] px-5 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.025]">
        <TrendingUp className="h-7 w-7 text-neutral-600" />
      </div>

      <h3 className="mt-5 text-lg font-black text-white">
        Aucune évolution financière
      </h3>

      <p className="mt-2 max-w-lg text-sm leading-6 text-neutral-500">
        Les revenus, commissions, remboursements et retraits apparaîtront ici dès que des opérations seront enregistrées.
      </p>
    </div>
  );
}

export default function PaymentsRevenueChart({
  data,
  currency,
  period,
  title = "Évolution financière",
  description =
    "Analysez les revenus, commissions, remboursements et retraits sur la période sélectionnée.",
}: PaymentsRevenueChartProps) {
  const [
    visibleMetrics,
    setVisibleMetrics,
  ] = useState<
    MoneyMetricKey[]
  >(
    DEFAULT_VISIBLE_METRICS,
  );

  const chartData =
    useMemo<ChartRow[]>(
      () =>
        data.map(
          (point) => ({
            ...point,
            grossRevenue:
              safeNumber(
                point.grossRevenue,
              ),
            platformFees:
              safeNumber(
                point.platformFees,
              ),
            organizerNet:
              safeNumber(
                point.organizerNet,
              ),
            refundedAmount:
              safeNumber(
                point.refundedAmount,
              ),
            payoutRequested:
              safeNumber(
                point.payoutRequested,
              ),
            payoutProcessed:
              safeNumber(
                point.payoutProcessed,
              ),
            shortDate:
              formatShortDate(
                point.date,
              ),
            fullDate:
              formatFullDate(
                point.date,
              ),
          }),
        ),
      [data],
    );

  const totals =
    useMemo(
      () =>
        chartData.reduce(
          (
            result,
            point,
          ) => ({
            grossRevenue:
              result.grossRevenue +
              point.grossRevenue,
            platformFees:
              result.platformFees +
              point.platformFees,
            organizerNet:
              result.organizerNet +
              point.organizerNet,
            refundedAmount:
              result.refundedAmount +
              point.refundedAmount,
            payoutRequested:
              result.payoutRequested +
              point.payoutRequested,
            payoutProcessed:
              result.payoutProcessed +
              point.payoutProcessed,
          }),
          {
            grossRevenue: 0,
            platformFees: 0,
            organizerNet: 0,
            refundedAmount: 0,
            payoutRequested: 0,
            payoutProcessed: 0,
          },
        ),
      [chartData],
    );

  const totalActivity =
    totals.grossRevenue +
    totals.refundedAmount +
    totals.payoutRequested +
    totals.payoutProcessed;

  const hasData =
    totalActivity > 0 ||
    chartData.some(
      (point) =>
        point.successfulPayments >
          0 ||
        point.pendingPayments >
          0 ||
        point.failedPayments >
          0 ||
        point.refundedPayments >
          0,
    );

  const bestDay =
    useMemo(
      () =>
        chartData.reduce<
          ChartRow | null
        >(
          (
            best,
            point,
          ) =>
            !best ||
            point.grossRevenue >
              best.grossRevenue
              ? point
              : best,
          null,
        ),
      [chartData],
    );

  const averageDailyNet =
    chartData.length > 0
      ? totals.organizerNet /
        chartData.length
      : 0;

  const netRetentionRate =
    totals.grossRevenue > 0
      ? Math.min(
          Math.max(
            (
              totals.organizerNet /
              totals.grossRevenue
            ) *
              100,
            0,
          ),
          100,
        )
      : 0;

  const toggleMetric = (
    key: MoneyMetricKey,
  ) => {
    setVisibleMetrics(
      (current) => {
        if (
          current.includes(key)
        ) {
          if (
            current.length === 1
          ) {
            return current;
          }

          return current.filter(
            (item) =>
              item !== key,
          );
        }

        return [
          ...current,
          key,
        ];
      },
    );
  };

  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.05),transparent_33%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.035),transparent_29%)]" />

      <div className="relative flex w-full min-w-0 flex-col gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-5 xl:flex-row xl:items-center xl:justify-between xl:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08]">
            <TrendingUp className="h-4 w-4 text-emerald-300" />
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

        {period && (
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[10px] font-bold text-neutral-400">
            <WalletCards className="h-3.5 w-3.5 text-sky-300" />
            {period.days} jour
            {period.days > 1
              ? "s"
              : ""}
            {period.custom
              ? " • période personnalisée"
              : ""}
          </span>
        )}
      </div>

      <div className="relative grid w-full min-w-0 gap-3 border-b border-white/[0.07] px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4 xl:px-6">
        <QuickMetric
          label="Revenu brut"
          value={formatMoney(
            totals.grossRevenue,
            currency,
          )}
          description="Total sur la période"
          icon={CircleDollarSign}
          tone="green"
        />

        <QuickMetric
          label="Revenu net"
          value={formatMoney(
            totals.organizerNet,
            currency,
          )}
          description={`${new Intl.NumberFormat(
            "fr-FR",
            {
              maximumFractionDigits: 1,
            },
          ).format(
            netRetentionRate,
          )} % du brut`}
          icon={Banknote}
          tone="blue"
        />

        <QuickMetric
          label="Retraits demandés"
          value={formatMoney(
            totals.payoutRequested,
            currency,
          )}
          description="Demandes enregistrées"
          icon={WalletCards}
          tone="orange"
        />

        <QuickMetric
          label="Retraits traités"
          value={formatMoney(
            totals.payoutProcessed,
            currency,
          )}
          description="Montants déjà versés"
          icon={HandCoins}
          tone="violet"
        />
      </div>

      <div className="relative grid w-full min-w-0 gap-5 px-4 py-5 sm:px-5 xl:grid-cols-[minmax(0,1fr)_260px] xl:px-6 xl:py-6">
        <div className="min-w-0">
          {!hasData ? (
            <EmptyState />
          ) : (
            <div className="h-[390px] w-full min-w-0 sm:h-[430px] xl:h-[470px]">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <ComposedChart
                  data={
                    chartData
                  }
                  margin={{
                    top: 16,
                    right: 10,
                    left: 0,
                    bottom: 0,
                  }}
                >
                  <defs>
                    {METRICS.map(
                      (metric) => (
                        <linearGradient
                          key={
                            metric.key
                          }
                          id={`payments-${metric.key}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={
                              metric.stroke
                            }
                            stopOpacity={
                              0.26
                            }
                          />

                          <stop
                            offset="100%"
                            stopColor={
                              metric.stroke
                            }
                            stopOpacity={
                              0
                            }
                          />
                        </linearGradient>
                      ),
                    )}
                  </defs>

                  <CartesianGrid
                    vertical={
                      false
                    }
                    stroke="rgba(255,255,255,0.055)"
                    strokeDasharray="4 4"
                  />

                  <XAxis
                    dataKey="shortDate"
                    axisLine={
                      false
                    }
                    tickLine={
                      false
                    }
                    minTickGap={
                      28
                    }
                    tick={{
                      fill:
                        "#667178",
                      fontSize:
                        10,
                    }}
                  />

                  <YAxis
                    axisLine={
                      false
                    }
                    tickLine={
                      false
                    }
                    width={
                      66
                    }
                    tick={{
                      fill:
                        "#667178",
                      fontSize:
                        10,
                    }}
                    tickFormatter={(
                      value,
                    ) =>
                      formatCompactMoney(
                        Number(
                          value,
                        ),
                        currency,
                      )
                    }
                  />

                  <Tooltip
                    cursor={{
                      stroke:
                        "rgba(255,255,255,0.12)",
                      strokeWidth:
                        1,
                      strokeDasharray:
                        "4 4",
                    }}
                    content={
                      <CustomTooltip
                        currency={
                          currency
                        }
                      />
                    }
                  />

                  {METRICS.map(
                    (
                      metric,
                      index,
                    ) => {
                      if (
                        !visibleMetrics.includes(
                          metric.key,
                        )
                      ) {
                        return null;
                      }

                      const useArea =
                        metric.key ===
                          "grossRevenue" ||
                        metric.key ===
                          "organizerNet";

                      if (useArea) {
                        return (
                          <Area
                            key={
                              metric.key
                            }
                            type="monotone"
                            dataKey={
                              metric.key
                            }
                            name={
                              metric.label
                            }
                            stroke={
                              metric.stroke
                            }
                            strokeWidth={
                              2.4
                            }
                            fill={`url(#payments-${metric.key})`}
                            dot={
                              false
                            }
                            activeDot={{
                              r: 4,
                              strokeWidth:
                                2,
                              fill:
                                "#071014",
                              stroke:
                                metric.stroke,
                            }}
                            isAnimationActive={
                              false
                            }
                          />
                        );
                      }

                      return (
                        <Line
                          key={
                            metric.key
                          }
                          type="monotone"
                          dataKey={
                            metric.key
                          }
                          name={
                            metric.label
                          }
                          stroke={
                            metric.stroke
                          }
                          strokeWidth={
                            index === 0
                              ? 2.4
                              : 2
                          }
                          strokeDasharray={
                            metric.key ===
                              "refundedAmount" ||
                            metric.key ===
                              "payoutRequested"
                              ? "5 4"
                              : undefined
                          }
                          dot={
                            false
                          }
                          activeDot={{
                            r: 4,
                            strokeWidth:
                              2,
                            fill:
                              "#071014",
                            stroke:
                              metric.stroke,
                          }}
                          isAnimationActive={
                            false
                          }
                        />
                      );
                    },
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <aside className="min-w-0 rounded-2xl border border-white/[0.07] bg-[#050c10] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                Courbes visibles
              </p>

              <p className="mt-1 text-xs font-black text-white">
                Sélection des indicateurs
              </p>
            </div>

            <span className="flex h-7 min-w-7 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.025] px-2 text-[10px] font-black text-neutral-400">
              {visibleMetrics.length}
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {METRICS.map(
              (metric) => (
                <MetricToggle
                  key={
                    metric.key
                  }
                  metric={
                    metric
                  }
                  active={visibleMetrics.includes(
                    metric.key,
                  )}
                  onToggle={
                    toggleMetric
                  }
                />
              ),
            )}
          </div>

          <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.018] p-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-600">
              Meilleure journée
            </p>

            <p className="mt-2 truncate text-xs font-black capitalize text-white">
              {bestDay?.fullDate ??
                "Aucune donnée"}
            </p>

            <p className="mt-1 text-sm font-black text-lime-300">
              {formatMoney(
                bestDay?.grossRevenue ??
                  0,
                currency,
              )}
            </p>
          </div>

          <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.018] p-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-600">
              Net moyen quotidien
            </p>

            <p className="mt-2 text-sm font-black text-emerald-300">
              {formatMoney(
                averageDailyNet,
                currency,
              )}
            </p>

            <div className="mt-2 flex items-center gap-1.5 text-[9px] text-neutral-600">
              {averageDailyNet > 0 ? (
                <ArrowUpRight className="h-3 w-3 text-emerald-400" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-neutral-500" />
              )}

              Moyenne sur la période
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}