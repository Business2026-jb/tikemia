
"use client";
import { currencySymbol } from "@/i18n/config";


import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Eye,
  Heart,
  Layers3,
  LoaderCircle,
  RefreshCw,
  Search,
  Ticket,
  Wallet,
  X,
  XCircle,
} from "lucide-react";

/* ==========================================================
   TIKEMIA — TRANSACTIONS ORGANISATEUR

   Route :
   /organizer/dashboard/transactions

   API existantes :
   GET /api/organizer/dashboard
   GET /api/organizer/withdrawals

   Fonctionnalités :
   - Ventes de billets
   - Dons et cagnottes
   - Demandes de retrait
   - Retraits en cours
   - Retraits effectués
   - Retraits rejetés
   - Indicateurs
   - Filtres
   - Recherche
   - Détails
   - Pagination
   - Actualisation automatique
   - Version PC et mobile

   Le menu global est fourni par :
   /organizer/dashboard/layout.tsx

   Aucune transaction fictive.
========================================================== */

const DASHBOARD_API = "/api/organizer/dashboard";
const WITHDRAWALS_API = "/api/organizer/withdrawals";

const REFRESH_MS = 30_000;
const PAGE_SIZE = 10;
const WITHDRAWAL_BATCH_SIZE = 50;

type Locale = "fr" | "en";

type TransactionType =
  | "TICKET"
  | "DONATION"
  | "WITHDRAWAL";

type TransactionStatus =
  | "COMPLETED"
  | "PENDING"
  | "REJECTED";

type FilterStatus =
  | "ALL"
  | TransactionStatus;

type FilterType =
  | "ALL"
  | TransactionType;

type PeriodFilter =
  | "ALL"
  | "THIS_MONTH"
  | "PREVIOUS_MONTH"
  | "THIS_YEAR"
  | "CUSTOM";

type JsonObject = Record<string, unknown>;

type Transaction = {
  id: string;
  reference: string;
  type: TransactionType;
  title: string;
  description: string;
  person: string;
  date: string;
  amountMinor: string;
  currency: string;
  status: TransactionStatus;
  rawStatus: string;
  destinationUrl: string;
};

type SourceResult = {
  items: Transaction[];
  hasMore: boolean;
  loaded: boolean;
  error: string;
};

type DashboardResult = {
  items: Transaction[];
  loaded: boolean;
  error: string;
  isPartial: boolean;
};

const EMPTY_SOURCE: SourceResult = {
  items: [],
  hasMore: false,
  loaded: false,
  error: "",
};

const EMPTY_DASHBOARD: DashboardResult = {
  items: [],
  loaded: false,
  error: "",
  isPartial: false,
};

/* ==========================================================
   TRADUCTIONS
========================================================== */

const WORDS = {
  fr: {
    title: "Transactions",
    subtitle:
      "Toutes vos opérations : ventes, dons, cagnottes et retraits.",

    total: "Transactions chargées",
    tickets: "Ventes de billets",
    donations: "Dons / Cagnottes",
    withdrawals: "Demandes de retrait",

    all: "Toutes",
    pending: "En cours",
    completed: "Validées",
    rejected: "Rejetées",

    period: "Période",
    allPeriods: "Toutes les périodes",
    thisMonth: "Ce mois",
    previousMonth: "Mois précédent",
    thisYear: "Cette année",
    custom: "Personnalisée",

    type: "Type",
    allTypes: "Tous les types",
    ticketSale: "Vente billet",
    donation: "Don / Cagnotte",
    withdrawal: "Retrait",

    search: "Rechercher une transaction...",
    date: "Date",
    details: "Détails",
    amount: "Montant",
    status: "Statut",
    action: "Action",
    view: "Voir",

    start: "Date de début",
    end: "Date de fin",

    transactionDetails: "Détails de la transaction",
    reference: "Référence",
    participant: "Acheteur / Donateur",
    origin: "Opération",
    openPage: "Ouvrir la page correspondante",
    close: "Fermer",

    refresh: "Actualiser",
    loading: "Chargement des transactions...",
    loadingMore: "Chargement...",
    loadMore: "Charger plus de retraits",

    noTransactions:
      "Aucune transaction trouvée pour les filtres sélectionnés.",

    error:
      "Impossible de charger certaines transactions.",

    incomplete:
      "Certaines opérations ne sont pas disponibles. L'historique affiché peut être incomplet.",

    recentOnly:
      "L'API dashboard fournit uniquement les opérations reçues dans sa réponse. Pour afficher toutes les anciennes ventes, elle doit proposer leur historique paginé.",

    page: "Page",
    of: "sur",

    unknown: "Non renseigné",
    ticketDetails: "Billetterie et ventes",
    donationDetails: "Dons et cagnottes",
    withdrawalDetails: "Retraits",

    paid: "Validé",
    waiting: "En cours",
    refused: "Rejeté",

    transactionCount:
      "Les compteurs correspondent aux opérations chargées.",

    retry: "Réessayer",
  },

  en: {
    title: "Transactions",
    subtitle:
      "All your operations: ticket sales, donations, fundraisers and withdrawals.",

    total: "Loaded transactions",
    tickets: "Ticket sales",
    donations: "Donations / Fundraisers",
    withdrawals: "Withdrawal requests",

    all: "All",
    pending: "Pending",
    completed: "Completed",
    rejected: "Rejected",

    period: "Period",
    allPeriods: "All periods",
    thisMonth: "This month",
    previousMonth: "Previous month",
    thisYear: "This year",
    custom: "Custom",

    type: "Type",
    allTypes: "All types",
    ticketSale: "Ticket sale",
    donation: "Donation / Fundraiser",
    withdrawal: "Withdrawal",

    search: "Search a transaction...",
    date: "Date",
    details: "Details",
    amount: "Amount",
    status: "Status",
    action: "Action",
    view: "View",

    start: "Start date",
    end: "End date",

    transactionDetails: "Transaction details",
    reference: "Reference",
    participant: "Buyer / Donor",
    origin: "Operation",
    openPage: "Open related page",
    close: "Close",

    refresh: "Refresh",
    loading: "Loading transactions...",
    loadingMore: "Loading...",
    loadMore: "Load more withdrawals",

    noTransactions:
      "No transactions match your filters.",

    error:
      "Some transactions could not be loaded.",

    incomplete:
      "Some operations are unavailable. The displayed history may be incomplete.",

    recentOnly:
      "The dashboard API only provides the operations included in its response. To display all older sales, it must expose paginated history.",

    page: "Page",
    of: "of",

    unknown: "Not provided",
    ticketDetails: "Ticketing and sales",
    donationDetails: "Donations and fundraisers",
    withdrawalDetails: "Withdrawals",

    paid: "Completed",
    waiting: "Pending",
    refused: "Rejected",

    transactionCount:
      "Counters reflect the loaded operations.",

    retry: "Try again",
  },
} as const;

