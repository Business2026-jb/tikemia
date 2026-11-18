
"use client";

import { OrganizerPublicHeader } from "@/components/organizer/OrganizerHeader";

import Image from "next/image";
import { useRouter } from "next/navigation";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import Link from "next/link";

import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Eye,
  EyeOff,
  Headphones,
  LockKeyhole,
  LoaderCircle,
  LogIn,
  Mail,
  ShieldCheck,
  UserRound,
  UserRoundPlus,
  Zap,
} from "lucide-react";

/* ==========================================================
   TIKEMIA — CONNEXION ORGANISATEUR

   PAGE :
   /organizer/login

   API :
   POST /api/organizer/auth/login

   FONCTIONNALITÉS :
   - Connexion par email et mot de passe
   - Afficher / masquer le mot de passe
   - Se souvenir de moi
   - Mot de passe oublié
   - Inscription organisateur
   - Gestion des erreurs serveur
   - Protection double soumission
   - Redirection après connexion
   - Français et anglais
   - Responsive PC et mobile

   SÉCURITÉ :
   - Session créée exclusivement par le serveur
   - Aucune conservation du mot de passe
   - Aucun token dans localStorage
   - Aucune redirection externe
   - Cookie HttpOnly géré par l'API

   Le menu du site reste géré
   par le layout organisateur existant.

   Aucune nouvelle API.
   Aucun CSS module.
========================================================== */

const LOGIN_API = "/api/organizer/auth/login";

const DASHBOARD_URL = "/organizer/dashboard";

const REGISTER_URL = "/organizer/register";

const FORGOT_PASSWORD_URL =
  "/organizer/forgot-password";

const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 1024;

type Locale = "fr" | "en";

type ApiErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_CREDENTIALS"
  | "TOO_MANY_ATTEMPTS"
  | "FORBIDDEN"
  | "SERVICE_UNAVAILABLE";

type LoginResponse = {
  success?: boolean;
  code?: string;
  message?: string;
  redirectTo?: string;
  user?: {
    id?: string;
    fullName?: string;
    email?: string;
  };
};

type Notice = {
  type: "error" | "success";
  message: string;
};

/* ==========================================================
   TRADUCTIONS FR / EN
========================================================== */

