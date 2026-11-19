import { getTrustedRequestOrigin } from "@/lib/tikemia-pay/providers";
import { getPlatformPrisma } from "@/lib/payments/fulfillment";

import { NextRequest, NextResponse } from "next/server";
import {
  createHash,
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";

import argon2 from "argon2";
import bcrypt from "bcryptjs";

import {
  Prisma,
  PrismaClient,
} from "@/generated/prisma/client";

/* ==========================================================
   TIKEMIA — CONNEXION ORGANISATEUR

   POST /api/organizer/auth/login

   Fonctionnalités :
   - Connexion par email et mot de passe
   - Vérification Argon2id
   - Compatibilité bcrypt
   - Contrôle du rôle ORGANIZER
   - Contrôle du compte et de l'email
   - Création d'une session PostgreSQL
   - Cookie sécurisé HttpOnly
   - Se souvenir de moi
   - Limitation des tentatives
   - Journalisation de sécurité
   - Français / Anglais

   Le mot de passe et le token de session
   ne sont jamais retournés dans le JSON.

   Modèles existants :
   User, UserRole, Organization,
   Session, AppSetting, SecurityEvent.
========================================================== */


/* ==========================================================
   CONFIGURATION
========================================================== */

const SESSION_COOKIE = "tikemia_organizer_session";

const MAX_BODY_BYTES = 4096;

const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 1024;

const SESSION_DURATION_MS =
  12 * 60 * 60 * 1000;

const REMEMBER_SESSION_DURATION_MS =
  30 * 24 * 60 * 60 * 1000;

const RATE_WINDOW_MS =
  15 * 60 * 1000;

const MAX_LOGIN_ATTEMPTS = 8;

const RATE_PREFIX = "organizer_login_rate:";

const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Locale = "fr" | "en";

type JsonObject = Record<string, unknown>;

type RateState = {
  version: 1;
  attempts: number;
  windowStartedAt: string;
  blockedUntil: string | null;
};

type LoginAccount = {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string | null;
  emailVerifiedAt: Date | null;
  isActive: boolean;
  isBlocked: boolean;
  preferredLocale: string;
  roles: Array<{ id: string }>;
  ownedOrganizations: Array<{
    id: string;
    name: string;
  }>;
};

class LoginError extends Error {
  constructor(
    readonly code:
      | "INVALID_REQUEST"
      | "INVALID_CREDENTIALS"
      | "TOO_MANY_ATTEMPTS"
      | "FORBIDDEN"
      | "SERVICE_UNAVAILABLE",
    readonly status: number
  ) {
    super(code);
  }
}

/* ==========================================================
   TRADUCTIONS
========================================================== */

const MESSAGES = {
  fr: {
    invalidRequest:
      "Veuillez saisir une adresse email et un mot de passe valides.",

    invalidCredentials:
      "Adresse email ou mot de passe incorrect.",

    tooManyAttempts:
      "Trop de tentatives de connexion. Veuillez réessayer plus tard.",

    forbidden:
      "Cette requête n'est pas autorisée.",

    unavailable:
      "La connexion est momentanément indisponible.",

    success:
      "Connexion réussie. Bienvenue dans votre espace organisateur.",
  },

  en: {
    invalidRequest:
      "Please enter a valid email address and password.",

    invalidCredentials:
      "Incorrect email address or password.",

    tooManyAttempts:
      "Too many login attempts. Please try again later.",

    forbidden:
      "This request is not authorized.",

    unavailable:
      "Login is temporarily unavailable.",

    success:
      "Login successful. Welcome to your organizer dashboard.",
  },
} as const;

/* ==========================================================
   PRISMA 7
========================================================== */

const getPrisma = getPlatformPrisma;

/* ==========================================================
   RÉPONSES
========================================================== */

function getLocale(
  request: NextRequest
): Locale {
  const requested =
    request.nextUrl.searchParams.get("locale");

  if (requested === "fr" || requested === "en") {
    return requested;
  }

  const acceptLanguage =
    request.headers.get("accept-language") ?? "";

  return acceptLanguage
    .toLowerCase()
    .startsWith("en")
    ? "en"
    : "fr";
}

function jsonResponse(
  data: JsonObject,
  status = 200,
  retryAfter?: number
): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control":
        "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      Vary: "Cookie, Accept-Language",

      ...(retryAfter
        ? {
            "Retry-After":
              String(retryAfter),
          }
        : {}),
    },
  });
}

