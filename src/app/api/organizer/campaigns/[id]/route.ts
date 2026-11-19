import { getTrustedRequestOrigin } from "@/lib/tikemia-pay/providers";
import { getPlatformPrisma } from "@/lib/payments/fulfillment";
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
} from "@/generated/prisma/client";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  isSupportedCountry,
} from "libphonenumber-js";

/* ============================================
   TIKEMIA — GESTION DES CAGNOTTES

   Fichier :
   src/app/api/organizer/campaigns/[id]/route.ts

   GET :
   - Informations de la cagnotte
   - Images
   - Montants confirmés
   - Objectif
   - Progression
   - Contributions
   - Préremplissage du formulaire

   PATCH :
   - Modification sécurisée
   - Conservation des images existantes
   - Ajout de nouvelles images
   - Validation serveur
   - Nouvelle validation administrative

   DELETE :
   - Annulation si aucun don
   - Clôture si historique financier
   - Historique conservé

   Architecture :
   Next.js App Router
   Prisma ORM 7
   PostgreSQL
   Supabase Storage
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

const CONTRIBUTIONS_PAGE_SIZE = 20;

const IMAGE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_CURRENCIES =
  new Set<string>(SUPPORTED_CURRENCIES);

type Language =
  | "fr"
  | "en";

type Currency = (typeof SUPPORTED_CURRENCIES)[number];

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type JsonRecord =
  Record<string, unknown>;

type Organizer = {
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
  keepImageIds: string[];
  newImageIds: string[];
};

type ErrorKey =
  | "unauthorized"
  | "forbidden"
  | "invalidId"
  | "notFound"
  | "invalidRequest"
  | "invalidTitle"
  | "invalidDescription"
  | "invalidCountry"
  | "invalidCity"
  | "invalidGoal"
  | "invalidCurrency"
  | "invalidImages"
  | "missingImages"
  | "alreadyClosed"
  | "donationsProtected"
  | "serverError";

/* ============================================
   TRADUCTIONS
============================================ */

const TEXT = {
  fr: {
    unauthorized:
      "Veuillez vous connecter à votre espace organisateur.",

    forbidden:
      "Vous n'êtes pas autorisé à effectuer cette opération.",

    invalidId:
      "Identifiant de cagnotte invalide.",

    notFound:
      "Cagnotte introuvable.",

    invalidRequest:
      "Les données envoyées sont invalides.",

    invalidTitle:
      "Le nom de la cagnotte doit contenir entre 3 et 180 caractères.",

    invalidDescription:
      "La description doit contenir entre 10 et 2000 caractères.",

    invalidCountry:
      "Veuillez sélectionner un pays valide.",

    invalidCity:
      "Veuillez renseigner une ville valide.",

    invalidGoal:
      "Veuillez renseigner un montant objectif valide.",

    invalidCurrency:
      "La devise sélectionnée est invalide.",

    invalidImages:
      "La cagnotte doit contenir entre 1 et 10 images valides.",

    missingImages:
      "Une ou plusieurs images sont introuvables.",

    alreadyClosed:
      "Cette cagnotte est déjà clôturée ou annulée.",

    donationsProtected:
      "Cette cagnotte possède déjà des contributions. Ses informations financières sont protégées.",

    serverError:
      "Impossible de traiter cette opération.",

    updated:
      "Les modifications ont ete enregistrees.",

    cancelled:
      "La cagnotte a été retirée de la publication.",

    closed:
      "La cagnotte a été clôturée. Son historique financier a été conservé.",

    success:
      "Informations récupérées avec succès.",
  },

  en: {
    unauthorized:
      "Please sign in to your organizer account.",

    forbidden:
      "You are not authorized to perform this operation.",

    invalidId:
      "Invalid fundraiser identifier.",

    notFound:
      "Fundraiser not found.",

    invalidRequest:
      "Invalid request data.",

    invalidTitle:
      "The fundraiser name must contain between 3 and 180 characters.",

    invalidDescription:
      "The description must contain between 10 and 2000 characters.",

    invalidCountry:
      "Please select a valid country.",

    invalidCity:
      "Please enter a valid city.",

    invalidGoal:
      "Please enter a valid fundraising goal.",

    invalidCurrency:
      "Invalid currency.",

    invalidImages:
      "The fundraiser must contain between 1 and 10 valid images.",

    missingImages:
      "One or more images could not be found.",

    alreadyClosed:
      "This fundraiser is already closed or cancelled.",

    donationsProtected:
      "This fundraiser already has contributions. Its financial information is protected.",

    serverError:
      "Unable to complete this operation.",

    updated:
      "Changes saved.",

    cancelled:
      "Fundraiser removed from publication.",

    closed:
      "Fundraiser closed. Its financial history has been preserved.",

    success:
      "Information retrieved successfully.",
  },
} as const;