/* ==========================================================
   LECTURE DES RÉPONSES API
========================================================== */

function object(value: unknown): JsonObject {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as JsonObject;
  }

  return {};
}

function readString(
  value: unknown,
  fallback = ""
): string {
  return typeof value === "string"
    ? value
    : fallback;
}

function firstValue(
  value: JsonObject,
  keys: string[]
): unknown {
  for (const key of keys) {
    const item = value[key];

    if (item !== undefined && item !== null) {
      return item;
    }
  }

  return undefined;
}

function firstString(
  value: JsonObject,
  keys: string[],
  fallback = ""
): string {
  const result = firstValue(value, keys);
  return readString(result, fallback);
}

function parseMinor(
  value: unknown
): string | null {
  if (
    typeof value === "string" &&
    /^-?\d+$/.test(value.trim())
  ) {
    return value.trim();
  }

  if (
    typeof value === "number" &&
    Number.isSafeInteger(value)
  ) {
    return String(value);
  }

  return null;
}

function getPayload(value: unknown): JsonObject {
  const raw = object(value);

  if (
    raw.data !== null &&
    typeof raw.data === "object" &&
    !Array.isArray(raw.data)
  ) {
    return object(raw.data);
  }

  return raw;
}

function findArray(
  source: JsonObject,
  keys: string[]
): unknown[] | null {
  for (const key of keys) {
    const value = source[key];

    if (Array.isArray(value)) {
      return value;
    }

    const nested = object(value);

    if (Array.isArray(nested.items)) {
      return nested.items;
    }

    if (Array.isArray(nested.data)) {
      return nested.data;
    }
  }

  return null;
}

function normalizeType(
  value: JsonObject
): TransactionType | null {
  const rawType = firstString(value, [
    "type",
    "saleType",
    "transactionType",
    "kind",
    "purpose",
    "paymentPurpose",
  ]).toUpperCase();

  if (
    rawType.includes("WITHDRAW") ||
    rawType.includes("PAYOUT") ||
    rawType === "RETRAIT"
  ) {
    return "WITHDRAWAL";
  }

  if (
    rawType.includes("DONATION") ||
    rawType.includes("CAMPAIGN") ||
    rawType.includes("FUNDRAIS") ||
    rawType === "DON"
  ) {
    return "DONATION";
  }

  if (
    rawType.includes("TICKET") ||
    rawType.includes("ORDER") ||
    rawType.includes("BILLET")
  ) {
    return "TICKET";
  }

  if (value.donationId || value.campaignId) {
    return "DONATION";
  }

  if (value.orderId || value.eventId) {
    return "TICKET";
  }

  return null;
}

function normalizeStatus(
  value: string
): TransactionStatus {
  const status = value.toUpperCase();

  if (
    [
      "PAID",
      "SUCCEEDED",
      "CONFIRMED",
      "COMPLETED",
      "VALID",
      "VALIDATED",
    ].includes(status)
  ) {
    return "COMPLETED";
  }

  if (
    [
      "REJECTED",
      "FAILED",
      "CANCELLED",
      "CANCELED",
      "REFUNDED",
      "CHARGEBACK",
    ].includes(status)
  ) {
    return "REJECTED";
  }

  return "PENDING";
}

function normalizeDashboardItem(
  value: unknown,
  forcedType?: TransactionType
): Transaction | null {
  const raw = object(value);

  const type = forcedType ?? normalizeType(raw);

  if (!type || type === "WITHDRAWAL") {
    return null;
  }

  const id = firstString(raw, [
    "id",
    "reference",
    "orderId",
    "donationId",
    "transactionId",
  ]);

  if (!id) return null;

  /*
   * Pour les ventes, on affiche le
   * montant brut de l'opération.
   *
   * Aucun calcul des 5 % ici.
   */

  const amount = parseMinor(
    firstValue(raw, [
      "amountMinor",
      "grossAmount",
      "amount",
      "subtotal",
      "total",
    ])
  );

  if (amount === null) return null;

  const status = firstString(raw, [
    "status",
    "paymentStatus",
    "state",
  ], "PENDING");

  const date = firstString(raw, [
    "confirmedAt",
    "paidAt",
    "date",
    "createdAt",
  ]);

  const title = firstString(raw, [
    "eventTitle",
    "campaignTitle",
    "title",
    "eventName",
    "campaignName",
  ]);

  const reference = firstString(
    raw,
    ["reference", "orderReference", "paymentReference"],
    id
  );

  return {
    id: `${type}:${id}`,
    reference,
    type,
    title,
    description: firstString(raw, [
      "description",
      "categoryName",
      "category",
      "subtitle",
    ]),
    person: firstString(raw, [
      "buyerName",
      "donorName",
      "customerName",
      "fullName",
    ]),
    date,
    amountMinor: amount,
    currency: firstString(
      raw,
      ["currency"],
      "XOF"
    ).toUpperCase(),
    status: normalizeStatus(status),
    rawStatus: status,
    destinationUrl:
      type === "TICKET"
        ? "/organizer/dashboard/sales"
        : "/organizer/dashboard/campaigns",
  };
}

