import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  Clock3,
  Globe2,
  Headphones,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  TicketCheck,
} from "lucide-react";

import ClientFooterLinks from "@/components/client/footer/client-footer-links";

export type ClientFooterProps = {
  logoSrc?: string;
  supportEmail?: string;
  supportPhone?: string;
  address?: string;
  websiteLabel?: string;
};

type SocialLinkItem = {
  label: string;
  href: string;
  shortLabel: string;
};

type TrustItem = {
  label: string;
  description: string;
  icon: typeof ShieldCheck;
};

const SOCIAL_LINKS: SocialLinkItem[] = [
  {
    label: "Facebook",
    href: "https://facebook.com",
    shortLabel: "f",
  },
  {
    label: "Instagram",
    href: "https://instagram.com",
    shortLabel: "IG",
  },
  {
    label: "X",
    href: "https://x.com",
    shortLabel: "X",
  },
  {
    label: "YouTube",
    href: "https://youtube.com",
    shortLabel: "▶",
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com",
    shortLabel: "in",
  },
];

const TRUST_ITEMS: TrustItem[] = [
  {
    label: "Paiements sécurisés",
    description: "Transactions protégées",
    icon: LockKeyhole,
  },
  {
    label: "Billets vérifiés",
    description: "QR codes uniques",
    icon: TicketCheck,
  },
  {
    label: "Données protégées",
    description: "Confidentialité renforcée",
    icon: ShieldCheck,
  },
  {
    label: "Support disponible",
    description: "Assistance client",
    icon: Headphones,
  },
  {
    label: "Plateforme fiable",
    description: "Expérience sécurisée",
    icon: BadgeCheck,
  },
];

const PAYMENT_METHODS = [
  "Visa",
  "Mastercard",
  "MTN MoMo",
  "Moov Money",
  "Orange Money",
  "Wave",
] as const;

const CURRENT_YEAR = new Date().getFullYear();

function normalizeTelephoneHref(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

export default function ClientFooter({
  logoSrc = "/logo.png",
  supportEmail = "support@tikemia.com",
  supportPhone = "+229 01 69 56 77 44",
  address = "Cotonou, Bénin",
  websiteLabel = "tikemia.com",
}: ClientFooterProps) {
  return (
    <footer className="relative w-full overflow-hidden border-t border-white/[0.08] bg-[#03070a] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute -left-40 top-10 h-80 w-80 rounded-full bg-emerald-500/[0.035] blur-[110px]" />
        <div className="absolute -right-40 bottom-20 h-80 w-80 rounded-full bg-orange-500/[0.03] blur-[120px]" />
      </div>

      <section className="relative border-b border-white/[0.07] bg-white/[0.012]">
        <div className="mx-auto grid w-full max-w-[1600px] gap-3 px-4 py-5 sm:grid-cols-2 sm:px-5 lg:grid-cols-5 xl:px-8">
          {TRUST_ITEMS.map((item) => {
            const Icon = item.icon;

            return (
              <article
                key={item.label}
                className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300">
                  <Icon className="h-[18px] w-[18px]" />
                </span>

                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-white">
                    {item.label}
                  </p>

                  <p className="mt-0.5 truncate text-[10px] text-neutral-600">
                    {item.description}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="relative mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-5 sm:py-12 xl:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(260px,1.1fr)_minmax(0,2fr)_minmax(240px,0.9fr)]">
          <section className="min-w-0">
            <Link
              href="/"
              aria-label="Accueil Tikemia"
              className="inline-flex items-center"
            >
              <Image
                src={logoSrc}
                alt="Tikemia"
                width={190}
                height={62}
                className="h-auto w-[155px] object-contain sm:w-[170px]"
              />
            </Link>

            <p className="mt-4 max-w-md text-sm leading-6 text-neutral-500">
              Tikemia vous permet de découvrir, réserver et recevoir vos billets
              pour les meilleurs événements, avec ou sans compte.
            </p>

            <p className="mt-3 max-w-md text-xs leading-5 text-neutral-600">
              Concerts, festivals, conférences, spectacles, sport et expériences
              uniques, réunis dans une seule plateforme simple et sécurisée.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {SOCIAL_LINKS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.label}
                  title={item.label}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-xs font-black text-neutral-500 transition hover:border-emerald-500/20 hover:bg-emerald-500/[0.07] hover:text-emerald-300"
                >
                  {item.shortLabel}
                </a>
              ))}
            </div>
          </section>

          <section className="min-w-0">
            <ClientFooterLinks />
          </section>

          <section className="min-w-0">
            <h2 className="text-sm font-black text-white">
              Contact
            </h2>

            <div className="mt-4 space-y-3">
              <ContactItem
                icon={Mail}
                label={supportEmail}
                href={`mailto:${supportEmail}`}
              />

              <ContactItem
                icon={Phone}
                label={supportPhone}
                href={`tel:${normalizeTelephoneHref(supportPhone)}`}
              />

              <ContactItem
                icon={MapPin}
                label={address}
              />

              <ContactItem
                icon={Globe2}
                label={websiteLabel}
                href="/"
              />

              <ContactItem
                icon={Clock3}
                label="Support client disponible"
              />
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.045] p-4">
              <p className="text-xs font-black text-white">
                Besoin d’aide ?
              </p>

              <p className="mt-1 text-[11px] leading-5 text-neutral-600">
                Notre équipe vous accompagne pour vos commandes, billets et
                paiements.
              </p>

              <Link
                href="/contact"
                className="mt-3 inline-flex h-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] px-4 text-xs font-black text-emerald-300 transition hover:bg-emerald-500/[0.13]"
              >
                Contacter le support
              </Link>
            </div>
          </section>
        </div>

        <section className="mt-10 rounded-3xl border border-white/[0.07] bg-white/[0.018] p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-black text-white">
                Moyens de paiement acceptés
              </h2>

              <p className="mt-1 text-[11px] text-neutral-600">
                Les moyens disponibles peuvent varier selon le pays et
                l’événement.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((method) => (
                <span
                  key={method}
                  className="inline-flex h-9 items-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-[11px] font-black text-neutral-300"
                >
                  {method}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="relative border-t border-white/[0.07] bg-black/20">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 py-5 text-[11px] text-neutral-600 sm:px-5 md:flex-row md:items-center md:justify-between xl:px-8">
          <p>
            © {CURRENT_YEAR} Tikemia. Tous droits réservés.
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              href="/terms"
              className="transition hover:text-neutral-300"
            >
              Conditions
            </Link>

            <Link
              href="/privacy-policy"
              className="transition hover:text-neutral-300"
            >
              Confidentialité
            </Link>

            <Link
              href="/refund-policy"
              className="transition hover:text-neutral-300"
            >
              Remboursements
            </Link>

            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Plateforme sécurisée
            </span>
          </div>
        </div>
      </section>
    </footer>
  );
}

function ContactItem({
  icon: Icon,
  label,
  href,
}: {
  icon: typeof Mail;
  label: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-neutral-500">
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0 break-words text-sm text-neutral-500">
        {label}
      </span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className="flex items-center gap-3 transition hover:text-white"
      >
        {content}
      </a>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {content}
    </div>
  );
}