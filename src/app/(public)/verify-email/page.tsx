
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
import { useRouter, useSearchParams } from "next/navigation";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  KeyRound,
  LoaderCircle,
  Mail,
  ShieldCheck,
} from "lucide-react";

/* ==========================================================
   TIKEMIA — VÉRIFICATION EMAIL PUBLIQUE

   FICHIER :
   src/app/(public)/verify-email/page.tsx

   ROUTE :
   /verify-email

   API :
   POST /api/auth/verify-email

   OBJECTIF :
   - Saisir le code à six chiffres
   - Vérifier le code avec l'API
   - Activer le compte
   - Ouvrir la session via le cookie API
   - Rediriger vers /account

   DESIGN :
   - Version PC professionnelle
   - Version mobile responsive
   - Image existante /images/paccueil.png
   - Header public existant
   - Aucun menu dupliqué
   - Aucun nouveau fichier CSS

   SÉCURITÉ :
   - Code envoyé uniquement par POST
   - Aucun code dans l'URL
   - Aucun stockage du code
   - Aucun succès simulé
   - Aucune session créée côté navigateur

   LANGUES :
   - Français par défaut
   - Anglais secondaire
========================================================== */

type Locale = "fr" | "en";

type VerifyResponse = {
  success?: boolean;
  verified?: boolean;
  message?: string;
  code?: string;
  redirectTo?: string;
};

const CODE_LENGTH = 6;

const API_URL = "/api/auth/verify-email";

const ACCOUNT_URL = "/account";

const IMAGE_URL = "/images/paccueil.png";

/* ==========================================================
   TEXTES FR / EN
========================================================== */

const TEXT = {
  fr: {
    title: "Vérifiez votre email",

    subtitle:
      "Saisissez le code à 6 chiffres envoyé à votre adresse email.",

    email: "Adresse email",

    emailPlaceholder: "Votre adresse email",

    codeLabel: "Code de vérification",

    codeHint:
      "Entrez les six chiffres reçus par email.",

    verify: "Vérifier mon email",

    verifying: "Vérification en cours...",

    back: "Retour à l'inscription",

    login: "Se connecter",

    existingAccount:
      "Vous avez déjà un compte vérifié ?",

    invalidEmail:
      "Veuillez saisir une adresse email valide.",

    incompleteCode:
      "Veuillez saisir les six chiffres du code.",

    invalidVerification:
      "Le code est incorrect, expiré ou déjà utilisé.",

    tooManyAttempts:
      "Trop de tentatives. Vous devez demander un nouveau code.",

    networkError:
      "Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.",

    genericError:
      "Une erreur est survenue. Veuillez réessayer.",

    successTitle:
      "Votre email a été vérifié !",

    successDescription:
      "Votre compte est activé. Vous allez accéder à votre espace personnel.",

    goToAccount:
      "Accéder à mon compte",

    security:
      "Vérification sécurisée",

    notice:
      "Le code est personnel. Ne le communiquez à personne.",

    changeEmail:
      "Vous pouvez corriger l'adresse email si nécessaire.",

    accountInfo:
      "Après validation, vous pourrez accéder à votre compte et retrouver les billets associés à votre adresse email vérifiée.",

    verificationUnavailable:
      "La vérification n'est pas disponible pour le moment.",
  },

  en: {
    title: "Verify your email",

    subtitle:
      "Enter the 6-digit code sent to your email address.",

    email: "Email address",

    emailPlaceholder: "Your email address",

    codeLabel: "Verification code",

    codeHint:
      "Enter the six digits received by email.",

    verify: "Verify my email",

    verifying: "Verifying...",

    back: "Back to registration",

    login: "Sign in",

    existingAccount:
      "Already have a verified account?",

    invalidEmail:
      "Please enter a valid email address.",

    incompleteCode:
      "Please enter all six digits.",

    invalidVerification:
      "The code is incorrect, expired or already used.",

    tooManyAttempts:
      "Too many attempts. You need to request a new code.",

    networkError:
      "Unable to reach the server. Check your connection and try again.",

    genericError:
      "Something went wrong. Please try again.",

    successTitle:
      "Your email has been verified!",

    successDescription:
      "Your account is activated. You can now access your personal account.",

    goToAccount:
      "Go to my account",

    security:
      "Secure verification",

    notice:
      "Your code is private. Never share it with anyone.",

    changeEmail:
      "You can correct the email address if needed.",

    accountInfo:
      "After verification, you can access your account and find tickets associated with your verified email address.",

    verificationUnavailable:
      "Verification is currently unavailable.",
  },
} as const;

