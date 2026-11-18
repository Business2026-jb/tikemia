
"use client";

import { OrganizerPublicHeader } from "@/components/organizer/OrganizerHeader";

import { useSyncExternalStore } from "react";

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
  useRef,
  useState,
  type FormEvent,
  type ChangeEvent,
} from "react";

import Link from "next/link";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
  Ticket,
  AlertCircle,
} from "lucide-react";

import fr from "@/i18n/fr.json";
import en from "@/i18n/en.json";

import {
  defaultLocale,
  i18nConfig,
  normalizeLocale,
  type Locale,
} from "@/i18n/config";

/* ============================================
   TIKEMIA — VÉRIFICATION EMAIL

   Page :
   /organizer/verify-email

   Responsive :
   Mobile / Tablette / PC

   Technologies :
   Next.js + TypeScript + Tailwind CSS

   API :
   POST /api/organizer/verify-email
   POST /api/organizer/resend-code

   Langues :
   Français / Anglais
============================================ */

const dictionaries = {
  fr: fr.auth,
  en: en.auth,
};

const landingDictionaries = {
  fr: fr.organizerLanding,
  en: en.organizerLanding,
};

/* ============================================
   ROUTES
============================================ */

const ROUTES = {
  organizer: "/organizer",
  register: "/organizer/register",
  login: "/organizer/login",
  dashboard: "/organizer/dashboard",
  verifyAPI: "/api/organizer/verify-email",
  resendAPI: "/api/organizer/resend-code",
};

/* ============================================
   CONFIGURATION
============================================ */

const OTP_LENGTH = 6;
const RESEND_DELAY = 60;
const MAX_EMAIL_LENGTH = 254;
const REQUEST_TIMEOUT = 15000;

const EMAIL_STORAGE_KEY = "tikemia_organizer_email";

/* ============================================
   TEXTES COMPLÉMENTAIRES

   Les textes déjà présents dans les fichiers
   de traduction sont chargés séparément.
============================================ */

const uiText = {
  fr: {
    back: "Retour",
    title: "Vérification de votre adresse e-mail",
    subtitle: "Saisissez le code à 6 chiffres envoyé à",
    email: "Adresse e-mail",
    emailPlaceholder: "Votre adresse e-mail",
    code: "Code de vérification",
    codePlaceholder: "000000",
    verify: "Vérifier mon adresse e-mail",
    verifying: "Vérification en cours...",
    resend: "Renvoyer le code",
    sending: "Envoi en cours...",
    resendIn: "Nouveau code dans",
    changeEmail: "Modifier l'adresse e-mail",
    missingEmail: "Veuillez saisir votre adresse e-mail.",
    invalidEmail: "Adresse e-mail invalide.",
    invalidCode: "Saisissez les 6 chiffres du code.",
    networkError:
      "Connexion impossible. Veuillez réessayer.",
    unknownError:
      "Une erreur est survenue. Veuillez réessayer.",
    verified: "Adresse e-mail vérifiée.",
    redirecting: "Ouverture de votre espace organisateur...",
    codeSent:
      "Si votre compte est en attente de vérification, un nouveau code vous sera envoyé.",
    organizer: "Espace Organisateur",
    help: "Vous n'avez pas reçu le code ?",
    security: "Vérification sécurisée",
    menu: "Menu",
    closeMenu: "Fermer le menu",
    language: "Langue",
  },
  en: {
    back: "Back",
    title: "Verify your email address",
    subtitle: "Enter the 6-digit code sent to",
    email: "Email address",
    emailPlaceholder: "Your email address",
    code: "Verification code",
    codePlaceholder: "000000",
    verify: "Verify my email address",
    verifying: "Verifying...",
    resend: "Resend code",
    sending: "Sending...",
    resendIn: "New code in",
    changeEmail: "Change email address",
    missingEmail: "Please enter your email address.",
    invalidEmail: "Invalid email address.",
    invalidCode: "Enter the 6-digit code.",
    networkError:
      "Connection failed. Please try again.",
    unknownError:
      "An error occurred. Please try again.",
    verified: "Email address verified.",
    redirecting: "Opening your organizer dashboard...",
    codeSent:
      "If your account is awaiting verification, a new code will be sent.",
    organizer: "Organizer Space",
    help: "Didn't receive the code?",
    security: "Secure verification",
    menu: "Menu",
    closeMenu: "Close menu",
    language: "Language",
  },
} as const;

