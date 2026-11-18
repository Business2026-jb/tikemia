
"use client";
import { formatMinorMoney } from "@/i18n/config";


import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Eye,
  Heart,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Ticket,
  UserRound,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";

/**
 * ============================================================
 * TIKEMIA — ADMIN / ORGANISATEURS
 * ============================================================
 *
 * src/app/admin/organizers/page.tsx
 *
 * Fonctionnalités :
 *
 * - Liste réelle des organisateurs
 * - Recherche
 * - Pagination
 * - Filtre des comptes
 * - Filtre des badges bleus
 * - Statistiques des événements
 * - Statistiques des cagnottes
 * - Montants générés par devise
 * - Fenêtre de détails sur la même page
 * - Activation et désactivation du badge
 * - Actualisation depuis PostgreSQL
 * - Interface responsive mobile et PC
 *
 * APIs :
 *
 * GET /api/admin/organizers
 *
 * GET /api/admin/organizers/[id]
 *
 * PATCH /api/admin/organizers/[id]
 *
 * Aucun montant fictif.
 * Aucune navigation vers une nouvelle page
 * lors du clic sur "Voir".
 *
 * Le menu général est conservé via
 * le layout administrateur existant.
 * ============================================================
 */

const API_BASE = "/api/admin/organizers";

const PAGE_SIZE = 20;

const REFRESH_INTERVAL_MS = 30000;

const SEARCH_DELAY_MS = 350;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ============================================================
   TYPES
============================================================ */

type AccountFilter =
  | "all"
  | "active"
  | "inactive";

type BadgeFilter =
  | "all"
  | "enabled"
  | "disabled";

type MoneyTotal = {
  currency: string;
  ticketSalesMinor: string;
  donationsMinor: string;
  generatedMinor: string;
};

type OrganizerStatistics = {
  totalEvents: number;
  publishedEvents: number;

  totalCampaigns: number;
  publishedCampaigns: number;

  amountBasis: string;
  totalsByCurrency: MoneyTotal[];
};

type OrganizerOwner = {
  id: string;
  fullName: string;
  email: string;
  phoneE164: string | null;
  avatarStorageKey: string | null;
  isActive: boolean;
  isBlocked: boolean;
};

type Organizer = {
  id: string;
  name: string;

  description: string | null;
  logoStorageKey: string | null;

  email: string | null;
  phoneE164: string | null;

  countryCode: string | null;
  city: string | null;

  isActive: boolean;
  blueBadgeEnabled: boolean;

  verificationStatus: string;

  owner: OrganizerOwner;

  statistics: OrganizerStatistics;

  createdAt: string;
  updatedAt: string;
};