function errorResponse(
  error: LoginError,
  locale: Locale
): NextResponse {
  const message =
    error.code === "INVALID_REQUEST"
      ? MESSAGES[locale].invalidRequest
      : error.code === "INVALID_CREDENTIALS"
        ? MESSAGES[locale].invalidCredentials
        : error.code === "TOO_MANY_ATTEMPTS"
          ? MESSAGES[locale].tooManyAttempts
          : error.code === "FORBIDDEN"
            ? MESSAGES[locale].forbidden
            : MESSAGES[locale].unavailable;

  return jsonResponse(
    {
      success: false,
      code: error.code,
      message,
    },
    error.status
  );
}

/* ==========================================================
   VÉRIFICATION ORIGINE / CSRF
========================================================== */

function validateOrigin(
  request: NextRequest
): void {
  const fetchSite =
    request.headers.get("sec-fetch-site");

  if (
    fetchSite &&
    fetchSite !== "same-origin" &&
    fetchSite !== "none"
  ) {
    throw new LoginError(
      "FORBIDDEN",
      403
    );
  }

  const origin =
    request.headers.get("origin");

  if (!origin) {
    throw new LoginError(
      "FORBIDDEN",
      403
    );
  }

  let parsedOrigin: string;

  try {
    parsedOrigin =
      new URL(origin).origin;
  } catch {
    throw new LoginError(
      "FORBIDDEN",
      403
    );
  }

  if (
    parsedOrigin !==
    getTrustedRequestOrigin(request)
  ) {
    throw new LoginError(
      "FORBIDDEN",
      403
    );
  }
}

/* ==========================================================
   LECTURE JSON LIMITÉE
========================================================== */

async function readBody(
  request: NextRequest
): Promise<JsonObject> {
  const contentType =
    request.headers.get("content-type") ?? "";

  if (
    !contentType
      .toLowerCase()
      .startsWith("application/json")
  ) {
    throw new LoginError(
      "INVALID_REQUEST",
      400
    );
  }

  if (!request.body) {
    throw new LoginError(
      "INVALID_REQUEST",
      400
    );
  }

  const reader =
    request.body.getReader();

  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const result =
        await reader.read();

      if (result.done) break;

      total +=
        result.value.byteLength;

      if (total > MAX_BODY_BYTES) {
        await reader.cancel();

        throw new LoginError(
          "INVALID_REQUEST",
          400
        );
      }

      chunks.push(
        result.value
      );
    }

    const bytes =
      new Uint8Array(total);

    let offset = 0;

    for (const chunk of chunks) {
      bytes.set(
        chunk,
        offset
      );

      offset +=
        chunk.byteLength;
    }

    const content =
      new TextDecoder("utf-8", {
        fatal: true,
      }).decode(bytes);

    const parsed: unknown =
      JSON.parse(content);

    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new LoginError(
        "INVALID_REQUEST",
        400
      );
    }

    return parsed as JsonObject;
  } catch (error) {
    if (error instanceof LoginError) {
      throw error;
    }

    throw new LoginError(
      "INVALID_REQUEST",
      400
    );
  } finally {
    reader.releaseLock();
  }
}

/* ==========================================================
   VALIDATION DES IDENTIFIANTS
========================================================== */

function normalizeEmail(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new LoginError(
      "INVALID_REQUEST",
      400
    );
  }

  const email = value
    .trim()
    .toLowerCase();

  if (
    email.length < 5 ||
    email.length > MAX_EMAIL_LENGTH ||
    !EMAIL_REGEX.test(email)
  ) {
    throw new LoginError(
      "INVALID_REQUEST",
      400
    );
  }

  return email;
}

function normalizePassword(
  value: unknown
): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_PASSWORD_LENGTH ||
    value.includes("\0")
  ) {
    throw new LoginError(
      "INVALID_REQUEST",
      400
    );
  }

  /*
   * Ne jamais utiliser trim() ici :
   * les espaces peuvent faire partie
   * du mot de passe enregistré.
   */

  return value;
}

/* ==========================================================
   COMPATIBILITÉ MOTS DE PASSE

   - Argon2id : nouvelle configuration
   - bcrypt : anciens comptes éventuels

   Les mots de passe ne sont jamais
   stockés en clair.
========================================================== */

function isArgonHash(
  hash: string
): boolean {
  return hash.startsWith("$argon2");
}

function isBcryptHash(
  hash: string
): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(hash);
}

/*
 * Hash de référence pour éviter
 * qu'un compte inexistant ne puisse
 * être reconnu par une réponse
 * instantanée.
 */

