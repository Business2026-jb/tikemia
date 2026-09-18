import Link from "next/link";

import {
  ArrowRight,
  Bell,
  Languages,
  LockKeyhole,
  Settings,
  UserRound,
} from "lucide-react";

const SETTINGS = [
  {
    title:
      "Informations personnelles",

    description:
      "Consultez et modifiez les informations de votre profil Tikemia.",

    href:
      "/account/profile",

    icon:
      UserRound,
  },

  {
    title:
      "Mot de passe",

    description:
      "Accédez aux paramètres de sécurité liés à votre mot de passe.",

    href:
      "/account/profile/password",

    icon:
      LockKeyhole,
  },

  {
    title:
      "Langue",

    description:
      "La langue de Tikemia peut être changée depuis le sélecteur FR / EN du site.",

    href:
      "/account/profile",

    icon:
      Languages,
  },

  {
    title:
      "Notifications",

    description:
      "Les préférences de notification seront centralisées dans votre espace client.",

    href:
      "/account/profile",

    icon:
      Bell,
  },
] as const;

export default function AccountSettingsPage() {
  return (
    <main className="min-h-[calc(100vh-140px)] bg-[#020609] px-4 py-7 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <section className="rounded-[28px] border border-white/[0.08] bg-[#071014] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.07] text-lime-300">
            <Settings
              className="h-5 w-5"
              aria-hidden="true"
            />
          </div>

          <p className="mt-6 text-[11px] font-black uppercase tracking-[0.18em] text-lime-400">
            Compte client
          </p>

          <h1 className="mt-2 text-2xl font-black sm:text-3xl">
            Paramètres
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
            Gérez les principales préférences liées
            à votre compte Tikemia.
          </p>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-2">
          {SETTINGS.map(
            ({
              title,
              description,
              href,
              icon: Icon,
            }) => (
              <Link
                key={title}
                href={href}
                className="group rounded-[22px] border border-white/[0.08] bg-[#071014] p-5 transition hover:border-lime-400/20 hover:bg-white/[0.025]"
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035] text-neutral-300 transition group-hover:border-lime-400/20 group-hover:text-lime-300">
                    <Icon
                      className="h-5 w-5"
                      aria-hidden="true"
                    />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sm font-black text-white">
                        {title}
                      </h2>

                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-neutral-600 transition group-hover:translate-x-0.5 group-hover:text-lime-400"
                        aria-hidden="true"
                      />
                    </div>

                    <p className="mt-2 text-xs leading-5 text-neutral-500">
                      {description}
                    </p>
                  </div>
                </div>
              </Link>
            ),
          )}
        </section>
      </div>
    </main>
  );
}