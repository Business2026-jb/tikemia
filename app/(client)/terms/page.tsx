import type {
  Metadata,
} from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Ban,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Gavel,
  HelpCircle,
  LockKeyhole,
  Mail,
  QrCode,
  ReceiptText,
  RefreshCcw,
  Scale,
  ShieldCheck,
  TicketCheck,
  UserCheck,
  Users,
  WalletCards,
} from "lucide-react";

export const metadata:
  Metadata = {
  title:
    "Conditions générales d’utilisation | Tikemia",

  description:
    "Consultez les conditions générales d’utilisation de Tikemia applicables aux participants, organisateurs, billets, paiements, transferts, remboursements et contrôles d’accès.",

  alternates: {
    canonical:
      "/terms",
  },
};

const keyRules = [
  {
    title:
      "Compte personnel",

    description:
      "Chaque utilisateur est responsable de l’exactitude de ses informations, de la confidentialité de ses identifiants et des activités réalisées depuis son compte.",

    icon:
      UserCheck,
  },
  {
    title:
      "Billets sécurisés",

    description:
      "Chaque billet est nominatif ou rattaché à une commande, comporte un identifiant unique et peut être contrôlé par QR code à l’entrée.",

    icon:
      QrCode,
  },
  {
    title:
      "Paiements confirmés",

    description:
      "Une commande n’est considérée comme payée qu’après confirmation du paiement par Tikemia ou par le prestataire de paiement concerné.",

    icon:
      WalletCards,
  },
  {
    title:
      "Utilisation loyale",

    description:
      "Toute fraude, duplication, revente interdite, falsification, tentative d’accès non autorisé ou utilisation abusive peut entraîner une suspension du compte.",

    icon:
      ShieldCheck,
  },
];

const organizerDuties = [
  "Fournir des informations exactes, complètes et à jour sur l’événement.",
  "Disposer des autorisations nécessaires pour organiser, promouvoir et vendre des billets.",
  "Respecter les lois, règles de sécurité, obligations fiscales et réglementations applicables.",
  "Assurer le bon déroulement de l’événement et l’accueil des participants.",
  "Informer rapidement Tikemia et les participants en cas d’annulation, report ou modification importante.",
  "Définir clairement les catégories, tarifs, quantités, périodes de vente et conditions particulières.",
  "Ne pas publier de contenu trompeur, illicite, discriminatoire, violent ou portant atteinte aux droits de tiers.",
  "Assumer les conséquences liées à l’organisation matérielle, artistique, technique et sécuritaire de l’événement.",
];

const participantDuties = [
  "Vérifier la date, l’heure, le lieu, la catégorie et les conditions de l’événement avant le paiement.",
  "Fournir des informations exactes lors de la commande.",
  "Conserver son billet et empêcher toute copie ou utilisation non autorisée.",
  "Présenter un billet valide et, si nécessaire, une pièce d’identité à l’entrée.",
  "Respecter les règles de l’organisateur, du lieu et des autorités compétentes.",
  "Ne pas revendre, falsifier, dupliquer ou modifier un billet en dehors des fonctionnalités autorisées.",
  "Signaler rapidement toute erreur de commande, anomalie de paiement ou problème de livraison.",
];

const prohibitedUses = [
  "Créer un faux compte ou usurper l’identité d’une autre personne.",
  "Utiliser des moyens de paiement frauduleux ou non autorisés.",
  "Copier, modifier, revendre ou distribuer illicitement des billets.",
  "Contourner les limitations de vente ou les contrôles de sécurité.",
  "Accéder sans autorisation aux données, comptes, serveurs ou fonctionnalités internes.",
  "Publier un événement inexistant, trompeur, interdit ou portant atteinte aux droits de tiers.",
  "Utiliser Tikemia pour le blanchiment d’argent, la fraude, le financement d’activités illicites ou toute autre infraction.",
  "Perturber volontairement le fonctionnement de la plateforme ou introduire un programme malveillant.",
];

