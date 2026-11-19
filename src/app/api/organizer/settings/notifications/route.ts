import { getTrustedRequestOrigin } from "@/lib/tikemia-pay/providers";
import { getPlatformPrisma } from "@/lib/payments/fulfillment";

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

/* ==========================================================
   TIKEMIA — PRÉFÉRENCES DE NOTIFICATIONS

   Fichier :
   src/app/api/organizer/settings/notifications/route.ts

   GET :
   - Authentifier l'organisateur
   - Lire ses préférences
   - Retourner les valeurs par défaut si aucune
     préférence n'a encore été enregistrée

   PATCH :
   - Authentifier l'organisateur
   - Contrôler l'origine de la requête
   - Vérifier les champs autorisés
   - Enregistrer uniquement les champs modifiés
   - Créer les préférences si nécessaire

   Modèle Prisma :
   UserNotificationPreference

   Les notifications de sécurité critiques
   ne sont pas désactivables avec cette API.

   Compatible :
   Next.js App Router
   Prisma ORM 7
   PostgreSQL
   TypeScript
   Français / Anglais
========================================================== */




/* ==========================================================
   CONFIGURATION
========================================================== */

const SESSION_COOKIE = "tikemia_organizer_session";

const MAX_BODY_BYTES = 8192;

const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

/* ==========================================================
   PRÉFÉRENCES MODIFIABLES

   Ces noms correspondent exactement aux
   champs UserNotificationPreference
   du schema.prisma TIKEMIA.
========================================================== */

const PREFERENCE_KEYS = [
  "emailTicketSales",
  "emailDonations",
  "emailPayouts",
  "emailEvents",
  "emailCampaigns",

  "inAppTicketSales",
  "inAppDonations",
  "inAppPayouts",
  "inAppEvents",
  "inAppCampaigns",
] as const;

type PreferenceKey =
  (typeof PREFERENCE_KEYS)[number];

type Preferences = Record<
  PreferenceKey,
  boolean
>;

type Language = "fr" | "en";

type JsonRecord = Record<string, unknown>;

type ErrorKey =
  | "unauthorized"
  | "forbidden"
  | "invalidContentType"
  | "invalidBody"
  | "invalidFields"
  | "invalidValues"
  | "emptyUpdate"
  | "serverError";

/* ==========================================================
   VALEURS PAR DÉFAUT

   Identiques aux valeurs @default(true)
   déclarées dans Prisma.
========================================================== */

const DEFAULT_PREFERENCES: Readonly<Preferences> = {
  emailTicketSales: true,
  emailDonations: true,
  emailPayouts: true,
  emailEvents: true,
  emailCampaigns: true,

  inAppTicketSales: true,
  inAppDonations: true,
  inAppPayouts: true,
  inAppEvents: true,
  inAppCampaigns: true,
};

/* ==========================================================
   TRADUCTIONS
========================================================== */

const TEXT = {
  fr: {
    unauthorized:
      "Veuillez vous connecter à votre espace organisateur.",

    forbidden:
      "Vous n'êtes pas autorisé à effectuer cette opération.",

    invalidContentType:
      "Le contenu doit être envoyé au format JSON.",

    invalidBody:
      "Les informations envoyées sont invalides ou trop volumineuses.",

    invalidFields:
      "Une ou plusieurs préférences ne sont pas reconnues.",

    invalidValues:
      "Les préférences doivent contenir uniquement des valeurs booléennes.",

    emptyUpdate:
      "Aucune préférence à modifier.",

    serverError:
      "Impossible de récupérer ou d'enregistrer les préférences pour le moment.",

    loaded:
      "Préférences de notifications récupérées avec succès.",

    updated:
      "Vos préférences de notifications ont été enregistrées.",
  },

  en: {
    unauthorized:
      "Please sign in to your organizer account.",

    forbidden:
      "You are not authorized to perform this operation.",

    invalidContentType:
      "Content must be sent in JSON format.",

    invalidBody:
      "Invalid or oversized request data.",

    invalidFields:
      "One or more notification preferences are not recognized.",

    invalidValues:
      "Notification preferences must contain boolean values only.",

    emptyUpdate:
      "No preferences to update.",

    serverError:
      "Unable to retrieve or save notification preferences right now.",

    loaded:
      "Notification preferences retrieved successfully.",

    updated:
      "Your notification preferences have been saved.",
  },
} as const;

