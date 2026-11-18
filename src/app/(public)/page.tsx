
"use client";
import { VerifiedBadge } from "@/components/public/PublicNavigation";
import { EVENT_CATEGORY_DEFINITIONS, eventCategoryLabel } from "@/i18n/config";

import { formatMinorMoney } from "@/i18n/config";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import { PublicCategoryStrip } from "@/components/public/PublicNavigation";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { ArrowRight, CalendarDays, ChevronRight, Clock3, Heart, ImageOff, MapPin, RefreshCw, Search, ShieldCheck, Ticket, UserRound } from "lucide-react";


/* ==========================================================
   TIKEMIA — ACCUEIL PUBLIC

   FICHIER :
   src/app/(public)/page.tsx

   ARCHITECTURE :
   1. Grande bannière d'accueil
   2. Recherche et filtres
   3. Catégories existantes
   4. Événements à la une
   5. Cagnottes à la une

   HEADER ET FOOTER :
   Déjà gérés par le layout public.

   DONNÉES :
   GET /api/public/home

   IMPORTANT :
   - Aucun événement fictif
   - Aucune cagnotte fictive
   - Aucune catégorie créée en base
   - Aucun montant inventé
   - Aucune statistique inventée
   - Aucun nouveau menu
   - Aucun nouveau footer
   - Aucune nouvelle API
   - Aucun nouveau fichier CSS

   RESPONSIVE :
   - Mobile
   - Tablette
   - Ordinateur

   LANGUES :
   - Français
   - Anglais

   ACTUALISATION :
   - Chargement initial
   - Actualisation périodique
   - Actualisation après retour sur l'onglet

   Les images stockées en storageKey doivent
   être résolues par le mécanisme de médias
   déjà utilisé dans TIKEMIA.
========================================================== */

/* ==========================================================
   CONFIGURATION
========================================================== */

const HOME_API = "/api/public/home";

const HERO_IMAGE = "/images/paccueil.png";

const EVENTS_URL = "/explore";

const CAMPAIGNS_URL = "/campaigns";

const REFRESH_INTERVAL = 60_000;

const MAX_VISIBLE_CATEGORIES = EVENT_CATEGORY_DEFINITIONS.length;

type Locale = "fr" | "en";

/* ==========================================================
   TYPES API
========================================================== */

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

type CampaignItem = {
  id: string;
  slug: string;
  title: string;
  description: string;

  imageUrl: string | null;
  imageStorageKey: string | null;

  organizer: Organizer;

  location: {
    country: string | null;
    city: string | null;
  };

  funding: {
    goal: Amount;
    collected: Amount;
    percentage: number;
    donationCount: number;
  };

  currency: string;
  publishedAt: string | null;
  href: string;
};

type HomeResponse = {
  success: boolean;
  generatedAt?: string;

  data?: {
    events?: EventItem[];
    campaigns?: CampaignItem[];
  };
};

/* ==========================================================
   TRADUCTIONS

   Compatible avec la préférence linguistique
   existante tikemia_locale.
========================================================== */

