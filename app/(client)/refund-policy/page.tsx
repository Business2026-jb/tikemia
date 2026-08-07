import type {
  Metadata,
} from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CircleX,
  Clock3,
  CreditCard,
  FileCheck2,
  Mail,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  TicketCheck,
} from "lucide-react";

export const metadata:
  Metadata = {
  title:
    "Politique de remboursement | Tikemia",

  description:
    "Consultez la politique de remboursement Tikemia applicable aux billets, annulations, reports, doublons de paiement et demandes de remboursement.",

  alternates: {
    canonical:
      "/refund-policy",
  },
};

const refundCases = [
  {
    title:
      "Événement annulé",

    description:
      "Lorsqu’un événement est officiellement annulé par l’organisateur, le participant peut être éligible au remboursement du prix du billet, selon les conditions communiquées pour l’événement concerné.",

    icon:
      CircleX,
  },
  {
    title:
      "Événement reporté",

    description:
      "En cas de report, le billet reste généralement valable pour la nouvelle date. Si l’organisateur autorise un remboursement, les modalités seront précisées par e-mail ou dans l’espace client.",

    icon:
      CalendarClock,
  },
  {
    title:
      "Paiement débité plusieurs fois",

    description:
      "Si une même commande a été débitée plusieurs fois à la suite d’un incident technique, Tikemia peut procéder à la vérification et au remboursement du montant prélevé en double.",

    icon:
      CreditCard,
  },
  {
    title:
      "Commande payée sans billet reçu",

    description:
      "Si le paiement est confirmé mais que le billet n’a pas été généré ou livré, Tikemia procède d’abord à la régularisation de la commande. Un remboursement peut être envisagé si la régularisation est impossible.",

    icon:
      TicketCheck,
  },
];

const nonRefundableCases = [
  "Changement d’avis après l’achat.",
  "Erreur du participant concernant la date, l’heure, le lieu ou la catégorie choisie.",
  "Absence ou retard du participant le jour de l’événement.",
  "Billet déjà utilisé, scanné ou transféré.",
  "Refus d’entrée lié au non-respect des règles de l’organisateur ou du lieu.",
  "Informations incorrectes fournies par l’acheteur lors de la commande.",
];

