
"use client";
import { VerifiedBadge } from "@/components/public/PublicNavigation";
import { currencyDecimals, formatMinorMoney, currencySymbol } from "@/i18n/config";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  type FormEvent,
} from "react";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Heart,
  ImageOff,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UserRound,
  UsersRound,
  Wallet,
  Zap,
} from "lucide-react";

/* ==========================================================
   TIKEMIA — DÉTAILS D'UNE CAGNOTTE

   FICHIER :
   src/app/(public)/campaigns/[slug]/page.tsx

   URL :
   /campaigns/soutien-aux-soins-de-koffi

   API EXISTANTE :
   GET /api/public/campaigns/[slug]

   INFORMATIONS :
   - Galerie réelle
   - Titre
   - Description complète
   - Pays et ville
   - Date de lancement
   - Date de fin si réellement disponible
   - Nom de l'organisateur
   - Photo de l'organisateur
   - Objectif
   - Montant récolté
   - Pourcentage
   - Nombre de dons confirmés
   - Champ de don libre
   - Bouton Faire un don

   RÈGLE FINANCIÈRE :
   - Les dons ont 1 % de frais.
   - Ces frais ne sont PAS appliqués ici.
   - Cette page transmettra uniquement
     le montant choisi à la future caisse.
   - Aucun paiement n'est simulé.

   EXCLUSIONS :
   - Aucun événement
   - Aucun billet
   - Aucune catégorie
   - Aucun filtre
   - Aucune recherche
   - Aucune géolocalisation IP
   - Aucun donateur nommé
   - Aucune liste des derniers dons
   - Aucune image décorative ajoutée
   - Aucun nouveau modèle Prisma
   - Aucun nouveau composant externe
   - Aucun fichier CSS supplémentaire

   RESPONSIVE :
   - PC : disposition 3 colonnes
   - Mobile : disposition verticale
   - Footer PC conservé
   - Footer mobile masqué
   - Navigation existante conservée

   MISE À JOUR :
   Rafraîchissement toutes les 15 s
   lorsque la page est visible.
========================================================== */

const REFRESH_INTERVAL_MS = 15_000;
const MAX_GALLERY_IMAGES = 10;

type Locale = "fr" | "en";

type Money = {
  amountMinor: string;
  currency: string;
};

type CampaignImage = {
  id: string;
  url: string | null;
  storageKey: string;
  isPrimary: boolean;
  position: number;
};

type CampaignOrganizer = {
  blueBadgeEnabled?: boolean;
  id: string;
  name: string;
  profileName: string;
  photoUrl: string | null;
  photoStorageKey: string | null;
};

type CampaignLocation = {
  country: string | null;
  city: string | null;
  fullLocation: string | null;
};

type CampaignDates = {
  launchedAt: string | null;
  publishedAt: string | null;
  closedAt: string | null;
  updatedAt: string;
  scheduledEndAt: string | null;
};

type CampaignFunding = {
  goal: Money;
  collected: Money;
  remaining: Money;
  percentage: number;
  progressPercentage: number;
  donationCount: number;
  goalReached: boolean;
};

type CampaignDetails = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: "PUBLISHED";

  imageUrl: string | null;
  imageStorageKey: string | null;
  images: CampaignImage[];

  organizer: CampaignOrganizer;
  location: CampaignLocation;
  dates: CampaignDates;
  funding: CampaignFunding;

  currency: string;
  publishedAt: string | null;
  closedAt: string | null;
  updatedAt: string;
  href: string;
};

type CampaignResponse = {
  success: boolean;
  generatedAt?: string;
  data?: {
    campaign?: CampaignDetails;
  };
};

/* ==========================================================
   TRADUCTIONS
========================================================== */