type OrganizerDetails = Organizer & {
  withdrawalMethods?: { id: string; provider: string; type: string; accountName: string; countryCode: string; currency: string; bankName: string | null; networkCode: string | null; assetCode: string | null; isVerified: boolean; isActive: boolean; maskedAccountRef: string | null; accountDetails: Record<string,string> | null }[];
  verifiedAt?: string | null;
  refreshedAt?: string;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type ListData = {
  organizers: Organizer[];

  pagination: Pagination;

  filters: {
    search: string;
    status: AccountFilter;
    badge: BadgeFilter;
  };

  amountBasis: string;
  refreshedAt: string;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  code?: string;
  message?: string;
};

type BadgeUpdateData = {
  id: string;
  name: string;
  blueBadgeEnabled: boolean;
  changed: boolean;
  updatedAt: string | null;
};

type Notice = {
  type: "success" | "error";
  message: string;
};

/* ============================================================
   OUTILS
============================================================ */

function initials(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "OR";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(
  value: string | null | undefined
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateTime(
  value: string | null | undefined
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Montants BigInt sans conversion en Number.
 *
 * Les valeurs de PostgreSQL sont transmises
 * sous forme de chaînes d'unités mineures.
 *
 * On ne mélange jamais les devises.
 */

function formatMoney(
  minor: string,
  currency: string
): string {
  return formatMinorMoney(minor, currency, "fr");
}

function errorMessage(
  code: string | undefined
): string {
  switch (code) {
    case "UNAUTHORIZED":
      return "Votre session administrateur est expirée ou non reconnue. Reconnectez-vous.";

    case "FORBIDDEN":
      return "Vous n'avez pas les autorisations nécessaires.";

    case "INVALID_REQUEST":
      return "La demande contient des informations invalides.";

    case "INVALID_ORGANIZER_ID":
      return "Identifiant de l'organisateur invalide.";

    case "ORGANIZER_NOT_FOUND":
      return "Cet organisateur n'existe plus.";

    case "INVALID_ORIGIN":
      return "La modification a été refusée pour des raisons de sécurité.";

    case "DATABASE_ERROR":
      return "Impossible de charger les organisateurs.";

    default:
      return "Une erreur est survenue. Veuillez réessayer.";
  }
}

async function readJson<T>(
  response: Response
): Promise<ApiResponse<T>> {
  try {
    const result =
      (await response.json()) as ApiResponse<T>;

    if (
      !result ||
      typeof result !== "object"
    ) {
      return {
        success: false,
        code: "INVALID_RESPONSE",
      };
    }

    return result;
  } catch {
    return {
      success: false,
      code: "INVALID_RESPONSE",
    };
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === "AbortError"
  );
}

/* ============================================================
   COMPOSANTS VISUELS
============================================================ */

function OrganizerAvatar({
  name,
  large = false,
}: {
  name: string;
  large?: boolean;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full border border-[#d8ebdd] bg-[#e9f7ed] font-black text-[#087a32] ${
        large
          ? "h-17 w-17 text-xl"
          : "h-11 w-11 text-sm"
      }`}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}

/**
 * Badge bleu graphique.
 * Il n'est affiché que lorsque
 * Organization.blueBadgeEnabled = true.
 */

function BlueBadge({
  size = 19,
}: {
  size?: number;
}) {
  return (
    <BadgeCheck
      size={size}
      strokeWidth={2.5}
      className="inline-block shrink-0 fill-[#1683f4] text-white"
      aria-label="Badge bleu TIKEMIA actif"
    />
  );
}

function BadgeStatus({
  enabled,
}: {
  enabled: boolean;
}) {
  return enabled ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f2ff] px-3 py-1.5 text-[11px] font-extrabold text-[#126ad1]">
      <BlueBadge size={17} />
      Actif
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f0f2f3] px-3 py-1.5 text-[11px] font-bold text-[#71808b]">
      <span className="h-2 w-2 rounded-full bg-[#9aa6b0]" />
      Inactif
    </span>
  );
}

function AccountStatus({
  active,
}: {
  active: boolean;
}) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f7ed] px-2.5 py-1 text-[11px] font-bold text-[#087a32]">
      <span className="h-2 w-2 rounded-full bg-[#16a34a]" />
      Actif
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff1e9] px-2.5 py-1 text-[11px] font-bold text-[#c36525]">
      <span className="h-2 w-2 rounded-full bg-[#e08b35]" />
      Inactif
    </span>
  );
}

function StatsCard({
  icon,
  title,
  value,
  note,
  iconClass = "text-[#087a32]",
}: {
  icon: ReactNode;
  title: string;
  value: number | string;
  note?: string;
  iconClass?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#e4ebe6] bg-white p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-semibold text-[#6b7886]">
          {title}
        </p>

        <div className={iconClass}>
          {icon}
        </div>
      </div>

      <p className="mt-2 text-[22px] font-black text-[#14243b] sm:text-[26px]">
        {value}
      </p>

      {note && (
        <p className="mt-1 text-[11px] text-[#82909a]">
          {note}
        </p>
      )}
    </div>
  );
}

function InformationRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 gap-3 border-b border-[#edf1ee] py-3 last:border-0">
      {icon && (
        <div className="mt-0.5 shrink-0 text-[#6c8072]">
          {icon}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-[#7a8793]">
          {label}
        </p>

        <div className="mt-1 wrap-break-word text-[13px] font-bold text-[#23344a]">
          {value}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="flex min-h-62 flex-col items-center justify-center px-4 py-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#edf6ef] text-[#12833b]">
        <UsersRound size={29} />
      </div>

      <h3 className="mt-4 text-base font-black text-[#223348]">
        {title}
      </h3>

      <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#71808b]">
        {message}
      </p>
    </div>
  );
}

function MoneySummary({
  totals,
}: {
  totals: MoneyTotal[];
}) {
  if (totals.length === 0) {
    return (
      <div className="rounded-xl border border-[#e6ece7] bg-[#f8faf9] px-4 py-5 text-center text-xs text-[#788794]">
        Aucun montant confirmé enregistré.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {totals.map((total) => (
        <div
          key={total.currency}
          className="overflow-hidden rounded-2xl border border-[#dce9e0] bg-white"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[#edf1ee] px-4 py-3">
            <span className="text-xs font-bold text-[#667789]">
              Devise
            </span>

            <span className="rounded-lg bg-[#edf7ef] px-3 py-1 text-xs font-extrabold text-[#06782c]">
              {total.currency}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs font-semibold text-[#71808b]">
                <Ticket size={15} />
                Ventes de billets
              </p>

              <p className="mt-1 wrap-break-word text-[16px] font-black text-[#20324a]">
                {formatMoney(
                  total.ticketSalesMinor,
                  total.currency
                )}
              </p>
            </div>

            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs font-semibold text-[#71808b]">
                <Heart size={15} />
                Dons collectés
              </p>

              <p className="mt-1 wrap-break-word text-[16px] font-black text-[#20324a]">
                {formatMoney(
                  total.donationsMinor,
                  total.currency
                )}
              </p>
            </div>
          </div>

          <div className="border-t border-[#dce9e0] bg-[#eff9f1] px-4 py-4">
            <p className="text-xs font-bold text-[#358250]">
              Total généré sur TIKEMIA
            </p>

            <p className="mt-1 wrap-break-word text-[22px] font-black text-[#087a32] sm:text-[25px]">
              {formatMoney(
                total.generatedMinor,
                total.currency
              )}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   PAGE
============================================================ */

export default function AdminOrganizersPage() {
  /* ==========================================================
     ÉTAT DE LA LISTE
  ========================================================== */

  const [list, setList] =
    useState<ListData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [listError, setListError] =
    useState<string | null>(null);

  /* ==========================================================
     RECHERCHE ET FILTRES
  ========================================================== */

  const [searchInput, setSearchInput] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [accountFilter, setAccountFilter] =
    useState<AccountFilter>("all");

  const [badgeFilter, setBadgeFilter] =
    useState<BadgeFilter>("all");

  const [page, setPage] =
    useState(1);

  /* ==========================================================
     DÉTAILS
  ========================================================== */

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const [details, setDetails] =
    useState<OrganizerDetails | null>(null);

  const [detailsLoading, setDetailsLoading] =
    useState(false);

  const [detailsRefreshing, setDetailsRefreshing] =
    useState(false);

  const [detailsError, setDetailsError] =
    useState<string | null>(null);

  /* ==========================================================
     BADGE BLEU
  ========================================================== */

  const [savingBadge, setSavingBadge] =
    useState(false);

  const [notice, setNotice] =
    useState<Notice | null>(null);

  /* ==========================================================
     CONTRÔLE DES REQUÊTES
  ========================================================== */

  const listController =
    useRef<AbortController | null>(null);

  const detailsController =
    useRef<AbortController | null>(null);

  const listRequestId =
    useRef(0);

  const detailsRequestId =
    useRef(0);

  const badgeSavingRef =
    useRef(false);

  const dialogRef =
    useRef<HTMLDivElement | null>(null);

  const previousFocusRef =
    useRef<HTMLElement | null>(null);

  const listLoadedRef =
    useRef(false);

  /* ==========================================================
     RECHERCHE AVEC DÉLAI
  ========================================================== */

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const value = searchInput.trim();

      if (value !== search) {
        setSearch(value);
        setPage(1);
      }
    }, SEARCH_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput, search]);

  /* ==========================================================
     CHARGER LES ORGANISATEURS
  ========================================================== */

  const loadOrganizers = useCallback(
    async (silent = false) => {
      listController.current?.abort();

      const controller =
        new AbortController();

      listController.current = controller;

      const requestId =
        ++listRequestId.current;

      if (
        silent &&
        listLoadedRef.current
      ) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const params =
          new URLSearchParams({
            page: String(page),
            pageSize: String(PAGE_SIZE),
            status: accountFilter,
            badge: badgeFilter,
          });

        if (search) {
          params.set("search", search);
        }

        const response =
          await fetch(
            `${API_BASE}?${params.toString()}`,
            {
              method: "GET",
              cache: "no-store",
              credentials: "same-origin",
              referrerPolicy: "no-referrer",
              headers: {
                Accept: "application/json",
              },
              signal: controller.signal,
            }
          );

        const result =
          await readJson<ListData>(response);

        if (
          !response.ok ||
          result.success !== true ||
          !result.data
        ) {
          throw new Error(
            errorMessage(result.code)
          );
        }

        if (
          controller.signal.aborted ||
          requestId !== listRequestId.current
        ) {
          return;
        }

        const data = result.data;

        if (
          !Array.isArray(data.organizers) ||
          !data.pagination
        ) {
          throw new Error(
            "Réponse incorrecte de l'API."
          );
        }

        /*
         * Si une page n'existe plus après
         * une modification des filtres ou
         * des données, revenir à la dernière
         * page valide.
         */

        if (
          data.pagination.totalPages > 0 &&
          page > data.pagination.totalPages
        ) {
          setPage(
            data.pagination.totalPages
          );
          return;
        }

        setList(data);
        setListError(null);
        listLoadedRef.current = true;
      } catch (error) {
        if (
          controller.signal.aborted ||
          isAbortError(error) ||
          requestId !== listRequestId.current
        ) {
          return;
        }

        setListError(
          error instanceof Error
            ? error.message
            : "Impossible de charger les organisateurs."
        );
      } finally {
        if (
          !controller.signal.aborted &&
          requestId === listRequestId.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      page,
      accountFilter,
      badgeFilter,
      search,
    ]
  );

  /* ==========================================================
     CHARGEMENT INITIAL ET FILTRES
  ========================================================== */

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void loadOrganizers(), 0);

    return () => {
      window.clearTimeout(initialTimer);
      listController.current?.abort();
    };
  }, [loadOrganizers]);

  /* ==========================================================
     CHARGER LES DÉTAILS
  ========================================================== */

  const loadDetails = useCallback(
    async (
      organizationId: string,
      silent = false
    ) => {
      if (!UUID_PATTERN.test(organizationId)) {
        setDetailsError(
          "Identifiant de l'organisateur invalide."
        );
        return;
      }

      if (badgeSavingRef.current) {
        return;
      }

      detailsController.current?.abort();

      const controller =
        new AbortController();

      detailsController.current = controller;

      const requestId =
        ++detailsRequestId.current;

      if (silent) {
        setDetailsRefreshing(true);
      } else {
        setDetailsLoading(true);
        setDetails(null);
      }

      try {
        const response =
          await fetch(
            `${API_BASE}/${encodeURIComponent(
              organizationId
            )}`,
            {
              method: "GET",
              cache: "no-store",
              credentials: "same-origin",
              referrerPolicy: "no-referrer",
              headers: {
                Accept: "application/json",
              },
              signal: controller.signal,
            }
          );

        const result =
          await readJson<OrganizerDetails>(
            response
          );

        if (
          !response.ok ||
          result.success !== true ||
          !result.data
        ) {
          throw new Error(
            errorMessage(result.code)
          );
        }

        if (
          controller.signal.aborted ||
          requestId !== detailsRequestId.current
        ) {
          return;
        }

        if (
          result.data.id !== organizationId
        ) {
          throw new Error(
            "Les détails reçus ne correspondent pas à l'organisateur."
          );
        }

        setDetails(result.data);
        setDetailsError(null);
      } catch (error) {
        if (
          controller.signal.aborted ||
          isAbortError(error) ||
          requestId !== detailsRequestId.current
        ) {
          return;
        }

        setDetailsError(
          error instanceof Error
            ? error.message
            : "Impossible de récupérer les détails."
        );
      } finally {
        if (
          !controller.signal.aborted &&
          requestId === detailsRequestId.current
        ) {
          setDetailsLoading(false);
          setDetailsRefreshing(false);
        }
      }
    },
    []
  );

  /* ==========================================================
     OUVRIR LES DÉTAILS
  ========================================================== */

  function openDetails(organizerId: string) {
    if (!UUID_PATTERN.test(organizerId)) {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    setSelectedId(organizerId);
    setDetails(null);
    setDetailsError(null);
    setNotice(null);
  }

  /* ==========================================================
     FERMER LES DÉTAILS
  ========================================================== */

  function closeDetails() {
    if (savingBadge) {
      return;
    }

    detailsController.current?.abort();
    detailsRequestId.current += 1;

    setSelectedId(null);
    setDetails(null);
    setDetailsError(null);
    setNotice(null);
    setDetailsLoading(false);
    setDetailsRefreshing(false);

    window.requestAnimationFrame(() => {
      previousFocusRef.current?.focus();
    });
  }

  /* ==========================================================
     OUVERTURE DU PANNEAU
  ========================================================== */

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    const initialTimer = window.setTimeout(() => void loadDetails(selectedId), 0);

    return () => {
      window.clearTimeout(initialTimer);
      detailsController.current?.abort();
    };
  }, [selectedId, loadDetails]);

  /* ==========================================================
     VERROUILLAGE DU DÉFILEMENT ET ÉCHAP
  ========================================================== */

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        !badgeSavingRef.current
      ) {
        setSelectedId(null);
        setDetails(null);
        setDetailsError(null);
        setNotice(null);

        window.requestAnimationFrame(() => {
          previousFocusRef.current?.focus();
        });
      }

      if (event.key === "Tab") {
        const dialog = dialogRef.current;

        if (!dialog) return;

        const focusable =
          Array.from(
            dialog.querySelectorAll<HTMLElement>(
              'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          ).filter(
            (element) =>
              element.getClientRects().length > 0
          );

        if (focusable.length === 0) {
          event.preventDefault();
          dialog.focus();
          return;
        }

        const first = focusable[0];
        const last =
          focusable[focusable.length - 1];

        if (
          event.shiftKey &&
          document.activeElement === first
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === last
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    const timer = window.setTimeout(() => {
      dialogRef.current?.focus();
    }, 0);

    return () => {
      document.body.style.overflow =
        previousOverflow;

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

      window.clearTimeout(timer);
    };
  }, [selectedId]);

  /* ==========================================================
     ACTUALISATION AUTOMATIQUE
  ========================================================== */

  useEffect(() => {
    const timer =
      window.setInterval(() => {
        if (
          document.visibilityState !==
          "visible"
        ) {
          return;
        }

        void loadOrganizers(true);
      }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [loadOrganizers]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    const timer =
      window.setInterval(() => {
        if (
          document.visibilityState !==
            "visible" ||
          badgeSavingRef.current
        ) {
          return;
        }

        void loadDetails(
          selectedId,
          true
        );
      }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    selectedId,
    loadDetails,
  ]);

  /* ==========================================================
     CHANGER LE BADGE BLEU
  ========================================================== */

  async function changeBlueBadge(
    enabled: boolean
  ) {
    if (
      !details ||
      !selectedId ||
      details.id !== selectedId ||
      badgeSavingRef.current
    ) {
      return;
    }

    badgeSavingRef.current = true;

    setSavingBadge(true);
    setNotice(null);

    /*
     * Arrêter une ancienne lecture pour
     * éviter qu'une réponse antérieure
     * écrase le nouvel état du badge.
     */

    detailsController.current?.abort();
    detailsRequestId.current += 1;

    const currentId = selectedId;

    try {
      const response =
        await fetch(
          `${API_BASE}/${encodeURIComponent(
            currentId
          )}`,
          {
            method: "PATCH",
            credentials: "same-origin",
            cache: "no-store",
            referrerPolicy: "same-origin",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body: JSON.stringify({
              blueBadgeEnabled: enabled,
            }),
          }
        );

      const result =
        await readJson<BadgeUpdateData>(
          response
        );

      if (
        !response.ok ||
        result.success !== true ||
        !result.data ||
        result.data.id !== currentId
      ) {
        throw new Error(
          errorMessage(result.code)
        );
      }

      const updated = result.data;

      /*
       * Modifier l'affichage uniquement
       * après la confirmation PostgreSQL.
       */

      setDetails((previous) => {
        if (
          !previous ||
          previous.id !== currentId
        ) {
          return previous;
        }

        return {
          ...previous,

          blueBadgeEnabled:
            updated.blueBadgeEnabled,

          updatedAt:
            updated.updatedAt ??
            previous.updatedAt,
        };
      });

      setList((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,

          organizers:
            previous.organizers.map(
              (organizer) =>
                organizer.id === currentId
                  ? {
                      ...organizer,
                      blueBadgeEnabled:
                        updated.blueBadgeEnabled,
                    }
                  : organizer
            ),
        };
      });

      setNotice({
        type: "success",

        message: updated.blueBadgeEnabled
          ? "Le badge bleu a été activé avec succès."
          : "Le badge bleu a été désactivé avec succès.",
      });
    } catch (error) {
      setNotice({
        type: "error",

        message:
          error instanceof Error
            ? error.message
            : "La modification du badge a échoué.",
      });
    } finally {
      badgeSavingRef.current = false;
      setSavingBadge(false);

      /*
       * Recharger la liste réelle.
       *
       * Important lorsque l'utilisateur
       * applique un filtre de badge.
       */

      void loadOrganizers(true);
    }
  }

  /* ==========================================================
     FILTRES
  ========================================================== */

  function changeAccountFilter(
    value: AccountFilter
  ) {
    setAccountFilter(value);
    setPage(1);
  }

  function changeBadgeFilter(
    value: BadgeFilter
  ) {
    setBadgeFilter(value);
    setPage(1);
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setAccountFilter("all");
    setBadgeFilter("all");
    setPage(1);
  }

  /* ==========================================================
     VARIABLES D'AFFICHAGE
  ========================================================== */

  const organizers =
    list?.organizers ?? [];

  const pagination =
    list?.pagination;

  const totalOrganizers =
    pagination?.total ?? 0;

  const hasFilters =
    search.length > 0 ||
    accountFilter !== "all" ||
    badgeFilter !== "all";

  const firstItem =
    pagination && pagination.total > 0
      ? (pagination.page - 1) *
          pagination.pageSize +
        1
      : 0;

  const lastItem =
    pagination
      ? Math.min(
          pagination.page *
            pagination.pageSize,
          pagination.total
        )
      : 0;

  /* ==========================================================
     RENDU
  ========================================================== */

  return (
    <main className="min-w-0 w-full bg-[#f7f9f8] p-3 text-[#17263c] sm:p-4 lg:p-5">
      <div className="w-full">
        {/* ====================================================
            EN-TÊTE
        ==================================================== */}

        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e7f5eb] text-[#087a32]">
                <UsersRound size={26} />
              </div>

              <div>
                <h1 className="text-[23px] font-black tracking-tight text-[#112339] sm:text-[29px]">
                  Organisateurs
                </h1>

                <p className="mt-1 text-xs text-[#71808d] sm:text-sm">
                  Gestion des organisateurs TIKEMIA
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadOrganizers(true)
            }
            disabled={refreshing || loading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#dce6df] bg-white px-4 text-xs font-bold text-[#276c43] transition hover:bg-[#f0f8f2] disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />

            Actualiser
          </button>
        </div>

        {/* ====================================================
            TOTAL ORGANISATEURS
        ==================================================== */}

        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#e0e9e2] bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#72808d]">
                  Organisateurs
                  {hasFilters
                    ? " — résultats"
                    : " enregistrés"}
                </p>

                <p className="mt-2 text-[30px] font-black text-[#14253c]">
                  {loading && !list
                    ? "—"
                    : totalOrganizers.toLocaleString(
                        "fr-FR"
                      )}
                </p>
              </div>

              <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-[#e9f7ed] text-[#0a8235]">
                <Building2 size={25} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#e0e9e2] bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#72808d]">
                  Badges actifs sur cette page
                </p>

                <p className="mt-2 text-sm font-extrabold text-[#087a32]">
                  {organizers.filter(organizer => organizer.blueBadgeEnabled).length}
                </p>

                
              </div>

              <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-[#e8f3fa] text-[#3484aa]">
                <RefreshCw size={23} />
              </div>
            </div>
          </div>
        </div>

        {/* ====================================================
            RECHERCHE ET FILTRES
        ==================================================== */}

        <section className="mb-3 rounded-2xl border border-[#e1e9e4] bg-white p-4 shadow-sm sm:p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
            {/* RECHERCHE */}

            <div className="relative min-w-0">
              <Search
                size={19}
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[#7e8a95]"
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
                placeholder="Rechercher un organisateur..."
                aria-label="Rechercher un organisateur"
                className="h-12 w-full min-w-0 rounded-xl border border-[#dce5df] bg-[#fbfcfb] pr-4 pl-11 text-[13px] outline-none transition focus:border-[#14913a] focus:ring-2 focus:ring-[#d7f0dd]"
              />
            </div>

            {/* STATUT */}

            <select
              aria-label="Filtrer par statut"
              value={accountFilter}
              onChange={(event) =>
                changeAccountFilter(
                  event.target.value as AccountFilter
                )
              }
              className="h-12 w-full rounded-xl border border-[#dce5df] bg-[#fbfcfb] px-3 text-[13px] font-semibold text-[#405166] outline-none focus:border-[#14913a]"
            >
              <option value="all">
                Tous les statuts
              </option>

              <option value="active">
                Comptes actifs
              </option>

              <option value="inactive">
                Comptes inactifs
              </option>
            </select>

            {/* BADGE BLEU */}

            <select
              aria-label="Filtrer par badge bleu"
              value={badgeFilter}
              onChange={(event) =>
                changeBadgeFilter(
                  event.target.value as BadgeFilter
                )
              }
              className="h-12 w-full rounded-xl border border-[#dce5df] bg-[#fbfcfb] px-3 text-[13px] font-semibold text-[#405166] outline-none focus:border-[#14913a]"
            >
              <option value="all">
                Tous les badges
              </option>

              <option value="enabled">
                Badge actif
              </option>

              <option value="disabled">
                Badge inactif
              </option>
            </select>
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#087a32] hover:underline"
            >
              <X size={14} />
              Effacer les filtres
            </button>
          )}
        </section>

        {/* ====================================================
            ERREUR DE CHARGEMENT
        ==================================================== */}

        {listError && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f2d0c7] bg-[#fff5f1] p-4"
          >
            <div className="flex items-start gap-2">
              <CircleAlert
                size={19}
                className="shrink-0 text-[#bb483c]"
              />

              <p className="text-[13px] text-[#984637]">
                {listError}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadOrganizers()
              }
              className="rounded-lg border border-[#edc3b7] px-3 py-2 text-xs font-bold text-[#984637]"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* ====================================================
            LISTE DES ORGANISATEURS
        ==================================================== */}

        <section className="overflow-hidden rounded-2xl border border-[#e1e9e4] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7ece8] px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-[16px] font-black text-[#18283d]">
                Liste des organisateurs
              </h2>

              <p className="mt-1 text-[11px] text-[#80909a]">
                Informations et statistiques enregistrées
              </p>
            </div>

            {list?.refreshedAt && (
              <span className="flex items-center gap-1.5 text-[11px] text-[#83909b]">
                <Clock3 size={13} />
                {formatDateTime(
                  list.refreshedAt
                )}
              </span>
            )}
          </div>

          {loading && !list ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-3">
              <LoaderCircle
                size={32}
                className="animate-spin text-[#087a32]"
              />

              <p className="text-xs text-[#75828b]">
                Chargement des organisateurs...
              </p>
            </div>
          ) : organizers.length === 0 ? (
            <EmptyState
              title={
                hasFilters
                  ? "Aucun résultat"
                  : "Aucun organisateur"
              }
              message={
                hasFilters
                  ? "Aucun organisateur ne correspond à votre recherche ou à vos filtres."
                  : "Les organisateurs apparaîtront ici dès leur enregistrement."
              }
            />
          ) : (
            <>
              {/* TABLEAU PC */}

              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-235 border-collapse text-left">
                  <thead className="bg-[#f7f9f8]">
                    <tr className="border-b border-[#e8ede9] text-[11px] font-extrabold uppercase tracking-wide text-[#71808b]">
                      <th className="px-5 py-4">
                        Organisateur
                      </th>

                      <th className="px-4 py-4">
                        Contact
                      </th>

                      <th className="px-4 py-4 text-center">
                        Événements
                      </th>

                      <th className="px-4 py-4 text-center">
                        Cagnottes
                      </th>

                      <th className="px-4 py-4 text-center">
                        Statut
                      </th>

                      <th className="px-4 py-4 text-center">
                        Badge bleu
                      </th>

                      <th className="px-5 py-4 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {organizers.map(
                      (organizer) => (
                        <tr
                          key={organizer.id}
                          className="border-b border-[#eef1ef] transition hover:bg-[#fafdfb] last:border-0"
                        >
                          <td className="px-5 py-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <OrganizerAvatar
                                name={organizer.name}
                              />

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="max-w-48 truncate text-[13px] font-black text-[#17263b]">
                                    {organizer.name}
                                  </span>

                                  {organizer.blueBadgeEnabled && (
                                    <BlueBadge />
                                  )}
                                </div>

                                <p className="mt-1 max-w-50 truncate text-[11px] text-[#71808b]">
                                  {organizer.owner.fullName}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <p className="max-w-49 truncate text-xs text-[#334155]">
                              {organizer.email ?? "—"}
                            </p>

                            <p className="mt-1 text-[11px] text-[#7a8795]">
                              {organizer.phoneE164 ?? "—"}
                            </p>
                          </td>

                          <td className="px-4 py-4 text-center">
                            <span className="text-[14px] font-black text-[#16263b]">
                              {organizer.statistics.publishedEvents}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-center">
                            <span className="text-[14px] font-black text-[#16263b]">
                              {organizer.statistics.publishedCampaigns}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-center">
                            <AccountStatus
                              active={organizer.isActive}
                            />
                          </td>

                          <td className="px-4 py-4 text-center">
                            <BadgeStatus
                              enabled={
                                organizer.blueBadgeEnabled
                              }
                            />
                          </td>

                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                openDetails(organizer.id)
                              }
                              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#cfe8d6] bg-[#eff9f1] px-3 text-xs font-extrabold text-[#087a32] transition hover:bg-[#ddf3e3]"
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

              {/* CARTES MOBILE / TABLETTE */}

              <div className="divide-y divide-[#edf1ee] lg:hidden">
                {organizers.map(
                  (organizer) => (
                    <article
                      key={organizer.id}
                      className="p-4 sm:p-5"
                    >
                      <div className="flex items-start gap-3">
                        <OrganizerAvatar
                          name={organizer.name}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h3 className="min-w-0 truncate text-sm font-black text-[#17283d]">
                              {organizer.name}
                            </h3>

                            {organizer.blueBadgeEnabled && (
                              <BlueBadge />
                            )}
                          </div>

                          <p className="mt-1 truncate text-xs text-[#71808d]">
                            {organizer.owner.fullName}
                          </p>

                          <p className="mt-1 break-all text-[11px] text-[#80909a]">
                            {organizer.email ?? "—"}
                          </p>
                        </div>

                        <AccountStatus
                          active={organizer.isActive}
                        />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-[#f5f8f6] p-3">
                          <p className="text-[11px] text-[#75828c]">
                            Événements publiés
                          </p>

                          <p className="mt-1 text-xl font-black text-[#17283c]">
                            {organizer.statistics.publishedEvents}
                          </p>
                        </div>

                        <div className="rounded-xl bg-[#f5f8f6] p-3">
                          <p className="text-[11px] text-[#75828c]">
                            Cagnottes publiées
                          </p>

                          <p className="mt-1 text-xl font-black text-[#17283c]">
                            {organizer.statistics.publishedCampaigns}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <BadgeStatus
                          enabled={
                            organizer.blueBadgeEnabled
                          }
                        />

                        <button
                          type="button"
                          onClick={() =>
                            openDetails(organizer.id)
                          }
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#087a32] px-5 text-xs font-extrabold text-white"
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

          {/* ==================================================
              PAGINATION
          ================================================== */}

          {pagination && pagination.total > 0 && (
            <div className="flex flex-col gap-3 border-t border-[#e8eee9] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-center text-[12px] text-[#788793] sm:text-left">
                {firstItem}–{lastItem} sur{" "}
                <strong className="text-[#22354a]">
                  {pagination.total}
                </strong>
                {" "}organisateurs
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
                    setPage((value) =>
                      Math.max(1, value - 1)
                    )
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dce6e0] bg-white text-[#34516c] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={18} />
                </button>

                <span className="min-w-25 text-center text-xs font-extrabold text-[#22354a]">
                  {pagination.page} /{" "}
                  {Math.max(1, pagination.totalPages)}
                </span>

                <button
                  type="button"
                  aria-label="Page suivante"
                  disabled={
                    !pagination.hasNextPage ||
                    loading
                  }
                  onClick={() =>
                    setPage((value) =>
                      value + 1
                    )
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dce6e0] bg-white text-[#34516c] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ======================================================
          FENÊTRE VOIR — MÊME PAGE
      ====================================================== */}

      {selectedId && (
        <div
          className="fixed inset-0 z-100 flex items-end justify-center bg-[#081423]/65 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !savingBadge
            ) {
              closeDetails();
            }
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="organizer-dialog-title"
            tabIndex={-1}
            className="flex h-dvh max-h-dvh sm:h-auto w-full max-w-180 flex-col overflow-hidden rounded-none bg-white shadow-2xl outline-none sm:max-h-[91dvh] sm:rounded-[23px]"
          >
            {/* EN-TÊTE DU PANNEAU */}

            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e5ece7] px-4 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e7f5eb] text-[#087a32]">
                  <Building2 size={23} />
                </div>

                <div className="min-w-0">
                  <h2
                    id="organizer-dialog-title"
                    className="text-[17px] font-black text-[#182a3f] sm:text-[20px]"
                  >
                    Détails de l&apos;organisateur
                  </h2>

                  <p className="mt-1 text-[11px] text-[#7b8993]">
                    Informations enregistrées dans TIKEMIA
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Fermer les détails"
                onClick={closeDetails}
                disabled={savingBadge}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e2e9e4] text-[#4c6071] transition hover:bg-[#f3f7f4] disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            {/* CONTENU DÉFILANT */}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4">
              {detailsLoading && !details ? (
                <div className="flex min-h-80 flex-col items-center justify-center gap-3">
                  <LoaderCircle
                    size={34}
                    className="animate-spin text-[#087a32]"
                  />

                  <p className="text-xs text-[#778793]">
                    Chargement des informations...
                  </p>
                </div>
              ) : detailsError && !details ? (
                <div className="flex min-h-40 flex-col items-center justify-center px-4 text-center">
                  <CircleAlert
                    size={35}
                    className="text-[#c35d47]"
                  />

                  <p className="mt-4 text-sm font-bold text-[#34465a]">
                    {detailsError}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      void loadDetails(selectedId)
                    }
                    className="mt-5 rounded-xl bg-[#087a32] px-5 py-3 text-xs font-extrabold text-white"
                  >
                    Réessayer
                  </button>
                </div>
              ) : details ? (
                <div className="space-y-3">
                  {/* IDENTITÉ */}

                  <div className="rounded-2xl border border-[#e4ebe5] bg-[#f9fbf9] p-4">
                    <div className="flex items-center gap-3">
                      <OrganizerAvatar
                        name={details.name}
                        large
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="min-w-0 wrap-break-word text-[17px] font-black text-[#16283d]">
                            {details.name}
                          </h3>

                          {details.blueBadgeEnabled && (
                            <BlueBadge size={23} />
                          )}
                        </div>

                        <p className="mt-1 text-[12px] text-[#6d7e8b]">
                          {details.owner.fullName}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <AccountStatus
                            active={details.isActive}
                          />

                          <BadgeStatus
                            enabled={
                              details.blueBadgeEnabled
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {details.description && (
                      <p className="mt-4 whitespace-pre-wrap wrap-break-word border-t border-[#e5ece7] pt-3 text-[12px] leading-relaxed text-[#637587]">
                        {details.description}
                      </p>
                    )}
                  </div>

                  {/* INFORMATIONS */}

                  <section>
                    <h3 className="mb-2 text-sm font-black text-[#1a2a40]">
                      Informations de l&apos;organisateur
                    </h3>

                    <div className="rounded-2xl border border-[#e5ebe6] bg-white px-4">
                      <InformationRow
                        label="Responsable"
                        value={
                          details.owner.fullName
                        }
                        icon={<UserRound size={17} />}
                      />

                      <InformationRow
                        label="Email"
                        value={
                          details.email ?? "Non renseigné"
                        }
                        icon={<Mail size={17} />}
                      />

                      <InformationRow
                        label="Téléphone"
                        value={
                          details.phoneE164 ??
                          "Non renseigné"
                        }
                        icon={<Phone size={17} />}
                      />

                      <InformationRow
                        label="Localisation"
                        value={
                          [
                            details.city,
                            details.countryCode,
                          ]
                            .filter(Boolean)
                            .join(", ") ||
                          "Non renseignée"
                        }
                        icon={<MapPin size={17} />}
                      />

                      <InformationRow
                        label="Inscription"
                        value={formatDate(
                          details.createdAt
                        )}
                        icon={
                          <CalendarDays size={17} />
                        }
                      />
                    </div>
                  </section>

                  <section className="min-w-0">
                    <h3 className="mb-3 text-sm font-black text-[#1a2a40]">Moyens de retrait</h3>
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">{details.withdrawalMethods?.map(method => <div key={method.id} className="min-w-0 rounded-xl border p-3">
                      <div className="flex flex-wrap justify-between gap-2"><strong>{method.provider}</strong><span className={method.isVerified ? "text-xs text-green-700" : "text-xs text-amber-700"}>{method.isVerified ? "Validé" : "Non vérifié"}</span></div>
                      <p className="mt-1 text-sm">{method.accountName}</p><p className="text-xs text-slate-500">{[method.type,method.countryCode,method.currency,method.bankName,method.assetCode,method.networkCode].filter(Boolean).join(" · ")}</p>
                      <dl className="mt-2 space-y-1 text-sm">{Object.entries(method.accountDetails ?? {reference:method.maskedAccountRef || "Coordonnées indisponibles"}).map(([key,value]) => <div key={key} className="min-w-0"><dt className="text-xs text-slate-500">{({reference:"Compte / numéro",accountRef:"Compte",iban:"IBAN",bic:"BIC",swift:"SWIFT",accountNumber:"Numéro de compte",routingCode:"Code bancaire",bankCode:"Code bancaire",branchCode:"Agence",mobileMoneyNumber:"Numéro Mobile Money",walletAddress:"Adresse du portefeuille",additionalInformation:"Informations"} as Record<string,string>)[key] || key}</dt><dd className="wrap-break-word font-semibold">{value}</dd></div>)}</dl>
                      {!method.isActive && <p className="mt-2 text-xs text-slate-500">Désactivé</p>}
                    </div>)}</div>{!details.withdrawalMethods?.length && <p className="text-sm text-slate-500">Aucun moyen de retrait enregistré.</p>}
                  </section>

                  {/* STATISTIQUES */}

                  <section>
                    <h3 className="mb-3 text-sm font-black text-[#1a2a40]">
                      Activités sur TIKEMIA
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <StatsCard
                        title="Événements publiés"
                        value={
                          details.statistics.publishedEvents
                        }
                        icon={
                          <CalendarDays size={20} />
                        }
                      />

                      <StatsCard
                        title="Cagnottes publiées"
                        value={
                          details.statistics.publishedCampaigns
                        }
                        icon={<Heart size={20} />}
                        iconClass="text-[#df6a6a]"
                      />

                      <StatsCard
                        title="Total événements"
                        value={
                          details.statistics.totalEvents
                        }
                        note="Tous statuts"
                        icon={<Ticket size={20} />}
                      />

                      <StatsCard
                        title="Total cagnottes"
                        value={
                          details.statistics.totalCampaigns
                        }
                        note="Tous statuts"
                        icon={<UsersRound size={20} />}
                      />
                    </div>
                  </section>

                  {/* FINANCES */}

                  <section>
                    <div className="mb-3 flex items-center gap-2">
                      <Wallet
                        size={20}
                        className="text-[#087a32]"
                      />

                      <h3 className="text-sm font-black text-[#1a2a40]">
                        Montants générés
                      </h3>
                    </div>

                    <MoneySummary
                      totals={
                        details.statistics.totalsByCurrency
                      }
                    />

                    <p className="mt-2 text-[11px] leading-relaxed text-[#7e8c95]">
                      Montants bruts confirmés, hors frais
                      de service. Les remboursements
                      partiels et les retraits ne sont
                      pas déduits. Les devises restent
                      séparées.
                    </p>
                  </section>

                  {/* BADGE BLEU */}

                  <section className="rounded-2xl border border-[#cfe5d5] bg-[#f5fbf6] p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e3f0ff]">
                        <BlueBadge size={29} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-[15px] font-black text-[#183049]">
                          Badge bleu TIKEMIA
                        </h3>

                        <p className="mt-1 text-[12px] leading-relaxed text-[#607384]">
                          Activer ou désactiver le badge
                          officiel de cette organisation.
                          
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3.5">
                      <div>
                        <p className="text-xs font-bold text-[#2b3c4d]">
                          Statut du badge
                        </p>

                        <p className="mt-1 text-xs text-[#758491]">
                          {details.blueBadgeEnabled
                            ? "Badge actuellement activé"
                            : "Badge actuellement désactivé"}
                        </p>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={
                          details.blueBadgeEnabled
                        }
                        aria-label={
                          details.blueBadgeEnabled
                            ? "Désactiver le badge bleu"
                            : "Activer le badge bleu"
                        }
                        disabled={savingBadge}
                        onClick={() =>
                          void changeBlueBadge(
                            !details.blueBadgeEnabled
                          )
                        }
                        className={`relative inline-flex h-8 w-15 shrink-0 items-center rounded-full p-1 transition-colors disabled:cursor-wait disabled:opacity-60 ${
                          details.blueBadgeEnabled
                            ? "bg-[#087e32]"
                            : "bg-[#b7c1c6]"
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#087e32] shadow-sm transition-transform ${
                            details.blueBadgeEnabled
                              ? "translate-x-7"
                              : "translate-x-0"
                          }`}
                        >
                          {savingBadge ? (
                            <LoaderCircle
                              size={14}
                              className="animate-spin"
                            />
                          ) : details.blueBadgeEnabled ? (
                            <Check size={15} />
                          ) : null}
                        </span>
                      </button>
                    </div>

                    {notice && (
                      <div
                        role="status"
                        aria-live="polite"
                        className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-[12px] font-semibold ${
                          notice.type === "success"
                            ? "bg-[#e3f6e7] text-[#087a32]"
                            : "bg-[#fff0eb] text-[#ad473a]"
                        }`}
                      >
                        {notice.type === "success" ? (
                          <CheckCircle2
                            size={17}
                            className="shrink-0"
                          />
                        ) : (
                          <CircleAlert
                            size={17}
                            className="shrink-0"
                          />
                        )}

                        <span>
                          {notice.message}
                        </span>
                      </div>
                    )}

                    <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-[#718292]">
                      <ShieldCheck
                        size={15}
                        className="mt-0.5 shrink-0 text-[#087a32]"
                      />

                      Seuls les administrateurs autorisés
                      peuvent effectuer cette action.
                      L&apos;activation est enregistrée dans
                      le journal d&apos;audit.
                    </p>
                  </section>

                  {/* DERNIÈRE ACTUALISATION */}

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf1ee] pt-4">
                    <p className="text-[11px] text-[#82919c]">
                      Dernière modification :{" "}
                      {formatDateTime(
                        details.updatedAt
                      )}
                    </p>

                    <button
                      type="button"
                      disabled={
                        detailsRefreshing ||
                        savingBadge
                      }
                      onClick={() =>
                        void loadDetails(
                          selectedId,
                          true
                        )
                      }
                      className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#dce8df] px-3 text-xs font-bold text-[#087a32] disabled:opacity-50"
                    >
                      <RefreshCw
                        size={15}
                        className={
                          detailsRefreshing
                            ? "animate-spin"
                            : ""
                        }
                      />

                      Actualiser
                    </button>
                  </div>

                  {detailsError && (
                    <p
                      role="alert"
                      className="rounded-lg bg-[#fff2ed] p-3 text-xs text-[#b45441]"
                    >
                      {detailsError}
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            {/* PIED DU PANNEAU */}

            <div className="shrink-0 border-t border-[#e5ece7] bg-white px-4 py-3 sm:px-6">
              <button
                type="button"
                onClick={closeDetails}
                disabled={savingBadge}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#087a32] px-5 text-sm font-extrabold text-white transition hover:bg-[#056b29] disabled:opacity-50"
              >
                <Check size={18} />
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
