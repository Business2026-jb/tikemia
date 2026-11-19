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
  Prisma,
  PrismaClient,
} from "@/generated/prisma/client";

import {
  isSupportedCountry,
  parsePhoneNumberFromString,
} from "libphonenumber-js";

/* ==========================================================
   TIKEMIA — PROFIL ORGANISATEUR

   Fichier :
   src/app/api/organizer/settings/profile/route.ts

   GET :
   - Récupérer le profil de l'utilisateur
   - Récupérer ses organisations
   - Récupérer l'organisation sélectionnée
   - Afficher l'email en lecture seule
   - Fournir les données aux pages Profil
     et Paramètres

   PATCH :
   - Modifier le prénom
   - Modifier le nom
   - Modifier le numéro de téléphone
   - Modifier le pays
   - Modifier le nom de l'organisation
   - Modifier les coordonnées de l'organisation
   - Ne jamais permettre la modification
     de l'adresse email

   Sécurité :
   - Session HttpOnly
   - Rôle ORGANIZER obligatoire
   - Email vérifié
   - Contrôle des organisations propriétaires
   - Vérification CSRF
   - Validation des champs
   - Transactions PostgreSQL
   - Journalisation AuditLog
   - Réponses FR / EN

   Compatible :
   - Next.js App Router
   - Prisma ORM 7
   - PostgreSQL
   - TypeScript
   - PC et mobile

   Aucun composant graphique dans cette API.
========================================================== */




/* ==========================================================
   CONFIGURATION
========================================================== */

const SESSION_COOKIE =
  "tikemia_organizer_session";

const SESSION_PATTERN =
  /^[a-f0-9]{64}$/i;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_BODY_BYTES = 8192;

const MAX_FIRST_NAME = 80;

const MAX_LAST_NAME = 80;

const MAX_ORGANIZATION_NAME = 180;

const MAX_CITY_LENGTH = 120;

const MAX_PHONE_LENGTH = 25;

type Language = "fr" | "en";

type JsonRecord =
  Record<string, unknown>;

type ProfileInput = {
  organizationId?: string;

  firstName?: string;
  lastName?: string;

  phoneE164?: string | null;
  countryCode?: string | null;

  organizationName?: string;
  organizationPhoneE164?: string | null;
  organizationCountryCode?: string | null;
  organizationCity?: string | null;
};

type ErrorKey =
  | "unauthorized"
  | "forbidden"
  | "invalidOrganization"
  | "invalidContentType"
  | "invalidBody"
  | "invalidFields"
  | "emptyUpdate"
  | "invalidFirstName"
  | "invalidLastName"
  | "invalidOrganizationName"
  | "invalidPhone"
  | "invalidCountry"
  | "invalidCity"
  | "emailProtected"
  | "conflict"
  | "serverError";

class ApiError extends Error {
  constructor(
    public readonly key: ErrorKey,
    public readonly status: number
  ) {
    super(key);

    this.name = "ApiError";
  }
}

/* ==========================================================
   CHAMPS AUTORISÉS

   IMPORTANT :
   email ne figure PAS dans cette liste.

   Toute tentative de modification de
   l'adresse email sera refusée.
========================================================== */

const ALLOWED_PATCH_FIELDS =
  new Set([
    "organizationId",

    "firstName",
    "lastName",

    "phoneE164",
    "countryCode",

    "organizationName",
    "organizationPhoneE164",
    "organizationCountryCode",
    "organizationCity",
  ]);


/* ==========================================================
   TRADUCTIONS
========================================================== */

