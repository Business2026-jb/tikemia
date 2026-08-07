import type {
  Metadata,
} from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Globe2,
  HeartHandshake,
  LockKeyhole,
  MapPin,
  QrCode,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  Users,
  WalletCards,
} from "lucide-react";

export const metadata:
  Metadata = {
  title:
    "À propos | Tikemia",

  description:
    "Découvrez Tikemia, la plateforme africaine de billetterie en ligne qui facilite la création, la vente, l’achat, le transfert et le contrôle des billets pour tous types d’événements.",

  alternates: {
    canonical:
      "/about",
  },
};

const values = [
  {
    title:
      "Simplicité",

    description:
      "Nous rendons la création, l’achat et la gestion des billets accessibles à tous, sur ordinateur comme sur mobile.",

    icon:
      Sparkles,
  },
  {
    title:
      "Sécurité",

    description:
      "Chaque billet est protégé par un QR code unique et contrôlable à l’entrée de l’événement.",

    icon:
      ShieldCheck,
  },
  {
    title:
      "Proximité",

    description:
      "Tikemia accompagne les organisateurs et les participants avec une solution pensée pour les réalités locales.",

    icon:
      HeartHandshake,
  },
];

const solutions = [
  {
    title:
      "Pour les organisateurs",

    description:
      "Créez vos événements, configurez vos catégories de billets, suivez les ventes, gérez les participants et contrôlez les entrées depuis un espace professionnel.",

    icon:
      CalendarDays,
  },
  {
    title:
      "Pour les participants",

    description:
      "Découvrez des événements, achetez vos billets en ligne, recevez-les par e-mail et retrouvez-les facilement dans votre espace Tikemia.",

    icon:
      TicketCheck,
  },
  {
    title:
      "Pour le contrôle d’accès",

    description:
      "Scannez rapidement les QR codes, identifiez les billets valides, refusés ou déjà utilisés, et suivez les entrées en temps réel.",

    icon:
      QrCode,
  },
];

