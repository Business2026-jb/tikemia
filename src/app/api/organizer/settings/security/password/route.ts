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
  Prisma,
} from "@/generated/prisma/client";

import {
  compare,
  hash,
} from "bcryptjs";

/* ==========================================================
   TIKEMIA — MODIFICATION DU MOT DE PASSE

   Fichier :
   src/app/api/organizer/settings/security/password/route.ts

   Méthode :
   PATCH

   URL :
   /api/organizer/settings/security/password

   Fonctionnalités :
   - Vérification de la session
   - Vérification du rôle ORGANIZER
   - Vérification du mot de passe actuel
   - Validation du nouveau mot de passe
   - Confirmation obligatoire
   - Hachage bcrypt
   - Limitation des tentatives incorrectes
   - Modification transactionnelle
   - Déconnexion des autres sessions
   - Journalisation des opérations sensibles
   - Réponses français / anglais

   IMPORTANT :
   Cette route fonctionne avec les hashes bcrypt.

   Si le système de connexion utilise Argon2
   ou un autre format, adapter la vérification
   au même algorithme avant toute mise en service.

   Aucun mot de passe en clair n'est enregistré.
========================================================== */




/* ==========================================================
   CONFIGURATION
========================================================== */

const SESSION_COOKIE =
  "tikemia_organizer_session";

const SESSION_TOKEN_PATTERN =
  /^[a-f0-9]{64}$/i;

const BCRYPT_HASH_PATTERN =
  /^\$2[ab]\$\d{2}\$/;

const MIN_PASSWORD_LENGTH = 8;

const MAX_PASSWORD_BYTES = 72;

const BCRYPT_COST = 12;

const MAX_BODY_BYTES = 4096;

const MAX_FAILED_ATTEMPTS = 5;

const BLOCK_DURATION_MINUTES = 15;

const FAILED_ATTEMPT_EVENT =
  "PASSWORD_CHANGE_FAILED";

const SUCCESS_EVENT =
  "PASSWORD_CHANGED";

const ALLOWED_BODY_KEYS = new Set([
  "currentPassword",
  "newPassword",
  "confirmPassword",
]);

type Language = "fr" | "en";

type JsonRecord = Record<string, unknown>;

type PasswordInput = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type AuthenticatedOrganizer = {
  userId: string;
  sessionId: string;
  tokenHash: string;
  passwordHash: string | null;
  sessionCreatedAt: Date;
};

type ErrorKey =
  | "unauthorized"
  | "forbidden"
  | "invalidContentType"
  | "invalidBody"
  | "invalidFields"
  | "missingFields"
  | "incorrectPassword"
  | "passwordTooShort"
  | "passwordTooLong"
  | "passwordTooWeak"
  | "passwordMismatch"
  | "samePassword"
  | "unsupportedHash"
  | "passwordNotConfigured"
  | "tooManyAttempts"
  | "concurrentChange"
  | "serverError";

/* ==========================================================
   TRADUCTIONS
========================================================== */

