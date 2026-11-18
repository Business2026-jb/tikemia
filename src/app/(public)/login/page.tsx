
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  Eye,
  EyeOff,
  Globe2,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Phone,
  UserRound,
  UserRoundPlus,
} from "lucide-react";

import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

/* ==========================================================
   TIKEMIA — CONNEXION PUBLIQUE

   FICHIER :
   src/app/(public)/login/page.tsx

   ROUTE :
   /login

   API :
   POST /api/auth/login

   FONCTIONNALITÉS :
   - Connexion email + mot de passe
   - Connexion téléphone + mot de passe
   - Indicatif international automatique
   - Sélection manuelle du pays
   - Validation du numéro E.164
   - Afficher / masquer le mot de passe
   - Se souvenir de moi
   - Mot de passe oublié
   - Inscription
   - Gestion des erreurs API
   - Redirection vers /account
   - Langues français et anglais

   DESIGN :
   - PC : image gauche, formulaire droite
   - Mobile : bannière + formulaire
   - Image /images/paccueil.png
   - Header public existant
   - Aucun menu dupliqué
   - Aucun CSS supplémentaire

   AUCUN TEXTE PROMOTIONNEL.
   AUCUN ENCADRÉ DÉCORATIF DE SÉCURITÉ.
========================================================== */

const LOGIN_API = "/api/auth/login";

const GEO_API =
  "/api/public/explore?page=1&limit=1";

const IMAGE_URL = "/images/paccueil.png";

const ACCOUNT_URL = "/account";

const REGISTER_URL = "/register";

const FORGOT_PASSWORD_URL = "/forgot-password";

const VERIFY_EMAIL_URL = "/verify-email";

type Locale = "fr" | "en";

type LoginMode = "email" | "phone";

type CountryOption = {
  code: CountryCode;
  name: string;
  callingCode: string;
  flag: string;
};

type LoginResponse = {
  success?: boolean;
  authenticated?: boolean;
  code?: string;
  message?: string;
  redirectTo?: string;
};

type GeoResponse = {
  geo?: {
    detectedCountry?: string | null;
    countryCode?: string | null;
  };
  data?: {
    geo?: {
      detectedCountry?: string | null;
      countryCode?: string | null;
    };
  };
};

type FormErrors = {
  identifier?: string;
  password?: string;
  general?: string;
};

/* ==========================================================
   TRADUCTIONS FR / EN
========================================================== */

const TEXT = {
  fr: {
    title: "Se connecter",
    subtitle: "Accédez à votre espace TIKEMIA",

    emailMode: "Email",
    phoneMode: "Numéro",

    email: "Adresse email",
    emailPlaceholder: "Entrez votre adresse email",

    phone: "Numéro de téléphone",
    phonePlaceholder: "Entrez votre numéro",
    country: "Choisir un pays",
    countrySearch: "Rechercher un pays ou indicatif",
    noCountry: "Aucun pays trouvé",

    password: "Mot de passe",
    passwordPlaceholder: "Entrez votre mot de passe",

    showPassword: "Afficher le mot de passe",
    hidePassword: "Masquer le mot de passe",

    rememberMe: "Se souvenir de moi",
    forgotPassword: "Mot de passe oublié ?",

    login: "Se connecter",
    loggingIn: "Connexion en cours...",

    noAccount: "Vous n'avez pas encore de compte ?",
    register: "S'inscrire maintenant",

    emailRequired:
      "Veuillez saisir votre adresse email.",
    invalidEmail:
      "Veuillez saisir une adresse email valide.",

    phoneRequired:
      "Veuillez saisir votre numéro de téléphone.",
    invalidPhone:
      "Veuillez saisir un numéro valide pour le pays sélectionné.",

    passwordRequired:
      "Veuillez saisir votre mot de passe.",

    invalidCredentials:
      "Adresse email, numéro de téléphone ou mot de passe incorrect.",

    emailNotVerified:
      "Votre adresse email doit être vérifiée avant la connexion.",

    verifyEmail: "Vérifier mon email",

    tooManyAttempts:
      "Trop de tentatives. Veuillez réessayer dans quelques minutes.",

    serverError:
      "Le service de connexion est temporairement indisponible.",

    networkError:
      "Connexion au serveur impossible. Vérifiez votre connexion Internet.",

    generalError:
      "La connexion a échoué. Veuillez réessayer.",

    redirecting:
      "Ouverture de votre espace personnel...",
  },

  en: {
    title: "Sign in",
    subtitle: "Access your TIKEMIA account",

    emailMode: "Email",
    phoneMode: "Phone",

    email: "Email address",
    emailPlaceholder: "Enter your email address",

    phone: "Phone number",
    phonePlaceholder: "Enter your phone number",
    country: "Choose a country",
    countrySearch: "Search country or calling code",
    noCountry: "No country found",

    password: "Password",
    passwordPlaceholder: "Enter your password",

    showPassword: "Show password",
    hidePassword: "Hide password",

    rememberMe: "Remember me",
    forgotPassword: "Forgot password?",

    login: "Sign in",
    loggingIn: "Signing in...",

    noAccount: "Don't have an account?",
    register: "Create an account",

    emailRequired:
      "Please enter your email address.",
    invalidEmail:
      "Please enter a valid email address.",

    phoneRequired:
      "Please enter your phone number.",
    invalidPhone:
      "Enter a valid phone number for the selected country.",

    passwordRequired:
      "Please enter your password.",

    invalidCredentials:
      "Incorrect email, phone number or password.",

    emailNotVerified:
      "Please verify your email before signing in.",

    verifyEmail: "Verify my email",

    tooManyAttempts:
      "Too many attempts. Please try again in a few minutes.",

    serverError:
      "The sign-in service is temporarily unavailable.",

    networkError:
      "Unable to reach the server. Check your Internet connection.",

    generalError:
      "Sign-in failed. Please try again.",

    redirecting:
      "Opening your account...",
  },
} as const;

