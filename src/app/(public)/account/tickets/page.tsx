
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import Image from "next/image";
import { formatMinorMoney } from "@/i18n/config";
import { PublicAccountShell } from "@/components/public/PublicNavigation";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import {
  ArrowLeftRight,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  MapPin,
  QrCode,
  RefreshCw,
  Search,
  ShoppingCart,
  Ticket,
  Tickets,
} from "lucide-react";

/* =========================================================
   TIKEMIA — MES BILLETS

   Fichier :
   src/app/(public)/account/tickets/page.tsx

   Page protégée par l'API et la session.

   PC :
   - Titre
   - 3 statistiques
   - Recherche et filtre
   - Cartes horizontales avec actions
   - Aucun menu latéral

   MOBILE :
   - Titre
   - Compteur
   - Cartes horizontales compactes
   - Boutons Voir / Transférer
   - Navigation publique existante
   - Aucun footer

   IMPORTANT :
   Aucun QR code dans la liste.
   Aucun token QR dans les données affichées.
   Aucun événement ou billet fictif.
========================================================= */

const TICKETS_API =
  "/api/public/account/tickets";

const ACCOUNT_API =
  "/api/public/account";

const LOGIN_URL = "/login";

const EXPLORE_URL = "/explore";

const TRANSFER_URL = "/account/transfer";

const PAGE_SIZE = 12;

const REFRESH_MS = 10_000;

type Locale = "fr" | "en";
type Filter = "all" | "upcoming";

type TicketItem = {
  id: string;
  number: string;
  status: string;
  unitPriceMinor: string;
  currency: string;
  qrImageUrl?: string;
  issuedAt?: string;

  event: {
    id: string;
    slug: string;
    title: string;
    imageUrl: string | null;
    category?: string;
    timeZone?: string;

    venue?: {
      name?: string | null;
      address?: string | null;
      city?: string | null;
      country?: string | null;
    } | null;
  };

  schedule?: {
    id: string;
    startsAt: string;
    endsAt?: string | null;
    label?: string | null;
  } | null;

  ticketCategory?: {
    id: string;
    name: string;
  } | null;

  order?: {
    id: string;
    reference: string;
    currency: string;
    paidAt?: string | null;
  };
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type TicketStatistics = {
  validTickets: number;
  totalPurchases: number;
  nextEventAt?: string | null;
  nextEventTimeZone?: string | null;
};

type ApiData = {
  tickets: TicketItem[];
  statistics: TicketStatistics;
  pagination: Pagination;
};

type ApiResponse = {
  success?: boolean;
  code?: string;
  message?: string;
  generatedAt?: string;
  data?: ApiData;
};

const TEXT = {
  fr: {
    title: "Mes billets",
    subtitle: "Tous vos billets disponibles et valables.",
    available: "Billets disponibles",
    purchases: "Achats totaux",
    nextEvent: "Prochain événement",
    search: "Rechercher un événement...",
    searchButton: "Rechercher",
    all: "Tous les billets",
    upcoming: "Événements à venir",
    valid: "Billet valable",
    quantity: "1 billet",
    category: "Catégorie",
    view: "Voir le billet",
    transfer: "Transférer",
    location: "Lieu non renseigné",
    date: "Date non renseignée",
    noNextEvent: "Aucun à venir",
    loading: "Chargement de vos billets...",
    refresh: "Actualiser",
    empty: "Aucun billet disponible",
    emptyText:
      "Vos billets valables apparaîtront ici après leur achat.",
    filteredEmpty: "Aucun billet trouvé",
    filteredEmptyText:
      "Aucun billet ne correspond à votre recherche.",
    explore: "Explorer les événements",
    error: "Impossible de charger vos billets.",
    retry: "Réessayer",
    previous: "Précédent",
    next: "Suivant",
    page: "Page",
    of: "sur",
    connecting: "Connexion requise",
    connectingText:
      "Connectez-vous pour consulter vos billets.",
    login: "Se connecter",
    updated: "Actualisé",
  },
  en: {
    title: "My tickets",
    subtitle: "All your available and valid tickets.",
    available: "Available tickets",
    purchases: "Total purchases",
    nextEvent: "Next event",
    search: "Search for an event...",
    searchButton: "Search",
    all: "All tickets",
    upcoming: "Upcoming events",
    valid: "Valid ticket",
    quantity: "1 ticket",
    category: "Category",
    view: "View ticket",
    transfer: "Transfer",
    location: "Location unavailable",
    date: "Date unavailable",
    noNextEvent: "None upcoming",
    loading: "Loading your tickets...",
    refresh: "Refresh",
    empty: "No available tickets",
    emptyText:
      "Your valid tickets will appear here after purchase.",
    filteredEmpty: "No tickets found",
    filteredEmptyText:
      "No tickets match your search.",
    explore: "Explore events",
    error: "Unable to load your tickets.",
    retry: "Try again",
    previous: "Previous",
    next: "Next",
    page: "Page",
    of: "of",
    connecting: "Sign-in required",
    connectingText:
      "Sign in to view your tickets.",
    login: "Sign in",
    updated: "Updated",
  },
} as const;

/* =========================================================
   UTILITAIRES
========================================================= */

function validDate(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function formatDate(
  value: string | null | undefined,
  zone: string | null | undefined,
  locale: Locale,
  includeTime = true
) {
  const date = validDate(value);
  if (!date) return null;

  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "2-digit" as const,
          minute: "2-digit" as const,
        }
      : {}),
  };

  try {
    return new Intl.DateTimeFormat(
      locale === "fr" ? "fr-FR" : "en-GB",
      {
        ...options,
        timeZone: zone || "UTC",
      }
    ).format(date);
  } catch {
    return new Intl.DateTimeFormat(
      locale === "fr" ? "fr-FR" : "en-GB",
      {
        ...options,
        timeZone: "UTC",
      }
    ).format(date);
  }
}