/* ============================================
   TYPES
============================================ */

type FeedbackType = "success" | "error" | "info";

type Feedback = {
  type: FeedbackType;
  message: string;
};

type APIResponse = {
  success?: boolean;
  message?: string;
  redirectTo?: string;
  verified?: boolean;
};

/* ============================================
   UTILITAIRES
============================================ */

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return (
    value.length <= MAX_EMAIL_LENGTH &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function cleanOTP(value: string): string {
  return value.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remaining
  ).padStart(2, "0")}`;
}

function safeRedirect(value: unknown): string {
  if (
    typeof value === "string" &&
    value.startsWith("/organizer/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !value.includes("?") &&
    !value.includes("#")
  ) {
    return value;
  }

  return ROUTES.dashboard;
}

async function postJSON(
  url: string,
  data: Record<string, unknown>
): Promise<{
  ok: boolean;
  status: number;
  data: APIResponse;
}> {
  const controller = new AbortController();

  const timeout = window.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    const result: unknown = await response
      .json()
      .catch(() => ({}));

    const parsed: APIResponse =
      typeof result === "object" &&
      result !== null &&
      !Array.isArray(result)
        ? (result as APIResponse)
        : {};

    return {
      ok: response.ok,
      status: response.status,
      data: parsed,
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

/* ============================================
   PAGE
============================================ */

export default function OrganizerVerifyEmailPage() {
  /* ==========================================
     ÉTATS
  ========================================== */

  const storedLocale = useSyncExternalStore(subscribeLocale, readStoredLocale, () => defaultLocale);
  const [selectedLocale, setLanguage] = useState<Locale | null>(null);
  const language = selectedLocale ?? storedLocale;

const initialEmail = useSyncExternalStore(subscribeLocale, () => {
    try {
      const queryEmail = new URLSearchParams(window.location.search).get("email");
      const value = normalizeEmail(window.sessionStorage.getItem(EMAIL_STORAGE_KEY) || queryEmail || "");
      return isValidEmail(value) ? value : "";
    } catch {
      return "";
    }
  }, () => "");
  const [editedEmail, setEmail] = useState<string | null>(null);
  const email = editedEmail ?? initialEmail;
  const [code, setCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const [verified, setVerified] = useState(false);

  const [countdown, setCountdown] =
    useState(RESEND_DELAY);

  const [feedback, setFeedback] =
    useState<Feedback | null>(null);

  const codeInputRef = useRef<HTMLInputElement>(null);
  const requestLock = useRef(false);

  const t = dictionaries[language];
  const landing = landingDictionaries[language];
  const ui = uiText[language];

  /* ==========================================
     CHARGER LA LANGUE ET L'EMAIL
  ========================================== */



  /* ==========================================
     LANGUE HTML
  ========================================== */

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  /* ==========================================
     COMPTE À REBOURS
  ========================================== */

  useEffect(() => {
    if (countdown <= 0 || verified) {
      return;
    }

    const interval = window.setInterval(() => {
      setCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [countdown, verified]);

  /* ==========================================
     CHANGEMENT DE LANGUE
  ========================================== */

  function changeLanguage(nextLanguage: Locale) {
    setLanguage(nextLanguage);


    try {
      window.localStorage.setItem(
        i18nConfig.storageKey,
        nextLanguage
      );
    } catch {
      // Le changement reste fonctionnel.
    }
  }

  

  /* ==========================================
     GESTION DU CODE OTP
  ========================================== */

  function handleCodeChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setCode(cleanOTP(event.target.value));

    if (feedback?.type === "error") {
      setFeedback(null);
    }
  }

  /* ==========================================
     VALIDATION EMAIL
  ========================================== */

  function getValidEmail(): string | null {
    const normalized = normalizeEmail(email);

    if (!normalized) {
      setFeedback({
        type: "error",
        message: ui.missingEmail,
      });

      return null;
    }

    if (!isValidEmail(normalized)) {
      setFeedback({
        type: "error",
        message: ui.invalidEmail,
      });

      return null;
    }

    return normalized;
  }

  /* ==========================================
     VÉRIFICATION DU CODE
  ========================================== */

  async function handleVerification(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      requestLock.current ||
      loading ||
      resending ||
      verified
    ) {
      return;
    }

    const validEmail = getValidEmail();

    if (!validEmail) {
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      setFeedback({
        type: "error",
        message: ui.invalidCode,
      });

      codeInputRef.current?.focus();
      return;
    }

    requestLock.current = true;
    setLoading(true);
    setFeedback(null);

    try {
      const result = await postJSON(
        ROUTES.verifyAPI,
        {
          email: validEmail,
          code,
          locale: language,
        }
      );

      if (
        !result.ok ||
        result.data.success !== true ||
        result.data.verified !== true
      ) {
        setFeedback({
          type: "error",
          message:
            result.data.message || ui.unknownError,
        });

        setCode("");
        codeInputRef.current?.focus();
        return;
      }

      setVerified(true);

      setFeedback({
        type: "success",
        message: ui.verified,
      });

      try {
        window.sessionStorage.removeItem(
          EMAIL_STORAGE_KEY
        );
      } catch {
        // Nettoyage non bloquant.
      }

      const destination = safeRedirect(
        result.data.redirectTo
      );

      window.location.assign(destination);
    } catch {
      setFeedback({
        type: "error",
        message: ui.networkError,
      });
    } finally {
      requestLock.current = false;
      setLoading(false);
    }
  }

  /* ==========================================
     RENVOYER LE CODE
  ========================================== */

  async function handleResendCode() {
    if (
      requestLock.current ||
      resending ||
      loading ||
      verified ||
      countdown > 0
    ) {
      return;
    }

    const validEmail = getValidEmail();

    if (!validEmail) {
      return;
    }

    requestLock.current = true;
    setResending(true);
    setFeedback(null);

    try {
      const result = await postJSON(
        ROUTES.resendAPI,
        {
          email: validEmail,
          locale: language,
          ...(new URLSearchParams(window.location.search).get("purpose") === "login" ? { purpose: "login" } : {}),
        }
      );

      if (
        !result.ok ||
        result.data.success !== true
      ) {
        setFeedback({
          type: "error",
          message:
            result.data.message || ui.unknownError,
        });

        return;
      }

      setCountdown(RESEND_DELAY);
      setCode("");

      setFeedback({
        type: "info",
        message:
          result.data.message || ui.codeSent,
      });
    } catch {
      setFeedback({
        type: "error",
        message: ui.networkError,
      });
    } finally {
      requestLock.current = false;
      setResending(false);
    }
  }

  /* ==========================================
     INTERFACE
  ========================================== */

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-white text-gray-950">

      {/* ======================================
          EN-TÊTE
      ====================================== */}

      <OrganizerPublicHeader locale={language} onLocaleChange={changeLanguage} />

      {/* ======================================
          PAGE PRINCIPALE
      ====================================== */}

      <main className="relative min-h-[calc(100svh-64px)] w-full overflow-hidden bg-white xl:min-h-[calc(100svh-72px)]">

        <div className="grid min-h-[calc(100svh-64px)] w-full grid-cols-1 lg:grid-cols-[42%_58%] xl:min-h-[calc(100svh-72px)]">

          {/* ====================================
              PARTIE VISUELLE
          ==================================== */}

          <section className="relative hidden min-h-full overflow-hidden bg-[#003b28] lg:block">

            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage:
                  "url('/images/orgaccueil.png')",
              }}
            />

            <div className="absolute inset-0 bg-linear-to-t from-[#003b28]/95 via-[#003b28]/35 to-[#003b28]/10" />

            <div className="relative z-10 flex h-full min-h-full flex-col justify-between px-8 py-8 xl:px-12">

              <div>
                <Link
                  href={ROUTES.organizer}
                  className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/15 px-4 py-2 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
                >
                  <ArrowLeft size={18} />
                  {ui.back}
                </Link>
              </div>

              <div className="max-w-lg">

                <div className="mb-5 inline-flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-4 backdrop-blur-sm">
                  <ShieldCheck
                    size={36}
                    className="text-yellow-400"
                  />

                  <span className="text-xl font-extrabold text-white">
                    {ui.security}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-white">
                  <Ticket
                    size={32}
                    className="text-yellow-400"
                  />

                  <span className="text-lg font-bold">
                    {landing.publishEvents}
                  </span>
                </div>

              </div>

            </div>

          </section>

          {/* ====================================
              FORMULAIRE OTP
          ==================================== */}

          <section className="relative flex w-full items-start justify-center bg-[#fafbfc] px-3 py-4 sm:px-6 sm:py-5 lg:px-8 xl:px-10">

            <div className="w-full max-w-2xl rounded-2xl border border-gray-100 bg-white px-4 py-5 shadow-[0_6px_30px_rgba(0,0,0,0.07)] sm:rounded-3xl sm:px-6 sm:py-6 xl:px-10">

              {/* TITRE */}

              <div className="mb-6 text-center">

                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-green-50 text-green-800 sm:size-18">
                  {verified ? (
                    <CheckCircle2 size={37} />
                  ) : (
                    <Mail size={37} />
                  )}
                </div>

                <h1 className="text-[23px] leading-tight font-black text-[#003b1c] sm:text-3xl">
                  {ui.title}
                </h1>

                <div className="mx-auto mt-3 h-1.5 w-16 rounded-full bg-yellow-400" />

                <p className="mt-4 text-sm leading-relaxed text-gray-600 sm:text-base">
                  {email
                    ? `${ui.subtitle} ${email}`
                    : t.verificationDescription}
                </p>

              </div>

              {/* FORMULAIRE */}

              <form
                onSubmit={handleVerification}
                noValidate
                className="flex flex-col gap-5"
              >

                {/* EMAIL */}

                <div className="flex flex-col gap-2">

                  <label
                    htmlFor="tikemia-verify-email"
                    className="text-sm font-bold text-gray-900"
                  >
                    {ui.email}
                  </label>

                  <div className="relative">

                    <Mail
                      size={20}
                      aria-hidden="true"
                      className="absolute top-1/2 left-4 -translate-y-1/2 text-gray-500"
                    />

                    <input
                      id="tikemia-verify-email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      maxLength={MAX_EMAIL_LENGTH}
                      required
                      disabled={loading || resending || verified}
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setCode("");
                        setFeedback(null);
                      }}
                      placeholder={ui.emailPlaceholder}
                      className="min-h-13 w-full rounded-xl border border-gray-300 bg-white py-3 pr-4 pl-12 text-base text-gray-950 outline-none transition-colors focus:border-green-600 focus:ring-2 focus:ring-green-100 disabled:bg-gray-50"
                    />

                  </div>

                </div>

                {/* CODE OTP */}

                <div className="flex flex-col gap-2">

                  <label
                    htmlFor="tikemia-otp-code"
                    className="text-sm font-bold text-gray-900"
                  >
                    {ui.code}
                  </label>

                  <div className="relative">

                    <KeyRound
                      size={22}
                      aria-hidden="true"
                      className="absolute top-1/2 left-4 -translate-y-1/2 text-green-700"
                    />

                    <input
                      ref={codeInputRef}
                      id="tikemia-otp-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={OTP_LENGTH}
                      required
                      disabled={loading || verified}
                      value={code}
                      onChange={handleCodeChange}
                      placeholder={ui.codePlaceholder}
                      aria-describedby="tikemia-otp-feedback"
                      className="min-h-16 w-full rounded-xl border border-gray-300 bg-white py-3 pr-4 pl-12 text-center text-3xl font-extrabold tracking-[0.35em] text-green-950 outline-none transition-colors focus:border-green-600 focus:ring-2 focus:ring-green-100 disabled:bg-gray-50 sm:text-4xl"
                    />

                  </div>

                </div>

                {/* MESSAGE */}

                <div
                  id="tikemia-otp-feedback"
                  role={feedback?.type === "error" ? "alert" : "status"}
                  aria-live="polite"
                >
                  {feedback && (
                    <div
                      className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
                        feedback.type === "success"
                          ? "border-green-200 bg-green-50 text-green-900"
                          : feedback.type === "error"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-blue-200 bg-blue-50 text-blue-800"
                      }`}
                    >
                      {feedback.type === "success" ? (
                        <CheckCircle2
                          size={19}
                          className="mt-0.5 shrink-0"
                        />
                      ) : feedback.type === "error" ? (
                        <AlertCircle
                          size={19}
                          className="mt-0.5 shrink-0"
                        />
                      ) : (
                        <Mail
                          size={19}
                          className="mt-0.5 shrink-0"
                        />
                      )}

                      <span>{feedback.message}</span>
                    </div>
                  )}
                </div>

                {/* BOUTON VALIDER */}

                <button
                  type="submit"
                  disabled={loading || resending || verified}
                  className="flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-linear-to-b from-[#20bd00] to-[#006b12] px-5 text-base font-extrabold text-white shadow-md transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <LoaderCircle
                        size={22}
                        className="animate-spin"
                      />
                      {ui.verifying}
                    </>
                  ) : verified ? (
                    <>
                      <CheckCircle2 size={23} />
                      {ui.verified}
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={23} />
                      {ui.verify}
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>

              </form>

              {/* ====================================
                  RENVOYER LE CODE
              ==================================== */}

              {!verified && (
                <div className="mt-6 border-t border-gray-200 pt-5 text-center">

                  <p className="mb-3 text-sm font-medium text-gray-600">
                    {ui.help}
                  </p>

                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={
                      countdown > 0 ||
                      loading ||
                      resending
                    }
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-green-700 px-5 text-sm font-extrabold text-green-800 transition-colors hover:bg-green-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-500"
                  >
                    {resending ? (
                      <>
                        <LoaderCircle
                          size={18}
                          className="animate-spin"
                        />
                        {ui.sending}
                      </>
                    ) : countdown > 0 ? (
                      <>
                        <Clock3 size={18} />
                        {ui.resendIn}{" "}
                        {formatCountdown(countdown)}
                      </>
                    ) : (
                      <>
                        <RefreshCw size={18} />
                        {ui.resend}
                      </>
                    )}
                  </button>

                  <div className="mt-4">

                    <Link
                      href={ROUTES.register}
                      className="inline-flex items-center gap-2 text-sm font-bold text-green-800 underline underline-offset-4 hover:text-green-950"
                    >
                      <ArrowLeft size={17} />
                      {ui.changeEmail}
                    </Link>

                  </div>

                </div>
              )}

              {/* ====================================
                  SÉCURITÉ
              ==================================== */}

              <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-center text-sm font-semibold text-green-950">

                <LockKeyhole
                  size={19}
                  className="shrink-0 text-green-700"
                />

                <span>{ui.security}</span>

              </div>

              {verified && (
                <p className="mt-3 text-center text-sm text-green-800">
                  {ui.redirecting}
                </p>
              )}

            </div>

          </section>

        </div>

        {/* ======================================
            DÉCORATION INFÉRIEURE
        ====================================== */}

        <div className="relative h-10 w-full overflow-hidden bg-white sm:h-14">

          <svg
            aria-hidden="true"
            viewBox="0 0 1440 90"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            <path
              d="M0 12 C180 100 280 30 480 65 S780 72 1000 49 S1250 15 1440 30 L1440 90 L0 90 Z"
              fill="#ffcf00"
            />

            <path
              d="M0 42 C190 105 330 50 500 78 S840 73 1040 62 S1290 22 1440 54 L1440 90 L0 90 Z"
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
