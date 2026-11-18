
"use client";
import {
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

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Heart,
  ImageOff,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";



/* ============================================
   TIKEMIA — MES DONS

   Fichier :
   src/app/organizer/dashboard/campaigns/page.tsx

   API :
   GET /api/organizer/campaigns
   DELETE /api/organizer/campaigns/[id]

   Pages :
   /organizer/dashboard/campaigns/[id]
   /organizer/dashboard/publish-campaign
   /organizer/dashboard/publish-campaign?edit=ID

   Fonctionnalités :
   - Onglets et compteurs
   - Recherche
   - Cartes PC / mobile
   - Progression des collectes
   - Pagination serveur
   - Voir
   - Modifier
   - Supprimer / clôturer
   - Confirmation avant suppression
   - FR / EN
   - Actualisation automatique
   - Pleine largeur

   Le layout existant fournit déjà
   le menu PC et le menu mobile.
============================================ */

const API_URL = "/api/organizer/campaigns";

const CAMPAIGNS_URL =
  "/organizer/dashboard/campaigns";

const PUBLISH_URL =
  "/organizer/dashboard/publish-campaign";

const PAGE_SIZE = 10;

const REFRESH_INTERVAL = 20_000;

type CampaignFilter =
  | "all"
  | "active"
  | "completed"
  | "drafts";

type Campaign = {
  id: string;
  title: string;
  description: string;
  status: string;
  countryCode: string;
  city: string;
  currency: string;
  goalAmount: string | null;
  collectedAmount: string | null;
  remainingAmount: string | null;
  progress: number | null;
  contributionCount: number | null;
  createdAt: string | null;
  imageUrl: string | null;
};

type Counters = {
  all: number;
  active: number;
  completed: number;
  drafts: number;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

type ApiRecord = Record<string, unknown>;

const EMPTY_COUNTS: Counters = {
  all: 0,
  active: 0,
  completed: 0,
  drafts: 0,
};

const EMPTY_PAGINATION: Pagination = {
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 1,
  hasPrevious: false,
  hasNext: false,
};

/* ============================================
   TRADUCTIONS
============================================ */

const TEXT = {
  fr: {
    pageTitle: "Mes dons",
    subtitle: "Gérez vos cagnottes et suivez vos collectes.",
    create: "Lancer une cagnotte",
    all: "Tous",
    active: "Actifs",
    completed: "Terminés",
    drafts: "Brouillons",
    search: "Rechercher une cagnotte...",
    searchLabel: "Rechercher",
    total: "Total des cagnottes",
    published: "Cagnottes actives",
    finished: "Cagnottes terminées",
    draftCount: "Brouillons et en validation",
    collected: "Collecté",
    goal: "Objectif",
    progress: "Progression",
    contributions: "contributions",
    view: "Voir",
    edit: "Modifier",
    remove: "Supprimer",
    refresh: "Actualiser",
    loading: "Chargement des cagnottes...",
    error: "Impossible de charger les cagnottes.",
    retry: "Réessayer",
    empty: "Aucune cagnotte pour le moment.",
    emptySearch: "Aucune cagnotte ne correspond à votre recherche.",
    createFirst: "Lancer ma première cagnotte",
    statusActive: "Active",
    statusCompleted: "Terminée",
    statusClosed: "Clôturée",
    statusPending: "En validation",
    statusDraft: "Brouillon",
    statusCancelled: "Annulée",
    imageUnavailable: "Image indisponible",
    page: "Page",
    of: "sur",
    previous: "Page précédente",
    next: "Page suivante",
    confirmTitle: "Retirer cette cagnotte ?",
    confirmDescription:
      "Cette action retirera la cagnotte de la publication. Si elle possède déjà des contributions, le serveur la clôturera en conservant l'historique financier.",
    cancel: "Annuler",
    confirm: "Confirmer",
    deleting: "Traitement en cours...",
    removed: "La cagnotte a été retirée ou clôturée.",
    deleteError: "Impossible de traiter cette demande.",
    updated: "Dernière actualisation",
    noData: "—",
    close: "Fermer",
  },

  en: {
    pageTitle: "My fundraisers",
    subtitle: "Manage your fundraisers and track collections.",
    create: "Launch a fundraiser",
    all: "All",
    active: "Active",
    completed: "Completed",
    drafts: "Drafts",
    search: "Search fundraisers...",
    searchLabel: "Search",
    total: "Total fundraisers",
    published: "Active fundraisers",
    finished: "Completed fundraisers",
    draftCount: "Drafts and pending review",
    collected: "Collected",
    goal: "Goal",
    progress: "Progress",
    contributions: "contributions",
    view: "View",
    edit: "Edit",
    remove: "Remove",
    refresh: "Refresh",
    loading: "Loading fundraisers...",
    error: "Unable to load fundraisers.",
    retry: "Try again",
    empty: "No fundraisers yet.",
    emptySearch: "No fundraiser matches your search.",
    createFirst: "Launch my first fundraiser",
    statusActive: "Active",
    statusCompleted: "Completed",
    statusClosed: "Closed",
    statusPending: "Pending review",
    statusDraft: "Draft",
    statusCancelled: "Cancelled",
    imageUnavailable: "Image unavailable",
    page: "Page",
    of: "of",
    previous: "Previous page",
    next: "Next page",
    confirmTitle: "Remove this fundraiser?",
    confirmDescription:
      "This action will remove the fundraiser from publication. If it already has contributions, the server will close it while preserving its financial history.",
    cancel: "Cancel",
    confirm: "Confirm",
    deleting: "Processing...",
    removed: "Fundraiser removed or closed.",
    deleteError: "Unable to process this request.",
    updated: "Last refreshed",
    noData: "—",
    close: "Close",
  },
} as const;

/* ============================================
   UTILITAIRES
============================================ */

function asRecord(value: unknown): ApiRecord {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as ApiRecord)
    : {};
}

function asString(
  value: unknown,
  fallback = ""
): string {
  return typeof value === "string"
    ? value
    : fallback;
}

function asNumber(
  value: unknown
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return null;
  }

  return value;
}

