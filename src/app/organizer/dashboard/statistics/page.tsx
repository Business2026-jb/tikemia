
"use client";
import {
  currencySymbol,
  SUPPORTED_CURRENCIES,
  currencyLabel,
} from "@/i18n/config";




import Image from "next/image";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import Link from "next/link";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Coins,
  Heart,
  LoaderCircle,
  RefreshCw,
  Ticket,
  Wallet,
} from "lucide-react";

/* ==========================================================
   TIKEMIA — STATISTIQUES ORGANISATEUR

   PAGE :
   /organizer/dashboard/statistics

   API EXISTANTE :
   GET /api/organizer/dashboard

   Aucun menu supplémentaire.
   Aucune donnée fictive.
   Aucun nouveau calcul de commission.

   Affichage :
   - Billets vendus
   - Dons confirmés
   - Chiffre d'affaires brut
   - Commission plateforme 5 %
   - Évolution des revenus
   - Répartition des revenus
   - Performances des événements
   - Performances des cagnottes
   - Filtres par période
   - Actualisation automatique
   - Français / Anglais
   - PC / Mobile
========================================================== */

const DASHBOARD_API = "/api/organizer/dashboard";
const REFRESH_INTERVAL_MS = 30_000;
const TABLE_PAGE_SIZE = 5;

type Locale = "fr" | "en";

type Period =
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "custom";

type JsonRecord = Record<string, unknown>;

type MetricValue = {
  value: string | null;
  change: number | null;
};

type RevenuePoint = {
  date: string;
  amount: string;
};

type EventPerformance = {
  id: string;
  title: string;
  sold: number | null;
  revenue: string | null;
  imageUrl: string | null;
  href: string;
};

type CampaignPerformance = {
  id: string;
  title: string;
  collected: string | null;
  goal: string | null;
  progress: number | null;
  imageUrl: string | null;
  href: string;
};

type StatisticsData = {
  currency: string;
  tickets: MetricValue;
  donations: MetricValue;
  gross: MetricValue;
  commission: MetricValue;
  ticketRevenue: string | null;
  donationRevenue: string | null;
  otherRevenue: string | null;
  evolution: RevenuePoint[];
  events: EventPerformance[];
  campaigns: CampaignPerformance[];
  hasEvolution: boolean;
  hasDistribution: boolean;
  hasEvents: boolean;
  hasCampaigns: boolean;
};

const EMPTY_METRIC: MetricValue = {
  value: null,
  change: null,
};

const EMPTY_DATA: StatisticsData = {
  currency: "XOF",
  tickets: EMPTY_METRIC,
  donations: EMPTY_METRIC,
  gross: EMPTY_METRIC,
  commission: EMPTY_METRIC,
  ticketRevenue: null,
  donationRevenue: null,
  otherRevenue: null,
  evolution: [],
  events: [],
  campaigns: [],
  hasEvolution: false,
  hasDistribution: false,
  hasEvents: false,
  hasCampaigns: false,
};

/* ==========================================================
   TEXTES FR / EN
========================================================== */

const TEXT = {
  fr: {
    title: "Statistiques",
    subtitle:
      "Analysez les performances de vos événements, cagnottes et ventes.",
    period: "Période",
    thisMonth: "Ce mois",
    lastMonth: "Mois précédent",
    thisYear: "Cette année",
    lastYear: "Année précédente",
    custom: "Période personnalisée",
    from: "Du",
    to: "Au",
    tickets: "Ventes de billets",
    donations: "Dons / Cagnottes",
    gross: "Chiffre d'affaires",
    commission: "Frais plateforme (5 %)",
    evolution: "Évolution des revenus",
    distribution: "Répartition des revenus",
    ticketing: "Billetterie",
    fundraisers: "Cagnottes / Dons",
    others: "Autres",
    total: "Total",
    events: "Performances par événement",
    campaigns: "Top cagnottes",
    event: "Événement",
    sales: "Ventes",
    revenue: "Revenus",
    details: "Détails",
    campaign: "Cagnotte",
    collected: "Collecté",
    progress: "Progression",
    view: "Voir",
    emptyEvolution:
      "Aucune série de revenus disponible pour cette période.",
    emptyDistribution:
      "La répartition des revenus n'est pas disponible.",
    emptyEvents:
      "Aucune performance d'événement disponible.",
    emptyCampaigns:
      "Aucune performance de cagnotte disponible.",
    loading: "Chargement des statistiques...",
    error: "Impossible de charger les statistiques.",
    retry: "Réessayer",
    refresh: "Actualiser",
    noData: "Donnée indisponible",
    previous: "Précédent",
    next: "Suivant",
    noComparison: "Comparaison indisponible",
    periodInfo:
      "Les statistiques sont calculées à partir des données réelles transmises par le serveur.",
    incomplete:
      "Certaines données détaillées ne sont pas encore fournies par l'API dashboard.",
    invalidDates: "Veuillez sélectionner une période valide.",
    currency: "Devise",
    noMix:
      "Les revenus de devises différentes ne sont pas additionnés.",
  },
  en: {
    title: "Statistics",
    subtitle:
      "Analyze your events, fundraisers and sales performance.",
    period: "Period",
    thisMonth: "This month",
    lastMonth: "Previous month",
    thisYear: "This year",
    lastYear: "Previous year",
    custom: "Custom period",
    from: "From",
    to: "To",
    tickets: "Tickets sold",
    donations: "Donations / Fundraisers",
    gross: "Gross revenue",
    commission: "Platform fee (5%)",
    evolution: "Revenue evolution",
    distribution: "Revenue distribution",
    ticketing: "Ticketing",
    fundraisers: "Fundraisers / Donations",
    others: "Others",
    total: "Total",
    events: "Event performance",
    campaigns: "Top fundraisers",
    event: "Event",
    sales: "Sales",
    revenue: "Revenue",
    details: "Details",
    campaign: "Fundraiser",
    collected: "Collected",
    progress: "Progress",
    view: "View",
    emptyEvolution:
      "No revenue time series available for this period.",
    emptyDistribution:
      "Revenue distribution is unavailable.",
    emptyEvents:
      "No event performance data available.",
    emptyCampaigns:
      "No fundraiser performance data available.",
    loading: "Loading statistics...",
    error: "Unable to load statistics.",
    retry: "Try again",
    refresh: "Refresh",
    noData: "Unavailable",
    previous: "Previous",
    next: "Next",
    noComparison: "Comparison unavailable",
    periodInfo:
      "Statistics use real data provided by the server.",
    incomplete:
      "Some detailed data is not yet provided by the dashboard API.",
    invalidDates: "Please select a valid date range.",
    currency: "Currency",
    noMix:
      "Revenue in different currencies is not combined.",
  },
} as const;

