import { getTrustedRequestOrigin } from "@/lib/tikemia-pay/providers";
import { getPlatformPrisma } from "@/lib/payments/fulfillment";
import { publicationSlug as titleSlug } from "@/i18n/config";
import {
  isSupportedCurrency,
  SUPPORTED_CURRENCIES,
  currencyDecimals,
} from "@/i18n/config";


import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createHash,
  } from "node:crypto";

import {
  PrismaClient,
  Prisma,
} from "@/generated/prisma/client";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  isSupportedCountry,
} from "libphonenumber-js";

/* ============================================
   TIKEMIA — API DES CAGNOTTES

   Fichier :
   src/app/api/organizer/campaigns/route.ts

   GET /api/organizer/campaigns

   - Liste des cagnottes
   - Recherche
   - Filtres de statut
   - Pagination
   - Compteurs des onglets
   - Objectifs financiers
   - Dons confirmés
   - Pourcentage de progression
   - Images Supabase Storage

   POST /api/organizer/campaigns

   - Création d'une cagnotte
   - Vérification de la session
   - Vérification du rôle organisateur
   - Validation des six champs
   - Vérification des images Supabase
   - Enregistrement PostgreSQL
   - Statut PENDING_REVIEW

   Technologies :
   - Next.js App Router
   - TypeScript
   - Prisma ORM 7
   - PostgreSQL
   - Supabase Storage
============================================ */




/* ============================================
   CONFIGURATION
============================================ */

const SESSION_COOKIE =
  "tikemia_organizer_session";

const MAX_BODY_BYTES =
  64 * 1024;

const MAX_IMAGES = 10;

const MAX_IMAGE_SIZE =
  10 * 1024 * 1024;

const MAX_GOAL =
  BigInt("999999999999");

const DEFAULT_PAGE_SIZE = 10;

const MAX_PAGE_SIZE = 50;

const IMAGE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_CURRENCIES =
  new Set<string>(SUPPORTED_CURRENCIES);

type Language =
  | "fr"
  | "en";

type Currency = (typeof SUPPORTED_CURRENCIES)[number];

type CampaignFilter =
  | "all"
  | "active"
  | "completed"
  | "drafts";

type SortOption =
  | "newest"
  | "oldest"
  | "title_asc"
  | "title_desc";

type JsonRecord =
  Record<string, unknown>;

type OrganizerContext = {
  userId: string;
  organizationIds: string[];
};

type CampaignInput = {
  title: string;
  description: string;
  countryCode: string;
  city: string;
  goalAmount: bigint;
  currency: Currency;
  imageIds: string[];
};

type ErrorKey =
  | "unauthorized"
  | "forbidden"
  | "invalidRequest"
  | "tooLarge"
  | "invalidTitle"
  | "invalidDescription"
  | "invalidCountry"
  | "invalidCity"
  | "invalidGoal"
  | "invalidCurrency"
  | "invalidImages"
  | "missingImages"
  | "serverError";

/* ============================================
   STATUTS DES CAGNOTTES

   Ces valeurs correspondent aux statuts
   utilisés dans les autres API TIKEMIA.

   Les brouillons comprennent également
   les cagnottes en attente de validation.

   Les cagnottes annulées sont conservées
   dans l'onglet Tous.
============================================ */

const ACTIVE_STATUSES =
  new Set([
    "ACTIVE",
    "PUBLISHED",
    "ON_SALE",
  ]);

const COMPLETED_STATUSES =
  new Set([
    "COMPLETED",
    "CLOSED",
  ]);

const DRAFT_STATUSES =
  new Set([
    "DRAFT",
    "PENDING_REVIEW",
  ]);

/* ============================================
   TEXTES FRANÇAIS / ANGLAIS
============================================ */

const TEXT = {
  fr: {
    unauthorized:
      "Veuillez vous connecter à votre espace organisateur.",

    forbidden:
      "Vous n'êtes pas autorisé à effectuer cette opération.",

    invalidRequest:
      "Les informations envoyées sont invalides.",

    tooLarge:
      "La requête est trop volumineuse.",

    invalidTitle:
      "Le nom de la cagnotte doit contenir entre 3 et 180 caractères.",

    invalidDescription:
      "La description doit contenir entre 10 et 2000 caractères.",

    invalidCountry:
      "Veuillez sélectionner un pays valide.",

    invalidCity:
      "Veuillez renseigner une ville valide.",

    invalidGoal:
      "Veuillez saisir un objectif financier valide et supérieur à zéro.",

    invalidCurrency:
      "La devise sélectionnée est invalide.",

    invalidImages:
      "Ajoutez entre 1 et 10 images valides.",

    missingImages:
      "Une ou plusieurs images sont introuvables dans Supabase Storage.",

    serverError:
      "Impossible de traiter la demande pour le moment.",

    created:
      "Votre cagnotte est publiee.",

    loaded:
      "Cagnottes récupérées avec succès.",
  },

  en: {
    unauthorized:
      "Please sign in to your organizer account.",

    forbidden:
      "You are not authorized to perform this operation.",

    invalidRequest:
      "Invalid request data.",

    tooLarge:
      "The request is too large.",

    invalidTitle:
      "The fundraiser name must contain between 3 and 180 characters.",

    invalidDescription:
      "The description must contain between 10 and 2000 characters.",

    invalidCountry:
      "Please select a valid country.",

    invalidCity:
      "Please enter a valid city.",

    invalidGoal:
      "Please enter a valid fundraising goal greater than zero.",

    invalidCurrency:
      "The selected currency is invalid.",

    invalidImages:
      "Please add between 1 and 10 valid images.",

    missingImages:
      "One or more images could not be found in Supabase Storage.",

    serverError:
      "Unable to process the request right now.",

    created:
      "Your fundraiser is published.",

    loaded:
      "Fundraisers retrieved successfully.",
  },
} as const;