let dummyHashPromise:
  Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise =
      argon2.hash(
        randomBytes(32).toString("hex"),
        {
          type: argon2.argon2id,
          memoryCost: 19456,
          timeCost: 2,
          parallelism: 1,
        }
      ).catch((error: unknown) => {
        dummyHashPromise = null;
        throw error;
      });
  }

  return dummyHashPromise;
}

async function verifyPassword(
  storedHash: string | null,
  submittedPassword: string
): Promise<boolean> {
  if (!storedHash) {
    const dummy = await getDummyHash();

    await argon2.verify(
      dummy,
      submittedPassword
    );

    return false;
  }

  try {
    if (storedHash.startsWith("scrypt:v1:")) {
      const parts = storedHash.split(":");
      if (parts.length !== 7 || !["16384", "32768"].includes(parts[2]) || parts[3] !== "8" || parts[4] !== "1" || !/^[a-f0-9]{64}$/i.test(parts[5]) || !/^[a-f0-9]{128}$/i.test(parts[6])) return false;
      const derived = await new Promise<Buffer>((resolve, reject) => scrypt(submittedPassword, Buffer.from(parts[5], "hex"), 64, { N: Number(parts[2]), r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, result) => error ? reject(error) : resolve(result)));
      return timingSafeEqual(derived, Buffer.from(parts[6], "hex"));
    }
    if (isArgonHash(storedHash)) {
      return await argon2.verify(
        storedHash,
        submittedPassword
      );
    }

    if (isBcryptHash(storedHash)) {
      return await bcrypt.compare(
        submittedPassword,
        storedHash
      );
    }
  } catch {
    return false;
  }

  const dummy = await getDummyHash();

  await argon2.verify(
    dummy,
    submittedPassword
  );

  return false;
}

/* ==========================================================
   PROTECTION CONTRE LES TENTATIVES

   AppSetting :
   organizer_login_rate:<HMAC(email)>

   Maximum :
   8 tentatives dans 15 minutes.

   Le HMAC empêche de stocker
   directement l'email dans la clé.
========================================================== */

function getRateSecret(): string {
  const secret =
    process.env.TIKEMIA_LOGIN_RATE_SECRET ??
    process.env.TIKEMIA_PASSWORD_RESET_SECRET;

  if (
    !secret ||
    secret.length < 32
  ) {
    throw new Error(
      "LOGIN_RATE_SECRET_MISSING"
    );
  }

  return secret;
}

function rateKey(
  email: string
): string {
  const digest =
    createHmac(
      "sha256",
      getRateSecret()
    )
      .update(email, "utf8")
      .digest("hex");

  return `${RATE_PREFIX}${digest}`;
}

function parseRate(
  value: unknown
): RateState | null {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const row =
    value as JsonObject;

  if (
    row.version !== 1 ||
    typeof row.attempts !== "number" ||
    !Number.isSafeInteger(row.attempts) ||
    typeof row.windowStartedAt !== "string"
  ) {
    return null;
  }

  return {
    version: 1,
    attempts: Math.max(
      0,
      row.attempts
    ),
    windowStartedAt:
      row.windowStartedAt,
    blockedUntil:
      typeof row.blockedUntil === "string"
        ? row.blockedUntil
        : null,
  };
}

function asRateJson(
  state: RateState
): Prisma.InputJsonValue {
  return {
    version: state.version,
    attempts: state.attempts,
    windowStartedAt:
      state.windowStartedAt,
    blockedUntil:
      state.blockedUntil,
  };
}

/* ==========================================================
   VERROUILLAGE POSTGRESQL

   Protège le compteur contre les
   demandes simultanées.
========================================================== */

async function lockRate(
  tx: Prisma.TransactionClient,
  key: string
): Promise<void> {
  await tx.$queryRaw`
    SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${key}))) AS authentication_lock
  `;
}

/* ==========================================================
   RÉSERVATION D'UNE TENTATIVE

   La tentative est comptabilisée AVANT
   la vérification du mot de passe.

   Ainsi, les requêtes simultanées ne
   peuvent pas contourner la limite.
========================================================== */