function isValidTicket(ticket: TicketItem) {
  return (
    ticket.status === "VALID" &&
    Boolean(ticket.id) &&
    Boolean(ticket.event?.id)
  );
}

function getLocation(ticket: TicketItem) {
  const venue = ticket.event.venue;

  if (!venue) return null;

  return [
    venue.name,
    venue.city,
  ]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(", ") || null;
}

function ticketDetailUrl(ticketId: string) {
  return (
    "/account/tickets?ticket=" +
    encodeURIComponent(ticketId)
  );
}

function ticketTransferUrl(ticketId: string) {
  return (
    TRANSFER_URL +
    "?ticket=" +
    encodeURIComponent(ticketId)
  );
}

function normalizePagination(
  value: Pagination | undefined,
  page: number,
  count: number
): Pagination {
  return {
    page: value?.page ?? page,
    limit: value?.limit ?? PAGE_SIZE,
    total: value?.total ?? count,
    totalPages: value?.totalPages ?? 1,
    hasNextPage:
      value?.hasNextPage ?? false,
    hasPreviousPage:
      value?.hasPreviousPage ?? page > 1,
  };
}

/* =========================================================
   IMAGE ÉVÉNEMENT

   Une photo réelle si l'API renvoie
   une URL accessible.

   Pas d'image fictive.
========================================================= */