function asCount(value: unknown): number | null {
  const number = asNumber(value);

  return number !== null &&
    Number.isSafeInteger(number)
    ? number
    : null;
}

function asAmount(value: unknown): string | null {
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

function asDate(value: unknown): string | null {
  return typeof value === "string" &&
    !Number.isNaN(Date.parse(value))
    ? value
    : null;
}

function asImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) {
    return null;
  }

  if (
    value.startsWith("/") &&
    !value.startsWith("//")
  ) {
    return value;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:"
      ? value
      : null;
  } catch {
    return null;
  }
}

function normalizeCampaign(value: unknown): Campaign {
  const data = asRecord(value);

  const images = Array.isArray(data.images)
    ? data.images
    : [];

  const firstImage = asRecord(images[0]);

  return {
    id: asString(data.id),
    title: asString(data.title),
    description: asString(data.description),
    status: asString(data.status),

    countryCode: asString(
      data.countryCode ?? data.country
    ),

    city: asString(data.city),

    currency: asString(
      data.currency,
      "XOF"
    ),

    goalAmount: asAmount(
      data.goalAmount
    ),

    collectedAmount: asAmount(
      data.collectedAmount
    ),

    remainingAmount: asAmount(
      data.remainingAmount
    ),

    progress: asNumber(
      data.progress ?? data.percentage
    ),

    contributionCount: asCount(
      data.contributionCount
    ),

    createdAt: asDate(
      data.createdAt
    ),

    imageUrl: asImageUrl(
      data.imageUrl ??
        data.image ??
        firstImage.url
    ),
  };
}

function normalizeCounts(value: unknown): Counters {
  const data = asRecord(value);

  return {
    all: asCount(data.all) ?? 0,
    active: asCount(data.active) ?? 0,
    completed: asCount(data.completed) ?? 0,
    drafts: asCount(data.drafts) ?? 0,
  };
}