/* ==========================================================
   VALIDATION EMAIL
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
   EXTRACTION DES CHIFFRES

   Permet :
   - Saisie normale
   - Collage du code complet
   - Saisie clavier mobile
========================================================== */

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function emptyCode(): string[] {
  return Array.from(
    { length: CODE_LENGTH },
    () => ""
  );
}

/* ==========================================================
   PAGE
========================================================== */

export default function VerifyEmailPage() {
  const router = useRouter();

  const [locale, setLocale] =
    useState<Locale>("fr");

  const t = TEXT[locale];

  const searchParams = useSearchParams();
  const [email, setEmail] = useState(() => { const initial = searchParams.get("email"); return initial && isValidEmail(initial) ? normalizeEmail(initial) : ""; });

  const [digits, setDigits] =
    useState<string[]>(emptyCode);

  const [submitting, setSubmitting] =
    useState(false);

  const [verified, setVerified] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [emailError, setEmailError] =
    useState(false);

  const [redirectTo, setRedirectTo] =
    useState(ACCOUNT_URL);

  const codeRefs = useRef<
    Array<HTMLInputElement | null>
  >([]);

  const requestController =
    useRef<AbortController | null>(null);

  const requestInProgress =
    useRef(false);

  /* ========================================================
     INITIALISATION DE L'EMAIL

     Compatible avec :
     /verify-email?email=client@example.com

     Si aucun email n'est transmis,
     l'utilisateur pourra le saisir.

     Aucun code n'est lu dans l'URL.
  ======================================================== */



  /* ========================================================
     SYNCHRONISATION FR / EN

     Réutilise la préférence utilisée
     par la navigation publique TIKEMIA.
  ======================================================== */

  useEffect(() => {
    function synchronizeLanguage() {
      try {
        const saved = localStorage.getItem(
          "tikemia_locale"
        );

        if (saved === "fr" || saved === "en") {
          setLocale(saved);
          return;
        }
      } catch {
        // Français par défaut.
      }

      const language =
        document.documentElement.lang
          .toLowerCase();

      setLocale(
        language.startsWith("en")
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
     NETTOYAGE DES REQUÊTES
  ======================================================== */

  useEffect(() => {
    return () => {
      requestController.current?.abort();
    };
  }, []);

  /* ========================================================
     FOCUS SUR UNE CASE
  ======================================================== */

  const focusInput = useCallback(
    (index: number) => {
      if (
        index < 0 ||
        index >= CODE_LENGTH
      ) {
        return;
      }

      const input =
        codeRefs.current[index];

      input?.focus();
      input?.select();
    },
    []
  );

  /* ========================================================
     REMPLISSAGE DE PLUSIEURS CASES

     Prend en charge :
     - Code collé
     - Autofill SMS/email du navigateur
     - Saisie de plusieurs chiffres
  ======================================================== */

  const fillDigits = useCallback(
    (startIndex: number, value: string) => {
      const numbers = onlyDigits(value);

      if (!numbers) {
        return;
      }

      const start =
        numbers.length >= CODE_LENGTH
          ? 0
          : startIndex;

      const values =
        numbers.length >= CODE_LENGTH
          ? numbers.slice(0, CODE_LENGTH)
          : numbers;

      setDigits((previous) => {
        const next = [...previous];

        for (
          let index = 0;
          index < values.length;
          index++
        ) {
          const target = start + index;

          if (target >= CODE_LENGTH) {
            break;
          }

          next[target] = values[index];
        }

        return next;
      });

      setError(null);

      const nextIndex =
        start + values.length;

      if (nextIndex < CODE_LENGTH) {
        requestAnimationFrame(() => {
          focusInput(nextIndex);
        });
      } else {
        requestAnimationFrame(() => {
          focusInput(CODE_LENGTH - 1);
        });
      }
    },
    [focusInput]
  );

  /* ========================================================
     CHANGEMENT D'UNE CASE
  ======================================================== */

  function handleDigitChange(
    index: number,
    event: ChangeEvent<HTMLInputElement>
  ) {
    if (submitting || verified) {
      return;
    }

    const input = event.target.value;

    if (input === "") {
      setDigits((previous) => {
        const next = [...previous];
        next[index] = "";
        return next;
      });

      setError(null);
      return;
    }

    fillDigits(index, input);
  }

  /* ========================================================
     GESTION DU CLAVIER

     - Backspace
     - Delete
     - Flèche gauche
     - Flèche droite
  ======================================================== */

  function handleDigitKeyDown(
    index: number,
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (submitting || verified) {
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

        focusInput(index - 1);
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
      focusInput(index - 1);
      return;
    }

    if (
      event.key === "ArrowRight" &&
      index < CODE_LENGTH - 1
    ) {
      event.preventDefault();
      focusInput(index + 1);
    }
  }

  /* ========================================================
     COLLAGE DU CODE
  ======================================================== */

  function handleDigitPaste(
    index: number,
    event: ClipboardEvent<HTMLInputElement>
  ) {
    event.preventDefault();

    if (submitting || verified) {
      return;
    }

    const pasted =
      event.clipboardData.getData("text");

    fillDigits(index, pasted);
  }

  /* ========================================================
     EMAIL
  ======================================================== */

  function handleEmailChange(
    value: string
  ) {
    if (submitting || verified) {
      return;
    }

    setEmail(value);
    setEmailError(false);
    setError(null);
  }

  /* ========================================================
     SOUMISSION AU SERVEUR

     API EXISTANTE :
     POST /api/auth/verify-email

     BODY :
     {
       email,
       code,
       locale
     }

     Aucun succès local simulé.

     Le serveur est seul responsable
     de la validation du code.
  ======================================================== */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      submitting ||
      verified ||
      requestInProgress.current
    ) {
      return;
    }

    const normalizedEmail =
      normalizeEmail(email);

    const code =
      digits.join("");

    if (!isValidEmail(normalizedEmail)) {
      setEmailError(true);
      setError(t.invalidEmail);
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      setError(t.incompleteCode);

      const firstEmpty =
        digits.findIndex(
          (digit) => digit === ""
        );

      focusInput(
        firstEmpty >= 0
          ? firstEmpty
          : 0
      );

      return;
    }

    requestInProgress.current = true;
    setSubmitting(true);
    setError(null);
    setEmailError(false);

    const controller =
      new AbortController();

    requestController.current =
      controller;

    try {
      const response = await fetch(
        API_URL,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            email: normalizedEmail,
            code,
            locale,
          }),

          signal: controller.signal,
        }
      );

      let result: VerifyResponse = {};

      try {
        result =
          (await response.json()) as VerifyResponse;
      } catch {
        // Une réponse non JSON est une erreur.
      }

      if (
        !response.ok ||
        result.success !== true ||
        result.verified !== true
      ) {
        if (
          response.status === 429 ||
          result.code === "tooManyAttempts"
        ) {
          setError(t.tooManyAttempts);
        } else if (
          response.status >= 500
        ) {
          setError(t.verificationUnavailable);
        } else {
          setError(
            result.message ||
            t.invalidVerification
          );
        }

        return;
      }

      /*
       * La session est créée par l'API.
       * Le navigateur reçoit uniquement
       * le cookie sécurisé HttpOnly.
       */

      const safeRedirect =
        result.redirectTo === ACCOUNT_URL
          ? ACCOUNT_URL
          : ACCOUNT_URL;

      setRedirectTo(safeRedirect);

      setVerified(true);

      setDigits(emptyCode());

      setError(null);

      /*
       * Redirection après confirmation
       * du succès par le serveur.
       */

      router.replace(safeRedirect);
      router.refresh();
    } catch (reason) {
      if (
        controller.signal.aborted
      ) {
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
     ÉTAT DU CODE
  ======================================================== */

  const codeComplete =
    digits.every(
      (digit) => /^\d$/.test(digit)
    );

  const canSubmit =
    !submitting &&
    !verified &&
    isValidEmail(email) &&
    codeComplete;

  /* ========================================================
     INTERFACE
  ======================================================== */

  return (
    <>
      {/* ==================================================
          FOOTER PUBLIC

          PC : conservé.
          MOBILE : masqué.

          Header et menu mobile existants
          conservés par le layout public.

          Aucun nouveau composant créé.
      ================================================== */}

      

      <div
        id="tikemia-verify-email-page"
        className="flex w-full min-w-0 flex-1 flex-col bg-white text-[#142236]"
      >
        {/* ==================================================
            STRUCTURE PC ET MOBILE
        ================================================== */}

        <div className="grid w-full min-w-0 flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">

          {/* ==================================================
              IMAGE PC

              Image existante :
              public/images/paccueil.png

              Aucun texte promotionnel
              ajouté au-dessus.
          ================================================== */}

          <div className="relative hidden min-h-0 overflow-hidden bg-[#063c2b] lg:block">
            <Image fill sizes="(min-width: 1024px) 50vw, 100vw" unoptimized
              src={IMAGE_URL}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover"
            />

            <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-[#002d24]/25 to-transparent" />
          </div>

          {/* ==================================================
              COLONNE FORMULAIRE
          ================================================== */}

          <div className="relative flex w-full min-w-0 flex-col bg-[#f8faf9]">

            {/* ==============================================
                BANNIÈRE MOBILE

                Même image de la page
                d'inscription.
            ============================================== */}

            <div className="relative h-31.25 w-full overflow-hidden bg-[#06452e] sm:h-40 lg:hidden">
              <Image fill sizes="(min-width: 1024px) 50vw, 100vw" unoptimized
                src={IMAGE_URL}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover object-center"
              />
            </div>

            {/* ==============================================
                CENTRAGE DU FORMULAIRE
            ============================================== */}

            <div className="relative z-10 flex w-full min-w-0 flex-1 items-start justify-center px-3 pb-4 sm:px-6 sm:py-5 lg:items-center lg:px-8 lg:py-6 xl:px-12">

              <div className="-mt-7 w-full max-w-147.5 min-w-0 rounded-[25px] border border-[#e4eae7] bg-white px-5 pt-8 pb-7 shadow-[0_12px_40px_rgba(15,51,30,0.1)] sm:mt-0 sm:px-9 sm:pt-10 sm:pb-9 lg:rounded-[30px]">

                {/* ==========================================
                    RETOUR
                ========================================== */}

                {!verified && (
                  <Link
                    href="/register"
                    className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-[#6b7f73] transition-colors hover:text-[#087d2d]"
                  >
                    <ArrowLeft size={16} />

                    {t.back}
                  </Link>
                )}

                {/* ==========================================
                    ICÔNE PRINCIPALE
                ========================================== */}

                <div className="mx-auto flex size-16.25 items-center justify-center rounded-full bg-linear-to-b from-[#18a700] to-[#006d29] text-white shadow-[0_5px_12px_rgba(5,107,40,0.16)] sm:size-18.75">
                  {verified ? (
                    <CheckCircle2
                      size={37}
                      strokeWidth={1.8}
                    />
                  ) : (
                    <Mail
                      size={36}
                      strokeWidth={1.8}
                    />
                  )}
                </div>

                {/* ==========================================
                    TITRE ET DESCRIPTION
                ========================================== */}

                <div className="mt-5 text-center">
                  <h1 className="text-[26px] font-black leading-tight tracking-tight text-[#0b172b] sm:text-[32px]">
                    {verified
                      ? t.successTitle
                      : t.title}
                  </h1>

                  <p className="mx-auto mt-2 max-w-105 text-[13px] leading-relaxed text-[#64748b] sm:text-[15px]">
                    {verified
                      ? t.successDescription
                      : t.subtitle}
                  </p>
                </div>

                {/* ==========================================
                    EMAIL VÉRIFIÉ : SUCCÈS
                ========================================== */}

                {verified ? (
                  <div
                    role="status"
                    className="mt-8"
                  >
                    <div className="rounded-2xl border border-[#cdebd4] bg-[#f1fbf3] p-5 text-center">
                      <CheckCircle2
                        size={29}
                        className="mx-auto text-[#087d2d]"
                      />

                      <p className="mt-3 wrap-break-word text-sm font-extrabold text-[#0b4b27]">
                        {normalizeEmail(email)}
                      </p>
                    </div>

                    <Link
                      href={redirectTo}
                      className="mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-linear-to-b from-[#1aae00] to-[#006d28] px-5 py-3 text-sm font-extrabold text-white shadow-sm"
                    >
                      {t.goToAccount}

                      <ArrowRight size={19} />
                    </Link>
                  </div>
                ) : (

                  /* ========================================
                     FORMULAIRE VÉRIFICATION
                  ======================================== */

                  <form
                    onSubmit={handleSubmit}
                    noValidate
                    className="mt-8 space-y-6"
                  >
                    {/* ====================================
                        ADRESSE EMAIL
                    ==================================== */}

                    <div>
                      <label
                        htmlFor="tikemia-verify-email"
                        className="mb-2 block text-[13px] font-extrabold text-[#192234]"
                      >
                        {t.email}{" "}

                        <span className="text-red-600">
                          *
                        </span>
                      </label>

                      <div className="relative">
                        <Mail
                          size={21}
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[#182537]"
                        />

                        <input
                          id="tikemia-verify-email"
                          name="email"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          spellCheck={false}
                          autoCapitalize="none"
                          autoCorrect="off"
                          required
                          maxLength={254}
                          value={email}
                          onChange={(event) =>
                            handleEmailChange(
                              event.target.value
                            )
                          }
                          placeholder={
                            t.emailPlaceholder
                          }
                          aria-invalid={emailError}
                          disabled={submitting}
                          className={`h-13 w-full rounded-xl border bg-[#fbfcff] pr-4 pl-12 text-sm font-medium text-[#26384e] outline-none transition-colors placeholder:font-normal placeholder:text-[#9aa6b6] focus:ring-2 ${
                            emailError
                              ? "border-red-500 focus:ring-red-100"
                              : "border-[#d8deea] focus:border-[#087d2d] focus:ring-[#087d2d]/10"
                          } disabled:opacity-70`}
                        />
                      </div>

                      <p className="mt-2 text-[11px] leading-relaxed text-[#8794a2]">
                        {t.changeEmail}
                      </p>
                    </div>

                    {/* ====================================
                        CODE À SIX CHIFFRES
                    ==================================== */}

                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <label
                          htmlFor="tikemia-code-0"
                          className="text-[13px] font-extrabold text-[#192234]"
                        >
                          {t.codeLabel}{" "}

                          <span className="text-red-600">
                            *
                          </span>
                        </label>

                        <KeyRound
                          size={18}
                          aria-hidden="true"
                          className="text-[#087d2d]"
                        />
                      </div>

                      <p className="mb-4 text-xs leading-relaxed text-[#738398]">
                        {t.codeHint}
                      </p>

                      <div
                        role="group"
                        aria-label={t.codeLabel}
                        className="grid w-full grid-cols-6 gap-1.5 sm:gap-2.5"
                      >
                        {digits.map(
                          (digit, index) => (
                            <input
                              key={index}
                              ref={(element) => {
                                codeRefs.current[index] =
                                  element;
                              }}
                              id={`tikemia-code-${index}`}
                              type="text"
                              inputMode="numeric"
                              autoComplete={
                                index === 0
                                  ? "one-time-code"
                                  : "off"
                              }
                              pattern="[0-9]*"
                              maxLength={CODE_LENGTH}
                              value={digit}
                              onChange={(event) =>
                                handleDigitChange(
                                  index,
                                  event
                                )
                              }
                              onKeyDown={(event) =>
                                handleDigitKeyDown(
                                  index,
                                  event
                                )
                              }
                              onPaste={(event) =>
                                handleDigitPaste(
                                  index,
                                  event
                                )
                              }
                              onFocus={(event) =>
                                event.currentTarget.select()
                              }
                              disabled={submitting}
                              aria-label={`${t.codeLabel} ${index + 1}`}
                              aria-invalid={Boolean(error)}
                              className={`h-13.25 min-w-0 w-full rounded-xl border bg-[#fbfcff] text-center text-[23px] font-black text-[#063f25] outline-none transition-colors sm:h-16 sm:text-[28px] ${
                                error
                                  ? "border-red-400 focus:border-red-500"
                                  : digit
                                    ? "border-[#0a8b39] bg-[#f4fbf6]"
                                    : "border-[#d5dfda] focus:border-[#087d2d]"
                              } focus:ring-2 focus:ring-[#087d2d]/10 disabled:opacity-70`}
                            />
                          )
                        )}
                      </div>
                    </div>

                    {/* ====================================
                        ERREUR DE VALIDATION
                    ==================================== */}

                    {error && (
                      <div
                        role="alert"
                        aria-live="assertive"
                        className="flex items-start gap-2.5 rounded-xl border border-[#f4c9c9] bg-[#fff5f5] px-3 py-3 text-xs font-semibold leading-relaxed text-[#ac3030]"
                      >
                        <CircleAlert
                          size={18}
                          className="shrink-0"
                        />

                        <p>{error}</p>
                      </div>
                    )}

                    {/* ====================================
                        BOUTON DE VÉRIFICATION
                    ==================================== */}

                    <button
                      type="submit"
                      disabled={
                        !canSubmit ||
                        submitting
                      }
                      className="flex min-h-13.25 w-full items-center justify-center gap-3 rounded-full bg-linear-to-b from-[#1cad00] to-[#006c27] px-5 py-3 text-[15px] font-extrabold text-white shadow-[0_5px_12px_rgba(5,101,34,0.13)] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {submitting ? (
                        <>
                          <LoaderCircle
                            size={20}
                            className="animate-spin"
                          />

                          {t.verifying}
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={21} />

                          {t.verify}

                          <ArrowRight size={17} />
                        </>
                      )}
                    </button>

                    {/* ====================================
                        CONNEXION
                    ==================================== */}

                    <div className="pt-1">
                      <div className="mb-4 flex items-center gap-3">
                        <div className="h-px flex-1 bg-[#e1e6ef]" />

                        <p className="text-center text-xs font-semibold text-[#58667b]">
                          {t.existingAccount}
                        </p>

                        <div className="h-px flex-1 bg-[#e1e6ef]" />
                      </div>

                      <Link
                        href="/login"
                        className="flex min-h-12.25 w-full items-center justify-center gap-2 rounded-full border border-[#07902d] bg-white px-5 py-3 text-sm font-extrabold text-[#087d2d] transition-colors hover:bg-[#f2fbf4]"
                      >
                        {t.login}
                      </Link>
                    </div>

                    {/* ====================================
                        INFORMATION DE SÉCURITÉ
                    ==================================== */}

                    <div className="flex items-start gap-3 rounded-xl bg-[#f2f5f9] px-4 py-4">
                      <ShieldCheck
                        size={21}
                        className="mt-0.5 shrink-0 text-[#087d2d]"
                      />

                      <p className="text-[11px] leading-relaxed text-[#53677a]">
                        {t.notice}
                      </p>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
