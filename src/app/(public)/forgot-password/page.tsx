
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RefreshCw,
  UserRound,
} from "lucide-react";

/* ==========================================================
   TIKEMIA — MOT DE PASSE OUBLIÉ

   FICHIER :
   src/app/(public)/forgot-password/page.tsx

   ROUTE :
   /forgot-password

   IMAGE EXISTANTE :
   /images/paccueil.png

   APIs EXISTANTES :
   POST /api/auth/forgot-password
   POST /api/auth/reset-password

   PARCOURS :
   1. Adresse email
   2. Code à six chiffres
   3. Nouveau mot de passe
   4. Retour à /login

   FONCTIONNALITÉS :
   - Email uniquement
   - Six cases OTP
   - Collage d'un code complet
   - Navigation au clavier
   - Renvoi du code
   - Temporisation de 60 secondes
   - Vérification serveur réelle
   - Nouveau mot de passe
   - Confirmation du mot de passe
   - Affichage / masquage
   - Gestion des erreurs
   - Français / Anglais
   - Responsive PC / Mobile

   SÉCURITÉ :
   - Aucun code dans l'URL
   - Aucun mot de passe dans l'URL
   - Aucun OTP stocké localement
   - Aucun succès simulé
   - Aucune vérification OTP fictive
   - Le serveur valide le code
     et modifie le mot de passe

   DESIGN :
   - Header public existant
   - Image gauche sur PC
   - Bannière sur mobile
   - Formulaire blanc arrondi
   - Aucun texte promotionnel
   - Aucun menu dupliqué
   - Aucun footer sur mobile
========================================================== */

const IMAGE_URL = "/images/paccueil.png";

const FORGOT_API = "/api/auth/forgot-password";

const RESET_API = "/api/auth/reset-password";

const LOGIN_URL = "/login";

const CODE_LENGTH = 6;

const PASSWORD_MIN_LENGTH = 12;

const PASSWORD_MAX_BYTES = 1024;

const RESEND_COOLDOWN_SECONDS = 60;

type Locale = "fr" | "en";

type Step = "email" | "code" | "password";

type ApiResponse = {
  success?: boolean;
  message?: string;
  code?: string;

  resetRequested?: boolean;
  passwordReset?: boolean;

  redirectTo?: string;

  data?: {
    codeLength?: number;
    expiresInSeconds?: number;
  };
};

/* ==========================================================
   TRADUCTIONS FR / EN
========================================================== */

const TEXT = {
  fr: {
    titleEmail: "Mot de passe oublié ?",
    titleCode: "Vérification du code",
    titlePassword: "Nouveau mot de passe",

    subtitleEmail:
      "Saisissez votre adresse email pour continuer.",

    subtitleCode:
      "Saisissez le code à 6 chiffres reçu par email.",

    subtitlePassword:
      "Définissez votre nouveau mot de passe.",

    email: "Adresse email",
    emailPlaceholder: "Entrez votre adresse email",

    code: "Code de vérification",

    codeHint:
      "Entrez les six chiffres reçus.",

    newPassword: "Nouveau mot de passe",

    passwordPlaceholder:
      "Créez votre nouveau mot de passe",

    confirmPassword:
      "Confirmer le mot de passe",

    confirmPlaceholder:
      "Confirmez votre mot de passe",

    passwordHint:
      "12 caractères minimum",

    sendCode: "Envoyer le code",
    sendingCode: "Envoi en cours...",

    continue: "Continuer",

    resetPassword:
      "Modifier mon mot de passe",

    resetting:
      "Modification en cours...",

    backToLogin:
      "Retour à la connexion",

    back:
      "Retour",

    otherEmail:
      "Modifier l'adresse email",

    codeNotReceived:
      "Vous n'avez pas reçu le code ?",

    resendCode:
      "Renvoyer le code",

    resendIn:
      "Renvoyer dans",

    resending:
      "Renvoi en cours...",

    codeRequested:
      "Si cette adresse possède un compte, un code de réinitialisation lui a été envoyé.",

    codeResent:
      "Si cette adresse possède un compte, un nouveau code lui a été envoyé.",

    emailRequired:
      "Veuillez saisir votre adresse email.",

    invalidEmail:
      "Veuillez saisir une adresse email valide.",

    codeRequired:
      "Veuillez saisir les six chiffres du code.",

    invalidCode:
      "Le code est incorrect, expiré ou déjà utilisé.",

    tooManyAttempts:
      "Trop de tentatives. Demandez un nouveau code.",

    newPasswordRequired:
      "Veuillez créer votre nouveau mot de passe.",

    weakPassword:
      "Le mot de passe doit contenir au moins 12 caractères.",

    passwordTooLong:
      "Le mot de passe est trop long.",

    confirmRequired:
      "Veuillez confirmer votre mot de passe.",

    passwordsMismatch:
      "Les deux mots de passe ne correspondent pas.",

    networkError:
      "Impossible de contacter le serveur. Vérifiez votre connexion Internet.",

    serverError:
      "Le service est temporairement indisponible. Veuillez réessayer.",

    genericError:
      "Une erreur est survenue. Veuillez réessayer.",

    showPassword:
      "Afficher le mot de passe",

    hidePassword:
      "Masquer le mot de passe",

    successTitle:
      "Mot de passe modifié !",

    successDescription:
      "Votre mot de passe a été modifié avec succès.",

    signIn:
      "Se connecter",

    redirecting:
      "Redirection vers la connexion...",

    step:
      "Étape",

    of:
      "sur",
  },

  en: {
    titleEmail: "Forgot your password?",
    titleCode: "Verify your code",
    titlePassword: "New password",

    subtitleEmail:
      "Enter your email address to continue.",

    subtitleCode:
      "Enter the 6-digit code sent to your email.",

    subtitlePassword:
      "Set your new password.",

    email: "Email address",
    emailPlaceholder: "Enter your email address",

    code: "Verification code",

    codeHint:
      "Enter the six digits you received.",

    newPassword: "New password",

    passwordPlaceholder:
      "Create your new password",

    confirmPassword:
      "Confirm password",

    confirmPlaceholder:
      "Confirm your new password",

    passwordHint:
      "At least 12 characters",

    sendCode: "Send code",
    sendingCode: "Sending...",

    continue: "Continue",

    resetPassword:
      "Reset my password",

    resetting:
      "Resetting password...",

    backToLogin:
      "Back to sign in",

    back:
      "Back",

    otherEmail:
      "Change email address",

    codeNotReceived:
      "Didn't receive the code?",

    resendCode:
      "Resend code",

    resendIn:
      "Resend in",

    resending:
      "Resending...",

    codeRequested:
      "If this email has an account, a reset code has been sent.",

    codeResent:
      "If this email has an account, a new reset code has been sent.",

    emailRequired:
      "Please enter your email address.",

    invalidEmail:
      "Please enter a valid email address.",

    codeRequired:
      "Please enter all six digits.",

    invalidCode:
      "The code is incorrect, expired or already used.",

    tooManyAttempts:
      "Too many attempts. Request a new code.",

    newPasswordRequired:
      "Please create your new password.",

    weakPassword:
      "Your password must contain at least 12 characters.",

    passwordTooLong:
      "The password is too long.",

    confirmRequired:
      "Please confirm your password.",

    passwordsMismatch:
      "The passwords do not match.",

    networkError:
      "Unable to contact the server. Check your Internet connection.",

    serverError:
      "The service is temporarily unavailable. Please try again.",

    genericError:
      "Something went wrong. Please try again.",

    showPassword:
      "Show password",

    hidePassword:
      "Hide password",

    successTitle:
      "Password updated!",

    successDescription:
      "Your password has been changed successfully.",

    signIn:
      "Sign in",

    redirecting:
      "Redirecting to sign in...",

    step:
      "Step",

    of:
      "of",
  },
} as const;