const TEXT = {
  fr: {
    back: "Retour",
    campaigns: "Cagnottes / Dons",
    details: "Détails",

    organizedBy: "Organisée par",
    description: "Description",
    location: "Localisation",
    launchDate: "Lancée le",
    endDate: "Fin prévue le",
    closedDate: "Fermée le",

    collected: "Montant collecté",
    goal: "Objectif",
    remaining: "Reste à collecter",
    reached: "Objectif atteint",

    participants: "dons confirmés",
    singleParticipant: "don confirmé",

    donationTitle: "Faire un don",
    donationAmount: "Montant de votre don",
    enterAmount: "Saisissez votre montant",
    currency: "Devise",
    continueDonation: "Faire un don",
    minimumAmount:
      "Saisissez un montant supérieur à zéro.",
    invalidAmount:
      "Veuillez saisir un montant valide.",
    tooManyDecimals:
      "Le montant comporte trop de décimales pour cette devise.",
    amountTooLarge:
      "Le montant saisi dépasse la limite autorisée pour un don.",

    amountChosen: "Montant choisi",
    

    pendingTitle:
      "Impossible d’ouvrir le paiement. Réessayez.",
    pendingDescription:
      "Votre montant est prêt. La prochaine étape permettra de confirmer le don et d'ajouter les frais de 1 % avant le paiement.",
    pendingSafety:
      "Aucun don ni paiement n'a été effectué.",

    secureDonation: "Don sécurisé",
    transparency: "Transparence",
    updatedAmounts: "Collecte actualisée",
    support: "Soutenir une cause",

    loading: "Chargement de la cagnotte...",
    unavailable: "Cagnotte indisponible",
    error:
      "Impossible de charger les détails de cette cagnotte.",
    retry: "Réessayer",
    backToCampaigns: "Voir les cagnottes",

    noImage: "Image indisponible",
    noLocation: "Localisation non précisée",
    noDate: "Date non précisée",

    previousImage: "Image précédente",
    nextImage: "Image suivante",
    image: "Image",

    refreshed: "Montants actualisés",
  },

  en: {
    back: "Back",
    campaigns: "Fundraisers",
    details: "Details",

    organizedBy: "Organized by",
    description: "Description",
    location: "Location",
    launchDate: "Launched on",
    endDate: "Scheduled end",
    closedDate: "Closed on",

    collected: "Amount raised",
    goal: "Goal",
    remaining: "Remaining",
    reached: "Goal reached",

    participants: "confirmed donations",
    singleParticipant: "confirmed donation",

    donationTitle: "Make a donation",
    donationAmount: "Your donation amount",
    enterAmount: "Enter your amount",
    currency: "Currency",
    continueDonation: "Donate",
    minimumAmount:
      "Enter an amount greater than zero.",
    invalidAmount:
      "Enter a valid amount.",
    tooManyDecimals:
      "Too many decimal places for this currency.",
    amountTooLarge:
      "The entered amount exceeds the allowed donation limit.",

    amountChosen: "Selected amount",
    

    pendingTitle:
      "Payment is temporarily unavailable.",
    pendingDescription:
      "Your amount is ready. The next step will confirm your donation and add the 1% fee before payment.",
    pendingSafety:
      "No donation or payment has been made.",

    secureDonation: "Secure donation",
    transparency: "Transparency",
    updatedAmounts: "Updated fundraising",
    support: "Support a cause",

    loading: "Loading fundraiser...",
    unavailable: "Fundraiser unavailable",
    error:
      "Unable to load this fundraiser.",
    retry: "Try again",
    backToCampaigns: "Browse fundraisers",

    noImage: "Image unavailable",
    noLocation: "Location not specified",
    noDate: "Date not specified",

    previousImage: "Previous image",
    nextImage: "Next image",
    image: "Image",

    refreshed: "Amounts updated",
  },
} as const;

/* ==========================================================
   UTILITAIRE — URL DES IMAGES
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
      process.env.NODE_ENV !== "production" &&
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

/* ==========================================================
   UTILITAIRE — DEVISES
========================================================== */

function currencyDigits(
  currency: string
): number { return currencyDecimals(currency); }

/* ==========================================================
   UTILITAIRE — MONTANTS FINANCIERS

   Le serveur utilise les unités mineures.

   Le client utilise BigInt pour conserver
   la précision du montant.

   Exemples :
   XOF : 5000 = 5 000 FCFA
   EUR : 500000 = 5 000,00 €
   USD : 500000 = 5 000,00 $
========================================================== */

