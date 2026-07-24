import type {
  Metadata,
} from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Headphones,
  Menu,
  QrCode,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";

export const metadata: Metadata = {
  title:
    "Organisez, gérez et vendez vos billets",

  description:
    "Créez vos événements, vendez vos billets, suivez vos ventes et gérez vos participants avec l’espace organisateur Tikemia.",

  keywords: [
    "Tikemia Organisateur",
    "créer un événement",
    "vendre des billets",
    "billetterie organisateur",
    "gestion événements",
    "vente tickets en ligne",
    "gestion participants",
    "statistiques événements",
    "paiements événements",
    "événements en Afrique",
  ],

  alternates: {
    canonical:
      "/organizer",
  },

  openGraph: {
    type:
      "website",

    locale:
      "fr_FR",

    url:
      "/organizer",

    siteName:
      "Tikemia",

    title:
      "Tikemia Organisateur — Organisez. Vendez. Réussissez.",

    description:
      "La plateforme complète pour créer, gérer et vendre les billets de vos événements en toute simplicité.",

    images: [
      {
        url:
          "/imageorganizer.png",

        width:
          1536,

        height:
          1024,

        alt:
          "Tikemia Organisateur — Créez, gérez et vendez vos événements",
      },
    ],
  },

  twitter: {
    card:
      "summary_large_image",

    title:
      "Tikemia Organisateur — Organisez. Vendez. Réussissez.",

    description:
      "Créez vos événements, suivez vos ventes et gérez vos participants depuis une seule plateforme.",

    images: [
      {
        url:
          "/imageorganizer.png",

        alt:
          "Tikemia Organisateur — Créez, gérez et vendez vos événements",
      },
    ],
  },

  robots: {
    index:
      true,

    follow:
      true,

    googleBot: {
      index:
        true,

      follow:
        true,

      "max-image-preview":
        "large",

      "max-snippet":
        -1,

      "max-video-preview":
        -1,
    },
  },
};

const organizerFeatures = [
  {
    title:
      "Tableau de bord intelligent",

    description:
      "Suivez vos ventes et vos performances en temps réel.",

    icon:
      BarChart3,

    iconClassName:
      "border-emerald-500/70 bg-emerald-500/10 text-emerald-400",
  },
  {
    title:
      "Billetterie et QR codes",

    description:
      "Générez des billets fiables, uniques et sécurisés.",

    icon:
      QrCode,

    iconClassName:
      "border-amber-500/70 bg-amber-500/10 text-amber-400",
  },
  {
    title:
      "Paiements rapides",

    description:
      "Recevez vos revenus avec des moyens de paiement adaptés.",

    icon:
      WalletCards,

    iconClassName:
      "border-red-500/70 bg-red-500/10 text-red-400",
  },
];