function normalizeWithdrawal(
  value: unknown
): Transaction | null {
  const raw = object(value);

  const id = firstString(raw, [
    "id",
    "reference",
  ]);

  if (!id) return null;

  const destination = object(raw.destination);

  const amount = parseMinor(
    raw.amountMinor ?? raw.amount
  );

  if (amount === null) return null;

  const status = firstString(
    raw,
    ["status"],
    "REQUESTED"
  );

  const provider = firstString(
    destination,
    ["bankName", "provider"],
    "Retrait"
  );

  const network = firstString(
    destination,
    ["networkCode"],
  );

  const detail = [provider, network]
    .filter(Boolean)
    .join(" · ");

  return {
    id: `WITHDRAWAL:${id}`,
    reference: firstString(
      raw,
      ["reference"],
      id
    ),
    type: "WITHDRAWAL",
    title: detail || "Retrait",
    description: firstString(
      destination,
      ["maskedAccountRef"],
    ),
    person: firstString(
      destination,
      ["accountName"],
    ),
    date: firstString(
      raw,
      ["requestedAt", "createdAt"],
    ),
    amountMinor:
      amount.startsWith("-") ? amount : `-${amount}`,
    currency: firstString(
      raw,
      ["currency"],
      "XOF"
    ).toUpperCase(),
    status: normalizeStatus(status),
    rawStatus: status,
    destinationUrl:
      "/organizer/dashboard/withdrawals",
  };
}

/* ==========================================================
   NORMALISATION DU DASHBOARD

   Accepte :
   - transactions
   - sales
   - recentSales
   - recentTransactions
   - ticketSales
   - donations
   - recentDonations

   Les opérations sont identifiées
   par leur type réel.

   Une réponse contenant seulement
   des indicateurs ne sera jamais
   transformée en fausses transactions.
========================================================== */

function normalizeDashboardResponse(
  response: unknown
): DashboardResult {
  const data = getPayload(response);

  const items: Transaction[] = [];

  const mixed = findArray(data, [
    "transactions",
    "sales",
    "recentSales",
    "recentTransactions",
    "salesHistory",
  ]);

  const tickets = findArray(data, [
    "ticketSales",
    "paidOrders",
    "recentOrders",
  ]);

  const donations = findArray(data, [
    "donations",
    "confirmedDonations",
    "recentDonations",
  ]);

  if (mixed) {
    for (const item of mixed) {
      const normalized = normalizeDashboardItem(item);

      if (normalized) items.push(normalized);
    }
  }

  if (tickets) {
    for (const item of tickets) {
      const normalized = normalizeDashboardItem(
        item,
        "TICKET"
      );

      if (normalized) items.push(normalized);
    }
  }

  if (donations) {
    for (const item of donations) {
      const normalized = normalizeDashboardItem(
        item,
        "DONATION"
      );

      if (normalized) items.push(normalized);
    }
  }

  const unique = new Map<string, Transaction>();

  for (const transaction of items) {
    unique.set(transaction.id, transaction);
  }

  return {
    items: [...unique.values()],
    loaded: true,
    error: "",
    /*
     * Par prudence, une liste dashboard
     * sans pagination confirmée ne permet
     * pas de garantir l'historique complet.
     */
    isPartial: true,
  };
}

/* ==========================================================
   FORMATAGE
========================================================== */

function currencyDigits(
  currency: string
): number {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

function formatMoney(
  amountMinor: string,
  currency: string,
  locale: Locale
): string {
  let amount: bigint;

  try {
    amount = BigInt(amountMinor);
  } catch {
    return "—";
  }

  const negative = amount < 0n;
  const positive = negative ? -amount : amount;

  const digits = currencyDigits(currency);
  const factor = 10n ** BigInt(digits);

  const whole = positive / factor;
  const fraction = positive % factor;

  const formattedWhole = new Intl.NumberFormat(
    locale === "fr" ? "fr-FR" : "en-GB"
  ).format(whole);

  const fractionString =
    digits > 0
      ? `${
          locale === "fr" ? "," : "."
        }${fraction.toString().padStart(digits, "0")}`
      : "";

  const sign = negative ? "− " : "+ ";

  if (currency === "XOF" || currency === "XAF") {
    return `${sign}${formattedWhole}${fractionString} ${currencySymbol(currency)}`;
  }

  if (currency === "EUR") {
    return `${sign}${formattedWhole}${fractionString} €`;
  }

  if (currency === "USD") {
    return `${sign}${formattedWhole}${fractionString} $`;
  }

  return `${sign}${formattedWhole}${fractionString} ${currencySymbol(currency)}`;
}

function formatDate(
  value: string,
  locale: Locale
): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

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

function localDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function inPeriod(
  dateString: string,
  period: PeriodFilter,
  from: string,
  to: string
): boolean {
  if (period === "ALL") return true;

  const value = new Date(dateString);

  if (Number.isNaN(value.getTime())) {
    return false;
  }

  const now = new Date();

  if (period === "THIS_MONTH") {
    return (
      value.getFullYear() === now.getFullYear() &&
      value.getMonth() === now.getMonth()
    );
  }

  if (period === "PREVIOUS_MONTH") {
    const previous = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );

    return (
      value.getFullYear() === previous.getFullYear() &&
      value.getMonth() === previous.getMonth()
    );
  }

  if (period === "THIS_YEAR") {
    return value.getFullYear() === now.getFullYear();
  }

  if (period === "CUSTOM") {
    const date = localDateInput(value);

    return (
      (!from || date >= from) &&
      (!to || date <= to)
    );
  }

  return true;
}

