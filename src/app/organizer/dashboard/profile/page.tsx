
"use client";
import { VerifiedBadge } from "@/components/public/PublicNavigation";

import OrganizerAvatar from "@/components/organizer/OrganizerAvatar";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Link from "next/link";

import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Globe2,
  IdCard,
  LockKeyhole,
  Mail,
  MapPin,
  Pencil,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
  LoaderCircle,
} from "lucide-react";

import {
  defaultLocale,
  i18nConfig,
  normalizeLocale,
  type Locale,
} from "@/i18n/config";

/* ==========================================================
   TIKEMIA — MON PROFIL ORGANISATEUR

   Fichier :
   src/app/organizer/dashboard/profile/page.tsx

   URL :
   /organizer/dashboard/profile

   API :
   GET /api/organizer/settings/profile

   Modification :
   /organizer/dashboard/settings

   Fonctionnalités :
   - Profil utilisateur
   - Informations de l'organisation
   - Adresse email en lecture seule
   - Statut de vérification de l'email
   - Mise à jour depuis PostgreSQL
   - Actualisation manuelle
   - Actualisation au retour sur la page
   - Actualisation lors de la navigation
   - Français / Anglais
   - Responsive PC / mobile
   - Pleine largeur disponible

   IMPORTANT :
   La sidebar et la navigation mobile
   sont déjà fournies par le layout
   du dashboard organisateur.

   Aucun faux solde ou chiffre d'activité
   n'est affiché ici.
========================================================== */

const API_URL =
  "/api/organizer/settings/profile";

const SETTINGS_URL =
  "/organizer/dashboard/settings";

const REFRESH_INTERVAL = 15_000;

