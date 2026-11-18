
"use client";
import {
  SUPPORTED_CURRENCIES,
  currencySymbol,
  currencyLabel,
  defaultLocale,
  i18nConfig,
  normalizeLocale,
  type Locale,
} from "@/i18n/config";


import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import Link from "next/link";

import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coins,
  Heart,
  LoaderCircle,
  RefreshCw,
  Ticket,
  Wallet,
  AlertCircle,
} from "lucide-react";

import DashboardFilters, {
  DEFAULT_DASHBOARD_FILTERS,
  type DashboardFilterValues,
} from "@/components/organizer/DashboardFilters";

import DashboardCharts, {
  type DashboardSalesPoint,
  type DashboardSalesDistribution,
} from "@/components/organizer/DashboardCharts";

import DashboardEventsTable, {
  type DashboardEvent,
} from "@/components/organizer/DashboardEventsTable";



/* ============================================
   TIKEMIA — DASHBOARD ORGANISATEUR

   Route :
   /organizer/dashboard

   Affichage :
   - Tableau de bord pleine largeur
   - Responsive PC / tablette / mobile
   - Filtres de période
   - Statistiques réelles
   - Ventes et revenus
   - Événements actifs
   - Cagnottes actives
   - Graphiques dynamiques
   - Événements en cours de vente
   - Dernières transactions
   - Actualisation automatique
   - Français / Anglais

   Les menus sont déjà intégrés dans :
   /organizer/dashboard/layout.tsx

   Aucune donnée statistique fictive.
============================================ */

/* ============================================
   CONFIGURATION
============================================ */

const DASHBOARD_API =
  "/api/organizer/dashboard";

const REFRESH_INTERVAL = 15_000;

const ROUTES = {
  events: "/organizer/dashboard/events",
  campaigns: "/organizer/dashboard/campaigns",
  transactions:
    "/organizer/dashboard/transactions",
  publishEvent:
    "/organizer/dashboard/publish-event",
} as const;

type DashboardCurrency = (typeof SUPPORTED_CURRENCIES)[number];

type TransactionType =
  | "TICKET_SALE"
  | "DONATION";

type DashboardMetric = {
  value: number;
  previousValue?: number;
  changePercent?: number | null;
};

type DashboardRevenueMetric = {
  value: string;
  previousValue?: string;
  changePercent?: number | null;
  currency: string;
};

type DashboardTransaction = {
  id: string;
  type: TransactionType;
  reference: string;
  title: string;
  quantity: number;
  amount: string;
  currency: string;
  date: string | null;
  status: string;
};

type DashboardApiData = {
  success: boolean;
  message?: string;
  updatedAt: string;

  filters: {
    period: string;
    quickView: string;
    currency: string;
  };

  stats: {
    ticketsSold: DashboardMetric;
    revenue: DashboardRevenueMetric;
    activeEvents: DashboardMetric;
    activeFundraisers: DashboardMetric;
    donations: {
      count: number;
      amount: string;
      currency: string;
    };
  };

  salesChart: DashboardSalesPoint[];
  salesDistribution: DashboardSalesDistribution[];
  events: DashboardEvent[];
  transactions: DashboardTransaction[];
};

/* ============================================
   TRADUCTIONS FR / EN
============================================ */