/* ==========================================================
   LECTURE ET NORMALISATION
========================================================== */

function asObject(value: unknown): JsonRecord {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as JsonRecord;
  }
  return {};
}

function get(
  source: JsonRecord,
  names: readonly string[]
): unknown {
  for (const name of names) {
    if (
      source[name] !== undefined &&
      source[name] !== null
    ) {
      return source[name];
    }
  }
  return undefined;
}

function textValue(
  value: unknown,
  fallback = ""
): string {
  return typeof value === "string"
    ? value
    : fallback;
}

function numberValue(
  value: unknown
): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    /^-?\d+(\.\d+)?$/.test(value.trim())
  ) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function integerValue(
  value: unknown
): string | null {
  if (
    typeof value === "bigint"
  ) {
    return value.toString();
  }

  if (
    typeof value === "number" &&
    Number.isSafeInteger(value)
  ) {
    return String(value);
  }

  if (
    typeof value === "string" &&
    /^-?\d+$/.test(value.trim())
  ) {
    return value.trim();
  }

  return null;
}

function arrayValue(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;

  const obj = asObject(value);

  if (Array.isArray(obj.items)) return obj.items;
  if (Array.isArray(obj.data)) return obj.data;

  return null;
}

function readMetric(
  source: JsonRecord,
  aliases: readonly string[],
  changeAliases: readonly string[] = []
): MetricValue {
  const value = get(source, aliases);
  const nested = asObject(value);

  const rawValue =
    Object.keys(nested).length > 0
      ? get(nested, [
          "value",
          "total",
          "count",
          "amount",
          "gross",
        ])
      : value;

  const nestedChange = get(nested, [
    "change",
    "changePercent",
    "growthPercent",
    "percentageChange",
  ]);

  const change =
    numberValue(nestedChange) ??
    numberValue(get(source, changeAliases));

  return {
    value: integerValue(rawValue),
    change,
  };
}

function readList(
  source: JsonRecord,
  aliases: readonly string[]
): unknown[] | null {
  return arrayValue(get(source, aliases));
}