function normalizePagination(
  value: unknown
): Pagination {
  const data = asRecord(value);

  const page = asCount(data.page) ?? 1;
  const pageSize =
    asCount(data.pageSize) ?? PAGE_SIZE;
  const total = asCount(data.total) ?? 0;
  const totalPages = Math.max(
    1,
    asCount(data.totalPages) ?? 1
  );

  return {
    page: Math.max(1, page),
    pageSize: Math.max(1, pageSize),
    total,
    totalPages,
    hasPrevious:
      data.hasPrevious === true,
    hasNext:
      data.hasNext === true,
  };
}

function formatCount(
  count: number | null,
  locale: Locale
): string {
  if (count === null) {
    return "—";
  }

  return new Intl.NumberFormat(
    locale === "fr" ? "fr-FR" : "en-US"
  ).format(count);
}

function formatAmount(
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

function formatDate(
  date: string | null,
  locale: Locale
): string {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    locale === "fr" ? "fr-FR" : "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(new Date(date));
}

function formatPercent(
  value: number | null,
  locale: Locale
): string {
  if (value === null) {
    return "—";
  }

  return (
    new Intl.NumberFormat(
      locale === "fr" ? "fr-FR" : "en-US",
      { maximumFractionDigits: 2 }
    ).format(value) + " %"
  );
}

function getStatusLabel(
  status: string,
  locale: Locale
): string {
  const t = TEXT[locale];

  switch (status.toUpperCase()) {
    case "ACTIVE":
    case "PUBLISHED":
    case "ON_SALE":
      return t.statusActive;

    case "CLOSED":
      return t.statusClosed;

    case "COMPLETED":
      return t.statusCompleted;

    case "PENDING_REVIEW":
      return t.statusPending;

    case "DRAFT":
      return t.statusDraft;

    case "ARCHIVED":
    case "CANCELLED":
      return t.statusCancelled;

    default:
      return status || "—";
  }
}

function getStatusClass(status: string): string {
  switch (status.toUpperCase()) {
    case "ACTIVE":
    case "PUBLISHED":
    case "ON_SALE":
      return "bg-[#e3f8e7] text-[#08752b]";

    case "COMPLETED":
    case "CLOSED":
      return "bg-[#e6f0ff] text-[#245d9b]";

    case "CANCELLED":
      return "bg-[#feecec] text-[#a72b2b]";

    case "DRAFT":
      return "bg-[#eff2f6] text-[#536176]";

    default:
      return "bg-[#fff2d6] text-[#996400]";
  }
}

/* ============================================
   CARTE D'INDICATEUR
============================================ */

function CounterCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: typeof Heart;
  color: "green" | "blue" | "amber" | "purple";
}) {
  const styles = {
    green: "bg-[#e5f9e8] text-[#08752a]",
    blue: "bg-[#e6f0ff] text-[#2461b7]",
    amber: "bg-[#fff3dc] text-[#b87908]",
    purple: "bg-[#f2eafd] text-[#7d3cba]",
  };

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#e2e8ef] bg-white p-3 shadow-sm sm:p-4">
      <div
        className={`flex size-11 shrink-0 items-center justify-center rounded-xl sm:size-13 ${styles[color]}`}
      >
        <Icon size={23} strokeWidth={2.2} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs leading-snug font-semibold text-[#58677d] sm:text-sm">
          {label}
        </p>

        <p className="mt-1 wrap-anywhere text-lg font-extrabold text-[#11223d] sm:text-2xl">
          {value}
        </p>
      </div>
    </div>
  );
}

/* ============================================
   CARTE DE CAGNOTTE
============================================ */

