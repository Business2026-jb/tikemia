
"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import { readPublicLocale, subscribePublicLocale } from "./PublicNavigation";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Heart,
  ShieldCheck,
  Ticket,
} from "lucide-react";

/* ==========================================================
   TIKEMIA — FOOTER PUBLIC

   FICHIER :
   src/components/public/PublicFooter.tsx

   OBJECTIFS :
   - Footer commun pour tout l'espace public
   - Version PC et mobile responsive
   - Pleine largeur
   - Rubriques bien alignées
   - Logo officiel TIKEMIA
   - Réseaux sociaux : tikemia0
   - Français / Anglais
   - Aucun CSS supplémentaire
   - Compatible avec le menu mobile fixe
   - Aucun élément organisateur

   IMPORTANT :
   Les adresses des réseaux sociaux
   devront correspondre aux comptes
   officiels effectivement créés.
========================================================== */

type Locale = "fr" | "en";

function SocialBrandIcon({ network }: { network: "facebook" | "instagram" | "youtube" | "linkedin" }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      {network === "facebook" && <path fill="currentColor" d="M14 22v-9h3l.5-4H14V7c0-1.2.4-2 2-2h2V1.3C17.3 1.1 16.3 1 15 1c-3 0-5 1.8-5 5v3H7v4h3v9z" />}
      {network === "instagram" && <g stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></g>}
      {network === "youtube" && <><path fill="currentColor" d="M21.6 6.2c-.2-.9-.9-1.6-1.8-1.8C18.2 4 12 4 12 4s-6.2 0-7.8.4c-.9.2-1.6.9-1.8 1.8C2 7.8 2 12 2 12s0 4.2.4 5.8c.2.9.9 1.6 1.8 1.8C5.8 20 12 20 12 20s6.2 0 7.8-.4c.9-.2 1.6-.9 1.8-1.8C22 16.2 22 12 22 12s0-4.2-.4-5.8Z" /><path d="m10 8 6 4-6 4Z" fill="#00432c" /></>}
      {network === "linkedin" && <><rect x="2" y="2" width="20" height="20" rx="2" stroke="currentColor" strokeWidth="2" /><circle cx="6.5" cy="7" r="1.5" fill="currentColor" /><path d="M5 10h3v9H5zm5 0h3v1.2c.8-1 1.7-1.5 3-1.5 2.6 0 3.5 1.6 3.5 4.3v5h-3v-4.6c0-1.4-.3-2.2-1.6-2.2-1.4 0-1.9 1-1.9 2.4V19h-3Z" fill="currentColor" /></>}
    </svg>
  );
}

type FooterLink = {
  label: string;
  href: string;
};

const LOGO = "/logo/logo.png";

/* ==========================================================
   RÉSEAUX SOCIAUX

   Identifiant officiel demandé :
   tikemia0

   YouTube utilise le format @handle.
   LinkedIn utilise généralement
   /company/nom-de-page.

   Confirmer les URL après création
   des pages sur chaque plateforme.
========================================================== */

const SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/tikemia0",
  instagram: "https://www.instagram.com/tikemia0/",
  x: "https://x.com/tikemia0",
  youtube: "https://www.youtube.com/@tikemia0",
  linkedin: "https://www.linkedin.com/company/tikemia0/",
} as const;

/* ==========================================================
   TRADUCTIONS
========================================================== */

const TRANSLATIONS = {
  fr: {
    explore: "Explorer",
    support: "Assistance",
    legal: "Légal",
    follow: "Suivez-nous",

    home: "Accueil",
    events: "Événements",
    campaigns: "Cagnottes",
    categories: "Catégories",

    howItWorks: "Comment ça marche",
    faq: "FAQ",
    contact: "Nous contacter",

    terms: "Conditions d'utilisation",
    privacy: "Politique de confidentialité",
    legalNotice: "Mentions légales",

    rights: "Tous droits réservés.",

    tagline:
      "Vos événements, vos billets et vos bonnes causes.",

    secure:
      "Plateforme de billetterie et de dons.",

    socialLabel:
      "Réseaux sociaux officiels TIKEMIA",

    accessibility:
      "Pied de page TIKEMIA",
  },

  en: {
    explore: "Explore",
    support: "Support",
    legal: "Legal",
    follow: "Follow us",

    home: "Home",
    events: "Events",
    campaigns: "Fundraisers",
    categories: "Categories",

    howItWorks: "How it works",
    faq: "FAQ",
    contact: "Contact us",

    terms: "Terms of use",
    privacy: "Privacy policy",
    legalNotice: "Legal notice",

    rights: "All rights reserved.",

    tagline:
      "Your events, your tickets and your good causes.",

    secure:
      "Ticketing and fundraising platform.",

    socialLabel:
      "Official TIKEMIA social media",

    accessibility:
      "TIKEMIA footer",
  },
} as const;

