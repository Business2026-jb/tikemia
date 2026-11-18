
"use client";

import { OrganizerPublicHeader } from "@/components/organizer/OrganizerHeader";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
  Clock3,
  Eye,
  EyeOff,
  Headphones,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

/* ==========================================================
   TIKEMIA — RÉCUPÉRATION DE MOT DE PASSE

   PAGE :
   /organizer/forgot-password

   ÉTAPE 1 :
   Adresse email
   POST /api/organizer/auth/forgot-password

   ÉTAPE 2 :
   Code alphanumérique de 8 caractères
   POST /api/organizer/auth/reset-password
   action: "verify"

   ÉTAPE 3 :
   Nouveau mot de passe
   POST /api/organizer/auth/reset-password
   action: "reset"

   SÉCURITÉ :
   - Vérifications serveur obligatoires
   - Code valable 10 minutes
   - Jeton de réinitialisation temporaire
   - Aucun secret stocké localement
   - Aucune donnée sensible dans l'URL
   - Pas de code exposé dans les logs
   - Anti-double soumission
   - Retour à la connexion après succès

   DESIGN :
   - Français / Anglais
   - PC et mobile
   - Image organisateur existante
   - Aucun CSS module
   - Tailwind / global.css existant
========================================================== */

type Locale = "fr" | "en";
type Step = "email" | "code" | "password" | "success";
type NoticeType = "error" | "success" | "info";

type Notice = {
  type: NoticeType;
  message: string;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  code?: string;
  resetToken?: string;
  expiresIn?: number;
  redirectTo?: string;
};

const FORGOT_API =
  "/api/organizer/auth/forgot-password";

const RESET_API =
  "/api/organizer/auth/reset-password";

const LOGIN_URL = "/organizer/login";

const CODE_LENGTH = 8;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;

const RESEND_SECONDS = 60;
const CODE_EXPIRATION_SECONDS = 600;

const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CODE_REGEX =
  /^[A-Z0-9]{8}$/;

/* ==========================================================
   TEXTES FR / EN
========================================================== */