const sections = [
  {
    title:
      "1. Objet des conditions",

    content:
      "Les présentes conditions générales d’utilisation encadrent l’accès et l’utilisation de la plateforme Tikemia, de ses sites, interfaces, espaces utilisateurs, outils de billetterie, systèmes de paiement, services de livraison de billets, fonctions de transfert et dispositifs de contrôle d’accès.",
  },
  {
    title:
      "2. Acceptation",

    content:
      "En créant un compte, en publiant un événement, en achetant un billet, en utilisant un QR code ou en accédant à une fonctionnalité Tikemia, l’utilisateur reconnaît avoir lu, compris et accepté les présentes conditions ainsi que les politiques associées.",
  },
  {
    title:
      "3. Accès au service",

    content:
      "Certaines fonctionnalités sont accessibles sans compte, tandis que d’autres exigent une inscription, une vérification d’adresse e-mail ou un rôle particulier. Tikemia peut limiter, suspendre ou refuser l’accès lorsqu’un risque de fraude, de sécurité ou de non-respect des présentes conditions est identifié.",
  },
  {
    title:
      "4. Exactitude des informations",

    content:
      "L’utilisateur s’engage à fournir des informations exactes, complètes et à jour. Tikemia n’est pas responsable des conséquences résultant d’une adresse e-mail, d’un numéro de téléphone, d’un nom ou de toute autre donnée incorrecte fournie par l’utilisateur.",
  },
];

