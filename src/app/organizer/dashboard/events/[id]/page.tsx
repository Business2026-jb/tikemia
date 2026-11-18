
"use client";
import {
  isSupportedCurrency,
  SUPPORTED_CURRENCIES,
  currencyDecimals,
  currencySymbol,
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
} from "react";

import Link from "next/link";
import { useParams } from "next/navigation";

import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  Mail,
  MapPin,
  Pencil,
  Phone,
  RefreshCw,
  Search,
  ShoppingBag,
  Ticket,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";



/* ============================================
   TIKEMIA — DÉTAILS D'UN ÉVÉNEMENT

   URL :
   /organizer/dashboard/events/[id]

   API :
   GET /api/organizer/events/[id]

   PDF :
   GET /api/organizer/events/[id]/report

   Affichage :
   - Informations de l'événement
   - Commandes payées
   - Billets vendus
   - Places restantes
   - Chiffre d'affaires
   - Taux de remplissage
   - Ventes par catégorie
   - Liste des commandes
   - Emails et téléphones des acheteurs
   - Téléchargement PDF

   La sécurité des données personnelles
   doit être appliquée par l'API serveur.

   Aucun menu organisateur n'est recréé.
============================================ */

const REFRESH_INTERVAL = 20_000;
const ROWS_PER_PAGE = 10;

type Currency = (typeof SUPPORTED_CURRENCIES)[number];

type NullableNumber = number | null;

type EventStatistics = {
  paidOrders: NullableNumber;
  ticketsSold: NullableNumber;
  remainingSeats: NullableNumber;
  grossRevenue: string | null;
  occupancyRate: NullableNumber;
};

type TicketCategoryDetails = {
  id: string;
  name: string;
  price: string;
  quantity: number;
  sold: NullableNumber;
  remaining: NullableNumber;
  revenue: string | null;
};

type OrderDetails = {
  id: string;
  reference: string;
  email: string;
  phone: string;
  quantity: number;
  amount: string;
  currency: string;
  status: string;
  createdAt: string | null;
};

type BuyerDetails = {
  id: string;
  email: string;
  phone: string;
  orders: number | null;
  tickets: number | null;
};

type EventDetails = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  currency: Currency;
  capacity: number;
  countryCode: string;
  city: string;
  address: string;
  venueName: string;
  timezone: string;
  startDate: string;
  startTime: string;
  endDate: string | null;
  endTime: string | null;
  images: Array<{
    id: string;
    url: string | null;
    position: number;
  }>;
  statistics: EventStatistics;
  ticketCategories: TicketCategoryDetails[];
  orders: OrderDetails[];
  buyers: BuyerDetails[];
  ordersTotal: number | null;
  buyersTotal: number | null;
};

type ApiRecord = Record<string, unknown>;

type Tab = "orders" | "buyers";

/* ============================================
   TRADUCTIONS
============================================ */

const TEXT = {
  fr: {
    title: "Détails de l'événement",
    subtitle:
      "Suivez les commandes, billets et revenus de votre événement.",
    back: "Mes événements",
    edit: "Modifier",
    download: "Télécharger PDF",
    refresh: "Actualiser",
    loading: "Chargement des informations...",
    loadError:
      "Impossible de charger les informations de cet événement.",
    retry: "Réessayer",
    event: "Informations de l'événement",
    location: "Lieu",
    date: "Date",
    endDate: "Fin",
    category: "Catégorie",
    status: "Statut",
    capacity: "Capacité totale",
    orders: "Commandes payées",
    tickets: "Billets vendus",
    remaining: "Places restantes",
    revenue: "Chiffre d'affaires",
    occupancy: "Taux de remplissage",
    sales: "Ventes par catégorie",
    price: "Prix",
    sold: "Vendus",
    available: "Restants",
    quantity: "Quantité",
    orderList: "Commandes",
    buyerList: "Acheteurs",
    reference: "Référence",
    email: "Email",
    phone: "Téléphone",
    amount: "Montant",
    orderStatus: "Statut",
    orderDate: "Date de commande",
    contacts: "Contacts des acheteurs",
    buyerOrders: "Commandes",
    buyerTickets: "Billets",
    searchOrders:
      "Rechercher une commande ou un email...",
    searchBuyers:
      "Rechercher un email ou un téléphone...",
    emptyOrders:
      "Aucune commande disponible pour cet événement.",
    emptyBuyers:
      "Aucun acheteur disponible pour cet événement.",
    noSalesData:
      "Les statistiques des ventes ne sont pas encore disponibles.",
    noImage: "Image indisponible",
    page: "Page",
    of: "sur",
    total: "Total",
    pending: "En attente",
    live: "En vente",
    completed: "Terminé",
    cancelled: "Annulé",
    draft: "Brouillon",
    paid: "Payée",
    refunded: "Remboursée",
    updated: "Dernière actualisation",
    unavailable: "Non disponible",
    
  },

  en: {
    title: "Event details",
    subtitle:
      "Monitor your event orders, tickets and revenue.",
    back: "My events",
    edit: "Edit",
    download: "Download PDF",
    refresh: "Refresh",
    loading: "Loading event information...",
    loadError:
      "Unable to load this event's information.",
    retry: "Try again",
    event: "Event information",
    location: "Location",
    date: "Date",
    endDate: "End",
    category: "Category",
    status: "Status",
    capacity: "Total capacity",
    orders: "Paid orders",
    tickets: "Tickets sold",
    remaining: "Remaining seats",
    revenue: "Revenue",
    occupancy: "Occupancy rate",
    sales: "Sales by category",
    price: "Price",
    sold: "Sold",
    available: "Remaining",
    quantity: "Quantity",
    orderList: "Orders",
    buyerList: "Buyers",
    reference: "Reference",
    email: "Email",
    phone: "Phone",
    amount: "Amount",
    orderStatus: "Status",
    orderDate: "Order date",
    contacts: "Buyer contacts",
    buyerOrders: "Orders",
    buyerTickets: "Tickets",
    searchOrders:
      "Search an order or email...",
    searchBuyers:
      "Search an email or phone...",
    emptyOrders:
      "No orders available for this event.",
    emptyBuyers:
      "No buyers available for this event.",
    noSalesData:
      "Sales statistics are not yet available.",
    noImage: "Image unavailable",
    page: "Page",
    of: "of",
    total: "Total",
    pending: "Pending review",
    live: "On sale",
    completed: "Completed",
    cancelled: "Cancelled",
    draft: "Draft",
    paid: "Paid",
    refunded: "Refunded",
    updated: "Last refreshed",
    unavailable: "Unavailable",
    
  },
} as const;

