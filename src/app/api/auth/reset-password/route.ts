import { getTrustedRequestOrigin } from "@/lib/tikemia-pay/providers";
import { unstable_rethrow } from "next/navigation";

import {
  createHmac,
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

/* ==========================================================
   TIKEMIA — RÉINITIALISATION DU MOT DE PASSE

   FICHIER :
   src/app/api/auth/reset-password/route.ts

   ROUTE :
   POST /api/auth/reset-password

   ENTRÉE :
   {
     "email": "client@example.com",
     "code": "123456",
     "newPassword": "NouveauMotDePasse123!",
     "confirmPassword": "NouveauMotDePasse123!",
     "locale": "fr"
   }

   FONCTIONNEMENT :
   - Vérifier l'adresse email
   - Vérifier le code à six chiffres
   - Vérifier sa date d'expiration
   - Limiter les tentatives
   - Contrôler le nouveau mot de passe
   - Hacher avec scrypt
   - Modifier le mot de passe
   - Consommer le code
   - Révoquer les anciennes sessions
   - Rediriger vers /login

   SÉCURITÉ :
   - Aucun mot de passe en clair stocké
   - Aucun code OTP en clair stocké
   - Code à usage unique
   - Transaction PostgreSQL atomique
   - Verrouillage du code en base
   - Pas de connexion automatique
   - Aucune session créée
   - Aucune modification de Prisma

   MODÈLES EXISTANTS :
   - User
   - UserEmailVerification
   - Session

   IMPORTANT :
   Les codes de réinitialisation utilisent
   un domaine HMAC différent des codes
   de validation d'inscription.
========================================================== */

/* ==========================================================
   CONFIGURATION
========================================================== */

const MAX_BODY_BYTES = 8192;

const MAX_ATTEMPTS = 5;

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_BYTES = 1024;

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;

const RESET_HMAC_CONTEXT =
  "tikemia:password-reset:v1";

const LOGIN_URL = "/login";

type Locale = "fr" | "en";

type RequestBody = {
  email?: unknown;
  code?: unknown;
  newPassword?: unknown;
  confirmPassword?: unknown;
  locale?: unknown;
};

type ErrorCode =
  | "invalidRequest"
  | "invalidEmail"
  | "invalidCode"
  | "invalidVerification"
  | "tooManyAttempts"
  | "weakPassword"
  | "passwordMismatch"
  | "serviceUnavailable";

type ResetResult =
  | {
      status: "success";
    }
  | {
      status: "invalid";
    }
  | {
      status: "locked";
    };

/* ==========================================================
   TRADUCTIONS
========================================================== */

const MESSAGES = {
  fr: {
    invalidRequest:
      "La demande de réinitialisation est invalide.",

    invalidEmail:
      "Veuillez saisir une adresse email valide.",

    invalidCode:
      "Le code doit contenir exactement six chiffres.",

    invalidVerification:
      "Le code est incorrect, expiré ou déjà utilisé.",

    tooManyAttempts:
      "Trop de tentatives. Demandez un nouveau code.",

    weakPassword:
      "Le nouveau mot de passe doit contenir au moins 12 caractères.",

    passwordMismatch:
      "Les deux mots de passe ne correspondent pas.",

    serviceUnavailable:
      "La réinitialisation est temporairement indisponible.",

    success:
      "Votre mot de passe a été modifié avec succès. Vous pouvez maintenant vous connecter.",
  },

  en: {
    invalidRequest:
      "Invalid password reset request.",

    invalidEmail:
      "Please enter a valid email address.",

    invalidCode:
      "The code must contain exactly six digits.",

    invalidVerification:
      "The code is incorrect, expired or already used.",

    tooManyAttempts:
      "Too many attempts. Request a new code.",

    weakPassword:
      "Your new password must contain at least 12 characters.",

    passwordMismatch:
      "The passwords do not match.",

    serviceUnavailable:
      "Password reset is temporarily unavailable.",

    success:
      "Your password has been changed successfully. You can now sign in.",
  },
} as const;

/* ==========================================================
   PRISMA 7

   Réutilisation du client Prisma
   dans l'environnement Next.js.

   Aucune nouvelle connexion
   n'est créée pour chaque requête.
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
  status = 200
) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function failure(
  locale: Locale,
  code: ErrorCode,
  status: number
) {
  return respond(
    {
      success: false,
      code,
      message: MESSAGES[locale][code],
    },
    status
  );
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
   PROTECTION DE L'ORIGINE
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
   NORMALISATION EMAIL
========================================================== */

function normalizeEmail(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

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
   VALIDATION CODE OTP
========================================================== */

function normalizeCode(
  value: unknown
): string | null {
  if (
    typeof value !== "string" ||
    !/^\d{6}$/.test(value)
  ) {
    return null;
  }

  return value;
}

/* ==========================================================
   VALIDATION MOT DE PASSE

   Même exigence que l'inscription :
   12 caractères minimum.

   La limite en octets protège
   les opérations de dérivation de clé.
========================================================== */

function validPassword(
  value: unknown
): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const characterCount =
    Array.from(value).length;

  const byteCount =
    Buffer.byteLength(value, "utf8");

  return (
    characterCount >= MIN_PASSWORD_LENGTH &&
    byteCount <= MAX_PASSWORD_BYTES
  );
}

/* ==========================================================
   HACHAGE SCRYPT

   COMPATIBLE AVEC L'API D'INSCRIPTION.

   Format :
   scrypt:v1:N:r:p:salt:hash

   On utilise :
   - Un sel aléatoire de 32 octets
   - Une clé dérivée de 64 octets
   - Les mêmes paramètres scrypt
     que dans register/route.ts

   Aucun mot de passe stocké en clair.
========================================================== */

function derivePasswordKey(
  password: string,
  salt: Buffer
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
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
  });
}

