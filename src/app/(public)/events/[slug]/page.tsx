
"use client";
import { VerifiedBadge } from "@/components/public/PublicNavigation";
import { EVENT_CATEGORY_DEFINITIONS, eventCategoryLabel } from "@/i18n/config";
import { Music2, Drama, GraduationCap, Martini, Palmtree, Trophy, Tent, FlaskConical, Church, UtensilsCrossed, BriefcaseBusiness, Ellipsis } from "lucide-react";
import { formatMinorMoney } from "@/i18n/config";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";

import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, CreditCard, Headphones, ImageOff, MapPin, Minus, Plus, QrCode, RefreshCw, ShieldCheck, Ticket, UserRound, Wallet, Zap } from "lucide-react";

function PublicCategoryIcon({ category, size = 22 }: { category: string; size?: number }) {
 const item = EVENT_CATEGORY_DEFINITIONS.find(item => item.key === category);
 const Icon = item ? ({ Music2, Drama, GraduationCap, Martini, Palmtree, Trophy, Tent, FlaskConical, Church, UtensilsCrossed, BriefcaseBusiness, Ellipsis })[item.icon] : CalendarDays;
 return <Icon size={size} color={item?.color} aria-hidden="true" />;
}
/* ==========================================================
   TIKEMIA — DÉTAILS D'UN ÉVÉNEMENT

   FICHIER :
   src/app/(public)/events/[slug]/page.tsx

   URL :
   /events/afrobeat-night

   API :
   /api/public/events/[slug]

   RÈGLE FINANCIÈRE :
   FRAIS DE SERVICE = 2 %

   APPLICATION :
   - Toutes les devises prises en charge
   - Tous les montants de commande
   - Toutes les catégories de billets
   - Aucun plafond de frais
   - Aucun ancien barème de 1 500 FCFA
   - Aucun ancien taux de 5 %

   CALCUL :
   Sous-total = somme des billets
   Frais = sous-total × 2 %
   Total = sous-total + frais

   PRÉCISION :
   - Calculs avec BigInt
   - Montants en unités mineures
   - Arrondi au plus petit montant payable
   - Aucune conversion monétaire
   - Aucune perte de précision flottante

   PRÉSENTATION :
   PC :
   - Galerie
   - Détails et localisation
   - Catégories et récapitulatif

   MOBILE :
   - Galerie et miniatures
   - Détails
   - Organisateur
   - Description
   - Lieu et carte
   - Billets
   - Total fixe en bas

   IMPORTANT :
   - Aucun événement inventé
   - Aucune catégorie ajoutée
   - Aucune cagnotte
   - Aucune création de commande
   - Aucun paiement simulé
   - Aucun nouveau modèle Prisma
   - Aucun nouveau fichier CSS
========================================================== */

/* ==========================================================
   CONFIGURATION
========================================================== */

const SERVICE_FEE_PERCENT = 2n;

const PERCENT_DIVISOR = 100n;

const MAX_GALLERY_IMAGES = 10;

const MAX_TICKETS_PER_CATEGORY = 20;

type Locale = "fr" | "en";

/* ==========================================================
   TYPES DE L'API EXISTANTE
========================================================== */

type Money = {
  amountMinor: string;
  currency: string;
};

type EventImage = {
  id: string;
  url: string | null;
  storageKey: string;
  isPrimary: boolean;
  position: number;
};

type EventOrganizer = {
  blueBadgeEnabled?: boolean;
  id: string;
  name: string;
  profileName: string;
  photoUrl: string | null;
  photoStorageKey: string | null;
};

type EventVenue = {
  name: string;
  address: string;
  city: string;
  country: string;
  fullAddress: string;

  imageUrl: string | null;
  imageStorageKey: string | null;

  mapQuery: string | null;
  mapUrl: string | null;
};

type EventSchedule = {
  id: string;
  startsAt: string;
  endsAt: string | null;
  label: string | null;
  timeZone: string;
};

type TicketCategory = {
  id: string;
  name: string;
  description: string | null;
  price: Money;
  capacity: number;
  currency: string;
  isActive: boolean;
};

type EventDetails = {
  id: string;
  slug: string;

  title: string;
  description: string;
  category: string;
  status: "PUBLISHED";

  organizer: EventOrganizer;

  imageUrl: string | null;
  imageStorageKey: string | null;
  images: EventImage[];

  venue: EventVenue | null;

  scheduleKind: string;
  ticketValidity: string;

  schedule: EventSchedule | null;
  schedules: EventSchedule[];

  ticketCategories: TicketCategory[];

  pricing: {
    from: Money | null;
    isFree: boolean;
    currency: string;
  };

  currency: string;
  timeZone: string;
  capacity: number;

  publishedAt: string | null;
  href: string;
};

type EventResponse = {
  success: boolean;
  data?: {
    event?: EventDetails;
  };
};

type OrderCalculation = {
  subtotalMinor: bigint;
  serviceFeeMinor: bigint;
  totalMinor: bigint;
  ticketCount: number;
  valid: boolean;
  error: string | null;
};

/* ==========================================================
   TRADUCTIONS FR / EN
========================================================== */

