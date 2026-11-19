
"use client";
import Image from "next/image";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import TicketScanner, {
  type ScanResult,
  type ScannerLocale,
} from "@/components/scanner/TicketScanner";

import {
  defaultLocale,
  i18nConfig,
  normalizeLocale,
} from "@/i18n/config";

/**
 * ============================================================
 * TIKEMIA — PAGE SCANNER ORGANISATEUR
 * ============================================================
 *
 * Route :
 * /organizer/dashboard/scan
 *
 * API :
 * GET  /api/organizer/scan/events
 * POST /api/organizer/scan/verify
 *
 * Fonctions :
 *
 * - Même espace organisateur existant
 * - Liste des événements autorisés
 * - Recherche des événements
 * - Pagination côté PostgreSQL
 * - Sélection d'un événement
 * - Ouverture automatique de la caméra
 * - Validation QR continue
 * - Résultats instantanés
 * - Statistiques de la session locale
 * - Actualisation des événements
 * - Gestion des erreurs réseau
 * - Interface FR / EN
 * - Mobile / tablette / ordinateur
 *
 * IMPORTANT :
 *
 * La caméra et la vérification sont gérées
 * par TicketScanner.tsx.
 *
 * Les billets sont validés exclusivement
 * côté serveur, dans scanner.ts.
 *
 * Cette page ne crée aucun nouvel espace,
 * aucun menu et aucune table PostgreSQL.
 *
 * ============================================================
 */

/* ============================================================
   TYPES
============================================================ */

type ScanEvent = {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: "PUBLISHED";

  organization: {
    id: string;
    name: string;
  };

  timeZone: string;
  currency: string;
  capacity: number;

  schedule: {
    startsAt: string;
    endsAt: string | null;
  } | null;

  venue: {
    name: string;
    address: string;
    city: string;
    country: string;
  } | null;

  scanUrl: string;
  coverUrl?: string | null;
};

type EventsApiResponse = {
  success: boolean;
  events: ScanEvent[];

  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };

  fetchedAt?: string;
};

type LoadStatus =
  | "loading"
  | "ready"
  | "error"
  | "unauthorized";

type SessionStats = {
  accepted: number;
  rejected: number;
  lastResult: ScanResult | null;
};

const EMPTY_STATS: SessionStats = {
  accepted: 0,
  rejected: 0,
  lastResult: null,
};

/* ============================================================
   CONSTANTES
============================================================ */

const EVENTS_ENDPOINT =
  "/api/organizer/scan/events";

const EVENTS_PAGE_SIZE = 50;

const SEARCH_DELAY_MS = 350;

const REFRESH_INTERVAL_MS = 30_000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ============================================================
   TRADUCTIONS
============================================================ */

