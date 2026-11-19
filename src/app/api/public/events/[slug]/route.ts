import { getPlatformPrisma } from "@/lib/payments/fulfillment";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

/** Signe uniquement les m?dias des publications d?j? autoris?es par cette API. */
async function resolvePublicMedia<T>(payload: T, defaultBucket: string): Promise<T> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return payload;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(10000) }) } });
  const targets: Array<{ record: Record<string, unknown>; field: string; path: string; bucket: string }> = [];
  function collect(value: unknown, bucket: string) {
    if (Array.isArray(value)) { value.forEach(item => collect(item, bucket)); return; }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    for (const [reference, field, mediaBucket] of [
      ["storageKey", "url", bucket], ["imageStorageKey", "imageUrl", bucket],
      ["photoStorageKey", "photoUrl", process.env.SUPABASE_AVATAR_BUCKET || "profile-avatars"],
    ]) {
      const path = record[reference];
      if (!record[field] && typeof path === "string" && /^[a-zA-Z0-9_/-]+\.(?:jpe?g|png|webp)$/i.test(path) && !path.startsWith("/") && !path.split("/").includes("..")) {
        targets.push({ record, field, path, bucket: mediaBucket });
      }
    }
    for (const [name, child] of Object.entries(record)) {
      const childBucket = name === "campaigns" || name === "campaign" ? process.env.SUPABASE_CAMPAIGN_BUCKET || "campaign-images" : name === "events" || name === "event" ? process.env.SUPABASE_EVENT_BUCKET || "event-images" : bucket;
      collect(child, childBucket);
    }
  }
  collect(payload, defaultBucket);
  const buckets = [...new Set(targets.map(target => target.bucket))];
  await Promise.all(buckets.map(async bucket => {
    const paths = [...new Set(targets.filter(target => target.bucket === bucket).map(target => target.path))];
    try {
      const { data, error } = await client.storage.from(bucket).createSignedUrls(paths, 300);
      if (error || !data) return;
      const urls = new Map(data.filter(item => item.path && item.signedUrl).map(item => [item.path, item.signedUrl]));
      for (const target of targets) if (target.bucket === bucket) target.record[target.field] = urls.get(target.path) ?? null;
    } catch { /* Une image absente ne bloque pas la publication. */ }
  }));
  return payload;
}

import { NextRequest, NextResponse } from "next/server";



const getPrisma = getPlatformPrisma;

/* ==========================================================
   TIKEMIA — API PUBLIQUE DÉTAILS ÉVÉNEMENT

   FICHIER :
   src/app/api/public/events/[slug]/route.ts

   ROUTE :
   GET /api/public/events/afrobeat-night

   OBJECTIF :
   Récupérer un événement publié avec
   toutes les informations nécessaires
   à sa page de détails PC et mobile.

   MODÈLES PRISMA EXISTANTS :
   - Event
   - EventImage
   - Organization
   - User
   - Venue
   - EventSchedule
   - TicketCategory

   FONCTIONNALITÉS :
   - Recherche par slug unique
   - Événement PUBLISHED uniquement
   - Organisation active obligatoire
   - Toutes les images de la galerie
   - Image principale
   - Nom et photo de l'organisateur
   - Titre et description
   - Catégorie existante
   - Toutes les dates et séances
   - Fuseau horaire
   - Adresse complète du lieu
   - Image du lieu
   - Adresse pour la carte
   - Catégories de billets actives
   - Prix en unités mineures
   - Capacités des catégories
   - Devise de l'événement

   SÉCURITÉ :
   - Lecture publique seulement
   - Aucune donnée privée utilisateur
   - Aucun mot de passe
   - Aucun email privé
   - Aucune donnée de paiement
   - Aucun jeton QR code
   - Aucune écriture en base
   - Aucune information fictive

   IMPORTANT :
   Cette API ne crée pas de commande.
   Elle ne réserve pas de places.
   Elle ne déclenche aucun paiement.
   Elle ne calcule pas les frais de caisse.

   PC / MOBILE :
   Même réponse JSON pour les deux.
========================================================== */

/* ==========================================================
   CONFIGURATION
========================================================== */

const MAX_SLUG_LENGTH = 180;

const MAX_GALLERY_IMAGES = 10;