const TRANSLATIONS = {
  fr: {
    explore: "Explorer",
    events: "Événements",
    details: "Détails de l'événement",

    organizer: "Organisé par",

    description: "Description",
    location: "Lieu de l'événement",

    date: "Date",
    time: "Heure",
    schedules: "Dates et horaires",
    chooseSchedule: "Choisir la séance",

    tickets: "Billets",
    ticketCategories: "Catégories de billets",
    quantity: "Quantité",

    selectedTickets: "Billets sélectionnés",

    subtotal: "Sous-total",
    serviceFees: "Frais de service",
    total: "Total à payer",

    checkout: "Passer à la caisse",

    free: "Gratuit",
    noTickets:
      "Aucune catégorie de billets disponible.",

    noSelection:
      "Sélectionnez au moins un billet.",

    priceUnavailable:
      "Tarif indisponible",

    locationUnavailable:
      "Lieu à préciser",

    scheduleUnavailable:
      "Date et heure à préciser",

    openMap: "Voir l'itinéraire",
    mapUnavailable:
      "Adresse indisponible",

    securePayment:
      "Paiements sécurisés",
    instantTicket:
      "Billets électroniques",
    qrCode:
      "QR code unique",
    support:
      "Assistance",

    loading:
      "Chargement de l'événement...",

    unavailable:
      "Événement indisponible",

    loadError:
      "Impossible de charger les informations de cet événement.",

    retry: "Réessayer",
    back: "Retour aux événements",

    

    currencyMismatch:
      "Une catégorie utilise une devise différente de celle de l'événement.",

    invalidPrice:
      "Un tarif de billet est invalide.",

    

    checkoutPending:
      "Le paiement est momentan?ment indisponible.",

    checkoutPendingDescription:
      "Votre sélection et le total sont prêts. Le passage à la caisse sera connecté au parcours de commande de TIKEMIA.",

    noPayment:
      "Aucun paiement ni aucune réservation n'ont été effectués.",

    organizerPhoto:
      "Photo de l'organisateur",

    imageUnavailable:
      "Image indisponible",

    ticketsLabel:
      "billet(s)",

    selectDate:
      "Sélectionnez une date",

    feeIncluded:
      "Frais de service inclus dans le total",

    capacityNote:
      "Quantité maximale de sélection atteinte.",
  },

  en: {
    explore: "Explore",
    events: "Events",
    details: "Event details",

    organizer: "Organized by",

    description: "Description",
    location: "Event location",

    date: "Date",
    time: "Time",
    schedules: "Dates and times",
    chooseSchedule: "Choose a session",

    tickets: "Tickets",
    ticketCategories: "Ticket categories",
    quantity: "Quantity",

    selectedTickets: "Selected tickets",

    subtotal: "Subtotal",
    serviceFees: "Service fee",
    total: "Total to pay",

    checkout: "Proceed to checkout",

    free: "Free",
    noTickets:
      "No ticket categories are available.",

    noSelection:
      "Select at least one ticket.",

    priceUnavailable:
      "Price unavailable",

    locationUnavailable:
      "Location to be confirmed",

    scheduleUnavailable:
      "Date and time to be confirmed",

    openMap: "Get directions",
    mapUnavailable:
      "Address unavailable",

    securePayment:
      "Secure payments",
    instantTicket:
      "Electronic tickets",
    qrCode:
      "Unique QR code",
    support:
      "Support",

    loading:
      "Loading event...",

    unavailable:
      "Event unavailable",

    loadError:
      "Unable to load this event.",

    retry: "Try again",
    back: "Back to events",

    

    currencyMismatch:
      "A ticket category uses a different currency from the event.",

    invalidPrice:
      "A ticket price is invalid.",

    

    checkoutPending:
      "Payment is temporarily unavailable.",

    checkoutPendingDescription:
      "Your ticket selection and total are ready. Checkout will be connected to the TIKEMIA order flow.",

    noPayment:
      "No payment or reservation has been made.",

    organizerPhoto:
      "Organizer photo",

    imageUnavailable:
      "Image unavailable",

    ticketsLabel:
      "ticket(s)",

    selectDate:
      "Choose a date",

    feeIncluded:
      "Service fees included in the total",

    capacityNote:
      "Maximum selection quantity reached.",
  },
} as const;

/* ==========================================================
   UTILITAIRE — IMAGES
========================================================== */