/* ==========================================================
   COMPOSANTS VISUELS
========================================================== */

const PANEL =
  "min-w-0 rounded-2xl border border-[#e2e5ef] bg-white shadow-sm";

const SELECT =
  "h-11 w-full min-w-0 rounded-xl border border-[#dfe2ec] bg-white px-3 text-sm font-semibold text-[#21213b] outline-none focus:border-[#7225dd] focus:ring-2 focus:ring-purple-100";

function TypeIcon({
  type,
  size = 22,
}: {
  type: TransactionType;
  size?: number;
}) {
  if (type === "TICKET") {
    return (
      <Ticket
        size={size}
        className="text-[#7523dc]"
      />
    );
  }

  if (type === "DONATION") {
    return (
      <Heart
        size={size}
        className="text-[#dc1642]"
      />
    );
  }

  return (
    <ArrowUpRight
      size={size}
      className="text-[#1765ae]"
    />
  );
}

function StatusBadge({
  status,
  locale,
}: {
  status: TransactionStatus;
  locale: Locale;
}) {
  const t = WORDS[locale];

  const config = {
    COMPLETED: {
      label: t.paid,
      css: "bg-[#e1f9e2] text-[#08752b]",
      icon: <CheckCircle2 size={15} />,
    },
    PENDING: {
      label: t.waiting,
      css: "bg-[#e8f0ff] text-[#1855c5]",
      icon: <Clock3 size={15} />,
    },
    REJECTED: {
      label: t.refused,
      css: "bg-[#ffe6ec] text-[#cf1831]",
      icon: <XCircle size={15} />,
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold ${config.css}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

function CounterCard({
  icon,
  title,
  count,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  className: string;
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-3 rounded-2xl border border-[#e5e3ed] bg-white p-3 shadow-sm sm:flex-col sm:justify-center sm:p-5 ${className}`}
    >
      <div className="shrink-0">{icon}</div>

      <div className="min-w-0 sm:text-center">
        <p className="text-xs font-bold leading-tight text-[#24243d] sm:text-sm">
          {title}
        </p>

        <p className="mt-1 text-xl font-extrabold tabular-nums text-[#17172e] sm:text-3xl">
          {count}
        </p>
      </div>
    </div>
  );
}

/* ==========================================================
   PAGE PRINCIPALE
========================================================== */

export default function OrganizerTransactionsPage() {
  const [locale, setLocale] =
    useState<Locale>("fr");

  const [dashboard, setDashboard] =
    useState<DashboardResult>(EMPTY_DASHBOARD);

  const [withdrawals, setWithdrawals] =
    useState<SourceResult>(EMPTY_SOURCE);

  const [withdrawalPage, setWithdrawalPage] =
    useState(1);

  const [withdrawalCurrency] =
    useState("XOF");

  const [statusFilter, setStatusFilter] =
    useState<FilterStatus>("ALL");

  const [typeFilter, setTypeFilter] =
    useState<FilterType>("ALL");

  const [periodFilter, setPeriodFilter] =
    useState<PeriodFilter>("ALL");

  const [search, setSearch] =
    useState("");

  const [startDate, setStartDate] =
    useState("");

  const [endDate, setEndDate] =
    useState("");

  const [currentPage, setCurrentPage] =
    useState(1);

  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const t = WORDS[locale];

  /* ========================================================
     LANGUE FR / EN
  ======================================================== */

  useEffect(() => {
    function updateLocale() {
      try {
        const saved =
          localStorage.getItem("tikemia_locale");

        setLocale(
          saved === "en" ? "en" : "fr"
        );
      } catch {
        setLocale("fr");
      }
    }

    updateLocale();

    window.addEventListener(
      "storage",
      updateLocale
    );

    window.addEventListener(
      "tikemia:locale-changed",
      updateLocale
    );

    return () => {
      window.removeEventListener(
        "storage",
        updateLocale
      );

      window.removeEventListener(
        "tikemia:locale-changed",
        updateLocale
      );
    };
  }, []);

  /* ========================================================
     RÉCUPÉRATION DU DASHBOARD

     Aucune donnée de démonstration.

     Les listes de ventes et dons sont
     utilisées uniquement si présentes
     dans la réponse du serveur.
  ======================================================== */

  const fetchDashboard = useCallback(
    async (
      signal?: AbortSignal
    ): Promise<DashboardResult> => {
      try {
        const items: Transaction[] = [];
        let nextPage = 1;
        let total = 0;
        do {
          const params = new URLSearchParams({ view: "transactions", locale, page: String(nextPage), pageSize: "100" });
          const response = await fetch(DASHBOARD_API + "?" + params, { credentials: "same-origin", cache: "no-store", signal });
          const json = object(await response.json());
          if (!response.ok || json.success !== true) throw new Error(readString(json.message, "Transactions indisponibles"));
          const result = normalizeDashboardResponse(json);
          items.push(...result.items);
          total = Number(object(json.pagination).total ?? items.length);
          if (result.items.length === 0) break;
          nextPage++;
        } while (!signal?.aborted && items.length < total);
        return { items, loaded: true, error: "", isPartial: false };
      } catch (error) {
        if (signal?.aborted) {
          throw error;
        }

        return {
          items: [],
          loaded: false,
          error:
            error instanceof Error
              ? error.message
              : "Dashboard indisponible",
          isPartial: false,
        };
      }
    },
    [locale]
  );

  /* ========================================================
     RÉCUPÉRATION DES RETRAITS

     Pagination via l'API existante.

     Chaque devise est demandée
     séparément pour éviter toute
     addition de montants incompatibles.
  ======================================================== */

  const fetchWithdrawalPage = useCallback(
    async (
      page: number,
      currency: string,
      signal?: AbortSignal
    ): Promise<{
      items: Transaction[];
      hasMore: boolean;
    }> => {
      const params = new URLSearchParams({
        currency,
        page: String(page),
        pageSize: String(WITHDRAWAL_BATCH_SIZE),
        view: "transactions",
      });

      const response = await fetch(
        `${WITHDRAWALS_API}?${params.toString()}`,
        {
          credentials: "same-origin",
          cache: "no-store",
          signal,
        }
      );

      if (!response.ok) {
        throw new Error(
          `Retraits : HTTP ${response.status}`
        );
      }

      const json: unknown = await response.json();
      const data = getPayload(json);

      if (object(json).success === false) {
        throw new Error(
          readString(
            object(json).message,
            "Erreur retraits"
          )
        );
      }

      const source = findArray(data, [
        "withdrawals",
        "history",
      ]) ?? [];

      const pagination = object(
        data.pagination
      );

      const items = source
        .map(normalizeWithdrawal)
        .filter(
          (item): item is Transaction =>
            item !== null
        );

      return {
        items,
        hasMore:
          pagination.hasNext === true,
      };
    },
    []
  );

  /* ========================================================
     CHARGEMENT INITIAL ET ACTUALISATION
  ======================================================== */

  const loadEverything = useCallback(
    async (
      signal?: AbortSignal,
      silent = false
    ) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const [dashboardResult, withdrawalResult] =
          await Promise.allSettled([
            fetchDashboard(signal),
            fetchWithdrawalPage(
              1,
              withdrawalCurrency,
              signal
            ),
          ]);

        if (signal?.aborted) return;

        if (dashboardResult.status === "fulfilled") {
          setDashboard(dashboardResult.value);
        } else {
          setDashboard({
            ...EMPTY_DASHBOARD,
            error: "Dashboard indisponible",
          });
        }

        if (withdrawalResult.status === "fulfilled") {
          setWithdrawals({
            items: withdrawalResult.value.items,
            hasMore: withdrawalResult.value.hasMore,
            loaded: true,
            error: "",
          });

          setWithdrawalPage(1);
        } else {
          setWithdrawals({
            ...EMPTY_SOURCE,
            error: "Retraits indisponibles",
          });
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      fetchDashboard,
      fetchWithdrawalPage,
      withdrawalCurrency,
    ]
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadEverything(
      controller.signal
    );

    return () => controller.abort();
  }, [loadEverything]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (
        document.visibilityState !== "visible"
      ) {
        return;
      }

      const controller = new AbortController();

      void loadEverything(
        controller.signal,
        true
      );
    }, REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [loadEverything]);

  /* ========================================================
     CHARGER PLUS DE RETRAITS
  ======================================================== */

  async function loadMoreWithdrawals() {
    if (
      loadingMore ||
      !withdrawals.hasMore
    ) {
      return;
    }

    setLoadingMore(true);

    try {
      const nextPage =
        withdrawalPage + 1;

      const next = await fetchWithdrawalPage(
        nextPage,
        withdrawalCurrency
      );

      setWithdrawals((previous) => {
        const merged = new Map(
          previous.items.map(
            (item) => [item.id, item] as const
          )
        );

        for (const item of next.items) {
          merged.set(item.id, item);
        }

        return {
          items: [...merged.values()],
          hasMore: next.hasMore,
          loaded: true,
          error: "",
        };
      });

      setWithdrawalPage(nextPage);
    } catch (error) {
      setWithdrawals((previous) => ({
        ...previous,
        error:
          error instanceof Error
            ? error.message
            : t.error,
      }));
    } finally {
      setLoadingMore(false);
    }
  }

  /* ========================================================
     FUSION DES OPÉRATIONS

     Aucune commission recalculée.
     Aucune transaction inventée.
  ======================================================== */

  const transactions = useMemo(() => {
    const combined = [
      ...dashboard.items,
      ...withdrawals.items,
    ];

    const unique = new Map<
      string,
      Transaction
    >();

    for (const item of combined) {
      unique.set(item.id, item);
    }

    return [...unique.values()].sort(
      (a, b) =>
        (Date.parse(b.date) || 0) -
        (Date.parse(a.date) || 0)
    );
  }, [
    dashboard.items,
    withdrawals.items,
  ]);

  /* ========================================================
     INDICATEURS
  ======================================================== */

  const counts = useMemo(() => {
    return {
      total: transactions.length,
      tickets: transactions.filter(
        (item) => item.type === "TICKET"
      ).length,
      donations: transactions.filter(
        (item) => item.type === "DONATION"
      ).length,
      withdrawals: transactions.filter(
        (item) => item.type === "WITHDRAWAL"
      ).length,
      pending: transactions.filter(
        (item) =>
          item.type === "WITHDRAWAL" &&
          item.status === "PENDING"
      ).length,
      completed: transactions.filter(
        (item) =>
          item.type === "WITHDRAWAL" &&
          item.status === "COMPLETED"
      ).length,
      rejected: transactions.filter(
        (item) =>
          item.type === "WITHDRAWAL" &&
          item.status === "REJECTED"
      ).length,
    };
  }, [transactions]);

  /* ========================================================
     FILTRES
  ======================================================== */

  const filtered = useMemo(() => {
    const normalizedSearch =
      search.trim().toLocaleLowerCase(locale);

    return transactions.filter(
      (item) => {
        if (
          statusFilter !== "ALL" &&
          item.status !== statusFilter
        ) {
          return false;
        }

        if (
          typeFilter !== "ALL" &&
          item.type !== typeFilter
        ) {
          return false;
        }

        if (
          !inPeriod(
            item.date,
            periodFilter,
            startDate,
            endDate
          )
        ) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return [
          item.title,
          item.reference,
          item.description,
          item.person,
          item.rawStatus,
        ]
          .join(" ")
          .toLocaleLowerCase(locale)
          .includes(normalizedSearch);
      }
    );
  }, [
    transactions,
    statusFilter,
    typeFilter,
    periodFilter,
    startDate,
    endDate,
    search,
    locale,
  ]);

  /* ========================================================
     PAGINATION LOCALE
  ======================================================== */

  const totalPages = Math.max(
    1,
    Math.ceil(
      filtered.length / PAGE_SIZE
    )
  );

  const safePage = Math.min(
    currentPage,
    totalPages
  );

  const visibleTransactions =
    filtered.slice(
      (safePage - 1) * PAGE_SIZE,
      safePage * PAGE_SIZE
    );

  function updateFilters(
    callback: () => void
  ) {
    callback();
    setCurrentPage(1);
  }

  /* ========================================================
     SOURCE INCOMPLÈTE
  ======================================================== */

  const hasSourceError =
    !!dashboard.error ||
    !!withdrawals.error;

  /* ========================================================
     INTERFACE
  ======================================================== */

  return (
    <main className="min-h-full w-full min-w-0 overflow-x-hidden bg-[#f9f9fd] pb-2 text-[#191930]">
      {/* EN-TÊTE */}

      <header className="border-b border-[#e7e5f0] bg-white px-3 py-5 sm:px-5 lg:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <ArrowLeftRight
              size={38}
              className="shrink-0 text-[#6e1be0]"
              strokeWidth={2.6}
            />

            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                {t.title}
              </h1>

              <p className="mt-1 text-xs text-[#535475] sm:text-sm">
                {t.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadEverything(
                undefined,
                true
              )
            }
            disabled={refreshing}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#dedbea] bg-white px-4 text-sm font-bold text-[#4b4565] hover:bg-[#f6f2ff] disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />
            {t.refresh}
          </button>
        </div>
      </header>

      <div className="flex w-full min-w-0 flex-col gap-5 p-3 sm:p-5 lg:p-6">
        {/* INDICATEURS */}

        <section className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
          <CounterCard
            title={t.total}
            count={counts.total}
            icon={
              <Wallet
                size={29}
                className="text-[#069a24]"
              />
            }
            className=""
          />

          <CounterCard
            title={t.tickets}
            count={counts.tickets}
            icon={
              <Ticket
                size={29}
                className="text-[#7319d6]"
              />
            }
            className=""
          />

          <CounterCard
            title={t.donations}
            count={counts.donations}
            icon={
              <Heart
                size={29}
                className="text-[#d71139]"
              />
            }
            className=""
          />

          <CounterCard
            title={t.withdrawals}
            count={counts.withdrawals}
            icon={
              <ArrowUpRight
                size={29}
                className="text-[#175d9d]"
              />
            }
            className=""
          />
        </section>

        {/* ONGLETS STATUT */}

        <section className="grid grid-cols-4 gap-1 rounded-2xl border border-[#e4e0ed] bg-white p-1.5 shadow-sm sm:gap-2 sm:p-2">
          {[
            {
              value: "ALL" as const,
              label: t.all,
              count: counts.total,
              icon: <Layers3 size={19} />,
            },
            {
              value: "PENDING" as const,
              label: t.pending,
              count: counts.pending,
              icon: <Clock3 size={19} />,
            },
            {
              value: "COMPLETED" as const,
              label: t.completed,
              count: counts.completed,
              icon: <CheckCircle2 size={19} />,
            },
            {
              value: "REJECTED" as const,
              label: t.rejected,
              count: counts.rejected,
              icon: <XCircle size={19} />,
            },
          ].map((tab) => (
            <button
              type="button"
              key={tab.value}
              onClick={() =>
                updateFilters(() =>
                  setStatusFilter(tab.value)
                )
              }
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-3 text-center text-[11px] font-extrabold transition-colors sm:flex-row sm:gap-2 sm:px-4 sm:text-sm ${
                statusFilter === tab.value
                  ? "bg-linear-to-b from-[#b441ff] to-[#7400dc] text-white shadow-md"
                  : "text-[#24243c] hover:bg-[#f6f1ff]"
              }`}
            >
              {tab.icon}

              <span>
                {tab.label} ({tab.count})
              </span>
            </button>
          ))}
        </section>

        {/* FILTRES */}

        <section className={`${PANEL} p-3 sm:p-4`}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold">
                {t.period}
              </label>

              <select
                value={periodFilter}
                onChange={(event) =>
                  updateFilters(() =>
                    setPeriodFilter(
                      event.target.value as PeriodFilter
                    )
                  )
                }
                className={SELECT}
              >
                <option value="ALL">
                  {t.allPeriods}
                </option>
                <option value="THIS_MONTH">
                  {t.thisMonth}
                </option>
                <option value="PREVIOUS_MONTH">
                  {t.previousMonth}
                </option>
                <option value="THIS_YEAR">
                  {t.thisYear}
                </option>
                <option value="CUSTOM">
                  {t.custom}
                </option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold">
                {t.type}
              </label>

              <select
                value={typeFilter}
                onChange={(event) =>
                  updateFilters(() =>
                    setTypeFilter(
                      event.target.value as FilterType
                    )
                  )
                }
                className={SELECT}
              >
                <option value="ALL">
                  {t.allTypes}
                </option>
                <option value="TICKET">
                  {t.ticketSale}
                </option>
                <option value="DONATION">
                  {t.donation}
                </option>
                <option value="WITHDRAWAL">
                  {t.withdrawal}
                </option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold">
                {t.status}
              </label>

              <select
                value={statusFilter}
                onChange={(event) =>
                  updateFilters(() =>
                    setStatusFilter(
                      event.target.value as FilterStatus
                    )
                  )
                }
                className={SELECT}
              >
                <option value="ALL">
                  {t.all}
                </option>
                <option value="PENDING">
                  {t.pending}
                </option>
                <option value="COMPLETED">
                  {t.completed}
                </option>
                <option value="REJECTED">
                  {t.rejected}
                </option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold">
                {t.search}
              </label>

              <div className="relative">
                <Search
                  size={18}
                  className="absolute top-3.5 left-3 text-[#85859e]"
                />

                <input
                  value={search}
                  onChange={(event) =>
                    updateFilters(() =>
                      setSearch(event.target.value)
                    )
                  }
                  placeholder={t.search}
                  className={`${SELECT} pl-10`}
                />
              </div>
            </div>
          </div>

          {periodFilter === "CUSTOM" && (
            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-[#eeebf4] pt-3 sm:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-xs font-bold">
                  {t.start}
                </span>

                <input
                  type="date"
                  value={startDate}
                  onChange={(event) =>
                    updateFilters(() =>
                      setStartDate(event.target.value)
                    )
                  }
                  className={SELECT}
                />
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-bold">
                  {t.end}
                </span>

                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(event) =>
                    updateFilters(() =>
                      setEndDate(event.target.value)
                    )
                  }
                  className={SELECT}
                />
              </label>
            </div>
          )}
        </section>

        {/* INFORMATIONS SUR LES SOURCES */}

        {hasSourceError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <CircleAlert
              size={19}
              className="shrink-0"
            />

            <div>
              <p className="font-bold">
                {t.incomplete}
              </p>

              {dashboard.error && (
                <p className="mt-1 text-xs">
                  {dashboard.error}
                </p>
              )}

              {withdrawals.error && (
                <p className="mt-1 text-xs">
                  {withdrawals.error}
                </p>
              )}
            </div>
          </div>
        )}

        {/* LISTE DES TRANSACTIONS */}

        <section className={`${PANEL} overflow-hidden`}>
          {loading ? (
            <div
              role="status"
              className="flex min-h-52 items-center justify-center gap-3 text-sm font-semibold text-[#62617e]"
            >
              <LoaderCircle
                size={24}
                className="animate-spin text-[#7423d6]"
              />
              {t.loading}
            </div>
          ) : (
            <>
              {/* TABLEAU PC */}

              <div className="hidden w-full overflow-x-auto lg:block">
                <table className="w-full min-w-197.5 border-collapse text-left">
                  <thead className="bg-[#f1f0f8] text-xs font-extrabold text-[#30304b]">
                    <tr>
                      <th className="px-4 py-4">
                        {t.date}
                      </th>
                      <th className="px-4 py-4">
                        {t.type}
                      </th>
                      <th className="px-4 py-4">
                        {t.details}
                      </th>
                      <th className="px-4 py-4">
                        {t.amount}
                      </th>
                      <th className="px-4 py-4">
                        {t.status}
                      </th>
                      <th className="px-4 py-4">
                        {t.action}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleTransactions.map(
                      (transaction) => (
                        <tr
                          key={transaction.id}
                          className="border-t border-[#eceaf2] text-sm hover:bg-[#faf8ff]"
                        >
                          <td className="whitespace-nowrap px-4 py-4 text-xs font-semibold text-[#464663]">
                            {formatDate(
                              transaction.date,
                              locale
                            )}
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <TypeIcon
                                type={transaction.type}
                              />

                              <span className="text-xs font-bold">
                                {transaction.type ===
                                "TICKET"
                                  ? t.ticketSale
                                  : transaction.type ===
                                      "DONATION"
                                    ? t.donation
                                    : t.withdrawal}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <p className="font-bold">
                              {transaction.title ||
                                t.unknown}
                            </p>

                            {transaction.description && (
                              <p className="mt-1 text-xs text-[#74748f]">
                                {transaction.description}
                              </p>
                            )}
                          </td>

                          <td
                            className={`whitespace-nowrap px-4 py-4 font-extrabold ${
                              transaction.type ===
                              "WITHDRAWAL"
                                ? "text-red-600"
                                : "text-green-700"
                            }`}
                          >
                            {formatMoney(
                              transaction.amountMinor,
                              transaction.currency,
                              locale
                            )}
                          </td>

                          <td className="px-4 py-4">
                            <StatusBadge
                              status={transaction.status}
                              locale={locale}
                            />
                          </td>

                          <td className="px-4 py-4">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedTransaction(
                                  transaction
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-full border border-[#bd91f3] bg-[#faf6ff] px-3 py-2 text-xs font-extrabold text-[#52228d] hover:bg-[#f1e4ff]"
                            >
                              <Eye size={16} />
                              {t.view}
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {/* LISTE MOBILE */}

              <div className="flex flex-col divide-y divide-[#eceaf3] lg:hidden">
                {visibleTransactions.map(
                  (transaction) => (
                    <article
                      key={transaction.id}
                      className="flex min-w-0 items-start gap-3 p-3 sm:p-4"
                    >
                      <div className="mt-1 shrink-0">
                        <TypeIcon
                          type={transaction.type}
                          size={25}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="wrap-break-word text-sm font-extrabold">
                          {transaction.title ||
                            t.unknown}
                        </p>

                        <p className="mt-1 text-xs text-[#666780]">
                          {formatDate(
                            transaction.date,
                            locale
                          )}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`text-sm font-extrabold ${
                              transaction.type ===
                              "WITHDRAWAL"
                                ? "text-red-600"
                                : "text-green-700"
                            }`}
                          >
                            {formatMoney(
                              transaction.amountMinor,
                              transaction.currency,
                              locale
                            )}
                          </span>

                          <StatusBadge
                            status={transaction.status}
                            locale={locale}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setSelectedTransaction(
                            transaction
                          )
                        }
                        className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-[#c8a5f5] bg-[#f8f1ff] px-3 text-xs font-extrabold text-[#5d2999]"
                      >
                        <Eye size={15} />
                        {t.view}
                      </button>
                    </article>
                  )
                )}
              </div>

              {visibleTransactions.length === 0 && (
                <div className="px-5 py-12 text-center text-sm font-semibold text-[#78778f]">
                  {t.noTransactions}
                </div>
              )}
            </>
          )}
        </section>

        {/* PAGINATION */}

        {!loading && totalPages > 1 && (
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs font-semibold text-[#77778e]">
              {t.page} {safePage} {t.of}{" "}
              {totalPages}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() =>
                  setCurrentPage(
                    Math.max(1, safePage - 1)
                  )
                }
                className="flex size-10 items-center justify-center rounded-xl border border-[#e1deeb] bg-white disabled:opacity-40"
              >
                <ChevronLeft size={18} />
              </button>

              <span className="flex size-10 items-center justify-center rounded-xl bg-[#7721da] text-sm font-bold text-white">
                {safePage}
              </span>

              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() =>
                  setCurrentPage(
                    Math.min(
                      totalPages,
                      safePage + 1
                    )
                  )
                }
                className="flex size-10 items-center justify-center rounded-xl border border-[#e1deeb] bg-white disabled:opacity-40"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* CHARGEMENT DES ANCIENS RETRAITS */}

        {!loading && withdrawals.hasMore && (
          <button
            type="button"
            onClick={() =>
              void loadMoreWithdrawals()
            }
            disabled={loadingMore}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#dcd5ed] bg-white text-sm font-bold text-[#6023a1] hover:bg-[#faf6ff] disabled:opacity-50"
          >
            {loadingMore ? (
              <LoaderCircle
                size={18}
                className="animate-spin"
              />
            ) : (
              <RefreshCw size={17} />
            )}

            {loadingMore
              ? t.loadingMore
              : t.loadMore}
          </button>
        )}

        {/* INFORMATION TRANSPARENTE */}

        {!loading && (
          <div className="space-y-1 text-xs leading-relaxed text-[#74758e]">
            <p>{t.transactionCount}</p>

            {dashboard.isPartial && (
              <p>{t.recentOnly}</p>
            )}
          </div>
        )}
      </div>

      {/* ====================================================
          FENÊTRE DÉTAILS

          Les informations sont celles
          réellement reçues de l'API.

          Le bouton ouvre la page métier
          correspondante.
      ==================================================== */}

      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#151126]/60 p-3 sm:p-5">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-details-title"
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#ece8f3] p-4 sm:p-5">
              <h2
                id="transaction-details-title"
                className="text-base font-extrabold sm:text-lg"
              >
                {t.transactionDetails}
              </h2>

              <button
                type="button"
                onClick={() =>
                  setSelectedTransaction(null)
                }
                aria-label={t.close}
                className="flex size-9 items-center justify-center rounded-lg bg-[#f4f2f7]"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <div className="flex items-center gap-3 rounded-xl bg-[#f7f3fe] p-3">
                <TypeIcon
                  type={selectedTransaction.type}
                  size={28}
                />

                <div className="min-w-0">
                  <p className="wrap-break-word font-extrabold">
                    {selectedTransaction.title ||
                      t.unknown}
                  </p>

                  <p className="mt-1 text-xs text-[#6d6682]">
                    {selectedTransaction.type ===
                    "TICKET"
                      ? t.ticketDetails
                      : selectedTransaction.type ===
                          "DONATION"
                        ? t.donationDetails
                        : t.withdrawalDetails}
                  </p>
                </div>
              </div>

              <div className="divide-y divide-[#eceaf3] rounded-xl border border-[#e5e2ee] px-3">
                {[
                  [
                    t.reference,
                    selectedTransaction.reference,
                  ],
                  [
                    t.date,
                    formatDate(
                      selectedTransaction.date,
                      locale
                    ),
                  ],
                  [
                    t.amount,
                    formatMoney(
                      selectedTransaction.amountMinor,
                      selectedTransaction.currency,
                      locale
                    ),
                  ],
                  [
                    t.participant,
                    selectedTransaction.person ||
                      t.unknown,
                  ],
                  [
                    t.details,
                    selectedTransaction.description ||
                      t.unknown,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm"
                  >
                    <span className="text-xs font-semibold text-[#74728b]">
                      {label}
                    </span>

                    <span className="max-w-[65%] break-all text-right text-xs font-extrabold text-[#23223c]">
                      {value}
                    </span>
                  </div>
                ))}

                <div className="flex items-center justify-between gap-2 py-3">
                  <span className="text-xs font-semibold text-[#74728b]">
                    {t.status}
                  </span>

                  <StatusBadge
                    status={
                      selectedTransaction.status
                    }
                    locale={locale}
                  />
                </div>
              </div>

              <Link
                href={
                  selectedTransaction.destinationUrl
                }
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#7420d4] px-4 text-center text-sm font-extrabold text-white hover:bg-[#631ab7]"
              >
                {t.openPage}
                <ArrowUpRight size={18} />
              </Link>

              <button
                type="button"
                onClick={() =>
                  setSelectedTransaction(null)
                }
                className="min-h-10 w-full rounded-xl border border-[#e2ddec] text-sm font-bold text-[#55496d]"
              >
                {t.close}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