/* ============================================
   STYLES
============================================ */

const SECTION_CLASS =
  "min-w-0 w-full rounded-2xl border border-[#e1e7ef] bg-white p-3 shadow-sm sm:p-4 lg:p-5";

const HEADER_CLASS =
  "text-base font-extrabold text-[#111c39] sm:text-lg";

/* ============================================
   LECTURE SÉCURISÉE DES DONNÉES JSON
============================================ */

function record(value: unknown): ApiRecord {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as ApiRecord)
    : {};
}

function stringValue(
  value: unknown,
  fallback = ""
): string {
  return typeof value === "string"
    ? value
    : fallback;
}

function optionalNumber(
  value: unknown
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  return value;
}

function nonnegativeNumber(
  value: unknown
): number | null {
  const number = optionalNumber(value);

  return number !== null && number >= 0
    ? number
    : null;
}

function optionalMoney(
  value: unknown
): string | null {
  if (
    typeof value === "string" &&
    /^\d+$/.test(value)
  ) {
    return value;
  }

  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  ) {
    return String(value);
  }

  return null;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function dateValue(value: unknown): string | null {
  return typeof value === "string" &&
    !Number.isNaN(Date.parse(value))
    ? value
    : null;
}

/* ============================================
   ADAPTATION DU CONTRAT API

   Le GET existant fournit les informations
   du formulaire de modification.

   Les statistiques, commandes et acheteurs
   sont des données complémentaires
   attendues du même endpoint.

   Les champs absents restent indisponibles :
   aucune vente fictive n'est calculée.
============================================ */