export default function OrganizerHomePage() {
  const currentYear =
    new Date().getFullYear();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020609] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -right-40 top-20 h-[650px] w-[650px] rounded-full bg-emerald-500/15 blur-[140px]" />
        <div className="absolute bottom-0 left-[35%] h-[350px] w-[350px] rounded-full bg-green-500/10 blur-[120px]" />
        <div className="absolute -bottom-40 right-10 h-[400px] w-[500px] rounded-full bg-orange-500/10 blur-[130px]" />

        <span className="absolute left-[49%] top-[16%] h-4 w-4 rounded-full bg-emerald-500/70" />
        <span className="absolute left-[63%] top-[19%] h-2.5 w-2.5 rounded-full bg-green-500" />
        <span className="absolute left-[71%] top-[17%] h-2.5 w-2.5 rounded-full bg-red-500" />
        <span className="absolute right-[16%] top-[20%] h-4 w-4 rounded-full bg-orange-500" />
        <span className="absolute right-[7%] top-[17%] h-2.5 w-2.5 rounded-full bg-green-500" />

        <div className="absolute bottom-0 left-0 h-[120px] w-full origin-bottom -skew-y-2 bg-gradient-to-r from-emerald-500 via-lime-400 via-amber-400 to-orange-600" />
        <div className="absolute -bottom-14 left-0 h-[120px] w-full bg-[#020609]" />
      </div>

      <header className="relative z-50 border-b border-white/5 bg-[#020609]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[92px] w-full max-w-[1600px] items-center justify-between px-5 sm:px-8 lg:h-[112px] lg:px-12 xl:px-16">
          <Link
            href="/organizer"
            aria-label="Accueil Tikemia Organisateur"
            className="relative flex shrink-0 items-center"
          >
            <Image
              src="/logo.png"
              alt="Tikemia"
              width={310}
              height={92}
              priority
              className="h-auto w-[190px] object-contain sm:w-[225px] lg:w-[275px]"
            />
          </Link>

          <div className="hidden items-center gap-7 lg:flex xl:gap-10">
            <div className="flex items-center gap-2 text-sm text-neutral-200">
              <ShieldCheck className="h-5 w-5 text-lime-400" />
              <span>100 % sécurisé</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-neutral-200">
              <Headphones className="h-5 w-5 text-lime-400" />
              <span>Assistance organisateur 24h/24</span>
            </div>

            <Link
              href="/organizer/login"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-emerald-500/70 px-8 text-sm font-semibold text-white transition hover:bg-emerald-500/10"
            >
              Connexion
            </Link>

            <Link
              href="/organizer/register"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-8 text-sm font-bold text-white shadow-[0_12px_35px_rgba(34,197,94,0.2)] transition hover:scale-[1.02]"
            >
              Inscription
            </Link>
          </div>

          <details className="group relative lg:hidden">
            <summary
              aria-label="Ouvrir le menu"
              className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white [&::-webkit-details-marker]:hidden"
            >
              <Menu className="h-6 w-6 group-open:hidden" />
              <X className="hidden h-6 w-6 group-open:block" />
            </summary>

            <div className="fixed inset-0 top-[92px] z-[100] bg-black/75 backdrop-blur-sm">
              <aside className="ml-auto flex h-[calc(100vh-92px)] w-[88%] max-w-[390px] flex-col border-l border-white/10 bg-[#060c10] p-6 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-5">
                  <Image
                    src="/logo.png"
                    alt="Tikemia"
                    width={220}
                    height={70}
                    className="h-auto w-[190px] object-contain"
                  />

                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
                    <X className="h-5 w-5" />
                  </span>
                </div>

                <div className="mt-8 space-y-4">
                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <ShieldCheck className="h-5 w-5 text-lime-400" />

                    <div>
                      <p className="text-sm font-semibold">
                        Plateforme sécurisée
                      </p>

                      <p className="mt-1 text-xs text-neutral-400">
                        Vos événements et vos paiements sont protégés.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <Headphones className="h-5 w-5 text-lime-400" />

                    <div>
                      <p className="text-sm font-semibold">
                        Support organisateur
                      </p>

                      <p className="mt-1 text-xs text-neutral-400">
                        Une équipe disponible pour vous accompagner.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-auto space-y-3">
                  <Link
                    href="/organizer/login"
                    className="flex h-13 items-center justify-center rounded-xl border border-emerald-500/70 px-5 font-semibold"
                  >
                    Se connecter
                  </Link>

                  <Link
                    href="/organizer/register"
                    className="flex h-13 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 font-bold"
                  >
                    Créer un compte organisateur
                  </Link>
                </div>
              </aside>
            </div>
          </details>
        </div>
      </header>

      <section className="relative z-10">
        <div className="mx-auto grid min-h-[calc(100vh-112px)] w-full max-w-[1600px] items-center gap-10 px-5 pb-32 pt-12 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:px-12 lg:pb-40 lg:pt-12 xl:px-16">
          <div className="relative z-20 max-w-[680px]">
            <p className="mb-5 text-sm font-bold uppercase tracking-[0.16em] text-lime-400 sm:text-base">
              Espace vendeur et organisateur
            </p>

            <h1 className="text-[52px] font-black leading-[0.98] tracking-[-0.05em] sm:text-[68px] lg:text-[76px] xl:text-[86px]">
              <span className="block text-white">
                Gérez. Vendez.
              </span>

              <span className="mt-3 block bg-gradient-to-r from-emerald-500 via-lime-400 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                Développez.
              </span>
            </h1>

            <p className="mt-7 max-w-[630px] text-base leading-8 text-neutral-300 sm:text-lg">
              Créez vos événements, commercialisez vos billets et suivez vos
              ventes en temps réel depuis une plateforme conçue pour les
              professionnels de l’événementiel en Afrique.
            </p>

            <div className="mt-9 grid gap-5 sm:grid-cols-3">
              {organizerFeatures.map((feature) => {
                const Icon =
                  feature.icon;

                return (
                  <div
                    key={feature.title}
                    className="flex items-start gap-3"
                  >
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${feature.iconClassName}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-white">
                        {feature.title}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-neutral-400">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/organizer/login"
                className="group inline-flex h-14 items-center justify-center gap-6 rounded-full bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-8 text-base font-bold text-white shadow-[0_18px_45px_rgba(34,197,94,0.2)] transition hover:scale-[1.02]"
              >
                Se connecter
                <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
              </Link>

              <Link
                href="/organizer/register"
                className="group inline-flex h-14 items-center justify-center gap-6 rounded-full border border-emerald-500/80 bg-black/20 px-8 text-base font-bold text-white transition hover:bg-emerald-500/10"
              >
                Créer un compte
                <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
              </Link>
            </div>

            <div className="mt-11 flex items-center gap-4">
              <div className="flex -space-x-3">
                {["A", "M", "K", "D"].map((letter, index) => (
                  <div
                    key={letter}
                    className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#020609] bg-gradient-to-br from-neutral-600 to-neutral-900 text-sm font-bold"
                    style={{
                      transform:
                        `translateX(-${index * 2}px)`,
                    }}
                  >
                    {letter}
                  </div>
                ))}
              </div>

              <div>
                <p className="text-sm font-semibold text-lime-400 sm:text-base">
                  Des milliers d’organisateurs
                </p>

                <p className="mt-1 text-xs text-neutral-400 sm:text-sm">
                  utilisent Tikemia pour développer leurs événements.
                </p>
              </div>
            </div>
          </div>

          <div className="relative flex min-h-[430px] items-center justify-center lg:min-h-[680px]">
            <div className="absolute inset-x-[8%] bottom-[12%] h-[45%] rounded-full bg-emerald-500/20 blur-[100px]" />

            <div className="relative w-full">
              <Image
                src="/imagea.png"
                alt="Plateforme organisateur Tikemia sur ordinateur et téléphone"
                width={1100}
                height={850}
                priority
                className="h-auto w-full object-contain drop-shadow-[0_35px_60px_rgba(0,0,0,0.7)]"
              />
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-20 border-t border-white/10 bg-[#020609]/95">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-7 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12 xl:px-16">
          <div className="flex items-center gap-4">
            <Image
              src="/logo.png"
              alt="Tikemia"
              width={180}
              height={55}
              className="h-auto w-[145px] object-contain"
            />

            <div className="hidden h-8 w-px bg-white/10 sm:block" />

            <p className="text-xs leading-5 text-neutral-500">
              © {currentYear} Tikemia. La billetterie conçue pour les
              professionnels de l’événementiel.
            </p>
          </div>

          <nav
            aria-label="Liens du pied de page organisateur"
            className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-neutral-400"
          >
            <Link
              href="/support"
              className="transition hover:text-white"
            >
              Assistance
            </Link>

            <Link
              href="/terms"
              className="transition hover:text-white"
            >
              Conditions organisateurs
            </Link>

            <Link
              href="/privacy-policy"
              className="transition hover:text-white"
            >
              Confidentialité
            </Link>

            <Link
              href="/"
              className="transition hover:text-white"
            >
              Retour au site
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}