import { getTrustedRequestOrigin } from "@/lib/tikemia-pay/providers";
import argon2 from "argon2";
import { compare as compareBcrypt } from "bcryptjs";
import { unstable_rethrow } from "next/navigation";

import {
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  PrismaClient,
} from "@/generated/prisma/client";

import {
  parsePhoneNumberFromString,
} from "libphonenumber-js";

/* ==========================================================
   TIKEMIA — CONNEXION PUBLIQUE CLIENT

   FICHIER :
   src/app/api/auth/login/route.ts

   MÉTHODE :
   POST /api/auth/login

   IDENTIFIANTS ACCEPTÉS :
   - Adresse email
   - Numéro international E.164

   DONNÉES :
   {
     "identifier": "client@example.com",
     "password": "MotDePasse123!",
     "rememberMe": false,
     "locale": "fr"
   }

   OU :
   {
     "identifier": "+229XXXXXXXXXX",
     "password": "MotDePasse123!",
     "rememberMe": true,
     "locale": "fr"
   }

   ÉGALEMENT ACCEPTÉS :
   - email
   - phoneE164
   - phone

   SÉCURITÉ :
   - Validation serveur
   - Vérification scrypt
   - Email vérifié obligatoire
   - Compte actif obligatoire
   - Compte non bloqué obligatoire
   - Rôle CLIENT obligatoire
   - Messages d'erreur contrôlés
   - Limitation locale des tentatives
   - Token de session cryptographique
   - Token haché dans PostgreSQL
   - Cookie HttpOnly
   - Secure en production
   - SameSite Lax
   - Aucun mot de passe retourné
   - Aucun token dans le JSON

   SESSION :
   - RememberMe = true : 30 jours
   - RememberMe = false :
     session navigateur, avec
     expiration serveur après 12 h

   REDIRECTION :
   /account

   MODÈLES PRISMA :
   - User
   - UserRole
   - Session

   AUCUN NOUVEAU MODÈLE.
   AUCUN NOUVEAU FICHIER.
========================================================== */

const SESSION_COOKIE = "tikemia_session";

const SESSION_HOURS = 12;
const REMEMBER_DAYS = 30;

const MAX_BODY_BYTES = 4096;
const MAX_PASSWORD_BYTES = 1024;

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;

const MAX_FAILURES = 8;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_LIMITER_ENTRIES = 10000;

const ACCOUNT_URL = "/account";

type Locale = "fr" | "en";

type RequestBody = {
  identifier?: unknown;
  email?: unknown;
  phone?: unknown;
  phoneE164?: unknown;
  password?: unknown;
  rememberMe?: unknown;
  locale?: unknown;
};

type LoginIdentifier =
  | {
      type: "email";
      value: string;
    }
  | {
      type: "phone";
      value: string;
    };

type LoginError =
  | "invalidRequest"
  | "invalidIdentifier"
  | "invalidPassword"
  | "invalidCredentials"
  | "emailNotVerified"
  | "tooManyAttempts"
  | "unavailable";

type FailureRecord = {
  count: number;
  expiresAt: number;
};

/* ==========================================================
   TEXTES FR / EN
========================================================== */

const MESSAGES = {
  fr: {
    invalidRequest:
      "La demande de connexion est invalide.",

    invalidIdentifier:
      "Veuillez saisir une adresse email ou un numéro de téléphone international valide.",

    invalidPassword:
      "Veuillez saisir votre mot de passe.",

    invalidCredentials:
      "Adresse email, numéro de téléphone ou mot de passe incorrect.",

    emailNotVerified:
      "Veuillez vérifier votre adresse email avant de vous connecter.",

    tooManyAttempts:
      "Trop de tentatives de connexion. Veuillez réessayer dans quelques minutes.",

    unavailable:
      "La connexion est temporairement indisponible.",

    success:
      "Connexion réussie.",
  },

  en: {
    invalidRequest:
      "Invalid login request.",

    invalidIdentifier:
      "Enter a valid email address or international phone number.",

    invalidPassword:
      "Please enter your password.",

    invalidCredentials:
      "Incorrect email, phone number or password.",

    emailNotVerified:
      "Please verify your email address before signing in.",

    tooManyAttempts:
      "Too many login attempts. Please try again in a few minutes.",

    unavailable:
      "Sign in is temporarily unavailable.",

    success:
      "Successfully signed in.",
  },
} as const;