type MessageKey =
  ErrorKey;

/* ============================================
   PRISMA ORM 7
============================================ */



const getPrisma = getPlatformPrisma;

/* ============================================
   SUPABASE STORAGE

   Bucket privé :
   campaign-images

   Aucun identifiant secret n'est
   envoyé au navigateur.
============================================ */

let storageClient:
  ReturnType<typeof createClient> | null =
    null;

function getStorage() {
  if (!storageClient) {
    const url =
      process.env.SUPABASE_URL;

    const key =
      process.env.SUPABASE_SECRET_KEY;

    if (!url || !key) {
      throw new Error(
        "SUPABASE_STORAGE_NOT_CONFIGURED"
      );
    }

    storageClient =
      createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
  }

  const bucket =
    process.env.SUPABASE_CAMPAIGN_BUCKET ||
    "campaign-images";

  return storageClient.storage.from(bucket);
}

/* ============================================
   RÉPONSES
============================================ */

function respond(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(data, {
    status,

    headers: {
      "Cache-Control":
        "private, no-store, max-age=0",

      "X-Content-Type-Options":
        "nosniff",

      Vary: "Cookie",
    },
  });
}

function errorResponse(
  locale: Language,
  key: MessageKey,
  status: number
) {
  return respond(
    {
      success: false,
      message:
        TEXT[locale][key],
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
  const query =
    request.nextUrl.searchParams.get(
      "locale"
    );

  if (
    query === "en" ||
    query === "fr"
  ) {
    return query;
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
   PROTECTION CSRF
============================================ */

function validOrigin(
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
   AUTHENTIFICATION
============================================ */

async function authenticate(
  request: NextRequest,
  prisma: PrismaClient
): Promise<Organizer | null> {
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
        id:
          session.userId,
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
    userId:
      user.id,

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

function cleanText(
  value: unknown,
  min: number,
  max: number
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const result =
    value
      .trim()
      .replace(
        /[ \t]+/g,
        " "
      );

  if (
    result.length < min ||
    result.length > max ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(
      result
    )
  ) {
    return null;
  }

  return result;
}

/* ============================================
   VALIDATION DES MONTANTS
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
   BIGINT POUR POSTGRESQL
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

  const text =
    String(value ?? "0");

  if (
    !/^-?\d+$/.test(text)
  ) {
    throw new Error(
      "INVALID_MONEY_VALUE"
    );
  }

  return BigInt(text);
}

/* ============================================
   IDENTIFIANTS DES IMAGES
============================================ */

function parseImageIds(
  value: unknown
): string[] | null {
  if (
    !Array.isArray(value) ||
    value.length > MAX_IMAGES
  ) {
    return null;
  }

  const ids:
    string[] = [];

  for (
    const item of value
  ) {
    let id:
      unknown = item;

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

    ids.push(
      id.toLowerCase()
    );
  }

  if (
    new Set(ids).size !==
    ids.length
  ) {
    return null;
  }

  return ids;
}

/* ============================================
   STOCKAGE DES IMAGES

   Chaque organisateur possède son
   propre préfixe dans Supabase.
============================================ */

function getOwnerPrefix(
  userId: string
): string {
  return createHash("sha256")
    .update(
      userId,
      "utf8"
    )
    .digest("hex");
}

function extractImageId(
  storageKey: string
): string | null {
  const match =
    storageKey.match(
      /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|png|webp)$/i
    );

  return match
    ? match[1].toLowerCase()
    : null;
}

function normalizeStorageKey(
  storageKey: string
): string {
  return storageKey.replace(
    /^campaigns\//,
    ""
  );
}

/* ============================================
   CONTRÔLER UNE NOUVELLE IMAGE

   Les images doivent être présentes
   dans le bucket Supabase privé
   de l'organisateur.
============================================ */

async function findUploadedImage(
  userId: string,
  imageId: string
): Promise<string | null> {
  const prefix =
    getOwnerPrefix(userId);

  const bucket =
    getStorage();

  const extensions = [
    "jpg",
    "png",
    "webp",
  ];

  for (
    const extension of extensions
  ) {
    const key =
      `${prefix}/${imageId}.${extension}`;

    const {
      data,
      error,
    } = await bucket.info(key);

    if (error) {
      const status =
        Number(
          error.statusCode ??
            0
        );

      if (
        status === 404 ||
        error.message.toLowerCase().includes(
          "not found"
        )
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

    if (
      Number.isFinite(size) &&
      size > 0 &&
      size <= MAX_IMAGE_SIZE
    ) {
      return key;
    }
  }

  return null;
}

/* ============================================
   URL SIGNÉE POUR IMAGE PRIVÉE

   L'URL est temporaire.
   Le bucket reste privé.
============================================ */

async function signedImageUrl(
  storageKey: string
): Promise<string | null> {
  const normalized =
    normalizeStorageKey(
      storageKey
    );

  const {
    data,
    error,
  } = await getStorage()
    .createSignedUrl(
      normalized,
      60 * 10
    );

  if (error || !data) {
    return null;
  }

  return data.signedUrl;
}

/* ============================================
   VALIDATION DU PATCH
============================================ */

function validateInput(
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
  function fail(
    error: ErrorKey
  ) {
    return {
      success: false as const,
      error,
    };
  }

  const title =
    cleanText(
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
    cleanText(
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
    cleanText(
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
    parseGoal(body.goalAmount, body.currency ?? "XOF");

  if (
    goalAmount === null
  ) {
    return fail(
      "invalidGoal"
    );
  }

  const currency =
    typeof body.currency ===
      "string"
      ? body.currency
          .trim()
          .toUpperCase()
      : "";

  if (
    !ALLOWED_CURRENCIES.has(
      currency
    )
  ) {
    return fail(
      "invalidCurrency"
    );
  }

  const keepImageIds =
    parseImageIds(
      body.keepImageIds ?? []
    );

  const newImageIds =
    parseImageIds(
      body.images ?? []
    );

  if (
    !keepImageIds ||
    !newImageIds
  ) {
    return fail(
      "invalidImages"
    );
  }

  const allImageIds = [
    ...keepImageIds,
    ...newImageIds,
  ];

  if (
    allImageIds.length < 1 ||
    allImageIds.length > MAX_IMAGES ||
    new Set(allImageIds).size !==
      allImageIds.length
  ) {
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
        currency as Currency,
      keepImageIds,
      newImageIds,
    },
  };
}

/* ============================================
   LECTURE LIMITÉE DU JSON

   Protection contre les requêtes
   trop volumineuses.
============================================ */

async function readBody(
  request: NextRequest
): Promise<JsonRecord | null> {
  const contentType =
    request.headers.get(
      "content-type"
    ) ?? "";

  if (
    !contentType.toLowerCase().startsWith(
      "application/json"
    )
  ) {
    return null;
  }

  const lengthHeader =
    request.headers.get(
      "content-length"
    );

  if (
    lengthHeader &&
    Number(lengthHeader) >
      MAX_BODY_BYTES
  ) {
    return null;
  }

  let received = 0;

  const stream =
    request.body?.pipeThrough(
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

  if (!stream) {
    return null;
  }

  try {
    const raw =
      await new Response(
        stream
      ).text();

    const value:
      unknown =
        JSON.parse(raw);

    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return null;
    }

    return value as JsonRecord;
  } catch {
    return null;
  }
}

/* ============================================
   CHARGER UNE CAGNOTTE AUTORISÉE
============================================ */

async function findCampaign(
  prisma: PrismaClient,
  campaignId: string,
  organizationIds: string[]
) {
  return prisma.campaign.findFirst({
    where: {
      id: campaignId,

      organizationId: {
        in:
          organizationIds,
      },
    },

    include: {
      images: {
        orderBy: {
          position: "asc",
        },
      },
    },
  });
}

/* ============================================
   CALCUL DE LA PROGRESSION

   BigInt évite les erreurs de
   précision sur les montants.
============================================ */

function progressPercent(
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

  const safe =
    scaled > maximum
      ? maximum
      : scaled;

  return Number(safe) / 100;
}

/* ============================================
   GET — DÉTAILS D'UNE CAGNOTTE

   Compatible avec :
   publish-campaign?edit=ID

   Et :
   /organizer/dashboard/campaigns/[id]
============================================ */

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const locale =
    getLanguage(
      request
    );

  try {
    const prisma =
      getPrisma();

    const organizer =
      await authenticate(
        request,
        prisma
      );

    if (!organizer) {
      return errorResponse(
        locale,
        "unauthorized",
        401
      );
    }

    const {
      id,
    } = await context.params;

    if (
      !id ||
      !ID_PATTERN.test(id)
    ) {
      return errorResponse(
        locale,
        "invalidId",
        400
      );
    }

    const campaign =
      await findCampaign(
        prisma,
        id,
        organizer.organizationIds
      );

    if (!campaign) {
      return errorResponse(
        locale,
        "notFound",
        404
      );
    }

    /* --------------------------------------
       LIRE LES CONTRIBUTIONS CONFIRMÉES

       Les dons en attente ne sont
       jamais additionnés.
    -------------------------------------- */

    const [
      confirmedTotals,
      allDonationCount,
      recentDonations,
    ] = await Promise.all([
      prisma.donation.aggregate({
        where: {
          campaignId:
            campaign.id,

          status:
            "CONFIRMED",

          currency:
            campaign.currency,
        },

        _sum: {
          amount: true,
        },

        _count: {
          _all: true,
        },
      }),

      prisma.donation.count({
        where: {
          campaignId:
            campaign.id,
        },
      }),

      prisma.donation.findMany({
        where: {
          campaignId:
            campaign.id,

          status:
            "CONFIRMED",

          currency:
            campaign.currency,
        },

        select: {
          id: true,

          amount: true,

          currency: true,

          createdAt: true,
        },

        orderBy: {
          createdAt: "desc",
        },

        take:
          CONTRIBUTIONS_PAGE_SIZE,
      }),
    ]);

    const goal =
      toBigInt(
        campaign.goalAmount
      );

    const collected =
      toBigInt(
        confirmedTotals._sum.amount ??
          0
      );

    const remaining =
      collected >= goal
        ? 0n
        : goal - collected;

    /* --------------------------------------
       GÉNÉRER LES URL DES IMAGES PRIVÉES

       Ne pas exposer les storageKey
       dans les réponses publiques.
    -------------------------------------- */

    const images =
      await Promise.all(
        campaign.images.map(
          async (
            image
          ) => {
            const imageId =
              extractImageId(
                image.storageKey
              );

            return {
              id:
                imageId ??
                image.id,

              url:
                await signedImageUrl(
                  image.storageKey
                ),

              position:
                image.position,

              isPrimary:
                image.isPrimary,
            };
          }
        )
      );

    /* --------------------------------------
       RÉPONSE POUR LA PAGE
    -------------------------------------- */

    return respond({
      success: true,

      message:
        TEXT[locale].success,

      campaign: {
        id:
          campaign.id,

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
          goal.toString(),

        collectedAmount:
          collected.toString(),

        remainingAmount:
          remaining.toString(),

        progress:
          progressPercent(
            collected,
            goal
          ),

        contributionCount:
          confirmedTotals._count._all,

        totalDonationRecords:
          allDonationCount,

        createdAt:
          campaign.createdAt.toISOString(),

        updatedAt:
          campaign.updatedAt.toISOString(),

        images,

        contributions:
          recentDonations.map(
            (
              donation
            ) => ({
              id:
                donation.id,

              amount:
                toBigInt(
                  donation.amount
                ).toString(),

              currency:
                donation.currency,

              status:
                "CONFIRMED",

              createdAt:
                donation.createdAt.toISOString(),
            })
          ),
      },
    });
  } catch (error) {
    console.error(
      "[TIKEMIA CAMPAIGN GET]",
      error instanceof Error
        ? error.message
        : "Unknown error"
    );

    return errorResponse(
      locale,
      "serverError",
      503
    );
  }
}

/* ============================================
   PATCH — MODIFIER UNE CAGNOTTE

   Conditions :
   - Organisateur authentifié
   - Cagnotte appartenant à l'organisation
   - Aucun don déjà enregistré
   - Images vérifiées
   - Transaction PostgreSQL
   - Nouvelle validation
============================================ */

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const locale =
    getLanguage(
      request
    );

  try {
    if (
      !validOrigin(request)
    ) {
      return errorResponse(
        locale,
        "forbidden",
        403
      );
    }

    const prisma =
      getPrisma();

    const organizer =
      await authenticate(
        request,
        prisma
      );

    if (!organizer) {
      return errorResponse(
        locale,
        "unauthorized",
        401
      );
    }

    const {
      id,
    } = await context.params;

    if (
      !id ||
      !ID_PATTERN.test(id)
    ) {
      return errorResponse(
        locale,
        "invalidId",
        400
      );
    }

    /* --------------------------------------
       LIRE ET VALIDER LE FORMULAIRE
    -------------------------------------- */

    const body =
      await readBody(
        request
      );

    if (!body) {
      return errorResponse(
        locale,
        "invalidRequest",
        400
      );
    }

    const validation =
      validateInput(
        body
      );

    if (
      !validation.success
    ) {
      return errorResponse(
        locale,
        validation.error,
        400
      );
    }

    const input =
      validation.value;

    /* --------------------------------------
       VÉRIFIER LA CAGNOTTE
    -------------------------------------- */

    const campaign =
      await findCampaign(
        prisma,
        id,
        organizer.organizationIds
      );

    if (!campaign) {
      return errorResponse(
        locale,
        "notFound",
        404
      );
    }

    if (
      campaign.status ===
        "CLOSED" ||
      campaign.status ===
        "ARCHIVED"
    ) {
      return errorResponse(
        locale,
        "alreadyClosed",
        409
      );
    }

    /* --------------------------------------
       PROTÉGER LES DONS EXISTANTS

       Ce contrôle est volontairement
       strict pour empêcher la
       modification d'une collecte
       déjà financée ou engagée.
    -------------------------------------- */

    const previousDonation =
      await prisma.donation.findFirst({
        where: {
          campaignId:
            id,
        },

        select: {
          id: true,
        },
      });

    if (
      previousDonation
    ) {
      return errorResponse(
        locale,
        "donationsProtected",
        409
      );
    }

    /* --------------------------------------
       VÉRIFIER LES ANCIENNES IMAGES

       Le navigateur ne peut conserver
       que les images appartenant
       déjà à cette cagnotte.
    -------------------------------------- */

    const storedImages =
      new Map<
        string,
        string
      >();

    for (
      const image of
      campaign.images
    ) {
      const imageId =
        extractImageId(
          image.storageKey
        );

      if (imageId) {
        storedImages.set(
          imageId,
          image.storageKey
        );
      }
    }

    for (
      const imageId of
      input.keepImageIds
    ) {
      if (
        !storedImages.has(
          imageId
        )
      ) {
        return errorResponse(
          locale,
          "invalidImages",
          400
        );
      }
    }

    /* --------------------------------------
       CONTRÔLER LES NOUVELLES IMAGES
    -------------------------------------- */

    const newStorageKeys:
      string[] = [];

    for (
      const imageId of
      input.newImageIds
    ) {
      const storageKey =
        await findUploadedImage(
          organizer.userId,
          imageId
        );

      if (
        !storageKey
      ) {
        return errorResponse(
          locale,
          "missingImages",
          400
        );
      }

      newStorageKeys.push(
        storageKey
      );
    }

    /* --------------------------------------
       ASSEMBLER LES IMAGES FINALES
    -------------------------------------- */

    const imageStorageKeys = [
      ...input.keepImageIds.map(
        (imageId) =>
          storedImages.get(
            imageId
          )!
      ),

      ...newStorageKeys,
    ];

    if (
      imageStorageKeys.length < 1 ||
      imageStorageKeys.length >
        MAX_IMAGES ||
      new Set(
        imageStorageKeys
      ).size !==
        imageStorageKeys.length
    ) {
      return errorResponse(
        locale,
        "invalidImages",
        400
      );
    }

    /* --------------------------------------
       TRANSACTION PRISMA

       Une nouvelle vérification est
       effectuée dans la transaction.

       Les modifications des images
       et de la cagnotte doivent
       réussir ensemble.
    -------------------------------------- */

    const updated =
      await prisma.$transaction(
        async (tx) => {
          const current =
            await tx.campaign.findFirst({
              where: {
                id,

                organizationId: {
                  in:
                    organizer.organizationIds,
                },
              },

              select: {
                id: true,

                status: true,
              },
            });

          if (!current) {
            throw new Error(
              "CAMPAIGN_NOT_FOUND"
            );
          }

          if (
            current.status ===
              "CLOSED" ||
            current.status ===
              "ARCHIVED"
          ) {
            throw new Error(
              "CAMPAIGN_CLOSED"
            );
          }

          const donation =
            await tx.donation.findFirst({
              where: {
                campaignId: id,
              },

              select: {
                id: true,
              },
            });

          if (donation) {
            throw new Error(
              "CAMPAIGN_HAS_DONATIONS"
            );
          }

          /* ----------------------------------
             REMPLACER LES RELATIONS IMAGE

             Les objets Supabase ne sont
             pas supprimés physiquement ici.
          ---------------------------------- */

          await tx.campaignImage.deleteMany({
            where: {
              campaignId: id,
            },
          });

          await tx.campaignImage.createMany({
            data:
              imageStorageKeys.map(
                (
                  storageKey,
                  index
                ) => ({
                  campaignId:
                    id,

                  storageKey,

                  position:
                    index,

                  isPrimary:
                    index === 0,
                })
              ),
          });

          /* ----------------------------------
             METTRE À JOUR LA CAGNOTTE
          ---------------------------------- */

          return tx.campaign.update({
            where: {
              id,
            },

            data: {
              title:
                input.title,

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
            },

            select: {
              id: true,

              status: true,

              updatedAt: true,
            },
          });
        },
        {
          isolationLevel:
            "Serializable",

          timeout: 15000,
        }
      );

    return respond({
      success: true,

      message:
        TEXT[locale].updated,

      campaign: {
        id:
          updated.id,

        status:
          updated.status,

        updatedAt:
          updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const code =
      error instanceof Error
        ? error.message
        : "";

    if (
      code ===
      "CAMPAIGN_HAS_DONATIONS"
    ) {
      return errorResponse(
        locale,
        "donationsProtected",
        409
      );
    }

    if (
      code ===
      "CAMPAIGN_CLOSED"
    ) {
      return errorResponse(
        locale,
        "alreadyClosed",
        409
      );
    }

    if (
      code ===
      "CAMPAIGN_NOT_FOUND"
    ) {
      return errorResponse(
        locale,
        "notFound",
        404
      );
    }

    console.error(
      "[TIKEMIA CAMPAIGN PATCH]",
      code ||
        "Unknown error"
    );

    return errorResponse(
      locale,
      "serverError",
      503
    );
  }
}

/* ============================================
   DELETE — RETIRER OU CLÔTURER

   Important :

   Nous n'effaçons jamais une cagnotte
   contenant un historique financier.

   Aucun don :
   statut CANCELLED

   Un ou plusieurs dons :
   statut CLOSED

   La ligne reste en PostgreSQL
   pour préserver les audits.
============================================ */

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const locale =
    getLanguage(
      request
    );

  try {
    if (
      !validOrigin(request)
    ) {
      return errorResponse(
        locale,
        "forbidden",
        403
      );
    }

    const prisma =
      getPrisma();

    const organizer =
      await authenticate(
        request,
        prisma
      );

    if (!organizer) {
      return errorResponse(
        locale,
        "unauthorized",
        401
      );
    }

    const {
      id,
    } = await context.params;

    if (
      !id ||
      !ID_PATTERN.test(id)
    ) {
      return errorResponse(
        locale,
        "invalidId",
        400
      );
    }

    const result =
      await prisma.$transaction(
        async (tx) => {
          /* ----------------------------------
             VÉRIFIER LE PROPRIÉTAIRE
          ---------------------------------- */

          const campaign =
            await tx.campaign.findFirst({
              where: {
                id,

                organizationId: {
                  in:
                    organizer.organizationIds,
                },
              },

              select: {
                id: true,

                status: true,
              },
            });

          if (!campaign) {
            throw new Error(
              "CAMPAIGN_NOT_FOUND"
            );
          }

          /* ----------------------------------
             OPÉRATION RÉPÉTÉE

             Une cagnotte déjà fermée
             ne doit pas être recréée.
          ---------------------------------- */

          if (
            campaign.status === "CLOSED" ||
            campaign.status === "ARCHIVED"
          ) {
            return {
              id:
                campaign.id,

              status:
                campaign.status,

              action:
                "ALREADY_CLOSED",
            };
          }

          /* ----------------------------------
             VÉRIFIER LES CONTRIBUTIONS

             Tous les dons sont pris en
             compte, y compris ceux dont
             le paiement n'est pas finalisé.
          ---------------------------------- */

          const donation =
            await tx.donation.findFirst({
              where: {
                campaignId:
                  id,
              },

              select: {
                id: true,
              },
            });

          /* ----------------------------------
             CHOISIR L'ÉTAT FINAL
          ---------------------------------- */

          const nextStatus =
            donation
              ? "CLOSED"
              : "ARCHIVED";

          const updated =
            await tx.campaign.update({
              where: {
                id,
              },

              data: {
                status:
                  nextStatus,
              },

              select: {
                id: true,

                status: true,
              },
            });

          return {
            id:
              updated.id,

            status:
              updated.status,

            action:
              donation
                ? "CLOSED"
                : "ARCHIVED",
          };
        },
        {
          isolationLevel:
            "Serializable",

          timeout: 15000,
        }
      );

    const message =
      result.action ===
        "CLOSED"
        ? TEXT[locale].closed
        : TEXT[locale].cancelled;

    return respond({
      success: true,

      message,

      campaign: {
        id:
          result.id,

        status:
          result.status,
      },
    });
  } catch (error) {
    const code =
      error instanceof Error
        ? error.message
        : "";

    if (
      code ===
      "CAMPAIGN_NOT_FOUND"
    ) {
      return errorResponse(
        locale,
        "notFound",
        404
      );
    }

    console.error(
      "[TIKEMIA CAMPAIGN DELETE]",
      code ||
        "Unknown error"
    );

    return errorResponse(
      locale,
      "serverError",
      503
    );
  }
}