async function hashPassword(
  password: string
): Promise<string> {
  const salt =
    randomBytes(32);

  const derived =
    await derivePasswordKey(
      password,
      salt
    );

  return [
    "scrypt",
    "v1",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("hex"),
    derived.toString("hex"),
  ].join(":");
}

/* ==========================================================
   HASH DU CODE DE RÉINITIALISATION

   IMPORTANT :
   Cette méthode doit être identique
   dans forgot-password/route.ts.

   Elle utilise :
   TIKEMIA_OTP_SECRET

   Le préfixe "password-reset" empêche
   d'utiliser un code de vérification
   d'inscription pour modifier
   un mot de passe.

   Une clé secrète forte est obligatoire.
========================================================== */

function hashResetCode(
  userId: string,
  email: string,
  code: string
): string {
  const secret =
    process.env.TIKEMIA_OTP_SECRET;

  if (
    !secret ||
    secret.length < 32
  ) {
    throw new Error(
      "TIKEMIA_OTP_SECRET_NOT_CONFIGURED"
    );
  }

  return createHmac("sha256", secret)
    .update(RESET_HMAC_CONTEXT)
    .update("\0")
    .update(userId)
    .update("\0")
    .update(email)
    .update("\0")
    .update(code)
    .digest("hex");
}

/* ==========================================================
   COMPARAISON DES HASHES

   Utilise timingSafeEqual pour réduire
   les fuites liées au temps de comparaison.
========================================================== */

function compareHashes(
  storedHash: string,
  receivedHash: string
): boolean {
  if (
    !/^[a-f0-9]{64}$/i.test(storedHash) ||
    !/^[a-f0-9]{64}$/i.test(receivedHash)
  ) {
    return false;
  }

  const stored =
    Buffer.from(storedHash, "hex");

  const received =
    Buffer.from(receivedHash, "hex");

  return timingSafeEqual(
    stored,
    received
  );
}

/* ==========================================================
   POST /api/auth/reset-password
========================================================== */

