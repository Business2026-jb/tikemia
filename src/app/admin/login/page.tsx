
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import Image from "next/image";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MailCheck,
  ShieldCheck,
} from "lucide-react";

/*
  TIKEMIA — CONNEXION ADMINISTRATEUR

  Page :
  /admin/login

  API :
  POST /api/admin/auth/login

  Fonctionnement :
  - Email et mot de passe
  - Aucun formulaire d'inscription
  - Aucun accès direct au dashboard
  - Envoi d'un lien de confirmation
  - Connexion finalisée par email

  Interface :
  - Français uniquement
  - PC et mobile
  - Aucun menu public
  - Aucun menu organisateur
  - Aucun changement de langue

  Sécurité :
  - Aucun mot de passe enregistré
  - Aucun secret côté navigateur
  - Aucune session créée ici
  - Confirmation obligatoire par email
*/

const LOGIN_API =
  "/api/admin/auth/login";

const REQUEST_TIMEOUT_MS = 20_000;

type LoginResponse = {
  success?: boolean;
  code?: string;
  message?: string;
  requiresEmailConfirmation?: boolean;
};

type PageState =
  | "form"
  | "submitting"
  | "email-sent";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return (
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

/* ======================================================
   LOGO TIKEMIA
====================================================== */

function TikemiaLogo() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="text-[27px] font-black tracking-tight text-[#087d35]">
        TIKEMIA
      </span>
    );
  }

  return (
    <Image
      src="/logo/logo.png"
      alt="TIKEMIA"
      width={190}
      height={60}
      priority
      onError={() => setFailed(true)}
      className="h-11.5 w-auto max-w-46.25 object-contain sm:h-13"
    />
  );
}