const TEXT = {
  fr: {
    title: "Tableau de bord",
    subtitle:
      "Suivez vos événements, vos ventes et vos cagnottes.",
    ticketsSold: "Billets vendus",
    revenue: "Revenus générés",
    activeEvents: "Événements actifs",
    activeFundraisers: "Cagnottes actives",
    sales: "Ventes",
    donations: "Dons confirmés",
    donationCount: "Contributions",
    recentTransactions: "Dernières transactions",
    allTransactions: "Voir toutes les transactions",
    transaction: "Transaction",
    amount: "Montant",
    date: "Date",
    status: "Statut",
    ticketSale: "Vente de billet",
    donation: "Don",
    paid: "Payé",
    confirmed: "Confirmé",
    refunded: "Remboursé",
    pending: "En attente",
    cancelled: "Annulé",
    failed: "Échoué",
    noTransactions: "Aucune transaction disponible.",
    loading: "Chargement du tableau de bord...",
    error: "Impossible de charger les données.",
    unauthorized:
      "Votre session n'est pas valide. Veuillez vous connecter.",
    retry: "Réessayer",
    refreshing: "Actualisation...",
    updated: "Dernière actualisation",
    noComparison: "Aucune comparaison disponible",
    noData: "Aucune donnée disponible.",
    customDates:
      "Sélectionnez une période personnalisée valide.",
    currentPeriod: "Période sélectionnée",
    currency: "Devise",
    viewEvents: "Voir mes événements",
    viewCampaigns: "Voir mes cagnottes",
    quantity: "Quantité",
    newEvent: "Publier un événement",
    transactionsShort: "Transactions",
  },

  en: {
    title: "Dashboard",
    subtitle:
      "Track your events, sales and fundraisers.",
    ticketsSold: "Tickets sold",
    revenue: "Generated revenue",
    activeEvents: "Active events",
    activeFundraisers: "Active fundraisers",
    sales: "Sales",
    donations: "Confirmed donations",
    donationCount: "Contributions",
    recentTransactions: "Recent transactions",
    allTransactions: "View all transactions",
    transaction: "Transaction",
    amount: "Amount",
    date: "Date",
    status: "Status",
    ticketSale: "Ticket sale",
    donation: "Donation",
    paid: "Paid",
    confirmed: "Confirmed",
    refunded: "Refunded",
    pending: "Pending",
    cancelled: "Cancelled",
    failed: "Failed",
    noTransactions: "No transactions available.",
    loading: "Loading dashboard...",
    error: "Unable to load dashboard data.",
    unauthorized:
      "Your session is invalid. Please sign in.",
    retry: "Try again",
    refreshing: "Refreshing...",
    updated: "Last updated",
    noComparison: "No comparison available",
    noData: "No data available.",
    customDates: "Select a valid custom date range.",
    currentPeriod: "Selected period",
    currency: "Currency",
    viewEvents: "View my events",
    viewCampaigns: "View my fundraisers",
    quantity: "Quantity",
    newEvent: "Publish an event",
    transactionsShort: "Transactions",
  },
} as const;

/* ============================================
   OUTILS DE FORMATAGE
============================================ */

function formatNumber(
  value: number,
  locale: Locale
): string {
  const safeValue = Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;

  return new Intl.NumberFormat(
    locale === "fr" ? "fr-FR" : "en-US",
    {
      maximumFractionDigits: 0,
    }
  ).format(safeValue);
}

function formatAmount(value: string | number | bigint | null | undefined, currency: string, locale: Locale): string {
  if (value === null || value === undefined) return "—";
  try {
    const amount = BigInt(value);
    const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 0;
    const factor = BigInt(10) ** BigInt(digits);
    const absolute = amount < BigInt(0) ? -amount : amount;
    const language = locale === "fr" ? "fr-FR" : "en-US";
    let formatted = new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(absolute / factor);
    if (digits > 0) {
      const decimal = new Intl.NumberFormat(language).formatToParts(1.1).find(part => part.type === "decimal")?.value ?? ".";
      formatted += decimal + (absolute % factor).toString().padStart(digits, "0");
    }
    if (amount < BigInt(0)) formatted = "-" + formatted;
    const symbol = currencySymbol(currency);
    return formatted + " " + symbol;
  } catch { return "—"; }
}

function formatDateTime(
  value: string | null | undefined,
  locale: Locale
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    locale === "fr" ? "fr-FR" : "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

function formatPercent(
  value: number,
  locale: Locale
): string {
  return new Intl.NumberFormat(
    locale === "fr" ? "fr-FR" : "en-US",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
      signDisplay: "always",
    }
  ).format(value) + " %";
}

function isValidCustomPeriod(
  filters: DashboardFilterValues
): boolean {
  if (filters.period !== "custom") {
    return true;
  }

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  return (
    datePattern.test(filters.startDate) &&
    datePattern.test(filters.endDate) &&
    filters.endDate >= filters.startDate
  );
}