function readMinorAmount(
  money: Money | null | undefined
): bigint | null {
  if (
    !money ||
    typeof money.amountMinor !== "string" ||
    !/^-?\d+$/.test(money.amountMinor)
  ) {
    return null;
  }

  try {
    return BigInt(money.amountMinor);
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
   VALIDATION DU MONTANT SAISI

   Aucun montant prédéfini.

   Le visiteur saisit librement
   son montant.

   On prend en charge :
   - 5000
   - 5000,50
   - 5000.50

   Les décimales doivent respecter
   la devise de la cagnotte.

   Le montant transmis à la future
   caisse devra être en unités mineures.

   AUCUN FRAIS DE 1 % CALCULÉ ICI.
========================================================== */

type ParsedDonation =
  | {
      valid: true;
      amountMinor: bigint;
    }
  | {
      valid: false;
      reason:
        | "empty"
        | "invalid"
        | "decimals"
        | "too-large";
    };

function parseDonationAmount(
  raw: string,
  currency: string
): ParsedDonation {
  const value = raw.trim();

  if (!value) {
    return {
      valid: false,
      reason: "empty",
    };
  }

  /*
   * Les séparateurs de milliers ne sont
   * pas acceptés pour éviter toute
   * ambiguïté entre 1.000 et 1,000.
   */

  if (!/^\d+(?:[.,]\d+)?$/.test(value)) {
    return {
      valid: false,
      reason: "invalid",
    };
  }

  const normalized = value.replace(",", ".");
  const parts = normalized.split(".");

  const digits = currencyDigits(currency);

  const integerPart = parts[0] || "0";
  const decimalPart = parts[1] || "";

  if (decimalPart.length > digits) {
    return {
      valid: false,
      reason: "decimals",
    };
  }

  try {
    const divisor =
      10n ** BigInt(digits);

    const integerAmount =
      BigInt(integerPart) * divisor;

    const decimalAmount =
      decimalPart
        ? BigInt(
            decimalPart.padEnd(digits, "0")
          )
        : 0n;

    const amountMinor =
      integerAmount + decimalAmount;

    if (amountMinor <= 0n) {
      return {
        valid: false,
        reason: "invalid",
      };
    }

    /*
     * Borne de sécurité pour la saisie.
     * Le backend devra aussi vérifier
     * les limites du prestataire de paiement.
     */

    if (
      amountMinor >
      9_000_000_000_000_000n
    ) {
      return {
        valid: false,
        reason: "too-large",
      };
    }

    return {
      valid: true,
      amountMinor,
    };
  } catch {
    return {
      valid: false,
      reason: "invalid",
    };
  }
}

/* ==========================================================
   UTILITAIRE — PAYS
========================================================== */

function displayCountry(
  value: string | null,
  locale: Locale
): string {
  if (!value) return "";

  const country = value.trim();

  if (!/^[a-z]{2}$/i.test(country)) {
    return country;
  }

  try {
    return (
      new Intl.DisplayNames([locale], {
        type: "region",
      }).of(country.toUpperCase()) ??
      country
    );
  } catch {
    return country;
  }
}

/* ==========================================================
   UTILITAIRE — DATE
========================================================== */

function formatDate(
  value: string | null | undefined,
  locale: Locale
): string | null {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat(
      locale === "fr" ? "fr-FR" : "en-US",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }
    ).format(date);
  } catch {
    return null;
  }
}

/* ==========================================================
   UTILITAIRE — PROGRESSION
========================================================== */

function safeProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(value, 100));
}

function formatPercentage(
  value: number,
  locale: Locale
): string {
  const number =
    Number.isFinite(value) ? value : 0;

  return new Intl.NumberFormat(
    locale === "fr" ? "fr-FR" : "en-US",
    {
      maximumFractionDigits: 1,
    }
  ).format(number);
}

/* ==========================================================
   IMAGE AVEC SOLUTION DE REPLI
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
  const resolved = safeImageUrl(src);

  const [failedSource, setFailedSource] = useState<string | null>(null);

  

  if (!resolved || (failedSource === resolved)) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center bg-[#e9f1eb] text-[#91a99a] ${className}`}
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
   GALERIE DES PHOTOS

   Images réellement publiées
   par l'organisateur.

   Aucun élément décoratif ajouté.
========================================================== */

function CampaignGallery({
  campaign,
  locale,
}: {
  campaign: CampaignDetails;
  locale: Locale;
}) {
  const t = TEXT[locale];

  const images = useMemo(() => {
    if (campaign.images.length > 0) {
      return campaign.images.slice(
        0,
        MAX_GALLERY_IMAGES
      );
    }

    if (!campaign.imageUrl) {
      return [];
    }

    return [
      {
        id: "primary",
        url: campaign.imageUrl,
        storageKey:
          campaign.imageStorageKey ?? "",
        isPrimary: true,
        position: 0,
      },
    ];
  }, [campaign]);

  const [requestedIndex, setActiveIndex] = useState(0);
  const activeIndex = Math.min(requestedIndex, Math.max(0, images.length - 1));

  

  const currentImage =
    images[activeIndex] ?? null;

  function changeImage(direction: number) {
    if (images.length < 2) return;

    setActiveIndex(
      (current) =>
        (current + direction + images.length) %
        images.length
    );
  }

  return (
    <div className="w-full min-w-0">
      {/* GRANDE IMAGE */}

      <div className="relative aspect-16/11 w-full overflow-hidden rounded-2xl bg-[#e9f1eb] lg:aspect-5/4 lg:max-h-120">
        <SafePicture
          src={currentImage?.url ?? null}
          alt={`${campaign.title} — ${t.image} ${activeIndex + 1}`}
          priority
          className="h-full w-full"
        />

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => changeImage(-1)}
              aria-label={t.previousImage}
              className="absolute top-1/2 left-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[#173b29] shadow-md"
            >
              <ChevronLeft size={21} />
            </button>

            <button
              type="button"
              onClick={() => changeImage(1)}
              aria-label={t.nextImage}
              className="absolute top-1/2 right-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[#173b29] shadow-md"
            >
              <ChevronRight size={21} />
            </button>
          </>
        )}

        {images.length > 0 && (
          <span className="absolute right-3 bottom-3 rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold text-white">
            {activeIndex + 1}/{images.length}
          </span>
        )}
      </div>

      {/* MINIATURES */}

      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              aria-label={`${t.image} ${index + 1}`}
              aria-pressed={index === activeIndex}
              onClick={() => setActiveIndex(index)}
              className={`h-15 w-19.5 shrink-0 overflow-hidden rounded-xl border-[3px] sm:h-18.5 sm:w-23.5 ${
                index === activeIndex
                  ? "border-[#07842e]"
                  : "border-transparent"
              }`}
            >
              <SafePicture
                src={image.url}
                alt={`${campaign.title} — ${index + 1}`}
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
   PROFIL PUBLIC ORGANISATEUR