function CampaignCard({
  campaign,
  locale,
  onDelete,
}: {
  campaign: Campaign;
  locale: Locale;
  onDelete: (campaign: Campaign) => void;
}) {
  const t = TEXT[locale];

  const progress =
    campaign.progress === null
      ? 0
      : Math.min(
          100,
          Math.max(0, campaign.progress)
        );

  const detailsUrl =
    `${CAMPAIGNS_URL}/${encodeURIComponent(campaign.id)}`;

  const editUrl =
    `${PUBLISH_URL}?edit=${encodeURIComponent(campaign.id)}`;

  return (
    <article className="flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e0e7ef] bg-white shadow-sm transition-shadow hover:shadow-md md:flex-row">
      {/* IMAGE PC ET MOBILE */}

      <div className="relative h-45 w-full shrink-0 overflow-hidden bg-[#eef2f5] sm:h-52 md:h-auto md:w-54 lg:w-62 xl:w-68">
        {campaign.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={campaign.imageUrl}
            alt={campaign.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[#8b9aab]">
            <ImageOff size={35} />
            <span className="text-xs">
              {t.imageUnavailable}
            </span>
          </div>
        )}

        <span
          className={`absolute top-3 left-3 rounded-full px-3 py-1.5 text-xs font-extrabold shadow-sm ${getStatusClass(campaign.status)}`}
        >
          {getStatusLabel(campaign.status, locale)}
        </span>
      </div>

      {/* INFORMATIONS */}

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-4 lg:p-5">
        <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h3 className="text-base leading-snug font-extrabold wrap-anywhere text-[#11213c] sm:text-lg lg:text-xl">
              {campaign.title}
            </h3>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-medium text-[#65738a] sm:text-sm">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays
                  size={15}
                  className="text-green-700"
                />

                {formatDate(
                  campaign.createdAt,
                  locale
                )}
              </span>

              <span className="inline-flex items-center gap-1.5">
                <MapPin
                  size={15}
                  className="text-green-700"
                />

                {[
                  campaign.city,
                  campaign.countryCode,
                ]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </span>
            </div>
          </div>

          <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-[#f0f8ee] px-3 py-1.5 text-xs font-bold text-green-800">
            <Heart size={15} />
            {formatCount(
              campaign.contributionCount,
              locale
            )}{" "}
            {t.contributions}
          </span>
        </div>

        {campaign.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-[#66738a] sm:text-sm">
            {campaign.description}
          </p>
        )}

        {/* MONTANTS */}

        <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#f7faf8] p-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#68758a]">
              {t.collected}
            </p>

            <p className="mt-1 wrap-anywhere text-base font-extrabold text-[#07762c] sm:text-lg">
              {formatAmount(
                campaign.collectedAmount,
                campaign.currency,
                locale
              )}
            </p>
          </div>

          <div className="min-w-0 text-right">
            <p className="text-xs font-semibold text-[#68758a]">
              {t.goal}
            </p>

            <p className="mt-1 wrap-anywhere text-base font-extrabold text-[#132341] sm:text-lg">
              {formatAmount(
                campaign.goalAmount,
                campaign.currency,
                locale
              )}
            </p>
          </div>
        </div>

        {/* PROGRESSION */}

        <div>
          <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold sm:text-sm">
            <span className="text-[#59677a]">
              {t.progress}
            </span>

            <span className="text-green-800">
              {formatPercent(
                campaign.progress,
                locale
              )}
            </span>
          </div>

          <div
            className="h-3 w-full overflow-hidden rounded-full bg-[#e7ebf0]"
            role="progressbar"
            aria-label={t.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={
              campaign.progress === null
                ? undefined
                : progress
            }
          >
            <div
              className="h-full rounded-full bg-linear-to-r from-[#078331] via-[#38c82c] to-[#97de19] transition-all"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>
        </div>

        {/* BOUTONS */}

        <div className="mt-auto grid grid-cols-3 gap-2 border-t border-[#edf0f4] pt-3 sm:flex sm:flex-wrap">
          <Link
            href={detailsUrl}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-[#e9f8eb] min-w-0 px-1.5 text-xs font-extrabold text-[#08772d] hover:bg-green-100 sm:text-sm"
          >
            <Eye size={17} />
            {t.view}
          </Link>

          <Link
            href={editUrl}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-[#edf2ff] min-w-0 px-1.5 text-xs font-extrabold text-[#2856a5] hover:bg-blue-100 sm:text-sm"
          >
            <Pencil size={17} />
            {t.edit}
          </Link>

          <button
            type="button"
            onClick={() => onDelete(campaign)}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-[#fff0ef] min-w-0 px-1.5 text-xs font-extrabold text-[#b32f2f] hover:bg-red-100 sm:text-sm"
          >
            <Trash2 size={17} />
            {t.remove}
          </button>
        </div>
      </div>
    </article>
  );
}

/* ============================================
   PAGE PRINCIPALE
============================================ */

export default function CampaignsPage() {
  const [locale, setLocale] =
    useState<Locale>(defaultLocale);

  const [filter, setFilter] =
    useState<CampaignFilter>("all");

  const [search, setSearch] =
    useState("");

  const [debouncedSearch, setDebouncedSearch] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [campaigns, setCampaigns] =
    useState<Campaign[]>([]);

  const [counts, setCounts] =
    useState<Counters>(EMPTY_COUNTS);

  const [pagination, setPagination] =
    useState<Pagination>(EMPTY_PAGINATION);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [notice, setNotice] =
    useState("");

  const [, setLastUpdated] =
    useState<Date | null>(null);

  const [refreshVersion, setRefreshVersion] =
    useState(0);

  const [deleteTarget, setDeleteTarget] =
    useState<Campaign | null>(null);

  const [deleting, setDeleting] =
    useState(false);

  const t = TEXT[locale];

  /* ==========================================
     LANGUE
  ========================================== */

  useEffect(() => {
    const updateLocale = () => {
      try {
        const stored =
          window.localStorage.getItem(
            i18nConfig.storageKey
          );

        if (stored) {
          setLocale(
            normalizeLocale(stored)
          );
        }
      } catch {
        // Utiliser la langue par défaut.
      }
    };

    updateLocale();

    window.addEventListener(
      "storage",
      updateLocale
    );

    window.addEventListener(
      "focus",
      updateLocale
    );

    return () => {
      window.removeEventListener(
        "storage",
        updateLocale
      );

      window.removeEventListener(
        "focus",
        updateLocale
      );
    };
  }, []);

  /* ==========================================
     RECHERCHE AVEC DÉLAI
  ========================================== */

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);

    return () =>
      window.clearTimeout(timer);
  }, [search]);

  /* ==========================================
     CONSTRUIRE L'URL
  ========================================== */

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({
      status: filter,
      search: debouncedSearch,
      page: String(page),
      pageSize: String(PAGE_SIZE),
      sort: "newest",
      locale,
    });

    return `${API_URL}?${params.toString()}`;
  }, [
    filter,
    debouncedSearch,
    page,
    locale,
  ]);

  /* ==========================================
     CHARGEMENT DES CAGNOTTES
  ========================================== */

  const [activeRequestUrl, setActiveRequestUrl] = useState(requestUrl);
  if (activeRequestUrl !== requestUrl) {
    setActiveRequestUrl(requestUrl);
    setLoading(true);
    setError("");
  }

  const loadCampaignsRequest = useCallback(
    async (
      signal?: AbortSignal,
      _background = false
    ) => {
      void _background;


      
        return fetch(
          requestUrl,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            signal,
          }
        ).then(async (response) => {

        const data: unknown =
          await response.json();

        const result = asRecord(data);

        if (
          !response.ok ||
          result.success !== true ||
          !Array.isArray(result.campaigns)
        ) {
          throw new Error(
            asString(
              result.message,
              TEXT[locale].error
            )
          );
        }

        if (signal?.aborted) {
          return;
        }

        const normalized =
          result.campaigns
            .map(normalizeCampaign)
            .filter((campaign) =>
              Boolean(campaign.id)
            );

        setCampaigns(normalized);

        setCounts(
          normalizeCounts(result.counts)
        );

        setPagination(
          normalizePagination(
            result.pagination
          )
        );

        setLastUpdated(new Date());
        setError("");
      
}).catch((caughtError) => {
        if (signal?.aborted) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : TEXT[locale].error
        );
      }).finally(() => {
        if (!signal?.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    },
    [requestUrl, locale]
  );


  /* ==========================================
     PREMIER CHARGEMENT / FILTRES
  ========================================== */

  useEffect(() => {
    const controller = new AbortController();

    void loadCampaignsRequest(
      controller.signal
    );

    return () =>
      controller.abort();
  }, [
    loadCampaignsRequest,
    refreshVersion,
  ]);

  /* ==========================================
     ACTUALISATION AUTOMATIQUE

     Si la fenêtre est ouverte,
     récupérer les données récentes.
  ========================================== */

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (
        document.visibilityState === "visible"
      ) {
        setRefreshVersion(
          (previous) => previous + 1
        );
      }
    }, REFRESH_INTERVAL);

    return () =>
      window.clearInterval(interval);
  }, []);

  /* ==========================================
     CHANGER D'ONGLET
  ========================================== */

  function changeFilter(
    nextFilter: CampaignFilter
  ) {
    if (nextFilter === filter) return;
    setLoading(true);
    setFilter(nextFilter);
    setPage(1);
    setNotice("");
  }

  /* ==========================================
     ACTUALISER
  ========================================== */

  function refresh() {
    setRefreshing(true);
    setRefreshVersion(
      (previous) => previous + 1
    );
  }

  /* ==========================================
     SUPPRESSION / CLÔTURE

     Le serveur décide si la cagnotte
     peut être retirée ou doit être
     clôturée en conservant ses dons.
  ========================================== */

  async function confirmDelete() {
    if (!deleteTarget || deleting) {
      return;
    }

    setDeleting(true);
    setError("");
    setNotice("");

    try {
      const url =
        `${API_URL}/${encodeURIComponent(deleteTarget.id)}`;

      const response = await fetch(url, {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
      });

      const result: unknown =
        await response.json();

      const data = asRecord(result);

      if (
        !response.ok ||
        data.success !== true
      ) {
        throw new Error(
          asString(
            data.message,
            t.deleteError
          )
        );
      }

      setDeleteTarget(null);

      setNotice(
        asString(data.message, t.removed)
      );

      if (
        campaigns.length === 1 &&
        page > 1
      ) {
        setPage(page - 1);
      } else {
        refresh();
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t.deleteError
      );

      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  /* ==========================================
     ONGLETS
  ========================================== */

  const tabs: {
    id: CampaignFilter;
    label: string;
    count: number;
  }[] = [
    {
      id: "all",
      label: t.all,
      count: counts.all,
    },
    {
      id: "active",
      label: t.active,
      count: counts.active,
    },
    {
      id: "completed",
      label: t.completed,
      count: counts.completed,
    },
    {
      id: "drafts",
      label: t.drafts,
      count: counts.drafts,
    },
  ];

  /* ============================================
     RENDU PRINCIPAL
  ============================================ */

  return (
    <main className="flex min-h-full w-full min-w-0 flex-col overflow-x-hidden bg-[#f6f9fb] pb-2 text-[#11213b]">
      {/* ======================================
          EN-TÊTE DE LA PAGE

          Le layout fournit déjà
          les menus de TIKEMIA.
      ====================================== */}

      <header className="relative w-full overflow-hidden border-b border-[#e2e8f0] bg-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-13 bg-linear-to-r from-[#e2ffd4] via-[#f4ffe7] to-[#fff4d4] opacity-80"
        />

        <div className="relative flex w-full flex-col gap-4 px-3 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-6 lg:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#e0ffd6] text-[#0a8129] sm:size-14">
              <Heart
                size={28}
                strokeWidth={2.2}
              />
            </div>

            <div className="min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight text-[#10213b] sm:text-2xl lg:text-3xl">
                {t.pageTitle}
              </h1>

              <p className="mt-1 text-xs text-[#627086] sm:text-sm">
                {t.subtitle}
              </p>
            </div>
          </div>

          <div className="flex w-full gap-2 sm:w-auto">
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing || loading}
              aria-label={t.refresh}
              title={t.refresh}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#dce4ec] bg-white text-[#40536a] hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw
                size={19}
                className={
                  refreshing ? "animate-spin" : ""
                }
              />
            </button>

            <Link
              href={PUBLISH_URL}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-[#087d2a] to-[#23bd1b] px-4 text-sm font-extrabold text-white shadow-sm hover:brightness-110 sm:flex-none"
            >
              <Plus size={20} />
              {t.create}
            </Link>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="relative h-1 w-full bg-linear-to-r from-[#057b2f] via-[#80d80c] to-[#ffc420]"
        />
      </header>

      {/* ======================================
          CONTENU PLEINE LARGEUR
      ====================================== */}

      <div className="flex w-full min-w-0 flex-1 flex-col gap-3 p-3 sm:p-4 lg:gap-4 lg:p-5">
        {/* COMPTEURS */}

        <section className="grid w-full min-w-0 grid-cols-2 gap-3 xl:grid-cols-4">
          <CounterCard
            label={t.total}
            value={formatCount(counts.all, locale)}
            icon={Heart}
            color="purple"
          />

          <CounterCard
            label={t.published}
            value={formatCount(counts.active, locale)}
            icon={TrendingUp}
            color="green"
          />

          <CounterCard
            label={t.finished}
            value={formatCount(counts.completed, locale)}
            icon={CheckCircle2}
            color="blue"
          />

          <CounterCard
            label={t.draftCount}
            value={formatCount(counts.drafts, locale)}
            icon={Clock3}
            color="amber"
          />
        </section>

        {/* FILTRES ET RECHERCHE */}

        <section className="w-full min-w-0 rounded-2xl border border-[#e0e7ef] bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div
              role="tablist"
              aria-label={t.pageTitle}
              className="flex w-full min-w-0 gap-2 overflow-x-auto pb-1 lg:w-auto"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === tab.id}
                  onClick={() => changeFilter(tab.id)}
                  className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-xs font-extrabold transition-colors sm:px-4 sm:text-sm ${
                    filter === tab.id
                      ? "bg-[#087c2a] text-white shadow-sm"
                      : "bg-[#f0f3f7] text-[#526177] hover:bg-[#e8edf2]"
                  }`}
                >
                  {tab.label}

                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      filter === tab.id
                        ? "bg-white/20 text-white"
                        : "bg-white text-[#526177]"
                    }`}
                  >
                    {formatCount(
                      tab.count,
                      locale
                    )}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative w-full min-w-0 lg:w-78 xl:w-90">
              <Search
                size={19}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#8090a0]"
              />

              <input
                type="search"
                aria-label={t.searchLabel}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder={t.search}
                className="h-11 w-full min-w-0 rounded-xl border border-[#d2dce5] bg-white pr-3 pl-10 text-sm text-[#14243e] outline-none placeholder:text-[#8090a0] focus:border-green-600 focus:ring-2 focus:ring-green-100"
              />
            </div>
          </div>
        </section>

        {/* MESSAGES */}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"
          >
            <AlertTriangle
              size={19}
              className="mt-0.5 shrink-0"
            />

            <span className="flex-1">{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label={t.close}
              className="shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800"
          >
            <CheckCircle2 size={19} />

            <span className="flex-1">
              {notice}
            </span>

            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label={t.close}
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* LISTE DES CAGNOTTES */}

        {loading && campaigns.length === 0 ? (
          <div
            role="status"
            className="flex min-h-60 w-full flex-col items-center justify-center gap-3 rounded-2xl border border-[#e2e8ef] bg-white"
          >
            <LoaderCircle
              size={34}
              className="animate-spin text-green-700"
            />

            <p className="text-sm font-semibold text-[#64748b]">
              {t.loading}
            </p>
          </div>
        ) : error && campaigns.length === 0 ? (
          <div className="flex min-h-60 flex-col items-center justify-center gap-4 rounded-2xl border border-[#e2e8ef] bg-white p-6 text-center">
            <AlertTriangle
              size={36}
              className="text-red-500"
            />

            <p className="text-sm text-[#64748b]">
              {t.error}
            </p>

            <button
              type="button"
              onClick={refresh}
              className="rounded-xl bg-[#087c2a] px-5 py-3 text-sm font-bold text-white"
            >
              {t.retry}
            </button>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex min-h-64 w-full flex-col items-center justify-center gap-3 rounded-2xl border border-[#e2e8ef] bg-white p-6 text-center">
            <div className="flex size-15 items-center justify-center rounded-full bg-green-50 text-green-700">
              <Heart size={29} />
            </div>

            <p className="text-sm font-bold text-[#172940]">
              {debouncedSearch
                ? t.emptySearch
                : t.empty}
            </p>

            {counts.all === 0 && !debouncedSearch && (
              <Link
                href={PUBLISH_URL}
                className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#087c2a] px-4 text-sm font-bold text-white"
              >
                <Plus size={19} />
                {t.createFirst}
              </Link>
            )}
          </div>
        ) : (
          <section className="flex w-full min-w-0 flex-col gap-3 sm:gap-4">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                locale={locale}
                onDelete={setDeleteTarget}
              />
            ))}
          </section>
        )}

        {/* PAGINATION SERVEUR */}

        {!loading &&
          pagination.totalPages > 1 && (
            <nav
              aria-label="Pagination"
              className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e0e7ef] bg-white px-3 py-3 shadow-sm sm:px-5"
            >
              <span className="text-xs font-semibold text-[#66748a] sm:text-sm">
                {formatCount(
                  pagination.total,
                  locale
                )}{" "}
                {t.pageTitle.toLowerCase()}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={
                    !pagination.hasPrevious ||
                    loading
                  }
                  onClick={() =>
                    setPage((previous) =>
                      Math.max(1, previous - 1)
                    )
                  }
                  aria-label={t.previous}
                  className="flex size-10 items-center justify-center rounded-xl border border-[#d8e0e8] text-[#172940] hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronLeft size={20} />
                </button>

                <span className="min-w-23 text-center text-xs font-bold text-[#172940] sm:text-sm">
                  {t.page} {pagination.page}{" "}
                  {t.of} {pagination.totalPages}
                </span>

                <button
                  type="button"
                  disabled={
                    !pagination.hasNext ||
                    loading
                  }
                  onClick={() =>
                    setPage((previous) =>
                      previous + 1
                    )
                  }
                  aria-label={t.next}
                  className="flex size-10 items-center justify-center rounded-xl border border-[#d8e0e8] text-[#172940] hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </nav>
          )}

        {/* ACTUALISATION */}

        
      </div>

      {/* ======================================
          CONFIRMATION DE SUPPRESSION

          Fenêtre adaptée PC et mobile.
          Le navigateur ne décide jamais
          seul d'effacer les dons.
      ====================================== */}

      {deleteTarget && (
        <div
          role="presentation"
          className="fixed inset-0 z-100 flex items-center justify-center bg-[#071728]/70 p-3 backdrop-blur-sm sm:p-5"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="campaign-delete-title"
            aria-describedby="campaign-delete-description"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-4 flex size-13 items-center justify-center rounded-full bg-red-50 text-red-600">
              <Trash2 size={25} />
            </div>

            <h2
              id="campaign-delete-title"
              className="text-lg font-extrabold text-[#14233c]"
            >
              {t.confirmTitle}
            </h2>

            <p className="mt-2 text-sm font-extrabold text-[#24334b]">
              {deleteTarget.title}
            </p>

            <p
              id="campaign-delete-description"
              className="mt-3 text-sm leading-relaxed text-[#627086]"
            >
              {t.confirmDescription}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() =>
                  setDeleteTarget(null)
                }
                className="min-h-12 rounded-xl border border-[#d8e0e8] bg-white px-4 text-sm font-extrabold text-[#24334b] hover:bg-gray-50 disabled:opacity-50"
              >
                {t.cancel}
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={() =>
                  void confirmDelete()
                }
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-3 text-sm font-extrabold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <LoaderCircle
                      size={18}
                      className="animate-spin"
                    />
                    <span className="text-xs">
                      {t.deleting}
                    </span>
                  </>
                ) : (
                  <>
                    <Trash2 size={17} />
                    {t.confirm}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
