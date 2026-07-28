"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  TicketCheck,
} from "lucide-react";
import {
  FormEvent,
  useMemo,
  useState,
} from "react";
import {
  useSearchParams,
} from "next/navigation";

type LoginResponse = {
  success?: boolean;
  message?: string;
  redirectTo?: string;
};

type LoginFormData = {
  email: string;
  password: string;
  rememberMe: boolean;
};

const initialForm: LoginFormData = {
  email: "",
  password: "",
  rememberMe: false,
};

const BLOCKED_REDIRECT_PATHS = [
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
] as const;

function normalizeRedirectPath(
  value: string | null,
): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/account/tickets";
  }

  const pathWithoutHash =
    value.split("#")[0] ?? value;

  const pathWithoutQuery =
    pathWithoutHash.split("?")[0] ??
    pathWithoutHash;

  const blocked =
    BLOCKED_REDIRECT_PATHS.some(
      (
        blockedPath,
      ) =>
        pathWithoutQuery ===
          blockedPath ||
        pathWithoutQuery.startsWith(
          `${blockedPath}/`,
        ),
    );

  if (blocked) {
    return "/account/tickets";
  }

  return value;
}

export default function ClientLoginPage() {
  const searchParams =
    useSearchParams();

  const [
    form,
    setForm,
  ] =
    useState<LoginFormData>(
      initialForm,
    );

  const [
    showPassword,
    setShowPassword,
  ] =
    useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const redirectPath =
    useMemo(
      () =>
        normalizeRedirectPath(
          searchParams.get(
            "redirect",
          ),
        ),
      [
        searchParams,
      ],
    );

  function updateField<
    Key extends keyof LoginFormData,
  >(
    field: Key,
    value: LoginFormData[Key],
  ) {
    setForm(
      (
        current,
      ) => ({
        ...current,
        [field]:
          value,
      }),
    );

    if (
      errorMessage
    ) {
      setErrorMessage(
        "",
      );
    }
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      isSubmitting
    ) {
      return;
    }

    setErrorMessage(
      "",
    );

    const email =
      form.email
        .trim()
        .toLowerCase();

    if (
      !email
    ) {
      setErrorMessage(
        "Renseignez votre adresse e-mail.",
      );

      return;
    }

    if (
      !form.password
    ) {
      setErrorMessage(
        "Renseignez votre mot de passe.",
      );

      return;
    }

    setIsSubmitting(
      true,
    );

    try {
      const response =
        await fetch(
          "/api/client/auth/login",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            credentials:
              "include",

            cache:
              "no-store",

            body:
              JSON.stringify({
                email,

                password:
                  form.password,

                rememberMe:
                  form.rememberMe,

                redirectTo:
                  redirectPath,
              }),
          },
        );

      const result =
        (await response.json()) as LoginResponse;

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ??
            "Impossible de vous connecter.",
        );
      }

      const finalRedirect =
        normalizeRedirectPath(
          result.redirectTo ??
            redirectPath,
        );

      /*
       * Une navigation complète est volontairement utilisée après la
       * connexion. Elle force Next.js à reconstruire le layout côté serveur
       * avec le nouveau cookie de session.
       *
       * Ainsi, le header et la barre mobile affichent immédiatement :
       * - Mon profil ;
       * - Mes billets ;
       * - Mes commandes ;
       * - Mes favoris ;
       * - Déconnexion.
       */
      window.location.assign(
        finalRedirect,
      );
    } catch (
      error
    ) {
      setErrorMessage(
        error instanceof
          Error
          ? error.message
          : "Une erreur est survenue. Réessayez.",
      );

      setIsSubmitting(
        false,
      );
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#03070a] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-60 top-1/4 h-[560px] w-[560px] rounded-full bg-emerald-500/[0.08] blur-[150px]" />

        <div className="absolute -right-52 top-[-120px] h-[620px] w-[620px] rounded-full bg-lime-500/[0.07] blur-[170px]" />

        <div className="absolute bottom-[-220px] left-[42%] h-[520px] w-[620px] rounded-full bg-orange-500/[0.07] blur-[170px]" />
      </div>

      <section className="relative z-10 flex min-h-screen">
        <div className="mx-auto grid w-full max-w-[1600px] flex-1 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="relative hidden min-h-[720px] overflow-hidden border-r border-white/[0.07] lg:flex lg:flex-col lg:justify-between">
            <div className="relative z-10 px-10 pb-6 pt-12 xl:px-14 xl:pt-16">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />

                Retour aux événements
              </Link>

              <div className="mt-14 max-w-[560px]">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-lime-400">
                  Compte client Tikemia
                </p>

                <h1 className="mt-5 text-[50px] font-black leading-[1.02] tracking-[-0.045em] xl:text-[64px]">
                  Retrouvez vos billets,
                  <span className="block bg-gradient-to-r from-emerald-400 via-lime-400 to-orange-500 bg-clip-text text-transparent">
                    simplement.
                  </span>
                </h1>

                <p className="mt-6 max-w-[520px] text-base leading-7 text-neutral-400 xl:text-lg">
                  Connectez-vous pour accéder à vos billets, suivre vos commandes et retrouver vos événements.
                </p>

                <div className="mt-9 space-y-4">
                  {[
                    "Accès à tous vos billets",
                    "Historique de vos commandes",
                    "Compte sécurisé",
                  ].map(
                    (
                      item,
                    ) => (
                      <div
                        key={
                          item
                        }
                        className="flex items-center gap-3 text-sm font-medium text-neutral-300"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/[0.08]">
                          <Check className="h-3.5 w-3.5 text-lime-400" />
                        </span>

                        <span>
                          {
                            item
                          }
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>

            <div className="relative mt-auto flex min-h-[300px] items-end justify-center px-8 pb-12">
              <div className="absolute bottom-[12%] h-[220px] w-[70%] rounded-full bg-emerald-500/[0.13] blur-[95px]" />

              <div className="relative z-10 w-full max-w-[650px] rounded-[30px] border border-white/[0.08] bg-white/[0.035] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.4)] backdrop-blur-xl">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/[0.07] bg-[#081015]/80 p-5">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
                      <TicketCheck className="h-5 w-5" />
                    </span>

                    <p className="mt-4 text-lg font-black text-white">
                      Mes billets
                    </p>

                    <p className="mt-2 text-sm leading-6 text-neutral-500">
                      Consultez tous vos billets achetés sur Tikemia.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/[0.07] bg-[#081015]/80 p-5">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-orange-400/20 bg-orange-400/[0.08] text-orange-300">
                      <ShieldCheck className="h-5 w-5" />
                    </span>

                    <p className="mt-4 text-lg font-black text-white">
                      Connexion sécurisée
                    </p>

                    <p className="mt-2 text-sm leading-6 text-neutral-500">
                      Votre compte et vos informations restent protégés.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center px-4 py-8 sm:px-6 sm:py-10 lg:px-10 xl:px-14">
            <div className="w-full max-w-[620px]">
              <Link
                href="/"
                className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 transition hover:text-white lg:hidden"
              >
                <ArrowLeft className="h-4 w-4" />

                Retour aux événements
              </Link>

              <div className="rounded-[26px] border border-white/[0.09] bg-[#081015]/95 p-5 shadow-[0_35px_90px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-8 xl:p-10">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-lime-400">
                    Connexion client
                  </p>

                  <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-white sm:text-[38px]">
                    Heureux de vous revoir
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-neutral-400 sm:text-base">
                    Connectez-vous pour accéder à vos billets et à vos commandes.
                  </p>
                </div>

                <form
                  onSubmit={
                    handleSubmit
                  }
                  className="mt-8 space-y-5"
                  noValidate
                >
                  <Field
                    label="Adresse e-mail"
                    htmlFor="client-login-email"
                  >
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-600" />

                      <input
                        id="client-login-email"
                        type="email"
                        value={
                          form.email
                        }
                        onChange={(
                          event,
                        ) =>
                          updateField(
                            "email",
                            event
                              .target
                              .value,
                          )
                        }
                        autoComplete="email"
                        placeholder="nom@exemple.com"
                        disabled={
                          isSubmitting
                        }
                        className="h-14 w-full rounded-xl border border-white/10 bg-[#050b0f] pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>
                  </Field>

                  <Field
                    label="Mot de passe"
                    htmlFor="client-login-password"
                  >
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-600" />

                      <input
                        id="client-login-password"
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        value={
                          form.password
                        }
                        onChange={(
                          event,
                        ) =>
                          updateField(
                            "password",
                            event
                              .target
                              .value,
                          )
                        }
                        autoComplete="current-password"
                        placeholder="Votre mot de passe"
                        disabled={
                          isSubmitting
                        }
                        className="h-14 w-full rounded-xl border border-white/10 bg-[#050b0f] pl-12 pr-14 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword(
                            (
                              current,
                            ) =>
                              !current,
                          )
                        }
                        disabled={
                          isSubmitting
                        }
                        aria-label={
                          showPassword
                            ? "Masquer le mot de passe"
                            : "Afficher le mot de passe"
                        }
                        className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-neutral-600 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </Field>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex cursor-pointer items-center gap-3 text-sm text-neutral-400">
                      <input
                        type="checkbox"
                        checked={
                          form.rememberMe
                        }
                        onChange={(
                          event,
                        ) =>
                          updateField(
                            "rememberMe",
                            event
                              .target
                              .checked,
                          )
                        }
                        disabled={
                          isSubmitting
                        }
                        className="peer sr-only"
                      />

                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/20 bg-[#050b0f] transition peer-checked:border-emerald-500 peer-checked:bg-emerald-500">
                        {form.rememberMe && (
                          <Check className="h-3.5 w-3.5 text-black" />
                        )}
                      </span>

                      Garder ma session ouverte
                    </label>

                    <Link
                      href="/forgot-password"
                      className="text-sm font-black text-lime-400 transition hover:text-lime-300"
                    >
                      Mot de passe oublié ?
                    </Link>
                  </div>

                  {errorMessage && (
                    <div
                      role="alert"
                      className="rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-sm leading-6 text-red-300"
                    >
                      {
                        errorMessage
                      }
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={
                      isSubmitting
                    }
                    className="group flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white shadow-[0_18px_45px_rgba(34,197,94,0.16)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                  >
                    {isSubmitting ? (
                      <>
                        <LoaderCircle className="h-5 w-5 animate-spin" />

                        Connexion...
                      </>
                    ) : (
                      <>
                        Se connecter

                        <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                      </>
                    )}
                  </button>

                  <p className="text-center text-sm text-neutral-500">
                    Vous n’avez pas encore de compte ?{" "}
                    <Link
                      href="/register"
                      className="font-black text-lime-400 transition hover:text-lime-300"
                    >
                      Créer un compte
                    </Link>
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

type FieldProps = {
  label: string;
  htmlFor: string;
  children:
    React.ReactNode;
};

function Field({
  label,
  htmlFor,
  children,
}: FieldProps) {
  return (
    <div>
      <label
        htmlFor={
          htmlFor
        }
        className="mb-2 block text-sm font-semibold text-neutral-200"
      >
        {
          label
        }

        <span className="ml-1 text-orange-500">
          *
        </span>
      </label>

      {
        children
      }
    </div>
  );
}