const TEXT = {
  fr: {
    eyebrow: "Bienvenue sur TIKEMIA",

    heroTitle1: "Réservez vos billets.",
    heroTitle2: "Soutenez les bonnes causes.",

    

    exploreEvents: "Explorer les événements",
    donate: "Faire un don",

    benefit1: "Billets avec QR code",
    benefit2: "Achat simple et rapide",
    benefit3: "Dons accessibles à tous",

    searchTitle: "Trouvez votre prochain événement",

    searchPlaceholder:
      "Rechercher un événement...",

    cityPlaceholder: "Toutes les villes",
    datePlaceholder: "Date",
    categoryPlaceholder: "Toutes les catégories",
    searchButton: "Rechercher",

    categoriesTitle: "Explorez par catégorie",
    categoriesSubtitle:
      "Découvrez les événements selon vos envies.",
    allCategories: "Toutes les catégories",

    eventsTitle: "Événements à la une",
    eventsSubtitle:
      "Découvrez les événements disponibles sur TIKEMIA.",
    seeAllEvents: "Voir tous les événements",
    noEvents:
      "Aucun événement publié pour le moment.",

    campaignsTitle: "Cagnottes à la une",
    campaignsSubtitle:
      "Soutenez les projets et les causes qui comptent.",
    seeAllCampaigns: "Voir toutes les cagnottes",
    noCampaigns:
      "Aucune cagnotte publiée pour le moment.",

    organizer: "Organisé par",
    campaignOrganizer: "Créée par",

    locationUnavailable: "Lieu à préciser",
    dateUnavailable: "Date à préciser",
    priceUnavailable: "Tarif à consulter",

    from: "À partir de",
    free: "Gratuit",

    book: "Réserver",
    support: "Faire un don",

    collected: "Collectés",
    goal: "Objectif",
    donations: "dons",

    loading: "Chargement des publications...",
    loadingEvents: "Chargement des événements...",
    loadingCampaigns: "Chargement des cagnottes...",

    errorTitle:
      "Impossible de charger les publications.",
    errorDescription:
      "Veuillez vérifier votre connexion et réessayer.",
    retry: "Réessayer",

    imageUnavailable: "Image indisponible",
    organizerPhoto: "Photo de l'organisateur",

    updated: "Données actualisées",
  },

  en: {
    eyebrow: "Welcome to TIKEMIA",

    heroTitle1: "Book your tickets.",
    heroTitle2: "Support meaningful causes.",

    

    exploreEvents: "Explore events",
    donate: "Make a donation",

    benefit1: "QR code tickets",
    benefit2: "Simple and quick booking",
    benefit3: "Donations open to everyone",

    searchTitle: "Find your next event",

    searchPlaceholder:
      "Search for an event...",

    cityPlaceholder: "All cities",
    datePlaceholder: "Date",
    categoryPlaceholder: "All categories",
    searchButton: "Search",

    categoriesTitle: "Explore by category",
    categoriesSubtitle:
      "Discover events that match your interests.",
    allCategories: "All categories",

    eventsTitle: "Featured events",
    eventsSubtitle:
      "Discover events available on TIKEMIA.",
    seeAllEvents: "View all events",
    noEvents:
      "No published events at the moment.",

    campaignsTitle: "Featured fundraisers",
    campaignsSubtitle:
      "Support projects and causes that matter.",
    seeAllCampaigns: "View all fundraisers",
    noCampaigns:
      "No published fundraisers at the moment.",

    organizer: "Organized by",
    campaignOrganizer: "Created by",

    locationUnavailable: "Location to be confirmed",
    dateUnavailable: "Date to be confirmed",
    priceUnavailable: "View pricing",

    from: "From",
    free: "Free",

    book: "Book now",
    support: "Donate",

    collected: "Raised",
    goal: "Goal",
    donations: "donations",

    loading: "Loading publications...",
    loadingEvents: "Loading events...",
    loadingCampaigns: "Loading fundraisers...",

    errorTitle:
      "Unable to load publications.",
    errorDescription:
      "Check your connection and try again.",
    retry: "Try again",

    imageUnavailable: "Image unavailable",
    organizerPhoto: "Organizer photo",

    updated: "Data updated",
  },
} as const;

/* ==========================================================
   UTILITAIRES
========================================================== */

function readableText(
  value: unknown,
  fallback = ""
): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const clean = value.trim();

  return clean || fallback;
}

/**
 * Accepte uniquement les URL utilisables
 * par le navigateur.
 *
 * Les storageKey Supabase non résolus
 * ne sont pas transformés en fausses URL.
 */