function getTransactionStatus(
  status: string,
  locale: Locale
): {
  label: string;
  classes: string;
} {
  const t = TEXT[locale];

  switch (status.toUpperCase()) {
    case "PAID":
    case "SUCCEEDED":
      return {
        label: t.paid,
        classes: "bg-green-50 text-green-800",
      };

    case "CONFIRMED":
      return {
        label: t.confirmed,
        classes: "bg-green-50 text-green-800",
      };

    case "PENDING":
    case "INITIATED":
      return {
        label: t.pending,
        classes: "bg-amber-50 text-amber-800",
      };

    case "REFUNDED":
      return {
        label: t.refunded,
        classes: "bg-slate-100 text-slate-700",
      };

    case "CANCELLED":
      return {
        label: t.cancelled,
        classes: "bg-red-50 text-red-700",
      };

    case "FAILED":
      return {
        label: t.failed,
        classes: "bg-red-50 text-red-700",
      };

    default:
      return {
        label: status || "—",
        classes: "bg-gray-100 text-gray-700",
      };
  }
}

/* ============================================
   CARTE STATISTIQUE
============================================ */

type StatisticCardProps = {
  title: string;
  value: string;
  icon: typeof Ticket;
  iconColor: string;
  background: string;
  changePercent?: number | null;
  highlighted?: boolean;
  locale: Locale;
};