const TRANSLATIONS = {
  fr: {
    pageTitle: "Mot de passe oublié",
    pageSubtitle:
      "Récupérez l'accès à votre espace organisateur.",

    login: "Se connecter",
    backToLogin: "Retour à la connexion",
    organizer: "Espace Organisateur",

    stepEmail: "Adresse email",
    stepCode: "Vérification",
    stepPassword: "Nouveau mot de passe",

    emailTitle: "Récupérer votre compte",
    emailDescription:
      "Saisissez l'adresse email associée à votre compte TIKEMIA.",

    emailLabel: "Adresse email",
    emailPlaceholder: "Entrez votre adresse email",
    emailInvalid:
      "Veuillez saisir une adresse email valide.",

    continue: "Continuer",
    sending: "Envoi en cours...",

    codeTitle: "Vérifiez votre email",
    codeDescription:
      "Saisissez le code de 8 caractères envoyé à votre adresse email.",

    codeLabel: "Code de vérification",
    codePlaceholder: "XXXXXXXX",
    codeHelp:
      "Le code contient des lettres et des chiffres.",

    codeExpiration:
      "Le code est valable pendant 10 minutes.",

    verifyCode: "Vérifier le code",
    verifying: "Vérification en cours...",

    codeInvalid:
      "Veuillez saisir le code complet de 8 caractères.",

    noCode: "Vous n'avez pas reçu le code ?",
    resend: "Renvoyer le code",
    resendIn: "Renvoyer dans",
    resendSuccess:
      "Si votre adresse correspond à un compte organisateur, un nouveau code a été envoyé.",

    changeEmail: "Modifier l'adresse email",

    passwordTitle: "Nouveau mot de passe",
    passwordDescription:
      "Définissez un nouveau mot de passe sécurisé pour votre compte.",

    newPassword: "Nouveau mot de passe",
    newPasswordPlaceholder:
      "Entrez votre nouveau mot de passe",

    confirmPassword: "Confirmer le mot de passe",
    confirmPasswordPlaceholder:
      "Confirmez votre nouveau mot de passe",

    passwordHint:
      "Utilisez au moins 12 caractères.",

    passwordTooShort:
      "Le mot de passe doit contenir entre 12 et 128 caractères.",

    passwordMismatch:
      "Les deux mots de passe ne correspondent pas.",

    passwordMatch: "Les mots de passe correspondent.",

    passwordSave: "Changer mon mot de passe",
    saving: "Enregistrement en cours...",

    successTitle: "Mot de passe modifié",
    successDescription:
      "Votre mot de passe a été changé avec succès. Vous pouvez maintenant vous connecter.",

    goToLogin: "Aller à la connexion",
    redirecting: "Redirection vers la connexion...",

    security: "Compte sécurisé",
    quick: "Procédure simple",
    assistance: "Assistance dédiée",

    securityNote:
      "Ne communiquez jamais votre code de récupération à une autre personne.",

    generalError:
      "Une erreur est survenue. Veuillez réessayer.",

    networkError:
      "Impossible de contacter le serveur. Vérifiez votre connexion.",

    sessionExpired:
      "Votre autorisation a expiré. Veuillez recommencer la vérification.",

    restart: "Recommencer",
    showPassword: "Afficher le mot de passe",
    hidePassword: "Masquer le mot de passe",

    codeSent:
      "Si cette adresse correspond à un compte organisateur, un code de récupération vous sera envoyé.",

    back: "Retour",
  },

  en: {
    pageTitle: "Forgot password",
    pageSubtitle:
      "Recover access to your organizer account.",

    login: "Sign in",
    backToLogin: "Back to sign in",
    organizer: "Organizer Space",

    stepEmail: "Email address",
    stepCode: "Verification",
    stepPassword: "New password",

    emailTitle: "Recover your account",
    emailDescription:
      "Enter the email address associated with your TIKEMIA account.",

    emailLabel: "Email address",
    emailPlaceholder: "Enter your email address",
    emailInvalid: "Please enter a valid email address.",

    continue: "Continue",
    sending: "Sending...",

    codeTitle: "Check your email",
    codeDescription:
      "Enter the 8-character code sent to your email address.",

    codeLabel: "Verification code",
    codePlaceholder: "XXXXXXXX",
    codeHelp:
      "The code contains letters and numbers.",

    codeExpiration:
      "The code is valid for 10 minutes.",

    verifyCode: "Verify code",
    verifying: "Verifying...",

    codeInvalid:
      "Please enter the complete 8-character code.",

    noCode: "Didn't receive the code?",
    resend: "Resend code",
    resendIn: "Resend in",
    resendSuccess:
      "If your email belongs to an organizer account, a new code has been sent.",

    changeEmail: "Change email address",

    passwordTitle: "New password",
    passwordDescription:
      "Create a secure new password for your account.",

    newPassword: "New password",
    newPasswordPlaceholder: "Enter your new password",

    confirmPassword: "Confirm password",
    confirmPasswordPlaceholder: "Confirm your new password",

    passwordHint:
      "Use at least 12 characters.",

    passwordTooShort:
      "The password must contain between 12 and 128 characters.",

    passwordMismatch: "Passwords do not match.",
    passwordMatch: "Passwords match.",

    passwordSave: "Change my password",
    saving: "Saving...",

    successTitle: "Password changed",
    successDescription:
      "Your password has been changed successfully. You can now sign in.",

    goToLogin: "Go to sign in",
    redirecting: "Redirecting to sign in...",

    security: "Secure account",
    quick: "Simple process",
    assistance: "Dedicated support",

    securityNote:
      "Never share your recovery code with anyone.",

    generalError:
      "Something went wrong. Please try again.",

    networkError:
      "Unable to reach the server. Check your connection.",

    sessionExpired:
      "Your authorization has expired. Please verify your code again.",

    restart: "Start again",
    showPassword: "Show password",
    hidePassword: "Hide password",

    codeSent:
      "If this email belongs to an organizer account, a recovery code will be sent.",

    back: "Back",
  },
} as const;

