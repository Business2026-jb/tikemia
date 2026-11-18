
import type { MetadataRoute } from "next";

/**
 * ============================================================
 * TIKEMIA — MANIFEST PWA
 * ============================================================
 *
 * Fichier :
 * src/app/manifest.ts
 *
 * Objectif :
 * Permettre l'installation de TIKEMIA
 * comme application web sur :
 *
 * - Android
 * - iPhone / iPad
 * - Ordinateur
 *
 * Ce manifest utilise les icônes officielles
 * présentes dans public/icons/.
 *
 * Aucun accès PostgreSQL.
 * Aucune modification des API.
 * Aucune dépendance supplémentaire.
 *
 * ============================================================
 */

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Identité officielle
    id: "/",

    name: "TIKEMIA",

    short_name: "TIKEMIA",

    description:
      "TIKEMIA — Découvrez des événements, achetez vos billets en ligne, retrouvez vos billets avec QR code et participez aux cagnottes.",

    // Langue et lecture
    lang: "fr",

    dir: "ltr",

    // Installation et navigation
    start_url: "/",

    scope: "/",

    display: "standalone",

    orientation: "any",

    // Couleurs officielles TIKEMIA
    background_color: "#FFFFFF",

    theme_color: "#087A32",

    // Catégories de l'application
    categories: [
      "entertainment",
      "lifestyle",
      "shopping",
    ],

    // Icônes officielles
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],

    // Capture de liens lorsque supportée
    prefer_related_applications: false,
  };
}