const TEXT = {
  fr: {
    unauthorized:
      "Votre session a expiré ou votre compte n'est pas autorisé. Veuillez vous reconnecter.",

    forbidden:
      "Cette opération n'est pas autorisée.",

    invalidContentType:
      "Les informations doivent être envoyées au format JSON.",

    invalidBody:
      "Les informations envoyées sont invalides ou trop volumineuses.",

    invalidFields:
      "La requête contient des champs non autorisés.",

    missingFields:
      "Veuillez renseigner le mot de passe actuel, le nouveau mot de passe et sa confirmation.",

    incorrectPassword:
      "Le mot de passe actuel est incorrect.",

    passwordTooShort:
      "Le nouveau mot de passe doit contenir au moins 8 caractères.",

    passwordTooLong:
      "Le nouveau mot de passe est trop long pour le système de sécurité utilisé.",

    passwordTooWeak:
      "Choisissez un mot de passe moins prévisible, qui ne soit pas composé uniquement d'espaces ou de caractères identiques.",

    passwordMismatch:
      "La confirmation ne correspond pas au nouveau mot de passe.",

    samePassword:
      "Le nouveau mot de passe doit être différent de l'ancien.",

    unsupportedHash:
      "Le format actuel du mot de passe nécessite une vérification de compatibilité avec le système de connexion.",

    passwordNotConfigured:
      "Aucun mot de passe classique n'est associé à ce compte. Utilisez la procédure sécurisée de création ou de réinitialisation du mot de passe.",

    tooManyAttempts:
      "Trop de tentatives incorrectes. Réessayez plus tard.",

    concurrentChange:
      "Le mot de passe a été modifié pendant cette opération. Veuillez vous reconnecter.",

    serverError:
      "Impossible de modifier le mot de passe pour le moment.",

    updated:
      "Votre mot de passe a été modifié avec succès. Les autres sessions ont été déconnectées.",
  },

  en: {
    unauthorized:
      "Your session has expired or your account is not authorized. Please sign in again.",

    forbidden:
      "This operation is not authorized.",

    invalidContentType:
      "Information must be sent in JSON format.",

    invalidBody:
      "Invalid or oversized request data.",

    invalidFields:
      "The request contains unauthorized fields.",

    missingFields:
      "Enter your current password, new password and confirmation.",

    incorrectPassword:
      "Your current password is incorrect.",

    passwordTooShort:
      "Your new password must contain at least 8 characters.",

    passwordTooLong:
      "Your new password is too long for the configured security algorithm.",

    passwordTooWeak:
      "Choose a less predictable password that is not made entirely of spaces or repeated characters.",

    passwordMismatch:
      "The confirmation does not match the new password.",

    samePassword:
      "Your new password must differ from your current password.",

    unsupportedHash:
      "The current password format requires compatibility checks with the sign-in system.",

    passwordNotConfigured:
      "Sign in again with an email code before setting your first password.",

    tooManyAttempts:
      "Too many incorrect attempts. Please try again later.",

    concurrentChange:
      "Your password was changed during this operation. Please sign in again.",

    serverError:
      "Unable to change your password right now.",

    updated:
      "Your password has been changed successfully. Other sessions have been signed out.",
  },
} as const;

/* ==========================================================
   PRISMA ORM 7
========================================================== */



const getPrisma = getPlatformPrisma;

/* ==========================================================
   LANGUE
========================================================== */