/* ==========================================================
   PRISMA 7 — CONNEXION POSTGRESQL

   Utilisation de l'adaptateur PrismaPg.

   La connexion est mise en cache pour
   éviter de créer un nouveau client
   à chaque requête.
========================================================== */



const getPrisma = getPlatformPrisma;

/* ==========================================================
   LANGUE
========================================================== */

function getLanguage(request: NextRequest): Language {
  const queryLocale =
    request.nextUrl.searchParams.get("locale");

  if (queryLocale === "fr" || queryLocale === "en") {
    return queryLocale;
  }

  const acceptLanguage =
    request.headers.get("accept-language") ?? "";

  return acceptLanguage
    .toLowerCase()
    .startsWith("en")
    ? "en"
    : "fr";
}

/* ==========================================================
   RÉPONSES JSON

   Les préférences sont personnelles.
   Aucune réponse ne doit être mise en cache
   dans un cache partagé.
========================================================== */

function respond(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(data, {
    status,

    headers: {
      "Cache-Control":
        "private, no-store, max-age=0, must-revalidate",

      "Pragma": "no-cache",

      "X-Content-Type-Options": "nosniff",

      "Vary": "Cookie",
    },
  });
}

function errorResponse(
  locale: Language,
  key: ErrorKey,
  status: number
) {
  return respond(
    {
      success: false,
      message: TEXT[locale][key],
    },
    status
  );
}

/* ==========================================================
   PROTECTION DES REQUÊTES D'ÉCRITURE

   Les modifications doivent provenir
   de la même origine que TIKEMIA.

   Les cookies de session doivent également
   avoir SameSite et Secure correctement
   configurés dans le système de connexion.
========================================================== */

function isAllowedOrigin(request: NextRequest): boolean {
  const fetchSite =
    request.headers.get("sec-fetch-site");

  if (fetchSite && fetchSite !== "same-origin") {
    return false;
  }

  const origin =
    request.headers.get("origin");

  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === getTrustedRequestOrigin(request);
  } catch {
    return false;
  }
}

/* ==========================================================
   AUTHENTIFICATION ORGANISATEUR

   1. Lecture du cookie
   2. Hachage du jeton
   3. Vérification de la session
   4. Vérification du compte utilisateur
   5. Vérification du rôle ORGANIZER

   L'identifiant utilisateur n'est jamais
   reçu depuis le navigateur.
========================================================== */

