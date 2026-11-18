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

import {
  NextRequest,
  NextResponse,
} from "next/server";



const getPrisma = getPlatformPrisma;

/* ==========================================================
   TIKEMIA — DÉTAILS PUBLICS D'UNE CAGNOTTE

   FICHIER :
   src/app/api/public/campaigns/[slug]/route.ts

   ROUTE :
   GET /api/public/campaigns/[slug]

   EXEMPLE :
   /api/public/campaigns/soutien-aux-soins-de-koffi

   OBJECTIF :
   Fournir les informations réelles
   d'une cagnotte publiée.

   MODÈLES PRISMA EXISTANTS :
   - Campaign
   - CampaignImage
   - Organization
   - User
   - Donation

   DONNÉES PUBLIQUES :
   - Titre
   - Description complète
   - Galerie de photos
   - Image principale
   - Nom de l'organisateur
   - Photo de l'organisateur
   - Pays et ville
   - Date de publication
   - Date de fermeture effective
   - Objectif financier
   - Montant réellement collecté
   - Pourcentage de progression
   - Nombre de dons confirmés
   - Devise réelle
   - Lien public de la cagnotte

   EXCLUSIONS :
   - Aucun événement
   - Aucun billet
   - Aucune catégorie
   - Aucun dernier don affiché
   - Aucun nom de donateur
   - Aucun email privé
   - Aucun numéro privé
   - Aucune information bancaire
   - Aucune géolocalisation IP
   - Aucun paiement
   - Aucune création de don
   - Aucun frais calculé ici
   - Aucune donnée fictive

   RÈGLES FINANCIÈRES :
   - Dons CONFIRMED uniquement
   - Calculs en BigInt
   - Montants en unités mineures
   - Aucune conversion de devise
   - Frais de don 1 % : étape suivante

   COMPATIBILITÉ :
   - Next.js App Router
   - Prisma 7
   - PostgreSQL
   - TypeScript
   - Mobile et PC
========================================================== */

/* ==========================================================
   CONFIGURATION
========================================================== */

const MAX_SLUG_LENGTH = 180;

const MAX_GALLERY_IMAGES = 10;

const RESPONSE_HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, must-revalidate, max-age=0",

  "X-Content-Type-Options": "nosniff",
};

/* ==========================================================
   TYPES PUBLICS
========================================================== */

type PublicMoney = {
  amountMinor: string;
  currency: string;
};

type PublicCampaignImage = {
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

type PublicCampaignLocation = {
  country: string | null;

  city: string | null;

  fullLocation: string | null;
};

type PublicCampaignFunding = {
  goal: PublicMoney;

  collected: PublicMoney;

  remaining: PublicMoney;

  percentage: number;

  progressPercentage: number;

  donationCount: number;

  goalReached: boolean;
};

type PublicCampaignDates = {
  launchedAt: string | null;

  publishedAt: string | null;

  closedAt: string | null;

  updatedAt: string;

  scheduledEndAt: null;
};

type PublicCampaign = {
  id: string;

  slug: string;

  title: string;

  description: string;

  status: "PUBLISHED";

  imageUrl: string | null;

  imageStorageKey: string | null;

  images: PublicCampaignImage[];

  organizer: PublicOrganizer;

  location: PublicCampaignLocation;

  dates: PublicCampaignDates;

  funding: PublicCampaignFunding;

  currency: string;

  publishedAt: string | null;

  closedAt: string | null;

  updatedAt: string;

  href: string;
};

/* ==========================================================
   UTILITAIRES — CHAÎNES
========================================================== */

/**
 * Nettoie une chaîne facultative.
 *
 * Ne crée aucune valeur fictive.
 */
function cleanOptional(
  value: string | null | undefined
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const clean = value.trim();

  return clean.length > 0
    ? clean
    : null;
}

/* ==========================================================
   UTILITAIRES — VALIDATION DU SLUG

   Une cagnotte se retrouve par
   son slug unique dans Prisma.

   Exemple :
   soutien-aux-soins-de-koffi

   Pas d'UUID dans le lien public.
========================================================== */

function validateSlug(
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

  /*
   * Slugs publics lisibles :
   * lettres minuscules, chiffres
   * et tirets.
   *
   * On évite les caractères dangereux,
   * les chemins et les query strings.
   */

  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
      slug
    )
  ) {
    return null;
  }

  return slug;
}

/* ==========================================================
   UTILITAIRES — MONTANTS

   Le Prisma utilise BigInt.

   Exemples :
   XOF : 5000 = 5 000 FCFA
   EUR : 500000 = 5 000,00 €
   USD : 500000 = 5 000,00 $

   Aucun BigInt brut n'est envoyé
   dans une réponse JSON.
========================================================== */

