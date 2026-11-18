
"use client";
import { VerifiedBadge } from "@/components/public/PublicNavigation";
import { formatMinorMoney } from "@/i18n/config";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import Link from "next/link";
import { readPublicSearch, subscribePublicLocation } from "@/components/public/PublicNavigation";
import Image from "next/image";

import { CalendarHeart, ChevronLeft, ChevronRight, Heart, ImageOff, MapPin, RefreshCw, UserRound, UsersRound } from "lucide-react";

/* ==========================================================
   TIKEMIA — PAGE PUBLIQUE CAGNOTTES

   FICHIER :
   src/app/(public)/campaigns/page.tsx

   API :
   GET /api/public/campaigns

   OBJECTIF :
   Afficher les cagnottes publiées
   par les organisateurs.

   DONNÉES :
   - Image de la cagnotte
   - Titre
   - Description
   - Nom de l'organisateur
   - Photo de l'organisateur
   - Pays
   - Ville
   - Objectif de collecte
   - Montant réellement récolté
   - Pourcentage de progression
   - Nombre de dons confirmés
   - Lien vers la fiche cagnotte

   DESIGN :
   - Mobile : cartes horizontales
   - Tablette : grille 2 colonnes
   - PC : grille 3 à 4 colonnes
   - Pleine largeur
   - Sections compactes
   - Aucun footer sur cette page

   EXCLUSIONS :
   - Aucun événement
   - Aucune catégorie
   - Aucun filtre
   - Aucune recherche
   - Aucune géolocalisation IP
   - Aucune donnée fictive
   - Aucun nouveau composant externe
   - Aucun nouveau fichier CSS

   TEMPS RÉEL :
   Actualisation par requêtes HTTP
   toutes les 15 secondes lorsque
   la page est visible.

   Le montant affiché provient
   de l'API et des dons CONFIRMED.

   LANGUES :
   Français / Anglais
========================================================== */

/* ==========================================================
   CONFIGURATION
========================================================== */

const CAMPAIGNS_API = "/api/public/campaigns";

const PAGE_SIZE = 12;

const REFRESH_INTERVAL_MS = 15_000;

type Locale = "fr" | "en";

/* ==========================================================
   TYPES API
========================================================== */

type Money = {
  amountMinor: string;
  currency: string;
};

type PublicOrganizer = {
  blueBadgeEnabled?: boolean;
  id: string;
  name: string;
  photoUrl: string | null;
  photoStorageKey: string | null;
};