function safeImage(
  value: string | null | undefined
): string | null {
  if (!value || typeof value !== "string") {
    return null;
  }

  const url = value.trim();

  if (
    url.startsWith("/") &&
    !url.startsWith("//") &&
    !url.includes("\\")
  ) {
    return url;
  }

  try {
    const parsed = new URL(url);

    if (parsed.protocol === "https:") {
      return parsed.toString();
    }

    if (
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(
        parsed.hostname
      )
    ) {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Conversion monétaire depuis les
 * unités mineures de Prisma.
 *
 * Exemples :
 * XOF : 5000 = 5 000 FCFA
 * EUR : 5000 = 50,00 €
 * USD : 5000 = 50,00 $
 *
 * Utilise BigInt pour conserver
 * la précision des montants.
 */
function formatMoney(
  value: Amount | null | undefined,
  locale: Locale
): string { if (!value || !/^-?\d+$/.test(value.amountMinor)) return "?"; return formatMinorMoney(value.amountMinor, value.currency || "XOF", locale); }

/**
 * Affiche la date dans le fuseau
 * horaire propre à l'événement.
 */
function formatEventDate(
  schedule: EventItem["schedule"],
  locale: Locale
): {
  date: string;
  time: string;
} | null {
  if (!schedule?.startsAt) {
    return null;
  }

  const date = new Date(schedule.startsAt);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const language =
    locale === "fr" ? "fr-FR" : "en-US";

  const format = (timeZone?: string) => ({
    date: new Intl.DateTimeFormat(
      language,
      {
        day: "numeric",
        month: "short",
        year: "numeric",
        ...(timeZone ? { timeZone } : {}),
      }
    ).format(date),

    time: new Intl.DateTimeFormat(
      language,
      {
        hour: "2-digit",
        minute: "2-digit",
        ...(timeZone ? { timeZone } : {}),
      }
    ).format(date),
  });

  try {
    return format(schedule.timeZone);
  } catch {
    return format();
  }
}

/**
 * Les identifiants de catégorie
 * proviennent uniquement des
 * événements réellement publiés.
 */


/**
 * Les liens proviennent de l'API.
 * Le contrôle garantit une navigation
 * exclusivement interne.
 */
function safeInternalHref(
  value: string | undefined,
  fallback: string
): string {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
  ) {
    return value;
  }

  return fallback;
}

/* ==========================================================
   IMAGE AVEC ÉTAT DE SECOURS

   Évite les images brisées.
========================================================== */

function PublicImage({
  src,
  alt,
  className = "",
  fallbackLabel,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);

  const validSrc = safeImage(src);

  

  if (!validSrc || (failedSource === validSrc)) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center bg-[#edf2ee] text-[#8ca49a] ${className}`}
      >
        <div className="flex flex-col items-center gap-2">
          <ImageOff size={28} strokeWidth={1.5} />

          {fallbackLabel && (
            <span className="px-2 text-center text-[11px] font-medium">
              {fallbackLabel}
            </span>
          )}
        </div>
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
   AVATAR ORGANISATEUR

   Photo réelle ou icône neutre.
========================================================== */

function OrganizerAvatar({
  organizer,
  size = "normal",
}: {
  organizer: Organizer;
  size?: "normal" | "small";
}) {
  const image =
    safeImage(organizer.photoUrl);

  const [failedSource, setFailedSource] = useState<string | null>(null);

  

  const sizeClass =
    size === "small"
      ? "size-8"
      : "size-9 sm:size-10";

  return (
    <div
      className={`flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#dbe8dd] bg-[#eaf5ed] text-[#087c2e]`}
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
          size={size === "small" ? 17 : 21}
          strokeWidth={1.9}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/* ==========================================================
   EN-TÊTE DES SECTIONS

   Titre à gauche, lien à droite.
   Pas de colonne vide.
========================================================== */

function SectionHeading({
  title,
  subtitle,
  action,
  href,
}: {
  title: string;
  subtitle?: string;
  action: string;
  href: string;
}) {
  return (
    <div className="mb-4 flex w-full min-w-0 items-start justify-between gap-3 sm:mb-5">
      <div className="min-w-0">
        <h2 className="text-lg font-extrabold tracking-tight text-[#183047] sm:text-xl lg:text-2xl">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-1 text-xs leading-relaxed text-[#728092] sm:text-sm">
            {subtitle}
          </p>
        )}
      </div>

      <Link
        href={href}
        className="inline-flex min-h-9 shrink-0 items-center gap-1 text-[11px] font-extrabold text-[#087f2e] transition-colors hover:text-[#055b22] sm:text-sm"
      >
        <span className="hidden sm:inline">
          {action}
        </span>

        <span className="sm:hidden">
          {action}
        </span>

        <ChevronRight
          size={17}
          className="shrink-0"
        />
      </Link>
    </div>
  );
}

/* ==========================================================
   CARTE ÉVÉNEMENT

   INFORMATIONS :
   - Image réelle
   - Catégorie existante
   - Titre
   - Nom organisateur
   - Photo organisateur
   - Lieu
   - Ville et pays
   - Date et heure
   - Prix réel
   - Réserver

   Responsive :
   1 carte par ligne sur petit mobile
   2 sur tablette
   3 ou 4 sur PC
========================================================== */

function EventCard({
  event,
  locale,
}: {
  event: EventItem;
  locale: Locale;
}) {
  const t = TEXT[locale];

  const eventDate = formatEventDate(
    event.schedule,
    locale
  );

  const venueLine = [
    event.venue?.name,
    event.venue?.city,
    event.venue?.country,
  ]
    .filter(Boolean)
    .join(" · ");

  const href = safeInternalHref(
    event.href,
    `/events/${encodeURIComponent(event.slug)}`
  );

  const isFree =
    event.pricing?.isFree === true;

  const price =
    isFree
      ? t.free
      : event.pricing?.from
        ? formatMoney(
            event.pricing.from,
            locale
          )
        : t.priceUnavailable;

  return (
    <article className="group flex h-full min-w-0 flex-row gap-3 p-2 overflow-hidden rounded-2xl border border-[#e1e9e2] bg-white shadow-[0_3px_14px_rgba(13,49,28,0.045)] transition-shadow duration-200 hover:shadow-[0_8px_25px_rgba(13,49,28,0.1)]">
      {/* IMAGE ÉVÉNEMENT */}

      <Link
        href={href}
        aria-label={event.title}
        className="relative block w-27 shrink-0 min-h-40 self-stretch overflow-hidden rounded-xl bg-[#edf2ee] sm:w-32 lg:w-36"
      >
        <PublicImage
          src={event.imageUrl}
          alt={event.title}
          fallbackLabel={t.imageUnavailable}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]"
        />

        {/* CATÉGORIE EXISTANTE */}

        {readableText(event.category) && (
          <span className="absolute top-3 left-3 max-w-[85%] truncate rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] font-extrabold text-[#087b2e] shadow-sm">
            {eventCategoryLabel(event.category, locale)}
          </span>
        )}
      </Link>

      {/* CONTENU */}

      <div className="flex min-w-0 flex-1 flex-col py-1 pr-1">
        <Link href={href}>
          <h3 className="line-clamp-2 text-[15px] font-extrabold leading-snug text-[#1c2b40] transition-colors hover:text-[#087d30] sm:text-base">
            {event.title}
          </h3>
        </Link>

        {/* NOM + PHOTO ORGANISATEUR */}

        <div className="mt-2 flex min-w-0 items-center gap-2.5 border-b border-[#edf1ed] pb-3">
          <OrganizerAvatar
            organizer={event.organizer}
          />

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium text-[#7b8997]">
              {t.organizer}
            </p>

            <p
              title={event.organizer.name}
              className="truncate text-xs font-extrabold text-[#253c35] sm:text-[13px]"
            >
              {event.organizer.name}{event.organizer.blueBadgeEnabled && <VerifiedBadge />}
            </p>
          </div>

          <ShieldCheck
            size={16}
            className="shrink-0 text-[#1d9b4a]"
            aria-hidden="true"
          />
        </div>

        {/* DATE ET HEURE */}

        <div className="mt-2 space-y-2">
          <div className="flex min-w-0 items-start gap-2">
            <CalendarDays
              size={16}
              className="mt-0.5 shrink-0 text-[#07832f]"
            />

            <span className="min-w-0 text-xs leading-relaxed text-[#526579]">
              {eventDate
                ? eventDate.date
                : t.dateUnavailable}

              {eventDate && (
                <span className="ml-2 inline-flex items-center gap-1 font-semibold text-[#253e4a]">
                  <Clock3 size={13} />
                  {eventDate.time}
                </span>
              )}
            </span>
          </div>

          {/* LIEU */}

          <div className="flex min-w-0 items-start gap-2">
            <MapPin
              size={16}
              className="mt-0.5 shrink-0 text-[#dc3145]"
            />

            <span
              title={venueLine}
              className="line-clamp-2 min-w-0 text-xs leading-relaxed text-[#526579]"
            >
              {venueLine ||
                t.locationUnavailable}
            </span>
          </div>
        </div>

        {/* PRIX ET RÉSERVATION */}

        <div className="mt-auto pt-2">
          <div className="mb-3 flex min-w-0 flex-col">
            {!isFree &&
              event.pricing?.from && (
                <span className="text-[10px] font-medium text-[#778696]">
                  {t.from}
                </span>
              )}

            <span className="wrap-break-word text-base font-black text-[#d51f2e] sm:text-lg">
              {price}
            </span>
          </div>

          <Link
            href={href}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#087d2d] px-3 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-[#056823] sm:text-sm"
          >
            <Ticket size={17} />
            {t.book}
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}

/* ==========================================================
   CARTE CAGNOTTE

   INFORMATIONS :
   - Image réelle
   - Titre
   - Nom + photo organisateur
   - Localisation
   - Montant réellement collecté
   - Objectif
   - Progression
   - Nombre de dons confirmés
   - Bouton Faire un don
========================================================== */

function CampaignCard({
  campaign,
  locale,
}: {
  campaign: CampaignItem;
  locale: Locale;
}) {
  const t = TEXT[locale];

  const href = safeInternalHref(
    campaign.href,
    `${CAMPAIGNS_URL}/${encodeURIComponent(
      campaign.slug
    )}`
  );

  const percentage = Number.isFinite(
    campaign.funding.percentage
  )
    ? Math.max(
        0,
        campaign.funding.percentage
      )
    : 0;

  const progressWidth =
    Math.min(percentage, 100);

  const location = [
    campaign.location?.city,
    campaign.location?.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <article className="group flex h-full min-w-0 flex-row gap-3 p-2 overflow-hidden rounded-2xl border border-[#e1e9e2] bg-white shadow-[0_3px_14px_rgba(13,49,28,0.045)] transition-shadow duration-200 hover:shadow-[0_8px_25px_rgba(13,49,28,0.1)]">
      {/* IMAGE CAGNOTTE */}

      <Link
        href={href}
        aria-label={campaign.title}
        className="relative block w-27 shrink-0 self-stretch overflow-hidden rounded-xl bg-[#edf2ee] sm:w-32 lg:w-36"
      >
        <PublicImage
          src={campaign.imageUrl}
          alt={campaign.title}
          fallbackLabel={t.imageUnavailable}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]"
        />
      </Link>

      {/* CONTENU */}

      <div className="flex min-w-0 flex-1 flex-col py-1 pr-1">
        <Link href={href}>
          <h3 className="line-clamp-2 text-[15px] font-extrabold leading-snug text-[#1c2b40] hover:text-[#087d30] sm:text-base">
            {campaign.title}
          </h3>
        </Link>

        {/* ORGANISATEUR */}

        <div className="mt-2 flex min-w-0 items-center gap-2.5">
          <OrganizerAvatar
            organizer={campaign.organizer}
          />

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium text-[#7b8997]">
              {t.campaignOrganizer}
            </p>

            <p className=" text-xs font-extrabold text-[#253c35] sm:text-[13px] flex min-w-0 items-center gap-1">
              <span className="min-w-0 truncate">{campaign.organizer.name}</span>{campaign.organizer.blueBadgeEnabled && <VerifiedBadge />}
            </p>
          </div>
        </div>

        {/* DESCRIPTION */}

        <p className="mt-2 line-clamp-2  text-xs leading-relaxed text-[#697b89]">
          {campaign.description}
        </p>

        {/* LOCALISATION */}

        {location && (
          <div className="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-[#607284]">
            <MapPin
              size={14}
              className="shrink-0 text-[#d93449]"
            />

            <span className="truncate">
              {location}
            </span>
          </div>
        )}

        {/* MONTANTS */}

        <div className="mt-auto pt-2">
          <div className="flex min-w-0 items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-[#78889a]">
                {t.collected}
              </p>

              <p className="wrap-break-word text-base font-black text-[#087d2d] sm:text-lg">
                {formatMoney(
                  campaign.funding.collected,
                  locale
                )}
              </p>
            </div>

            <span className="shrink-0 text-xs font-extrabold text-[#087d2c]">
              {new Intl.NumberFormat(
                locale === "fr"
                  ? "fr-FR"
                  : "en-US",
                {
                  maximumFractionDigits: 1,
                }
              ).format(percentage)}
              %
            </span>
          </div>

          {/* BARRE DE PROGRESSION */}

          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressWidth}
            className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[#e6eee8]"
          >
            <div
              className="h-full rounded-full bg-[#078b31] transition-[width] duration-300"
              style={{
                width: `${progressWidth}%`,
              }}
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] text-[#66798b]">
            <span>
              {t.goal} :{" "}
              <strong className="font-bold text-[#334b40]">
                {formatMoney(
                  campaign.funding.goal,
                  locale
                )}
              </strong>
            </span>

            <span>
              {campaign.funding.donationCount}{" "}
              {t.donations}
            </span>
          </div>

          {/* ACTION */}

          <Link
            href={href}
            className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#087d2d] px-3 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-[#056823] sm:text-sm"
          >
            <Heart size={17} />
            {t.support}
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}

/* ==========================================================
   SQUELETTE DE CHARGEMENT

   Ce ne sont pas de fausses publications :
   uniquement des éléments de chargement.
========================================================== */

function LoadingCards({
  count = 4,
}: {
  count?: number;
}) {
  return (
    <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 xl:gap-4">
      {Array.from({
        length: count,
      }).map((_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="animate-pulse overflow-hidden rounded-2xl border border-[#e8edea] bg-white"
        >
          <div className="aspect-16/10 w-full bg-[#e8efea]" />

          <div className="space-y-3 p-4">
            <div className="h-4 w-4/5 rounded bg-[#e8efea]" />

            <div className="flex items-center gap-2">
              <div className="size-9 rounded-full bg-[#e8efea]" />
              <div className="h-3 w-1/2 rounded bg-[#e8efea]" />
            </div>

            <div className="h-3 w-3/4 rounded bg-[#e8efea]" />

            <div className="h-10 rounded-xl bg-[#e8efea]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ==========================================================
   PAGE PRINCIPALE
========================================================== */

export default function PublicHomePage() {
  const router = useRouter();


  /* ========================================================
     LANGUE
  ======================================================== */

  const [locale, setLocale] =
    useState<Locale>("fr");

  const t = TEXT[locale];

  /* ========================================================
     DONNÉES API
  ======================================================== */

  const [events, setEvents] =
    useState<EventItem[]>([]);

  const [campaigns, setCampaigns] =
    useState<CampaignItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(false);

  

  /* ========================================================
     RECHERCHE
  ======================================================== */

  const [searchTerm, setSearchTerm] =
    useState("");

  const [selectedCity, setSelectedCity] =
    useState("");

  const [selectedDate, setSelectedDate] =
    useState("");

  const [selectedCategory, setSelectedCategory] =
    useState("");

  /* ========================================================
     SYNCHRONISATION FR / EN
  ======================================================== */

  useEffect(() => {
    function syncLanguage() {
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
        // Aucune préférence obligatoire.
      }

      const htmlLanguage =
        document.documentElement.lang
          .toLowerCase();

      setLocale(
        htmlLanguage.startsWith("en")
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
     CHARGEMENT DES DONNÉES RÉELLES

     Même API pour PC et mobile.

     Aucune requête organisateur.
     Aucune session obligatoire.
  ======================================================== */

  const loadHome = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(
          `${HOME_API}?eventsLimit=12&campaignsLimit=8`,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            signal,
          }
        );

        if (!response.ok) {
          throw new Error("HOME_API_ERROR");
        }

        const result =
          (await response.json()) as HomeResponse;

        if (
          result.success !== true ||
          !result.data
        ) {
          throw new Error("INVALID_HOME_RESPONSE");
        }

        if (signal?.aborted) return;

        setEvents(
          Array.isArray(result.data.events)
            ? result.data.events
            : []
        );

        setCampaigns(
          Array.isArray(result.data.campaigns)
            ? result.data.campaigns
            : []
        );

        

        setError(false);
      } catch {
        if (signal?.aborted) {
          return;
        }

        setError(true);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    []
  );

  /* ========================================================
     CHARGEMENT INITIAL ET ACTUALISATION

     Réactualisation toutes les 60 secondes
     lorsque l'onglet est visible.

     Actualisation également au retour
     sur la page.

     Aucune donnée fictive utilisée.
  ======================================================== */

  useEffect(() => {
    const controllers =
      new Set<AbortController>();

    let disposed = false;

    function refresh() {
      if (
        disposed ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      const controller =
        new AbortController();

      controllers.add(controller);

      void loadHome(controller.signal)
        .finally(() => {
          controllers.delete(controller);
        });
    }

    refresh();

    const interval = window.setInterval(
      refresh,
      REFRESH_INTERVAL
    );

    function handleVisibility() {
      if (
        document.visibilityState === "visible"
      ) {
        refresh();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      disposed = true;

      window.clearInterval(interval);

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );

      controllers.forEach((controller) =>
        controller.abort()
      );
    };
  }, [loadHome]);

  /* ========================================================
     CATÉGORIES EXISTANTES

     La page n'invente aucune catégorie.

     Les catégories sont récupérées
     depuis Event.category.

     Il ne s'agit pas d'une création
     ou modification du catalogue.
  ======================================================== */

  const categories = EVENT_CATEGORY_DEFINITIONS.map(item => item.key);

  const visibleCategories =
    categories.slice(
      0,
      MAX_VISIBLE_CATEGORIES
    );

  /* ========================================================
     VILLES DISPONIBLES

     Extraction des lieux des événements
     réellement chargés.
  ======================================================== */

  const cities = useMemo(() => {
    const names = new Map<
      string,
      string
    >();

    for (const event of events) {
      const city =
        readableText(event.venue?.city);

      if (city) {
        names.set(
          city.toLowerCase(),
          city
        );
      }
    }

    return Array.from(
      names.values()
    ).sort((a, b) =>
      a.localeCompare(b, locale)
    );
  }, [events, locale]);

  /* ========================================================
     RECHERCHE VERS L'EXPLORATION

     La page d'accueil ne prétend pas
     rechercher toute la base.

     Les filtres sont transmis à /events.
     La page d'exploration devra traiter
     les paramètres reçus.
  ======================================================== */

  function handleSearch(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const params =
      new URLSearchParams();

    if (searchTerm.trim()) {
      params.set(
        "q",
        searchTerm.trim()
      );
    }

    if (selectedCity) {
      params.set(
        "city",
        selectedCity
      );
    }

    if (selectedDate) {
      params.set(
        "date",
        selectedDate
      );
    }

    if (selectedCategory) {
      params.set(
        "category",
        selectedCategory
      );
    }

    const query =
      params.toString();

    router.push(
      query
        ? `${EVENTS_URL}?${query}`
        : EVENTS_URL
    );
  }

  /* ========================================================
     RENDU
  ======================================================== */

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col bg-white text-[#17283b]">

      {/* ==================================================
          1. GRANDE BANNIÈRE TIKEMIA

          Image officielle :
          public/images/paccueil.png

          PC :
          Texte à gauche.
          Image à droite.

          MOBILE :
          Texte en haut.
          Image adaptée en dessous.

          Pleine largeur.
          Aucun espace extérieur.
      ================================================== */}

      <section className="relative isolate w-full min-w-0 overflow-hidden bg-[#f7faf1]">
<Image src={HERO_IMAGE} alt="" fill unoptimized loading="eager" fetchPriority="high" sizes="100vw" className="object-cover object-[65%_center] sm:object-center" />
<div aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-white/95 via-white/65 to-transparent sm:via-white/25" />
<div className="relative z-10 flex min-h-88 w-full flex-col justify-center px-4 py-8 sm:min-h-80 sm:px-6 lg:min-h-100 lg:px-10 xl:px-14">
<h1 className="max-w-[70%] text-[27px] font-black leading-tight tracking-tight text-[#063f24] sm:max-w-[60%] sm:text-4xl lg:text-5xl">
<span className="block">{t.heroTitle1}</span><span className="mt-1 block text-[#087c2e]">{t.heroTitle2}</span></h1>
<div className="mt-5 flex w-fit max-w-full flex-col gap-2.5 min-[410px]:flex-row min-[410px]:items-center">
              <Link
                href={EVENTS_URL}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#087c2d] px-5 py-3 text-xs font-extrabold text-white transition-colors hover:bg-[#056724] sm:text-sm"
              >
                <Ticket size={18} />
                {t.exploreEvents}
                <ArrowRight size={16} />
              </Link>

              <Link
                href={CAMPAIGNS_URL}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#e3bb43] bg-white/95 px-5 py-3 text-xs font-extrabold text-[#b73c23] transition-colors hover:bg-[#fff9e9] sm:text-sm"
              >
                <Heart size={18} />
                {t.donate}
              </Link>
            </div>

            
</div></section>

      {/* ==================================================
          2. RECHERCHE ET FILTRES

          PC :
          Champs alignés horizontalement.

          MOBILE :
          Champs sur deux colonnes,
          recherche sur toute la largeur.

          Aucun grand espace inutile.
      ================================================== */}

      <section className="w-full border-b border-[#e4ece5] bg-white px-4 py-4 sm:px-6 lg:px-10 lg:py-4">
        <h2 className="mb-3 text-base font-extrabold text-[#23374a] sm:text-lg">
          {t.searchTitle}
        </h2>

        <form
          role="search"
          onSubmit={handleSearch}
          className="grid w-full min-w-0 grid-cols-2 gap-2.5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] lg:items-center"
        >
          {/* RECHERCHE TEXTE */}

          <div className="relative col-span-2 min-w-0 lg:col-span-1">
            <Search
              size={18}
              className="pointer-events-none absolute top-3.5 left-3.5 text-[#76899a]"
            />

            <input
              type="search"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(
                  event.target.value
                )
              }
              maxLength={120}
              placeholder={t.searchPlaceholder}
              aria-label={t.searchPlaceholder}
              className="h-12 w-full min-w-0 rounded-xl border border-[#dae4dd] bg-[#fbfcfb] pr-3 pl-11 text-xs font-medium text-[#23384a] outline-none placeholder:text-[#8996a2] focus:border-[#07872c] focus:ring-2 focus:ring-[#07872c]/10 sm:text-sm"
            />
          </div>

          {/* VILLE */}

          <select
            value={selectedCity}
            onChange={(event) =>
              setSelectedCity(
                event.target.value
              )
            }
            aria-label={t.cityPlaceholder}
            className="h-12 min-w-0 w-full rounded-xl border border-[#dae4dd] bg-[#fbfcfb] px-3 text-xs font-semibold text-[#43566b] outline-none focus:border-[#07872c] sm:text-sm"
          >
            <option value="">
              {t.cityPlaceholder}
            </option>

            {cities.map((city) => (
              <option
                key={city}
                value={city}
              >
                {city}
              </option>
            ))}
          </select>

          {/* DATE */}

          <input
            type="date"
            value={selectedDate}
            onChange={(event) =>
              setSelectedDate(
                event.target.value
              )
            }
            aria-label={t.datePlaceholder}
            className="h-12 min-w-0 w-full rounded-xl border border-[#dae4dd] bg-[#fbfcfb] px-2.5 text-xs font-semibold text-[#43566b] outline-none focus:border-[#07872c] sm:px-3 sm:text-sm"
          />

          {/* CATÉGORIE EXISTANTE */}

          <select
            value={selectedCategory}
            onChange={(event) =>
              setSelectedCategory(
                event.target.value
              )
            }
            aria-label={t.categoryPlaceholder}
            className="col-span-2 h-12 min-w-0 w-full rounded-xl border border-[#dae4dd] bg-[#fbfcfb] px-3 text-xs font-semibold text-[#43566b] outline-none focus:border-[#07872c] sm:text-sm lg:col-span-1"
          >
            <option value="">
              {t.categoryPlaceholder}
            </option>

            {categories.map(
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

          {/* BOUTON */}

          <button
            type="submit"
            className="col-span-2 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#087d2d] px-5 text-sm font-extrabold text-white transition-colors hover:bg-[#056724] lg:col-span-1"
          >
            <Search size={18} />
            {t.searchButton}
          </button>
        </form>
      </section>

      {/* ==================================================
          3. CATÉGORIES

          Les catégories sont issues
          des événements réellement publiés.

          Aucun doublon.
          Aucun catalogue artificiel.

          MOBILE :
          Défilement horizontal propre.

          PC :
          Six colonnes maximum.
      ================================================== */}

      {visibleCategories.length > 0 && (
        <section className="w-full bg-white px-4 py-4 sm:px-6 lg:px-10">
          <SectionHeading title={t.categoriesTitle} action={t.allCategories} href={EVENTS_URL} />
          <PublicCategoryStrip locale={locale} />
        </section>
      )}

      {/* ==================================================
          4. ÉVÉNEMENTS À LA UNE

          Affichage direct sur toute la largeur.

          Pas de colonne de présentation
          supplémentaire à gauche.

          Les informations viennent
          exclusivement de l'API.
      ================================================== */}

      <section className="w-full bg-[#fbfcfb] px-4 py-4 sm:px-6 lg:px-10 lg:py-4">
        <SectionHeading
          title={t.eventsTitle}
          
          action={t.seeAllEvents}
          href={EVENTS_URL}
        />

        {/* CHARGEMENT */}

        {loading ? (
          <LoadingCards count={4} />
        ) : error && events.length === 0 ? (
          <div className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-[#e4eae5] bg-white px-4 py-9 text-center">
            <RefreshCw
              size={28}
              className="text-[#087d2c]"
            />

            <p className="text-sm font-bold text-[#2c4052]">
              {t.errorTitle}
            </p>

            <p className="text-xs text-[#718294]">
              {t.errorDescription}
            </p>

            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void loadHome();
              }}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#087d2d] px-5 text-xs font-bold text-white"
            >
              <RefreshCw size={15} />
              {t.retry}
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="flex min-h-36.25 w-full flex-col items-center justify-center gap-2 rounded-xl border border-[#e4eae5] bg-white px-4 text-center">
            <CalendarDays
              size={29}
              className="text-[#99b5a4]"
            />

            <p className="text-sm font-semibold text-[#718294]">
              {t.noEvents}
            </p>
          </div>
        ) : (
          <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 xl:gap-4">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                locale={locale}
              />
            ))}
          </div>
        )}
      </section>

      {/* ==================================================
          5. CAGNOTTES À LA UNE

          Même disposition générale
          que les événements.

          Montants = dons confirmés uniquement.
          Aucun montant fictif.
      ================================================== */}

      <section className="w-full bg-white px-4 py-4 sm:px-6 lg:px-10 lg:py-4">
        <SectionHeading
          title={t.campaignsTitle}
          
          action={t.seeAllCampaigns}
          href={CAMPAIGNS_URL}
        />

        {loading ? (
          <LoadingCards count={4} />
        ) : error && campaigns.length === 0 ? (
          <div className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-[#e4eae5] bg-[#fbfcfb] px-4 py-9 text-center">
            <RefreshCw
              size={28}
              className="text-[#087d2c]"
            />

            <p className="text-sm font-bold text-[#2c4052]">
              {t.errorTitle}
            </p>

            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void loadHome();
              }}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#087d2d] px-5 text-xs font-bold text-white"
            >
              <RefreshCw size={15} />
              {t.retry}
            </button>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex min-h-36.25 w-full flex-col items-center justify-center gap-2 rounded-xl border border-[#e4eae5] bg-[#fbfcfb] px-4 text-center">
            <Heart
              size={29}
              className="text-[#dba7ae]"
            />

            <p className="text-sm font-semibold text-[#718294]">
              {t.noCampaigns}
            </p>
          </div>
        ) : (
          <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 xl:gap-4">
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
      </section>

      {/* ==================================================
          FIN DE L'ACCUEIL

          AUCUNE SECTION SUPPLÉMENTAIRE.

          SUPPRIMÉ :
          - Comment ça marche
          - Statistiques
          - Logos partenaires
          - Colonnes inutiles
          - Blocs de démonstration
          - Deuxième footer

          PublicFooter.tsx est déjà intégré
          dans src/app/(public)/layout.tsx.
      ================================================== */}

    </div>
  );
}