const TEXT = {
  fr: {
    pageTitle: "Scanner les billets",
    pageDescription:
      "Sélectionnez un événement et contrôlez les billets automatiquement.",

    selectTitle: "Choisir un événement",
    selectDescription:
      "Sélectionnez l'événement dont vous souhaitez contrôler les entrées.",

    eventSearch: "Rechercher un événement...",
    searchLabel: "Rechercher des événements",

    availableEvents: "Événements disponibles",

    loadingEvents: "Chargement des événements...",
    loadingMore: "Chargement...",
    loadMore: "Afficher plus d'événements",

    noEvents: "Aucun événement disponible",
    noEventsDescription:
      "Aucun événement publié ne vous est actuellement accessible pour le scan.",

    noSearchResult: "Aucun résultat",
    noSearchDescription:
      "Aucun événement ne correspond à votre recherche.",

    errorTitle: "Impossible de charger les événements",
    errorDescription:
      "La connexion au serveur a échoué. Vérifiez votre connexion et réessayez.",

    unauthorizedTitle: "Session expirée",
    unauthorizedDescription:
      "Reconnectez-vous à votre espace organisateur pour accéder au scanner.",

    retry: "Réessayer",
    login: "Se connecter",
    refresh: "Actualiser",

    selectEvent: "Scanner cet événement",
    published: "Publié",

    organizer: "Organisateur",
    date: "Date",
    location: "Lieu",
    capacity: "Capacité",
    seats: "places",

    noDate: "Date non renseignée",
    noLocation: "Lieu non renseigné",

    scannerTitle: "Contrôle des entrées",
    scannerDescription:
      "Présentez les QR codes à la caméra. Le scan suivant est automatique.",

    changeEvent: "Changer d'événement",
    selectedEvent: "Événement sélectionné",

    validated: "Entrées validées",
    rejected: "Billets refusés",
    totalScans: "Scans traités",

    sessionStats: "Statistiques de cette session",
    sessionNotice:
      "Ces compteurs concernent uniquement les scans effectués sur cet appareil depuis l'ouverture de cet événement.",

    lastResult: "Dernier résultat",
    waitingResult: "En attente du premier billet",

    lastUpdated: "Liste actualisée",
    automatic: "Scan automatique",

    scanningHint:
      "Après chaque contrôle, la caméra reste active. Aucun bouton « Scanner suivant » n'est nécessaire.",

    secureNotice:
      "Chaque billet est vérifié sur le serveur TIKEMIA. Une entrée n'est autorisée qu'après confirmation.",

    eventCount: "événement(s)",

    statusValid: "Entrée autorisée",
    statusRejected: "Accès refusé",
  },

  en: {
    pageTitle: "Ticket scanner",
    pageDescription:
      "Select an event and verify tickets automatically.",

    selectTitle: "Choose an event",
    selectDescription:
      "Select the event for which you want to check tickets.",

    eventSearch: "Search for an event...",
    searchLabel: "Search events",

    availableEvents: "Available events",

    loadingEvents: "Loading events...",
    loadingMore: "Loading...",
    loadMore: "Show more events",

    noEvents: "No events available",
    noEventsDescription:
      "You currently have no published events available for scanning.",

    noSearchResult: "No results",
    noSearchDescription:
      "No events match your search.",

    errorTitle: "Unable to load events",
    errorDescription:
      "The server connection failed. Check your connection and try again.",

    unauthorizedTitle: "Session expired",
    unauthorizedDescription:
      "Sign in to your organizer account to access the scanner.",

    retry: "Try again",
    login: "Sign in",
    refresh: "Refresh",

    selectEvent: "Scan this event",
    published: "Published",

    organizer: "Organizer",
    date: "Date",
    location: "Location",
    capacity: "Capacity",
    seats: "seats",

    noDate: "Date not provided",
    noLocation: "Location not provided",

    scannerTitle: "Entry control",
    scannerDescription:
      "Show QR codes to the camera. The next scan starts automatically.",

    changeEvent: "Change event",
    selectedEvent: "Selected event",

    validated: "Validated entries",
    rejected: "Rejected tickets",
    totalScans: "Processed scans",

    sessionStats: "Current session statistics",
    sessionNotice:
      "These counters only include scans processed on this device since opening this event.",

    lastResult: "Latest result",
    waitingResult: "Waiting for the first ticket",

    lastUpdated: "List updated",
    automatic: "Automatic scanning",

    scanningHint:
      "The camera stays active after each verification. No next-scan button is needed.",

    secureNotice:
      "Each ticket is verified on the TIKEMIA server. Entry is authorized only after confirmation.",

    eventCount: "event(s)",

    statusValid: "Entry authorized",
    statusRejected: "Entry denied",
  },
} as const;

/* ============================================================
   SYNCHRONISATION DE LA LANGUE
============================================================ */

function subscribeLocale(
  onChange: () => void,
): () => void {
  window.addEventListener(
    "storage",
    onChange,
  );

  window.addEventListener(
    "tikemia:locale-changed",
    onChange,
  );

  return () => {
    window.removeEventListener(
      "storage",
      onChange,
    );

    window.removeEventListener(
      "tikemia:locale-changed",
      onChange,
    );
  };
}

function readStoredLocale(): ScannerLocale {
  try {
    const saved = window.localStorage.getItem(
      i18nConfig.storageKey,
    );

    const result = normalizeLocale(
      saved ?? defaultLocale,
    );

    return result === "en" ? "en" : "fr";
  } catch {
    return "fr";
  }
}

function getServerLocale(): ScannerLocale {
  return "fr";
}

/* ============================================================
   VALIDATION DES DONNÉES API
============================================================ */

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function isScanEvent(
  value: unknown,
): value is ScanEvent {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.id !== "string" ||
    !UUID_PATTERN.test(value.id) ||
    typeof value.title !== "string" ||
    typeof value.slug !== "string" ||
    typeof value.category !== "string" ||
    value.status !== "PUBLISHED" ||
    typeof value.timeZone !== "string" ||
    typeof value.currency !== "string" ||
    typeof value.capacity !== "number" ||
    typeof value.scanUrl !== "string"
  ) {
    return false;
  }

  if (
    !isRecord(value.organization) ||
    typeof value.organization.id !== "string" ||
    typeof value.organization.name !== "string"
  ) {
    return false;
  }

  if (
    value.schedule !== null &&
    (
      !isRecord(value.schedule) ||
      typeof value.schedule.startsAt !== "string" ||
      (
        value.schedule.endsAt !== null &&
        typeof value.schedule.endsAt !== "string"
      )
    )
  ) {
    return false;
  }

  if (
    value.venue !== null &&
    (
      !isRecord(value.venue) ||
      typeof value.venue.name !== "string" ||
      typeof value.venue.city !== "string"
    )
  ) {
    return false;
  }

  return true;
}

