
"use client";

import { useMemo } from "react";

import {
  BarChart3,
  ChartPie,
  Ticket,
} from "lucide-react";

/* ============================================
   TIKEMIA — GRAPHIQUES DU DASHBOARD

   Fichier :
   src/components/organizer/DashboardCharts.tsx

   Fonctionnalités :
   - Ventes par période
   - Histogramme vert responsive
   - Répartition des ventes
   - Diagramme circulaire
   - Pourcentages automatiques
   - Total réel des billets
   - État de chargement
   - État sans données
   - Français / Anglais
   - Mobile / Tablette / PC

   Les données viennent de l'API.
   Aucun chiffre fictif.
   Aucune bibliothèque externe.
============================================ */

/* ============================================
   TYPES EXPORTÉS
============================================ */

export type DashboardSalesPoint = {
  label: string;
  value: number;
  date?: string;
};

export type DashboardSalesDistribution = {
  category: string;
  value: number;
};

export type DashboardChartsProps = {
  sales: DashboardSalesPoint[];
  distribution: DashboardSalesDistribution[];
  locale?: "fr" | "en";
  loading?: boolean;
  className?: string;
};

/* ============================================
   TRADUCTIONS
============================================ */

const TEXT = {
  fr: {
    salesTitle: "Ventes par période",
    distributionTitle: "Répartition des ventes",
    total: "Total",
    tickets: "billets",
    noSales: "Aucune vente sur cette période.",
    noDistribution:
      "Aucune donnée de répartition disponible.",
    loading: "Chargement des statistiques...",
    salesAxis: "Billets vendus",
    distributionLabel:
      "Répartition des billets vendus par catégorie",
    unknownCategory: "Autres",
  },

  en: {
    salesTitle: "Sales by period",
    distributionTitle: "Sales distribution",
    total: "Total",
    tickets: "tickets",
    noSales: "No sales during this period.",
    noDistribution:
      "No distribution data available.",
    loading: "Loading statistics...",
    salesAxis: "Tickets sold",
    distributionLabel:
      "Distribution of tickets sold by category",
    unknownCategory: "Other",
  },
} as const;

/* ============================================
   COULEURS TIKEMIA
============================================ */

const BAR_COLOR = "#27c91a";
const BAR_COLOR_LIGHT = "#a8ee58";
const GRID_COLOR = "#e5eaf0";
const AXIS_COLOR = "#64748b";

const CATEGORY_COLORS: Record<string, string> = {
  concerts: "#13a817",
  concert: "#13a817",

  festival: "#ffcd00",
  festivals: "#ffcd00",

  conferences: "#ff8500",
  conference: "#ff8500",
  formation: "#ff8500",

  sport: "#ff2638",
  sports: "#ff2638",

  culture: "#8b3fd1",
  soirees: "#ed4b9b",
  tourisme: "#078fa4",
  science: "#2182e9",
  religieux: "#b96b25",
  gastronomie: "#f59e0b",
  business: "#085b43",
  autres: "#64748b",
};

const FALLBACK_COLORS = [
  "#12a817",
  "#ffcd00",
  "#ff8500",
  "#ff2638",
  "#8138cb",
  "#0ba6c2",
  "#f04d91",
  "#006b43",
  "#64748b",
  "#99b629",
];

/* ============================================
   TYPES INTERNES
============================================ */

type NormalizedSalesPoint = {
  label: string;
  value: number;
  date?: string;
};

type NormalizedDistributionItem = {
  category: string;
  value: number;
  color: string;
  percentage: number;
};

type SalesChartSvgProps = {
  data: NormalizedSalesPoint[];
  locale: "fr" | "en";
  width: number;
  height: number;
};

/* ============================================
   UTILITAIRES
============================================ */

function safeNumber(value: number): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return 0;
  }

  return Math.floor(value);
}

function formatNumber(
  value: number,
  locale: "fr" | "en"
): string {
  return new Intl.NumberFormat(
    locale === "fr" ? "fr-FR" : "en-US",
    {
      maximumFractionDigits: 0,
    }
  ).format(safeNumber(value));
}

