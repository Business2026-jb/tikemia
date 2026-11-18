
"use client";
import {
  currencySymbol,
  SUPPORTED_CURRENCIES,
  currencyLabel,
  currencyDecimals,
} from "@/i18n/config";





import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowDownUp,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Coins,
  Eye,
  Heart,
  Info,
  LoaderCircle,
  RefreshCw,
  Search,
  Ticket,
  Wallet,
  X,
} from "lucide-react";

/* ==========================================================
   TIKEMIA — PAGE VENTES ORGANISATEUR

   Route :
   /organizer/dashboard/sales

   Source :
   GET /api/organizer/dashboard

   Affichage :
   - Total brut
   - Commission globale 5 %
   - Montant net
   - Nombre de transactions
   - Billets et dons confirmés
   - Périodes et filtres
   - Tableau PC / cartes mobile

   Aucune commission détaillée sur
   chaque ligne de vente.

   Le layout existant du dashboard
   gère les menus PC et mobile.
========================================================== */

const DASHBOARD_API = "/api/organizer/dashboard";

const PAGE_SIZE = 10;
const REFRESH_INTERVAL = 30_000;
const PLATFORM_FEE_BPS = 500;

type Locale = "fr" | "en";
type Period =
  | "month"
  | "previous_month"
  | "year"
  | "previous_year"
  | "custom";

type SaleType = "ticket" | "donation";
type SaleFilter = "all" | SaleType;
type StatusFilter = "all" | "paid" | "other";
type SortMode = "newest" | "oldest" | "amount_desc" | "amount_asc";

type JsonObject = Record<string, unknown>;

type Sale = {
  id: string;
  reference: string;
  type: SaleType;
  title: string;
  person: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  subtitle: string;
};

type Summary = {
  gross: number | null;
  fee: number | null;
  net: number | null;
  count: number | null;
  currency: string;
};

type SalesData = {
  summary: Summary;
  items: Sale[];
  totalItems: number | null;
  sourceHasTransactions: boolean;
  sourceHasSummary: boolean;
};

const EMPTY_DATA: SalesData = {
  summary: {
    gross: null,
    fee: null,
    net: null,
    count: null,
    currency: "XOF",
  },
  items: [],
  totalItems: null,
  sourceHasTransactions: false,
  sourceHasSummary: false,
};

