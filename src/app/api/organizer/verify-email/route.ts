import { getPlatformPrisma } from "@/lib/payments/fulfillment";

import { NextRequest, NextResponse } from "next/server";

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/* ============================================
   TIKEMIA — VÉRIFICATION EMAIL ORGANISATEUR

   POST /api/organizer/verify-email

   Next.js App Router
   Prisma ORM 7
   PostgreSQL

   Sécurité :
   - Code OTP à 6 chiffres
   - HMAC-SHA256
   - Expiration après 10 minutes
   - 5 tentatives maximum
   - Vérification atomique
   - Code à usage unique
   - Session sécurisée HttpOnly
   - Français / Anglais
============================================ */


/* ============================================
   CONFIGURATION
============================================ */

const OTP_MAX_ATTEMPTS = 5;
const MAX_BODY_BYTES = 4096;

const SESSION_DURATION_SECONDS =
  60 * 60 * 24 * 7;

const SESSION_COOKIE_NAME =
  "tikemia_organizer_session";

type Language = "fr" | "en";

type VerificationResult =
  | { status: "verified" }
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "too_many_attempts" }
  | { status: "already_verified" };

/* ============================================
   MESSAGES
============================================ */

const MESSAGES = {
  fr: {
    verified:
      "Votre adresse e-mail a été vérifiée avec succès.",

    invalid:
      "Le code de vérification est incorrect.",

    expired:
      "Ce code a expiré. Demandez un nouveau code.",

    tooManyAttempts:
      "Nombre maximal de tentatives atteint. Demandez un nouveau code.",

    alreadyVerified:
      "Cette adresse e-mail est déjà vérifiée.",

    invalidEmail:
      "Veuillez saisir une adresse e-mail valide.",

    invalidCode:
      "Veuillez saisir un code à 6 chiffres.",

    invalidRequest:
      "Requête invalide.",

    unavailable:
      "Service temporairement indisponible. Veuillez réessayer.",
  },

  en: {
    verified:
      "Your email address has been verified successfully.",

    invalid:
      "The verification code is incorrect.",

    expired:
      "This code has expired. Request a new code.",

    tooManyAttempts:
      "Maximum verification attempts reached. Request a new code.",

    alreadyVerified:
      "This email address is already verified.",

    invalidEmail:
      "Please enter a valid email address.",

    invalidCode:
      "Please enter a 6-digit code.",

    invalidRequest:
      "Invalid request.",

    unavailable:
      "Service temporarily unavailable. Please try again.",
  },
} as const;

/* ============================================
   PRISMA 7 — POSTGRESQL
============================================ */



const getPrisma = getPlatformPrisma;

/* ============================================
   RÉPONSES JSON
============================================ */

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function errorResponse(
  language: Language,
  key: keyof (typeof MESSAGES)["fr"],
  status: number
) {
  return jsonResponse(
    {
      success: false,
      message: MESSAGES[language][key],
    },
    status
  );
}

/* ============================================
   VALIDATION DES DONNÉES
============================================ */

function resolveLanguage(
  value: unknown
): Language {
  return value === "en" ? "en" : "fr";
}

function normalizeEmail(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const email = value
    .trim()
    .toLowerCase();

  if (
    email.length < 3 ||
    email.length > 254 ||
    /[\s<>]/.test(email)
  ) {
    return null;
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return null;
  }

  return email;
}

function normalizeOTP(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const code = value.trim();

  if (!/^\d{6}$/.test(code)) {
    return null;
  }

  return code;
}

/* ============================================
   VÉRIFICATION HMAC-SHA256

   IMPORTANT :
   Cette fonction correspond au système
   utilisé par resend-code/route.ts.
============================================ */

function hashOTP(
  userId: string,
  email: string,
  code: string
): string {
  const secret = process.env.OTP_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "OTP_SECRET_NOT_CONFIGURED"
    );
  }

  return createHmac(
    "sha256",
    secret
  )
    .update(
      `${userId}:${email}:${code}`,
      "utf8"
    )
    .digest("hex");
}

/* ============================================
   COMPARAISON SÉCURISÉE
============================================ */

function compareHashes(
  storedHash: string,
  calculatedHash: string
): boolean {
  if (
    !/^[a-f0-9]{64}$/i.test(storedHash) ||
    !/^[a-f0-9]{64}$/i.test(calculatedHash)
  ) {
    return false;
  }

  const stored = Buffer.from(
    storedHash,
    "hex"
  );

  const calculated = Buffer.from(
    calculatedHash,
    "hex"
  );

  return timingSafeEqual(
    stored,
    calculated
  );
}

/* ============================================
   SESSION SÉCURISÉE

   Le jeton brut est envoyé uniquement
   dans un cookie HttpOnly.

   La base de données conserve
   uniquement son empreinte SHA-256.
============================================ */