async function reserveAttempt(
  prisma: PrismaClient,
  email: string
): Promise<boolean> {
  const key =
    rateKey(email);

  return prisma.$transaction(
    async (tx) => {
      await lockRate(
        tx,
        key
      );

      const existing =
        await tx.appSetting.findUnique({
          where: { key },
          select: {
            value: true,
          },
        });

      const previous =
        parseRate(existing?.value);

      const now =
        Date.now();

      if (
        previous?.blockedUntil &&
        now <
          Date.parse(
            previous.blockedUntil
          )
      ) {
        return false;
      }

      const inWindow =
        previous !== null &&
        Number.isFinite(
          Date.parse(
            previous.windowStartedAt
          )
        ) &&
        now -
          Date.parse(
            previous.windowStartedAt
          ) <
          RATE_WINDOW_MS;

      const attempts =
        inWindow
          ? previous!.attempts + 1
          : 1;

      if (
        attempts >
        MAX_LOGIN_ATTEMPTS
      ) {
        return false;
      }

      const next: RateState = {
        version: 1,
        attempts,
        windowStartedAt:
          inWindow
            ? previous!.windowStartedAt
            : new Date(now).toISOString(),
        blockedUntil:
          attempts >= MAX_LOGIN_ATTEMPTS
            ? new Date(
                now + RATE_WINDOW_MS
              ).toISOString()
            : null,
      };

      await tx.appSetting.upsert({
        where: { key },
        create: {
          key,
          value: asRateJson(next),
        },
        update: {
          value: asRateJson(next),
        },
      });

      return true;
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
      timeout: 10000,
    }
  );
}

/* ==========================================================
   RÉINITIALISATION DU COMPTEUR

   Uniquement après une connexion
   parfaitement authentifiée.
========================================================== */

async function clearAttempts(
  tx: Prisma.TransactionClient,
  email: string
): Promise<void> {
  const key = rateKey(email);

  await lockRate(
    tx,
    key
  );

  await tx.appSetting.deleteMany({
    where: { key },
  });
}

/* ==========================================================
   RECHERCHE DU COMPTE

   Aucun hash ni donnée sensible
   n'est retourné au navigateur.
========================================================== */

async function findAccount(
  prisma: PrismaClient,
  email: string
): Promise<LoginAccount | null> {
  return prisma.user.findUnique({
    where: { email },

    select: {
      id: true,
      fullName: true,
      email: true,
      passwordHash: true,
      emailVerifiedAt: true,
      isActive: true,
      isBlocked: true,
      preferredLocale: true,

      roles: {
        where: {
          role: "ORGANIZER",
        },
        select: {
          id: true,
        },
        take: 1,
      },

      ownedOrganizations: {
        where: {
          isActive: true,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          createdAt: "asc",
        },
        take: 1,
      },
    },
  });
}

/* ==========================================================
   AUTHENTIFICATION COMPLÈTE
========================================================== */

function accountIsAllowed(
  account: LoginAccount | null
): account is LoginAccount {
  return (
    account !== null &&
    account.isActive &&
    !account.isBlocked &&
    account.emailVerifiedAt !== null &&
    account.roles.length > 0 &&
    account.ownedOrganizations.length > 0
  );
}

/* ==========================================================
   CRÉATION DE SESSION

   Token :
   32 octets aléatoires cryptographiques.

   Base PostgreSQL :
   SHA-256 du token uniquement.

   Cookie :
   tikemia_organizer_session
========================================================== */

async function createSession(
  prisma: PrismaClient,
  account: LoginAccount,
  email: string,
  rememberMe: boolean,
  request: NextRequest
): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const duration =
    rememberMe
      ? REMEMBER_SESSION_DURATION_MS
      : SESSION_DURATION_MS;

  const token =
    randomBytes(32).toString("hex");

  const tokenHash =
    createHash("sha256")
      .update(token, "utf8")
      .digest("hex");

  const expiresAt = new Date(
    Date.now() + duration
  );

  const userAgent =
    request.headers
      .get("user-agent")
      ?.slice(0, 500) ?? null;

  /*
   * Pas de lecture naïve de
   * X-Forwarded-For : cette valeur doit
   * être fournie par un proxy de confiance
   * avant utilisation en sécurité.
   */

  await prisma.$transaction(
    async (tx) => {
      const current =
        await tx.user.findUnique({
          where: {
            id: account.id,
          },
          select: {
            isActive: true,
            isBlocked: true,
            emailVerifiedAt: true,
            passwordHash: true,
            roles: {
              where: {
                role: "ORGANIZER",
              },
              select: { id: true },
              take: 1,
            },
          },
        });

      /*
       * Un changement de mot de passe
       * entre la vérification et la création
       * de session invalide cette connexion.
       */

      if (
        !current ||
        !current.isActive ||
        current.isBlocked ||
        !current.emailVerifiedAt ||
        current.roles.length === 0 ||
        current.passwordHash !== account.passwordHash
      ) {
        throw new LoginError(
          "INVALID_CREDENTIALS",
          401
        );
      }

      await tx.session.create({
        data: {
          userId: account.id,
          tokenHash,
          expiresAt,
          revokedAt: null,
          userAgent,
        },
      });

      await clearAttempts(
        tx,
        email
      );

      await tx.securityEvent.create({
        data: {
          userId: account.id,
          type: "ORGANIZER_LOGIN_SUCCESS",
          userAgent,
          metadata: {
            method: "PASSWORD",
            rememberMe,
          },
        },
      });
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
      timeout: 15000,
    }
  );

  return {
    token,
    expiresAt,
  };
}