function parseEventsResponse(
  data: unknown,
): EventsApiResponse {
  if (
    !isRecord(data) ||
    data.success !== true ||
    !Array.isArray(data.events) ||
    !isRecord(data.pagination)
  ) {
    throw new Error("INVALID_EVENTS_RESPONSE");
  }

  if (
    typeof data.pagination.hasMore !== "boolean" ||
    (
      data.pagination.nextCursor !== null &&
      typeof data.pagination.nextCursor !== "string"
    )
  ) {
    throw new Error("INVALID_EVENTS_PAGINATION");
  }

  if (
    !data.events.every(isScanEvent)
  ) {
    throw new Error("INVALID_EVENTS_DATA");
  }

  return {
    success: true,
    events: data.events,

    pagination: {
      limit:
        typeof data.pagination.limit === "number"
          ? data.pagination.limit
          : EVENTS_PAGE_SIZE,

      hasMore: data.pagination.hasMore,

      nextCursor: data.pagination.nextCursor,
    },

    fetchedAt:
      typeof data.fetchedAt === "string"
        ? data.fetchedAt
        : undefined,
  };
}

/* ============================================================
   UTILITAIRES D'AFFICHAGE
============================================================ */

function formatEventDate(
  value: string | null | undefined,
  locale: ScannerLocale,
  timeZone: string,
): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat(
      locale === "en" ? "en-GB" : "fr-FR",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      },
    ).format(date);
  } catch {
    return new Intl.DateTimeFormat(
      locale === "en" ? "en-GB" : "fr-FR",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      },
    ).format(date);
  }
}

function getVenueLabel(
  event: ScanEvent,
): string | null {
  if (!event.venue) {
    return null;
  }

  return [
    event.venue.name,
    event.venue.city,
  ]
    .filter(Boolean)
    .join(" — ");
}

/* ============================================================
   ICÔNES
============================================================ */

type IconProps = {
  className?: string;
};

function ScanIcon({
  className = "h-5 w-5",
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M7 3H5a2 2 0 0 0-2 2v2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M3 17v2a2 2 0 0 0 2 2h2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M4 12h16" />
    </svg>
  );
}