const highlights = [
  {
    label:
      "Billetterie numérique",

    icon:
      TicketCheck,
  },
  {
    label:
      "Paiements sécurisés",

    icon:
      WalletCards,
  },
  {
    label:
      "Contrôle par QR code",

    icon:
      QrCode,
  },
  {
    label:
      "Gestion des participants",

    icon:
      Users,
  },
  {
    label:
      "Protection des données",

    icon:
      LockKeyhole,
  },
  {
    label:
      "Solution adaptée à l’Afrique",

    icon:
      Globe2,
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#03070a] text-white">
      <section className="relative overflow-hidden border-b border-white/[0.07]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-lime-500/10 blur-3xl" />
          <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-lime-400/20 bg-lime-400/[0.08] px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-lime-300">
              <BadgeCheck className="h-4 w-4" />
              À propos de Tikemia
            </span>

            <h1 className="mt-6 max-w-4xl text-4xl font-black leading-tight tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
              La billetterie africaine pensée pour connecter les événements et leur public.
            </h1>

            <p className="mt-6 max-w-3xl text-base leading-8 text-neutral-400 sm:text-lg">
              Tikemia est une plateforme de billetterie en ligne qui permet aux organisateurs de créer, publier et gérer leurs événements, tout en offrant aux participants une expérience simple, rapide et sécurisée pour acheter et recevoir leurs billets.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/events"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white transition hover:scale-[1.01]"
              >
                Découvrir les événements
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/organizer"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl border border-white/[0.09] bg-white/[0.03] px-6 text-sm font-black text-white transition hover:bg-white/[0.06]"
              >
                Devenir organisateur
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#071015] p-3 shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
              <div className="relative min-h-[420px] overflow-hidden rounded-[24px] bg-gradient-to-br from-[#0d191e] via-[#071015] to-[#03070a]">
                <Image
                  src="/imageorganizer.png"
                  alt="Organisateur et participants utilisant Tikemia"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 48vw"
                  className="object-cover opacity-80"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#03070a] via-transparent to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/[0.08] bg-black/50 p-4 backdrop-blur-xl">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-lime-400">
                        Organisateurs
                      </p>

                      <p className="mt-2 text-sm font-bold leading-6 text-white">
                        Une gestion complète des événements, ventes et participants.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/[0.08] bg-black/50 p-4 backdrop-blur-xl">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-400">
                        Participants
                      </p>

                      <p className="mt-2 text-sm font-bold leading-6 text-white">
                        Des billets accessibles, sécurisés et faciles à utiliser.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <span className="absolute -bottom-5 -left-5 hidden h-20 w-20 items-center justify-center rounded-3xl border border-lime-400/20 bg-[#071015] text-lime-300 shadow-2xl lg:flex">
              <QrCode className="h-9 w-9" />
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-lime-400">
            Notre mission
          </p>

          <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
            Simplifier l’accès aux événements et professionnaliser la billetterie.
          </h2>

          <p className="mt-5 text-base leading-8 text-neutral-500">
            Notre ambition est de donner aux organisateurs des outils modernes pour développer leurs événements, tout en permettant au public d’acheter ses billets en toute confiance, où qu’il se trouve.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {values.map(
            (
              value,
            ) => {
              const Icon =
                value.icon;

              return (
                <article
                  key={value.title}
                  className="rounded-[26px] border border-white/[0.08] bg-[#071015] p-6"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
                    <Icon className="h-5 w-5" />
                  </span>

                  <h3 className="mt-5 text-xl font-black text-white">
                    {value.title}
                  </h3>

                  <p className="mt-3 text-sm leading-7 text-neutral-500">
                    {value.description}
                  </p>
                </article>
              );
            },
          )}
        </div>
      </section>

      <section className="border-y border-white/[0.07] bg-white/[0.015]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-400">
                Une plateforme complète
              </p>

              <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
                Tikemia accompagne chaque étape de l’événement.
              </h2>

              <p className="mt-5 text-base leading-8 text-neutral-500">
                De la publication de l’événement jusqu’au contrôle des billets à l’entrée, la plateforme centralise les outils essentiels dans une seule expérience.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {highlights.map(
                  (
                    item,
                  ) => {
                    const Icon =
                      item.icon;

                    return (
                      <div
                        key={item.label}
                        className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#071015] p-4"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-lime-300">
                          <Icon className="h-4.5 w-4.5" />
                        </span>

                        <span className="text-sm font-black text-white">
                          {item.label}
                        </span>
                      </div>
                    );
                  },
                )}
              </div>
            </div>

            <div className="grid gap-4">
              {solutions.map(
                (
                  solution,
                  index,
                ) => {
                  const Icon =
                    solution.icon;

                  return (
                    <article
                      key={solution.title}
                      className="grid gap-5 rounded-[26px] border border-white/[0.08] bg-[#071015] p-6 sm:grid-cols-[auto_1fr] sm:items-start"
                    >
                      <span className="flex h-13 w-13 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-lime-300">
                        <Icon className="h-6 w-6" />
                      </span>

                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-700">
                          Solution {index + 1}
                        </p>

                        <h3 className="mt-2 text-xl font-black text-white">
                          {solution.title}
                        </h3>

                        <p className="mt-3 text-sm leading-7 text-neutral-500">
                          {solution.description}
                        </p>
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-8 lg:grid-cols-2">
          <article className="rounded-[30px] border border-white/[0.08] bg-[#071015] p-6 sm:p-8">
            <span className="flex h-13 w-13 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/[0.08] text-orange-300">
              <MapPin className="h-6 w-6" />
            </span>

            <h2 className="mt-6 text-2xl font-black tracking-[-0.03em] text-white">
              Une solution développée pour les événements en Afrique
            </h2>

            <p className="mt-4 text-sm leading-7 text-neutral-500">
              Tikemia prend en compte les besoins des organisateurs, des entreprises, des artistes, des associations, des lieux culturels et de tous les acteurs qui souhaitent proposer une expérience de billetterie moderne et professionnelle.
            </p>
          </article>

          <article className="rounded-[30px] border border-white/[0.08] bg-gradient-to-br from-emerald-500/10 via-lime-500/5 to-orange-500/10 p-6 sm:p-8">
            <span className="flex h-13 w-13 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
              <ShieldCheck className="h-6 w-6" />
            </span>

            <h2 className="mt-6 text-2xl font-black tracking-[-0.03em] text-white">
              La confiance au centre de chaque transaction
            </h2>

            <p className="mt-4 text-sm leading-7 text-neutral-400">
              Tikemia protège les comptes, les commandes et les billets grâce à des contrôles d’accès sécurisés, des QR codes uniques, des sessions protégées et une traçabilité des opérations importantes.
            </p>
          </article>
        </div>
      </section>

      <section className="border-t border-white/[0.07]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#071015] p-6 text-center sm:p-10">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
              <Users className="h-6 w-6" />
            </span>

            <h2 className="mx-auto mt-6 max-w-3xl text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
              Rejoignez une nouvelle manière de vivre et d’organiser les événements.
            </h2>

            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-neutral-500 sm:text-base">
              Que vous soyez organisateur ou participant, Tikemia vous accompagne avec une expérience fluide, sécurisée et adaptée à vos besoins.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/events"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white"
              >
                Voir les événements
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/contact"
                className="inline-flex h-13 items-center justify-center rounded-2xl border border-white/[0.09] bg-white/[0.03] px-6 text-sm font-black text-white"
              >
                Nous contacter
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}