function normalizeEvent(
  input: unknown
): EventDetails {
  const source = record(input);

  const stats = record(
    source.statistics ?? source.stats
  );

  const currencyValue =
    stringValue(source.currency, "XOF");

  const currency: Currency =
    isSupportedCurrency(currencyValue) ? currencyValue : "XOF";

  const categories = arrayValue(
    source.ticketCategories
  ).map((value, index) => {
    const item = record(value);

    return {
      id: stringValue(item.id, String(index)),
      name: stringValue(item.name),
      price:
        item.price !== undefined &&
        item.price !== null
          ? String(item.price)
          : "0",
      quantity:
        nonnegativeNumber(item.quantity) ?? 0,
      sold: nonnegativeNumber(item.sold),
      remaining:
        nonnegativeNumber(item.remaining),
      revenue: optionalMoney(item.revenue),
    };
  });

  const orders = arrayValue(
    source.orders
  ).map((value, index) => {
    const item = record(value);

    return {
      id: stringValue(item.id, String(index)),
      reference: stringValue(item.reference),
      email: stringValue(item.email),
      phone: stringValue(item.phone),
      quantity:
        nonnegativeNumber(item.quantity) ?? 0,
      amount:
        optionalMoney(item.amount) ?? "0",
      currency:
        stringValue(item.currency, currency),
      status: stringValue(item.status),
      createdAt: dateValue(item.createdAt),
    };
  });

  const buyers = arrayValue(
    source.buyers
  ).map((value, index) => {
    const item = record(value);

    return {
      id: stringValue(item.id, String(index)),
      email: stringValue(item.email),
      phone: stringValue(item.phone),
      orders: nonnegativeNumber(item.orders),
      tickets: nonnegativeNumber(item.tickets),
    };
  });

  const images = arrayValue(
    source.images
  )
    .map((value, index) => {
      const item = record(value);

      return {
        id: stringValue(item.id, String(index)),
        url:
          typeof item.url === "string"
            ? item.url
            : null,
        position:
          optionalNumber(item.position) ?? index,
      };
    })
    .sort((a, b) => a.position - b.position);

  return {
    id: stringValue(source.id),
    title: stringValue(source.title),
    description: stringValue(source.description),
    category: stringValue(source.category),
    status: stringValue(source.status),
    currency,
    capacity:
      nonnegativeNumber(source.capacity) ?? 0,
    countryCode:
      stringValue(source.countryCode),
    city: stringValue(source.city),
    address: stringValue(source.address),
    venueName: stringValue(source.venueName),
    timezone: stringValue(source.timezone, "UTC"),
    startDate: stringValue(source.startDate),
    startTime: stringValue(source.startTime),
    endDate:
      typeof source.endDate === "string"
        ? source.endDate
        : null,
    endTime:
      typeof source.endTime === "string"
        ? source.endTime
        : null,
    images,
    statistics: {
      paidOrders:
        nonnegativeNumber(
          stats.paidOrders
        ),
      ticketsSold:
        nonnegativeNumber(
          stats.ticketsSold
        ),
      remainingSeats:
        nonnegativeNumber(
          stats.remainingSeats
        ),
      grossRevenue:
        optionalMoney(stats.grossRevenue),
      occupancyRate:
        nonnegativeNumber(
          stats.occupancyRate
        ),
    },
    ticketCategories: categories,
    orders,
    buyers,
    ordersTotal:
      nonnegativeNumber(source.ordersTotal),
    buyersTotal:
      nonnegativeNumber(source.buyersTotal),
  };
}

/* ============================================
   FORMATAGE
============================================ */

function formatNumber(
  value: number | null,
  locale: Locale
): string {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat(
    locale === "fr" ? "fr-FR" : "en-US"
  ).format(value);
}

function formatMoney(
  amount: string | null,
  currency: string,
  locale: Locale
): string {
  if (amount === null) return "\u2014";
  try {
    const minorAmount = BigInt(amount);
    const decimals = currencyDecimals(currency);
    const factor = decimals ? 100n : 1n;
    const absolute = minorAmount < 0n ? -minorAmount : minorAmount;
    const whole = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US").format(absolute / factor);
    const fraction = decimals ? (locale === "fr" ? "," : ".") + String(absolute % factor).padStart(2, "0") : "";
    return (minorAmount < 0n ? "-" : "") + whole + fraction + " " + (currencySymbol(currency));
  } catch { return "\u2014"; }
}

function statusText(
  status: string,
  locale: Locale
): string {
  const t = TEXT[locale];

  switch (status.toUpperCase()) {
    case "PUBLISHED":
    case "ON_SALE":
    case "ACTIVE":
      return t.live;

    case "COMPLETED":
    case "FINISHED":
      return t.completed;

    case "CANCELLED":
      return t.cancelled;

    case "DRAFT":
      return t.draft;

    case "PAID":
      return t.paid;

    case "REFUNDED":
      return t.refunded;

    case "PENDING_REVIEW":
    case "PENDING":
      return t.pending;

    default:
      return status || "—";
  }
}

function statusClass(status: string): string {
  switch (status.toUpperCase()) {
    case "ACTIVE":
    case "ON_SALE":
    case "PUBLISHED":
    case "PAID":
      return "bg-green-100 text-green-800";

    case "COMPLETED":
    case "FINISHED":
      return "bg-blue-100 text-blue-800";

    case "CANCELLED":
    case "REFUNDED":
      return "bg-red-100 text-red-700";

    default:
      return "bg-amber-100 text-amber-800";
  }
}

/* ============================================
   COMPOSANT STATISTIQUE
============================================ */

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  background,
}: {
  icon: typeof Ticket;
  label: string;
  value: string;
  color: string;
  background: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-[#e0e7f1] bg-white p-3 shadow-sm sm:p-4">
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-xl sm:size-12"
        style={{
          color,
          backgroundColor: background,
        }}
      >
        <Icon
          size={23}
          strokeWidth={2.2}
          aria-hidden="true"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs leading-snug font-semibold text-[#536079] sm:text-sm">
          {label}
        </p>

        <p className="mt-1 wrap-anywhere text-lg leading-tight font-extrabold text-[#121a38] sm:text-xl xl:text-2xl">
          {value}
        </p>
      </div>
    </div>
  );
}

/* ============================================
   COMPOSANT DE PAGINATION
============================================ */

function Pagination({
  page,
  totalPages,
  onChange,
  locale,
}: {
  page: number;
  totalPages: number;
  onChange: (value: number) => void;
  locale: Locale;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-3 border-t border-[#e6eaf0] px-3 py-4">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() =>
          onChange(Math.max(1, page - 1))
        }
        aria-label="Previous page"
        className="flex size-9 items-center justify-center rounded-lg border border-gray-200 text-[#172346] disabled:opacity-40"
      >
        <ChevronLeft size={19} />
      </button>

      <span className="text-xs font-bold text-[#26334e] sm:text-sm">
        {TEXT[locale].page} {page}{" "}
        {TEXT[locale].of} {totalPages}
      </span>

      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() =>
          onChange(
            Math.min(totalPages, page + 1)
          )
        }
        aria-label="Next page"
        className="flex size-9 items-center justify-center rounded-lg border border-gray-200 text-[#172346] disabled:opacity-40"
      >
        <ChevronRight size={19} />
      </button>
    </div>
  );
}

