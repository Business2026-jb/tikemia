
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
  useRef,
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
  Coins,
  Download,
  FileText,
  HeartHandshake,
  ImageOff,
  LoaderCircle,
  MapPin,
  Pencil,
  RefreshCw,
  Target,
  TrendingUp,
  UsersRound,
  Wallet,
} from "lucide-react";



/* ============================================
   TIKEMIA — DÉTAILS D'UNE CAGNOTTE

   Fichier :
   src/app/organizer/dashboard/
   campaigns/[id]/page.tsx

   URL :
   /organizer/dashboard/campaigns/[id]

   API :
   GET /api/organizer/campaigns/[id]

   Rapport :
   GET /api/organizer/campaigns/[id]/report

   Fonctionnalités :
   - Détails de la cagnotte
   - Galerie d'images
   - Objectif financier
   - Collecte confirmée
   - Montant restant
   - Taux de progression
   - Nombre de contributions
   - Historique récent des dons
   - Actualisation automatique
   - Modification de la cagnotte
   - Téléchargement PDF
   - Français / Anglais
   - Responsive PC / mobile

   Le layout du dashboard fournit déjà
   la sidebar et les menus mobiles.
============================================ */

const ROUTES = {
  campaigns:
    "/organizer/dashboard/campaigns",

  publishCampaign:
    "/organizer/dashboard/publish-campaign",

  api:
    "/api/organizer/campaigns",
} as const;

const REFRESH_INTERVAL = 20_000;

const CONTRIBUTIONS_PER_PAGE = 8;

type Currency = (typeof SUPPORTED_CURRENCIES)[number];

type CampaignImage = {
  id: string;
  url: string | null;
  position: number;
  isPrimary: boolean;
};

type Contribution = {
  id: string;
  amount: string;
  currency: Currency;
  status: string;
  createdAt: string;
};

type CampaignDetails = {
  id: string;
  title: string;
  description: string;
  status: string;

  countryCode: string;
  city: string;

  currency: Currency;

  goalAmount: string;
  collectedAmount: string;
  remainingAmount: string;

  progress: number | null;
  contributionCount: number | null;
  totalDonationRecords: number | null;

  createdAt: string | null;
  updatedAt: string | null;

  images: CampaignImage[];
  contributions: Contribution[];
};

type ApiRecord = Record<string, unknown>;

/* ============================================
   TRADUCTIONS
============================================ */

const TEXT = {
  fr: {
    pageTitle: "Détails de la cagnotte",

    subtitle:
      "Suivez votre collecte et vos contributions.",

    back: "Mes dons",
    edit: "Modifier",
    refresh: "Actualiser",
    download: "Télécharger PDF",

    loading:
      "Chargement de la cagnotte...",

    loadingError:
      "Impossible de charger les informations de cette cagnotte.",

    invalidId:
      "Identifiant de cagnotte invalide.",

    retry: "Réessayer",

    information:
      "Informations de la cagnotte",

    description: "Description",

    country: "Pays",
    city: "Ville",
    launchDate: "Date de création",

    goal: "Objectif",
    collected: "Montant collecté",
    remaining: "Reste à collecter",
    participants: "Contributions confirmées",

    progress: "Progression de la collecte",
    progressLabel: "Objectif atteint",

    contributions:
      "Historique des contributions",

    recent:
      "Dernières contributions confirmées",

    allHistoryNotice:
      "Cette liste affiche les contributions récentes disponibles. Le rapport PDF présente l'historique prévu par l'API d'export.",

    contribution:
      "Contribution",

    date: "Date",
    amount: "Montant",
    status: "Statut",

    confirmed: "Confirmé",
    pending: "En attente",
    active: "Active",
    completed: "Terminée",
    draft: "Brouillon",
    review: "En validation",
    cancelled: "Annulée",
    closed: "Clôturée",

    emptyContributions:
      "Aucune contribution confirmée pour cette cagnotte.",

    missingImage:
      "Image indisponible",

    updated:
      "Dernière actualisation",

    page: "Page",
    of: "sur",

    unavailable: "Non disponible",

    

    
  },

  en: {
    pageTitle: "Fundraiser details",

    subtitle:
      "Track your fundraiser and contributions.",

    back: "My fundraisers",
    edit: "Edit",
    refresh: "Refresh",
    download: "Download PDF",

    loading:
      "Loading fundraiser...",

    loadingError:
      "Unable to load this fundraiser.",

    invalidId:
      "Invalid fundraiser identifier.",

    retry: "Try again",

    information:
      "Fundraiser information",

    description: "Description",

    country: "Country",
    city: "City",
    launchDate: "Creation date",

    goal: "Goal",
    collected: "Amount collected",
    remaining: "Remaining amount",
    participants: "Confirmed contributions",

    progress: "Fundraising progress",
    progressLabel: "Goal achieved",

    contributions:
      "Contribution history",

    recent:
      "Latest confirmed contributions",

    allHistoryNotice:
      "This list displays the recent contributions available. The PDF report contains the history supported by the export API.",

    contribution:
      "Contribution",

    date: "Date",
    amount: "Amount",
    status: "Status",

    confirmed: "Confirmed",
    pending: "Pending",
    active: "Active",
    completed: "Completed",
    draft: "Draft",
    review: "Pending review",
    cancelled: "Cancelled",
    closed: "Closed",

    emptyContributions:
      "No confirmed contributions for this fundraiser.",

    missingImage:
      "Image unavailable",

    updated:
      "Last refreshed",

    page: "Page",
    of: "of",

    unavailable: "Unavailable",

    

    
  },
} as const;