/* ==========================================================
   PRISMA 7

   Même configuration utilisée dans
   les API publiques d'inscription.

   Réutilisation du client pour éviter
   une connexion à chaque requête.
========================================================== */

const prismaGlobal = globalThis as typeof globalThis & {
  tikemiaPrisma?: PrismaClient;
};

function getPrisma(): PrismaClient {
  if (prismaGlobal.tikemiaPrisma) {
    return prismaGlobal.tikemiaPrisma;
  }

  const connectionString =
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL_NOT_CONFIGURED"
    );
  }

  const adapter = new PrismaPg({
    connectionString,
  });

  const client = new PrismaClient({
    adapter,
  });

  prismaGlobal.tikemiaPrisma = client;

  return client;
}

/* ==========================================================
   RÉPONSES HTTP
========================================================== */

function respond(
  data: Record<string, unknown>,
  status = 200,
  retryAfter?: number
) {
  const headers: Record<string, string> = {
    "Cache-Control":
      "no-store, no-cache, must-revalidate",
    "X-Content-Type-Options": "nosniff",
  };

  if (
    retryAfter !== undefined &&
    retryAfter > 0
  ) {
    headers["Retry-After"] =
      String(retryAfter);
  }

  return NextResponse.json(data, {
    status,
    headers,
  });
}

function fail(
  locale: Locale,
  code: LoginError,
  status: number,
  retryAfter?: number
) {
  return respond(
    {
      success: false,
      code,
      message: MESSAGES[locale][code],
    },
    status,
    retryAfter
  );
}

/* ==========================================================
   ORIGINE DE LA REQUÊTE
========================================================== */

function validOrigin(
  request: NextRequest
): boolean {
  const fetchSite =
    request.headers.get("sec-fetch-site");

  if (fetchSite === "cross-site") {
    return false;
  }

  const origin =
    request.headers.get("origin");

  if (!origin) {
    return true;
  }

  return origin === getTrustedRequestOrigin(request);
}

/* ==========================================================
   LANGUE
========================================================== */

function resolveLocale(
  value: unknown
): Locale {
  return value === "en" ? "en" : "fr";
}

/* ==========================================================
   NORMALISATION EMAIL
========================================================== */

function normalizeEmail(
  value: string
): string | null {
  const email =
    value.trim().toLowerCase();

  if (
    email.length < 3 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return null;
  }

  return email;
}

/* ==========================================================
   NORMALISATION TÉLÉPHONE

   Le frontend choisit l'indicatif.

   L'API doit recevoir :
   +229...
   +225...
   +33...
   +234...

   Le format E.164 est obligatoire.

   Aucun pays inventé par le backend.
========================================================== */

function normalizePhone(
  value: string
): string | null {
  const phoneText = value.trim();

  if (
    !phoneText.startsWith("+") ||
    phoneText.length > 35
  ) {
    return null;
  }

  try {
    const phone =
      parsePhoneNumberFromString(
        phoneText
      );

    if (
      !phone ||
      !phone.isValid()
    ) {
      return null;
    }

    return phone.number;
  } catch {
    return null;
  }
}

/* ==========================================================
   IDENTIFIANT EMAIL OU TÉLÉPHONE

   Les deux méthodes utilisent le
   même compte utilisateur.

   La page peut envoyer :
   - identifier
   - email
   - phoneE164

   Priorité :
   identifier, puis email,
   puis phoneE164, puis phone.
========================================================== */

