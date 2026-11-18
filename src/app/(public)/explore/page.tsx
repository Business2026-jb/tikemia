
"use client";
import { VerifiedBadge } from "@/components/public/PublicNavigation";
import { eventCategoryLabel } from "@/i18n/config";

import { formatMinorMoney } from "@/i18n/config";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";

import { PublicCategoryStrip } from "@/components/public/PublicNavigation";
import Link from "next/link";
import { readPublicSearch, subscribePublicLocation } from "@/components/public/PublicNavigation";
import Image from "next/image";

import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Filter, Globe2, ImageOff, MapPin, Search, SlidersHorizontal, Ticket, UserRound, X, RefreshCw } from "lucide-react";


/* ==========================================================
   TIKEMIA — PAGE EXPLORER

   FICHIER :
   src/app/(public)/explore/page.tsx

   API :
   GET /api/public/explore

   CONTENU :
   ÉVÉNEMENTS UNIQUEMENT.

   AUCUNE CAGNOTTE.

   FONCTIONNALITÉS :
   - Recherche d'événements
   - Filtre pays
   - Filtre date
   - Filtre catégorie
   - Filtre ville
   - Catégories existantes
   - Priorité géographique via l'API
   - Événements réellement publiés
   - Nom de l'organisateur
   - Photo de l'organisateur
   - Image de l'événement
   - Lieu, ville, pays
   - Date et heure
   - Tarif réel
   - Pagination serveur
   - Actualisation des données
   - Français et anglais

   DESIGN :
   - PC : grille d'événements
   - Mobile : cartes horizontales
   - Pleine largeur
   - Aucun espace inutile
   - Footer PC uniquement
   - Menu mobile existant conservé

   SÉCURITÉ :
   - Aucune authentification nécessaire
   - Aucun accès aux API organisateur
   - Aucun prix fictif
   - Aucun événement fictif
   - Aucun composant supplémentaire
   - Aucun nouveau fichier CSS
========================================================== */

const API_URL = "/api/public/explore";

const PAGE_SIZE = 12;

const REFRESH_INTERVAL_MS = 60_000;

type Locale = "fr" | "en";

type Amount = {
  amountMinor: string;
  currency: string;
};

type Organizer = {
  blueBadgeEnabled?: boolean;
  id: string;
  name: string;
  profileName: string;
  photoUrl: string | null;
  photoStorageKey: string | null;
};

type EventItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;

  imageUrl: string | null;
  imageStorageKey: string | null;

  organizer: Organizer;

  venue: {
    name: string;
    address: string;
    city: string;
    country: string;
  } | null;

  schedule: {
    startsAt: string;
    endsAt: string | null;
    timeZone: string;
  } | null;

  pricing: {
    from: Amount | null;
    isFree: boolean;
    categories: {
      id: string;
      name: string;
      price: Amount;
      capacity: number;
    }[];
  };

  currency: string;
  publishedAt: string | null;
  href: string;
};

