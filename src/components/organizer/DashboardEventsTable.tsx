
"use client";

import { useMemo } from "react";
import Link from "next/link";

import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  ImageIcon,
  MapPin,
  Ticket,
} from "lucide-react";

/* ============================================
   TIKEMIA — ÉVÉNEMENTS DU DASHBOARD

   Fichier :
   src/components/organizer/
   DashboardEventsTable.tsx

   Fonctionnalités :
   - Tableau des événements sur PC
   - Cartes compactes sur mobile
   - Images des événements
   - Catégorie
   - Date
   - Ville / lieu
   - Billets vendus / capacité
   - Progression réelle des ventes
   - Statut de l'événement
   - Navigation vers les détails
   - Français / Anglais

   Les données sont reçues depuis
   la page principale du dashboard.

   Aucun chiffre fictif.
   Aucun appel API dupliqué.
   Aucun fichier CSS supplémentaire.
============================================ */

/* ============================================
   TYPES EXPORTÉS
============================================ */

export type DashboardEventStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "ON_SALE"
  | "ACTIVE"
  | "SOLD_OUT"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED"
  | "PAUSED";

export type DashboardEvent = {
  id: string;
  title: string;

  category: string | null;

  imageUrl?: string | null;

  city?: string | null;
  venue?: string | null;

  startsAt: string | null;
  endsAt?: string | null;

  ticketsSold: number;
  capacity: number;

  status: DashboardEventStatus | string;

  href?: string | null;
};

export type DashboardEventsTableProps = {
  events: DashboardEvent[];

  locale?: "fr" | "en";

  loading?: boolean;

  currency?: string;

  showHeader?: boolean;

  viewAllHref?: string;

  maxItems?: number;

  className?: string;
};

/* ============================================
   ROUTES
============================================ */

const ROUTES = {
  events: "/organizer/dashboard/events",
};

/* ============================================
   TRADUCTIONS
============================================ */

const TEXT = {
  fr: {
    title: "Événements en cours de vente",
    viewAll: "Voir tous mes événements",
    seeAllMobile: "Voir tout",
    event: "Événement",
    category: "Catégorie",
    date: "Date",
    sold: "Billets vendus",
    status: "Statut",
    actions: "Actions",
    details: "Voir détails",
    empty: "Aucun événement en cours de vente.",
    loading: "Chargement des événements...",
    tickets: "billets",
    noImage: "Aucune image",
    location: "Lieu",
    unknownDate: "Date non définie",
    unknownCategory: "Autres",
    unknownStatus: "Statut indisponible",
    draft: "Brouillon",
    pending: "En validation",
    published: "Publié",
    onSale: "En vente",
    active: "Actif",
    soldOut: "Complet",
    completed: "Terminé",
    cancelled: "Annulé",
    rejected: "Refusé",
    paused: "Suspendu",
  },

  en: {
    title: "Events currently on sale",
    viewAll: "View all my events",
    seeAllMobile: "View all",
    event: "Event",
    category: "Category",
    date: "Date",
    sold: "Tickets sold",
    status: "Status",
    actions: "Actions",
    details: "View details",
    empty: "No events currently on sale.",
    loading: "Loading events...",
    tickets: "tickets",
    noImage: "No image",
    location: "Location",
    unknownDate: "Date not set",
    unknownCategory: "Other",
    unknownStatus: "Status unavailable",
    draft: "Draft",
    pending: "Pending review",
    published: "Published",
    onSale: "On sale",
    active: "Active",
    soldOut: "Sold out",
    completed: "Completed",
    cancelled: "Cancelled",
    rejected: "Rejected",
    paused: "Paused",
  },
} as const;

/* ============================================
   CATÉGORIES
============================================ */

const CATEGORY_LABELS: Record<
  string,
  { fr: string; en: string }
