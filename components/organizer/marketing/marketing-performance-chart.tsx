"use client";

import {
  BarChart3,
  CalendarDays,
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
  MarketingTimelineGroup,
  MarketingTimelinePoint,
} from "@/lib/marketing/calculate-marketing-metrics";

export type MarketingPerformanceMetric =
  | "visits"
  | "orders"
  | "tickets"
  | "revenue"
  | "conversionRate"
  | "averageOrderValue";

export type MarketingPerformanceChartProps = {
  data: readonly MarketingTimelinePoint[];

  metric?: MarketingPerformanceMetric;
  groupBy?: MarketingTimelineGroup;

  currency?: string;
  locale?: string;

  title?: string;
  description?: string;

  isLoading?: boolean;
  className?: string;

  onMetricChange?:
    (
      metric: MarketingPerformanceMetric,
    ) => void;

  onGroupByChange?:
    (
      groupBy: MarketingTimelineGroup,
    ) => void;
};

type MetricDefinition = {
  key: MarketingPerformanceMetric;
  label: string;
  shortLabel: string;
  icon:
    typeof MousePointerClick;
  format:
    | "number"
    | "money"
    | "percentage";
};

type ChartPoint = MarketingTimelinePoint & {
  value: number;
  x: number;
  y: number;
};

const METRICS: readonly MetricDefinition[] = [
  {
    key: "visits",
    label: "Visites",
    shortLabel: "Visites",
    icon: MousePointerClick,
    format: "number",
  },
  {
    key: "orders",
    label: "Commandes",
    shortLabel: "Commandes",
    icon: ShoppingCart,
    format: "number",
  },
  {
    key: "tickets",
    label: "Billets vendus",
    shortLabel: "Billets",
    icon: TicketCheck,
    format: "number",
  },
  {
    key: "revenue",
    label: "Revenus",
    shortLabel: "Revenus",
    icon: CircleDollarSign,
    format: "money",
  },
  {
    key: "conversionRate",
    label: "Taux de conversion",
    shortLabel: "Conversion",
    icon: TrendingUp,
    format: "percentage",
  },
  {
    key: "averageOrderValue",
    label: "Panier moyen",
    shortLabel: "Panier moyen",
    icon: BarChart3,
    format: "money",
  },
] as const;

const GROUP_BY_OPTIONS: ReadonlyArray<{
  value: MarketingTimelineGroup;
  label: string;
}> = [
  {
    value: "day",
    label: "Par jour",
  },
  {
    value: "week",
    label: "Par semaine",
  },
  {
    value: "month",
    label: "Par mois",
  },
];

const SVG_WIDTH =
  1_000;

const SVG_HEIGHT =
  320;

const CHART_PADDING = {
  top: 24,
  right: 24,
  bottom: 54,
  left: 66,
} as const;

function joinClassNames(
  ...values: Array<
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
  return Number.isFinite(value)
    ? Math.max(value, 0)
    : 0;
}

function formatNumber(
  value: number,
  locale: string,
  maximumFractionDigits = 0,
): string {
  return new Intl.NumberFormat(
    locale,
    {
      maximumFractionDigits,
    },
  ).format(
    toSafeNumber(value),
  );
}