const TRANSLATIONS = {
  fr: {
    organizer: "Espace Organisateur",

    title: "Se connecter",

    subtitle:
      "Accédez à votre espace organisateur.",

    email: "Adresse email",

    emailPlaceholder:
      "Entrez votre adresse email",

    emailRequired:
      "Veuillez saisir une adresse email valide.",

    password: "Mot de passe",

    passwordPlaceholder:
      "Entrez votre mot de passe",

    passwordRequired:
      "Veuillez saisir votre mot de passe.",

    showPassword:
      "Afficher le mot de passe",

    hidePassword:
      "Masquer le mot de passe",

    rememberMe:
      "Se souvenir de moi",

    forgotPassword:
      "Mot de passe oublié ?",

    loginButton:
      "Se connecter",

    loggingIn:
      "Connexion en cours...",

    noAccount:
      "Pas encore de compte organisateur ?",

    registerButton:
      "Créer un compte maintenant",

    secureAccount:
      "Compte sécurisé",

    quickAccess:
      "Accès rapide",

    dedicatedSupport:
      "Assistance dédiée",

    securityText:
      "Vos identifiants sont protégés.",

    invalidCredentials:
      "Adresse email ou mot de passe incorrect.",

    invalidRequest:
      "Veuillez vérifier les informations saisies.",

    tooManyAttempts:
      "Trop de tentatives de connexion. Veuillez réessayer plus tard.",

    forbidden:
      "Connexion non autorisée.",

    unavailable:
      "La connexion est momentanément indisponible.",

    networkError:
      "Impossible de contacter le serveur. Vérifiez votre connexion internet.",

    unknownError:
      "Une erreur est survenue. Veuillez réessayer.",

    success:
      "Connexion réussie.",

    redirecting:
      "Ouverture de votre espace organisateur...",

    required:
      "Champ obligatoire",

    home:
      "Retour à l'accueil",

    imageAlt:
      "Espace organisateur TIKEMIA",
  },

  en: {
    organizer: "Organizer Space",

    title: "Sign in",

    subtitle:
      "Access your organizer dashboard.",

    email: "Email address",

    emailPlaceholder:
      "Enter your email address",

    emailRequired:
      "Please enter a valid email address.",

    password: "Password",

    passwordPlaceholder:
      "Enter your password",

    passwordRequired:
      "Please enter your password.",

    showPassword:
      "Show password",

    hidePassword:
      "Hide password",

    rememberMe:
      "Remember me",

    forgotPassword:
      "Forgot password?",

    loginButton:
      "Sign in",

    loggingIn:
      "Signing in...",

    noAccount:
      "Don't have an organizer account?",

    registerButton:
      "Create an account now",

    secureAccount:
      "Secure account",

    quickAccess:
      "Quick access",

    dedicatedSupport:
      "Dedicated support",

    securityText:
      "Your login credentials are protected.",

    invalidCredentials:
      "Incorrect email address or password.",

    invalidRequest:
      "Please check the information you entered.",

    tooManyAttempts:
      "Too many login attempts. Please try again later.",

    forbidden:
      "Sign-in is not authorized.",

    unavailable:
      "Login is temporarily unavailable.",

    networkError:
      "Unable to contact the server. Check your internet connection.",

    unknownError:
      "Something went wrong. Please try again.",

    success:
      "Successfully signed in.",

    redirecting:
      "Opening your organizer dashboard...",

    required:
      "Required field",

    home:
      "Back to homepage",

    imageAlt:
      "TIKEMIA organizer space",
  },
} as const;

/* ==========================================================
   STYLES TAILWIND

   Utilisation du global.css existant.
========================================================== */

const INPUT_CLASS =
  "h-12 w-full min-w-0 rounded-xl border border-[#d7e0eb] " +
  "bg-[#fafbfd] px-4 text-sm font-medium text-[#17233a] " +
  "outline-none transition-colors duration-150 " +
  "placeholder:text-[#8290a1] " +
  "focus:border-[#088d33] focus:bg-white " +
  "focus:ring-2 focus:ring-[#0b8b33]/10 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const PRIMARY_BUTTON_CLASS =
  "inline-flex min-h-12 w-full items-center justify-center " +
  "gap-2 rounded-xl bg-[#07852d] px-5 py-3 " +
  "text-sm font-extrabold text-white " +
  "transition-colors duration-150 " +
  "hover:bg-[#056c25] " +
  "focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 " +
  "focus-visible:outline-[#087c2b] " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const SECONDARY_BUTTON_CLASS =
  "inline-flex min-h-12 w-full items-center justify-center " +
  "gap-2 rounded-xl border border-[#07852d] bg-white " +
  "px-5 py-3 text-sm font-extrabold text-[#07782a] " +
  "transition-colors duration-150 " +
  "hover:bg-[#eef8f0] " +
  "focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 " +
  "focus-visible:outline-[#087c2b]";

/* ==========================================================
   UTILITAIRES
========================================================== */

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function validEmail(value: string): boolean {
  const email = normalizeEmail(value);

  return (
    email.length >= 5 &&
    email.length <= MAX_EMAIL_LENGTH &&
    EMAIL_REGEX.test(email)
  );
}

function validPassword(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_PASSWORD_LENGTH &&
    !value.includes("\0")
  );
}

function isApiErrorCode(
  value: unknown
): value is ApiErrorCode {
  return (
    value === "INVALID_REQUEST" ||
    value === "INVALID_CREDENTIALS" ||
    value === "TOO_MANY_ATTEMPTS" ||
    value === "FORBIDDEN" ||
    value === "SERVICE_UNAVAILABLE"
  );
}