> = {
  concerts: {
    fr: "Concert",
    en: "Concert",
  },
  culture: {
    fr: "Culture",
    en: "Culture",
  },
  formation: {
    fr: "Formation",
    en: "Training",
  },
  soirees: {
    fr: "Soirée",
    en: "Party",
  },
  tourisme: {
    fr: "Tourisme",
    en: "Tourism",
  },
  sport: {
    fr: "Sport",
    en: "Sports",
  },
  festival: {
    fr: "Festival",
    en: "Festival",
  },
  science: {
    fr: "Science",
    en: "Science",
  },
  religieux: {
    fr: "Religieux",
    en: "Religious",
  },
  gastronomie: {
    fr: "Gastronomie",
    en: "Food",
  },
  business: {
    fr: "Business",
    en: "Business",
  },
  autres: {
    fr: "Autres",
    en: "Other",
  },
};

/* ============================================
   STYLES DES STATUTS
============================================ */

const STATUS_STYLES: Record<
  string,
  {
    background: string;
    text: string;
    dot: string;
  }
> = {
  DRAFT: {
    background: "bg-gray-100",
    text: "text-gray-700",
    dot: "bg-gray-500",
  },

  PENDING_REVIEW: {
    background: "bg-amber-50",
    text: "text-amber-800",
    dot: "bg-amber-500",
  },

  PUBLISHED: {
    background: "bg-green-50",
    text: "text-green-800",
    dot: "bg-green-600",
  },

  ON_SALE: {
    background: "bg-[#e6f9dd]",
    text: "text-[#087522]",
    dot: "bg-[#0aab26]",
  },

  ACTIVE: {
    background: "bg-green-50",
    text: "text-green-800",
    dot: "bg-green-600",
  },

  SOLD_OUT: {
    background: "bg-blue-50",
    text: "text-blue-800",
    dot: "bg-blue-600",
  },

  COMPLETED: {
    background: "bg-slate-100",
    text: "text-slate-700",
    dot: "bg-slate-500",
  },

  CANCELLED: {
    background: "bg-red-50",
    text: "text-red-700",
    dot: "bg-red-500",
  },

  REJECTED: {
    background: "bg-red-50",
    text: "text-red-700",
    dot: "bg-red-500",
  },

  PAUSED: {
    background: "bg-orange-50",
    text: "text-orange-800",
    dot: "bg-orange-500",
  },
};

/* ============================================
   FONCTIONS UTILITAIRES
============================================ */

function formatNumber(
  value: number,
  locale: "fr" | "en"
): string {
  const safeValue =
    Number.isFinite(value) && value >= 0
      ? Math.floor(value)
      : 0;

  return new Intl.NumberFormat(
    locale === "fr" ? "fr-FR" : "en-US"
  ).format(safeValue);
}

function formatEventDate(
  value: string | null,
  locale: "fr" | "en"
): string {
  if (!value) {
    return TEXT[locale].unknownDate;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return TEXT[locale].unknownDate;
  }

  return new Intl.DateTimeFormat(
    locale === "fr" ? "fr-FR" : "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }
  ).format(date);
}

function formatCategory(
  category: string | null,
  locale: "fr" | "en"
): string {
  if (!category) {
    return TEXT[locale].unknownCategory;
  }

  const key = category
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "");

  return (
    CATEGORY_LABELS[key]?.[locale] ??
    category.trim()
  );
}

function getStatusLabel(
  status: string,
  locale: "fr" | "en"
): string {
  const t = TEXT[locale];

  switch (status.toUpperCase()) {
    case "DRAFT":
      return t.draft;

    case "PENDING_REVIEW":
      return t.pending;

    case "PUBLISHED":
      return t.published;

    case "ON_SALE":
      return t.onSale;

    case "ACTIVE":
      return t.active;

    case "SOLD_OUT":
      return t.soldOut;

    case "COMPLETED":
      return t.completed;

    case "CANCELLED":
      return t.cancelled;

    case "REJECTED":
      return t.rejected;

    case "PAUSED":
      return t.paused;

    default:
      return t.unknownStatus;
  }
}

function getStatusStyle(status: string) {
  return (
    STATUS_STYLES[status.toUpperCase()] ?? {
      background: "bg-gray-100",
      text: "text-gray-700",
      dot: "bg-gray-500",
    }
  );
}