/* ==========================================================
   OUTILS
========================================================== */

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CODE_LENGTH);
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");

  if (at <= 0) return "••••";

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  return `${local.slice(0, 2)}••••@${domain}`;
}

function passwordLength(value: string): number {
  return [...value].length;
}

async function postApi(
  url: string,
  body: Record<string, unknown>
): Promise<ApiResponse> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("NETWORK_ERROR");
  }

  let data: ApiResponse = {};

  try {
    data = (await response.json()) as ApiResponse;
  } catch {
    throw new Error("INVALID_RESPONSE");
  }

  if (!response.ok || data.success !== true) {
    const error = new Error(
      typeof data.message === "string"
        ? data.message
        : "REQUEST_FAILED"
    );

    Object.assign(error, {
      code: data.code,
      status: response.status,
    });

    throw error;
  }

  return data;
}

/* ==========================================================
   DESIGN
========================================================== */

const INPUT =
  "h-12 w-full rounded-xl border border-[#d6dfeb] bg-white px-4 text-sm font-medium text-[#182841] outline-none transition focus:border-[#088a35] focus:ring-2 focus:ring-green-100 disabled:bg-[#f3f5f7] disabled:opacity-60";

const PRIMARY =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#07852e] px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#056e27] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 disabled:cursor-not-allowed disabled:opacity-50";

const SECONDARY =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#c9dfcd] bg-white px-4 text-sm font-bold text-[#08752b] transition-colors hover:bg-[#f1f9f2] disabled:opacity-50";

/* ==========================================================
   PAGE
========================================================== */

