
"use client";
import { formatMinorMoney } from "@/i18n/config";


import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  FilterX,
  
  ImageIcon,
  
  LoaderCircle,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Ticket,
  Users,
  Wallet,
  X,
} from "lucide-react";

/**
 * ============================================================
 * TIKEMIA — ADMINISTRATION / ÉVÉNEMENTS
 * ============================================================
 *
 * FICHIER :
 * src/app/admin/events/page.tsx
 *
 * PAGE :
 * /admin/events
 *
 * API :
 * GET /api/admin/events
 *
 * FONCTIONNALITÉS :
 *
 * - Statistiques des événements publiés
 * - Nombre d'organisateurs
 * - Recettes des événements par devise
 * - Recherche
 * - Filtre par statut
 * - Pagination
 * - Tableau responsive sur PC
 * - Cartes responsive sur mobile
 * - Fenêtre Voir
 * - Informations organisateur
 * - Description complète
 * - Dates et horaires
 * - Lieu
 * - Images disponibles
 * - Catégories et prix des billets
 * - Billets vendus
 * - Recettes brutes
 * - Actualisation automatique
 * - Messages d'erreur et états de chargement
 *
 * AUCUNE donnée fictive.
 * AUCUNE modification PostgreSQL.
 * AUCUN paiement exécuté.
 * AUCUN nouveau fichier nécessaire.
 *
 * Le layout /admin existant conserve
 * son menu et son identité visuelle.
 *
 * ============================================================
 */

/* ============================================================
   CONFIGURATION
============================================================ */

const API_URL = "/api/admin/events";

const PAGE_SIZE = 20;

const REFRESH_INTERVAL = 30_000;

const SEARCH_DELAY = 350;

const STATUS_OPTIONS = [
  { value: "ALL", label: "Tous les statuts" },
  { value: "PUBLISHED", label: "Publiés" },
  { value: "SUSPENDED", label: "Suspendus" },
  { value: "COMPLETED", label: "Terminés" },
  { value: "CANCELLED", label: "Annulés" },
  { value: "ARCHIVED", label: "Archivés" },
] as const;

/* ============================================================
   TYPES
============================================================ */

type EventStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "SUSPENDED"
  | "COMPLETED"
  | "CANCELLED"
  | "ARCHIVED";

type StatusFilter =
  | "ALL"
  | "PUBLISHED"
  | "SUSPENDED"
  | "COMPLETED"
  | "CANCELLED"
  | "ARCHIVED";

type CurrencyTotal = {
  currency: string;
  amountMinor: string;
};

type OrganizerOwner = {
  id: string;
  fullName: string;
  email: string;
};

type EventOrganizer = {
  id: string;
  name: string;
  email: string | null;
  phoneE164: string | null;
  countryCode: string | null;
  city: string | null;
  isActive: boolean;
  blueBadgeEnabled: boolean;
  owner: OrganizerOwner;
};

type EventVenue = {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  imageKey: string | null;
};

type EventSchedule = {
  id: string;
  startsAt: string;
  endsAt: string | null;
  label: string | null;
};

type EventImage = {
  id: string;
  storageKey: string;
  isPrimary: boolean;
  position: number;
};

type TicketCategory = {
  id: string;
  name: string;
  description: string | null;
  priceMinor: string;
  currency: string;
  capacity: number;
  isActive: boolean;
  ticketsSold: number;
  grossRevenueMinor: string;
};

type AdminEvent = {
  id: string;
  organizationId: string;

  title: string;
  slug: string;
  category: string;
  description: string;

  status: EventStatus;

  currency: string;
  timeZone: string;
  capacity: number;

  scheduleKind: string;
  ticketValidity: string;

  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;

  organizer: EventOrganizer;
  venue: EventVenue | null;

  startAt: string | null;
  endAt: string | null;

  schedules: EventSchedule[];

  mainImageKey: string | null;
  images: EventImage[];

  categories: TicketCategory[];

  ticketsSold: number;
  grossRevenue: CurrencyTotal[];

  revenueBasis: string;
  source: string;
};