function getProgress(
  sold: number,
  capacity: number
): number {
  if (
    !Number.isFinite(sold) ||
    !Number.isFinite(capacity) ||
    capacity <= 0
  ) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(
      0,
      (sold / capacity) * 100
    )
  );
}

function getLocation(
  event: DashboardEvent
): string | null {
  const parts = [
    event.city?.trim(),
    event.venue?.trim(),
  ].filter(
    (value): value is string =>
      Boolean(value)
  );

  if (parts.length === 0) {
    return null;
  }

  return parts.join(", ");
}

/* ============================================
   BADGE DE STATUT
============================================ */

function EventStatusBadge({
  status,
  locale,
}: {
  status: string;
  locale: "fr" | "en";
}) {
  const style = getStatusStyle(status);

  return (
    <span
      className={[
        "inline-flex max-w-full",
        "items-center justify-center",
        "gap-1.5 rounded-full",
        "px-2.5 py-1",
        "text-[11px] font-extrabold",
        "whitespace-nowrap",
        style.background,
        style.text,
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "size-1.5 shrink-0 rounded-full",
          style.dot,
        ].join(" ")}
      />

      {getStatusLabel(status, locale)}
    </span>
  );
}

/* ============================================
   IMAGE DE L'ÉVÉNEMENT
============================================ */