========================================================== */

function OrganizerProfile({
  organizer,
  locale,
}: {
  organizer: CampaignOrganizer;
  locale: Locale;
}) {
  const t = TEXT[locale];

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#e3ece6] bg-[#fbfdfb] p-3">
      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#d7e6da] bg-[#e8f5eb] text-[#087d2e]">
        {safeImageUrl(organizer.photoUrl) ? (
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
        <p className="text-[11px] text-[#788898]">
          {t.organizedBy}
        </p>

        <p className=" text-sm font-extrabold text-[#183c2a] flex min-w-0 items-center gap-1">
          <span className="min-w-0 truncate">{organizer.name}</span>{organizer.blueBadgeEnabled && <VerifiedBadge />}
        </p>
      </div>
    </div>
  );
}

/* ==========================================================
   PROGRESSION FINANCIÈRE

   La réponse API contient :
   - Objectif
   - Montant réellement collecté
   - Pourcentage
   - Nombre de dons confirmés

   Aucun nom de donateur affiché.
========================================================== */

function FundingPanel({
  campaign,
  locale,
}: {
  campaign: CampaignDetails;
  locale: Locale;
}) {
  const t = TEXT[locale];

  const goal =
    readMinorAmount(campaign.funding.goal) ?? 0n;

  const collected =
    readMinorAmount(campaign.funding.collected) ?? 0n;

  const percentage =
    Number.isFinite(campaign.funding.percentage)
      ? campaign.funding.percentage
      : 0;

  const progress =
    safeProgress(
      campaign.funding.progressPercentage
    );

  return (
    <section className="rounded-2xl border border-[#e1e9e3] bg-white p-4 shadow-[0_4px_18px_rgba(13,49,28,0.055)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#667886]">
            {t.collected}
          </p>

          <p className="mt-1 wrap-break-word text-[23px] font-black leading-tight text-[#064c27] sm:text-[27px]">
            {formatMoney(
              collected,
              campaign.currency,
              locale
            )}
          </p>

          <p className="mt-2 text-sm text-[#667588]">
            {t.goal} :{" "}
            <strong className="font-extrabold text-[#304837]">
              {formatMoney(
                goal,
                campaign.currency,
                locale
              )}
            </strong>
          </p>
        </div>

        <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-linear-to-b from-[#25b600] to-[#00752b] text-base font-black text-white shadow-md">
          {formatPercentage(percentage, locale)}%
        </div>
      </div>

      {/* BARRE DE PROGRESSION */}

      <div
        role="progressbar"
        aria-label={t.collected}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        className="mt-5 h-3 w-full overflow-hidden rounded-full bg-[#e2eee4]"
      >
        <div
          className="h-full rounded-full bg-linear-to-r from-[#149d29] to-[#07832a] transition-[width] duration-500"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>

      {campaign.funding.goalReached && (
        <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-[#087c2d]">
          <CheckCircle2 size={16} />
          {t.reached}
        </div>
      )}

      {/* NOMBRE DE DONS */}

      <div className="mt-5 flex items-center gap-3 border-t border-[#edf1ed] pt-4">
        <div className="flex size-11 items-center justify-center rounded-xl bg-[#fff4d7] text-[#d99a00]">
          <UsersRound size={24} />
        </div>

        <div>
          <p className="text-xl font-black leading-tight text-[#1b2e28]">
            {new Intl.NumberFormat(
              locale === "fr" ? "fr-FR" : "en-US"
            ).format(
              campaign.funding.donationCount
            )}
          </p>

          <p className="text-xs text-[#617586]">
            {campaign.funding.donationCount === 1
              ? t.singleParticipant
              : t.participants}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================
   FORMULAIRE DE DON

   UN SEUL CHAMP DE MONTANT.

   Aucun montant présélectionné.
   Aucun calcul de frais.
   Aucune création de paiement.

   Le bouton ouvre la caisse de la plateforme.
========================================================== */

function DonationForm({
  campaignId,
  currency,
  locale,
}: {
  campaignId: string;
  currency: string;
  locale: Locale;
}) {
  const t = TEXT[locale];
  const requestId = useRef<string | null>(null);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);

  const [amount, setAmount] =
    useState("");

  const [attempted, setAttempted] =
    useState(false);

  const [checkoutNotice, setCheckoutNotice] =
    useState(false);

  const parsed = useMemo(
    () => parseDonationAmount(amount, currency),
    [amount, currency]
  );

  

  let errorMessage: string | null = null;

  if (attempted && !parsed.valid) {
    if (parsed.reason === "decimals") {
      errorMessage = t.tooManyDecimals;
    } else if (parsed.reason === "too-large") {
      errorMessage = t.amountTooLarge;
    } else if (parsed.reason === "empty") {
      errorMessage = t.minimumAmount;
    } else {
      errorMessage = t.invalidAmount;
    }
  }

  async function handleSubmit(
    submitEvent: FormEvent<HTMLFormElement>
  ) {
    submitEvent.preventDefault();
    setAttempted(true);

    if (!parsed.valid) {
      setCheckoutNotice(false);
      return;
    }

    if (submitting.current) return;
    submitting.current = true; setBusy(true); setCheckoutNotice(false);
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/public/checkout", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create-donation", campaignId, amountMinor: parsed.amountMinor.toString(), requestId: requestId.current }) });
      const result = await response.json();
      if (!response.ok || !result.success || typeof result.data?.checkoutUrl !== "string" || !result.data.checkoutUrl.startsWith("/checkout?")) throw new Error("CHECKOUT_FAILED");
      window.location.assign(result.data.checkoutUrl);
    } catch { setCheckoutNotice(true); }
    finally { submitting.current = false; setBusy(false); }
  }

  function updateAmount(value: string) {
    setAmount(value);
    requestId.current = null;
    setCheckoutNotice(false);
    setAttempted(false);
  }

  return (
    <section className="rounded-2xl border border-[#e0e9e2] bg-white p-4 shadow-[0_4px_18px_rgba(13,49,28,0.055)] sm:p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-[#074c2a]">
        <Heart
          size={21}
          className="text-[#087f2e]"
        />
        {t.donationTitle}
      </h2>

      <form
        onSubmit={handleSubmit} aria-busy={busy}
        noValidate
      >
        <label
          htmlFor="tikemia-donation-amount"
          className="mb-2 block text-xs font-extrabold text-[#435a4b]"
        >
          {t.donationAmount} ({currencySymbol(currency)})
        </label>

        <div className="relative">
          <Wallet
            size={19}
            aria-hidden="true"
            className="pointer-events-none absolute top-3.5 left-3.5 text-[#647c6c]"
          />

          <input
            id="tikemia-donation-amount"
            name="amount"
            type="text"
            inputMode={
              currencyDigits(currency) === 0
                ? "numeric"
                : "decimal"
            }
            autoComplete="off"
            maxLength={30}
            value={amount}
            onChange={(event) =>
              updateAmount(event.target.value)
            }
            placeholder={t.enterAmount}
            aria-invalid={Boolean(errorMessage)}
            aria-describedby={
              errorMessage
                ? "tikemia-donation-error"
                : undefined
            }
            className={`h-12 w-full rounded-xl border bg-[#fbfdfb] pr-20 pl-11 text-sm font-semibold text-[#223c2d] outline-none placeholder:font-normal placeholder:text-[#90a096] focus:ring-2 ${
              errorMessage
                ? "border-[#d74646] focus:ring-[#d74646]/10"
                : "border-[#dce7df] focus:border-[#087d2e] focus:ring-[#087d2e]/10"
            }`}
          />

          <span className="pointer-events-none absolute top-4 right-3 text-xs font-extrabold text-[#3b634a]">
            {currency}
          </span>
        </div>

        {errorMessage && (
          <p
            id="tikemia-donation-error"
            role="alert"
            className="mt-2 text-xs font-semibold text-[#bd3737]"
          >
            {errorMessage}
          </p>
        )}

        

        {/* AUCUN FRAIS AFFICHÉ */}

        <button
          type="submit" disabled={busy}
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-b from-[#24ae00] to-[#006d28] px-4 py-3 text-sm font-black text-white shadow-[0_4px_10px_rgba(4,100,37,0.15)] transition-opacity hover:opacity-95"
        >
          <Heart size={21} />
          {t.continueDonation}
          <ArrowRight size={16} />
        </button>
      </form>

      {/* MESSAGE QUAND LA CAISSE N'EXISTE PAS ENCORE */}

      {checkoutNotice && parsed.valid && (
        <div
          role="status"
          className="mt-4 rounded-xl border border-[#d7e9dc] bg-[#f4fbf6] p-3"
        >
          <p className="text-xs font-extrabold text-[#07542b]">
            {t.pendingTitle}
          </p>

          <p className="mt-2 text-xs leading-relaxed text-[#4c6655]">
            {t.amountChosen} :{" "}
            <strong>
              {formatMoney(
                parsed.amountMinor,
                currency,
                locale
              )}
            </strong>
          </p>

          

          
        </div>
      )}
    </section>
  );
}