function readRevenuePoints(
  source: unknown[] | null,
  currency: string
): RevenuePoint[] {
  if (!source) return [];

  const points: RevenuePoint[] = [];

  for (const item of source) {
    const row = asObject(item);

    const itemCurrency = textValue(
      get(row, ["currency"]),
      currency
    ).toUpperCase();

    if (itemCurrency !== currency) continue;

    const date = textValue(
      get(row, ["date", "day", "period", "label", "month"])
    );

    const amount = integerValue(
      get(row, [
        "revenueMinor",
        "amountMinor",
        "revenue",
        "gross",
        "amount",
        "total",
      ])
    );

    if (!date || amount === null) continue;

    points.push({ date, amount });
  }

  return points.sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

function localHref(
  value: unknown,
  fallback: string
): string {
  if (typeof value !== "string") return fallback;

  if (
    value.startsWith("/organizer/dashboard/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
  ) {
    return value;
  }

  return fallback;
}

function normalizeEvents(
  items: unknown[] | null,
  currency: string
): EventPerformance[] {
  if (!items) return [];

  const events: EventPerformance[] = [];

  for (const item of items) {
    const row = asObject(item);

    const rowCurrency = textValue(
      get(row, ["currency"]),
      currency
    ).toUpperCase();

    if (rowCurrency !== currency) continue;

    const id = textValue(get(row, ["id", "eventId"]));
    const title = textValue(
      get(row, ["title", "eventTitle", "name"])
    );

    if (!id || !title) continue;

    events.push({
      id,
      title,
      sold: numberValue(
        get(row, [
          "ticketsSold",
          "soldTickets",
          "sold",
          "salesCount",
          "ticketCount",
        ])
      ),
      revenue: integerValue(
        get(row, [
          "revenueMinor",
          "grossRevenue",
          "revenue",
          "gross",
        ])
      ),
      imageUrl: textValue(
        get(row, ["imageUrl", "thumbnailUrl"]),
        ""
      ) || null,
      href: localHref(
        get(row, ["href", "url"]),
        "/organizer/dashboard/events"
      ),
    });
  }

  return events;
}

function normalizeCampaigns(
  items: unknown[] | null,
  currency: string
): CampaignPerformance[] {
  if (!items) return [];

  const campaigns: CampaignPerformance[] = [];

  for (const item of items) {
    const row = asObject(item);

    const rowCurrency = textValue(
      get(row, ["currency"]),
      currency
    ).toUpperCase();

    if (rowCurrency !== currency) continue;

    const id = textValue(get(row, ["id", "campaignId"]));
    const title = textValue(
      get(row, ["title", "campaignTitle", "name"])
    );

    if (!id || !title) continue;

    const collected = integerValue(
      get(row, [
        "collectedMinor",
        "collectedAmount",
        "amountCollected",
        "collected",
        "totalDonations",
      ])
    );

    const goal = integerValue(
      get(row, ["goalAmount", "targetAmount", "goal"])
    );

    let progress = numberValue(
      get(row, [
        "progress",
        "progressPercent",
        "percentage",
      ])
    );

    if (progress === null && collected && goal) {
      try {
        const target = BigInt(goal);
        const amount = BigInt(collected);

        if (target > 0n) {
          progress = Number(
            (amount * 10000n) / target
          ) / 100;
        }
      } catch {
        progress = null;
      }
    }

    campaigns.push({
      id,
      title,
      collected,
      goal,
      progress,
      imageUrl: textValue(
        get(row, ["imageUrl", "thumbnailUrl"]),
        ""
      ) || null,
      href: localHref(
        get(row, ["href", "url"]),
        "/organizer/dashboard/campaigns"
      ),
    });
  }

  return campaigns;
}

function normalizeStatistics(
  raw: unknown,
  requestedCurrency: string
): StatisticsData {
  const response = asObject(raw);
  const root = Object.keys(asObject(response.data)).length
    ? asObject(response.data)
    : response;

  const summary = asObject(
    get(root, ["summary", "stats", "statistics", "totals"])
  );

  const finance = asObject(
    get(root, ["financials", "finance", "revenueSummary"])
  );

  const combined: JsonRecord = {
    ...root,
    ...summary,
    ...finance,
  };

  const currency = requestedCurrency;

  const tickets = readMetric(
    combined,
    [
      "ticketsSold",
      "soldTickets",
      "ticketSalesCount",
      "totalTicketsSold",
    ],
    ["ticketsGrowthPercent", "ticketsChangePercent"]
  );

  const donations = readMetric(
    combined,
    [
      "donationsCount",
      "confirmedDonations",
      "donationCount",
      "totalDonationsCount",
    ],
    ["donationsGrowthPercent", "donationsChangePercent"]
  );

  const gross = readMetric(
    combined,
    [
      "grossRevenue",
      "totalGross",
      "gross",
      "totalRevenue",
      "totalCollected",
    ],
    ["revenueGrowthPercent", "grossChangePercent"]
  );

  const commission = readMetric(
    combined,
    [
      "platformCommission",
      "commission",
      "platformFee",
      "totalFees",
    ]
  );

  const breakdown = asObject(
    get(root, [
      "revenueBreakdown",
      "distribution",
      "revenueDistribution",
    ])
  );

  const ticketRevenue = integerValue(
    get(
      { ...combined, ...breakdown },
      [
        "ticketRevenue",
        "ticketGross",
        "ticketingRevenue",
      ]
    )
  );

  const donationRevenue = integerValue(
    get(
      { ...combined, ...breakdown },
      [
        "donationRevenue",
        "donationGross",
        "campaignRevenue",
      ]
    )
  );

  const otherRevenue = integerValue(
    get(breakdown, [
      "otherRevenue",
      "others",
      "other",
    ])
  );

  const evolutionSource =
    readList(root, [
      "revenueSeries",
      "revenueEvolution",
      "salesChart",
      "revenueChart",
      "chartData",
    ]) ??
    readList(asObject(root.charts), [
      "revenue",
      "sales",
    ]);

  const eventsSource = readList(root, [
    "eventPerformance",
    "eventsPerformance",
    "topEvents",
    "eventStats",
  ]);

  const campaignsSource = readList(root, [
    "campaignPerformance",
    "campaignsPerformance",
    "topCampaigns",
    "campaignStats",
  ]);

  return {
    currency,
    tickets,
    donations,
    gross,
    commission,
    ticketRevenue,
    donationRevenue,
    otherRevenue,
    evolution: readRevenuePoints(
      evolutionSource,
      currency
    ),
    events: normalizeEvents(eventsSource, currency),
    campaigns: normalizeCampaigns(campaignsSource, currency),
    hasEvolution: evolutionSource !== null,
    hasDistribution:
      ticketRevenue !== null ||
      donationRevenue !== null ||
      otherRevenue !== null,
    hasEvents: eventsSource !== null,
    hasCampaigns: campaignsSource !== null,
  };
}

/* ==========================================================
   MONTANTS EXACTS (UNITÉS MINEURES)
========================================================== */

function toBigInt(value: string | null): bigint | null {
  if (value === null) return null;

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function currencyDecimals(currency: string): number {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

function money(
  value: string | null,
  currency: string,
  locale: Locale
): string {
  const amount = toBigInt(value);

  if (amount === null) return "—";

  const digits = currencyDecimals(currency);
  const factor = 10n ** BigInt(digits);
  const negative = amount < 0n;
  const positive = negative ? -amount : amount;
  const whole = positive / factor;
  const fraction = positive % factor;

  const formatted = new Intl.NumberFormat(
    locale === "fr" ? "fr-FR" : "en-GB"
  ).format(whole);

  const suffix =
    digits > 0
      ? `${locale === "fr" ? "," : "."}${fraction
          .toString()
          .padStart(digits, "0")}`
      : "";

  const symbol = currencySymbol(currency);

  return `${negative ? "−" : ""}${formatted}${suffix} ${symbol}`;
}

function countText(
  value: string | null,
  locale: Locale
): string {
  if (value === null) return "—";

  const parsed = toBigInt(value);
  if (parsed === null) return "—";

  return new Intl.NumberFormat(
    locale === "fr" ? "fr-FR" : "en-GB"
  ).format(parsed);
}

function formatDateLabel(
  value: string,
  locale: Locale
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(
    locale === "fr" ? "fr-FR" : "en-GB",
    { day: "numeric", month: "short" }
  ).format(date);
}

/* ==========================================================
   PÉRIODES
========================================================== */

function inputDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function getPeriodDates(
  period: Period,
  customFrom: string,
  customTo: string
): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (period === "custom") {
    return { from: customFrom, to: customTo };
  }

  let start: Date;
  let end: Date;

  if (period === "this_month") {
    start = new Date(year, month, 1);
    end = now;
  } else if (period === "last_month") {
    start = new Date(year, month - 1, 1);
    end = new Date(year, month, 0);
  } else if (period === "last_year") {
    start = new Date(year - 1, 0, 1);
    end = new Date(year - 1, 11, 31);
  } else {
    start = new Date(year, 0, 1);
    end = now;
  }

  return {
    from: inputDate(start),
    to: inputDate(end),
  };
}

/* ==========================================================
   DESIGN
========================================================== */

const PANEL =
  "min-w-0 overflow-hidden rounded-2xl border border-[#e2e6f0] bg-white shadow-sm";

const SELECT =
  "h-11 w-full min-w-0 rounded-xl border border-[#dce3ed] bg-white px-3 text-sm font-semibold text-[#19233b] outline-none focus:border-[#128c3c] focus:ring-2 focus:ring-green-100";

function StatCard({
  icon,
  title,
  value,
  change,
  tone,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  change: number | null;
  tone: "purple" | "pink" | "green" | "yellow";
}) {
  const colors = {
    purple: "bg-[#f5f0ff] text-[#6623b9]",
    pink: "bg-[#fff0f5] text-[#cf174b]",
    green: "bg-[#edfbef] text-[#07882e]",
    yellow: "bg-[#fff8e5] text-[#a67600]",
  };

  return (
    <div
      className={`flex min-w-0 flex-col justify-center rounded-2xl border border-[#e8e5ef] p-3 shadow-sm sm:p-5 ${colors[tone]}`}
    >
      <div className="flex items-center gap-2">
        <span className="shrink-0">{icon}</span>
        <span className="text-xs font-bold leading-tight text-[#242438] sm:text-sm">
          {title}
        </span>
      </div>

      <div className="mt-3 wrap-break-word text-lg font-extrabold leading-tight text-[#171b32] sm:text-2xl xl:text-[26px]">
        {value}
      </div>

      {change !== null && (
        <div
          className={`mt-2 inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${
            change >= 0
              ? "bg-[#d8f8dd] text-[#087c2c]"
              : "bg-[#ffe1e5] text-[#c32b3b]"
          }`}
        >
          {change >= 0 ? (
            <ArrowUpRight size={14} />
          ) : (
            <ArrowDownRight size={14} />
          )}
          {change > 0 ? "+" : ""}
          {change.toLocaleString("fr-FR", {
            maximumFractionDigits: 1,
          })}
          %
        </div>
      )}
    </div>
  );
}

/* ==========================================================
   GRAPHIQUE DES REVENUS

   SVG responsive sans bibliothèque
   supplémentaire.

   Les points sont exclusivement
   issus de la réponse API.
========================================================== */

function RevenueChart({
  points,
  currency,
  locale,
  emptyLabel,
}: {
  points: RevenuePoint[];
  currency: string;
  locale: Locale;
  emptyLabel: string;
}) {
  const chart = useMemo(() => {
    const width = 740;
    const height = 300;
    const left = 76;
    const right = 20;
    const top = 22;
    const bottom = 48;

    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;

    const values = points.map((point) => {
      const parsed = toBigInt(point.amount);
      return parsed === null || parsed < 0n ? 0n : parsed;
    });

    let maximum = 0n;

    for (const value of values) {
      if (value > maximum) maximum = value;
    }

    if (maximum === 0n) maximum = 1n;

    const coordinates = values.map((value, index) => {
      const x =
        left +
        (values.length <= 1
          ? plotWidth / 2
          : (index / (values.length - 1)) * plotWidth);

      const y =
        top +
        plotHeight -
        Number((value * BigInt(plotHeight * 1000)) / maximum) /
          1000;

      return { x, y };
    });

    const line = coordinates
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
      )
      .join(" ");

    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];

    const area =
      first && last
        ? `${line} L ${last.x} ${top + plotHeight} L ${first.x} ${
            top + plotHeight
          } Z`
        : "";

    return {
      width,
      height,
      left,
      top,
      plotWidth,
      plotHeight,
      maximum,
      coordinates,
      line,
      area,
    };
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="flex min-h-56 items-center justify-center px-5 text-center text-sm text-[#76839a]">
        {emptyLabel}
      </div>
    );
  }

  const labels = [
    0,
    Math.round((points.length - 1) / 4),
    Math.round((points.length - 1) / 2),
    Math.round(((points.length - 1) * 3) / 4),
    points.length - 1,
  ];

  const labelIndexes = [...new Set(labels)];

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        role="img"
        aria-label={locale === "fr" ? "Évolution des revenus" : "Revenue evolution"}
        className="h-auto w-full min-w-75"
      >
        <defs>
          <linearGradient
            id="tikemia-statistics-area"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#1bce39"
              stopOpacity="0.37"
            />
            <stop
              offset="100%"
              stopColor="#1bce39"
              stopOpacity="0.04"
            />
          </linearGradient>
        </defs>

        {Array.from({ length: 5 }, (_, index) => {
          const y =
            chart.top + (index * chart.plotHeight) / 4;

          const value =
            (chart.maximum * BigInt(4 - index)) / 4n;

          return (
            <g key={index}>
              <line
                x1={chart.left}
                y1={y}
                x2={chart.left + chart.plotWidth}
                y2={y}
                stroke="#e7edf1"
                strokeWidth="1"
              />
              <text
                x={chart.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="12"
                fill="#69758c"
              >
                {money(value.toString(), currency, locale)}
              </text>
            </g>
          );
        })}

        <path d={chart.area} fill="url(#tikemia-statistics-area)" />

        <path
          d={chart.line}
          fill="none"
          stroke="#0db932"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {chart.coordinates.map((point, index) => (
          <circle
            key={`${points[index].date}-${index}`}
            cx={point.x}
            cy={point.y}
            r="4.5"
            fill="#fff"
            stroke="#0aac32"
            strokeWidth="2.5"
          >
            <title>
              {`${points[index].date}: ${money(
                points[index].amount,
                currency,
                locale
              )}`}
            </title>
          </circle>
        ))}

        {labelIndexes.map((index) => {
          const point = chart.coordinates[index];

          return (
            <text
              key={`label-${index}`}
              x={point.x}
              y={chart.height - 15}
              textAnchor="middle"
              fontSize="12"
              fill="#58677f"
            >
              {formatDateLabel(points[index].date, locale)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/* ==========================================================
   DIAGRAMME DE RÉPARTITION
========================================================== */

function RevenueDistribution({
  data,
  locale,
}: {
  data: StatisticsData;
  locale: Locale;
}) {
  const t = TEXT[locale];

  const rows = [
    {
      name: t.ticketing,
      value: toBigInt(data.ticketRevenue) ?? 0n,
      color: "#8523ed",
    },
    {
      name: t.fundraisers,
      value: toBigInt(data.donationRevenue) ?? 0n,
      color: "#13be36",
    },
    {
      name: t.others,
      value: toBigInt(data.otherRevenue) ?? 0n,
      color: "#ffbd08",
    },
  ].filter((row) => row.value > 0n);

  const total = rows.reduce(
    (sum, row) => sum + row.value,
    0n
  );

  if (total <= 0n) {
    return (
      <div className="flex min-h-56 items-center justify-center px-5 text-center text-sm text-[#718095]">
        {t.emptyDistribution}
      </div>
    );
  }

  let offset = 0;

  const segments = rows.map((row) => {
    const percent =
      Number((row.value * 10000n) / total) / 100;

    const result = {
      ...row,
      percent,
      start: offset,
      end: offset + percent,
    };

    offset += percent;
    return result;
  });

  const gradient = segments
    .map(
      (segment) =>
        `${segment.color} ${segment.start}% ${segment.end}%`
    )
    .join(", ");

  return (
    <div className="flex flex-col items-center gap-5 p-4 sm:flex-row sm:justify-center sm:p-5">
      <div
        className="relative flex size-44 shrink-0 items-center justify-center rounded-full sm:size-50"
        style={{
          background: `conic-gradient(${gradient})`,
        }}
        role="img"
        aria-label={t.distribution}
      >
        <div className="flex size-[65%] flex-col items-center justify-center rounded-full bg-white px-2 text-center">
          <p className="wrap-break-word text-sm font-extrabold text-[#161b32] sm:text-base">
            {money(
              total.toString(),
              data.currency,
              locale
            )}
          </p>

          <p className="text-xs text-[#64728b]">{t.total}</p>
        </div>
      </div>

      <div className="w-full max-w-56 space-y-3">
        {segments.map((segment) => (
          <div
            key={segment.name}
            className="flex items-center justify-between gap-3 text-xs font-bold sm:text-sm"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{
                  backgroundColor: segment.color,
                }}
              />
              <span className="wrap-break-word">{segment.name}</span>
            </div>

            <span className="shrink-0">
              {segment.percent.toLocaleString(
                locale === "fr" ? "fr-FR" : "en-GB",
                { maximumFractionDigits: 1 }
              )}
              %
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==========================================================
   PAGE PRINCIPALE
========================================================== */

export default function OrganizerStatisticsPage() {
  const [locale, setLocale] = useState<Locale>("fr");
  const [period, setPeriod] = useState<Period>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [currency, setCurrency] = useState("XOF");

  const [data, setData] = useState<StatisticsData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [eventPage, setEventPage] = useState(1);
  const [campaignPage, setCampaignPage] = useState(1);

  const requestSequence = useRef(0);
  const t = TEXT[locale];

  /* ========================================================
     LANGUE
  ======================================================== */

  useEffect(() => {
    function updateLocale() {
      try {
        const saved = localStorage.getItem("tikemia_locale");

        setLocale(saved === "en" ? "en" : "fr");
      } catch {
        setLocale("fr");
      }
    }

    updateLocale();

    window.addEventListener("storage", updateLocale);
    window.addEventListener(
      "tikemia:locale-changed",
      updateLocale
    );

    return () => {
      window.removeEventListener("storage", updateLocale);
      window.removeEventListener(
        "tikemia:locale-changed",
        updateLocale
      );
    };
  }, []);

  /* ========================================================
     DATES
  ======================================================== */

  const dates = useMemo(
    () => getPeriodDates(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  const datesValid =
    dates.from.length === 10 &&
    dates.to.length === 10 &&
    dates.from <= dates.to;

  const query = useMemo(() => {
    const params = new URLSearchParams({
      view: "statistics",
      period: "custom",
      startDate: dates.from,
      endDate: dates.to,
      currency,
      locale,
    });

    return params.toString();
  }, [
    dates.from,
    dates.to,
    currency,
    locale,
  ]);

  /* ========================================================
     CHARGEMENT DEPUIS L'API EXISTANTE
  ======================================================== */

  const loadStatistics = useCallback(
    async (
      signal?: AbortSignal,
      silent = false
    ) => {
      if (!datesValid) {
        setError(TEXT[locale].invalidDates);
        setLoading(false);
        return;
      }

      const requestId = ++requestSequence.current;

      if (silent) setRefreshing(true);
      else setLoading(true);

      try {
        const response = await fetch(
          `${DASHBOARD_API}?${query}`,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            signal,
          }
        );

        let result: unknown;

        try {
          result = await response.json();
        } catch {
          throw new Error(TEXT[locale].error);
        }

        const payload = asObject(result);

        if (!response.ok || payload.success === false) {
          throw new Error(
            textValue(payload.message, TEXT[locale].error)
          );
        }

        if (
          signal?.aborted ||
          requestId !== requestSequence.current
        ) {
          return;
        }

        setData(normalizeStatistics(result, currency));
        setError("");
      } catch (caught) {
        if (
          signal?.aborted ||
          requestId !== requestSequence.current
        ) {
          return;
        }

        setError(
          caught instanceof Error
            ? caught.message
            : TEXT[locale].error
        );
      } finally {
        if (
          !signal?.aborted &&
          requestId === requestSequence.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [query, currency, locale, datesValid]
  );

  useEffect(() => {
    const controller = new AbortController();

    queueMicrotask(() => { if (!controller.signal.aborted) void loadStatistics(controller.signal); });

    return () => controller.abort();
  }, [loadStatistics]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void loadStatistics(undefined, true);
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [loadStatistics]);

  useEffect(() => {
    function refreshOnFocus() {
      void loadStatistics(undefined, true);
    }

    window.addEventListener("focus", refreshOnFocus);

    return () =>
      window.removeEventListener("focus", refreshOnFocus);
  }, [loadStatistics]);

  function updateFilters(callback: () => void) {
    callback();
    setEventPage(1);
    setCampaignPage(1);
  }

  /* ========================================================
     TABLEAUX
  ======================================================== */

  const sortedEvents = useMemo(() => {
    return [...data.events].sort((a, b) => {
      const aRevenue = toBigInt(a.revenue) ?? 0n;
      const bRevenue = toBigInt(b.revenue) ?? 0n;

      if (aRevenue > bRevenue) return -1;
      if (aRevenue < bRevenue) return 1;
      return a.title.localeCompare(b.title);
    });
  }, [data.events]);

  const sortedCampaigns = useMemo(() => {
    return [...data.campaigns].sort((a, b) => {
      const aCollected = toBigInt(a.collected) ?? 0n;
      const bCollected = toBigInt(b.collected) ?? 0n;

      if (aCollected > bCollected) return -1;
      if (aCollected < bCollected) return 1;
      return a.title.localeCompare(b.title);
    });
  }, [data.campaigns]);

  const eventsPages = Math.max(
    1,
    Math.ceil(sortedEvents.length / TABLE_PAGE_SIZE)
  );

  const campaignsPages = Math.max(
    1,
    Math.ceil(sortedCampaigns.length / TABLE_PAGE_SIZE)
  );

  const safeEventPage = Math.min(eventPage, eventsPages);
  const safeCampaignPage = Math.min(campaignPage, campaignsPages);

  const visibleEvents = sortedEvents.slice(
    (safeEventPage - 1) * TABLE_PAGE_SIZE,
    safeEventPage * TABLE_PAGE_SIZE
  );

  const visibleCampaigns = sortedCampaigns.slice(
    (safeCampaignPage - 1) * TABLE_PAGE_SIZE,
    safeCampaignPage * TABLE_PAGE_SIZE
  );



  /* ========================================================
     RENDU
  ======================================================== */

  return (
    <main className="min-h-full w-full min-w-0 overflow-x-hidden bg-[#f7f9fc] pb-2 text-[#17213b]">
      {/* EN-TÊTE */}

      <header className="border-b border-[#e5eaf0] bg-white px-3 py-5 sm:px-5 lg:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <ChartNoAxesColumnIncreasing
              size={36}
              className="shrink-0 text-[#078b30]"
            />

            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                {t.title}
              </h1>

              <p className="mt-1 text-xs text-[#53617b] sm:text-sm">
                {t.subtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:w-52">
              <CalendarDays
                size={18}
                className="pointer-events-none absolute top-3.5 left-3 text-[#53647b]"
              />

              <select
                aria-label={t.period}
                value={period}
                onChange={(event) =>
                  updateFilters(() =>
                    setPeriod(event.target.value as Period)
                  )
                }
                className={`${SELECT} pl-10`}
              >
                <option value="this_month">{t.thisMonth}</option>
                <option value="last_month">{t.lastMonth}</option>
                <option value="this_year">{t.thisYear}</option>
                <option value="last_year">{t.lastYear}</option>
                <option value="custom">{t.custom}</option>
              </select>
            </div>

            <select
              aria-label={t.currency}
              value={currency}
              onChange={(event) =>
                updateFilters(() =>
                  setCurrency(event.target.value)
                )
              }
              className={`${SELECT} sm:w-32`}
            >
              {SUPPORTED_CURRENCIES.map(code => <option key={code} value={code}>{currencyLabel(code, locale)}</option>)}
              
              
              
              
              
              
            </select>

            <button
              type="button"
              onClick={() => void loadStatistics(undefined, true)}
              disabled={refreshing}
              aria-label={t.refresh}
              title={t.refresh}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#dce3ed] bg-white px-4 text-sm font-bold text-[#465a74] disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={refreshing ? "animate-spin" : ""}
              />
              <span className="sm:hidden">{t.refresh}</span>
            </button>
          </div>
        </div>

        {period === "custom" && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-bold">
                {t.from}
              </span>
              <input
                type="date"
                value={customFrom}
                onChange={(event) =>
                  updateFilters(() =>
                    setCustomFrom(event.target.value)
                  )
                }
                className={SELECT}
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-bold">
                {t.to}
              </span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(event) =>
                  updateFilters(() =>
                    setCustomTo(event.target.value)
                  )
                }
                className={SELECT}
              />
            </label>
          </div>
        )}

        <div className="mt-4 h-1 rounded-full bg-linear-to-r from-[#087e30] via-[#ffce13] to-[#e72231]" />
      </header>

      <div className="flex min-w-0 flex-col gap-4 p-3 sm:p-5 lg:gap-5 lg:p-6">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
          >
            <CircleAlert size={20} className="shrink-0" />

            <p className="min-w-0 flex-1">{error}</p>

            <button
              type="button"
              onClick={() => void loadStatistics(undefined, true)}
              className="shrink-0 underline"
            >
              {t.retry}
            </button>
          </div>
        )}

        {loading && (
          <div
            role="status"
            className="flex min-h-40 items-center justify-center gap-3 rounded-xl border border-[#e1e7ec] bg-white p-4 text-sm font-semibold text-[#60718a]"
          >
            <LoaderCircle
              size={24}
              className="animate-spin text-[#07842e]"
            />
            {t.loading}
          </div>
        )}

        {!loading && (
          <>
            {/* 4 INDICATEURS */}

            <section className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
              <StatCard
                icon={<Ticket size={27} />}
                title={t.tickets}
                value={countText(data.tickets.value, locale)}
                change={data.tickets.change}
                tone="purple"
              />

              <StatCard
                icon={<Heart size={27} />}
                title={t.donations}
                value={countText(data.donations.value, locale)}
                change={data.donations.change}
                tone="pink"
              />

              <StatCard
                icon={<Coins size={27} />}
                title={t.gross}
                value={money(
                  data.gross.value,
                  data.currency,
                  locale
                )}
                change={data.gross.change}
                tone="green"
              />

              <StatCard
                icon={<Wallet size={27} />}
                title={t.commission}
                value={money(
                  data.commission.value,
                  data.currency,
                  locale
                )}
                change={data.commission.change}
                tone="yellow"
              />
            </section>

            {/* GRAPHIQUES */}

            <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
              <div className={PANEL}>
                <div className="flex items-center gap-2 border-b border-[#e9edf2] p-4 sm:p-5">
                  <Activity
                    size={22}
                    className="text-[#6225b9]"
                  />
                  <h2 className="text-base font-extrabold sm:text-lg">
                    {t.evolution}
                  </h2>
                </div>

                <div className="p-2 sm:p-3">
                  <RevenueChart
                    points={data.evolution}
                    currency={data.currency}
                    locale={locale}
                    emptyLabel={t.emptyEvolution}
                  />
                </div>
              </div>

              <div className={PANEL}>
                <div className="flex items-center gap-2 border-b border-[#e9edf2] p-4 sm:p-5">
                  <ChartNoAxesColumnIncreasing
                    size={22}
                    className="text-[#7020dc]"
                  />
                  <h2 className="text-base font-extrabold sm:text-lg">
                    {t.distribution}
                  </h2>
                </div>

                <RevenueDistribution
                  data={data}
                  locale={locale}
                />
              </div>
            </section>

            {/* TABLEAUX */}

            <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
              {/* PERFORMANCES ÉVÉNEMENTS */}

              <div className={PANEL}>
                <div className="flex items-center gap-2 border-b border-[#e9edf2] p-4">
                  <CalendarDays
                    size={22}
                    className="text-[#6625cd]"
                  />
                  <h2 className="text-base font-extrabold sm:text-lg">
                    {t.events}
                  </h2>
                </div>

                {visibleEvents.length > 0 ? (
                  <div className="w-full overflow-x-auto">
                    <table className="w-full min-w-115 border-collapse text-left">
                      <thead className="bg-[#f4f5fa] text-xs text-[#526078]">
                        <tr>
                          <th className="px-3 py-3">{t.event}</th>
                          <th className="px-3 py-3">{t.sales}</th>
                          <th className="px-3 py-3">{t.revenue}</th>
                          <th className="px-3 py-3">{t.details}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleEvents.map((event) => (
                          <tr
                            key={event.id}
                            className="border-t border-[#edf0f4] text-xs"
                          >
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#eef2f5] text-[#718095]">
                                  {event.imageUrl ? (
                                    <Image
                                      width={48} height={48} unoptimized src={event.imageUrl}
                                      alt=""
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <Ticket size={20} />
                                  )}
                                </span>
                                <span className="font-bold">
                                  {event.title}
                                </span>
                              </div>
                            </td>

                            <td className="px-3 py-3 font-bold">
                              {event.sold === null
                                ? "—"
                                : event.sold.toLocaleString(locale)}
                            </td>

                            <td className="whitespace-nowrap px-3 py-3 font-extrabold text-[#078b32]">
                              {money(
                                event.revenue,
                                data.currency,
                                locale
                              )}
                            </td>

                            <td className="px-3 py-3">
                              <Link
                                href={event.href}
                                className="inline-flex items-center gap-1 rounded-full border border-[#ceb0f4] bg-[#faf7ff] px-3 py-1.5 font-bold text-[#5723a6]"
                              >
                                {t.view}
                                <ArrowUpRight size={14} />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-4 py-12 text-center text-sm text-[#748197]">
                    {t.emptyEvents}
                  </div>
                )}

                {eventsPages > 1 && (
                  <div className="flex items-center justify-end gap-2 border-t border-[#edf0f4] p-3">
                    <button
                      type="button"
                      disabled={safeEventPage <= 1}
                      onClick={() =>
                        setEventPage((p) => Math.max(1, p - 1))
                      }
                      aria-label={t.previous}
                      className="rounded-lg border p-2 disabled:opacity-40"
                    >
                      <ChevronLeft size={17} />
                    </button>

                    <span className="text-xs font-bold">
                      {safeEventPage} / {eventsPages}
                    </span>

                    <button
                      type="button"
                      disabled={safeEventPage >= eventsPages}
                      onClick={() =>
                        setEventPage((p) =>
                          Math.min(eventsPages, p + 1)
                        )
                      }
                      aria-label={t.next}
                      className="rounded-lg border p-2 disabled:opacity-40"
                    >
                      <ChevronRight size={17} />
                    </button>
                  </div>
                )}
              </div>

              {/* TOP CAGNOTTES */}

              <div className={PANEL}>
                <div className="flex items-center gap-2 border-b border-[#e9edf2] p-4">
                  <Heart
                    size={22}
                    className="text-[#a21bda]"
                  />

                  <h2 className="text-base font-extrabold sm:text-lg">
                    {t.campaigns}
                  </h2>
                </div>

                {visibleCampaigns.length > 0 ? (
                  <div className="w-full overflow-x-auto">
                    <table className="w-full min-w-110 border-collapse text-left">
                      <thead className="bg-[#f4f5fa] text-xs text-[#526078]">
                        <tr>
                          <th className="px-3 py-3">
                            {t.campaign}
                          </th>
                          <th className="px-3 py-3">
                            {t.collected}
                          </th>
                          <th className="px-3 py-3">
                            {t.progress}
                          </th>
                          <th className="px-3 py-3">
                            {t.details}
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {visibleCampaigns.map((campaign) => {
                          const percent = campaign.progress;

                          return (
                            <tr
                              key={campaign.id}
                              className="border-t border-[#edf0f4] text-xs"
                            >
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#fff0f6] text-[#ce2867]">
                                    {campaign.imageUrl ? (
                                      <Image
                                        width={48} height={48} unoptimized src={campaign.imageUrl}
                                        alt=""
                                        loading="lazy"
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <Heart size={20} />
                                    )}
                                  </span>

                                  <span className="font-bold">
                                    {campaign.title}
                                  </span>
                                </div>
                              </td>

                              <td className="whitespace-nowrap px-3 py-3 font-extrabold text-[#078b32]">
                                {money(
                                  campaign.collected,
                                  data.currency,
                                  locale
                                )}
                              </td>

                              <td className="px-3 py-3">
                                {percent === null ? (
                                  "—"
                                ) : (
                                  <div className="flex min-w-28 items-center gap-2">
                                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e7e9f2]">
                                      <div
                                        className="h-full rounded-full bg-[#16b72e]"
                                        style={{
                                          width: `${Math.min(
                                            100,
                                            Math.max(0, percent)
                                          )}%`,
                                        }}
                                      />
                                    </div>

                                    <span className="font-bold">
                                      {percent.toLocaleString(
                                        locale === "fr"
                                          ? "fr-FR"
                                          : "en-GB",
                                        {
                                          maximumFractionDigits: 1,
                                        }
                                      )}
                                      %
                                    </span>
                                  </div>
                                )}
                              </td>

                              <td className="px-3 py-3">
                                <Link
                                  href={campaign.href}
                                  className="inline-flex items-center gap-1 rounded-full border border-[#ceb0f4] bg-[#faf7ff] px-3 py-1.5 font-bold text-[#5723a6]"
                                >
                                  {t.view}
                                  <ArrowUpRight size={14} />
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-4 py-12 text-center text-sm text-[#748197]">
                    {t.emptyCampaigns}
                  </div>
                )}

                {campaignsPages > 1 && (
                  <div className="flex items-center justify-end gap-2 border-t border-[#edf0f4] p-3">
                    <button
                      type="button"
                      disabled={safeCampaignPage <= 1}
                      onClick={() =>
                        setCampaignPage((p) => Math.max(1, p - 1))
                      }
                      aria-label={t.previous}
                      className="rounded-lg border p-2 disabled:opacity-40"
                    >
                      <ChevronLeft size={17} />
                    </button>

                    <span className="text-xs font-bold">
                      {safeCampaignPage} / {campaignsPages}
                    </span>

                    <button
                      type="button"
                      disabled={safeCampaignPage >= campaignsPages}
                      onClick={() =>
                        setCampaignPage((p) =>
                          Math.min(campaignsPages, p + 1)
                        )
                      }
                      aria-label={t.next}
                      className="rounded-lg border p-2 disabled:opacity-40"
                    >
                      <ChevronRight size={17} />
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* INFORMATION DISCRÈTE */}


          </>
        )}
      </div>
    </main>
  );
}