/* ============================================
   PRISMA ORM 7
============================================ */



const getPrisma = getPlatformPrisma;

/* ============================================
   SUPABASE STORAGE

   Les buckets restent privés.
   La clé serveur ne doit jamais être
   envoyée au navigateur.
============================================ */

let supabaseClient:
  ReturnType<typeof createClient> | null =
    null;

function getStorage() {
  if (!supabaseClient) {
    const url =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

    const key =
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error(
        "SUPABASE_STORAGE_NOT_CONFIGURED"
      );
    }

    supabaseClient =
      createClient(
        url,
        key,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      );
  }

  const bucket =
    process.env.SUPABASE_CAMPAIGN_BUCKET ||
    "campaign-images";

  return supabaseClient.storage.from(
    bucket
  );
}

/* ============================================
   RÉPONSES
============================================ */

function respond(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(
    data,
    {
      status,

      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",

        "X-Content-Type-Options":
          "nosniff",

        Vary: "Cookie",
      },
    }
  );
}

function errorResponse(
  language: Language,
  key: ErrorKey,
  status: number
) {
  return respond(
    {
      success: false,
      message: TEXT[language][key],
    },
    status
  );
}

/* ============================================
   LANGUE
============================================ */

function getLanguage(
  request: NextRequest
): Language {
  const queryLanguage =
    request.nextUrl.searchParams.get(
      "locale"
    );

  if (
    queryLanguage === "fr" ||
    queryLanguage === "en"
  ) {
    return queryLanguage;
  }

  const header =
    request.headers.get(
      "accept-language"
    ) ?? "";

  return header
    .toLowerCase()
    .startsWith("en")
    ? "en"
    : "fr";
}

/* ============================================
   PROTECTION CONTRE LES REQUÊTES
   PROVENANT D'UNE AUTRE ORIGINE
============================================ */

function isAllowedOrigin(
  request: NextRequest
): boolean {
  const fetchSite =
    request.headers.get(
      "sec-fetch-site"
    );

  if (
    fetchSite &&
    fetchSite !== "same-origin"
  ) {
    return false;
  }

  const origin =
    request.headers.get(
      "origin"
    );

  return Boolean(
    origin &&
    origin === getTrustedRequestOrigin(request)
  );
}

/* ============================================
   VÉRIFICATION DE L'ORGANISATEUR
============================================ */

async function authenticate(
  request: NextRequest,
  prisma: PrismaClient
): Promise<OrganizerContext | null> {
  const token =
    request.cookies.get(
      SESSION_COOKIE
    )?.value;

  if (
    !token ||
    !/^[a-f0-9]{64}$/i.test(token)
  ) {
    return null;
  }

  const tokenHash =
    createHash("sha256")
      .update(
        token,
        "utf8"
      )
      .digest("hex");

  const session =
    await prisma.session.findFirst({
      where: {
        tokenHash,

        revokedAt: null,

        expiresAt: {
          gt: new Date(),
        },
      },

      select: {
        userId: true,
      },
    });

  if (!session) {
    return null;
  }

  const user =
    await prisma.user.findUnique({
      where: {
        id: session.userId,
      },

      select: {
        id: true,

        isActive: true,

        isBlocked: true,

        emailVerifiedAt: true,

        roles: {
          where: {
            role: "ORGANIZER",
          },

          select: {
            id: true,
          },

          take: 1,
        },
      },
    });

  if (
    !user ||
    !user.isActive ||
    user.isBlocked ||
    !user.emailVerifiedAt ||
    user.roles.length === 0
  ) {
    return null;
  }

  const organizations =
    await prisma.organization.findMany({
      where: {
        ownerId: user.id,
        isActive: true,
      },

      select: {
        id: true,
      },
    });

  if (
    organizations.length === 0
  ) {
    return null;
  }

  return {
    userId: user.id,

    organizationIds:
      organizations.map(
        (organization) =>
          organization.id
      ),
  };
}