function generateSessionToken() {
  const token = randomBytes(32)
    .toString("hex");

  const tokenHash = createHash("sha256")
    .update(token, "utf8")
    .digest("hex");

  return {
    token,
    tokenHash,
  };
}

/* ============================================
   ROUTE PRINCIPALE
============================================ */

export async function POST(
  request: NextRequest
) {
  let language: Language = "fr";

  try {
    /* ----------------------------------------
       1. CONFIGURATION
    ---------------------------------------- */

    if (
      !process.env.DATABASE_URL ||
      !process.env.OTP_SECRET ||
      process.env.OTP_SECRET.length < 32
    ) {
      console.error(
        "[TIKEMIA] Configuration OTP incomplète."
      );

      return errorResponse(
        language,
        "unavailable",
        503
      );
    }

    /* ----------------------------------------
       2. CONTRÔLE DE L'ORIGINE
    ---------------------------------------- */

    const origin =
      request.headers.get("origin");

    const expectedOrigin =
      request.nextUrl.origin;

    if (
      origin &&
      origin !== expectedOrigin
    ) {
      return errorResponse(
        language,
        "invalidRequest",
        403
      );
    }

    /* ----------------------------------------
       3. TYPE DE CONTENU
    ---------------------------------------- */

    const contentType =
      request.headers.get(
        "content-type"
      ) ?? "";

    if (
      !contentType
        .toLowerCase()
        .startsWith("application/json")
    ) {
      return errorResponse(
        language,
        "invalidRequest",
        415
      );
    }

    /* ----------------------------------------
       4. TAILLE DE LA REQUÊTE
    ---------------------------------------- */

    const lengthHeader =
      request.headers.get(
        "content-length"
      );

    if (lengthHeader !== null) {
      const size = Number(lengthHeader);

      if (
        !Number.isFinite(size) ||
        size < 0 ||
        size > MAX_BODY_BYTES
      ) {
        return errorResponse(
          language,
          "invalidRequest",
          413
        );
      }
    }

    const rawBody = await request.text();

    if (
      Buffer.byteLength(
        rawBody,
        "utf8"
      ) > MAX_BODY_BYTES
    ) {
      return errorResponse(
        language,
        "invalidRequest",
        413
      );
    }

    /* ----------------------------------------
       5. LECTURE DU JSON
    ---------------------------------------- */

    let body: unknown;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return errorResponse(
        language,
        "invalidRequest",
        400
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return errorResponse(
        language,
        "invalidRequest",
        400
      );
    }

    const input = body as Record<
      string,
      unknown
    >;

    language = resolveLanguage(
      input.locale
    );

    const email = normalizeEmail(
      input.email
    );

    const code = normalizeOTP(
      input.code
    );

    if (!email) {
      return errorResponse(
        language,
        "invalidEmail",
        400
      );
    }

    if (!code) {
      return errorResponse(
        language,
        "invalidCode",
        400
      );
    }

    /* ----------------------------------------
       6. RECHERCHE DU COMPTE
    ---------------------------------------- */

    const prisma = getPrisma();

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (!user) {
      return errorResponse(
        language,
        "invalid",
        400
      );
    }

    /* ----------------------------------------
       7. PRÉPARER LA SESSION

       La session sera enregistrée
       uniquement après validation
       effective du code OTP.
    ---------------------------------------- */

    const sessionData =
      generateSessionToken();

    const now = new Date();

    const sessionExpiresAt = new Date(
      now.getTime() +
        SESSION_DURATION_SECONDS * 1000
    );

    /* ----------------------------------------
       8. TRANSACTION ATOMIQUE

       Le verrou PostgreSQL empêche
       deux validations concurrentes
       du même compte.

       Il est identique à celui utilisé
       dans la route de renvoi OTP.
    ---------------------------------------- */

    const result: VerificationResult =
      await prisma.$transaction(
        async (tx): Promise<VerificationResult> => {
          await tx.$queryRaw<
            { locked: number }[]
          >`
            SELECT 1 AS locked
            FROM (
              SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${user.id}))) AS authentication_lock
            ) AS lock_row
          `;

          /* ----------------------------------
             Relecture du compte sous verrou
          ---------------------------------- */

          const account =
            await tx.user.findUnique({
              where: {
                id: user.id,
              },
              select: {
                id: true,
                email: true,
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
            !account ||
            !account.isActive ||
            account.isBlocked ||
            account.roles.length === 0
          ) {
            return {
              status: "invalid",
            };
          }


          /* ----------------------------------
             Dernier code OTP créé
          ---------------------------------- */

          const verification =
            await tx.userEmailVerification.findFirst({
              where: {
                userId: account.id,
                email: account.email,
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
                codeHash: true,
                attempts: true,
                expiresAt: true,
                consumedAt: true,
              },
            });

          if (!verification) {
            return {
              status: "invalid",
            };
          }

          /* ----------------------------------
             Code déjà consommé
          ---------------------------------- */

          if (
            verification.consumedAt !== null
          ) {
            return {
              status: "invalid",
            };
          }

          /* ----------------------------------
             Code expiré
          ---------------------------------- */

          if (
            verification.expiresAt <=
            new Date()
          ) {
            return {
              status: "expired",
            };
          }

          /* ----------------------------------
             Nombre maximal de tentatives
          ---------------------------------- */

          if (
            verification.attempts >=
            OTP_MAX_ATTEMPTS
          ) {
            return {
              status: "too_many_attempts",
            };
          }

          /* ----------------------------------
             Comparaison HMAC
          ---------------------------------- */

          const calculatedHash = hashOTP(
            account.id,
            account.email,
            code
          );

          const isValid = compareHashes(
            verification.codeHash,
            calculatedHash
          );

          /* ----------------------------------
             Code incorrect
          ---------------------------------- */

          if (!isValid) {
            await tx.userEmailVerification.update({
              where: {
                id: verification.id,
              },
              data: {
                attempts: {
                  increment: 1,
                },
              },
            });

            if (
              verification.attempts + 1 >=
              OTP_MAX_ATTEMPTS
            ) {
              return {
                status: "too_many_attempts",
              };
            }

            return {
              status: "invalid",
            };
          }

          /* ----------------------------------
             Code correct

             1. Consommer le code
             2. Vérifier l'email
             3. Créer la session
          ---------------------------------- */

          const verifiedAt = new Date();

          await tx.userEmailVerification.update({
            where: {
              id: verification.id,
            },
            data: {
              consumedAt: verifiedAt,
            },
          });

          await tx.user.update({
            where: {
              id: account.id,
            },
            data: {
              emailVerifiedAt: account.emailVerifiedAt ?? verifiedAt,
            },
          });

          /* ----------------------------------
             Invalider tous les autres
             codes en attente.
          ---------------------------------- */

          await tx.userEmailVerification.updateMany({
            where: {
              userId: account.id,
              consumedAt: null,
            },
            data: {
              consumedAt: verifiedAt,
            },
          });

          /* ----------------------------------
             Enregistrer la session
          ---------------------------------- */

          await tx.session.create({
            data: {
              userId: account.id,
              tokenHash:
                sessionData.tokenHash,
              expiresAt:
                sessionExpiresAt,
            },
          });

          return {
            status: "verified",
          };
        },
        {
          timeout: 10000,
        }
      );

    /* ----------------------------------------
       9. GESTION DES RÉSULTATS
    ---------------------------------------- */

    if (result.status === "invalid") {
      return errorResponse(
        language,
        "invalid",
        400
      );
    }

    if (result.status === "expired") {
      return errorResponse(
        language,
        "expired",
        400
      );
    }

    if (
      result.status ===
      "too_many_attempts"
    ) {
      return errorResponse(
        language,
        "tooManyAttempts",
        429
      );
    }

    if (
      result.status ===
      "already_verified"
    ) {
      return errorResponse(
        language,
        "alreadyVerified",
        409
      );
    }

    /* ----------------------------------------
       10. COMPTE VÉRIFIÉ

       Création de la réponse HTTP
       et installation du cookie.
    ---------------------------------------- */

    const response = jsonResponse({
      success: true,
      verified: true,
      message:
        MESSAGES[language].verified,
      redirectTo: "/organizer/dashboard",
    });

    response.cookies.set(
      SESSION_COOKIE_NAME,
      sessionData.token,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/",
        maxAge:
          SESSION_DURATION_SECONDS,
        expires: sessionExpiresAt,
      }
    );

    return response;

  } catch (error: unknown) {
    /* ----------------------------------------
       11. ERREUR SERVEUR
    ---------------------------------------- */

    console.error(
      "[TIKEMIA] Échec de vérification OTP.",
      {
        code: typeof error === "object" && error !== null && "code" in error
          && typeof error.code === "string" ? error.code : "UNKNOWN",
        type: error instanceof Error ? error.name : "UnknownError",
      }
    );

    return errorResponse(
      language,
      "unavailable",
      503
    );
  }
}

/* Fin de la session courante : aucune autre session n'est affectée. */
export async function DELETE(request: NextRequest) {
  const origin = request.headers.get("origin");
  if ((origin && origin !== request.nextUrl.origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    return jsonResponse({ success: false }, 403);
  }

  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
      await getPrisma().session.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    const response = jsonResponse({ success: true });
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
    return response;
  } catch (error: unknown) {
    console.error("[TIKEMIA] Session revocation failed.", {
      code: typeof error === "object" && error !== null && "code" in error
        && typeof error.code === "string" ? error.code : "UNKNOWN",
      type: error instanceof Error ? error.name : "UnknownError",
    });
    return jsonResponse({ success: false }, 503);
  }
}