function formatCompactNumber(
  value: number,
  locale: "fr" | "en"
): string {
  return new Intl.NumberFormat(
    locale === "fr" ? "fr-FR" : "en-US",
    {
      notation: "compact",
      maximumFractionDigits: 1,
    }
  ).format(safeNumber(value));
}

function normalizeCategoryKey(
  category: string
): string {
  return category
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "");
}

function getCategoryColor(
  category: string,
  index: number
): string {
  const key = normalizeCategoryKey(category);

  return (
    CATEGORY_COLORS[key] ??
    FALLBACK_COLORS[
      index % FALLBACK_COLORS.length
    ]
  );
}

function getNiceMaximum(
  highestValue: number
): number {
  if (highestValue <= 0) {
    return 4;
  }

  const roughStep = highestValue / 4;

  const magnitude = Math.pow(
    10,
    Math.floor(Math.log10(roughStep))
  );

  const normalizedStep =
    roughStep / magnitude;

  let niceStep = 1;

  if (normalizedStep > 5) {
    niceStep = 10;
  } else if (normalizedStep > 2) {
    niceStep = 5;
  } else if (normalizedStep > 1) {
    niceStep = 2;
  }

  return (
    Math.max(1, niceStep * magnitude) * 4
  );
}

/* ============================================
   HISTOGRAMME SVG

   Deux tailles :
   - Version mobile
   - Version PC

   Même données et même proportions.
============================================ */

function SalesChartSvg({
  data,
  locale,
  width,
  height,
}: SalesChartSvgProps) {
  const t = TEXT[locale];

  const mobile = width < 500;

  const margin = mobile
    ? {
        top: 14,
        right: 8,
        bottom: 36,
        left: 37,
      }
    : {
        top: 16,
        right: 14,
        bottom: 43,
        left: 57,
      };

  const plotWidth =
    width - margin.left - margin.right;

  const plotHeight =
    height - margin.top - margin.bottom;

  const maximumValue = Math.max(
    0,
    ...data.map((point) => point.value)
  );

  const yMaximum = getNiceMaximum(
    maximumValue
  );

  const rowCount = 4;
  const slotWidth =
    plotWidth / Math.max(1, data.length);

  const barGap = mobile ? 2 : 3;

  const barWidth = Math.max(
    1,
    Math.min(
      mobile ? 18 : 27,
      slotWidth - barGap
    )
  );

  const maxLabels = mobile ? 5 : 9;

  const labelStep = Math.max(
    1,
    Math.ceil(data.length / maxLabels)
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={t.salesTitle}
      className="block h-auto w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient
          id={`tikemia-bars-${width}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop
            offset="0%"
            stopColor={BAR_COLOR}
          />
          <stop
            offset="100%"
            stopColor={BAR_COLOR_LIGHT}
          />
        </linearGradient>
      </defs>

      {/* LIGNES DE LA GRILLE */}

      {Array.from(
        { length: rowCount + 1 },
        (_, index) => {
          const y =
            margin.top +
            (plotHeight / rowCount) * index;

          const value =
            yMaximum -
            (yMaximum / rowCount) * index;

          return (
            <g key={`grid-${index}`}>
              <line
                x1={margin.left}
                y1={y}
                x2={width - margin.right}
                y2={y}
                stroke={GRID_COLOR}
                strokeWidth={1}
              />

              <text
                x={margin.left - 8}
                y={y + 4}
                textAnchor="end"
                fill={AXIS_COLOR}
                fontSize={mobile ? 10 : 13}
              >
                {formatCompactNumber(
                  value,
                  locale
                )}
              </text>
            </g>
          );
        }
      )}

      {/* BARRES */}

      {data.map((point, index) => {
        const normalizedHeight =
          point.value === 0
            ? 0
            : (point.value / yMaximum) *
              plotHeight;

        const centerX =
          margin.left +
          slotWidth * index +
          slotWidth / 2;

        const x = centerX - barWidth / 2;

        const y =
          margin.top +
          plotHeight -
          normalizedHeight;

        const showLabel =
          index % labelStep === 0 ||
          index === data.length - 1;

        return (
          <g key={`${point.date ?? point.label}-${index}`}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={normalizedHeight}
              rx={Math.min(
                3,
                barWidth / 3
              )}
              fill={`url(#tikemia-bars-${width})`}
            >
              <title>
                {point.label} :{" "}
                {formatNumber(
                  point.value,
                  locale
                )}{" "}
                {t.tickets}
              </title>
            </rect>

            {showLabel && (
              <text
                x={centerX}
                y={height - 13}
                textAnchor="middle"
                fill={AXIS_COLOR}
                fontSize={mobile ? 9 : 12}
              >
                {point.label.length >
                (mobile ? 8 : 13)
                  ? `${point.label.slice(
                      0,
                      mobile ? 7 : 12
                    )}…`
                  : point.label}
              </text>
            )}
          </g>
        );
      })}

      {/* LIGNE DE BASE */}

      <line
        x1={margin.left}
        y1={margin.top + plotHeight}
        x2={width - margin.right}
        y2={margin.top + plotHeight}
        stroke="#94a3b8"
        strokeWidth={1}
      />
    </svg>
  );
}