function EventPicture({
  src,
  title,
}: {
  src: string | null;
  title: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);



  return (
    <div className="relative h-27 w-29 shrink-0 overflow-hidden rounded-xl bg-[#e7f2e9] sm:h-34 sm:w-52.5">
      {src && failed !== src ? (
        <Image
          src={src}
          alt={title}
          fill
          unoptimized
          sizes="(max-width: 640px) 116px, 210px"
          className="object-cover"
          onError={() => setFailed(src)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[#15833c]">
          <Ticket size={36} strokeWidth={1.5} />
        </div>
      )}

      <span className="absolute bottom-1.5 left-1.5 rounded-md bg-[#087d2d] px-2 py-1 text-[10px] font-extrabold text-white shadow-sm sm:top-2 sm:bottom-auto sm:left-2">
        { /* Le libellé est affiché uniquement
             après filtrage du statut VALID. */ }
        <CheckCircle2
          size={11}
          className="mr-1 inline-block"
        />
        VALID
      </span>
    </div>
  );
}

/* =========================================================
   PAGE MES BILLETS
========================================================= */

export default function MyTicketsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusedTicketId = searchParams.get("ticket") ?? "";

  const [locale, setLocale] =
    useState<Locale>("fr");

  const [account, setAccount] =
    useState<ApiData | null>(null);

  const [page, setPage] = useState(1);

  const [searchInput, setSearchInput] =
    useState("");

  const [query, setQuery] = useState("");

  const [filter, setFilter] =
    useState<Filter>("all");

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [unauthorized, setUnauthorized] =
    useState(false);

  const [lastUpdated, setLastUpdated] =
    useState<string | null>(null);

  const abortRef =
    useRef<AbortController | null>(null);

  const sequenceRef = useRef(0);

  const t = TEXT[locale];

  /* =======================================================
     LANGUE EXISTANTE DU SITE
  ======================================================= */

  useEffect(() => {
    function syncLocale() {
      try {
        const saved = localStorage.getItem(
          "tikemia_locale"
        );

        if (saved === "fr" || saved === "en") {
          setLocale(saved);
          return;
        }
      } catch {
        // Français par défaut.
      }

      setLocale(
        document.documentElement.lang
          .toLowerCase()
          .startsWith("en")
          ? "en"
          : "fr"
      );
    }

    syncLocale();

    window.addEventListener(
      "storage",
      syncLocale
    );

    window.addEventListener(
      "tikemia:locale-changed",
      syncLocale
    );

    return () => {
      window.removeEventListener(
        "storage",
        syncLocale
      );

      window.removeEventListener(
        "tikemia:locale-changed",
        syncLocale
      );
    };
  }, []);

  /* =======================================================
     CHARGEMENT SÉCURISÉ

     L'API identifie l'utilisateur via
     son cookie de session HttpOnly.

     Aucun userId ni email envoyé
     depuis le navigateur.

     L'API spécialisée est utilisée
     en priorité.

     Repli temporaire sur l'API du
     compte seulement si la route
     spécialisée est absente (404).

     La recherche serveur devra être
     appliquée par l'API spécialisée
     pour rester exacte sur toutes
     les pages.
  ======================================================= */

  const loadTickets = useCallback(
    async (
      targetPage: number,
      silent = false
    ) => {
      abortRef.current?.abort();

      const controller =
        new AbortController();

      abortRef.current = controller;

      const sequence =
        ++sequenceRef.current;

      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          limit: String(PAGE_SIZE),
          q: query,
          filter,
        });
        if (focusedTicketId) params.set("ticket", focusedTicketId);

        let response = await fetch(
          `${TICKETS_API}?${params}`,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          }
        );

        let usingAccountFallback = false;

        if (response.status === 404) {
          usingAccountFallback = true;

          const accountParams =
            new URLSearchParams({
              page: String(targetPage),
              limit: String(PAGE_SIZE),
            });

          response = await fetch(
            `${ACCOUNT_API}?${accountParams}`,
            {
              method: "GET",
              credentials: "same-origin",
              cache: "no-store",
              headers: {
                Accept: "application/json",
              },
              signal: controller.signal,
            }
          );
        }

        if (response.status === 401 || response.status === 403) {
          if (sequence === sequenceRef.current) {
            setAccount(null);
            setUnauthorized(true);
            router.replace(LOGIN_URL);
          }
          return;
        }

        const body =
          (await response.json()) as ApiResponse;

        if (
          !response.ok ||
          body.success !== true ||
          !body.data ||
          !Array.isArray(body.data.tickets)
        ) {
          throw new Error(
            body.message || "TICKETS_LOAD_FAILED"
          );
        }

        if (
          controller.signal.aborted ||
          sequence !== sequenceRef.current
        ) {
          return;
        }

        const originalTickets =
          body.data.tickets.filter(isValidTicket);

        /*
         * L'API spécialisée doit filtrer
         * globalement avant la pagination.
         *
         * Le repli sur l'API du compte
         * applique seulement les filtres
         * sur la page actuellement chargée.
         * Aucun total filtré fictif.
         */

        const tickets = usingAccountFallback
          ? originalTickets.filter((ticket) => {
              const matchesSearch =
                !query ||
                ticket.event.title
                  .toLocaleLowerCase()
                  .includes(
                    query.toLocaleLowerCase()
                  );

              const start =
                validDate(
                  ticket.schedule?.startsAt
                );

              const matchesDate =
                filter === "all" ||
                (
                  start !== null &&
                  start.getTime() >= Date.now()
                );

              return (
                matchesSearch &&
                matchesDate
              );
            })
          : originalTickets;

        const nextData: ApiData = {
          statistics: body.data.statistics,
          tickets,
          pagination: normalizePagination(
            body.data.pagination,
            targetPage,
            tickets.length
          ),
        };

        setAccount(nextData);
        setUnauthorized(false);
        setLastUpdated(
          body.generatedAt ||
          new Date().toISOString()
        );

        const totalPages = Math.max(
          1,
          nextData.pagination.totalPages
        );

        if (targetPage > totalPages) {
          setPage(totalPages);
        }
      } catch {
        if (
          controller.signal.aborted ||
          sequence !== sequenceRef.current
        ) {
          return;
        }


        setError("TICKETS_LOAD_FAILED");
      } finally {
        if (sequence === sequenceRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [router, query, filter, focusedTicketId]
  );

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadTickets(page), 0);

    return () => {
      window.clearTimeout(initialLoad);
      abortRef.current?.abort();
    };
  }, [page, loadTickets]);

  /* =======================================================
     ACTUALISATION DES BILLETS

     Au maximum une actualisation toutes
     les 10 secondes tant que la page
     est visible, plus un contrôle
     au retour sur l'onglet.
  ======================================================= */

  useEffect(() => {
    const refresh = () => {
      if (
        document.visibilityState === "visible"
      ) {
        void loadTickets(page, true);
      }
    };

    const interval = window.setInterval(
      refresh,
      REFRESH_MS
    );

    document.addEventListener(
      "visibilitychange",
      refresh
    );

    window.addEventListener("focus", refresh);

    return () => {
      window.clearInterval(interval);

      document.removeEventListener(
        "visibilitychange",
        refresh
      );

      window.removeEventListener(
        "focus",
        refresh
      );
    };
  }, [page, loadTickets]);

  /* =======================================================
     RECHERCHE
  ======================================================= */

  function handleSearch(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setPage(1);
    setQuery(searchInput.trim());
  }

  function handleFilter(value: Filter) {
    setPage(1);
    setFilter(value);
  }

  /* =======================================================
     STATISTIQUES

     Pas de chiffre inventé.

     "Prochain événement" est utilisé
     seulement si l'API spécialisée
     fournit la date globale réelle.

     Sinon, on affiche la première date
     à venir parmi les billets reçus,
     sans prétendre couvrir tous les
     billets paginés.
  ======================================================= */

  const stats = account?.statistics;

  const tickets = account?.tickets ?? [];

  const pagination = account?.pagination;

  const nextEvent = stats?.nextEventAt ? formatDate(stats.nextEventAt, stats.nextEventTimeZone, locale, false) : null;

  /* =======================================================
     CARTE BILLET

     AUCUN QR CODE RENDU.

     Le symbole QrCode sur le bouton
     est uniquement une icône d'action,
     pas un véritable code scannable.

     La page détail chargera ensuite
     le QR sécurisé du billet sélectionné.
  ======================================================= */

  function renderTicket(ticket: TicketItem) {
    const eventDate = formatDate(
      ticket.schedule?.startsAt,
      ticket.event.timeZone,
      locale
    );

    const location = getLocation(ticket);

    const category =
      ticket.ticketCategory?.name?.trim();

    return (
      <article
        key={ticket.id}
        className="min-w-0 rounded-[18px] border border-[#e4ebe6] bg-white p-3 shadow-[0_3px_13px_rgba(12,44,25,0.06)] sm:p-4"
      >
        <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-5">

          {/* PHOTO RÉELLE */}

          <EventPicture
            src={ticket.event.imageUrl}
            title={ticket.event.title}
          />

          {/* INFORMATIONS */}

          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-[14px] font-black leading-snug text-[#101828] sm:text-[19px]">
              {ticket.event.title}
            </h3>

            <div className="mt-2 space-y-1.5">
              <p className="flex min-w-0 items-start gap-1.5 text-[11px] font-medium text-[#344457] sm:text-[13px]">
                <CalendarDays
                  size={15}
                  className="mt-0.5 shrink-0"
                />
                <span>
                  {eventDate || t.date}
                </span>
              </p>

              <p className="flex min-w-0 items-start gap-1.5 text-[11px] text-[#405063] sm:text-[13px]">
                <MapPin
                  size={15}
                  className="mt-0.5 shrink-0"
                />

                <span className="line-clamp-2">
                  {location || t.location}
                </span>
              </p>
            </div>

            {/* INFORMATIONS COMPLÉMENTAIRES PC */}

            <div className="mt-3 hidden flex-wrap items-center gap-2 sm:flex">
              <span className="rounded-full bg-[#e0f8db] px-3 py-1 text-[11px] font-extrabold text-[#076b28]">
                {t.quantity}
              </span>

              {category && (
                <span className="rounded-full bg-[#eff0fa] px-3 py-1 text-[11px] font-bold text-[#303a64]">
                  {t.category} : {category}
                </span>
              )}
            </div>
          </div>

          {/* STATUT PC */}

          <span className="hidden shrink-0 items-center gap-1 rounded-full bg-[#dff8d6] px-3 py-1.5 text-[11px] font-extrabold text-[#087b2d] xl:inline-flex">
            <CheckCircle2 size={15} />
            {t.valid}
          </span>

          {/* ACTIONS PC */}

          <div className="hidden w-42.5 shrink-0 flex-col gap-2 sm:flex">
            <Link
              href={ticketDetailUrl(ticket.id)}
              className="flex min-h-10.25 items-center justify-center gap-2 rounded-full bg-linear-to-b from-[#1aa500] to-[#006c27] px-3 text-[12px] font-extrabold text-white transition-opacity hover:opacity-90"
            >
              <QrCode size={17} />
              {t.view}
            </Link>

            <Link
              href={ticketTransferUrl(ticket.id)}
              className="flex min-h-10.25 items-center justify-center gap-2 rounded-full border border-[#07832d] bg-white px-3 text-[12px] font-extrabold text-[#087d2d] hover:bg-[#f2faf3]"
            >
              <ArrowLeftRight size={17} />
              {t.transfer}
            </Link>
          </div>
        </div>

        {/* ACTIONS MOBILE */}

        <div className="mt-3 grid grid-cols-2 gap-2 sm:hidden">
          <Link
            href={ticketDetailUrl(ticket.id)}
            className="flex min-h-10.5 items-center justify-center gap-1.5 rounded-full bg-linear-to-b from-[#18a700] to-[#006c27] px-2 text-[12px] font-extrabold text-white"
          >
            <QrCode size={17} />
            {t.view}
          </Link>

          <Link
            href={ticketTransferUrl(ticket.id)}
            className="flex min-h-10.5 items-center justify-center gap-1.5 rounded-full border border-[#07852d] px-2 text-[12px] font-extrabold text-[#087d2d]"
          >
            <ArrowLeftRight size={17} />
            {t.transfer}
          </Link>
        </div>
      </article>
    );
  }

  /* =======================================================
     INTERFACE
  ======================================================= */

  return (
    <>
      {/* ================================================
          FOOTER PUBLIC

          PC : visible.
          MOBILE : masqué uniquement ici.

          Le header et la navigation
          mobile restent ceux du layout.
      ================================================ */}

      

      <PublicAccountShell locale={locale}><div
        id="tikemia-my-tickets-page"
        className="flex min-h-full w-full min-w-0 flex-1 flex-col bg-[#f9fafc] text-[#111b30]"
      >
        <div className="w-full min-w-0 px-3 py-5 sm:px-5 md:px-7 md:py-5 xl:px-10">

          {/* ============================================
              TITRE
          ============================================ */}

          <header className="mb-5 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Tickets
                size={37}
                strokeWidth={1.8}
                className="shrink-0 text-[#076e2e] sm:size-11.75"
              />

              <div className="min-w-0">
                <h1 className="text-[25px] font-black leading-tight tracking-tight text-[#10172d] sm:text-[34px]">
                  {t.title}
                </h1>

                <p className="mt-1 text-[12px] text-[#445772] sm:text-[15px]">
                  {t.subtitle}
                </p>
              </div>
            </div>

            <button
              type="button"
              aria-label={t.refresh}
              title={t.refresh}
              disabled={refreshing || loading}
              onClick={() =>
                void loadTickets(page, true)
              }
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#deebdf] bg-white text-[#087e2d] hover:bg-[#f0faf2] disabled:opacity-50"
            >
              <RefreshCw
                size={19}
                className={
                  refreshing ? "animate-spin" : ""
                }
              />
            </button>
          </header>

          {/* ============================================
              CHARGEMENT INITIAL
          ============================================ */}

          {loading && !account && !unauthorized && (
            <div className="flex min-h-75 flex-col items-center justify-center gap-3">
              <LoaderCircle
                size={34}
                className="animate-spin text-[#087f2f]"
              />

              <p className="text-sm font-semibold text-[#526477]">
                {t.loading}
              </p>
            </div>
          )}

          {/* ============================================
              SESSION ABSENTE
          ============================================ */}

          {unauthorized && (
            <div className="flex min-h-75 flex-col items-center justify-center rounded-2xl border border-[#e3eae6] bg-white px-5 text-center">
              <CircleAlert
                size={36}
                className="text-[#087d2d]"
              />

              <h2 className="mt-4 text-xl font-black">
                {t.connecting}
              </h2>

              <p className="mt-2 text-sm text-[#617084]">
                {t.connectingText}
              </p>

              <Link
                href={LOGIN_URL}
                className="mt-5 rounded-full bg-[#087d2d] px-6 py-3 text-sm font-extrabold text-white"
              >
                {t.login}
              </Link>
            </div>
          )}

          {/* ============================================
              ERREUR
          ============================================ */}

          {!loading && !account && !unauthorized && (
            <div className="flex min-h-75 flex-col items-center justify-center gap-3 rounded-2xl bg-white px-5 text-center">
              <CircleAlert
                size={34}
                className="text-[#cb4343]"
              />

              <p className="text-sm font-semibold">
                {t.error}
              </p>

              <button
                type="button"
                onClick={() =>
                  void loadTickets(page)
                }
                className="rounded-full bg-[#087d2d] px-6 py-3 text-sm font-bold text-white"
              >
                {t.retry}
              </button>
            </div>
          )}

          {/* ============================================
              COMPTE CHARGÉ
          ============================================ */}

          {account && !unauthorized && (
            <>
              {/* ========================================
                  STATISTIQUES MOBILE

                  Une seule carte compacte,
                  comme l'architecture.
              ======================================== */}

              <section className="mb-4 rounded-2xl border border-[#e0f1e2] bg-[#ebfbea] px-4 py-4 shadow-sm sm:hidden">
                <div className="flex items-center gap-3">
                  <Ticket
                    size={31}
                    className="shrink-0 -rotate-12 text-[#07862e]"
                  />

                  <p className="min-w-0 text-[14px] font-extrabold text-[#192237]">
                    {t.available} :{" "}
                    <span className="text-[23px] font-black">
                      {stats?.validTickets ?? 0}
                    </span>
                  </p>
                </div>
              </section>

              {/* ========================================
                  STATISTIQUES PC

                  Trois cartes sur une ligne.
                  Aucune valeur fictive.
              ======================================== */}

              <section className="mb-6 hidden grid-cols-3 gap-4 sm:grid">
                <div className="flex min-w-0 items-center gap-4 rounded-[20px] border border-[#e3f0e4] bg-[#eafbeb] p-5 shadow-sm">
                  <Ticket
                    size={36}
                    className="shrink-0 text-[#0c8c31]"
                  />

                  <div className="min-w-0">
                    <p className="text-[13px] font-bold">
                      {t.available}
                    </p>

                    <p className="mt-1 text-[30px] font-black">
                      {stats?.validTickets ?? 0}
                    </p>
                  </div>
                </div>

                <div className="flex min-w-0 items-center gap-4 rounded-[20px] border border-[#e9e8f2] bg-[#f3f1fc] p-5 shadow-sm">
                  <ShoppingCart
                    size={36}
                    className="shrink-0 text-[#6755a4]"
                  />

                  <div className="min-w-0">
                    <p className="text-[13px] font-bold">
                      {t.purchases}
                    </p>

                    <p className="mt-1 text-[30px] font-black">
                      {stats?.totalPurchases ?? 0}
                    </p>
                  </div>
                </div>

                <div className="flex min-w-0 items-center gap-4 rounded-[20px] border border-[#f4ecd8] bg-[#fff8e8] p-5 shadow-sm">
                  <CalendarDays
                    size={36}
                    className="shrink-0 text-[#e3a00a]"
                  />

                  <div className="min-w-0">
                    <p className="text-[13px] font-bold">
                      {t.nextEvent}
                    </p>

                    <p className="mt-1 text-[20px] font-black">
                      {nextEvent || t.noNextEvent}
                    </p>
                  </div>
                </div>
              </section>

              {/* ========================================
                  RECHERCHE ET FILTRE

                  Présents sur PC et mobile.
              ======================================== */}

              <div className="mb-5 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_230px]">
                <form
                  onSubmit={handleSearch}
                  className="flex min-w-0 items-center gap-2 rounded-2xl border border-[#dce3e9] bg-white px-3 shadow-sm focus-within:border-[#0a8a31]"
                >
                  <Search
                    size={20}
                    className="shrink-0 text-[#344254]"
                  />

                  <input
                    type="search"
                    value={searchInput}
                    onChange={(event) =>
                      setSearchInput(event.target.value)
                    }
                    placeholder={t.search}
                    aria-label={t.search}
                    className="h-12.25 min-w-0 flex-1 bg-transparent text-[13px] text-[#253348] outline-none placeholder:text-[#8d9aa9]"
                  />

                  <button
                    type="submit"
                    aria-label={t.searchButton}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#087d2d] text-white"
                  >
                    <ArrowRight size={18} />
                  </button>
                </form>

                <select
                  value={filter}
                  onChange={(event) =>
                    handleFilter(
                      event.target.value as Filter
                    )
                  }
                  aria-label={t.all}
                  className="h-12.75 w-full rounded-2xl border border-[#dce3e9] bg-white px-4 text-[13px] font-semibold text-[#27384a] outline-none focus:border-[#087d2d]"
                >
                  <option value="all">
                    {t.all}
                  </option>

                  <option value="upcoming">
                    {t.upcoming}
                  </option>
                </select>
              </div>

              {/* ========================================
                  LISTE DE BILLETS
              ======================================== */}

              <section aria-label={t.title}>
                {tickets.length > 0 ? (
                  <div className="space-y-3">
                    {tickets.map(renderTicket)}
                  </div>
                ) : (
                  <div className="flex min-h-58.75 flex-col items-center justify-center rounded-[20px] border border-[#e3eae6] bg-white px-5 py-8 text-center">
                    <Ticket
                      size={39}
                      className="text-[#8ab59a]"
                    />

                    <h2 className="mt-3 text-[18px] font-black">
                      {query || filter !== "all"
                        ? t.filteredEmpty
                        : t.empty}
                    </h2>

                    <p className="mt-2 max-w-90 text-[13px] leading-relaxed text-[#6f7e90]">
                      {query || filter !== "all"
                        ? t.filteredEmptyText
                        : t.emptyText}
                    </p>

                    {!query && filter === "all" && (
                      <Link
                        href={EXPLORE_URL}
                        className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#087d2d] px-5 py-2.5 text-[13px] font-extrabold text-white"
                      >
                        {t.explore}
                        <ArrowRight size={16} />
                      </Link>
                    )}
                  </div>
                )}
              </section>

              {/* ========================================
                  PAGINATION
              ======================================== */}

              {pagination &&
                pagination.totalPages > 1 && (
                  <nav
                    aria-label={t.title}
                    className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-[#e6ebe7] bg-white px-3 py-3"
                  >
                    <button
                      type="button"
                      disabled={
                        !pagination.hasPreviousPage ||
                        loading
                      }
                      onClick={() =>
                        setPage((current) =>
                          Math.max(1, current - 1)
                        )
                      }
                      className="flex min-h-9 items-center gap-1 rounded-full border border-[#d8e6da] px-3 text-[12px] font-bold text-[#087d2d] disabled:opacity-40"
                    >
                      <ChevronLeft size={16} />
                      <span className="hidden sm:inline">
                        {t.previous}
                      </span>
                    </button>

                    <span className="text-center text-xs font-semibold text-[#536477]">
                      {t.page} {pagination.page} {t.of}{" "}
                      {pagination.totalPages}
                    </span>

                    <button
                      type="button"
                      disabled={
                        !pagination.hasNextPage ||
                        loading
                      }
                      onClick={() =>
                        setPage((current) => current + 1)
                      }
                      className="flex min-h-9 items-center gap-1 rounded-full border border-[#d8e6da] px-3 text-[12px] font-bold text-[#087d2d] disabled:opacity-40"
                    >
                      <span className="hidden sm:inline">
                        {t.next}
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  </nav>
                )}

              {/* ERREUR DE RAFRAÎCHISSEMENT */}

              {error && (
                <div
                  role="alert"
                  className="mt-4 flex items-center gap-3 rounded-xl border border-[#f1caca] bg-[#fff5f5] px-4 py-3 text-xs text-[#ad3434]"
                >
                  <CircleAlert
                    size={17}
                    className="shrink-0"
                  />

                  <span className="flex-1">
                    {t.error}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      void loadTickets(page, true)
                    }
                    className="font-extrabold underline"
                  >
                    {t.retry}
                  </button>
                </div>
              )}

              {lastUpdated && (
                <p className="mt-4 text-right text-[11px] text-[#83908b]">
                  {t.updated} :{" "}
                  {new Date(
                    lastUpdated
                  ).toLocaleTimeString(
                    locale === "fr" ? "fr-FR" : "en-GB",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )}
                </p>
              )}
            </>
          )}
        </div>
      </div>{focusedTicketId && <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-2 sm:p-4" onClick={() => router.replace("/account/tickets")}><section role="dialog" aria-modal="true" aria-labelledby="public-ticket-title" className="max-h-[96dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape") router.replace("/account/tickets"); }}><div className="flex items-center justify-between gap-3"><h2 id="public-ticket-title" className="text-lg font-extrabold">{locale === "fr" ? "Mon billet" : "My ticket"}</h2><button autoFocus type="button" aria-label={locale === "fr" ? "Fermer" : "Close"} onClick={() => router.replace("/account/tickets")} className="min-h-11 rounded-xl border px-4">{locale === "fr" ? "Fermer" : "Close"}</button></div>{loading ? <p role="status" className="py-5">{t.loading}</p> : tickets.find(ticket => ticket.id === focusedTicketId) ? (() => { const ticket = tickets.find(ticket => ticket.id === focusedTicketId)!; return <div className="mt-4 space-y-3"><h3 className="text-xl font-extrabold">{ticket.event.title}</h3><p>{formatDate(ticket.schedule?.startsAt, ticket.event.timeZone, locale, true)}</p><p>{[ticket.event.venue?.name, ticket.event.venue?.city].filter(Boolean).join(", ")}</p><div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-green-50 p-3"><span className="font-extrabold">{ticket.ticketCategory?.name}</span><span className="font-extrabold text-green-800">{formatMinorMoney(ticket.unitPriceMinor, ticket.currency, locale)}</span></div>{ticket.qrImageUrl && <div className="mx-auto w-full max-w-80 rounded-2xl border bg-white p-3"><Image unoptimized src={ticket.qrImageUrl} alt="QR code" width={320} height={320} className="h-auto w-full" /></div>}<a href={TICKETS_API + "?" + new URLSearchParams({ ticket: ticket.id, download: "pdf" })} className="flex min-h-11 items-center justify-center rounded-xl border px-4 font-bold">{locale === "fr" ? "Télécharger le PDF" : "Download PDF"}</a><p className="wrap-break-word text-sm">{ticket.number}</p><p className="rounded-xl bg-green-50 p-3 text-sm font-bold text-green-800">{locale === "fr" ? "Billet valable" : "Valid ticket"}</p><Link href={ticketTransferUrl(ticket.id)} className="flex min-h-11 items-center justify-center rounded-xl bg-[#087d30] px-4 font-bold text-white">{locale === "fr" ? "Transf\u00e9rer" : "Transfer"}</Link></div>; })() : <p role="alert" className="py-5">{locale === "fr" ? "Billet indisponible." : "Ticket unavailable."}</p>}</section></div>}</PublicAccountShell>
    </>
  );
}