const DICTIONARY = {
  fr: {
    title: "Ventes",
    subtitle:
      "Consultez les ventes de billets et les dons reçus.",
    gross: "Total brut encaissé",
    commission: "Commission TIKEMIA (5 %)",
    net: "Montant net",
    transactions: "Transactions",
    feeInfo:
      "TIKEMIA prélève 5 % sur les ventes de billets et les dons confirmés.",
    withdrawal: "Retraits",
    refresh: "Actualiser",
    period: "Période",
    month: "Ce mois",
    previousMonth: "Mois précédent",
    year: "Cette année",
    previousYear: "Année précédente",
    custom: "Période personnalisée",
    start: "Du",
    end: "Au",
    apply: "Appliquer",
    type: "Type de vente",
    allTypes: "Toutes les ventes",
    ticket: "Billet",
    donation: "Don / Cagnotte",
    status: "Statut",
    allStatuses: "Tous les statuts",
    paid: "Payé",
    other: "Autres statuts",
    sort: "Tri",
    newest: "Date (plus récente)",
    oldest: "Date (plus ancienne)",
    highest: "Montant (décroissant)",
    lowest: "Montant (croissant)",
    titleColumn: "Événement / Cagnotte",
    person: "Acheteur / Donateur",
    date: "Date et heure",
    amount: "Montant brut",
    actions: "Actions",
    detail: "Voir les détails",
    close: "Fermer",
    reference: "Référence",
    search: "Rechercher une vente...",
    loading: "Chargement des ventes...",
    noSales: "Aucune vente pour les filtres sélectionnés.",
    missingSales:
      "Aucune vente disponible.",
    missingSummary:
      "Aucune donnee disponible.",
    error: "Impossible de récupérer les ventes.",
    retry: "Réessayer",
    page: "Page",
    of: "sur",
    total: "ventes",
    notAvailable: "—",
    allCurrencies:
      "Les montants ne doivent pas être additionnés entre devises différentes.",
    invalidDates: "Vérifiez les dates sélectionnées.",
  },
  en: {
    title: "Sales",
    subtitle:
      "View ticket sales and confirmed donations.",
    gross: "Total gross collected",
    commission: "TIKEMIA fee (5%)",
    net: "Net amount",
    transactions: "Transactions",
    feeInfo:
      "TIKEMIA charges 5% on confirmed ticket sales and donations.",
    withdrawal: "Withdrawals",
    refresh: "Refresh",
    period: "Period",
    month: "This month",
    previousMonth: "Previous month",
    year: "This year",
    previousYear: "Previous year",
    custom: "Custom period",
    start: "From",
    end: "To",
    apply: "Apply",
    type: "Sale type",
    allTypes: "All sales",
    ticket: "Ticket",
    donation: "Donation / Fundraiser",
    status: "Status",
    allStatuses: "All statuses",
    paid: "Paid",
    other: "Other statuses",
    sort: "Sort",
    newest: "Date (newest)",
    oldest: "Date (oldest)",
    highest: "Amount (highest)",
    lowest: "Amount (lowest)",
    titleColumn: "Event / Fundraiser",
    person: "Buyer / Donor",
    date: "Date and time",
    amount: "Gross amount",
    actions: "Actions",
    detail: "View details",
    close: "Close",
    reference: "Reference",
    search: "Search sales...",
    loading: "Loading sales...",
    noSales: "No sales match the selected filters.",
    missingSales:
      "No sales available.",
    missingSummary:
      "No data available.",
    error: "Unable to load sales.",
    retry: "Try again",
    page: "Page",
    of: "of",
    total: "sales",
    notAvailable: "—",
    allCurrencies:
      "Amounts in different currencies must not be added together.",
    invalidDates: "Please check the selected dates.",
  },
} as const;

/* ==========================================================
   NORMALISATION DE LA RÉPONSE API

   Les données viennent exclusivement
   du serveur existant.

   Les alias ci-dessous permettent de lire
   plusieurs conventions de nommage.

   Aucune valeur financière n'est inventée.
========================================================== */

function obj(value: unknown): JsonObject {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function pick(
  source: JsonObject,
  keys: readonly string[]
): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      return source[key];
    }
  }
  return undefined;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (
    typeof value === "string" &&
    /^-?\d+(?:\.\d+)?$/.test(value.trim())
  ) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function unwrap(raw: JsonObject): JsonObject {
  const data = obj(raw.data);
  return Object.keys(data).length > 0 ? data : raw;
}

function detectSaleType(raw: JsonObject): SaleType | null {
  const type = str(
    pick(raw, [
      "type",
      "saleType",
      "kind",
      "purpose",
      "paymentPurpose",
      "transactionType",
    ])
  ).toUpperCase();

  if (
    type.includes("DONATION") ||
    type.includes("CAMPAIGN") ||
    type === "DON" ||
    type === "FUNDRAISER"
  ) {
    return "donation";
  }

  if (
    type.includes("TICKET") ||
    type.includes("ORDER") ||
    type.includes("BILLET") ||
    type === "SALE"
  ) {
    return "ticket";
  }

  if (raw.campaignId || raw.donationId) return "donation";
  if (raw.eventId || raw.orderId) return "ticket";

  return null;
}