/* ============================================
   ÉTAT SANS DONNÉES
============================================ */

function EmptyChart({
  message,
  icon,
}: {
  message: string;
  icon: "bar" | "pie";
}) {
  return (
    <div className="flex min-h-52 w-full flex-col items-center justify-center gap-3 px-4 py-8 text-center sm:min-h-64">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-green-50">
        {icon === "bar" ? (
          <BarChart3
            size={29}
            className="text-green-700"
            aria-hidden="true"
          />
        ) : (
          <ChartPie
            size={29}
            className="text-green-700"
            aria-hidden="true"
          />
        )}
      </div>

      <p className="text-sm font-medium text-gray-500">
        {message}
      </p>
    </div>
  );
}

/* ============================================
   ÉTAT DE CHARGEMENT
============================================ */

function LoadingChart({
  message,
}: {
  message: string;
}) {
  return (
    <div
      role="status"
      className="flex min-h-64 w-full flex-col items-center justify-center gap-3"
    >
      <div className="size-9 animate-spin rounded-full border-3 border-green-100 border-t-green-700" />

      <span className="text-sm text-gray-500">
        {message}
      </span>
    </div>
  );
}

/* ============================================
   COMPOSANT PRINCIPAL
============================================ */

export default function DashboardCharts({
  sales,
  distribution,
  locale = "fr",
  loading = false,
  className = "",
}: DashboardChartsProps) {
  const t = TEXT[locale];

  /* ==========================================
     DONNÉES DES VENTES

     Les points sont conservés dans
     l'ordre donné par l'API.
  ========================================== */

  const salesData = useMemo(() => {
    if (!Array.isArray(sales)) {
      return [];
    }

    return sales.map((point) => ({
      label: String(point.label ?? ""),
      date: point.date,
      value: safeNumber(point.value),
    }));
  }, [sales]);

  const totalSales = useMemo(
    () =>
      salesData.reduce(
        (sum, point) => sum + point.value,
        0
      ),
    [salesData]
  );

  const hasSales =
    salesData.some(
      (point) => point.value > 0
    );

  /* ==========================================
     RÉPARTITION PAR CATÉGORIE

     Les valeurs sont regroupées par
     catégorie, sans données inventées.
  ========================================== */

  const distributionData = useMemo<
    NormalizedDistributionItem[]
  >(() => {
    if (!Array.isArray(distribution)) {
      return [];
    }

    const grouped = new Map<
      string,
      {
        label: string;
        value: number;
      }
    >();

    for (const item of distribution) {
      const rawCategory =
        typeof item.category === "string"
          ? item.category.trim()
          : "";

      const category =
        rawCategory ||
        TEXT[locale].unknownCategory;

      const key = normalizeCategoryKey(
        category
      );

      const value = safeNumber(
        item.value
      );

      if (value <= 0) {
        continue;
      }

      const existing = grouped.get(key);

      if (existing) {
        existing.value += value;
      } else {
        grouped.set(key, {
          label: category,
          value,
        });
      }
    }

    const items = Array.from(
      grouped.values()
    ).sort(
      (a, b) => b.value - a.value
    );

    const total = items.reduce(
      (sum, item) => sum + item.value,
      0
    );

    if (total <= 0) {
      return [];
    }

    return items.map((item, index) => ({
      category: item.label,
      value: item.value,
      color: getCategoryColor(
        item.label,
        index
      ),
      percentage:
        (item.value / total) * 100,
    }));
  }, [distribution, locale]);

  const totalDistribution = useMemo(
    () =>
      distributionData.reduce(
        (sum, item) => sum + item.value,
        0
      ),
    [distributionData]
  );

  /* ==========================================
     CALCUL DES SEGMENTS CIRCULAIRES

     SVG :
     - Rayon 76
     - Circonférence calculée
     - Début du cercle en haut
  ========================================== */

  const circleRadius = 76;
  const circleCircumference =
    2 * Math.PI * circleRadius;

  const donutSegments = distributionData.map(
    (item, index) => {
      const length =
        (item.percentage / 100) *
        circleCircumference;

      const offset =
        (distributionData.slice(0, index).reduce((sum, previous) => sum + previous.percentage, 0) / 100) *
        circleCircumference;

      return {
        ...item,
        length,
        offset,
      };
    }
  );

  /* ==========================================
     AFFICHAGE
  ========================================== */

  return (
    <div
      className={[
        "grid w-full min-w-0",
        "grid-cols-1 gap-3",
        "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]",
        "lg:gap-4",
        className,
      ].join(" ")}
    >
      {/* ======================================
          GRAPHIQUE DES VENTES
      ====================================== */}

      <section
        aria-labelledby="tikemia-sales-chart-title"
        aria-busy={loading}
        className="flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e4e8ed] bg-white p-3 shadow-sm sm:p-4"
      >
        {/* EN-TÊTE */}

        <div className="flex w-full flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="tikemia-sales-chart-title"
              className="text-base font-extrabold text-[#101828] sm:text-lg"
            >
              {t.salesTitle}
            </h2>

            <div className="mt-2 h-1 w-11 rounded-full bg-linear-to-r from-[#c8fa00] to-[#13aa20]" />
          </div>

          {!loading && hasSales && (
            <div className="inline-flex items-center gap-2 rounded-full bg-[#ecfbe7] px-3 py-2 text-xs font-extrabold text-green-800 sm:text-sm">
              <Ticket
                size={16}
                aria-hidden="true"
              />

              {t.total} :{" "}
              {formatNumber(
                totalSales,
                locale
              )}{" "}
              {t.tickets}
            </div>
          )}
        </div>

        {/* CONTENU */}

        <div className="mt-3 flex min-h-0 w-full min-w-0 flex-1 items-center">
          {loading ? (
            <LoadingChart
              message={t.loading}
            />
          ) : !hasSales ? (
            <EmptyChart
              message={t.noSales}
              icon="bar"
            />
          ) : (
            <div className="w-full min-w-0">
              {/* MOBILE */}

              <div className="block w-full lg:hidden">
                <SalesChartSvg
                  data={salesData}
                  locale={locale}
                  width={390}
                  height={260}
                />
              </div>

              {/* PC */}

              <div className="hidden w-full lg:block">
                <SalesChartSvg
                  data={salesData}
                  locale={locale}
                  width={920}
                  height={340}
                />
              </div>

              {/* TABLEAU ACCESSIBLE */}

              <table className="sr-only">
                <caption>
                  {t.salesTitle}
                </caption>

                <thead>
                  <tr>
                    <th scope="col">
                      {t.salesTitle}
                    </th>

                    <th scope="col">
                      {t.salesAxis}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {salesData.map(
                    (point, index) => (
                      <tr
                        key={`${point.date ?? point.label}-${index}`}
                      >
                        <th scope="row">
                          {point.label}
                        </th>

                        <td>
                          {point.value}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ======================================
          RÉPARTITION DES VENTES
      ====================================== */}

      <section
        aria-labelledby="tikemia-distribution-chart-title"
        aria-busy={loading}
        className="flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e4e8ed] bg-white p-3 shadow-sm sm:p-4"
      >
        {/* EN-TÊTE */}

        <div className="w-full">
          <h2
            id="tikemia-distribution-chart-title"
            className="text-base font-extrabold text-[#101828] sm:text-lg"
          >
            {t.distributionTitle}
          </h2>

          <div className="mt-2 h-1 w-11 rounded-full bg-linear-to-r from-[#c8fa00] to-[#13aa20]" />
        </div>

        {/* CONTENU */}

        <div className="mt-3 flex min-h-0 w-full min-w-0 flex-1 items-center">
          {loading ? (
            <LoadingChart
              message={t.loading}
            />
          ) : distributionData.length === 0 ? (
            <EmptyChart
              message={t.noDistribution}
              icon="pie"
            />
          ) : (
            <div className="flex w-full min-w-0 flex-col items-center justify-center gap-4 py-2 sm:flex-row lg:flex-col xl:flex-row">
              {/* DIAGRAMME CIRCULAIRE */}

              <div className="w-full max-w-55 shrink-0 sm:w-48 lg:w-52 xl:w-[52%]">
                <svg
                  viewBox="0 0 240 240"
                  role="img"
                  aria-label={
                    t.distributionLabel
                  }
                  className="block h-auto w-full"
                >
                  {/* FOND DU CERCLE */}

                  <circle
                    cx="120"
                    cy="120"
                    r={circleRadius}
                    fill="none"
                    stroke="#edf1f3"
                    strokeWidth="30"
                  />

                  {/* SEGMENTS */}

                  {donutSegments.map(
                    (segment, index) => (
                      <circle
                        key={`${segment.category}-${index}`}
                        cx="120"
                        cy="120"
                        r={circleRadius}
                        fill="none"
                        stroke={segment.color}
                        strokeWidth="30"
                        strokeDasharray={`${segment.length} ${circleCircumference}`}
                        strokeDashoffset={
                          -segment.offset
                        }
                        transform="rotate(-90 120 120)"
                      >
                        <title>
                          {segment.category} :{" "}
                          {formatNumber(
                            segment.value,
                            locale
                          )}{" "}
                          {t.tickets} (
                          {segment.percentage.toFixed(
                            1
                          )}
                          %)
                        </title>
                      </circle>
                    )
                  )}

                  {/* CENTRE */}

                  <circle
                    cx="120"
                    cy="120"
                    r="57"
                    fill="white"
                  />

                  <text
                    x="120"
                    y="118"
                    fill="#101828"
                    fontSize="27"
                    fontWeight="800"
                    textAnchor="middle"
                  >
                    {formatCompactNumber(
                      totalDistribution,
                      locale
                    )}
                  </text>

                  <text
                    x="120"
                    y="140"
                    fill="#475569"
                    fontSize="14"
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    {t.tickets}
                  </text>
                </svg>
              </div>

              {/* LÉGENDE */}

              <div className="flex w-full min-w-0 flex-1 flex-col gap-2">
                {distributionData.map(
                  (item, index) => (
                    <div
                      key={`${item.category}-${index}`}
                      className="flex w-full min-w-0 items-center gap-2"
                    >
                      <span
                        aria-hidden="true"
                        className="size-3 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            item.color,
                        }}
                      />

                      <span
                        title={item.category}
                        className="min-w-0 flex-1 truncate text-xs font-semibold text-[#142138] sm:text-sm"
                      >
                        {item.category}
                      </span>

                      <span className="shrink-0 text-xs font-extrabold tabular-nums text-[#101828] sm:text-sm">
                        {new Intl.NumberFormat(
                          locale === "fr"
                            ? "fr-FR"
                            : "en-US",
                          {
                            maximumFractionDigits: 1,
                          }
                        ).format(
                          item.percentage
                        )}{" "}
                        %
                      </span>
                    </div>
                  )
                )}
              </div>

              {/* TABLEAU ACCESSIBLE */}

              <table className="sr-only">
                <caption>
                  {t.distributionTitle}
                </caption>

                <thead>
                  <tr>
                    <th scope="col">
                      {t.distributionTitle}
                    </th>

                    <th scope="col">
                      {t.tickets}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {distributionData.map(
                    (item, index) => (
                      <tr
                        key={`${item.category}-${index}`}
                      >
                        <th scope="row">
                          {item.category}
                        </th>

                        <td>{item.value}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
