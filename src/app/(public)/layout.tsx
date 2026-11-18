
import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import PublicNavigation from "@/components/public/PublicNavigation";
import PublicFooter from "@/components/public/PublicFooter";

/* ==========================================================
   TIKEMIA — LAYOUT PRINCIPAL DE L'ESPACE PUBLIC

   FICHIER :
   src/app/(public)/layout.tsx

   STRUCTURE :
   1. Header public PC / mobile
   2. Contenu de la page
   3. Footer public PC / mobile
   4. Navigation mobile fixe (gérée par PublicNavigation)

   OBJECTIFS :
   - Architecture commune à toutes les pages publiques
   - Responsive PC, tablette et mobile
   - Largeur 100 %
   - Aucun max-width imposé
   - Aucun espace extérieur inutile
   - Aucun espacement entre les sections
   - Un seul header
   - Un seul footer
   - Barre mobile avec cinq menus
   - Séparation de l'espace organisateur
   - Aucun nouveau fichier CSS

   IMPORTANT :
   PublicNavigation et PublicFooter
   doivent être exportés par défaut
   depuis leurs fichiers respectifs.
========================================================== */

/* ==========================================================
   MÉTADONNÉES DE L'ESPACE PUBLIC
========================================================== */

export const metadata: Metadata = {
  title: {
    default: "TIKEMIA — Événements, billets et cagnottes",
    template: "%s | TIKEMIA",
  },

  description:
    "Découvrez les événements, réservez vos billets et soutenez des cagnottes sur TIKEMIA.",

  applicationName: "TIKEMIA",

  robots: {
    index: true,
    follow: true,
  },

  openGraph: {
    type: "website",
    siteName: "TIKEMIA",
    title: "TIKEMIA — Événements, billets et cagnottes",
    description:
      "Découvrez les événements, achetez vos billets et soutenez des cagnottes sur TIKEMIA.",
  },
};

/* ==========================================================
   TYPES
========================================================== */

type PublicLayoutProps = Readonly<{
  children: ReactNode;
}>;

/* ==========================================================
   LAYOUT PUBLIC
========================================================== */

export default function PublicLayout({
  children,
}: PublicLayoutProps) {
  return (
    <div
      id="tikemia-public-root"
      className={[
        "relative",
        "flex",
        "min-h-dvh",
        "w-full",
        "min-w-0",
        "flex-col",
        "overflow-x-clip",
        "bg-white",
        "text-[#14243A]",
        "m-0",
        "p-0",
      ].join(" ")}
    >
      {/* ==================================================
          1. NAVIGATION PUBLIQUE

          Affiche automatiquement :

          PC :
          - Logo TIKEMIA
          - Accueil
          - Événements
          - Cagnottes
          - Comment ça marche
          - Contact
          - Recherche
          - FR / EN

          MOBILE :
          - Bouton menu
          - Logo TIKEMIA
          - Recherche

          BARRE INFÉRIEURE :
          - Accueil
          - Événements
          - Billets (centre)
          - Transfert
          - Compte

          Aucun header supplémentaire.
      ================================================== */}

      <Suspense fallback={<div className="h-16 w-full shrink-0 bg-white lg:h-19" aria-busy="true" />}><PublicNavigation /></Suspense>

      {/* ==================================================
          2. CONTENU PRINCIPAL

          Toutes les pages publiques seront
          affichées dans cette zone.

          - Pleine largeur
          - Aucune limite max-width
          - Aucun padding extérieur imposé
          - Aucun margin extérieur
          - Aucun gap imposé
          - Aucun espace inutile sous le contenu

          Chaque page définit uniquement
          ses espacements internes nécessaires.

          Important :
          Pas de padding inférieur supplémentaire
          ici, puisque le PublicFooter réserve
          déjà l'espace de la barre mobile.
      ================================================== */}

      <main
        id="tikemia-public-content"
        className={[
          "relative",
          "flex",
          "w-full",
          "min-w-0",
          "flex-1",
          "flex-col",
          "m-0",
          "p-0",
        ].join(" ")}
      >
        <Suspense fallback={<div className="min-h-48 w-full bg-white" aria-busy="true" />}>{children}</Suspense>
      </main>

      {/* ==================================================
          3. FOOTER PUBLIC

          Affiché automatiquement sur toutes
          les pages de l'espace public.

          Rubriques :
          - Logo TIKEMIA
          - Explorer
          - Assistance
          - Légal
          - Suivez-nous

          Réseaux sociaux :
          - Facebook
          - Instagram
          - X
          - YouTube
          - LinkedIn

          Identifiant :
          @tikemia0

          Responsive PC et mobile.

          Le footer prévoit lui-même la zone
          nécessaire à la navigation inférieure
          fixe sur mobile.

          Aucun second footer ne doit être
          ajouté dans les pages individuelles.
      ================================================== */}

      <Suspense fallback={null}><PublicFooter /></Suspense>
    </div>
  );
}