function readableError(
  code: unknown,
  status: number,
  locale: Locale
): string {
  const t = TRANSLATIONS[locale];

  if (isApiErrorCode(code)) {
    const messages: Record<ApiErrorCode, string> = {
      INVALID_REQUEST: t.invalidRequest,
      INVALID_CREDENTIALS: t.invalidCredentials,
      TOO_MANY_ATTEMPTS: t.tooManyAttempts,
      FORBIDDEN: t.forbidden,
      SERVICE_UNAVAILABLE: t.unavailable,
    };

    return messages[code];
  }

  if (status === 401) {
    return t.invalidCredentials;
  }

  if (status === 429) {
    return t.tooManyAttempts;
  }

  if (status === 403) {
    return t.forbidden;
  }

  if (status >= 500) {
    return t.unavailable;
  }

  return t.unknownError;
}

/* ==========================================================
   COMPOSANT : GARANTIE VISUELLE
========================================================== */

function FeatureItem({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-2 px-2 text-center">
      <span className="flex h-8 items-center justify-center">
        {icon}
      </span>

      <span className="text-[10px] font-bold leading-snug text-[#263147] sm:text-xs">
        {text}
      </span>
    </div>
  );
}

/* ==========================================================
   PAGE PRINCIPALE
========================================================== */

