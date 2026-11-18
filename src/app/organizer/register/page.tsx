
"use client";

import { OrganizerPublicHeader } from "@/components/organizer/OrganizerHeader";

import { Suspense, useSyncExternalStore } from "react";

function subscribeLocale(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readStoredLocale(): Locale {
  try {
    return normalizeLocale(window.localStorage.getItem(i18nConfig.storageKey) ?? defaultLocale);
  } catch {
    return defaultLocale;
  }
}


import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import {
  Building2,
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  Globe2,
  Heart,
  LoaderCircle,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  MapPin,
  Phone,
  Ticket,
  UserRound,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";

import {
  getCountries,
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

import {
  defaultLocale,
  i18nConfig,
  normalizeLocale,
  type Locale,
} from "@/i18n/config";

/* ==========================================
   TIKEMIA
   INSCRIPTION ORGANISATEUR

   Page : /organizer/register

   Next.js App Router
   TypeScript
   Tailwind CSS 4
   Français / Anglais
   Mobile / Tablette / PC
========================================== */

const ROUTES = {
  home: "/organizer",
  register: "/organizer/register",
  login: "/organizer/login",
  verify: "/organizer/verify-email",
  registerAPI: "/api/organizer/register",
  geoAPI: "/api/geo",
  terms: "/terms",
  privacy: "/privacy",
} as const;

const EMAIL_STORAGE_KEY =
  "tikemia_organizer_email";

const TEXT = {
  fr: {
    organizer: "Espace Organisateur",
    home: "Accueil",
    features: "Fonctionnalités",
    pricing: "Tarifs",
    support: "Assistance",
    login: "Se connecter",
    signup: "S'inscrire",

    title: "Créer un compte",
    titleAccent: "organisateur",
    subtitle:
      "Publiez vos événements, vendez vos billets et lancez vos cagnottes.",

    fullName: "Nom et prénom *",
    organization: "Nom d'organisation (optionnel)",
    email: "Adresse e-mail *",
    country: "Sélectionner un pays",
    countryLabel: "Pays",
    dialLabel: "Indicatif téléphonique",
    phone: "Numéro de téléphone *",

    accept: "J'accepte les",
    terms: "conditions d'utilisation",
    and: "et la",
    privacy: "politique de confidentialité",

    submit: "S'inscrire",
    submitting: "Inscription en cours...",

    existing: "Déjà un compte ?",
    world: "Inscription ouverte dans le monde entier.",

    benefitEvents: "Publiez vos événements",
    benefitCampaigns: "Lancez vos cagnottes",
    benefitResults: "Suivez vos résultats",

    invalidName: "Saisissez votre nom et prénom.",
    invalidOrganization:
      "Le nom d'organisation est trop long.",
    invalidEmail: "Adresse e-mail invalide.",
    invalidCountry: "Sélectionnez votre pays.",
    invalidDial: "Sélectionnez un indicatif.",
    invalidPhone: "Numéro de téléphone invalide.",
    invalidTerms:
      "Acceptez les conditions d'utilisation et la politique de confidentialité.",

    networkError:
      "Connexion impossible. Réessayez.",
    serverError:
      "Inscription indisponible. Réessayez.",

    menu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
    language: "Changer de langue",
  },

  en: {
    organizer: "Organizer Space",
    home: "Home",
    features: "Features",
    pricing: "Pricing",
    support: "Support",
    login: "Log in",
    signup: "Sign up",

    title: "Create an",
    titleAccent: "organizer account",
    subtitle:
      "Publish events, sell tickets and launch fundraisers.",

    fullName: "Full name *",
    organization: "Organization name (optional)",
    email: "Email address *",
    country: "Select a country",
    countryLabel: "Country",
    dialLabel: "Calling code",
    phone: "Phone number *",

    accept: "I accept the",
    terms: "Terms of Use",
    and: "and the",
    privacy: "Privacy Policy",

    submit: "Sign up",
    submitting: "Creating account...",

    existing: "Already have an account?",
    world: "Registration open worldwide.",

    benefitEvents: "Publish your events",
    benefitCampaigns: "Launch fundraisers",
    benefitResults: "Track your results",

    invalidName: "Enter your full name.",
    invalidOrganization:
      "Organization name is too long.",
    invalidEmail: "Invalid email address.",
    invalidCountry: "Select your country.",
    invalidDial: "Select a calling code.",
    invalidPhone: "Invalid phone number.",
    invalidTerms:
      "Accept the Terms of Use and Privacy Policy.",

    networkError:
      "Connection failed. Please try again.",
    serverError:
      "Registration unavailable. Please try again.",

    menu: "Open menu",
    closeMenu: "Close menu",
    language: "Change language",
  },
} as const;

/* ==========================================
   TYPES
========================================== */

type GeoResponse = {
  success?: boolean;
  countryCode?: string | null;
};

type RegisterResponse = {
  success?: boolean;
  message?: string;
  nextStep?: string;
};

type CountryOption = {
  code: CountryCode;
  name: string;
  flag: string;
  dialCode: string;
};

/* ==========================================
   UTILITAIRES
========================================== */

function getFlag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) {
    return "🌍";
  }

  return String.fromCodePoint(
    ...Array.from(code).map(
      (character) => character.charCodeAt(0) + 127397
    )
  );
}

function getCountryList(
  language: Locale
): CountryOption[] {
  const names = new Intl.DisplayNames(
    [language],
    { type: "region" }
  );

  return getCountries()
    .map((country) => ({
      code: country,
      name: names.of(country) ?? country,
      flag: getFlag(country),
      dialCode: `+${getCountryCallingCode(country)}`,
    }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, language, {
        sensitivity: "base",
      })
    );
}

function isValidEmail(email: string): boolean {
  return (
    email.length >= 3 &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function isValidPhone(phone: string, dialCode: string): boolean {
  if (!/^[+\d\s().-]+$/.test(phone)) {
    return false;
  }

  const cleaned = phone.replace(/[\s().-]/g, "");
  const internationalNumber = cleaned.startsWith("+")
    ? cleaned
    : `${dialCode}${cleaned}`;

  if (!/^\+[1-9]\d{6,14}$/.test(internationalNumber)) {
    return false;
  }

  return parsePhoneNumberFromString(internationalNumber)?.isValid() === true;
}

/* ==========================================
   PAGE PRINCIPALE
========================================== */

function OrganizerRegisterContent() {
  const legacyLogin = useSearchParams().get("mode") === "login";
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const router = useRouter();
  useEffect(() => { if (legacyLogin) router.replace("/organizer/login"); }, [legacyLogin, router]);

  const storedLocale = useSyncExternalStore(subscribeLocale, readStoredLocale, () => defaultLocale);
  const [selectedLocale, setLanguage] = useState<Locale | null>(null);
  const language = selectedLocale ?? storedLocale;

const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] =
    useState("");
  const [email, setEmail] = useState("");

  const [countryCode, setCountryCode] =
    useState<CountryCode | "">("");

  const [dialCode, setDialCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [acceptedTerms, setAcceptedTerms] =
    useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Empêche une réponse de géolocalisation
  // de remplacer un choix manuel.
  const countryChosenManually = useRef(false);

  // Empêche les doubles inscriptions.
  const submittingRef = useRef(false);

  const t = TEXT[language];

  /* ========================================
     PAYS DU MONDE
  ======================================== */

  const countries = useMemo(
    () => getCountryList(language),
    [language]
  );

  /* ========================================
     INDICATIFS INTERNATIONAUX
  ======================================== */

  const dialCodes = useMemo(() => {
    const codes = new Set(
      getCountries().map(
        (country) =>
          `+${getCountryCallingCode(country)}`
      )
    );

    return Array.from(codes).sort(
      (a, b) =>
        Number(a.slice(1)) - Number(b.slice(1))
    );
  }, []);

  /* ========================================
     LANGUE ENREGISTRÉE
  ======================================== */



  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  function changeLanguage(next: Locale) {
    setLanguage(next);


    try {
      window.localStorage.setItem(
        i18nConfig.storageKey,
        next
      );
    } catch {
      // Le changement reste actif sur la page.
    }
  }

  

  /* ========================================
     DÉTECTION AUTOMATIQUE DU PAYS
  ======================================== */

  useEffect(() => {
    const controller = new AbortController();

    async function detectCountry() {
      try {
        const response = await fetch(
          ROUTES.geoAPI,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          return;
        }

        const result: GeoResponse =
          await response.json();

        if (
          controller.signal.aborted ||
          countryChosenManually.current
        ) {
          return;
        }

        const detected =
          result.countryCode?.toUpperCase();

        if (
          result.success === true &&
          detected &&
          isSupportedCountry(detected)
        ) {
          const country = detected as CountryCode;

          setCountryCode((previous) =>
            previous || country
          );

          setDialCode((previous) =>
            previous ||
            `+${getCountryCallingCode(country)}`
          );
        }
      } catch {
        // La géolocalisation est facultative.
      }
    }

    void detectCountry();

    return () => controller.abort();
  }, []);

  /* ========================================
     CHANGEMENT MANUEL DU PAYS
  ======================================== */

  function handleCountryChange(value: string) {
    countryChosenManually.current = true;

    if (!isSupportedCountry(value)) {
      setCountryCode("");
      setDialCode("");
      setError("");
      return;
    }

    const selected = value as CountryCode;

    setCountryCode(selected);

    // Indicatif proposé automatiquement.
    // Il reste modifiable indépendamment.
    setDialCode(
      `+${getCountryCallingCode(selected)}`
    );

    setError("");
  }

  /* ========================================
     INSCRIPTION
  ======================================== */

  

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }

    setError("");

    const name = fullName
      .trim()
      .replace(/\s+/g, " ");

    const organization = organizationName
      .trim()
      .replace(/\s+/g, " ");

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    const phone = phoneNumber.trim();

    if (!isValidEmail(normalizedEmail)) { setError(t.invalidEmail); return; }
    if ((password.length < 8) || !password || new TextEncoder().encode(password).byteLength > 72) {
      setError(language === "fr" ? "Veuillez saisir un mot de passe valide." : "Please enter a valid password.");
      return;
    }
    

    if (name.length < 3 || name.length > 120) {
      setError(t.invalidName);
      return;
    }

    if (organization.length > 160) {
      setError(t.invalidOrganization);
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setError(t.invalidEmail);
      return;
    }

    if (
      !countryCode ||
      !isSupportedCountry(countryCode)
    ) {
      setError(t.invalidCountry);
      return;
    }

    if (!/^\+[1-9]\d{0,3}$/.test(dialCode)) {
      setError(t.invalidDial);
      return;
    }

    if (!isValidPhone(phone, dialCode)) {
      setError(t.invalidPhone);
      return;
    }

    if (!acceptedTerms) {
      setError(t.invalidTerms);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const response = await fetch(
        ROUTES.registerAPI,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName: name,
            password,
            organizationName: organization,
            email: normalizedEmail,
            countryCode,
            dialCode,
            phoneNumber: phone,
            acceptedTerms: true,
            locale: language,
          }),
        }
      );

      const result: RegisterResponse =
        await response.json().catch(() => ({}));

      if (!response.ok || result.success !== true) {
        setError(result.message || t.serverError);
        return;
      }

      // Email conservé pour la validation OTP.
      try {
        window.sessionStorage.setItem(
          EMAIL_STORAGE_KEY,
          normalizedEmail
        );
      } catch {
        // Le formulaire OTP permet aussi
        // une saisie manuelle de l'email.
      }

      router.push(ROUTES.verify);
    } catch {
      setError(t.networkError);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  /* ========================================
     INTERFACE
  ======================================== */

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-white text-[#101828]">
      {/* ====================================
          HEADER
      ==================================== */}

      <OrganizerPublicHeader locale={language} onLocaleChange={changeLanguage} />

      {/* ====================================
          CONTENU PRINCIPAL
      ==================================== */}

      <main className="relative min-h-[calc(100svh-64px)] xl:min-h-[calc(100svh-76px)] w-full bg-[#fafbfc]">
        <div className="grid min-h-[calc(100svh-64px)] xl:min-h-[calc(100svh-76px)] w-full grid-cols-1 lg:grid-cols-[42%_58%]">
          {/* ================================
              VISUEL GAUCHE PC
          ================================ */}

          <section className="relative hidden min-h-full overflow-hidden bg-[#06452a] lg:block">
            <Image
              src="/images/orgaccueil.png"
              alt=""
              fill
              priority
              sizes="42vw"
              className="object-cover object-center"
            />

            <div className="absolute inset-0 bg-linear-to-t from-[#003d24]/75 via-transparent to-transparent" />

            <div className="absolute inset-x-4 bottom-6 rounded-3xl border border-white/70 bg-white/95 p-4 shadow-xl backdrop-blur-sm xl:inset-x-7">
              <div className="grid grid-cols-3 divide-x divide-gray-200">
                <div className="flex flex-col items-center gap-2 px-2 text-center">
                  <Ticket
                    size={34}
                    strokeWidth={2.5}
                    className="-rotate-12 text-[#f5ae00]"
                  />

                  <span className="text-xs leading-snug font-extrabold text-[#101828] xl:text-sm">
                    {t.benefitEvents}
                  </span>
                </div>

                <div className="flex flex-col items-center gap-2 px-2 text-center">
                  <Heart
                    size={34}
                    strokeWidth={2.5}
                    className="text-red-500"
                  />

                  <span className="text-xs leading-snug font-extrabold text-[#101828] xl:text-sm">
                    {t.benefitCampaigns}
                  </span>
                </div>

                <div className="flex flex-col items-center gap-2 px-2 text-center">
                  <ChartNoAxesColumnIncreasing
                    size={34}
                    strokeWidth={2.5}
                    className="text-green-700"
                  />

                  <span className="text-xs leading-snug font-extrabold text-[#101828] xl:text-sm">
                    {t.benefitResults}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ================================
              FORMULAIRE INSCRIPTION
          ================================ */}

          <section className="flex w-full items-start justify-center px-3 py-4 sm:px-6 sm:py-5 lg:px-7 xl:px-9">
            <div className="w-full max-w-215 rounded-2xl border border-gray-100 bg-white px-4 py-5 shadow-[0_8px_35px_rgba(0,0,0,0.08)] sm:rounded-3xl sm:px-6 sm:py-6 xl:px-10">
              {/* TITRE */}

              <div className="mb-5 text-center">
                <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <div className="flex size-15 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-800">
                    <UsersRound size={34} />
                  </div>

                  <h1 className="text-[25px] leading-tight font-black tracking-tight sm:text-3xl xl:text-[36px]">
                    {t.title}{" "}
                    <span className="text-[#128c09]">
                      {t.titleAccent}
                    </span>
                  </h1>
                </div>

                <div className="mx-auto mt-3 h-1.5 w-17 rounded-full bg-[#ffc400]" />

                <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-gray-600 sm:text-base">
                  {t.subtitle}
                </p>
              </div>

              {/* FORMULAIRE */}

              <form
                onSubmit={handleSubmit}
                noValidate
                className="flex w-full flex-col gap-3"
              >
                <>
                {/* NOM ET PRÉNOM */}

                <div className="relative">
                  <label
                    htmlFor="register-fullname"
                    className="sr-only"
                  >
                    {t.fullName}
                  </label>

                  <UserRound
                    size={22}
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-gray-800"
                  />

                  <input
                    id="register-fullname"
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    maxLength={120}
                    required
                    value={fullName}
                    onChange={(event) => {
                      setFullName(event.target.value);
                      setError("");
                    }}
                    disabled={submitting}
                    placeholder={t.fullName}
                    className="min-h-12 w-full rounded-xl border border-gray-300 bg-white py-3 pr-4 pl-12 text-base text-gray-950 shadow-sm outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-100 disabled:opacity-60"
                  />
                </div>

                {/* ORGANISATION */}

                <div className="relative">
                  <label
                    htmlFor="register-organization"
                    className="sr-only"
                  >
                    {t.organization}
                  </label>

                  <Building2
                    size={22}
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-gray-800"
                  />

                  <input
                    id="register-organization"
                    name="organizationName"
                    type="text"
                    autoComplete="organization"
                    maxLength={160}
                    value={organizationName}
                    onChange={(event) => {
                      setOrganizationName(event.target.value);
                      setError("");
                    }}
                    disabled={submitting}
                    placeholder={t.organization}
                    className="min-h-12 w-full rounded-xl border border-gray-300 bg-white py-3 pr-4 pl-12 text-base text-gray-950 shadow-sm outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-100 disabled:opacity-60"
                  />
                </div>

                </>
                {/* EMAIL */}

                <div className="relative">
                  <label
                    htmlFor="register-email"
                    className="sr-only"
                  >
                    {t.email}
                  </label>

                  <Mail
                    size={22}
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-gray-800"
                  />

                  <input
                    id="register-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    maxLength={254}
                    required
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError("");
                    }}
                    disabled={submitting}
                    placeholder={t.email}
                    className="min-h-12 w-full rounded-xl border border-gray-300 bg-white py-3 pr-4 pl-12 text-base text-gray-950 shadow-sm outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-100 disabled:opacity-60"
                  />
                </div>

                <div className="relative">
                  <label htmlFor="organizer-account-password" className="sr-only">{language === "fr" ? "Mot de passe" : "Password"}</label>
                  <LockKeyhole size={22} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-gray-800" />
                  <input id="organizer-account-password" name="password" type={passwordVisible ? "text" : "password"} autoComplete={"new-password"} value={password} onChange={event => { setPassword(event.target.value); setError(""); }} maxLength={72} required disabled={submitting} placeholder={language === "fr" ? "Mot de passe" : "Password"} className="min-h-12 w-full rounded-xl border border-gray-300 bg-white py-3 pr-12 pl-12 text-base text-gray-950 shadow-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100 disabled:opacity-60" />
                  <button type="button" aria-label={passwordVisible ? (language === "fr" ? "Masquer le mot de passe" : "Hide password") : (language === "fr" ? "Afficher le mot de passe" : "Show password")} onClick={() => setPasswordVisible(value => !value)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-600">{passwordVisible ? <EyeOff size={20} /> : <Eye size={20} />}</button>
                </div>

                <>
                {/* PAYS ET TÉLÉPHONE */}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* PAYS */}

                  <div className="relative min-w-0">
                    <label
                      htmlFor="register-country"
                      className="sr-only"
                    >
                      {t.countryLabel}
                    </label>

                    <MapPin
                      size={21}
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-green-800"
                    />

                    <select
                      id="register-country"
                      name="countryCode"
                      value={countryCode}
                      onChange={(event) =>
                        handleCountryChange(event.target.value)
                      }
                      required
                      disabled={submitting}
                      className="min-h-12 w-full appearance-none rounded-xl border border-green-700 bg-white py-3 pr-9 pl-10 text-sm font-semibold text-gray-950 shadow-sm outline-none focus:ring-2 focus:ring-green-100 disabled:opacity-60 sm:text-base"
                    >
                      <option value="">
                        {t.country}
                      </option>

                      {countries.map((country) => (
                        <option
                          key={country.code}
                          value={country.code}
                        >
                          {country.flag} {country.name}
                        </option>
                      ))}
                    </select>

                    <ChevronDown
                      size={19}
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-green-800"
                    />
                  </div>

                  {/* INDICATIF ET NUMÉRO */}

                  <div className="flex min-w-0 gap-2">
                    <div className="relative w-26.25 shrink-0 sm:w-27.5">
                      <label
                        htmlFor="register-dial"
                        className="sr-only"
                      >
                        {t.dialLabel}
                      </label>

                      <select
                        id="register-dial"
                        name="dialCode"
                        value={dialCode}
                        onChange={(event) => {
                          setDialCode(event.target.value);
                          setError("");
                        }}
                        required
                        disabled={submitting}
                        title={t.dialLabel}
                        className="min-h-12 w-full appearance-none rounded-xl border border-gray-300 bg-white py-3 pr-6 pl-3 text-sm font-semibold text-gray-950 shadow-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-100 disabled:opacity-60"
                      >
                        <option value="">+</option>

                        {dialCodes.map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                      </select>

                      <ChevronDown
                        size={16}
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-green-800"
                      />
                    </div>

                    <div className="relative min-w-0 flex-1">
                      <label
                        htmlFor="register-phone"
                        className="sr-only"
                      >
                        {t.phone}
                      </label>

                      <Phone
                        size={19}
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-800"
                      />

                      <input
                        id="register-phone"
                        name="phoneNumber"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel-national"
                        maxLength={25}
                        required
                        value={phoneNumber}
                        onChange={(event) => {
                          setPhoneNumber(event.target.value);
                          setError("");
                        }}
                        disabled={submitting}
                        placeholder={t.phone}
                        className="min-h-12 w-full rounded-xl border border-gray-300 bg-white py-3 pr-3 pl-10 text-sm text-gray-950 shadow-sm outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-100 disabled:opacity-60 sm:text-base"
                      />
                    </div>
                  </div>
                </div>

                {/* CONDITIONS */}

                <div className="flex items-start gap-3 px-1 py-2">
                  <input
                    id="register-terms"
                    name="acceptedTerms"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(event) => {
                      setAcceptedTerms(event.target.checked);
                      setError("");
                    }}
                    disabled={submitting}
                    required
                    className="mt-0.5 size-5 shrink-0 cursor-pointer accent-green-700"
                  />

                  <div className="text-sm leading-relaxed text-gray-950 sm:text-base">
                    <label
                      htmlFor="register-terms"
                      className="cursor-pointer"
                    >
                      {t.accept}{" "}
                    </label>

                    <Link
                      href={ROUTES.terms}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-green-800 underline underline-offset-2"
                    >
                      {t.terms}
                    </Link>{" "}

                    {t.and}{" "}

                    <Link
                      href={ROUTES.privacy}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-green-800 underline underline-offset-2"
                    >
                      {t.privacy}
                    </Link>
                    .
                  </div>
                </div>

                </>
                {/* ERREURS */}

                {error && (
                  <div
                    role="alert"
                    aria-live="polite"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
                  >
                    {error}
                  </div>
                )}

                {/* BOUTON INSCRIPTION */}

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex min-h-13 w-full items-center justify-center gap-3 rounded-xl bg-linear-to-b from-[#24c300] to-[#00660b] px-5 text-base font-extrabold text-white shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:text-lg"
                >
                  {submitting ? (
                    <>
                      <LoaderCircle
                        size={23}
                        className="animate-spin"
                      />
                      {t.submitting}
                    </>
                  ) : (
                    <>
                      <UserRoundPlus size={26} />
                      {t.submit}
                    </>
                  )}
                </button>
                
              </form>

              {/* CONNEXION */}

              <div className="mt-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />

                <p className="text-center text-xs text-gray-950 sm:text-sm">
                  {t.existing}{" "}

                  <Link
                    href={ROUTES.login}
                    className="font-extrabold text-green-800 underline underline-offset-2"
                  >
                    {t.login}
                  </Link>
                </p>

                <div className="h-px flex-1 bg-gray-200" />
              </div>

              {/* INSCRIPTION MONDIALE */}

              <div className="mt-5 flex min-h-14 items-center justify-center gap-3 rounded-xl bg-green-50 px-4 py-3 text-center text-sm font-medium text-green-950 sm:text-base">
                <Globe2
                  size={24}
                  className="shrink-0 text-green-800"
                />

                <span>{t.world}</span>
              </div>
            </div>
          </section>
        </div>

        {/* DÉCORATION INFÉRIEURE */}

        <div
          aria-hidden="true"
          className="relative h-10 w-full overflow-hidden bg-white sm:h-13"
        >
          <svg
            viewBox="0 0 1440 90"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            <path
              d="M0 15 C180 100 280 32 480 65 S780 72 1000 49 S1250 10 1440 30 L1440 90 L0 90 Z"
              fill="#ffcf00"
            />

            <path
              d="M0 43 C190 105 330 50 500 78 S840 73 1040 62 S1290 22 1440 54 L1440 90 L0 90 Z"
              fill="#008c14"
            />

            <path
              d="M1080 65 C1220 30 1330 55 1440 27 L1440 90 L1080 90 Z"
              fill="#f52228"
            />
          </svg>
        </div>
      </main>
    </div>
  );
}

export default function OrganizerRegisterPage() {
  return <Suspense fallback={<div className="min-h-dvh bg-white" aria-busy="true" />}><OrganizerRegisterContent /></Suspense>;
}