const steps = [
  {
    number:
      "01",

    title:
      "Préparer les informations",

    description:
      "Munissez-vous de la référence de commande, de l’adresse e-mail utilisée lors de l’achat, du nom de l’événement et d’une preuve de paiement si nécessaire.",
  },
  {
    number:
      "02",

    title:
      "Envoyer la demande",

    description:
      "Contactez Tikemia depuis la page de contact ou l’adresse officielle du support en expliquant clairement la situation.",
  },
  {
    number:
      "03",

    title:
      "Vérification du dossier",

    description:
      "Tikemia vérifie la commande, le statut du paiement, l’état du billet et les conditions appliquées par l’organisateur.",
  },
  {
    number:
      "04",

    title:
      "Décision et traitement",

    description:
      "Si la demande est acceptée, le remboursement est initié vers le moyen de paiement d’origine, dans la mesure du possible.",
  },
];

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen bg-[#03070a] text-white">
      <section className="relative overflow-hidden border-b border-white/[0.07]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-lime-500/10 blur-3xl" />
          <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-20">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-neutral-500 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à l’accueil
          </Link>

          <div className="mt-8 max-w-4xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-lime-400/20 bg-lime-400/[0.08] px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-lime-300">
              <ReceiptText className="h-4 w-4" />
              Informations importantes
            </span>

            <h1 className="mt-6 text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl">
              Politique de remboursement
            </h1>

            <p className="mt-5 max-w-3xl text-base leading-8 text-neutral-400">
              Cette politique explique les conditions dans lesquelles un achat effectué sur Tikemia peut faire l’objet d’un remboursement, ainsi que les démarches à suivre.
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-xs font-bold text-neutral-400">
              <Clock3 className="h-4 w-4 text-lime-400" />
              Dernière mise à jour : 7 août 2026
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="rounded-[28px] border border-amber-400/20 bg-amber-400/[0.06] p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/[0.10] text-amber-300">
              <AlertTriangle className="h-5 w-5" />
            </span>

            <div>
              <h2 className="text-lg font-black text-white">
                Principe général
              </h2>

              <p className="mt-2 text-sm leading-7 text-amber-100/70">
                Les billets d’événement sont généralement définitifs après confirmation du paiement. Un remboursement n’est accordé que dans les situations prévues par la présente politique, par les conditions de l’organisateur ou lorsque la loi applicable l’exige.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6 lg:px-8 lg:pb-20">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-lime-400">
              Situations éligibles
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">
              Quand un remboursement peut être envisagé
            </h2>

            <div className="mt-7 grid gap-4">
              {refundCases.map(
                (
                  item,
                ) => {
                  const Icon =
                    item.icon;

                  return (
                    <article
                      key={item.title}
                      className="rounded-[24px] border border-white/[0.08] bg-[#071015] p-5 sm:p-6"
                    >
                      <div className="flex items-start gap-4">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
                          <Icon className="h-5 w-5" />
                        </span>

                        <div>
                          <h3 className="text-lg font-black text-white">
                            {item.title}
                          </h3>

                          <p className="mt-2 text-sm leading-7 text-neutral-500">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          </div>

          <aside className="h-fit rounded-[28px] border border-red-400/15 bg-red-400/[0.04] p-5 sm:p-6 lg:sticky lg:top-24">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-400/[0.08] text-red-300">
              <CircleX className="h-5 w-5" />
            </span>

            <h2 className="mt-5 text-2xl font-black">
              Cas généralement non remboursables
            </h2>

            <div className="mt-5 space-y-3">
              {nonRefundableCases.map(
                (
                  item,
                ) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-black/20 p-4"
                  >
                    <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />

                    <p className="text-sm leading-6 text-neutral-400">
                      {item}
                    </p>
                  </div>
                ),
              )}
            </div>
          </aside>
        </div>
      </section>

      <section className="border-y border-white/[0.07] bg-white/[0.015]">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-400">
              Procédure
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">
              Comment demander un remboursement
            </h2>

            <p className="mt-4 text-sm leading-7 text-neutral-500">
              Toute demande doit être complète, exacte et envoyée dans un délai raisonnable après la survenance du problème.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {steps.map(
              (
                step,
              ) => (
                <article
                  key={step.number}
                  className="rounded-[24px] border border-white/[0.08] bg-[#071015] p-5 sm:p-6"
                >
                  <span className="text-sm font-black text-lime-400">
                    {step.number}
                  </span>

                  <h3 className="mt-3 text-lg font-black text-white">
                    {step.title}
                  </h3>

                  <p className="mt-3 text-sm leading-7 text-neutral-500">
                    {step.description}
                  </p>
                </article>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-5 md:grid-cols-2">
          <article className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
              <Banknote className="h-5 w-5" />
            </span>

            <h2 className="mt-5 text-2xl font-black">
              Délai de traitement
            </h2>

            <p className="mt-3 text-sm leading-7 text-neutral-500">
              Après acceptation, Tikemia initie le remboursement dans les meilleurs délais. Le délai d’apparition des fonds dépend ensuite de la banque, de l’opérateur Mobile Money ou du prestataire de paiement utilisé.
            </p>
          </article>

          <article className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/[0.08] text-orange-300">
              <RefreshCcw className="h-5 w-5" />
            </span>

            <h2 className="mt-5 text-2xl font-black">
              Moyen de remboursement
            </h2>

            <p className="mt-3 text-sm leading-7 text-neutral-500">
              Le remboursement est effectué, autant que possible, vers le moyen de paiement utilisé lors de l’achat. Une autre méthode peut être proposée lorsque le remboursement d’origine est techniquement impossible.
            </p>
          </article>

          <article className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
              <FileCheck2 className="h-5 w-5" />
            </span>

            <h2 className="mt-5 text-2xl font-black">
              Vérification obligatoire
            </h2>

            <p className="mt-3 text-sm leading-7 text-neutral-500">
              Tikemia peut demander des justificatifs supplémentaires afin de confirmer l’identité de l’acheteur, le paiement concerné et la légitimité de la demande.
            </p>
          </article>

          <article className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/[0.08] text-orange-300">
              <ShieldCheck className="h-5 w-5" />
            </span>

            <h2 className="mt-5 text-2xl font-black">
              Lutte contre la fraude
            </h2>

            <p className="mt-3 text-sm leading-7 text-neutral-500">
              Toute demande frauduleuse, falsifiée ou abusive peut être refusée. Tikemia se réserve également le droit de suspendre un compte en cas d’utilisation abusive du système de remboursement.
            </p>
          </article>
        </div>
      </section>

      <section className="border-t border-white/[0.07]">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="rounded-[30px] border border-white/[0.08] bg-gradient-to-br from-emerald-500/10 via-lime-500/5 to-orange-500/10 p-6 text-center sm:p-10">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
              <Mail className="h-6 w-6" />
            </span>

            <h2 className="mt-6 text-3xl font-black tracking-[-0.04em]">
              Besoin d’aide pour une commande ?
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-neutral-500">
              Contactez le support Tikemia avec votre référence de commande et une description détaillée du problème.
            </p>

            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/contact"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white"
              >
                Contacter le support
                <Mail className="h-4 w-4" />
              </Link>

              <Link
                href="/account/orders"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl border border-white/[0.09] bg-white/[0.03] px-6 text-sm font-black text-white"
              >
                Voir mes commandes
                <CheckCircle2 className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <p className="mx-auto mt-8 max-w-4xl text-center text-xs leading-6 text-neutral-700">
            Cette politique peut être mise à jour afin de tenir compte de l’évolution des services Tikemia, des moyens de paiement ou des exigences réglementaires applicables.
          </p>
        </div>
      </section>
    </main>
  );
}