function StatisticCard({
  title,
  value,
  icon: Icon,
  iconColor,
  background,
  changePercent,
  highlighted = false,
  locale,
}: StatisticCardProps) {
  const hasChange =
    typeof changePercent === "number" &&
    Number.isFinite(changePercent);

  const positive =
    hasChange && changePercent >= 0;

  return (
    <article
      className={[
        "flex min-h-34 w-full min-w-0",
        "flex-col justify-between",
        "rounded-2xl border",
        "p-3 shadow-sm",
        "sm:min-h-40 sm:p-4",
        "transition-colors",
        highlighted
          ? "border-green-500 ring-1 ring-green-200"
          : "border-[#e3e9ed]",
        background,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-xs leading-relaxed font-extrabold text-[#263b32] sm:text-sm">
          {title}
        </p>

        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/85 sm:size-11">
          <Icon
            size={23}
            strokeWidth={2.3}
            style={{
              color: iconColor,
            }}
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="mt-3 min-w-0">
        <p
          title={value}
          className="wrap-break-word text-xl leading-tight font-extrabold tracking-tight tabular-nums text-[#13283a] sm:text-2xl xl:text-[27px]"
        >
          {value}
        </p>

        {hasChange ? (
          <div
            className={[
              "mt-2 inline-flex items-center gap-1",
              "text-xs font-bold",
              positive
                ? "text-green-800"
                : "text-red-700",
            ].join(" ")}
          >
            {positive ? (
              <ArrowUpRight
                size={15}
                aria-hidden="true"
              />
            ) : (
              <ArrowDownRight
                size={15}
                aria-hidden="true"
              />
            )}

            {formatPercent(
              changePercent,
              locale
            )}
          </div>
        ) : (
          <div className="mt-2 h-4" />
        )}
      </div>
    </article>
  );
}

/* ============================================
   TRANSACTIONS
============================================ */

type TransactionsProps = {
  transactions: DashboardTransaction[];
  locale: Locale;
};

function DashboardTransactions({
  transactions,
  locale,
}: TransactionsProps) {
  const t = TEXT[locale];

  return (
    <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-[#e4e8ed] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-4 sm:px-4">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-[#101828] sm:text-lg">
            {t.recentTransactions}
          </h2>

          <div className="mt-2 h-1 w-11 rounded-full bg-linear-to-r from-[#c8fa00] to-[#13aa20]" />
        </div>

        <Link
          href={ROUTES.transactions}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-green-700 px-3 text-xs font-extrabold text-green-800 hover:bg-green-50"
        >
          <span className="hidden sm:inline">
            {t.allTransactions}
          </span>

          <span className="sm:hidden">
            {t.transactionsShort}
          </span>

          <ArrowRight
            size={15}
            aria-hidden="true"
          />
        </Link>
      </div>

      {transactions.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-3 border-t border-gray-100 px-4 py-7 text-center">
          <Wallet
            size={32}
            className="text-green-700"
            aria-hidden="true"
          />

          <p className="text-sm text-gray-500">
            {t.noTransactions}
          </p>
        </div>
      ) : (
        <>
          {/* ==================================
              TABLEAU PC
          ================================== */}

          <div className="hidden w-full min-w-0 lg:block">
            <table className="w-full table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[42%]" />
                <col className="w-[20%]" />
                <col className="w-[23%]" />
                <col className="w-[15%]" />
              </colgroup>

              <thead>
                <tr className="border-y border-[#e7ebef] bg-[#f7f9fb] text-xs font-extrabold text-[#243247]">
                  <th
                    scope="col"
                    className="px-4 py-3"
                  >
                    {t.transaction}
                  </th>

                  <th
                    scope="col"
                    className="px-3 py-3"
                  >
                    {t.amount}
                  </th>

                  <th
                    scope="col"
                    className="px-3 py-3"
                  >
                    {t.date}
                  </th>

                  <th
                    scope="col"
                    className="px-3 py-3"
                  >
                    {t.status}
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#edf0f3]">
                {transactions.map((transaction) => {
                  const donation =
                    transaction.type === "DONATION";

                  const status =
                    getTransactionStatus(
                      transaction.status,
                      locale
                    );

                  return (
                    <tr
                      key={transaction.id}
                      className="hover:bg-[#fbfdfb]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={[
                              "flex size-10 shrink-0 items-center justify-center rounded-xl",
                              donation
                                ? "bg-red-50 text-red-600"
                                : "bg-green-50 text-green-700",
                            ].join(" ")}
                          >
                            {donation ? (
                              <Heart size={20} />
                            ) : (
                              <Ticket size={20} />
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-extrabold text-[#142138]">
                              {transaction.title}
                            </p>

                            <p className="mt-0.5 truncate text-xs text-gray-500">
                              {donation
                                ? t.donation
                                : t.ticketSale}
                              {" · "}
                              {transaction.reference}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <span className="text-sm font-extrabold text-[#13283a]">
                          {formatAmount(
                            transaction.amount,
                            transaction.currency,
                            locale
                          )}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-xs text-gray-600">
                        {formatDateTime(
                          transaction.date,
                          locale
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <span
                          className={[
                            "inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold",
                            status.classes,
                          ].join(" ")}
                        >
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ==================================
              CARTES MOBILE / TABLETTE
          ================================== */}

          <div className="divide-y divide-[#edf0f3] lg:hidden">
            {transactions.map((transaction) => {
              const donation =
                transaction.type === "DONATION";

              const status = getTransactionStatus(
                transaction.status,
                locale
              );

              return (
                <article
                  key={transaction.id}
                  className="flex w-full min-w-0 items-start gap-3 px-3 py-3 sm:px-4"
                >
                  <div
                    className={[
                      "flex size-10 shrink-0 items-center justify-center rounded-xl",
                      donation
                        ? "bg-red-50 text-red-600"
                        : "bg-green-50 text-green-700",
                    ].join(" ")}
                  >
                    {donation ? (
                      <Heart
                        size={20}
                        aria-hidden="true"
                      />
                    ) : (
                      <Ticket
                        size={20}
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <p className="line-clamp-2 min-w-0 text-xs font-extrabold text-[#142138] sm:text-sm">
                        {transaction.title}
                      </p>

                      <p className="shrink-0 text-xs font-extrabold text-green-800 sm:text-sm">
                        {formatAmount(
                          transaction.amount,
                          transaction.currency,
                          locale
                        )}
                      </p>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
                      <span>
                        {donation
                          ? t.donation
                          : t.ticketSale}
                      </span>

                      <span aria-hidden="true">
                        ·
                      </span>

                      <span className="min-w-0 truncate">
                        {transaction.reference}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1 text-[11px] text-gray-500">
                        <Clock3
                          size={13}
                          aria-hidden="true"
                        />

                        {formatDateTime(
                          transaction.date,
                          locale
                        )}
                      </span>

                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-[11px] font-extrabold",
                          status.classes,
                        ].join(" ")}
                      >
                        {status.label}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

/* ============================================
   PAGE PRINCIPALE
============================================ */

function subscribeLocale(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("focus", onChange);
  return () => { window.removeEventListener("storage", onChange); window.removeEventListener("focus", onChange); };
}
function readStoredLocale(): Locale {
  try { return normalizeLocale(window.localStorage.getItem(i18nConfig.storageKey) ?? defaultLocale); }
  catch { return defaultLocale; }
}

export default function OrganizerDashboardPage() {
  /* ==========================================
     LANGUE
  ========================================== */

  const locale = useSyncExternalStore(subscribeLocale, readStoredLocale, () => defaultLocale);

  /* ==========================================
     FILTRES
  ========================================== */

  const [filters, setFilters] =
    useState<DashboardFilterValues>({
      ...DEFAULT_DASHBOARD_FILTERS,
    });

  const [currency, setCurrency] =
    useState<DashboardCurrency>("XOF");

  /* ==========================================
     DONNÉES API
  ========================================== */

  const [dashboardData, setDashboardData] =
    useState<DashboardApiData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [unauthorized, setUnauthorized] =
    useState(false);

  const [reloadKey, setReloadKey] =
    useState(0);

  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const t = TEXT[locale];

  /* ==========================================
     SYNCHRONISATION DE LA LANGUE

     Réutilisation du système i18n.
  ========================================== */



  /* ==========================================
     VALIDITÉ DES FILTRES
  ========================================== */

  const validFilters = useMemo(
    () => isValidCustomPeriod(filters),
    [filters]
  );

  /* ==========================================
     PARAMÈTRES API
  ========================================== */

  const queryString = useMemo(() => {
    if (!validFilters) {
      return null;
    }

    const params = new URLSearchParams({
      period: filters.period,
      quickView: filters.quickView,
      currency,
      locale,
    });

    if (filters.period === "custom") {
      params.set(
        "startDate",
        filters.startDate
      );

      params.set(
        "endDate",
        filters.endDate
      );
    }

    return params.toString();
  }, [
    filters.period,
    filters.quickView,
    filters.startDate,
    filters.endDate,
    currency,
    locale,
    validFilters,
  ]);

  /* ==========================================
     RÉCUPÉRATION DES DONNÉES

     - Chargement initial
     - Changement de filtre
     - Actualisation toutes les 15 s
     - Actualisation au retour sur l'onglet

     Les requêtes en cours sont annulées
     lorsque les filtres changent.
  ========================================== */

  if (activeQuery !== queryString) {
    setActiveQuery(queryString);
    setDashboardData(null);
    setLoading(Boolean(queryString));
    setRefreshing(false);
    setError("");
    setUnauthorized(false);
  }

  useEffect(() => {
    if (!queryString) return;

    let active = true;
    let currentRequest: AbortController | null =
      null;

    let firstRequest = true;


    async function loadDashboard() {
      if (!active || currentRequest) {
        return;
      }

      if (
        document.visibilityState === "hidden"
      ) {
        return;
      }

      const controller = new AbortController();

      currentRequest = controller;

      if (firstRequest) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const response = await fetch(
          `${DASHBOARD_API}?${queryString}`,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const result: DashboardApiData =
          await response.json();

        if (
          !active ||
          controller.signal.aborted
        ) {
          return;
        }

        if (response.status === 401) {
          setUnauthorized(true);
          setDashboardData(null);
          setError(TEXT[locale].unauthorized);
          return;
        }

        if (
          !response.ok ||
          result.success !== true ||
          !result.stats
        ) {
          throw new Error(
            result.message ||
              TEXT[locale].error
          );
        }

        setDashboardData(result);
        setUnauthorized(false);
        setError("");
      } catch (caughtError) {
        if (
          !active ||
          controller.signal.aborted
        ) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : TEXT[locale].error
        );
      } finally {
        if (currentRequest === controller) {
          currentRequest = null;
        }

        if (active) {
          firstRequest = false;
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void loadDashboard();

    const intervalId = window.setInterval(
      () => {
        void loadDashboard();
      },
      REFRESH_INTERVAL
    );

    function handleVisible() {
      if (
        document.visibilityState === "visible"
      ) {
        void loadDashboard();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisible
    );

    window.addEventListener(
      "focus",
      handleVisible
    );

    return () => {
      active = false;

      currentRequest?.abort();

      window.clearInterval(intervalId);

      document.removeEventListener(
        "visibilitychange",
        handleVisible
      );

      window.removeEventListener(
        "focus",
        handleVisible
      );
    };
  }, [queryString, reloadKey, locale]);

  /* ==========================================
     ACTUALISATION MANUELLE
  ========================================== */

  const handleRefresh = useCallback(() => {
    setReloadKey((previous) => previous + 1);
  }, []);

  /* ==========================================
     VALEURS RÉELLES
  ========================================== */

  const stats = dashboardData?.stats;

  const ticketsSold =
    stats?.ticketsSold.value ?? 0;

  const activeEvents =
    stats?.activeEvents.value ?? 0;

  const activeFundraisers =
    stats?.activeFundraisers.value ?? 0;

  const revenue =
    stats?.revenue.value ?? "0";

  const revenueCurrency =
    stats?.revenue.currency ?? currency;

  const sales =
    dashboardData?.salesChart ?? [];

  const distribution =
    dashboardData?.salesDistribution ?? [];

  const events =
    dashboardData?.events ?? [];

  const transactions =
    dashboardData?.transactions ?? [];

  /* ==========================================
     AFFICHAGE
  ========================================== */

  return (
    <main
      id="organizer-dashboard-page"
      className="flex min-h-full w-full min-w-0 flex-col bg-[#f6f8fa] text-[#142138]"
    >
      {/* ======================================
          CONTENU PLEINE LARGEUR
      ====================================== */}

      <div className="flex w-full min-w-0 flex-1 flex-col gap-3 px-3 py-3 sm:px-4 lg:px-5 lg:py-4">
        {/* ====================================
            TITRE
        ==================================== */}

        <header className="flex w-full min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] leading-tight font-extrabold tracking-tight text-[#0f2638] sm:text-2xl lg:text-[30px]">
              {t.title}
            </h1>

            <p className="mt-1 text-xs text-gray-600 sm:text-sm">
              {t.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/organizer/dashboard/scan" className="inline-flex h-10 items-center rounded-xl bg-green-700 px-4 text-sm font-bold text-white hover:bg-green-800">Scan</Link>
            {/* INDICATEUR D'ACTUALISATION */}

            {refreshing && (
              <span
                role="status"
                className="hidden items-center gap-1.5 text-xs font-medium text-green-700 sm:inline-flex"
              >
                <LoaderCircle
                  size={15}
                  className="animate-spin"
                  aria-hidden="true"
                />

                {t.refreshing}
              </span>
            )}

            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading || refreshing}
              aria-label={t.retry}
              title={t.retry}
              className="flex size-10 items-center justify-center rounded-xl border border-[#dce5e0] bg-white text-green-800 transition-colors hover:bg-green-50 disabled:opacity-50"
            >
              <RefreshCw
                size={18}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />
            </button>
          </div>
        </header>

        {/* ====================================
            FILTRES ET DEVISE
        ==================================== */}

        <div className="w-full min-w-0">
          <DashboardFilters
            value={filters}
            onChange={setFilters}
            locale={locale}
            disabled={loading && !dashboardData}
          />
        </div>

        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Activity
              size={16}
              className="shrink-0 text-green-700"
              aria-hidden="true"
            />

            <span className="text-xs font-semibold text-gray-500">
              {t.currentPeriod} :
            </span>

            <span className="text-xs font-extrabold text-[#142138]">
              {filters.period === "week"
                ? locale === "fr"
                  ? "Cette semaine"
                  : "This week"
                : filters.period === "month"
                  ? locale === "fr"
                    ? "Ce mois"
                    : "This month"
                  : filters.period === "year"
                    ? locale === "fr"
                      ? "Cette année"
                      : "This year"
                    : `${filters.startDate || "—"} — ${filters.endDate || "—"}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="dashboard-currency"
              className="text-xs font-bold text-[#142138]"
            >
              {t.currency}
            </label>

            <select
              id="dashboard-currency"
              value={currency}
              onChange={(event) =>
                setCurrency(
                  event.currentTarget
                    .value as DashboardCurrency
                )
              }
              className="h-10 rounded-xl border border-[#dce3ea] bg-white px-3 text-xs font-extrabold text-[#142138] outline-none focus:border-green-700"
            >
              {SUPPORTED_CURRENCIES.map(code => <option key={code} value={code}>{currencyLabel(code, locale)}</option>)}
              
              
            </select>
          </div>
        </div>

        {/* ====================================
            ERREURS
        ==================================== */}

        {!validFilters && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
          >
            <AlertCircle
              size={18}
              className="shrink-0"
            />

            {t.customDates}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
          >
            <div className="flex min-w-0 items-start gap-2">
              <AlertCircle
                size={19}
                className="shrink-0 text-red-700"
              />

              <span className="text-sm font-medium text-red-800">
                {error}
              </span>
            </div>

            {!unauthorized && (
              <button
                type="button"
                onClick={handleRefresh}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-800 hover:bg-red-100"
              >
                {t.retry}
              </button>
            )}
          </div>
        )}

        {/* ====================================
            CHARGEMENT INITIAL
        ==================================== */}

        {loading && !dashboardData ? (
          <div
            role="status"
            className="flex min-h-72 w-full flex-col items-center justify-center gap-3 rounded-2xl border border-[#e4e8ed] bg-white"
          >
            <LoaderCircle
              size={38}
              className="animate-spin text-green-700"
              aria-hidden="true"
            />

            <p className="text-sm font-medium text-gray-600">
              {t.loading}
            </p>
          </div>
        ) : dashboardData ? (
          <>
            {/* ==================================
                4 CARTES STATISTIQUES

                PC : 4 colonnes
                MOBILE : 2 colonnes
            ================================== */}

            <section
              aria-label={t.title}
              className="grid w-full min-w-0 grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4 xl:gap-4"
            >
              <StatisticCard
                title={t.ticketsSold}
                value={formatNumber(
                  ticketsSold,
                  locale
                )}
                icon={Ticket}
                iconColor="#10a21f"
                background="bg-[#effbea]"
                changePercent={
                  stats?.ticketsSold.changePercent
                }
                highlighted={
                  filters.quickView === "ticket_sales"
                }
                locale={locale}
              />

              <StatisticCard
                title={t.revenue}
                value={formatAmount(
                  revenue,
                  revenueCurrency,
                  locale
                )}
                icon={Coins}
                iconColor="#e0a400"
                background="bg-[#fff9e3]"
                changePercent={
                  stats?.revenue.changePercent
                }
                highlighted={
                  filters.quickView === "revenue"
                }
                locale={locale}
              />

              <StatisticCard
                title={t.activeEvents}
                value={formatNumber(
                  activeEvents,
                  locale
                )}
                icon={CalendarDays}
                iconColor="#f08019"
                background="bg-[#fff1e5]"
                highlighted={
                  filters.quickView === "events"
                }
                locale={locale}
              />

              <StatisticCard
                title={t.activeFundraisers}
                value={formatNumber(
                  activeFundraisers,
                  locale
                )}
                icon={Heart}
                iconColor="#eb4151"
                background="bg-[#fff0f2]"
                highlighted={
                  filters.quickView === "fundraisers"
                }
                locale={locale}
              />
            </section>

            {/* ==================================
                GRAPHIQUES

                Utilise le composant
                DashboardCharts existant.
            ================================== */}

            <DashboardCharts
              sales={sales}
              distribution={distribution}
              locale={locale}
              loading={false}
              className="w-full"
            />

            {/* ==================================
                ÉVÉNEMENTS EN COURS DE VENTE
            ================================== */}

            <DashboardEventsTable
              events={events}
              locale={locale}
              loading={false}
              maxItems={5}
              viewAllHref={ROUTES.events}
              className="w-full"
            />

            {/* ==================================
                DERNIÈRES TRANSACTIONS
            ================================== */}

            <DashboardTransactions
              transactions={transactions}
              locale={locale}
            />

            {/* ==================================
                DERNIÈRE ACTUALISATION
            ================================== */}

            <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
              <span className="flex items-center gap-2 text-[11px] font-medium text-gray-500">
                <CheckCircle2
                  size={15}
                  className="text-green-700"
                  aria-hidden="true"
                />

                {t.updated} :{" "}
                {formatDateTime(
                  dashboardData.updatedAt,
                  locale
                )}
              </span>

              <div className="flex items-center gap-3">
                <Link
                  href={ROUTES.events}
                  className="text-xs font-bold text-green-800 hover:underline"
                >
                  {t.viewEvents}
                </Link>

                <Link
                  href={ROUTES.campaigns}
                  className="text-xs font-bold text-green-800 hover:underline"
                >
                  {t.viewCampaigns}
                </Link>
              </div>
            </div>
          </>
        ) : !loading && !error && validFilters ? (
          <div className="flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-2xl border border-[#e4e8ed] bg-white px-4 text-center">
            <Wallet
              size={32}
              className="text-green-700"
            />

            <p className="text-sm text-gray-600">
              {t.noData}
            </p>

            <Link
              href={ROUTES.publishEvent}
              className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-800"
            >
              {t.newEvent}

              <ArrowRight
                size={16}
                aria-hidden="true"
              />
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