export default function OrganizerLoginPage() {
  const router = useRouter();
  /* --------------------------------------------------------
     LANGUE
  -------------------------------------------------------- */

  const [locale, setLocale] = useState<Locale>("fr");

  /* --------------------------------------------------------
     FORMULAIRE
  -------------------------------------------------------- */

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [rememberMe, setRememberMe] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  /* --------------------------------------------------------
     INTERFACE
  -------------------------------------------------------- */

  const [loading, setLoading] = useState(false);

  const [redirecting, setRedirecting] = useState(false);

  const [notice, setNotice] = useState<Notice | null>(null);

  const [submitted, setSubmitted] = useState(false);

  const requestInProgress = useRef(false);

  const abortControllerRef =
    useRef<AbortController | null>(null);

  const t = TRANSLATIONS[locale];

  /* ========================================================
     SYNCHRONISATION DE LA LANGUE

     Utilise la préférence du site TIKEMIA.
  ======================================================== */

  useEffect(() => {
    function syncLanguage() {
      try {
        const saved = localStorage.getItem(
          "tikemia_locale"
        );

        if (saved === "fr" || saved === "en") {
          setLocale(saved);
          return;
        }
      } catch {
        // Le stockage local peut être indisponible.
      }

      const htmlLanguage =
        document.documentElement.lang.toLowerCase();

      setLocale(
        htmlLanguage.startsWith("en") ? "en" : "fr"
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
     NETTOYAGE REQUÊTE

     Empêche les mises à jour inutiles
     après fermeture du composant.
  ======================================================== */

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  /* ========================================================
     VALIDATION
  ======================================================== */

  const emailIsValid = validEmail(email);

  const passwordIsValid = validPassword(password);

  const emailHasError =
    submitted && !emailIsValid;

  const passwordHasError =
    submitted && !passwordIsValid;

  const formIsValid =
    emailIsValid && passwordIsValid;

  /* ========================================================
     MODIFICATION DES CHAMPS
  ======================================================== */

  const updateEmail = useCallback((value: string) => {
    setEmail(value);
    setNotice(null);
  }, []);

  const updatePassword = useCallback((value: string) => {
    setPassword(value);
    setNotice(null);
  }, []);

  /* ========================================================
     CONNEXION À L'API EXISTANTE

     Le mot de passe est envoyé au serveur
     uniquement dans la requête HTTPS.

     L'API crée le cookie de session
     sécurisé HttpOnly.

     Aucun token n'est conservé ici.
  ======================================================== */

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (requestInProgress.current || redirecting) {
      return;
    }

    setSubmitted(true);
    setNotice(null);

    const normalizedEmail = normalizeEmail(email);

    if (!validEmail(normalizedEmail)) {
      setNotice({
        type: "error",
        message: t.emailRequired,
      });

      return;
    }

    if (!validPassword(password)) {
      setNotice({
        type: "error",
        message: t.passwordRequired,
      });

      return;
    }

    const controller = new AbortController();

    abortControllerRef.current = controller;

    requestInProgress.current = true;

    setLoading(true);

    try {
      const response = await fetch(
        `${LOGIN_API}?locale=${locale}`,
        {
          method: "POST",

          credentials: "same-origin",

          cache: "no-store",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            email: normalizedEmail,
            password,
            rememberMe,
          }),

          signal: controller.signal,
        }
      );

      let result: LoginResponse;

      try {
        result =
          (await response.json()) as LoginResponse;
      } catch {
        throw new Error("INVALID_RESPONSE");
      }

      /* ----------------------------------------------------
         ERREUR SERVEUR
      ---------------------------------------------------- */

      if (
        !response.ok ||
        result.success !== true
      ) {
        setNotice({
          type: "error",
          message: readableError(
            result.code,
            response.status,
            locale
          ),
        });

        return;
      }

      /* ----------------------------------------------------
         CONNEXION RÉUSSIE

         La session est déjà enregistrée
         côté serveur.

         Supprimer le mot de passe de
         l'état du formulaire.
      ---------------------------------------------------- */

      setPassword("");
      setShowPassword(false);

      setNotice({
        type: "success",
        message: t.success,
      });

      setRedirecting(true);

      /*
       * Navigation complète :
       * les composants du dashboard
       * relisent immédiatement le cookie
       * et les données de session.
       *
       * On utilise une destination fixe
       * pour empêcher une redirection
       * vers un site extérieur.
       */

      router.replace(DASHBOARD_URL);
      router.refresh();
    } catch (error) {
      if (
        controller.signal.aborted ||
        (error instanceof Error &&
          error.name === "AbortError")
      ) {
        return;
      }

      setNotice({
        type: "error",

        message:
          error instanceof Error &&
          error.message === "INVALID_RESPONSE"
            ? t.unknownError
            : t.networkError,
      });
    } finally {
      requestInProgress.current = false;

      abortControllerRef.current = null;

      setLoading(false);
    }
  }

  /* ========================================================
     RENDU
  ======================================================== */

  return (
    <main className="min-h-dvh w-full min-w-0 overflow-x-hidden bg-[#f7f9f8] text-[#17243b]">
      <OrganizerPublicHeader locale={locale} onLocaleChange={setLocale} />
      <div className="grid w-full min-w-0 grid-cols-1 lg:min-h-[calc(100dvh-72px)] lg:grid-cols-[0.42fr_0.58fr]">
        {/* ==================================================
            IMAGE ORGANISATEUR

            Image existante du projet.

            Aucun texte promotionnel ajouté.
        ================================================== */}

        <section className="relative h-48 w-full overflow-hidden bg-[#003b2a] sm:h-64 lg:h-auto lg:min-h-150">
          <Image
            width={220} height={80} unoptimized src="/images/orgaccueil.png"
            loading="eager"
            fetchPriority="high"
            alt={t.imageAlt}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />

          {/* Bande décorative TIKEMIA */}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2 bg-linear-to-r from-[#087f2e] via-[#f8d015] to-[#e12c35] sm:h-3" />
        </section>

        {/* ==================================================
            FORMULAIRE DE CONNEXION
        ================================================== */}

        <section className="flex min-w-0 items-center justify-center px-3 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-6 xl:px-12">
          <div className="w-full max-w-215 overflow-hidden rounded-2xl border border-[#e0e8e3] bg-white px-4 py-6 shadow-sm sm:rounded-3xl sm:px-8 sm:py-9 lg:px-8 lg:py-7">
            {/* LOGO ET IDENTITÉ */}

            <div className="mb-6 flex flex-col items-center text-center">
              <div className="flex size-15 items-center justify-center rounded-full bg-[#e7f8eb] text-[#087c2d]">
                <UserRound
                  size={30}
                  strokeWidth={2}
                />
              </div>

              <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-[#161c32] sm:text-3xl">
                {t.title}
              </h1>

              <p className="mt-2 text-sm leading-relaxed text-[#5c6c85]">
                {t.subtitle}
              </p>

              <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#edf8ee] px-3 py-1.5 text-[11px] font-extrabold text-[#08752b]">
                <ShieldCheck size={14} />
                {t.organizer}
              </span>
            </div>

            {/* ==============================================
                NOTIFICATIONS
            ============================================== */}

            {notice && (
              <div
                role={
                  notice.type === "error"
                    ? "alert"
                    : "status"
                }
                aria-live={
                  notice.type === "error"
                    ? "assertive"
                    : "polite"
                }
                className={`mb-5 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-xs font-semibold leading-relaxed sm:text-sm ${
                  notice.type === "error"
                    ? "border-[#f2c8ce] bg-[#fff0f2] text-[#a41d32]"
                    : "border-[#bce4c4] bg-[#ecfaef] text-[#08752c]"
                }`}
              >
                {notice.type === "error" ? (
                  <CircleAlert
                    size={19}
                    className="shrink-0"
                  />
                ) : (
                  <CheckCircle2
                    size={19}
                    className="shrink-0"
                  />
                )}

                <span className="min-w-0 flex-1">
                  {notice.message}
                </span>
              </div>
            )}

            {/* ==============================================
                FORMULAIRE
            ============================================== */}

            <form
              onSubmit={handleLogin}
              noValidate
              className="space-y-5"
            >
              {/* EMAIL */}

              <div>
                <label
                  htmlFor="organizer-login-email"
                  className="mb-2 block text-sm font-bold text-[#253149]"
                >
                  {t.email}

                  <span
                    aria-hidden="true"
                    className="ml-1 text-red-600"
                  >
                    *
                  </span>
                </label>

                <div className="relative">
                  <Mail
                    size={19}
                    className="pointer-events-none absolute top-3.5 left-3.5 text-[#60758b]"
                  />

                  <input
                    id="organizer-login-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={MAX_EMAIL_LENGTH}
                    placeholder={t.emailPlaceholder}
                    value={email}
                    onChange={(event) =>
                      updateEmail(event.target.value)
                    }
                    disabled={loading || redirecting}
                    aria-required="true"
                    aria-invalid={emailHasError}
                    aria-describedby={
                      emailHasError
                        ? "organizer-email-error"
                        : undefined
                    }
                    className={`${INPUT_CLASS} pl-11 ${
                      emailHasError
                        ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                        : ""
                    }`}
                  />
                </div>

                {emailHasError && (
                  <p
                    id="organizer-email-error"
                    className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-600"
                  >
                    <CircleAlert size={14} />
                    {t.emailRequired}
                  </p>
                )}
              </div>

              {/* MOT DE PASSE */}

              <div>
                <label
                  htmlFor="organizer-login-password"
                  className="mb-2 block text-sm font-bold text-[#253149]"
                >
                  {t.password}

                  <span
                    aria-hidden="true"
                    className="ml-1 text-red-600"
                  >
                    *
                  </span>
                </label>

                <div className="relative">
                  <LockKeyhole
                    size={19}
                    className="pointer-events-none absolute top-3.5 left-3.5 text-[#60758b]"
                  />

                  <input
                    id="organizer-login-password"
                    name="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    autoComplete="current-password"
                    maxLength={MAX_PASSWORD_LENGTH}
                    placeholder={t.passwordPlaceholder}
                    value={password}
                    onChange={(event) =>
                      updatePassword(event.target.value)
                    }
                    disabled={loading || redirecting}
                    aria-required="true"
                    aria-invalid={passwordHasError}
                    aria-describedby={
                      passwordHasError
                        ? "organizer-password-error"
                        : undefined
                    }
                    className={`${INPUT_CLASS} pr-12 pl-11 ${
                      passwordHasError
                        ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                        : ""
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (previous) => !previous
                      )
                    }
                    disabled={loading || redirecting}
                    aria-label={
                      showPassword
                        ? t.hidePassword
                        : t.showPassword
                    }
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-1 flex w-11 items-center justify-center rounded-lg text-[#53677f] hover:text-[#087d2e] disabled:opacity-50"
                  >
                    {showPassword ? (
                      <EyeOff size={20} />
                    ) : (
                      <Eye size={20} />
                    )}
                  </button>
                </div>

                {passwordHasError && (
                  <p
                    id="organizer-password-error"
                    className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-600"
                  >
                    <CircleAlert size={14} />
                    {t.passwordRequired}
                  </p>
                )}
              </div>

              {/* ============================================
                  SE SOUVENIR / MOT DE PASSE OUBLIÉ
              ============================================ */}

              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3">
                <label className="inline-flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={rememberMe}
                    onChange={(event) =>
                      setRememberMe(
                        event.target.checked
                      )
                    }
                    disabled={loading || redirecting}
                    className="size-4 cursor-pointer rounded border-[#c3cfda] accent-[#087d2c]"
                  />

                  <span className="text-xs font-semibold text-[#34435b] sm:text-sm">
                    {t.rememberMe}
                  </span>
                </label>

                <Link
                  href={FORGOT_PASSWORD_URL}
                  className="text-xs font-bold text-[#087b2c] underline decoration-[#087b2c]/40 underline-offset-4 transition-colors hover:text-[#055e20] sm:text-sm"
                >
                  {t.forgotPassword}
                </Link>
              </div>

              {/* ============================================
                  BOUTON CONNEXION
              ============================================ */}

              <button
                type="submit"
                disabled={
                  loading ||
                  redirecting ||
                  !formIsValid
                }
                className={PRIMARY_BUTTON_CLASS}
              >
                {loading || redirecting ? (
                  <LoaderCircle
                    size={19}
                    className="animate-spin"
                  />
                ) : (
                  <LogIn size={19} />
                )}

                {redirecting
                  ? t.redirecting
                  : loading
                    ? t.loggingIn
                    : t.loginButton}
              </button>
            </form>

            {/* ==============================================
                LIEN INSCRIPTION
            ============================================== */}

            <div className="mt-7">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-[#e5ebef]" />

                <p className="shrink-0 text-center text-[11px] font-semibold text-[#61718a] sm:text-xs">
                  {t.noAccount}
                </p>

                <span className="h-px flex-1 bg-[#e5ebef]" />
              </div>

              <Link
                href={REGISTER_URL}
                className={`${SECONDARY_BUTTON_CLASS} mt-4`}
              >
                <UserRoundPlus size={19} />
                {t.registerButton}
                <ArrowRight size={17} />
              </Link>
            </div>

            {/* ==============================================
                SERVICES VISUELS

                Trois informations uniquement,
                comme sur l'architecture.
            ============================================== */}

            <div className="mt-6 grid grid-cols-3 divide-x divide-[#dce4eb] rounded-xl bg-[#f3f6f9] px-2 py-4">
              <FeatureItem
                icon={
                  <ShieldCheck
                    size={24}
                    className="text-[#078b31]"
                  />
                }
                text={t.secureAccount}
              />

              <FeatureItem
                icon={
                  <Zap
                    size={24}
                    className="text-[#e8ad00]"
                  />
                }
                text={t.quickAccess}
              />

              <FeatureItem
                icon={
                  <Headphones
                    size={24}
                    className="text-[#078b31]"
                  />
                }
                text={t.dedicatedSupport}
              />
            </div>

            {/* NOTE DISCRÈTE */}

            <div className="mt-5 flex items-center justify-center gap-2 text-center">
              <ShieldCheck
                size={15}
                className="shrink-0 text-[#078b31]"
              />

              <p className="text-[11px] font-medium text-[#7b8899]">
                {t.securityText}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