/* ============================================
   CLASSES COMMUNES
============================================ */

const SECTION_CLASS = [
  "w-full min-w-0",
  "rounded-2xl",
  "border border-[#e1e8ef]",
  "bg-white",
  "p-3 sm:p-4 lg:p-5",
  "shadow-sm",
].join(" ");

const HEADING_CLASS = [
  "text-base font-extrabold",
  "text-[#12233c]",
  "sm:text-lg",
].join(" ");

/* ============================================
   UTILITAIRES JSON
============================================ */

function asRecord(
  value: unknown
): ApiRecord {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  ) {
    return value as ApiRecord;
  }

  return {};
}

function asString(
  value: unknown,
  fallback = ""
): string {
  return typeof value === "string"
    ? value
    : fallback;
}

function asCount(
  value: unknown
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    return null;
  }

  return value;
}

function asAmount(
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

function asCurrency(
  value: unknown
): Currency { return isSupportedCurrency(value) ? value : "XOF"; }

function asDate(
  value: unknown
): string | null {
  if (
    typeof value !== "string" ||
    Number.isNaN(
      Date.parse(value)
    )
  ) {
    return null;
  }

  return value;
}

function asImageUrl(
  value: unknown
): string | null {
  if (
    typeof value !== "string" ||
    !value
  ) {
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

function asProgress(
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

/* ============================================
   ADAPTER LA RÉPONSE DE L'API

   Aucun montant absent ne devient
   artificiellement zéro.

   Le zéro est utilisé uniquement
   lorsque l'API retourne réellement 0.
============================================ */

function normalizeCampaign(
  value: unknown
): CampaignDetails {
  const source = asRecord(value);

  const images: CampaignImage[] =
    Array.isArray(source.images)
      ? source.images
          .map((item, index) => {
            const image = asRecord(item);

            return {
              id: asString(
                image.id,
                String(index)
              ),

              url: asImageUrl(
                image.url
              ),

              position:
                asCount(image.position) ??
                index,

              isPrimary:
                image.isPrimary === true,
            };
          })
          .sort(
            (a, b) =>
              a.position - b.position
          )
      : [];

  const contributions: Contribution[] =
    Array.isArray(source.contributions)
      ? source.contributions
          .map((item, index) => {
            const contribution =
              asRecord(item);

            return {
              id: asString(
                contribution.id,
                String(index)
              ),

              amount:
                asAmount(
                  contribution.amount
                ) ?? "",

              currency:
                asCurrency(
                  contribution.currency ??
                    source.currency
                ),

              status:
                asString(
                  contribution.status,
                  "CONFIRMED"
                ),

              createdAt:
                asString(
                  contribution.createdAt
                ),
            };
          })
      : [];

  return {
    id:
      asString(source.id),

    title:
      asString(source.title),

    description:
      asString(source.description),

    status:
      asString(source.status),

    countryCode:
      asString(
        source.countryCode ??
          source.country
      ),

    city:
      asString(source.city),

    currency:
      asCurrency(source.currency),

    goalAmount:
      asAmount(
        source.goalAmount
      ) ?? "",

    collectedAmount:
      asAmount(
        source.collectedAmount
      ) ?? "",

    remainingAmount:
      asAmount(
        source.remainingAmount
      ) ?? "",

    progress:
      asProgress(source.progress),

    contributionCount:
      asCount(
        source.contributionCount
      ),

    totalDonationRecords:
      asCount(
        source.totalDonationRecords
      ),

    createdAt:
      asDate(source.createdAt),

    updatedAt:
      asDate(source.updatedAt),

    images,
    contributions,
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
    locale === "fr"
      ? "fr-FR"
      : "en-US"
  ).format(value);
}

function formatAmount(
  amount: string,
  currency: Currency,
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
  value: string | null,
  locale: Locale,
  includeTime = false
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    locale === "fr"
      ? "fr-FR"
      : "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",

      ...(includeTime
        ? {
            hour: "2-digit",
            minute: "2-digit",
          }
        : {}),
    }
  ).format(date);
}

function formatPercentage(
  value: number | null,
  locale: Locale
): string {
  if (value === null) {
    return "—";
  }

  return (
    new Intl.NumberFormat(
      locale === "fr"
        ? "fr-FR"
        : "en-US",
      {
        maximumFractionDigits: 2,
      }
    ).format(value) + " %"
  );
}

function getStatus(
  value: string,
  locale: Locale
): {
  label: string;
  className: string;
} {
  const t = TEXT[locale];

  switch (
    value.toUpperCase()
  ) {
    case "ACTIVE":
    case "PUBLISHED":
    case "ON_SALE":
      return {
        label: t.active,
        className:
          "bg-green-100 text-green-800",
      };

    case "CLOSED":
      return {
        label: t.closed,
        className:
          "bg-blue-100 text-blue-800",
      };

    case "COMPLETED":
      return {
        label: t.completed,
        className:
          "bg-blue-100 text-blue-800",
      };

    case "PENDING_REVIEW":
      return {
        label: t.review,
        className:
          "bg-amber-100 text-amber-800",
      };

    case "DRAFT":
      return {
        label: t.draft,
        className:
          "bg-slate-100 text-slate-700",
      };

    case "ARCHIVED":
    case "CANCELLED":
      return {
        label: t.cancelled,
        className:
          "bg-red-100 text-red-700",
      };

    case "CONFIRMED":
      return {
        label: t.confirmed,
        className:
          "bg-green-100 text-green-800",
      };

    default:
      return {
        label: value || "—",
        className:
          "bg-slate-100 text-slate-700",
      };
  }
}

/* ============================================
   CARTE STATISTIQUE
============================================ */

function StatisticCard({
  icon: Icon,
  label,
  value,
  iconClass,
  backgroundClass,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  iconClass: string;
  backgroundClass: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-[#e1e8ef] bg-white p-3 shadow-sm sm:p-4 lg:p-5">
      <div
        className={`flex size-11 shrink-0 items-center justify-center rounded-xl sm:size-12 ${backgroundClass}`}
      >
        <Icon
          size={24}
          strokeWidth={2.2}
          className={iconClass}
          aria-hidden="true"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs leading-snug font-semibold text-[#56647a] sm:text-sm">
          {label}
        </p>

        <p className="mt-2 wrap-anywhere text-lg leading-tight font-extrabold text-[#10213c] sm:text-xl xl:text-2xl">
          {value}
        </p>
      </div>
    </div>
  );
}

/* ============================================
   PAGE PRINCIPALE
============================================ */

export default function CampaignDetailsPage() {
  const params = useParams<{
    id: string;
  }>();

  const campaignId =
    typeof params.id === "string"
      ? params.id
      : "";

  /* ==========================================
     LANGUE
  ========================================== */

  const [locale, setLocale] =
    useState<Locale>(
      defaultLocale
    );

  const t = TEXT[locale];

  /* ==========================================
     ÉTATS
  ========================================== */

  const [
    campaign,
    setCampaign,
  ] = useState<CampaignDetails | null>(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    ,
    setLastUpdated,
  ] = useState<Date | null>(
    null
  );

  const [
    activeImage,
    setActiveImage,
  ] = useState(0);

  const [
    contributionPage,
    setContributionPage,
  ] = useState(1);

  /* ==========================================
     RÉFÉRENCES
  ========================================== */

  const [activeRecordId, setActiveRecordId] = useState(campaignId);
  if (activeRecordId !== campaignId) {
    setActiveRecordId(campaignId);
    setCampaign(null);
    setLoading(true);
    setError("");
  }

  const requestController =
    useRef<AbortController | null>(
      null
    );

  const requestInProgress =
    useRef(false);

  /* ==========================================
     SYNCHRONISATION DE LA LANGUE
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
     CHARGER LA CAGNOTTE
  ========================================== */

  const loadCampaignRequest =
    useCallback(
      async (
        _background = false
      ) => {
      void _background;
        if (
          requestInProgress.current
        ) {
          return;
        }

        requestInProgress.current = true;

        requestController.current?.abort();

        const controller =
          new AbortController();

        requestController.current =
          controller;



        
          return fetch(
              `${ROUTES.api}/${encodeURIComponent(
                campaignId
              )}`,
              {
                method: "GET",

                credentials:
                  "same-origin",

                cache: "no-store",

                signal:
                  controller.signal,
              }
            ).then(async (response) => {

          const result:
            unknown =
              await response.json();

          const data =
            asRecord(result);

          if (
            !response.ok ||
            data.success !== true ||
            !data.campaign
          ) {
            throw new Error(
              asString(
                data.message,
                TEXT.fr.loadingError
              )
            );
          }

          const normalized =
            normalizeCampaign(
              data.campaign
            );

          if (
            !normalized.id ||
            normalized.id !== campaignId
          ) {
            throw new Error(
              TEXT.fr.loadingError
            );
          }

          if (
            controller.signal.aborted
          ) {
            return;
          }

          setCampaign(
            normalized
          );

          setLastUpdated(
            new Date()
          );

          setError("");
        
}).catch((caughtError) => {
          if (
            controller.signal.aborted
          ) {
            return;
          }

          setError(
            caughtError instanceof Error
              ? caughtError.message
              : TEXT.fr.loadingError
          );
        }).finally(() => {
          if (
            requestController.current ===
            controller
          ) {
            requestInProgress.current =
              false;

            setLoading(false);
            setRefreshing(false);
          }
        });
      },
      [campaignId]
    );
const loadCampaign = useCallback((background = false) => {
if (background) setRefreshing(true); else setLoading(true);
return loadCampaignRequest(background);
}, [loadCampaignRequest]);


  /* ==========================================
     PREMIER CHARGEMENT
  ========================================== */

  useEffect(() => {
    requestController.current?.abort();

    requestInProgress.current =
      false;



    void loadCampaignRequest();

    return () => {
      requestController.current?.abort();
      requestInProgress.current = false;
    };
  }, [loadCampaignRequest]);

  /* ==========================================
     ACTUALISATION AUTOMATIQUE

     Seulement lorsque l'onglet
     navigateur est visible.
  ========================================== */

  useEffect(() => {
    if (!campaignId) {
      return;
    }

    const interval =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
            "visible"
          ) {
            void loadCampaign(
              true
            );
          }
        },
        REFRESH_INTERVAL
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    campaignId,
    loadCampaign,
  ]);

  /* ==========================================
     IMAGES DISPONIBLES
  ========================================== */

  const images = useMemo(() => {
    return (
      campaign?.images.filter(
        (image) =>
          image.url !== null
      ) ?? []
    );
  }, [campaign]);

  const currentImageIndex =
    images.length === 0
      ? 0
      : Math.min(
          activeImage,
          images.length - 1
        );

  const selectedImage =
    images[currentImageIndex] ??
    null;

  function previousImage() {
    if (
      images.length <= 1
    ) {
      return;
    }

    setActiveImage(
      (current) =>
        (
          current -
          1 +
          images.length
        ) % images.length
    );
  }

  function nextImage() {
    if (
      images.length <= 1
    ) {
      return;
    }

    setActiveImage(
      (current) =>
        (
          current + 1
        ) % images.length
    );
  }

  /* ==========================================
     CONTRIBUTIONS RÉCENTES
  ========================================== */

  const contributions =
    campaign?.contributions ??
    [];

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        contributions.length /
          CONTRIBUTIONS_PER_PAGE
      )
    );

  const currentPage =
    Math.min(
      contributionPage,
      totalPages
    );

  const visibleContributions =
    contributions.slice(
      (
        currentPage - 1
      ) *
        CONTRIBUTIONS_PER_PAGE,
      currentPage *
        CONTRIBUTIONS_PER_PAGE
    );

  /* ==========================================
     PROGRESSION
  ========================================== */

  const progress =
    campaign?.progress ??
    null;

  const visualProgress =
    progress === null
      ? 0
      : Math.min(
          100,
          Math.max(
            0,
            progress
          )
        );

  /* ==========================================
     ÉCRAN DE CHARGEMENT
  ========================================== */

  if (
    loading &&
    !campaign
  ) {
    return (
      <main className="flex min-h-full w-full items-center justify-center bg-[#f6f9fb] px-4">
        <div
          role="status"
          className="flex flex-col items-center gap-3 text-center"
        >
          <LoaderCircle
            size={37}
            className="animate-spin text-green-700"
            aria-hidden="true"
          />

          <p className="text-sm font-semibold text-[#536079]">
            {t.loading}
          </p>
        </div>
      </main>
    );
  }

  /* ==========================================
     ERREUR INITIALE
  ========================================== */

  if (!campaign) {
    return (
      <main className="flex min-h-full w-full flex-col items-center justify-center gap-4 bg-[#f6f9fb] p-4 text-center">
        <FileText
          size={43}
          className="text-red-500"
          aria-hidden="true"
        />

        <p
          role="alert"
          className="max-w-lg text-sm font-semibold text-red-700"
        >
          {error ||
            t.loadingError}
        </p>

        <button
          type="button"
          onClick={() => {
            void loadCampaign();
          }}
          className="min-h-11 rounded-xl bg-green-700 px-5 py-3 text-sm font-extrabold text-white hover:bg-green-800"
        >
          {t.retry}
        </button>

        <Link
          href={
            ROUTES.campaigns
          }
          className="text-sm font-bold text-green-800 underline"
        >
          {t.back}
        </Link>
      </main>
    );
  }

  const campaignStatus =
    getStatus(
      campaign.status,
      locale
    );

  /* ==========================================
     RENDU PRINCIPAL PC / MOBILE
  ========================================== */

  return (
    <main className="flex min-h-full w-full min-w-0 flex-col overflow-x-hidden bg-[#f6f9fb] pb-5 text-[#101828]">
      {/* ======================================
          EN-TÊTE DE PAGE

          Pas de menu supplémentaire.
          Largeur complète.
      ====================================== */}

      <header className="relative w-full overflow-hidden border-b border-[#e1e8ef] bg-white">
        <div className="absolute inset-x-0 bottom-0 h-12 bg-linear-to-r from-[#e0ffce] via-[#f6ffe7] to-[#fff0c7] opacity-75" />

        <div className="relative flex w-full flex-col gap-4 px-3 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-6 lg:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={
                ROUTES.campaigns
              }
              aria-label={
                t.back
              }
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-800 transition-colors hover:bg-green-100"
            >
              <ArrowLeft
                size={22}
                aria-hidden="true"
              />
            </Link>

            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#e4ffd9] text-[#07852b]">
              <HeartHandshake
                size={28}
                strokeWidth={2.2}
                aria-hidden="true"
              />
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-xl leading-tight font-extrabold text-[#10213b] sm:text-2xl lg:text-[30px]">
                {t.pageTitle}
              </h1>

              <p className="mt-1 text-xs leading-relaxed text-[#536079] sm:text-sm">
                {t.subtitle}
              </p>
            </div>
          </div>

          {/* ACTIONS */}

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <button
              type="button"
              onClick={() => {
                void loadCampaign(true);
              }}
              disabled={refreshing}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d9e2eb] bg-white px-3 text-xs font-extrabold text-[#23334a] transition-colors hover:bg-gray-50 disabled:opacity-60 sm:text-sm"
            >
              <RefreshCw
                size={18}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
                aria-hidden="true"
              />

              {t.refresh}
            </button>

            <Link
              href={`${ROUTES.publishCampaign}?edit=${encodeURIComponent(
                campaign.id
              )}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 text-xs font-extrabold text-green-800 transition-colors hover:bg-green-100 sm:text-sm"
            >
              <Pencil
                size={18}
                aria-hidden="true"
              />

              {t.edit}
            </Link>

            <a
              href={`${ROUTES.api}/${encodeURIComponent(
                campaign.id
              )}/report?locale=${locale}`}
              className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-linear-to-b from-[#2bd200] to-[#087a21] px-4 text-xs font-extrabold text-white shadow-sm transition-all hover:brightness-110 sm:text-sm"
            >
              <Download
                size={19}
                aria-hidden="true"
              />

              {t.download}
            </a>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="relative h-1 w-full bg-linear-to-r from-[#008b35] via-[#7edd00] to-[#f8c321]"
        />
      </header>

      {/* ======================================
          CONTENU PRINCIPAL

          Pas de max-w.
          Utilisation totale de l'espace
          disponible dans le dashboard.
      ====================================== */}

      <div className="flex w-full min-w-0 flex-1 flex-col gap-3 p-3 sm:p-4 lg:gap-4 lg:p-5">
        {/* ERREUR LORS D'UNE ACTUALISATION */}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          >
            {error}
          </div>
        )}

        {/* ====================================
            PRÉSENTATION DE LA CAGNOTTE
        ==================================== */}

        <section className={SECTION_CLASS}>
          <div className="grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,38%)_minmax(0,1fr)] lg:gap-6">
            {/* GALERIE */}

            <div className="min-w-0">
              <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl bg-[#edf2f5] sm:aspect-16/10 lg:aspect-4/3">
                {selectedImage?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      selectedImage.url
                    }
                    alt={
                      campaign.title
                    }
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center text-[#8090a0]">
                    <ImageOff
                      size={36}
                      aria-hidden="true"
                    />

                    <span className="text-xs font-semibold">
                      {t.missingImage}
                    </span>
                  </div>
                )}

                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={
                        previousImage
                      }
                      aria-label="Previous image"
                      className="absolute top-1/2 left-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[#12233c] shadow-sm hover:bg-white"
                    >
                      <ChevronLeft
                        size={21}
                        aria-hidden="true"
                      />
                    </button>

                    <button
                      type="button"
                      onClick={
                        nextImage
                      }
                      aria-label="Next image"
                      className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[#12233c] shadow-sm hover:bg-white"
                    >
                      <ChevronRight
                        size={21}
                        aria-hidden="true"
                      />
                    </button>

                    <span className="absolute right-3 bottom-3 rounded-full bg-[#10243a]/85 px-3 py-1 text-xs font-bold text-white">
                      {currentImageIndex + 1} / {images.length}
                    </span>
                  </>
                )}
              </div>

              {images.length > 1 && (
                <div className="mt-2 flex w-full gap-2 overflow-x-auto pb-1">
                  {images.map(
                    (image, index) => (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() =>
                          setActiveImage(
                            index
                          )
                        }
                        aria-label={`Image ${index + 1}`}
                        aria-pressed={
                          index ===
                          currentImageIndex
                        }
                        className={`size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors sm:size-19 ${
                          index ===
                          currentImageIndex
                            ? "border-green-600"
                            : "border-transparent"
                        }`}
                      >
                        {image.url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={
                              image.url
                            }
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            {/* INFORMATIONS */}

            <div className="flex min-w-0 flex-col">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="min-w-0 flex-1 text-lg leading-snug font-extrabold wrap-anywhere text-[#10213b] sm:text-xl lg:text-2xl">
                  {campaign.title}
                </h2>

                <span
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold ${campaignStatus.className}`}
                >
                  {campaignStatus.label}
                </span>
              </div>

              <h3 className="mt-5 flex items-center gap-2 text-sm font-extrabold text-[#12233c]">
                <FileText
                  size={19}
                  className="text-green-700"
                  aria-hidden="true"
                />

                {t.description}
              </h3>

              <p className="mt-2 whitespace-pre-wrap wrap-anywhere text-sm leading-relaxed text-[#536079]">
                {campaign.description ||
                  "—"}
              </p>

              <div className="mt-5 grid grid-cols-1 gap-3 border-t border-[#e8edf1] pt-4 sm:grid-cols-2">
                <div className="flex min-w-0 items-start gap-2">
                  <MapPin
                    size={19}
                    className="mt-0.5 shrink-0 text-green-700"
                    aria-hidden="true"
                  />

                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#6a788b]">
                      {t.city} / {t.country}
                    </p>

                    <p className="mt-1 text-sm font-bold text-[#14243c]">
                      {[
                        campaign.city,
                        campaign.countryCode,
                      ]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </p>
                  </div>
                </div>

                <div className="flex min-w-0 items-start gap-2">
                  <CalendarDays
                    size={19}
                    className="mt-0.5 shrink-0 text-green-700"
                    aria-hidden="true"
                  />

                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#6a788b]">
                      {t.launchDate}
                    </p>

                    <p className="mt-1 text-sm font-bold text-[#14243c]">
                      {formatDate(
                        campaign.createdAt,
                        locale
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ====================================
            INDICATEURS FINANCIERS
        ==================================== */}

        <section className="grid w-full min-w-0 grid-cols-2 gap-3 xl:grid-cols-4">
          <StatisticCard
            icon={Target}
            label={t.goal}
            value={formatAmount(
              campaign.goalAmount,
              campaign.currency,
              locale
            )}
            iconClass="text-[#9e6500]"
            backgroundClass="bg-[#fff4d9]"
          />

          <StatisticCard
            icon={Wallet}
            label={t.collected}
            value={formatAmount(
              campaign.collectedAmount,
              campaign.currency,
              locale
            )}
            iconClass="text-green-800"
            backgroundClass="bg-[#e5f9e8]"
          />

          <StatisticCard
            icon={Coins}
            label={t.remaining}
            value={formatAmount(
              campaign.remainingAmount,
              campaign.currency,
              locale
            )}
            iconClass="text-[#0f618e]"
            backgroundClass="bg-[#e5f3ff]"
          />

          <StatisticCard
            icon={UsersRound}
            label={t.participants}
            value={formatNumber(
              campaign.contributionCount,
              locale
            )}
            iconClass="text-[#783cb5]"
            backgroundClass="bg-[#f3eafe]"
          />
        </section>

        {/* ====================================
            PROGRESSION DE LA COLLECTE
        ==================================== */}

        <section className={SECTION_CLASS}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className={`flex items-center gap-2 ${HEADING_CLASS}`}>
              <TrendingUp
                size={22}
                className="text-green-700"
                aria-hidden="true"
              />

              {t.progress}
            </h2>

            <p className="text-xl font-extrabold text-green-800 sm:text-2xl">
              {formatPercentage(
                progress,
                locale
              )}
            </p>
          </div>

          <div
            role="progressbar"
            aria-label={t.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={
              progress === null
                ? undefined
                : visualProgress
            }
            className="mt-4 h-4 w-full overflow-hidden rounded-full bg-[#e5eaf0]"
          >
            <div
              className="h-full rounded-full bg-linear-to-r from-[#06802a] via-[#35bf1a] to-[#a4e411] transition-all"
              style={{
                width: `${visualProgress}%`,
              }}
            />
          </div>

          <div className="mt-3 flex flex-wrap justify-between gap-3 text-xs font-semibold text-[#536079] sm:text-sm">
            <span>
              {t.collected} :{" "}
              <strong className="text-green-800">
                {formatAmount(
                  campaign.collectedAmount,
                  campaign.currency,
                  locale
                )}
              </strong>
            </span>

            <span>
              {t.goal} :{" "}
              <strong className="text-[#15233c]">
                {formatAmount(
                  campaign.goalAmount,
                  campaign.currency,
                  locale
                )}
              </strong>
            </span>
          </div>
        </section>

        {/* ====================================
            HISTORIQUE DES DONS
        ==================================== */}

        <section className={`${SECTION_CLASS} p-0!`}>
          <div className="flex flex-col gap-2 border-b border-[#e5ebf0] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4 lg:p-5">
            <div>
              <h2 className={`flex items-center gap-2 ${HEADING_CLASS}`}>
                <HeartHandshake
                  size={22}
                  className="text-green-700"
                  aria-hidden="true"
                />

                {t.contributions}
              </h2>

              <p className="mt-1 text-xs text-[#6b788a] sm:text-sm">
                {t.recent}
              </p>
            </div>

            <span className="self-start rounded-full bg-green-50 px-3 py-1.5 text-xs font-extrabold text-green-800">
              {formatNumber(
                campaign.contributionCount,
                locale
              )}{" "}
              {t.participants.toLowerCase()}
            </span>
          </div>

          {contributions.length > 0 ? (
            <>
              {/* TABLEAU PC */}

              <div className="hidden w-full overflow-x-auto md:block">
                <table className="w-full min-w-145 border-collapse text-left text-sm">
                  <thead className="bg-[#f4f7fa] text-xs font-extrabold text-[#536079]">
                    <tr>
                      <th className="px-4 py-3">
                        {t.contribution}
                      </th>

                      <th className="px-4 py-3">
                        {t.date}
                      </th>

                      <th className="px-4 py-3">
                        {t.amount}
                      </th>

                      <th className="px-4 py-3">
                        {t.status}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleContributions.map(
                      (contribution) => {
                        const status =
                          getStatus(
                            contribution.status,
                            locale
                          );

                        return (
                          <tr
                            key={contribution.id}
                            className="border-t border-[#edf0f4] hover:bg-[#fafdfa]"
                          >
                            <td className="px-4 py-3 font-semibold text-[#14243b]">
                              {contribution.id.slice(
                                0,
                                8
                              ).toUpperCase()}
                            </td>

                            <td className="px-4 py-3 text-[#536079]">
                              {formatDate(
                                contribution.createdAt,
                                locale,
                                true
                              )}
                            </td>

                            <td className="px-4 py-3 font-extrabold text-green-800">
                              {formatAmount(
                                contribution.amount,
                                contribution.currency,
                                locale
                              )}
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${status.className}`}
                              >
                                {status.label}
                              </span>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              {/* CARTES MOBILE */}

              <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 md:hidden">
                {visibleContributions.map(
                  (contribution) => {
                    const status =
                      getStatus(
                        contribution.status,
                        locale
                      );

                    return (
                      <div
                        key={contribution.id}
                        className="rounded-xl border border-[#e2e8ee] bg-[#fcfdfc] p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#e6f8e8] text-green-800">
                              <HeartHandshake
                                size={19}
                                aria-hidden="true"
                              />
                            </div>

                            <div className="min-w-0">
                              <p className="text-xs font-extrabold text-[#14233d]">
                                {t.contribution}
                              </p>

                              <p className="text-[11px] text-[#66758a]">
                                {contribution.id.slice(
                                  0,
                                  8
                                ).toUpperCase()}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </div>

                        <p className="mt-3 text-lg font-extrabold text-green-800">
                          {formatAmount(
                            contribution.amount,
                            contribution.currency,
                            locale
                          )}
                        </p>

                        <p className="mt-2 flex items-center gap-1.5 text-xs text-[#68778a]">
                          <Clock3
                            size={14}
                            aria-hidden="true"
                          />

                          {formatDate(
                            contribution.createdAt,
                            locale,
                            true
                          )}
                        </p>
                      </div>
                    );
                  }
                )}
              </div>

              {/* PAGINATION DES 20
                  CONTRIBUTIONS RÉCENTES */}

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 border-t border-[#e5ebf0] px-4 py-4">
                  <button
                    type="button"
                    onClick={() =>
                      setContributionPage(
                        Math.max(
                          1,
                          currentPage - 1
                        )
                      )
                    }
                    disabled={
                      currentPage <= 1
                    }
                    aria-label="Previous page"
                    className="flex size-9 items-center justify-center rounded-lg border border-[#d7e0e9] text-[#15233c] hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronLeft
                      size={19}
                      aria-hidden="true"
                    />
                  </button>

                  <span className="text-xs font-bold text-[#44516a] sm:text-sm">
                    {t.page}{" "}
                    {currentPage}{" "}
                    {t.of}{" "}
                    {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setContributionPage(
                        Math.min(
                          totalPages,
                          currentPage + 1
                        )
                      )
                    }
                    disabled={
                      currentPage >= totalPages
                    }
                    aria-label="Next page"
                    className="flex size-9 items-center justify-center rounded-lg border border-[#d7e0e9] text-[#15233c] hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronRight
                      size={19}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              )}


            </>
          ) : (
            <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
              <HeartHandshake
                size={37}
                className="text-[#9aabba]"
                aria-hidden="true"
              />

              <p className="max-w-sm text-sm text-[#68778a]">
                {t.emptyContributions}
              </p>
            </div>
          )}
        </section>

        {/* ====================================
            CONFIDENTIALITÉ / ACTUALISATION
        ==================================== */}

        
      </div>
    </main>
  );
}
