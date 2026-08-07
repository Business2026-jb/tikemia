import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Mail,
  QrCode,
  RefreshCcw,
  ShieldCheck,
  TicketCheck,
  UserRound,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Questions fréquentes | Tikemia",
  description:
    "Retrouvez les réponses aux questions fréquentes sur les billets, les commandes, les paiements, les transferts, les événements et les comptes Tikemia.",
  alternates: {
    canonical: "/faq",
  },
};

const faqSections = [
  {
    title: "Billets et commandes",
    icon: TicketCheck,
    questions: [
      {
        question: "Comment acheter un billet sur Tikemia ?",
        answer:
          "Choisissez un événement, sélectionnez la catégorie de billet souhaitée, renseignez les informations demandées puis procédez au paiement. Après confirmation, le billet est généré et mis à votre disposition.",
      },
      {
        question: "Où puis-je retrouver mes billets ?",
        answer:
          "Vos billets sont disponibles dans votre espace client, dans la section « Mes billets ». Ils peuvent également être envoyés à l’adresse e-mail utilisée lors de la commande.",
      },
      {
        question: "Puis-je télécharger mon billet en PDF ?",
        answer:
          "Oui. Depuis la section « Mes billets », ouvrez le billet concerné puis utilisez le bouton de téléchargement pour obtenir sa version PDF.",
      },
      {
        question: "Que faire si je ne reçois pas mon billet ?",
        answer:
          "Vérifiez d’abord votre dossier de courriers indésirables, puis consultez votre espace client. Si le paiement est confirmé mais que le billet reste introuvable, contactez Tikemia à l’adresse contact@tikemia.com.",
      },
    ],
  },
  {
    title: "Paiements",
    icon: CreditCard,
    questions: [
      {
        question: "Comment savoir si mon paiement a été confirmé ?",
        answer:
          "Une commande est considérée comme payée lorsque Tikemia reçoit la confirmation du prestataire de paiement. Le statut de la commande est ensuite mis à jour et les billets sont générés.",
      },
      {
        question: "Que faire si le paiement a été débité plusieurs fois ?",
        answer:
          "Contactez Tikemia en indiquant la référence de la commande, l’adresse e-mail utilisée et les preuves du double débit afin que la transaction soit vérifiée.",
      },
      {
        question: "Puis-je demander un remboursement ?",
        answer:
          "Les remboursements dépendent de la situation, du statut de l’événement et des conditions applicables. Consultez la politique de remboursement Tikemia pour connaître les cas concernés.",
      },
    ],
  },
  {
    title: "Transfert de billets",
    icon: RefreshCcw,
    questions: [
      {
        question: "Puis-je transférer un billet à une autre personne ?",
        answer:
          "Oui, lorsque l’organisateur autorise le transfert pour l’événement concerné. Le billet doit être valide, non utilisé et ne pas faire partie d’un autre transfert actif.",
      },
      {
        question: "Que se passe-t-il après un transfert confirmé ?",
        answer:
          "Le billet disparaît de l’espace de l’ancien détenteur et devient disponible dans l’espace du nouveau détenteur. Le nouveau détenteur peut alors l’afficher et le télécharger.",
      },
      {
        question: "Puis-je annuler un transfert en cours ?",
        answer:
          "Un transfert peut être annulé tant qu’il n’a pas encore été confirmé définitivement. Après confirmation, le billet appartient au nouveau détenteur.",
      },
    ],
  },
  {
    title: "Comptes et sécurité",
    icon: ShieldCheck,
    questions: [
      {
        question: "Dois-je créer un compte pour utiliser Tikemia ?",
        answer:
          "Certaines fonctionnalités sont accessibles sans compte, mais un compte client permet de retrouver plus facilement ses billets, ses commandes et ses transferts.",
      },
      {
        question: "Comment protéger mon compte Tikemia ?",
        answer:
          "Utilisez un mot de passe unique, ne partagez jamais vos codes de sécurité et déconnectez-vous lorsque vous utilisez un appareil qui ne vous appartient pas.",
      },
      {
        question: "Que faire si je n’arrive plus à me connecter ?",
        answer:
          "Utilisez la fonction « Mot de passe oublié » depuis la page de connexion. Un lien ou un code de réinitialisation sera envoyé à l’adresse e-mail associée au compte.",
      },
    ],
  },
  {
    title: "Événements et organisateurs",
    icon: Building2,
    questions: [
      {
        question: "Qui est responsable de l’organisation de l’événement ?",
        answer:
          "L’organisateur est responsable du contenu, du lieu, de la date, de la sécurité et du déroulement de l’événement. Tikemia fournit la plateforme de billetterie et les outils de gestion.",
      },
      {
        question: "Que se passe-t-il si un événement est reporté ou annulé ?",
        answer:
          "L’organisateur doit informer les participants. Les billets peuvent rester valables pour une nouvelle date ou faire l’objet d’un remboursement selon les conditions communiquées.",
      },
      {
        question: "Comment devenir organisateur sur Tikemia ?",
        answer:
          "Accédez à l’espace organisateur, créez votre compte puis suivez les étapes de vérification. Une fois le compte validé, vous pourrez créer et gérer vos événements.",
      },
    ],
  },
  {
    title: "Contrôle d’accès",
    icon: QrCode,
    questions: [
      {
        question: "Comment les billets sont-ils vérifiés à l’entrée ?",
        answer:
          "Chaque billet comporte un QR code unique. L’organisateur ou l’agent autorisé le scanne afin de vérifier sa validité et d’empêcher une seconde utilisation.",
      },
      {
        question: "Puis-je présenter mon billet depuis mon téléphone ?",
        answer:
          "Oui. Vous pouvez afficher le billet directement depuis votre espace Tikemia ou depuis le fichier PDF reçu ou téléchargé.",
      },
      {
        question: "Que se passe-t-il si mon billet a déjà été scanné ?",
        answer:
          "Le système signale qu’il a déjà été utilisé. Dans ce cas, présentez-vous auprès de l’organisateur avec votre pièce d’identité et votre preuve de commande.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#03070a] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-lime-500/10 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
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
            FAQ
          </span>
        </header>

        <section className="mx-auto max-w-4xl py-16 text-center sm:py-20">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
            <CircleHelp className="h-7 w-7" />
          </span>

          <p className="mt-6 text-[11px] font-black uppercase tracking-[0.22em] text-lime-400">
            Centre d’aide Tikemia
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] sm:text-5xl">
            Questions fréquentes
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-neutral-400 sm:text-base">
            Cliquez sur une question pour afficher sa réponse.
          </p>
        </section>

        <section className="space-y-10 pb-16">
          {faqSections.map((section) => {
            const Icon = section.icon;

            return (
              <div key={section.title}>
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
                    <Icon className="h-5 w-5" />
                  </span>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-600">
                      Aide Tikemia
                    </p>

                    <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">
                      {section.title}
                    </h2>
                  </div>
                </div>

                <div className="space-y-3">
                  {section.questions.map((item) => (
                    <details
                      key={item.question}
                      suppressHydrationWarning
                      className="group overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#071015] transition open:border-lime-400/20"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 text-left sm:px-6">
                        <span className="text-sm font-black text-white sm:text-base">
                          {item.question}
                        </span>

                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-500 transition group-open:rotate-180 group-open:border-lime-400/20 group-open:text-lime-300">
                          <ChevronDown className="h-4 w-4" />
                        </span>
                      </summary>

                      <div className="border-t border-white/[0.07] px-5 py-5 sm:px-6">
                        <p className="text-sm leading-7 text-neutral-400">
                          {item.answer}
                        </p>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        <section className="mb-16 rounded-[28px] border border-white/[0.08] bg-gradient-to-br from-emerald-500/10 via-lime-500/5 to-orange-500/10 p-6 text-center sm:p-8">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/[0.08] text-lime-300">
            <Mail className="h-6 w-6" />
          </span>

          <h2 className="mt-5 text-2xl font-black text-white">
            Vous n&apos;avez pas trouvé votre réponse ?
          </h2>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-neutral-500">
            Contactez Tikemia en précisant les informations liées à votre demande.
          </p>

          <Link
            href="/contact"
            className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-lime-400 to-orange-500 px-6 text-sm font-black text-black transition hover:opacity-90"
          >
            <Mail className="h-4 w-4" />
            Contacter Tikemia
          </Link>
        </section>
      </div>
    </main>
  );
}