export default function OrganizerForgotPasswordPage() {
  const router = useRouter();

  const [locale, setLocale] = useState<Locale>("fr");
  const [step, setStep] = useState<Step>("email");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const [resetToken, setResetToken] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmation, setShowConfirmation] =
    useState(false);

  const [notice, setNotice] = useState<Notice | null>(
    null
  );

  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  const [, setCodeExpiresAt] =
    useState<number | null>(null);

  const workingRef = useRef(false);
  const t = TRANSLATIONS[locale];

  /* ========================================================
     LANGUE
  ======================================================== */

  useEffect(() => {
    function updateLanguage() {
      try {
        const value = localStorage.getItem(
          "tikemia_locale"
        );

        setLocale(value === "en" ? "en" : "fr");
      } catch {
        setLocale("fr");
      }
    }

    updateLanguage();

    window.addEventListener("storage", updateLanguage);
    window.addEventListener(
      "tikemia:locale-changed",
      updateLanguage
    );

    return () => {
      window.removeEventListener(
        "storage",
        updateLanguage
      );
      window.removeEventListener(
        "tikemia:locale-changed",
        updateLanguage
      );
    };
  }, []);

  /* ========================================================
     DÉCOMPTE RENVOI
  ======================================================== */

  useEffect(() => {
    if (resendSeconds <= 0) return;

    const timer = window.setTimeout(() => {
      setResendSeconds((seconds) =>
        Math.max(0, seconds - 1)
      );
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  /* ========================================================
     REDIRECTION APRÈS SUCCÈS
  ======================================================== */

  useEffect(() => {
    if (step !== "success") return;

    const timer = window.setTimeout(() => {
      router.replace(LOGIN_URL);
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [step, router]);

  /* ========================================================
     ÉTAT DU FORMULAIRE
  ======================================================== */

  const emailValid =
    email.length <= 254 &&
    EMAIL_REGEX.test(normalizeEmail(email));

  const codeValid = CODE_REGEX.test(code);

  const passwordValid =
    passwordLength(password) >= PASSWORD_MIN_LENGTH &&
    passwordLength(password) <= PASSWORD_MAX_LENGTH &&
    !password.includes("\0");

  const passwordsMatch =
    password.length > 0 &&
    password === confirmPassword;

  const currentStepNumber =
    step === "email"
      ? 1
      : step === "code"
        ? 2
        : 3;

  /* ========================================================
     ERREURS
  ======================================================== */

  const errorMessage = useCallback(
    (error: unknown): string => {
      if (!(error instanceof Error)) {
        return TRANSLATIONS[locale].generalError;
      }

      if (error.message === "NETWORK_ERROR") {
        return TRANSLATIONS[locale].networkError;
      }

      if (
        error.message === "INVALID_RESPONSE" ||
        error.message === "REQUEST_FAILED"
      ) {
        return TRANSLATIONS[locale].generalError;
      }

      return error.message;
    },
    [locale]
  );

  function resetToEmail() {
    if (workingRef.current) return;

    setStep("email");
    setCode("");
    setResetToken("");
    setPassword("");
    setConfirmPassword("");
    setResendSeconds(0);
    setCodeExpiresAt(null);
    setNotice(null);
  }

  /* ========================================================
     ÉTAPE 1 — ENVOYER LE CODE
  ======================================================== */

  async function sendCode(
    event?: FormEvent<HTMLFormElement>,
    resend = false
  ) {
    event?.preventDefault();

    if (workingRef.current) return;

    const normalized = normalizeEmail(email);

    if (
      normalized.length > 254 ||
      !EMAIL_REGEX.test(normalized)
    ) {
      setNotice({
        type: "error",
        message: t.emailInvalid,
      });
      return;
    }

    if (resend && resendSeconds > 0) {
      return;
    }

    workingRef.current = true;
    setLoading(true);
    setNotice(null);

    try {
      const result = await postApi(`${FORGOT_API}?locale=${locale}`, {
        action: "send",
        email: normalized,
      });

      setEmail(normalized);
      setCode("");
      setResetToken("");
      setPassword("");
      setConfirmPassword("");

      const now = Date.now();

      setCodeExpiresAt(
        now + CODE_EXPIRATION_SECONDS * 1000
      );

      setResendSeconds(RESEND_SECONDS);
      setStep("code");

      setNotice({
        type: "success",
        message:
          result.message ||
          (resend ? t.resendSuccess : t.codeSent),
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(error),
      });
    } finally {
      workingRef.current = false;
      setLoading(false);
    }
  }

  /* ========================================================
     ÉTAPE 2 — VÉRIFIER LE CODE
  ======================================================== */

  async function verifyCode(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (workingRef.current) return;

    if (!CODE_REGEX.test(code)) {
      setNotice({
        type: "error",
        message: t.codeInvalid,
      });
      return;
    }

    workingRef.current = true;
    setLoading(true);
    setNotice(null);

    try {
      const result = await postApi(`${RESET_API}?locale=${locale}`, {
        action: "verify",
        email: normalizeEmail(email),
        code,
      });

      if (
        typeof result.resetToken !== "string" ||
        !/^[a-f0-9]{64}$/i.test(result.resetToken)
      ) {
        throw new Error(t.generalError);
      }

      setResetToken(result.resetToken);
      setCode("");
      setStep("password");
      setNotice(null);
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(error),
      });
    } finally {
      workingRef.current = false;
      setLoading(false);
    }
  }

  /* ========================================================
     ÉTAPE 3 — NOUVEAU MOT DE PASSE
  ======================================================== */

  async function savePassword(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (workingRef.current) return;

    if (!passwordValid) {
      setNotice({
        type: "error",
        message: t.passwordTooShort,
      });
      return;
    }

    if (!passwordsMatch) {
      setNotice({
        type: "error",
        message: t.passwordMismatch,
      });
      return;
    }

    if (!resetToken) {
      setNotice({
        type: "error",
        message: t.sessionExpired,
      });
      return;
    }

    workingRef.current = true;
    setLoading(true);
    setNotice(null);

    try {
      await postApi(`${RESET_API}?locale=${locale}`, {
        action: "reset",
        email: normalizeEmail(email),
        resetToken,
        password,
        confirmPassword,
      });

      /*
       * Supprimer immédiatement les secrets
       * conservés dans l'état React.
       */

      setResetToken("");
      setCode("");
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmation(false);

      setStep("success");

      setNotice({
        type: "success",
        message: t.successDescription,
      });
    } catch (error) {
      const typedError = error as Error & {
        code?: string;
      };

      if (
        typedError.code === "invalidToken" ||
        typedError.code === "expired"
      ) {
        setResetToken("");
        setCode("");
        setStep("code");
      }

      setNotice({
        type: "error",
        message: errorMessage(error),
      });
    } finally {
      workingRef.current = false;
      setLoading(false);
    }
  }

  /* ========================================================
     RENDU
  ======================================================== */

  return (
    <main className="min-h-dvh w-full overflow-x-hidden bg-[#f7faf8] text-[#17243d]">
      {/* EN-TÊTE SIMPLE */}

      <OrganizerPublicHeader locale={locale} onLocaleChange={setLocale} />

      {/* CONTENU */}

      <div className="grid w-full min-w-0 grid-cols-1 lg:min-h-[calc(100dvh-72px)] lg:grid-cols-[0.42fr_0.58fr]">
        {/* IMAGE ORGANISATEUR */}

        <div className="relative h-42 overflow-hidden bg-[#003e2d] sm:h-56 lg:h-auto lg:min-h-150">
          <Image
            width={220} height={80} unoptimized src="/images/orgaccueil.png"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
          />

          <div className="absolute inset-0 bg-linear-to-r from-[#002d23]/30 to-transparent" />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-linear-to-r from-[#07852e] via-[#fbd01d] to-[#db2632]" />
        </div>

        {/* FORMULAIRE */}

        <div className="flex min-w-0 items-center justify-center p-3 sm:p-5 lg:p-6">
          <section className="w-full max-w-215 rounded-2xl border border-[#e1e9e3] bg-white p-5 shadow-sm sm:rounded-3xl sm:p-6 lg:p-8">
            {/* EN-TÊTE FORMULAIRE */}

            <div className="mb-6 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#e7f8eb] text-[#07842e]">
                {step === "success" ? (
                  <CheckCircle2 size={29} />
                ) : step === "password" ? (
                  <LockKeyhole size={29} />
                ) : step === "code" ? (
                  <Mail size={29} />
                ) : (
                  <KeyRound size={29} />
                )}
              </div>

              <h1 className="mt-4 text-xl font-extrabold tracking-tight sm:text-2xl">
                {step === "email"
                  ? t.emailTitle
                  : step === "code"
                    ? t.codeTitle
                    : step === "password"
                      ? t.passwordTitle
                      : t.successTitle}
              </h1>

              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#68778a]">
                {step === "email"
                  ? t.emailDescription
                  : step === "code"
                    ? t.codeDescription
                    : step === "password"
                      ? t.passwordDescription
                      : t.successDescription}
              </p>
            </div>

            {/* PROGRESSION */}

            {step !== "success" && (
              <div
                className="mb-6 grid grid-cols-3 gap-2"
                aria-label={`${currentStepNumber}/3`}
              >
                {[1, 2, 3].map((number) => (
                  <div key={number}>
                    <div
                      className={`h-1.5 rounded-full ${
                        number <= currentStepNumber
                          ? "bg-[#07842e]"
                          : "bg-[#e4e9e8]"
                      }`}
                    />
                    <p
                      className={`mt-2 text-center text-[10px] font-bold sm:text-xs ${
                        number <= currentStepNumber
                          ? "text-[#087b2d]"
                          : "text-[#8c99a5]"
                      }`}
                    >
                      {number === 1
                        ? t.stepEmail
                        : number === 2
                          ? t.stepCode
                          : t.stepPassword}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* NOTIFICATION */}

            {notice && step !== "success" && (
              <div
                role={
                  notice.type === "error" ? "alert" : "status"
                }
                className={`mb-5 flex items-start gap-2 rounded-xl border p-3 text-xs font-semibold leading-relaxed ${
                  notice.type === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : notice.type === "success"
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-blue-200 bg-blue-50 text-blue-700"
                }`}
              >
                {notice.type === "error" ? (
                  <CircleAlert
                    size={18}
                    className="shrink-0"
                  />
                ) : (
                  <CheckCircle2
                    size={18}
                    className="shrink-0"
                  />
                )}

                <span className="min-w-0 flex-1">
                  {notice.message}
                </span>

                <button
                  type="button"
                  onClick={() => setNotice(null)}
                  aria-label="Fermer"
                >
                  <CircleAlert
                    size={16}
                    className="opacity-0"
                  />
                </button>
              </div>
            )}

            {/* ============================================
                ÉTAPE 1 : EMAIL
            ============================================ */}

            {step === "email" && (
              <form
                onSubmit={(event) => void sendCode(event)}
                className="space-y-5"
              >
                <div>
                  <label
                    htmlFor="recovery-email"
                    className="mb-2 block text-sm font-bold"
                  >
                    {t.emailLabel}
                    <span className="ml-1 text-red-600">*</span>
                  </label>

                  <div className="relative">
                    <Mail
                      size={19}
                      className="pointer-events-none absolute top-3.5 left-3.5 text-[#687991]"
                    />

                    <input
                      id="recovery-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      spellCheck={false}
                      maxLength={254}
                      placeholder={t.emailPlaceholder}
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setNotice(null);
                      }}
                      disabled={loading}
                      required
                      className={`${INPUT} pl-11`}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!emailValid || loading}
                  className={PRIMARY}
                >
                  {loading ? (
                    <LoaderCircle
                      size={19}
                      className="animate-spin"
                    />
                  ) : (
                    <ArrowRight size={19} />
                  )}

                  {loading ? t.sending : t.continue}
                </button>
              </form>
            )}

            {/* ============================================
                ÉTAPE 2 : CODE
            ============================================ */}

            {step === "code" && (
              <form
                onSubmit={(event) => void verifyCode(event)}
                className="space-y-5"
              >
                <div className="rounded-xl bg-[#eef8f0] p-3 text-center">
                  <p className="text-xs text-[#52705d]">
                    {t.emailLabel}
                  </p>

                  <p className="mt-1 font-semibold text-[#08762c]">
                    {maskEmail(email)}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="recovery-code"
                    className="mb-2 block text-sm font-bold"
                  >
                    {t.codeLabel}
                    <span className="ml-1 text-red-600">*</span>
                  </label>

                  <input
                    id="recovery-code"
                    type="text"
                    inputMode="text"
                    autoComplete="one-time-code"
                    spellCheck={false}
                    autoCapitalize="characters"
                    maxLength={CODE_LENGTH}
                    pattern="[A-Z0-9]{8}"
                    placeholder={t.codePlaceholder}
                    value={code}
                    onChange={(event) => {
                      setCode(
                        normalizeCode(event.target.value)
                      );
                      setNotice(null);
                    }}
                    disabled={loading}
                    required
                    className={`${INPUT} h-14 text-center font-mono text-xl font-extrabold tracking-[0.2em] sm:text-2xl sm:tracking-[0.3em]`}
                  />

                  <p className="mt-2 text-xs text-[#738399]">
                    {t.codeHelp}
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-xl bg-[#f4f8fb] p-3 text-xs font-medium text-[#566a80]">
                  <Clock3
                    size={17}
                    className="shrink-0 text-[#07852f]"
                  />
                  {t.codeExpiration}
                </div>

                <button
                  type="submit"
                  disabled={!codeValid || loading}
                  className={PRIMARY}
                >
                  {loading ? (
                    <LoaderCircle
                      size={19}
                      className="animate-spin"
                    />
                  ) : (
                    <ShieldCheck size={19} />
                  )}

                  {loading ? t.verifying : t.verifyCode}
                </button>

                <div className="flex flex-col items-center gap-2 text-center">
                  <p className="text-xs text-[#768497]">
                    {t.noCode}
                  </p>

                  <button
                    type="button"
                    disabled={resendSeconds > 0 || loading}
                    onClick={() =>
                      void sendCode(undefined, true)
                    }
                    className="inline-flex min-h-9 items-center gap-2 text-sm font-extrabold text-[#087a2d] hover:underline disabled:cursor-not-allowed disabled:text-[#9baa9d]"
                  >
                    <RefreshCw size={15} />

                    {resendSeconds > 0
                      ? `${t.resendIn} ${resendSeconds}s`
                      : t.resend}
                  </button>

                  <button
                    type="button"
                    onClick={resetToEmail}
                    disabled={loading}
                    className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-[#65788b] hover:underline"
                  >
                    <ChevronLeft size={15} />
                    {t.changeEmail}
                  </button>
                </div>
              </form>
            )}

            {/* ============================================
                ÉTAPE 3 : NOUVEAU MOT DE PASSE
            ============================================ */}

            {step === "password" && (
              <form
                onSubmit={(event) =>
                  void savePassword(event)
                }
                className="space-y-5"
              >
                <div>
                  <label
                    htmlFor="new-password"
                    className="mb-2 block text-sm font-bold"
                  >
                    {t.newPassword}
                    <span className="ml-1 text-red-600">*</span>
                  </label>

                  <div className="relative">
                    <LockKeyhole
                      size={19}
                      className="pointer-events-none absolute top-3.5 left-3.5 text-[#687991]"
                    />

                    <input
                      id="new-password"
                      type={
                        showPassword ? "text" : "password"
                      }
                      autoComplete="new-password"
                      minLength={PASSWORD_MIN_LENGTH}
                      maxLength={PASSWORD_MAX_LENGTH}
                      placeholder={t.newPasswordPlaceholder}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setNotice(null);
                      }}
                      disabled={loading}
                      required
                      className={`${INPUT} pr-12 pl-11`}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((value) => !value)
                      }
                      aria-label={
                        showPassword
                          ? t.hidePassword
                          : t.showPassword
                      }
                      className="absolute inset-y-0 right-2 flex w-10 items-center justify-center text-[#60768d]"
                    >
                      {showPassword ? (
                        <EyeOff size={19} />
                      ) : (
                        <Eye size={19} />
                      )}
                    </button>
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <Check
                      size={15}
                      className={
                        passwordValid
                          ? "text-[#07852c]"
                          : "text-[#96a2aa]"
                      }
                    />

                    <span
                      className={
                        passwordValid
                          ? "font-semibold text-[#08752c]"
                          : "text-[#728198]"
                      }
                    >
                      {t.passwordHint}
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirm-new-password"
                    className="mb-2 block text-sm font-bold"
                  >
                    {t.confirmPassword}
                    <span className="ml-1 text-red-600">*</span>
                  </label>

                  <div className="relative">
                    <LockKeyhole
                      size={19}
                      className="pointer-events-none absolute top-3.5 left-3.5 text-[#687991]"
                    />

                    <input
                      id="confirm-new-password"
                      type={
                        showConfirmation
                          ? "text"
                          : "password"
                      }
                      autoComplete="new-password"
                      minLength={PASSWORD_MIN_LENGTH}
                      maxLength={PASSWORD_MAX_LENGTH}
                      placeholder={
                        t.confirmPasswordPlaceholder
                      }
                      value={confirmPassword}
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        setNotice(null);
                      }}
                      disabled={loading}
                      required
                      className={`${INPUT} pr-12 pl-11`}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmation((value) => !value)
                      }
                      aria-label={
                        showConfirmation
                          ? t.hidePassword
                          : t.showPassword
                      }
                      className="absolute inset-y-0 right-2 flex w-10 items-center justify-center text-[#60768d]"
                    >
                      {showConfirmation ? (
                        <EyeOff size={19} />
                      ) : (
                        <Eye size={19} />
                      )}
                    </button>
                  </div>

                  {confirmPassword.length > 0 && (
                    <p
                      className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${
                        passwordsMatch
                          ? "text-[#087d2f]"
                          : "text-red-600"
                      }`}
                    >
                      {passwordsMatch ? (
                        <CheckCircle2 size={15} />
                      ) : (
                        <CircleAlert size={15} />
                      )}

                      {passwordsMatch
                        ? t.passwordMatch
                        : t.passwordMismatch}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={
                    loading ||
                    !passwordValid ||
                    !passwordsMatch ||
                    !resetToken
                  }
                  className={PRIMARY}
                >
                  {loading ? (
                    <LoaderCircle
                      size={19}
                      className="animate-spin"
                    />
                  ) : (
                    <ShieldCheck size={19} />
                  )}

                  {loading
                    ? t.saving
                    : t.passwordSave}
                </button>
              </form>
            )}

            {/* ============================================
                ÉTAPE 4 : SUCCÈS
            ============================================ */}

            {step === "success" && (
              <div
                role="status"
                className="flex flex-col items-center gap-4 text-center"
              >
                <div className="flex size-18 items-center justify-center rounded-full bg-[#e1f9e5] text-[#087e30]">
                  <CheckCircle2 size={39} />
                </div>

                <p className="text-sm font-semibold leading-relaxed text-[#526981]">
                  {t.successDescription}
                </p>

                <Link
                  href={LOGIN_URL}
                  className={PRIMARY}
                >
                  {t.goToLogin}
                  <ArrowRight size={18} />
                </Link>

                <p className="flex items-center gap-2 text-xs text-[#8290a0]">
                  <LoaderCircle
                    size={14}
                    className="animate-spin"
                  />
                  {t.redirecting}
                </p>
              </div>
            )}

            {/* ============================================
                LIEN CONNEXION
            ============================================ */}

            {step !== "success" && (
              <div className="mt-6 border-t border-[#e8edf0] pt-5">
                <Link
                  href={LOGIN_URL}
                  className={`${SECONDARY} w-full`}
                >
                  <ArrowLeft size={17} />
                  {t.backToLogin}
                </Link>
              </div>
            )}

            {/* ============================================
                GARANTIES VISUELLES
            ============================================ */}

            <div className="mt-6 grid grid-cols-3 divide-x divide-[#dce4e9] rounded-xl bg-[#f4f7fa] px-2 py-4">
              <div className="flex flex-col items-center gap-2 px-2 text-center">
                <ShieldCheck
                  size={22}
                  className="text-[#07822e]"
                />

                <span className="text-[10px] font-bold leading-tight sm:text-xs">
                  {t.security}
                </span>
              </div>

              <div className="flex flex-col items-center gap-2 px-2 text-center">
                <KeyRound
                  size={22}
                  className="text-[#e7a500]"
                />

                <span className="text-[10px] font-bold leading-tight sm:text-xs">
                  {t.quick}
                </span>
              </div>

              <div className="flex flex-col items-center gap-2 px-2 text-center">
                <Headphones
                  size={22}
                  className="text-[#07822e]"
                />

                <span className="text-[10px] font-bold leading-tight sm:text-xs">
                  {t.assistance}
                </span>
              </div>
            </div>

            <p className="mt-5 text-center text-xs leading-relaxed text-[#81909e]">
              <ShieldCheck
                size={15}
                className="mr-1 inline text-[#087c2d]"
              />
              {t.securityNote}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