function normalizeSale(
  value: unknown,
  fallbackCurrency: string
): Sale | null {
  const raw = obj(value);
  const type = detectSaleType(raw);

  if (!type) return null;

  const id = str(
    pick(raw, [
      "id",
      "transactionId",
      "orderId",
      "donationId",
      "reference",
    ])
  );

  if (!id) return null;

  const amount = num(
    pick(raw, [
      "grossAmount",
      "amount",
      "subtotal",
      "totalAmount",
      "total",
    ])
  );

  if (amount === null || amount < 0) return null;

  const date = str(
    pick(raw, [
      "confirmedAt",
      "paidAt",
      "date",
      "createdAt",
      "timestamp",
    ])
  );

  const status = str(
    pick(raw, ["status", "paymentStatus", "state"]),
    "CONFIRMED"
  );

  const title = str(
    pick(raw, [
      "eventTitle",
      "campaignTitle",
      "title",
      "eventName",
      "campaignName",
    ])
  );

  const person = str(
    pick(raw, [
      "buyerName",
      "donorName",
      "customerName",
      "participantName",
      "fullName",
    ])
  );

  const reference = str(
    pick(raw, ["reference", "orderReference", "paymentReference"]),
    id
  );

  return {
    id,
    reference,
    type,
    title,
    person,
    date,
    amount,
    currency: str(raw.currency, fallbackCurrency).toUpperCase(),
    status,
    subtitle: str(
      pick(raw, ["categoryName", "category", "description", "city"])
    ),
  };
}

function normalizeDashboard(
  response: JsonObject,
  requestedCurrency: string
): SalesData {
  const root = unwrap(response);

  const stats = obj(
    pick(root, [
      "summary",
      "stats",
      "statistics",
      "totals",
      "financials",
    ])
  );

  const financial = {
    ...root,
    ...stats,
  };

  const gross = num(
    pick(financial, [
      "gross",
      "grossAmount",
      "totalGross",
      "grossRevenue",
      "totalRevenue",
      "totalCollected",
      "totalGrossCollected",
    ])
  );

  const explicitFee = num(
    pick(financial, [
      "platformCommission",
      "commission",
      "platformFee",
      "platformFees",
      "totalFees",
      "serviceFees",
    ])
  );

  const explicitNet = num(
    pick(financial, [
      "net",
      "netAmount",
      "totalNet",
      "netRevenue",
      "netAvailable",
      "availableAmount",
    ])
  );

  const count = num(
    pick(financial, [
      "transactionCount",
      "transactionsCount",
      "totalTransactions",
      "salesCount",
      "count",
    ])
  );

  const currency = str(
    pick(financial, ["currency", "displayCurrency"]),
    requestedCurrency
  ).toUpperCase();

  // Calcul sur le TOTAL uniquement, jamais sur chaque ligne.
  // Les montants explicites du serveur sont prioritaires.
  const fee =
    explicitFee ??
    (gross !== null
      ? Math.round((gross * PLATFORM_FEE_BPS) / 10_000)
      : null);

  const net =
    explicitNet ??
    (gross !== null && fee !== null ? gross - fee : null);

  const rawItems = pick(root, [
    "transactions",
    "sales",
    "recentSales",
    "salesHistory",
    "recentTransactions",
    "items",
  ]);

  const transactionContainer = obj(rawItems);
  const values = Array.isArray(rawItems)
    ? rawItems
    : Array.isArray(transactionContainer.items)
      ? transactionContainer.items
      : Array.isArray(transactionContainer.data)
        ? transactionContainer.data
        : null;

  const items = (values ?? [])
    .map((item) => normalizeSale(item, currency))
    .filter((item): item is Sale => item !== null);

  const pagination = obj(root.pagination);

  const totalItems =
    num(pick(pagination, ["total", "totalItems", "count"])) ??
    num(pick(root, ["totalSales", "totalItems"])) ??
    (values ? items.length : null);

  return {
    summary: {
      gross,
      fee,
      net,
      count,
      currency,
    },
    items,
    totalItems,
    sourceHasTransactions: values !== null,
    sourceHasSummary: gross !== null,
  };
}

/* ==========================================================
   FORMATAGE
========================================================== */

