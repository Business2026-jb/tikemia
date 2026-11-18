"use client";
import {
  SUPPORTED_CURRENCIES,
  currencyDecimals,
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
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Ticket,
  Trash2,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";


/* TIKEMIA — /organizer/dashboard/events
   Header, sidebar and mobile navigation belong to dashboard/layout.tsx.
   Data: GET /api/organizer/events; removal: DELETE /api/organizer/events/:id.
*/

type EventStatus =
  | "all" | "PUBLISHED" | "PENDING_REVIEW" | "DRAFT"
  | "COMPLETED" | "CANCELLED" | "REJECTED" | "SUSPENDED";
type Sort = "recent" | "oldest" | "title_asc" | "title_desc";
type EventItem = {
  id: string;
  title: string;
  status: string;
  currency: string;
  capacity: number;
  ticketsSold: number;
  remainingSeats: number;
  progressPercent: number;
  imageUrl: string | null;
  venue: string | null;
  address: string | null;
  city: string | null;
  startsAt: string | null;
  endsAt: string | null;
};
type Statistics = {
  ticketsSold: number;
  revenue: string | null;
  currency: string | null;
  revenueByCurrency: Record<string, string>;
  eventsOnSale: number;
  completedEvents: number;
  totalEvents: number;
};
type PaginationData = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
type EventsResponse = {
  success: boolean;
  message?: string;
  events?: EventItem[];
  stats?: Statistics;
  pagination?: PaginationData;
  updatedAt?: string;
};

const PAGE_SIZE = 8;
const REFRESH_MS = 20_000;
const TEXT = {
  fr: {
    title: "Mes événements",
    subtitle: "Gérez, modifiez et suivez vos événements.",
    publish: "Publier un événement",
    sold: "Billets vendus",
    revenue: "Chiffre d'affaires",
    live: "Événements en vente",
    finished: "Événements terminés",
    search: "Rechercher un événement...",
    all: "Tous les statuts",
    published: "En vente",
    pending: "En attente",
    draft: "Brouillon",
    completed: "Terminé",
    cancelled: "Annulé",
    rejected: "Refusé",
    suspended: "Suspendu",
    recent: "Plus récents",
    oldest: "Plus anciens",
    ascending: "Nom : A à Z",
    descending: "Nom : Z à A",
    view: "Voir",
    edit: "Modifier",
    delete: "Supprimer",
    ticketProgress: "billets vendus",
    remaining: "places restantes",
    noPhoto: "Sans image",
    emptyTitle: "Aucun événement trouvé",
    emptyBody: "Modifiez vos filtres ou publiez votre premier événement.",
    loading: "Chargement des événements...",
    error: "Impossible de charger vos événements.",
    retry: "Réessayer",
    update: "Actualiser",
    deleteTitle: "Supprimer cet événement ?",
    deleteMessage: "Cette action retirera l'événement de la publication. Les événements ayant des commandes ne peuvent pas être supprimés directement.",
    cancel: "Annuler",
    confirm: "Confirmer la suppression",
    deleting: "Suppression...",
    removed: "L'événement a été retiré de la publication.",
    page: "Page",
    of: "sur",
    events: "événements",
    results: "Résultats",
    allCurrencies: "Toutes les devises",
    multiCurrency: "Plusieurs devises",
    refreshed: "Mise à jour",
  },
  en: {
    title: "My events",
    subtitle: "Manage, edit and track your events.",
    publish: "Publish an event",
    sold: "Tickets sold",
    revenue: "Revenue",
    live: "Events on sale",
    finished: "Completed events",
    search: "Search for an event...",
    all: "All statuses",
    published: "On sale",
    pending: "Pending review",
    draft: "Draft",
    completed: "Completed",
    cancelled: "Cancelled",
    rejected: "Rejected",
    suspended: "Suspended",
    recent: "Newest first",
    oldest: "Oldest first",
    ascending: "Name: A to Z",
    descending: "Name: Z to A",
    view: "View",
    edit: "Edit",
    delete: "Delete",
    ticketProgress: "tickets sold",
    remaining: "seats remaining",
    noPhoto: "No image",
    emptyTitle: "No events found",
    emptyBody: "Change your filters or publish your first event.",
    loading: "Loading events...",
    error: "Unable to load your events.",
    retry: "Try again",
    update: "Refresh",
    deleteTitle: "Remove this event?",
    deleteMessage: "This removes the event from publication. Events with orders cannot be deleted directly.",
    cancel: "Cancel",
    confirm: "Confirm removal",
    deleting: "Removing...",
    removed: "The event has been removed from publication.",
    page: "Page",
    of: "of",
    events: "events",
    results: "Results",
    allCurrencies: "All currencies",
    multiCurrency: "Multiple currencies",
    refreshed: "Updated",
  },
} as const;

function formatNumber(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US").format(value);
}
function formatMoney(raw: string | null, currency: string | null, locale: Locale) {
  if (raw === null || !currency || !/^\d+$/.test(raw)) return "—";
  try {
    const decimals = currencyDecimals(currency);
    const total = BigInt(raw);
    const divisor = 10n ** BigInt(decimals);
    const integral = total / divisor;
    const remainder = total % divisor;
    const fraction = decimals ? `${locale === "fr" ? "," : "."}${String(remainder).padStart(decimals, "0")}` : "";
    return `${new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US").format(integral)}${fraction} ${currencySymbol(currency)}`;
  } catch {
    return "—";
  }
}
function readableDate(value: string | null, locale: Locale) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    day: "numeric", month: "short", year: "numeric",
  }).format(parsed);
}
function validImageUrl(value: string | null): value is string {
  if (!value) return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
function statusLabel(status: string, locale: Locale) {
  const t = TEXT[locale];
  const labels: Record<string, string> = {
    PUBLISHED: t.published, ON_SALE: t.published, ACTIVE: t.published,
    PENDING_REVIEW: t.pending, DRAFT: t.draft,
    COMPLETED: t.completed, FINISHED: t.completed,
    CANCELLED: t.cancelled, REJECTED: t.rejected, SUSPENDED: t.suspended,
  };
  return labels[status] ?? status;
}
function statusStyle(status: string) {
  if (["PUBLISHED", "ON_SALE", "ACTIVE"].includes(status)) return "bg-[#dcfbe1] text-[#066e1e]";
  if (["COMPLETED", "FINISHED"].includes(status)) return "bg-[#e8e9ff] text-[#4934ac]";
  if (["CANCELLED", "REJECTED", "SUSPENDED"].includes(status)) return "bg-[#ffe9e8] text-[#aa2020]";
  return "bg-[#fff2d8] text-[#9a6500]";
}

function SummaryCard({ icon: Icon, label, value, color }: {
  icon: LucideIcon; label: string; value: string; color: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-[#dce4f0] bg-white px-3 py-3 shadow-sm sm:gap-3 sm:px-4 sm:py-4">
      <Icon size={29} strokeWidth={2} color={color} className="shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold leading-tight text-[#29364e] sm:text-xs">{label}</p>
        <p className="mt-1 wrap-anywhere text-base font-extrabold leading-tight text-[#0b1536] sm:text-lg xl:text-xl">{value}</p>
      </div>
    </div>
  );
}

function EventPhoto({ src, title, empty }: { src: string | null; title: string; empty: string }) {
  if (!validImageUrl(src)) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#edf1f6] text-[#607089]">
        <CalendarDays size={28} aria-hidden="true" />
        <span className="text-[10px] font-semibold">{empty}</span>
      </div>
    );
  }
  return <Image src={src} alt={title} width={320} height={180} unoptimized className="h-full w-full object-cover" />;
}

