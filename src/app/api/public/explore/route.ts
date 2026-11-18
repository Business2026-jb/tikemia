import { getPlatformPrisma } from "@/lib/payments/fulfillment";
import { EVENT_CATEGORY_DEFINITIONS } from "@/i18n/config";
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
import type { Prisma } from "@/generated/prisma/client";

/* ==========================================================
   TIKEMIA — API PUBLIQUE EXPLORER

   FICHIER :
   src/app/api/public/explore/route.ts

   MÉTHODE :
   GET /api/public/explore

   CONTENU :
   ÉVÉNEMENTS UNIQUEMENT.

   AUCUNE CAGNOTTE.

   FONCTIONNALITÉS :
   - Événements réellement publiés
   - Recherche par mot-clé
   - Filtre pays
   - Filtre ville
   - Filtre date
   - Catégories existantes
   - Pagination serveur
   - Priorité au pays du visiteur
   - Nom et photo de l'organisateur
   - Images des événements
   - Dates, lieux et tarifs
   - Lecture publique sans connexion

   SÉCURITÉ :
   - Aucune écriture en base
   - Aucun champ privé utilisateur
   - Aucune donnée de paiement
   - Aucun mot de passe ou token
   - Organisation active obligatoire
   - Statut PUBLISHED obligatoire
   - Limitation des paramètres
   - Aucune donnée fictive

   TECHNOLOGIES :
   Next.js App Router
   TypeScript
   Prisma 7
   PostgreSQL
========================================================== */

/* ==========================================================
   CONSTANTES
========================================================== */

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;

const MAX_PAGE = 1000;
const MAX_LIMIT = 24;

const MAX_QUERY_LENGTH = 120;
const MAX_FILTER_LENGTH = 100;

const HEADERS = {
  "Cache-Control":
    "no-store, no-cache, must-revalidate, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

/* ==========================================================
   TYPES
========================================================== */

type CountryDetection = {
  code: string | null;
  source: "hosting-header" | "unavailable";
};

type Amount = {
  amountMinor: string;
  currency: string;
};

type PublicEvent = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;

  imageUrl: string | null;
  imageStorageKey: string | null;

  organizer: {
    blueBadgeEnabled: boolean;
    id: string;
    name: string;
    profileName: string;
    photoUrl: string | null;
    photoStorageKey: string | null;
  };

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
    from: Amount | null;
    isFree: boolean;
    categories: {
      id: string;
      name: string;
      price: Amount;
      capacity: number;
    }[];
  };

  currency: string;
  publishedAt: string | null;
  href: string;
};

/* ==========================================================
   UTILITAIRES — PARAMÈTRES
========================================================== */

function readInteger(
  value: string | null,
  fallback: number,
  maximum: number
): number | null {
  if (value === null || value === "") {
    return fallback;
  }

  if (!/^\d{1,6}$/.test(value)) {
    return null;
  }

  const number = Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number < 1 ||
    number > maximum
  ) {
    return null;
  }

  return number;
}

function readText(
  value: string | null,
  maximum = MAX_FILTER_LENGTH
): string | null {
  if (value === null) {
    return "";
  }

  const clean = value
    .replace(/\s+/g, " ")
    .trim();

  if (clean.length > maximum) {
    return null;
  }

  return clean;
}

function parseDay(
  value: string
): {
  start: Date;
  end: Date;
} | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const start = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(start.getTime()) ||
    start.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  const end = new Date(
    start.getTime() + 24 * 60 * 60 * 1000
  );

  return { start, end };
}

/* ==========================================================
   UTILITAIRES — PAYS

   Le champ Venue.country est une chaîne
   dans le Prisma existant.

   Nous reconnaissons donc les valeurs
   réellement enregistrées, sans créer
   une nouvelle table de pays.

   La normalisation prend en charge :
   - Majuscules / minuscules
   - Accents
   - Apostrophes
   - Espaces
========================================================== */

