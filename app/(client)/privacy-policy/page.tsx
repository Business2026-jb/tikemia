import type {
  Metadata,
} from "next";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  Building2,
  CheckCircle2,
  Clock3,
  Cookie,
  Database,
  Eye,
  FileLock2,
  Fingerprint,
  Globe2,
  LockKeyhole,
  Mail,
  Server,
  ShieldCheck,
  TicketCheck,
  UserCheck,
  Users,
} from "lucide-react";

export const metadata:
  Metadata = {
  title:
    "Politique de confidentialité | Tikemia",

  description:
    "Découvrez comment Tikemia collecte, utilise, protège et conserve les données personnelles des participants, organisateurs et utilisateurs de la plateforme.",

  alternates: {
    canonical:
      "/privacy-policy",
  },
};

const collectedData = [
  {
    title:
      "Données d’identité",

    description:
      "Nom, prénom, date de naissance lorsque nécessaire, photo de profil et informations permettant d’identifier l’utilisateur.",

    icon:
      UserCheck,
  },
  {
    title:
      "Coordonnées",

    description:
      "Adresse e-mail, numéro de téléphone, pays, ville, adresse postale et autres informations de contact fournies volontairement.",

    icon:
      Mail,
  },
  {
    title:
      "Données de compte",

    description:
      "Identifiants techniques, rôle du compte, statut de vérification, préférences, sessions actives et historique de connexion.",

    icon:
      Fingerprint,
  },
  {
    title:
      "Données de commande",

    description:
      "Événements réservés, billets achetés, catégories sélectionnées, références de commande, montants, statut du paiement et historique des transactions.",

    icon:
      TicketCheck,
  },
  {
    title:
      "Données techniques",

    description:
      "Adresse IP, type d’appareil, navigateur, système d’exploitation, journaux techniques, identifiants de session et informations de sécurité.",

    icon:
      Server,
  },
  {
    title:
      "Données organisateur",

    description:
      "Informations professionnelles, nom de l’organisation, documents de vérification, événements publiés, ventes, participants et paramètres de paiement.",

    icon:
      Building2,
  },
];

const purposes = [
  "Créer et administrer les comptes utilisateurs.",
  "Permettre l’achat, la réception, le téléchargement et le transfert de billets.",
  "Traiter les paiements et rapprocher les transactions avec les commandes.",
  "Permettre aux organisateurs de créer et gérer leurs événements.",
  "Assurer le contrôle d’accès par QR code et prévenir les doubles utilisations.",
  "Envoyer les confirmations, billets, codes de sécurité et notifications utiles.",
  "Fournir l’assistance client et traiter les demandes de remboursement.",
  "Prévenir la fraude, les abus, les tentatives d’accès non autorisées et les incidents techniques.",
  "Améliorer les performances, la sécurité et l’expérience de la plateforme.",
  "Respecter les obligations légales, comptables, fiscales et réglementaires applicables.",
];

const rights = [
  {
    title:
      "Droit d’accès",

    description:
      "Demander si Tikemia traite vos données et obtenir une copie des informations vous concernant.",
  },
  {
    title:
      "Droit de rectification",

    description:
      "Faire corriger des données inexactes ou compléter des informations incomplètes.",
  },
  {
    title:
      "Droit à l’effacement",

    description:
      "Demander la suppression de certaines données lorsque leur conservation n’est plus nécessaire ou légalement obligatoire.",
  },
  {
    title:
      "Droit à la limitation",

    description:
      "Demander la suspension temporaire de certains traitements dans les situations prévues par la réglementation applicable.",
  },
  {
    title:
      "Droit d’opposition",

    description:
      "Vous opposer à certains traitements fondés sur l’intérêt légitime, notamment lorsque votre situation particulière le justifie.",
  },
  {
    title:
      "Droit à la portabilité",

    description:
      "Recevoir certaines données fournies à Tikemia dans un format structuré et couramment utilisé, lorsque ce droit est applicable.",
  },
];