function formatMoney(
  value: number,
  currency: string,
  locale: string,
  compact = false,
): string {
  const amount =
    toSafeNumber(value);

  try {
    return new Intl.NumberFormat(
      locale,
      {
        style: "currency",
        currency,
        notation:
          compact
            ? "compact"
            : "standard",
        minimumFractionDigits:
          currency === "XOF" ||
          currency === "XAF"
            ? 0
            : 2,
        maximumFractionDigits:
          compact
            ? 1
            : currency === "XOF" ||
                currency === "XAF"
              ? 0
              : 2,
      },
    ).format(amount);
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
  compact = false,
}: {
  value: number;
  metric: MetricDefinition;
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

function createNiceMaximum(
  value: number,
): number {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return 1;
  }

  const magnitude =
    10 **
    Math.floor(
      Math.log10(value),
    );

  const normalized =
    value /
    magnitude;

  const niceNormalized =
    normalized <= 1
      ? 1
      : normalized <= 2
        ? 2
        : normalized <= 5
          ? 5
          : 10;

  return (
    niceNormalized *
    magnitude
  );
}

function buildLinePath(
  points:
    readonly ChartPoint[],
): string {
  if (
    points.length ===
    0
  ) {
    return "";
  }

  return points
    .map(
      (
        point,
        index,
      ) =>
        `${index === 0
          ? "M"
          : "L"} ${point.x.toFixed(
          2,
        )} ${point.y.toFixed(
          2,
        )}`,
    )
    .join(" ");
}

function buildAreaPath({
  points,
  baseline,
}: {
  points:
    readonly ChartPoint[];
  baseline:
    number;
}): string {
  if (
    points.length ===
    0
  ) {
    return "";
  }

  const first =
    points[0];

  const last =
    points[
      points.length -
      1
    ];

  if (
    !first ||
    !last
  ) {
    return "";
  }

  const line =
    buildLinePath(
      points,
    );

  return `${line} L ${last.x.toFixed(
    2,
  )} ${baseline.toFixed(
    2,
  )} L ${first.x.toFixed(
    2,
  )} ${baseline.toFixed(
    2,
  )} Z`;
}

function getVisibleLabelIndexes(
  length: number,
): Set<number> {
  if (
    length <= 6
  ) {
    return new Set(
      Array.from(
        {
          length,
        },
        (
          _,
          index,
        ) =>
          index,
      ),
    );
  }

  const indexes =
    new Set<number>([
      0,
      length -
        1,
    ]);

  const desiredLabels =
    6;

  for (
    let index = 1;
    index <
    desiredLabels -
      1;
    index += 1
  ) {
    indexes.add(
      Math.round(
        (
          index *
          (
            length -
            1
          )
        ) /
          (
            desiredLabels -
            1
          ),
      ),
    );
  }

  return indexes;
}

function EmptyChartState() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.018] px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300">
        <BarChart3 className="h-6 w-6" />
      </div>

      <h3 className="mt-4 text-base font-black text-white">
        Aucune donnée disponible
      </h3>

      <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
        Les performances apparaîtront ici dès que vos campagnes auront généré des visites ou des ventes.
      </p>
    </div>
  );
}

function LoadingChartState() {
  return (
    <div
      aria-label="Chargement du graphique"
      className="min-h-[320px] animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.018] p-5"
    >
      <div className="flex h-full min-h-[280px] items-end gap-3">
        {[
          36,
          58,
          43,
          72,
          51,
          82,
          66,
          91,
          73,
          88,
        ].map(
          (
            height,
            index,
          ) => (
            <div
              key={
                `${height}-${index}`
              }
              className="flex-1 rounded-t-lg bg-white/[0.055]"
              style={{
                height:
                  `${height}%`,
              }}
            />
          ),
        )}
      </div>
    </div>
  );
}