function toMoney(
  amount: bigint,
  currency: string
): PublicMoney {
  return {
    amountMinor: amount.toString(),

    currency,
  };
}

/* ==========================================================
   UTILITAIRES — PROGRESSION

   Le montant réellement collecté
   est comparé à l'objectif.

   Calcul avec BigInt.

   On conserve deux décimales
   pour le pourcentage réel.

   La barre visuelle est plafonnée
   à 100 %.

   Si la collecte dépasse son objectif,
   son montant n'est pas plafonné.
========================================================== */

function calculatePercentage(
  collected: bigint,
  goal: bigint
): number {
  if (
    goal <= 0n ||
    collected <= 0n
  ) {
    return 0;
  }

  /*
   * Deux décimales :
   *
   * 65,25 % = 6525 unités.
   *
   * Calcul sans conversion
   * monétaire en Number.
   */

  const scaled =
    (collected * 10000n) / goal;

  const maxSafe =
    BigInt(Number.MAX_SAFE_INTEGER);

  /*
   * Protection contre un dépassement
   * de la capacité de Number.
   */

  if (scaled > maxSafe) {
    return 100;
  }

  return Number(scaled) / 100;
}

function clampProgress(
  percentage: number
): number {
  if (!Number.isFinite(percentage)) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(0, percentage)
  );
}

/* ==========================================================
   UTILITAIRES — IMAGES

   Les fichiers TIKEMIA sont enregistrés
   en storageKey.

   Si la valeur contient déjà une URL
   publique valide, on l'utilise.

   Si la valeur est une référence privée,
   elle reste dans storageKey.

   Le frontend devra réutiliser le
   mécanisme de médias existant.

   Aucune URL de bucket inventée.
========================================================== */