function safeImageUrl(
  value: string | null | undefined
): string | null {
  if (!value || typeof value !== "string") {
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

/* ==========================================================
   UTILITAIRE — MONTANTS

   Toutes les devises utilisent les
   unités mineures de leur monnaie.

   Exemples :
   XOF : 5000 -> 5 000 FCFA
   EUR : 500000 -> 5 000,00 €
   USD : 500000 -> 5 000,00 $
   NGN : 500000 -> 5 000,00 NGN
   GHS : 500000 -> 5 000,00 GHS
   ZAR : 500000 -> 5 000,00 ZAR

   Aucune conversion entre devises.
========================================================== */

function readMoney(
  value: Money | null | undefined
): bigint | null {
  if (
    !value ||
    typeof value.amountMinor !== "string" ||
    !/^-?\d+$/.test(value.amountMinor)
  ) {
    return null;
  }

  try {
    return BigInt(value.amountMinor);
  } catch {
    return null;
  }
}



function formatMoney(
  amountMinor: bigint,
  currency: string,
  locale: Locale
): string { return formatMinorMoney(amountMinor, currency, locale); }

/* ==========================================================
   CALCUL DÉFINITIF D'AFFICHAGE DES FRAIS

   RÈGLE :
   2 % POUR TOUTES LES DEVISES.

   Frais = sous-total × 2 / 100.

   Arrondi supérieur à l'unité mineure.

   Exemple XOF :
   5 000 FCFA -> 100 FCFA.

   Exemple EUR :
   5 000,00 € -> 100,00 €.

   Exemple NGN :
   50 000,00 NGN -> 1 000,00 NGN.

   Aucun plafond et aucune tranche.

   IMPORTANT :
   Le backend de création de commande
   devra recalculer indépendamment
   cette même règle.
========================================================== */

function calculateServiceFee(
  subtotalMinor: bigint
): bigint {
  if (subtotalMinor <= 0n) {
    return 0n;
  }

  const numerator =
    subtotalMinor * SERVICE_FEE_PERCENT;

  // Arrondi supérieur à l'unité mineure.
  return (
    numerator +
    PERCENT_DIVISOR -
    1n
  ) / PERCENT_DIVISOR;
}

/* ==========================================================
   UTILITAIRES — DATE ET HEURE
========================================================== */

function formatEventDate(
  startsAt: string,
  timeZone: string,
  locale: Locale
): string {
  const date = new Date(startsAt);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat(
      locale === "fr" ? "fr-FR" : "en-US",
      {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone,
      }
    ).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function formatEventTime(
  startsAt: string,
  timeZone: string,
  locale: Locale
): string {
  const date = new Date(startsAt);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat(
      locale === "fr" ? "fr-FR" : "en-US",
      {
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      }
    ).format(date);
  } catch {
    return "—";
  }
}

function displayCountry(
  value: string,
  locale: Locale
): string {
  const country = value.trim();

  if (!/^[A-Z]{2}$/i.test(country)) {
    return country;
  }

  try {
    return (
      new Intl.DisplayNames(
        [locale],
        { type: "region" }
      ).of(country.toUpperCase()) ??
      country
    );
  } catch {
    return country;
  }
}

/* ==========================================================
   UTILITAIRE — CARTE DU LIEU

   Recherche à partir de l'adresse
   réelle transmise par l'API.

   Aucune coordonnée GPS inventée.
========================================================== */

function makeMapEmbed(
  address: string | null
): string | null {
  if (!address?.trim()) {
    return null;
  }

  return (
    "https://www.google.com/maps?q=" +
    encodeURIComponent(address) +
    "&output=embed"
  );
}

/* ==========================================================
   IMAGE SÉCURISÉE AVEC FALLBACK
========================================================== */

function SafePicture({
  src,
  alt,
  className = "",
  priority = false,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);

  const resolved =
    safeImageUrl(src);

  

  if (!resolved || (failedSource === resolved)) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center bg-[#e9f0ea] text-[#8fa99a] ${className}`}
      >
        <ImageOff
          size={29}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <span className={`relative block overflow-hidden ${className}`}>
    <Image fill sizes="(min-width: 1024px) 33vw, 100vw" unoptimized
      src={resolved}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onError={() => setFailedSource(resolved)}
      className="object-cover lg:object-contain"
    />
  </span>
  );
}

/* ==========================================================
   GALERIE DES IMAGES
========================================================== */

function EventGallery({
  event,
}: {
  event: EventDetails;
}) {
  const gallery = useMemo(() => {
    if (event.images.length > 0) {
      return event.images.slice(
        0,
        MAX_GALLERY_IMAGES
      );
    }

    if (!event.imageUrl) {
      return [];
    }

    return [
      {
        id: "main",
        url: event.imageUrl,
        storageKey:
          event.imageStorageKey ?? "",
        isPrimary: true,
        position: 0,
      },
    ];
  }, [event]);

  const [requestedIndex, setActiveIndex] = useState(0);
  const activeIndex = Math.min(requestedIndex, Math.max(0, gallery.length - 1));

  

  const active =
    gallery[activeIndex] ?? null;

  function move(direction: number) {
    if (gallery.length <= 1) {
      return;
    }

    setActiveIndex(
      (current) =>
        (current +
          direction +
          gallery.length) %
        gallery.length
    );
  }

  return (
    <div className="w-full min-w-0">
      <div className="relative aspect-16/11 w-full overflow-hidden rounded-2xl bg-[#e9f0ea] lg:aspect-5/4 lg:max-h-120">
        <SafePicture
          src={active?.url ?? null}
          alt={`${event.title} — ${activeIndex + 1}`}
          priority
          className="h-full w-full"
        />

        {gallery.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label="Image précédente"
              className="absolute top-1/2 left-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[#173b29] shadow-md"
            >
              <ChevronLeft size={21} />
            </button>

            <button
              type="button"
              onClick={() => move(1)}
              aria-label="Image suivante"
              className="absolute top-1/2 right-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[#173b29] shadow-md"
            >
              <ChevronRight size={21} />
            </button>
          </>
        )}

        <span className="absolute right-3 bottom-3 rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold text-white">
          {gallery.length > 0
            ? activeIndex + 1
            : 0}
          /{gallery.length}
        </span>
      </div>

      {gallery.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {gallery.map((image, index) => (
            <button
              key={image.id}
              type="button"
              aria-label={`Image ${index + 1}`}
              aria-pressed={
                index === activeIndex
              }
              onClick={() =>
                setActiveIndex(index)
              }
              className={`h-15.5 w-20 shrink-0 overflow-hidden rounded-xl border-[3px] sm:h-19 sm:w-23.75 ${
                index === activeIndex
                  ? "border-[#087e2e]"
                  : "border-transparent"
              }`}
            >
              <SafePicture
                src={image.url}
                alt={`${event.title} — miniature ${index + 1}`}
                className="h-full w-full"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==========================================================
   PROFIL PUBLIC DE L'ORGANISATEUR
========================================================== */

function OrganizerProfile({
  organizer,
  locale,
}: {
  organizer: EventOrganizer;
  locale: Locale;
}) {
  const t = TRANSLATIONS[locale];

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#e4ece6] bg-[#fbfdfb] px-3 py-3">
      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#d8e7dc] bg-[#e8f5eb] text-[#087d2e]">
        {safeImageUrl(
          organizer.photoUrl
        ) ? (
          <SafePicture
            src={organizer.photoUrl}
            alt={organizer.name}
            className="h-full w-full"
          />
        ) : (
          <UserRound
            size={23}
            aria-hidden="true"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-[#768697]">
          {t.organizer}
        </p>

        <p className=" text-sm font-extrabold text-[#173c2a] flex min-w-0 items-center gap-1">
          <span className="min-w-0 truncate">{organizer.name}</span>{organizer.blueBadgeEnabled && <VerifiedBadge />}
        </p>
      </div>
    </div>
  );
}

/* ==========================================================
   SÉLECTEUR DE QUANTITÉ
========================================================== */

function QuantityControl({
  value,
  maximum,
  disabled,
  onChange,
}: {
  value: number;
  maximum: number;
  disabled: boolean;
  onChange: (next: number) => void;
}) {
  return (
    <div className="inline-flex h-9 shrink-0 items-center overflow-hidden rounded-full border border-[#dbe5df] bg-white">
      <button
        type="button"
        aria-label="Diminuer"
        disabled={
          disabled || value <= 0
        }
        onClick={() =>
          onChange(value - 1)
        }
        className="flex size-9 items-center justify-center text-[#204331] hover:bg-[#edf7ef] disabled:opacity-35"
      >
        <Minus size={16} />
      </button>

      <output
        aria-live="polite"
        className="min-w-7 text-center text-sm font-extrabold text-[#203b2b]"
      >
        {value}
      </output>

      <button
        type="button"
        aria-label="Augmenter"
        disabled={
          disabled || value >= maximum
        }
        onClick={() =>
          onChange(value + 1)
        }
        className="flex size-9 items-center justify-center text-[#204331] hover:bg-[#edf7ef] disabled:opacity-35"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

/* ==========================================================
   RÉCAPITULATIF DES BILLETS

   Le montant est identique sur PC
   et sur mobile.

   FRAIS :
   2 % POUR TOUTES LES DEVISES.
========================================================== */

function OrderSummary({
  calculation,
  currency,
  locale,
}: {
  calculation: OrderCalculation;
  currency: string;
  locale: Locale;
}) {
  const t = TRANSLATIONS[locale];

  return (
    <div className="rounded-2xl border border-[#dfe9e2] bg-white p-4 shadow-[0_4px_18px_rgba(13,52,28,0.045)]">
      <div className="space-y-3">
        {/* NOMBRE DE BILLETS */}

        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-[#586b7c]">
            {t.selectedTickets}
          </span>

          <strong className="text-[#20382b]">
            {calculation.ticketCount}
          </strong>
        </div>

        {/* SOUS-TOTAL */}

        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-[#586b7c]">
            {t.subtotal}
          </span>

          <strong className="wrap-break-word text-right text-[#20382b]">
            {formatMoney(
              calculation.subtotalMinor,
              currency,
              locale
            )}
          </strong>
        </div>

        {/* FRAIS 2 % */}

        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-[#586b7c]">
            {t.serviceFees}

            
          </span>

          <strong className="wrap-break-word text-right text-[#20382b]">
            {formatMoney(
              calculation.serviceFeeMinor,
              currency,
              locale
            )}
          </strong>
        </div>

        {/* TOTAL GÉNÉRAL */}

        <div className="flex items-center justify-between gap-3 rounded-xl bg-[#e9f8ed] px-3 py-3">
          <span className="shrink-0 text-sm font-extrabold text-[#075329]">
            {t.total}
          </span>

          <strong className="wrap-break-word text-right text-base font-black text-[#075329] sm:text-lg">
            {formatMoney(
              calculation.totalMinor,
              currency,
              locale
            )}
          </strong>
        </div>

        
      </div>
    </div>
  );
}

/* ==========================================================
   PAGE PRINCIPALE
========================================================== */

export default function EventDetailsPage() {
  const params =
    useParams<{ slug: string }>();

  const slug = params.slug;

  const [locale, setLocale] =
    useState<Locale>("fr");

  const t = TRANSLATIONS[locale];

  const [event, setEvent] =
    useState<EventDetails | null>(null);

  const router = useRouter();
  const mobileCheckoutRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = mobileCheckoutRef.current;
    if (!bar) return;
    const update = () => bar.parentElement?.style.setProperty("--event-checkout-height", `${bar.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(update);
    observer.observe(bar);
    update();
    return () => observer.disconnect();
  }, [event?.id]);
  useEffect(() => {
    if (event?.slug && event.slug !== slug) {
      router.replace("/events/" + encodeURIComponent(event.slug));
    }
  }, [event?.slug, slug, router]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [retryCount, setRetryCount] =
    useState(0);

  const [quantities, setQuantities] =
    useState<Record<string, number>>({});

  const [
    selectedScheduleId,
    setSelectedScheduleId,
  ] = useState("");

  const [
    checkoutNotice,
    setCheckoutNotice,
  ] = useState(false);

  /* ========================================================
     LANGUE FR / EN

     Compatible avec PublicNavigation.
  ======================================================== */

  useEffect(() => {
    function syncLocale() {
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
        // Français par défaut.
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
     CHARGEMENT API
  ======================================================== */

  useEffect(() => {
    const controller =
      new AbortController();

    let inFlight = false;
    async function load(background = false) {
      if (inFlight) return;
      inFlight = true;
      if (!background) {
        setLoading(true);
        setError(null);
        setEvent(null);
        setCheckoutNotice(false);
      }

      try {
        if (!slug) {
          throw new Error(
            "INVALID_EVENT_SLUG"
          );
        }

        const response = await fetch(
          `/api/public/events/${encodeURIComponent(slug)}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "EVENT_NOT_FOUND"
              : "EVENT_LOAD_FAILED"
          );
        }

        const result =
          (await response.json()) as EventResponse;

        if (
          result.success !== true ||
          !result.data?.event
        ) {
          throw new Error(
            "INVALID_EVENT_RESPONSE"
          );
        }

        if (controller.signal.aborted) {
          return;
        }

        const loaded =
          result.data.event;

        setEvent(loaded);
        setError(null);

        if (!background) {
        setQuantities({});

        setSelectedScheduleId(
          loaded.schedule?.id ??
          loaded.schedules[0]?.id ??
          ""
        );
        }
      } catch (reason) {
        if (controller.signal.aborted) {
          return;
        }

        if (background && (!(reason instanceof Error) || reason.message !== "EVENT_NOT_FOUND")) return;
        setEvent(null);
        setError(
          reason instanceof Error
            ? reason.message
            : "EVENT_LOAD_FAILED"
        );
      } finally {
        inFlight = false;
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    const refresh = () => { if (document.visibilityState === "visible") void load(true); };
    const interval = window.setInterval(refresh, 15_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [slug, retryCount]);

  /* ========================================================
     SÉANCE SÉLECTIONNÉE
  ======================================================== */

  const selectedSchedule = useMemo(() => {
    if (!event) {
      return null;
    }

    return (
      event.schedules.find(
        (schedule) =>
          schedule.id ===
          selectedScheduleId
      ) ??
      event.schedule ??
      event.schedules[0] ??
      null
    );
  }, [event, selectedScheduleId]);

  /* ========================================================
     CATÉGORIES TARIFAIRES EXISTANTES
  ======================================================== */

  const ticketCategories =
    useMemo(() => {
      return (
        event?.ticketCategories ?? []
      ).filter(
        (category) =>
          category.isActive
      );
    }, [event]);

  /* ========================================================
     CALCUL DES BILLETS ET DES FRAIS

     1. Parcourir toutes les catégories.
     2. Lire chaque quantité sélectionnée.
     3. Multiplier quantité × prix.
     4. Additionner le sous-total.
     5. Calculer 2 % de frais.
     6. Ajouter les frais au sous-total.

     LES FRAIS SONT CALCULÉS
     INDÉPENDAMMENT DE LA DEVISE.

     Pas de restriction XOF.
     Pas de plafonnement 500 000.
     Pas de frais fixes.
========================================================== */

  const calculation =
    useMemo<OrderCalculation>(() => {
      let subtotalMinor = 0n;

      let ticketCount = 0;

      let valid = true;

      let error: string | null = null;

      if (!event) {
        return {
          subtotalMinor: 0n,
          serviceFeeMinor: 0n,
          totalMinor: 0n,
          ticketCount: 0,
          valid: false,
          error: null,
        };
      }

      for (const category of ticketCategories) {
        const quantity =
          quantities[category.id] ?? 0;

        if (
          !Number.isSafeInteger(quantity) ||
          quantity < 0
        ) {
          valid = false;
          error = "INVALID_QUANTITY";
          continue;
        }

        if (quantity === 0) {
          continue;
        }

        ticketCount += quantity;

        const price =
          readMoney(category.price);

        if (
          price === null ||
          price < 0n
        ) {
          valid = false;
          error = "INVALID_PRICE";
          continue;
        }

        if (
          category.currency
            .toUpperCase() !==
          event.currency.toUpperCase()
        ) {
          valid = false;
          error = "CURRENCY_MISMATCH";
          continue;
        }

        subtotalMinor +=
          price * BigInt(quantity);
      }

      /*
       * 2 % pour toutes les devises.
       */
      const serviceFeeMinor =
        calculateServiceFee(
          subtotalMinor
        );

      const totalMinor =
        subtotalMinor +
        serviceFeeMinor;

      return {
        subtotalMinor,
        serviceFeeMinor,
        totalMinor,
        ticketCount,
        valid,
        error,
      };
    }, [
      event,
      ticketCategories,
      quantities,
    ]);

  /* ========================================================
     CHANGEMENT DE QUANTITÉ

     Pas de réservation effectuée ici.

     La limite locale évite une
     sélection excessive.

     Le stock réel sera vérifié
     lors de la création de commande.
  ======================================================== */

  const changeQuantity =
    useCallback(
      (
        categoryId: string,
        nextQuantity: number
      ) => {
        const category =
          ticketCategories.find(
            (item) =>
              item.id === categoryId
          );

        if (!category) {
          return;
        }

        const maximum =
          Math.min(
            MAX_TICKETS_PER_CATEGORY,
            Math.max(
              0,
              category.capacity
            )
          );

        const safeQuantity =
          Math.max(
            0,
            Math.min(
              Math.floor(nextQuantity),
              maximum
            )
          );

        setQuantities(
          (previous) => ({
            ...previous,
            [categoryId]:
              safeQuantity,
          })
        );

        setCheckoutNotice(false);
      },
      [ticketCategories]
    );

  /* ========================================================
     CAISSE

     La page affiche la sélection
     et le total avec les 2 %.

     La véritable route de checkout
     n'a pas encore été intégrée.

     Ne jamais simuler une commande
     ou un paiement.
  ======================================================== */

  const [checkoutStarting, setCheckoutStarting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const checkoutRequest = useRef<{ selection: string; id: string } | null>(null);
  async function handleCheckout() {
    if (
      !event ||
      !calculation.valid ||
      calculation.ticketCount <= 0
    ) {
      return;
    }

    if (checkoutStarting || !selectedSchedule) return;
    const items = ticketCategories.filter(category => (quantities[category.id] ?? 0) > 0).map(category => ({ ticketCategoryId: category.id, quantity: quantities[category.id] }));
    const selection = JSON.stringify([event.id, selectedSchedule.id, items]);
    if (checkoutRequest.current?.selection !== selection) checkoutRequest.current = { selection, id: crypto.randomUUID() };
    setCheckoutStarting(true); setCheckoutError(""); setCheckoutNotice(false);
    try {
      const response = await fetch("/api/public/checkout", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", eventId: event.id, scheduleId: selectedSchedule.id, items, requestId: checkoutRequest.current.id }) });
      const result = await response.json();
      if (!response.ok || result.success !== true || typeof result.data?.checkoutUrl !== "string" || !result.data.checkoutUrl.startsWith("/checkout?")) throw new Error("CHECKOUT_UNAVAILABLE");
      router.push(result.data.checkoutUrl);
    } catch {
      setCheckoutError(locale === "en" ? "Unable to start checkout. Please try again." : "Impossible de commencer la commande. Veuillez réessayer."); setCheckoutStarting(false);
    }
  }

  /* ========================================================
     CHARGEMENT
  ======================================================== */

  if (loading) {
    return (
      <div className="flex min-h-[55vh] w-full items-center justify-center bg-white px-4">
        <div
          role="status"
          className="flex flex-col items-center gap-3"
        >
          <RefreshCw
            size={30}
            className="animate-spin text-[#087d2d]"
          />

          <p className="text-sm font-semibold text-[#66798a]">
            {t.loading}
          </p>
        </div>
      </div>
    );
  }

  /* ========================================================
     ERREUR / ÉVÉNEMENT INTROUVABLE
  ======================================================== */

  if (!event || error) {
    return (
      <div className="flex min-h-[55vh] w-full items-center justify-center bg-white px-4">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <Ticket
            size={42}
            className="text-[#91aa98]"
          />

          <h1 className="text-xl font-black text-[#143b28]">
            {t.unavailable}
          </h1>

          <p className="text-sm text-[#6e7e8e]">
            {t.loadError}
          </p>

          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() =>
                setRetryCount(
                  (current) => current + 1
                )
              }
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#087d2d] px-5 text-sm font-bold text-white"
            >
              <RefreshCw size={16} />
              {t.retry}
            </button>

            <Link
              href="/explore"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d8e5da] px-5 text-sm font-bold text-[#087d2d]"
            >
              <ArrowLeft size={16} />
              {t.back}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ========================================================
     DONNÉES DE PRÉSENTATION
  ======================================================== */

  const locationLabel =
    event.venue
      ? [
          event.venue.name,
          event.venue.city,
          displayCountry(
            event.venue.country,
            locale
          ),
        ]
          .filter(Boolean)
          .join(", ")
      : t.locationUnavailable;

  const mapAddress =
    event.venue?.mapQuery ??
    event.venue?.fullAddress ??
    null;

  const mapEmbed =
    makeMapEmbed(mapAddress);

  const canCheckout =
    calculation.valid &&
    calculation.ticketCount > 0 && !checkoutStarting;

  const checkoutMessage =
    checkoutError || checkoutNotice ? (
      <div
        role="status"
        className="mt-3 rounded-xl border border-[#d8e7dd] bg-[#f5faf6] p-3 text-xs leading-relaxed text-[#45604e]"
      >
        <p className="font-extrabold text-[#164c2a]">
          {checkoutError || t.checkoutPending}
        </p>

        

        
      </div>
    ) : null;

  return (
    <div className="w-full min-w-0 bg-white pb-[var(--event-checkout-height,160px)] text-[#182c3a] lg:pb-0">

      {/* ==================================================
          NAVIGATION SECONDAIRE
      ================================================== */}

      <div className="flex w-full min-w-0 items-center gap-2 overflow-hidden px-4 py-4 text-xs sm:px-6 lg:px-9">
        <Link
          href="/explore"
          aria-label={t.back}
          className="mr-1 flex size-9 shrink-0 items-center justify-center rounded-full border border-[#e1e9e3] text-[#234332]"
        >
          <ArrowLeft size={19} />
        </Link>

        <Link
          href="/explore"
          className="font-semibold text-[#506879]"
        >
          {t.explore}
        </Link>

        <ChevronRight
          size={15}
          className="shrink-0 text-[#a8b4ba]"
        />

        <span className="min-w-0 truncate font-extrabold text-[#087d2d]">
          {event.title}
        </span>
      </div>

      {/* ==================================================
          STRUCTURE PC ET MOBILE

          PC :
          GALERIE | INFORMATIONS | BILLETS

          MOBILE :
          GALERIE
          INFORMATIONS
          BILLETS
          TOTAL
      ================================================== */}

      <div className="grid w-full min-w-0 grid-cols-1 items-start gap-4 px-4 pb-4 sm:px-6 lg:grid-cols-12 lg:gap-5 lg:px-9 xl:gap-6">

        {/* ==================================================
            1. GALERIE
        ================================================== */}

        <section className="min-w-0 lg:col-span-4">
          <EventGallery key={event.id} event={event} />
        </section>

        {/* ==================================================
            2. INFORMATIONS ÉVÉNEMENT
        ================================================== */}

        <section className="min-w-0 space-y-4 lg:col-span-4">

          {/* CATÉGORIE ET TITRE */}

          <div>
            <span className="inline-flex max-w-full rounded-lg bg-[#ffeb77] px-3 py-1.5 text-xs font-extrabold text-[#725400]">
              <PublicCategoryIcon category={event.category} size={18} /> {eventCategoryLabel(event.category, locale)}
            </span>

            <h1 className="mt-3 wrap-break-word text-[27px] font-black leading-tight tracking-tight text-[#074329] sm:text-3xl lg:text-[29px] xl:text-[34px]">
              {event.title}
            </h1>
          </div>

          {/* DATE / HEURE / LIEU */}

          <div className="space-y-3 border-b border-[#e7ece8] pb-4">
            {selectedSchedule ? (
              <>
                <div className="flex items-start gap-3">
                  <CalendarDays
                    size={20}
                    className="mt-0.5 shrink-0 text-[#087d2d]"
                  />

                  <div className="min-w-0">
                    <p className="text-[11px] text-[#85929b]">
                      {t.date}
                    </p>

                    <p className="text-sm font-semibold text-[#283d4a]">
                      {formatEventDate(
                        selectedSchedule.startsAt,
                        selectedSchedule.timeZone,
                        locale
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock3
                    size={20}
                    className="mt-0.5 shrink-0 text-[#087d2d]"
                  />

                  <div>
                    <p className="text-[11px] text-[#85929b]">
                      {t.time}
                    </p>

                    <p className="text-sm font-semibold text-[#283d4a]">
                      {formatEventTime(
                        selectedSchedule.startsAt,
                        selectedSchedule.timeZone,
                        locale
                      )}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-[#738593]">
                {t.scheduleUnavailable}
              </p>
            )}

            <div className="flex items-start gap-3">
              <MapPin
                size={20}
                className="mt-0.5 shrink-0 text-[#087d2d]"
              />

              <div className="min-w-0">
                <p className="text-[11px] text-[#85929b]">
                  {t.location}
                </p>

                <p className="text-sm font-semibold leading-relaxed text-[#283d4a]">
                  {locationLabel}
                </p>
              </div>
            </div>
          </div>

          {/* ORGANISATEUR */}

          <OrganizerProfile
            organizer={event.organizer}
            locale={locale}
          />

          {/* DESCRIPTION */}

          <div className="border-b border-[#e7ece8] pb-5">
            <h2 className="mb-2 text-lg font-black text-[#06472b]">
              {t.description}
            </h2>

            <p className="whitespace-pre-line wrap-break-word text-sm leading-[1.75] text-[#425466]">
              {event.description}
            </p>
          </div>

          {/* ==================================================
              LOCALISATION ET CARTE
          ================================================== */}

          <div>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-[#06472b]">
              <MapPin
                size={21}
                className="text-[#087d2d]"
              />
              {t.location}
            </h2>

            {event.venue ? (
              <div className="space-y-3">

                {/* PHOTO DU LIEU */}

                {event.venue.imageUrl && (
                  <SafePicture
                    src={event.venue.imageUrl}
                    alt={event.venue.name}
                    className="aspect-video w-full rounded-xl"
                  />
                )}

                {/* ADRESSE */}

                <p className="text-sm font-semibold leading-relaxed text-[#405463]">
                  {event.venue.fullAddress}
                </p>

                {/* GOOGLE MAPS */}

                {mapEmbed && (
                  <div className="overflow-hidden rounded-xl border border-[#dfe9e2] bg-[#edf3ee]">
                    <iframe
                      title={`${t.location} — ${event.title}`}
                      src={mapEmbed}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      className="h-55 w-full border-0 sm:h-60"
                    />
                  </div>
                )}

                {/* ITINÉRAIRE */}

                {event.venue.mapUrl && (
                  <a
                    href={event.venue.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-extrabold text-[#087d2d] hover:underline"
                  >
                    <MapPin size={16} />

                    {t.openMap}

                    <ArrowRight size={14} />
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#738593]">
                {t.mapUnavailable}
              </p>
            )}
          </div>

          {/* ==================================================
              SÉANCES MULTIPLES
          ================================================== */}

          {event.schedules.length > 1 && (
            <div className="rounded-xl border border-[#e0eae3] bg-[#fbfdfb] p-3">
              <label
                htmlFor="event-schedule"
                className="mb-2 block text-xs font-extrabold text-[#254633]"
              >
                {t.chooseSchedule}
              </label>

              <select
                id="event-schedule"
                value={selectedScheduleId}
                onChange={(change) => {
                  setSelectedScheduleId(
                    change.target.value
                  );
                  setCheckoutNotice(false);
                }}
                className="min-h-11 w-full rounded-lg border border-[#d9e4dc] bg-white px-3 text-xs font-semibold text-[#365162] outline-none focus:border-[#087d2d]"
              >
                {event.schedules.map(
                  (schedule) => (
                    <option
                      key={schedule.id}
                      value={schedule.id}
                    >
                      {schedule.label
                        ? `${schedule.label} — `
                        : ""}

                      {formatEventDate(
                        schedule.startsAt,
                        schedule.timeZone,
                        locale
                      )}
                    </option>
                  )
                )}
              </select>
            </div>
          )}
        </section>

        {/* ==================================================
            3. CATÉGORIES ET QUANTITÉS
        ================================================== */}

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:col-span-4">

          <div className="overflow-hidden rounded-2xl border border-[#dfe9e2] bg-white shadow-[0_4px_20px_rgba(13,49,28,0.055)]">

            {/* TITRE BILLETS */}

            <div className="flex items-center gap-3 border-b border-[#e9eee9] px-4 py-4">
              <Ticket
                size={24}
                className="text-[#e8a500]"
              />

              <div>
                <h2 className="text-xl font-black text-[#07472a]">
                  {t.tickets}
                </h2>

                <p className="text-[11px] text-[#80909a]">
                  {t.ticketCategories}
                </p>
              </div>
            </div>

            {/* LISTE DES TARIFS */}

            <div className="space-y-3 p-3 sm:p-4">

              {ticketCategories.length === 0 ? (
                <div className="rounded-xl bg-[#f4f7f4] px-4 py-8 text-center text-sm text-[#768696]">
                  {t.noTickets}
                </div>
              ) : (
                ticketCategories.map(
                  (category) => {
                    const quantity =
                      quantities[category.id] ??
                      0;

                    const price =
                      readMoney(
                        category.price
                      );

                    const maximum =
                      Math.min(
                        MAX_TICKETS_PER_CATEGORY,
                        Math.max(
                          0,
                          category.capacity
                        )
                      );

                    const currencyValid =
                      category.currency
                        .toUpperCase() ===
                      event.currency.toUpperCase();

                    const disabled =
                      maximum === 0 ||
                      !currencyValid ||
                      price === null ||
                      price < 0n;

                    const selected =
                      quantity > 0;

                    return (
                      <div
                        key={category.id}
                        className={`rounded-xl border p-3 transition-colors ${
                          selected
                            ? "border-[#087d2d] bg-[#f3fbf5]"
                            : "border-[#e2eae4] bg-white"
                        }`}
                      >
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          {/* CATÉGORIE */}

                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#fff5da] text-[#dc9b00]">
                                <Ticket size={19} />
                              </span>

                              <h3 className="wrap-break-word text-sm font-extrabold text-[#24352c]">
                                {category.name}
                              </h3>

                              {selected && (
                                <Check
                                  size={16}
                                  className="shrink-0 text-[#087d2d]"
                                />
                              )}
                            </div>

                            {category.description && (
                              <p className="mt-2 text-xs leading-relaxed text-[#718293]">
                                {category.description}
                              </p>
                            )}
                          </div>

                          {/* PRIX ET QUANTITÉ */}

                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <strong className="text-right text-sm font-black text-[#d32325]">
                              {price !== null
                                ? formatMoney(
                                    price,
                                    category.currency,
                                    locale
                                  )
                                : t.priceUnavailable}
                            </strong>

                            <QuantityControl
                              value={quantity}
                              maximum={maximum}
                              disabled={disabled}
                              onChange={(next) =>
                                changeQuantity(
                                  category.id,
                                  next
                                )
                              }
                            />
                          </div>
                        </div>

                        {!currencyValid && (
                          <p className="mt-2 text-[11px] text-[#bd5229]">
                            {t.currencyMismatch}
                          </p>
                        )}
                      </div>
                    );
                  }
                )
              )}

              
            </div>
          </div>

          {/* RÉCAPITULATIF PC */}

          <div className="hidden lg:block">
            <OrderSummary
              calculation={calculation}
              currency={event.currency}
              locale={locale}
            />
          </div>

          {/* COMMANDE PC */}

          <div className="hidden lg:block">
            <button
              type="button"
              disabled={!canCheckout}
              onClick={handleCheckout}
              className="flex min-h-13 w-full items-center justify-center gap-3 rounded-2xl bg-linear-to-b from-[#25af00] to-[#006e29] px-4 py-3.5 text-sm font-black text-white shadow-[0_5px_12px_rgba(4,100,37,0.16)] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Wallet size={23} />

              {t.checkout}
            </button>

            {checkoutMessage}
          </div>
        </aside>
      </div>

      {/* ==================================================
          AVANTAGES

          VERSION TABLETTE / PC
      ================================================== */}

      <section className="mx-4 mb-4 hidden grid-cols-4 gap-3 rounded-2xl border border-[#e5ece6] bg-[#fcfdfc] px-4 py-5 sm:mx-6 sm:grid lg:mx-9">
        <div className="flex items-center justify-center gap-2">
          <ShieldCheck
            size={23}
            className="text-[#087d2d]"
          />

          <span className="text-xs font-bold text-[#304638]">
            {t.securePayment}
          </span>
        </div>

        <div className="flex items-center justify-center gap-2">
          <Zap
            size={23}
            className="text-[#e6a600]"
          />

          <span className="text-xs font-bold text-[#304638]">
            {t.instantTicket}
          </span>
        </div>

        <div className="flex items-center justify-center gap-2">
          <QrCode
            size={23}
            className="text-[#087d2d]"
          />

          <span className="text-xs font-bold text-[#304638]">
            {t.qrCode}
          </span>
        </div>

        <div className="flex items-center justify-center gap-2">
          <Headphones
            size={23}
            className="text-[#087d2d]"
          />

          <span className="text-xs font-bold text-[#304638]">
            {t.support}
          </span>
        </div>
      </section>

      {/* ==================================================
          RÉCAPITULATIF MOBILE / TABLETTE
      ================================================== */}

      <div className="mx-4 mb-3 sm:mx-6 lg:hidden">
        <OrderSummary
          calculation={calculation}
          currency={event.currency}
          locale={locale}
        />

        {checkoutMessage}
      </div>

      {/* ==================================================
          ESPACE POUR LA BARRE FIXE MOBILE
      ================================================== */}



      {/* ==================================================
          BARRE DE COMMANDE MOBILE

          Placée au-dessus de la navigation
          publique mobile existante.

          Aucun second menu créé.
      ================================================== */}

      <div
        ref={mobileCheckoutRef}
        className="fixed right-0 left-0 z-40 border-t border-[#e0e9e2] bg-white/98 px-3 pt-2.5 pb-2 shadow-[0_-5px_18px_rgba(18,49,28,0.08)] backdrop-blur-sm lg:hidden"
        style={{
          bottom:
            "calc(76px + env(safe-area-inset-bottom))",
        }}
      >
        <div className="w-full">
          <div className="mb-2 flex min-w-0 items-center justify-between gap-3 rounded-xl bg-[#eaf8ee] px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-[#577465]">
                {t.total}
              </p>

              <p className="wrap-break-word text-lg font-black leading-tight text-[#075429]">
                {formatMoney(
                  calculation.totalMinor,
                  event.currency,
                  locale
                )}
              </p>

              <p className="mt-0.5 text-[10px] text-[#688477]">
                {t.feeIncluded}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#087d2d]">
              <Ticket size={15} />
              {calculation.ticketCount}
            </div>
          </div>

          <button
            type="button"
            disabled={!canCheckout}
            onClick={handleCheckout}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-b from-[#24ae00] to-[#006d28] px-4 py-3 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
          >
            <CreditCard size={19} />

            {t.checkout}

            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