const TEXT = {
  fr: {
    unauthorized:
      "Veuillez vous connecter à votre espace organisateur.",

    forbidden:
      "Vous n'êtes pas autorisé à effectuer cette opération.",

    invalidOrganization:
      "L'organisation sélectionnée n'existe pas ou ne vous appartient pas.",

    invalidContentType:
      "Les informations doivent être envoyées au format JSON.",

    invalidBody:
      "Les données envoyées sont invalides ou trop volumineuses.",

    invalidFields:
      "La requête contient des champs non autorisés.",

    emptyUpdate:
      "Aucune information à modifier.",

    invalidFirstName:
      "Veuillez renseigner un prénom valide de 1 à 80 caractères.",

    invalidLastName:
      "Veuillez renseigner un nom valide de 1 à 80 caractères.",

    invalidOrganizationName:
      "Le nom de l'organisation doit contenir entre 2 et 180 caractères.",

    invalidPhone:
      "Veuillez saisir un numéro de téléphone valide avec son indicatif international.",

    invalidCountry:
      "Veuillez sélectionner un pays valide.",

    invalidCity:
      "Veuillez renseigner une ville valide.",

    emailProtected:
      "L'adresse email du compte ne peut pas être modifiée depuis les paramètres.",

    conflict:
      "Les informations ont changé pendant l'enregistrement. Veuillez réessayer.",

    serverError:
      "Impossible de récupérer ou de modifier le profil pour le moment.",

    loaded:
      "Profil récupéré avec succès.",

    updated:
      "Les informations de votre profil ont été enregistrées.",
  },

  en: {
    unauthorized:
      "Please sign in to your organizer account.",

    forbidden:
      "You are not authorized to perform this operation.",

    invalidOrganization:
      "The selected organization does not exist or does not belong to you.",

    invalidContentType:
      "Information must be sent in JSON format.",

    invalidBody:
      "Invalid or oversized request data.",

    invalidFields:
      "The request contains unauthorized fields.",

    emptyUpdate:
      "No information to update.",

    invalidFirstName:
      "Please enter a valid first name of 1 to 80 characters.",

    invalidLastName:
      "Please enter a valid last name of 1 to 80 characters.",

    invalidOrganizationName:
      "The organization name must contain between 2 and 180 characters.",

    invalidPhone:
      "Please enter a valid phone number with its international calling code.",

    invalidCountry:
      "Please select a valid country.",

    invalidCity:
      "Please enter a valid city.",

    emailProtected:
      "The account email address cannot be changed in Settings.",

    conflict:
      "The information changed while saving. Please try again.",

    serverError:
      "Unable to load or update the profile right now.",

    loaded:
      "Profile retrieved successfully.",

    updated:
      "Your profile information has been saved.",
  },
} as const;

/* ==========================================================
   PRISMA 7 — CONNEXION POSTGRESQL

   Réutilisation du client en développement
   et dans une instance serveur persistante.
========================================================== */

const getPrisma = getPlatformPrisma;

/* ==========================================================
   LANGUE
========================================================== */

function getLanguage(
  request: NextRequest
): Language {
  const requested =
    request.nextUrl.searchParams.get(
      "locale"
    );

  if (
    requested === "fr" ||
    requested === "en"
  ) {
    return requested;
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

/* ==========================================================
   RÉPONSES JSON

   Les informations personnelles ne doivent
   pas être mises en cache par un proxy.
========================================================== */

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
          "private, no-store, max-age=0, must-revalidate",

        Pragma:
          "no-cache",

        "X-Content-Type-Options":
          "nosniff",

        Vary:
          "Cookie, Accept-Language",
      },
    }
  );
}

function errorResponse(
  language: Language,
  key: ErrorKey,
  status: number
) {
  const response = respond(
    {
      success: false,

      message:
        TEXT[language][key],
    },
    status
  );
  if (status === 401) response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}

/* ==========================================================
   CONTRÔLE DE L'ORIGINE

   PATCH doit provenir de TIKEMIA.

   Le cookie de session doit être configuré
   avec HttpOnly, Secure et SameSite
   dans le système de connexion.
========================================================== */

function isSameOrigin(
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

  if (!origin) {
    return false;
  }

  try {
    return (
      new URL(origin).origin ===
      getTrustedRequestOrigin(request)
    );
  } catch {
    return false;
  }
}

