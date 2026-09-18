import Link from "next/link";

import {
  ArrowLeft,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

export default function PasswordSettingsPage() {
  return (
    <main className="min-h-[calc(100vh-140px)] bg-[#020609] px-4 py-7 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/account/profile"
          className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-400 transition hover:text-white"
        >
          <ArrowLeft
            className="h-4 w-4"
            aria-hidden="true"
          />

          Retour au profil
        </Link>

        <section className="mt-5 overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#071014] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="h-px bg-gradient-to-r from-transparent via-lime-400/70 to-transparent" />

          <div className="p-5 sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.07] text-lime-300">
              <LockKeyhole
                className="h-5 w-5"
                aria-hidden="true"
              />
            </div>

            <p className="mt-6 text-[11px] font-black uppercase tracking-[0.18em] text-lime-400">
              Sécurité
            </p>

            <h1 className="mt-2 text-2xl font-black sm:text-3xl">
              Mot de passe
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
              Gérez la sécurité du mot de passe
              associé à votre compte Tikemia.
            </p>

            <div className="mt-7 rounded-[22px] border border-white/[0.08] bg-white/[0.025] p-5">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035] text-lime-300">
                  <ShieldCheck
                    className="h-5 w-5"
                    aria-hidden="true"
                  />
                </span>

                <div>
                  <h2 className="text-sm font-black text-white">
                    Sécurité du compte
                  </h2>

                  <p className="mt-2 text-xs leading-5 text-neutral-500">
                    Le changement de mot de passe doit
                    être connecté à la route
                    d&apos;authentification existante de
                    Tikemia afin de conserver les règles
                    de sécurité, les contrôles de session
                    et le hachage déjà utilisés par la
                    plateforme.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/reset-password"
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-lime-500 via-yellow-500 to-orange-500 px-5 text-sm font-black text-white transition hover:brightness-110"
              >
                <KeyRound
                  className="h-4 w-4"
                  aria-hidden="true"
                />

                Réinitialiser mon mot de passe
              </Link>

              <Link
                href="/account/profile"
                className="flex h-12 items-center justify-center rounded-2xl border border-white/[0.09] bg-white/[0.025] px-5 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.05] hover:text-white"
              >
                Retour au profil
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}