/* ======================================================
   PAGE DE CONNEXION
====================================================== */

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recovering, setRecovering] = useState(false);

  const [showPassword, setShowPassword] =
    useState(false);

  const [pageState, setPageState] =
    useState<PageState>("form");

  const [error, setError] =
    useState<string | null>(null);

  const [fieldErrors, setFieldErrors] =
    useState<{
      email?: string;
      password?: string;
    }>({});

  const [requestInfo, setRequestInfo] =
    useState<string | null>(null);

  const submittingRef = useRef(false);

  const requestController =
    useRef<AbortController | null>(null);

  const emailInputRef =
    useRef<HTMLInputElement>(null);

  /* ====================================================
     NETTOYAGE DES REQUÊTES
  ==================================================== */

  useEffect(() => {
    return () => {
      requestController.current?.abort();
    };
  }, []);

  /* ====================================================
     VALIDATION DU FORMULAIRE
  ==================================================== */

  const validate = useCallback(() => {
    const errors: {
      email?: string;
      password?: string;
    } = {};

    const normalizedEmail =
      normalizeEmail(email);

    if (!normalizedEmail) {
      errors.email =
        "Veuillez saisir votre adresse email.";
    } else if (!isValidEmail(normalizedEmail)) {
      errors.email =
        "Veuillez saisir une adresse email valide.";
    }

    if (!recovering && !password) {
      errors.password =
        "Veuillez saisir votre mot de passe.";
    } else if (password.length > 1024) {
      errors.password =
        "Le mot de passe est trop long.";
    }

    setFieldErrors(errors);

    return Object.keys(errors).length === 0;
  }, [email, password, recovering]);

  /* ====================================================
     SOUMISSION

     Le serveur effectue :
     - Vérification des identifiants
     - Vérification du rôle administrateur
     - Contrôle des tentatives
     - Génération du lien
     - Envoi par email

     Cette page ne crée aucune session.
  ==================================================== */

  const submitLogin = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (submittingRef.current) {
        return;
      }

      setError(null);
      setRequestInfo(null);

      if (!validate()) {
        return;
      }

      submittingRef.current = true;

      setPageState("submitting");

      const controller =
        new AbortController();

      requestController.current = controller;

      const timeout = window.setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
      );

      try {
        const response = await fetch(
          LOGIN_API,
          {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body: JSON.stringify({
              action: recovering ? "recover" : "login",
              email: normalizeEmail(email),
              password,
            }),
          }
        );

        let result: LoginResponse | null = null;

        try {
          result =
            (await response.json()) as LoginResponse;
        } catch {
          result = null;
        }

        if (!response.ok) {
          if (response.status === 429) {
            throw new Error(
              "Trop de tentatives ont été effectuées. Veuillez réessayer dans quelques minutes."
            );
          }

          throw new Error(
            result?.message ||
              "La connexion est momentanément indisponible."
          );
        }

        if (result?.success !== true) {
          throw new Error(
            result?.message ||
              "La demande de connexion n'a pas été acceptée."
          );
        }

        /*
          La réponse du serveur peut être
          volontairement générique afin
          de ne pas révéler la validité
          des identifiants.

          Ne jamais affirmer qu'un email
          a effectivement été délivré.
        */

        setRequestInfo(
          result.message ||
            "Si vos identifiants sont valides, un lien de confirmation vous sera envoyé."
        );

        /*
          Effacer le mot de passe
          de l'état du formulaire
          après la demande.
        */

        setPassword("");

        setPageState("email-sent");
      } catch (cause) {
        if (controller.signal.aborted) {
          setError(
            "Le délai de connexion est dépassé. Vérifiez votre connexion Internet et réessayez."
          );
        } else {
          setError(
            cause instanceof Error
              ? cause.message
              : "Une erreur est survenue. Veuillez réessayer."
          );
        }

        setPageState("form");
      } finally {
        window.clearTimeout(timeout);

        submittingRef.current = false;
        requestController.current = null;
      }
    },
    [email, password, validate, recovering]
  );

  /* ====================================================
     NOUVELLE DEMANDE
  ==================================================== */

  function restartLogin() {
    setPassword("");
    setError(null);
    setRequestInfo(null);
    setFieldErrors({});
    setPageState("form");

    window.requestAnimationFrame(() => {
      emailInputRef.current?.focus();
    });
  }

  const isSubmitting =
    pageState === "submitting";

  const emailSent =
    pageState === "email-sent";

  /* ====================================================
     AFFICHAGE PC / MOBILE
  ==================================================== */

  return (
    <div
      lang="fr"
      id="tikemia-admin-login"
      className="relative flex min-h-dvh w-full flex-col overflow-x-hidden bg-[#f6f9f7] text-[#152739]"
    >
      {/* ==========================================
          DÉCORATION DISCRÈTE
      ========================================== */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 size-72.5 rounded-full bg-[#e6f7e9] opacity-80 blur-3xl sm:size-115"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -left-20 size-75 rounded-full bg-[#e8f0f9] opacity-80 blur-3xl sm:size-107.5"
      />

      {/* ==========================================
          HEADER MINIMAL

          Pas de navigation publique.
          Pas de menu administrateur.
          Pas de choix de langue.
      ========================================== */}

      <header
        className="relative z-10 w-full border-b border-[#e6ece8] bg-white/95"
      >
        <div
          className="mx-auto flex h-18 w-full max-w-295 items-center justify-between gap-3 px-4 sm:h-20.5 sm:px-8"
        >
          <div className="shrink-0">
            <TikemiaLogo />
          </div>

          <div
            className="flex items-center gap-2 rounded-full border border-[#dcebe0] bg-[#f0f9f2] px-3 py-2 text-[#087d35] sm:px-4"
          >
            <ShieldCheck
              size={17}
              className="shrink-0"
            />

            <span
              className="text-[10px] font-extrabold sm:text-[12px]"
            >
              Espace administrateur
            </span>
          </div>
        </div>
      </header>

      {/* ==========================================
          CONTENU PRINCIPAL
      ========================================== */}

      <main
        className="relative z-10 flex w-full flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-12"
      >
        <div
          className="w-full max-w-115"
        >
          {/* ======================================
              CARTE DE CONNEXION
          ====================================== */}

          <div
            className="overflow-hidden rounded-[22px] border border-[#dfe9e2] bg-white shadow-[0_16px_50px_rgba(11,39,29,0.07)] sm:rounded-[26px]"
          >
            <div className="h-1.25 w-full bg-[#087d35]" />

            <div
              className="px-5 pb-8 pt-8 sm:px-9 sm:pb-10 sm:pt-10"
            >
              {/* ==================================
                  APRÈS DEMANDE DE CONNEXION
              ================================== */}

              {emailSent ? (
                <div
                  className="text-center"
                  aria-live="polite"
                >
                  <div
                    className="mx-auto flex size-19.5 items-center justify-center rounded-[22px] border border-[#d4eadb] bg-[#e9f8ee]"
                  >
                    <MailCheck
                      size={38}
                      className="text-[#087d35]"
                    />
                  </div>

                  <h1
                    className="mt-6 text-[24px] font-black tracking-tight text-[#15283b] sm:text-[28px]"
                  >
                    Vérifiez votre messagerie
                  </h1>

                  <p
                    className="mx-auto mt-3 max-w-85 text-[13px] leading-6 text-[#6b7d8f]"
                  >
                    {requestInfo ||
                      "Si vos identifiants sont valides, un lien de confirmation vous sera envoyé."}
                  </p>

                  <div
                    className="mt-7 rounded-xl border border-[#e4ede6] bg-[#f8fbf9] px-4 py-4 text-left"
                  >
                    <div
                      className="flex items-start gap-3"
                    >
                      <Mail
                        size={21}
                        className="mt-0.5 shrink-0 text-[#087d35]"
                      />

                      <div className="min-w-0">
                        <p
                          className="text-[12px] font-extrabold text-[#20374a]"
                        >
                          Confirmation par email
                        </p>

                        <p
                          className="mt-1 text-[12px] leading-6 text-[#718295]"
                        >
                          Ouvrez votre messagerie et
                          recherchez le message de
                          confirmation TIKEMIA.
                          Si vous recevez le lien,
                          cliquez dessus pour
                          poursuivre la connexion.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    className="mt-5 flex items-start gap-2 rounded-xl bg-[#f3f7fa] px-4 py-3 text-left"
                  >
                    <LockKeyhole
                      size={17}
                      className="mt-0.5 shrink-0 text-[#5c7184]"
                    />

                    <p
                      className="text-[11px] leading-5 text-[#65798b]"
                    >
                      Le lien de confirmation
                      est temporaire, valable
                      10 minutes et utilisable
                      une seule fois.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={restartLogin}
                    className="mt-7 flex min-h-12.5 w-full items-center justify-center gap-2 rounded-xl border border-[#087d35] bg-white px-5 text-[13px] font-extrabold text-[#087d35] transition-colors hover:bg-[#f0f9f2]"
                  >
                    Retour à la connexion
                    <ArrowRight size={17} />
                  </button>
                </div>
              ) : (
                <>
                  {/* ==================================
                      TITRE
                  ================================== */}

                  <div className="text-center">
                    <div
                      className="mx-auto flex size-18 items-center justify-center rounded-[20px] border border-[#d4ead9] bg-[#eaf8ed]"
                    >
                      <ShieldCheck
                        size={36}
                        strokeWidth={2}
                        className="text-[#087d35]"
                      />
                    </div>

                    <h1
                      className="mt-5 text-[25px] font-black tracking-tight text-[#15283b] sm:text-[29px]"
                    >
                      Connexion administrateur
                    </h1>

                    <p
                      className="mx-auto mt-2 max-w-82.5 text-[13px] leading-6 text-[#708092]"
                    >
                      Connectez-vous pour accéder
                      à l&apos;administration générale
                      de TIKEMIA.
                    </p>
                  </div>

                  {/* ==================================
                      MESSAGE D'ERREUR
                  ================================== */}

                  {error && (
                    <div
                      role="alert"
                      className="mt-6 flex items-start gap-2.5 rounded-xl border border-[#f0d1cc] bg-[#fff4f1] px-4 py-3"
                    >
                      <AlertCircle
                        size={18}
                        className="mt-0.5 shrink-0 text-[#c64b42]"
                      />

                      <p
                        className="text-[12px] leading-5 text-[#a5463c]"
                      >
                        {error}
                      </p>
                    </div>
                  )}

                  {/* ==================================
                      FORMULAIRE
                  ================================== */}

                  <form
                    onSubmit={(event) =>
                      void submitLogin(event)
                    }
                    noValidate
                    className="mt-8 space-y-5"
                  >
                    {/* EMAIL */}

                    <div>
                      <label
                        htmlFor="admin-email"
                        className="mb-2 block text-[12px] font-extrabold text-[#26394c]"
                      >
                        Adresse email
                      </label>

                      <div
                        className="relative flex items-center"
                      >
                        <Mail
                          size={19}
                          className="pointer-events-none absolute left-4 text-[#81909d]"
                        />

                        <input
                          ref={emailInputRef}
                          id="admin-email"
                          name="email"
                          type="email"
                          inputMode="email"
                          autoComplete="username"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          required
                          maxLength={254}
                          disabled={isSubmitting}
                          value={email}
                          onChange={(event) => {
                            setEmail(
                              event.target.value
                            );

                            setFieldErrors(
                              (previous) => ({
                                ...previous,
                                email: undefined,
                              })
                            );

                            setError(null);
                          }}
                          placeholder="Votre adresse email"
                          aria-invalid={
                            Boolean(
                              fieldErrors.email
                            )
                          }
                          aria-describedby={
                            fieldErrors.email
                              ? "admin-email-error"
                              : undefined
                          }
                          className={`
                            h-13.25
                            w-full
                            min-w-0
                            rounded-xl
                            border
                            bg-white
                            py-3
                            pl-12
                            pr-4
                            text-[14px]
                            text-[#172b40]
                            outline-none
                            transition-colors
                            placeholder:text-[#a2acb6]
                            focus:border-[#087d35]
                            focus:ring-2
                            focus:ring-[#087d35]/10
                            disabled:opacity-60
                            ${
                              fieldErrors.email
                                ? "border-[#d95a54]"
                                : "border-[#dce5df]"
                            }
                          `}
                        />
                      </div>

                      {fieldErrors.email && (
                        <p
                          id="admin-email-error"
                          className="mt-1.5 text-[11px] font-medium text-[#cb5148]"
                        >
                          {fieldErrors.email}
                        </p>
                      )}
                    </div>

                    {/* MOT DE PASSE */}
                    {!recovering && (<>

                    <div>
                      <label
                        htmlFor="admin-password"
                        className="mb-2 block text-[12px] font-extrabold text-[#26394c]"
                      >
                        Mot de passe
                      </label>

                      <div
                        className="relative flex items-center"
                      >
                        <KeyRound
                          size={19}
                          className="pointer-events-none absolute left-4 text-[#81909d]"
                        />

                        <input
                          id="admin-password"
                          name="password"
                          type={
                            showPassword
                              ? "text"
                              : "password"
                          }
                          autoComplete="current-password"
                          required
                          maxLength={1024}
                          disabled={isSubmitting}
                          value={password}
                          onChange={(event) => {
                            setPassword(
                              event.target.value
                            );

                            setFieldErrors(
                              (previous) => ({
                                ...previous,
                                password: undefined,
                              })
                            );

                            setError(null);
                          }}
                          placeholder="Votre mot de passe"
                          aria-invalid={
                            Boolean(
                              fieldErrors.password
                            )
                          }
                          aria-describedby={
                            fieldErrors.password
                              ? "admin-password-error"
                              : undefined
                          }
                          className={`
                            h-13.25
                            w-full
                            min-w-0
                            rounded-xl
                            border
                            bg-white
                            py-3
                            pl-12
                            pr-12
                            text-[14px]
                            text-[#172b40]
                            outline-none
                            transition-colors
                            placeholder:text-[#a2acb6]
                            focus:border-[#087d35]
                            focus:ring-2
                            focus:ring-[#087d35]/10
                            disabled:opacity-60
                            ${
                              fieldErrors.password
                                ? "border-[#d95a54]"
                                : "border-[#dce5df]"
                            }
                          `}
                        />

                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() =>
                            setShowPassword(
                              (previous) =>
                                !previous
                            )
                          }
                          aria-label={
                            showPassword
                              ? "Masquer le mot de passe"
                              : "Afficher le mot de passe"
                          }
                          aria-pressed={showPassword}
                          className="absolute right-2 flex size-10 items-center justify-center rounded-lg text-[#788898] transition-colors hover:bg-[#f2f6f3] hover:text-[#087d35] disabled:opacity-50"
                        >
                          {showPassword ? (
                            <EyeOff size={19} />
                          ) : (
                            <Eye size={19} />
                          )}
                        </button>
                      </div>

                      {fieldErrors.password && (
                        <p
                          id="admin-password-error"
                          className="mt-1.5 text-[11px] font-medium text-[#cb5148]"
                        >
                          {fieldErrors.password}
                        </p>
                      )}
                    </div>

                    </>)}
                    <button type="button" disabled={isSubmitting} onClick={() => { setRecovering(value => !value); setError(null); setFieldErrors({}); setPassword(""); }} className="text-xs font-bold text-[#087d35] hover:underline">{recovering ? "Retour a la connexion" : "Mot de passe oublié ?"}</button>
                    {recovering && <p className="text-sm text-[#64748b]">Recevez un lien par email pour choisir un nouveau mot de passe.</p>}
                    {/* CONNEXION */}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex min-h-13.25 w-full items-center justify-center gap-2.5 rounded-xl bg-[#087d35] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_6px_16px_rgba(8,125,53,0.16)] transition-colors hover:bg-[#066b2d] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#087d35] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSubmitting ? (
                        <>
                          <LoaderCircle
                            size={20}
                            className="animate-spin"
                          />

                          Vérification en cours...
                        </>
                      ) : (
                        <>
                          <LockKeyhole size={19} />

                          {recovering ? "Recevoir le lien" : "Se connecter"}

                          <ArrowRight size={19} />
                        </>
                      )}
                    </button>
                  </form>

                  {/* ==================================
                      CONFIRMATION EMAIL
                  ================================== */}

                  <div
                    className="mt-7 flex items-start gap-3 rounded-xl border border-[#e1eae4] bg-[#f8fbf9] px-4 py-3.5"
                  >
                    <MailCheck
                      size={21}
                      className="mt-0.5 shrink-0 text-[#087d35]"
                    />

                    <div className="min-w-0">
                      <p
                        className="text-[12px] font-extrabold text-[#26394b]"
                      >
                        Confirmation de sécurité
                      </p>

                      <p
                        className="mt-1 text-[11px] leading-5 text-[#758495]"
                      >
                        Après la vérification
                        de vos identifiants,
                        un lien de confirmation
                        sera envoyé par email.
                        Vous devrez le valider
                        pour accéder au
                        tableau de bord.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* ==================================
                  PIED DE CARTE
              ================================== */}

              <div
                className="mt-7 border-t border-[#edf1ee] pt-5"
              >
                <div
                  className="flex items-center justify-center gap-2 text-center"
                >
                  <ShieldCheck
                    size={16}
                    className="shrink-0 text-[#087d35]"
                  />

                  <p
                    className="text-[11px] font-semibold text-[#7c8996]"
                  >
                    Accès réservé à
                    l&apos;administration TIKEMIA
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ======================================
              INFORMATION EXTERNE
          ====================================== */}

          <div
            className="mt-5 flex items-start justify-center gap-2 px-3 text-center"
          >
            <CheckCircle2
              size={15}
              className="mt-0.5 shrink-0 text-[#087d35]"
            />

            <p
              className="max-w-91.25 text-[11px] leading-5 text-[#788898]"
            >
              Aucune inscription publique.
              L&apos;accès administrateur
              nécessite une autorisation
              préalable et une confirmation
              par email.
            </p>
          </div>
        </div>
      </main>

      {/* ==========================================
          FOOTER ADMINISTRATEUR

          Aucun menu de navigation.
      ========================================== */}

      <footer
        className="relative z-10 border-t border-[#e7eee9] bg-white/80 px-4 py-4 text-center"
      >
        <p
          className="text-[11px] text-[#8896a3]"
        >
          © TIKEMIA
          {" — "}
          Administration sécurisée
        </p>
      </footer>
    </div>
  );
}