export async function POST(
  request: NextRequest
) {
  let locale: Locale = "fr";

  try {
    /* ======================================================
       1. CONTRÔLER L'ORIGINE
    ====================================================== */

    if (!validOrigin(request)) {
      return failure(
        locale,
        "invalidRequest",
        403
      );
    }

    /* ======================================================
       2. TYPE DE CONTENU
    ====================================================== */

    const contentType =
      request.headers.get("content-type") ?? "";

    if (
      !contentType
        .toLowerCase()
        .startsWith("application/json")
    ) {
      return failure(
        locale,
        "invalidRequest",
        415
      );
    }

    /* ======================================================
       3. TAILLE DU CORPS JSON
    ====================================================== */

    const declaredLength =
      Number(
        request.headers.get("content-length") ?? "0"
      );

    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_BODY_BYTES
    ) {
      return failure(
        locale,
        "invalidRequest",
        413
      );
    }

    const rawBody =
      await request.text();

    if (
      Buffer.byteLength(rawBody, "utf8") >
      MAX_BODY_BYTES
    ) {
      return failure(
        locale,
        "invalidRequest",
        413
      );
    }

    /* ======================================================
       4. LECTURE JSON
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
        return failure(
          locale,
          "invalidRequest",
          400
        );
      }

      body = parsed as RequestBody;
    } catch {
      return failure(
        locale,
        "invalidRequest",
        400
      );
    }

    /* ======================================================
       5. VALIDATION DES DONNÉES
    ====================================================== */

    locale =
      resolveLocale(body.locale);

    const email =
      normalizeEmail(body.email);

    const code =
      normalizeCode(body.code);

    if (!email) {
      return failure(
        locale,
        "invalidEmail",
        400
      );
    }

    if (!code) {
      return failure(
        locale,
        "invalidCode",
        400
      );
    }

    const newPassword =
      body.newPassword;

    const confirmPassword =
      body.confirmPassword;

    if (!validPassword(newPassword)) {
      return failure(
        locale,
        "weakPassword",
        400
      );
    }

    if (
      typeof confirmPassword !== "string" ||
      newPassword !== confirmPassword
    ) {
      return failure(
        locale,
        "passwordMismatch",
        400
      );
    }

    /* ======================================================
       6. VÉRIFIER LA CONFIGURATION

       Le même secret doit être utilisé
       par forgot-password/route.ts.
    ====================================================== */

    if (
      !process.env.TIKEMIA_OTP_SECRET ||
      process.env.TIKEMIA_OTP_SECRET.length < 32
    ) {
      throw new Error(
        "TIKEMIA_OTP_SECRET_NOT_CONFIGURED"
      );
    }

    const prisma =
      getPrisma();

    /* ======================================================
       7. RECHERCHER L'UTILISATEUR

       Uniquement les comptes :
       - Actifs
       - Non bloqués
       - Email déjà vérifié

       Une réponse générique évite
       de révéler les comptes existants.
    ====================================================== */

    const user =
      await prisma.user.findUnique({
        where: {
          email,
          roles: { some: { role: "CLIENT" } },
        },

        select: {
          id: true,
          email: true,
          isActive: true,
          isBlocked: true,
          emailVerifiedAt: true,
        },
      });

    if (
      !user ||
      !user.isActive ||
      user.isBlocked ||
      !user.emailVerifiedAt
    ) {
      return failure(
        locale,
        "invalidVerification",
        400
      );
    }

    /* ======================================================
       8. RECHERCHER LE DERNIER CODE

       Le schéma existant
       UserEmailVerification est réutilisé.

       Le code doit :
       - Appartenir au bon utilisateur
       - Correspondre à son email
       - Ne pas être consommé
       - Ne pas être expiré

       Le dernier code émis prévaut.
    ====================================================== */

    const verification =
      await prisma.userEmailVerification.findFirst({
        where: {
          userId: user.id,
          email,
        },

        orderBy: [
          {
            createdAt: "desc",
          },
          {
            id: "desc",
          },
        ],

        select: {
          id: true,
        },
      });

    if (!verification) {
      return failure(
        locale,
        "invalidVerification",
        400
      );
    }

    /* ======================================================
       9. PRÉPARER LE HASH DU CODE

       Le code à six chiffres est
       transformé en HMAC côté serveur.

       Aucune valeur OTP n'est
       enregistrée ou journalisée.
    ====================================================== */

    const receivedHash =
      hashResetCode(
        user.id,
        email,
        code
      );

    /* ======================================================
       10. PRÉPARER LE NOUVEAU MOT DE PASSE

       Le hachage est effectué avant
       la transaction pour réduire
       la durée du verrou PostgreSQL.
    ====================================================== */

    const newPasswordHash =
      await hashPassword(
        newPassword
      );

    /* ======================================================
       11. TRANSACTION ATOMIQUE

       Opérations :
       - Verrouiller la vérification
       - Contrôler le code
       - Compter les tentatives
       - Modifier le mot de passe
       - Consommer le code
       - Invalider les autres codes
       - Révoquer les anciennes sessions

       Toutes les modifications critiques
       sont réalisées en transaction.
    ====================================================== */

    const result =
      await prisma.$transaction<ResetResult>(
        async (tx) => {
          const now = new Date();

          /* ==============================================
             VERROUILLAGE DE LA LIGNE OTP

             Empêche deux validations
             simultanées du même code.

             Le modèle possède des UUID.
          ============================================== */

          await tx.$queryRaw`
            SELECT "id"
            FROM "UserEmailVerification"
            WHERE "id" = ${verification.id}::uuid
            FOR UPDATE
          `;

          /* ==============================================
             RELECTURE DU CODE
          ============================================== */

          const stored =
            await tx.userEmailVerification.findUnique({
              where: {
                id: verification.id,
              },

              select: {
                id: true,
                userId: true,
                email: true,
                codeHash: true,
                attempts: true,
                expiresAt: true,
                consumedAt: true,
              },
            });

          if (
            !stored ||
            stored.userId !== user.id ||
            stored.email !== email ||
            stored.consumedAt !== null ||
            stored.expiresAt <= now
          ) {
            return {
              status: "invalid",
            };
          }

          /* ==============================================
             LIMITATION À CINQ TENTATIVES
          ============================================== */

          if (
            stored.attempts >=
            MAX_ATTEMPTS
          ) {
            return {
              status: "locked",
            };
          }

          /* ==============================================
             COMPARAISON DU CODE
          ============================================== */

          const codeIsValid =
            compareHashes(
              stored.codeHash,
              receivedHash
            );

          if (!codeIsValid) {
            await tx.userEmailVerification.update({
              where: {
                id: stored.id,
              },

              data: {
                attempts: {
                  increment: 1,
                },
              },
            });

            return {
              status:
                stored.attempts + 1 >= MAX_ATTEMPTS
                  ? "locked"
                  : "invalid",
            };
          }

          /* ==============================================
             MODIFIER LE MOT DE PASSE

             Seulement si le compte
             est toujours autorisé.
          ============================================== */

          const passwordUpdated =
            await tx.user.updateMany({
              where: {
                id: user.id,
                email,
                isActive: true,
                isBlocked: false,
                emailVerifiedAt: {
                  not: null,
                },
              },

              data: {
                passwordHash:
                  newPasswordHash,
              },
            });

          if (
            passwordUpdated.count !== 1
          ) {
            return {
              status: "invalid",
            };
          }

          /* ==============================================
             CONSOMMER LE CODE

             Le code devient inutilisable
             après la réinitialisation.
          ============================================== */

          const consumed =
            await tx.userEmailVerification.updateMany({
              where: {
                id: stored.id,
                consumedAt: null,
                expiresAt: {
                  gt: now,
                },
              },

              data: {
                consumedAt: now,
              },
            });

          if (consumed.count !== 1) {
            throw new Error(
              "PASSWORD_RESET_CODE_CONSUMPTION_FAILED"
            );
          }

          /* ==============================================
             INVALIDER LES AUTRES CODES

             Les anciens codes de
             vérification du compte
             deviennent inutilisables.
          ============================================== */

          await tx.userEmailVerification.updateMany({
            where: {
              userId: user.id,
              consumedAt: null,
            },

            data: {
              consumedAt: now,
            },
          });

          /* ==============================================
             RÉVOQUER LES SESSIONS

             Après un changement de
             mot de passe, les sessions
             précédentes sont invalidées.

             L'utilisateur devra
             se reconnecter.
          ============================================== */

          await tx.session.updateMany({
            where: {
              userId: user.id,
              revokedAt: null,
            },

            data: {
              revokedAt: now,
            },
          });

          return {
            status: "success",
          };
        },
        {
          maxWait: 5000,
          timeout: 15000,
        }
      );

    /* ======================================================
       12. TRAITER LES RÉSULTATS
    ====================================================== */

    if (result.status === "locked") {
      return failure(
        locale,
        "tooManyAttempts",
        429
      );
    }

    if (result.status !== "success") {
      return failure(
        locale,
        "invalidVerification",
        400
      );
    }

    /* ======================================================
       13. SUCCÈS

       Aucun token de session créé.

       Le client revient sur /login
       et utilise son nouveau mot
       de passe pour se connecter.
    ====================================================== */

    const response =
      respond(
        {
          success: true,

          passwordReset: true,

          message:
            MESSAGES[locale].success,

          redirectTo: LOGIN_URL,
        },
        200
      );

    /*
     * Supprime le cookie public actuel
     * si une session était présente.

     * Les sessions en base ont déjà
     * été révoquées par la transaction.
     */

    response.cookies.delete(
      "tikemia_session"
    );

    return response;
  } catch (error) {
    unstable_rethrow(error);
    /* ======================================================
       14. GESTION DES ERREURS

       Aucune information interne
       du serveur n'est transmise
       au visiteur.

       Aucun mot de passe ni code
       n'est écrit dans les journaux.
    ====================================================== */

    console.error(
      "[TIKEMIA_PUBLIC_RESET_PASSWORD_ERROR]",
      error instanceof Error
        ? error.message
        : "UNKNOWN_ERROR"
    );

    return failure(
      locale,
      "serviceUnavailable",
      503
    );
  }
}

/* ==========================================================
   FIN

   AUCUNE MÉTHODE GET.

   Le code OTP et le nouveau mot
   de passe ne doivent jamais
   apparaître dans une URL.

   Tous les contrôles sont réalisés
   côté serveur.
========================================================== */