export default function MarketingPerformanceChart({
  data,
  metric:
    controlledMetric,
  groupBy:
    controlledGroupBy,
  currency = "XOF",
  locale = "fr-FR",
  title = "Évolution des performances",
  description =
    "Analysez les résultats marketing sur la période sélectionnée.",
  isLoading = false,
  className,
  onMetricChange,
  onGroupByChange,
}: MarketingPerformanceChartProps) {
  const [
    internalMetric,
    setInternalMetric,
  ] =
    useState<MarketingPerformanceMetric>(
      controlledMetric ??
        "visits",
    );

  const [
    internalGroupBy,
    setInternalGroupBy,
  ] =
    useState<MarketingTimelineGroup>(
      controlledGroupBy ??
        "day",
    );

  const [
    hoveredIndex,
    setHoveredIndex,
  ] =
    useState<number | null>(
      null,
    );

  const selectedMetricKey =
    controlledMetric ??
    internalMetric;

  const selectedGroupBy =
    controlledGroupBy ??
    internalGroupBy;

  const selectedMetric =
    METRICS.find(
      (
        item,
      ) =>
        item.key ===
        selectedMetricKey,
    ) ??
    METRICS[0];

  const normalizedCurrency =
    currency
      .trim()
      .toUpperCase() ||
    "XOF";

  const chart = useMemo(
    () => {
      const normalizedData =
        data.map(
          (
            item,
          ) => ({
            ...item,
            value:
              toSafeNumber(
                item[
                  selectedMetricKey
                ],
              ),
          }),
        );

      const maximumValue =
        normalizedData.reduce(
          (
            maximum,
            item,
          ) =>
            Math.max(
              maximum,
              item.value,
            ),
          0,
        );

      const niceMaximum =
        createNiceMaximum(
          maximumValue,
        );

      const innerWidth =
        SVG_WIDTH -
        CHART_PADDING.left -
        CHART_PADDING.right;

      const innerHeight =
        SVG_HEIGHT -
        CHART_PADDING.top -
        CHART_PADDING.bottom;

      const denominator =
        Math.max(
          normalizedData.length -
            1,
          1,
        );

      const points:
        ChartPoint[] =
        normalizedData.map(
          (
            item,
            index,
          ) => ({
            ...item,

            x:
              CHART_PADDING.left +
              (
                index /
                denominator
              ) *
                innerWidth,

            y:
              CHART_PADDING.top +
              (
                1 -
                item.value /
                  niceMaximum
              ) *
                innerHeight,
          }),
        );

      const gridValues =
        Array.from(
          {
            length: 5,
          },
          (
            _,
            index,
          ) =>
            (
              niceMaximum *
              (
                4 -
                index
              )
            ) /
            4,
        );

      const total =
        normalizedData.reduce(
          (
            sum,
            item,
          ) =>
            sum +
            item.value,
          0,
        );

      const average =
        normalizedData.length >
        0
          ? total /
            normalizedData.length
          : 0;

      const latest =
        normalizedData.at(
          -1,
        )?.value ??
        0;

      const previous =
        normalizedData.at(
          -2,
        )?.value ??
        0;

      const change =
        previous === 0
          ? latest === 0
            ? 0
            : null
          : (
              (
                latest -
                previous
              ) /
              Math.abs(
                previous,
              )
            ) *
            100;

      return {
        points,

        gridValues,

        maximum:
          niceMaximum,

        average,

        latest,

        change,

        linePath:
          buildLinePath(
            points,
          ),

        areaPath:
          buildAreaPath({
            points,

            baseline:
              SVG_HEIGHT -
              CHART_PADDING.bottom,
          }),

        visibleLabels:
          getVisibleLabelIndexes(
            points.length,
          ),
      };
    },
    [
      data,
      selectedMetricKey,
    ],
  );

  const MetricIcon =
    selectedMetric.icon;

  const hoveredPoint =
    hoveredIndex ===
      null
      ? null
      : chart.points[
          hoveredIndex
        ] ??
        null;

  function handleMetricChange(
    value:
      MarketingPerformanceMetric,
  ) {
    if (
      controlledMetric ===
      undefined
    ) {
      setInternalMetric(
        value,
      );
    }

    onMetricChange?.(
      value,
    );

    setHoveredIndex(
      null,
    );
  }

  function handleGroupByChange(
    value:
      MarketingTimelineGroup,
  ) {
    if (
      controlledGroupBy ===
      undefined
    ) {
      setInternalGroupBy(
        value,
      );
    }

    onGroupByChange?.(
      value,
    );

    setHoveredIndex(
      null,
    );
  }

  return (
    <section
      aria-labelledby="marketing-performance-title"
      className={joinClassNames(
        "w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071014] shadow-[0_20px_65px_rgba(0,0,0,0.2)]",
        className,
      )}
    >
      <div className="border-b border-white/[0.07] p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300">
                <MetricIcon className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                  Analyse temporelle
                </p>

                <h2
                  id="marketing-performance-title"
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

          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 sm:min-w-[190px]">
              <span className="sr-only">
                Métrique affichée
              </span>

              <select
                value={
                  selectedMetricKey
                }
                onChange={(
                  event,
                ) => {
                  handleMetricChange(
                    event.target.value as MarketingPerformanceMetric,
                  );
                }}
                className="h-11 w-full appearance-none rounded-xl border border-white/[0.08] bg-[#0a1216] px-3 pr-9 text-sm font-bold text-neutral-200 outline-none focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10"
              >
                {METRICS.map(
                  (
                    item,
                  ) => (
                    <option
                      key={
                        item.key
                      }
                      value={
                        item.key
                      }
                    >
                      {
                        item.label
                      }
                    </option>
                  ),
                )}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            </label>

            <label className="relative min-w-0 sm:min-w-[160px]">
              <span className="sr-only">
                Regroupement temporel
              </span>

              <select
                value={
                  selectedGroupBy
                }
                onChange={(
                  event,
                ) => {
                  handleGroupByChange(
                    event.target.value as MarketingTimelineGroup,
                  );
                }}
                className="h-11 w-full appearance-none rounded-xl border border-white/[0.08] bg-[#0a1216] px-3 pr-9 text-sm font-bold text-neutral-200 outline-none focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10"
              >
                {GROUP_BY_OPTIONS.map(
                  (
                    option,
                  ) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {
                        option.label
                      }
                    </option>
                  ),
                )}
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            </label>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
              Dernière valeur
            </p>

            <p className="mt-1.5 text-lg font-black tracking-[-0.03em] text-white">
              {formatMetricValue({
                value:
                  chart.latest,

                metric:
                  selectedMetric,

                currency:
                  normalizedCurrency,

                locale,
              })}
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
              Moyenne
            </p>

            <p className="mt-1.5 text-lg font-black tracking-[-0.03em] text-white">
              {formatMetricValue({
                value:
                  chart.average,

                metric:
                  selectedMetric,

                currency:
                  normalizedCurrency,

                locale,
              })}
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
              Évolution récente
            </p>

            <p
              className={joinClassNames(
                "mt-1.5 text-lg font-black tracking-[-0.03em]",
                chart.change ===
                  null ||
                chart.change >
                  0
                  ? "text-emerald-300"
                  : chart.change <
                      0
                    ? "text-rose-300"
                    : "text-neutral-300",
              )}
            >
              {chart.change ===
              null
                ? "Nouvelle activité"
                : `${chart.change >
                    0
                    ? "+"
                    : ""}${formatNumber(
                    chart.change,
                    locale,
                    1,
                  )} %`}
            </p>
          </div>
        </div>

        {isLoading ? (
          <LoadingChartState />
        ) : chart.points.length ===
          0 ? (
          <EmptyChartState />
        ) : (
          <div className="relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#050b0e] p-2 sm:p-3">
            <div className="overflow-x-auto">
              <svg
                role="img"
                aria-label={`${selectedMetric.label} selon la période`}
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                className="h-[320px] min-w-[720px] w-full"
                onMouseLeave={() => {
                  setHoveredIndex(
                    null,
                  );
                }}
              >
                <defs>
                  <linearGradient
                    id="marketing-chart-area"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="rgb(52 211 153)"
                      stopOpacity="0.26"
                    />
                    <stop
                      offset="100%"
                      stopColor="rgb(52 211 153)"
                      stopOpacity="0"
                    />
                  </linearGradient>

                  <filter
                    id="marketing-chart-glow"
                    x="-20%"
                    y="-20%"
                    width="140%"
                    height="140%"
                  >
                    <feGaussianBlur
                      stdDeviation="4"
                      result="blur"
                    />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {chart.gridValues.map(
                  (
                    value,
                    index,
                  ) => {
                    const y =
                      CHART_PADDING.top +
                      (
                        index /
                        4
                      ) *
                        (
                          SVG_HEIGHT -
                          CHART_PADDING.top -
                          CHART_PADDING.bottom
                        );

                    return (
                      <g
                        key={
                          `${value}-${index}`
                        }
                      >
                        <line
                          x1={
                            CHART_PADDING.left
                          }
                          y1={
                            y
                          }
                          x2={
                            SVG_WIDTH -
                            CHART_PADDING.right
                          }
                          y2={
                            y
                          }
                          stroke="rgba(255,255,255,0.07)"
                          strokeDasharray="4 7"
                        />

                        <text
                          x={
                            CHART_PADDING.left -
                            12
                          }
                          y={
                            y +
                            4
                          }
                          textAnchor="end"
                          fill="rgb(115 115 115)"
                          fontSize="11"
                          fontWeight="600"
                        >
                          {formatMetricValue({
                            value,

                            metric:
                              selectedMetric,

                            currency:
                              normalizedCurrency,

                            locale,

                            compact:
                              true,
                          })}
                        </text>
                      </g>
                    );
                  },
                )}

                <path
                  d={
                    chart.areaPath
                  }
                  fill="url(#marketing-chart-area)"
                />

                <path
                  d={
                    chart.linePath
                  }
                  fill="none"
                  stroke="rgb(52 211 153)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#marketing-chart-glow)"
                />

                {chart.points.map(
                  (
                    point,
                    index,
                  ) => (
                    <g
                      key={
                        point.key
                      }
                    >
                      <rect
                        x={
                          point.x -
                          18
                        }
                        y={
                          CHART_PADDING.top
                        }
                        width="36"
                        height={
                          SVG_HEIGHT -
                          CHART_PADDING.top -
                          CHART_PADDING.bottom
                        }
                        fill="transparent"
                        onMouseEnter={() => {
                          setHoveredIndex(
                            index,
                          );
                        }}
                      />

                      <circle
                        cx={
                          point.x
                        }
                        cy={
                          point.y
                        }
                        r={
                          hoveredIndex ===
                          index
                            ? 7
                            : 4.5
                        }
                        fill="rgb(5 11 14)"
                        stroke="rgb(52 211 153)"
                        strokeWidth="3"
                        className="transition-all"
                      />

                      {chart.visibleLabels.has(
                        index,
                      ) && (
                        <text
                          x={
                            point.x
                          }
                          y={
                            SVG_HEIGHT -
                            20
                          }
                          textAnchor="middle"
                          fill="rgb(115 115 115)"
                          fontSize="11"
                          fontWeight="600"
                        >
                          {
                            point.label
                          }
                        </text>
                      )}
                    </g>
                  ),
                )}
              </svg>
            </div>

            {hoveredPoint && (
              <div
                className="pointer-events-none absolute z-10 min-w-[180px] rounded-xl border border-white/[0.1] bg-[#0b1519]/95 p-3 shadow-2xl backdrop-blur-xl"
                style={{
                  left:
                    `${Math.min(
                      Math.max(
                        (
                          hoveredPoint.x /
                          SVG_WIDTH
                        ) *
                          100,
                        15,
                      ),
                      85,
                    )}%`,

                  top:
                    `${Math.min(
                      Math.max(
                        (
                          hoveredPoint.y /
                          SVG_HEIGHT
                        ) *
                          100,
                        15,
                      ),
                      72,
                    )}%`,

                  transform:
                    "translate(-50%, -115%)",
                }}
              >
                <div className="flex items-center gap-2 text-[11px] font-bold text-neutral-500">
                  <CalendarDays className="h-3.5 w-3.5 text-emerald-400" />
                  {
                    hoveredPoint.label
                  }
                </div>

                <p className="mt-1.5 text-base font-black text-white">
                  {formatMetricValue({
                    value:
                      hoveredPoint.value,

                    metric:
                      selectedMetric,

                    currency:
                      normalizedCurrency,

                    locale,
                  })}
                </p>

                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  {
                    selectedMetric.label
                  }
                </p>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 border-t border-white/[0.06] pt-4 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Les données sont calculées à partir des visites et commandes attribuées à vos campagnes.
          </span>

          <span className="inline-flex items-center gap-2 whitespace-nowrap font-semibold text-neutral-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {
              selectedMetric.shortLabel
            }
          </span>
        </div>
      </div>
    </section>
  );
}