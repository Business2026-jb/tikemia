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
   TIKEMIA — API PUBLIQUE DES CAGNOTTES

   FICHIER :
   src/app/api/public/campaigns/route.ts

   ROUTE :
   GET /api/public/campaigns

   OBJECTIF :
   Afficher toutes les cagnottes publiées
   par les organisateurs, avec pagination.

   MODÈLES PRISMA EXISTANTS :
   - Campaign
   - CampaignImage
   - Organization
   - User
   - Donation

   FONCTIONNALITÉS :
   - Cagnottes PUBLISHED uniquement
   - Organisations actives uniquement
   - Image principale
   - Titre et description
   - Pays et ville
   - Nom et photo de l'organisateur
   - Objectif de collecte
   - Somme des dons confirmés
   - Nombre de dons confirmés
   - Pourcentage de progression
   - Pagination serveur
   - Montants financiers sans perte
   - Actualisation à chaque requête

   EXCLUSIONS :
   - Aucun événement
   - Aucune catégorie
   - Aucun filtrage géographique
   - Aucune lecture d'adresse IP
   - Aucun champ de recherche
   - Aucune donnée fictive
   - Aucune modification de Prisma

   PC ET MOBILE :
   Une même API pour les deux affichages.
========================================================== */

/* ==========================================================
   CONFIGURATION
========================================================== */

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 24;
const MAX_PAGE = 10000;

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

type PublicOrganizer = {
  blueBadgeEnabled: boolean;
  id: string;
  name: string;
  photoUrl: string | null;
  photoStorageKey: string | null;
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
    goal: Money;
    collected: Money;
    percentage: number;
    donationCount: number;
  };

  currency: string;

  publishedAt: string | null;
  updatedAt: string;

  href: string;
};

/* ==========================================================
   LECTURE SÉCURISÉE DE LA PAGINATION
========================================================== */

function parsePositiveInteger(
  value: string | null,
  fallback: number,
  maximum: number
): number | null {
  if (value === null) {
    return fallback;
  }

  if (!/^[0-9]+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > maximum
  ) {
    return null;
  }

  return parsed;
}

/* ==========================================================
   UTILITAIRES FINANCIERS

   Le schéma TIKEMIA stocke les montants
   en unités mineures.

   XOF :
   1 unité = 1 FCFA

   EUR / USD :
   100 unités = 1 EUR / USD

   Les BigInt ne sont jamais convertis
   en Number pour les montants monétaires.
========================================================== */

function toMoney(
  amount: bigint,
  currency: string
): Money {
  return {
    amountMinor: amount.toString(),
    currency,
  };
}

/**
 * Pourcentage avec deux décimales.
 *
 * Calcul BigInt pour éviter les pertes
 * de précision dans les opérations.
 *
 * La barre de progression est plafonnée
 * à 100 %, même si l'objectif est dépassé.
 *
 * Les sommes réelles ne sont pas plafonnées.
 */
function calculatePercentage(
  collected: bigint,
  goal: bigint
): number {
  if (goal <= 0n) {
    return 0;
  }

  if (collected <= 0n) {
    return 0;
  }

  if (collected >= goal) {
    return 100;
  }

  const scaled = (collected * 10000n) / goal;

  return Number(scaled) / 100;
}

/* ==========================================================
   TEXTE
========================================================== */

function cleanText(
  value: string | null | undefined
): string {
  return (value ?? "").trim();
}

function excerpt(
  value: string | null | undefined,
  maximum = 180
): string {
  const text = (value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maximum) {
    return text;
  }

  return (
    text.slice(0, maximum)
      .trimEnd()
      .replace(/[.,;:!?-]+$/, "") + "…"
  );
}

/* ==========================================================
   IMAGES

   Le Prisma TIKEMIA utilise storageKey.

   Lorsque la valeur est déjà une URL
   publique HTTPS ou un chemin local,
   elle peut être utilisée directement.

   Sinon, le storageKey est conservé
   pour être traité par le mécanisme
   de médias existant dans TIKEMIA.

   Aucune URL Supabase fictive.
========================================================== */

function normalizeStorageKey(
  value: string | null | undefined
): string | null {
  const key = value?.trim();

  return key || null;
}