function parseIdentifier(
  body: RequestBody
): LoginIdentifier | null {
  const candidate =
    body.identifier ??
    body.email ??
    body.phoneE164 ??
    body.phone;

  if (
    typeof candidate !== "string"
  ) {
    return null;
  }

  const value = candidate.trim();

  if (value.includes("@")) {
    const email =
      normalizeEmail(value);

    return email
      ? {
          type: "email",
          value: email,
        }
      : null;
  }

  const phone =
    normalizePhone(value);

  return phone
    ? {
        type: "phone",
        value: phone,
      }
    : null;
}

/* ==========================================================
   MOT DE PASSE

   Hachage identique à celui utilisé
   dans register/route.ts et
   reset-password/route.ts.

   Format :
   scrypt:v1:N:r:p:salt:hash

   Les paramètres sont validés avant
   de calculer la clé dérivée.
========================================================== */

function deriveKey(
  password: string,
  salt: Buffer
): Promise<Buffer> {
  return new Promise(
    (resolve, reject) => {
      scrypt(
        password,
        salt,
        SCRYPT_KEY_LENGTH,
        {
          N: SCRYPT_N,
          r: SCRYPT_R,
          p: SCRYPT_P,
          maxmem: 64 * 1024 * 1024,
        },
        (error, derivedKey) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(derivedKey);
        }
      );
    }
  );
}

/*
 * Empreinte de repli.
 *
 * En cas d'identifiant inexistant,
 * on effectue quand même un calcul
 * scrypt pour réduire les différences
 * de durée de réponse.
 *
 * Ce hash n'est jamais attribué
 * à un utilisateur.
 */

const DUMMY_SALT = Buffer.alloc(32, 73);
const DUMMY_EXPECTED = Buffer.alloc(
  SCRYPT_KEY_LENGTH,
  47
);

async function dummyPasswordCheck(
  password: string
): Promise<void> {
  const actual = await deriveKey(
    password,
    DUMMY_SALT
  );

  timingSafeEqual(
    actual,
    DUMMY_EXPECTED
  );
}

async function verifyPassword(
  password: string,
  stored: string | null
): Promise<boolean> {
  if (!stored) {
    await dummyPasswordCheck(password);
    return false;
  }

  try {
    if (stored.startsWith("$argon2")) return await argon2.verify(stored, password);
    if (/^\$2[aby]\$\d{2}\$/.test(stored)) return await compareBcrypt(password, stored);
  } catch { return false; }
  const parts = stored.split(":");

  if (
    parts.length !== 7 ||
    parts[0] !== "scrypt" ||
    parts[1] !== "v1"
  ) {
    await dummyPasswordCheck(password);
    return false;
  }

  const n = Number(parts[2]);
  const r = Number(parts[3]);
  const p = Number(parts[4]);

  const saltHex = parts[5];
  const expectedHex = parts[6];

  if (
    n !== SCRYPT_N ||
    r !== SCRYPT_R ||
    p !== SCRYPT_P ||
    !/^[a-f0-9]{64}$/i.test(
      saltHex
    ) ||
    !/^[a-f0-9]{128}$/i.test(
      expectedHex
    )
  ) {
    await dummyPasswordCheck(password);
    return false;
  }

  const salt =
    Buffer.from(saltHex, "hex");

  const expected =
    Buffer.from(expectedHex, "hex");

  const actual =
    await deriveKey(
      password,
      salt
    );

  return timingSafeEqual(
    expected,
    actual
  );
}

/* ==========================================================
   LIMITATION LOCALE DES TENTATIVES

   Protection de base par identifiant.

   - 8 échecs maximum
   - Fenêtre de 15 minutes
   - Clé hachée
   - Aucune adresse email en clair
     dans le stockage temporaire

   IMPORTANT :
   En production multi-instances,
   il faut ajouter une limitation
   distribuée au niveau de l'hébergement
   ou du service de sécurité existant.

   Cette limitation locale ne suffit
   pas seule contre les attaques
   réparties sur plusieurs serveurs.
========================================================== */