/* ==========================================================
   TYPES DES REQUÊTES PRISMA

   Nous utilisons les champs présents dans
   le schéma TIKEMIA :

   User :
   id, fullName, firstName, lastName,
   email, phoneE164, countryCode,
   preferredLocale, avatarStorageKey

   Organization :
   id, ownerId, name, description,
   logoStorageKey, email, phoneE164,
   countryCode, city
========================================================== */

const userSelect = {
  passwordHash: true,
  id: true,

  fullName: true,
  firstName: true,
  lastName: true,

  email: true,
  emailVerifiedAt: true,

  phoneE164: true,
  countryCode: true,

  preferredLocale: true,
  avatarStorageKey: true,

  isActive: true,
  isBlocked: true,

  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const organizationSelect = {
  blueBadgeEnabled: true,
  id: true,

  name: true,
  description: true,

  email: true,
  phoneE164: true,

  countryCode: true,
  city: true,

  logoStorageKey: true,

  isActive: true,

  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrganizationSelect;

/* ==========================================================
   AUTHENTIFICATION ORGANISATEUR

   - Cookie de session
   - Hachage SHA256 du jeton
   - Vérification de l'expiration
   - Vérification du rôle ORGANIZER
   - Vérification du compte

   L'email, les identifiants utilisateur
   et les organisations ne sont jamais
   choisis librement depuis le navigateur.
========================================================== */

async function authenticateOrganizer(
  request: NextRequest,
  prisma: PrismaClient
): Promise<string | null> {
  const token =
    request.cookies.get(
      SESSION_COOKIE
    )?.value;

  if (
    !token ||
    !SESSION_PATTERN.test(token)
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
            role:
              "ORGANIZER",
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

  const organizationCount =
    await prisma.organization.count({
      where: {
        ownerId:
          user.id,

        isActive: true,
      },
    });

  if (
    organizationCount === 0
  ) {
    return null;
  }

  return user.id;
}

/* ==========================================================
   UTILITAIRES
========================================================== */

function hasOwn(
  object: JsonRecord,
  key: string
): boolean {
  return Object.prototype.hasOwnProperty.call(
    object,
    key
  );
}

function cleanText(
  value: unknown,
  minimum: number,
  maximum: number
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
    normalized.length < minimum ||
    normalized.length > maximum ||
    /[\u0000-\u001f\u007f]/.test(
      normalized
    )
  ) {
    return null;
  }

  return normalized;
}

function normalizeCountry(
  value: string
): string {
  return value
    .trim()
    .toUpperCase();
}

function parseCountry(
  value: unknown
): string | null {
  if (value === null || value === "") {
    return null;
  }

  if (
    typeof value !== "string"
  ) {
    throw new ApiError(
      "invalidCountry",
      400
    );
  }

  const code =
    normalizeCountry(value);

  if (
    !isSupportedCountry(code)
  ) {
    throw new ApiError(
      "invalidCountry",
      400
    );
  }

  return code;
}

/* ==========================================================
   TÉLÉPHONE INTERNATIONAL

   L'utilisateur doit saisir son numéro
   avec l'indicatif, par exemple +229...

   Le stockage utilise le format E.164.

   Les numéros invalides sont refusés.
========================================================== */

function parsePhone(
  value: unknown
): string | null {
  if (
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !== "string"
  ) {
    throw new ApiError(
      "invalidPhone",
      400
    );
  }

  const normalized =
    value.replace(
      /[\s().-]/g,
      ""
    );

  if (
    normalized.length >
      MAX_PHONE_LENGTH ||
    !/^\+[1-9]\d{6,14}$/.test(
      normalized
    )
  ) {
    throw new ApiError(
      "invalidPhone",
      400
    );
  }

  const phone =
    parsePhoneNumberFromString(
      normalized
    );

  if (
    !phone ||
    !phone.isValid()
  ) {
    throw new ApiError(
      "invalidPhone",
      400
    );
  }

  return phone.number;
}

/* ==========================================================
   LECTURE JSON AVEC LIMITE DE TAILLE

   Contrôle aussi les requêtes sans
   en-tête Content-Length.
========================================================== */

async function readLimitedJson(
  request: NextRequest
): Promise<JsonRecord | null> {
  if (!request.body) {
    return null;
  }

  const lengthHeader =
    request.headers.get(
      "content-length"
    );

  if (
    lengthHeader !== null
  ) {
    const length =
      Number(lengthHeader);

    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > MAX_BODY_BYTES
    ) {
      return null;
    }
  }

  const reader =
    request.body.getReader();

  const chunks:
    Uint8Array[] = [];

  let total = 0;

  try {
    while (true) {
      const result =
        await reader.read();

      if (
        result.done
      ) {
        break;
      }

      total +=
        result.value.byteLength;

      if (
        total > MAX_BODY_BYTES
      ) {
        await reader.cancel();

        return null;
      }

      chunks.push(
        result.value
      );
    }

    const bytes =
      new Uint8Array(total);

    let offset = 0;

    for (
      const chunk of chunks
    ) {
      bytes.set(
        chunk,
        offset
      );

      offset +=
        chunk.byteLength;
    }

    const raw =
      new TextDecoder(
        "utf-8",
        {
          fatal: true,
        }
      ).decode(bytes);

    const parsed: unknown =
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
  } finally {
    reader.releaseLock();
  }
}

/* ==========================================================
   VALIDATION DU PATCH

   Exemple :

   {
     "firstName": "Jean",
     "lastName": "Dupont",
     "phoneE164": "+229...",
     "organizationName": "Mon Organisation",
     "organizationCity": "Cotonou"
   }

   L'adresse email est explicitement
   interdite en modification.
========================================================== */

function validateProfileInput(
  body: JsonRecord
): ProfileInput {
  if (
    hasOwn(body, "email") ||
    hasOwn(body, "emailAddress") ||
    hasOwn(body, "guestEmail")
  ) {
    throw new ApiError(
      "emailProtected",
      403
    );
  }

  for (
    const key of Object.keys(body)
  ) {
    if (
      !ALLOWED_PATCH_FIELDS.has(key)
    ) {
      throw new ApiError(
        "invalidFields",
        400
      );
    }
  }

  const input:
    ProfileInput = {};

  if (
    hasOwn(
      body,
      "organizationId"
    )
  ) {
    if (
      typeof body.organizationId !==
        "string" ||
      !UUID_PATTERN.test(
        body.organizationId
      )
    ) {
      throw new ApiError(
        "invalidOrganization",
        400
      );
    }

    input.organizationId =
      body.organizationId.toLowerCase();
  }

  if (
    hasOwn(
      body,
      "firstName"
    )
  ) {
    const value =
      cleanText(
        body.firstName,
        1,
        MAX_FIRST_NAME
      );

    if (!value) {
      throw new ApiError(
        "invalidFirstName",
        400
      );
    }

    input.firstName = value;
  }

  if (
    hasOwn(
      body,
      "lastName"
    )
  ) {
    const value =
      cleanText(
        body.lastName,
        1,
        MAX_LAST_NAME
      );

    if (!value) {
      throw new ApiError(
        "invalidLastName",
        400
      );
    }

    input.lastName = value;
  }

  if (
    hasOwn(
      body,
      "phoneE164"
    )
  ) {
    input.phoneE164 =
      parsePhone(
        body.phoneE164
      );
  }

  if (
    hasOwn(
      body,
      "countryCode"
    )
  ) {
    input.countryCode =
      parseCountry(
        body.countryCode
      );
  }

  if (
    hasOwn(
      body,
      "organizationName"
    )
  ) {
    const value =
      cleanText(
        body.organizationName,
        2,
        MAX_ORGANIZATION_NAME
      );

    if (!value) {
      throw new ApiError(
        "invalidOrganizationName",
        400
      );
    }

    input.organizationName =
      value;
  }

  if (
    hasOwn(
      body,
      "organizationPhoneE164"
    )
  ) {
    input.organizationPhoneE164 =
      parsePhone(
        body.organizationPhoneE164
      );
  }

  if (
    hasOwn(
      body,
      "organizationCountryCode"
    )
  ) {
    input.organizationCountryCode =
      parseCountry(
        body.organizationCountryCode
      );
  }

  if (
    hasOwn(
      body,
      "organizationCity"
    )
  ) {
    if (
      body.organizationCity === null ||
      body.organizationCity === ""
    ) {
      input.organizationCity =
        null;
    } else {
      const value =
        cleanText(
          body.organizationCity,
          1,
          MAX_CITY_LENGTH
        );

      if (!value) {
        throw new ApiError(
          "invalidCity",
          400
        );
      }

      input.organizationCity =
        value;
    }
  }

  const changedFields =
    Object.keys(input).filter(
      (key) =>
        key !== "organizationId"
    );

  if (
    changedFields.length === 0
  ) {
    throw new ApiError(
      "emptyUpdate",
      400
    );
  }

  return input;
}

/* ==========================================================
   NOM / PRÉNOM

   Conservation du champ historique
   User.fullName.

   Cela évite de casser les pages
   qui utilisent encore fullName.
========================================================== */

function deriveNames(
  firstName: string | null,
  lastName: string | null,
  fullName: string
) {
  const parts =
    fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  return {
    firstName:
      firstName?.trim() ||
      parts[0] ||
      "",

    lastName:
      lastName?.trim() ||
      parts.slice(1).join(" "),
  };
}

/* ==========================================================
   SÉLECTION DE L'ORGANISATION

   - Si un identifiant est fourni :
     vérifier qu'il appartient à l'utilisateur.

   - Sinon :
     utiliser la première organisation
     active de l'utilisateur.

   Ce choix doit être cohérent avec
   l'organisation active dans le dashboard
   si plusieurs organisations sont gérées.
========================================================== */

async function getOwnedOrganization(
  prisma: PrismaClient,
  userId: string,
  requestedId?: string
) {
  return prisma.organization.findFirst({
    where: {
      ownerId: userId,

      isActive: true,

      ...(requestedId
        ? {
            id:
              requestedId,
          }
        : {}),
    },

    orderBy: {
      createdAt: "asc",
    },

    select:
      organizationSelect,
  });
}

/* ==========================================================
   CONSTRUIRE LA RÉPONSE

   Les informations sont regroupées
   pour faciliter l'utilisation par :

   settings/page.tsx
   profile/page.tsx

   Aucune donnée de session ou
   aucun hash de mot de passe n'est exposé.
========================================================== */

function serializeProfile(
  user: {
    id: string;
    fullName: string;
    passwordHash: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string;
    emailVerifiedAt: Date | null;
    phoneE164: string | null;
    countryCode: string | null;
    preferredLocale: string;
    avatarStorageKey: string | null;
    createdAt: Date;
    updatedAt: Date;
  },

  organization: {
    blueBadgeEnabled: boolean;
    id: string;
    name: string;
    description: string | null;
    email: string | null;
    phoneE164: string | null;
    countryCode: string | null;
    city: string | null;
    logoStorageKey: string | null;
    createdAt: Date;
    updatedAt: Date;
  },

  organizations: {
    id: string;
    name: string;
  }[]
) {
  const names =
    deriveNames(
      user.firstName,
      user.lastName,
      user.fullName
    );

  return {
    id:
      user.id,

    userId:
      user.id,
    hasPassword: user.passwordHash !== null,

    firstName:
      names.firstName,

    lastName:
      names.lastName,

    fullName:
      user.fullName,

    email:
      user.email,

    emailEditable:
      false,

    emailVerified:
      Boolean(
        user.emailVerifiedAt
      ),

    phoneE164:
      user.phoneE164,

    countryCode:
      user.countryCode,

    preferredLocale:
      user.preferredLocale,

    avatarStorageKey:
      user.avatarStorageKey,
    hasAvatar: Boolean(user.avatarStorageKey),
    avatarEndpoint: "/api/organizer/settings/profile/avatar",

    createdAt:
      user.createdAt.toISOString(),

    updatedAt:
      user.updatedAt.toISOString(),

    organizationId:
      organization.id,

    blueBadgeEnabled: organization.blueBadgeEnabled,
    organizationName:
      organization.name,

    organizationPhoneE164:
      organization.phoneE164,

    organizationCountryCode:
      organization.countryCode,

    organizationCity:
      organization.city,

    organization: {
      blueBadgeEnabled: organization.blueBadgeEnabled,
      id:
        organization.id,

      name:
        organization.name,

      description:
        organization.description,

      email:
        organization.email,

      phoneE164:
        organization.phoneE164,

      countryCode:
        organization.countryCode,

      city:
        organization.city,

      logoStorageKey:
        organization.logoStorageKey,

      createdAt:
        organization.createdAt.toISOString(),

      updatedAt:
        organization.updatedAt.toISOString(),
    },

    organizations,

    permissions: {
      canEditFirstName: true,
      canEditLastName: true,
      canEditPhone: true,
      canEditOrganization: true,
      canEditEmail: false,
    },
  };
}

/* ==========================================================
   ERREURS
========================================================== */

function handleError(
  error: unknown,
  language: Language
) {
  if (
    error instanceof ApiError
  ) {
    return errorResponse(
      language,
      error.key,
      error.status
    );
  }

  if (
    error instanceof
      Prisma.PrismaClientKnownRequestError &&
    (
      error.code === "P2034" ||
      error.code === "P2025"
    )
  ) {
    return errorResponse(
      language,
      "conflict",
      409
    );
  }

  console.error(
    "[TIKEMIA ORGANIZER PROFILE]",
    error instanceof Error
      ? error.name
      : "UnknownError"
  );

  return errorResponse(
    language,
    "serverError",
    503
  );
}

/* ==========================================================
   GET — PROFIL DE L'ORGANISATEUR

   URL :
   GET /api/organizer/settings/profile

   Option :
   ?organizationId=UUID

   Retour :
   - Profil utilisateur
   - Email non modifiable
   - Organisation sélectionnée
   - Liste des organisations
========================================================== */

export async function GET(
  request: NextRequest
) {
  const language =
    getLanguage(
      request
    );

  try {
    const prisma =
      getPrisma();

    /* ----------------------------------------
       AUTHENTIFIER L'UTILISATEUR
    ---------------------------------------- */

    const userId =
      await authenticateOrganizer(
        request,
        prisma
      );

    if (!userId) {
      throw new ApiError(
        "unauthorized",
        401
      );
    }

    /* ----------------------------------------
       ORGANISATION DEMANDÉE
    ---------------------------------------- */

    const requestedId =
      request.nextUrl.searchParams.get(
        "organizationId"
      ) ??
      undefined;

    if (
      requestedId &&
      !UUID_PATTERN.test(
        requestedId
      )
    ) {
      throw new ApiError(
        "invalidOrganization",
        400
      );
    }

    /* ----------------------------------------
       RÉCUPÉRER LES INFORMATIONS
    ---------------------------------------- */

    const [
      user,
      organization,
      organizations,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: {
          id: userId,
        },

        select:
          userSelect,
      }),

      getOwnedOrganization(
        prisma,
        userId,
        requestedId
      ),

      prisma.organization.findMany({
        where: {
          ownerId: userId,

          isActive: true,
        },

        orderBy: {
          createdAt: "asc",
        },

        select: {
          id: true,
          name: true,
        },
      }),
    ]);

    if (!user) {
      throw new ApiError(
        "unauthorized",
        401
      );
    }

    if (!organization) {
      throw new ApiError(
        "invalidOrganization",
        404
      );
    }

    /* ----------------------------------------
       RÉPONSE
    ---------------------------------------- */

    return respond({
      success: true,

      message:
        TEXT[language].loaded,

      profile:
        serializeProfile(
          user,
          organization,
          organizations
        ),
    });
  } catch (error) {
    return handleError(
      error,
      language
    );
  }
}