function normalizeCountry(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Principales variantes linguistiques
 * nécessaires pour reconnaître certains
 * noms de pays stockés dans la base.
 *
 * Ce dictionnaire ne crée pas de
 * catégories ou de modèles Prisma.
 */
const COUNTRY_ALIASES: Record<string, string[]> = {
  CI: [
    "CI",
    "Côte d'Ivoire",
    "Côte d’Ivoire",
    "Cote d Ivoire",
    "Ivory Coast",
  ],

  BJ: [
    "BJ",
    "Bénin",
    "Benin",
  ],

  SN: [
    "SN",
    "Sénégal",
    "Senegal",
  ],

  TG: [
    "TG",
    "Togo",
  ],

  BF: [
    "BF",
    "Burkina Faso",
  ],

  ML: [
    "ML",
    "Mali",
  ],

  NE: [
    "NE",
    "Niger",
  ],

  GN: [
    "GN",
    "Guinée",
    "Guinea",
  ],

  GH: [
    "GH",
    "Ghana",
  ],

  NG: [
    "NG",
    "Nigeria",
  ],

  CM: [
    "CM",
    "Cameroun",
    "Cameroon",
  ],

  CD: [
    "CD",
    "RDC",
    "RD Congo",
    "République démocratique du Congo",
    "Democratic Republic of the Congo",
  ],

  CG: [
    "CG",
    "Congo",
    "République du Congo",
    "Republic of the Congo",
  ],

  FR: [
    "FR",
    "France",
  ],

  BE: [
    "BE",
    "Belgique",
    "Belgium",
  ],

  DE: [
    "DE",
    "Allemagne",
    "Germany",
  ],

  AT: [
    "AT",
    "Autriche",
    "Austria",
  ],

  IT: [
    "IT",
    "Italie",
    "Italy",
  ],

  US: [
    "US",
    "États-Unis",
    "Etats Unis",
    "United States",
    "USA",
  ],

  CA: [
    "CA",
    "Canada",
  ],

  GB: [
    "GB",
    "Royaume-Uni",
    "United Kingdom",
    "UK",
  ],
};

function countryNames(value: string): string[] {
  const clean = value.trim();

  if (!clean) {
    return [];
  }

  const names = new Set<string>([clean]);

  const upper = clean.toUpperCase();

  if (/^[A-Z]{2}$/.test(upper)) {
    names.add(upper);

    for (const locale of ["fr", "en"]) {
      try {
        const formatter = new Intl.DisplayNames(
          [locale],
          { type: "region" }
        );

        const displayName = formatter.of(upper);

        if (displayName) {
          names.add(displayName);
        }
      } catch {
        // Continue sans traduction automatique.
      }
    }
  }

  for (const aliases of Object.values(
    COUNTRY_ALIASES
  )) {
    const matched = aliases.some(
      (name) =>
        normalizeCountry(name) ===
        normalizeCountry(clean)
    );

    if (matched) {
      for (const alias of aliases) {
        names.add(alias);
      }
    }
  }

  if (COUNTRY_ALIASES[upper]) {
    for (const alias of COUNTRY_ALIASES[upper]) {
      names.add(alias);
    }
  }

  return [...names];
}

/**
 * Recherche les valeurs de pays telles
 * qu'elles sont réellement présentes
 * dans les lieux des événements.
 *
 * Permet par exemple :
 * CI = Côte d'Ivoire.
 */
function matchStoredCountries(
  requestedCountry: string,
  storedCountries: string[]
): string[] {
  const aliases = countryNames(requestedCountry);

  const normalizedAliases = new Set(
    aliases.map(normalizeCountry)
  );

  return storedCountries.filter(
    (country) =>
      normalizedAliases.has(
        normalizeCountry(country)
      )
  );
}

/* ==========================================================
   GÉOLOCALISATION APPROXIMATIVE PAR IP

   Utilise uniquement les en-têtes
   géographiques d'une infrastructure
   de déploiement configurée.

   Ne lit pas directement l'IP brute.
   N'enregistre pas l'adresse IP.

   Aucun appel à un service extérieur.

   En développement localhost, le pays
   peut être indisponible.

   IMPORTANT :
   L'hébergeur doit contrôler ces en-têtes
   et supprimer toute valeur entrante
   fournie directement par un visiteur.
========================================================== */

function detectVisitorCountry(
  request: NextRequest
): CountryDetection {
  const candidates = [
    request.headers.get("x-vercel-ip-country"),
    request.headers.get("cf-ipcountry"),
  ];

  for (const candidate of candidates) {
    const code = candidate
      ?.trim()
      .toUpperCase();

    if (
      code &&
      /^[A-Z]{2}$/.test(code) &&
      code !== "XX" &&
      code !== "T1"
    ) {
      return {
        code,
        source: "hosting-header",
      };
    }
  }

  return {
    code: null,
    source: "unavailable",
  };
}

/* ==========================================================
   MÉDIAS

   Ne fabrique pas d'adresse Supabase.

   Une URL HTTP(S) publique ou un chemin
   local peut être utilisé directement.

   Les storageKey restent disponibles
   pour le mécanisme d'images TIKEMIA.
========================================================== */

function imageUrl(
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

function money(
  amount: bigint,
  currency: string
): Amount {
  return {
    amountMinor: amount.toString(),
    currency,
  };
}

function excerpt(
  value: string,
  maximum = 180
): string {
  const text = value
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maximum) {
    return text;
  }

  return `${text.slice(0, maximum).trimEnd()}…`;
}

/* ==========================================================
   SÉLECTION PRISMA

   Champs publics nécessaires aux cartes.

   On évite de récupérer :
   - Email organisateur
   - Téléphone organisateur
   - Mot de passe
   - Données financières privées
   - Informations des clients
========================================================== */

const eventSelect = {
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
      { isPrimary: "desc" },
      { position: "asc" },
      { createdAt: "asc" },
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
} as const satisfies Prisma.EventSelect;

/* ==========================================================
   TRI STABLE

   Garantit une pagination prévisible
   lors des lectures successives.
========================================================== */

const eventOrderBy = [
  { publishedAt: "desc" },
  { createdAt: "desc" },
  { id: "desc" },
] as const satisfies Prisma.EventOrderByWithRelationInput[];

/* ==========================================================
   CONVERSION DES DONNÉES PRISMA

   Le type est déduit du select exact.
========================================================== */

type SelectedEvent = Prisma.EventGetPayload<{
  select: typeof eventSelect;
}>;

function serializeEvent(
  event: SelectedEvent,
  now: Date
): PublicEvent {
  const organization = event.organization;
  const owner = organization.owner;
  const creator = event.createdBy;

  /* --------------------------------------------------------
     ORGANISATEUR

     Nom affiché :
     1. Nom de l'organisation
     2. Nom du propriétaire
     3. Nom du créateur

     Photo affichée :
     1. Logo de l'organisation
     2. Avatar du propriétaire
     3. Avatar du créateur
  -------------------------------------------------------- */

  const organizerName =
    organization.name.trim() ||
    owner.fullName.trim() ||
    creator.fullName.trim();

  const photoStorageKey =
    organization.logoStorageKey ||
    owner.avatarStorageKey ||
    creator.avatarStorageKey ||
    null;

  /* --------------------------------------------------------
     IMAGE DE L'ÉVÉNEMENT
  -------------------------------------------------------- */

  const mainImage =
    event.images[0]?.storageKey ?? null;

  /* --------------------------------------------------------
     SÉANCE

     Préférence pour une séance future
     ou non terminée.

     Sinon, première séance enregistrée.
  -------------------------------------------------------- */

  const schedule =
    event.schedules.find((item) =>
      item.endsAt
        ? item.endsAt >= now
        : item.startsAt >= now
    ) ??
    event.schedules[0] ??
    null;

  /* --------------------------------------------------------
     TARIFS

     Les prix viennent exclusivement
     des TicketCategory actives.
  -------------------------------------------------------- */

  const activeCategories =
    event.categories.map((category) => ({
      id: category.id,
      name: category.name,

      price: money(
        category.price,
        category.currency
      ),

      capacity: category.capacity,
    }));

  const firstPrice =
    event.categories[0] ?? null;

  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: excerpt(event.description),
    category: event.category,

    imageUrl: imageUrl(mainImage),

    imageStorageKey: mainImage,

    organizer: {
      blueBadgeEnabled: organization.blueBadgeEnabled,
      id: organization.id,
      name: organizerName,

      profileName:
        owner.fullName.trim() ||
        creator.fullName.trim(),

      photoUrl: imageUrl(photoStorageKey),

      photoStorageKey,
    },

    venue: event.venue
      ? {
          name: event.venue.name,
          address: event.venue.address,
          city: event.venue.city,
          country: event.venue.country,
        }
      : null,

    schedule: schedule
      ? {
          startsAt:
            schedule.startsAt.toISOString(),

          endsAt:
            schedule.endsAt?.toISOString() ??
            null,

          timeZone: event.timeZone,
        }
      : null,

    pricing: {
      from: firstPrice
        ? money(
            firstPrice.price,
            firstPrice.currency
          )
        : null,

      isFree:
        firstPrice !== null &&
        firstPrice.price === 0n,

      categories: activeCategories,
    },

    currency: event.currency,

    publishedAt:
      event.publishedAt?.toISOString() ??
      null,

    href:
      `/events/${encodeURIComponent(event.slug)}`,
  };
}