function publicImageUrl(
  storageKey: string | null | undefined
): string | null {
  const key = normalizeStorageKey(storageKey);

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

    if (
      url.protocol === "https:"
    ) {
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

/* ==========================================================
   RÉPONSE D'ERREUR DE VALIDATION
========================================================== */

function invalidPagination() {
  return NextResponse.json(
    {
      success: false,
      code: "INVALID_PAGINATION",
      message: "Paramètres de pagination invalides.",
    },
    {
      status: 400,
      headers: RESPONSE_HEADERS,
    }
  );
}

/* ==========================================================
   GET /api/public/campaigns
========================================================== */

export async function GET(request: NextRequest) {
  try {
    const prisma = getPrisma();

    /* ======================================================
       1. PARAMÈTRES
    ====================================================== */

    const searchParams =
      request.nextUrl.searchParams;

    const page = parsePositiveInteger(
      searchParams.get("page"),
      DEFAULT_PAGE,
      MAX_PAGE
    );

    const limit = parsePositiveInteger(
      searchParams.get("limit"),
      DEFAULT_LIMIT,
      MAX_LIMIT
    );

    if (page === null || limit === null) {
      return invalidPagination();
    }

    const skip = (page - 1) * limit;

    const now = new Date();

    /* ======================================================
       2. CONDITIONS DE PUBLICATION

       Seulement :
       - Cagnottes publiées
       - Organisations actives
       - Publications déjà effectuées

       Aucune cagnotte :
       - DRAFT
       - PENDING_REVIEW
       - SUSPENDED
       - CLOSED
       - CANCELLED
       - REJECTED
       - ARCHIVED
    ====================================================== */

    const where = {
      status: "PUBLISHED" as const,

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
    };

    /* ======================================================
       3. LECTURE DES CAGNOTTES

       Récupération paginée.

       Le nombre total est calculé
       séparément pour la pagination.

       Sélection uniquement des champs
       nécessaires à l'affichage public.

       Aucune information bancaire,
       aucun email et aucun téléphone.
    ====================================================== */

    const [total, campaigns] = await Promise.all([
      prisma.campaign.count({
        where,
      }),

      prisma.campaign.findMany({
        where,

        orderBy: [
          {
            publishedAt: "desc",
          },
          {
            createdAt: "desc",
          },
          {
            id: "desc",
          },
        ],

        skip,
        take: limit,

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
          updatedAt: true,

          /* ================================================
             ORGANISATION
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

             Utilisé uniquement comme
             solution de repli pour le nom
             ou la photo publique.
          ================================================ */

          createdBy: {
            select: {
              fullName: true,
              avatarStorageKey: true,
            },
          },

          /* ================================================
             IMAGE PRINCIPALE

             Une seule image est nécessaire
             pour chaque carte.

             Priorité :
             - isPrimary
             - position
             - date de création
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

            take: 1,

            select: {
              storageKey: true,
            },
          },
        },
      }),
    ]);

    /* ======================================================
       4. IDENTIFIANTS DES CAGNOTTES

       Préparation du calcul groupé
       des dons réellement confirmés.
    ====================================================== */

    const campaignIds = campaigns.map(
      (campaign) => campaign.id
    );

    /* ======================================================
       5. CALCUL DES DONS CONFIRMÉS

       Une seule requête groupBy pour
       toutes les cagnottes de la page.

       Seuls les dons au statut
       CONFIRMED sont comptabilisés.

       PENDING, FAILED, CANCELLED
       et REFUNDED sont exclus.

       Aucun montant estimé.
       Aucun nombre de dons inventé.
    ====================================================== */

    const donationTotals =
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

    /* ======================================================
       6. INDEXATION DES MONTANTS

       Accès rapide pour chaque cagnotte.
    ====================================================== */

    const fundingByCampaign = new Map<
      string,
      {
        collected: bigint;
        donationCount: number;
      }
    >();

    for (const row of donationTotals) {
      fundingByCampaign.set(row.campaignId, {
        collected: row._sum.amount ?? 0n,
        donationCount: row._count._all,
      });
    }

    /* ======================================================
       7. FORMATAGE PUBLIC

       Chaque cagnotte sera affichée avec :

       - Son titre
       - Sa description
       - Son image
       - Le pays
       - La ville
       - Le nom de l'organisateur
       - La photo de l'organisateur
       - Le montant souhaité
       - Le montant récolté
       - La progression
       - Le nombre de dons
       - Le lien vers sa fiche

       Les montants restent associés
       à leur devise réelle.
    ====================================================== */

    const publicCampaigns: PublicCampaign[] =
      campaigns.map((campaign) => {
        const organization = campaign.organization;

        const owner = organization.owner;

        const creator = campaign.createdBy;

        /* ================================================
           NOM DE L'ORGANISATEUR

           1. Nom de l'organisation
           2. Nom du propriétaire
           3. Nom du créateur

           Pas de nom inventé.
        ================================================ */

        const organizerName =
          cleanText(organization.name) ||
          cleanText(owner.fullName) ||
          cleanText(creator.fullName);

        /* ================================================
           PHOTO DE L'ORGANISATEUR

           1. Logo de l'organisation
           2. Avatar du propriétaire
           3. Avatar du créateur

           Aucun avatar fictif transmis.
        ================================================ */

        const organizerImageKey =
          normalizeStorageKey(
            organization.logoStorageKey
          ) ??
          normalizeStorageKey(
            owner.avatarStorageKey
          ) ??
          normalizeStorageKey(
            creator.avatarStorageKey
          );

        const organizer: PublicOrganizer = {
 blueBadgeEnabled: organization.blueBadgeEnabled,
          id: organization.id,
          name: organizerName,

          photoUrl:
            publicImageUrl(organizerImageKey),

          photoStorageKey:
            organizerImageKey,
        };

        /* ================================================
           IMAGE PRINCIPALE DE LA CAGNOTTE
        ================================================ */

        const imageStorageKey =
          normalizeStorageKey(
            campaign.images[0]?.storageKey
          );

        /* ================================================
           MONTANTS CONFIRMÉS
        ================================================ */

        const funding =
          fundingByCampaign.get(campaign.id);

        const collectedAmount =
          funding?.collected ?? 0n;

        const donationCount =
          funding?.donationCount ?? 0;

        const goalAmount =
          campaign.goalAmount;

        /* ================================================
           OBJET PUBLIC
        ================================================ */

        return {
          id: campaign.id,
          slug: campaign.slug,
          title: campaign.title,

          description: excerpt(
            campaign.description
          ),

          imageUrl:
            publicImageUrl(imageStorageKey),

          imageStorageKey,

          organizer,

          location: {
            country:
              normalizeStorageKey(
                campaign.country
              ),

            city:
              normalizeStorageKey(
                campaign.city
              ),
          },

          funding: {
            goal: toMoney(
              goalAmount,
              campaign.currency
            ),

            collected: toMoney(
              collectedAmount,
              campaign.currency
            ),

            percentage: calculatePercentage(
              collectedAmount,
              goalAmount
            ),

            donationCount,
          },

          currency: campaign.currency,

          publishedAt:
            campaign.publishedAt
              ?.toISOString() ?? null,

          updatedAt:
            campaign.updatedAt.toISOString(),

          href:
            `/campaigns/${encodeURIComponent(
              campaign.slug
            )}`,
        };
      });

    /* ======================================================
       8. PAGINATION

       Les résultats sont répartis
       en pages.

       La navigation peut afficher :
       - Précédent
       - Pages disponibles
       - Suivant

       Une page vide reste valide
       lorsqu'elle dépasse la dernière
       page disponible.
    ====================================================== */

    const totalPages = Math.ceil(total / limit);

    const hasNext = page < totalPages;

    const hasPrevious =
      page > 1 && totalPages > 0;

    /* ======================================================
       9. RÉPONSE PUBLIQUE

       La même structure sera utilisée
       sur PC et mobile.

       Les données sont chargées depuis
       PostgreSQL à chaque nouvelle
       requête HTTP.

       Pas de cache de réponse.
    ====================================================== */

    return NextResponse.json(
      await resolvePublicMedia({
        success: true,

        generatedAt:
          new Date().toISOString(),

        data: {
          campaigns: publicCampaigns,
        },

        pagination: {
          page,
          limit,

          total,
          totalPages,

          hasNext,
          hasPrevious,
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
       10. GESTION DES ERREURS

       Les détails techniques sont
       uniquement journalisés côté serveur.

       Le visiteur ne reçoit jamais :
       - Identifiants PostgreSQL
       - Informations de connexion
       - Secrets internes
       - Détails des requêtes
       - Traces d'erreurs privées
    ====================================================== */

    console.error(
      "[TIKEMIA_PUBLIC_CAMPAIGNS_ERROR]",
      error
    );

    return NextResponse.json(
      {
        success: false,

        code: "CAMPAIGNS_UNAVAILABLE",

        message:
          "Les cagnottes sont temporairement indisponibles.",

        data: {
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