function getLanguage(
  request: NextRequest
): Language {
  const queryLocale =
    request.nextUrl.searchParams.get(
      "locale"
    );

  if (
    queryLocale === "fr" ||
    queryLocale === "en"
  ) {
    return queryLocale;
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
   RÉPONSES SÉCURISÉES
========================================================== */

function respond(
  body: Record<string, unknown>,
  status = 200,
  extraHeaders?: Record<string, string>
) {
  return NextResponse.json(body, {
    status,

    headers: {
      "Cache-Control":
        "private, no-store, max-age=0, must-revalidate",

      Pragma: "no-cache",

      "X-Content-Type-Options":
        "nosniff",

      Vary: "Cookie",

      ...extraHeaders,
    },
  });
}

function errorResponse(
  language: Language,
  error: ErrorKey,
  status: number,
  extraHeaders?: Record<string, string>
) {
  return respond(
    {
      success: false,
      message: TEXT[language][error],
    },
    status,
    extraHeaders
  );
}

/* ==========================================================
   PROTECTION CSRF / ORIGINE

   Les changements de mot de passe
   doivent provenir du site TIKEMIA.

   Nécessite également un cookie de session
   HttpOnly, Secure et SameSite correctement
   défini dans le système d'authentification.
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
   AUTHENTIFICATION

   User.passwordHash
   Session.tokenHash
   Session.revokedAt
   Session.expiresAt
   User.roles

   Tous ces champs sont présents
   dans le schéma Prisma TIKEMIA.
========================================================== */

async function authenticateOrganizer(
  request: NextRequest,
  prisma: PrismaClient
): Promise<AuthenticatedOrganizer | null> {
  const token =
    request.cookies.get(
      SESSION_COOKIE
    )?.value;

  if (
    !token ||
    !SESSION_TOKEN_PATTERN.test(token)
  ) {
    return null;
  }

  const tokenHash =
    createHash("sha256")
      .update(token, "utf8")
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
        id: true,
        userId: true,
        createdAt: true,
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

        passwordHash: true,

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

  return {
    userId: user.id,

    sessionId: session.id,

    tokenHash,

    passwordHash: user.passwordHash,
    sessionCreatedAt: session.createdAt,
  };
}

/* ==========================================================
   LECTURE JSON AVEC LIMITE

   Même si Content-Length est absent,
   la taille maximale est contrôlée
   pendant la lecture.
========================================================== */

async function readJson(
  request: NextRequest
): Promise<JsonRecord | null> {
  const contentLength =
    request.headers.get(
      "content-length"
    );

  if (contentLength !== null) {
    const length =
      Number(contentLength);

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

  const reader =
    request.body.getReader();

  const chunks: Uint8Array[] = [];

  let size = 0;

  try {
    while (true) {
      const result =
        await reader.read();

      if (result.done) {
        break;
      }

      size += result.value.byteLength;

      if (
        size > MAX_BODY_BYTES
      ) {
        await reader.cancel();
        return null;
      }

      chunks.push(result.value);
    }

    const bytes =
      new Uint8Array(size);

    let offset = 0;

    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const raw =
      new TextDecoder("utf-8", {
        fatal: true,
      }).decode(bytes);

    const value: unknown =
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
  } finally {
    reader.releaseLock();
  }
}

/* ==========================================================
   VALIDATION DU FORMULAIRE

   Format accepté :

   {
     currentPassword: string,
     newPassword: string,
     confirmPassword: string
   }

   Ne jamais enregistrer ces informations
   dans AuditLog, SecurityEvent ou console.
========================================================== */

type ValidationResult =
  | {
      success: true;
      value: PasswordInput;
    }
  | {
      success: false;
      error: ErrorKey;
    };

function validateInput(
  body: JsonRecord,
  allowInitial = false
): ValidationResult {
  for (const key of Object.keys(body)) {
    if (!ALLOWED_BODY_KEYS.has(key)) {
      return {
        success: false,
        error: "invalidFields",
      };
    }
  }

  const currentPassword =
    body.currentPassword;

  const newPassword =
    body.newPassword;

  const confirmPassword =
    body.confirmPassword;

  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    typeof confirmPassword !== "string" ||
    (!allowInitial && currentPassword.length === 0) ||
    newPassword.length === 0 ||
    confirmPassword.length === 0
  ) {
    return {
      success: false,
      error: "missingFields",
    };
  }

  /* ------------------------------------------
     Éviter une charge excessive lors
     de la vérification du hash existant.
  ------------------------------------------ */

  if (
    Buffer.byteLength(
      currentPassword,
      "utf8"
    ) > 1024
  ) {
    return {
      success: false,
      error: "invalidBody",
    };
  }

  if (
    newPassword.length <
    MIN_PASSWORD_LENGTH
  ) {
    return {
      success: false,
      error: "passwordTooShort",
    };
  }

  /* ------------------------------------------
     bcrypt utilise au maximum
     72 octets de mot de passe.

     Ne jamais tronquer silencieusement
     un nouveau mot de passe.
  ------------------------------------------ */

  if (
    Buffer.byteLength(
      newPassword,
      "utf8"
    ) > MAX_PASSWORD_BYTES
  ) {
    return {
      success: false,
      error: "passwordTooLong",
    };
  }

  if (
    newPassword.trim().length === 0 ||
    /^(.)\1+$/u.test(newPassword)
  ) {
    return {
      success: false,
      error: "passwordTooWeak",
    };
  }

  if (
    newPassword !== confirmPassword
  ) {
    return {
      success: false,
      error: "passwordMismatch",
    };
  }

  if (
    currentPassword === newPassword
  ) {
    return {
      success: false,
      error: "samePassword",
    };
  }

  return {
    success: true,

    value: {
      currentPassword,
      newPassword,
      confirmPassword,
    },
  };
}

/* ==========================================================
   INFORMATIONS TECHNIQUES POUR JOURNALISATION

   On ne fait pas confiance à X-Forwarded-For
   comme identité client sans configuration
   explicite d'un proxy de confiance.

   L'adresse IP est donc laissée à null.

   L'agent utilisateur est limité en longueur.
========================================================== */

function getUserAgent(
  request: NextRequest
): string | null {
  const value =
    request.headers.get(
      "user-agent"
    );

  return value
    ? value.slice(0, 512)
    : null;
}

/* ==========================================================
   TENTATIVES INCORRECTES

   La table SecurityEvent existe dans
   le schéma Prisma TIKEMIA.

   Après 5 échecs récents, le compte
   ne peut pas refaire une tentative
   de changement pendant la fenêtre
   de sécurité.

   Cette limite protège cette route.
   Une limitation distribuée additionnelle
   reste recommandée avant la production.
========================================================== */

function getLockWindowStart(): Date {
  return new Date(
    Date.now() -
    BLOCK_DURATION_MINUTES * 60_000
  );
}

async function getFailedAttempts(
  prisma: PrismaClient,
  userId: string
): Promise<number> {
  return prisma.securityEvent.count({
    where: {
      userId,

      type: FAILED_ATTEMPT_EVENT,

      createdAt: {
        gte: getLockWindowStart(),
      },
    },
  });
}

async function recordFailedAttempt(
  prisma: PrismaClient,
  userId: string,
  request: NextRequest
): Promise<void> {
  await prisma.securityEvent.create({
    data: {
      userId,

      type: FAILED_ATTEMPT_EVENT,

      ipAddress: null,

      userAgent:
        getUserAgent(request),

      metadata: {
        source:
          "organizer_settings",
      },
    },
  });
}

/* ==========================================================
   PATCH — CHANGER LE MOT DE PASSE
========================================================== */

export async function PATCH(
  request: NextRequest
) {
  const language =
    getLanguage(request);

  try {
    /* ----------------------------------------
       1. VÉRIFIER L'ORIGINE
    ---------------------------------------- */

    if (!isSameOrigin(request)) {
      return errorResponse(
        language,
        "forbidden",
        403
      );
    }

    /* ----------------------------------------
       2. VÉRIFIER LE FORMAT
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
      return errorResponse(
        language,
        "invalidContentType",
        415
      );
    }

    /* ----------------------------------------
       3. VÉRIFIER LA SESSION
    ---------------------------------------- */

    const prisma =
      getPrisma();

    const organizer =
      await authenticateOrganizer(
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
       4. CONTRÔLER LES TENTATIVES
    ---------------------------------------- */

    const failedAttempts =
      await getFailedAttempts(
        prisma,
        organizer.userId
      );

    if (
      failedAttempts >=
      MAX_FAILED_ATTEMPTS
    ) {
      return errorResponse(
        language,
        "tooManyAttempts",
        429,
        {
          "Retry-After": String(
            BLOCK_DURATION_MINUTES * 60
          ),
        }
      );
    }

    /* ----------------------------------------
       5. LIRE LE FORMULAIRE
    ---------------------------------------- */

    const body =
      await readJson(request);

    if (!body) {
      return errorResponse(
        language,
        "invalidBody",
        400
      );
    }

    /* ----------------------------------------
       6. VALIDER LE FORMULAIRE
    ---------------------------------------- */

    const validation =
      validateInput(body, organizer.passwordHash === null);

    if (!validation.success) {
      return errorResponse(
        language,
        validation.error,
        400
      );
    }

    const input =
      validation.value;

    /* ----------------------------------------
       7. VÉRIFIER LE TYPE DU HASH ACTUEL

       Une connexion OAuth sans mot
       de passe classique doit utiliser
       un parcours adapté.

       Ne jamais écraser un hash inconnu.
    ---------------------------------------- */


    if (
      organizer.passwordHash && !BCRYPT_HASH_PATTERN.test(
        organizer.passwordHash
      )
    ) {
      return errorResponse(
        language,
        "unsupportedHash",
        409
      );
    }

    /* ----------------------------------------
       8. VÉRIFIER LE MOT DE PASSE ACTUEL

       bcrypt compare le texte fourni
       avec le hash enregistré.

       Le mot de passe actuel n'est
       jamais renvoyé ni journalisé.
    ---------------------------------------- */

    const currentPasswordValid =
      organizer.passwordHash === null || await compare(
        input.currentPassword,
        organizer.passwordHash
      );

    if (!currentPasswordValid) {
      await recordFailedAttempt(
        prisma,
        organizer.userId,
        request
      );

      return errorResponse(
        language,
        "incorrectPassword",
        400
      );
    }

    /* ----------------------------------------
       9. REFUSER LA RÉUTILISATION
          DU MOT DE PASSE ACTUEL
    ---------------------------------------- */

    const sameAsExisting =
      organizer.passwordHash !== null && await compare(
        input.newPassword,
        organizer.passwordHash
      );

    if (sameAsExisting) {
      return errorResponse(
        language,
        "samePassword",
        400
      );
    }

    /* ----------------------------------------
       10. HACHER LE NOUVEAU MOT DE PASSE

       bcrypt avec facteur de coût 12.

       Cette opération s'effectue
       uniquement côté serveur.
    ---------------------------------------- */

    const newPasswordHash =
      await hash(
        input.newPassword,
        BCRYPT_COST
      );

    /* ----------------------------------------
       11. TRANSACTION POSTGRESQL

       La transaction :
       - vérifie que le hash n'a pas changé
       - met à jour le mot de passe
       - révoque les autres sessions
       - inscrit l'événement de sécurité
       - inscrit l'audit

       En cas d'échec, les modifications
       sont annulées ensemble.
    ---------------------------------------- */

    const transactionResult =
      await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${organizer.userId}))) AS password_lock`;

          /* ----------------------------------
             Vérifier une nouvelle fois
             la session active.
          ---------------------------------- */

          const activeSession =
            await tx.session.findFirst({
              where: {
                id:
                  organizer.sessionId,

                userId:
                  organizer.userId,

                tokenHash:
                  organizer.tokenHash,

                revokedAt: null,

                expiresAt: {
                  gt: new Date(),
                },
              },

              select: {
                id: true,
              },
            });

          if (!activeSession) {
            return {
              success: false as const,
              reason:
                "SESSION_EXPIRED" as const,
            };
          }

          /* ----------------------------------
             Mise à jour conditionnelle.

             Si un autre appareil a déjà
             changé le mot de passe,
             cette opération ne remplace
             pas sa modification.
          ---------------------------------- */

          const updated =
            await tx.user.updateMany({
              where: {
                id:
                  organizer.userId,

                passwordHash:
                  organizer.passwordHash,

                isActive: true,

                isBlocked: false,
              },

              data: {
                passwordHash:
                  newPasswordHash,
              },
            });

          if (
            updated.count !== 1
          ) {
            return {
              success: false as const,
              reason:
                "PASSWORD_CHANGED" as const,
            };
          }

          /* ----------------------------------
             Déconnecter les autres sessions.

             La session courante est
             conservée pour confirmer
             correctement l'opération.
          ---------------------------------- */

          const revoked =
            await tx.session.updateMany({
              where: {
                userId:
                  organizer.userId,

                id: {
                  not:
                    organizer.sessionId,
                },

                revokedAt: null,
              },

              data: {
                revokedAt:
                  new Date(),
              },
            });

          /* ----------------------------------
             Journal de sécurité.
          ---------------------------------- */

          await tx.securityEvent.create({
            data: {
              userId:
                organizer.userId,

              type:
                SUCCESS_EVENT,

              ipAddress: null,

              userAgent:
                getUserAgent(request),

              metadata: {
                source:
                  "organizer_settings",

                otherSessionsRevoked:
                  revoked.count,
              },
            },
          });

          /* ----------------------------------
             Journal d'audit.

             Aucune donnée secrète
             n'est enregistrée.
          ---------------------------------- */

          await tx.auditLog.create({
            data: {
              actorId:
                organizer.userId,

              action:
                "PASSWORD_CHANGED",

              entity:
                "User",

              entityId:
                organizer.userId,

              metadata: {
                source:
                  "organizer_settings",

                otherSessionsRevoked:
                  revoked.count,
              },
            },
          });

          return {
            success: true as const,
            revokedSessions:
              revoked.count,
          };
        },
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel
              .Serializable,

          timeout: 15000,
        }
      );

    /* ----------------------------------------
       12. TRAITER LES CONFLITS
    ---------------------------------------- */

    if (!transactionResult.success) {
      if (
        transactionResult.reason ===
        "SESSION_EXPIRED"
      ) {
        return errorResponse(
          language,
          "unauthorized",
          401
        );
      }

      return errorResponse(
        language,
        "concurrentChange",
        409
      );
    }

    /* ----------------------------------------
       13. CONFIRMATION

       Ne jamais retourner le hash
       ou les mots de passe.
    ---------------------------------------- */

    return respond({
      success: true,

      message:
        TEXT[language].updated,

      security: {
        passwordChanged: true,

        currentSessionPreserved: true,

        otherSessionsRevoked:
          transactionResult.revokedSessions,
      },
    });
  } catch (error) {
    /* ----------------------------------------
       Ne jamais journaliser le corps JSON,
       les mots de passe ou les hashes.

       Les détails techniques restent
       uniquement dans les logs serveur.
    ---------------------------------------- */

    console.error(
      "[TIKEMIA PASSWORD UPDATE]",
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
}