/* ============================================
   VALIDATION DES TEXTES
============================================ */

function normalizeText(
  value: unknown,
  min: number,
  max: number
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const normalized =
    value
      .trim()
      .replace(
        /[ \t]+/g,
        " "
      );

  if (
    normalized.length < min ||
    normalized.length > max
  ) {
    return null;
  }

  if (
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(
      normalized
    )
  ) {
    return null;
  }

  return normalized;
}

/* ============================================
   OBJECTIF FINANCIER

   Stockage en montant entier.
   Aucune opération avec des flottants.
============================================ */

function parseGoal(value: unknown, currency: unknown = "XOF"): bigint | null {
 if (!isSupportedCurrency(currency)) return null;
 if (typeof value !== "string" && typeof value !== "number") return null;
 const raw = String(value).trim();
 if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(raw)) return null;
 const [whole, fraction = ""] = raw.split(".");
 if (currencyDecimals(currency) === 0 && /[1-9]/.test(fraction)) return null;
 const factor = currencyDecimals(currency) === 0 ? 1n : 100n;
 const result = BigInt(whole) * factor + (currencyDecimals(currency) === 0 ? 0n : BigInt(fraction.padEnd(2, "0")));
 return result > 0n && result <= MAX_GOAL * factor ? result : null;
}

/* ============================================
   CONVERSION DES MONTANTS POSTGRESQL
============================================ */

function toBigInt(
  value: unknown
): bigint {
  if (
    typeof value === "bigint"
  ) {
    return value;
  }

  if (
    typeof value === "number" &&
    Number.isSafeInteger(value)
  ) {
    return BigInt(value);
  }

  const raw =
    String(value ?? "0");

  if (
    !/^-?\d+(?:\.0+)?$/.test(raw)
  ) {
    throw new Error(
      "INVALID_FINANCIAL_AMOUNT"
    );
  }

  return BigInt(
    raw.split(".")[0]
  );
}

/* ============================================
   POURCENTAGE EXACT

   Les calculs utilisent BigInt.
   Le résultat peut dépasser 100 %
   si la collecte dépasse son objectif.
============================================ */

function calculateProgress(
  collected: bigint,
  goal: bigint
): number {
  if (
    goal <= 0n
  ) {
    return 0;
  }

  const scaled =
    (collected * 10000n) /
    goal;

  const maximum =
    BigInt(
      Number.MAX_SAFE_INTEGER
    );

  const safeScaled =
    scaled > maximum
      ? maximum
      : scaled;

  return Number(
    safeScaled
  ) / 100;
}

/* ============================================
   IDENTIFIANTS DES IMAGES
============================================ */

function parseImageIds(
  value: unknown
): string[] | null {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > MAX_IMAGES
  ) {
    return null;
  }

  const ids:
    string[] = [];

  const seen =
    new Set<string>();

  for (
    const item of value
  ) {
    let id: unknown =
      item;

    if (
      item &&
      typeof item === "object" &&
      !Array.isArray(item)
    ) {
      id =
        (item as JsonRecord).id;
    }

    if (
      typeof id !== "string" ||
      !IMAGE_ID_PATTERN.test(id)
    ) {
      return null;
    }

    const normalized =
      id.toLowerCase();

    if (
      seen.has(normalized)
    ) {
      return null;
    }

    seen.add(normalized);
    ids.push(normalized);
  }

  return ids;
}

/* ============================================
   CHEMIN PRIVÉ D'UN ORGANISATEUR
============================================ */

function getOwnerPrefix(
  userId: string
): string {
  return createHash("sha256")
    .update(userId, "utf8")
    .digest("hex");
}

/* ============================================
   VÉRIFIER UNE IMAGE DANS SUPABASE

   Convention :
   campaign-images/
     HASH_ORGANISATEUR/
       UUID.jpg
       UUID.png
       UUID.webp
============================================ */

async function findUploadedImage(
  userId: string,
  imageId: string
): Promise<string | null> {
  const storage =
    getStorage();

  const prefix =
    getOwnerPrefix(userId);

  const formats = [
    {
      extension: "jpg",
      mime: "image/jpeg",
    },
    {
      extension: "png",
      mime: "image/png",
    },
    {
      extension: "webp",
      mime: "image/webp",
    },
  ] as const;

  for (
    const format of formats
  ) {
    const storageKey =
      `${prefix}/${imageId}.${format.extension}`;

    const {
      data,
      error,
    } =
      await storage.info(
        storageKey
      );

    if (error) {
      const status =
        Number(
          error.statusCode ??
            0
        );

      const message =
        error.message.toLowerCase();

      if (
        status === 404 ||
        message.includes("not found") ||
        message.includes("not_found")
      ) {
        continue;
      }

      throw error;
    }

    if (!data) {
      continue;
    }

    const size =
      Number(
        data.size ??
          0
      );

    const mime =
      String(
        data.contentType ??
          data.metadata?.mimetype ??
          ""
      );

    if (
      Number.isFinite(size) &&
      size > 0 &&
      size <= MAX_IMAGE_SIZE &&
      mime === format.mime
    ) {
      return storageKey;
    }
  }

  return null;
}

