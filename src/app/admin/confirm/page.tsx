
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import Image from "next/image";
import Link from "next/link";

import { useRouter } from "next/navigation";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  LockKeyhole,
  MailCheck,
  ShieldCheck,
} from "lucide-react";

/*
  TIKEMIA — CONFIRMATION ADMINISTRATEUR

  Page : /admin/confirm

  - Français uniquement
  - Responsive PC / mobile
  - Aucun menu administrateur
  - Aucun formulaire d'inscription
  - Jeton reçu dans #token=...
  - Confirmation volontaire par clic
  - Validation par API serveur
  - Session créée côté serveur
  - Redirection vers /admin

  Compatible avec :
  /api/admin/auth/login
  /api/admin/auth/confirm
  /api/admin/dashboard
*/

const CONFIRM_API =
  "/api/admin/auth/confirm";

const LOGIN_URL =
  "/admin/login";

const DASHBOARD_URL =
  "/admin";

const TOKEN_REGEX =
  /^[a-f0-9]{64}$/i;

const REQUEST_TIMEOUT_MS =
  15_000;

type PageStatus =
  | "loading"
  | "ready"
  | "submitting"
  | "success"
  | "invalid"
  | "error";

type ConfirmResponse = {
  success?: boolean;
  code?: string;
  message?: string;
  redirectTo?: string;
  data?: {
    authenticated?: boolean;
  };
};

function getConfirmationToken():
  string | null {
  try {
    /*
      Le serveur a envoyé :

      /admin/confirm#token=...

      Le fragment # n'est pas
      transmis au serveur.
    */

    const fragment =
      window.location.hash.replace(
        /^#/,
        ""
      );

    const params =
      new URLSearchParams(fragment);

    const token =
      params.get("token");

    if (
      !token ||
      !TOKEN_REGEX.test(token)
    ) {
      return null;
    }

    return token.toLowerCase();
  } catch {
    return null;
  }
}

function removeTokenFromAddress() {
  /*
    Retire le jeton de la barre
    d'adresse pour éviter qu'il
    reste visible ou soit recopié.

    Le jeton est conservé
    temporairement en mémoire.
  */

  try {
    const cleanUrl =
      window.location.pathname +
      window.location.search;

    window.history.replaceState(
      window.history.state,
      "",
      cleanUrl
    );
  } catch {
    // Ne pas interrompre la page.
  }
}

function StatusIcon({
  status,
}: {
  status: PageStatus;
}) {
  if (
    status === "loading" ||
    status === "submitting"
  ) {
    return (
      <LoaderCircle
        size={34}
        strokeWidth={2.2}
        className="animate-spin text-[#087d35]"
      />
    );
  }

  if (status === "success") {
    return (
      <CheckCircle2
        size={38}
        strokeWidth={2.1}
        className="text-[#087d35]"
      />
    );
  }

  if (
    status === "invalid" ||
    status === "error"
  ) {
    return (
      <AlertCircle
        size={36}
        strokeWidth={2.1}
        className="text-[#d04c43]"
      />
    );
  }

  return (
    <MailCheck
      size={36}
      strokeWidth={2}
      className="text-[#087d35]"
    />
  );
}

function getStatusContent(
  status: PageStatus
) {
  switch (status) {
    case "loading":
      return {
        title: "Vérification du lien",
        description:
          "Préparation de votre confirmation de connexion.",
      };

    case "ready":
      return {
        title: "Confirmez votre connexion",
        description:
          "Votre lien de confirmation est prêt. Cliquez sur le bouton ci-dessous pour accéder à l'administration TIKEMIA.",
      };

    case "submitting":
      return {
        title: "Confirmation en cours",
        description:
          "Nous vérifions votre lien et préparons votre session administrateur sécurisée.",
      };

    case "success":
      return {
        title: "Connexion confirmée",
        description:
          "Votre identité a été vérifiée. Vous allez accéder au tableau de bord administrateur.",
      };

    case "invalid":
      return {
        title: "Lien non valide",
        description:
          "Ce lien de confirmation est absent, invalide, expiré ou déjà utilisé. Effectuez une nouvelle demande de connexion.",
      };

    case "error":
      return {
        title: "Confirmation impossible",
        description:
          "Une erreur est survenue pendant la vérification. Veuillez réessayer ou demander un nouveau lien.",
      };
  }
}