type PublicCampaign = {
  id: string;
  slug: string;
  title: string;
  description: string;

  imageUrl: string | null;
  imageStorageKey: string | null;

  organizer: PublicOrganizer;

  location: {
    country: string | null;
    city: string | null;
  };

  funding: {
    goal: Money;
    collected: Money;
    percentage: number;
    donationCount: number;
  };

  currency: string;

  publishedAt: string | null;
  updatedAt: string;

  href: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

type CampaignsResponse = {
  success: boolean;

  generatedAt?: string;

  data?: {
    campaigns?: PublicCampaign[];
  };

  pagination?: Pagination;
};

/* ==========================================================
   TRADUCTIONS
========================================================== */

const TRANSLATIONS = {
  fr: {
    title: "Cagnottes",
    subtitle:
      "Découvrez les cagnottes publiées sur TIKEMIA et soutenez les causes qui vous tiennent à cœur.",

    sectionTitle: "Toutes les cagnottes",

    campaignCount: "cagnottes publiées",
    singleCampaign: "cagnotte publiée",

    organizer: "Organisée par",

    collected: "Montant récolté",
    goal: "Objectif",
    percentage: "de l'objectif atteint",

    donors: "dons confirmés",
    singleDonor: "don confirmé",

    donate: "Faire un don",
    viewDetails: "Voir la cagnotte",

    loading: "Chargement des cagnottes...",

    emptyTitle: "Aucune cagnotte disponible",
    emptyDescription:
      "Les cagnottes publiées par les organisateurs apparaîtront ici.",

    errorTitle:
      "Impossible de charger les cagnottes.",
    errorDescription:
      "Vérifiez votre connexion Internet et réessayez.",

    retry: "Réessayer",

    previous: "Précédent",
    next: "Suivant",
    page: "Page",
    of: "sur",

    imageUnavailable: "Image indisponible",

    locationUnavailable: "Localisation non précisée",

    refreshLabel: "Actualisation des données",
  },

  en: {
    title: "Fundraisers",
    subtitle:
      "Discover fundraisers published on TIKEMIA and support causes that matter to you.",

    sectionTitle: "All fundraisers",

    campaignCount: "published fundraisers",
    singleCampaign: "published fundraiser",

    organizer: "Organized by",

    collected: "Amount raised",
    goal: "Goal",
    percentage: "of goal reached",

    donors: "confirmed donations",
    singleDonor: "confirmed donation",

    donate: "Donate",
    viewDetails: "View fundraiser",

    loading: "Loading fundraisers...",

    emptyTitle: "No fundraisers available",
    emptyDescription:
      "Fundraisers published by organizers will appear here.",

    errorTitle:
      "Unable to load fundraisers.",
    errorDescription:
      "Check your Internet connection and try again.",

    retry: "Try again",

    previous: "Previous",
    next: "Next",
    page: "Page",
    of: "of",

    imageUnavailable: "Image unavailable",

    locationUnavailable: "Location not specified",

    refreshLabel: "Refreshing data",
  },
} as const;

/* ==========================================================
   UTILITAIRES
========================================================== */

/**
 * Accepte les images locales et les URL
 * HTTPS publiques.
 *
 * Les storageKey privés non résolus ne
 * sont pas convertis en fausses URL.
 */
function safeImageUrl(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null;
  }

  const source = value.trim();

  if (!source) {
    return null;
  }

  if (
    source.startsWith("/") &&
    !source.startsWith("//") &&
    !source.includes("\\")
  ) {
    return source;
  }

  try {
    const url = new URL(source);

    if (url.protocol === "https:") {
      return url.toString();
    }

    if (
      url.protocol === "http:" &&
      (
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1"
      )
    ) {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Empêche les liens externes inattendus.
 *
 * Les liens publics vers les cagnottes
 * utilisent exclusivement /campaigns.
 */
function campaignHref(
  campaign: PublicCampaign
): string {
  const fallback =
    `/campaigns/${encodeURIComponent(campaign.slug)}`;

  const href = campaign.href;

  if (
    typeof href === "string" &&
    /^\/campaigns\/[^/?#]+(?:[?#].*)?$/.test(href) &&
    !href.includes("\\")
  ) {
    return href;
  }

  return fallback;
}

/**
 * Montants TIKEMIA :
 *
 * XOF : unités entières
 * EUR : centimes
 * USD : cents
 *
 * Les calculs utilisent BigInt.
 *
 * Aucun montant financier n'est
 * calculé avec des nombres flottants.
 */
function formatMoney(
  value: Money | null | undefined,
  locale: Locale
): string { if (!value || !/^-?\d+$/.test(value.amountMinor)) return "?"; return formatMinorMoney(value.amountMinor, value.currency || "XOF", locale); }

/**
 * Affiche un nom de pays lisible
 * lorsqu'un code ISO est enregistré.
 *
 * Exemple : BJ -> Bénin.
 */
function displayCountry(
  value: string | null,
  locale: Locale
): string {
  if (!value) {
    return "";
  }

  const clean = value.trim();

  if (!/^[A-Za-z]{2}$/.test(clean)) {
    return clean;
  }

  try {
    return (
      new Intl.DisplayNames(
        [locale === "fr" ? "fr" : "en"],
        { type: "region" }
      ).of(clean.toUpperCase()) ?? clean
    );
  } catch {
    return clean;
  }
}

/**
 * Progression visuelle limitée à 100 %.
 *
 * Les montants réels sont affichés
 * séparément et ne sont pas plafonnés.
 */
function progressValue(
  value: number
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(value, 100)
  );
}

/**
 * Lecture du numéro de page présent
 * dans l'URL du navigateur.
 */
function getPageFromUrl(search?: string): number {
  if (typeof window === "undefined") {
    return 1;
  }

  const params =
    new URLSearchParams(
      search ?? window.location.search
    );

  const raw =
    params.get("page");

  if (
    !raw ||
    !/^\d+$/.test(raw)
  ) {
    return 1;
  }

  const page =
    Number(raw);

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 10000
  ) {
    return 1;
  }

  return page;
}

/* ==========================================================
   IMAGE CAGNOTTE

   Évite les images visuellement cassées.
========================================================== */

function CampaignImage({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className: string;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);

  const validSrc =
    safeImageUrl(src);

  

  if (!validSrc || (failedSource === validSrc)) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center bg-[#edf3ee] text-[#93aa9b] ${className}`}
      >
        <ImageOff
          size={29}
          strokeWidth={1.6}
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <Image fill sizes="(min-width: 1024px) 144px, 128px" unoptimized
      src={validSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSource(validSrc)}
      className={`block object-cover ${className}`}
    />
  );
}

/* ==========================================================
   PHOTO ORGANISATEUR

   Réutilise la photo transmise
   par l'API.

   Si elle n'est pas disponible,
   une icône neutre est affichée.

   Aucun visage fictif.
========================================================== */

function OrganizerAvatar({
  organizer,
  compact = false,
}: {
  organizer: PublicOrganizer;
  compact?: boolean;
}) {
  const src =
    safeImageUrl(organizer.photoUrl);

  const [failedSource, setFailedSource] = useState<string | null>(null);

  

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#d7e7da] bg-[#e9f6ec] text-[#087b2e] ${
        compact
          ? "size-7"
          : "size-9 sm:size-10"
      }`}
    >
      {src && !(failedSource === src) ? (
        <Image width={960} height={640} unoptimized
          src={src}
          alt={organizer.name}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSource(src)}
          className="h-full w-full object-cover"
        />
      ) : (
        <UserRound
          size={compact ? 16 : 21}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/* ==========================================================
   PROGRESSION D'UNE CAGNOTTE

   Données réelles :
   - Montant récolté
   - Objectif
   - Pourcentage
   - Nombre de dons confirmés
========================================================== */

function FundingInformation({
  campaign,
  locale,
  compact = false,
}: {
  campaign: PublicCampaign;
  locale: Locale;
  compact?: boolean;
}) {
  const t = TRANSLATIONS[locale];

  const percentage =
    Number.isFinite(
      campaign.funding.percentage
    )
      ? Math.max(
          0,
          campaign.funding.percentage
        )
      : 0;

  const progress =
    progressValue(percentage);

  const formattedPercentage =
    new Intl.NumberFormat(
      locale === "fr" ? "fr-FR" : "en-US",
      {
        maximumFractionDigits: 1,
      }
    ).format(percentage);

  return (
    <div className="w-full min-w-0">
      {/* MONTANT RÉCOLTÉ */}

      <div className="flex min-w-0 flex-wrap items-end justify-between gap-1">
        <div className="min-w-0">
          <p
            className={`font-medium text-[#728396] ${
              compact
                ? "text-[9px]"
                : "text-[11px]"
            }`}
          >
            {t.collected}
          </p>

          <p
            className={`wrap-break-word font-black leading-tight text-[#087e2d] ${
              compact
                ? "text-[12px]"
                : "text-lg"
            }`}
          >
            {formatMoney(
              campaign.funding.collected,
              locale
            )}
          </p>
        </div>

        <span
          className={`shrink-0 font-extrabold text-[#087e2d] ${
            compact
              ? "text-[10px]"
              : "text-[12px]"
          }`}
        >
          {formattedPercentage}%
        </span>
      </div>

      {/* BARRE DE PROGRESSION */}

      <div
        role="progressbar"
        aria-label={t.percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        className={`w-full overflow-hidden rounded-full bg-[#e2ece5] ${
          compact
            ? "mt-1.5 h-1.5"
            : "mt-2.5 h-2.5"
        }`}
      >
        <div
          className="h-full rounded-full bg-[#079536] transition-[width] duration-500"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>

      {/* OBJECTIF */}

      <div
        className={`mt-1.5 flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[#64778a] ${
          compact
            ? "text-[9px]"
            : "text-[11px]"
        }`}
      >
        <span className="min-w-0 wrap-break-word">
          {t.goal} :{" "}
          <strong className="font-extrabold text-[#334b3c]">
            {formatMoney(
              campaign.funding.goal,
              locale
            )}
          </strong>
        </span>

        <span className="inline-flex shrink-0 items-center gap-1">
          <UsersRound
            size={compact ? 11 : 13}
          />
          {campaign.funding.donationCount}{" "}
          {campaign.funding.donationCount === 1
            ? t.singleDonor
            : t.donors}
        </span>
      </div>
    </div>
  );
}

/* ==========================================================
   CARTE CAGNOTTE

   MOBILE :
   - Image à gauche
   - Informations à droite
   - Montant et progression
   - Bouton Faire un don

   PC :
   - Image en haut
   - Titre
   - Organisateur
   - Localisation
   - Description
   - Montants
   - Progression
   - Bouton Faire un don

   AUCUN ÉVÉNEMENT DANS CETTE CARTE.
========================================================== */

function CampaignCard({
  campaign,
  locale,
}: {
  campaign: PublicCampaign;
  locale: Locale;
}) {
  const t = TRANSLATIONS[locale];

  const href =
    campaignHref(campaign);

  const location = [
    campaign.location?.city?.trim(),
    displayCountry(
      campaign.location?.country ?? null,
      locale
    ),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <article className="group min-w-0 overflow-hidden rounded-2xl border border-[#e1e9e3] bg-white shadow-[0_2px_12px_rgba(12,46,27,0.05)] transition-shadow hover:shadow-[0_8px_25px_rgba(12,46,27,0.09)]">

      {/* ==================================================
          VERSION MOBILE :
          CARTE HORIZONTALE
      ================================================== */}

      <div className="flex min-w-0 gap-2.5 p-2">
        {/* IMAGE GAUCHE */}

        <Link
          href={href}
          aria-label={campaign.title}
          className="relative w-27 shrink-0 sm:w-32 overflow-hidden rounded-xl bg-[#edf3ee] min-[390px]:w-30"
        >
          <CampaignImage
            src={campaign.imageUrl}
            alt={campaign.title}
            className="absolute inset-0 h-full w-full"
          />
        </Link>

        {/* INFORMATIONS DROITE */}

        <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
          {/* TITRE */}

          <Link href={href}>
            <h2 className="line-clamp-2 text-xs sm:text-base font-extrabold leading-snug text-[#172b3f] min-[390px]:text-[13px]">
              {campaign.title}
            </h2>
          </Link>

          {/* LOCALISATION */}

          {location && (
            <div className="flex min-w-0 items-center gap-1">
              <MapPin
                size={12}
                className="shrink-0 text-[#087d2e]"
              />

              <span className="truncate text-[11px] sm:text-sm text-[#627689]">
                {location}
              </span>
            </div>
          )}

          {/* PHOTO + NOM ORGANISATEUR */}

          <div className="flex min-w-0 items-center gap-1.5">
            <OrganizerAvatar
              organizer={campaign.organizer}
              compact
            />

            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs leading-tight text-[#8794a0]">
                {t.organizer}
              </p>

              <p className=" text-[11px] sm:text-sm font-extrabold leading-tight text-[#2b4739] flex min-w-0 items-center gap-1">
                <span className="min-w-0 truncate">{campaign.organizer.name}</span>{campaign.organizer.blueBadgeEnabled && <VerifiedBadge />}
              </p>
            </div>
          </div>

          {/* COLLECTE */}

          <FundingInformation
            campaign={campaign}
            locale={locale}
            compact
          />

          {/* BOUTON DON */}

          <Link
            href={href}
            className="mt-auto inline-flex min-h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-[#087d2d] px-2 py-2 text-[11px] sm:text-sm font-extrabold text-white transition-colors hover:bg-[#056b25]"
          >
            <Heart
              size={14}
              aria-hidden="true"
            />

            {t.donate}
          </Link>
        </div>
      </div>

      {/* ==================================================
          VERSION TABLETTE / PC :
          CARTE VERTICALE
      ================================================== */}

      
    </article>
  );
}

/* ==========================================================
   CHARGEMENT VISUEL

   Ce sont des placeholders de chargement,
   pas de fausses cagnottes.
========================================================== */

function LoadingCampaigns() {
  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-2.5 md:grid-cols-2 sm:gap-4 xl:grid-cols-3">

      {Array.from({
        length: 8,
      }).map((_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="animate-pulse overflow-hidden rounded-xl border border-[#e6ede7] bg-white"
        >
          {/* MOBILE */}

          <div className="flex gap-2.5 p-2 sm:hidden">
            <div className="h-46.25 w-27 shrink-0 rounded-lg bg-[#e9f0ea]" />

            <div className="flex flex-1 flex-col gap-3 py-1">
              <div className="h-4 w-4/5 rounded bg-[#e9f0ea]" />

              <div className="h-3 w-2/3 rounded bg-[#e9f0ea]" />

              <div className="flex items-center gap-2">
                <div className="size-7 rounded-full bg-[#e9f0ea]" />

                <div className="h-3 w-1/2 rounded bg-[#e9f0ea]" />
              </div>

              <div className="h-4 w-2/3 rounded bg-[#e9f0ea]" />

              <div className="h-2 w-full rounded bg-[#e9f0ea]" />

              <div className="mt-auto h-8 w-full rounded bg-[#e9f0ea]" />
            </div>
          </div>

          {/* PC */}

          <div className="hidden sm:block">
            <div className="aspect-16/10 bg-[#e9f0ea]" />

            <div className="space-y-3 p-4">
              <div className="h-4 w-4/5 rounded bg-[#e9f0ea]" />

              <div className="flex items-center gap-2">
                <div className="size-9 rounded-full bg-[#e9f0ea]" />

                <div className="h-3 w-1/2 rounded bg-[#e9f0ea]" />
              </div>

              <div className="h-3 w-3/4 rounded bg-[#e9f0ea]" />

              <div className="h-2 w-full rounded bg-[#e9f0ea]" />

              <div className="h-10 w-full rounded bg-[#e9f0ea]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ==========================================================
   PAGE PUBLIQUE CAGNOTTES
========================================================== */

export default function CampaignsPage() {
  const search = useSyncExternalStore(subscribePublicLocation, readPublicSearch, () => null);
  if (search === null) return <div role="status" aria-label="Chargement" className="min-h-48 w-full animate-pulse bg-[#f7faf8]" />;
  return <CampaignsPageContent key={search} initialSearch={search} />;
}
function CampaignsPageContent({ initialSearch }: { initialSearch: string }) {

  /* ========================================================
     LANGUE
  ======================================================== */

  const [locale, setLocale] =
    useState<Locale>("fr");

  const t = TRANSLATIONS[locale];

  /* ========================================================
     DONNÉES
  ======================================================== */

  const [campaigns, setCampaigns] =
    useState<PublicCampaign[]>([]);

  const [pagination, setPagination] =
    useState<Pagination>({
      page: 1,
      limit: PAGE_SIZE,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrevious: false,
    });

  /* ========================================================
     PAGINATION
  ======================================================== */

  const [page, setPage] = useState(() => getPageFromUrl(initialSearch));

  const initialized = true;

  /* ========================================================
     ÉTATS
  ======================================================== */

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(false);

  

  const [retryCount, setRetryCount] =
    useState(0);

  const pageRef = useRef(page);

  useEffect(() => { pageRef.current = page; }, [page]);

  const campaignsSectionRef =
    useRef<HTMLElement | null>(null);
  /* ========================================================
     LANGUE FR / EN

     Réutilisation de la préférence
     tikemia_locale déjà utilisée
     par la navigation publique.
  ======================================================== */

  useEffect(() => {
    function syncLocale() {
      try {
        const saved =
          localStorage.getItem(
            "tikemia_locale"
          );

        if (
          saved === "fr" ||
          saved === "en"
        ) {
          setLocale(saved);
          return;
        }
      } catch {
        // Français par défaut.
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

  /* ========================================================
     RESTAURATION DE LA PAGE

     Exemple :
     /campaigns?page=2

     Aucun autre filtre n'existe.
  ======================================================== */

  

  /* ========================================================
     REQUÊTE API

     Cette fonction lit uniquement
     l'API publique des cagnottes.

     Aucun accès aux événements,
     aux catégories ou à l'IP.
  ======================================================== */

  const fetchCampaigns = useCallback(
    async (
      requestedPage: number,
      signal: AbortSignal
    ): Promise<CampaignsResponse> => {
      const params =
        new URLSearchParams({
          page: String(requestedPage),
          limit: String(PAGE_SIZE),
        });

      const response = await fetch(
        `${CAMPAIGNS_API}?${params.toString()}`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal,
        }
      );

      if (!response.ok) {
        throw new Error(
          "CAMPAIGNS_API_UNAVAILABLE"
        );
      }

      const result =
        (await response.json()) as CampaignsResponse;

      if (
        result.success !== true ||
        !Array.isArray(
          result.data?.campaigns
        ) ||
        !result.pagination
      ) {
        throw new Error(
          "INVALID_CAMPAIGNS_RESPONSE"
        );
      }

      return result;
    },
    []
  );

  /* ========================================================
     CHARGEMENT INITIAL ET CHANGEMENT DE PAGE

     Annule une requête lorsque
     le visiteur change de page.

     Empêche une ancienne réponse
     de remplacer une réponse récente.
  ======================================================== */

  useEffect(() => {
    if (!initialized) {
      return;
    }

    const controller =
      new AbortController();

    let active = true;

    async function load() {
      setLoading(true);
      setError(false);

      try {
        const result = await fetchCampaigns(
          page,
          controller.signal
        );

        if (
          !active ||
          controller.signal.aborted
        ) {
          return;
        }

        setCampaigns(
          result.data?.campaigns ?? []
        );

        setPagination(
          result.pagination!
        );

        

        setError(false);
      } catch {
        if (
          !active ||
          controller.signal.aborted
        ) {
          return;
        }

        setError(true);
      } finally {
        if (
          active &&
          !controller.signal.aborted
        ) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    initialized,
    page,
    retryCount,
    fetchCampaigns,
  ]);

  /* ========================================================
     ACTUALISATION DES MONTANTS

     Toutes les 15 secondes.

     Uniquement lorsque la page
     est visible.

     Si une nouvelle requête échoue,
     les données déjà affichées
     sont conservées.

     L'API recalcule les dons confirmés
     à chaque nouvelle requête.

     Il s'agit d'un rafraîchissement
     périodique, pas d'un WebSocket.
  ======================================================== */

  useEffect(() => {
    if (!initialized) {
      return;
    }

    let active = true;

    let running = false;

    let controller:
      AbortController | null = null;

    async function refresh() {
      if (
        !active ||
        running ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      running = true;

      controller =
        new AbortController();

      try {
        const result = await fetchCampaigns(
          pageRef.current,
          controller.signal
        );

        if (
          !active ||
          controller.signal.aborted
        ) {
          return;
        }

        setCampaigns(
          result.data?.campaigns ?? []
        );

        setPagination(
          result.pagination!
        );

        

        setError(false);
      } catch {
        // Conserver l'affichage précédent.
      } finally {
        running = false;
        controller = null;
      }
    }

    const interval =
      window.setInterval(
        () => {
          void refresh();
        },
        REFRESH_INTERVAL_MS
      );

    function onVisibilityChange() {
      if (
        document.visibilityState === "visible"
      ) {
        void refresh();
      }
    }

    document.addEventListener(
      "visibilitychange",
      onVisibilityChange
    );

    return () => {
      active = false;

      window.clearInterval(interval);

      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange
      );

      controller?.abort();
    };
  }, [
    initialized,
    fetchCampaigns,
  ]);

  /* ========================================================
     CHANGEMENT DE PAGE

     Pagination côté serveur.

     L'URL reste partageable :
     /campaigns?page=2
  ======================================================== */

  function changePage(nextPage: number) {
    if (
      nextPage < 1 ||
      nextPage > pagination.totalPages ||
      nextPage === page ||
      loading
    ) {
      return;
    }

    setPage(nextPage);

    const url =
      nextPage === 1
        ? "/campaigns"
        : `/campaigns?page=${nextPage}`;

    window.history.pushState(
      { page: nextPage },
      "",
      url
    );

    campaignsSectionRef.current
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  /* ========================================================
     NUMÉROS DE PAGINATION

     Maximum 5 numéros visibles.
  ======================================================== */

  const pageNumbers = (() => {
    const total =
      pagination.totalPages;

    const current =
      pagination.page;

    if (total < 1) {
      return [];
    }

    const start =
      Math.max(
        1,
        Math.min(
          current - 2,
          total - 4
        )
      );

    const end =
      Math.min(
        total,
        start + 4
      );

    return Array.from(
      {
        length:
          end - start + 1,
      },
      (_, index) =>
        start + index
    );
  })();

  /* ========================================================
     RENDU FINAL
  ======================================================== */

  return (
    <>
      {/* ==================================================
          FOOTER MASQUÉ SUR CETTE PAGE

          PC ET MOBILE.

          Le footer est ajouté par le
          layout public existant.

          Cette règle le masque uniquement
          lorsque #tikemia-campaigns-page
          est présent.

          Le header et la navigation mobile
          restent inchangés.

          Aucun nouveau fichier CSS.
      ================================================== */}

      

      <div
        id="tikemia-campaigns-page"
        className="flex w-full min-w-0 flex-1 flex-col bg-white text-[#17283b]"
      >
        {/* ==================================================
            1. EN-TÊTE DE PAGE

            Même identité que la page
            Explorer des événements.

            Aucun moteur de recherche.
            Aucun filtre.
        ================================================== */}

        <section className="w-full border-b border-[#e8eee9] bg-white px-3 pt-5 pb-5 sm:px-5 sm:pt-7 lg:px-8 lg:pt-8 xl:px-10">
          <div className="flex w-full min-w-0 flex-col gap-2">
            {/* TITRE */}

            <h1 className="flex items-center gap-2.5 text-[27px] font-black tracking-tight text-[#084c2a] sm:text-3xl lg:text-[36px]">
              <Heart
                size={30}
                className="shrink-0 text-[#087f2e]"
                strokeWidth={2.3}
                aria-hidden="true"
              />

              {t.title}
            </h1>

            {/* LIGNE D'IDENTITÉ */}

            <div className="h-1 w-14 rounded-full bg-linear-to-r from-[#07862d] to-[#f4ca16]" />

            {/* DESCRIPTION */}

            <p className="mt-1 max-w-190 text-xs leading-relaxed text-[#6b7f8c] sm:text-sm">
              {t.subtitle}
            </p>
          </div>
        </section>

        {/* ==================================================
            2. LISTE DES CAGNOTTES

            - Données réelles
            - Pagination
            - Cartes mobile et PC
            - Montants actualisés
        ================================================== */}

        <section
          ref={campaignsSectionRef}
          className="w-full flex-1 scroll-mt-5 bg-white px-3 pt-5 pb-4 sm:px-5 lg:px-8 lg:pt-4 lg:pb-5 xl:px-10"
        >
          {/* TITRE SECTION */}

          <div className="mb-4 flex w-full min-w-0 flex-wrap items-center justify-between gap-2 border-b border-[#e8eee9] pb-3 sm:mb-5">
            <h2 className="flex items-center gap-2 text-base font-black text-[#084c2a] sm:text-xl lg:text-2xl">
              <CalendarHeart
                size={24}
                className="shrink-0 text-[#e1a900]"
                aria-hidden="true"
              />

              {t.sectionTitle}
            </h2>

            {!loading && !error && (
              <span className="text-[11px] font-semibold text-[#748596] sm:text-xs">
                {pagination.total}{" "}
                {pagination.total === 1
                  ? t.singleCampaign
                  : t.campaignCount}
              </span>
            )}
          </div>

          {/* RÉGION MISE À JOUR */}

          <div
            aria-live="polite"
            aria-busy={loading}
            className="w-full min-w-0"
          >
            {/* CHARGEMENT */}

            {loading ? (
              <LoadingCampaigns />
            ) : error ? (
              /* ERREUR */

              <div
                role="alert"
                className="flex min-h-57.5 w-full flex-col items-center justify-center gap-3 rounded-xl border border-[#e4ece6] bg-[#fbfcfb] px-5 py-8 text-center"
              >
                <RefreshCw
                  size={30}
                  className="text-[#087c2e]"
                  aria-hidden="true"
                />

                <h3 className="text-sm font-extrabold text-[#2c4253]">
                  {t.errorTitle}
                </h3>

                <p className="max-w-sm text-xs leading-relaxed text-[#748596]">
                  {t.errorDescription}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setRetryCount(
                      (current) => current + 1
                    )
                  }
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#087d2d] px-5 text-xs font-extrabold text-white transition-colors hover:bg-[#056b25]"
                >
                  <RefreshCw size={16} />

                  {t.retry}
                </button>
              </div>
            ) : campaigns.length === 0 ? (
              /* AUCUNE CAGNOTTE */

              <div className="flex min-h-57.5 w-full flex-col items-center justify-center gap-3 rounded-xl border border-[#e4ece6] bg-[#fbfcfb] px-5 py-8 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-[#e9f6ed] text-[#087d2d]">
                  <Heart
                    size={27}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </div>

                <h3 className="text-base font-extrabold text-[#304557]">
                  {t.emptyTitle}
                </h3>

                <p className="max-w-sm text-xs leading-relaxed text-[#758698]">
                  {t.emptyDescription}
                </p>
              </div>
            ) : (
              /* GRILLE DE CAGNOTTES */

              <div className="grid w-full min-w-0 grid-cols-1 gap-2.5 md:grid-cols-2 sm:gap-4 xl:grid-cols-3">
                {campaigns.map(
                  (campaign) => (
                    <CampaignCard
                      key={campaign.id}
                      campaign={campaign}
                      locale={locale}
                    />
                  )
                )}
              </div>
            )}
          </div>

          {/* ==================================================
              3. PAGINATION

              Visible uniquement lorsque
              plusieurs pages existent.
          ================================================== */}

          {!loading &&
            !error &&
            pagination.totalPages > 1 && (
              <nav
                aria-label="Pagination"
                className="mt-7 flex w-full flex-wrap items-center justify-center gap-1.5 sm:gap-2"
              >
                {/* PRÉCÉDENT */}

                <button
                  type="button"
                  onClick={() =>
                    changePage(page - 1)
                  }
                  disabled={
                    !pagination.hasPrevious
                  }
                  aria-label={t.previous}
                  className="flex size-10 items-center justify-center rounded-xl border border-[#dfe8e2] bg-white text-[#3e5669] transition-colors hover:bg-[#edf7ef] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={19} />
                </button>

                {/* NUMÉROS */}

                {pageNumbers.map(
                  (number) => (
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
                      className={`flex size-10 items-center justify-center rounded-xl text-xs font-extrabold transition-colors ${
                        number === page
                          ? "bg-[#087d2d] text-white"
                          : "border border-[#dfe8e2] bg-white text-[#425a6e] hover:bg-[#edf7ef]"
                      }`}
                    >
                      {number}
                    </button>
                  )
                )}

                {/* SUIVANT */}

                <button
                  type="button"
                  onClick={() =>
                    changePage(page + 1)
                  }
                  disabled={
                    !pagination.hasNext
                  }
                  aria-label={t.next}
                  className="flex size-10 items-center justify-center rounded-xl border border-[#dfe8e2] bg-white text-[#3e5669] transition-colors hover:bg-[#edf7ef] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={19} />
                </button>
              </nav>
            )}

          {/* ==================================================
              FIN DE LA PAGE

              Aucun footer ajouté.
              Aucun menu dupliqué.
              Aucun événement.
              Aucun filtre.

              PublicNavigation reste
              géré par le layout existant.
          ================================================== */}
        </section>
      </div>
    </>
  );
}