const limiterGlobal = globalThis as typeof globalThis & {
  tikemiaLoginFailures?: Map<
    string,
    FailureRecord
  >;
};

const loginFailures =
  limiterGlobal.tikemiaLoginFailures ??
  new Map<string, FailureRecord>();

limiterGlobal.tikemiaLoginFailures =
  loginFailures;

function limiterKey(
  identifier: string
): string {
  return createHash("sha256")
    .update(identifier, "utf8")
    .digest("hex");
}

function cleanupLimiter(): void {
  const now = Date.now();

  for (const [key, record] of loginFailures) {
    if (record.expiresAt <= now) {
      loginFailures.delete(key);
    }
  }

  if (
    loginFailures.size >=
    MAX_LIMITER_ENTRIES
  ) {
    const first =
      loginFailures.keys().next();

    if (!first.done) {
      loginFailures.delete(
        first.value
      );
    }
  }
}

function remainingLockSeconds(
  key: string
): number {
  const record =
    loginFailures.get(key);

  if (!record) {
    return 0;
  }

  if (
    record.expiresAt <=
    Date.now()
  ) {
    loginFailures.delete(key);
    return 0;
  }

  if (
    record.count <
    MAX_FAILURES
  ) {
    return 0;
  }

  return Math.ceil(
    (record.expiresAt - Date.now()) /
      1000
  );
}

function recordFailure(
  key: string
): void {
  cleanupLimiter();

  const now = Date.now();
  const record =
    loginFailures.get(key);

  if (
    !record ||
    record.expiresAt <= now
  ) {
    loginFailures.set(key, {
      count: 1,
      expiresAt:
        now + FAILURE_WINDOW_MS,
    });

    return;
  }

  record.count += 1;
}

function clearFailures(
  key: string
): void {
  loginFailures.delete(key);
}

/* ==========================================================
   SESSION

   Token brut :
   Stocké uniquement dans le cookie.

   Empreinte SHA-256 :
   Enregistrée dans PostgreSQL.

   Les API de l'espace personnel
   doivent vérifier :
   - tokenHash
   - revokedAt = null
   - expiresAt > maintenant
   - User actif et non bloqué

   Aucune session client fictive.
========================================================== */

function createSessionToken() {
  const token =
    randomBytes(32).toString("hex");

  const tokenHash =
    createHash("sha256")
      .update(token, "utf8")
      .digest("hex");

  return {
    token,
    tokenHash,
  };
}

/* ==========================================================
   POST — CONNEXION PUBLIQUE
========================================================== */

