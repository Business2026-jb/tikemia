import { Suspense } from "react";

import type { Metadata, Viewport } from "next";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import "./globals.css";

/**
 * ============================================================
 * TIKEMIA — ROOT LAYOUT
 * ============================================================
 *
 * Configuration principale de la plateforme.
 *
 * - Site web TIKEMIA
 * - Application PWA Android
 * - Application PWA iPhone / iPad
 * - Installation sur ordinateur
 * - Français par défaut
 * - Compatible Next.js App Router
 *
 * ============================================================
 */

export const metadata: Metadata = {
  title: "TIKEMIA | Billetterie et cagnottes",

  description:
    "Publiez vos événements, gérez votre billetterie et lancez vos cagnottes avec TIKEMIA.",

  applicationName: "TIKEMIA",

  manifest: "/manifest.webmanifest",

  appleWebApp: {
    capable: true,
    title: "TIKEMIA",
    statusBarStyle: "default",
  },

  icons: {
    icon: [
      {
        url: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],

    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },

  formatDetection: {
    telephone: false,
  },
};

/**
 * Couleur du navigateur et affichage mobile.
 *
 * Next.js recommande de déclarer ces valeurs
 * séparément des métadonnées classiques.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#087A32",
};

/**
 * Layout principal TIKEMIA.
 *
 * InstallPrompt ne modifie pas les routes,
 * les sessions ou les composants existants.
 */
export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      data-scroll-behavior="smooth"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        {children}

        {/* Installation TIKEMIA Android / iPhone / PC */}
        <Suspense fallback={null}><InstallPrompt /></Suspense>
      </body>
    </html>
  );
}