function CalendarIcon({
  className = "h-5 w-5",
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
      />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}

function SearchIcon({
  className = "h-5 w-5",
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

function RefreshIcon({
  className = "h-5 w-5",
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 7v5h-5" />
      <path d="M4 17v-5h5" />
      <path d="M5.8 9A7 7 0 0 1 18 7l2 5" />
      <path d="M18.2 15A7 7 0 0 1 6 17l-2-5" />
    </svg>
  );
}

function ArrowLeftIcon({
  className = "h-5 w-5",
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

/* ============================================================
   PAGE PRINCIPALE
============================================================ */

export default function OrganizerScanPage() {
  /* ==========================================================
     LANGUE
  ========================================================== */

  const locale = useSyncExternalStore(
    subscribeLocale,
    readStoredLocale,
    getServerLocale,
  );

  const t = TEXT[locale];

  /* ==========================================================
     ÉTATS — ÉVÉNEMENTS
  ========================================================== */

  const [events, setEvents] =
    useState<ScanEvent[]>([]);

  const [status, setStatus] =
    useState<LoadStatus>("loading");

  const [search, setSearch] =
    useState("");

  const [debouncedSearch, setDebouncedSearch] =
    useState("");

  const [cursor, setCursor] =
    useState<string | null>(null);

  const [nextCursor, setNextCursor] =
    useState<string | null>(null);

  const [hasMore, setHasMore] =
    useState(false);

  const [loadingMore, setLoadingMore] =
    useState(false);

  const [refreshVersion, setRefreshVersion] =
    useState(0);

  const [lastUpdated, setLastUpdated] =
    useState<string | null>(null);

  /* ==========================================================
     ÉTATS — SCANNER
  ========================================================== */

  const [selectedEvent, setSelectedEvent] =
    useState<ScanEvent | null>(null);

  const [stats, setStats] =
    useState<SessionStats>(EMPTY_STATS);

  const selectedEventRef =
    useRef<ScanEvent | null>(null);

  const requestCounterRef =
    useRef(0);

  /**
   * Récupérer l'événement de la query string
   * uniquement si l'API confirme qu'il est
   * accessible à cet utilisateur.
   */
  const initialEventIdRef =
    useRef<string | null>(null);

  /* ==========================================================
     INITIALISATION
  ========================================================== */

  useEffect(() => {
    try {
      const params =
        new URLSearchParams(window.location.search);

      const eventId = params.get("eventId");

      initialEventIdRef.current =
        eventId && UUID_PATTERN.test(eventId)
          ? eventId
          : null;
    } catch {
      initialEventIdRef.current = null;
    }
  }, []);

  /* ==========================================================
     RECHERCHE AVEC DÉLAI
  ========================================================== */

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, SEARCH_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [search]);

  /* ==========================================================
     MISE À JOUR DE LA RÉFÉRENCE DE SÉLECTION
  ========================================================== */

  useEffect(() => {
    selectedEventRef.current = selectedEvent;
  }, [selectedEvent]);

  /* ==========================================================
     SÉLECTION D'ÉVÉNEMENT
  ========================================================== */

  const selectEvent = useCallback(
    (event: ScanEvent) => {
      selectedEventRef.current = event;
      setSelectedEvent(event);
      setStats(EMPTY_STATS);

      initialEventIdRef.current = null;

      /**
       * Préserver le lien direct vers
       * l'événement sélectionné.
       *
       * Aucune navigation serveur.
       * Aucun rechargement de page.
       */
      try {
        const url = new URL(
          window.location.href,
        );

        url.searchParams.set(
          "eventId",
          event.id,
        );

        window.history.replaceState(
          null,
          "",
          `${url.pathname}${url.search}${url.hash}`,
        );
      } catch {
        // La sélection reste fonctionnelle.
      }
    },
    [],
  );

  const changeEvent = useCallback(() => {
    setSelectedEvent(null);
    selectedEventRef.current = null;
    setStats(EMPTY_STATS);

    initialEventIdRef.current = null;

    try {
      const url = new URL(
        window.location.href,
      );

      url.searchParams.delete("eventId");

      window.history.replaceState(
        null,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    } catch {
      // Aucun blocage de la navigation.
    }

    setCursor(null);
    setNextCursor(null);
    setRefreshVersion((value) => value + 1);
  }, []);

  /* ==========================================================
     ACTUALISATION MANUELLE
  ========================================================== */

  const refreshEvents = useCallback(() => {
    setCursor(null);
    setNextCursor(null);
    setRefreshVersion(
      (previous) => previous + 1,
    );
  }, []);

  /* ==========================================================
     CHARGEMENT PAGINÉ DES ÉVÉNEMENTS
  ========================================================== */

  useEffect(() => {
    /**
     * Tant que la caméra est ouverte,
     * nous n'effectuons pas de recherches
     * inutiles en arrière-plan.
     */
    if (selectedEventRef.current) {
      return;
    }

    const controller = new AbortController();

    const requestId =
      ++requestCounterRef.current;

    const isFirstPage = cursor === null;

    const loadEvents = async () => {
      if (isFirstPage) {
        setStatus("loading");
      } else {
        setLoadingMore(true);
      }

      try {
        const params = new URLSearchParams();

        params.set(
          "limit",
          String(EVENTS_PAGE_SIZE),
        );

        if (debouncedSearch) {
          params.set(
            "search",
            debouncedSearch,
          );
        }

        if (cursor) {
          params.set(
            "cursor",
            cursor,
          );
        }

        const response = await fetch(
          `${EVENTS_ENDPOINT}?${params.toString()}`,
          {
            method: "GET",

            credentials: "same-origin",

            cache: "no-store",

            headers: {
              Accept: "application/json",
              "Accept-Language": locale,
            },

            signal: controller.signal,
          },
        );

        if (
          controller.signal.aborted ||
          requestId !== requestCounterRef.current
        ) {
          return;
        }

        if (response.status === 401) {
          setStatus("unauthorized");
          return;
        }

        if (!response.ok) {
          throw new Error(
            "EVENTS_REQUEST_FAILED",
          );
        }

        const raw: unknown =
          await response.json();

        const result =
          parseEventsResponse(raw);

        if (
          controller.signal.aborted ||
          requestId !== requestCounterRef.current
        ) {
          return;
        }

        if (isFirstPage) {
          setEvents(result.events);
        } else {
          setEvents((previous) => {
            const known = new Set(
              previous.map((event) => event.id),
            );

            return [
              ...previous,
              ...result.events.filter(
                (event) => !known.has(event.id),
              ),
            ];
          });
        }

        setHasMore(
          result.pagination.hasMore,
        );

        setNextCursor(
          result.pagination.nextCursor,
        );

        setLastUpdated(
          result.fetchedAt ??
            new Date().toISOString(),
        );

        setStatus("ready");

        /**
         * Si le lien contient eventId,
         * l'événement doit obligatoirement
         * provenir des événements autorisés.
         */
        const requestedId =
          initialEventIdRef.current;

        if (requestedId) {
          const matched =
            result.events.find(
              (event) =>
                event.id === requestedId,
            );

          if (matched) {
            selectEvent(matched);
          }
        }
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        if (
          requestId ===
          requestCounterRef.current
        ) {
          if (isFirstPage) {
            setStatus("error");
          } else {
            /**
             * Conserver la liste déjà chargée
             * en cas d'échec d'une page suivante.
             */
            setHasMore(true);
          }
        }
      } finally {
        if (
          requestId ===
          requestCounterRef.current
        ) {
          setLoadingMore(false);
        }
      }
    };

    void loadEvents();

    return () => {
      controller.abort();
    };
  }, [
    cursor,
    debouncedSearch,
    refreshVersion,
    locale,
    selectEvent,
  ]);

  /* ==========================================================
     ACTUALISATION PÉRIODIQUE
  ========================================================== */

  useEffect(() => {
    const handleRefresh = () => {
      if (
        document.visibilityState === "visible" &&
        !selectedEventRef.current
      ) {
        refreshEvents();
      }
    };

    const timer = window.setInterval(
      handleRefresh,
      REFRESH_INTERVAL_MS,
    );

    window.addEventListener(
      "focus",
      handleRefresh,
    );

    return () => {
      window.clearInterval(timer);

      window.removeEventListener(
        "focus",
        handleRefresh,
      );
    };
  }, [refreshEvents]);

  /* ==========================================================
     CHANGEMENT DE RECHERCHE
  ========================================================== */

  const updateSearch = useCallback(
    (value: string) => {
      setSearch(value);

      /**
       * Repartir sur la première page
       * dès qu'une nouvelle recherche
       * est effectuée.
       */
      setCursor(null);
      setNextCursor(null);
    },
    [],
  );

  const loadMore = useCallback(() => {
    if (
      loadingMore ||
      !hasMore ||
      !nextCursor
    ) {
      return;
    }

    setCursor(nextCursor);
  }, [
    loadingMore,
    hasMore,
    nextCursor,
  ]);

  /* ==========================================================
     RÉSULTATS DU SCANNER
  ========================================================== */

  const handleScanPending = useCallback(() => {setStats(previous => ({...previous,lastResult:null}));}, []);
  const handleScanResult = useCallback(
    (result: ScanResult) => {
      /**
       * Le callback est déclenché uniquement
       * après réception d'une réponse métier
       * de l'API de vérification.
       *
       * Ce ne sont pas des statistiques
       * globales de tous les agents.
       */
      setStats((previous) => ({
        accepted:
          previous.accepted +
          (result.allowed ? 1 : 0),

        rejected:
          previous.rejected +
          (result.allowed ? 0 : 1),

        lastResult: result,
      }));
    },
    [],
  );

  /* ==========================================================
     DATES
  ========================================================== */

  const updatedLabel =
    lastUpdated
      ? formatEventDate(
          lastUpdated,
          locale,
          Intl.DateTimeFormat()
            .resolvedOptions()
            .timeZone || "UTC",
        )
      : null;

  const totalProcessed =
    stats.accepted +
    stats.rejected;

  /* ==========================================================
     AFFICHAGE
  ========================================================== */

  return (
    <main
      id="tikemia-organizer-scan-page"
      className="
        flex min-h-full w-full min-w-0
        flex-col bg-[#f8faf9]
        text-[#142138]
      "
    >
      {/* =====================================================
          EN-TÊTE DE PAGE
      ===================================================== */}

      <div
        className="
          border-b border-slate-200
          bg-white px-3 py-3
          sm:px-4 lg:px-5
        "
      >
        <div
          className="
            flex flex-wrap items-center
            justify-between gap-4
          "
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="
                flex h-12 w-12 shrink-0
                items-center justify-center
                rounded-xl bg-[#E9F7ED]
                text-[#087A32]
              "
            >
              <ScanIcon className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <h1
                className="
                  text-xl font-extrabold
                  tracking-tight text-[#142138]
                  sm:text-2xl
                "
              >
                {t.pageTitle}
              </h1>

              <p
                className="
                  mt-1 text-xs
                  leading-relaxed text-slate-500
                  sm:text-sm
                "
              >
                {t.pageDescription}
              </p>
            </div>
          </div>

          <div
            className="
              inline-flex items-center gap-2
              rounded-full border
              border-green-200 bg-green-50
              px-3 py-2
              text-xs font-semibold
              text-[#087A32]
            "
          >
            <span
              className="
                h-2 w-2 rounded-full
                bg-[#087A32]
              "
            />

            {t.automatic}
          </div>
        </div>
      </div>

      {/* =====================================================
          CONTENU PRINCIPAL
      ===================================================== */}

      <div
        className="
          flex w-full min-w-0 flex-1
          flex-col gap-3 p-3
          sm:p-4 lg:p-5
        "
      >
        {!selectedEvent ? (
          <>
            {/* ===============================================
                SÉLECTION DES ÉVÉNEMENTS
            =============================================== */}

            <section
              className="
                overflow-hidden rounded-2xl
                border border-slate-200
                bg-white shadow-sm
              "
            >
              <div
                className="
                  flex flex-wrap items-center
                  justify-between gap-3
                  border-b border-slate-100
                  p-4 sm:p-5
                "
              >
                <div>
                  <h2
                    className="
                      text-base font-bold
                      text-[#142138]
                      sm:text-lg
                    "
                  >
                    {t.selectTitle}
                  </h2>

                  <p
                    className="
                      mt-1 text-xs
                      leading-relaxed text-slate-500
                      sm:text-sm
                    "
                  >
                    {t.selectDescription}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={refreshEvents}
                  disabled={status === "loading"}
                  className="
                    inline-flex min-h-10
                    items-center justify-center
                    gap-2 rounded-lg
                    border border-slate-200
                    bg-white px-4 py-2
                    text-xs font-semibold
                    text-[#142138]
                    transition-colors
                    hover:bg-slate-50
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                    focus-visible:outline-2
                    focus-visible:outline-offset-2
                    focus-visible:outline-[#087A32]
                  "
                >
                  <RefreshIcon className="h-4 w-4" />

                  {t.refresh}
                </button>
              </div>

              {/* RECHERCHE */}

              <div className="p-4 sm:p-5">
                <label
                  htmlFor="tikemia-scan-event-search"
                  className="sr-only"
                >
                  {t.searchLabel}
                </label>

                <div className="relative">
                  <div
                    className="
                      pointer-events-none
                      absolute inset-y-0 left-3
                      flex items-center
                      text-slate-400
                    "
                  >
                    <SearchIcon className="h-5 w-5" />
                  </div>

                  <input
                    id="tikemia-scan-event-search"
                    type="search"
                    value={search}
                    onChange={(event) =>
                      updateSearch(
                        event.target.value,
                      )
                    }
                    maxLength={100}
                    autoComplete="off"
                    placeholder={t.eventSearch}
                    className="
                      min-h-12 w-full
                      rounded-xl border
                      border-slate-200
                      bg-[#fbfcfc]
                      py-3 pl-11 pr-4
                      text-sm text-[#142138]
                      outline-none
                      transition-colors
                      placeholder:text-slate-400
                      focus:border-[#087A32]
                      focus:ring-2
                      focus:ring-green-100
                    "
                  />
                </div>
              </div>

              {/* ÉTAT DE CHARGEMENT */}

              {status === "loading" && (
                <div
                  role="status"
                  aria-live="polite"
                  className="
                    flex min-h-48 flex-col
                    items-center justify-center
                    gap-3 px-4 py-8
                  "
                >
                  <div
                    className="
                      h-9 w-9 animate-spin
                      rounded-full
                      border-[3px]
                      border-green-100
                      border-t-[#087A32]
                    "
                  />

                  <p className="text-sm text-slate-500">
                    {t.loadingEvents}
                  </p>
                </div>
              )}

              {/* ERREUR D'AUTHENTIFICATION */}

              {status === "unauthorized" && (
                <div
                  className="
                    flex min-h-52 flex-col
                    items-center justify-center
                    px-5 py-8 text-center
                  "
                >
                  <h3
                    className="
                      text-base font-bold
                      text-[#142138]
                    "
                  >
                    {t.unauthorizedTitle}
                  </h3>

                  <p
                    className="
                      mt-2 max-w-md
                      text-sm text-slate-500
                    "
                  >
                    {t.unauthorizedDescription}
                  </p>

                  <a
                    href="/organizer"
                    className="
                      mt-5 inline-flex
                      min-h-11 items-center
                      justify-center rounded-xl
                      bg-[#087A32] px-5
                      text-sm font-semibold
                      text-white
                      hover:bg-[#06662A]
                    "
                  >
                    {t.login}
                  </a>
                </div>
              )}

              {/* ERREUR RÉSEAU */}

              {status === "error" && (
                <div
                  role="alert"
                  className="
                    flex min-h-52 flex-col
                    items-center justify-center
                    px-5 py-8 text-center
                  "
                >
                  <h3
                    className="
                      text-base font-bold
                      text-[#142138]
                    "
                  >
                    {t.errorTitle}
                  </h3>

                  <p
                    className="
                      mt-2 max-w-md
                      text-sm text-slate-500
                    "
                  >
                    {t.errorDescription}
                  </p>

                  <button
                    type="button"
                    onClick={refreshEvents}
                    className="
                      mt-5 min-h-11
                      rounded-xl bg-[#087A32]
                      px-5 text-sm font-semibold
                      text-white
                      hover:bg-[#06662A]
                    "
                  >
                    {t.retry}
                  </button>
                </div>
              )}

              {/* LISTE DES ÉVÉNEMENTS */}

              {status === "ready" && (
                <>
                  <div
                    className="
                      flex items-center
                      justify-between
                      border-y border-slate-100
                      bg-[#fbfcfc]
                      px-4 py-3
                      sm:px-5
                    "
                  >
                    <span
                      className="
                        text-xs font-semibold
                        text-slate-600
                      "
                    >
                      {t.availableEvents}
                    </span>

                    <span
                      className="
                        rounded-full bg-slate-100
                        px-3 py-1
                        text-xs font-semibold
                        text-slate-600
                      "
                    >
                      {events.length} {t.eventCount}
                    </span>
                  </div>

                  {events.length === 0 ? (
                    <div
                      className="
                        flex min-h-52 flex-col
                        items-center justify-center
                        px-5 py-8 text-center
                      "
                    >
                      <div
                        className="
                          flex h-14 w-14
                          items-center justify-center
                          rounded-full bg-slate-100
                          text-slate-500
                        "
                      >
                        <CalendarIcon className="h-7 w-7" />
                      </div>

                      <h3
                        className="
                          mt-4 text-base
                          font-bold text-[#142138]
                        "
                      >
                        {debouncedSearch
                          ? t.noSearchResult
                          : t.noEvents}
                      </h3>

                      <p
                        className="
                          mt-2 max-w-md
                          text-sm text-slate-500
                        "
                      >
                        {debouncedSearch
                          ? t.noSearchDescription
                          : t.noEventsDescription}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {events.map((event) => {
                        const date =
                          formatEventDate(
                            event.schedule?.startsAt,
                            locale,
                            event.timeZone,
                          );

                        const venue =
                          getVenueLabel(event);

                        return (
                          <article
                            key={event.id}
                            className="
                              flex flex-col
                              gap-4 p-4
                              transition-colors
                              hover:bg-[#fbfdfb]
                              sm:flex-row
                              sm:items-center
                              sm:justify-between
                              sm:p-5
                            "
                          >
                            <div className="flex min-w-0 flex-1 gap-3">
                              <div
                                className="
                                  flex h-12 w-12
                                  shrink-0 items-center
                                  justify-center
                                  rounded-xl
                                  bg-[#E9F7ED]
                                  text-[#087A32]
                                "
                              >
                                <CalendarIcon className="h-6 w-6" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div
                                  className="
                                    flex flex-wrap
                                    items-center gap-2
                                  "
                                >
                                  <h3
                                    className="
                                      text-sm font-bold
                                      text-[#142138]
                                      sm:text-base
                                      wrap-break-word
                                    "
                                  >
                                    {event.title}
                                  </h3>

                                  <span
                                    className="
                                      rounded-full
                                      bg-green-50
                                      px-2 py-1
                                      text-[10px]
                                      font-semibold
                                      text-[#087A32]
                                    "
                                  >
                                    {t.published}
                                  </span>
                                </div>

                                <p
                                  className="
                                    mt-1 text-xs
                                    text-slate-500
                                  "
                                >
                                  {t.organizer}:{" "}
                                  {event.organization.name}
                                </p>

                                <div
                                  className="
                                    mt-3 flex
                                    flex-wrap gap-x-4
                                    gap-y-2
                                    text-xs
                                    text-slate-600
                                  "
                                >
                                  <span>
                                    <strong className="font-semibold">
                                      {t.date}:
                                    </strong>{" "}
                                    {date || t.noDate}
                                  </span>

                                  <span>
                                    <strong className="font-semibold">
                                      {t.location}:
                                    </strong>{" "}
                                    {venue || t.noLocation}
                                  </span>

                                  <span>
                                    <strong className="font-semibold">
                                      {t.capacity}:
                                    </strong>{" "}
                                    {event.capacity.toLocaleString(
                                      locale === "en"
                                        ? "en-GB"
                                        : "fr-FR",
                                    )}{" "}
                                    {t.seats}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                selectEvent(event)
                              }
                              className="
                                inline-flex min-h-11
                                shrink-0 items-center
                                justify-center gap-2
                                rounded-xl bg-[#087A32]
                                px-5 py-3
                                text-sm font-semibold
                                text-white
                                transition-colors
                                hover:bg-[#06662A]
                                focus-visible:outline-2
                                focus-visible:outline-offset-2
                                focus-visible:outline-[#087A32]
                              "
                            >
                              <ScanIcon className="h-5 w-5" />
                              {t.selectEvent}
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  {hasMore && (
                    <div
                      className="
                        border-t border-slate-100
                        p-4 text-center
                      "
                    >
                      <button
                        type="button"
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="
                          min-h-11 rounded-xl
                          border border-slate-200
                          bg-white px-5
                          text-sm font-semibold
                          text-[#142138]
                          hover:bg-slate-50
                          disabled:opacity-60
                        "
                      >
                        {loadingMore
                          ? t.loadingMore
                          : t.loadMore}
                      </button>
                    </div>
                  )}
                </>
              )}

              {updatedLabel &&
                status === "ready" && (
                  <p
                    className="
                      border-t border-slate-100
                      px-4 py-3
                      text-right text-[11px]
                      text-slate-400
                    "
                  >
                    {t.lastUpdated}: {updatedLabel}
                  </p>
                )}
            </section>
          </>
        ) : (
          <>
            {/* ===============================================
                ÉVÉNEMENT SÉLECTIONNÉ
            =============================================== */}

            <section
              className="
                overflow-hidden rounded-2xl
                border border-slate-200
                bg-white shadow-sm
              "
            >
              <div
                className="
                  flex flex-wrap items-center
                  justify-between gap-3
                  p-4 sm:p-5
                "
              >
                <div className="min-w-0">
                  <p
                    className="
                      text-xs font-semibold
                      text-[#087A32]
                    "
                  >
                    {t.selectedEvent}
                  </p>

                  <h2
                    className="
                      mt-1 text-lg
                      font-bold text-[#142138]
                      sm:text-xl
                    "
                  >
                    {selectedEvent.title}
                  </h2>

                  <p
                    className="
                      mt-1 text-xs
                      text-slate-500
                    "
                  >
                    {selectedEvent.organization.name}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={changeEvent}
                  className="
                    inline-flex min-h-10
                    items-center justify-center
                    gap-2 rounded-xl
                    border border-slate-200
                    bg-white px-4 py-2
                    text-xs font-semibold
                    text-[#142138]
                    transition-colors
                    hover:bg-slate-50
                    focus-visible:outline-2
                    focus-visible:outline-offset-2
                    focus-visible:outline-[#087A32]
                  "
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  {t.changeEvent}
                </button>
              </div>
            </section>

            {/* ===============================================
                ZONE SCANNER ET STATISTIQUES
            =============================================== */}


            <div className="grid min-w-0 grid-cols-1 items-stretch gap-3 lg:grid-cols-2">
              <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                <TicketScanner key={selectedEvent.id} eventId={selectedEvent.id} locale={locale} onResult={handleScanResult} onPending={handleScanPending} compact />
              </div>
              <aside className="flex min-w-0 flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-live="polite" aria-atomic="true">
                <div className={`flex items-center gap-3 rounded-xl px-4 py-4 text-lg font-extrabold ${!stats.lastResult?"bg-slate-50 text-slate-600":stats.lastResult.allowed?"bg-green-50 text-green-900":"bg-red-50 text-red-800"}`}>
                  <span aria-hidden="true">{stats.lastResult?.allowed?"✓":stats.lastResult?"!":"◎"}</span>
                  {stats.lastResult?.message || t.waitingResult}
                </div>
                <div className="flex min-w-0 items-start gap-3">
                  {selectedEvent.coverUrl && <Image src={selectedEvent.coverUrl} alt="" width={112} height={112} unoptimized className="size-24 shrink-0 rounded-xl object-cover sm:size-28" />}
                  <div className="min-w-0 space-y-2"><h2 className="wrap-break-word text-lg font-extrabold text-slate-900">{selectedEvent.title}</h2>
                    <p className="text-sm text-slate-600">{formatEventDate(selectedEvent.schedule?.startsAt,locale,selectedEvent.timeZone) || t.noDate}</p>
                    <p className="wrap-break-word text-sm text-slate-600">{[selectedEvent.venue?.name,selectedEvent.venue?.city].filter(Boolean).join(", ") || t.noLocation}</p>
                  </div>
                </div>
                <dl className="divide-y divide-slate-100 border-y border-slate-100 text-sm">
                  <div className="flex items-center justify-between gap-3 py-4"><dt>{locale==="en"?"Category":"Catégorie"}</dt><dd className="rounded-full bg-green-100 px-3 py-1 font-bold text-green-900">{stats.lastResult?.ticket?.category || "—"}</dd></div>
                  <div className="flex items-start justify-between gap-3 py-4"><dt>{locale==="en"?"Holder":"Titulaire"}</dt><dd className="max-w-[70%] wrap-break-word text-right font-semibold">{stats.lastResult?.ticket?.holder || "—"}</dd></div>
                  {stats.lastResult?.ticket?.number && <div className="flex items-start justify-between gap-3 py-4"><dt>Billet</dt><dd className="max-w-[70%] break-all text-right text-xs font-semibold">{stats.lastResult.ticket.number}</dd></div>}
                </dl>
                <div className={`mt-auto rounded-xl p-4 text-center ${stats.lastResult?.allowed?"bg-green-700 text-white":stats.lastResult?"bg-red-50 text-red-800":"bg-slate-50 text-slate-600"}`}>
                  <p className="text-xl font-extrabold">{stats.lastResult ? stats.lastResult.allowed?t.statusValid:t.statusRejected:t.waitingResult}</p>
                  {stats.lastResult && <p className="mt-2 text-sm">{stats.lastResult.description}</p>}
                  {stats.lastResult && <p className="mt-2 text-xs">{formatEventDate(stats.lastResult.scannedAt,locale,selectedEvent.timeZone)}</p>}
                </div>
              </aside>
            </div>
            <section aria-label={t.sessionStats} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[[t.totalScans,totalProcessed,"text-blue-800"],[t.validated,stats.accepted,"text-green-800"],[t.rejected,stats.rejected,"text-red-700"],[locale==="en"?"Admitted participants":"Participants admis",stats.accepted,"text-green-800"]].map(([label,value,tone])=><div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className={`text-2xl font-extrabold ${tone}`}>{value}</p><p className="mt-1 text-xs font-semibold text-slate-600">{label}</p></div>)}
            </section>
            <p className="text-xs text-slate-500">{t.sessionStats} ? {locale==="en"?"This device":"Cet appareil"}</p>

          </>
        )}
      </div>
    </main>
  );
}