/* ============================================
   PAGE PRINCIPALE
============================================ */

export default function EventDetailsPage() {
  const params = useParams<{
    id: string;
  }>();

  const eventId =
    typeof params.id === "string"
      ? params.id
      : "";

  const [locale, setLocale] =
    useState<Locale>(defaultLocale);

  const [event, setEvent] =
    useState<EventDetails | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [activeTab, setActiveTab] =
    useState<Tab>("orders");

  const [search, setSearch] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [, setLastUpdated] =
    useState<Date | null>(null);

  const [activeRecordId, setActiveRecordId] = useState(eventId);
  if (activeRecordId !== eventId) {
    setActiveRecordId(eventId);
    setEvent(null);
    setLoading(true);
    setError("");
  }

  const t = TEXT[locale];

  /* ==========================================
     LANGUE
  ========================================== */

  useEffect(() => {
    function readLocale() {
      try {
        const saved =
          window.localStorage.getItem(
            i18nConfig.storageKey
          );

        if (saved) {
          setLocale(
            normalizeLocale(saved)
          );
        }
      } catch {
        // Langue par défaut.
      }
    }

    readLocale();

    window.addEventListener(
      "storage",
      readLocale
    );

    window.addEventListener(
      "focus",
      readLocale
    );

    return () => {
      window.removeEventListener(
        "storage",
        readLocale
      );

      window.removeEventListener(
        "focus",
        readLocale
      );
    };
  }, []);

  /* ==========================================
     CHARGER LES DONNÉES DE L'ÉVÉNEMENT
  ========================================== */

  const fetchDetailsRequest = useCallback(
    async (
      signal?: AbortSignal,
      _background = false
    ) => {
      void _background;
      
        return fetch(
          `/api/organizer/events/${encodeURIComponent(eventId)}?details=1`,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            signal,
          }
        ).then(async (response) => {

        const result: unknown =
          await response.json();

        const data = record(result);

        if (
          !response.ok ||
          data.success !== true ||
          !data.event
        ) {
          throw new Error(
            stringValue(
              data.message,
              TEXT.fr.loadError
            )
          );
        }

        const normalized =
          normalizeEvent(data.event);

        if (
          !normalized.id ||
          normalized.id !== eventId
        ) {
          throw new Error(
            TEXT.fr.loadError
          );
        }

        if (signal?.aborted) {
          return;
        }

        setEvent(normalized);
        setLastUpdated(new Date());
        setError("");
      
}).catch((caughtError) => {
        if (signal?.aborted) {
          return;
        }

        if (
          caughtError instanceof Error &&
          caughtError.name === "AbortError"
        ) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : TEXT.fr.loadError
        );
      }).finally(() => {
        if (!signal?.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    },
    [eventId]
  );
const fetchDetails = useCallback((signal?: AbortSignal, background = false) => {
if (background) setRefreshing(true); else setLoading(true);
return fetchDetailsRequest(signal, background);
}, [fetchDetailsRequest]);


  /* ==========================================
     CHARGEMENT ET ACTUALISATION
  ========================================== */

  useEffect(() => {
    const controller =
      new AbortController();

    void fetchDetailsRequest(controller.signal);

    return () => controller.abort();
  }, [fetchDetailsRequest]);

  useEffect(() => {
    if (!eventId) {
      return;
    }

    let busy = false;

    const interval = window.setInterval(
      async () => {
        if (
          document.visibilityState !== "visible" ||
          busy
        ) {
          return;
        }

        busy = true;

        try {
          await fetchDetails(
            undefined,
            true
          );
        } finally {
          busy = false;
        }
      },
      REFRESH_INTERVAL
    );

    return () =>
      window.clearInterval(interval);
  }, [eventId, fetchDetails]);

  /* ==========================================
     STATISTIQUES
  ========================================== */

  const stats =
    event?.statistics ?? null;

  const occupancy =
    stats?.occupancyRate !== null &&
    stats?.occupancyRate !== undefined
      ? Math.min(
          100,
          Math.max(
            0,
            stats.occupancyRate
          )
        )
      : null;

  const startDisplay =
    event?.startDate
      ? `${event.startDate}${
          event.startTime
            ? ` · ${event.startTime}`
            : ""
        }`
      : "—";

  const endDisplay =
    event?.endDate
      ? `${event.endDate}${
          event.endTime
            ? ` · ${event.endTime}`
            : ""
        }`
      : null;

  /* ==========================================
     RECHERCHE ET PAGINATION
  ========================================== */

  const filteredOrders = useMemo(() => {
    if (!event) {
      return [];
    }

    const query = search
      .trim()
      .toLowerCase();

    if (!query) {
      return event.orders;
    }

    return event.orders.filter((order) =>
      [
        order.reference,
        order.email,
        order.phone,
        order.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [event, search]);

  const filteredBuyers = useMemo(() => {
    if (!event) {
      return [];
    }

    const query = search
      .trim()
      .toLowerCase();

    if (!query) {
      return event.buyers;
    }

    return event.buyers.filter((buyer) =>
      [
        buyer.email,
        buyer.phone,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [event, search]);

  const activeItems =
    activeTab === "orders"
      ? filteredOrders
      : filteredBuyers;

  const totalPages = Math.max(
    1,
    Math.ceil(
      activeItems.length /
        ROWS_PER_PAGE
    )
  );

  const currentPage = Math.min(
    page,
    totalPages
  );

  const visibleOrders =
    filteredOrders.slice(
      (currentPage - 1) *
        ROWS_PER_PAGE,
      currentPage *
        ROWS_PER_PAGE
    );

  const visibleBuyers =
    filteredBuyers.slice(
      (currentPage - 1) *
        ROWS_PER_PAGE,
      currentPage *
        ROWS_PER_PAGE
    );

  function changeTab(tab: Tab) {
    setActiveTab(tab);
    setSearch("");
    setPage(1);
  }

  /* ==========================================
     CHARGEMENT INITIAL
  ========================================== */

  if (loading && !event) {
    return (
      <main className="flex min-h-full w-full items-center justify-center bg-[#f6f8fc] p-6">
        <div
          role="status"
          className="flex flex-col items-center gap-3 text-center"
        >
          <LoaderCircle
            size={36}
            className="animate-spin text-green-700"
          />
          <p className="text-sm font-semibold text-gray-600">
            {t.loading}
          </p>
        </div>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="flex min-h-full w-full flex-col items-center justify-center gap-4 bg-[#f6f8fc] p-5 text-center">
        <XCircle
          size={42}
          className="text-red-600"
        />

        <p
          role="alert"
          className="text-sm font-bold text-red-700"
        >
          {error || t.loadError}
        </p>

        <button
          type="button"
          onClick={() =>
            void fetchDetails()
          }
          className="rounded-xl bg-green-700 px-5 py-3 text-sm font-extrabold text-white"
        >
          {t.retry}
        </button>

        <Link
          href="/organizer/dashboard/events"
          className="text-sm font-semibold text-green-800 underline"
        >
          {t.back}
        </Link>
      </main>
    );
  }

  /* ==========================================
     RENDU PRINCIPAL
  ========================================== */

  return (
    <main className="flex min-h-full w-full min-w-0 flex-col overflow-x-hidden bg-[#f6f8fc] pb-5 text-[#101828]">
      {/* ======================================
          EN-TÊTE
      ====================================== */}

      <div className="w-full border-b border-[#e5e9ef] bg-white px-3 py-4 sm:px-5 lg:px-6 lg:py-5">
        <div className="flex w-full min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/organizer/dashboard/events"
              aria-label={t.back}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-800 transition-colors hover:bg-green-100"
            >
              <ArrowLeft size={23} />
            </Link>

            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#e8ffe3] text-green-700">
              <CalendarDays
                size={27}
                strokeWidth={2.2}
              />
            </div>

            <div className="min-w-0">
              <h1 className="text-xl leading-tight font-extrabold text-[#0e1839] sm:text-2xl lg:text-3xl">
                {t.title}
              </h1>

              <p className="mt-1 text-xs text-[#52617a] sm:text-sm">
                {t.subtitle}
              </p>
            </div>
          </div>

          {/* ACTIONS */}

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <button
              type="button"
              onClick={() =>
                void fetchDetails(
                  undefined,
                  true
                )
              }
              disabled={refreshing}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d8dfeb] bg-white px-3 text-xs font-bold text-[#132341] hover:bg-gray-50 disabled:opacity-50 sm:text-sm"
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

            <Link
              href={`/organizer/dashboard/publish-event?edit=${encodeURIComponent(
                event.id
              )}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 text-xs font-extrabold text-green-800 hover:bg-green-100 sm:text-sm"
            >
              <Pencil size={17} />
              {t.edit}
            </Link>

            <a
              href={`/api/organizer/events/${encodeURIComponent(
                event.id
              )}/report?locale=${locale}`}
              className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-linear-to-b from-[#28c900] to-[#08791b] px-4 text-xs font-extrabold text-white shadow-sm hover:brightness-110 sm:text-sm"
            >
              <Download size={19} />
              {t.download}
            </a>
          </div>
        </div>
      </div>

      {/* ======================================
          CONTENU PLEINE LARGEUR
      ====================================== */}

      <div className="flex w-full min-w-0 flex-1 flex-col gap-3 p-3 sm:p-4 lg:gap-4 lg:p-5">
        {/* ERREUR D'ACTUALISATION */}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          >
            {error}
          </div>
        )}

        {/* ====================================
            INFORMATIONS DE L'ÉVÉNEMENT
        ==================================== */}

        <section className={SECTION_CLASS}>
          <div className="flex w-full min-w-0 flex-col gap-4 sm:flex-row">
            {/* IMAGE */}

            <div className="flex h-45 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#e8edf3] sm:h-43 sm:w-56 lg:h-48 lg:w-72">
              {event.images[0]?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={event.images[0].url}
                  alt={event.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <Eye size={30} />
                  <span className="text-xs">
                    {t.noImage}
                  </span>
                </div>
              )}
            </div>

            {/* INFORMATIONS */}

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="min-w-0 text-lg font-extrabold wrap-anywhere text-[#111a38] sm:text-xl lg:text-2xl">
                  {event.title}
                </h2>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-extrabold ${statusClass(
                    event.status
                  )}`}
                >
                  {statusText(
                    event.status,
                    locale
                  )}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <p className="flex items-center gap-2 text-[#40506b]">
                  <CalendarDays
                    size={17}
                    className="shrink-0 text-green-700"
                  />
                  {startDisplay}
                </p>

                <p className="flex items-center gap-2 text-[#40506b]">
                  <MapPin
                    size={17}
                    className="shrink-0 text-green-700"
                  />
                  {[
                    event.venueName,
                    event.address,
                    event.city,
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </p>

                {endDisplay && (
                  <p className="flex items-center gap-2 text-[#40506b]">
                    <Clock3
                      size={17}
                      className="shrink-0 text-green-700"
                    />
                    {t.endDate} : {endDisplay}
                  </p>
                )}

                <p className="text-[#40506b]">
                  <span className="font-bold">
                    {t.category} :
                  </span>{" "}
                  {event.category || "—"}
                </p>

                <p className="text-[#40506b]">
                  <span className="font-bold">
                    {t.capacity} :
                  </span>{" "}
                  {formatNumber(
                    event.capacity,
                    locale
                  )}
                </p>
              </div>

              {event.description && (
                <p className="mt-3 line-clamp-4 text-xs leading-relaxed text-[#536078] sm:text-sm">
                  {event.description}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ====================================
            STATISTIQUES
        ==================================== */}

        <section className="grid w-full min-w-0 grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            icon={ShoppingBag}
            label={t.orders}
            value={formatNumber(
              stats?.paidOrders ?? null,
              locale
            )}
            color="#7031be"
            background="#f2eafb"
          />

          <StatCard
            icon={Ticket}
            label={t.tickets}
            value={formatNumber(
              stats?.ticketsSold ?? null,
              locale
            )}
            color="#0a8d33"
            background="#e6f9e9"
          />

          <StatCard
            icon={Users}
            label={t.remaining}
            value={formatNumber(
              stats?.remainingSeats ?? null,
              locale
            )}
            color="#df8b00"
            background="#fff4d9"
          />

          <StatCard
            icon={Wallet}
            label={t.revenue}
            value={formatMoney(
              stats?.grossRevenue ?? null,
              event.currency,
              locale
            )}
            color="#066f38"
            background="#e0f6e8"
          />

          <StatCard
            icon={TrendingUp}
            label={t.occupancy}
            value={
              occupancy === null
                ? "—"
                : `${Math.round(occupancy)} %`
            }
            color="#762ac3"
            background="#f1e8fd"
          />
        </section>

        {/* ====================================
            PROGRESSION DES VENTES
        ==================================== */}

        <section className={SECTION_CLASS}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={HEADER_CLASS}>
              {t.occupancy}
            </h2>

            <span className="font-extrabold text-green-800">
              {occupancy === null
                ? "—"
                : `${Math.round(occupancy)} %`}
            </span>
          </div>

          <div
            role="progressbar"
            aria-label={t.occupancy}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={
              occupancy ?? undefined
            }
            className="mt-3 h-3 w-full overflow-hidden rounded-full bg-[#e6e9f0]"
          >
            <div
              className="h-full rounded-full bg-linear-to-r from-[#088a27] to-[#85d500] transition-all"
              style={{
                width:
                  occupancy === null
                    ? "0%"
                    : `${occupancy}%`,
              }}
            />
          </div>

          <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs font-semibold text-[#58657a]">
            <span>
              {t.tickets} :{" "}
              {formatNumber(
                stats?.ticketsSold ?? null,
                locale
              )}
            </span>

            <span>
              {t.remaining} :{" "}
              {formatNumber(
                stats?.remainingSeats ?? null,
                locale
              )}
            </span>
          </div>
        </section>

        {/* ====================================
            VENTES PAR CATÉGORIE
        ==================================== */}

        <section className={SECTION_CLASS}>
          <div className="mb-4 flex items-center gap-2">
            <Ticket
              size={23}
              className="text-green-700"
            />
            <h2 className={HEADER_CLASS}>
              {t.sales}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {event.ticketCategories.map(
              (category) => {
                const percent =
                  category.sold !== null &&
                  category.quantity > 0
                    ? Math.min(
                        100,
                        (category.sold /
                          category.quantity) *
                          100
                      )
                    : null;

                return (
                  <div
                    key={category.id}
                    className="rounded-xl border border-[#e0e6ee] bg-[#fcfdff] p-3 sm:p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-extrabold text-[#13213d]">
                        {category.name}
                      </h3>

                      <span className="text-xs font-extrabold text-green-800">
                        {formatMoney(
                          category.price,
                          event.currency,
                          locale
                        )}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">
                          {t.sold}
                        </p>
                        <p className="text-lg font-extrabold text-[#111a38]">
                          {formatNumber(
                            category.sold,
                            locale
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">
                          {t.available}
                        </p>
                        <p className="text-lg font-extrabold text-[#111a38]">
                          {formatNumber(
                            category.remaining,
                            locale
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#e8eaf0]">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-green-700 to-lime-400"
                        style={{
                          width:
                            percent === null
                              ? "0%"
                              : `${percent}%`,
                        }}
                      />
                    </div>

                    <p className="mt-2 text-right text-xs font-bold text-green-800">
                      {percent === null
                        ? "—"
                        : `${Math.round(percent)} %`}
                    </p>
                  </div>
                );
              }
            )}
          </div>

          {event.ticketCategories.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500">
              {t.noSalesData}
            </p>
          )}
        </section>

        {/* ====================================
            COMMANDES ET ACHETEURS
        ==================================== */}

        <section className={`${SECTION_CLASS} p-0!`}>
          <div className="flex flex-col gap-3 border-b border-[#e4e9f0] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  changeTab("orders")
                }
                className={`rounded-xl px-4 py-2.5 text-sm font-extrabold transition-colors ${
                  activeTab === "orders"
                    ? "bg-green-700 text-white"
                    : "bg-[#f0f3f8] text-[#33425c]"
                }`}
              >
                <ShoppingBag
                  size={16}
                  className="mr-2 inline-block"
                />
                {t.orderList}
              </button>

              <button
                type="button"
                onClick={() =>
                  changeTab("buyers")
                }
                className={`rounded-xl px-4 py-2.5 text-sm font-extrabold transition-colors ${
                  activeTab === "buyers"
                    ? "bg-green-700 text-white"
                    : "bg-[#f0f3f8] text-[#33425c]"
                }`}
              >
                <Users
                  size={16}
                  className="mr-2 inline-block"
                />
                {t.buyerList}
              </button>
            </div>

            <div className="relative min-w-0 sm:w-80">
              <Search
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-500"
              />

              <input
                type="search"
                value={search}
                onChange={(inputEvent) => {
                  setSearch(
                    inputEvent.target.value
                  );
                  setPage(1);
                }}
                placeholder={
                  activeTab === "orders"
                    ? t.searchOrders
                    : t.searchBuyers
                }
                className="h-11 w-full min-w-0 rounded-xl border border-[#ced8e4] bg-white pr-3 pl-10 text-sm outline-none placeholder:text-gray-400 focus:border-green-600 focus:ring-2 focus:ring-green-100"
              />
            </div>
          </div>

          {/* COMMANDES */}

          {activeTab === "orders" && (
            <>
              {/* TABLEAU PC */}

              <div className="hidden w-full overflow-x-auto lg:block">
                <table className="w-full min-w-185 border-collapse text-left text-sm">
                  <thead className="bg-[#f5f7fb] text-xs font-bold text-[#46556d]">
                    <tr>
                      <th className="px-4 py-3">
                        {t.reference}
                      </th>
                      <th className="px-4 py-3">
                        {t.email}
                      </th>
                      <th className="px-4 py-3">
                        {t.phone}
                      </th>
                      <th className="px-4 py-3">
                        {t.quantity}
                      </th>
                      <th className="px-4 py-3">
                        {t.amount}
                      </th>
                      <th className="px-4 py-3">
                        {t.orderStatus}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleOrders.map(
                      (order) => (
                        <tr
                          key={order.id}
                          className="border-t border-[#edf0f5] hover:bg-[#fafdfb]"
                        >
                          <td className="px-4 py-3 font-bold text-[#15233e]">
                            {order.reference || "—"}
                          </td>

                          <td className="px-4 py-3 text-[#40506b]">
                            {order.email || "—"}
                          </td>

                          <td className="px-4 py-3 text-[#40506b]">
                            {order.phone || "—"}
                          </td>

                          <td className="px-4 py-3 font-semibold">
                            {formatNumber(
                              order.quantity,
                              locale
                            )}
                          </td>

                          <td className="px-4 py-3 font-bold">
                            {formatMoney(
                              order.amount,
                              order.currency,
                              locale
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(
                                order.status
                              )}`}
                            >
                              {statusText(
                                order.status,
                                locale
                              )}
                            </span>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {/* CARTES MOBILE */}

              <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:hidden">
                {visibleOrders.map(
                  (order) => (
                    <div
                      key={order.id}
                      className="rounded-xl border border-[#e2e7ef] bg-[#fafbfe] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-extrabold text-[#121c37]">
                          {order.reference || "—"}
                        </span>

                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-bold ${statusClass(
                            order.status
                          )}`}
                        >
                          {statusText(
                            order.status,
                            locale
                          )}
                        </span>
                      </div>

                      <p className="mt-3 flex min-w-0 items-center gap-2 break-all text-xs text-[#4d5c71]">
                        <Mail size={15} className="shrink-0" />
                        {order.email || "—"}
                      </p>

                      <p className="mt-2 flex items-center gap-2 text-xs text-[#4d5c71]">
                        <Phone size={15} className="shrink-0" />
                        {order.phone || "—"}
                      </p>

                      <div className="mt-3 flex items-center justify-between border-t border-[#e2e7ef] pt-3">
                        <span className="text-xs font-semibold text-gray-600">
                          {order.quantity} {t.tickets.toLowerCase()}
                        </span>

                        <span className="text-sm font-extrabold text-green-800">
                          {formatMoney(
                            order.amount,
                            order.currency,
                            locale
                          )}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>

              {filteredOrders.length === 0 && (
                <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                  <FileText
                    size={32}
                    className="text-gray-400"
                  />

                  <p className="text-sm text-gray-500">
                    {t.emptyOrders}
                  </p>
                </div>
              )}
            </>
          )}

          {/* ACHETEURS */}

          {activeTab === "buyers" && (
            <>
              <div className="hidden w-full overflow-x-auto lg:block">
                <table className="w-full min-w-145 border-collapse text-left text-sm">
                  <thead className="bg-[#f5f7fb] text-xs font-bold text-[#46556d]">
                    <tr>
                      <th className="px-4 py-3">
                        {t.email}
                      </th>
                      <th className="px-4 py-3">
                        {t.phone}
                      </th>
                      <th className="px-4 py-3">
                        {t.buyerOrders}
                      </th>
                      <th className="px-4 py-3">
                        {t.buyerTickets}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleBuyers.map(
                      (buyer) => (
                        <tr
                          key={buyer.id}
                          className="border-t border-[#edf0f5] hover:bg-[#fafdfb]"
                        >
                          <td className="px-4 py-3 font-semibold text-[#172540]">
                            {buyer.email || "—"}
                          </td>

                          <td className="px-4 py-3 text-[#40506b]">
                            {buyer.phone || "—"}
                          </td>

                          <td className="px-4 py-3 font-bold">
                            {formatNumber(
                              buyer.orders,
                              locale
                            )}
                          </td>

                          <td className="px-4 py-3 font-bold">
                            {formatNumber(
                              buyer.tickets,
                              locale
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:hidden">
                {visibleBuyers.map(
                  (buyer) => (
                    <div
                      key={buyer.id}
                      className="rounded-xl border border-[#e2e7ef] bg-[#fafbfe] p-3"
                    >
                      <p className="flex min-w-0 items-start gap-2 break-all text-sm font-semibold text-[#14213d]">
                        <Mail
                          size={17}
                          className="mt-0.5 shrink-0 text-green-700"
                        />
                        {buyer.email || "—"}
                      </p>

                      <p className="mt-3 flex items-center gap-2 text-sm text-[#4b5970]">
                        <Phone
                          size={17}
                          className="shrink-0"
                        />
                        {buyer.phone || "—"}
                      </p>

                      <div className="mt-3 flex justify-between gap-3 border-t border-[#e2e7ef] pt-3 text-xs">
                        <span>
                          {t.buyerOrders} :{" "}
                          <b>
                            {formatNumber(
                              buyer.orders,
                              locale
                            )}
                          </b>
                        </span>

                        <span>
                          {t.buyerTickets} :{" "}
                          <b>
                            {formatNumber(
                              buyer.tickets,
                              locale
                            )}
                          </b>
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>

              {filteredBuyers.length === 0 && (
                <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                  <Users
                    size={32}
                    className="text-gray-400"
                  />

                  <p className="text-sm text-gray-500">
                    {t.emptyBuyers}
                  </p>
                </div>
              )}
            </>
          )}

          <Pagination
            page={currentPage}
            totalPages={totalPages}
            onChange={setPage}
            locale={locale}
          />
        </section>

        {/* ====================================
            INFORMATIONS DE RAFRAÎCHISSEMENT
        ==================================== */}

        
      </div>
    </main>
  );
}