function publicImageUrl(
  storageKey: string | null | undefined
): string | null {
  const key =
    cleanOptional(storageKey);

  if (!key) {
    return null;
  }

  /*
   * Chemin local public.
   */

  if (
    key.startsWith("/") &&
    !key.startsWith("//") &&
    !key.includes("\\") &&
    !/[\u0000-\u001F]/.test(key)
  ) {
    return key;
  }

  /*
   * URL HTTPS.
   */

  try {
    const url = new URL(key);

    if (url.protocol === "https:") {
      return url.toString();
    }

    /*
     * HTTP uniquement en développement
     * local.
     */

    if (
      process.env.NODE_ENV !== "production" &&
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

/* ==========================================================
   UTILITAIRES — LOCALISATION

   La cagnotte possède country
   et city dans Prisma.

   Aucune détection IP.
   Aucune position GPS inventée.
========================================================== */

function buildLocation(
  city: string | null,
  country: string | null
): string | null {
  const parts = [
    cleanOptional(city),
    cleanOptional(country),
  ].filter(
    (part): part is string =>
      typeof part === "string"
  );

  if (parts.length === 0) {
    return null;
  }

  return parts.join(", ");
}

/* ==========================================================
   UTILITAIRES — DATES

   publishedAt :
   Date réelle de publication.

   closedAt :
   Date réelle de fermeture,
   et NON une date de fin prévue.

   Le modèle Campaign ne contient
   actuellement aucun champ
   scheduledEndAt.

   Ne jamais inventer une échéance.
========================================================== */

function toISOString(
  date: Date | null | undefined
): string | null {
  if (!date) {
    return null;
  }

  return date.toISOString();
}

/* ==========================================================
   RÉPONSES D'ERREUR
========================================================== */

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
   GET — DÉTAILS D'UNE CAGNOTTE
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
       params est asynchrone.

       Exemple :
       /api/public/campaigns/soutien-aux-soins-de-koffi
    ====================================================== */

    const { slug: rawSlug } =
      await context.params;

    const slug =
      validateSlug(rawSlug);

    if (!slug) {
      return errorResponse(
        400,
        "INVALID_CAMPAIGN_SLUG",
        "L'adresse de cette cagnotte est invalide."
      );
    }

    const now = new Date();

    /* ======================================================
       2. RECHERCHE DE LA CAGNOTTE

       Conditions :
       - Slug unique
       - Statut PUBLISHED
       - Organisation active
       - Publication non programmée
         dans le futur

       Une cagnotte en brouillon,
       suspendue, rejetée, annulée,
       fermée ou archivée ne doit
       pas être affichée ici.
    ====================================================== */

    const alias = await prisma.appSetting.findUnique({ where: { key: "publication:campaign:" + slug }, select: { value: true } });
    const aliasValue = alias?.value;
    const legacyId = aliasValue && typeof aliasValue === "object" && !Array.isArray(aliasValue) && typeof aliasValue.id === "string" ? aliasValue.id : null;
    const campaign =
      await prisma.campaign.findFirst({
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

          status: true,

          goalAmount: true,

          currency: true,

          country: true,

          city: true,

          publishedAt: true,

          closedAt: true,

          updatedAt: true,

          /* ================================================
             ORGANISATEUR

             Nom de l'organisation
             et photo de profil.
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
             CRÉATEUR

             Uniquement en repli pour
             les données publiques du profil.
          ================================================ */

          createdBy: {
            select: {
              fullName: true,

              avatarStorageKey: true,
            },
          },

          /* ================================================
             GALERIE

             Images classées selon :
             1. Image principale
             2. Position
             3. Date de création

             Limite conforme aux images
             de cagnotte de TIKEMIA.
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
        },
      });

    /* ======================================================
       3. CAGNOTTE INTROUVABLE

       Même réponse pour :
       - Slug inexistant
       - Cagnotte non publiée
       - Organisation inactive

       Les données privées restent
       inaccessibles.
    ====================================================== */

    if (!campaign) {
      return errorResponse(
        404,
        "CAMPAIGN_NOT_FOUND",
        "Cette cagnotte est introuvable ou indisponible."
      );
    }

    /* ======================================================
       4. AGRÉGATION FINANCIÈRE

       Une seule requête d'agrégation.

       On additionne seulement les dons :
       status = CONFIRMED.

       Les dons suivants sont exclus :
       - PENDING
       - FAILED
       - CANCELLED
       - REFUNDED

       Les montants sont regroupés dans
       la devise de la cagnotte.

       Aucune conversion monétaire
       implicite entre devises.
    ====================================================== */

    const donationAggregate =
      await prisma.donation.aggregate({
        where: {
          campaignId: campaign.id,

          status: "CONFIRMED",

          currency: campaign.currency,
        },

        _sum: {
          amount: true,
        },

        _count: {
          _all: true,
        },
      });

    /* ======================================================
       5. MONTANT COLLECTÉ

       BigInt pour éviter toute perte
       de précision financière.
    ====================================================== */

    const collectedAmount =
      donationAggregate._sum.amount ??
      0n;

    const donationCount =
      donationAggregate._count._all;

    const goalAmount =
      campaign.goalAmount;

    /* ======================================================
       6. RESTE À COLLECTER

       Si l'objectif est dépassé,
       le montant restant devient zéro.

       Le montant collecté reste réel.
    ====================================================== */

    const remainingAmount =
      goalAmount > collectedAmount
        ? goalAmount - collectedAmount
        : 0n;

    /* ======================================================
       7. PROGRESSION

       Le pourcentage est dérivé
       du montant réellement confirmé.

       Aucune statistique inventée.
    ====================================================== */

    const percentage =
      calculatePercentage(
        collectedAmount,
        goalAmount
      );

    const progressPercentage =
      clampProgress(percentage);

    const goalReached =
      goalAmount > 0n &&
      collectedAmount >= goalAmount;

    /* ======================================================
       8. ORGANISATEUR

       Nom :
       1. Nom de l'organisation
       2. Nom du propriétaire
       3. Nom du créateur

       Photo :
       1. Logo de l'organisation
       2. Avatar du propriétaire
       3. Avatar du créateur

       Aucune photo fictive.
    ====================================================== */

    const organization =
      campaign.organization;

    const owner =
      organization.owner;

    const creator =
      campaign.createdBy;

    const organizerName =
      cleanOptional(
        organization.name
      ) ??
      cleanOptional(
        owner.fullName
      ) ??
      cleanOptional(
        creator.fullName
      ) ??
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
        cleanOptional(
          owner.fullName
        ) ??
        cleanOptional(
          creator.fullName
        ) ??
        "",

      photoUrl:
        publicImageUrl(
          organizerPhotoKey
        ),

      photoStorageKey:
        organizerPhotoKey,
    };

    /* ======================================================
       9. GALERIE DE LA CAGNOTTE

       On renvoie uniquement les
       images réellement publiées.

       Aucune image décorative ajoutée.

       Le frontend pourra afficher :
       - Grande image
       - Miniatures
       - Image précédente
       - Image suivante
    ====================================================== */

    const images: PublicCampaignImage[] =
      campaign.images.map(
        (image) => ({
          id: image.id,

          url:
            publicImageUrl(
              image.storageKey
            ),

          storageKey:
            image.storageKey,

          isPrimary:
            image.isPrimary,

          position:
            image.position,
        })
      );

    const primaryImage =
      images.find(
        (image) =>
          image.isPrimary
      ) ??
      images[0] ??
      null;

    /* ======================================================
       10. LOCALISATION

       Uniquement pays et ville
       réellement enregistrés.

       Aucun service IP.
    ====================================================== */

    const country =
      cleanOptional(
        campaign.country
      );

    const city =
      cleanOptional(
        campaign.city
      );

    const location:
      PublicCampaignLocation = {
        country,

        city,

        fullLocation:
          buildLocation(
            city,
            country
          ),
      };

    /* ======================================================
       11. DATES

       Date de lancement :
       publishedAt.

       Date de fermeture :
       closedAt seulement lorsqu'une
       fermeture a réellement eu lieu.

       Pas de fausse date de fin prévue.

       scheduledEndAt reste null
       puisqu'aucun champ correspondant
       n'existe dans le modèle fourni.
    ====================================================== */

    const dates: PublicCampaignDates = {
      launchedAt:
        toISOString(
          campaign.publishedAt
        ),

      publishedAt:
        toISOString(
          campaign.publishedAt
        ),

      closedAt:
        toISOString(
          campaign.closedAt
        ),

      updatedAt:
        campaign.updatedAt.toISOString(),

      scheduledEndAt: null,
    };

    /* ======================================================
       12. DONNÉES FINANCIÈRES PUBLIQUES

       Objectif :
       Montant défini par l'organisateur.

       Collecté :
       Somme des dons confirmés.

       Restant :
       Objectif moins collecté.

       Progression :
       Pourcentage réel.

       Participation :
       Nombre de dons confirmés.

       Aucun nom de donateur.
    ====================================================== */

    const funding:
      PublicCampaignFunding = {
        goal: toMoney(
          goalAmount,
          campaign.currency
        ),

        collected: toMoney(
          collectedAmount,
          campaign.currency
        ),

        remaining: toMoney(
          remainingAmount,
          campaign.currency
        ),

        percentage,

        progressPercentage,

        donationCount,

        goalReached,
      };

    /* ======================================================
       13. CONSTRUCTION DE L'OBJET PUBLIC

       Format adapté aux interfaces :
       - PC
       - Tablette
       - Mobile

       Aucun événement et aucun billet.
    ====================================================== */

    const publicCampaign:
      PublicCampaign = {
        id: campaign.id,

        slug: campaign.slug,

        title:
          campaign.title,

        description:
          campaign.description,

        status: "PUBLISHED",

        imageUrl:
          primaryImage?.url ??
          null,

        imageStorageKey:
          primaryImage?.storageKey ??
          null,

        images,

        organizer,

        location,

        dates,

        funding,

        currency:
          campaign.currency,

        publishedAt:
          toISOString(
            campaign.publishedAt
          ),

        closedAt:
          toISOString(
            campaign.closedAt
          ),

        updatedAt:
          campaign.updatedAt.toISOString(),

        href:
          `/campaigns/${encodeURIComponent(
            campaign.slug
          )}`,
      };

    /* ======================================================
       14. RÉPONSE PUBLIQUE

       Même API pour PC et mobile.

       La page publique pourra recharger
       régulièrement ces données pour
       afficher les montants actualisés.

       Aucun cache HTTP.

       Aucun calcul de frais de 1 %
       à ce stade.

       Aucun paiement.
       Aucune création de don.
       Aucune liste de donateurs.
    ====================================================== */

    return NextResponse.json(
      await resolvePublicMedia({
        success: true,

        generatedAt:
          new Date().toISOString(),

        data: {
          campaign:
            publicCampaign,
        },
      }, process.env.SUPABASE_CAMPAIGN_BUCKET || "campaign-images"),
      {
        status: 200,

        headers: RESPONSE_HEADERS,
      }
    );
  } catch (error) {
    unstable_rethrow(error);

    /* ======================================================
       15. GESTION DES ERREURS

       Aucune erreur interne Prisma
       ne doit être envoyée au visiteur.

       Aucune information PostgreSQL
       ou secret ne doit être exposé.
    ====================================================== */

    console.error(
      "[TIKEMIA_PUBLIC_CAMPAIGN_DETAILS_ERROR]",
      error
    );

    return errorResponse(
      500,
      "CAMPAIGN_DETAILS_UNAVAILABLE",
      "Les détails de cette cagnotte sont temporairement indisponibles."
    );
  }
}
