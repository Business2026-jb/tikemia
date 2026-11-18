
"use client";

import {
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
  ShieldCheck,
  UserRoundPlus,
} from "lucide-react";

import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

/* ==========================================================
   TIKEMIA — INSCRIPTION PUBLIQUE

   FICHIER :
   src/app/(public)/register/page.tsx

   ROUTE :
   /register

   API :
   POST /api/auth/register

   IMAGE EXISTANTE :
   /images/paccueil.png

   INFORMATIONS DEMANDÉES :
   - Email
   - Numéro international
   - Mot de passe
   - Acceptation des conditions

   FONCTIONNALITÉS :
   - Détection du pays via l'API existante
   - Indicatif international automatique
   - Modification manuelle du pays
   - Validation du numéro E.164
   - Afficher / masquer le mot de passe
   - Vérification des informations
   - Inscription sécurisée via API
   - Redirection vers /verify-email
   - Français et anglais
   - PC, tablette et mobile

   IMPORTANT :
   - Achat invité toujours autorisé
   - Aucun billet rattaché ici
   - Vérification email obligatoire
   - Aucun code OTP généré côté client
   - Aucun mot de passe conservé
   - Aucun nouveau fichier créé
   - Aucun nouveau CSS
   - Aucun menu public dupliqué

   DESIGN :
   PC :
   Image gauche, formulaire droite.

   MOBILE :
   Bannière, puis formulaire.

   IMAGE :
   Aucun texte promotionnel superposé.
========================================================== */

const REGISTER_API = "/api/auth/register";

const VERIFY_URL = "/verify-email";

const IMAGE_URL = "/images/paccueil.png";

const GEO_API = "/api/public/explore?page=1&limit=1";

const PASSWORD_MIN_LENGTH = 12;

type Locale = "fr" | "en";

type FieldErrors = {
  email?: string;
  phone?: string;
  password?: string;
  terms?: string;
  general?: string;
};

type RegistrationResponse = {
  success?: boolean;
  message?: string;
  code?: string;
  redirectTo?: string;
  verificationRequired?: boolean;
  data?: {
    email?: string;
  };
};

type GeoResponse = {
  success?: boolean;
  geo?: {
    detectedCountry?: string | null;
  };
};

type CountryOption = {
  code: CountryCode;
  name: string;
  callingCode: string;
  flag: string;
};

/* ==========================================================
   TRADUCTIONS
========================================================== */

const TRANSLATIONS = {
  fr: {
    title: "Créer un compte",
    subtitle: "Inscrivez-vous sur TIKEMIA.",

    email: "Adresse email",
    emailPlaceholder: "exemple@email.com",

    phone: "Numéro de téléphone",
    country: "Pays et indicatif",
    phonePlaceholder: "Votre numéro de téléphone",

    password: "Mot de passe",
    passwordPlaceholder: "Créez votre mot de passe",
    passwordHint: "12 caractères minimum",

    showPassword: "Afficher le mot de passe",
    hidePassword: "Masquer le mot de passe",

    termsBeginning:
      "J'accepte les",
    terms: "Conditions d'utilisation",
    termsMiddle: "et la",
    privacy: "Politique de confidentialité",

    register: "S'inscrire",
    registering: "Inscription en cours...",

    alreadyAccount: "Vous avez déjà un compte ?",
    login: "Se connecter",

    requiredEmail:
      "Veuillez saisir votre adresse email.",

    invalidEmail:
      "Veuillez saisir une adresse email valide.",

    requiredPhone:
      "Veuillez saisir votre numéro de téléphone.",

    invalidPhone:
      "Veuillez saisir un numéro de téléphone valide pour le pays sélectionné.",

    requiredPassword:
      "Veuillez créer un mot de passe.",

    weakPassword:
      "Le mot de passe doit contenir au moins 12 caractères.",

    termsRequired:
      "Veuillez accepter les conditions d'utilisation et la politique de confidentialité.",

    alreadyRegistered:
      "Cette adresse email possède déjà un compte. Connectez-vous.",

    invalidCredentials:
      "Impossible de poursuivre l'inscription avec ces informations.",

    tooManyRequests:
      "Trop de demandes. Veuillez réessayer plus tard.",

    waitBeforeRetry:
      "Un code a déjà été demandé récemment. Veuillez patienter.",

    configurationError:
      "Le service d'inscription est temporairement indisponible.",

    emailError:
      "Le code de vérification n'a pas pu être envoyé. Veuillez réessayer.",

    networkError:
      "Impossible de contacter le serveur. Vérifiez votre connexion Internet.",

    generalError:
      "L'inscription n'a pas pu être effectuée. Veuillez réessayer.",

    security: "Inscription sécurisée",

    detectedCountry: "Indicatif proposé automatiquement",

    emailAlreadyUsed:
      "Vous possédez déjà un compte ?",

    redirecting:
      "Redirection vers la vérification de votre email...",
  },

  en: {
    title: "Create an account",
    subtitle: "Sign up for TIKEMIA.",

    email: "Email address",
    emailPlaceholder: "example@email.com",

    phone: "Phone number",
    country: "Country and calling code",
    phonePlaceholder: "Your phone number",

    password: "Password",
    passwordPlaceholder: "Create your password",
    passwordHint: "At least 12 characters",

    showPassword: "Show password",
    hidePassword: "Hide password",

    termsBeginning: "I agree to the",
    terms: "Terms of use",
    termsMiddle: "and the",
    privacy: "Privacy policy",

    register: "Sign up",
    registering: "Creating account...",

    alreadyAccount: "Already have an account?",
    login: "Sign in",

    requiredEmail:
      "Please enter your email address.",

    invalidEmail:
      "Please enter a valid email address.",

    requiredPhone:
      "Please enter your phone number.",

    invalidPhone:
      "Please enter a valid phone number for the selected country.",

    requiredPassword:
      "Please create a password.",

    weakPassword:
      "Your password must contain at least 12 characters.",

    termsRequired:
      "Please accept the terms of use and privacy policy.",

    alreadyRegistered:
      "An account already exists with this email. Please sign in.",

    invalidCredentials:
      "Unable to continue registration with these details.",

    tooManyRequests:
      "Too many requests. Please try again later.",

    waitBeforeRetry:
      "A verification code was recently requested. Please wait.",

    configurationError:
      "Registration is temporarily unavailable.",

    emailError:
      "Unable to send the verification code. Please try again.",

    networkError:
      "Unable to reach the server. Check your Internet connection.",

    generalError:
      "Registration could not be completed. Please try again.",

    security: "Secure registration",

    detectedCountry: "Automatically suggested calling code",

    emailAlreadyUsed:
      "Already registered?",

    redirecting:
      "Redirecting to email verification...",
  },
} as const;