export async function POST(
  request: NextRequest
) {
  let locale: Locale = "fr";

  try {
    /* ======================================================
       1. SÉCURITÉ DE LA REQUÊTE
    ====================================================== */

    if (!validOrigin(request)) {
      return fail(
        locale,
        "invalidRequest",
        403
      );
    }

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
      return fail(
        locale,
        "invalidRequest",
        415
      );
    }

    const declaredLength =
      Number(
        request.headers.get(
          "content-length"
        ) ?? "0"
      );

    if (
      Number.isFinite(
        declaredLength
      ) &&
      declaredLength >
        MAX_BODY_BYTES
    ) {
      return fail(
        locale,
        "invalidRequest",
        413
      );
    }

    const rawBody =
      await request.text();

    if (
      Buffer.byteLength(
        rawBody,
        "utf8"
      ) > MAX_BODY_BYTES
    ) {
      return fail(
        locale,
        "invalidRequest",
        413
      );
    }

    /* ======================================================
       2. JSON
    ====================================================== */

    let body: RequestBody;

    try {
      const parsed: unknown =
        JSON.parse(rawBody);

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        return fail(
          locale,
          "invalidRequest",
          400
        );
      }

      body =
        parsed as RequestBody;
    } catch {
      return fail(
        locale,
        "invalidRequest",
        400
      );
    }

    /* ======================================================
       3. LANGUE ET IDENTIFIANTS
    ====================================================== */

    locale =
      resolveLocale(
        body.locale
      );

    const identifier =
      parseIdentifier(body);

    if (!identifier) {
      return fail(
        locale,
        "invalidIdentifier",
        400
      );
    }

    const password =
      body.password;

    if (
      typeof password !== "string" ||
      password.length === 0 ||
      Buffer.byteLength(
        password,
        "utf8"
      ) > MAX_PASSWORD_BYTES
    ) {
      return fail(
        locale,
        "invalidPassword",
        400
      );
    }

    const rememberMe =
      body.rememberMe === true;

    /* ======================================================
       4. LIMITATION DES TENTATIVES
    ====================================================== */

    const key =
      limiterKey(
        `${identifier.type}:${identifier.value}`
      );

    const lockSeconds =
      remainingLockSeconds(key);

    if (lockSeconds > 0) {
      return fail(
        locale,
        "tooManyAttempts",
        429,
        lockSeconds
      );
    }

    const prisma =
      getPrisma();

    /* ======================================================
       5. RECHERCHE UTILISATEUR

       EMAIL :
       unique dans Prisma.

       TÉLÉPHONE :
       phoneE164 n'est pas unique
       dans le schéma actuel.

       On récupère au maximum
       deux correspondances.

       Si plusieurs comptes possèdent
       le même numéro, la connexion
       par téléphone est refusée afin
       d'éviter toute ambiguïté.

       La connexion par email
       reste possible.
    ====================================================== */

    let user:
      | {
          id: string;
          email: string;
          passwordHash: string | null;
          isActive: boolean;
          isBlocked: boolean;
          emailVerifiedAt: Date | null;
          roles: {
            role: import("@/generated/prisma/client").RoleType;
          }[];
        }
      | null = null;

    if (
      identifier.type === "email"
    ) {
      user =
        await prisma.user.findUnique({
          where: {
            email:
              identifier.value,
          },

          select: {
            id: true,
            email: true,
            passwordHash: true,
            isActive: true,
            isBlocked: true,
            emailVerifiedAt: true,

            roles: {
              where: {
                role: "CLIENT",
              },
              select: {
                role: true,
              },
            },
          },
        });
    } else {
      const matches =
        await prisma.user.findMany({
          where: {
            phoneE164:
              identifier.value,
          },

          take: 2,

          select: {
            id: true,
            email: true,
            passwordHash: true,
            isActive: true,
            isBlocked: true,
            emailVerifiedAt: true,

            roles: {
              where: {
                role: "CLIENT",
              },
              select: {
                role: true,
              },
            },
          },
        });

      user =
        matches.length === 1
          ? matches[0]
          : null;
    }

    /* ======================================================
       6. VÉRIFICATION MOT DE PASSE

       Toujours effectuer le calcul
       cryptographique, même lorsqu'un
       utilisateur est introuvable.

       Cela réduit les différences
       temporelles de réponse.
    ====================================================== */

    const passwordValid =
      await verifyPassword(
        password,
        user?.passwordHash ?? null
      );

    if (
      !user ||
      !passwordValid
    ) {
      recordFailure(key);

      return fail(
        locale,
        "invalidCredentials",
        401
      );
    }

    /* ======================================================
       7. CONTRÔLE DU COMPTE

       Le compte doit :
       - Être actif
       - Ne pas être bloqué
       - Posséder le rôle CLIENT

       Les organisateurs et
       administrateurs utilisent
       leurs espaces dédiés.

       Les comptes multi-rôles restent
       autorisés s'ils possèdent
       également le rôle CLIENT.
    ====================================================== */

    if (
      !user.isActive ||
      user.isBlocked ||
      user.roles.length === 0
    ) {
      recordFailure(key);

      return fail(
        locale,
        "invalidCredentials",
        401
      );
    }

    /* ======================================================
       8. EMAIL VÉRIFIÉ

       Pas de session pour un compte
       dont l'email n'a pas été validé.

       Le contrôle intervient après
       validation du mot de passe.

       Il ne révèle donc pas l'état
       d'un compte à un visiteur ne
       connaissant pas le mot de passe.
    ====================================================== */

    if (!user.emailVerifiedAt) {
      return fail(
        locale,
        "emailNotVerified",
        403
      );
    }

    /* ======================================================
       9. PRÉPARATION DE LA SESSION

       Se souvenir de moi :
       - 30 jours

       Sans option :
       - 12 heures côté serveur
       - Cookie de session navigateur

       Les deux formats utilisent
       le même modèle Session.
    ====================================================== */

    const durationMs =
      rememberMe
        ? REMEMBER_DAYS *
          24 *
          60 *
          60 *
          1000
        : SESSION_HOURS *
          60 *
          60 *
          1000;

    const expiresAt = new Date(
      Date.now() + durationMs
    );

    const sessionToken =
      createSessionToken();

    /* ======================================================
       10. CRÉATION DE SESSION

       Seule l'empreinte du token
       est enregistrée dans Prisma.

       Aucun mot de passe
       enregistré dans la session.

       Le cookie sera ajouté à la
       réponse après la création.
    ====================================================== */

    await prisma.session.create({
      data: {
        userId: user.id,

        tokenHash:
          sessionToken.tokenHash,

        expiresAt,

        revokedAt: null,

        userAgent:
          request.headers
            .get("user-agent")
            ?.slice(0, 512) ??
          null,
      },
    });

    /* ======================================================
       11. RÉINITIALISER LES ÉCHECS

       Uniquement après
       authentification réussie.
    ====================================================== */

    clearFailures(key);

    /* ======================================================
       12. RÉPONSE PUBLIQUE

       Le token de session n'est
       pas présent dans le JSON.

       La page PC ou mobile pourra
       rediriger vers l'espace compte.
    ====================================================== */

    const response = respond(
      {
        success: true,

        authenticated: true,

        message:
          MESSAGES[locale].success,

        redirectTo:
          ACCOUNT_URL,

        user: {
          id: user.id,
          email: user.email,
        },
      },
      200
    );

    /* ======================================================
       13. COOKIE HTTPONLY

       RememberMe = true :
       cookie persistant 30 jours.

       RememberMe = false :
       cookie de session du navigateur.

       Le cookie ne peut pas être
       lu directement par JavaScript.
    ====================================================== */

    response.cookies.set({
      name:
        SESSION_COOKIE,

      value:
        sessionToken.token,

      httpOnly: true,

      secure:
        process.env.NODE_ENV ===
        "production",

      sameSite: "lax",

      path: "/",

      ...(rememberMe
        ? {
            maxAge:
              Math.floor(
                durationMs / 1000
              ),
          }
        : {}),
    });

    return response;
  } catch (error) {
    unstable_rethrow(error);
    /* ======================================================
       14. ERREUR SERVEUR

       Ne jamais exposer :
       - DATABASE_URL
       - PasswordHash
       - Token de session
       - Secret d'authentification
       - Stack interne Prisma
    ====================================================== */

    console.error(
      "[TIKEMIA_PUBLIC_LOGIN_ERROR]",
      error instanceof Error
        ? error.name
        : "UNKNOWN_ERROR"
    );

    return fail(
      locale,
      "unavailable",
      503
    );
  }
}

/* ==========================================================
   FIN

   AUCUNE MÉTHODE GET.

   LA CONNEXION SE FAIT UNIQUEMENT
   PAR UNE REQUÊTE POST.

   LE CLIENT ACCÈDE ENSUITE À :
   /account
========================================================== */
