import type {
  Metadata,
  Viewport,
} from "next";

import { GoogleAnalytics } from "@next/third-parties/google";

import "./globals.css";

const APP_NAME =
  "Tikemia";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.APP_URL?.trim() ||
  "https://tikemia.com";

const CLIENT_SOCIAL_IMAGE =
  "/imageclient.png";

const SITE_ICON =
  "/favicon.png";

const PWA_ICON_192 =
  "/icons/icon-192x192.png";

const PWA_ICON_512 =
  "/icons/icon-512x512.png";

const APPLE_TOUCH_ICON =
  "/icons/apple-touch-icon.png";

const GOOGLE_ANALYTICS_ID =
  process.env.NEXT_PUBLIC_GA_ID?.trim() ||
  "G-FE8WSP77Q9";

export const metadata: Metadata = {
  metadataBase:
    new URL(APP_URL),

  title: {
    default:
      "Tikemia — Réservez vos billets pour les meilleurs événements",

    template:
      "%s | Tikemia",
  },

  description:
    "Découvrez et réservez facilement vos billets pour les meilleurs concerts, festivals, conférences, spectacles, événements sportifs et expériences en Afrique.",

  applicationName:
    APP_NAME,

  authors: [
    {
      name:
        APP_NAME,

      url:
        APP_URL,
    },
  ],

  creator:
    APP_NAME,

  publisher:
    APP_NAME,

  generator:
    "Next.js",

  category:
    "Billetterie et événements",

  keywords: [
    "Tikemia",
    "billetterie en ligne",
    "billets événements",
    "tickets événements",
    "concerts en Afrique",
    "festivals en Afrique",
    "conférences",
    "spectacles",
    "événements sportifs",
    "réservation de billets",
    "billets électroniques",
    "événements à Cotonou",
    "événements à Abidjan",
    "événements à Dakar",
    "événements à Lomé",
  ],

  referrer:
    "origin-when-cross-origin",

  formatDetection: {
    email:
      false,

    address:
      false,

    telephone:
      false,
  },

  manifest:
    "/manifest.webmanifest",

  icons: {
    icon: [
      {
        url:
          SITE_ICON,

        type:
          "image/png",

        sizes:
          "512x512",
      },

      {
        url:
          PWA_ICON_192,

        type:
          "image/png",

        sizes:
          "192x192",
      },

      {
        url:
          PWA_ICON_512,

        type:
          "image/png",

        sizes:
          "512x512",
      },
    ],

    shortcut: [
      {
        url:
          SITE_ICON,

        type:
          "image/png",
      },
    ],

    apple: [
      {
        url:
          APPLE_TOUCH_ICON,

        type:
          "image/png",

        sizes:
          "180x180",
      },
    ],
  },

  alternates: {
    canonical:
      "/",
  },

  openGraph: {
    type:
      "website",

    locale:
      "fr_FR",

    url:
      "/",

    siteName:
      APP_NAME,

    title:
      "Tikemia — Vivez l’expérience des meilleurs événements",

    description:
      "Réservez facilement vos billets pour les meilleurs concerts, festivals, conférences, spectacles et événements en Afrique.",

    images: [
      {
        url:
          CLIENT_SOCIAL_IMAGE,

        width:
          1536,

        height:
          1024,

        alt:
          "Tikemia — Réservez vos billets pour les meilleurs événements",
      },
    ],
  },

  twitter: {
    card:
      "summary_large_image",

    title:
      "Tikemia — Vivez l’expérience des meilleurs événements",

    description:
      "Découvrez et réservez vos billets pour les meilleurs événements sur Tikemia.",

    images: [
      {
        url:
          CLIENT_SOCIAL_IMAGE,

        alt:
          "Tikemia — Réservez vos billets pour les meilleurs événements",
      },
    ],
  },

  robots: {
    index:
      true,

    follow:
      true,

    nocache:
      false,

    googleBot: {
      index:
        true,

      follow:
        true,

      noimageindex:
        false,

      "max-video-preview":
        -1,

      "max-image-preview":
        "large",

      "max-snippet":
        -1,
    },
  },

  appleWebApp: {
    capable:
      true,

    title:
      APP_NAME,

    statusBarStyle:
      "black-translucent",
  },

  other: {
    "mobile-web-app-capable":
      "yes",

    "apple-mobile-web-app-capable":
      "yes",

    "apple-mobile-web-app-title":
      APP_NAME,

    "msapplication-TileColor":
      "#03070a",
  },
};

export const viewport:
  Viewport = {
  width:
    "device-width",

  initialScale:
    1,

  maximumScale:
    5,

  viewportFit:
    "cover",

  themeColor: [
    {
      media:
        "(prefers-color-scheme: light)",

      color:
        "#03070a",
    },

    {
      media:
        "(prefers-color-scheme: dark)",

      color:
        "#03070a",
    },
  ],

  colorScheme:
    "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children:
    React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
    >
      <body>
        {children}
      </body>

      <GoogleAnalytics
        gaId={GOOGLE_ANALYTICS_ID}
      />
    </html>
  );
}