/* ============================================
   EXTRAIRE L'ID D'UNE IMAGE
============================================ */

function getImageId(
  storageKey: string
): string | null {
  const match =
    storageKey.match(
      /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(?:jpg|png|webp)$/i
    );

  return match
    ? match[1].toLowerCase()
    : null;
}

/* ============================================
   NORMALISER LE CHEMIN SUPABASE
============================================ */

function normalizeStorageKey(
  storageKey: string
): string {
  return storageKey.replace(
    /^campaigns\//,
    ""
  );
}

/* ============================================
   URL SIGNÉE DES IMAGES PRIVÉES

   Durée : 10 minutes.
   Aucune clé Supabase n'est exposée.
============================================ */

async function getSignedImageUrl(
  storageKey: string
): Promise<string | null> {
  const {
    data,
    error,
  } = await getStorage()
    .createSignedUrl(
      normalizeStorageKey(storageKey),
      600
    );

  if (error || !data) {
    return null;
  }

  return data.signedUrl;
}

/* ============================================
   SLUG UNIQUE
============================================ */

function makeSlug(
  title: string
): string { return titleSlug(title, "cagnotte"); }

/* ============================================
   VALIDATION DE LA CRÉATION
============================================ */

function validateCampaign(
  body: JsonRecord
):
  | {
      success: true;
      value: CampaignInput;
    }
  | {
      success: false;
      error: ErrorKey;
    } {
  const fail = (
    error: ErrorKey
  ) => ({
    success: false as const,
    error,
  });

  const title =
    normalizeText(
      body.title,
      3,
      180
    );

  if (!title) {
    return fail(
      "invalidTitle"
    );
  }

  const description =
    normalizeText(
      body.description,
      10,
      2000
    );

  if (!description) {
    return fail(
      "invalidDescription"
    );
  }

  const countryCode =
    typeof body.countryCode ===
      "string"
      ? body.countryCode
          .trim()
          .toUpperCase()
      : "";

  if (
    !isSupportedCountry(
      countryCode
    )
  ) {
    return fail(
      "invalidCountry"
    );
  }

  const city =
    normalizeText(
      body.city,
      1,
      120
    );

  if (!city) {
    return fail(
      "invalidCity"
    );
  }

  const goalAmount =
    parseGoal(body.goalAmount ?? body.targetAmount, body.currency ?? "XOF");

  if (
    goalAmount === null
  ) {
    return fail(
      "invalidGoal"
    );
  }

  const currencyValue =
    typeof body.currency ===
      "string"
      ? body.currency
          .trim()
          .toUpperCase()
      : "XOF";

  if (
    !ALLOWED_CURRENCIES.has(
      currencyValue
    )
  ) {
    return fail(
      "invalidCurrency"
    );
  }

  const imageIds =
    parseImageIds(
      body.images
    );

  if (!imageIds) {
    return fail(
      "invalidImages"
    );
  }

  return {
    success: true,

    value: {
      title,
      description,
      countryCode,
      city,
      goalAmount,
      currency:
        currencyValue as Currency,
      imageIds,
    },
  };
}

/* ============================================
   LECTURE LIMITÉE DU JSON

   Contrôle réel du volume,
   même sans Content-Length.
============================================ */

async function readJsonBody(
  request: NextRequest
): Promise<JsonRecord | null> {
  const contentType =
    request.headers.get(
      "content-type"
    ) ?? "";

  if (
    !contentType
      .toLowerCase()
      .startsWith(
        "application/json"
      )
  ) {
    return null;
  }

  const contentLength =
    request.headers.get(
      "content-length"
    );

  if (
    contentLength !== null
  ) {
    const length =
      Number(contentLength);

    if (
      !Number.isFinite(length) ||
      length < 0 ||
      length > MAX_BODY_BYTES
    ) {
      return null;
    }
  }

  if (!request.body) {
    return null;
  }

  let received = 0;

  const limitedStream =
    request.body.pipeThrough(
      new TransformStream<
        Uint8Array,
        Uint8Array
      >({
        transform(
          chunk,
          controller
        ) {
          received +=
            chunk.byteLength;

          if (
            received >
            MAX_BODY_BYTES
          ) {
            throw new Error(
              "REQUEST_TOO_LARGE"
            );
          }

          controller.enqueue(
            chunk
          );
        },
      })
    );

  try {
    const raw =
      await new Response(
        limitedStream
      ).text();

    const parsed:
      unknown =
        JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    return parsed as JsonRecord;
  } catch {
    return null;
  }
}