/* ==========================================================
   POST — CONNEXION

   Entrée JSON :

   {
     "email": "organisateur@example.com",
     "password": "mot-de-passe",
     "rememberMe": false
   }

   Réponse :
   {
     success: true,
     redirectTo: "/organizer/dashboard",
     user: {...},
     organization: {...}
   }
========================================================== */

export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  const locale =
    getLocale(request);

  try {
    validateOrigin(
      request
    );

    const body =
      await readBody(request);

    const email =
      normalizeEmail(body.email);

    const password =
      normalizePassword(body.password);

    const rememberMe =
      body.rememberMe === true;

    const prisma =
      getPrisma();

    /* ------------------------------------------------------
       1. Limiter les tentatives
    ------------------------------------------------------ */

    const allowed =
      await reserveAttempt(
        prisma,
        email
      );

    if (!allowed) {
      throw new LoginError(
        "TOO_MANY_ATTEMPTS",
        429
      );
    }

    /* ------------------------------------------------------
       2. Lire le compte
    ------------------------------------------------------ */

    const account =
      await findAccount(
        prisma,
        email
      );

    /* ------------------------------------------------------
       3. Vérifier le mot de passe

       Toujours effectuer une vérification
       même pour un email inconnu.
    ------------------------------------------------------ */

    const validPassword =
      await verifyPassword(
        account?.passwordHash ?? null,
        password
      );

    /* ------------------------------------------------------
       4. Vérifier les permissions

       Même message d'erreur pour :
       - Email inexistant
       - Mot de passe incorrect
       - Compte désactivé
       - Email non vérifié
       - Rôle non autorisé

       Cela limite la divulgation
       d'informations sur les comptes.
    ------------------------------------------------------ */

    if (
      !validPassword ||
      !accountIsAllowed(account)
    ) {
      throw new LoginError(
        "INVALID_CREDENTIALS",
        401
      );
    }

    /* ------------------------------------------------------
       5. Créer la session
    ------------------------------------------------------ */

    const session =
      await createSession(
        prisma,
        account,
        email,
        rememberMe,
        request
      );

    const organization =
      account.ownedOrganizations[0];

    /* ------------------------------------------------------
       6. Réponse
    ------------------------------------------------------ */

    const response =
      jsonResponse({
        success: true,

        message:
          MESSAGES[locale].success,

        redirectTo:
          "/organizer/dashboard",

        user: {
          id: account.id,
          fullName:
            account.fullName,
          email:
            account.email,
          preferredLocale:
            account.preferredLocale,
          role: "ORGANIZER",
        },

        organization: {
          id: organization.id,
          name: organization.name,
        },

        expiresAt:
          session.expiresAt.toISOString(),
      });

    /* ------------------------------------------------------
       7. Cookie sécurisé

       HttpOnly :
       JavaScript navigateur ne peut
       pas lire le token.

       Secure :
       HTTPS en production.

       SameSite :
       Protection supplémentaire CSRF.
    ------------------------------------------------------ */

    response.cookies.set(
      SESSION_COOKIE,
      session.token,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/",
        expires:
          session.expiresAt,
        priority: "high",
      }
    );

    return response;
  } catch (error) {
    if (error instanceof LoginError) {
      return errorResponse(
        error,
        locale
      );
    }

    if (
      error instanceof
      Prisma.PrismaClientKnownRequestError
    ) {
      if (
        error.code === "P2034" ||
        error.code === "P2002"
      ) {
        return errorResponse(
          new LoginError(
            "SERVICE_UNAVAILABLE",
            503
          ),
          locale
        );
      }
    }

    console.error(
      "[TIKEMIA ORGANIZER LOGIN]",
      { name: error instanceof Error ? error.name : "UnknownError", code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null }
    );

    return errorResponse(
      new LoginError(
        "SERVICE_UNAVAILABLE",
        503
      ),
      locale
    );
  }
}