type EventsSummary = {
  totalEvents: number;
  totalOrganizers: number;
  totalTicketsSold: number;
  grossRevenue: CurrencyTotal[];
  revenueBasis: string;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type EventsData = {
  events: AdminEvent[];

  summary: EventsSummary;

  pagination: Pagination;

  filters: {
    page: number;
    pageSize: number;
    search: string;
    status: string;
  };

  refreshedAt: string;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  code?: string;
  message?: string;
};

/* ============================================================
   UTILITAIRES
============================================================ */

function formatDate(
  input: string | null | undefined
): string {
  if (!input) return "—";

  const date = new Date(input);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(date);
}

function formatDateTime(
  input: string | null | undefined
): string {
  if (!input) return "—";

  const date = new Date(input);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatNumber(
  value: number
): string {
  return new Intl.NumberFormat(
    "fr-FR"
  ).format(value);
}

/**
 * Montants PostgreSQL transmis en chaînes.
 *
 * EUR / USD : généralement 2 décimales.
 * XOF : 0 décimale.
 *
 * BigInt évite les pertes de précision
 * sur les montants importants.
 */

function formatMoney(
  minor: string,
  currency: string
): string {
  return formatMinorMoney(minor, currency, "fr");
}

function formatRevenue(
  amounts: CurrencyTotal[]
): string {
  if (!amounts.length) {
    return "Aucune vente";
  }

  return amounts
    .map((item) =>
      formatMoney(
        item.amountMinor,
        item.currency
      )
    )
    .join(" · ");
}

function statusLabel(
  status: EventStatus
): string {
  const labels: Record<EventStatus, string> = {
    DRAFT: "Brouillon",
    PENDING_REVIEW: "En attente",
    PUBLISHED: "Publié",
    SUSPENDED: "Suspendu",
    COMPLETED: "Terminé",
    CANCELLED: "Annulé",
    ARCHIVED: "Archivé",
  };

  return labels[status] ?? status;
}

function scheduleKindLabel(
  value: string
): string {
  const labels: Record<string, string> = {
    SINGLE_DATE: "Date unique",
    DATE_RANGE: "Période déterminée",
    CONTINUOUS: "Événement continu",
  };

  return labels[value] ?? value;
}

function ticketValidityLabel(
  value: string
): string {
  const labels: Record<string, string> = {
    ENTIRE_EVENT: "Événement entier",
    SESSION: "Séance précise",
  };

  return labels[value] ?? value;
}

function errorLabel(
  code?: string
): string {
  const messages: Record<string, string> = {
    UNAUTHORIZED:
      "Votre session administrateur est expirée ou non reconnue. Reconnectez-vous.",

    FORBIDDEN:
      "Vous n'avez pas l'autorisation de consulter cette page.",

    INVALID_REQUEST:
      "Les paramètres de recherche sont invalides.",

    DATABASE_ERROR:
      "Impossible de charger les événements.",
  };

  return (
    (code && messages[code]) ||
    "Impossible de charger les événements. Réessayez."
  );
}

function getErrorMessage(
  error: unknown
): string {
  return error instanceof Error
    ? error.message
    : "Une erreur inattendue est survenue.";
}

function isAbortError(
  error: unknown
): boolean {
  return (
    error instanceof Error &&
    error.name === "AbortError"
  );
}

async function readApi<T>(
  response: Response
): Promise<T> {
  let payload: ApiResponse<T>;

  try {
    payload =
      (await response.json()) as ApiResponse<T>;
  } catch {
    throw new Error(
      "Le serveur a retourné une réponse invalide."
    );
  }

  if (
    !response.ok ||
    payload?.success !== true ||
    payload.data === undefined
  ) {
    throw new Error(
      errorLabel(payload?.code)
    );
  }

  return payload.data;
}

/**
 * Les images TIKEMIA sont stockées sous
 * la forme de storageKey.
 *
 * Sans connaître la route de livraison
 * des médias déjà créée dans TIKEMIA,
 * on ne doit pas inventer d'URL.
 *
 * Si une image contient déjà une URL locale
 * publique valide, elle peut être affichée.
 *
 * Les autres images seront signalées
 * comme présentes dans le stockage.
 */

function existingImageUrl(
  storageKey: string | null
): string | null {
  if (!storageKey) return null;
  try { const url = new URL(storageKey); if (url.protocol === "https:" && !url.username && !url.password) return url.toString(); } catch { /* A local image can be a relative path. */ }

  if (
    storageKey.startsWith("/") &&
    !storageKey.startsWith("//") &&
    !storageKey.includes("\\") &&
    !storageKey.includes("..") &&
    !/[\r\n]/.test(storageKey)
  ) {
    return storageKey;
  }

  return null;
}

/* ============================================================
   COMPOSANTS VISUELS
============================================================ */

function StatusBadge({
  status,
}: {
  status: EventStatus;
}) {
  const colors: Record<EventStatus, string> = {
    DRAFT:
      "border-slate-200 bg-slate-100 text-slate-700",

    PENDING_REVIEW:
      "border-amber-200 bg-amber-50 text-amber-700",

    PUBLISHED:
      "border-emerald-200 bg-emerald-50 text-emerald-700",

    SUSPENDED:
      "border-orange-200 bg-orange-50 text-orange-700",

    COMPLETED:
      "border-blue-200 bg-blue-50 text-blue-700",

    CANCELLED:
      "border-red-200 bg-red-50 text-red-700",

    ARCHIVED:
      "border-slate-200 bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
        colors[status] ??
        "border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      {status === "PUBLISHED" ? (
        <CheckCircle2 size={13} />
      ) : (
        <Clock3 size={13} />
      )}

      {statusLabel(status)}
    </span>
  );
}

function StatCard({
  title,
  value,
  icon,
  description,
}: {
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#e1e9e4] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-[#728293]">
          {title}
        </p>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e7f5eb] text-[#087a32]">
          {icon}
        </div>
      </div>

      <p className="mt-4 wrap-break-word text-[26px] font-black tracking-tight text-[#14263d] sm:text-[30px]">
        {value}
      </p>

      {description && (
        <p className="mt-2 text-[11px] leading-relaxed text-[#84929d]">
          {description}
        </p>
      )}
    </div>
  );
}