/* ==========================================================
   UTILITAIRES EMAIL
========================================================== */

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  const email = normalizeEmail(value);

  return (
    email.length >= 3 &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

/* ==========================================================
   UTILITAIRES PAYS
========================================================== */

function countryFlag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) {
    return "🌐";
  }

  return String.fromCodePoint(
    ...code.split("").map(
      (letter) =>
        letter.charCodeAt(0) + 127397
    )
  );
}

function countryName(
  code: CountryCode,
  locale: Locale
): string {
  try {
    const names = new Intl.DisplayNames(
      [locale],
      { type: "region" }
    );

    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

/* ==========================================================
   VALIDATION TÉLÉPHONE

   Le serveur attend le numéro
   international au format E.164.

   Exemples de formats :
   +229...
   +225...
   +33...

   Le pays choisi dans l'interface
   permet de comprendre le numéro local.
========================================================== */

function normalizePhone(
  raw: string,
  country: CountryCode
): string | null {
  const value = raw.trim();

  if (!value) {
    return null;
  }

  try {
    const number =
      parsePhoneNumberFromString(
        value,
        country
      );

    if (
      !number ||
      !number.isValid()
    ) {
      return null;
    }

    return number.number;
  } catch {
    return null;
  }
}

/* ==========================================================
   RECHERCHE DES PAYS
========================================================== */

function searchableText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/* ==========================================================
   PAGE CONNEXION
========================================================== */

export default function LoginPage() {
  const router = useRouter();

  /* ========================================================
     LANGUE
  ======================================================== */

  const [locale, setLocale] =
    useState<Locale>("fr");

  const t = TEXT[locale];

  /* ========================================================
     MODE DE CONNEXION
  ======================================================== */

  const [mode, setMode] =
    useState<LoginMode>("email");

  /* ========================================================
     CHAMPS
  ======================================================== */

  const [email, setEmail] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [rememberMe, setRememberMe] =
    useState(false);

  /* ========================================================
     SÉLECTEUR INTERNATIONAL
  ======================================================== */

  const [selectedCountry, setSelectedCountry] =
    useState<CountryCode>("FR");

  const [countrySearch, setCountrySearch] =
    useState("");

  const [countryOpen, setCountryOpen] =
    useState(false);

  const countryManuallySelected =
    useRef(false);

  const countrySelectorRef =
    useRef<HTMLDivElement | null>(null);

  const countrySearchRef =
    useRef<HTMLInputElement | null>(null);

  /* ========================================================
     REQUÊTES
  ======================================================== */

  const [submitting, setSubmitting] =
    useState(false);

  const [redirecting, setRedirecting] =
    useState(false);

  const [errors, setErrors] =
    useState<FormErrors>({});

  const [emailNotVerified, setEmailNotVerified] =
    useState(false);

  const requestController =
    useRef<AbortController | null>(null);

  const requestInProgress =
    useRef(false);

  /* ========================================================
     PAYS ET INDICATIFS

     Réutilisation de libphonenumber-js.

     Aucun tableau de pays créé
     manuellement dans le projet.
  ======================================================== */

  const countries = useMemo<CountryOption[]>(() => {
    const sorter = new Intl.Collator(
      locale,
      { sensitivity: "base" }
    );

    return getCountries()
      .map((code) => ({
        code,
        name: countryName(code, locale),
        callingCode: getCountryCallingCode(code),
        flag: countryFlag(code),
      }))
      .sort((a, b) =>
        sorter.compare(a.name, b.name)
      );
  }, [locale]);

  const countryCodes = useMemo(
    () =>
      new Set(
        countries.map((country) => country.code)
      ),
    [countries]
  );

  const selectedCountryInfo =
    countries.find(
      (country) => country.code === selectedCountry
    ) ?? null;

  const filteredCountries = useMemo(() => {
    const query = searchableText(countrySearch);

    if (!query) {
      return countries;
    }

    return countries.filter((country) => {
      const name = searchableText(country.name);

      return (
        name.includes(query) ||
        country.code.toLowerCase().includes(query) ||
        `+${country.callingCode}`.includes(query)
      );
    });
  }, [countries, countrySearch]);

  /* ========================================================
     SYNCHRONISATION FR / EN

     Même préférence que le menu
     public TIKEMIA.
  ======================================================== */

  useEffect(() => {
    function syncLanguage() {
      try {
        const stored =
          localStorage.getItem("tikemia_locale");

        if (stored === "fr" || stored === "en") {
          setLocale(stored);
          return;
        }
      } catch {
        // Français par défaut.
      }

      const htmlLanguage =
        document.documentElement.lang.toLowerCase();

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
     DÉTECTION AUTOMATIQUE DU PAYS

     Réutilisation de l'API publique
     Explorer, déjà prévue pour la
     géolocalisation IP.

     La géolocalisation est seulement
     une suggestion.

     L'utilisateur peut modifier
     manuellement le pays.

     En cas d'échec :
     région du navigateur, puis FR.

     Cette page n'envoie pas
     l'adresse IP à un nouveau service.
  ======================================================== */

  useEffect(() => {
    const controller = new AbortController();

    let active = true;

    function browserCountry(): CountryCode | null {
      const languages =
        navigator.languages?.length
          ? navigator.languages
          : [navigator.language];

      for (const language of languages) {
        try {
          const region =
            new Intl.Locale(language).region;

          if (
            region &&
            countryCodes.has(region as CountryCode)
          ) {
            return region as CountryCode;
          }
        } catch {
          // Langue non reconnue.
        }
      }

      return null;
    }

    async function detectCountry() {
      let country: CountryCode | null = null;

      try {
        const response = await fetch(
          GEO_API,
          {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          }
        );

        if (response.ok) {
          const result =
            (await response.json()) as GeoResponse;

          const detected =
            (
              result.geo?.detectedCountry ??
              result.geo?.countryCode ??
              result.data?.geo?.detectedCountry ??
              result.data?.geo?.countryCode ??
              ""
            )
              .trim()
              .toUpperCase();

          if (
            countryCodes.has(
              detected as CountryCode
            )
          ) {
            country = detected as CountryCode;
          }
        }
      } catch {
        // La connexion reste disponible
        // même sans détection IP.
      }

      if (!country) {
        country = browserCountry();
      }

      if (
        active &&
        !countryManuallySelected.current
      ) {
        setSelectedCountry(country ?? "FR");
      }
    }

    void detectCountry();

    return () => {
      active = false;
      controller.abort();
    };
  }, [countryCodes]);

  /* ========================================================
     FERMETURE DU MENU PAYS
  ======================================================== */

  useEffect(() => {
    if (!countryOpen) {
      return;
    }

    function handleOutside(event: MouseEvent) {
      if (
        countrySelectorRef.current &&
        !countrySelectorRef.current.contains(
          event.target as Node
        )
      ) {
        setCountryOpen(false);
      }
    }

    function handleKeyDown(
      event: globalThis.KeyboardEvent
    ) {
      if (event.key === "Escape") {
        setCountryOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutside
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    window.requestAnimationFrame(() => {
      countrySearchRef.current?.focus();
    });

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutside
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [countryOpen]);

  /* ========================================================
     ANNULER LA REQUÊTE AU DÉMONTAGE
  ======================================================== */

  useEffect(() => {
    return () => {
      requestController.current?.abort();
    };
  }, []);

  /* ========================================================
     CHOISIR EMAIL / TÉLÉPHONE

     On ne supprime pas les informations
     déjà saisies lorsque l'utilisateur
     change de méthode.
  ======================================================== */

  const changeMode = useCallback(
    (nextMode: LoginMode) => {
      if (requestInProgress.current) {
        return;
      }

      setMode(nextMode);
      setErrors({});
      setEmailNotVerified(false);
    },
    []
  );

  /* ========================================================
     CHOISIR UN PAYS
  ======================================================== */

  function chooseCountry(country: CountryCode) {
    countryManuallySelected.current = true;

    setSelectedCountry(country);
    setCountryOpen(false);
    setCountrySearch("");

    setErrors((previous) => ({
      ...previous,
      identifier: undefined,
      general: undefined,
    }));

    setEmailNotVerified(false);
  }

  /* ========================================================
     MESSAGES D'ERREUR API
  ======================================================== */

  function apiErrorMessage(
    code: string | undefined,
    status: number
  ): string {
    switch (code) {
      case "invalidIdentifier":
        return mode === "email"
          ? t.invalidEmail
          : t.invalidPhone;

      case "invalidPassword":
        return t.passwordRequired;

      case "invalidCredentials":
        return t.invalidCredentials;

      case "emailNotVerified":
        return t.emailNotVerified;

      case "tooManyAttempts":
        return t.tooManyAttempts;

      default:
        return status >= 500
          ? t.serverError
          : t.generalError;
    }
  }

  /* ========================================================
     VALIDATION DU FORMULAIRE
  ======================================================== */

  function validateForm():
    | { valid: true; identifier: string }
    | { valid: false } {
    const nextErrors: FormErrors = {};

    let identifier: string | null = null;

    if (mode === "email") {
      if (!email.trim()) {
        nextErrors.identifier = t.emailRequired;
      } else if (!isValidEmail(email)) {
        nextErrors.identifier = t.invalidEmail;
      } else {
        identifier = normalizeEmail(email);
      }
    } else {
      if (!phone.trim()) {
        nextErrors.identifier = t.phoneRequired;
      } else {
        identifier = normalizePhone(
          phone,
          selectedCountry
        );

        if (!identifier) {
          nextErrors.identifier = t.invalidPhone;
        }
      }
    }

    if (!password) {
      nextErrors.password = t.passwordRequired;
    } else if (
      new TextEncoder().encode(password).length > 1024
    ) {
      nextErrors.password = t.invalidCredentials;
    }

    setErrors(nextErrors);

    if (
      Object.keys(nextErrors).length > 0 ||
      !identifier
    ) {
      return { valid: false };
    }

    return {
      valid: true,
      identifier,
    };
  }

  /* ========================================================
     SOUMISSION — API DE CONNEXION

     POST /api/auth/login

     {
       identifier,
       password,
       rememberMe,
       locale
     }

     Le serveur est responsable :
     - De l'authentification
     - Du contrôle de l'email
     - De la session PostgreSQL
     - Du cookie HttpOnly

     Aucun token créé ici.
  ======================================================== */

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      requestInProgress.current ||
      submitting ||
      redirecting
    ) {
      return;
    }

    const validation = validateForm();

    if (!validation.valid) {
      return;
    }

    requestInProgress.current = true;

    setSubmitting(true);
    setErrors({});
    setEmailNotVerified(false);

    const controller = new AbortController();

    requestController.current = controller;

    try {
      const response = await fetch(
        LOGIN_API,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            identifier: validation.identifier,
            password,
            rememberMe,
            locale,
          }),

          signal: controller.signal,
        }
      );

      let result: LoginResponse = {};

      try {
        result =
          (await response.json()) as LoginResponse;
      } catch {
        // Réponse non JSON ou vide.
      }

      if (
        !response.ok ||
        result.success !== true ||
        result.authenticated !== true
      ) {
        const code = result.code;

        if (code === "emailNotVerified") {
          setEmailNotVerified(true);
        }

        setErrors({
          general: apiErrorMessage(
            code,
            response.status
          ),
        });

        return;
      }

      /*
       * Connexion confirmée par le serveur.
       * Le cookie HttpOnly a été défini
       * dans la réponse API.
       */

      setPassword("");
      setRedirecting(true);

      /*
       * Destination interne fixe :
       * pas de redirection vers une
       * URL externe fournie au client.
       */

      router.replace(ACCOUNT_URL);
      router.refresh();
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      setErrors({
        general:
          error instanceof TypeError
            ? t.networkError
            : t.generalError,
      });
    } finally {
      requestInProgress.current = false;
      requestController.current = null;
      setSubmitting(false);
    }
  }

  /* ========================================================
     RENDU
  ======================================================== */

  return (
    <>
      {/* ==================================================
          FOOTER

          Le footer public est déjà
          rendu par le layout.

          PC : visible.
          Mobile : masqué.

          On conserve le header et
          le menu mobile existants.
      ================================================== */}

      

      <div
        id="tikemia-login-page"
        className="flex w-full min-w-0 flex-1 flex-col bg-white text-[#142236]"
      >
        {/* ==================================================
            PC : 2 COLONNES
            MOBILE : 1 COLONNE
        ================================================== */}

        <div className="grid w-full min-w-0 flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-2">

          {/* ==================================================
              IMAGE PC

              Image existante.
              Aucun texte sur l'image.
          ================================================== */}

          <div className="relative hidden min-h-0 overflow-hidden bg-[#06432e] lg:block">
            <Image fill sizes="(min-width: 1024px) 50vw, 100vw" unoptimized
              src={IMAGE_URL}
              alt=""
              aria-hidden="true"
              loading="eager"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          </div>

          {/* ==================================================
              PARTIE FORMULAIRE
          ================================================== */}

          <section className="relative flex w-full min-w-0 flex-col bg-[#f8faf9]">

            {/* ==============================================
                BANNIÈRE MOBILE
            ============================================== */}

            <div className="relative h-33.75 w-full overflow-hidden bg-[#06432e] sm:h-43.75 lg:hidden">
              <Image fill sizes="(min-width: 1024px) 50vw, 100vw" unoptimized
                src={IMAGE_URL}
                alt=""
                aria-hidden="true"
                loading="eager"
                className="h-full w-full object-cover object-center"
              />
            </div>

            {/* ==============================================
                CONTENEUR FORMULAIRE
            ============================================== */}

            <div className="relative flex w-full min-w-0 flex-1 items-start justify-center px-3 pb-4 sm:px-6 sm:py-5 lg:items-center lg:px-7 lg:py-6 xl:px-10">

              <div className="-mt-7 w-full max-w-147.5 min-w-0 rounded-[25px] border border-[#e3eae6] bg-white px-5 pt-7 pb-8 shadow-[0_12px_40px_rgba(15,51,30,0.1)] sm:mt-0 sm:px-9 sm:py-10 lg:rounded-[29px] xl:px-10">

                {/* ==========================================
                    ICÔNE PRINCIPALE
                ========================================== */}

                <div className="mx-auto flex size-16.25 items-center justify-center rounded-full bg-linear-to-b from-[#1bb000] to-[#006e28] text-white shadow-[0_5px_12px_rgba(5,105,39,0.16)] sm:size-18.5">
                  <UserRound
                    size={36}
                    strokeWidth={1.8}
                  />
                </div>

                {/* ==========================================
                    TITRE
                ========================================== */}

                <div className="mt-5 text-center">
                  <h1 className="text-[28px] font-black leading-tight tracking-tight text-[#0d182b] sm:text-[33px]">
                    {t.title}
                  </h1>

                  <p className="mt-2 text-[13px] text-[#69798d] sm:text-[15px]">
                    {t.subtitle}
                  </p>
                </div>

                {/* ==========================================
                    FORMULAIRE
                ========================================== */}

                <form
                  onSubmit={handleLogin}
                  noValidate
                  className="mt-7 space-y-5"
                >

                  {/* ========================================
                      CHOIX EMAIL / TÉLÉPHONE
                  ======================================== */}

                  <div
                    role="group"
                    aria-label={t.title}
                    className="grid grid-cols-2 gap-1 rounded-full border border-[#d9e2e9] bg-[#f5f7fa] p-1"
                  >
                    <button
                      type="button"
                      onClick={() => changeMode("email")}
                      disabled={submitting || redirecting}
                      aria-pressed={mode === "email"}
                      className={`flex min-h-10.75 min-w-0 items-center justify-center gap-2 rounded-full px-2 text-[12px] font-extrabold transition-colors sm:text-sm ${
                        mode === "email"
                          ? "bg-linear-to-b from-[#1cad00] to-[#006d28] text-white shadow-sm"
                          : "text-[#263649] hover:bg-white"
                      } disabled:opacity-60`}
                    >
                      <Mail
                        size={18}
                        className="shrink-0"
                      />

                      {t.emailMode}
                    </button>

                    <button
                      type="button"
                      onClick={() => changeMode("phone")}
                      disabled={submitting || redirecting}
                      aria-pressed={mode === "phone"}
                      className={`flex min-h-10.75 min-w-0 items-center justify-center gap-2 rounded-full px-2 text-[12px] font-extrabold transition-colors sm:text-sm ${
                        mode === "phone"
                          ? "bg-linear-to-b from-[#1cad00] to-[#006d28] text-white shadow-sm"
                          : "text-[#263649] hover:bg-white"
                      } disabled:opacity-60`}
                    >
                      <Phone
                        size={18}
                        className="shrink-0"
                      />

                      {t.phoneMode}
                    </button>
                  </div>

                  {/* ========================================
                      CONNEXION PAR EMAIL
                  ======================================== */}

                  {mode === "email" && (
                    <div>
                      <label
                        htmlFor="tikemia-login-email"
                        className="mb-2 block text-[13px] font-extrabold text-[#1b2a3b]"
                      >
                        {t.email}
                        <span className="ml-1 text-red-600">
                          *
                        </span>
                      </label>

                      <div className="relative">
                        <Mail
                          size={20}
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[#34495a]"
                        />

                        <input
                          id="tikemia-login-email"
                          name="email"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          required
                          maxLength={254}
                          disabled={submitting || redirecting}
                          value={email}
                          onChange={(event) => {
                            setEmail(event.target.value);

                            setErrors((previous) => ({
                              ...previous,
                              identifier: undefined,
                              general: undefined,
                            }));

                            setEmailNotVerified(false);
                          }}
                          placeholder={t.emailPlaceholder}
                          aria-invalid={Boolean(errors.identifier)}
                          aria-describedby={
                            errors.identifier
                              ? "tikemia-login-identifier-error"
                              : undefined
                          }
                          className={`h-13 w-full rounded-xl border bg-[#fbfcff] pr-4 pl-12 text-sm font-medium text-[#243548] outline-none placeholder:font-normal placeholder:text-[#9aa6b6] focus:ring-2 disabled:opacity-60 ${
                            errors.identifier
                              ? "border-red-500 focus:ring-red-100"
                              : "border-[#d9e1e9] focus:border-[#087d2e] focus:ring-[#087d2e]/10"
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  {/* ========================================
                      CONNEXION PAR TÉLÉPHONE
                  ======================================== */}

                  {mode === "phone" && (
                    <div>
                      <label
                        htmlFor="tikemia-login-phone"
                        className="mb-2 block text-[13px] font-extrabold text-[#1b2a3b]"
                      >
                        {t.phone}
                        <span className="ml-1 text-red-600">
                          *
                        </span>
                      </label>

                      <div className="flex w-full min-w-0 gap-2">

                        {/* ================================
                            INDICATIF ET PAYS
                        ================================ */}

                        <div
                          ref={countrySelectorRef}
                          className="relative shrink-0"
                        >
                          <button
                            type="button"
                            disabled={submitting || redirecting}
                            onClick={() => {
                              setCountryOpen(
                                (previous) => !previous
                              );

                              setCountrySearch("");
                            }}
                            aria-label={t.country}
                            aria-expanded={countryOpen}
                            className="flex h-13 min-w-26.25 items-center justify-center gap-1.5 rounded-xl border border-[#d9e1e9] bg-[#fbfcff] px-2.5 text-xs font-extrabold text-[#243548] hover:border-[#087d2e] disabled:opacity-60 sm:min-w-30"
                          >
                            {selectedCountryInfo ? (
                              <>
                                <span className="text-[21px] leading-none">
                                  {selectedCountryInfo.flag}
                                </span>

                                <span>
                                  +{selectedCountryInfo.callingCode}
                                </span>
                              </>
                            ) : (
                              <Globe2 size={18} />
                            )}

                            <ChevronDown
                              size={14}
                              className="shrink-0 text-[#718196]"
                            />
                          </button>

                          {/* ============================
                              MENU DES PAYS
                          ============================ */}

                          {countryOpen && (
                            <div className="absolute top-14.5 left-0 z-50 w-[min(310px,calc(100vw-32px))] overflow-hidden rounded-xl border border-[#d9e7dd] bg-white shadow-[0_12px_35px_rgba(11,54,29,0.16)]">
                              <div className="border-b border-[#e8eee9] p-2.5">
                                <input
                                  ref={countrySearchRef}
                                  type="search"
                                  value={countrySearch}
                                  onChange={(event) =>
                                    setCountrySearch(
                                      event.target.value
                                    )
                                  }
                                  placeholder={t.countrySearch}
                                  aria-label={t.countrySearch}
                                  className="h-10 w-full rounded-lg border border-[#dce6df] bg-[#f9fbf9] px-3 text-sm outline-none focus:border-[#087d2e]"
                                />
                              </div>

                              <div className="max-h-65 overflow-y-auto overscroll-contain">
                                {filteredCountries.length === 0 ? (
                                  <p className="px-3 py-4 text-center text-xs text-[#7d8a91]">
                                    {t.noCountry}
                                  </p>
                                ) : (
                                  filteredCountries.map((country) => (
                                    <button
                                      key={country.code}
                                      type="button"
                                      onClick={() =>
                                        chooseCountry(country.code)
                                      }
                                      className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs transition-colors hover:bg-[#eff8f1] ${
                                        selectedCountry === country.code
                                          ? "bg-[#eaf7ed] font-extrabold text-[#07592b]"
                                          : "text-[#405469]"
                                      }`}
                                    >
                                      <span className="shrink-0 text-xl">
                                        {country.flag}
                                      </span>

                                      <span className="min-w-0 flex-1">
                                        {country.name}
                                      </span>

                                      <span className="shrink-0 font-semibold">
                                        +{country.callingCode}
                                      </span>

                                      {selectedCountry === country.code && (
                                        <Check
                                          size={14}
                                          className="shrink-0 text-[#087d2e]"
                                        />
                                      )}
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* ============================
                            NUMÉRO DE TÉLÉPHONE
                        ============================ */}

                        <div className="relative min-w-0 flex-1">
                          <Phone
                            size={18}
                            aria-hidden="true"
                            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#34495a]"
                          />

                          <input
                            id="tikemia-login-phone"
                            type="tel"
                            name="phone"
                            inputMode="tel"
                            autoComplete="tel-national"
                            maxLength={35}
                            required
                            disabled={submitting || redirecting}
                            value={phone}
                            onChange={(event) => {
                              setPhone(event.target.value);

                              setErrors((previous) => ({
                                ...previous,
                                identifier: undefined,
                                general: undefined,
                              }));

                              setEmailNotVerified(false);
                            }}
                            placeholder={t.phonePlaceholder}
                            aria-invalid={Boolean(errors.identifier)}
                            aria-describedby={
                              errors.identifier
                                ? "tikemia-login-identifier-error"
                                : undefined
                            }
                            className={`h-13 w-full min-w-0 rounded-xl border bg-[#fbfcff] pr-3 pl-10 text-sm font-medium text-[#243548] outline-none placeholder:font-normal placeholder:text-[#9aa6b6] focus:ring-2 disabled:opacity-60 ${
                              errors.identifier
                                ? "border-red-500 focus:ring-red-100"
                                : "border-[#d9e1e9] focus:border-[#087d2e] focus:ring-[#087d2e]/10"
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ========================================
                      ERREUR IDENTIFIANT
                  ======================================== */}

                  {errors.identifier && (
                    <p
                      id="tikemia-login-identifier-error"
                      role="alert"
                      className="-mt-3 text-xs font-semibold text-red-600"
                    >
                      {errors.identifier}
                    </p>
                  )}

                  {/* ========================================
                      MOT DE PASSE
                  ======================================== */}

                  <div>
                    <label
                      htmlFor="tikemia-login-password"
                      className="mb-2 block text-[13px] font-extrabold text-[#1b2a3b]"
                    >
                      {t.password}
                      <span className="ml-1 text-red-600">
                        *
                      </span>
                    </label>

                    <div className="relative">
                      <LockKeyhole
                        size={20}
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[#34495a]"
                      />

                      <input
                        id="tikemia-login-password"
                        name="password"
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        autoComplete="current-password"
                        required
                        disabled={submitting || redirecting}
                        value={password}
                        onChange={(event) => {
                          setPassword(event.target.value);

                          setErrors((previous) => ({
                            ...previous,
                            password: undefined,
                            general: undefined,
                          }));

                          setEmailNotVerified(false);
                        }}
                        placeholder={t.passwordPlaceholder}
                        aria-invalid={Boolean(errors.password)}
                        aria-describedby={
                          errors.password
                            ? "tikemia-login-password-error"
                            : undefined
                        }
                        className={`h-13 w-full rounded-xl border bg-[#fbfcff] pr-12 pl-12 text-sm font-medium text-[#243548] outline-none placeholder:font-normal placeholder:text-[#9aa6b6] focus:ring-2 disabled:opacity-60 ${
                          errors.password
                            ? "border-red-500 focus:ring-red-100"
                            : "border-[#d9e1e9] focus:border-[#087d2e] focus:ring-[#087d2e]/10"
                        }`}
                      />

                      <button
                        type="button"
                        disabled={submitting || redirecting}
                        onClick={() =>
                          setShowPassword(
                            (previous) => !previous
                          )
                        }
                        aria-label={
                          showPassword
                            ? t.hidePassword
                            : t.showPassword
                        }
                        className="absolute top-1/2 right-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#6a7a8d] hover:bg-[#edf3ef] disabled:opacity-50"
                      >
                        {showPassword ? (
                          <EyeOff size={20} />
                        ) : (
                          <Eye size={20} />
                        )}
                      </button>
                    </div>

                    {errors.password && (
                      <p
                        id="tikemia-login-password-error"
                        role="alert"
                        className="mt-2 text-xs font-semibold text-red-600"
                      >
                        {errors.password}
                      </p>
                    )}
                  </div>

                  {/* ========================================
                      SE SOUVENIR DE MOI /
                      MOT DE PASSE OUBLIÉ
                  ======================================== */}

                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <label className="inline-flex cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        name="rememberMe"
                        checked={rememberMe}
                        disabled={submitting || redirecting}
                        onChange={(event) =>
                          setRememberMe(event.target.checked)
                        }
                        className="size-4.25 shrink-0 accent-[#087d2e]"
                      />

                      <span className="text-[12px] font-semibold text-[#384959] sm:text-[13px]">
                        {t.rememberMe}
                      </span>
                    </label>

                    <Link
                      href={FORGOT_PASSWORD_URL}
                      className="text-[12px] font-extrabold text-[#087d2e] underline underline-offset-2 hover:text-[#005b22] sm:text-[13px]"
                    >
                      {t.forgotPassword}
                    </Link>
                  </div>

                  {/* ========================================
                      ERREURS DE CONNEXION
                  ======================================== */}

                  {errors.general && (
                    <div
                      role="alert"
                      aria-live="assertive"
                      className="rounded-xl border border-[#f2c9c9] bg-[#fff5f5] px-4 py-3 text-xs font-semibold leading-relaxed text-[#a82e2e]"
                    >
                      <div className="flex items-start gap-2.5">
                        <CircleAlert
                          size={18}
                          className="shrink-0"
                        />

                        <p>{errors.general}</p>
                      </div>

                      {emailNotVerified &&
                        mode === "email" &&
                        isValidEmail(email) && (
                          <Link
                            href={`${VERIFY_EMAIL_URL}?email=${encodeURIComponent(
                              normalizeEmail(email)
                            )}`}
                            className="mt-3 inline-block font-extrabold text-[#087d2e] underline underline-offset-2"
                          >
                            {t.verifyEmail}
                          </Link>
                        )}
                    </div>
                  )}

                  {/* ========================================
                      BOUTON SE CONNECTER
                  ======================================== */}

                  <button
                    type="submit"
                    disabled={submitting || redirecting}
                    className="flex min-h-13.25 w-full items-center justify-center gap-3 rounded-full bg-linear-to-b from-[#1fb000] to-[#006e28] px-5 py-3 text-[15px] font-extrabold text-white shadow-[0_5px_12px_rgba(5,102,37,0.16)] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {submitting || redirecting ? (
                      <>
                        <LoaderCircle
                          size={20}
                          className="animate-spin"
                        />

                        {redirecting
                          ? t.redirecting
                          : t.loggingIn}
                      </>
                    ) : (
                      <>
                        <UserRound size={21} />
                        {t.login}
                        <ArrowRight size={17} />
                      </>
                    )}
                  </button>

                  {/* ========================================
                      S'INSCRIRE
                  ======================================== */}

                  <div className="pt-1">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="h-px flex-1 bg-[#e1e8e4]" />

                      <p className="text-center text-[12px] font-semibold text-[#5d6f7c]">
                        {t.noAccount}
                      </p>

                      <div className="h-px flex-1 bg-[#e1e8e4]" />
                    </div>

                    <Link
                      href={REGISTER_URL}
                      className="flex min-h-12.5 w-full items-center justify-center gap-2 rounded-full border border-[#078d2e] bg-white px-5 py-3 text-[14px] font-extrabold text-[#087d2e] transition-colors hover:bg-[#f2faf4]"
                    >
                      <UserRoundPlus size={20} />
                      {t.register}
                    </Link>
                  </div>
                </form>

              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