type ProfileOrganization = {
  blueBadgeEnabled: boolean;
  id: string;
  name: string;
  description: string | null;
  email: string | null;
  phoneE164: string | null;
  countryCode: string | null;
  city: string | null;
  logoStorageKey: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type ProfileData = {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  phoneE164: string | null;
  countryCode: string | null;
  preferredLocale: string;
  avatarStorageKey: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  organizationId: string;
  organizationName: string;
  organizationPhoneE164: string | null;
  organizationCountryCode: string | null;
  organizationCity: string | null;
  organization: ProfileOrganization;
  organizations: {
    id: string;
    name: string;
  }[];
};

type JsonRecord = Record<string, unknown>;

const TEXT = {
  fr: {
    pageTitle: "Mon profil",
    subtitle:
      "Consultez vos informations personnelles et professionnelles.",

    organizer: "Compte organisateur",
    personalTitle: "Informations personnelles",
    organizationTitle: "Mon organisation",

    fullName: "Nom complet",
    firstName: "Prénom",
    lastName: "Nom",
    email: "Adresse email",
    phone: "Numéro de téléphone",
    country: "Pays",
    city: "Ville",

    organizationName: "Nom de l'organisation",
    organizationEmail: "Email de l'organisation",
    organizationPhone:
      "Téléphone de l'organisation",

    organizationDescription:
      "Description de l'organisation",

    accountCreated: "Compte créé le",
    organizationCreated:
      "Organisation créée le",

    emailVerified: "Email vérifié",
    emailNotVerified: "Email non vérifié",

    emailLocked:
      "L'adresse email du compte ne peut pas être modifiée depuis les paramètres.",

    edit: "Modifier mon profil",
    settings: "Paramètres",
    refresh: "Actualiser",

    loading: "Chargement de votre profil...",
    error:
      "Impossible de récupérer les informations de votre profil.",
    retry: "Réessayer",

    noInformation: "Non renseigné",
    organizationCount: "Organisations",
    otherOrganizations: "Mes organisations",

    profileUpdated:
      "Informations synchronisées avec votre compte TIKEMIA.",

    lastRefresh: "Dernière actualisation",
    securityTitle: "Gestion sécurisée",
    securityText:
      "Les informations affichées proviennent de votre compte. Les modifications sont enregistrées dans votre espace Paramètres.",

    openSettings: "Ouvrir les paramètres",
    close: "Fermer",
  },

  en: {
    pageTitle: "My profile",
    subtitle:
      "View your personal and organization details.",

    organizer: "Organizer account",
    personalTitle: "Personal information",
    organizationTitle: "My organization",

    fullName: "Full name",
    firstName: "First name",
    lastName: "Last name",
    email: "Email address",
    phone: "Phone number",
    country: "Country",
    city: "City",

    organizationName: "Organization name",
    organizationEmail: "Organization email",
    organizationPhone:
      "Organization phone number",

    organizationDescription:
      "Organization description",

    accountCreated: "Account created on",
    organizationCreated:
      "Organization created on",

    emailVerified: "Email verified",
    emailNotVerified: "Email not verified",

    emailLocked:
      "Your account email address cannot be changed in Settings.",

    edit: "Edit my profile",
    settings: "Settings",
    refresh: "Refresh",

    loading: "Loading your profile...",
    error:
      "Unable to load your profile information.",
    retry: "Try again",

    noInformation: "Not provided",
    organizationCount: "Organizations",
    otherOrganizations: "My organizations",

    profileUpdated:
      "Information synchronized with your TIKEMIA account.",

    lastRefresh: "Last refreshed",
    securityTitle: "Secure account management",
    securityText:
      "The information displayed comes from your account. Changes are saved in your Settings area.",

    openSettings: "Open settings",
    close: "Close",
  },
} as const;

/* ==========================================================
   STYLES RÉUTILISABLES
========================================================== */

const PANEL_CLASS = [
  "w-full min-w-0",
  "rounded-2xl",
  "border border-[#e0e8ed]",
  "bg-white shadow-sm",
  "p-4 sm:p-5 lg:p-6",
].join(" ");

const PRIMARY_BUTTON_CLASS = [
  "inline-flex min-h-11",
  "items-center justify-center gap-2",
  "rounded-xl",
  "bg-[#07862d]",
  "px-4 py-2.5",
  "text-sm font-extrabold text-white",
  "transition-colors",
  "hover:bg-[#056e24]",
  "focus-visible:outline-none",
  "focus-visible:ring-2",
  "focus-visible:ring-green-500",
  "focus-visible:ring-offset-2",
].join(" ");

const SECONDARY_BUTTON_CLASS = [
  "inline-flex min-h-11",
  "items-center justify-center gap-2",
  "rounded-xl",
  "border border-[#d8e2e8]",
  "bg-white px-4 py-2.5",
  "text-sm font-bold text-[#34465c]",
  "transition-colors",
  "hover:bg-[#f2f7f3]",
  "disabled:cursor-not-allowed",
  "disabled:opacity-50",
].join(" ");

/* ==========================================================
   UTILITAIRES
========================================================== */

function asRecord(
  value: unknown
): JsonRecord {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as JsonRecord;
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

function asOptionalString(
  value: unknown
): string | null {
  return typeof value === "string" &&
    value.trim().length > 0
    ? value.trim()
    : null;
}

function asDate(
  value: unknown
): string | null {
  if (
    typeof value !== "string" ||
    !Number.isFinite(Date.parse(value))
  ) {
    return null;
  }

  return value;
}

function normalizeProfile(
  value: unknown
): ProfileData {
  const source = asRecord(value);
  const org = asRecord(source.organization);

  const organizations = Array.isArray(
    source.organizations
  )
    ? source.organizations
        .map((item) => {
          const current = asRecord(item);

          return {
            id: asString(current.id),
            name: asString(current.name),
          };
        })
        .filter((item) => Boolean(item.id))
    : [];

  const organization: ProfileOrganization = {
    blueBadgeEnabled: org.blueBadgeEnabled === true,
    id: asString(
      org.id,
      asString(source.organizationId)
    ),

    name: asString(
      org.name,
      asString(source.organizationName)
    ),

    description: asOptionalString(
      org.description
    ),

    email: asOptionalString(org.email),

    phoneE164: asOptionalString(
      org.phoneE164 ??
        source.organizationPhoneE164
    ),

    countryCode: asOptionalString(
      org.countryCode ??
        source.organizationCountryCode
    ),

    city: asOptionalString(
      org.city ??
        source.organizationCity
    ),

    logoStorageKey: asOptionalString(
      org.logoStorageKey
    ),

    createdAt: asDate(org.createdAt),
    updatedAt: asDate(org.updatedAt),
  };

  return {
    id: asString(
      source.id,
      asString(source.userId)
    ),

    fullName: asString(source.fullName),
    firstName: asString(source.firstName),
    lastName: asString(source.lastName),

    email: asString(source.email),

    emailVerified:
      source.emailVerified === true,

    phoneE164: asOptionalString(
      source.phoneE164
    ),

    countryCode: asOptionalString(
      source.countryCode
    ),

    preferredLocale: asString(
      source.preferredLocale,
      "fr"
    ),

    avatarStorageKey: asOptionalString(
      source.avatarStorageKey
    ),

    createdAt: asDate(source.createdAt),
    updatedAt: asDate(source.updatedAt),

    organizationId: organization.id,
    organizationName: organization.name,
    organizationPhoneE164:
      organization.phoneE164,

    organizationCountryCode:
      organization.countryCode,

    organizationCity: organization.city,

    organization,
    organizations,
  };
}

function formatDate(
  value: string | null,
  locale: Locale
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    locale === "fr"
      ? "fr-FR"
      : "en-GB",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  ).format(date);
}

function formatTime(
  value: Date,
  locale: Locale
): string {
  return new Intl.DateTimeFormat(
    locale === "fr"
      ? "fr-FR"
      : "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(value);
}

function formatCountry(
  countryCode: string | null,
  locale: Locale
): string {
  if (!countryCode) {
    return "—";
  }

  try {
    const names = new Intl.DisplayNames(
      [locale],
      {
        type: "region",
      }
    );

    return (
      names.of(
        countryCode.toUpperCase()
      ) ?? countryCode
    );
  } catch {
    return countryCode;
  }
}

function displayName(
  profile: ProfileData
): string {
  const combined =
    `${profile.firstName} ${profile.lastName}`.trim();

  return combined || profile.fullName || "—";
}

/* ==========================================================
   BLOC D'INFORMATION
========================================================== */

function InformationItem({
  icon: IconComponent,
  label,
  value,
  description,
  locked = false,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  description?: string;
  locked?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-[#edf1f4] bg-[#fafcfd] p-3 sm:p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf7ed] text-[#087d2c]">
        <IconComponent
          size={20}
          strokeWidth={2}
          aria-hidden="true"
        />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold text-[#67758a] sm:text-sm">
            {label}
          </p>

          {locked && (
            <LockKeyhole
              size={13}
              className="text-[#8a96a8]"
              aria-hidden="true"
            />
          )}
        </div>

        <p className="mt-1 wrap-break-word text-sm font-extrabold text-[#14243c] sm:text-base">
          {value || "—"}
        </p>

        {description && (
          <p className="mt-1 text-xs leading-relaxed text-[#8290a2]">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

/* ==========================================================
   EN-TÊTE DE SECTION
========================================================== */

function PanelHeader({
  icon: IconComponent,
  title,
  subtitle,
}: {
  icon: typeof UserRound;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5 flex min-w-0 items-start gap-3 border-b border-[#edf1f4] pb-4">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#e4f8e6] text-[#087d2c]">
        <IconComponent
          size={23}
          aria-hidden="true"
        />
      </div>

      <div className="min-w-0">
        <h2 className="text-base font-extrabold text-[#13243d] sm:text-lg lg:text-xl">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-1 text-xs leading-relaxed text-[#6b798c] sm:text-sm">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

/* ==========================================================
   PAGE PRINCIPALE
========================================================== */

export default function OrganizerProfilePage() {
  const [locale, setLocale] =
    useState<Locale>(defaultLocale);

  const [profile, setProfile] =
    useState<ProfileData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  const [activeOrganizationId, setActiveOrganizationId] =
    useState<string>("");

  const requestController =
    useRef<AbortController | null>(null);

  const mounted =
    useRef(true);

  const requestNumber =
    useRef(0);

  const t = TEXT[locale];

  /* ========================================================
     LANGUE FR / EN

     Le même stockage i18n est utilisé
     dans tout le projet TIKEMIA.
  ======================================================== */

  useEffect(() => {
    const synchronizeLanguage = () => {
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
        // Conserver la langue par défaut.
      }
    };

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
     CHARGER LE PROFIL DEPUIS POSTGRESQL

     Aucun stockage local des données
     personnelles ou professionnelles.
  ======================================================== */

  const loadProfileRequest = useCallback(
    async (
      background = false,
      organizationId?: string
    ) => {
      const currentRequest = ++requestNumber.current;

      requestController.current?.abort();

      const controller = new AbortController();

      requestController.current = controller;

      void background;

      
        const params = new URLSearchParams();

        if (organizationId) {
          params.set(
            "organizationId",
            organizationId
          );
        }

        const query = params.toString();

        const url = query
          ? `${API_URL}?${query}`
          : API_URL;

        return fetch(url, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        }).then(async (response) => {

        const result: unknown =
          await response.json();

        const data = asRecord(result);

        if (
          !response.ok ||
          data.success !== true ||
          !data.profile
        ) {
          throw new Error(
            asString(
              data.message,
              TEXT.fr.error
            )
          );
        }

        const normalized =
          normalizeProfile(data.profile);

        if (
          !normalized.id ||
          !normalized.organizationId
        ) {
          throw new Error(
            TEXT.fr.error
          );
        }

        if (
          !mounted.current ||
          controller.signal.aborted ||
          requestNumber.current !== currentRequest
        ) {
          return;
        }

        setProfile(normalized);
        setActiveOrganizationId(
          normalized.organizationId
        );
        setLastUpdated(new Date());
        setError("");
      
}).catch((caughtError) => {
        if (
          !mounted.current ||
          controller.signal.aborted ||
          requestNumber.current !== currentRequest
        ) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : TEXT.fr.error
        );
      }).finally(() => {
        if (
          mounted.current &&
          !controller.signal.aborted &&
          requestNumber.current === currentRequest
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    },
    []
  );
  const loadProfile = useCallback((background = false, organizationId?: string) => { if (background) setRefreshing(true); else setLoading(true); return loadProfileRequest(background, organizationId); }, [loadProfileRequest]);


  /* ========================================================
     CHARGEMENT INITIAL
  ======================================================== */

  useEffect(() => {
    mounted.current = true;

    void loadProfileRequest();

    return () => {
      mounted.current = false;
      requestController.current?.abort();
    };
  }, [loadProfileRequest]);

  /* ========================================================
     ACTUALISER LORSQUE LA PAGE
     REDEVIENT VISIBLE

     Cela permet de récupérer les modifications
     enregistrées depuis Paramètres ou depuis
     un autre appareil.
  ======================================================== */

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void loadProfile(
          true,
          activeOrganizationId || undefined
        );
      }
    };

    const refreshWhenFocused = () => {
      void loadProfile(
        true,
        activeOrganizationId || undefined
      );
    };

    window.addEventListener(
      "focus",
      refreshWhenFocused
    );

    document.addEventListener(
      "visibilitychange",
      refreshWhenVisible
    );

    const interval = window.setInterval(
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void loadProfile(
            true,
            activeOrganizationId || undefined
          );
        }
      },
      REFRESH_INTERVAL
    );

    return () => {
      window.removeEventListener(
        "focus",
        refreshWhenFocused
      );

      document.removeEventListener(
        "visibilitychange",
        refreshWhenVisible
      );

      window.clearInterval(interval);
    };
  }, [
    activeOrganizationId,
    loadProfile,
  ]);

  /* ========================================================
     ORGANISATIONS DISPONIBLES
  ======================================================== */

  const organizations =
    useMemo(() => {
      return profile?.organizations ?? [];
    }, [profile]);

  /* ========================================================
     CHARGEMENT INITIAL
  ======================================================== */

  if (
    loading &&
    !profile
  ) {
    return (
      <main className="flex min-h-[70vh] w-full items-center justify-center bg-[#f5f8fb] p-4">
        <div
          role="status"
          className="flex flex-col items-center gap-3 text-center"
        >
          <LoaderCircle
            size={37}
            className="animate-spin text-[#087b2a]"
            aria-hidden="true"
          />

          <p className="text-sm font-semibold text-[#617189]">
            {t.loading}
          </p>
        </div>
      </main>
    );
  }

  /* ========================================================
     ERREUR DE CHARGEMENT INITIAL
  ======================================================== */

  if (!profile) {
    return (
      <main className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-4 bg-[#f5f8fb] p-4 text-center">
        <CircleAlert
          size={42}
          className="text-red-600"
          aria-hidden="true"
        />

        <p
          role="alert"
          className="max-w-md text-sm font-semibold text-red-700"
        >
          {error || t.error}
        </p>

        <button
          type="button"
          onClick={() => {
            void loadProfile();
          }}
          className={PRIMARY_BUTTON_CLASS}
        >
          <RefreshCw
            size={18}
            aria-hidden="true"
          />

          {t.retry}
        </button>
      </main>
    );
  }

  /* ========================================================
     DONNÉES AFFICHÉES
  ======================================================== */

  const fullName =
    displayName(profile);



  const userCountry =
    formatCountry(
      profile.countryCode,
      locale
    );

  const organizationCountry =
    formatCountry(
      profile.organization.countryCode,
      locale
    );

  const editUrl =
    `${SETTINGS_URL}`;

  /* ========================================================
     INTERFACE PRINCIPALE
  ======================================================== */

  return (
    <main className="flex min-h-full w-full min-w-0 flex-col overflow-x-hidden bg-[#f5f8fb] pb-7 text-[#14243d]">
      {/* ====================================================
          EN-TÊTE PRINCIPAL

          Toute la largeur disponible.
          Aucun deuxième menu dashboard.
      ==================================================== */}

      <header className="relative w-full overflow-hidden border-b border-[#e1e8ed] bg-white">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-13 bg-linear-to-r from-[#e2ffd5] via-[#f2ffe7] to-[#fff2d5] opacity-80" />

        <div className="relative flex w-full min-w-0 flex-col gap-4 px-3 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-6 lg:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#e2f9e4] text-[#087e2b] sm:size-14">
              <UserRound
                size={29}
                strokeWidth={2.2}
                aria-hidden="true"
              />
            </div>

            <div className="min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight text-[#10213b] sm:text-2xl lg:text-3xl">
                {t.pageTitle}
              </h1>

              <p className="mt-1 text-xs leading-relaxed text-[#627188] sm:text-sm">
                {t.subtitle}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => {
                void loadProfile(
                  true,
                  activeOrganizationId
                );
              }}
              disabled={refreshing}
              className={SECONDARY_BUTTON_CLASS}
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
              href={editUrl}
              className={`${PRIMARY_BUTTON_CLASS} flex-1 sm:flex-none`}
            >
              <Pencil
                size={18}
                aria-hidden="true"
              />

              {t.edit}
            </Link>
          </div>
        </div>

        <div className="relative h-1 w-full bg-linear-to-r from-[#087d2a] via-[#77dc16] to-[#ffc527]" />
      </header>

      {/* ====================================================
          CONTENU COMPLET PLEINE LARGEUR
      ==================================================== */}

      <div className="flex w-full min-w-0 flex-1 flex-col gap-4 p-3 sm:p-5 lg:gap-5 lg:p-6">
        {/* ERREUR D'ACTUALISATION */}

        {error && (
          <div
            role="alert"
            className="flex min-w-0 items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          >
            <CircleAlert
              size={19}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />

            <span className="min-w-0 flex-1 wrap-break-word">
              {error}
            </span>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label={t.close}
            >
              <X
                size={18}
                aria-hidden="true"
              />
            </button>
          </div>
        )}

        {/* ==================================================
            CARTE DE PRÉSENTATION
        ================================================== */}

        <section className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-[#dce7df] bg-white shadow-sm">
          <div className="h-24 w-full bg-linear-to-r from-[#087d2d] via-[#19a437] to-[#9cde1a] sm:h-32" />

          <div className="relative flex w-full min-w-0 flex-col gap-4 px-4 pb-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:pb-6">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
              <OrganizerAvatar fullName={fullName} firstName={profile.firstName} lastName={profile.lastName} locale={locale} size="lg" editable className="-mt-8 shrink-0" />

              <div className="min-w-0 pb-1">
                <h2 className="wrap-break-word text-xl font-extrabold text-[#13243d] sm:text-2xl lg:text-[28px]">
                  {fullName}{profile.organization.blueBadgeEnabled && <VerifiedBadge />}
                </h2>

                <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-[#65758a] sm:text-sm">
                  <UsersRound
                    size={16}
                    className="shrink-0 text-green-700"
                    aria-hidden="true"
                  />

                  {t.organizer}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold ${
                      profile.emailVerified
                        ? "bg-[#e6f8e8] text-[#08772b]"
                        : "bg-[#fff3dc] text-[#986000]"
                    }`}
                  >
                    {profile.emailVerified ? (
                      <BadgeCheck
                        size={15}
                        aria-hidden="true"
                      />
                    ) : (
                      <Clock3
                        size={15}
                        aria-hidden="true"
                      />
                    )}

                    {profile.emailVerified
                      ? t.emailVerified
                      : t.emailNotVerified}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center lg:pb-1">
              <Link
                href={editUrl}
                className={SECONDARY_BUTTON_CLASS}
              >
                <Pencil
                  size={17}
                  aria-hidden="true"
                />

                {t.edit}
              </Link>
            </div>
          </div>
        </section>

        {/* ==================================================
            INFORMATIONS PERSONNELLES ET ORGANISATION

            Deux colonnes sur les grands écrans.
            Une colonne sur mobile.
            Pas de max-width inutile.
        ================================================== */}

        <div className="grid w-full min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2 lg:gap-5">
          {/* INFORMATIONS PERSONNELLES */}

          <section className={PANEL_CLASS}>
            <PanelHeader
              icon={UserRound}
              title={t.personalTitle}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InformationItem
                icon={UserRound}
                label={t.firstName}
                value={
                  profile.firstName ||
                  t.noInformation
                }
              />

              <InformationItem
                icon={UserRound}
                label={t.lastName}
                value={
                  profile.lastName ||
                  t.noInformation
                }
              />

              <div className="sm:col-span-2">
                <InformationItem
                  icon={IdCard}
                  label={t.fullName}
                  value={fullName}
                />
              </div>

              <div className="sm:col-span-2">
                <InformationItem
                  icon={Mail}
                  label={t.email}
                  value={
                    profile.email ||
                    t.noInformation
                  }
                  description={t.emailLocked}
                  locked
                />
              </div>

              <InformationItem
                icon={Phone}
                label={t.phone}
                value={
                  profile.phoneE164 ||
                  t.noInformation
                }
              />

              <InformationItem
                icon={Globe2}
                label={t.country}
                value={
                  userCountry !== "—"
                    ? userCountry
                    : t.noInformation
                }
              />

              <div className="sm:col-span-2">
                <InformationItem
                  icon={CalendarDays}
                  label={t.accountCreated}
                  value={formatDate(
                    profile.createdAt,
                    locale
                  )}
                />
              </div>
            </div>
          </section>

          {/* INFORMATIONS DE L'ORGANISATION */}

          <section className={PANEL_CLASS}>
            <PanelHeader
              icon={Building2}
              title={t.organizationTitle}
              subtitle={
                profile.organization.name
              }
            />

            {organizations.length > 1 && (
              <div className="mb-4">
                <label
                  htmlFor="profile-organization"
                  className="mb-1.5 block text-xs font-bold text-[#56667d] sm:text-sm"
                >
                  {t.otherOrganizations}
                </label>

                <select
                  id="profile-organization"
                  value={activeOrganizationId}
                  disabled={refreshing}
                  onChange={(event) => {
                    const nextId =
                      event.target.value;

                    setActiveOrganizationId(nextId);

                    void loadProfile(
                      true,
                      nextId
                    );
                  }}
                  className="min-h-11 w-full min-w-0 rounded-xl border border-[#d8e3e9] bg-white px-3 text-sm font-semibold text-[#14243d] outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                >
                  {organizations.map(
                    (organization) => (
                      <option
                        key={organization.id}
                        value={organization.id}
                      >
                        {organization.name}
                      </option>
                    )
                  )}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <InformationItem
                  icon={Building2}
                  label={t.organizationName}
                  value={
                    profile.organization.name ||
                    t.noInformation
                  }
                />
              </div>

              {profile.organization.email && (
                <div className="sm:col-span-2">
                  <InformationItem
                    icon={Mail}
                    label={t.organizationEmail}
                    value={
                      profile.organization.email
                    }
                  />
                </div>
              )}

              <InformationItem
                icon={Phone}
                label={t.organizationPhone}
                value={
                  profile.organization.phoneE164 ||
                  t.noInformation
                }
              />

              <InformationItem
                icon={Globe2}
                label={t.country}
                value={
                  organizationCountry !== "—"
                    ? organizationCountry
                    : t.noInformation
                }
              />

              <div className="sm:col-span-2">
                <InformationItem
                  icon={MapPin}
                  label={t.city}
                  value={
                    profile.organization.city ||
                    t.noInformation
                  }
                />
              </div>

              {profile.organization.description && (
                <div className="sm:col-span-2">
                  <InformationItem
                    icon={Building2}
                    label={t.organizationDescription}
                    value={
                      profile.organization.description
                    }
                  />
                </div>
              )}

              <div className="sm:col-span-2">
                <InformationItem
                  icon={CalendarDays}
                  label={t.organizationCreated}
                  value={formatDate(
                    profile.organization.createdAt,
                    locale
                  )}
                />
              </div>
            </div>
          </section>
        </div>

        {/* ==================================================
            SÉCURITÉ ET GESTION DU PROFIL
        ================================================== */}

        <section className={PANEL_CLASS}>
          <div className="flex w-full min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#e7f8e8] text-[#087b2b]">
                <ShieldCheck
                  size={24}
                  aria-hidden="true"
                />
              </div>

              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-[#13243d] sm:text-lg">
                  {t.securityTitle}
                </h2>

                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#66778b] sm:text-sm">
                  {t.securityText}
                </p>
              </div>
            </div>

            <Link
              href={SETTINGS_URL}
              className={`${PRIMARY_BUTTON_CLASS} w-full shrink-0 sm:w-auto`}
            >
              <LockKeyhole
                size={18}
                aria-hidden="true"
              />

              {t.openSettings}

              <ArrowRight
                size={17}
                aria-hidden="true"
              />
            </Link>
          </div>
        </section>

        {/* ==================================================
            SYNCHRONISATION
        ================================================== */}

        <div className="flex w-full flex-col gap-2 rounded-xl border border-[#d7e9db] bg-[#eff8f0] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex min-w-0 items-start gap-2 text-xs font-semibold leading-relaxed text-[#366844]">
            <CheckCircle2
              size={18}
              className="shrink-0"
              aria-hidden="true"
            />

            {t.profileUpdated}
          </p>

          {lastUpdated && (
            <p className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-[#487253]">
              <Clock3
                size={15}
                aria-hidden="true"
              />

              {t.lastRefresh} :{" "}
              {formatTime(lastUpdated, locale)}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