async function authenticateOrganizer(
  request: NextRequest,
  prisma: PrismaClient
): Promise<string | null> {
  const sessionToken =
    request.cookies.get(SESSION_COOKIE)?.value;

  if (
    !sessionToken ||
    !TOKEN_PATTERN.test(sessionToken)
  ) {
    return null;
  }

  const tokenHash = createHash("sha256")
    .update(sessionToken, "utf8")
    .digest("hex");

  const session = await prisma.session.findFirst({
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

  const user = await prisma.user.findUnique({
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

  return user.id;
}

/* ==========================================================
   EXTRAIRE UNIQUEMENT LES PRÉFÉRENCES

   Les identifiants internes, email et
   données du compte ne sont pas exposés.
========================================================== */

function getPreferenceValues(
  record: Preferences
): Preferences {
  return {
    emailTicketSales: record.emailTicketSales,
    emailDonations: record.emailDonations,
    emailPayouts: record.emailPayouts,
    emailEvents: record.emailEvents,
    emailCampaigns: record.emailCampaigns,

    inAppTicketSales: record.inAppTicketSales,
    inAppDonations: record.inAppDonations,
    inAppPayouts: record.inAppPayouts,
    inAppEvents: record.inAppEvents,
    inAppCampaigns: record.inAppCampaigns,
  };
}

/* ==========================================================
   LECTURE JSON AVEC LIMITE DE TAILLE

   Empêche de charger volontairement
   un corps de requête volumineux.

   Les erreurs de lecture sont traitées
   comme une requête invalide.
========================================================== */

async function readLimitedJson(
  request: NextRequest
): Promise<JsonRecord | null> {
  const contentType =
    request.headers.get("content-type") ?? "";

  if (
    !contentType
      .toLowerCase()
      .startsWith("application/json")
  ) {
    return null;
  }

  const contentLength =
    request.headers.get("content-length");

  if (contentLength !== null) {
    const length = Number(contentLength);

    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > MAX_BODY_BYTES
    ) {
      return null;
    }
  }

  if (!request.body) {
    return null;
  }

  const reader = request.body.getReader();

  const chunks: Uint8Array[] = [];

  let totalBytes = 0;

  try {
    while (true) {
      const result = await reader.read();

      if (result.done) {
        break;
      }

      totalBytes += result.value.byteLength;

      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }

      chunks.push(result.value);
    }

    const bytes = new Uint8Array(totalBytes);

    let offset = 0;

    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const raw = new TextDecoder("utf-8", {
      fatal: true,
    }).decode(bytes);

    const parsed: unknown = JSON.parse(raw);

    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    return parsed as JsonRecord;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

/* ==========================================================
   VALIDATION DES PRÉFÉRENCES

   PATCH PARTIEL AUTORISÉ :

   {
     "emailDonations": false
   }

   OU :

   {
     "emailDonations": false,
     "inAppTicketSales": true
   }

   Les noms de colonnes internes ne peuvent
   pas être modifiés depuis le navigateur.
========================================================== */

type ValidationResult =
  | {
      success: true;
      values: Partial<Preferences>;
    }
  | {
      success: false;
      error: ErrorKey;
    };

function validatePreferences(
  body: JsonRecord
): ValidationResult {
  const allowedKeys = new Set<string>(
    PREFERENCE_KEYS
  );

  const keys = Object.keys(body);

  if (keys.length === 0) {
    return {
      success: false,
      error: "emptyUpdate",
    };
  }

  for (const key of keys) {
    if (!allowedKeys.has(key)) {
      return {
        success: false,
        error: "invalidFields",
      };
    }

    if (typeof body[key] !== "boolean") {
      return {
        success: false,
        error: "invalidValues",
      };
    }
  }

  const values: Partial<Preferences> = {};

  for (const key of PREFERENCE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      values[key] = body[key] as boolean;
    }
  }

  return {
    success: true,
    values,
  };
}

/* ==========================================================
   GET — LIRE LES PRÉFÉRENCES

   URL :
   /api/organizer/settings/notifications

   Le modèle utilise userId comme clé unique.

   Si aucune ligne n'existe encore,
   on retourne les valeurs par défaut
   sans modifier la base de données.
========================================================== */

export async function GET(request: NextRequest) {
  const locale = getLanguage(request);

  try {
    const prisma = getPrisma();

    const userId = await authenticateOrganizer(
      request,
      prisma
    );

    if (!userId) {
      return errorResponse(
        locale,
        "unauthorized",
        401
      );
    }

    const saved =
      await prisma.userNotificationPreference.findUnique({
        where: {
          userId,
        },

        select: {
          emailTicketSales: true,
          emailDonations: true,
          emailPayouts: true,
          emailEvents: true,
          emailCampaigns: true,

          inAppTicketSales: true,
          inAppDonations: true,
          inAppPayouts: true,
          inAppEvents: true,
          inAppCampaigns: true,

          updatedAt: true,
        },
      });

    const preferences = saved
      ? getPreferenceValues(saved)
      : getPreferenceValues(DEFAULT_PREFERENCES);

    return respond({
      success: true,

      message: TEXT[locale].loaded,

      preferences,

      // Les notifications critiques de sécurité
      // ne peuvent pas être désactivées ici.
      securityNotifications: {
        mandatory: true,
      },

      updatedAt: saved
        ? saved.updatedAt.toISOString()
        : null,
    });
  } catch (error) {
    console.error(
      "[TIKEMIA SETTINGS NOTIFICATIONS GET]",
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

/* ==========================================================
   PATCH — ENREGISTRER LES PRÉFÉRENCES

   URL :
   /api/organizer/settings/notifications

   Les modifications sont appliquées
   uniquement à l'utilisateur connecté.

   Upsert :
   - Première modification : création
   - Modifications suivantes : mise à jour

   Les préférences non transmises
   conservent leur valeur précédente.
========================================================== */

export async function PATCH(request: NextRequest) {
  const locale = getLanguage(request);

  try {
    /* ------------------------------------------------------
       1. VÉRIFIER L'ORIGINE
    ------------------------------------------------------ */

    if (!isAllowedOrigin(request)) {
      return errorResponse(
        locale,
        "forbidden",
        403
      );
    }

    /* ------------------------------------------------------
       2. VÉRIFIER LE CONTENT-TYPE
    ------------------------------------------------------ */

    const contentType =
      request.headers.get("content-type") ?? "";

    if (
      !contentType
        .toLowerCase()
        .startsWith("application/json")
    ) {
      return errorResponse(
        locale,
        "invalidContentType",
        415
      );
    }

    /* ------------------------------------------------------
       3. AUTHENTIFIER L'ORGANISATEUR
    ------------------------------------------------------ */

    const prisma = getPrisma();

    const userId = await authenticateOrganizer(
      request,
      prisma
    );

    if (!userId) {
      return errorResponse(
        locale,
        "unauthorized",
        401
      );
    }

    /* ------------------------------------------------------
       4. LIRE LES DONNÉES
    ------------------------------------------------------ */

    const body = await readLimitedJson(request);

    if (!body) {
      return errorResponse(
        locale,
        "invalidBody",
        400
      );
    }

    /* ------------------------------------------------------
       5. VALIDER TOUS LES CHAMPS
    ------------------------------------------------------ */

    const validation = validatePreferences(body);

    if (!validation.success) {
      return errorResponse(
        locale,
        validation.error,
        400
      );
    }

    const changes = validation.values;

    /* ------------------------------------------------------
       6. ENREGISTRER DANS POSTGRESQL

       userId vient de la session.
       Il n'est jamais accepté depuis
       le corps de la requête.

       Les valeurs par défaut sont utilisées
       uniquement lors de la création.
    ------------------------------------------------------ */

    const saved =
      await prisma.userNotificationPreference.upsert({
        where: {
          userId,
        },

        create: {
          userId,
          ...DEFAULT_PREFERENCES,
          ...changes,
        },

        update: changes,

        select: {
          emailTicketSales: true,
          emailDonations: true,
          emailPayouts: true,
          emailEvents: true,
          emailCampaigns: true,

          inAppTicketSales: true,
          inAppDonations: true,
          inAppPayouts: true,
          inAppEvents: true,
          inAppCampaigns: true,

          updatedAt: true,
        },
      });

    /* ------------------------------------------------------
       7. RÉPONSE
    ------------------------------------------------------ */

    return respond({
      success: true,

      message: TEXT[locale].updated,

      preferences: getPreferenceValues(saved),

      securityNotifications: {
        mandatory: true,
      },

      updatedAt: saved.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error(
      "[TIKEMIA SETTINGS NOTIFICATIONS PATCH]",
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
