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
   TIKEMIA — API PUBLIQUE ACCUEIL

   FICHIER :
   src/app/api/public/home/route.ts

   MÉTHODE :
   GET /api/public/home

   OBJECTIF :
   Fournir les données réelles pour l'accueil public.

   SOURCES :
   - Event
   - EventImage
   - EventSchedule
   - Venue
   - TicketCategory
   - Organization
   - User
   - Campaign
   - CampaignImage
   - Donation

   SÉCURITÉ :
   - Lecture publique uniquement
   - Aucune authentification obligatoire
   - Aucun mot de passe
   - Aucun email privé
   - Aucun numéro de téléphone
   - Aucun token sensible
   - Aucun champ bancaire
   - Statuts publiés uniquement
   - Organisations actives uniquement
   - Limites strictes sur les résultats
   - Montants BigInt sérialisés en chaînes

   COMPATIBILITÉ :
   - Next.js App Router
   - TypeScript
   - Prisma 7
   - PostgreSQL
   - PC / tablette / mobile

   IMPORTANT :
   Réutiliser le client Prisma existant.
========================================================== */

/* ==========================================================
   CONFIGURATION
========================================================== */

const DEFAULT_EVENTS_LIMIT = 8;
const DEFAULT_CAMPAIGNS_LIMIT = 6;

const MAX_EVENTS_LIMIT = 24;
const MAX_CAMPAIGNS_LIMIT = 18;

const RESPONSE_HEADERS = {
  "Cache-Control":
    "no-store, no-cache, must-revalidate, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

/* ==========================================================
   TYPES
========================================================== */

type CurrencyAmount = {
  amountMinor: string;
  currency: string;
};

type PublicOrganizer = {
  blueBadgeEnabled: boolean;
  id: string;
  name: string;
  profileName: string;
  photoUrl: string | null;
  photoStorageKey: string | null;
};

type PublicEvent = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string | null;
  imageStorageKey: string | null;
  organizer: PublicOrganizer;

  venue: {
    name: string;
    address: string;
    city: string;
    country: string;
  } | null;

  schedule: {
    startsAt: string;
    endsAt: string | null;
    timeZone: string;
  } | null;

  pricing: {
    from: CurrencyAmount | null;
    isFree: boolean;
    categories: {
      id: string;
      name: string;
      price: CurrencyAmount;
      capacity: number;
    }[];
  };

  currency: string;
  publishedAt: string | null;
  href: string;
};

type PublicCampaign = {
  id: string;
  slug: string;
  title: string;
  description: string;

  imageUrl: string | null;
  imageStorageKey: string | null;

  organizer: PublicOrganizer;

  location: {
    country: string | null;
    city: string | null;
  };

  funding: {
    goal: CurrencyAmount;
    collected: CurrencyAmount;
    percentage: number;
    donationCount: number;
  };

  currency: string;
  publishedAt: string | null;
  href: string;
};

/* ==========================================================
   UTILITAIRES
========================================================== */

/**
 * Limite les paramètres de requête.
 *
 * Une limite maximale protège la base
 * contre les lectures excessives.
 */
function getLimit(
  value: string | null,
  fallback: number,
  maximum: number
): number {
  if (!value) return fallback;

  if (!/^\d{1,3}$/.test(value)) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    return fallback;
  }

  return Math.min(
    Math.max(parsed, 1),
    maximum
  );
}

/**
 * Les montants financiers de TIKEMIA
 * sont enregistrés en unités mineures.
 *
 * On ne convertit pas les BigInt en Number
 * pour éviter toute perte de précision.
 */
function money(
  amount: bigint,
  currency: string
): CurrencyAmount {
  return {
    amountMinor: amount.toString(),
    currency,
  };
}

/**
 * Raccourcit le texte uniquement
 * pour la carte de l'accueil.
 */