/* ==========================================================
   UTILITAIRES
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

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function emptyCode(): string[] {
  return Array.from(
    { length: CODE_LENGTH },
    () => ""
  );
}

function passwordByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remaining
  ).padStart(2, "0")}`;
}

/* ==========================================================
   PAGE PRINCIPALE
========================================================== */

export default function ForgotPasswordPage() {
  const router = useRouter();

  /* ========================================================
     LANGUE
  ======================================================== */

  const [locale, setLocale] =
    useState<Locale>("fr");

  const t = TEXT[locale];

  /* ========================================================
     ÉTAPES
  ======================================================== */

  const [step, setStep] =
    useState<Step>("email");

  const [completed, setCompleted] =
    useState(false);

  /* ========================================================
     FORMULAIRE
  ======================================================== */

  const [email, setEmail] =
    useState("");

  const [digits, setDigits] =
    useState<string[]>(emptyCode);

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmation, setShowConfirmation] =
    useState(false);

  /* ========================================================
     ÉTATS
  ======================================================== */

  const [submitting, setSubmitting] =
    useState(false);

  const [resending, setResending] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [information, setInformation] =
    useState<string | null>(null);

  const [cooldownUntil, setCooldownUntil] =
    useState(0);

  const [countdown, setCountdown] =
    useState(0);

  /* ========================================================
     RÉFÉRENCES
  ======================================================== */

  const codeRefs = useRef<
    Array<HTMLInputElement | null>
  >([]);

  const requestController =
    useRef<AbortController | null>(null);

  const requestInProgress =
    useRef(false);

  const resendInProgress =
    useRef(false);

  /* ========================================================
     LANGUE EXISTANTE TIKEMIA
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

      const language =
        document.documentElement.lang.toLowerCase();

      setLocale(
        language.startsWith("en") ? "en" : "fr"
      );
    }

    syncLanguage();

    window.addEventListener("storage", syncLanguage);

    window.addEventListener(
      "tikemia:locale-changed",
      syncLanguage
    );

    return () => {
      window.removeEventListener("storage", syncLanguage);

      window.removeEventListener(
        "tikemia:locale-changed",
        syncLanguage
      );
    };
  }, []);

  /* ========================================================
     NETTOYAGE DES REQUÊTES
  ======================================================== */

  useEffect(() => {
    return () => {
      requestController.current?.abort();
    };
  }, []);

  /* ========================================================
     TEMPORISATION DE RENVOI

     Le serveur impose lui aussi
     sa propre limitation.

     Le compteur navigateur sert
     uniquement à l'interface.
  ======================================================== */

  useEffect(() => {
    if (!cooldownUntil) {
      return;
    }

    function updateCountdown() {
      const remaining = Math.max(
        0,
        Math.ceil(
          (cooldownUntil - Date.now()) / 1000
        )
      );

      setCountdown(remaining);
    }

    const initialTick = window.setTimeout(updateCountdown, 0);

    const interval = window.setInterval(
      updateCountdown,
      1000
    );

    return () => {
      window.clearTimeout(initialTick);
      window.clearInterval(interval);
    };
  }, [cooldownUntil]);

  /* ========================================================
     SÉCURITÉ NAVIGATION

     On empêche les requêtes
     simultanées et les doubles clics.
  ======================================================== */

  const busy =
    submitting ||
    resending ||
    completed;

  /* ========================================================
     FOCUS SUR LES CASES OTP
  ======================================================== */

  const focusCode = useCallback(
    (index: number) => {
      if (index < 0 || index >= CODE_LENGTH) {
        return;
      }

      const input = codeRefs.current[index];

      input?.focus();
      input?.select();
    },
    []
  );

  /* ========================================================
     REMPLISSAGE DU CODE

     Compatible avec :
     - Saisie clavier
     - Collage des six chiffres
     - Autofill navigateur
  ======================================================== */

  const fillCode = useCallback(
    (startIndex: number, value: string) => {
      const numbers = onlyDigits(value);

      if (!numbers) {
        return;
      }

      const start =
        numbers.length >= CODE_LENGTH
          ? 0
          : startIndex;

      const content =
        numbers.slice(0, CODE_LENGTH);

      setDigits((previous) => {
        const next = [...previous];

        for (let index = 0; index < content.length; index++) {
          const target = start + index;

          if (target >= CODE_LENGTH) {
            break;
          }

          next[target] = content[index];
        }

        return next;
      });

      setError(null);

      const nextIndex = Math.min(
        start + content.length,
        CODE_LENGTH - 1
      );

      window.requestAnimationFrame(() => {
        focusCode(nextIndex);
      });
    },
    [focusCode]
  );

  /* ========================================================
     MODIFICATION D'UNE CASE OTP
  ======================================================== */

  function handleCodeChange(
    index: number,
    event: ChangeEvent<HTMLInputElement>
  ) {
    if (busy) {
      return;
    }

    const value = event.target.value;

    if (value === "") {
      setDigits((previous) => {
        const next = [...previous];
        next[index] = "";
        return next;
      });

      setError(null);
      return;
    }

    fillCode(index, value);
  }

  /* ========================================================
     NAVIGATION CLAVIER OTP
  ======================================================== */

  function handleCodeKeyDown(
    index: number,
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (busy) {
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();

      if (digits[index]) {
        setDigits((previous) => {
          const next = [...previous];
          next[index] = "";
          return next;
        });
      } else if (index > 0) {
        setDigits((previous) => {
          const next = [...previous];
          next[index - 1] = "";
          return next;
        });

        focusCode(index - 1);
      }

      setError(null);
      return;
    }

    if (event.key === "Delete") {
      event.preventDefault();

      setDigits((previous) => {
        const next = [...previous];
        next[index] = "";
        return next;
      });

      setError(null);
      return;
    }

    if (
      event.key === "ArrowLeft" &&
      index > 0
    ) {
      event.preventDefault();
      focusCode(index - 1);
      return;
    }

    if (
      event.key === "ArrowRight" &&
      index < CODE_LENGTH - 1
    ) {
      event.preventDefault();
      focusCode(index + 1);
    }
  }

  /* ========================================================
     COLLAGE D'UN CODE COMPLET
  ======================================================== */

  function handleCodePaste(
    index: number,
    event: ClipboardEvent<HTMLInputElement>
  ) {
    event.preventDefault();

    if (busy) {
      return;
    }

    const pasted =
      event.clipboardData.getData("text");

    fillCode(index, pasted);
  }

  /* ========================================================
     RÉINITIALISATION DES DONNÉES

     Retour à la première étape.
  ======================================================== */

  function returnToEmail() {
    if (submitting || resending) {
      return;
    }

    setStep("email");
    setDigits(emptyCode());
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setInformation(null);
    setCooldownUntil(0);
    setCountdown(0);
  }

  /* ========================================================
     1. ENVOYER LE CODE

     API :
     POST /api/auth/forgot-password

     JSON :
     {
       email,
       locale
     }

     Le serveur ne révèle pas si
     le compte existe réellement.
  ======================================================== */

  async function requestCode(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      busy ||
      requestInProgress.current
    ) {
      return;
    }

    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail) {
      setError(t.emailRequired);
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setError(t.invalidEmail);
      return;
    }

    requestInProgress.current = true;
    setSubmitting(true);
    setError(null);
    setInformation(null);

    const controller =
      new AbortController();

    requestController.current = controller;

    try {
      const response = await fetch(
        FORGOT_API,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            email: cleanEmail,
            locale,
          }),

          signal: controller.signal,
        }
      );

      let result: ApiResponse = {};

      try {
        result =
          (await response.json()) as ApiResponse;
      } catch {
        // Réponse non JSON.
      }

      if (
        !response.ok ||
        result.success !== true ||
        result.resetRequested !== true
      ) {
        setError(
          response.status >= 500
            ? t.serverError
            : result.message || t.genericError
        );

        return;
      }

      setEmail(cleanEmail);
      setDigits(emptyCode());

      setInformation(t.codeRequested);
      setStep("code");

      setCooldownUntil(
        Date.now() +
          RESEND_COOLDOWN_SECONDS * 1000
      );

      window.requestAnimationFrame(() => {
        focusCode(0);
      });
    } catch (reason) {
      if (controller.signal.aborted) {
        return;
      }

      setError(
        reason instanceof TypeError
          ? t.networkError
          : t.genericError
      );
    } finally {
      requestInProgress.current = false;
      requestController.current = null;
      setSubmitting(false);
    }
  }

  /* ========================================================
     2. PASSER À LA SAISIE DU MOT DE PASSE

     IMPORTANT :
     À cette étape, le navigateur
     contrôle seulement que le code
     contient six chiffres.

     La vérification cryptographique
     du code sera réalisée par l'API
     /api/auth/reset-password lors
     de la validation finale.

     Aucun code n'est déclaré valide
     avant la réponse du serveur.
  ======================================================== */

  function continueAfterCode(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (busy) {
      return;
    }

    const code = digits.join("");

    if (!/^\d{6}$/.test(code)) {
      setError(t.codeRequired);

      const index = digits.findIndex(
        (digit) => digit === ""
      );

      focusCode(index >= 0 ? index : 0);
      return;
    }

    setError(null);
    setInformation(null);
    setStep("password");
  }

  /* ========================================================
     RENVOI DU CODE

     On réutilise exactement
     la même API de demande.

     Si le prestataire accepte le
     renvoi, les anciennes cases
     sont vidées.

     Le nouveau code remplace
     le précédent côté serveur.
  ======================================================== */

  async function resendCode() {
    if (
      busy ||
      countdown > 0 ||
      resendInProgress.current ||
      !isValidEmail(email)
    ) {
      return;
    }

    resendInProgress.current = true;
    setResending(true);
    setError(null);
    setInformation(null);

    const controller =
      new AbortController();

    requestController.current = controller;

    try {
      const response = await fetch(
        FORGOT_API,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            email: normalizeEmail(email),
            locale,
          }),

          signal: controller.signal,
        }
      );

      let result: ApiResponse = {};

      try {
        result =
          (await response.json()) as ApiResponse;
      } catch {
        // Réponse non JSON.
      }

      if (
        !response.ok ||
        result.success !== true ||
        result.resetRequested !== true
      ) {
        setError(
          response.status >= 500
            ? t.serverError
            : result.message || t.genericError
        );

        return;
      }

      setDigits(emptyCode());
      setNewPassword("");
      setConfirmPassword("");
      setInformation(t.codeResent);

      setCooldownUntil(
        Date.now() +
          RESEND_COOLDOWN_SECONDS * 1000
      );

      setStep("code");

      window.requestAnimationFrame(() => {
        focusCode(0);
      });
    } catch (reason) {
      if (controller.signal.aborted) {
        return;
      }

      setError(
        reason instanceof TypeError
          ? t.networkError
          : t.genericError
      );
    } finally {
      resendInProgress.current = false;
      requestController.current = null;
      setResending(false);
    }
  }

  /* ========================================================
     3. RÉINITIALISATION DÉFINITIVE

     API :
     POST /api/auth/reset-password

     JSON :
     {
       email,
       code,
       newPassword,
       confirmPassword,
       locale
     }

     C'EST ICI QUE LE SERVEUR :
     - Vérifie réellement le code
     - Contrôle l'expiration
     - Limite les tentatives
     - Hache le mot de passe
     - Modifie le compte
     - Révoque les sessions

     Aucun succès n'est simulé.
  ======================================================== */

  async function resetPassword(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      busy ||
      requestInProgress.current
    ) {
      return;
    }

    const code = digits.join("");

    if (!/^\d{6}$/.test(code)) {
      setError(t.codeRequired);
      setStep("code");
      return;
    }

    if (!newPassword) {
      setError(t.newPasswordRequired);
      return;
    }

    if (
      Array.from(newPassword).length <
      PASSWORD_MIN_LENGTH
    ) {
      setError(t.weakPassword);
      return;
    }

    if (
      passwordByteLength(newPassword) >
      PASSWORD_MAX_BYTES
    ) {
      setError(t.passwordTooLong);
      return;
    }

    if (!confirmPassword) {
      setError(t.confirmRequired);
      return;
    }

    if (
      newPassword !== confirmPassword
    ) {
      setError(t.passwordsMismatch);
      return;
    }

    requestInProgress.current = true;
    setSubmitting(true);
    setError(null);
    setInformation(null);

    const controller =
      new AbortController();

    requestController.current = controller;

    try {
      const response = await fetch(
        RESET_API,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            email: normalizeEmail(email),
            code,
            newPassword,
            confirmPassword,
            locale,
          }),

          signal: controller.signal,
        }
      );

      let result: ApiResponse = {};

      try {
        result =
          (await response.json()) as ApiResponse;
      } catch {
        // Réponse non JSON.
      }

      if (
        !response.ok ||
        result.success !== true ||
        result.passwordReset !== true
      ) {
        if (
          response.status === 429 ||
          result.code === "tooManyAttempts"
        ) {
          setError(t.tooManyAttempts);

          setStep("code");
          setDigits(emptyCode());
        } else if (
          result.code === "invalidVerification" ||
          result.code === "invalidCode"
        ) {
          setError(t.invalidCode);

          setStep("code");
          setDigits(emptyCode());
        } else if (
          result.code === "weakPassword"
        ) {
          setError(t.weakPassword);
        } else if (
          result.code === "passwordMismatch"
        ) {
          setError(t.passwordsMismatch);
        } else {
          setError(
            response.status >= 500
              ? t.serverError
              : result.message || t.genericError
          );
        }

        return;
      }

      /*
       * Succès confirmé par l'API.
       *
       * Le code et les mots de passe
       * sont effacés de l'état.
       */

      setDigits(emptyCode());
      setNewPassword("");
      setConfirmPassword("");

      setCompleted(true);
      setError(null);
      setInformation(null);

      /*
       * Seule la destination prévue
       * par TIKEMIA est autorisée.
       *
       * Aucun redirect externe
       * transmis par le serveur.
       */

      router.replace(LOGIN_URL);
      router.refresh();
    } catch (reason) {
      if (controller.signal.aborted) {
        return;
      }

      setError(
        reason instanceof TypeError
          ? t.networkError
          : t.genericError
      );
    } finally {
      requestInProgress.current = false;
      requestController.current = null;
      setSubmitting(false);
    }
  }

  /* ========================================================
     INFORMATIONS DE PROGRESSION
  ======================================================== */

  const currentStepNumber =
    step === "email"
      ? 1
      : step === "code"
        ? 2
        : 3;

  const title =
    completed
      ? t.successTitle
      : step === "email"
        ? t.titleEmail
        : step === "code"
          ? t.titleCode
          : t.titlePassword;

  const subtitle =
    completed
      ? t.successDescription
      : step === "email"
        ? t.subtitleEmail
        : step === "code"
          ? t.subtitleCode
          : t.subtitlePassword;

  const completeCode =
    digits.every(
      (digit) => /^\d$/.test(digit)
    );

  /* ========================================================
     INTERFACE
  ======================================================== */

  return (
    <>
      {/* ==================================================
          FOOTER PUBLIC

          Le header et la navigation
          sont déjà fournis par
          src/app/(public)/layout.tsx.

          PC : footer existant.
          Mobile : footer masqué.

          Aucun footer supplémentaire.
      ================================================== */}

      

      <div
        id="tikemia-forgot-password-page"
        className="flex w-full min-w-0 flex-1 flex-col bg-white text-[#172439]"
      >
        {/* ==================================================
            ARCHITECTURE PRINCIPALE

            PC :
            - Image à gauche
            - Formulaire à droite

            MOBILE :
            - Image en bannière
            - Formulaire en dessous
        ================================================== */}

        <div className="grid w-full min-w-0 flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-2">

          {/* ==================================================
              IMAGE PC

              Image déjà présente :
              public/images/paccueil.png

              Aucun texte promotionnel
              ajouté sur cette image.
          ================================================== */}

          <div className="relative hidden min-h-0 overflow-hidden bg-[#063e2c] lg:block">
            <Image fill sizes="(min-width: 1024px) 50vw, 100vw" unoptimized
              src={IMAGE_URL}
              alt=""
              aria-hidden="true"
              loading="eager"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          </div>

          {/* ==================================================
              COLONNE DROITE
          ================================================== */}

          <div className="relative flex w-full min-w-0 flex-col bg-[#f8faf9]">

            {/* ==============================================
                BANNIÈRE MOBILE

                Même image.
                Sans texte superposé.
            ============================================== */}

            <div className="relative h-33.75 w-full overflow-hidden bg-[#06462f] sm:h-43.75 lg:hidden">
              <Image fill sizes="(min-width: 1024px) 50vw, 100vw" unoptimized
                src={IMAGE_URL}
                alt=""
                aria-hidden="true"
                loading="eager"
                className="h-full w-full object-cover object-center"
              />
            </div>

            {/* ==============================================
                CENTRAGE DU FORMULAIRE
            ============================================== */}

            <div className="relative flex w-full min-w-0 flex-1 items-start justify-center px-3 pb-4 sm:px-6 sm:py-5 lg:items-center lg:px-8 lg:py-6 xl:px-12">

              <div className="-mt-7 w-full max-w-147.5 min-w-0 rounded-[25px] border border-[#e3eae6] bg-white px-5 pt-7 pb-7 shadow-[0_12px_40px_rgba(15,51,30,0.1)] sm:mt-0 sm:px-9 sm:py-9 lg:rounded-[29px]">

                {/* ==========================================
                    NAVIGATION DU FORMULAIRE
                ========================================== */}

                {!completed && (
                  <div className="mb-5 flex items-center justify-between gap-3">
                    {step === "email" ? (
                      <Link
                        href={LOGIN_URL}
                        className="inline-flex items-center gap-2 text-xs font-bold text-[#667b6f] hover:text-[#087d2d]"
                      >
                        <ArrowLeft size={16} />
                        {t.backToLogin}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={submitting || resending}
                        onClick={() => {
                          if (step === "password") {
                            setStep("code");
                            setError(null);
                          } else {
                            returnToEmail();
                          }
                        }}
                        className="inline-flex items-center gap-2 text-xs font-bold text-[#667b6f] hover:text-[#087d2d] disabled:opacity-50"
                      >
                        <ChevronLeft size={16} />
                        {t.back}
                      </button>
                    )}

                    <span className="text-[11px] font-bold text-[#7b8b80]">
                      {t.step} {currentStepNumber} {t.of} 3
                    </span>
                  </div>
                )}

                {/* ==========================================
                    ICÔNE PRINCIPALE
                ========================================== */}

                <div className="mx-auto flex size-16.25 items-center justify-center rounded-full bg-linear-to-b from-[#19ad00] to-[#006e28] text-white shadow-[0_5px_12px_rgba(5,105,39,0.15)] sm:size-18.5">
                  {completed ? (
                    <CheckCircle2
                      size={36}
                      strokeWidth={1.8}
                    />
                  ) : step === "email" ? (
                    <Mail
                      size={35}
                      strokeWidth={1.8}
                    />
                  ) : step === "code" ? (
                    <KeyRound
                      size={35}
                      strokeWidth={1.8}
                    />
                  ) : (
                    <LockKeyhole
                      size={35}
                      strokeWidth={1.8}
                    />
                  )}
                </div>

                {/* ==========================================
                    TITRE
                ========================================== */}

                <div className="mt-5 text-center">
                  <h1 className="text-[26px] font-black leading-tight tracking-tight text-[#111b2e] sm:text-[32px]">
                    {title}
                  </h1>

                  <p className="mx-auto mt-2 max-w-105 text-[13px] leading-relaxed text-[#708095] sm:text-[14px]">
                    {subtitle}
                  </p>
                </div>

                {/* ==========================================
                    PROGRESSION

                    Trois étapes simples.
                ========================================== */}

                {!completed && (
                  <div
                    role="progressbar"
                    aria-valuemin={1}
                    aria-valuemax={3}
                    aria-valuenow={currentStepNumber}
                    aria-label={`${t.step} ${currentStepNumber} ${t.of} 3`}
                    className="mt-6 grid grid-cols-3 gap-2"
                  >
                    {[1, 2, 3].map((number) => (
                      <div
                        key={number}
                        className={`h-1.5 rounded-full ${
                          number <= currentStepNumber
                            ? "bg-[#07852e]"
                            : "bg-[#e3ebe5]"
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* ==========================================
                    INFORMATION
                ========================================== */}

                {information && !completed && (
                  <div
                    role="status"
                    className="mt-5 rounded-xl border border-[#d6ebdb] bg-[#f0faf3] px-4 py-3 text-xs leading-relaxed text-[#265e37]"
                  >
                    <div className="flex items-start gap-2">
                      <CheckCircle2
                        size={17}
                        className="mt-0.5 shrink-0 text-[#087d2d]"
                      />
                      <p>{information}</p>
                    </div>
                  </div>
                )}

                {/* ==========================================
                    ERREUR
                ========================================== */}

                {error && !completed && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="mt-5 flex items-start gap-2.5 rounded-xl border border-[#f2cbcb] bg-[#fff5f5] px-4 py-3 text-xs font-semibold leading-relaxed text-[#ad3434]"
                  >
                    <CircleAlert
                      size={18}
                      className="shrink-0"
                    />

                    <p>{error}</p>
                  </div>
                )}

                {/* ==========================================
                    ÉTAPE 1 — EMAIL
                ========================================== */}

                {!completed && step === "email" && (
                  <form
                    onSubmit={requestCode}
                    noValidate
                    className="mt-7 space-y-5"
                  >
                    <div>
                      <label
                        htmlFor="tikemia-forgot-email"
                        className="mb-2 block text-[13px] font-extrabold text-[#1e2b3b]"
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
                          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[#304657]"
                        />

                        <input
                          id="tikemia-forgot-email"
                          name="email"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          maxLength={254}
                          required
                          disabled={busy}
                          value={email}
                          onChange={(event) => {
                            setEmail(event.target.value);
                            setError(null);
                            setInformation(null);
                          }}
                          placeholder={t.emailPlaceholder}
                          className="h-13 w-full rounded-xl border border-[#d9e1e9] bg-[#fbfcff] pr-4 pl-12 text-sm font-medium text-[#243548] outline-none placeholder:font-normal placeholder:text-[#9aa6b6] focus:border-[#087d2d] focus:ring-2 focus:ring-[#087d2d]/10 disabled:opacity-60"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={busy}
                      className="flex min-h-13.25 w-full items-center justify-center gap-3 rounded-full bg-linear-to-b from-[#1dae00] to-[#006d28] px-5 py-3 text-[15px] font-extrabold text-white shadow-[0_5px_12px_rgba(5,101,37,0.15)] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <LoaderCircle
                            size={20}
                            className="animate-spin"
                          />
                          {t.sendingCode}
                        </>
                      ) : (
                        <>
                          <Mail size={20} />
                          {t.sendCode}
                          <ArrowRight size={17} />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* ==========================================
                    ÉTAPE 2 — CODE À SIX CHIFFRES
                ========================================== */}

                {!completed && step === "code" && (
                  <form
                    onSubmit={continueAfterCode}
                    noValidate
                    className="mt-7 space-y-5"
                  >
                    {/* EMAIL DESTINATAIRE */}

                    <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-[#f4f8f5] px-3 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <Mail
                          size={18}
                          className="shrink-0 text-[#087d2d]"
                        />

                        <p className="min-w-0 truncate text-xs font-semibold text-[#415c4a]">
                          {email}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={returnToEmail}
                        className="shrink-0 text-[11px] font-extrabold text-[#087d2d] hover:underline disabled:opacity-50"
                      >
                        {t.otherEmail}
                      </button>
                    </div>

                    {/* SIX CASES */}

                    <div>
                      <label
                        htmlFor="tikemia-reset-code-0"
                        className="mb-2 block text-[13px] font-extrabold text-[#1e2b3b]"
                      >
                        {t.code}
                        <span className="ml-1 text-red-600">
                          *
                        </span>
                      </label>

                      <p className="mb-4 text-xs text-[#738398]">
                        {t.codeHint}
                      </p>

                      <div
                        role="group"
                        aria-label={t.code}
                        className="grid grid-cols-6 gap-1.5 sm:gap-2.5"
                      >
                        {digits.map((digit, index) => (
                          <input
                            key={index}
                            ref={(element) => {
                              codeRefs.current[index] = element;
                            }}
                            id={`tikemia-reset-code-${index}`}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            autoComplete={
                              index === 0
                                ? "one-time-code"
                                : "off"
                            }
                            maxLength={CODE_LENGTH}
                            value={digit}
                            disabled={busy}
                            aria-label={`${t.code} ${index + 1}`}
                            onChange={(event) =>
                              handleCodeChange(index, event)
                            }
                            onKeyDown={(event) =>
                              handleCodeKeyDown(index, event)
                            }
                            onPaste={(event) =>
                              handleCodePaste(index, event)
                            }
                            onFocus={(event) =>
                              event.currentTarget.select()
                            }
                            className={`h-13.25 w-full min-w-0 rounded-xl border text-center text-[23px] font-black text-[#074b29] outline-none focus:ring-2 focus:ring-[#087d2d]/10 disabled:opacity-60 sm:h-15.75 sm:text-[28px] ${
                              digit
                                ? "border-[#087d2d] bg-[#f2faf4]"
                                : "border-[#d5dfda] bg-[#fbfcff] focus:border-[#087d2d]"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* CONTINUER */}

                    <button
                      type="submit"
                      disabled={busy || !completeCode}
                      className="flex min-h-13.25 w-full items-center justify-center gap-2 rounded-full bg-linear-to-b from-[#1dae00] to-[#006d28] px-5 py-3 text-[15px] font-extrabold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {t.continue}
                      <ArrowRight size={19} />
                    </button>

                    {/* RENVOI DU CODE */}

                    <div className="flex flex-col items-center gap-2 pt-2 text-center">
                      <p className="text-xs text-[#708095]">
                        {t.codeNotReceived}
                      </p>

                      <button
                        type="button"
                        onClick={() => {
                          void resendCode();
                        }}
                        disabled={
                          busy ||
                          countdown > 0
                        }
                        className="inline-flex items-center gap-2 text-xs font-extrabold text-[#087d2d] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {resending ? (
                          <>
                            <LoaderCircle
                              size={16}
                              className="animate-spin"
                            />
                            {t.resending}
                          </>
                        ) : countdown > 0 ? (
                          <>
                            <RefreshCw size={15} />
                            {t.resendIn}{" "}
                            {formatCountdown(countdown)}
                          </>
                        ) : (
                          <>
                            <RefreshCw size={16} />
                            {t.resendCode}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* ==========================================
                    ÉTAPE 3 — NOUVEAU MOT DE PASSE
                ========================================== */}

                {!completed && step === "password" && (
                  <form
                    onSubmit={resetPassword}
                    noValidate
                    className="mt-7 space-y-5"
                  >
                    {/* NOUVEAU MOT DE PASSE */}

                    <div>
                      <label
                        htmlFor="tikemia-reset-new-password"
                        className="mb-2 block text-[13px] font-extrabold text-[#1e2b3b]"
                      >
                        {t.newPassword}
                        <span className="ml-1 text-red-600">
                          *
                        </span>
                      </label>

                      <div className="relative">
                        <LockKeyhole
                          size={20}
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[#314757]"
                        />

                        <input
                          id="tikemia-reset-new-password"
                          type={
                            showPassword
                              ? "text"
                              : "password"
                          }
                          name="newPassword"
                          autoComplete="new-password"
                          minLength={PASSWORD_MIN_LENGTH}
                          maxLength={1024}
                          required
                          value={newPassword}
                          disabled={busy}
                          onChange={(event) => {
                            setNewPassword(
                              event.target.value
                            );
                            setError(null);
                          }}
                          placeholder={t.passwordPlaceholder}
                          className="h-13 w-full rounded-xl border border-[#d9e1e9] bg-[#fbfcff] pr-12 pl-12 text-sm font-medium text-[#243548] outline-none placeholder:font-normal placeholder:text-[#9aa6b6] focus:border-[#087d2d] focus:ring-2 focus:ring-[#087d2d]/10 disabled:opacity-60"
                        />

                        <button
                          type="button"
                          disabled={busy}
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
                          className="absolute top-1/2 right-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#718093] hover:bg-[#edf3ef] disabled:opacity-50"
                        >
                          {showPassword ? (
                            <EyeOff size={20} />
                          ) : (
                            <Eye size={20} />
                          )}
                        </button>
                      </div>

                      <p className="mt-2 text-[11px] text-[#82909e]">
                        {t.passwordHint}
                      </p>
                    </div>

                    {/* CONFIRMATION */}

                    <div>
                      <label
                        htmlFor="tikemia-reset-confirm-password"
                        className="mb-2 block text-[13px] font-extrabold text-[#1e2b3b]"
                      >
                        {t.confirmPassword}
                        <span className="ml-1 text-red-600">
                          *
                        </span>
                      </label>

                      <div className="relative">
                        <LockKeyhole
                          size={20}
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[#314757]"
                        />

                        <input
                          id="tikemia-reset-confirm-password"
                          type={
                            showConfirmation
                              ? "text"
                              : "password"
                          }
                          name="confirmPassword"
                          autoComplete="new-password"
                          minLength={PASSWORD_MIN_LENGTH}
                          maxLength={1024}
                          required
                          disabled={busy}
                          value={confirmPassword}
                          onChange={(event) => {
                            setConfirmPassword(
                              event.target.value
                            );
                            setError(null);
                          }}
                          placeholder={t.confirmPlaceholder}
                          className="h-13 w-full rounded-xl border border-[#d9e1e9] bg-[#fbfcff] pr-12 pl-12 text-sm font-medium text-[#243548] outline-none placeholder:font-normal placeholder:text-[#9aa6b6] focus:border-[#087d2d] focus:ring-2 focus:ring-[#087d2d]/10 disabled:opacity-60"
                        />

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setShowConfirmation(
                              (previous) => !previous
                            )
                          }
                          aria-label={
                            showConfirmation
                              ? t.hidePassword
                              : t.showPassword
                          }
                          className="absolute top-1/2 right-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#718093] hover:bg-[#edf3ef] disabled:opacity-50"
                        >
                          {showConfirmation ? (
                            <EyeOff size={20} />
                          ) : (
                            <Eye size={20} />
                          )}
                        </button>
                      </div>

                      {/* INDICATEUR CORRESPONDANCE */}

                      {confirmPassword.length > 0 &&
                        newPassword === confirmPassword && (
                          <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#087d2d]">
                            <Check size={15} />
                            {locale === "fr"
                              ? "Les mots de passe correspondent."
                              : "Passwords match."}
                          </p>
                        )}
                    </div>

                    {/* VALIDATION FINALE */}

                    <button
                      type="submit"
                      disabled={busy}
                      className="flex min-h-13.25 w-full items-center justify-center gap-2 rounded-full bg-linear-to-b from-[#1dae00] to-[#006d28] px-5 py-3 text-[15px] font-extrabold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <LoaderCircle
                            size={20}
                            className="animate-spin"
                          />
                          {t.resetting}
                        </>
                      ) : (
                        <>
                          <LockKeyhole size={20} />
                          {t.resetPassword}
                          <ArrowRight size={17} />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* ==========================================
                    SUCCÈS CONFIRMÉ PAR LE SERVEUR
                ========================================== */}

                {completed && (
                  <div
                    role="status"
                    className="mt-8 text-center"
                  >
                    <div className="rounded-2xl border border-[#d1ebd8] bg-[#f1faf3] px-5 py-6">
                      <CheckCircle2
                        size={34}
                        className="mx-auto text-[#087d2d]"
                      />

                      <p className="mt-3 text-sm font-semibold text-[#275c36]">
                        {t.successDescription}
                      </p>
                    </div>

                    <Link
                      href={LOGIN_URL}
                      className="mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-linear-to-b from-[#1dae00] to-[#006d28] px-5 py-3 text-sm font-extrabold text-white"
                    >
                      <UserRound size={20} />
                      {t.signIn}
                      <ArrowRight size={17} />
                    </Link>
                  </div>
                )}

                {/* ==========================================
                    LIEN CONNEXION

                    Aucun texte promotionnel.
                ========================================== */}

                {!completed && (
                  <div className="mt-7 border-t border-[#e7ede8] pt-5 text-center">
                    <Link
                      href={LOGIN_URL}
                      className="inline-flex items-center gap-2 text-xs font-extrabold text-[#087d2d] hover:underline"
                    >
                      <ArrowLeft size={16} />
                      {t.backToLogin}
                    </Link>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
