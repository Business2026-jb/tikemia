"use client";

import {
  Activity,
  AreaChart as AreaChartIcon,
  Banknote,
  CircleDollarSign,
  CreditCard,
  Eye,
  EyeOff,
  TicketCheck,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import {
  useMemo,
  useState,
  type ComponentType,
} from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import type {
  OrganizerStatisticsData,
  StatisticsSalesPoint,
} from "@/lib/organizer/get-organizer-statistics";

type RevenuePerformanceChartProps = {
  data: OrganizerStatisticsData["salesChart"];
  currency: OrganizerStatisticsData["currency"];
  period: OrganizerStatisticsData["period"];
};

type RevenueMetricKey =
  | "grossRevenue"
  | "platformFees"
  | "netRevenue";

type ActivityMetricKey =
  | "ticketsSold"
  | "paidOrders"
  | "participants"
  | "checkedInParticipants";

type ChartMetricKey =
  | RevenueMetricKey
  | ActivityMetricKey;

type MetricDefinition = {
  key: ChartMetricKey;
  label: string;
  shortLabel: string;
  icon: ComponentType<{
    className?: string;
  }>;
  kind: "money" | "number";
  stroke: string;
  fill: string;
  defaultVisible: boolean;
  chartType: "area" | "line";
  yAxisId: "money" | "activity";
};

type ChartRow = StatisticsSalesPoint & {
  displayDate: string;
  fullDate: string;
};

const METRICS: MetricDefinition[] = [
  {
    key: "grossRevenue",
    label: "Chiffre d’affaires brut",
    shortLabel: "Revenu brut",
    icon: CircleDollarSign,
    kind: "money",
    stroke: "#84cc16",
    fill: "#84cc16",
    defaultVisible: true,
    chartType: "area",
    yAxisId: "money",
  },
  {
    key: "netRevenue",
    label: "Revenu net",
    shortLabel: "Revenu net",
    icon: Banknote,
    kind: "money",
    stroke: "#22c55e",
    fill: "#22c55e",
    defaultVisible: true,
    chartType: "line",
    yAxisId: "money",
  },
  {
    key: "platformFees",
    label: "Commissions Tikemia",
    shortLabel: "Commissions",
    icon: CreditCard,
    kind: "money",
    stroke: "#a855f7",
    fill: "#a855f7",
    defaultVisible: false,
    chartType: "line",
    yAxisId: "money",
  },
  {
    key: "ticketsSold",
    label: "Billets vendus",
    shortLabel: "Billets",
    icon: TicketCheck,
    kind: "number",
    stroke: "#f97316",
    fill: "#f97316",
    defaultVisible: true,
    chartType: "line",
    yAxisId: "activity",
  },
  {
    key: "paidOrders",
    label: "Commandes payées",
    shortLabel: "Commandes",
    icon: CreditCard,
    kind: "number",
    stroke: "#38bdf8",
    fill: "#38bdf8",
    defaultVisible: false,
    chartType: "line",
    yAxisId: "activity",
  },
  {
    key: "participants",
    label: "Participants uniques",
    shortLabel: "Participants",
    icon: UsersRound,
    kind: "number",
    stroke: "#eab308",
    fill: "#eab308",
    defaultVisible: false,
    chartType: "line",
    yAxisId: "activity",
  },
  {
    key: "checkedInParticipants",
    label: "Entrées validées",
    shortLabel: "Présents",
    icon: Activity,
    kind: "number",
    stroke: "#14b8a6",
    fill: "#14b8a6",
    defaultVisible: false,
    chartType: "line",
    yAxisId: "activity",
  },
];

function formatMoney(
  value: number,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits:
        currency === "XOF" || currency === "XAF"
          ? 0
          : 2,
    }).format(value);
  } catch {
    return `${new Intl.NumberFormat("fr-FR").format(
      value,
    )} ${currency}`;
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatAxisMoney(
  value: number,
  currency: string,
): string {
  const compact = formatCompactNumber(value);

  if (currency === "XOF" || currency === "XAF") {
    return compact;
  }

  const definition = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  });

  return definition.format(value);
}