function excerpt(
  value: string | null | undefined,
  maximum = 180
): string {
  const clean = (value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (clean.length <= maximum) {
    return clean;
  }

  return (
    clean.slice(0, maximum)
      .trimEnd()
      .replace(/[.,;:!?-]+$/, "") + "…"
  );
}

/**
 * Convertit uniquement les références
 * qui sont déjà des URL publiques valides.
 *
 * Les autres storageKey sont conservées
 * pour être résolues par le système
 * d'images existant de TIKEMIA.
 *
 * On n'invente pas de bucket Supabase.
 */
function publicImageUrl(
  storageKey: string | null | undefined
): string | null {
  if (!storageKey) {
    return null;
  }

  const value = storageKey.trim();

  if (!value) {
    return null;
  }

  if (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
  ) {
    return value;
  }

  try {
    const url = new URL(value);

    if (url.protocol === "https:") {
      return url.toString();
    }

    if (
      url.protocol === "http:" &&
      (url.hostname === "localhost" ||
        url.hostname === "127.0.0.1")
    ) {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Formate une date UTC sous la forme
 * ISO 8601 pour le frontend.
 *
 * Le frontend pourra ensuite utiliser
 * le timeZone de l'événement.
 */
function isoDate(
  value: Date | null | undefined
): string | null {
  return value
    ? value.toISOString()
    : null;
}

/**
 * Pourcentage calculé avec BigInt.
 *
 * On utilise deux décimales sans
 * convertir les montants en Number.
 *
 * Le pourcentage peut dépasser 100
 * si les dons dépassent l'objectif.
 */
function fundingPercentage(
  collected: bigint,
  goal: bigint
): number {
  if (goal <= 0n) {
    return 0;
  }

  const safeCollected =
    collected > 0n ? collected : 0n;

  const scaled =
    (safeCollected * 10000n) / goal;

  const maximum =
    BigInt(Number.MAX_SAFE_INTEGER);

  if (scaled > maximum) {
    return 100;
  }

  return Number(scaled) / 100;
}

/**
 * Empêche une réponse de contenir
 * un grand nombre d'images ou de
 * catégories inutiles.
 */
function storageReference(
  value: string | null | undefined
): string | null {
  const clean = value?.trim();

  return clean || null;
}

/* ==========================================================
   GET — DONNÉES DE L'ACCUEIL PUBLIC
========================================================== */

export async function GET(request: NextRequest) {
  try {
    const prisma = getPrisma();

    /* ======================================================
       PARAMÈTRES
    ====================================================== */

    const params = request.nextUrl.searchParams;

    const eventsLimit = getLimit(
      params.get("eventsLimit"),
      DEFAULT_EVENTS_LIMIT,
      MAX_EVENTS_LIMIT
    );

    const campaignsLimit = getLimit(
      params.get("campaignsLimit"),
      DEFAULT_CAMPAIGNS_LIMIT,
      MAX_CAMPAIGNS_LIMIT
    );

    const now = new Date();

    /* ======================================================
       LECTURE DES ÉVÉNEMENTS ET CAGNOTTES

       Lecture parallèle.

       Seuls les contenus publiés
       par des organisations actives
       sont visibles.

       Ne pas utiliser les routes
       organisateur : elles nécessitent
       une session privée.
    ====================================================== */

    const [events, campaigns] = await Promise.all([
      prisma.event.findMany({
        where: {
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

        orderBy: [
          {
            publishedAt: "desc",
          },
          {
            createdAt: "desc",
          },
        ],

        take: eventsLimit,

        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          category: true,
          currency: true,
          timeZone: true,
          publishedAt: true,

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

          createdBy: {
            select: {
              fullName: true,
              avatarStorageKey: true,
            },
          },

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

            take: 1,

            select: {
              storageKey: true,
            },
          },

          venue: {
            select: {
              name: true,
              address: true,
              city: true,
              country: true,
            },
          },

          schedules: {
            orderBy: {
              startsAt: "asc",
            },

            select: {
              startsAt: true,
              endsAt: true,
            },
          },

          categories: {
            where: {
              isActive: true,
            },

            orderBy: {
              price: "asc",
            },

            select: {
              id: true,
              name: true,
              price: true,
              currency: true,
              capacity: true,
            },
          },
        },
      }),

      prisma.campaign.findMany({
        where: {
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

        orderBy: [
          {
            publishedAt: "desc",
          },
          {
            createdAt: "desc",
          },
        ],

        take: campaignsLimit,

        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          goalAmount: true,
          currency: true,
          country: true,
          city: true,
          publishedAt: true,

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

          createdBy: {
            select: {
              fullName: true,
              avatarStorageKey: true,
            },
          },

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

            take: 1,

            select: {
              storageKey: true,
            },
          },
        },
      }),
    ]);

    /* ======================================================
       AGRÉGATION DES DONS CONFIRMÉS

       Une seule requête groupBy.

       Pas de requête individuelle
       pour chaque cagnotte.

       Seuls les dons CONFIRMED sont comptés.
       Les dons PENDING, FAILED, CANCELLED
       et REFUNDED sont exclus.
    ====================================================== */

    const campaignIds = campaigns.map(
      (campaign) => campaign.id
    );

    const donationAggregates =
      campaignIds.length > 0
        ? await prisma.donation.groupBy({
            by: ["campaignId"],

            where: {
              campaignId: {
                in: campaignIds,
              },

              status: "CONFIRMED",
            },

            _sum: {
              amount: true,
            },

            _count: {
              _all: true,
            },
          })
        : [];

    const donationsByCampaign = new Map(
      donationAggregates.map((row) => [
        row.campaignId,
        {
          collected: row._sum.amount ?? 0n,
          count: row._count._all,
        },
      ])
    );

    /* ======================================================
       FORMATAGE DES ÉVÉNEMENTS

       Chaque carte comporte :
       - Image principale
       - Catégorie
       - Titre
       - Nom de l'organisateur
       - Photo de l'organisateur
       - Lieu complet
       - Date / heure
       - Prix minimum
       - Lien vers le détail
    ====================================================== */

    const publicEvents: PublicEvent[] = events.map(
      (event) => {
        const organization =
          event.organization;

        const owner =
          organization.owner;

        const creator =
          event.createdBy;

        /* --------------------------------------------------
           ORGANISATEUR

           Le nom officiel de l'organisation
           est prioritaire.

           Photo :
           1. Logo de l'organisation
           2. Avatar du propriétaire
           3. Avatar du créateur
        -------------------------------------------------- */

        const organizerName =
          organization.name.trim() ||
          owner.fullName.trim() ||
          creator.fullName.trim();

        const organizerImageKey =
          storageReference(
            organization.logoStorageKey
          ) ??
          storageReference(
            owner.avatarStorageKey
          ) ??
          storageReference(
            creator.avatarStorageKey
          );

        const organizer: PublicOrganizer = {
 blueBadgeEnabled: organization.blueBadgeEnabled,
          id: organization.id,
          name: organizerName,
          profileName:
            owner.fullName.trim() ||
            creator.fullName.trim(),

          photoUrl:
            publicImageUrl(organizerImageKey),

          photoStorageKey:
            organizerImageKey,
        };

        /* --------------------------------------------------
           IMAGE PRINCIPALE
        -------------------------------------------------- */

        const primaryImage =
          event.images[0]?.storageKey ?? null;

        /* --------------------------------------------------
           DATES

           Sélectionne la prochaine séance
           non terminée.

           Si aucune séance future n'existe,
           conserve la première séance
           enregistrée pour affichage.
        -------------------------------------------------- */

        const upcomingSchedule =
          event.schedules.find(
            (schedule) =>
              schedule.endsAt
                ? schedule.endsAt >= now
                : schedule.startsAt >= now
          );

        const firstSchedule =
          upcomingSchedule ??
          event.schedules[0] ??
          null;

        /* --------------------------------------------------
           CATÉGORIES TARIFAIRES EXISTANTES

           Les catégories de billets sont
           distinctes des catégories
           d'événements.

           Aucun prix fictif.
        -------------------------------------------------- */

        const ticketCategories =
          event.categories.map(
            (category) => ({
              id: category.id,
              name: category.name,
              price: money(
                category.price,
                category.currency
              ),
              capacity: category.capacity,
            })
          );

        const minimumPrice =
          event.categories[0] ?? null;

        const isFree =
          minimumPrice !== null &&
          minimumPrice.price === 0n;

        return {
          id: event.id,
          slug: event.slug,
          title: event.title,

          description: excerpt(
            event.description
          ),

          category: event.category,

          imageUrl:
            publicImageUrl(primaryImage),

          imageStorageKey:
            storageReference(primaryImage),

          organizer,

          venue: event.venue
            ? {
                name: event.venue.name,
                address: event.venue.address,
                city: event.venue.city,
                country: event.venue.country,
              }
            : null,

          schedule: firstSchedule
            ? {
                startsAt:
                  firstSchedule.startsAt.toISOString(),

                endsAt:
                  isoDate(firstSchedule.endsAt),

                timeZone: event.timeZone,
              }
            : null,

          pricing: {
            from: minimumPrice
              ? money(
                  minimumPrice.price,
                  minimumPrice.currency
                )
              : null,

            isFree,
            categories: ticketCategories,
          },

          currency: event.currency,

          publishedAt:
            isoDate(event.publishedAt),

          href:
            `/events/${encodeURIComponent(event.slug)}`,
        };
      }
    );

    /* ======================================================
       FORMATAGE DES CAGNOTTES

       Chaque carte comporte :
       - Image principale
       - Titre
       - Description
       - Organisateur
       - Photo / logo
       - Montant collecté
       - Objectif
       - Pourcentage
       - Nombre de dons confirmés
       - Lien vers le détail
    ====================================================== */

    const publicCampaigns: PublicCampaign[] =
      campaigns.map((campaign) => {
        const organization =
          campaign.organization;

        const owner =
          organization.owner;

        const creator =
          campaign.createdBy;

        const organizerName =
          organization.name.trim() ||
          owner.fullName.trim() ||
          creator.fullName.trim();

        const organizerImageKey =
          storageReference(
            organization.logoStorageKey
          ) ??
          storageReference(
            owner.avatarStorageKey
          ) ??
          storageReference(
            creator.avatarStorageKey
          );

        const organizer: PublicOrganizer = {
 blueBadgeEnabled: organization.blueBadgeEnabled,
          id: organization.id,
          name: organizerName,

          profileName:
            owner.fullName.trim() ||
            creator.fullName.trim(),

          photoUrl:
            publicImageUrl(organizerImageKey),

          photoStorageKey:
            organizerImageKey,
        };

        const primaryImage =
          campaign.images[0]?.storageKey ??
          null;

        const donationData =
          donationsByCampaign.get(campaign.id);

        const collected =
          donationData?.collected ?? 0n;

        const donationCount =
          donationData?.count ?? 0;

        return {
          id: campaign.id,
          slug: campaign.slug,

          title: campaign.title,

          description: excerpt(
            campaign.description
          ),

          imageUrl:
            publicImageUrl(primaryImage),

          imageStorageKey:
            storageReference(primaryImage),

          organizer,

          location: {
            country: campaign.country,
            city: campaign.city,
          },

          funding: {
            goal: money(
              campaign.goalAmount,
              campaign.currency
            ),

            collected: money(
              collected,
              campaign.currency
            ),

            percentage: fundingPercentage(
              collected,
              campaign.goalAmount
            ),

            donationCount,
          },

          currency: campaign.currency,

          publishedAt:
            isoDate(campaign.publishedAt),

          href:
            `/campaigns/${encodeURIComponent(
              campaign.slug
            )}`,
        };
      });

    /* ======================================================
       RÉPONSE PUBLIQUE

       Pas de données privées.
       Pas de BigInt non sérialisé.
       Pas de token.
       Pas de données fictives.
    ====================================================== */

    return NextResponse.json(
      await resolvePublicMedia({
        success: true,

        generatedAt:
          new Date().toISOString(),

        data: {
          events: publicEvents,
          campaigns: publicCampaigns,
        },

        counts: {
          events: publicEvents.length,
          campaigns: publicCampaigns.length,
        },

        limits: {
          events: eventsLimit,
          campaigns: campaignsLimit,
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
       ERREUR SERVEUR

       Ne jamais exposer :
       - Les identifiants de la base
       - Les informations PostgreSQL
       - Les requêtes internes
       - Les détails d'infrastructure
    ====================================================== */

    console.error(
      "[TIKEMIA_PUBLIC_HOME_ERROR]",
      error
    );

    return NextResponse.json(
      {
        success: false,

        code: "PUBLIC_HOME_UNAVAILABLE",

        message:
          "Les données de l'accueil sont temporairement indisponibles.",

        data: {
          events: [],
          campaigns: [],
        },
      },
      {
        status: 500,
        headers: RESPONSE_HEADERS,
      }
    );
  }
}