function DetailField({
  title,
  value,
  icon,
}: {
  title: string;
  value: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-[#edf1ee] py-3 last:border-0">
      {icon && (
        <span className="mt-0.5 shrink-0 text-[#84929e]">
          {icon}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-[#81909d]">
          {title}
        </p>

        <div className="mt-1 wrap-break-word text-[13px] font-bold text-[#24384e]">
          {value || "—"}
        </div>
      </div>
    </div>
  );
}

function EventThumbnail({
  storageKey,
  large = false,
}: {
  storageKey: string | null;
  large?: boolean;
}) {
  const src = existingImageUrl(storageKey);

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-[#e9f3ed] text-[#83a894] ${
        large
          ? "h-44 w-full rounded-2xl sm:h-56"
          : "h-12 w-12 rounded-xl"
      }`}
    >
      {src ? (
        // Les URLs proviennent uniquement de chemins
        // locaux déjà enregistrés en base.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <ImageIcon
            size={large ? 38 : 21}
          />

          {large && (
            <span className="text-xs font-semibold">
              {storageKey
                ? "Image enregistrée dans TIKEMIA"
                : "Aucune image"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   FENÊTRE VOIR — DÉTAILS DE L'ÉVÉNEMENT
============================================================ */

function EventDialog({
  event,
  onClose,
}: {
  event: AdminEvent;
  onClose: () => void;
}) {
  const dialogRef =
    useRef<HTMLDivElement | null>(null);

  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  /* ==========================================================
     ACCESSIBILITÉ ET FERMETURE
  ========================================================== */

  useEffect(() => {
    const previousOverflow =
      document.body.style.overflow;

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    document.body.style.overflow = "hidden";

    dialogRef.current?.focus();

    function keyDown(
      keyboardEvent: KeyboardEvent
    ) {
      if (keyboardEvent.key === "Escape") {
        closeRef.current();
        return;
      }

      if (keyboardEvent.key !== "Tab") {
        return;
      }

      const dialog = dialogRef.current;

      if (!dialog) {
        return;
      }

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(
        (element) =>
          element.getClientRects().length > 0
      );

      if (focusable.length === 0) {
        keyboardEvent.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (
        keyboardEvent.shiftKey &&
        document.activeElement === first
      ) {
        keyboardEvent.preventDefault();
        last.focus();
      } else if (
        !keyboardEvent.shiftKey &&
        document.activeElement === last
      ) {
        keyboardEvent.preventDefault();
        first.focus();
      }
    }

    document.addEventListener(
      "keydown",
      keyDown
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      document.removeEventListener(
        "keydown",
        keyDown
      );

      previousFocus?.focus();
    };
  }, []);

  const totalCapacity =
    event.categories.reduce(
      (sum, category) =>
        sum + category.capacity,
      0
    );

  const primaryImage =
    event.images.find(
      (image) => image.isPrimary
    ) ??
    event.images[0] ??
    null;

  /* ==========================================================
     RENDU
  ========================================================== */

  return (
    <div
      className="fixed inset-0 z-100 flex items-end justify-center bg-[#0a1728]/75 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
      onMouseDown={(mouseEvent) => {
        if (
          mouseEvent.target ===
          mouseEvent.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-dialog-title"
        tabIndex={-1}
        className="flex h-dvh max-h-dvh sm:h-auto w-full max-w-200 flex-col overflow-hidden rounded-none bg-white shadow-2xl outline-none sm:max-h-[93dvh] sm:rounded-3xl"
      >
        {/* EN-TÊTE */}

        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e3ebe5] bg-white px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e7f6ec] text-[#087a32]">
              <CalendarDays size={22} />
            </div>

            <div className="min-w-0">
              <h2
                id="event-dialog-title"
                className="truncate text-[17px] font-black text-[#14283d] sm:text-xl"
              >
                Détails de l&apos;événement
              </h2>

              <p className="mt-1 text-xs text-[#758594]">
                Consultation administrateur
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer les détails"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e0e8e3] text-[#526477] transition hover:bg-[#f1f7f3]"
          >
            <X size={19} />
          </button>
        </div>

        {/* CONTENU DÉFILANT */}

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[#fcfdfc] px-3 py-3 sm:px-5 sm:py-4">
          {/* IMAGE PRINCIPALE */}

          <EventThumbnail
            storageKey={
              primaryImage?.storageKey ??
              event.mainImageKey
            }
            large
          />

          {/* NOM ET STATUT */}

          <section>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge
                status={event.status}
              />

              <span className="rounded-full bg-[#edf5ef] px-3 py-1 text-[11px] font-semibold text-[#38724b]">
                {event.category}
              </span>
            </div>

            <h3 className="wrap-break-word text-[23px] font-black leading-tight text-[#14283d] sm:text-[28px]">
              {event.title}
            </h3>

            <p className="mt-2 break-all text-xs text-[#84929d]">
              {event.slug}
            </p>
          </section>

          {/* INDICATEURS ÉVÉNEMENT */}

          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#e1e9e4] bg-white p-4">
              <p className="text-[11px] font-semibold text-[#81909d]">
                Billets vendus
              </p>

              <p className="mt-2 text-[23px] font-black text-[#087a32]">
                {formatNumber(
                  event.ticketsSold
                )}
              </p>
            </div>

            <div className="rounded-xl border border-[#e1e9e4] bg-white p-4">
              <p className="text-[11px] font-semibold text-[#81909d]">
                Capacité prévue
              </p>

              <p className="mt-2 text-[23px] font-black text-[#14283d]">
                {formatNumber(
                  event.capacity ||
                  totalCapacity
                )}
              </p>
            </div>
          </section>

          {/* RECETTES */}

          <section className="rounded-2xl bg-[#10263d] p-5 text-white">
            <div className="flex items-center gap-2">
              <Wallet
                size={19}
                className="text-[#81d59d]"
              />

              <h3 className="text-sm font-black">
                Recettes des billets
              </h3>
            </div>

            {event.grossRevenue.length === 0 ? (
              <p className="mt-4 text-lg font-bold text-white/80">
                Aucune vente enregistrée
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {event.grossRevenue.map(
                  (revenue) => (
                    <p
                      key={revenue.currency}
                      className="wrap-break-word text-[22px] font-black sm:text-[27px]"
                    >
                      {formatMoney(
                        revenue.amountMinor,
                        revenue.currency
                      )}
                    </p>
                  )
                )}
              </div>
            )}

            <p className="mt-3 text-[11px] leading-relaxed text-white/65">
              Ventes brutes enregistrées sur les commandes
              payées, avant déduction des remboursements.
            </p>
          </section>

          {/* ORGANISATEUR */}

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[#203449]">
              <Users
                size={19}
                className="text-[#087a32]"
              />

              Organisateur
            </h3>

            <div className="rounded-2xl border border-[#e2e9e5] bg-white px-4">
              <DetailField
                title="Organisation"
                value={event.organizer.name}
              />

              <DetailField
                title="Responsable"
                value={
                  event.organizer.owner.fullName
                }
              />

              <DetailField
                title="Email"
                value={event.organizer.email}
              />

              <DetailField
                title="Téléphone"
                value={
                  event.organizer.phoneE164
                }
              />

              <DetailField
                title="Ville"
                value={
                  event.organizer.city
                }
              />

              <DetailField
                title="Pays"
                value={
                  event.organizer.countryCode
                }
              />

              <DetailField
                title="Compte organisateur"
                value={
                  event.organizer.isActive
                    ? "Actif"
                    : "Désactivé"
                }
              />

              <DetailField
                title="Badge officiel TIKEMIA"
                value={
                  event.organizer.blueBadgeEnabled
                    ? "Activé"
                    : "Non activé"
                }
              />
            </div>
          </section>

          {/* DESCRIPTION */}

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[#203449]">
              <FileText
                size={19}
                className="text-[#087a32]"
              />

              Description
            </h3>

            <div className="rounded-2xl border border-[#e2e9e5] bg-white p-4">
              <p className="whitespace-pre-wrap wrap-break-word text-[13px] leading-7 text-[#42566a]">
                {event.description ||
                  "Aucune description disponible."}
              </p>
            </div>
          </section>

          {/* DATES */}

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[#203449]">
              <CalendarDays
                size={19}
                className="text-[#087a32]"
              />

              Dates et horaires
            </h3>

            <div className="rounded-2xl border border-[#e2e9e5] bg-white px-4">
              <DetailField
                title="Type de calendrier"
                value={scheduleKindLabel(
                  event.scheduleKind
                )}
              />

              <DetailField
                title="Début"
                value={formatDateTime(
                  event.startAt
                )}
              />

              <DetailField
                title="Fin"
                value={formatDateTime(
                  event.endAt
                )}
              />

              <DetailField
                title="Fuseau horaire configuré"
                value={event.timeZone}
              />

              <DetailField
                title="Validité des billets"
                value={ticketValidityLabel(
                  event.ticketValidity
                )}
              />
            </div>

            {event.schedules.length > 0 && (
              <div className="mt-3 space-y-2">
                {event.schedules.map(
                  (schedule, index) => (
                    <div
                      key={schedule.id}
                      className="rounded-xl border border-[#e2e9e5] bg-white p-3"
                    >
                      <p className="text-xs font-black text-[#26394e]">
                        {schedule.label ||
                          `Séance ${index + 1}`}
                      </p>

                      <p className="mt-2 text-xs text-[#718293]">
                        Début :{" "}
                        {formatDateTime(
                          schedule.startsAt
                        )}
                      </p>

                      {schedule.endsAt && (
                        <p className="mt-1 text-xs text-[#718293]">
                          Fin :{" "}
                          {formatDateTime(
                            schedule.endsAt
                          )}
                        </p>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          {/* LIEU */}

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[#203449]">
              <MapPin
                size={19}
                className="text-[#087a32]"
              />

              Lieu de l&apos;événement
            </h3>

            {event.venue ? (
              <div className="rounded-2xl border border-[#e2e9e5] bg-white px-4">
                <DetailField
                  title="Nom du lieu"
                  value={event.venue.name}
                />

                <DetailField
                  title="Adresse"
                  value={event.venue.address}
                />

                <DetailField
                  title="Ville"
                  value={event.venue.city}
                />

                <DetailField
                  title="Pays"
                  value={event.venue.country}
                />

                <DetailField
                  title="Plan ou image du lieu"
                  value={
                    event.venue.imageKey
                      ? "Image enregistrée"
                      : "Non renseigné"
                  }
                />
              </div>
            ) : (
              <div className="rounded-xl border border-[#e2e9e5] bg-white p-4 text-xs text-[#81909d]">
                Aucun lieu renseigné.
              </div>
            )}
          </section>

          {/* BILLETS */}

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-black text-[#203449]">
                <Ticket
                  size={19}
                  className="text-[#087a32]"
                />

                Catégories de billets
              </h3>

              <span className="rounded-full bg-[#edf5ef] px-3 py-1 text-xs font-bold text-[#087a32]">
                {event.categories.length}
              </span>
            </div>

            {event.categories.length === 0 ? (
              <div className="rounded-xl border border-[#e2e9e5] bg-white p-4 text-xs text-[#81909d]">
                Aucune catégorie de billet.
              </div>
            ) : (
              <div className="space-y-3">
                {event.categories.map(
                  (category) => (
                    <div
                      key={category.id}
                      className="rounded-2xl border border-[#e2e9e5] bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="wrap-break-word text-sm font-black text-[#21364b]">
                            {category.name}
                          </p>

                          {category.description && (
                            <p className="mt-1 text-xs leading-relaxed text-[#7b8995]">
                              {category.description}
                            </p>
                          )}
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            category.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {category.isActive
                            ? "Actif"
                            : "Inactif"}
                        </span>
                      </div>

                      <p className="mt-4 text-xl font-black text-[#087a32]">
                        {formatMoney(
                          category.priceMinor,
                          category.currency
                        )}
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-[#f7f9f8] p-3">
                        <div>
                          <p className="text-[11px] text-[#81909d]">
                            Places prévues
                          </p>

                          <p className="mt-1 text-sm font-black text-[#26394e]">
                            {formatNumber(
                              category.capacity
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] text-[#81909d]">
                            Billets vendus
                          </p>

                          <p className="mt-1 text-sm font-black text-[#087a32]">
                            {formatNumber(
                              category.ticketsSold
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 border-t border-[#edf1ee] pt-3">
                        <p className="text-[11px] text-[#81909d]">
                          Recettes brutes
                        </p>

                        <p className="mt-1 text-sm font-black text-[#26394e]">
                          {formatMoney(
                            category.grossRevenueMinor,
                            category.currency
                          )}
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          {/* AUTRES IMAGES */}

          {event.images.length > 0 && (
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-[#203449]">
                <ImageIcon
                  size={19}
                  className="text-[#087a32]"
                />

                Images de l&apos;événement
              </h3>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {event.images.map(
                  (image, index) => (
                    <div
                      key={image.id}
                      className="overflow-hidden rounded-xl border border-[#e2e9e5] bg-white"
                    >
                      <div className="aspect-4/3">
                        <EventThumbnail
                          storageKey={
                            image.storageKey
                          }
                          large
                        />
                      </div>

                      <p className="p-2 text-center text-[11px] font-semibold text-[#6d7e8c]">
                        Image {index + 1}
                        {image.isPrimary
                          ? " — principale"
                          : ""}
                      </p>
                    </div>
                  )
                )}
              </div>
            </section>
          )}

          {/* PUBLICATION */}

          <section>
            <h3 className="mb-3 text-sm font-black text-[#203449]">
              Informations de publication
            </h3>

            <div className="rounded-2xl border border-[#e2e9e5] bg-white px-4">
              <DetailField
                title="Date de publication"
                value={formatDateTime(
                  event.publishedAt
                )}
              />

              <DetailField
                title="Date de création"
                value={formatDateTime(
                  event.createdAt
                )}
              />

              <DetailField
                title="Dernière mise à jour"
                value={formatDateTime(
                  event.updatedAt
                )}
              />

              <DetailField
                title="Identifiant"
                value={
                  <span className="break-all">
                    {event.id}
                  </span>
                }
              />
            </div>
          </section>
        </div>

        {/* BOUTON FERMER */}

        <div className="shrink-0 border-t border-[#e3ebe5] bg-white px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#10263d] px-5 text-sm font-extrabold text-white transition hover:bg-[#1c3c57]"
          >
            <X size={17} />
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PAGE ADMIN / EVENTS
============================================================ */

export default function AdminEventsPage() {
  const [data, setData] =
    useState<EventsData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [searchInput, setSearchInput] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState<StatusFilter>("ALL");

  const [page, setPage] =
    useState(1);

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const controllerRef =
    useRef<AbortController | null>(null);

  const requestIdRef =
    useRef(0);

  const previousFocusRef =
    useRef<HTMLElement | null>(null);

  /* ==========================================================
     RECHERCHE
  ========================================================== */

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const value =
        searchInput.trim();

      if (value !== search) {
        setSearch(value);
        setPage(1);
      }
    }, SEARCH_DELAY);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput, search]);

  /* ==========================================================
     CHARGEMENT DEPUIS POSTGRESQL
  ========================================================== */

  const loadEvents = useCallback(
    async (silent = false) => {
      controllerRef.current?.abort();

      const controller =
        new AbortController();

      controllerRef.current =
        controller;

      const currentRequest =
        ++requestIdRef.current;

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const params =
          new URLSearchParams({
            page: String(page),
            pageSize: String(PAGE_SIZE),
            status,
          });

        if (search) {
          params.set(
            "search",
            search
          );
        }

        const response =
          await fetch(
            `${API_URL}?${params.toString()}`,
            {
              method: "GET",
              cache: "no-store",
              credentials: "same-origin",
              headers: {
                Accept: "application/json",
              },
              signal: controller.signal,
            }
          );

        const result =
          await readApi<EventsData>(
            response
          );

        if (
          controller.signal.aborted ||
          currentRequest !==
            requestIdRef.current
        ) {
          return;
        }

        if (
          !Array.isArray(
            result.events
          ) ||
          !result.summary ||
          !result.pagination
        ) {
          throw new Error(
            "Les informations reçues sont invalides."
          );
        }

        if (
          result.pagination.totalPages > 0 &&
          page > result.pagination.totalPages
        ) {
          setPage(
            result.pagination.totalPages
          );
          return;
        }

        setData(result);
        setError(null);
      } catch (err) {
        if (
          controller.signal.aborted ||
          isAbortError(err) ||
          currentRequest !==
            requestIdRef.current
        ) {
          return;
        }

        setError(
          getErrorMessage(err)
        );
      } finally {
        if (
          !controller.signal.aborted &&
          currentRequest ===
            requestIdRef.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [page, search, status]
  );

  /* ==========================================================
     CHARGEMENT INITIAL
  ========================================================== */

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void loadEvents(), 0);

    return () => {
      window.clearTimeout(initialTimer);
      controllerRef.current?.abort();
    };
  }, [loadEvents]);

  /* ==========================================================
     ACTUALISATION AUTOMATIQUE
  ========================================================== */

  useEffect(() => {
    const timer =
      window.setInterval(() => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void loadEvents(true);
        }
      }, REFRESH_INTERVAL);

    function onFocus() {
      void loadEvents(true);
    }

    window.addEventListener(
      "focus",
      onFocus
    );

    return () => {
      window.clearInterval(timer);

      window.removeEventListener(
        "focus",
        onFocus
      );
    };
  }, [loadEvents]);

  /* ==========================================================
     MODAL
  ========================================================== */

  function openEvent(
    id: string
  ) {
    previousFocusRef.current =
      document.activeElement instanceof
      HTMLElement
        ? document.activeElement
        : null;

    setSelectedId(id);
  }

  function closeEvent() {
    setSelectedId(null);

    window.requestAnimationFrame(() => {
      previousFocusRef.current?.focus();
    });
  }

  const selectedEvent = useMemo(
    () =>
      data?.events.find(
        (event) => event.id === selectedId
      ) ?? null,
    [data, selectedId]
  );

  /* ==========================================================
     FILTRES
  ========================================================== */

  const hasFilters =
    search !== "" ||
    status !== "ALL";

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setStatus("ALL");
    setPage(1);
  }

  const events =
    data?.events ?? [];

  const summary =
    data?.summary;

  const pagination =
    data?.pagination;

  const total =
    pagination?.total ?? 0;

  const start =
    pagination && total > 0
      ? (pagination.page - 1) *
          pagination.pageSize +
        1
      : 0;

  const end =
    pagination
      ? Math.min(
          pagination.page *
            pagination.pageSize,
          total
        )
      : 0;

  /* ==========================================================
     RENDU DE LA PAGE
  ========================================================== */

  return (
    <main className="min-h-full min-w-0 w-full bg-[#f7f9f8] p-3 text-[#18283d] sm:p-4 lg:p-5">
      <div className="w-full">
        {/* EN-TÊTE */}

        <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e7f5eb] text-[#087a32]">
              <CalendarDays size={25} />
            </div>

            <div className="min-w-0">
              <h1 className="text-[23px] font-black tracking-tight text-[#14263b] sm:text-[30px]">
                Gestion des événements
              </h1>

              <p className="mt-1 text-xs text-[#728293] sm:text-sm">
                Événements publiés par les organisateurs
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadEvents(true)
            }
            disabled={
              loading || refreshing
            }
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#dbe6df] bg-white px-4 text-xs font-extrabold text-[#087a32] transition hover:bg-[#eff8f1] disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />

            Actualiser
          </button>
        </header>

        {/* LES TROIS INDICATEURS */}

        <section className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            title="Événements mis en ligne"
            value={
              summary
                ? formatNumber(
                    summary.totalEvents
                  )
                : "—"
            }
            icon={
              <CalendarDays size={21} />
            }
            description="Total des événements déjà publiés"
          />

          <div className="min-w-0 rounded-2xl border border-[#e1e9e4] bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-semibold text-[#728293]">
                Recettes totales
              </p>

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e7f5eb] text-[#087a32]">
                <Wallet size={21} />
              </div>
            </div>

            {!summary ? (
              <p className="mt-4 text-[26px] font-black text-[#14263d]">
                —
              </p>
            ) : summary.grossRevenue.length === 0 ? (
              <p className="mt-4 text-[22px] font-black text-[#14263d]">
                Aucune vente
              </p>
            ) : (
              <div className="mt-4 space-y-1.5">
                {summary.grossRevenue.map(
                  (item) => (
                    <p
                      key={item.currency}
                      className="wrap-break-word text-[19px] font-black leading-tight text-[#14263d] sm:text-[22px]"
                    >
                      {formatMoney(
                        item.amountMinor,
                        item.currency
                      )}
                    </p>
                  )
                )}
              </div>
            )}

            <p className="mt-2 text-[11px] leading-relaxed text-[#84929d]">
              Billetterie payée, montants bruts par devise
            </p>
          </div>

          <StatCard
            title="Organisateurs"
            value={
              summary
                ? formatNumber(
                    summary.totalOrganizers
                  )
                : "—"
            }
            icon={
              <Users size={21} />
            }
            description="Organisations ayant publié un événement"
          />
        </section>

        {/* RECHERCHE */}

        <section className="mb-3 rounded-2xl border border-[#e1e9e3] bg-white p-4 shadow-sm sm:p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_210px]">
            <div className="relative min-w-0">
              <Search
                size={19}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#85929c]"
              />

              <input
                type="search"
                value={searchInput}
                maxLength={100}
                onChange={(event) =>
                  setSearchInput(
                    event.target.value
                  )
                }
                placeholder="Rechercher un événement ou un organisateur..."
                aria-label="Rechercher un événement"
                className="h-12 w-full min-w-0 rounded-xl border border-[#dce6df] bg-[#fbfcfb] pl-11 pr-4 text-[13px] outline-none transition focus:border-[#0d913b] focus:ring-2 focus:ring-[#d9f1df]"
              />
            </div>

            <select
              value={status}
              aria-label="Filtrer les événements par statut"
              onChange={(event) => {
                setStatus(
                  event.target.value as StatusFilter
                );

                setPage(1);
              }}
              className="h-12 w-full rounded-xl border border-[#dce6df] bg-[#fbfcfb] px-3 text-[13px] font-semibold text-[#405368] outline-none focus:border-[#0d913b]"
            >
              {STATUS_OPTIONS.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[#087a32] hover:underline"
            >
              <FilterX size={16} />

              Effacer les filtres
            </button>
          )}
        </section>

        {/* ERREUR */}

        {error && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle
                size={19}
                className="shrink-0 text-red-600"
              />

              <p className="text-xs leading-relaxed text-red-700">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadEvents()
              }
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* LISTE */}

        <section className="overflow-hidden rounded-2xl border border-[#e1e9e4] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7ede9] px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-base font-black text-[#17283d]">
                Tous les événements
              </h2>

              <p className="mt-1 text-[11px] text-[#80909a]">
                {formatNumber(total)} événement(s)
                {hasFilters
                  ? " correspondant aux filtres"
                  : " dans la liste"}
              </p>
            </div>

            {data?.refreshedAt && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[#83909b]">
                <Clock3 size={13} />

                {formatDateTime(
                  data.refreshedAt
                )}
              </span>
            )}
          </div>

          {/* CHARGEMENT */}

          {loading && !data ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-3">
              <LoaderCircle
                size={32}
                className="animate-spin text-[#087a32]"
              />

              <p className="text-xs text-[#738392]">
                Chargement des événements...
              </p>
            </div>
          ) : events.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center px-4 py-6 text-center">
              <CalendarDays
                size={39}
                className="text-[#86b497]"
              />

              <h3 className="mt-4 text-sm font-black text-[#24374c]">
                {hasFilters
                  ? "Aucun événement trouvé"
                  : "Aucun événement publié"}
              </h3>

              <p className="mt-2 max-w-sm text-xs leading-relaxed text-[#7e8b98]">
                {hasFilters
                  ? "Modifiez votre recherche ou votre filtre."
                  : "Les événements publiés par les organisateurs apparaîtront ici automatiquement."}
              </p>
            </div>
          ) : (
            <>
              {/* TABLEAU PC */}

              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-262.5 border-collapse text-left">
                  <thead className="border-b border-[#e7ede9] bg-[#f7f9f8]">
                    <tr className="text-[11px] font-extrabold uppercase tracking-wide text-[#778593]">
                      <th className="px-5 py-4">
                        Événement
                      </th>

                      <th className="px-4 py-4">
                        Organisateur
                      </th>

                      <th className="px-4 py-4">
                        Date
                      </th>

                      <th className="px-4 py-4">
                        Billets vendus
                      </th>

                      <th className="px-4 py-4">
                        Recettes
                      </th>

                      <th className="px-4 py-4">
                        Statut
                      </th>

                      <th className="px-5 py-4 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {events.map(
                      (event) => (
                        <tr
                          key={event.id}
                          className="border-b border-[#edf1ee] transition hover:bg-[#fafdfa] last:border-0"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <EventThumbnail
                                storageKey={
                                  event.mainImageKey
                                }
                              />

                              <div className="min-w-0">
                                <p className="max-w-50 truncate text-[13px] font-black text-[#192a40]">
                                  {event.title}
                                </p>

                                <p className="mt-1 text-[11px] text-[#7a8995]">
                                  {event.category}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <p className="max-w-41.25 truncate text-xs font-bold text-[#405268]">
                              {event.organizer.name}
                            </p>

                            <p className="mt-1 max-w-41.25 truncate text-[11px] text-[#84919c]">
                              {event.organizer.owner.fullName}
                            </p>
                          </td>

                          <td className="px-4 py-4 whitespace-nowrap text-xs text-[#697c8d]">
                            {formatDate(
                              event.startAt
                            )}
                          </td>

                          <td className="px-4 py-4 text-xs font-black text-[#26394e]">
                            {formatNumber(
                              event.ticketsSold
                            )}
                          </td>

                          <td className="px-4 py-4">
                            <div className="max-w-43.75 space-y-1 text-xs font-bold text-[#087a32]">
                              {event.grossRevenue.length === 0
                                ? "Aucune vente"
                                : event.grossRevenue.map(
                                    (revenue) => (
                                      <p
                                        key={revenue.currency}
                                        className="whitespace-nowrap"
                                      >
                                        {formatMoney(
                                          revenue.amountMinor,
                                          revenue.currency
                                        )}
                                      </p>
                                    )
                                  )}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <StatusBadge
                              status={event.status}
                            />
                          </td>

                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                openEvent(event.id)
                              }
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#cce7d3] bg-[#eff9f1] px-4 text-xs font-extrabold text-[#087a32] transition hover:bg-[#def2e3]"
                            >
                              <Eye size={16} />
                              Voir
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {/* CARTES MOBILE ET TABLETTE */}

              <div className="divide-y divide-[#ecf0ed] lg:hidden">
                {events.map(
                  (event) => (
                    <article
                      key={event.id}
                      className="p-4 sm:p-5"
                    >
                      <div className="flex items-start gap-3">
                        <EventThumbnail
                          storageKey={
                            event.mainImageKey
                          }
                        />

                        <div className="min-w-0 flex-1">
                          <p className="wrap-break-word text-sm font-black text-[#192b40]">
                            {event.title}
                          </p>

                          <p className="mt-1 text-xs text-[#7b8995]">
                            {event.organizer.name}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <StatusBadge
                          status={event.status}
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-[#f7f9f8] p-3">
                        <div className="min-w-0">
                          <p className="text-[11px] text-[#82909a]">
                            Date
                          </p>

                          <p className="mt-1 text-xs font-bold text-[#405268]">
                            {formatDate(
                              event.startAt
                            )}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-[11px] text-[#82909a]">
                            Billets vendus
                          </p>

                          <p className="mt-1 text-xs font-black text-[#087a32]">
                            {formatNumber(
                              event.ticketsSold
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-[#82909a]">
                            Recettes
                          </p>

                          <p className="mt-1 wrap-break-word text-sm font-black text-[#087a32]">
                            {formatRevenue(
                              event.grossRevenue
                            )}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            openEvent(event.id)
                          }
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#087a32] px-5 text-xs font-extrabold text-white"
                        >
                          <Eye size={17} />
                          Voir
                        </button>
                      </div>
                    </article>
                  )
                )}
              </div>
            </>
          )}

          {/* PAGINATION */}

          {pagination &&
            pagination.total > 0 && (
              <div className="flex flex-col gap-3 border-t border-[#e7ede9] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-center text-xs text-[#7b8996] sm:text-left">
                  {start}–{end} sur{" "}
                  <strong className="text-[#293b50]">
                    {pagination.total}
                  </strong>{" "}
                  événements
                </p>

                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    aria-label="Page précédente"
                    disabled={
                      !pagination.hasPreviousPage ||
                      loading
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.max(
                            1,
                            current - 1
                          )
                      )
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dce6df] text-[#405268] disabled:opacity-40"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <span className="min-w-27.5 text-center text-xs font-extrabold text-[#26394e]">
                    Page {pagination.page} /{" "}
                    {Math.max(
                      pagination.totalPages,
                      1
                    )}
                  </span>

                  <button
                    type="button"
                    aria-label="Page suivante"
                    disabled={
                      !pagination.hasNextPage ||
                      loading
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          current + 1
                      )
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dce6df] text-[#405268] disabled:opacity-40"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
        </section>

        {/* INFORMATION */}

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#e2ebe4] bg-white p-4">
          <ShieldCheck
            size={18}
            className="shrink-0 text-[#087a32]"
          />

          
        </div>
      </div>

      {/* FENÊTRE VOIR */}

      {selectedEvent && (
        <EventDialog
          key={selectedEvent.id}
          event={selectedEvent}
          onClose={closeEvent}
        />
      )}
    </main>
  );
}