function formatDateLabel(
  value: string,
  periodDays: number,
): {
  displayDate: string;
  fullDate: string;
} {
  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return {
      displayDate: value,
      fullDate: value,
    };
  }

  const displayDate = new Intl.DateTimeFormat(
    "fr-FR",
    periodDays > 90
      ? {
          day: "2-digit",
          month: "short",
        }
      : {
          day: "2-digit",
          month: "short",
        },
  ).format(date);

  const fullDate = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);

  return {
    displayDate,
    fullDate,
  };
}

function buildChartRows({
  data,
  periodDays,
}: {
  data: StatisticsSalesPoint[];
  periodDays: number;
}): ChartRow[] {
  return data.map((point) => {
    const date = formatDateLabel(
      point.date,
      periodDays,
    );

    return {
      ...point,
      displayDate: date.displayDate,
      fullDate: date.fullDate,
    };
  });
}

function getMetricDefinition(
  key: string,
): MetricDefinition | undefined {
  return METRICS.find((metric) => metric.key === key);
}

type CustomTooltipPayloadItem = {
  dataKey?: string | number;
  value?: number | string | null;
  payload?: ChartRow;
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  label?: string | number;
  currency: string;
};

function CustomTooltip({
  active = false,
  payload = [],
  label,
  currency,
}: CustomTooltipProps) {
  if (!active || payload.length === 0) {
    return null;
  }

  const row = payload[0]?.payload;

  return (
    <div className="min-w-[230px] rounded-2xl border border-white/[0.1] bg-[#050c10]/95 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <p className="text-xs font-bold capitalize text-white">
        {row?.fullDate ?? String(label ?? "")}
      </p>

      <div className="mt-3 space-y-2.5">
        {payload.map((entry, index) => {
          const dataKey = String(entry.dataKey ?? "");
          const metric = getMetricDefinition(dataKey);

          if (!metric) {
            return null;
          }

          const parsedValue =
            typeof entry.value === "number"
              ? entry.value
              : Number(entry.value ?? 0);

          const value = Number.isFinite(parsedValue)
            ? parsedValue
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
                    backgroundColor: metric.stroke,
                  }}
                />

                <span className="truncate text-[11px] text-neutral-400">
                  {metric.shortLabel}
                </span>
              </div>

              <strong className="shrink-0 text-xs font-black text-white">
                {metric.kind === "money"
                  ? formatMoney(value, currency)
                  : formatNumber(value)}
              </strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricToggle({
  metric,
  active,
  onClick,
}: {
  metric: MetricDefinition;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = metric.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-9 min-w-0 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition ${
        active
          ? "border-white/[0.14] bg-white/[0.06] text-white"
          : "border-white/[0.07] bg-white/[0.018] text-neutral-500 hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-neutral-300"
      }`}
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{
          backgroundColor: metric.stroke,
          opacity: active ? 1 : 0.35,
        }}
      />

      <Icon className="h-3.5 w-3.5 shrink-0" />

      <span className="truncate">
        {metric.shortLabel}
      </span>

      {active ? (
        <Eye className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
      ) : (
        <EyeOff className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
      )}
    </button>
  );
}

function EmptyChartState() {
  return (
    <div className="flex h-full min-h-[320px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.012] px-5 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.025]">
        <AreaChartIcon className="h-6 w-6 text-neutral-600" />
      </div>

      <h3 className="mt-4 text-sm font-black text-white">
        Aucune donnée sur cette période
      </h3>

      <p className="mt-2 max-w-md text-xs leading-5 text-neutral-500">
        Les ventes, commandes et participants apparaîtront ici dès qu’une activité sera enregistrée.
      </p>
    </div>
  );
}

export default function RevenuePerformanceChart({
  data,
  currency,
  period,
}: RevenuePerformanceChartProps) {
  const [visibleMetrics, setVisibleMetrics] =
    useState<Set<ChartMetricKey>>(
      () =>
        new Set(
          METRICS.filter(
            (metric) => metric.defaultVisible,
          ).map((metric) => metric.key),
        ),
    );

  const chartRows = useMemo(
    () =>
      buildChartRows({
        data,
        periodDays: period.days,
      }),
    [data, period.days],
  );

  const totals = useMemo(
    () =>
      chartRows.reduce(
        (accumulator, point) => ({
          grossRevenue:
            accumulator.grossRevenue +
            point.grossRevenue,
          platformFees:
            accumulator.platformFees +
            point.platformFees,
          netRevenue:
            accumulator.netRevenue +
            point.netRevenue,
          ticketsSold:
            accumulator.ticketsSold +
            point.ticketsSold,
          paidOrders:
            accumulator.paidOrders +
            point.paidOrders,
        }),
        {
          grossRevenue: 0,
          platformFees: 0,
          netRevenue: 0,
          ticketsSold: 0,
          paidOrders: 0,
        },
      ),
    [chartRows],
  );

  const hasData = useMemo(
    () =>
      chartRows.some(
        (point) =>
          point.grossRevenue > 0 ||
          point.platformFees > 0 ||
          point.netRevenue > 0 ||
          point.ticketsSold > 0 ||
          point.paidOrders > 0 ||
          point.participants > 0 ||
          point.checkedInParticipants > 0,
      ),
    [chartRows],
  );

  const hasVisibleMoneyMetric = METRICS.some(
    (metric) =>
      metric.yAxisId === "money" &&
      visibleMetrics.has(metric.key),
  );

  const hasVisibleActivityMetric = METRICS.some(
    (metric) =>
      metric.yAxisId === "activity" &&
      visibleMetrics.has(metric.key),
  );

  function toggleMetric(
    metricKey: ChartMetricKey,
  ): void {
    setVisibleMetrics((current) => {
      const next = new Set(current);

      if (next.has(metricKey)) {
        if (next.size === 1) {
          return current;
        }

        next.delete(metricKey);
      } else {
        next.add(metricKey);
      }

      return next;
    });
  }

  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.045),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.035),transparent_28%)]" />

      <div className="relative flex w-full min-w-0 flex-col gap-5 border-b border-white/[0.07] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between xl:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08]">
              <TrendingUp className="h-4 w-4 text-emerald-300" />
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-base font-black text-white sm:text-lg">
                Performance des ventes
              </h2>

              <p className="mt-1 text-xs text-neutral-500">
                Évolution journalière des revenus, billets, commandes et participants.
              </p>
            </div>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto">
          <QuickStat
            label="Brut"
            value={formatMoney(
              totals.grossRevenue,
              currency,
            )}
            tone="green"
          />

          <QuickStat
            label="Net"
            value={formatMoney(
              totals.netRevenue,
              currency,
            )}
            tone="emerald"
          />

          <QuickStat
            label="Billets"
            value={formatNumber(
              totals.ticketsSold,
            )}
            tone="orange"
          />

          <QuickStat
            label="Commandes"
            value={formatNumber(
              totals.paidOrders,
            )}
            tone="blue"
          />
        </div>
      </div>

      <div className="relative w-full min-w-0 border-b border-white/[0.07] px-4 py-3 sm:px-5 xl:px-6">
        <div className="flex w-full min-w-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {METRICS.map((metric) => (
            <MetricToggle
              key={metric.key}
              metric={metric}
              active={visibleMetrics.has(
                metric.key,
              )}
              onClick={() =>
                toggleMetric(metric.key)
              }
            />
          ))}
        </div>
      </div>

      <div className="relative w-full min-w-0 px-2 py-4 sm:px-4 sm:py-5 xl:px-5">
        <div className="h-[340px] w-full min-w-0 sm:h-[400px] xl:h-[460px] 2xl:h-[500px]">
          {!hasData ? (
            <EmptyChartState />
          ) : (
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              minHeight={300}
            >
              <ComposedChart
                data={chartRows}
                margin={{
                  top: 16,
                  right:
                    hasVisibleActivityMetric
                      ? 14
                      : 6,
                  bottom: 4,
                  left: 2,
                }}
              >
                <defs>
                  <linearGradient
                    id="statisticsGrossRevenueGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#84cc16"
                      stopOpacity={0.28}
                    />
                    <stop
                      offset="95%"
                      stopColor="#84cc16"
                      stopOpacity={0}
                    />
                  </linearGradient>

                  <linearGradient
                    id="statisticsNetRevenueGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#22c55e"
                      stopOpacity={0.18}
                    />
                    <stop
                      offset="95%"
                      stopColor="#22c55e"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  stroke="rgba(255,255,255,0.055)"
                  strokeDasharray="3 3"
                  vertical={false}
                />

                <XAxis
                  dataKey="displayDate"
                  axisLine={false}
                  tickLine={false}
                  minTickGap={
                    period.days > 180
                      ? 36
                      : period.days > 60
                        ? 24
                        : 12
                  }
                  tick={{
                    fill: "#6b7280",
                    fontSize: 11,
                  }}
                  dy={10}
                />

                <YAxis
                  yAxisId="money"
                  hide={!hasVisibleMoneyMetric}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                  tick={{
                    fill: "#6b7280",
                    fontSize: 10,
                  }}
                  tickFormatter={(value: number) =>
                    formatAxisMoney(
                      value,
                      currency,
                    )
                  }
                />

                <YAxis
                  yAxisId="activity"
                  orientation="right"
                  hide={!hasVisibleActivityMetric}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tick={{
                    fill: "#6b7280",
                    fontSize: 10,
                  }}
                  tickFormatter={(
                    value: number,
                  ) =>
                    formatCompactNumber(value)
                  }
                />

                <Tooltip
                  cursor={{
                    stroke:
                      "rgba(255,255,255,0.12)",
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                  }}
                  content={
                    <CustomTooltip
                      currency={currency}
                    />
                  }
                />

                {visibleMetrics.has(
                  "grossRevenue",
                ) && (
                  <Area
                    yAxisId="money"
                    type="monotone"
                    dataKey="grossRevenue"
                    name="Chiffre d’affaires brut"
                    stroke="#84cc16"
                    strokeWidth={2.2}
                    fill="url(#statisticsGrossRevenueGradient)"
                    dot={false}
                    activeDot={{
                      r: 4,
                      strokeWidth: 2,
                      stroke: "#071014",
                      fill: "#84cc16",
                    }}
                    animationDuration={500}
                  />
                )}

                {visibleMetrics.has(
                  "netRevenue",
                ) && (
                  <Line
                    yAxisId="money"
                    type="monotone"
                    dataKey="netRevenue"
                    name="Revenu net"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{
                      r: 4,
                      strokeWidth: 2,
                      stroke: "#071014",
                      fill: "#22c55e",
                    }}
                    animationDuration={500}
                  />
                )}

                {visibleMetrics.has(
                  "platformFees",
                ) && (
                  <Line
                    yAxisId="money"
                    type="monotone"
                    dataKey="platformFees"
                    name="Commissions Tikemia"
                    stroke="#a855f7"
                    strokeWidth={1.8}
                    strokeDasharray="6 4"
                    dot={false}
                    activeDot={{
                      r: 4,
                      strokeWidth: 2,
                      stroke: "#071014",
                      fill: "#a855f7",
                    }}
                    animationDuration={500}
                  />
                )}

                {visibleMetrics.has(
                  "ticketsSold",
                ) && (
                  <Line
                    yAxisId="activity"
                    type="monotone"
                    dataKey="ticketsSold"
                    name="Billets vendus"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{
                      r: 4,
                      strokeWidth: 2,
                      stroke: "#071014",
                      fill: "#f97316",
                    }}
                    animationDuration={500}
                  />
                )}

                {visibleMetrics.has(
                  "paidOrders",
                ) && (
                  <Line
                    yAxisId="activity"
                    type="monotone"
                    dataKey="paidOrders"
                    name="Commandes payées"
                    stroke="#38bdf8"
                    strokeWidth={1.8}
                    dot={false}
                    activeDot={{
                      r: 4,
                      strokeWidth: 2,
                      stroke: "#071014",
                      fill: "#38bdf8",
                    }}
                    animationDuration={500}
                  />
                )}

                {visibleMetrics.has(
                  "participants",
                ) && (
                  <Line
                    yAxisId="activity"
                    type="monotone"
                    dataKey="participants"
                    name="Participants uniques"
                    stroke="#eab308"
                    strokeWidth={1.8}
                    dot={false}
                    activeDot={{
                      r: 4,
                      strokeWidth: 2,
                      stroke: "#071014",
                      fill: "#eab308",
                    }}
                    animationDuration={500}
                  />
                )}

                {visibleMetrics.has(
                  "checkedInParticipants",
                ) && (
                  <Line
                    yAxisId="activity"
                    type="monotone"
                    dataKey="checkedInParticipants"
                    name="Entrées validées"
                    stroke="#14b8a6"
                    strokeWidth={1.8}
                    dot={false}
                    activeDot={{
                      r: 4,
                      strokeWidth: 2,
                      stroke: "#071014",
                      fill: "#14b8a6",
                    }}
                    animationDuration={500}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="relative grid w-full min-w-0 gap-3 border-t border-white/[0.07] px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4 xl:px-6">
        <FooterMetric
          label="Période analysée"
          value={`${period.days} jour${
            period.days > 1 ? "s" : ""
          }`}
          description={
            period.custom
              ? "Période personnalisée"
              : "Période prédéfinie"
          }
        />

        <FooterMetric
          label="Moyenne quotidienne"
          value={formatMoney(
            period.days > 0
              ? totals.grossRevenue /
                  period.days
              : 0,
            currency,
          )}
          description="Chiffre d’affaires brut moyen"
        />

        <FooterMetric
          label="Billets par jour"
          value={formatNumber(
            period.days > 0
              ? totals.ticketsSold /
                  period.days
              : 0,
          )}
          description="Moyenne quotidienne"
        />

        <FooterMetric
          label="Valeur par commande"
          value={formatMoney(
            totals.paidOrders > 0
              ? totals.grossRevenue /
                  totals.paidOrders
              : 0,
            currency,
          )}
          description="Panier moyen calculé"
        />
      </div>
    </section>
  );
}

function QuickStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone:
    | "green"
    | "emerald"
    | "orange"
    | "blue";
}) {
  const styles = {
    green:
      "border-lime-500/20 bg-lime-500/[0.055] text-lime-300",
    emerald:
      "border-emerald-500/20 bg-emerald-500/[0.055] text-emerald-300",
    orange:
      "border-orange-500/20 bg-orange-500/[0.055] text-orange-300",
    blue:
      "border-sky-500/20 bg-sky-500/[0.055] text-sky-300",
  }[tone];

  return (
    <div
      className={`min-w-0 rounded-xl border px-3 py-2 ${styles}`}
    >
      <p className="truncate text-[9px] font-bold uppercase tracking-[0.1em] opacity-70">
        {label}
      </p>

      <p className="mt-1 truncate text-xs font-black">
        {value}
      </p>
    </div>
  );
}

function FooterMetric({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <article className="min-w-0 rounded-xl border border-white/[0.065] bg-white/[0.018] px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-neutral-600">
        {label}
      </p>

      <p className="mt-1.5 truncate text-sm font-black text-white">
        {value}
      </p>

      <p className="mt-1 truncate text-[10px] text-neutral-600">
        {description}
      </p>
    </article>
  );
}