/* ============================================
   FILTRE DES ONGLETS
============================================ */

function getFilter(
  request: NextRequest
): CampaignFilter {
  const value =
    (
      request.nextUrl.searchParams.get(
        "status"
      ) ??
      request.nextUrl.searchParams.get(
        "filter"
      ) ??
      "all"
    )
      .trim()
      .toLowerCase();

  if (
    value === "active" ||
    value === "actifs"
  ) {
    return "active";
  }

  if (
    value === "completed" ||
    value === "termines" ||
    value === "terminés"
  ) {
    return "completed";
  }

  if (
    value === "drafts" ||
    value === "brouillons"
  ) {
    return "drafts";
  }

  return "all";
}

/* ============================================
   TRI
============================================ */

function getSort(
  request: NextRequest
): SortOption {
  const value =
    request.nextUrl.searchParams.get(
      "sort"
    );

  if (
    value === "oldest" ||
    value === "title_asc" ||
    value === "title_desc"
  ) {
    return value;
  }

  return "newest";
}

/* ============================================
   PAGINATION
============================================ */

function parsePage(
  value: string | null
): number {
  const parsed =
    Number(value ?? "1");

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1
  ) {
    return 1;
  }

  return Math.min(
    parsed,
    1_000_000
  );
}

function parsePageSize(
  value: string | null
): number {
  const parsed =
    Number(
      value ??
        String(DEFAULT_PAGE_SIZE)
    );

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1
  ) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(
    parsed,
    MAX_PAGE_SIZE
  );
}

/* ============================================
   CLASSIFIER UN STATUT
============================================ */

function statusGroup(
  status: string
): CampaignFilter | "other" {
  const normalized =
    status.toUpperCase();

  if (
    ACTIVE_STATUSES.has(normalized)
  ) {
    return "active";
  }

  if (
    COMPLETED_STATUSES.has(normalized)
  ) {
    return "completed";
  }

  if (
    DRAFT_STATUSES.has(normalized)
  ) {
    return "drafts";
  }

  return "other";
}

/* ============================================
   GET — MES CAGNOTTES

   Exemple :
   /api/organizer/campaigns
     ?status=active
     &search=ecole
     &page=1
     &pageSize=10
     &sort=newest

   La liste est toujours limitée aux
   organisations du compte connecté.

   Les compteurs des onglets portent
   sur toutes les cagnottes de
   l'organisateur, pas seulement
   sur la page actuellement affichée.
============================================ */

