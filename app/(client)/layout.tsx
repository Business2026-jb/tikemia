import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import ClientConditionalFooter from "@/components/client/footer/client-conditional-footer";
import ClientHeader from "@/components/client/header/client-header";
import ClientMobileBottomNav from "@/components/client/navigation/client-mobile-bottom-nav";
import { getClientHeaderData } from "@/lib/client/get-client-header-data";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.APP_URL?.trim() ||
  "https://tikemia.com";

/**
 * Le layout dépend du cookie de session du client.
 * Il doit donc être recalculé à chaque requête afin que le header
 * et la navigation mobile reflètent immédiatement la connexion
 * ou la déconnexion.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),

  title: {
    default: "Tikemia — Billetterie en ligne",
    template: "%s | Tikemia",
  },

  description:
    "Découvrez et achetez vos billets pour les meilleurs concerts, festivals, conférences, spectacles, événements sportifs et culturels sur Tikemia.",

  applicationName: "Tikemia",

  keywords: [
    "Tikemia",
    "billetterie",
    "tickets",
    "événements",
    "concerts",
    "festivals",
    "spectacles",
    "conférences",
    "sport",
    "Afrique",
  ],

  authors: [
    {
      name: "Tikemia",
    },
  ],

  creator: "Tikemia",
  publisher: "Tikemia",
  category: "Billetterie et événements",

  alternates: {
    canonical: "/",
  },

  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName: "Tikemia",
    title: "Tikemia — Billetterie en ligne",
    description:
      "Découvrez et achetez vos billets pour les meilleurs événements sur Tikemia.",

    images: [
      {
        url: "/imageclient.png",
        width: 1536,
        height: 1024,
        alt: "Tikemia — Réservez vos billets pour les meilleurs événements",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Tikemia — Billetterie en ligne",
    description:
      "Découvrez et achetez vos billets pour les meilleurs événements sur Tikemia.",

    images: [
      {
        url: "/imageclient.png",
        alt: "Tikemia — Réservez vos billets pour les meilleurs événements",
      },
    ],
  },

  robots: {
    index: true,
    follow: true,

    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#03070a",
  colorScheme: "dark",
};

type ClientLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function ClientLayout({
  children,
}: ClientLayoutProps) {
  const headerData =
    await getClientHeaderData();

  const mobileUser =
    headerData.user
      ? {
          id: headerData.user.id,
        }
      : null;

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-[#03070a] text-white">
      <a
        href="#client-main-content"
        className="sr-only fixed left-4 top-4 z-[200] rounded-xl bg-lime-400 px-4 py-2.5 text-sm font-black text-black shadow-xl focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-white"
      >
        Aller au contenu principal
      </a>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-emerald-500/[0.045] blur-[120px]" />

        <div className="absolute -right-48 top-[18%] h-[430px] w-[430px] rounded-full bg-orange-500/[0.035] blur-[130px]" />

        <div className="absolute bottom-[-220px] left-1/2 h-[460px] w-[720px] -translate-x-1/2 rounded-full bg-red-500/[0.025] blur-[150px]" />
      </div>

      <div className="relative z-10 flex min-h-dvh w-full flex-col">
        <ClientHeader
          user={headerData.user}
          loginHref={headerData.loginHref}
          registerHref={headerData.registerHref}
        />

        <main
          id="client-main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 outline-none"
        >
          {children}
        </main>

        <ClientConditionalFooter />
      </div>

      <ClientMobileBottomNav
        user={mobileUser}
        homeHref="/"
        exploreHref="/events"
        favoritesHref={headerData.favoritesHref}
        ticketsHref={headerData.ticketsHref}
        accountHref={headerData.ordersHref}
        loginHref={headerData.loginHref}
      />
    </div>
  );
}