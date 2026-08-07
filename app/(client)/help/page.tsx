import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CircleHelp,
  CreditCard,
  Mail,
  QrCode,
  RefreshCcw,
  Search,
  ShieldCheck,
  TicketCheck,
  UserRound,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Centre d’aide | Tikemia",
  description:
    "Accédez rapidement à l’aide Tikemia pour les billets, commandes, paiements, transferts, comptes, événements et contrôles d’accès.",
  alternates: {
    canonical: "/help",
  },
};

const helpCategories = [
  {
    title: "Billets et commandes",
    description:
      "Retrouver un billet, télécharger un PDF, vérifier une commande ou signaler un billet non reçu.",
    icon: TicketCheck,
    href: "/account/tickets",
    action: "Voir mes billets",
  },
  {
    title: "Paiements",
    description:
      "Comprendre le statut d’un paiement, signaler un double débit ou consulter les règles de remboursement.",
    icon: CreditCard,
    href: "/refund-policy",
    action: "Voir les remboursements",
  },
  {
    title: "Transfert de billets",
    description:
      "Envoyer un billet à un autre compte Tikemia, suivre un transfert ou modifier une sélection.",
    icon: RefreshCcw,
    href: "/account/transfers",
    action: "Gérer les transferts",
  },
  {
    title: "Compte client",
    description:
      "Accéder au profil, modifier les informations autorisées et sécuriser le compte Tikemia.",
    icon: UserRound,
    href: "/account/profile",
    action: "Ouvrir mon profil",
  },
  {
    title: "Espace organisateur",
    description:
      "Créer un événement, gérer les billets, les participants, les ventes et le contrôle d’accès.",
    icon: Building2,
    href: "/organizer",
    action: "Espace organisateur",
  },
  {
    title: "Contrôle d’accès",
    description:
      "Accéder au scanner Tikemia et vérifier les billets par QR code pendant un événement.",
    icon: QrCode,
    href: "/scanner/login",
    action: "Accéder au scanner",
  },
];

const quickLinks = [
  {
    label: "Questions fréquentes",
    href: "/faq",
  },
  {
    label: "Nous contacter",
    href: "/contact",
  },
  {
    label: "Politique de remboursement",
    href: "/refund-policy",
  },
  {
    label: "Politique de confidentialité",
    href: "/privacy-policy",
  },
  {
    label: "Conditions d’utilisation",
    href: "/terms",
  },
];

export default function HelpPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#03070a] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-lime-500/10 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Retour à l&apos;accueil</span>
          </Link>

          <span className="inline-flex h-11 items-center gap-2 rounded-xl border border-lime-400/20 bg-lime-400/[0.08] px-4 text-xs font-black uppercase tracking-[0.14em] text-lime-300">
            <CircleHelp className="h-4 w-4" />
            Centre d’aide
          </span>
        </header>

        <section className="mx-auto max-w-4xl py-16 text-center sm:py-20">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
            <ShieldCheck className="h-7 w-7" />
          </span>

          <p className="mt-6 text-[11px] font-black uppercase tracking-[0.22em] text-lime-400">
            Assistance Tikemia
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] sm:text-5xl">
            Comment pouvons-nous vous aider ?
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-neutral-400 sm:text-base">
            Retrouvez rapidement les principales rubriques d’aide pour votre compte,
            vos billets, vos paiements, vos transferts et vos événements.
          </p>

          <Link
            href="/faq"
            className="mx-auto mt-8 flex h-14 w-full max-w-xl items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#071015] px-5 text-left transition hover:border-lime-400/20"
          >
            <Search className="h-5 w-5 shrink-0 text-lime-300" />

            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black text-white">
                Rechercher une réponse
              </span>

              <span className="mt-1 block truncate text-xs text-neutral-600">
                Accéder aux questions fréquentes Tikemia
              </span>
            </span>

            <ArrowRight className="h-4 w-4 shrink-0 text-neutral-500" />
          </Link>
        </section>

        <section className="pb-16">
          <div className="mb-7">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-400">
              Rubriques d’aide
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">
              Choisissez le sujet concerné
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {helpCategories.map((category) => {
              const Icon = category.icon;

              return (
                <Link
                  key={category.title}
                  href={category.href}
                  className="group rounded-[26px] border border-white/[0.08] bg-[#071015] p-6 transition hover:border-lime-400/20 hover:bg-white/[0.025]"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300 transition group-hover:scale-105">
                    <Icon className="h-5 w-5" />
                  </span>

                  <h3 className="mt-5 text-xl font-black text-white">
                    {category.title}
                  </h3>

                  <p className="mt-3 text-sm leading-7 text-neutral-500">
                    {category.description}
                  </p>

                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-lime-400">
                    {category.action}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="grid gap-6 pb-16 lg:grid-cols-[1fr_0.8fr]">
          <article className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-6 sm:p-8">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-lime-400">
              Liens utiles
            </p>

            <h2 className="mt-3 text-2xl font-black">
              Informations et règles Tikemia
            </h2>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {quickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-black/20 p-4 text-sm font-black text-white transition hover:border-lime-400/20"
                >
                  <span>{item.label}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-neutral-600" />
                </Link>
              ))}
            </div>
          </article>

          <article className="rounded-[28px] border border-white/[0.08] bg-gradient-to-br from-emerald-500/10 via-lime-500/5 to-orange-500/10 p-6 sm:p-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
              <Mail className="h-5 w-5" />
            </span>

            <h2 className="mt-5 text-2xl font-black">
              Besoin d’une assistance directe ?
            </h2>

            <p className="mt-3 text-sm leading-7 text-neutral-500">
              Contactez Tikemia en indiquant les informations liées à votre billet,
              votre commande, votre compte ou votre événement.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/contact"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-lime-400 to-orange-500 px-5 text-sm font-black text-black"
              >
                <Mail className="h-4 w-4" />
                Ouvrir la page Contact
              </Link>

              <a
                href="mailto:contact@tikemia.com"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/[0.09] bg-white/[0.03] px-5 text-sm font-black text-white"
              >
                contact@tikemia.com
              </a>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}