/* ==========================================================
   RÉPONSES
========================================================== */

function badRequest(message: string) {
  return NextResponse.json(
    {
      success: false,
      code: "INVALID_EXPLORE_FILTER",
      message,
    },
    {
      status: 400,
      headers: HEADERS,
    }
  );
}

/* ==========================================================
   GET /api/public/explore
========================================================== */

export async function GET(
  request: NextRequest
) {
  try {
    const prisma = getPrisma();

    const params =
      request.nextUrl.searchParams;

    /* ======================================================
       1. PAGINATION
    ====================================================== */

    const page = readInteger(
      params.get("page"),
      DEFAULT_PAGE,
      MAX_PAGE
    );

    const limit = readInteger(
      params.get("limit"),
      DEFAULT_LIMIT,
      MAX_LIMIT
    );

    if (page === null || limit === null) {
      return badRequest(
        "Pagination invalide."
      );
    }

    /* ======================================================
       2. FILTRES UTILISATEUR
    ====================================================== */

    const query = readText(
      params.get("q"),
      MAX_QUERY_LENGTH
    );

    const requestedCountry = readText(
      params.get("country")
    );

    const city = readText(
      params.get("city")
    );

    const category = readText(
      params.get("category")
    );

    const dateValue = readText(
      params.get("date"),
      10
    );

    if (
      query === null ||
      requestedCountry === null ||
      city === null ||
      category === null ||
      dateValue === null
    ) {
      return badRequest(
        "Un filtre dépasse la longueur autorisée."
      );
    }

    const dateRange = dateValue
      ? parseDay(dateValue)
      : null;

    if (dateValue && !dateRange) {
      return badRequest(
        "La date doit respecter le format AAAA-MM-JJ."
      );
    }

    /* ======================================================
       3. DÉTECTION GÉOGRAPHIQUE

       Un filtre manuel est prioritaire.

       L'adresse IP n'est pas conservée
       dans la base ou dans la réponse.
    ====================================================== */

    const detection =
      detectVisitorCountry(request);

    const countryFilterIsManual =
      requestedCountry.length > 0;

    const priorityCountry =
      countryFilterIsManual
        ? null
        : detection.code;

    const now = new Date();

    /* ======================================================
       4. DONNÉES DE FILTRES EXISTANTES

       Catégories :
       Event.category

       Pays :
       Venue.country

       Uniquement des événements publiés.

       Aucun modèle supplémentaire.
    ====================================================== */

    const publicScope: Prisma.EventWhereInput = {
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
    };

    const [categoryRows, countryRows] =
      await Promise.all([
        prisma.event.findMany({
          where: publicScope,

          distinct: ["category"],

          select: {
            category: true,
          },

          orderBy: {
            category: "asc",
          },

          take: 150,
        }),

        prisma.venue.findMany({
          where: {
            event: {
              status: "PUBLISHED",

              organization: {
                isActive: true,
              },
            },
          },

          distinct: ["country"],

          select: {
            country: true,
          },

          orderBy: {
            country: "asc",
          },
        }),
      ]);

    const categories = EVENT_CATEGORY_DEFINITIONS.map(item => item.key);
    const availableCategories = categoryRows.map(row => row.category.trim()).filter(Boolean);

    const availableCountries =
      countryRows
        .map((row) => row.country.trim())
        .filter(Boolean);

    /* ======================================================
       5. PAYS DISPONIBLES

       Un même pays peut être enregistré
       en français, anglais ou code ISO.

       Le filtrage utilise les vraies
       valeurs présentes en base.
    ====================================================== */

    const manuallyMatchedCountries =
      countryFilterIsManual
        ? matchStoredCountries(
            requestedCountry,
            availableCountries
          )
        : [];

    const prioritizedCountries =
      priorityCountry
        ? matchStoredCountries(
            priorityCountry,
            availableCountries
          )
        : [];

    /* ======================================================
       6. CONSTRUCTION DES FILTRES

       Recherche :
       - Titre
       - Description
       - Catégorie
       - Nom organisateur
       - Ville
       - Nom du lieu

       Les conditions sont appliquées
       côté PostgreSQL.
    ====================================================== */

    const filters: Prisma.EventWhereInput[] = [
      publicScope,
    ];

    if (query) {
      filters.push({
        OR: [
          {
            title: {
              contains: query,
              mode: "insensitive",
            },
          },

          {
            description: {
              contains: query,
              mode: "insensitive",
            },
          },

          {
            category: {
              contains: query,
              mode: "insensitive",
            },
          },

          {
            organization: {
              name: {
                contains: query,
                mode: "insensitive",
              },
            },
          },

          {
            venue: {
              is: {
                name: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
          },

          {
            venue: {
              is: {
                city: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
          },
        ],
      });
    }

    if (city) {
      filters.push({
        venue: {
          is: {
            city: {
              equals: city,
              mode: "insensitive",
            },
          },
        },
      });
    }

    if (category) {
      filters.push({
        category: {
          equals: category,
          mode: "insensitive",
        },
      });
    }

    if (dateRange) {
      filters.push({
        schedules: {
          some: {
            startsAt: {
              gte: dateRange.start,
              lt: dateRange.end,
            },
          },
        },
      });
    }

    /* ======================================================
       7. PAYS MANUEL

       Si le visiteur choisit un pays,
       on limite réellement les résultats
       à ce pays.

       Contrairement à la géolocalisation
       automatique, il ne s'agit pas
       uniquement d'une priorité.
    ====================================================== */

    if (countryFilterIsManual) {
      if (manuallyMatchedCountries.length === 0) {
        filters.push({
          venue: {
            is: {
              country: {
                equals: requestedCountry,
                mode: "insensitive",
              },
            },
          },
        });
      } else {
        filters.push({
          venue: {
            is: {
              country: {
                in: manuallyMatchedCountries,
              },
            },
          },
        });
      }
    }

    const baseWhere: Prisma.EventWhereInput = {
      AND: filters,
    };

    /* ======================================================
       8. NOMBRE TOTAL

       Le total correspond à la recherche
       entière, pas seulement à la page.
    ====================================================== */

    const total =
      await prisma.event.count({
        where: baseWhere,
      });

    const totalPages =
      Math.ceil(total / limit);

    const skip =
      (page - 1) * limit;

    /* ======================================================
       9. PRIORITÉ GÉOGRAPHIQUE

       Exemple :
       Visiteur CI.

       Ordre :
       1. Événements Côte d'Ivoire
       2. Autres événements

       La pagination respecte cet ordre.

       Si aucun événement local n'existe,
       tous les événements restent visibles.

       Une sélection manuelle du pays
       désactive cette priorité.
    ====================================================== */

    const useGeoPriority =
      !countryFilterIsManual &&
      prioritizedCountries.length > 0;

    let selectedEvents: SelectedEvent[] = [];

    let localTotal = 0;

    if (useGeoPriority) {
      const localCondition: Prisma.EventWhereInput = {
        venue: {
          is: {
            country: {
              in: prioritizedCountries,
            },
          },
        },
      };

      const localWhere: Prisma.EventWhereInput = {
        AND: [
          baseWhere,
          localCondition,
        ],
      };

      const otherWhere: Prisma.EventWhereInput = {
        AND: [
          baseWhere,
          {
            NOT: localCondition,
          },
        ],
      };

      localTotal =
        await prisma.event.count({
          where: localWhere,
        });

      /*
       * Calcul du nombre de résultats
       * locaux à afficher pour cette page.
       */

      const localSkip =
        Math.min(skip, localTotal);

      const localTake =
        Math.min(
          limit,
          Math.max(
            0,
            localTotal - localSkip
          )
        );

      const otherSkip =
        Math.max(
          0,
          skip - localTotal
        );

      const otherTake =
        limit - localTake;

      /*
       * Les deux groupes sont calculés
       * séparément pour garantir la
       * priorité du pays même en pagination.
       */

      const [localEvents, otherEvents] =
        await Promise.all([
          localTake > 0
            ? prisma.event.findMany({
                where: localWhere,

                orderBy: eventOrderBy,

                skip: localSkip,

                take: localTake,

                select: eventSelect,
              })
            : Promise.resolve(
                [] as SelectedEvent[]
              ),

          otherTake > 0
            ? prisma.event.findMany({
                where: otherWhere,

                orderBy: eventOrderBy,

                skip: otherSkip,

                take: otherTake,

                select: eventSelect,
              })
            : Promise.resolve(
                [] as SelectedEvent[]
              ),
        ]);

      selectedEvents = [
        ...localEvents,
        ...otherEvents,
      ];
    } else {
      /* ----------------------------------------------------
         Aucun pays détecté.

         Ou filtre pays choisi manuellement.

         Tri classique par publication.
      ---------------------------------------------------- */

      selectedEvents =
        await prisma.event.findMany({
          where: baseWhere,

          orderBy: eventOrderBy,

          skip,

          take: limit,

          select: eventSelect,
        });
    }

    /* ======================================================
       10. SÉRIALISATION

       Les données BigInt des tarifs
       sont converties en chaînes.

       Les dates deviennent ISO 8601.

       Aucun objet Prisma brut n'est
       envoyé au navigateur.
    ====================================================== */

    const events = selectedEvents.map(
      (event) =>
        serializeEvent(event, now)
    );

    /* ======================================================
       11. RÉPONSE FINALE

       Compatible avec :
       - PC
       - Mobile
       - Tablette

       Les composants frontend utilisent
       exactement la même API.

       Aucune cagnotte dans la réponse.
    ====================================================== */

    return NextResponse.json(
      await resolvePublicMedia({
        success: true,

        generatedAt:
          new Date().toISOString(),

        data: {
          events,
        },

        filters: {
          query,
          country: requestedCountry || null,
          city: city || null,
          category: category || null,
          date: dateValue || null,

          categories,
        availableCategories,

          countries: availableCountries,
        },

        geo: {
          detectedCountry:
            detection.code,

          detectionSource:
            detection.source,

          prioritizedCountry:
            useGeoPriority
              ? priorityCountry
              : null,

          priorityApplied:
            useGeoPriority &&
            localTotal > 0,

          localResults:
            useGeoPriority
              ? localTotal
              : 0,

          manualCountrySelection:
            countryFilterIsManual,
        },

        pagination: {
          page,
          limit,
          total,
          totalPages,

          hasNext:
            page < totalPages,

          hasPrevious:
            page > 1 && totalPages > 0,
        },
      }, process.env.SUPABASE_EVENT_BUCKET || "event-images"),
      {
        status: 200,
        headers: HEADERS,
      }
    );
  } catch (error) {
    unstable_rethrow(error);

    /* ======================================================
       ERREURS SERVEUR

       Ne jamais transmettre :
       - Les détails PostgreSQL
       - Les secrets Prisma
       - Les identifiants de connexion
       - Les traces d'erreurs internes
    ====================================================== */

    console.error(
      "[TIKEMIA_PUBLIC_EXPLORE_ERROR]",
      error
    );

    return NextResponse.json(
      {
        success: false,

        code: "EXPLORE_UNAVAILABLE",

        message:
          "Les événements sont temporairement indisponibles.",

        data: {
          events: [],
        },
      },
      {
        status: 500,
        headers: HEADERS,
      }
    );
  }
}