function formatAmount(
  amount: number | null,
  currency: string,
  locale: Locale
): string {
  if (amount === null) return "—";

  try {
    return new Intl.NumberFormat(
      locale === "fr" ? "fr-FR" : "en-GB",
      {
        style: "currency",
        currency,
        maximumFractionDigits:
          currencyDecimals(currency),
      }
    ).formatToParts(amount / 10 ** currencyDecimals(currency)).map(part => part.type === "currency" ? currencySymbol(currency) : part.value).join("");
  } catch {
    return `${amount.toLocaleString(locale)} ${currency}`;
  }
}

function formatDate(value: string, locale: Locale): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(
    locale === "fr" ? "fr-FR" : "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);
}

function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function periodDates(period: Period, from: string, to: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (period === "custom") return { from, to };

  let first: Date;
  let last: Date;

  if (period === "month") {
    first = new Date(year, month, 1);
    last = new Date(year, month + 1, 0);
  } else if (period === "previous_month") {
    first = new Date(year, month - 1, 1);
    last = new Date(year, month, 0);
  } else if (period === "previous_year") {
    first = new Date(year - 1, 0, 1);
    last = new Date(year - 1, 11, 31);
  } else {
    first = new Date(year, 0, 1);
    last = new Date(year, 11, 31);
  }

  return {
    from: dateInputValue(first),
    to: dateInputValue(last),
  };
}

/* ==========================================================
   COMPOSANTS DE PRÉSENTATION
========================================================== */

const INPUT =
  "h-11 w-full min-w-0 rounded-xl border border-[#d8e1e8] bg-white px-3 text-sm font-medium text-[#16243b] outline-none focus:border-[#088830] focus:ring-2 focus:ring-green-100";

const CARD =
  "min-w-0 rounded-2xl border border-[#e1e7ed] bg-white p-4 shadow-sm sm:p-5";

function MetricCard({
  icon,
  title,
  value,
  tone,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  tone: "green" | "yellow" | "mint" | "red";
}) {
  const colors = {
    green: "bg-[#e9f8ed] text-[#0b7033]",
    yellow: "bg-[#fff7e3] text-[#9c7300]",
    mint: "bg-[#e8f7f0] text-[#087746]",
    red: "bg-[#fff0f0] text-[#b43139]",
  };

  return (
    <div
      className={`flex min-w-0 items-center gap-3 rounded-xl p-3 sm:p-4 ${colors[tone]}`}
    >
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold leading-tight sm:text-xs">
          {title}
        </p>
        <p className="mt-1 wrap-break-word text-base font-extrabold leading-tight sm:text-xl">
          {value}
        </p>
      </div>
    </div>
  );
}

function SaleBadge({
  type,
  locale,
}: {
  type: SaleType;
  locale: Locale;
}) {
  const t = DICTIONARY[locale];

  return type === "ticket" ? (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#e7f8eb] px-2.5 py-1 text-xs font-bold text-[#08732c]">
      <Ticket size={15} />
      {t.ticket}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#fff0f0] px-2.5 py-1 text-xs font-bold text-[#c32234]">
      <Heart size={15} />
      {t.donation}
    </span>
  );
}