const RESPONSE_HEADERS = {
  "Cache-Control":
    "no-store, no-cache, must-revalidate, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

/* ==========================================================
   TYPES PUBLICS
========================================================== */

type Money = {
  amountMinor: string;
  currency: string;
};

type PublicImage = {
  id: string;
  url: string | null;
  storageKey: string;
  isPrimary: boolean;
  position: number;
};

type PublicOrganizer = {
  blueBadgeEnabled: boolean;
  id: string;
  name: string;

  profileName: string;

  photoUrl: string | null;
  photoStorageKey: string | null;
};

type PublicVenue = {
  name: string;
  address: string;
  city: string;
  country: string;

  fullAddress: string;

  imageUrl: string | null;
  imageStorageKey: string | null;

  mapQuery: string | null;
  mapUrl: string | null;
};

type PublicSchedule = {
  id: string;
  startsAt: string;
  endsAt: string | null;
  label: string | null;
  timeZone: string;
};

type PublicTicketCategory = {
  id: string;
  name: string;
  description: string | null;

  price: Money;

  capacity: number;
  currency: string;
  isActive: boolean;
};

type PublicEvent = {
  id: string;
  slug: string;

  title: string;
  description: string;
  category: string;

  status: "PUBLISHED";

  organizer: PublicOrganizer;

  imageUrl: string | null;
  imageStorageKey: string | null;

  images: PublicImage[];

  venue: PublicVenue | null;

  scheduleKind: string;
  ticketValidity: string;

  schedule: PublicSchedule | null;
  schedules: PublicSchedule[];

  ticketCategories: PublicTicketCategory[];

  pricing: {
    from: Money | null;
    isFree: boolean;
    currency: string;
  };

  currency: string;
  timeZone: string;

  capacity: number;

  publishedAt: string | null;

  href: string;
};

/* ==========================================================
   UTILITAIRES
========================================================== */

/**
 * Nettoie les chaînes facultatives
 * sans créer de valeurs fictives.
 */
function cleanOptional(
  value: string | null | undefined
): string | null {
  const clean = value?.trim();

  return clean || null;
}

/**
 * Montants Prisma BigInt.
 *
 * Les montants financiers sont renvoyés
 * sous forme de chaînes pour conserver
 * leur précision.
 *
 * Rappel :
 * XOF : 1 unité = 1 FCFA
 * EUR : 100 unités = 1 EUR
 * USD : 100 unités = 1 USD
 */
function money(
  amount: bigint,
  currency: string
): Money {
  return {
    amountMinor: amount.toString(),
    currency,
  };
}

/**
 * Les images utilisent storageKey
 * dans le Prisma TIKEMIA.
 *
 * Si la clé est déjà une URL publique
 * ou un chemin local utilisable,
 * elle est renvoyée comme URL.
 *
 * Sinon, la clé reste disponible
 * pour le résolveur de médias existant.
 *
 * Aucune URL Supabase fictive.
 */
function publicImageUrl(
  value: string | null | undefined
): string | null {
  const key = cleanOptional(value);

  if (!key) {
    return null;
  }

  if (
    key.startsWith("/") &&
    !key.startsWith("//") &&
    !key.includes("\\")
  ) {
    return key;
  }

  try {
    const url = new URL(key);

    if (url.protocol === "https:") {
      return url.toString();
    }

    if (
      url.protocol === "http:" &&
      (
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1"
      )
    ) {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Vérifie le slug provenant de l'URL.
 *
 * Le slug est le nom lisible
 * et unique de l'événement.
 *
 * Exemples :
 * afrobeat-night
 * festival-des-cultures
 * conference-business-2027
 *
 * Aucun identifiant technique
 * n'est nécessaire dans l'URL.
 */
function validSlug(
  value: string | undefined
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const slug = value.trim();

  if (
    slug.length === 0 ||
    slug.length > MAX_SLUG_LENGTH
  ) {
    return null;
  }

  if (
    slug.includes("/") ||
    slug.includes("\\") ||
    slug.includes("?") ||
    slug.includes("#") ||
    slug.includes("\0")
  ) {
    return null;
  }

  return slug;
}

/**
 * Construit l'adresse complète
 * avec les champs réels du lieu.
 *
 * Aucune coordonnée GPS inventée.
 */
function buildFullAddress(
  venue: {
    name: string;
    address: string;
    city: string;
    country: string;
  }
): string {
  const fields = [
    cleanOptional(venue.name),
    cleanOptional(venue.address),
    cleanOptional(venue.city),
    cleanOptional(venue.country),
  ].filter(
    (value): value is string =>
      typeof value === "string"
  );

  const seen = new Set<string>();
  const parts: string[] = [];
  for (const field of fields) {
    for (const value of field.split(/[,;\r\n]+/)) {
      const label = value.trim().replace(/\s+/g, " ");
      const key = label.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[’']/g, "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      parts.push(label);
    }
  }
  return parts.join(", ");
}

/**
 * Prépare une URL Google Maps
 * permettant d'ouvrir l'adresse.
 *
 * Ceci ne confirme pas une position
 * GPS exacte et ne nécessite pas
 * d'enregistrer des coordonnées.
 */
function buildMapUrl(
  fullAddress: string
): string | null {
  if (!fullAddress) {
    return null;
  }

  return (
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(fullAddress)
  );
}

/**
 * Réponses publiques cohérentes.
 */
function errorResponse(
  status: number,
  code: string,
  message: string
) {
  return NextResponse.json(
    {
      success: false,
      code,
      message,
    },
    {
      status,
      headers: RESPONSE_HEADERS,
    }
  );
}

/* ==========================================================
   GET — DÉTAILS D'UN ÉVÉNEMENT
========================================================== */

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{
      slug: string;
    }>;
  }
) {
  try {
    const prisma = getPrisma();

    /* ======================================================
       1. RÉCUPÉRATION DU SLUG

       Next.js App Router :
       paramètres dynamiques asynchrones.

       Exemple :
       /api/public/events/afrobeat-night
    ====================================================== */

    const { slug: rawSlug } =
      await context.params;

    const slug = validSlug(rawSlug);

    if (!slug) {
      return errorResponse(
        400,
        "INVALID_EVENT_SLUG",
        "L'adresse de cet événement est invalide."
      );
    }

    const now = new Date();

    /* ======================================================
       2. RECHERCHE DE L'ÉVÉNEMENT

       Conditions :
       - Slug exact
       - Statut PUBLISHED
       - Organisation active
       - Date de publication non future

       Les événements brouillons,
       suspendus ou annulés ne sont
       pas accessibles publiquement.
    ====================================================== */

    const alias = await prisma.appSetting.findUnique({ where: { key: "publication:event:" + slug }, select: { value: true } });
    const aliasValue = alias?.value;
    const legacyId = aliasValue && typeof aliasValue === "object" && !Array.isArray(aliasValue) && typeof aliasValue.id === "string" ? aliasValue.id : null;
    const event = await prisma.event.findFirst({
      where: {
        ...(legacyId ? { id: legacyId } : { slug }),

        status: "PUBLISHED",

        organization: {
          isActive: true,
        },

        OR: [
          {
            publishedAt: null,
          },
          {
            publishedAt: {
              lte: now,
            },
          },
        ],
      },

      select: {
        /* ================================================
           INFORMATIONS GÉNÉRALES
        ================================================ */

        id: true,
        slug: true,
        title: true,
        description: true,
        category: true,
        status: true,

        currency: true,
        timeZone: true,
        capacity: true,

        scheduleKind: true,
        ticketValidity: true,

        publishedAt: true,

        /* ================================================
           ORGANISATEUR
        ================================================ */

        organization: {
          select: { blueBadgeEnabled: true,
            id: true,
            name: true,
            logoStorageKey: true,

            owner: {
              select: {
                fullName: true,
                avatarStorageKey: true,
              },
            },
          },
        },

        /* ================================================
           CRÉATEUR DE L'ÉVÉNEMENT

           Utilisé seulement comme
           repli pour le profil public.
        ================================================ */

        createdBy: {
          select: {
            fullName: true,
            avatarStorageKey: true,
          },
        },

        /* ================================================
           GALERIE D'IMAGES

           Le Prisma permet :
           - isPrimary
           - position

           On respecte cet ordre.
        ================================================ */

        images: {
          orderBy: [
            {
              isPrimary: "desc",
            },
            {
              position: "asc",
            },
            {
              createdAt: "asc",
            },
          ],

          take: MAX_GALLERY_IMAGES,

          select: {
            id: true,
            storageKey: true,
            isPrimary: true,
            position: true,
          },
        },

        /* ================================================
           LIEU

           Nom, adresse, ville, pays
           et photographie du lieu.
        ================================================ */

        venue: {
          select: {
            name: true,
            address: true,
            city: true,
            country: true,
            imageKey: true,
          },
        },

        /* ================================================
           DATES ET SÉANCES

           Une date ou plusieurs dates
           selon le type d'événement.
        ================================================ */

        schedules: {
          orderBy: [
            {
              startsAt: "asc",
            },
            {
              id: "asc",
            },
          ],

          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            label: true,
          },
        },

        /* ================================================
           CATÉGORIES TARIFAIRES

           On utilise TicketCategory,
           déjà configuré dans Prisma.

           Aucune catégorie recréée.

           Une catégorie inactive
           ne doit pas être proposée
           pour une nouvelle commande.
        ================================================ */

        categories: {
          where: {
            isActive: true,
          },

          orderBy: [
            {
              price: "asc",
            },
            {
              createdAt: "asc",
            },
          ],

          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            currency: true,
            capacity: true,
            isActive: true,
          },
        },
      },
    });

    /* ======================================================
       3. ÉVÉNEMENT INTROUVABLE

       Même réponse pour :
       - Slug inexistant
       - Événement non publié
       - Organisation inactive

       Cela évite d'exposer des
       publications non publiques.
    ====================================================== */

    if (!event) {
      return errorResponse(
        404,
        "EVENT_NOT_FOUND",
        "Cet événement est introuvable ou indisponible."
      );
    }

    /* ======================================================
       4. ORGANISATEUR

       Nom :
       1. Organisation
       2. Propriétaire
       3. Créateur

       Photo :
       1. Logo de l'organisation
       2. Avatar du propriétaire
       3. Avatar du créateur
    ====================================================== */

    const organization =
      event.organization;

    const owner =
      organization.owner;

    const creator =
      event.createdBy;

    const organizerName =
      cleanOptional(organization.name) ??
      cleanOptional(owner.fullName) ??
      cleanOptional(creator.fullName) ??
      "";

    const organizerPhotoKey =
      cleanOptional(
        organization.logoStorageKey
      ) ??
      cleanOptional(
        owner.avatarStorageKey
      ) ??
      cleanOptional(
        creator.avatarStorageKey
      );

    const organizer: PublicOrganizer = {
 blueBadgeEnabled: organization.blueBadgeEnabled,
      id: organization.id,

      name: organizerName,

      profileName:
        cleanOptional(owner.fullName) ??
        cleanOptional(creator.fullName) ??
        "",

      photoUrl:
        publicImageUrl(organizerPhotoKey),

      photoStorageKey:
        organizerPhotoKey,
    };

    /* ======================================================
       5. GALERIE D'IMAGES

       Toutes les images sélectionnées
       sont conservées dans leur ordre.

       Le frontend pourra :
       - Afficher une grande image
       - Afficher les miniatures
       - Passer à l'image suivante
       - Revenir à l'image précédente
    ====================================================== */

    const images: PublicImage[] =
      event.images.map((image) => ({
        id: image.id,

        url: publicImageUrl(
          image.storageKey
        ),

        storageKey: image.storageKey,

        isPrimary: image.isPrimary,

        position: image.position,
      }));

    const primaryImage =
      images.find(
        (image) => image.isPrimary
      ) ??
      images[0] ??
      null;

    /* ======================================================
       6. LIEU DE L'ÉVÉNEMENT

       Adresse complète.
       Image du lieu.
       Lien Google Maps.

       Aucun point GPS inventé.
    ====================================================== */

    let venue: PublicVenue | null = null;

    if (event.venue) {
      const storedVenue =
        event.venue;

      const fullAddress =
        buildFullAddress(storedVenue);

      const venueImageKey =
        cleanOptional(
          storedVenue.imageKey
        );

      venue = {
        name: storedVenue.name,
        address: storedVenue.address,
        city: storedVenue.city,
        country: storedVenue.country,

        fullAddress,

        imageUrl:
          publicImageUrl(venueImageKey),

        imageStorageKey:
          venueImageKey,

        mapQuery:
          fullAddress || null,

        mapUrl:
          buildMapUrl(fullAddress),
      };
    }

    /* ======================================================
       7. DATES ET HORAIRES

       Les dates restent en ISO 8601.

       Le frontend doit les afficher
       dans event.timeZone.

       Aucune conversion incorrecte
       vers le fuseau du visiteur.
    ====================================================== */

    const schedules: PublicSchedule[] =
      event.schedules.map((schedule) => ({
        id: schedule.id,

        startsAt:
          schedule.startsAt.toISOString(),

        endsAt:
          schedule.endsAt?.toISOString() ??
          null,

        label:
          cleanOptional(schedule.label),

        timeZone:
          event.timeZone,
      }));

    /* ======================================================
       8. SÉANCE PRINCIPALE

       Préférence :
       - Prochaine séance non terminée
       - Sinon première séance connue

       Les autres séances restent
       accessibles dans schedules.
    ====================================================== */

    const principalSchedule =
      event.schedules.find((schedule) =>
        schedule.endsAt
          ? schedule.endsAt >= now
          : schedule.startsAt >= now
      ) ??
      event.schedules[0] ??
      null;

    const selectedSchedule =
      principalSchedule
        ? schedules.find(
            (schedule) =>
              schedule.id ===
              principalSchedule.id
          ) ?? null
        : null;

    /* ======================================================
       9. CATÉGORIES DE BILLETS

       Chaque catégorie possède :
       - ID interne
       - Nom
       - Description
       - Prix
       - Devise
       - Capacité configurée
       - Statut actif

       Ces informations permettront
       au frontend d'afficher :

       VIP         25 000 FCFA   - 0 +
       Standard    10 000 FCFA   - 0 +
       Gradins      5 000 FCFA   - 0 +

       Les exemples ci-dessus sont
       seulement explicatifs.

       L'API renvoie uniquement
       les catégories réellement
       présentes dans PostgreSQL.
    ====================================================== */

    const ticketCategories:
      PublicTicketCategory[] =
        event.categories.map((category) => ({
          id: category.id,

          name: category.name,

          description:
            cleanOptional(
              category.description
            ),

          price: money(
            category.price,
            category.currency
          ),

          capacity:
            category.capacity,

          currency:
            category.currency,

          isActive:
            category.isActive,
        }));

    /* ======================================================
       10. PRIX MINIMUM

       Récupéré depuis les catégories
       actives et leurs prix réels.

       Aucun prix inventé.
    ====================================================== */

    const cheapestCategory =
      event.categories[0] ??
      null;

    const pricing = {
      from: cheapestCategory
        ? money(
            cheapestCategory.price,
            cheapestCategory.currency
          )
        : null,

      isFree:
        cheapestCategory !== null &&
        cheapestCategory.price === 0n,

      currency:
        event.currency,
    };

    /* ======================================================
       11. DONNÉES PUBLIQUES COMPLÈTES

       Structure destinée à la page :

       src/app/(public)/events/[slug]/page.tsx

       Le frontend n'a pas besoin
       de consulter les API organisateur.
    ====================================================== */

    const publicEvent: PublicEvent = {
      id: event.id,
      slug: event.slug,

      title: event.title,

      description:
        event.description,

      category:
        event.category,

      status: "PUBLISHED",

      organizer,

      imageUrl:
        primaryImage?.url ?? null,

      imageStorageKey:
        primaryImage?.storageKey ?? null,

      images,

      venue,

      scheduleKind:
        event.scheduleKind,

      ticketValidity:
        event.ticketValidity,

      schedule:
        selectedSchedule,

      schedules,

      ticketCategories,

      pricing,

      currency:
        event.currency,

      timeZone:
        event.timeZone,

      capacity:
        event.capacity,

      publishedAt:
        event.publishedAt
          ?.toISOString() ?? null,

      href:
        `/events/${encodeURIComponent(event.slug)}`,
    };

    /* ======================================================
       12. RÉPONSE

       Même API pour :
       - PC
       - Mobile
       - Tablette

       Sans cache HTTP.

       Aucun montant de commande
       ou frais financier inventé.
    ====================================================== */

    return NextResponse.json(
      await resolvePublicMedia({
        success: true,

        generatedAt:
          new Date().toISOString(),

        data: {
          event: publicEvent,
        },
      }, process.env.SUPABASE_EVENT_BUCKET || "event-images"),
      {
        status: 200,
        headers: RESPONSE_HEADERS,
      }
    );
  } catch (error) {
    unstable_rethrow(error);

    /* ======================================================
       13. GESTION DES ERREURS

       Ne jamais exposer au visiteur :
       - La configuration PostgreSQL
       - Les secrets d'infrastructure
       - Les identifiants privés
       - Les traces internes Prisma
    ====================================================== */

    console.error(
      "[TIKEMIA_PUBLIC_EVENT_DETAILS_ERROR]",
      error
    );

    return errorResponse(
      500,
      "EVENT_DETAILS_UNAVAILABLE",
      "Les détails de cet événement sont temporairement indisponibles."
    );
  }
}