export default function TermsPage() {
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
              <Scale className="h-4 w-4" />
              Cadre d’utilisation
            </span>

            <h1 className="mt-6 text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl">
              Conditions générales d’utilisation
            </h1>

            <p className="mt-5 max-w-3xl text-base leading-8 text-neutral-400">
              Les présentes conditions définissent les règles applicables à l’utilisation de Tikemia par les participants, organisateurs, agents de contrôle, visiteurs et utilisateurs autorisés.
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
                Acceptation obligatoire
              </h2>

              <p className="mt-2 text-sm leading-7 text-amber-100/70">
                En utilisant Tikemia, vous acceptez les présentes conditions. Si vous n’acceptez pas une disposition, vous devez cesser d’utiliser la plateforme et ses services.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6 lg:px-8 lg:pb-20">
        <div className="max-w-3xl">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-lime-400">
            Principes essentiels
          </p>

          <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">
            Les règles de base de Tikemia
          </h2>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {keyRules.map(
            (
              rule,
            ) => {
              const Icon =
                rule.icon;

              return (
                <article
                  key={rule.title}
                  className="rounded-[24px] border border-white/[0.08] bg-[#071015] p-5 sm:p-6"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
                      <Icon className="h-5 w-5" />
                    </span>

                    <div>
                      <h3 className="text-lg font-black">
                        {rule.title}
                      </h3>

                      <p className="mt-2 text-sm leading-7 text-neutral-500">
                        {rule.description}
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
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-4">
            {sections.map(
              (
                section,
              ) => (
                <article
                  key={section.title}
                  className="rounded-[24px] border border-white/[0.08] bg-[#071015] p-5 sm:p-6"
                >
                  <h2 className="text-xl font-black text-white">
                    {section.title}
                  </h2>

                  <p className="mt-3 text-sm leading-7 text-neutral-500">
                    {section.content}
                  </p>
                </article>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-2">
          <article className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/[0.08] text-orange-300">
              <Building2 className="h-5 w-5" />
            </span>

            <h2 className="mt-5 text-2xl font-black">
              Obligations des organisateurs
            </h2>

            <div className="mt-5 space-y-3">
              {organizerDuties.map(
                (
                  duty,
                ) => (
                  <div
                    key={duty}
                    className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-black/20 p-4"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />

                    <p className="text-sm leading-6 text-neutral-400">
                      {duty}
                    </p>
                  </div>
                ),
              )}
            </div>
          </article>

          <article className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
              <Users className="h-5 w-5" />
            </span>

            <h2 className="mt-5 text-2xl font-black">
              Obligations des participants
            </h2>

            <div className="mt-5 space-y-3">
              {participantDuties.map(
                (
                  duty,
                ) => (
                  <div
                    key={duty}
                    className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-black/20 p-4"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />

                    <p className="text-sm leading-6 text-neutral-400">
                      {duty}
                    </p>
                  </div>
                ),
              )}
            </div>
          </article>
        </div>
      </section>

      <section className="border-y border-white/[0.07] bg-white/[0.015]">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-5 md:grid-cols-2">
            <article className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
                <CreditCard className="h-5 w-5" />
              </span>

              <h2 className="mt-5 text-2xl font-black">
                Commandes et paiements
              </h2>

              <p className="mt-3 text-sm leading-7 text-neutral-500">
                Les prix sont affichés dans la devise indiquée pour l’événement. Des frais de service peuvent être ajoutés avant la confirmation de la commande. Le paiement est traité par un prestataire externe autorisé. Tikemia ne garantit pas l’acceptation de tous les moyens de paiement.
              </p>
            </article>

            <article className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/[0.08] text-orange-300">
                <TicketCheck className="h-5 w-5" />
              </span>

              <h2 className="mt-5 text-2xl font-black">
                Émission et livraison des billets
              </h2>

              <p className="mt-3 text-sm leading-7 text-neutral-500">
                Après confirmation du paiement, les billets peuvent être envoyés par e-mail, rendus disponibles dans l’espace client ou transmis par un canal autorisé. L’utilisateur doit vérifier ses coordonnées et contacter le support en cas de non-réception.
              </p>
            </article>

            <article className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
                <RefreshCcw className="h-5 w-5" />
              </span>

              <h2 className="mt-5 text-2xl font-black">
                Transfert de billets
              </h2>

              <p className="mt-3 text-sm leading-7 text-neutral-500">
                Le transfert n’est possible que lorsque l’organisateur l’autorise et que le billet est valide, non utilisé et non engagé dans un autre transfert. Une fois confirmé, l’ancien détenteur perd l’accès au billet transféré.
              </p>
            </article>

            <article className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/[0.08] text-orange-300">
                <ReceiptText className="h-5 w-5" />
              </span>

              <h2 className="mt-5 text-2xl font-black">
                Remboursements
              </h2>

              <p className="mt-3 text-sm leading-7 text-neutral-500">
                Les conditions de remboursement sont décrites dans la politique de remboursement Tikemia et peuvent dépendre de l’organisateur, du statut de l’événement, du moyen de paiement et de la réglementation applicable.
              </p>

              <Link
                href="/refund-policy"
                className="mt-5 inline-flex items-center gap-2 text-sm font-black text-lime-400 transition hover:text-lime-300"
              >
                Consulter la politique de remboursement
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <span className="flex h-13 w-13 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/[0.08] text-red-300">
              <Ban className="h-6 w-6" />
            </span>

            <h2 className="mt-6 text-3xl font-black tracking-[-0.04em]">
              Utilisations interdites
            </h2>

            <p className="mt-4 text-sm leading-7 text-neutral-500">
              Tikemia peut suspendre immédiatement un compte ou une activité en cas de suspicion sérieuse de fraude, de risque pour les utilisateurs ou de violation des présentes conditions.
            </p>
          </div>

          <div className="grid gap-3">
            {prohibitedUses.map(
              (
                use,
              ) => (
                <div
                  key={use}
                  className="flex items-start gap-3 rounded-2xl border border-red-400/10 bg-red-400/[0.03] p-4"
                >
                  <Ban className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />

                  <p className="text-sm leading-6 text-neutral-400">
                    {use}
                  </p>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.07] bg-white/[0.015]">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-5 md:grid-cols-2">
            <article className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-6">
              <LockKeyhole className="h-6 w-6 text-lime-400" />

              <h2 className="mt-5 text-2xl font-black">
                Sécurité du compte
              </h2>

              <p className="mt-3 text-sm leading-7 text-neutral-500">
                L’utilisateur doit protéger son mot de passe, ses codes de vérification et ses appareils. Toute activité réalisée depuis une session authentifiée peut être considérée comme effectuée par le titulaire du compte, sauf preuve contraire.
              </p>
            </article>

            <article className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-6">
              <CalendarDays className="h-6 w-6 text-orange-400" />

              <h2 className="mt-5 text-2xl font-black">
                Annulation et report
              </h2>

              <p className="mt-3 text-sm leading-7 text-neutral-500">
                L’organisateur est responsable des décisions relatives à l’annulation, au report, au changement de lieu ou à toute modification substantielle. Tikemia facilite l’information et le traitement technique, mais n’est pas l’organisateur de l’événement.
              </p>
            </article>

            <article className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-6">
              <Gavel className="h-6 w-6 text-lime-400" />

              <h2 className="mt-5 text-2xl font-black">
                Suspension et résiliation
              </h2>

              <p className="mt-3 text-sm leading-7 text-neutral-500">
                Tikemia peut suspendre ou fermer un compte en cas de fraude, de violation répétée, de risque de sécurité, d’obligation légale ou d’utilisation incompatible avec le fonctionnement normal de la plateforme.
              </p>
            </article>

            <article className="rounded-[28px] border border-white/[0.08] bg-[#071015] p-6">
              <FileText className="h-6 w-6 text-orange-400" />

              <h2 className="mt-5 text-2xl font-black">
                Évolution des services
              </h2>

              <p className="mt-3 text-sm leading-7 text-neutral-500">
                Tikemia peut modifier, ajouter, suspendre ou retirer certaines fonctionnalités afin d’améliorer le service, renforcer la sécurité, respecter une obligation ou adapter la plateforme aux besoins du marché.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="rounded-[30px] border border-white/[0.08] bg-[#071015] p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
              <BadgeCheck className="h-5 w-5" />
            </span>

            <div>
              <h2 className="text-2xl font-black">
                Limitation de responsabilité
              </h2>

              <p className="mt-3 text-sm leading-7 text-neutral-500">
                Tikemia fournit une infrastructure de billetterie et de mise en relation. Sauf disposition légale contraire, Tikemia ne peut être tenue responsable de l’organisation matérielle de l’événement, de la prestation artistique, d’un changement décidé par l’organisateur, du comportement des participants, d’une interruption indépendante de sa volonté ou d’un préjudice indirect.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.07]">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="rounded-[30px] border border-white/[0.08] bg-gradient-to-br from-emerald-500/10 via-lime-500/5 to-orange-500/10 p-6 text-center sm:p-10">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
              <HelpCircle className="h-6 w-6" />
            </span>

            <h2 className="mt-6 text-3xl font-black tracking-[-0.04em]">
              Une question sur ces conditions ?
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-neutral-500">
              Le support Tikemia peut vous aider à comprendre une règle, signaler un problème ou traiter une demande liée à votre compte, votre commande ou votre événement.
            </p>

            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/contact"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white"
              >
                Contacter Tikemia
                <Mail className="h-4 w-4" />
              </Link>

              <Link
                href="/privacy-policy"
                className="inline-flex h-13 items-center justify-center rounded-2xl border border-white/[0.09] bg-white/[0.03] px-6 text-sm font-black text-white"
              >
                Politique de confidentialité
              </Link>
            </div>
          </div>

          <p className="mx-auto mt-8 max-w-4xl text-center text-xs leading-6 text-neutral-700">
            Tikemia peut mettre à jour les présentes conditions. La version applicable est celle publiée sur cette page à la date d’utilisation du service, sauf disposition contraire imposée par la loi.
          </p>
        </div>
      </section>
    </main>
  );
}