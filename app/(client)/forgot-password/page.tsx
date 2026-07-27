"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  KeyRound,
  LoaderCircle,
  Mail,
  MailCheck,
  ShieldCheck,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ForgotPasswordResponse = {
  success?: boolean;
  message?: string;
  redirectTo?: string;
  expiresInMinutes?: number;
};

export default function ClientForgotPasswordPage() {
  const router =
    useRouter();

  const [
    email,
    setEmail,
  ] =
    useState("");

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

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      isSubmitting
    ) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    const normalizedEmail =
      email
        .trim()
        .toLowerCase();

    if (
      !normalizedEmail
    ) {
      setErrorMessage(
        "Renseignez votre adresse e-mail.",
      );

      return;
    }

    setIsSubmitting(
      true,
    );

    try {
      const response =
        await fetch(
          "/api/client/auth/forgot-password",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                email:
                  normalizedEmail,
              }),
          },
        );

      const result =
        (await response.json()) as ForgotPasswordResponse;

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.message ??
            "Impossible de traiter votre demande.",
        );
      }

      sessionStorage.setItem(
        "tikemia_client_password_reset_email",
        normalizedEmail,
      );

      setSuccessMessage(
        result.message ??
          "Un code de réinitialisation vous a été envoyé.",
      );

      window.setTimeout(
        () => {
          router.push(
            result.redirectTo ??
              `/reset-password?email=${encodeURIComponent(
                normalizedEmail,
              )}`,
          );
        },
        700,
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
    } finally {
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
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />

                Retour à la connexion
              </Link>

              <div className="mt-14 max-w-[560px]">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-lime-400">
                  Récupération du compte
                </p>

                <h1 className="mt-5 text-[50px] font-black leading-[1.02] tracking-[-0.045em] xl:text-[64px]">
                  Réinitialisez votre
                  <span className="block bg-gradient-to-r from-emerald-400 via-lime-400 to-orange-500 bg-clip-text text-transparent">
                    mot de passe.
                  </span>
                </h1>

                <p className="mt-6 max-w-[520px] text-base leading-7 text-neutral-400 xl:text-lg">
                  Entrez l’adresse e-mail liée à votre compte Tikemia. Vous recevrez un code sécurisé pour créer un nouveau mot de passe.
                </p>

                <div className="mt-9 space-y-4">
                  {[
                    "Code sécurisé à 6 chiffres",
                    "Validité limitée à 10 minutes",
                    "Nouveau mot de passe protégé",
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
                      <MailCheck className="h-5 w-5" />
                    </span>

                    <p className="mt-4 text-lg font-black text-white">
                      Code par e-mail
                    </p>

                    <p className="mt-2 text-sm leading-6 text-neutral-500">
                      Le code sera envoyé à l’adresse liée à votre compte.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/[0.07] bg-[#081015]/80 p-5">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-orange-400/20 bg-orange-400/[0.08] text-orange-300">
                      <ShieldCheck className="h-5 w-5" />
                    </span>

                    <p className="mt-4 text-lg font-black text-white">
                      Réinitialisation sécurisée
                    </p>

                    <p className="mt-2 text-sm leading-6 text-neutral-500">
                      Votre ancien mot de passe ne sera jamais affiché.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center px-4 py-8 sm:px-6 sm:py-10 lg:px-10 xl:px-14">
            <div className="w-full max-w-[620px]">
              <Link
                href="/login"
                className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-neutral-500 transition hover:text-white lg:hidden"
              >
                <ArrowLeft className="h-4 w-4" />

                Retour à la connexion
              </Link>

              <div className="rounded-[26px] border border-white/[0.09] bg-[#081015]/95 p-5 shadow-[0_35px_90px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-8 xl:p-10">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
                  <KeyRound className="h-7 w-7" />
                </span>

                <p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-lime-400">
                  Mot de passe oublié
                </p>

                <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-white sm:text-[38px]">
                  Récupérez votre compte
                </h2>

                <p className="mt-3 text-sm leading-6 text-neutral-400 sm:text-base">
                  Entrez votre adresse e-mail pour recevoir un code de réinitialisation.
                </p>

                <form
                  onSubmit={
                    handleSubmit
                  }
                  className="mt-8 space-y-5"
                  noValidate
                >
                  <div>
                    <label
                      htmlFor="client-forgot-password-email"
                      className="mb-2 block text-sm font-semibold text-neutral-200"
                    >
                      Adresse e-mail

                      <span className="ml-1 text-orange-500">
                        *
                      </span>
                    </label>

                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-600" />

                      <input
                        id="client-forgot-password-email"
                        type="email"
                        value={
                          email
                        }
                        onChange={(
                          event,
                        ) => {
                          setEmail(
                            event.target
                              .value,
                          );

                          if (
                            errorMessage
                          ) {
                            setErrorMessage(
                              "",
                            );
                          }

                          if (
                            successMessage
                          ) {
                            setSuccessMessage(
                              "",
                            );
                          }
                        }}
                        autoComplete="email"
                        placeholder="nom@exemple.com"
                        disabled={
                          isSubmitting
                        }
                        className="h-14 w-full rounded-xl border border-white/10 bg-[#050b0f] pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>
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

                  {successMessage && (
                    <div
                      role="status"
                      className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3 text-sm leading-6 text-emerald-300"
                    >
                      <MailCheck className="mt-0.5 h-5 w-5 shrink-0" />

                      <span>
                        {
                          successMessage
                        }
                      </span>
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

                        Envoi du code...
                      </>
                    ) : (
                      <>
                        Recevoir le code

                        <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                      </>
                    )}
                  </button>

                  <div className="border-t border-white/[0.07] pt-5 text-center">
                    <p className="text-sm text-neutral-500">
                      Vous vous souvenez de votre mot de passe ?{" "}
                      <Link
                        href="/login"
                        className="font-black text-lime-400 transition hover:text-lime-300"
                      >
                        Se connecter
                      </Link>
                    </p>

                    <p className="mt-3 text-sm text-neutral-600">
                      Vous n’avez pas encore de compte ?{" "}
                      <Link
                        href="/register"
                        className="font-black text-white transition hover:text-lime-300"
                      >
                        Créer un compte
                      </Link>
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}