function StatusBadge({
  value,
  locale,
}: {
  value: string;
  locale: Locale;
}) {
  const paid = [
    "PAID",
    "SUCCEEDED",
    "CONFIRMED",
    "COMPLETED",
  ].includes(value.toUpperCase());

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
        paid
          ? "bg-[#e5f7e9] text-[#087633]"
          : "bg-[#fff4df] text-[#936400]"
      }`}
    >
      {paid ? DICTIONARY[locale].paid : value}
    </span>
  );
}

/* ==========================================================
   PAGE PRINCIPALE
========================================================== */

export default function OrganizerSalesPage() {
  const [locale, setLocale] = useState<Locale>("fr");

  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [saleType, setSaleType] = useState<SaleFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [search, setSearch] = useState("");
  const [currency, setCurrency] = useState("XOF");

  const [page, setPage] = useState(1);
  const [data, setData] = useState<SalesData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedSale, setSelectedSale] = useState<string | null>(
    null
  );

  const t = DICTIONARY[locale];

  useEffect(() => {
    const updateLocale = () => {
      try {
        const saved = localStorage.getItem("tikemia_locale");
        setLocale(saved === "en" ? "en" : "fr");
      } catch {
        setLocale("fr");
      }
    };

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

  const dates = useMemo(
    () => periodDates(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  const validDates =
    !!dates.from && !!dates.to && dates.from <= dates.to;

  const query = useMemo(() => {
    const params = new URLSearchParams({
      view: "sales",
      period: "custom",
      quickView: "monthly_sales",
      currency,
      locale,
      page: String(page),
      pageSize: String(PAGE_SIZE),
      saleType,
      status,
      sort,
      search,
    });

    if (validDates) {
      params.set("startDate", dates.from);
      params.set("endDate", dates.to);
    }

    return params.toString();
  }, [
    currency,
    locale,
    page,
    saleType,
    status,
    sort,
    search,
    dates.from,
    dates.to,
    validDates,
  ]);

  const loadSales = useCallback(
    async (signal: AbortSignal, silent = false) => {
      if (!validDates) {
        setError(DICTIONARY[locale].invalidDates);
        setLoading(false);
        return;
      }

      if (silent) setRefreshing(true);
      else setLoading(true);

      try {
        const response = await fetch(
          `${DASHBOARD_API}?${query}`,
          {
            credentials: "same-origin",
            cache: "no-store",
            signal,
          }
        );

        const body: unknown = await response.json();
        const result = obj(body);

        if (!response.ok || result.success === false) {
          throw new Error(
            str(result.message, DICTIONARY[locale].error)
          );
        }

        if (!signal.aborted) {
          setData(normalizeDashboard(result, currency));
          setError("");
        }
      } catch (caught) {
        if (signal.aborted) return;

        setError(
          caught instanceof Error
            ? caught.message
            : DICTIONARY[locale].error
        );
      } finally {
        if (!signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [query, currency, locale, validDates]
  );

  useEffect(() => {
    const controller = new AbortController();

    queueMicrotask(() => { if (!controller.signal.aborted) void loadSales(controller.signal); });

    return () => controller.abort();
  }, [loadSales]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;

      const controller = new AbortController();
      void loadSales(controller.signal, true);
    }, REFRESH_INTERVAL);

    return () => window.clearInterval(timer);
  }, [loadSales]);

  useEffect(() => {
    function onFocus() {
      const controller = new AbortController();
      void loadSales(controller.signal, true);
    }

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadSales]);

  const shownItems = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase(locale);

    const filtered = data.items.filter((item) => {
      if (saleType !== "all" && item.type !== saleType) {
        return false;
      }

      const paid = [
        "PAID",
        "CONFIRMED",
        "SUCCEEDED",
        "COMPLETED",
      ].includes(item.status.toUpperCase());

      if (status === "paid" && !paid) return false;
      if (status === "other" && paid) return false;

      if (!needle) return true;

      return [
        item.title,
        item.person,
        item.reference,
        item.subtitle,
      ]
        .join(" ")
        .toLocaleLowerCase(locale)
        .includes(needle);
    });

    return [...filtered].sort((a, b) => {
      if (sort === "amount_desc") return b.amount - a.amount;
      if (sort === "amount_asc") return a.amount - b.amount;

      const timeA = Date.parse(a.date) || 0;
      const timeB = Date.parse(b.date) || 0;

      return sort === "oldest"
        ? timeA - timeB
        : timeB - timeA;
    });
  }, [data.items, search, saleType, status, sort, locale]);

  const totalPages =
    data.totalItems !== null
      ? Math.max(1, Math.ceil(data.totalItems / PAGE_SIZE))
      : 1;

  function updateFilter(callback: () => void) {
    callback();
    setPage(1);
    setSelectedSale(null);
  }

  function reload() {
    const controller = new AbortController();
    void loadSales(controller.signal, true);
  }

  const availableCurrencies = SUPPORTED_CURRENCIES;

  /* ========================================================
     RENDU
  ======================================================== */

  return (
    <main className="min-h-full w-full min-w-0 overflow-x-hidden bg-[#f7f9fb] pb-2 text-[#152338]">
      {/* EN-TÊTE */}

      <div className="w-full border-b border-[#e5eaf0] bg-white px-3 py-5 sm:px-5 lg:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {t.title}
            </h1>
            <p className="mt-1 text-xs text-[#627187] sm:text-sm">
              {t.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={t.allCurrencies}
              value={currency}
              onChange={(event) =>
                updateFilter(() => setCurrency(event.target.value))
              }
              className="h-10 rounded-xl border border-[#d8e1e8] bg-white px-3 text-sm font-semibold"
            >
              {availableCurrencies.map((code) => (
                <option key={code} value={code}>
                  {currencyLabel(code, locale)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={reload}
              disabled={refreshing}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d8e1e8] bg-white px-3 text-sm font-bold text-[#34506a] disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={refreshing ? "animate-spin" : ""}
              />
              {t.refresh}
            </button>
          </div>
        </div>

        <div className="mt-4 h-1 rounded-full bg-linear-to-r from-[#087e2d] via-[#ffd130] to-[#e31f31]" />
      </div>

      <div className="flex w-full min-w-0 flex-col gap-4 p-3 sm:p-5 lg:gap-5 lg:p-6">
        {/* ERREURS API */}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
          >
            <CircleAlert size={19} className="shrink-0" />
            <span className="min-w-0 flex-1">{error}</span>
            <button
              type="button"
              aria-label={t.close}
              onClick={() => setError("")}
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* INDICATEURS GLOBAUX */}

        <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
          <MetricCard
            icon={<Coins size={26} />}
            title={t.gross}
            value={formatAmount(
              data.summary.gross,
              data.summary.currency,
              locale
            )}
            tone="green"
          />
          <MetricCard
            icon={<Ticket size={26} />}
            title={t.commission}
            value={formatAmount(
              data.summary.fee,
              data.summary.currency,
              locale
            )}
            tone="yellow"
          />
          <MetricCard
            icon={<Wallet size={26} />}
            title={t.net}
            value={formatAmount(
              data.summary.net,
              data.summary.currency,
              locale
            )}
            tone="mint"
          />
          <MetricCard
            icon={<ArrowDownUp size={26} />}
            title={t.transactions}
            value={
              data.summary.count !== null
                ? new Intl.NumberFormat(locale).format(
                    data.summary.count
                  )
                : "—"
            }
            tone="red"
          />
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-[#e8f6ed] px-4 py-3 text-xs font-semibold text-[#215839] sm:text-sm">
          <Info size={19} className="shrink-0" />
          <span>{t.feeInfo}</span>
        </div>

        {!data.sourceHasSummary && !loading && !error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {t.missingSummary}
          </div>
        )}

        {/* RETRAITS */}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Link
            href="/organizer/dashboard/withdrawals"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#087d30] px-5 text-sm font-extrabold text-white hover:bg-[#056b27]"
          >
            <Wallet size={18} />
            {t.withdrawal}
          </Link>
        </div>

        {/* FILTRES */}

        <section className={CARD}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="min-w-0">
              <span className="mb-1.5 block text-xs font-bold">
                {t.period}
              </span>
              <div className="relative">
                <CalendarDays
                  size={16}
                  className="pointer-events-none absolute top-3.5 left-3 text-[#64758c]"
                />
                <select
                  value={period}
                  onChange={(event) =>
                    updateFilter(() =>
                      setPeriod(event.target.value as Period)
                    )
                  }
                  className={`${INPUT} pl-9`}
                >
                  <option value="month">{t.month}</option>
                  <option value="previous_month">
                    {t.previousMonth}
                  </option>
                  <option value="year">{t.year}</option>
                  <option value="previous_year">
                    {t.previousYear}
                  </option>
                  <option value="custom">{t.custom}</option>
                </select>
              </div>
            </label>

            <label className="min-w-0">
              <span className="mb-1.5 block text-xs font-bold">
                {t.type}
              </span>
              <select
                value={saleType}
                onChange={(event) =>
                  updateFilter(() =>
                    setSaleType(
                      event.target.value as SaleFilter
                    )
                  )
                }
                className={INPUT}
              >
                <option value="all">{t.allTypes}</option>
                <option value="ticket">{t.ticket}</option>
                <option value="donation">{t.donation}</option>
              </select>
            </label>

            <label className="min-w-0">
              <span className="mb-1.5 block text-xs font-bold">
                {t.status}
              </span>
              <select
                value={status}
                onChange={(event) =>
                  updateFilter(() =>
                    setStatus(
                      event.target.value as StatusFilter
                    )
                  )
                }
                className={INPUT}
              >
                <option value="all">{t.allStatuses}</option>
                <option value="paid">{t.paid}</option>
                <option value="other">{t.other}</option>
              </select>
            </label>

            <label className="min-w-0">
              <span className="mb-1.5 block text-xs font-bold">
                {t.sort}
              </span>
              <select
                value={sort}
                onChange={(event) =>
                  updateFilter(() =>
                    setSort(event.target.value as SortMode)
                  )
                }
                className={INPUT}
              >
                <option value="newest">{t.newest}</option>
                <option value="oldest">{t.oldest}</option>
                <option value="amount_desc">{t.highest}</option>
                <option value="amount_asc">{t.lowest}</option>
              </select>
            </label>
          </div>

          {period === "custom" && (
            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[#e7edf2] pt-4 sm:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-xs font-bold">
                  {t.start}
                </span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(event) =>
                    updateFilter(() =>
                      setCustomFrom(event.target.value)
                    )
                  }
                  className={INPUT}
                />
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-bold">
                  {t.end}
                </span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(event) =>
                    updateFilter(() =>
                      setCustomTo(event.target.value)
                    )
                  }
                  className={INPUT}
                />
              </label>
            </div>
          )}

          <div className="relative mt-4">
            <Search
              size={17}
              className="absolute top-3.5 left-3 text-[#718197]"
            />
            <input
              value={search}
              onChange={(event) => updateFilter(() => setSearch(event.target.value))}
              className={`${INPUT} pl-10`}
              placeholder={t.search}
              aria-label={t.search}
            />
          </div>
        </section>

        {/* CHARGEMENT */}

        {loading && (
          <div
            role="status"
            className="flex min-h-36 items-center justify-center gap-3 rounded-2xl border border-[#e1e7ed] bg-white text-sm font-semibold text-[#61738a]"
          >
            <LoaderCircle
              size={23}
              className="animate-spin text-[#087e30]"
            />
            {t.loading}
          </div>
        )}

        {!loading && !error && !data.sourceHasTransactions && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <Info size={20} className="shrink-0" />
            {t.missingSales}
          </div>
        )}

        {/* LISTE */}

        {!loading && data.sourceHasTransactions && (
          <section className={`${CARD} p-0!`}>
            {/* TABLEAU PC */}

            <div className="hidden w-full overflow-x-auto lg:block">
              <table className="w-full min-w-212.5 border-collapse text-left">
                <thead className="bg-[#f1f5f8] text-xs font-extrabold text-[#35445b]">
                  <tr>
                    <th className="px-4 py-4">{t.type}</th>
                    <th className="px-4 py-4">{t.titleColumn}</th>
                    <th className="px-4 py-4">{t.person}</th>
                    <th className="px-4 py-4">{t.date}</th>
                    <th className="px-4 py-4">{t.amount}</th>
                    <th className="px-4 py-4">{t.status}</th>
                    <th className="px-4 py-4">{t.actions}</th>
                  </tr>
                </thead>

                <tbody>
                  {shownItems.map((sale) => (
                    <tr
                      key={sale.id}
                      className="border-t border-[#e7edf1] align-top text-sm hover:bg-[#fafcfd]"
                    >
                      <td className="px-4 py-4">
                        <SaleBadge type={sale.type} locale={locale} />
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-bold">{sale.title || "—"}</p>
                        {sale.subtitle && (
                          <p className="mt-1 text-xs text-[#69798c]">
                            {sale.subtitle}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {sale.person || "—"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-xs">
                        {formatDate(sale.date, locale)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 font-extrabold">
                        {formatAmount(
                          sale.amount,
                          sale.currency,
                          locale
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <StatusBadge
                          value={sale.status}
                          locale={locale}
                        />
                      </td>

                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedSale(
                              selectedSale === sale.id
                                ? null
                                : sale.id
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-[#d8e2e8] px-3 py-2 text-xs font-semibold hover:bg-[#f1f6f4]"
                        >
                          <Eye size={15} />
                          {t.detail}
                          <ChevronDown size={14} />
                        </button>

                        {selectedSale === sale.id && (
                          <div className="mt-2 rounded-lg bg-[#f1f6f3] p-3 text-xs">
                            <strong>{t.reference} :</strong>
                            <p className="mt-1 break-all">
                              {sale.reference}
                            </p>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* CARTES MOBILE ET TABLETTE */}

            <div className="flex flex-col gap-3 p-3 sm:p-4 lg:hidden">
              {shownItems.map((sale) => (
                <article
                  key={sale.id}
                  className="rounded-xl border border-[#dfe6ed] bg-white p-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <SaleBadge type={sale.type} locale={locale} />
                    <StatusBadge
                      value={sale.status}
                      locale={locale}
                    />
                  </div>

                  <h3 className="mt-3 text-sm font-extrabold">
                    {sale.title || "—"}
                  </h3>

                  {sale.subtitle && (
                    <p className="mt-1 text-xs text-[#67768a]">
                      {sale.subtitle}
                    </p>
                  )}

                  <div className="mt-3 space-y-1.5 text-xs text-[#45546c]">
                    <p>{sale.person || "—"}</p>
                    <p>{formatDate(sale.date, locale)}</p>
                  </div>

                  <div className="mt-3 rounded-lg bg-[#f1f6f4] p-3">
                    <p className="text-xs text-[#526078]">
                      {t.amount}
                    </p>
                    <p className="mt-1 text-base font-extrabold text-[#087536]">
                      {formatAmount(
                        sale.amount,
                        sale.currency,
                        locale
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedSale(
                        selectedSale === sale.id
                          ? null
                          : sale.id
                      )
                    }
                    className="mt-3 flex min-h-10 w-full items-center justify-between rounded-lg border border-[#dce4e9] px-3 text-xs font-semibold"
                  >
                    <span className="flex items-center gap-2">
                      <Eye size={16} />
                      {t.detail}
                    </span>
                    <ChevronRight size={16} />
                  </button>

                  {selectedSale === sale.id && (
                    <div className="mt-2 rounded-lg bg-[#f4f7f9] p-3 text-xs">
                      <strong>{t.reference}</strong>
                      <p className="mt-1 break-all">
                        {sale.reference}
                      </p>
                    </div>
                  )}
                </article>
              ))}
            </div>

            {shownItems.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-[#68788d]">
                {t.noSales}
              </div>
            )}
          </section>
        )}

        {/* PAGINATION */}

        {!loading &&
          data.sourceHasTransactions &&
          totalPages > 1 && (
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-xs text-[#69788c]">
                {t.page} {page} {t.of} {totalPages}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={t.previousMonth}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex size-10 items-center justify-center rounded-xl border bg-white disabled:opacity-40"
                >
                  <ChevronLeft size={18} />
                </button>

                <span className="flex size-10 items-center justify-center rounded-xl bg-[#087d30] text-sm font-bold text-white">
                  {page}
                </span>

                <button
                  type="button"
                  aria-label={t.refresh}
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                  className="flex size-10 items-center justify-center rounded-xl border bg-white disabled:opacity-40"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}


      </div>
    </main>
  );
}