/* ==========================================================
   UTILITAIRES — EMAIL
========================================================== */

function normalizeEmail(
  value: string
): string {
  return value.trim().toLowerCase();
}

function isValidEmail(
  value: string
): boolean {
  const email = normalizeEmail(value);

  return (
    email.length >= 3 &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

/* ==========================================================
   UTILITAIRES — PAYS
========================================================== */

function countryFlag(
  code: string
): string {
  if (!/^[A-Z]{2}$/.test(code)) {
    return "🌐";
  }

  return String.fromCodePoint(
    ...code.split("").map(
      (letter) =>
        letter.charCodeAt(0) +
        127397
    )
  );
}

function getCountryName(
  code: CountryCode,
  locale: Locale
): string {
  try {
    const displayNames =
      new Intl.DisplayNames(
        [locale],
        { type: "region" }
      );

    return displayNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/* ==========================================================
   NUMÉROS INTERNATIONAUX

   Les pays et indicatifs viennent
   de libphonenumber-js.

   On ne recrée pas de tableau
   de pays ou de codes téléphoniques.

   Le numéro final transmis au serveur
   sera au format international E.164.
========================================================== */

function getInternationalPhone(
  raw: string,
  country: CountryCode
): string | null {
  const input = raw.trim();

  if (!input) {
    return null;
  }

  try {
    const phone =
      parsePhoneNumberFromString(
        input,
        country
      );

    if (
      !phone ||
      !phone.isValid()
    ) {
      return null;
    }

    return phone.number;
  } catch {
    return null;
  }
}

/* ==========================================================
   UTILITAIRE — CODE D'ERREUR API
========================================================== */

function translatedApiError(
  code: string | undefined,
  locale: Locale
): string | null {
  if (!code) {
    return null;
  }

  const messages =
    TRANSLATIONS[locale];

  const knownKeys = [

    "invalidEmail",
    "invalidPhone",
    "weakPassword",
    "termsRequired",
    "alreadyRegistered",

    "tooManyRequests",
    "waitBeforeRetry",
    "configurationError",
    "emailError",
  ] as const;

  const matched = knownKeys.find(
    (key) => key === code
  );

  return matched
    ? messages[matched]
    : null;
}

/* ==========================================================
   PAGE PUBLIQUE D'INSCRIPTION
========================================================== */

export default function RegisterPage() {
  const router = useRouter();

  /* ========================================================
     LANGUE
  ======================================================== */

  const [locale, setLocale] =
    useState<Locale>("fr");

  const t = TRANSLATIONS[locale];

  /* ========================================================
     FORMULAIRE
  ======================================================== */

  const [email, setEmail] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [acceptedTerms, setAcceptedTerms] =
    useState(false);

  const [showPassword, setShowPassword] =
    useState(false);

  /* ========================================================
     PAYS

     null = pas encore initialisé.

     L'indicatif du pays sera affiché
     dès que l'initialisation sera terminée.
  ======================================================== */

  const [selectedCountry, setSelectedCountry] =
    useState<CountryCode | null>(null);

  const [
    countryAutomaticallyDetected,
    setCountryAutomaticallyDetected,
  ] = useState(false);

  const [countrySearch, setCountrySearch] =
    useState("");

  const [countrySelectorOpen, setCountrySelectorOpen] =
    useState(false);

  const countrySelectorRef =
    useRef<HTMLDivElement | null>(null);

  const countryManuallyChosen =
    useRef(false);

  /* ========================================================
     REQUÊTES
  ======================================================== */

  const [submitting, setSubmitting] =
    useState(false);

  const [redirecting, setRedirecting] =
    useState(false);

  const [errors, setErrors] =
    useState<FieldErrors>({});

  const registerController =
    useRef<AbortController | null>(null);

  const registerInProgress =
    useRef(false);

  /* ========================================================
     LISTE MONDIALE DES PAYS

     Aucun tableau inventé.

     Les indicatifs sont obtenus
     depuis libphonenumber-js.
  ======================================================== */

  const countries = useMemo<
    CountryOption[]
  >(() => {
    const countryCodes =
      getCountries();

    const collator =
      new Intl.Collator(locale, {
        sensitivity: "base",
      });

    return countryCodes
      .map((code) => {
        return {
          code,

          name: getCountryName(
            code,
            locale
          ),

          callingCode:
            getCountryCallingCode(code),

          flag:
            countryFlag(code),
        };
      })
      .sort(
        (first, second) =>
          collator.compare(
            first.name,
            second.name
          )
      );
  }, [locale]);

  const countryCodes = useMemo(
    () =>
      new Set(
        countries.map(
          (country) => country.code
        )
      ),
    [countries]
  );

  const currentCountry =
    countries.find(
      (country) =>
        country.code ===
        selectedCountry
    ) ?? null;

  /* ========================================================
     FILTRAGE DE LA LISTE DES PAYS
  ======================================================== */

  const filteredCountries =
    useMemo(() => {
      const query =
        countrySearch
          .trim()
          .normalize("NFD")
          .replace(
            /[\u0300-\u036f]/g,
            ""
          )
          .toLowerCase();

      if (!query) {
        return countries;
      }

      return countries.filter(
        (country) => {
          const name =
            country.name
              .normalize("NFD")
              .replace(
                /[\u0300-\u036f]/g,
                ""
              )
              .toLowerCase();

          return (
            name.includes(query) ||
            country.code
              .toLowerCase()
              .includes(query) ||
            `+${country.callingCode}`
              .includes(query)
          );
        }
      );
    }, [
      countries,
      countrySearch,
    ]);

  /* ========================================================
     LANGUE FR / EN EXISTANTE

     Compatible avec PublicNavigation.
  ======================================================== */

  useEffect(() => {
    function synchronizeLanguage() {
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

      const htmlLanguage =
        document.documentElement.lang
          .toLowerCase();

      setLocale(
        htmlLanguage.startsWith("en")
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
     DÉTECTION DU PAYS

     Réutilisation de l'API EXISTANTE :
     /api/public/explore

     Cette API fournit déjà :
     geo.detectedCountry

     Le navigateur ne lit pas lui-même
     l'adresse IP.

     Aucun nouveau service de
     géolocalisation n'est créé.

     Si l'infrastructure ne fournit pas
     le pays via IP, la langue du
     navigateur sert seulement de repli.

     Le choix manuel reste prioritaire.
  ======================================================== */

  useEffect(() => {
    let active = true;

    const controller =
      new AbortController();

    function suggestedBrowserCountry():
      CountryCode | null {
      const languages =
        navigator.languages?.length
          ? navigator.languages
          : [navigator.language];

      for (const language of languages) {
        const parts =
          language.split("-");

        const region =
          parts.find(
            (part) =>
              /^[a-z]{2}$/i.test(part) &&
              part !== parts[0]
          );

        if (!region) {
          continue;
        }

        const countryCode =
          region.toUpperCase() as CountryCode;

        if (
          countryCodes.has(
            countryCode
          )
        ) {
          return countryCode;
        }
      }

      return null;
    }

    async function detectCountry() {
      let detected:
        CountryCode | null = null;

      let detectedByIp = false;

      try {
        const response = await fetch(
          GEO_API,
          {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
            signal:
              controller.signal,
          }
        );

        if (response.ok) {
          const result =
            (await response.json()) as GeoResponse;

          const code =
            result.geo?.detectedCountry
              ?.trim()
              .toUpperCase();

          if (
            code &&
            countryCodes.has(
              code as CountryCode
            )
          ) {
            detected =
              code as CountryCode;

            detectedByIp = true;
          }
        }
      } catch {
        // La page fonctionne même
        // si la géolocalisation échoue.
      }

      if (!detected) {
        detected =
          suggestedBrowserCountry();
      }

      if (
        !active ||
        countryManuallyChosen.current
      ) {
        return;
      }

      setSelectedCountry(
        detected ?? "FR"
      );

      setCountryAutomaticallyDetected(
        detectedByIp
      );
    }

    void detectCountry();

    return () => {
      active = false;
      controller.abort();
    };
  }, [countryCodes]);

  /* ========================================================
     FERMETURE DU SÉLECTEUR DE PAYS

     Au clic en dehors ou à Escape.
  ======================================================== */

  useEffect(() => {
    if (!countrySelectorOpen) {
      return;
    }

    function handleOutsideClick(
      event: MouseEvent
    ) {
      if (
        countrySelectorRef.current &&
        !countrySelectorRef.current.contains(
          event.target as Node
        )
      ) {
        setCountrySelectorOpen(false);
      }
    }

    function handleEscape(
      event: globalThis.KeyboardEvent
    ) {
      if (event.key === "Escape") {
        setCountrySelectorOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [countrySelectorOpen]);

  /* ========================================================
     NETTOYAGE DES REQUÊTES
  ======================================================== */

  useEffect(() => {
    return () => {
      registerController.current
        ?.abort();
    };
  }, []);

  /* ========================================================
     MODIFICATION MANUELLE DU PAYS

     La sélection manuelle empêche
     la détection automatique de
     remplacer le choix du visiteur.
  ======================================================== */

  function chooseCountry(
    code: CountryCode
  ) {
    countryManuallyChosen.current =
      true;

    setSelectedCountry(code);

    setCountryAutomaticallyDetected(
      false
    );

    setCountrySelectorOpen(false);

    setCountrySearch("");

    setErrors(
      (previous) => ({
        ...previous,
        phone: undefined,
        general: undefined,
      })
    );
  }

  /* ========================================================
     VALIDATION DES CHAMPS
  ======================================================== */

  function validateForm():
    | {
        valid: true;
        email: string;
        phoneE164: string;
      }
    | {
        valid: false;
      } {
    const nextErrors: FieldErrors = {};

    const cleanEmail =
      normalizeEmail(email);

    if (!cleanEmail) {
      nextErrors.email =
        t.requiredEmail;
    } else if (
      !isValidEmail(cleanEmail)
    ) {
      nextErrors.email =
        t.invalidEmail;
    }

    let phoneE164:
      string | null = null;

    if (!phone.trim()) {
      nextErrors.phone =
        t.requiredPhone;
    } else if (selectedCountry) {
      phoneE164 =
        getInternationalPhone(
          phone,
          selectedCountry
        );

      if (!phoneE164) {
        nextErrors.phone =
          t.invalidPhone;
      }
    } else {
      nextErrors.phone =
        t.invalidPhone;
    }

    if (!password) {
      nextErrors.password =
        t.requiredPassword;
    } else if (
      Array.from(password).length <
      PASSWORD_MIN_LENGTH
    ) {
      nextErrors.password =
        t.weakPassword;
    }

    if (!acceptedTerms) {
      nextErrors.terms =
        t.termsRequired;
    }

    setErrors(nextErrors);

    if (
      Object.keys(nextErrors).length >
        0 ||
      !phoneE164
    ) {
      return { valid: false };
    }

    return {
      valid: true,
      email: cleanEmail,
      phoneE164,
    };
  }

  /* ========================================================
     INSCRIPTION

     Un seul appel à :
     POST /api/auth/register

     Le serveur est responsable :
     - Du compte
     - Du mot de passe haché
     - Du code de vérification
     - De l'envoi email

     Le navigateur ne crée pas
     de compte localement.
  ======================================================== */

  async function handleRegister(
    submitEvent: FormEvent<HTMLFormElement>
  ) {
    submitEvent.preventDefault();

    if (
      submitting ||
      redirecting ||
      registerInProgress.current
    ) {
      return;
    }

    const validation =
      validateForm();

    if (!validation.valid) {
      return;
    }

    registerInProgress.current =
      true;

    setSubmitting(true);

    setErrors({});

    const controller =
      new AbortController();

    registerController.current =
      controller;

    try {
      const response = await fetch(
        REGISTER_API,
        {
          method: "POST",

          credentials: "same-origin",

          cache: "no-store",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            email:
              validation.email,

            phoneE164:
              validation.phoneE164,

            password,

            acceptTerms: true,

            locale,
          }),

          signal:
            controller.signal,
        }
      );

      let result:
        RegistrationResponse = {};

      try {
        result =
          (await response.json()) as RegistrationResponse;
      } catch {
        // Réponse non JSON ou vide.
      }

      if (
        !response.ok ||
        result.success !== true
      ) {
        let message =
          translatedApiError(
            result.code,
            locale
          );

        if (!message) {
          if (response.status === 429) {
            message =
              t.tooManyRequests;
          } else if (
            response.status >= 500
          ) {
            message =
              t.configurationError;
          } else {
            message =
              result.message ||
              t.generalError;
          }
        }

        setErrors({
          general: message,
        });

        return;
      }

      /*
       * Le backend a accepté
       * l'inscription et l'envoi du code.
       *
       * L'utilisateur doit maintenant
       * vérifier son adresse email.
       */

      if (
        result.verificationRequired !==
        true
      ) {
        setErrors({
          general:
            t.generalError,
        });

        return;
      }

      /*
       * Ne pas conserver le mot de passe
       * dans l'état de la page.
       */

      setPassword("");

      setRedirecting(true);

      /*
       * La page de vérification pourra
       * préremplir l'email.
       *
       * Aucun OTP dans l'URL.
       */

      const verificationEmail =
        result.data?.email &&
        isValidEmail(result.data.email)
          ? normalizeEmail(
              result.data.email
            )
          : validation.email;

      const destination =
        `${VERIFY_URL}?email=` +
        encodeURIComponent(
          verificationEmail
        );

      router.push(destination);
    } catch (reason) {
      if (
        controller.signal.aborted
      ) {
        return;
      }

      setErrors({
        general:
          reason instanceof TypeError
            ? t.networkError
            : t.generalError,
      });
    } finally {
      registerInProgress.current =
        false;

      registerController.current =
        null;

      setSubmitting(false);
    }
  }

  /* ========================================================
     FORMULAIRE
  ======================================================== */

  return (
    <>
      {/* ==================================================
          FOOTER PUBLIC

          Sur PC, le footer existant
          reste disponible.

          Sur mobile, il est masqué
          uniquement pour l'inscription.

          Aucun header ou menu dupliqué.
      ================================================== */}

      

      <div
        id="tikemia-register-page"
        className="flex w-full min-w-0 flex-1 flex-col bg-white text-[#162236]"
      >
        {/* ==================================================
            LAYOUT PRINCIPAL

            PC :
            Image gauche / Formulaire droite

            MOBILE :
            Image en bannière / Formulaire
        ================================================== */}

        <div className="grid w-full min-w-0 flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-2">

          {/* ==================================================
              IMAGE PC

              Photo existante uniquement.
              Aucun texte ajouté sur l'image.
          ================================================== */}

          <section className="relative hidden min-h-0 overflow-hidden bg-[#06432e] lg:block">
            <Image fill sizes="(min-width: 1024px) 50vw, 100vw" unoptimized
              src={IMAGE_URL}
              alt=""
              aria-hidden="true"
              loading="eager"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          </section>

          {/* ==================================================
              PARTIE FORMULAIRE
          ================================================== */}

          <section className="flex w-full min-w-0 flex-col bg-[#f8faf9]">

            {/* ==============================================
                BANNIÈRE MOBILE / TABLETTE

                Même image paccueil.png.
                Sans texte superposé.
            ============================================== */}

            <div className="relative h-35 w-full overflow-hidden bg-[#06432e] sm:h-47.5 lg:hidden">
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

              <div className="-mt-7 w-full max-w-147.5 min-w-0 rounded-3xl border border-[#e3eae6] bg-white px-5 pt-7 pb-7 shadow-[0_12px_40px_rgba(15,51,30,0.1)] sm:mt-0 sm:px-8 sm:py-9 lg:rounded-[28px] xl:px-10">

                {/* ==========================================
                    ICÔNE ET TITRE
                ========================================== */}

                <div className="text-center">

                  <div className="mx-auto flex size-15.5 items-center justify-center rounded-full bg-linear-to-b from-[#1ab000] to-[#006c28] text-white shadow-[0_5px_12px_rgba(5,100,39,0.17)] sm:size-17.5">
                    <UserRoundPlus
                      size={33}
                      strokeWidth={1.8}
                    />
                  </div>

                  <h1 className="mt-4 text-[27px] font-black leading-tight tracking-tight text-[#0e1c2c] sm:text-[33px]">
                    {t.title}
                  </h1>

                  <p className="mt-2 text-[13px] text-[#718094] sm:text-sm">
                    {t.subtitle}
                  </p>
                </div>

                {/* ==========================================
                    FORMULAIRE PRINCIPAL
                ========================================== */}

                <form
                  onSubmit={handleRegister}
                  noValidate
                  className="mt-7 space-y-5"
                >

                  {/* ========================================
                      ADRESSE EMAIL
                  ======================================== */}

                  <div>
                    <label
                      htmlFor="tikemia-register-email"
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
                        className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[#314556]"
                      />

                      <input
                        id="tikemia-register-email"
                        type="email"
                        name="email"
                        autoComplete="email"
                        inputMode="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        maxLength={254}
                        required
                        disabled={
                          submitting ||
                          redirecting
                        }
                        value={email}
                        onChange={(
                          changeEvent
                        ) => {
                          setEmail(
                            changeEvent.target.value
                          );

                          setErrors(
                            (previous) => ({
                              ...previous,
                              email: undefined,
                              general: undefined,
                            })
                          );
                        }}
                        placeholder={
                          t.emailPlaceholder
                        }
                        aria-invalid={
                          Boolean(
                            errors.email
                          )
                        }
                        aria-describedby={
                          errors.email
                            ? "tikemia-register-email-error"
                            : undefined
                        }
                        className={`h-13 w-full min-w-0 rounded-xl border bg-[#fbfcff] pr-4 pl-12 text-sm font-medium text-[#243548] outline-none placeholder:font-normal placeholder:text-[#9aa6b6] focus:ring-2 disabled:opacity-60 ${
                          errors.email
                            ? "border-red-500 focus:ring-red-100"
                            : "border-[#d9e1e9] focus:border-[#087d2e] focus:ring-[#087d2e]/10"
                        }`}
                      />
                    </div>

                    {errors.email && (
                      <p
                        id="tikemia-register-email-error"
                        role="alert"
                        className="mt-2 text-xs font-semibold text-red-600"
                      >
                        {errors.email}
                      </p>
                    )}
                  </div>

                  {/* ========================================
                      TÉLÉPHONE INTERNATIONAL
                  ======================================== */}

                  <div>
                    <label
                      htmlFor="tikemia-register-phone"
                      className="mb-2 block text-[13px] font-extrabold text-[#1b2a3b]"
                    >
                      {t.phone}
                      <span className="ml-1 text-red-600">
                        *
                      </span>
                    </label>

                    <div className="flex w-full min-w-0 gap-2">

                      {/* ====================================
                          SÉLECTEUR DE PAYS

                          Indicatif détecté
                          automatiquement.

                          Modifiable manuellement.
                      ==================================== */}

                      <div
                        ref={countrySelectorRef}
                        className="relative shrink-0"
                      >
                        <button
                          type="button"
                          disabled={
                            submitting ||
                            redirecting
                          }
                          onClick={() => {
                            setCountrySelectorOpen(
                              (previous) =>
                                !previous
                            );
                          }}
                          aria-label={
                            t.country
                          }
                          aria-expanded={
                            countrySelectorOpen
                          }
                          className="flex h-13 min-w-26.25 items-center justify-center gap-1.5 rounded-xl border border-[#d9e1e9] bg-[#fbfcff] px-2.5 text-xs font-extrabold text-[#243548] transition-colors hover:border-[#087d2e] disabled:opacity-60 sm:min-w-30"
                        >
                          {currentCountry ? (
                            <>
                              <span className="text-[21px] leading-none">
                                {
                                  currentCountry.flag
                                }
                              </span>

                              <span>
                                +
                                {
                                  currentCountry.callingCode
                                }
                              </span>
                            </>
                          ) : (
                            <Globe2
                              size={18}
                            />
                          )}

                          <ChevronDown
                            size={14}
                            className="text-[#708095]"
                          />
                        </button>

                        {/* ================================
                            LISTE DES PAYS
                        ================================ */}

                        {countrySelectorOpen && (
                          <div className="absolute top-14.5 left-0 z-50 w-[min(310px,calc(100vw-32px))] overflow-hidden rounded-xl border border-[#d8e6db] bg-white shadow-[0_12px_35px_rgba(11,54,29,0.15)]">

                            <div className="border-b border-[#e8eee9] p-2.5">
                              <input
                                type="search"
                                autoFocus
                                value={
                                  countrySearch
                                }
                                onChange={(
                                  changeEvent
                                ) =>
                                  setCountrySearch(
                                    changeEvent
                                      .target.value
                                  )
                                }
                                placeholder={
                                  t.country
                                }
                                aria-label={
                                  t.country
                                }
                                className="h-10 w-full rounded-lg border border-[#dce6df] bg-[#f9fbf9] px-3 text-sm outline-none focus:border-[#087d2e]"
                              />
                            </div>

                            <div className="max-h-65 overflow-y-auto overscroll-contain">
                              {filteredCountries.map(
                                (country) => (
                                  <button
                                    key={
                                      country.code
                                    }
                                    type="button"
                                    onClick={() =>
                                      chooseCountry(
                                        country.code
                                      )
                                    }
                                    className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs transition-colors hover:bg-[#eff8f1] ${
                                      selectedCountry ===
                                      country.code
                                        ? "bg-[#eaf7ed] font-extrabold text-[#07592b]"
                                        : "text-[#405469]"
                                    }`}
                                  >
                                    <span className="shrink-0 text-xl">
                                      {
                                        country.flag
                                      }
                                    </span>

                                    <span className="min-w-0 flex-1">
                                      {
                                        country.name
                                      }
                                    </span>

                                    <span className="shrink-0 font-semibold">
                                      +
                                      {
                                        country.callingCode
                                      }
                                    </span>

                                    {selectedCountry ===
                                      country.code && (
                                      <Check
                                        size={14}
                                        className="shrink-0 text-[#087d2e]"
                                      />
                                    )}
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ====================================
                          SAISIE DU NUMÉRO
                      ==================================== */}

                      <div className="relative min-w-0 flex-1">
                        <Phone
                          size={18}
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#34495a]"
                        />

                        <input
                          id="tikemia-register-phone"
                          type="tel"
                          name="phone"
                          inputMode="tel"
                          autoComplete="tel-national"
                          required
                          maxLength={35}
                          disabled={
                            submitting ||
                            redirecting
                          }
                          value={phone}
                          onChange={(
                            changeEvent
                          ) => {
                            setPhone(
                              changeEvent
                                .target.value
                            );

                            setErrors(
                              (previous) => ({
                                ...previous,
                                phone: undefined,
                                general: undefined,
                              })
                            );
                          }}
                          placeholder={
                            t.phonePlaceholder
                          }
                          aria-invalid={
                            Boolean(
                              errors.phone
                            )
                          }
                          aria-describedby={
                            errors.phone
                              ? "tikemia-register-phone-error"
                              : undefined
                          }
                          className={`h-13 w-full min-w-0 rounded-xl border bg-[#fbfcff] pr-3 pl-10 text-sm font-medium text-[#243548] outline-none placeholder:font-normal placeholder:text-[#9aa6b6] focus:ring-2 disabled:opacity-60 ${
                            errors.phone
                              ? "border-red-500 focus:ring-red-100"
                              : "border-[#d9e1e9] focus:border-[#087d2e] focus:ring-[#087d2e]/10"
                          }`}
                        />
                      </div>
                    </div>

                    {errors.phone && (
                      <p
                        id="tikemia-register-phone-error"
                        role="alert"
                        className="mt-2 text-xs font-semibold text-red-600"
                      >
                        {errors.phone}
                      </p>
                    )}

                    {countryAutomaticallyDetected &&
                      currentCountry && (
                        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#748977]">
                          <Globe2
                            size={13}
                          />

                          {
                            t.detectedCountry
                          }
                        </p>
                      )}
                  </div>

                  {/* ========================================
                      MOT DE PASSE
                  ======================================== */}

                  <div>
                    <label
                      htmlFor="tikemia-register-password"
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
                        id="tikemia-register-password"
                        name="password"
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        autoComplete="new-password"
                        required
                        minLength={
                          PASSWORD_MIN_LENGTH
                        }
                        maxLength={256}
                        disabled={
                          submitting ||
                          redirecting
                        }
                        value={password}
                        onChange={(
                          changeEvent
                        ) => {
                          setPassword(
                            changeEvent
                              .target.value
                          );

                          setErrors(
                            (previous) => ({
                              ...previous,
                              password: undefined,
                              general: undefined,
                            })
                          );
                        }}
                        placeholder={
                          t.passwordPlaceholder
                        }
                        aria-invalid={
                          Boolean(
                            errors.password
                          )
                        }
                        aria-describedby={
                          errors.password
                            ? "tikemia-register-password-error"
                            : "tikemia-register-password-hint"
                        }
                        className={`h-13 w-full rounded-xl border bg-[#fbfcff] pr-12 pl-12 text-sm font-medium text-[#243548] outline-none placeholder:font-normal placeholder:text-[#9aa6b6] focus:ring-2 disabled:opacity-60 ${
                          errors.password
                            ? "border-red-500 focus:ring-red-100"
                            : "border-[#d9e1e9] focus:border-[#087d2e] focus:ring-[#087d2e]/10"
                        }`}
                      />

                      <button
                        type="button"
                        disabled={
                          submitting ||
                          redirecting
                        }
                        onClick={() =>
                          setShowPassword(
                            (previous) =>
                              !previous
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
                          <EyeOff
                            size={20}
                          />
                        ) : (
                          <Eye
                            size={20}
                          />
                        )}
                      </button>
                    </div>

                    <p
                      id="tikemia-register-password-hint"
                      className="mt-2 text-[11px] text-[#81909e]"
                    >
                      {t.passwordHint}
                    </p>

                    {errors.password && (
                      <p
                        id="tikemia-register-password-error"
                        role="alert"
                        className="mt-2 text-xs font-semibold text-red-600"
                      >
                        {
                          errors.password
                        }
                      </p>
                    )}
                  </div>

                  {/* ========================================
                      CONDITIONS D'UTILISATION
                  ======================================== */}

                  <div>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        name="acceptTerms"
                        checked={
                          acceptedTerms
                        }
                        disabled={
                          submitting ||
                          redirecting
                        }
                        onChange={(
                          changeEvent
                        ) => {
                          setAcceptedTerms(
                            changeEvent
                              .target.checked
                          );

                          setErrors(
                            (previous) => ({
                              ...previous,
                              terms: undefined,
                              general: undefined,
                            })
                          );
                        }}
                        aria-invalid={
                          Boolean(
                            errors.terms
                          )
                        }
                        className="mt-0.5 size-4 shrink-0 accent-[#087d2e]"
                      />

                      <span className="text-[12px] leading-relaxed text-[#536578]">
                        {t.termsBeginning}{" "}

                        <Link
                          href="/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-extrabold text-[#087d2e] hover:underline"
                        >
                          {t.terms}
                        </Link>{" "}

                        {t.termsMiddle}{" "}

                        <Link
                          href="/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-extrabold text-[#087d2e] hover:underline"
                        >
                          {t.privacy}
                        </Link>
                        .
                      </span>
                    </label>

                    {errors.terms && (
                      <p
                        role="alert"
                        className="mt-2 text-xs font-semibold text-red-600"
                      >
                        {errors.terms}
                      </p>
                    )}
                  </div>

                  {/* ========================================
                      ERREUR GÉNÉRALE
                  ======================================== */}

                  {errors.general && (
                    <div
                      role="alert"
                      aria-live="assertive"
                      className="flex items-start gap-2.5 rounded-xl border border-[#f2c9c9] bg-[#fff5f5] px-3 py-3 text-xs font-semibold leading-relaxed text-[#ae3030]"
                    >
                      <CircleAlert
                        size={18}
                        className="shrink-0"
                      />

                      <p>
                        {errors.general}
                      </p>
                    </div>
                  )}

                  {/* ========================================
                      BOUTON INSCRIPTION
                  ======================================== */}

                  <button
                    type="submit"
                    disabled={
                      submitting ||
                      redirecting
                    }
                    className="flex min-h-13.25 w-full items-center justify-center gap-3 rounded-full bg-linear-to-b from-[#1fb100] to-[#006e28] px-5 py-3 text-[15px] font-extrabold text-white shadow-[0_5px_12px_rgba(5,102,37,0.15)] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {submitting ||
                    redirecting ? (
                      <>
                        <LoaderCircle
                          size={20}
                          className="animate-spin"
                        />

                        {redirecting
                          ? t.redirecting
                          : t.registering}
                      </>
                    ) : (
                      <>
                        <UserRoundPlus
                          size={20}
                        />

                        {t.register}

                        <ArrowRight
                          size={17}
                        />
                      </>
                    )}
                  </button>

                  {/* ========================================
                      CONNEXION
                  ======================================== */}

                  <div className="pt-1">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="h-px flex-1 bg-[#e2e9e4]" />

                      <p className="text-center text-xs font-semibold text-[#5d6f7c]">
                        {t.alreadyAccount}
                      </p>

                      <div className="h-px flex-1 bg-[#e2e9e4]" />
                    </div>

                    <Link
                      href="/login"
                      className="flex min-h-12.25 w-full items-center justify-center rounded-full border border-[#088e30] bg-white px-5 py-3 text-sm font-extrabold text-[#087d2e] transition-colors hover:bg-[#f2faf4]"
                    >
                      {t.login}
                    </Link>
                  </div>

                  {/* ========================================
                      SÉCURITÉ

                      Aucune explication sur
                      le code à 6 chiffres
                      affichée ici.
                  ======================================== */}

                  <div className="flex items-center justify-center gap-2 pt-1 text-[11px] font-semibold text-[#71867a]">
                    <ShieldCheck
                      size={18}
                      className="text-[#087d2e]"
                    />

                    {t.security}
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