type ExploreResponse = {
  success: boolean;
  data?: {
    events?: EventItem[];
  };
  filters?: {
    query?: string;
    country?: string | null;
    city?: string | null;
    category?: string | null;
    date?: string | null;
    categories?: string[];
    countries?: string[];
  };
  geo?: {
    detectedCountry?: string | null;
    prioritizedCountry?: string | null;
    priorityApplied?: boolean;
    localResults?: number;
    manualCountrySelection?: boolean;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
};

type Filters = {
  q: string;
  country: string;
  city: string;
  date: string;
  category: string;
};

const EMPTY_FILTERS: Filters = {
  q: "",
  country: "",
  city: "",
  date: "",
  category: "",
};

/* ==========================================================
   TRADUCTIONS
========================================================== */

const TRANSLATIONS = {
  fr: {
    title: "Explorer",
    description:
      "Découvrez les événements publiés sur TIKEMIA.",

    searchPlaceholder:
      "Rechercher un événement...",
    search: "Rechercher",

    country: "Pays",
    allCountries: "Tous les pays",

    city: "Ville",
    allCities: "Toutes les villes",

    date: "Date",
    filter: "Filtrer",

    all: "Tous",
    categories: "Catégories",

    eventsTitle: "Billetterie (Événements)",
    allEvents: "Tous les événements",

    organizer: "Organisé par",
    book: "Réserver",
    from: "À partir de",
    free: "Gratuit",
    priceUnavailable: "Tarif à consulter",

    locationUnavailable: "Lieu à préciser",
    dateUnavailable: "Date à préciser",

    nearby: "Dans votre pays",
    detectedCountry: "Événements de votre pays en priorité",

    noEvents: "Aucun événement disponible",
    noEventsDescription:
      "Aucun événement ne correspond actuellement à votre recherche.",

    loading: "Chargement des événements...",

    error: "Impossible de charger les événements.",
    retry: "Réessayer",

    clear: "Effacer les filtres",
    apply: "Appliquer",
    cancel: "Fermer",

    page: "Page",
    of: "sur",
    previous: "Précédent",
    next: "Suivant",

    results: "événements trouvés",

    allCategory: "Toutes les catégories",
    searchOptions: "Filtres de recherche",

    imageUnavailable: "Image indisponible",
    organizerPhoto: "Photo de l'organisateur",

    categoryConcert: "Concert",
    categoryFestival: "Festival",
    categoryGala: "Gala",
    categoryConference: "Conférence",
    categorySport: "Sport",

    emptyCategory:
      "Les catégories apparaîtront dès que des événements seront publiés.",
  },

  en: {
    title: "Explore",
    description:
      "Discover published events on TIKEMIA.",

    searchPlaceholder:
      "Search for an event...",
    search: "Search",

    country: "Country",
    allCountries: "All countries",

    city: "City",
    allCities: "All cities",

    date: "Date",
    filter: "Filter",

    all: "All",
    categories: "Categories",

    eventsTitle: "Ticketing (Events)",
    allEvents: "All events",

    organizer: "Organized by",
    book: "Book now",
    from: "From",
    free: "Free",
    priceUnavailable: "View pricing",

    locationUnavailable: "Location to be confirmed",
    dateUnavailable: "Date to be confirmed",

    nearby: "In your country",
    detectedCountry: "Events in your country first",

    noEvents: "No events available",
    noEventsDescription:
      "No events currently match your search.",

    loading: "Loading events...",

    error: "Unable to load events.",
    retry: "Try again",

    clear: "Clear filters",
    apply: "Apply",
    cancel: "Close",

    page: "Page",
    of: "of",
    previous: "Previous",
    next: "Next",

    results: "events found",

    allCategory: "All categories",
    searchOptions: "Search filters",

    imageUnavailable: "Image unavailable",
    organizerPhoto: "Organizer photo",

    categoryConcert: "Concert",
    categoryFestival: "Festival",
    categoryGala: "Gala",
    categoryConference: "Conference",
    categorySport: "Sport",

    emptyCategory:
      "Categories will appear when events are published.",
  },
} as const;

/* ==========================================================
   UTILITAIRES
========================================================== */

function safeImage(
  value: string | null | undefined
): string | null {
  if (!value) return null;

  const src = value.trim();

  if (
    src.startsWith("/") &&
    !src.startsWith("//") &&
    !src.includes("\\")
  ) {
    return src;
  }

  try {
    const url = new URL(src);

    if (url.protocol === "https:") {
      return url.toString();
    }

    if (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(
        url.hostname
      )
    ) {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function safeHref(
  href: string,
  slug: string
): string {
  if (
    href.startsWith("/") &&
    !href.startsWith("//") &&
    !href.includes("\\")
  ) {
    return href;
  }

  return `/events/${encodeURIComponent(slug)}`;
}

/**
 * Formatage basé sur les unités mineures
 * utilisées dans le Prisma TIKEMIA.
 *
 * XOF : aucune décimale
 * EUR / USD : deux décimales
 *
 * La partie entière reste en BigInt.
 */
function formatMoney(
  amount: Amount | null | undefined,
  locale: Locale
): string { if (!amount || !/^-?\d+$/.test(amount.amountMinor)) return "?"; return formatMinorMoney(amount.amountMinor, amount.currency || "XOF", locale); }

function eventDate(
  schedule: EventItem["schedule"],
  locale: Locale
): string | null {
  if (!schedule?.startsAt) {
    return null;
  }

  const date = new Date(schedule.startsAt);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const language =
    locale === "fr" ? "fr-FR" : "en-US";

  try {
    return new Intl.DateTimeFormat(language, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: schedule.timeZone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(language, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(date);
  }
}

function countryDisplay(
  code: string,
  locale: Locale
): string {
  if (!/^[A-Z]{2}$/i.test(code)) {
    return code;
  }

  try {
    const display = new Intl.DisplayNames(
      [locale],
      { type: "region" }
    );

    return display.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

function normalizeCategory(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Icônes purement visuelles.
 *
 * Ces correspondances n'ajoutent aucune
 * catégorie dans la base de données.
 *
 * Le libellé reste exactement celui
 * retourné par l'API.
 */


/* ==========================================================
   IMAGE ÉVÉNEMENT
========================================================== */

function EventImage({
  src,
  title,
  className = "",
}: {
  src: string | null;
  title: string;
  className?: string;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);

  

  const valid = safeImage(src);

  if (!valid || (failedSource === src)) {
    return (
      <div
        role="img"
        aria-label={title}
        className={`flex items-center justify-center bg-[#eaf0eb] text-[#90a49a] ${className}`}
      >
        <ImageOff size={27} />
      </div>
    );
  }

  return (
    <Image fill sizes="(min-width: 1024px) 144px, 128px" unoptimized
      src={valid}
      alt={title}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSource(src)}
      className={`block object-cover ${className}`}
    />
  );
}

/* ==========================================================
   AVATAR ORGANISATEUR
========================================================== */

function OrganizerAvatar({
  organizer,
  compact = false,
}: {
  organizer: Organizer;
  compact?: boolean;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);

  const image = safeImage(organizer.photoUrl);

  

  const size = compact
    ? "size-7"
    : "size-9";

  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#d8e7dc] bg-[#e7f5ea] text-[#087e30]`}
    >
      {image && !(failedSource === image) ? (
        <Image width={960} height={640} unoptimized
          src={image}
          alt={organizer.name}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSource(image)}
          className="h-full w-full object-cover"
        />
      ) : (
        <UserRound
          size={compact ? 15 : 20}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/* ==========================================================
   CARTE ÉVÉNEMENT

   PC :
   Carte verticale.

   MOBILE :
   Carte horizontale compacte.

   Les deux versions affichent
   l'organisateur et sa photo.

   Un seul composant, deux présentations.
========================================================== */

function EventCard({
  event,
  locale,
}: {
  event: EventItem;
  locale: Locale;
}) {
  const t = TRANSLATIONS[locale];

  const href = safeHref(
    event.href,
    event.slug
  );

  const date = eventDate(
    event.schedule,
    locale
  );

  const city = [
    event.venue?.city,
    event.venue?.country,
  ]
    .filter(Boolean)
    .join(", ");

  const fullLocation = [
    event.venue?.name,
    event.venue?.address,
    city,
  ]
    .filter(Boolean)
    .join(" · ");

  const price =
    event.pricing.isFree
      ? t.free
      : event.pricing.from
        ? formatMoney(
            event.pricing.from,
            locale
          )
        : t.priceUnavailable;

  return (
    <article className="group min-w-0 overflow-hidden rounded-xl border border-[#e1e9e3] bg-white shadow-[0_2px_10px_rgba(12,46,27,0.05)] transition-shadow hover:shadow-md">

      {/* ==================================================
          VERSION MOBILE
      ================================================== */}

      <div className="flex min-w-0 gap-2.5 p-2">
        {/* IMAGE */}

        <Link
          href={href}
          aria-label={event.title}
          className="relative min-h-40 w-28 sm:w-36 shrink-0 self-stretch overflow-hidden rounded-lg bg-[#edf2ee]"
        >
          <EventImage
            src={event.imageUrl}
            title={event.title}
            className="absolute inset-0 h-full w-full"
          />
        </Link>

        {/* INFORMATIONS */}

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">

          {/* CATÉGORIE */}

          <div className="flex min-w-0 items-center">
            <span className="max-w-full truncate rounded-md bg-[#fff2cb] px-2 py-0.5 text-[11px] sm:text-sm font-bold text-[#a75e00]">
              {eventCategoryLabel(event.category, locale)}
            </span>
          </div>

          {/* TITRE */}

          <Link
            href={href}
            className="line-clamp-2 text-xs sm:text-base font-extrabold leading-tight text-[#14283c]"
          >
            {event.title}
          </Link>

          {/* LIEU */}

          <div className="flex min-w-0 items-center gap-1">
            <MapPin
              size={12}
              className="shrink-0 text-[#087b2d]"
            />

            <span
              title={fullLocation}
              className="truncate text-[11px] sm:text-sm text-[#526679]"
            >
              {fullLocation ||
                t.locationUnavailable}
            </span>
          </div>

          {/* DATE */}

          <div className="flex min-w-0 items-center gap-1">
            <CalendarDays
              size={12}
              className="shrink-0 text-[#087b2d]"
            />

            <span className="truncate text-[11px] sm:text-sm text-[#526679]">
              {date || t.dateUnavailable}
            </span>
          </div>

          {/* ORGANISATEUR */}

          <div className="flex min-w-0 items-center gap-1.5">
            <OrganizerAvatar
              organizer={event.organizer}
              compact
            />

            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs leading-tight text-[#86939e]">
                {t.organizer}
              </p>

              <p className=" text-[11px] sm:text-sm font-bold leading-tight text-[#284237] flex min-w-0 items-center gap-1">
                <span className="min-w-0 truncate">{event.organizer.name}</span>{event.organizer.blueBadgeEnabled && <VerifiedBadge />}
              </p>
            </div>
          </div>

          {/* PRIX + BOUTON */}

          <div className="mt-auto flex min-w-0 flex-wrap items-center justify-between gap-1.5 pt-1">
            <span className="max-w-full wrap-break-word rounded-lg bg-[#fff0ef] px-2 py-1 text-xs sm:text-sm font-black text-[#c82121]">
              {price}
            </span>

            <Link
              href={href}
              className="inline-flex min-h-8 items-center justify-center rounded-lg bg-[#087e2d] px-3 text-[11px] sm:text-sm font-extrabold text-white"
            >
              {t.book}
            </Link>
          </div>
        </div>
      </div>

      {/* ==================================================
          VERSION TABLETTE / PC
      ================================================== */}

      
    </article>
  );
}

/* ==========================================================
   SQUELETTE DE CHARGEMENT

   Uniquement pendant les requêtes.
   Aucune donnée fictive.
========================================================== */

function LoadingEvents() {
  return (
    <div className="grid w-full grid-cols-1 gap-2.5 md:grid-cols-2 sm:gap-4 xl:grid-cols-3">
      {Array.from({ length: 8 }).map(
        (_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="animate-pulse overflow-hidden rounded-xl border border-[#e8ede9] bg-white"
          >
            <div className="flex gap-2 p-2 sm:hidden">
              <div className="h-33 w-28 shrink-0 rounded-lg bg-[#e9efea]" />

              <div className="flex flex-1 flex-col gap-3 py-1">
                <div className="h-3 w-1/3 rounded bg-[#e9efea]" />
                <div className="h-4 w-4/5 rounded bg-[#e9efea]" />
                <div className="h-3 w-full rounded bg-[#e9efea]" />
                <div className="h-3 w-3/4 rounded bg-[#e9efea]" />
                <div className="mt-auto h-8 w-full rounded bg-[#e9efea]" />
              </div>
            </div>

            <div className="hidden sm:block">
              <div className="aspect-video bg-[#e9efea]" />

              <div className="space-y-3 p-4">
                <div className="h-4 w-4/5 rounded bg-[#e9efea]" />
                <div className="h-3 w-2/3 rounded bg-[#e9efea]" />
                <div className="h-3 w-3/4 rounded bg-[#e9efea]" />
                <div className="h-9 rounded bg-[#e9efea]" />
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}

/* ==========================================================
   PAGE EXPLORER
========================================================== */

export default function ExplorePage() {
  const search = useSyncExternalStore(subscribePublicLocation, readPublicSearch, () => null);
  if (search === null) return <div role="status" aria-label="Chargement" className="min-h-48 w-full animate-pulse bg-[#f7faf8]" />;
  return <ExplorePageContent key={search} initialSearch={search} />;
}
function ExplorePageContent({ initialSearch }: { initialSearch: string }) {

const params =
      new URLSearchParams(
        initialSearch
      );
const initialFilters: Filters = {
      q: (params.get("q") ?? "").slice(0, 120),

      country:
        (params.get("country") ?? "").slice(0, 100),

      city:
        (params.get("city") ?? "").slice(0, 100),

      date:
        (params.get("date") ?? "").slice(0, 10),

      category:
        (params.get("category") ?? "").slice(0, 100),
    };
const initialPage = Number(
      params.get("page") ?? "1"
    );
const validPage =
      Number.isSafeInteger(initialPage) &&
      initialPage >= 1 &&
      initialPage <= 1000
        ? initialPage
        : 1;
  /* ========================================================
     LANGUE
  ======================================================== */

  const [locale, setLocale] =
    useState<Locale>("fr");

  const t = TRANSLATIONS[locale];

  /* ========================================================
     DONNÉES
  ======================================================== */

  const [events, setEvents] =
    useState<EventItem[]>([]);

  const [categories, setCategories] =
    useState<string[]>([]);

  const [countries, setCountries] =
    useState<string[]>([]);

  const [geoCountry, setGeoCountry] =
    useState<string | null>(null);

  const [geoPriority, setGeoPriority] =
    useState(false);

  const [pagination, setPagination] =
    useState({
      page: 1,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrevious: false,
    });

  /* ========================================================
     FILTRES
  ======================================================== */

  const [draft, setDraft] =
    useState<Filters>(initialFilters);

  const [applied, setApplied] =
    useState<Filters>(initialFilters);

  const [page, setPage] = useState(validPage);

  const [filtersOpen, setFiltersOpen] =
    useState(false);

  /* ========================================================
     ÉTAT REQUÊTES
  ======================================================== */

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(false);

  const requestController =
    useRef<AbortController | null>(null);

  const appliedRef = useRef(applied);
  const pageRef = useRef(page);
  useEffect(() => { appliedRef.current = applied; pageRef.current = page; }, [applied, page]);
  /* ========================================================
     LANGUE FR / EN
  ======================================================== */

  useEffect(() => {
    function syncLanguage() {
      try {
        const stored =
          localStorage.getItem(
            "tikemia_locale"
          );

        if (
          stored === "fr" ||
          stored === "en"
        ) {
          setLocale(stored);
          return;
        }
      } catch {
        // Utiliser le français par défaut.
      }

      const htmlLocale =
        document.documentElement.lang
          .toLowerCase();

      setLocale(
        htmlLocale.startsWith("en")
          ? "en"
          : "fr"
      );
    }

    syncLanguage();

    window.addEventListener(
      "storage",
      syncLanguage
    );

    window.addEventListener(
      "tikemia:locale-changed",
      syncLanguage
    );

    return () => {
      window.removeEventListener(
        "storage",
        syncLanguage
      );

      window.removeEventListener(
        "tikemia:locale-changed",
        syncLanguage
      );
    };
  }, []);

  /* ========================================================
     RESTAURATION DES PARAMÈTRES URL

     Les liens provenant de l'accueil,
     par exemple :
     /explore?category=Concert

     peuvent préremplir les filtres.
  ======================================================== */

  const initialized = true;

  

  /* ========================================================
     CHARGEMENT API

     L'API assure :
     - Publication réelle
     - Filtrage
     - Recherche
     - Pagination
     - Priorité géographique
  ======================================================== */

  const fetchEvents = useCallback(
    async (
      filters: Filters,
      requestedPage: number,
      signal: AbortSignal
    ) => {
      const params =
        new URLSearchParams();

      params.set(
        "page",
        String(requestedPage)
      );

      params.set(
        "limit",
        String(PAGE_SIZE)
      );

      if (filters.q.trim()) {
        params.set("q", filters.q.trim());
      }

      if (filters.country) {
        params.set(
          "country",
          filters.country
        );
      }

      if (filters.city) {
        params.set(
          "city",
          filters.city
        );
      }

      if (filters.date) {
        params.set(
          "date",
          filters.date
        );
      }

      if (filters.category) {
        params.set(
          "category",
          filters.category
        );
      }

      const response = await fetch(
        `${API_URL}?${params.toString()}`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal,
        }
      );

      if (!response.ok) {
        throw new Error("EXPLORE_API_ERROR");
      }

      const json =
        (await response.json()) as ExploreResponse;

      if (
        json.success !== true ||
        !json.data ||
        !Array.isArray(json.data.events)
      ) {
        throw new Error(
          "INVALID_EXPLORE_RESPONSE"
        );
      }

      return json;
    },
    []
  );

  /* ========================================================
     CHARGEMENT AUTOMATIQUE

     Une seule requête active.
     Les anciennes requêtes sont annulées.

     Actualisation lorsque la page est visible.
  ======================================================== */

  useEffect(() => {
    if (!initialized) {
      return;
    }

    const controller =
      new AbortController();

    requestController.current?.abort();
    requestController.current = controller;

    let disposed = false;

    async function load() {
      setLoading(true);
      setError(false);

      try {
        const result = await fetchEvents(
          applied,
          page,
          controller.signal
        );

        if (
          disposed ||
          controller.signal.aborted
        ) {
          return;
        }

        setEvents(result.data?.events ?? []);

        setCategories(
          result.filters?.categories ?? []
        );

        setCountries(
          result.filters?.countries ?? []
        );

        setGeoCountry(
          result.geo?.detectedCountry ?? null
        );

        setGeoPriority(
          result.geo?.priorityApplied === true
        );

        if (result.pagination) {
          setPagination({
            page: result.pagination.page,
            total: result.pagination.total,
            totalPages:
              result.pagination.totalPages,
            hasNext:
              result.pagination.hasNext,
            hasPrevious:
              result.pagination.hasPrevious,
          });
        }
      } catch {
        if (
          disposed ||
          controller.signal.aborted
        ) {
          return;
        }

        setError(true);
      } finally {
        if (
          !disposed &&
          !controller.signal.aborted
        ) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [
    applied,
    page,
    initialized,
    fetchEvents,
  ]);

  /* ========================================================
     ACTUALISATION PÉRIODIQUE

     Ne recharge pas les filtres.
     Actualise les données publiées.
  ======================================================== */

  useEffect(() => {
    if (!initialized) {
      return;
    }

    let active = true;

    async function refresh() {
      if (
        !active ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      const controller =
        new AbortController();

      try {
        const result = await fetchEvents(
          appliedRef.current,
          pageRef.current,
          controller.signal
        );

        if (!active) return;

        setEvents(result.data?.events ?? []);

        setCategories(
          result.filters?.categories ?? []
        );

        setCountries(
          result.filters?.countries ?? []
        );

        setGeoCountry(
          result.geo?.detectedCountry ?? null
        );

        setGeoPriority(
          result.geo?.priorityApplied === true
        );

        if (result.pagination) {
          setPagination({
            page: result.pagination.page,
            total: result.pagination.total,
            totalPages:
              result.pagination.totalPages,
            hasNext:
              result.pagination.hasNext,
            hasPrevious:
              result.pagination.hasPrevious,
          });
        }

        setError(false);
      } catch {
        // Conserver les données précédentes.
      }
    }

    const interval = window.setInterval(
      () => {
        void refresh();
      },
      REFRESH_INTERVAL_MS
    );

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [initialized, fetchEvents]);

  /* ========================================================
     CATÉGORIES EXISTANTES

     Aucun tableau artificiel de catégories.
     On utilise uniquement celles de l'API.
  ======================================================== */

  const visibleCategories = useMemo(() => {
    const unique = new Map<string, string>();

    for (const value of categories) {
      const clean = value.trim();

      if (!clean) continue;

      const key =
        normalizeCategory(clean);

      if (!unique.has(key)) {
        unique.set(key, clean);
      }
    }

    return [...unique.values()];
  }, [categories]);



  /* ========================================================
     MODIFICATION DES FILTRES
  ======================================================== */

  function updateDraft(
    changes: Partial<Filters>
  ) {
    setDraft((previous) => ({
      ...previous,
      ...changes,
    }));
  }

  function updateUrl(
    nextFilters: Filters,
    nextPage: number
  ) {
    const params =
      new URLSearchParams();

    if (nextFilters.q.trim()) {
      params.set(
        "q",
        nextFilters.q.trim()
      );
    }

    if (nextFilters.country) {
      params.set(
        "country",
        nextFilters.country
      );
    }

    if (nextFilters.city) {
      params.set(
        "city",
        nextFilters.city
      );
    }

    if (nextFilters.date) {
      params.set(
        "date",
        nextFilters.date
      );
    }

    if (nextFilters.category) {
      params.set(
        "category",
        nextFilters.category
      );
    }

    if (nextPage > 1) {
      params.set(
        "page",
        String(nextPage)
      );
    }

    const query = params.toString();

    window.history.replaceState(
      null,
      "",
      query
        ? `/explore?${query}`
        : "/explore"
    );
  }

  function applyFilters(
    nextFilters: Filters
  ) {
    const cleanFilters: Filters = {
      q: nextFilters.q.trim().slice(0, 120),
      country: nextFilters.country,
      city: nextFilters.city.trim(),
      date: nextFilters.date,
      category: nextFilters.category,
    };

    setDraft(cleanFilters);
    setApplied(cleanFilters);
    setPage(1);
    setFiltersOpen(false);

    updateUrl(cleanFilters, 1);
  }

  function submitSearch(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    applyFilters(draft);
  }

  function selectCategory(
    category: string
  ) {
    applyFilters({
      ...applied,
      category,
      q: draft.q,
      country: draft.country,
      date: draft.date,
    });
  }

  function clearFilters() {
    applyFilters({
      ...EMPTY_FILTERS,
    });
  }

  function changePage(nextPage: number) {
    if (
      nextPage < 1 ||
      nextPage > pagination.totalPages ||
      nextPage === page
    ) {
      return;
    }

    setPage(nextPage);
    updateUrl(applied, nextPage);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  /* ========================================================
     PAGINATION
  ======================================================== */

  const pageNumbers = useMemo(() => {
    const total =
      pagination.totalPages;

    const current =
      pagination.page;

    if (total <= 0) return [];

    const start = Math.max(
      1,
      Math.min(current - 2, total - 4)
    );

    const end = Math.min(
      total,
      start + 4
    );

    return Array.from(
      { length: end - start + 1 },
      (_, index) => start + index
    );
  }, [
    pagination.totalPages,
    pagination.page,
  ]);

  const hasFilters =
    Boolean(
      applied.q ||
      applied.country ||
      applied.city ||
      applied.date ||
      applied.category
    );

  /* ========================================================
     RENDU
  ======================================================== */

  return (
    <>
      {/* ==================================================
          MASQUER LE FOOTER UNIQUEMENT SUR
          /explore EN VERSION MOBILE.

          Le footer reste visible :
          - sur PC
          - sur les autres pages publiques

          Aucun changement du layout.
      ================================================== */}

      

      <div
        id="tikemia-explore-page"
        className="flex w-full min-w-0 flex-1 flex-col bg-white text-[#17283b]"
      >
        {/* ==================================================
            EN-TÊTE PAGE + RECHERCHE

            PC :
            Titre et filtres sur une ligne.

            MOBILE :
            Titre, recherche puis filtres.
        ================================================== */}

        <section className="w-full bg-white px-3 pt-5 pb-4 sm:px-5 lg:px-8 lg:pt-8 lg:pb-5 xl:px-10">
          <div className="flex w-full min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">

            {/* TITRE */}

            <div className="shrink-0">
              <h1 className="text-[27px] font-black tracking-tight text-[#084c2a] sm:text-3xl lg:text-[36px]">
                {t.title}
              </h1>

              <div className="mt-2 h-1 w-13 rounded-full bg-linear-to-r from-[#07862d] to-[#f4ca16]" />
            </div>

            {/* RECHERCHE */}

            <form
              onSubmit={submitSearch}
              className="flex w-full min-w-0 flex-1 flex-col gap-2.5 sm:flex-row lg:justify-end"
            >
              <div className="relative min-w-0 flex-1">
                <Search
                  size={20}
                  className="pointer-events-none absolute top-3 left-3.5 text-[#263e48]"
                />

                <input
                  type="search"
                  value={draft.q}
                  onChange={(event) =>
                    updateDraft({
                      q: event.target.value,
                    })
                  }
                  maxLength={120}
                  placeholder={
                    t.searchPlaceholder
                  }
                  aria-label={
                    t.searchPlaceholder
                  }
                  className="h-11 w-full min-w-0 rounded-xl border border-[#dce5df] bg-[#fbfcfb] pr-3 pl-11 text-[13px] outline-none focus:border-[#087e2d] focus:ring-2 focus:ring-[#087e2d]/10 sm:text-sm"
                />
              </div>

              {/* FILTRES */}

              <div className="grid grid-cols-3 gap-2 sm:flex sm:shrink-0">

                {/* PAYS */}

                <div className="relative min-w-0">
                  <Globe2
                    size={16}
                    className="pointer-events-none absolute top-3.5 left-2 text-[#087d2c]"
                  />

                  <select
                    value={draft.country}
                    onChange={(event) => {
                      const next = {
                        ...draft,
                        country:
                          event.target.value,
                      };

                      applyFilters(next);
                    }}
                    aria-label={t.country}
                    className="h-11 w-full min-w-0 appearance-none rounded-xl border border-[#e0e8e2] bg-white pr-6 pl-7 text-[11px] font-semibold text-[#34495c] outline-none focus:border-[#087e2d] sm:w-37 sm:text-xs"
                  >
                    <option value="">
                      {t.country}
                    </option>

                    {countries.map((country) => (
                      <option
                        key={country}
                        value={country}
                      >
                        {country}
                      </option>
                    ))}
                  </select>

                  <ChevronDown
                    size={13}
                    className="pointer-events-none absolute top-3.5 right-1.5 text-[#66788a]"
                  />
                </div>

                {/* DATE */}

                <div className="min-w-0">
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(event) => {
                      const next = {
                        ...draft,
                        date: event.target.value,
                      };

                      applyFilters(next);
                    }}
                    aria-label={t.date}
                    className="h-11 w-full min-w-0 rounded-xl border border-[#e0e8e2] bg-white px-1.5 text-[10px] font-semibold text-[#34495c] outline-none focus:border-[#087e2d] sm:w-38 sm:px-2 sm:text-xs"
                  />
                </div>

                {/* FILTRES AVANCÉS */}

                <button
                  type="button"
                  onClick={() =>
                    setFiltersOpen(
                      (previous) => !previous
                    )
                  }
                  aria-expanded={filtersOpen}
                  aria-controls="explore-filters-panel"
                  className={`flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-bold transition-colors sm:px-4 sm:text-xs ${
                    filtersOpen
                      ? "border-[#087e2d] bg-[#eaf7ee] text-[#087e2d]"
                      : "border-[#e0e8e2] bg-white text-[#34495c]"
                  }`}
                >
                  <SlidersHorizontal size={17} />
                  {t.filter}
                  <ChevronDown size={13} />
                </button>
              </div>

              {/* BOUTON RECHERCHE DESKTOP */}

              <button
                type="submit"
                aria-label={t.search}
                className="hidden h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#087e2d] px-4 text-xs font-extrabold text-white lg:inline-flex"
              >
                <Search size={17} />
                {t.search}
              </button>
            </form>
          </div>

          {/* ==================================================
              OPTIONS DE FILTRAGE

              Réutilise les paramètres
              supportés par l'API existante.
          ================================================== */}

          {filtersOpen && (
            <div
              id="explore-filters-panel"
              className="mt-4 rounded-xl border border-[#dce8df] bg-[#f9fcfa] p-3 sm:p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-extrabold text-[#193c2b]">
                  <Filter size={17} />
                  {t.searchOptions}
                </h2>

                <button
                  type="button"
                  onClick={() =>
                    setFiltersOpen(false)
                  }
                  aria-label={t.cancel}
                  className="flex size-8 items-center justify-center rounded-lg hover:bg-[#e7f2e9]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                {/* VILLE */}

                <div>
                  <label
                    htmlFor="explore-city"
                    className="mb-1.5 block text-xs font-bold text-[#40576b]"
                  >
                    {t.city}
                  </label>

                  <input
                    id="explore-city"
                    type="text"
                    maxLength={100}
                    value={draft.city}
                    onChange={(event) =>
                      updateDraft({
                        city: event.target.value,
                      })
                    }
                    placeholder={t.allCities}
                    className="h-11 w-full rounded-xl border border-[#dce5df] bg-white px-3 text-sm outline-none focus:border-[#087d2e]"
                  />
                </div>

                {/* CATÉGORIE */}

                <div>
                  <label
                    htmlFor="explore-category"
                    className="mb-1.5 block text-xs font-bold text-[#40576b]"
                  >
                    {t.categories}
                  </label>

                  <select
                    id="explore-category"
                    value={draft.category}
                    onChange={(event) =>
                      updateDraft({
                        category:
                          event.target.value,
                      })
                    }
                    className="h-11 w-full rounded-xl border border-[#dce5df] bg-white px-3 text-sm outline-none focus:border-[#087d2e]"
                  >
                    <option value="">
                      {t.allCategory}
                    </option>

                    {visibleCategories.map(
                      (category) => (
                        <option
                          key={eventCategoryLabel(category, locale)}
                          value={category}
                        >
                          {eventCategoryLabel(category, locale)}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#d6e3da] bg-white px-4 text-xs font-bold text-[#516677]"
                >
                  <X size={15} />
                  {t.clear}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyFilters(draft)
                  }
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#087d2e] px-5 text-xs font-extrabold text-white"
                >
                  <Check size={16} />
                  {t.apply}
                </button>
              </div>
            </div>
          )}

          {/* ==================================================
              GÉOLOCALISATION

              Simple information visuelle.
              La priorité est assurée par l'API.
          ================================================== */}

          {geoCountry &&
            geoPriority &&
            !applied.country &&
            !loading && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#607769] sm:text-xs">
                <MapPin
                  size={14}
                  className="text-[#07842e]"
                />

                <span>
                  {t.detectedCountry} :
                </span>

                <strong className="text-[#08762c]">
                  {countryDisplay(
                    geoCountry,
                    locale
                  )}
                </strong>
              </div>
            )}
        </section>

        {/* ==================================================
            CATÉGORIES EXISTANTES

            Tous + catégories retournées
            par /api/public/explore.

            Aucun ajout en base.

            MOBILE :
            Défilement horizontal.

            PC :
            Grille flexible.
        ================================================== */}

        <section className="w-full bg-white px-3 pb-5 sm:px-5 lg:px-8 xl:px-10">
          <PublicCategoryStrip locale={locale} selected={applied.category} onSelect={selectCategory} />

          {!loading &&
            visibleCategories.length === 0 &&
            !error && (
              <p className="mt-2 text-xs text-[#81909b]">
                {t.emptyCategory}
              </p>
            )}
        </section>

        {/* ==================================================
            ÉVÉNEMENTS PUBLIÉS

            UNIQUEMENT LES ÉVÉNEMENTS.

            AUCUNE CAGNOTTE.

            PC :
            4 colonnes sur grands écrans.

            MOBILE :
            Cartes compactes horizontales.
        ================================================== */}

        <section className="w-full flex-1 bg-white px-3 pt-3 pb-7 sm:px-5 lg:px-8 lg:pt-5 lg:pb-9 xl:px-10">

          {/* TITRE SECTION */}

          <div className="mb-4 flex w-full min-w-0 flex-wrap items-center justify-between gap-3 border-b border-[#e8eeea] pb-3">
            <h2 className="flex min-w-0 items-center gap-2 text-base font-black text-[#074a2a] sm:text-xl lg:text-2xl">
              <Ticket
                size={24}
                className="shrink-0 text-[#efaa00]"
              />

              {t.eventsTitle}
            </h2>

            {!loading && !error && (
              <span className="text-[11px] font-semibold text-[#6c7f8f] sm:text-xs">
                {pagination.total}{" "}
                {t.results}
              </span>
            )}
          </div>

          {/* CHARGEMENT */}

          {loading ? (
            <LoadingEvents />
          ) : error ? (
            <div
              role="alert"
              className="flex min-h-55 flex-col items-center justify-center gap-3 rounded-xl border border-[#e4ebe6] bg-[#fbfcfb] p-5 text-center"
            >
              <RefreshCw
                size={30}
                className="text-[#087d2e]"
              />

              <p className="text-sm font-bold text-[#2d4152]">
                {t.error}
              </p>

              <button
                type="button"
                onClick={() => {
                  setError(false);
                  setLoading(true);

                  const controller =
                    new AbortController();

                  void fetchEvents(
                    applied,
                    page,
                    controller.signal
                  )
                    .then((result) => {
                      setEvents(
                        result.data?.events ?? []
                      );

                      setCategories(
                        result.filters?.categories ?? []
                      );

                      setCountries(
                        result.filters?.countries ?? []
                      );

                      setGeoCountry(
                        result.geo?.detectedCountry ??
                          null
                      );

                      setGeoPriority(
                        result.geo?.priorityApplied ===
                          true
                      );

                      if (result.pagination) {
                        setPagination({
                          page: result.pagination.page,
                          total: result.pagination.total,
                          totalPages:
                            result.pagination.totalPages,
                          hasNext:
                            result.pagination.hasNext,
                          hasPrevious:
                            result.pagination.hasPrevious,
                        });
                      }
                    })
                    .catch(() => setError(true))
                    .finally(() =>
                      setLoading(false)
                    );
                }}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#087e2d] px-5 text-xs font-bold text-white"
              >
                <RefreshCw size={16} />
                {t.retry}
              </button>
            </div>
          ) : events.length === 0 ? (
            <div className="flex min-h-55 flex-col items-center justify-center gap-3 rounded-xl border border-[#e4ebe6] bg-[#fbfcfb] p-5 text-center">
              <CalendarDays
                size={34}
                className="text-[#9ab2a0]"
              />

              <h3 className="text-base font-extrabold text-[#304758]">
                {t.noEvents}
              </h3>

              <p className="max-w-sm text-xs leading-relaxed text-[#758697]">
                {t.noEventsDescription}
              </p>

              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#087e2d] bg-white px-4 text-xs font-bold text-[#087e2d]"
                >
                  <X size={15} />
                  {t.clear}
                </button>
              )}
            </div>
          ) : (
            <div className="grid w-full min-w-0 grid-cols-1 gap-2.5 md:grid-cols-2 sm:gap-4 xl:grid-cols-3">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  locale={locale}
                />
              ))}
            </div>
          )}

          {/* ==================================================
              PAGINATION
          ================================================== */}

          {!loading &&
            !error &&
            pagination.totalPages > 1 && (
              <nav
                aria-label="Pagination"
                className="mt-7 flex w-full flex-wrap items-center justify-center gap-1.5 sm:gap-2"
              >
                <button
                  type="button"
                  onClick={() =>
                    changePage(page - 1)
                  }
                  disabled={
                    !pagination.hasPrevious
                  }
                  aria-label={t.previous}
                  className="flex size-10 items-center justify-center rounded-xl border border-[#dfe8e2] bg-white text-[#365065] disabled:opacity-40"
                >
                  <ChevronLeft size={19} />
                </button>

                {pageNumbers.map((number) => (
                  <button
                    key={number}
                    type="button"
                    onClick={() =>
                      changePage(number)
                    }
                    aria-label={`${t.page} ${number}`}
                    aria-current={
                      number === page
                        ? "page"
                        : undefined
                    }
                    className={`flex size-10 items-center justify-center rounded-xl text-xs font-extrabold ${
                      number === page
                        ? "bg-[#087e2d] text-white"
                        : "border border-[#dfe8e2] bg-white text-[#40576b]"
                    }`}
                  >
                    {number}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    changePage(page + 1)
                  }
                  disabled={
                    !pagination.hasNext
                  }
                  aria-label={t.next}
                  className="flex size-10 items-center justify-center rounded-xl border border-[#dfe8e2] bg-white text-[#365065] disabled:opacity-40"
                >
                  <ChevronRight size={19} />
                </button>
              </nav>
            )}
        </section>

        {/* ==================================================
            FIN PAGE EXPLORER

            Aucun footer créé ici.
            Aucun menu dupliqué.

            Le footer commun reste visible
            sur PC grâce au layout public.

            Sur mobile, le footer est masqué
            uniquement pour cette page.

            Les cinq menus mobiles existants
            restent affichés en bas.
        ================================================== */}
      </div>
    </>
  );
}