/* ==========================================================
   PAGE PRINCIPALE
========================================================== */

export default function CampaignDetailsPage() {
  const params =
    useParams<{ slug: string }>();

  const slug = params.slug;

  const [locale, setLocale] =
    useState<Locale>("fr");

  const t = TEXT[locale];

  const [campaign, setCampaign] =
    useState<CampaignDetails | null>(null);

  const router = useRouter();
  useEffect(() => {
    if (campaign?.slug && campaign.slug !== slug) {
      router.replace("/campaigns/" + encodeURIComponent(campaign.slug));
    }
  }, [campaign?.slug, slug, router]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(false);

  const [notFound, setNotFound] =
    useState(false);

  const [retryCount, setRetryCount] =
    useState(0);

  

  /* ========================================================
     LANGUE EXISTANTE TIKEMIA
  ======================================================== */

  useEffect(() => {
    function synchronizeLanguage() {
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

      const htmlLocale =
        document.documentElement.lang
          .toLowerCase();

      setLocale(
        htmlLocale.startsWith("en")
          ? "en"
          : "fr"
      );
    }

    synchronizeLanguage();

    window.addEventListener(
      "storage",
      synchronizeLanguage
    );

    window.addEventListener(
      "tikemia:locale-changed",
      synchronizeLanguage
    );

    return () => {
      window.removeEventListener(
        "storage",
        synchronizeLanguage
      );

      window.removeEventListener(
        "tikemia:locale-changed",
        synchronizeLanguage
      );
    };
  }, []);

  /* ========================================================
     REQUÊTE API PUBLIQUE

     Aucun accès aux données privées.
  ======================================================== */

  const fetchCampaign = useCallback(
    async (
      signal: AbortSignal
    ): Promise<CampaignDetails> => {
      if (!slug) {
        throw new Error("INVALID_SLUG");
      }

      const response = await fetch(
        `/api/public/campaigns/${encodeURIComponent(slug)}`,
        {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          signal,
        }
      );

      if (response.status === 404) {
        throw new Error("NOT_FOUND");
      }

      if (!response.ok) {
        throw new Error("API_ERROR");
      }

      const result =
        (await response.json()) as CampaignResponse;

      if (
        result.success !== true ||
        !result.data?.campaign
      ) {
        throw new Error("INVALID_RESPONSE");
      }

      return result.data.campaign;
    },
    [slug]
  );

  /* ========================================================
     CHARGEMENT ET ACTUALISATION

     - Chargement initial
     - Toutes les 15 secondes
     - Retour sur l'onglet
     - Arrêt lors du démontage
     - Une seule requête en cours

     Les montants sont recalculés
     dans l'API à chaque requête.

     Pas de faux temps réel WebSocket.
  ======================================================== */

  useEffect(() => {
    const controller =
      new AbortController();

    let active = true;
    let running = false;
    let firstLoad = true;

    async function refresh() {
      if (
        !active ||
        running ||
        controller.signal.aborted
      ) {
        return;
      }

      running = true;

      if (firstLoad) {
        setLoading(true);
        setError(false);
        setNotFound(false);
      }

      try {
        const result =
          await fetchCampaign(controller.signal);

        if (
          !active ||
          controller.signal.aborted
        ) {
          return;
        }

        setCampaign(result);
        setError(false);
        setNotFound(false);
        
      } catch (reason) {
        if (
          !active ||
          controller.signal.aborted
        ) {
          return;
        }

        if (
          reason instanceof Error &&
          reason.message === "NOT_FOUND"
        ) {
          setCampaign(null);
          setNotFound(true);
          setError(false);
        } else if (firstLoad) {
          setError(true);
        }
      } finally {
        running = false;

        if (
          active &&
          !controller.signal.aborted
        ) {
          firstLoad = false;
          setLoading(false);
        }
      }
    }

    void refresh();

    const interval = window.setInterval(
      () => {
        if (
          document.visibilityState === "visible"
        ) {
          void refresh();
        }
      },
      REFRESH_INTERVAL_MS
    );

    function handleVisibility() {
      if (
        document.visibilityState === "visible"
      ) {
        void refresh();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [
    fetchCampaign,
    retryCount,
  ]);

  /* ========================================================
     LOADING
  ======================================================== */

  if (loading) {
    return (
      <div
        id="tikemia-campaign-detail"
        className="flex min-h-[55vh] w-full items-center justify-center bg-white px-4"
      >
        <div
          role="status"
          className="flex flex-col items-center gap-3"
        >
          <RefreshCw
            size={30}
            className="animate-spin text-[#087d2e]"
          />

          <p className="text-sm font-semibold text-[#63788a]">
            {t.loading}
          </p>
        </div>
      </div>
    );
  }

  /* ========================================================
     ERREUR / INTROUVABLE
  ======================================================== */

  if (!campaign || error || notFound) {
    return (
      <div
        id="tikemia-campaign-detail"
        className="flex min-h-[55vh] w-full items-center justify-center bg-white px-4"
      >
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <Heart
            size={43}
            className="text-[#94aa9b]"
          />

          <h1 className="text-xl font-black text-[#143c28]">
            {t.unavailable}
          </h1>

          <p className="text-sm text-[#708090]">
            {t.error}
          </p>

          <div className="flex flex-wrap justify-center gap-2">
            {!notFound && (
              <button
                type="button"
                onClick={() =>
                  setRetryCount(
                    (count) => count + 1
                  )
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#087d2d] px-5 text-sm font-bold text-white"
              >
                <RefreshCw size={16} />
                {t.retry}
              </button>
            )}

            <Link
              href="/campaigns"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d7e6da] px-5 text-sm font-bold text-[#087d2d]"
            >
              <ArrowLeft size={16} />
              {t.backToCampaigns}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ========================================================
     LOCALISATION
  ======================================================== */

  const country =
    displayCountry(
      campaign.location.country,
      locale
    );

  const location =
    [
      campaign.location.city,
      country,
    ]
      .filter(Boolean)
      .join(", ") ||
    t.noLocation;

  /* ========================================================
     DATES RÉELLES

     La date de fin prévue est
     facultative et null dans le
     Prisma actuel.

     closedAt correspond seulement
     à une fermeture effective.
  ======================================================== */

  const launchDate =
    formatDate(
      campaign.dates.launchedAt,
      locale
    );

  const scheduledEnd =
    formatDate(
      campaign.dates.scheduledEndAt,
      locale
    );

  const closedDate =
    formatDate(
      campaign.dates.closedAt,
      locale
    );

  /* ========================================================
     RENDU FINAL
  ======================================================== */

  return (
    <>
      {/* ==================================================
          FOOTER PUBLIC

          PC : visible
          MOBILE : masqué

          Le footer est déjà présent
          dans le layout public.

          Aucun nouveau footer créé.
      ================================================== */}

      

      <div
        id="tikemia-campaign-detail"
        className="w-full min-w-0 flex-1 bg-white text-[#192e3c]"
      >

        {/* ==================================================
            FIL D'ARIANE

            Navigation existante conservée.
        ================================================== */}

        <nav
          aria-label="Fil d'Ariane"
          className="flex w-full min-w-0 items-center gap-2 overflow-hidden px-4 py-4 text-xs sm:px-6 lg:px-9"
        >
          <Link
            href="/campaigns"
            aria-label={t.back}
            className="mr-1 flex size-9 shrink-0 items-center justify-center rounded-full border border-[#e1e9e3] bg-white text-[#234332] shadow-sm"
          >
            <ArrowLeft size={19} />
          </Link>

          <Link
            href="/campaigns"
            className="shrink-0 font-semibold text-[#506575] hover:text-[#087d2d]"
          >
            {t.campaigns}
          </Link>

          <ChevronRight
            size={15}
            className="shrink-0 text-[#aab5bb]"
          />

          <span className="min-w-0 truncate font-extrabold text-[#087d2d]">
            {campaign.title}
          </span>
        </nav>

        {/* ==================================================
            ARCHITECTURE DESKTOP

            GAUCHE :
            Galerie des images

            CENTRE :
            Titre, pays, ville, dates,
            organisateur, description

            DROITE :
            Montants et formulaire

            MOBILE :
            Éléments empilés
        ================================================== */}

        <div className="grid w-full min-w-0 grid-cols-1 items-start gap-4 px-4 pb-4 sm:px-6 lg:grid-cols-12 lg:gap-5 lg:px-9 xl:gap-6">

          {/* ==================================================
              COLONNE 1 — IMAGES
          ================================================== */}

          <section className="min-w-0 lg:col-span-4">
            <CampaignGallery key={campaign.id} 
              campaign={campaign}
              locale={locale}
            />
          </section>

          {/* ==================================================
              COLONNE 2 — INFORMATIONS
          ================================================== */}

          <section className="min-w-0 space-y-4 lg:col-span-4">

            {/* TITRE */}

            <div>
              <h1 className="wrap-break-word text-[27px] font-black leading-tight tracking-tight text-[#07432a] sm:text-3xl lg:text-[29px] xl:text-[34px]">
                {campaign.title}
              </h1>
            </div>

            {/* LOCALISATION ET DATES */}

            <div className="space-y-3 border-b border-[#e7ece8] pb-4">

              {/* PAYS / VILLE */}

              <div className="flex items-start gap-3">
                <MapPin
                  size={20}
                  className="mt-0.5 shrink-0 text-[#087d2d]"
                />

                <div className="min-w-0">
                  <p className="text-[11px] text-[#84929c]">
                    {t.location}
                  </p>

                  <p className="text-sm font-semibold leading-relaxed text-[#304453]">
                    {location}
                  </p>
                </div>
              </div>

              {/* DATE DE LANCEMENT */}

              {launchDate && (
                <div className="flex items-start gap-3">
                  <CalendarDays
                    size={20}
                    className="mt-0.5 shrink-0 text-[#087d2d]"
                  />

                  <div>
                    <p className="text-[11px] text-[#84929c]">
                      {t.launchDate}
                    </p>

                    <p className="text-sm font-semibold text-[#304453]">
                      {launchDate}
                    </p>
                  </div>
                </div>
              )}

              {/* DATE DE FIN PROGRAMMÉE */}

              {scheduledEnd && (
                <div className="flex items-start gap-3">
                  <CalendarDays
                    size={20}
                    className="mt-0.5 shrink-0 text-[#087d2d]"
                  />

                  <div>
                    <p className="text-[11px] text-[#84929c]">
                      {t.endDate}
                    </p>

                    <p className="text-sm font-semibold text-[#304453]">
                      {scheduledEnd}
                    </p>
                  </div>
                </div>
              )}

              {/* FERMETURE RÉELLE */}

              {closedDate && (
                <div className="flex items-start gap-3">
                  <CalendarDays
                    size={20}
                    className="mt-0.5 shrink-0 text-[#087d2d]"
                  />

                  <div>
                    <p className="text-[11px] text-[#84929c]">
                      {t.closedDate}
                    </p>

                    <p className="text-sm font-semibold text-[#304453]">
                      {closedDate}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ORGANISATEUR */}

            <OrganizerProfile
              organizer={campaign.organizer}
              locale={locale}
            />

            {/* DESCRIPTION COMPLÈTE */}

            <div>
              <h2 className="mb-3 text-lg font-black text-[#06472b]">
                {t.description}
              </h2>

              <p className="whitespace-pre-line wrap-break-word text-sm leading-[1.8] text-[#415566]">
                {campaign.description}
              </p>
            </div>
          </section>

          {/* ==================================================
              COLONNE 3 — COLLECTE ET DON
          ================================================== */}

          <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:col-span-4">

            {/* MONTANTS ET PROGRESSION */}

            <FundingPanel
              campaign={campaign}
              locale={locale}
            />

            {/* SAISIE LIBRE DU MONTANT */}

            <DonationForm
              campaignId={campaign.id}
              key={campaign.id}
              currency={campaign.currency}
              locale={locale}
            />
          </aside>
        </div>

        {/* ==================================================
            AVANTAGES

            UNIQUEMENT LES INFORMATIONS
            DU SERVICE.

            AUCUNE IMAGE DÉCORATIVE.

            AUCUNE LISTE DE DONATEURS.
        ================================================== */}

        <section className="mx-4 mb-4 grid grid-cols-2 gap-3 rounded-2xl border border-[#e5ede6] bg-[#fcfdfc] p-4 sm:mx-6 sm:grid-cols-4 lg:mx-9 lg:gap-4 lg:p-5">

          <div className="flex items-center gap-2 sm:justify-center">
            <ShieldCheck
              size={23}
              className="shrink-0 text-[#087d2d]"
            />

            <span className="text-xs font-bold text-[#34493b]">
              {t.secureDonation}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:justify-center">
            <Zap
              size={23}
              className="shrink-0 text-[#e7aa00]"
            />

            <span className="text-xs font-bold text-[#34493b]">
              {t.transparency}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:justify-center">
            <UsersRound
              size={23}
              className="shrink-0 text-[#087d2d]"
            />

            <span className="text-xs font-bold text-[#34493b]">
              {t.updatedAmounts}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:justify-center">
            <Heart
              size={23}
              className="shrink-0 text-[#db3448]"
            />

            <span className="text-xs font-bold text-[#34493b]">
              {t.support}
            </span>
          </div>
        </section>

        {/* ==================================================
            FIN DE LA PAGE

            PAS DE :
            - Derniers dons
            - Liste de participants
            - Noms de donateurs
            - Image de stéthoscope
            - Image décorative
            - Événement
            - Catégorie
            - Géolocalisation IP
            - Footer supplémentaire

            La navigation mobile est
            toujours celle du layout public.
        ================================================== */}
      </div>
    </>
  );
}
