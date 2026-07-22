"use client";

import {
  BarChart3,
  CalendarDays,
  ChevronDown,
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
import type { DashboardSalesPoint } from "@/lib/organizer/get-organizer-dashboard";

type SalesChartProps = {
  data: DashboardSalesPoint[];
  currency: SupportedCurrencyCode;
  periodDays: number;
};

type VisibleMetric = "netRevenue" | "ticketsSold";

type ChartPoint = DashboardSalesPoint & {
  x: number;
  revenueY: number;
  ticketsY: number;
};

const CHART_WIDTH = 1000;
const CHART_HEIGHT = 360;

const CHART_PADDING = {
  top: 30,
  right: 42,
  bottom: 52,
  left: 70,
};

const periodOptions = [
  { label: "7 derniers jours", value: 7 },
  { label: "30 derniers jours", value: 30 },
  { label: "90 derniers jours", value: 90 },
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

function formatDateLabel(date: string): string {
  const parsedDate = new Date(`${date}T12:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
  }).format(parsedDate);
}

function formatLongDate(date: string): string {
  const parsedDate = new Date(`${date}T12:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsedDate);
}

function createSmoothPath(
  points: Array<{ x: number; y: number }>,
): string {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const middleX = (current.x + next.x) / 2;

    path += ` C ${middleX} ${current.y}, ${middleX} ${next.y}, ${next.x} ${next.y}`;
  }

  return path;
}

function getTickIndexes(length: number): number[] {
  if (length <= 1) {
    return length === 1 ? [0] : [];
  }

  const maximumTicks =
    length <= 7 ? length : length <= 31 ? 7 : 8;

  const indexes = new Set<number>();

  for (let index = 0; index < maximumTicks; index += 1) {
    indexes.add(
      Math.round((index / (maximumTicks - 1)) * (length - 1)),
    );
  }

  return Array.from(indexes).sort((a, b) => a - b);
}

function roundMaximum(value: number): number {
  if (value <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;

  let roundedNormalized = 10;

  if (normalized <= 1) {
    roundedNormalized = 1;
  } else if (normalized <= 2) {
    roundedNormalized = 2;
  } else if (normalized <= 5) {
    roundedNormalized = 5;
  }

  return roundedNormalized * magnitude;
}

function buildAreaPath(
  linePath: string,
  points: ChartPoint[],
  baseY: number,
): string {
  if (!linePath || points.length === 0) {
    return "";
  }

  const first = points[0];
  const last = points[points.length - 1];

  return `${linePath} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
}

export default function SalesChart({
  data,
  currency,
  periodDays,
}: SalesChartProps) {
  const gradientId =
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
  const revenueGradientId = `revenue-gradient-${gradientId}`;
  const ticketsGradientId = `tickets-gradient-${gradientId}`;

  const [activeIndex, setActiveIndex] = useState<number | null>(
    null,
  );

  const [visibleMetrics, setVisibleMetrics] = useState<
    Record<VisibleMetric, boolean>
  >({
    netRevenue: true,
    ticketsSold: true,
  });

  const chart = useMemo(() => {
    const normalizedData = data.map((item) => ({
      ...item,
      grossRevenue: Number(item.grossRevenue) || 0,
      platformFees: Number(item.platformFees) || 0,
      netRevenue: Number(item.netRevenue) || 0,
      ticketsSold: Number(item.ticketsSold) || 0,
      paidOrders: Number(item.paidOrders) || 0,
    }));

    const innerWidth =
      CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;

    const innerHeight =
      CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

    const revenueMaximum = roundMaximum(
      Math.max(...normalizedData.map((item) => item.netRevenue), 0),
    );

    const ticketsMaximum = roundMaximum(
      Math.max(...normalizedData.map((item) => item.ticketsSold), 0),
    );

    const points: ChartPoint[] = normalizedData.map(
      (item, index) => {
        const x =
          normalizedData.length <= 1
            ? CHART_PADDING.left + innerWidth / 2
            : CHART_PADDING.left +
              (index / (normalizedData.length - 1)) * innerWidth;

        const revenueY =
          CHART_PADDING.top +
          innerHeight -
          (item.netRevenue / revenueMaximum) * innerHeight;

        const ticketsY =
          CHART_PADDING.top +
          innerHeight -
          (item.ticketsSold / ticketsMaximum) * innerHeight;

        return {
          ...item,
          x,
          revenueY,
          ticketsY,
        };
      },
    );

    const revenuePath = createSmoothPath(
      points.map((point) => ({
        x: point.x,
        y: point.revenueY,
      })),
    );

    const ticketsPath = createSmoothPath(
      points.map((point) => ({
        x: point.x,
        y: point.ticketsY,
      })),
    );

    const chartBottom =
      CHART_PADDING.top + innerHeight;

    return {
      points,
      revenueMaximum,
      ticketsMaximum,
      revenuePath,
      ticketsPath,
      revenueAreaPath: buildAreaPath(
        revenuePath,
        points,
        chartBottom,
      ),
      ticketsAreaPath: buildAreaPath(
        ticketsPath,
        points,
        chartBottom,
      ),
      tickIndexes: getTickIndexes(normalizedData.length),
      innerHeight,
      chartBottom,
    };
  }, [data]);

  const totals = useMemo(
    () =>
      data.reduce(
        (current, item) => ({
          grossRevenue:
            current.grossRevenue + Number(item.grossRevenue || 0),

          platformFees:
            current.platformFees + Number(item.platformFees || 0),

          netRevenue:
            current.netRevenue + Number(item.netRevenue || 0),

          ticketsSold:
            current.ticketsSold + Number(item.ticketsSold || 0),

          paidOrders:
            current.paidOrders + Number(item.paidOrders || 0),
        }),
        {
          grossRevenue: 0,
          platformFees: 0,
          netRevenue: 0,
          ticketsSold: 0,
          paidOrders: 0,
        },
      ),
    [data],
  );

  const activePoint =
    activeIndex === null ? null : chart.points[activeIndex];

  function toggleMetric(metric: VisibleMetric) {
    setVisibleMetrics((current) => {
      const enabledCount = Object.values(current).filter(Boolean).length;

      if (current[metric] && enabledCount === 1) {
        return current;
      }

      return {
        ...current,
        [metric]: !current[metric],
      };
    });
  }

  function handlePointerMove(
    event: React.PointerEvent<SVGSVGElement>,
  ) {
    if (chart.points.length === 0) {
      return;
    }

    const rectangle = event.currentTarget.getBoundingClientRect();

    const pointerX =
      ((event.clientX - rectangle.left) / rectangle.width) *
      CHART_WIDTH;

    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    chart.points.forEach((point, index) => {
      const distance = Math.abs(point.x - pointerX);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setActiveIndex(closestIndex);
  }

  const isEmpty =
    data.length === 0 ||
    data.every(
      (point) =>
        point.netRevenue === 0 &&
        point.ticketsSold === 0 &&
        point.paidOrders === 0,
    );

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
      <div className="flex flex-col gap-5 border-b border-white/[0.07] px-4 py-5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <BarChart3 className="h-5 w-5 text-lime-400" />

            <h2 className="text-lg font-black tracking-[-0.02em] text-white">
              Aperçu des ventes
            </h2>
          </div>

          <p className="mt-1.5 text-sm text-neutral-500">
            Évolution réelle de vos revenus et billets vendus dans la devise sélectionnée.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex h-10 items-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/[0.06] px-3 text-xs font-black text-orange-300">
            <CircleDollarSign className="h-4 w-4" />

            <span>
              {resolvedCurrency}
            </span>

            <span className="font-normal opacity-70">
              {currencyDefinition?.symbol ??
                resolvedCurrency}
            </span>
          </div>

          <button
            type="button"
            onClick={() => toggleMetric("netRevenue")}
            aria-pressed={visibleMetrics.netRevenue}
            className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition ${
              visibleMetrics.netRevenue
                ? "border-emerald-500/30 bg-emerald-500/10 text-lime-400"
                : "border-white/[0.08] bg-white/[0.025] text-neutral-500"
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-lime-400" />
            Revenus nets
          </button>

          <button
            type="button"
            onClick={() => toggleMetric("ticketsSold")}
            aria-pressed={visibleMetrics.ticketsSold}
            className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition ${
              visibleMetrics.ticketsSold
                ? "border-orange-500/30 bg-orange-500/10 text-orange-400"
                : "border-white/[0.08] bg-white/[0.025] text-neutral-500"
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
            Billets vendus
          </button>

          <div className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-xs font-semibold text-neutral-300">
            <CalendarDays className="h-4 w-4 text-neutral-500" />

            <span>
              {periodOptions.find(
                (option) => option.value === periodDays,
              )?.label ?? `${periodDays} derniers jours`}
            </span>

            <ChevronDown className="h-3.5 w-3.5 text-neutral-600" />
          </div>
        </div>
      </div>

      <div className="relative px-2 py-4 sm:px-4">
        {isEmpty && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
            <div className="max-w-[360px] rounded-2xl border border-white/[0.08] bg-[#071014]/95 px-6 py-5 text-center shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
                <BarChart3 className="h-5 w-5 text-lime-400" />
              </div>

              <p className="mt-3 text-sm font-bold text-white">
                Aucune vente sur cette période
              </p>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Le graphique se remplira automatiquement dès qu’une
                commande sera réellement payée dans cette devise.
              </p>
            </div>
          </div>
        )}

        <div className="relative overflow-x-auto">
          <div className="min-w-[700px]">
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              role="img"
              aria-label="Graphique des revenus nets et billets vendus"
              onPointerMove={handlePointerMove}
              onPointerLeave={() => setActiveIndex(null)}
              className={`h-auto w-full select-none ${
                isEmpty ? "opacity-35" : ""
              }`}
            >
              <defs>
                <linearGradient
                  id={revenueGradientId}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="#84cc16"
                    stopOpacity="0.28"
                  />
                  <stop
                    offset="100%"
                    stopColor="#84cc16"
                    stopOpacity="0"
                  />
                </linearGradient>

                <linearGradient
                  id={ticketsGradientId}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="#f97316"
                    stopOpacity="0.18"
                  />
                  <stop
                    offset="100%"
                    stopColor="#f97316"
                    stopOpacity="0"
                  />
                </linearGradient>
              </defs>

              {Array.from({ length: 5 }).map((_, index) => {
                const ratio = index / 4;

                const y =
                  CHART_PADDING.top +
                  chart.innerHeight * ratio;

                const revenueValue =
                  chart.revenueMaximum * (1 - ratio);

                const ticketValue =
                  chart.ticketsMaximum * (1 - ratio);

                return (
                  <g key={index}>
                    <line
                      x1={CHART_PADDING.left}
                      y1={y}
                      x2={CHART_WIDTH - CHART_PADDING.right}
                      y2={y}
                      stroke="rgba(255,255,255,0.07)"
                      strokeDasharray="4 7"
                    />

                    <text
                      x={CHART_PADDING.left - 14}
                      y={y + 4}
                      textAnchor="end"
                      fill="rgba(163,230,53,0.7)"
                      fontSize="11"
                    >
                      {formatCompactMoney(
                        revenueValue,
                        resolvedCurrency,
                      )}
                    </text>

                    <text
                      x={CHART_WIDTH - CHART_PADDING.right + 14}
                      y={y + 4}
                      textAnchor="start"
                      fill="rgba(251,146,60,0.75)"
                      fontSize="11"
                    >
                      {Math.round(ticketValue).toLocaleString(
                        "fr-FR",
                      )}
                    </text>
                  </g>
                );
              })}

              {chart.tickIndexes.map((index) => {
                const point = chart.points[index];

                if (!point) {
                  return null;
                }

                return (
                  <g key={`${point.date}-${index}`}>
                    <line
                      x1={point.x}
                      y1={CHART_PADDING.top}
                      x2={point.x}
                      y2={chart.chartBottom}
                      stroke="rgba(255,255,255,0.035)"
                    />

                    <text
                      x={point.x}
                      y={CHART_HEIGHT - 17}
                      textAnchor="middle"
                      fill="rgba(163,163,163,0.75)"
                      fontSize="11"
                    >
                      {formatDateLabel(point.date)}
                    </text>
                  </g>
                );
              })}

              {visibleMetrics.netRevenue &&
                chart.revenueAreaPath && (
                  <path
                    d={chart.revenueAreaPath}
                    fill={`url(#${revenueGradientId})`}
                  />
                )}

              {visibleMetrics.ticketsSold &&
                chart.ticketsAreaPath && (
                  <path
                    d={chart.ticketsAreaPath}
                    fill={`url(#${ticketsGradientId})`}
                  />
                )}

              {visibleMetrics.netRevenue &&
                chart.revenuePath && (
                  <path
                    d={chart.revenuePath}
                    fill="none"
                    stroke="#84cc16"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}

              {visibleMetrics.ticketsSold &&
                chart.ticketsPath && (
                  <path
                    d={chart.ticketsPath}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}

              {activePoint && (
                <g>
                  <line
                    x1={activePoint.x}
                    y1={CHART_PADDING.top}
                    x2={activePoint.x}
                    y2={chart.chartBottom}
                    stroke="rgba(255,255,255,0.32)"
                    strokeDasharray="4 5"
                  />

                  {visibleMetrics.netRevenue && (
                    <circle
                      cx={activePoint.x}
                      cy={activePoint.revenueY}
                      r="6"
                      fill="#081015"
                      stroke="#84cc16"
                      strokeWidth="3"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}

                  {visibleMetrics.ticketsSold && (
                    <circle
                      cx={activePoint.x}
                      cy={activePoint.ticketsY}
                      r="6"
                      fill="#081015"
                      stroke="#f97316"
                      strokeWidth="3"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </g>
              )}
            </svg>

            {activePoint && !isEmpty && (
              <div
                className="pointer-events-none absolute top-7 z-20 w-[230px] rounded-xl border border-white/[0.1] bg-[#050b0f]/95 p-3.5 shadow-[0_18px_55px_rgba(0,0,0,0.55)] backdrop-blur-xl"
                style={{
                  left: `${Math.min(
                    Math.max(
                      (activePoint.x / CHART_WIDTH) * 100,
                      13,
                    ),
                    82,
                  )}%`,
                  transform: "translateX(-50%)",
                }}
              >
                <p className="text-xs font-bold capitalize text-white">
                  {formatLongDate(activePoint.date)}
                </p>

                <div className="mt-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2 text-xs text-neutral-500">
                      <span className="h-2 w-2 rounded-full bg-lime-400" />
                      Revenus nets
                    </span>

                    <span className="text-xs font-bold text-lime-400">
                      {formatMoney({
                        amount:
                          activePoint.netRevenue,

                        currency:
                          resolvedCurrency,
                      })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2 text-xs text-neutral-500">
                      <span className="h-2 w-2 rounded-full bg-orange-400" />
                      Billets
                    </span>

                    <span className="text-xs font-bold text-orange-400">
                      {activePoint.ticketsSold.toLocaleString(
                        "fr-FR",
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-neutral-500">
                      Chiffre brut
                    </span>

                    <span className="text-xs font-semibold text-white">
                      {formatMoney({
                        amount:
                          activePoint.grossRevenue,

                        currency:
                          resolvedCurrency,
                      })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-neutral-500">
                      Commission
                    </span>

                    <span className="text-xs font-semibold text-orange-300">
                      {formatMoney({
                        amount:
                          activePoint.platformFees,

                        currency:
                          resolvedCurrency,
                      })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-neutral-500">
                      Commandes payées
                    </span>

                    <span className="text-xs font-semibold text-white">
                      {activePoint.paidOrders.toLocaleString(
                        "fr-FR",
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.07] px-4 py-3 sm:px-5">
        <p className="text-[11px] leading-5 text-neutral-600">
          Les revenus affichés dans ce graphique correspondent uniquement aux commandes payées en{" "}
          <span className="font-bold text-neutral-400">
            {resolvedCurrency}
          </span>
          . Les autres devises restent séparées dans le tableau de bord.
        </p>
      </div>

      <div className="grid border-t border-white/[0.07] sm:grid-cols-2 xl:grid-cols-5">
        <SummaryItem
          label="Total brut"
          value={formatMoney({
            amount:
              totals.grossRevenue,

            currency:
              resolvedCurrency,
          })}
          icon={CircleDollarSign}
        />

        <SummaryItem
          label="Frais plateforme"
          value={formatMoney({
            amount:
              totals.platformFees,

            currency:
              resolvedCurrency,
          })}
          icon={CircleDollarSign}
          valueClassName="text-orange-400"
        />

        <SummaryItem
          label="Revenus nets"
          value={formatMoney({
            amount:
              totals.netRevenue,

            currency:
              resolvedCurrency,
          })}
          icon={CircleDollarSign}
          valueClassName="text-lime-400"
        />

        <SummaryItem
          label="Billets vendus"
          value={totals.ticketsSold.toLocaleString("fr-FR")}
          icon={TicketCheck}
        />

        <SummaryItem
          label="Commandes payées"
          value={totals.paidOrders.toLocaleString("fr-FR")}
          icon={BarChart3}
        />
      </div>
    </section>
  );
}

type SummaryItemProps = {
  label: string;
  value: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  valueClassName?: string;
};

function SummaryItem({
  label,
  value,
  icon: Icon,
  valueClassName = "text-white",
}: SummaryItemProps) {
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-4 last:border-b-0 sm:border-r sm:last:border-r-0 xl:border-b-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
        <Icon className="h-4 w-4 text-neutral-500" />
      </div>

      <div className="min-w-0">
        <p className="truncate text-[11px] text-neutral-600">
          {label}
        </p>

        <p
          className={`mt-1 truncate text-sm font-black ${valueClassName}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}