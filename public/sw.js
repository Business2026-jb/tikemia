


/**
 * ============================================================
 * TIKEMIA — SERVICE WORKER PWA
 * ============================================================
 *
 * Fichier : public/sw.js
 *
 * Objectifs :
 * - Activer le service worker de TIKEMIA.
 * - Prendre en charge le cycle de vie PWA.
 * - Mettre en cache uniquement les icônes publiques.
 * - Préserver la confidentialité des utilisateurs.
 * - Ne jamais intercepter les paiements ou API.
 * - Ne jamais mettre les billets ou QR codes en cache.
 * - Éviter les caches HTML obsolètes.
 *
 * Compatible avec Next.js App Router.
 *
 * Aucun package externe nécessaire.
 * ============================================================
 */

"use strict";

/**
 * Version du cache.
 *
 * Modifier cette version uniquement lorsque
 * les ressources publiques mises en cache changent.
 */
const CACHE_VERSION = "v1";

const CACHE_NAME = `tikemia-pwa-static-${CACHE_VERSION}`;

/**
 * Icônes publiques autorisées en cache.
 *
 * Nous ne mettons pas en cache :
 * - Les pages HTML
 * - Les données utilisateurs
 * - Les API
 * - Les sessions
 * - Les billets
 * - Les QR codes
 * - Les paiements
 */
const STATIC_ASSETS = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

/**
 * Préfixe réservé aux caches créés
 * par ce service worker.
 *
 * Aucun cache tiers ne sera supprimé.
 */
const CACHE_PREFIX = "tikemia-pwa-static-";

/**
 * Vérifier qu'une requête concerne
 * uniquement une icône explicitement autorisée.
 */
function isAllowedStaticAsset(request) {
  if (request.method !== "GET") {
    return false;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return false;
  }

  return STATIC_ASSETS.includes(url.pathname);
}

/**
 * ============================================================
 * INSTALLATION
 * ============================================================
 *
 * Précharger les icônes publiques disponibles.
 *
 * Une icône temporairement indisponible
 * ne doit pas bloquer l'installation du SW.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      await Promise.allSettled(
        STATIC_ASSETS.map(async (asset) => {
          const request = new Request(asset, {
            method: "GET",
            credentials: "omit",
            cache: "reload",
          });

          const response = await fetch(request);

          if (
            response.ok &&
            response.type === "basic"
          ) {
            await cache.put(request, response);
          }
        })
      );
    })()
  );
});

/**
 * ============================================================
 * ACTIVATION
 * ============================================================
 *
 * Nettoyer uniquement les anciens caches
 * d'icônes TIKEMIA créés par ce service worker.
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter(
            (name) =>
              name.startsWith(CACHE_PREFIX) &&
              name !== CACHE_NAME
          )
          .map((name) => caches.delete(name))
      );

      /**
       * Contrôler les pages déjà ouvertes
       * sans attendre leur rechargement.
       */
      await self.clients.claim();
    })()
  );
});

/**
 * ============================================================
 * INTERCEPTION DES REQUÊTES
 * ============================================================
 *
 * Seules les icônes publiques sont interceptées.
 *
 * Toutes les autres requêtes sont entièrement
 * laissées au navigateur et au réseau.
 *
 * Cela inclut :
 * - /api/*
 * - /admin/*
 * - /organizer/*
 * - Authentification
 * - Paiements
 * - Billets et QR codes
 * - Cagnottes
 * - Pages Next.js
 * - Ressources dynamiques
 */
self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (!isAllowedStaticAsset(request)) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      const cachedResponse = await cache.match(request);

      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const response = await fetch(request);

        if (
          response.ok &&
          response.type === "basic"
        ) {
          await cache.put(
            request,
            response.clone()
          );
        }

        return response;
      } catch {
        /**
         * Pas de fausse réponse HTML.
         * Pas de redirection vers une page privée.
         *
         * Le navigateur reçoit une erreur réseau
         * si l'icône est indisponible et absente du cache.
         */
        return Response.error();
      }
    })()
  );
});

/**
 * ============================================================
 * FIN DU SERVICE WORKER TIKEMIA
 * ============================================================
 *
 * Pas de notifications push dans cette version.
 * Pas de synchronisation en arrière-plan.
 * Pas de cache des pages ou données privées.
 *
 * Ces fonctionnalités pourront être ajoutées
 * uniquement lorsqu'elles seront nécessaires.
 * ============================================================
 */