export default function PrivacyPolicyPage() {
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
              <ShieldCheck className="h-4 w-4" />
              Protection des données
            </span>

            <h1 className="mt-6 text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl">
              Politique de confidentialité
            </h1>

            <p className="mt-5 max-w-3xl text-base leading-8 text-neutral-400">
              Tikemia accorde une attention particulière à la protection des données personnelles. Cette politique explique quelles informations sont collectées, pourquoi elles sont utilisées, avec qui elles peuvent être partagées et comment exercer vos droits.
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-xs font-bold text-neutral-400">
              <Clock3 className="h-4 w-4 text-lime-400" />
              Dernière mise à jour : 7 août 2026
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="rounded-[28px] border border-lime-400/20 bg-lime-400/[0.05] p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lime-400/[0.10] text-lime-300">
              <BadgeCheck className="h-5 w-5" />
            </span>

            <div>
              <h2 className="text-lg font-black text-white">
                Notre engagement
              </h2>

              <p className="mt-2 text-sm leading-7 text-neutral-400">
                Tikemia limite la collecte aux informations nécessaires au fonctionnement de la plateforme, à la sécurité des comptes, au traitement des commandes et à la gestion des événements. Les données ne sont pas vendues à des tiers.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6 lg:px-8 lg:pb-20">
        <div className="max-w-3xl">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-lime-400">
            Données collectées
          </p>

          <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">
            Quelles informations pouvons-nous traiter ?
          </h2>

          <p className="mt-4 text-sm leading-7 text-neutral-500">
            Les données réellement collectées dépendent de votre utilisation de Tikemia : participant, organisateur, invité, agent scanner ou administrateur autorisé.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {collectedData.map(
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
      </section>

      <section className="border-y border-white/[0.07] bg-white/[0.015]">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8 lg:py-20">
          <div>
            <span className="flex h-13 w-13 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/[0.08] text-orange-300">
              <Database className="h-6 w-6" />
            </span>

            <p className="mt-6 text-[11px] font-black uppercase tracking-[0.16em] text-orange-400">
              Finalités
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">
              Pourquoi utilisons-nous vos données ?
            </h2>

            <p className="mt-4 text-sm leading-7 text-neutral-500">
              Chaque traitement poursuit un objectif déterminé lié au service, à la sécurité, à l’assistance ou au respect des obligations applicables.
            </p>
          </div>

          <div className="grid gap-3">
            {purposes.map(
              (
                purpose,
              ) => (
                <div
                  key={purpose}
                  className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-[#071015] p-4"
                >
                  <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-lime-400" />

                  <p className="text-sm leading-6 text-neutral-400">
                    {purpose}
                  </p>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-5 md:grid-cols-2">
          <article className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
              <FileLock2 className="h-5 w-5" />
            </span>

            <h2 className="mt-5 text-2xl font-black">
              Bases du traitement
            </h2>

            <p className="mt-3 text-sm leading-7 text-neutral-500">
              Selon la situation, le traitement peut être nécessaire à l’exécution d’un contrat ou de mesures précontractuelles, au respect d’une obligation légale, à la protection des intérêts légitimes de Tikemia ou reposer sur votre consentement lorsque celui-ci est requis.
            </p>
          </article>

          <article className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/[0.08] text-orange-300">
              <Users className="h-5 w-5" />
            </span>

            <h2 className="mt-5 text-2xl font-black">
              Destinataires des données
            </h2>

            <p className="mt-3 text-sm leading-7 text-neutral-500">
              Les données peuvent être accessibles aux équipes Tikemia autorisées, aux organisateurs pour leurs propres événements, ainsi qu’aux prestataires nécessaires au paiement, à l’hébergement, à l’envoi d’e-mails, à la sécurité et à l’assistance.
            </p>
          </article>

          <article className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
              <Clock3 className="h-5 w-5" />
            </span>

            <h2 className="mt-5 text-2xl font-black">
              Durée de conservation
            </h2>

            <p className="mt-3 text-sm leading-7 text-neutral-500">
              Les données sont conservées pendant la durée nécessaire au service concerné, puis archivées ou supprimées selon les obligations légales, comptables, fiscales, de preuve et de sécurité applicables.
            </p>
          </article>

          <article className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/[0.08] text-orange-300">
              <Globe2 className="h-5 w-5" />
            </span>

            <h2 className="mt-5 text-2xl font-black">
              Transferts internationaux
            </h2>

            <p className="mt-3 text-sm leading-7 text-neutral-500">
              Certains prestataires peuvent traiter des données depuis d’autres pays. Tikemia veille alors à utiliser des prestataires offrant des garanties appropriées et à mettre en place les protections requises par la réglementation applicable.
            </p>
          </article>
        </div>
      </section>

      <section className="border-y border-white/[0.07] bg-white/[0.015]">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <span className="flex h-13 w-13 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
                <Cookie className="h-6 w-6" />
              </span>

              <h2 className="mt-6 text-3xl font-black tracking-[-0.04em]">
                Cookies et technologies similaires
              </h2>

              <p className="mt-4 text-sm leading-7 text-neutral-500">
                Tikemia peut utiliser des cookies strictement nécessaires à la connexion, à la sécurité, à la conservation des préférences et au bon fonctionnement de la plateforme. Les traceurs non essentiels ne doivent être utilisés qu’après information et consentement lorsque la réglementation applicable l’exige.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[24px] border border-white/[0.08] bg-[#071015] p-5">
                <h3 className="text-lg font-black">
                  Cookies indispensables
                </h3>

                <p className="mt-2 text-sm leading-7 text-neutral-500">
                  Ils permettent notamment l’authentification, la protection des sessions, la prévention de la fraude et le fonctionnement des commandes.
                </p>
              </div>

              <div className="rounded-[24px] border border-white/[0.08] bg-[#071015] p-5">
                <h3 className="text-lg font-black">
                  Mesure d’audience et préférences
                </h3>

                <p className="mt-2 text-sm leading-7 text-neutral-500">
                  Lorsque ces outils sont activés, ils peuvent aider à comprendre l’utilisation de la plateforme et à améliorer l’expérience, sous réserve des choix de l’utilisateur.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-lime-400">
            Vos droits
          </p>

          <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">
            Vous gardez le contrôle de vos données
          </h2>

          <p className="mt-4 text-sm leading-7 text-neutral-500">
            Selon votre situation et la réglementation applicable, vous pouvez exercer plusieurs droits concernant vos données personnelles.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rights.map(
            (
              right,
            ) => (
              <article
                key={right.title}
                className="rounded-[24px] border border-white/[0.08] bg-[#071015] p-5"
              >
                <Eye className="h-5 w-5 text-lime-400" />

                <h3 className="mt-4 text-lg font-black">
                  {right.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-neutral-500">
                  {right.description}
                </p>
              </article>
            ),
          )}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6 lg:px-8 lg:pb-20">
        <div className="grid gap-5 md:grid-cols-2">
          <article className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
              <LockKeyhole className="h-5 w-5" />
            </span>

            <h2 className="mt-5 text-2xl font-black">
              Sécurité des données
            </h2>

            <p className="mt-3 text-sm leading-7 text-neutral-500">
              Tikemia met en œuvre des mesures techniques et organisationnelles destinées à protéger les données contre l’accès non autorisé, la perte, l’altération, la divulgation ou l’utilisation abusive. Aucune méthode de sécurité ne peut toutefois garantir un risque nul.
            </p>
          </article>

          <article className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/[0.08] text-orange-300">
              <Bell className="h-5 w-5" />
            </span>

            <h2 className="mt-5 text-2xl font-black">
              Notification d’incident
            </h2>

            <p className="mt-3 text-sm leading-7 text-neutral-500">
              En cas d’incident susceptible d’engendrer un risque pour les personnes concernées, Tikemia prend les mesures nécessaires et informe les utilisateurs ou autorités compétentes lorsque la loi l’exige.
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
              Exercer vos droits ou poser une question
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-neutral-500">
              Pour toute demande relative à vos données personnelles, contactez Tikemia en précisant l’adresse e-mail associée à votre compte et la nature de votre demande.
            </p>

            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/contact"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white"
              >
                Nous contacter
                <Mail className="h-4 w-4" />
              </Link>

              <a
                href="mailto:contact@tikemia.com"
                className="inline-flex h-13 items-center justify-center rounded-2xl border border-white/[0.09] bg-white/[0.03] px-6 text-sm font-black text-white"
              >
                contact@tikemia.com
              </a>
            </div>
          </div>

          <div className="mt-8 rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-5">
            <h2 className="text-lg font-black">
              Mise à jour de cette politique
            </h2>

            <p className="mt-2 text-sm leading-7 text-neutral-600">
              Tikemia peut modifier cette politique afin de tenir compte de l’évolution de la plateforme, de ses prestataires, de ses mesures de sécurité ou des exigences réglementaires. La date de dernière mise à jour est indiquée en haut de cette page.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}