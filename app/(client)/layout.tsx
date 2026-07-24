import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
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

  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.APP_URL?.trim() ||
      "https://tikemia.com",
  ),

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
  },

  twitter: {
    card: "summary_large_image",
    title: "Tikemia — Billetterie en ligne",
    description:
      "Découvrez et achetez vos billets pour les meilleurs événements sur Tikemia.",
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

  category: "Billetterie et événements",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#03070a",
};

type ClientLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function ClientLayout({
  children,
}: ClientLayoutProps) {
  return (
    <div className="relative min-h-dvh overflow-x-clip bg-[#03070a] text-white">
      {/*
        Le lien d’évitement améliore l’accessibilité au clavier.
        Il permet d’aller directement au contenu principal.
      */}
      <a
        href="#client-main-content"
        className="sr-only fixed left-4 top-4 z-[100] rounded-lg bg-lime-400 px-4 py-2 text-sm font-black text-black focus:not-sr-only"
      >
        Aller au contenu principal
      </a>

      {/*
        Décoration globale légère.
        Elle respecte l’identité sombre et premium de Tikemia
        sans bloquer les interactions.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-emerald-500/[0.045] blur-[120px]" />

        <div className="absolute -right-48 top-[18%] h-[430px] w-[430px] rounded-full bg-orange-500/[0.035] blur-[130px]" />

        <div className="absolute bottom-[-220px] left-1/2 h-[460px] w-[720px] -translate-x-1/2 rounded-full bg-red-500/[0.025] blur-[150px]" />
      </div>

      {/*
        Le header client global sera ajouté ici à l’étape suivante :

        <ClientHeader />

        Il restera identique pour :
        - les visiteurs invités ;
        - les clients connectés ;
        - les pages d’achat ;
        - les pages du compte client.

        Seules les actions du compte changeront selon la session.
      */}

      <div className="relative z-10 flex min-h-dvh w-full flex-col">
        <div
          id="client-main-content"
          className="min-w-0 flex-1"
        >
          {children}
        </div>

        {/*
          Le footer client global sera ajouté ici :

          <ClientFooter />

          Il sera unique sur toute l’expérience client.
          Aucun lien organisateur ne sera ajouté.
        */}
      </div>

      {/*
        La navigation inférieure mobile sera ajoutée ici :

        <ClientMobileBottomNavigation />

        Elle sera principalement visible en mode mobile/PWA.
      */}
    </div>
  );
}