function EventThumbnail({
  src,
  title,
}: {
  src?: string | null;
  title: string;
}) {
  const safeSource =
    typeof src === "string" &&
    (
      src.startsWith("/") &&
      !src.startsWith("//")
    )
      ? src
      : typeof src === "string" &&
          /^https:\/\//i.test(src)
        ? src
        : null;

  return (
    <div className="relative flex h-13 w-17 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#eaf2ec] sm:h-14 sm:w-20">
      {safeSource ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={safeSource}
          alt={title}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      ) : (
        <ImageIcon
          size={24}
          className="text-green-700"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/* ============================================
   COMPOSANT PRINCIPAL
============================================ */

export default function DashboardEventsTable({
  events,
  locale = "fr",
  loading = false,
  showHeader = true,
  viewAllHref = ROUTES.events,
  maxItems = 3,
  className = "",
}: DashboardEventsTableProps) {
  const t = TEXT[locale];

  /* ==========================================
     DONNÉES À AFFICHER

     Ne pas modifier les événements reçus.

     Le tableau se limite aux données
     envoyées par la page principale.
  ========================================== */

  const visibleEvents = useMemo(() => {
    if (!Array.isArray(events)) {
      return [];
    }

    if (maxItems <= 0) {
      return events;
    }

    return events.slice(
      0,
      Math.floor(maxItems)
    );
  }, [events, maxItems]);

  /* ==========================================
     AFFICHAGE
  ========================================== */

  return (
    <section
      aria-labelledby="dashboard-events-title"
      aria-busy={loading}
      className={[
        "flex w-full min-w-0 flex-col",
        "overflow-hidden rounded-2xl",
        "border border-[#e4e8ed]",
        "bg-white shadow-sm",
        className,
      ].join(" ")}
    >
      {/* ======================================
          EN-TÊTE DE SECTION
      ====================================== */}

      {showHeader && (
        <div className="flex w-full flex-wrap items-center justify-between gap-2 px-3 pt-3 pb-2 sm:px-4 sm:pt-4">
          <div className="min-w-0">
            <h2
              id="dashboard-events-title"
              className="text-base leading-tight font-extrabold text-[#101828] sm:text-lg"
            >
              {t.title}
            </h2>

            <div className="mt-2 h-1 w-10 rounded-full bg-linear-to-r from-[#baff00] to-[#08a12b]" />
          </div>

          <Link
            href={viewAllHref}
            className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-green-600 bg-white px-3 py-1 text-[11px] font-extrabold text-green-800 transition-colors hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-green-700"
          >
            <span className="hidden sm:inline">
              {t.viewAll}
            </span>

            <span className="sm:hidden">
              {t.seeAllMobile}
            </span>

            <ArrowRight
              size={14}
              strokeWidth={2.4}
              aria-hidden="true"
            />
          </Link>
        </div>
      )}

      {/* ======================================
          CHARGEMENT
      ====================================== */}

      {loading ? (
        <div
          role="status"
          className="flex min-h-48 w-full flex-col items-center justify-center gap-3 px-4 py-8"
        >
          <div className="size-9 animate-spin rounded-full border-3 border-green-100 border-t-green-700" />

          <p className="text-sm font-medium text-gray-500">
            {t.loading}
          </p>
        </div>
      ) : visibleEvents.length === 0 ? (
        /* ====================================
           AUCUN ÉVÉNEMENT
        ==================================== */

        <div className="flex min-h-48 w-full flex-col items-center justify-center gap-3 px-4 py-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-green-50">
            <CalendarDays
              size={28}
              className="text-green-700"
              aria-hidden="true"
            />
          </div>

          <p className="text-sm font-medium text-gray-600">
            {t.empty}
          </p>
        </div>
      ) : (
        <>
          {/* ==================================
              VERSION PC

              Tableau visible à partir
              de 1024 pixels.

              Toute la largeur disponible.
          ================================== */}

          <div className="hidden w-full min-w-0 lg:block">
            <table className="w-full table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[14%]" />
                <col className="w-[15%]" />
                <col className="w-[17%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
              </colgroup>

              <thead>
                <tr className="border-y border-[#e5e9ee] bg-[#f7f9fb] text-xs font-extrabold text-[#243247]">
                  <th
                    scope="col"
                    className="px-3 py-3"
                  >
                    {t.event}
                  </th>

                  <th
                    scope="col"
                    className="px-2 py-3"
                  >
                    {t.category}
                  </th>

                  <th
                    scope="col"
                    className="px-2 py-3"
                  >
                    {t.date}
                  </th>

                  <th
                    scope="col"
                    className="px-2 py-3"
                  >
                    {t.sold}
                  </th>

                  <th
                    scope="col"
                    className="px-2 py-3"
                  >
                    {t.status}
                  </th>

                  <th
                    scope="col"
                    className="px-2 py-3 text-center"
                  >
                    {t.actions}
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#e5e9ee]">
                {visibleEvents.map((event) => {
                  const location =
                    getLocation(event);

                  const progress = getProgress(
                    event.ticketsSold,
                    event.capacity
                  );

                  return (
                    <tr
                      key={event.id}
                      className="transition-colors hover:bg-[#fbfdfb]"
                    >
                      {/* ÉVÉNEMENT */}

                      <td className="px-3 py-3 align-middle">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <EventThumbnail
                            src={event.imageUrl}
                            title={event.title}
                          />

                          <div className="min-w-0">
                            <p
                              title={event.title}
                              className="truncate text-xs font-extrabold text-[#101828] xl:text-sm"
                            >
                              {event.title}
                            </p>

                            {location && (
                              <p className="mt-1 flex min-w-0 items-center gap-1 text-[11px] text-gray-500">
                                <MapPin
                                  size={12}
                                  aria-hidden="true"
                                  className="shrink-0"
                                />

                                <span className="truncate">
                                  {location}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* CATÉGORIE */}

                      <td className="px-2 py-3 align-middle">
                        <span className="inline-block max-w-full truncate rounded-lg bg-[#edf8ea] px-2.5 py-1.5 text-[11px] font-bold text-green-800">
                          {formatCategory(
                            event.category,
                            locale
                          )}
                        </span>
                      </td>

                      {/* DATE */}

                      <td className="px-2 py-3 align-middle">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-[#334155]">
                          <CalendarDays
                            size={15}
                            aria-hidden="true"
                            className="shrink-0 text-gray-500"
                          />

                          <span>
                            {formatEventDate(
                              event.startsAt,
                              locale
                            )}
                          </span>
                        </div>
                      </td>

                      {/* BILLETS VENDUS */}

                      <td className="px-2 py-3 align-middle">
                        <div className="space-y-1.5">
                          <span className="text-xs font-extrabold whitespace-nowrap text-[#172b42]">
                            {formatNumber(
                              event.ticketsSold,
                              locale
                            )}
                            <span className="font-medium text-gray-500">
                              {" / "}
                              {formatNumber(
                                event.capacity,
                                locale
                              )}
                            </span>
                          </span>

                          <div
                            role="progressbar"
                            aria-label={t.sold}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(progress)}
                            className="h-1.5 w-full overflow-hidden rounded-full bg-[#e7efe6]"
                          >
                            <div
                              className="h-full rounded-full bg-[#1fb51d]"
                              style={{
                                width: `${progress}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* STATUT */}

                      <td className="px-2 py-3 align-middle">
                        <EventStatusBadge
                          status={event.status}
                          locale={locale}
                        />
                      </td>

                      {/* ACTION */}

                      <td className="px-2 py-3 text-center align-middle">
                        {event.href ? (
                          <Link
                            href={event.href}
                            className="inline-flex min-h-8 items-center justify-center rounded-lg bg-linear-to-b from-[#108d22] to-[#004e25] px-2.5 py-1.5 text-[11px] font-extrabold whitespace-nowrap text-white transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-green-700"
                          >
                            {t.details}
                          </Link>
                        ) : (
                          <span className="text-xs text-gray-400">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ==================================
              VERSION MOBILE / TABLETTE

              Photos à gauche.
              Informations à droite.
              Statut et progression visibles.

              Pas de tableau horizontal.
          ================================== */}

          <div className="divide-y divide-[#edf0f3] lg:hidden">
            {visibleEvents.map((event) => {
              const progress = getProgress(
                event.ticketsSold,
                event.capacity
              );

              const location =
                getLocation(event);

              return (
                <article
                  key={event.id}
                  className="w-full min-w-0 px-3 py-3 sm:px-4"
                >
                  <div className="flex w-full min-w-0 items-start gap-3">
                    {/* PHOTO */}

                    <EventThumbnail
                      src={event.imageUrl}
                      title={event.title}
                    />

                    {/* INFORMATIONS */}

                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <h3 className="line-clamp-2 min-w-0 text-xs leading-snug font-extrabold text-[#101828] sm:text-sm">
                          {event.title}
                        </h3>

                        {event.href && (
                          <Link
                            href={event.href}
                            aria-label={`${t.details} : ${event.title}`}
                            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-800 focus-visible:outline-2 focus-visible:outline-green-700"
                          >
                            <ChevronRight
                              size={17}
                              aria-hidden="true"
                            />
                          </Link>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="flex items-center gap-1 text-[11px] text-gray-600">
                          <CalendarDays
                            size={13}
                            aria-hidden="true"
                          />

                          {formatEventDate(
                            event.startsAt,
                            locale
                          )}
                        </span>

                        {location && (
                          <span className="flex min-w-0 items-center gap-1 text-[11px] text-gray-500">
                            <MapPin
                              size={12}
                              aria-hidden="true"
                              className="shrink-0"
                            />

                            <span className="max-w-40 truncate">
                              {location}
                            </span>
                          </span>
                        )}
                      </div>

                      {/* BILLETS ET STATUT */}

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Ticket
                            size={14}
                            aria-hidden="true"
                            className="text-green-700"
                          />

                          <span className="text-xs font-extrabold text-green-800">
                            {formatNumber(
                              event.ticketsSold,
                              locale
                            )}
                            <span className="font-medium text-gray-500">
                              {" / "}
                              {formatNumber(
                                event.capacity,
                                locale
                              )}
                            </span>
                          </span>
                        </div>

                        <EventStatusBadge
                          status={event.status}
                          locale={locale}
                        />
                      </div>

                      {/* BARRE DE PROGRESSION */}

                      <div
                        role="progressbar"
                        aria-label={t.sold}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(progress)}
                        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e7efe6]"
                      >
                        <div
                          className="h-full rounded-full bg-[#1fb51d]"
                          style={{
                            width: `${progress}%`,
                          }}
                        />
                      </div>
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
