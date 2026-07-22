"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { FormEvent, useState } from "react";

type ForgotPasswordResponse = {
  success?: boolean;
  message?: string;
  redirectTo?: string;
};

export default function OrganizerForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Renseignez votre adresse e-mail.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        "/api/organizer/auth/forgot-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: cleanEmail,
          }),
        },
      );

      const result =
        (await response.json()) as ForgotPasswordResponse;

      if (!response.ok) {
        throw new Error(
          result.message ??
            "Impossible d’envoyer le code pour le moment.",
        );
      }

      sessionStorage.setItem(
        "tikemia_password_reset_email",
        cleanEmail,
      );

      router.push(
        result.redirectTo ??
          `/organizer/reset-password?email=${encodeURIComponent(
            cleanEmail,
          )}`,
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Une erreur est survenue. Réessayez.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030709] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-48 top-[20%] h-[540px] w-[540px] rounded-full bg-emerald-500/10 blur-[155px]" />

        <div className="absolute -right-52 top-[-130px] h-[640px] w-[640px] rounded-full bg-green-500/10 blur-[175px]" />

        <div className="absolute bottom-[-260px] right-[18%] h-[520px] w-[640px] rounded-full bg-orange-500/10 blur-[175px]" />

        <span className="absolute left-[11%] top-[24%] h-2.5 w-2.5 rounded-full bg-lime-400/70" />
        <span className="absolute right-[13%] top-[26%] h-2 w-2 rounded-full bg-orange-500/80" />
        <span className="absolute bottom-[17%] left-[39%] h-3 w-3 rounded-full bg-emerald-500/70" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="border-b border-white/[0.07] bg-[#030709]/80 backdrop-blur-xl">
          <div className="mx-auto flex h-[82px] w-full max-w-[1540px] items-center justify-between px-5 sm:px-8 lg:h-[94px] lg:px-12 xl:px-16">
            <Link
              href="/organizer"
              aria-label="Accueil Tikemia organisateur"
              className="flex items-center"
            >
              <Image
                src="/logo.png"
                alt="Tikemia"
                width={250}
                height={76}
                priority
                className="h-auto w-[175px] object-contain sm:w-[210px]"
              />
            </Link>

            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-lime-400" />

              <span className="hidden text-sm text-neutral-300 sm:inline">
                Réinitialisation sécurisée
              </span>
            </div>
          </div>
        </header>

        <section className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-[520px]">
            <Link
              href="/organizer/login"
              className="mb-6 inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à la connexion
            </Link>

            <div className="rounded-[28px] border border-white/[0.09] bg-[#081015]/95 p-6 shadow-[0_35px_90px_rgba(0,0,0,0.48)] backdrop-blur-xl sm:p-9">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
                <Mail className="h-8 w-8 text-lime-400" />
              </div>

              <div className="mt-6 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-lime-400">
                  Mot de passe oublié
                </p>

                <h1 className="mt-3 text-3xl font-black tracking-[-0.03em] sm:text-[38px]">
                  Récupérez votre compte
                </h1>

                <p className="mx-auto mt-4 max-w-[390px] text-sm leading-6 text-neutral-400">
                  Entrez l’adresse e-mail utilisée pour votre compte
                  organisateur.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-8">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-neutral-200"
                  >
                    Adresse e-mail
                    <span className="ml-1 text-orange-500">*</span>
                  </label>

                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />

                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);

                        if (error) {
                          setError("");
                        }
                      }}
                      autoComplete="email"
                      placeholder="nom@exemple.com"
                      disabled={isSubmitting}
                      className="h-14 w-full rounded-xl border border-white/10 bg-[#050b0f] pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-300"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white shadow-[0_18px_45px_rgba(34,197,94,0.18)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                >
                  {isSubmitting ? (
                    <>
                      <LoaderCircle className="h-5 w-5 animate-spin" />
                      Envoi du code...
                    </>
                  ) : (
                    <>
                      Recevoir mon code
                      <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
                    </>
                  )}
                </button>

                <div className="mt-7 border-t border-white/[0.07] pt-6 text-center">
                  <p className="text-sm text-neutral-400">
                    Vous connaissez votre mot de passe ?{" "}
                    <Link
                      href="/organizer/login"
                      className="font-bold text-lime-400 transition hover:text-lime-300"
                    >
                      Se connecter
                    </Link>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/[0.07] bg-[#030709]/90">
          <div className="mx-auto flex w-full max-w-[1540px] flex-col gap-3 px-5 py-5 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12 xl:px-16">
            <p>
              © {new Date().getFullYear()} Tikemia. Tous droits
              réservés.
            </p>

            <Link
              href="/support"
              className="transition hover:text-white"
            >
              Assistance
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}