export async function GET(
  request: NextRequest
) {
  const language =
    getLanguage(request);

  try {
    /* ----------------------------------------
       1. AUTHENTIFICATION
    ---------------------------------------- */

    const prisma =
      getPrisma();

    const organizer =
      await authenticate(
        request,
        prisma
      );

    if (!organizer) {
      return errorResponse(
        language,
        "unauthorized",
        401
      );
    }

    /* ----------------------------------------
       2. PARAMÈTRES
    ---------------------------------------- */

    const filter =
      getFilter(request);

    const sort =
      getSort(request);

    const page =
      parsePage(
        request.nextUrl.searchParams.get(
          "page"
        )
      );

    const pageSize =
      parsePageSize(
        request.nextUrl.searchParams.get(
          "pageSize"
        ) ??
          request.nextUrl.searchParams.get(
            "limit"
          )
      );

    const search =
      (
        request.nextUrl.searchParams.get(
          "search"
        ) ?? ""
      )
        .trim()
        .slice(0, 150);

    /* ----------------------------------------
       3. FILTRE DE PROPRIÉTÉ
    ---------------------------------------- */

    const ownerWhere: Prisma.CampaignWhereInput = {
      organizationId: {
        in:
          organizer.organizationIds,
      },
    };

    /* ----------------------------------------
       4. COMPTEURS PAR STATUT

       Lecture des statuts présents
       dans le schéma actuel.

       Cette méthode évite de supposer
       qu'un statut optionnel existe
       nécessairement dans l'enum Prisma.
    ---------------------------------------- */

    const statusRows =
      await prisma.campaign.groupBy({
        by: [
          "status",
        ],

        where:
          ownerWhere,

        _count: {
          _all: true,
        },
      });

    const counts = {
      all: 0,
      active: 0,
      completed: 0,
      drafts: 0,
    };

    for (
      const row of statusRows
    ) {
      const count =
        row._count._all;

      counts.all += count;

      const group =
        statusGroup(
          String(row.status)
        );

      if (
        group !== "other" &&
        group !== "all"
      ) {
        counts[group] +=
          count;
      }
    }

    /* ----------------------------------------
       5. STATUTS CORRESPONDANT
          À L'ONGLET CHOISI
    ---------------------------------------- */

    const selectedStatuses =
      statusRows
        .filter((row) => {
          return (
            filter === "all" ||
            statusGroup(
              String(row.status)
            ) === filter
          );
        })
        .map(
          (row) =>
            row.status
        );

    /* ----------------------------------------
       6. CONSTRUIRE LE FILTRE PRISMA
    ---------------------------------------- */

    const where: Prisma.CampaignWhereInput = {
      ...ownerWhere,

      ...(filter !== "all"
        ? {
            status: {
              in:
                selectedStatuses,
            },
          }
        : {}),

      ...(search
        ? {
            OR: [
              {
                title: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                city: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                description: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };

    /* ----------------------------------------
       7. TRI
    ---------------------------------------- */

    const orderBy: Prisma.CampaignOrderByWithRelationInput =
      sort === "oldest"
        ? {
            createdAt: "asc",
          }
        : sort === "title_asc"
          ? {
              title: "asc",
            }
          : sort === "title_desc"
            ? {
                title: "desc",
              }
            : {
                createdAt: "desc",
              };

    /* ----------------------------------------
       8. PAGINATION ET LISTE
    ---------------------------------------- */

    const skip =
      (page - 1) *
      pageSize;

    const [
      total,
      campaigns,
    ] = await prisma.$transaction(
      [
        prisma.campaign.count({
          where,
        }),

        prisma.campaign.findMany({
          where,

          orderBy: [
            orderBy,
            {
              id: "desc",
            },
          ],

          skip,
          take:
            pageSize,

          select: {
            id: true,

            title: true,

            slug: true,

            description: true,

            status: true,

            country: true,

            city: true,

            currency: true,

            goalAmount: true,

            createdAt: true,

            updatedAt: true,

            images: {
              orderBy: {
                position: "asc",
              },

              take: 1,

              select: {
                id: true,

                storageKey: true,

                position: true,
              },
            },
          },
        }),
      ],
      {
        isolationLevel:
          "RepeatableRead",
      }
    );

    /* ----------------------------------------
       9. CALCUL DES DONS CONFIRMÉS

       Les calculs concernent seulement
       les cagnottes visibles sur
       cette page.

       Cela évite de lire chaque
       don individuellement.
    ---------------------------------------- */

    const campaignIds =
      campaigns.map(
        (campaign) =>
          campaign.id
      );

    const donationTotals =
      campaignIds.length > 0
        ? await prisma.donation.groupBy({
            by: [
              "campaignId",
              "currency",
            ],

            where: {
              campaignId: {
                in: campaignIds,
              },

              status:
                "CONFIRMED",
            },

            _sum: {
              amount: true,
            },

            _count: {
              _all: true,
            },
          })
        : [];

    /* ----------------------------------------
       10. INDEXER LES DONNÉES FINANCIÈRES

       Ne jamais additionner plusieurs
       devises comme s'il s'agissait
       de la même monnaie.
    ---------------------------------------- */

    const financeMap =
      new Map<
        string,
        {
          amount: bigint;
          count: number;
        }
      >();

    for (
      const item of donationTotals
    ) {
      const key =
        `${item.campaignId}:${item.currency}`;

      financeMap.set(
        key,
        {
          amount:
            toBigInt(
              item._sum.amount ??
                0
            ),

          count:
            item._count._all,
        }
      );
    }

    /* ----------------------------------------
       11. CONSTRUIRE LES CARTES

       Chaque image vient du bucket
       privé avec URL signée.

       Si une image est inaccessible,
       la page pourra afficher son
       emplacement vide.
    ---------------------------------------- */

    const items =
      await Promise.all(
        campaigns.map(
          async (campaign) => {
            const financeKey =
              `${campaign.id}:${campaign.currency}`;

            const finance =
              financeMap.get(
                financeKey
              );

            const goalAmount =
              toBigInt(
                campaign.goalAmount
              );

            const collectedAmount =
              finance?.amount ??
              0n;

            const remainingAmount =
              collectedAmount >= goalAmount
                ? 0n
                : goalAmount -
                  collectedAmount;

            const progress =
              calculateProgress(
                collectedAmount,
                goalAmount
              );

            const primaryImage =
              campaign.images[0] ??
              null;

            let imageUrl:
              string | null =
                null;

            if (
              primaryImage
            ) {
              try {
                imageUrl =
                  await getSignedImageUrl(
                    primaryImage.storageKey
                  );
              } catch {
                imageUrl = null;
              }
            }

            return {
              id:
                campaign.id,

              slug:
                campaign.slug,

              title:
                campaign.title,

              description:
                campaign.description,

              status:
                campaign.status,

              countryCode:
                campaign.country,

              city:
                campaign.city,

              currency:
                campaign.currency,

              goalAmount:
                goalAmount.toString(),

              collectedAmount:
                collectedAmount.toString(),

              remainingAmount:
                remainingAmount.toString(),

              progress,

              percentage:
                progress,

              contributionCount:
                finance?.count ??
                0,

              createdAt:
                campaign.createdAt.toISOString(),

              updatedAt:
                campaign.updatedAt.toISOString(),

              image:
                imageUrl,

              imageUrl,

              images:
                primaryImage
                  ? [
                      {
                        id:
                          getImageId(
                            primaryImage.storageKey
                          ) ??
                          primaryImage.id,

                        url:
                          imageUrl,

                        position:
                          primaryImage.position,
                      },
                    ]
                  : [],
            };
          }
        )
      );

    /* ----------------------------------------
       12. PAGINATION
    ---------------------------------------- */

    const totalPages =
      Math.max(
        1,
        Math.ceil(
          total / pageSize
        )
      );

    /* ----------------------------------------
       13. RÉPONSE POUR MES DONS
    ---------------------------------------- */

    return respond({
      success: true,

      message:
        TEXT[language].loaded,

      campaigns:
        items,

      counts,

      stats: {
        total:
          counts.all,

        active:
          counts.active,

        completed:
          counts.completed,

        drafts:
          counts.drafts,
      },

      pagination: {
        page,
        pageSize,

        total,

        totalPages,

        hasPrevious:
          page > 1,

        hasNext:
          page < totalPages,
      },

      filters: {
        status:
          filter,

        search,

        sort,
      },
    });
  } catch (error) {
    console.error(
      "[TIKEMIA CAMPAIGNS GET]",
      error instanceof Error
        ? error.message
        : "Unknown error"
    );

    return errorResponse(
      language,
      "serverError",
      503
    );
  }
}

/* ============================================
   POST — CRÉER UNE CAGNOTTE

   Cette opération conserve les
   six informations de la maquette.

   Le montant collecté n'est jamais
   fourni par le navigateur.

   Les images doivent avoir été
   téléversées avant la création.
============================================ */

export async function POST(
  request: NextRequest
) {
  let language =
    getLanguage(
      request
    );

  try {
    /* ----------------------------------------
       1. PROTECTION D'ORIGINE
    ---------------------------------------- */

    if (
      !isAllowedOrigin(
        request
      )
    ) {
      return errorResponse(
        language,
        "forbidden",
        403
      );
    }

    /* ----------------------------------------
       2. SESSION ORGANISATEUR
    ---------------------------------------- */

    const prisma =
      getPrisma();

    const organizer =
      await authenticate(
        request,
        prisma
      );

    if (!organizer) {
      return errorResponse(
        language,
        "unauthorized",
        401
      );
    }

    /* ----------------------------------------
       3. LECTURE DU JSON
    ---------------------------------------- */

    const body =
      await readJsonBody(
        request
      );

    if (!body) {
      return errorResponse(
        language,
        "invalidRequest",
        400
      );
    }

    if (
      body.locale === "fr" ||
      body.locale === "en"
    ) {
      language =
        body.locale;
    }

    /* ----------------------------------------
       4. VALIDATION
    ---------------------------------------- */

    const validation =
      validateCampaign(
        body
      );

    if (
      !validation.success
    ) {
      return errorResponse(
        language,
        validation.error,
        400
      );
    }

    const requestId = body.requestId;
    if (requestId !== undefined && (typeof requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))) return errorResponse(language, "invalidRequest", 400);
    const publicationSlug = typeof requestId === "string" ? "campaign-" + createHash("sha256").update(organizer.userId + ":" + requestId).digest("hex") : null;
    const input =
      validation.value;

    /* ----------------------------------------
       5. VÉRIFICATION DES IMAGES

       Chaque image doit appartenir
       au stockage de l'organisateur.
    ---------------------------------------- */

    if (publicationSlug) {
      const existing = await findPublication(prisma, publicationSlug);
      if (existing) return respond({ success: true, message: TEXT[language].created, campaign: { ...existing, goalAmount: existing.goalAmount.toString(), createdAt: existing.createdAt.toISOString() } }, 201);
    }

    const storageKeys =
      await Promise.all(
        input.imageIds.map(
          async (imageId) =>
            findUploadedImage(
              organizer.userId,
              imageId
            )
        )
      );

    if (
      storageKeys.some(
        (key) =>
          key === null
      )
    ) {
      return errorResponse(
        language,
        "missingImages",
        400
      );
    }

    const validStorageKeys =
      storageKeys.filter(
        (key): key is string =>
          key !== null
      );

    if (
      validStorageKeys.length !==
      input.imageIds.length
    ) {
      return errorResponse(
        language,
        "missingImages",
        400
      );
    }

    /* ----------------------------------------
       6. VÉRIFIER QUE LES IMAGES NE SONT
          PAS DÉJÀ RATTACHÉES À UNE AUTRE
          CAGNOTTE
    ---------------------------------------- */

    const alreadyAttached =
      await prisma.campaignImage.findFirst({
        where: {
          storageKey: {
            in:
              validStorageKeys,
          },
        },

        select: {
          id: true,
        },
      });

    if (
      alreadyAttached
    ) {
      return errorResponse(
        language,
        "invalidImages",
        409
      );
    }

    /* ----------------------------------------
       7. TRANSACTION POSTGRESQL
    ---------------------------------------- */

    const saved =
      await prisma.$transaction(
        async (tx) => {
          if (publicationSlug) {
            await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${publicationSlug}))) AS publication_lock`;
            const existing = await findPublication(tx, publicationSlug);
            if (existing) return existing;
          }

          /* ----------------------------------
             REVÉRIFIER L'ORGANISATION
          ---------------------------------- */

          const organization =
            await tx.organization.findFirst({
              where: {
                id: {
                  in:
                    organizer.organizationIds,
                },

                ownerId:
                  organizer.userId,

                isActive: true,
              },

              select: {
                id: true,
              },
            });

          if (!organization) {
            throw new Error(
              "ORGANIZATION_NOT_ALLOWED"
            );
          }

          /* ----------------------------------
             ÉVITER LA RÉUTILISATION D'IMAGES

             Le verrou est transactionnel
             et propre à chaque objet.
          ---------------------------------- */

          for (
            const key of
            [...validStorageKeys].sort()
          ) {
            await tx.$queryRaw`
              SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${key}))) AS storage_lock
            `;
          }

          const duplicate =
            await tx.campaignImage.findFirst({
              where: {
                storageKey: {
                  in:
                    validStorageKeys,
                },
              },

              select: {
                id: true,
              },
            });

          if (duplicate) {
            throw new Error(
              "IMAGE_ALREADY_ATTACHED"
            );
          }

          /* ----------------------------------
             CRÉER LA CAGNOTTE
          ---------------------------------- */

          const readableSlug = await allocateSlug(tx, input.title);
          const campaign =
            await tx.campaign.create({
              data: {
                organizationId:
                  organization.id,

                createdById:
                  organizer.userId,

                title:
                  input.title,

                slug: readableSlug,

                description:
                  input.description,

                country:
                  input.countryCode,

                city:
                  input.city,

                currency:
                  input.currency,

                goalAmount:
                  input.goalAmount,

                status: "PUBLISHED",
              publishedAt: new Date(),

                images: {
                  create:
                    validStorageKeys.map(
                      (
                        storageKey,
                        index
                      ) => ({
                        storageKey,

                        position:
                          index,

                        isPrimary:
                          index === 0,
                      })
                    ),
                },
              },

              select: {
                id: true,

                slug: true,

                status: true,

                currency: true,

                goalAmount: true,

                createdAt: true,
              },
            });

          if (publicationSlug) await tx.appSetting.upsert({ where: { key: "publication:campaign:" + publicationSlug }, create: { key: "publication:campaign:" + publicationSlug, value: { id: campaign.id } }, update: { value: { id: campaign.id } } });
          return campaign;
        },
        {
          isolationLevel:
            "Serializable",

          timeout:
            15000,
        }
      );

    /* ----------------------------------------
       8. CONFIRMATION
    ---------------------------------------- */

    return respond(
      {
        success: true,

        message:
          TEXT[language].created,

        campaign: {
          id:
            saved.id,

          slug:
            saved.slug,

          status:
            saved.status,

          currency:
            saved.currency,

          goalAmount:
            toBigInt(
              saved.goalAmount
            ).toString(),

          createdAt:
            saved.createdAt.toISOString(),
        },
      },
      201
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error";

    if (
      message ===
      "IMAGE_ALREADY_ATTACHED"
    ) {
      return errorResponse(
        language,
        "invalidImages",
        409
      );
    }

    if (
      message ===
      "ORGANIZATION_NOT_ALLOWED"
    ) {
      return errorResponse(
        language,
        "forbidden",
        403
      );
    }

    console.error(
      "[TIKEMIA CAMPAIGNS POST]",
      message
    );

    return errorResponse(
      language,
      "serverError",
      503
    );
  }
}

async function findPublication(database: PrismaClient | Prisma.TransactionClient, technicalKey: string) {
  const alias = await database.appSetting.findUnique({ where: { key: "publication:campaign:" + technicalKey }, select: { value: true } });
  const value = alias?.value;
  const id = value && typeof value === "object" && !Array.isArray(value) && typeof value.id === "string" ? value.id : null;
  return database.campaign.findUnique({ where: id ? { id } : { slug: technicalKey }, select: { id: true, slug: true, status: true, currency: true, goalAmount: true, createdAt: true } });
}
async function allocateSlug(tx: Prisma.TransactionClient, title: string): Promise<string> {
  const base = makeSlug(title);
  await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${"campaign:" + base}))) AS title_lock`;
  let candidate = base;
  for (let suffix = 2; await tx.campaign.findUnique({ where: { slug: candidate }, select: { id: true } }); suffix++) candidate = base + "-" + suffix;
  return candidate;
}
