"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { FormEvent, useState } from "react";

type LoginApiResponse = {
  success?: boolean;
  message?: string;
  redirectTo?: string;
};

export default function OrganizerLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

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

    if (!password) {
      setError("Renseignez votre mot de passe.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/organizer/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          rememberMe,
        }),
      });

      const result = (await response.json()) as LoginApiResponse;

      if (!response.ok) {
  if (result.redirectTo) {
    sessionStorage.setItem(
      "tikemia_verification_email",
      cleanEmail,
    );

    router.push(result.redirectTo);
    return;
  }

  throw new Error(
    result.message ?? "Impossible de vous connecter.",
  );
}

      router.replace(
        result.redirectTo ?? "/organizer/dashboard",
      );

      router.refresh();
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Impossible de vous connecter. Réessayez.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030709] text-white">
      {/* Décoration */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-56 top-[20%] h-[560px] w-[560px] rounded-full bg-emerald-500/10 blur-[155px]" />

        <div className="absolute -right-52 top-[-120px] h-[650px] w-[650px] rounded-full bg-green-500/10 blur-[175px]" />

        <div className="absolute bottom-[-260px] right-[18%] h-[520px] w-[650px] rounded-full bg-orange-500/10 blur-[175px]" />

        <span className="absolute left-[11%] top-[24%] h-2.5 w-2.5 rounded-full bg-lime-400/70" />
        <span className="absolute left-[45%] top-[13%] h-2 w-2 rounded-full bg-orange-500/80" />
        <span className="absolute right-[11%] top-[28%] h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="absolute bottom-[16%] left-[39%] h-3 w-3 rounded-full bg-emerald-500/70" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Header */}
        <header className="border-b border-white/[0.07] bg-[#030709]/80 backdrop-blur-xl">
          <div className="mx-auto flex h-[82px] w-full max-w-[1560px] items-center justify-between px-5 sm:px-8 lg:h-[94px] lg:px-12 xl:px-16">
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

            <div className="flex items-center gap-3 sm:gap-5">
              <div className="hidden items-center gap-2 text-sm text-neutral-300 md:flex">
                <ShieldCheck className="h-5 w-5 text-lime-400" />
                <span>Connexion sécurisée</span>
              </div>

              <Link
                href="/organizer/register"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-emerald-500/70 px-5 text-sm font-semibold transition hover:bg-emerald-500/10 sm:px-7"
              >
                Inscription
              </Link>
            </div>
          </div>
        </header>

        {/* Contenu principal */}
        <section className="flex flex-1">
          <div className="mx-auto grid w-full max-w-[1560px] flex-1 lg:grid-cols-[0.95fr_1.05fr]">
            {/* Partie visuelle PC */}
            <div className="relative hidden min-h-[720px] overflow-hidden border-r border-white/[0.07] lg:flex lg:flex-col lg:justify-between">
              <div className="relative z-10 px-12 pt-14 xl:px-16">
                <Link
                  href="/organizer"
                  className="inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour à l’espace organisateur
                </Link>

                <div className="mt-16 max-w-[550px]">
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-lime-400">
                    Espace organisateur
                  </p>

                  <h1 className="mt-5 text-[56px] font-black leading-[1.01] tracking-[-0.05em] xl:text-[68px]">
                    Retrouvez votre
                    <span className="block bg-gradient-to-r from-emerald-400 via-lime-400 to-orange-500 bg-clip-text text-transparent">
                      tableau de bord.
                    </span>
                  </h1>

                  <p className="mt-6 max-w-[500px] text-base leading-7 text-neutral-300 xl:text-lg">
                    Connectez-vous pour gérer vos événements, vos ventes et vos
                    revenus.
                  </p>

                  <div className="mt-9 grid gap-4 sm:grid-cols-2">
                    {[
                      "Événements",
                      "Ventes en temps réel",
                      "Billets sécurisés",
                      "Paiements",
                    ].map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-3 text-sm text-neutral-200"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10">
                          <Check className="h-3.5 w-3.5 text-lime-400" />
                        </span>

                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative mt-auto flex min-h-[350px] items-end justify-center px-7">
                <div className="absolute bottom-[15%] h-[260px] w-[72%] rounded-full bg-emerald-500/15 blur-[100px]" />

                <Image
                  src="/imagea.png"
                  alt="Tableau de bord organisateur Tikemia"
                  width={850}
                  height={600}
                  priority
                  className="relative z-10 h-auto w-full max-w-[760px] object-contain drop-shadow-[0_30px_55px_rgba(0,0,0,0.65)]"
                />
              </div>
            </div>

            {/* Formulaire */}
            <div className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-10 xl:px-16">
              <div className="w-full max-w-[590px]">
                <Link
                  href="/organizer"
                  className="mb-8 inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour
                </Link>

                <div className="rounded-[28px] border border-white/[0.09] bg-[#081015]/95 p-6 shadow-[0_35px_90px_rgba(0,0,0,0.46)] backdrop-blur-xl sm:p-9 xl:p-10">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-lime-400">
                      Connexion
                    </p>

                    <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] sm:text-[40px]">
                      Accédez à votre compte
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-neutral-400 sm:text-base">
                      Entrez vos identifiants organisateur.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                    {/* E-mail */}
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

                    {/* Mot de passe */}
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <label
                          htmlFor="password"
                          className="text-sm font-semibold text-neutral-200"
                        >
                          Mot de passe
                          <span className="ml-1 text-orange-500">*</span>
                        </label>

                        <Link
                          href="/organizer/forgot-password"
                          className="text-xs font-semibold text-lime-400 transition hover:text-lime-300 sm:text-sm"
                        >
                          Mot de passe oublié ?
                        </Link>
                      </div>

                      <div className="relative">
                        <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />

                        <input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(event) => {
                            setPassword(event.target.value);

                            if (error) {
                              setError("");
                            }
                          }}
                          autoComplete="current-password"
                          placeholder="Votre mot de passe"
                          disabled={isSubmitting}
                          className="h-14 w-full rounded-xl border border-white/10 bg-[#050b0f] pl-12 pr-14 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowPassword((current) => !current)
                          }
                          disabled={isSubmitting}
                          aria-label={
                            showPassword
                              ? "Masquer le mot de passe"
                              : "Afficher le mot de passe"
                          }
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Maintenir la session */}
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(event) =>
                          setRememberMe(event.target.checked)
                        }
                        disabled={isSubmitting}
                        className="peer sr-only"
                      />

                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/20 bg-[#050b0f] transition peer-checked:border-emerald-500 peer-checked:bg-emerald-500 peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
                        {rememberMe && (
                          <Check className="h-3.5 w-3.5 text-black" />
                        )}
                      </span>

                      <span className="text-sm text-neutral-400">
                        Rester connecté
                      </span>
                    </label>

                    {/* Erreur */}
                    {error && (
                      <div
                        role="alert"
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-300"
                      >
                        {error}
                      </div>
                    )}

                    {/* Connexion */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="group flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white shadow-[0_18px_45px_rgba(34,197,94,0.18)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
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

                    {/* Inscription */}
                    <div className="border-t border-white/[0.07] pt-6">
                      <p className="text-center text-sm text-neutral-400">
                        Vous n’avez pas encore de compte ?
                      </p>

                      <Link
                        href="/organizer/register"
                        className="mt-4 flex h-13 w-full items-center justify-center rounded-xl border border-emerald-500/60 bg-emerald-500/[0.04] px-6 text-sm font-bold text-white transition hover:bg-emerald-500/10"
                      >
                        Créer un compte organisateur
                      </Link>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/[0.07] bg-[#030709]/90">
          <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-3 px-5 py-5 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12 xl:px-16">
            <p>
              © {new Date().getFullYear()} Tikemia. Tous droits réservés.
            </p>

            <div className="flex items-center gap-5">
              <Link
                href="/support"
                className="transition hover:text-white"
              >
                Assistance
              </Link>

              <Link
                href="/privacy-policy"
                className="transition hover:text-white"
              >
                Confidentialité
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}