export default function AdminConfirmPage() {
  const router = useRouter();

  const tokenRef =
    useRef<string | null>(null);

  const requestRef =
    useRef<AbortController | null>(
      null
    );

  const submittingRef =
    useRef(false);

  const [status, setStatus] =
    useState<PageStatus>("loading");

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const recoveryRef = useRef(false);
  const [recovery, setRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [logoFailed, setLogoFailed] =
    useState(false);

  /* ==========================================
     INITIALISATION

     Lecture du jeton transmis
     dans le lien email.

     Aucun appel automatique à
     l'API de confirmation.
  ========================================== */

  useEffect(() => {
    const token = getConfirmationToken();
    if (token) recoveryRef.current = new URLSearchParams(window.location.hash.slice(1)).get("mode") === "reset";
    if (token) { tokenRef.current = token; removeTokenFromAddress(); }
    const timer = window.setTimeout(() => { setRecovery(recoveryRef.current); setStatus(tokenRef.current ? "ready" : "invalid"); }, 0);
    return () => { window.clearTimeout(timer); requestRef.current?.abort(); };
  }, []);

  /* ==========================================
     CONFIRMATION DE CONNEXION

     Le jeton est transmis
     uniquement au serveur.

     Le navigateur ne crée
     jamais lui-même la session.
  ========================================== */

  const confirmLogin =
    useCallback(async () => {
      if (
        submittingRef.current ||
        status !== "ready"
      ) {
        return;
      }

      const token =
        tokenRef.current;

      if (
        !token ||
        !TOKEN_REGEX.test(token)
      ) {
        setStatus("invalid");
        return;
      }

      if (recovery && (Array.from(newPassword).length < 12 || new TextEncoder().encode(newPassword).length > 72 || newPassword !== confirmPassword)) {
        setErrorMessage("Choisissez un mot de passe de 12 caracteres minimum et de 72 octets maximum, puis confirmez-le."); return;
      }
      submittingRef.current = true;

      setStatus("submitting");
      setErrorMessage(null);

      const controller =
        new AbortController();

      requestRef.current = controller;

      const timeout =
        window.setTimeout(
          () => controller.abort(),
          REQUEST_TIMEOUT_MS
        );

      try {
        const response =
          await fetch(CONFIRM_API, {
            method: "POST",

            credentials:
              "same-origin",

            cache: "no-store",

            signal:
              controller.signal,

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body: JSON.stringify({
              token,
              action: recovery ? "reset" : "confirm",
              ...(recovery ? { password: newPassword, confirmPassword } : {}),
            }),
          });

        let result:
          ConfirmResponse | null = null;

        try {
          result =
            (await response.json()) as
              ConfirmResponse;
        } catch {
          result = null;
        }

        if (!response.ok) {
          const invalidCodes = [
            "LIEN_INVALIDE",
            "LIEN_DEJA_UTILISE",
            "ACCES_NON_AUTORISE",
          ];

          if (
            result?.code &&
            invalidCodes.includes(
              result.code
            )
          ) {
            tokenRef.current = null;

            setStatus("invalid");
            setErrorMessage(
              result.message ?? null
            );

            return;
          }

          throw new Error(
            result?.message ||
              "La confirmation n'a pas pu être effectuée."
          );
        }

        if (
          result?.success !== true ||
          result?.data?.authenticated !==
            true
        ) {
          throw new Error(
            "La confirmation de la session n'a pas été validée."
          );
        }

        /*
          La session est maintenant
          créée côté serveur.

          Son cookie HttpOnly
          est géré automatiquement.
        */

        tokenRef.current = null;

        setStatus("success");

        /*
          Destination fixe :
          ne jamais utiliser une URL
          arbitraire renvoyée par
          un paramètre du navigateur.
        */

        router.replace(
          DASHBOARD_URL
        );

        router.refresh();
      } catch (error) {
        if (
          controller.signal.aborted
        ) {
          setErrorMessage(
            "Le délai de confirmation est dépassé. Vérifiez votre connexion et réessayez."
          );
        } else {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Une erreur est survenue. Veuillez réessayer."
          );
        }

        /*
          Une erreur réseau peut survenir
          alors que le serveur a déjà
          consommé le jeton.

          Si la tentative suivante indique
          un lien utilisé, il faudra
          ouvrir une nouvelle session
          depuis /admin/login.
        */

        setStatus("error");
      } finally {
        window.clearTimeout(
          timeout
        );

        submittingRef.current = false;

        requestRef.current = null;
      }
    }, [router, status, recovery, newPassword, confirmPassword]);

  /* ==========================================
     NOUVELLE TENTATIVE

     Réutilise uniquement le jeton
     encore présent en mémoire.
  ========================================== */

  function retryConfirmation() {
    if (!tokenRef.current) {
      setStatus("invalid");
      return;
    }

    setErrorMessage(null);
    setStatus("ready");
  }

  const content =
    recovery && status === "ready" ? { title: "Nouveau mot de passe", description: "Choisissez et confirmez votre nouveau mot de passe administrateur." } : getStatusContent(status);

  const isBusy =
    status === "loading" ||
    status === "submitting";

  const isInvalid =
    status === "invalid";

  const isError =
    status === "error";

  return (
    <div
      lang="fr"
      className="relative flex min-h-dvh w-full flex-col overflow-x-hidden bg-[#f6f9f7] text-[#15273a]"
    >
      {/* =====================================
          FOND DISCRET
      ===================================== */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 size-65 rounded-full bg-[#e5f6e8] blur-3xl sm:size-95"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-20 size-65 rounded-full bg-[#e8f0fa] blur-3xl sm:size-95"
      />

      {/* =====================================
          EN-TÊTE PUBLIC DE CONFIRMATION

          Aucun menu administrateur.
          Aucun changement de langue.
      ===================================== */}

      <header className="relative z-10 w-full border-b border-[#e6ede8] bg-white/95">
        <div className="mx-auto flex h-18 w-full max-w-295 items-center justify-between gap-3 px-4 sm:h-20.5 sm:px-8">
          <Link
            href={LOGIN_URL}
            aria-label="TIKEMIA — Retour à la connexion"
            className="flex shrink-0 items-center"
          >
            {!logoFailed ? (
              <Image
                src="/logo/logo.png"
                alt="TIKEMIA"
                width={175}
                height={55}
                priority
                onError={() =>
                  setLogoFailed(true)
                }
                className="h-10 w-auto max-w-40 object-contain sm:h-12 sm:max-w-43.75"
              />
            ) : (
              <span className="text-[23px] font-black tracking-tight text-[#087d35]">
                TIKEMIA
              </span>
            )}
          </Link>

          <div className="flex items-center gap-2 rounded-full border border-[#dcebe0] bg-[#f0f9f2] px-3 py-2 text-[#087d35] sm:px-4">
            <ShieldCheck
              size={17}
              className="shrink-0"
            />

            <span className="text-[11px] font-extrabold sm:text-[12px]">
              Accès administrateur
            </span>
          </div>
        </div>
      </header>

      {/* =====================================
          CONTENU PRINCIPAL
      ===================================== */}

      <main className="relative z-10 flex w-full flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <div className="w-full max-w-120">
          <div
            className="overflow-hidden rounded-[22px] border border-[#e0e9e3] bg-white shadow-[0_16px_50px_rgba(11,39,29,0.07)] sm:rounded-[26px]"
          >
            {/* ACCENT SUPÉRIEUR */}

            <div className="h-1.25 w-full bg-[#087d35]" />

            <div className="px-5 pb-7 pt-8 sm:px-9 sm:pb-9 sm:pt-10">
              {/* ICÔNE */}

              <div className="mb-5 flex justify-center">
                <div
                  className={`
                    flex
                    size-19.5
                    items-center
                    justify-center
                    rounded-[22px]
                    border
                    ${
                      isInvalid || isError
                        ? "border-[#f2d3d0] bg-[#fff1ef]"
                        : "border-[#d4ead9] bg-[#eaf8ed]"
                    }
                  `}
                >
                  <StatusIcon
                    status={status}
                  />
                </div>
              </div>

              {/* TITRES */}

              <div
                className="text-center"
                aria-live="polite"
              >
                <h1 className="text-[23px] font-black tracking-tight text-[#13263a] sm:text-[27px]">
                  {content.title}
                </h1>

                <p className="mx-auto mt-3 max-w-88.75 text-[13px] leading-6 text-[#6b7c8d] sm:text-[14px]">
                  {content.description}
                </p>
              </div>

              {/* MESSAGE D'ERREUR */}

              {errorMessage &&
                status !== "success" && (
                  <div
                    role="alert"
                    className="mt-6 flex items-start gap-2.5 rounded-xl border border-[#f0d2cd] bg-[#fff5f2] px-4 py-3 text-left"
                  >
                    <AlertCircle
                      size={18}
                      className="mt-0.5 shrink-0 text-[#c84c42]"
                    />

                    <p className="text-[12px] leading-5 text-[#9f443b]">
                      {errorMessage}
                    </p>
                  </div>
                )}

              {/* =================================
                  INFORMATION DU LIEN
              ================================= */}

              {status === "ready" && (
                <div className="mt-7 flex items-start gap-3 rounded-xl border border-[#e4ece6] bg-[#f8fbf9] px-4 py-3.5">
                  <Clock3
                    size={19}
                    className="mt-0.5 shrink-0 text-[#087d35]"
                  />

                  <div className="min-w-0">
                    <p className="text-[12px] font-extrabold text-[#263b4a]">
                      Lien temporaire sécurisé
                    </p>

                    <p className="mt-1 text-[11px] leading-5 text-[#738294]">
                      Valable 10 minutes après son émission et utilisable une seule fois.
                    </p>
                  </div>
                </div>
              )}

              {/* =================================
                  ACTION PRINCIPALE
              ================================= */}

              <div className="mt-7">
                {recovery && status === "ready" && <div className="mb-4 space-y-3 text-left"><label className="block text-sm font-bold">Nouveau mot de passe<input type="password" autoComplete="new-password" value={newPassword} onChange={event=>setNewPassword(event.target.value)} minLength={12} className="mt-1 w-full rounded-xl border border-[#dce5df] p-3"/></label><label className="block text-sm font-bold">Confirmer le mot de passe<input type="password" autoComplete="new-password" value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} minLength={12} className="mt-1 w-full rounded-xl border border-[#dce5df] p-3"/></label><p className="text-xs text-[#64748b]">12 caractères minimum.</p></div>}
                {(status === "ready" ||
                  status === "submitting") && (
                  <button
                    type="button"
                    onClick={() =>
                      void confirmLogin()
                    }
                    disabled={
                      status !== "ready"
                    }
                    className="flex min-h-13 w-full items-center justify-center gap-2.5 rounded-xl bg-[#087d35] px-5 py-3 text-[14px] font-extrabold text-white shadow-[0_5px_15px_rgba(8,125,53,0.14)] transition-colors hover:bg-[#066a2c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#087d35] disabled:cursor-not-allowed disabled:opacity-75"
                  >
                    {status === "submitting" ? (
                      <>
                        <LoaderCircle
                          size={20}
                          className="animate-spin"
                        />
                        Vérification en cours...
                      </>
                    ) : (
                      <>
                        <ShieldCheck
                          size={20}
                        />
                        {recovery ? "Enregistrer et se connecter" : "Confirmer ma connexion"}
                        <ArrowRight
                          size={18}
                        />
                      </>
                    )}
                  </button>
                )}

                {status === "success" && (
                  <div
                    role="status"
                    className="flex min-h-13 items-center justify-center gap-2 rounded-xl bg-[#e8f8ed] px-4 text-[13px] font-extrabold text-[#087d35]"
                  >
                    <CheckCircle2
                      size={20}
                    />
                    Accès autorisé
                  </div>
                )}

                {isError && (
                  <button
                    type="button"
                    onClick={
                      retryConfirmation
                    }
                    className="flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#087d35] px-5 text-[13px] font-extrabold text-white hover:bg-[#066a2c]"
                  >
                    Réessayer la confirmation
                    <ArrowRight
                      size={18}
                    />
                  </button>
                )}

                {isInvalid && (
                  <Link
                    href={LOGIN_URL}
                    className="flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#087d35] px-5 text-[13px] font-extrabold text-white hover:bg-[#066a2c]"
                  >
                    Demander un nouveau lien
                    <ArrowRight
                      size={18}
                    />
                  </Link>
                )}
              </div>

              {/* =================================
                  LIEN SECONDAIRE
              ================================= */}

              {!isBusy &&
                status !== "success" && (
                  <div className="mt-5 text-center">
                    <Link
                      href={LOGIN_URL}
                      className="inline-flex min-h-10 items-center justify-center gap-2 text-[12px] font-bold text-[#617286] transition-colors hover:text-[#087d35]"
                    >
                      <ArrowLeft
                        size={16}
                      />
                      Retour à la connexion
                    </Link>
                  </div>
                )}

              {/* =================================
                  SÉCURITÉ
              ================================= */}

              <div className="mt-6 border-t border-[#edf1ee] pt-5">
                <div className="flex items-center justify-center gap-2 text-center">
                  <LockKeyhole
                    size={15}
                    className="shrink-0 text-[#087d35]"
                  />

                  <p className="text-[11px] font-semibold text-[#788797]">
                    Espace réservé à l&apos;administration TIKEMIA
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* TEXTE SOUS LA CARTE */}

          <div className="mt-5 flex items-start justify-center gap-2 px-4 text-center">
            <ShieldCheck
              size={15}
              className="mt-0.5 shrink-0 text-[#087d35]"
            />

            <p className="max-w-97.5 text-[11px] leading-5 text-[#718294]">
              La connexion est autorisée uniquement après validation du lien de confirmation.
            </p>
          </div>
        </div>
      </main>

      {/* =====================================
          FOOTER SIMPLE

          Aucun menu de navigation
          public ou organisateur.
      ===================================== */}

      <footer className="relative z-10 border-t border-[#e7eee9] bg-white/80 px-4 py-4 text-center">
        <p className="text-[11px] text-[#8a98a5]">
          © TIKEMIA — Administration sécurisée
        </p>
      </footer>
    </div>
  );
}
