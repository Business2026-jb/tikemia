import type {
  MetadataRoute,
} from "next";

export default function manifest():
  MetadataRoute.Manifest {
  return {
    id:
      "/",

    name:
      "Tikemia",

    short_name:
      "Tikemia",

    description:
      "Découvrez, réservez et gérez vos billets pour les meilleurs événements avec Tikemia.",

    start_url:
      "/",

    scope:
      "/",

    display:
      "standalone",

    orientation:
      "portrait-primary",

    background_color:
      "#03070a",

    theme_color:
      "#03070a",

    lang:
      "fr",

    categories: [
      "entertainment",
      "events",
      "lifestyle",
    ],

    icons: [
      {
        src:
          "/icons/icon-192x192.png",
        sizes:
          "192x192",
        type:
          "image/png",
        purpose:
          "any",
      },

      {
        src:
          "/icons/icon-512x512.png",
        sizes:
          "512x512",
        type:
          "image/png",
        purpose:
          "any",
      },
    ],
  };
}