/* ==========================================================
   COMPOSANT RÉUTILISABLE : LIENS
========================================================== */

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: FooterLink[];
}) {
  return (
    <div className="min-w-0">
      <h2 className="mb-3 text-[13px] font-extrabold text-white sm:text-sm">
        {title}
      </h2>

      <nav aria-label={title}>
        <ul className="flex flex-col gap-2">
          {links.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="inline-flex min-h-6 max-w-full items-center text-[12px] leading-snug text-[#d9eae1] transition-colors hover:text-[#ffdb33] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-[13px]"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/* ==========================================================
   COMPOSANT RÉSEAUX SOCIAUX
========================================================== */

function SocialIcon({
  href,
  name,
  children,
}: {
  href: string;
  name: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`TIKEMIA sur ${name}`}
      title={`TIKEMIA — ${name} (@tikemia0)`}
      className={[
        "inline-flex",
        "size-10",
        "shrink-0",
        "items-center",
        "justify-center",
        "rounded-xl",
        "border",
        "border-white/20",
        "bg-white/10",
        "text-white",
        "transition-colors",
        "duration-150",
        "hover:border-[#fbd229]",
        "hover:bg-[#fbd229]",
        "hover:text-[#06422c]",
        "focus-visible:outline-2",
        "focus-visible:outline-offset-2",
        "focus-visible:outline-white",
      ].join(" ")}
    >
      {children}
    </a>
  );
}

/* ==========================================================
   COMPOSANT PRINCIPAL
========================================================== */

export default function PublicFooter() {
  const pathname = usePathname();
  const year = useSyncExternalStore(subscribePublicLocale, () => new Date().getFullYear(), () => null);
  const locale = useSyncExternalStore(subscribePublicLocale, readPublicLocale, () => "fr" as Locale);

  const t = TRANSLATIONS[locale];
  if (["/login", "/register", "/forgot-password", "/verify-email"].includes(pathname)) return null;
  if (pathname !== "/") return <div aria-hidden="true" data-public-navigation-spacer className="h-[calc(76px+env(safe-area-inset-bottom))] w-full shrink-0 lg:hidden" />;

  /* ========================================================
     SYNCHRONISATION AVEC LA LANGUE TIKEMIA
  ======================================================== */

  

  /* ========================================================
     LIENS DES RUBRIQUES
  ======================================================== */

  const exploreLinks: FooterLink[] = [
    {
      label: t.home,
      href: "/",
    },
    {
      label: t.events,
      href: "/explore",
    },
    {
      label: t.campaigns,
      href: "/campaigns",
    },
    {
      label: t.categories,
      href: "/#categories",
    },
  ];

  const supportLinks: FooterLink[] = [
    {
      label: t.howItWorks,
      href: "/#how-it-works",
    },
    {
      label: t.faq,
      href: "/faq",
    },
    {
      label: t.contact,
      href: "/#contact",
    },
  ];

  const legalLinks: FooterLink[] = [
    {
      label: t.terms,
      href: "/terms",
    },
    {
      label: t.privacy,
      href: "/privacy",
    },
    {
      label: t.legalNotice,
      href: "/legal",
    },
  ];

  return (
    <footer
      id="tikemia-public-footer"
      aria-label={t.accessibility}
      className={[
        "relative",
        "w-full",
        "min-w-0",
        "shrink-0",
        "overflow-hidden",
        "bg-[#00432c]",
        "text-white",
      ].join(" ")}
    >
      {/* ==================================================
          BANDE SUPÉRIEURE AUX COULEURS TIKEMIA

          Fine décoration uniquement.
      ================================================== */}

      <div
        aria-hidden="true"
        className="h-0.75 w-full bg-linear-to-r from-[#05912d] via-[#f8cf19] to-[#e22130]"
      />

      {/* ==================================================
          CONTENU DU FOOTER

          MOBILE :
          2 colonnes pour les rubriques.

          PC :
          Logo + 4 rubriques horizontales.

          Aucun max-width.
          Largeur totale.
      ================================================== */}

      <div className="w-full px-4 pt-5 pb-5 sm:px-6 lg:px-8 lg:pt-6 lg:pb-5 xl:px-10">
        <div className="grid w-full min-w-0 grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-3 lg:grid-cols-[1.35fr_0.8fr_0.85fr_1fr_1.1fr] lg:gap-x-7 xl:gap-x-10">
          {/* ================================================
              IDENTITÉ TIKEMIA

              MOBILE :
              Logo sur toute la ligne.

              PC :
              Première colonne.
          ================================================= */}

          <div className="col-span-2 min-w-0 sm:col-span-3 lg:col-span-1">
            <Link
              href="/"
              aria-label="TIKEMIA — Accueil"
              className="inline-flex max-w-full items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Image
                src={LOGO}
                alt="TIKEMIA"
                width={180}
                height={64}
                className="h-auto max-h-14 w-auto max-w-43.75 object-contain object-left"
              />
            </Link>

            <p className="mt-3 max-w-72.5 text-[12px] leading-relaxed text-[#d5e7db] sm:text-[13px]">
              {t.tagline}
            </p>

            <div className="mt-3 inline-flex max-w-full items-start gap-2 text-[11px] leading-relaxed text-[#b5d6c2]">
              <ShieldCheck
                size={16}
                className="mt-px shrink-0 text-[#f9cc20]"
              />

              <span>{t.secure}</span>
            </div>
          </div>

          {/* ================================================
              EXPLORER
          ================================================= */}

          <FooterColumn
            title={t.explore}
            links={exploreLinks}
          />

          {/* ================================================
              ASSISTANCE
          ================================================= */}

          <FooterColumn
            title={t.support}
            links={supportLinks}
          />

          {/* ================================================
              LÉGAL
          ================================================= */}

          <FooterColumn
            title={t.legal}
            links={legalLinks}
          />

          {/* ================================================
              RÉSEAUX SOCIAUX

              Toutes les pages utilisent
              l'identifiant tikemia0.
          ================================================= */}

          <div className="min-w-0">
            <h2 className="mb-3 text-[13px] font-extrabold text-white sm:text-sm">
              {t.follow}
            </h2>

            <div
              aria-label={t.socialLabel}
              className="flex max-w-full flex-wrap items-center gap-2"
            >
              {/* FACEBOOK */}

              <SocialIcon
                href={SOCIAL_LINKS.facebook}
                name="Facebook"
              >
                <SocialBrandIcon network="facebook" />
              </SocialIcon>

              {/* INSTAGRAM */}

              <SocialIcon
                href={SOCIAL_LINKS.instagram}
                name="Instagram"
              >
                <SocialBrandIcon network="instagram" />
              </SocialIcon>

              {/* X / TWITTER */}

              <SocialIcon
                href={SOCIAL_LINKS.x}
                name="X"
              >
                <span
                  aria-hidden="true"
                  className="text-[19px] font-semibold leading-none"
                >
                  𝕏
                </span>
              </SocialIcon>

              {/* YOUTUBE */}

              <SocialIcon
                href={SOCIAL_LINKS.youtube}
                name="YouTube"
              >
                <SocialBrandIcon network="youtube" />
              </SocialIcon>

              {/* LINKEDIN */}

              <SocialIcon
                href={SOCIAL_LINKS.linkedin}
                name="LinkedIn"
              >
                <SocialBrandIcon network="linkedin" />
              </SocialIcon>
            </div>

            <p className="mt-3 text-xs font-semibold text-[#d9e9de]">
              @tikemia0
            </p>
          </div>
        </div>

        {/* ==================================================
            BAS DU FOOTER

            Ligne de séparation + copyright.

            Compact, aligné et responsive.
        ================================================== */}

        <div className="mt-5 border-t border-white/15 pt-4 lg:mt-6">
          <div className="flex flex-col gap-2 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <p className="text-[11px] leading-relaxed text-[#d0e2d6] sm:text-xs">
              © {year !== null ? `${year} ` : ""}TIKEMIA.
              {" "}
              {t.rights}
            </p>

            <div className="flex items-center justify-center gap-2 text-[11px] text-[#bedac8] sm:justify-end">
              <Ticket
                size={15}
                className="text-[#f6d024]"
              />

              <span>TIKEMIA</span>

              <span aria-hidden="true">•</span>

              <Heart
                size={14}
                className="text-[#f26b73]"
              />

              <span>{t.secure}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================
          ESPACE DE SÉCURITÉ MOBILE

          Empêche le footer d'être recouvert
          par les 5 menus fixes.

          Barre mobile :
          76px + safe-area-inset-bottom.

          Sur PC, aucun espace supplémentaire.
      ================================================== */}

      <div
        aria-hidden="true"
        className="h-[calc(76px+env(safe-area-inset-bottom))] w-full lg:hidden"
      />
    </footer>
  );
}