export default function OrganizerEventsPage() {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<EventStatus>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [currency, setCurrency] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<EventItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const loadCounter = useRef(0);
  const t = TEXT[locale];

  useEffect(() => {
    const sync = () => {
      try {
        const stored = window.localStorage.getItem(i18nConfig.storageKey);
        if (stored) setLocale(normalizeLocale(stored));
      } catch { /* Keep default. */ }
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("focus", sync); };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const queryKey = JSON.stringify([page, status, sort, debouncedSearch, currency, locale]);
  const [activeQueryKey, setActiveQueryKey] = useState(queryKey);
  if (activeQueryKey !== queryKey) {
    setActiveQueryKey(queryKey);
    setLoading(true);
    setError("");
  }

  const fetchEventsRequest = useCallback(async (_background = false, signal?: AbortSignal) => {
    void _background;
    const requestNumber = ++loadCounter.current;

    
      const params = new URLSearchParams({
        page: String(page), pageSize: String(PAGE_SIZE), status, sort, locale,
      });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (currency) params.set("currency", currency);
      return fetch(`/api/organizer/events?${params.toString()}`, {
        credentials: "same-origin", cache: "no-store", signal,
      }).then(async (response) => {
      const data = (await response.json()) as EventsResponse;
      if (!response.ok || data.success !== true || !data.events || !data.pagination || !data.stats) {
        throw new Error(data.message || TEXT[locale].error);
      }
      if (signal?.aborted || requestNumber !== loadCounter.current) return;
      setEvents(data.events);
      setStats(data.stats);
      setPagination(data.pagination);
      setUpdatedAt(data.updatedAt ?? new Date().toISOString());
      setError("");
    
}).catch((caught) => {
      if (signal?.aborted || requestNumber !== loadCounter.current) return;
      setError(caught instanceof Error ? caught.message : TEXT[locale].error);
    }).finally(() => {
      if (requestNumber === loadCounter.current && !signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    });
  }, [page, status, sort, debouncedSearch, currency, locale]);
const fetchEvents = useCallback((background = false, signal?: AbortSignal) => {
if (background) setRefreshing(true); else setLoading(true);
return fetchEventsRequest(background, signal);
}, [fetchEventsRequest]);


  useEffect(() => {
    const controller = new AbortController();
    void fetchEventsRequest(false, controller.signal);
    return () => controller.abort();
  }, [fetchEventsRequest]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !deleteTarget) void fetchEvents(true);
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [fetchEvents, deleteTarget]);

  useEffect(() => {
    if (!deleteTarget) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) setDeleteTarget(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteTarget, deleting]);

  const revenueDisplay = useMemo(() => {
    if (!stats) return "—";
    if (stats.currency && stats.revenue !== null) return formatMoney(stats.revenue, stats.currency, locale);
    const amounts = Object.entries(stats.revenueByCurrency).filter(([, value]) => /^\d+$/.test(value));
    if (!amounts.length) return "—";
    return amounts.map(([code, value]) => formatMoney(value, code, locale)).join(" · ");
  }, [stats, locale]);

  function changeStatus(next: EventStatus) { setStatus(next); setPage(1); setNotice(""); }
  function changeSort(next: Sort) { setSort(next); setPage(1); }
  function changeCurrency(next: string) { setCurrency(next); setPage(1); }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/organizer/events/${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE", credentials: "same-origin", cache: "no-store",
      });
      const result = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || result.success !== true) throw new Error(result.message || t.error);
      setDeleteTarget(null);
      setNotice(result.message || t.removed);
      if (events.length === 1 && page > 1) setPage(page - 1);
      else await fetchEvents(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.error);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = pagination.totalPages;
  const displayFrom = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const displayTo = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <main className="flex min-h-full w-full min-w-0 flex-col overflow-x-hidden bg-[#f7f9fc] text-[#0b1534]">
      {/* Page title and creation action — dashboard layout handles global navigation. */}
      <header className="w-full border-b border-[#e7eaf2] bg-white px-3 py-4 sm:px-5 lg:px-6 lg:py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <CalendarDays size={38} strokeWidth={2} className="shrink-0 text-[#11813b] sm:size-11" aria-hidden="true" />
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl lg:text-[30px]">{t.title}</h1>
              <p className="mt-0.5 text-xs text-[#53617b] sm:text-sm">{t.subtitle}</p>
            </div>
          </div>
          <Link href="/organizer/dashboard/publish-event" className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-b from-[#29cd08] to-[#047b24] px-4 py-2.5 text-sm font-extrabold text-white shadow-sm hover:brightness-110 sm:w-auto sm:min-w-50">
            <Plus size={22} aria-hidden="true" /> {t.publish}
          </Link>
        </div>
      </header>

      <div className="flex w-full min-w-0 flex-1 flex-col gap-4 px-3 py-4 sm:px-5 lg:gap-5 lg:px-6">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
          <SummaryCard icon={Ticket} label={t.sold} value={stats ? formatNumber(stats.ticketsSold, locale) : "—"} color="#128c3a" />
          <SummaryCard icon={Wallet} label={t.revenue} value={revenueDisplay} color="#ea9600" />
          <SummaryCard icon={CalendarDays} label={t.live} value={stats ? formatNumber(stats.eventsOnSale, locale) : "—"} color="#6c38b8" />
          <SummaryCard icon={CheckCircle2} label={t.finished} value={stats ? formatNumber(stats.completedEvents, locale) : "—"} color="#089647" />
        </div>

        <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-[#e2e7f0] bg-white p-3 shadow-sm sm:p-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            <div className="relative min-w-0 flex-1 basis-full sm:basis-55">
              <Search size={19} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#526079]" aria-hidden="true" />
              <input type="search" aria-label={t.search} placeholder={t.search} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} maxLength={120} className="h-11 w-full rounded-xl border border-[#cdd5e4] bg-white pr-3 pl-10 text-sm outline-none placeholder:text-[#68758b] focus:border-green-600 focus:ring-2 focus:ring-green-100" />
            </div>
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <select aria-label={t.all} value={status} onChange={(event) => changeStatus(event.target.value as EventStatus)} className="h-11 w-full appearance-none rounded-xl border border-[#cdd5e4] bg-white pr-9 pl-3 text-xs font-semibold text-[#23314d] outline-none focus:border-green-600 sm:min-w-44 sm:text-sm">
                <option value="all">{t.all}</option>
                <option value="PUBLISHED">{t.published}</option>
                <option value="DRAFT">{t.draft}</option>
                <option value="COMPLETED">{t.completed}</option>
                <option value="SUSPENDED">{t.suspended}</option>
                <option value="REJECTED">{t.rejected}</option>
                <option value="CANCELLED">{t.cancelled}</option>
              </select>
              <ChevronDown size={17} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2" aria-hidden="true" />
            </div>
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <select aria-label={t.recent} value={sort} onChange={(event) => changeSort(event.target.value as Sort)} className="h-11 w-full appearance-none rounded-xl border border-[#cdd5e4] bg-white pr-9 pl-3 text-xs font-semibold text-[#23314d] outline-none focus:border-green-600 sm:min-w-40 sm:text-sm">
                <option value="recent">{t.recent}</option>
                <option value="oldest">{t.oldest}</option>
                <option value="title_asc">{t.ascending}</option>
                <option value="title_desc">{t.descending}</option>
              </select>
              <ChevronDown size={17} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2" aria-hidden="true" />
            </div>
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <select aria-label={t.allCurrencies} value={currency} onChange={(event) => changeCurrency(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-[#cdd5e4] bg-white pr-9 pl-3 text-xs font-semibold text-[#23314d] outline-none focus:border-green-600 sm:min-w-27 sm:text-sm">
                <option value="">{t.allCurrencies}</option>
                {SUPPORTED_CURRENCIES.map(code => <option key={code} value={code}>{currencyLabel(code, locale)}</option>)}
                
                
              </select>
              <ChevronDown size={17} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2" aria-hidden="true" />
            </div>
            <button type="button" onClick={() => void fetchEvents(true)} disabled={refreshing || loading} title={t.update} aria-label={t.update} className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#cdd5e4] text-[#31415c] hover:bg-green-50 disabled:opacity-50">
              <RefreshCw size={20} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
            </button>
          </div>
        </section>

        {notice && (
          <div role="status" className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
            <CheckCircle2 size={18} className="shrink-0" /> <span className="flex-1">{notice}</span>
            <button type="button" onClick={() => setNotice("")} aria-label="Fermer"><X size={18} /></button>
          </div>
        )}
        {error && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <span className="flex-1">{error}</span>
            <button type="button" onClick={() => void fetchEvents()} className="rounded-lg border border-red-200 px-3 py-1.5">{t.retry}</button>
          </div>
        )}

        <section aria-label={t.title} className="flex min-w-0 flex-1 flex-col gap-3">
          {loading && !events.length ? (
            <div role="status" className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-2xl bg-white text-[#66738b]">
              <LoaderCircle size={30} className="animate-spin text-green-700" />
              <p className="text-sm font-semibold">{t.loading}</p>
            </div>
          ) : !loading && !error && events.length === 0 ? (
            <div className="flex min-h-65 flex-col items-center justify-center gap-3 rounded-2xl border border-[#e1e7ef] bg-white px-4 text-center">
              <CalendarDays size={40} className="text-green-600" />
              <h2 className="text-lg font-extrabold">{t.emptyTitle}</h2>
              <p className="text-sm text-[#68758a]">{t.emptyBody}</p>
              <Link href="/organizer/dashboard/publish-event" className="mt-2 rounded-xl bg-green-700 px-5 py-3 text-sm font-extrabold text-white">{t.publish}</Link>
            </div>
          ) : events.map((item) => {
            const percent = Math.min(100, Math.max(0, item.progressPercent));
            const viewHref = `/organizer/dashboard/events/${encodeURIComponent(item.id)}`;
            const editHref = `/organizer/dashboard/publish-event?edit=${encodeURIComponent(item.id)}`;
            return (
              <article key={item.id} className="min-w-0 overflow-hidden rounded-2xl border border-[#dfe5ef] bg-white p-2.5 shadow-sm sm:p-3">
                {/* Desktop: full event information and three explicit actions */}
                <div className="hidden min-w-0 items-center gap-4 lg:flex">
                  <div className="h-28 w-44 shrink-0 overflow-hidden rounded-xl xl:h-30 xl:w-50">
                    <EventPhoto src={item.imageUrl} title={item.title} empty={t.noPhoto} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-extrabold text-[#111935] xl:text-xl">{item.title}</h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-[#34435f] xl:text-sm">
                      <span className="inline-flex items-center gap-1.5"><CalendarDays size={16} className="text-green-700" />{readableDate(item.startsAt, locale)}</span>
                      <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin size={16} className="shrink-0 text-green-700" />{[item.venue, item.city].filter(Boolean).join(", ") || "—"}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-[#35435e]">
                      <Ticket size={16} className="shrink-0 text-green-700" />
                      {formatNumber(item.ticketsSold, locale)} / {formatNumber(item.capacity, locale)} {t.ticketProgress}
                      <span className="text-[#67748b]">· {formatNumber(item.remainingSeats, locale)} {t.remaining}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#e9eaf2]" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={t.ticketProgress}>
                        <div style={{ width: `${percent}%` }} className="h-full rounded-full bg-linear-to-r from-[#138c35] to-[#8add16]" />
                      </div>
                      <span className="text-xs font-extrabold text-green-800">{percent}%</span>
                    </div>
                  </div>
                  <div className="flex w-51 shrink-0 flex-col items-end gap-3 xl:w-76">
                    <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${statusStyle(item.status)}`}>{statusLabel(item.status, locale)}</span>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Link href={viewHref} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-[#e9f7e8] px-2.5 text-xs font-extrabold text-green-800 hover:bg-[#d5f1d1]"><Eye size={15} />{t.view}</Link>
                      <Link href={editHref} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#a5c7ac] bg-white px-2.5 text-xs font-extrabold text-[#116d2e] hover:bg-green-50"><Pencil size={14} />{t.edit}</Link>
                      <button type="button" onClick={() => setDeleteTarget(item)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-red-400 px-2.5 text-xs font-extrabold text-red-700 hover:bg-red-50"><Trash2 size={14} />{t.delete}</button>
                    </div>
                  </div>
                </div>

                {/* Mobile/tablet: compact card and accessible actions */}
                <div className="lg:hidden">
                  <Link href={viewHref} className="flex min-w-0 gap-3">
                    <div className="h-24 w-25 shrink-0 overflow-hidden rounded-xl sm:h-30 sm:w-37">
                      <EventPhoto src={item.imageUrl} title={item.title} empty={t.noPhoto} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="line-clamp-2 text-sm font-extrabold leading-snug sm:text-base">{item.title}</h2>
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#41506b] sm:text-xs"><CalendarDays size={13} className="shrink-0 text-green-700" />{readableDate(item.startsAt, locale)}</p>
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-[#41506b] sm:text-xs"><MapPin size={13} className="shrink-0 text-green-700" /><span className="truncate">{[item.venue, item.city].filter(Boolean).join(", ") || "—"}</span></p>
                      <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold ${statusStyle(item.status)}`}>{statusLabel(item.status, locale)}</span>
                    </div>
                    <ChevronRight size={19} className="mt-8 shrink-0 text-[#50627b]" aria-hidden="true" />
                  </Link>
                  <div className="mt-2.5 flex items-center gap-2 text-[11px] font-semibold text-[#536079]">
                    <span className="shrink-0">{formatNumber(item.ticketsSold, locale)} / {formatNumber(item.capacity, locale)}</span>
                    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#e9eaf2]"><div style={{ width: `${percent}%` }} className="h-full rounded-full bg-linear-to-r from-[#158b37] to-[#88d913]" /></div>
                    <span className="shrink-0 font-extrabold text-green-800">{percent}%</span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-[#edf0f5] pt-2.5">
                    <Link href={viewHref} className="flex min-h-9 items-center justify-center gap-1 rounded-lg bg-green-50 text-xs font-extrabold text-green-800"><Eye size={15} />{t.view}</Link>
                    <Link href={editHref} className="flex min-h-9 items-center justify-center gap-1 rounded-lg border border-green-200 text-xs font-extrabold text-green-800"><Pencil size={14} />{t.edit}</Link>
                    <button type="button" onClick={() => setDeleteTarget(item)} className="flex min-h-9 items-center justify-center gap-1 rounded-lg border border-red-200 text-xs font-extrabold text-red-700"><Trash2 size={14} />{t.delete}</button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <footer className="mt-1 flex w-full flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-3 py-3 text-xs font-semibold text-[#46536c] sm:px-4 sm:text-sm">
          <span>{displayFrom} – {displayTo} {t.of} {formatNumber(pagination.total, locale)} {t.events}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1 || loading} aria-label="Previous page" className="flex size-9 items-center justify-center rounded-lg border border-[#d7dfeb] disabled:opacity-40"><ChevronLeft size={19} /></button>
            <span className="rounded-lg bg-green-700 px-3 py-2 font-extrabold text-white">{page}</span>
            <button type="button" onClick={() => setPage(page + 1)} disabled={page >= totalPages || loading} aria-label="Next page" className="flex size-9 items-center justify-center rounded-lg border border-[#d7dfeb] disabled:opacity-40"><ChevronRight size={19} /></button>
          </div>
          {updatedAt && <span className="hidden text-[11px] text-[#68758b] sm:inline">{t.refreshed} : {new Date(updatedAt).toLocaleTimeString(locale === "fr" ? "fr-FR" : "en-GB", { hour: "2-digit", minute: "2-digit" })}</span>}
        </footer>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-[#07152b]/65 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeleteTarget(null); }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="remove-event-title" aria-describedby="remove-event-description" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 id="remove-event-title" className="text-lg font-extrabold text-[#111935]">{t.deleteTitle}</h2>
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} aria-label="Fermer" className="rounded-lg p-1.5 text-[#526078] hover:bg-gray-100"><X size={21} /></button>
            </div>
            <p className="mt-2 font-bold text-[#1c2942]">{deleteTarget.title}</p>
            <p id="remove-event-description" className="mt-2 text-sm leading-relaxed text-[#5e6b80]">{t.deleteMessage}</p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} className="min-h-11 rounded-xl border border-[#d6dfeb] px-4 text-sm font-bold text-[#26364f]">{t.cancel}</button>
              <button type="button" onClick={() => void confirmDelete()} disabled={deleting} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-700 px-4 text-sm font-extrabold text-white hover:bg-red-800 disabled:opacity-60">
                {deleting ? <LoaderCircle size={17} className="animate-spin" /> : <Trash2 size={17} />}
                {deleting ? t.deleting : t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