/* ==========================================================
   PATCH — MODIFICATION DU PROFIL

   URL :
   PATCH /api/organizer/settings/profile

   Les modifications de l'utilisateur
   et de l'organisation sont exécutées
   dans la même transaction.

   L'email n'est jamais modifié.
========================================================== */

export async function PATCH(
  request: NextRequest
) {
  const language =
    getLanguage(
      request
    );

  try {
    /* ----------------------------------------
       1. PROTECTION CSRF
    ---------------------------------------- */

    if (
      !isSameOrigin(
        request
      )
    ) {
      throw new ApiError(
        "forbidden",
        403
      );
    }

    /* ----------------------------------------
       2. CONTENT-TYPE
    ---------------------------------------- */

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
      throw new ApiError(
        "invalidContentType",
        415
      );
    }

    /* ----------------------------------------
       3. AUTHENTIFICATION
    ---------------------------------------- */

    const prisma =
      getPrisma();

    const userId =
      await authenticateOrganizer(
        request,
        prisma
      );

    if (!userId) {
      throw new ApiError(
        "unauthorized",
        401
      );
    }

    /* ----------------------------------------
       4. LECTURE DU JSON
    ---------------------------------------- */

    const body =
      await readLimitedJson(
        request
      );

    if (!body) {
      throw new ApiError(
        "invalidBody",
        400
      );
    }

    /* ----------------------------------------
       5. VALIDATION
    ---------------------------------------- */

    const input =
      validateProfileInput(
        body
      );

    /* ----------------------------------------
       6. TRANSACTION POSTGRESQL
    ---------------------------------------- */

    const result =
      await prisma.$transaction(
        async (tx) => {
          /* ----------------------------------
             UTILISATEUR ACTUEL
          ---------------------------------- */

          const currentUser =
            await tx.user.findUnique({
              where: {
                id: userId,
              },

              select: {
                id: true,

                fullName: true,
                firstName: true,
                lastName: true,

                email: true,

                isActive: true,
                isBlocked: true,
              },
            });

          if (
            !currentUser ||
            !currentUser.isActive ||
            currentUser.isBlocked
          ) {
            throw new ApiError(
              "unauthorized",
              401
            );
          }

          /* ----------------------------------
             ORGANISATION AUTORISÉE
          ---------------------------------- */

          const organization =
            await tx.organization.findFirst({
              where: {
                ownerId: userId,

                isActive: true,

                ...(input.organizationId
                  ? {
                      id:
                        input.organizationId,
                    }
                  : {}),
              },

              orderBy: {
                createdAt: "asc",
              },

              select: {
                id: true,
              },
            });

          if (!organization) {
            throw new ApiError(
              "invalidOrganization",
              403
            );
          }

          /* ----------------------------------
             PRÉPARER LES MODIFICATIONS
             DE L'UTILISATEUR
          ---------------------------------- */

          const userData:
            Prisma.UserUpdateInput = {};

          const nameChanged =
            input.firstName !== undefined ||
            input.lastName !== undefined;

          if (nameChanged) {
            const existingNames =
              deriveNames(
                currentUser.firstName,
                currentUser.lastName,
                currentUser.fullName
              );

            const firstName =
              input.firstName ??
              existingNames.firstName;

            const lastName =
              input.lastName ??
              existingNames.lastName;

            if (
              !firstName ||
              !lastName
            ) {
              throw new ApiError(
                !firstName
                  ? "invalidFirstName"
                  : "invalidLastName",
                400
              );
            }

            userData.firstName =
              firstName;

            userData.lastName =
              lastName;

            /* ------------------------------
               Conserver fullName à jour
               pour les anciennes pages.
            ------------------------------ */

            userData.fullName =
              `${firstName} ${lastName}`.trim();
          }

          if (
            input.phoneE164 !==
            undefined
          ) {
            userData.phoneE164 =
              input.phoneE164;
          }

          if (
            input.countryCode !==
            undefined
          ) {
            userData.countryCode =
              input.countryCode;
          }

          /* ----------------------------------
             PRÉPARER LES MODIFICATIONS
             DE L'ORGANISATION
          ---------------------------------- */

          const organizationData:
            Prisma.OrganizationUpdateInput = {};

          if (
            input.organizationName !==
            undefined
          ) {
            organizationData.name =
              input.organizationName;
          }

          if (
            input.organizationPhoneE164 !==
            undefined
          ) {
            organizationData.phoneE164 =
              input.organizationPhoneE164;
          }

          if (
            input.organizationCountryCode !==
            undefined
          ) {
            organizationData.countryCode =
              input.organizationCountryCode;
          }

          if (
            input.organizationCity !==
            undefined
          ) {
            organizationData.city =
              input.organizationCity;
          }

          /* ----------------------------------
             ENREGISTRER L'UTILISATEUR
          ---------------------------------- */

          if (
            Object.keys(userData).length >
            0
          ) {
            await tx.user.update({
              where: {
                id: userId,
              },

              data:
                userData,
            });
          }

          /* ----------------------------------
             ENREGISTRER L'ORGANISATION

             L'ownerId est revérifié ici.
          ---------------------------------- */

          if (
            Object.keys(
              organizationData
            ).length > 0
          ) {
            const updated =
              await tx.organization.updateMany({
                where: {
                  id:
                    organization.id,

                  ownerId:
                    userId,

                  isActive: true,
                },

                data:
                  organizationData,
              });

            if (
              updated.count !== 1
            ) {
              throw new ApiError(
                "invalidOrganization",
                403
              );
            }
          }

          /* ----------------------------------
             HISTORIQUE D'AUDIT

             Ne pas journaliser les
             numéros de téléphone ni
             d'autres valeurs personnelles.
          ---------------------------------- */

          const changedFields =
            Object.keys(input).filter(
              (key) =>
                key !==
                "organizationId"
            );

          await tx.auditLog.create({
            data: {
              actorId: userId,

              action:
                "ORGANIZER_PROFILE_UPDATED",

              entity:
                "User",

              entityId:
                userId,

              metadata: {
                organizationId:
                  organization.id,

                changedFields,
              },
            },
          });

          /* ----------------------------------
             RECHARGER LES INFORMATIONS
             APRÈS ENREGISTREMENT
          ---------------------------------- */

          const [
            savedUser,
            savedOrganization,
            organizations,
          ] = await Promise.all([
            tx.user.findUnique({
              where: {
                id: userId,
              },

              select:
                userSelect,
            }),

            tx.organization.findUnique({
              where: {
                id:
                  organization.id,
              },

              select:
                organizationSelect,
            }),

            tx.organization.findMany({
              where: {
                ownerId:
                  userId,

                isActive: true,
              },

              orderBy: {
                createdAt: "asc",
              },

              select: {
                id: true,
                name: true,
              },
            }),
          ]);

          if (
            !savedUser ||
            !savedOrganization
          ) {
            throw new ApiError(
              "serverError",
              503
            );
          }

          return serializeProfile(
            savedUser,
            savedOrganization,
            organizations
          );
        },
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel
              .Serializable,

          timeout: 15000,
        }
      );

    /* ----------------------------------------
       7. CONFIRMATION
    ---------------------------------------- */

    return respond({
      success: true,

      message:
        TEXT[language].updated,

      profile:
        result,
    });
  } catch (error) {
    return handleError(
      error,
      language
    );
  }
}
