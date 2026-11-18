import { getPlatformPrisma } from "@/lib/payments/fulfillment";

import { NextRequest, NextResponse } from "next/server";
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import argon2 from "argon2";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
/**
 * TIKEMIA — Réinitialisation du mot de passe organisateur
 *
 * POST action="verify"
 *   email + code => jeton temporaire de réinitialisation
 *
 * POST action="reset"
 *   email + resetToken + password + confirmPassword
 *   => modification du mot de passe
 *
 * Aucun nouveau modèle Prisma.
 * Stockage des défis dans AppSetting.
 *
 * IMPORTANT :
 * La route forgot-password doit enregistrer le défi
 * avec exactement le contrat décrit ci-dessous.
 */


const MAX_BODY_BYTES = 4096;
const MAX_ATTEMPTS = 5;
const CODE_LENGTH = 8;
const RESET_TOKEN_LIFETIME_MS = 5 * 60 * 1000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_PATTERN = /^[A-Z0-9]{8}$/;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const KEY_PREFIX = "organizer_password_reset:";

type Language = "fr" | "en";
type JsonObject = Record<string, unknown>;

type ResetChallenge = {
  version: 1;
  userId: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
  verifiedAt: string | null;
  resetTokenHash: string | null;
  resetTokenExpiresAt: string | null;
};

type Result =
  | {
      ok: true;
      token?: string;
    }
  | {
      ok: false;
      code: string;
      status: number;
    };

const MESSAGES = {
  fr: {
    invalid: "Informations invalides.",
    invalidCode: "Code incorrect ou expiré.",
    expired: "Le code a expiré. Demandez-en un nouveau.",
    attempts:
      "Trop de tentatives. Demandez un nouveau code.",
    verified: "Code vérifié. Définissez votre nouveau mot de passe.",
    invalidToken:
      "Votre autorisation a expiré. Recommencez la vérification.",
    password:
      "Le mot de passe doit contenir au moins 12 caractères et au maximum 128 caractères.",
    mismatch: "Les mots de passe ne correspondent pas.",
    unchanged:
      "Le nouveau mot de passe doit être différent de l'ancien.",
    success:
      "Votre mot de passe a été modifié. Connectez-vous avec votre nouveau mot de passe.",
    unavailable:
      "Ce service est momentanément indisponible.",
    forbidden: "Requête non autorisée.",
  },
  en: {
    invalid: "Invalid information.",
    invalidCode: "Incorrect or expired code.",
    expired: "The code has expired. Request another one.",
    attempts: "Too many attempts. Request another code.",
    verified: "Code verified. Set your new password.",
    invalidToken:
      "Your authorization has expired. Verify your code again.",
    password:
      "The password must contain between 12 and 128 characters.",
    mismatch: "Passwords do not match.",
    unchanged:
      "Your new password must be different from your old one.",
    success:
      "Your password has been changed. Sign in using your new password.",
    unavailable: "This service is temporarily unavailable.",
    forbidden: "Unauthorized request.",
  },
} as const;

class ResetError extends Error {
  constructor(
    readonly code: keyof typeof MESSAGES.fr,
    readonly status: number
  ) {
    super(code);
  }
}

/* ==========================================================
   PRISMA 7 — CONNEXION RÉUTILISABLE
========================================================== */



const getPrisma = getPlatformPrisma;

/* ==========================================================
   LANGUE ET RÉPONSES
========================================================== */

function getLanguage(request: NextRequest): Language {
  const param = request.nextUrl.searchParams.get("locale");

  if (param === "en" || param === "fr") {
    return param;
  }

  return (request.headers.get("accept-language") ?? "")
    .toLowerCase()
    .startsWith("en")
    ? "en"
    : "fr";
}

function json(
  value: JsonObject,
  status = 200
): NextResponse {
  return NextResponse.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function fail(
  code: keyof typeof MESSAGES.fr,
  status: number,
  language: Language
): NextResponse {
  return json(
    {
      success: false,
      code,
      message: MESSAGES[language][code],
    },
    status
  );
}

/* ==========================================================
   SÉCURITÉ DE LA REQUÊTE
========================================================== */

function validateOrigin(request: NextRequest): void {
  const site = request.headers.get("sec-fetch-site");

  if (site && site !== "same-origin") {
    throw new ResetError("forbidden", 403);
  }

  const origin = request.headers.get("origin");

  if (!origin) {
    throw new ResetError("forbidden", 403);
  }

  try {
    if (new URL(origin).origin !== request.nextUrl.origin) {
      throw new ResetError("forbidden", 403);
    }
  } catch {
    throw new ResetError("forbidden", 403);
  }
}

async function parseBody(
  request: NextRequest
): Promise<JsonObject> {
  const contentType =
    request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ResetError("invalid", 400);
  }

  if (!request.body) {
    throw new ResetError("invalid", 400);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      const part = await reader.read();

      if (part.done) break;

      size += part.value.byteLength;

      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new ResetError("invalid", 400);
      }

      chunks.push(part.value);
    }

    const bytes = new Uint8Array(size);
    let offset = 0;

    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const value: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    );

    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      throw new ResetError("invalid", 400);
    }

    return value as JsonObject;
  } catch (error) {
    if (error instanceof ResetError) throw error;
    throw new ResetError("invalid", 400);
  } finally {
    reader.releaseLock();
  }
}

/* ==========================================================
   NORMALISATION
========================================================== */

function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new ResetError("invalid", 400);
  }

  const email = value.trim().toLowerCase();

  if (
    email.length > 254 ||
    !EMAIL_PATTERN.test(email)
  ) {
    throw new ResetError("invalid", 400);
  }

  return email;
}

function normalizeCode(value: unknown): string {
  if (typeof value !== "string") {
    throw new ResetError("invalidCode", 400);
  }

  const code = value
    .trim()
    .replace(/[\s-]/g, "")
    .toUpperCase();

  if (
    code.length !== CODE_LENGTH ||
    !CODE_PATTERN.test(code)
  ) {
    throw new ResetError("invalidCode", 400);
  }

  return code;
}

function normalizeToken(value: unknown): string {
  if (
    typeof value !== "string" ||
    !TOKEN_PATTERN.test(value)
  ) {
    throw new ResetError("invalidToken", 400);
  }

  return value.toLowerCase();
}

function validatePassword(
  password: unknown,
  confirmation: unknown
): string {
  if (
    typeof password !== "string" ||
    typeof confirmation !== "string"
  ) {
    throw new ResetError("password", 400);
  }

  const length = [...password].length;

  if (
    length < 12 ||
    length > 128 ||
    password.includes("\0")
  ) {
    throw new ResetError("password", 400);
  }

  if (password !== confirmation) {
    throw new ResetError("mismatch", 400);
  }

  return password;
}

/* ==========================================================
   SECRET SERVEUR ET HACHAGE

   Le code alphanumérique n'est jamais
   stocké en clair dans la base.

   La même fonction de hachage doit être
   utilisée dans forgot-password/route.ts.
========================================================== */

function getSecret(): string {
  const secret =
    process.env.TIKEMIA_PASSWORD_RESET_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("PASSWORD_RESET_SECRET_MISSING");
  }

  return secret;
}

function getSettingKey(email: string): string {
  const digest = createHash("sha256")
    .update(email, "utf8")
    .digest("hex");

  return `${KEY_PREFIX}${digest}`;
}

function hashCode(email: string, code: string): string {
  return createHmac("sha256", getSecret())
    .update(`TIKEMIA_RESET_CODE_V1:${email}:${code}`)
    .digest("hex");
}

function hashToken(token: string): string {
  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

function safeCompare(
  expectedHex: string,
  actualHex: string
): boolean {
  if (
    !/^[a-f0-9]{64}$/i.test(expectedHex) ||
    !/^[a-f0-9]{64}$/i.test(actualHex)
  ) {
    return false;
  }

  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(actualHex, "hex");

  return timingSafeEqual(expected, actual);
}

/* ==========================================================
   LECTURE DE L'ÉTAT TEMPORAIRE

   Contrat attendu dans AppSetting.value :

   {
     version: 1,
     userId: "...",
     codeHash: "...",
     expiresAt: "ISO date",
     attempts: 0,
     verifiedAt: null,
     resetTokenHash: null,
     resetTokenExpiresAt: null
   }
========================================================== */

function parseChallenge(
  value: unknown
): ResetChallenge | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const row = value as JsonObject;

  if (
    row.version !== 1 ||
    typeof row.userId !== "string" ||
    typeof row.codeHash !== "string" ||
    typeof row.expiresAt !== "string" ||
    typeof row.attempts !== "number" ||
    !Number.isInteger(row.attempts) ||
    row.attempts < 0
  ) {
    return null;
  }

  return {
    version: 1,
    userId: row.userId,
    codeHash: row.codeHash,
    expiresAt: row.expiresAt,
    attempts: row.attempts,
    verifiedAt:
      typeof row.verifiedAt === "string"
        ? row.verifiedAt
        : null,
    resetTokenHash:
      typeof row.resetTokenHash === "string"
        ? row.resetTokenHash
        : null,
    resetTokenExpiresAt:
      typeof row.resetTokenExpiresAt === "string"
        ? row.resetTokenExpiresAt
        : null,
  };
}

function jsonChallenge(
  challenge: ResetChallenge
): Prisma.InputJsonValue {
  return {
    ...challenge,
  };
}

/* ==========================================================
   VERROU POSTGRESQL

   Évite deux validations simultanées
   du même code ou du même jeton.
========================================================== */

async function lockChallenge(
  tx: Prisma.TransactionClient,
  key: string
): Promise<void> {
  await tx.$queryRaw`
    SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${key}))) AS authentication_lock
  `;
}

/* ==========================================================
   ÉTAPE 1 : VÉRIFIER LE CODE

   Entrée :
   {
     action: "verify",
     email: "...",
     code: "K7M2P9A4"
   }

   Sortie :
   {
     success: true,
     resetToken: "..."
   }

   Le jeton n'est valable que 5 minutes.
========================================================== */

async function verifyCode(
  prisma: PrismaClient,
  email: string,
  code: string
): Promise<Result> {
  const key = getSettingKey(email);

  return prisma.$transaction(
    async (tx): Promise<Result> => {
      await lockChallenge(tx, key);

      const stored = await tx.appSetting.findUnique({
        where: { key },
        select: { value: true },
      });

      const challenge = parseChallenge(stored?.value);

      if (!challenge) {
        return {
          ok: false,
          code: "invalidCode",
          status: 400,
        };
      }

      if (
        !Number.isFinite(Date.parse(challenge.expiresAt)) ||
        Date.now() >= Date.parse(challenge.expiresAt)
      ) {
        return {
          ok: false,
          code: "expired",
          status: 400,
        };
      }

      if (challenge.attempts >= MAX_ATTEMPTS) {
        return {
          ok: false,
          code: "attempts",
          status: 429,
        };
      }

      // Un code ayant déjà créé un jeton ne
      // peut plus être vérifié une seconde fois.
      if (challenge.verifiedAt) {
        return {
          ok: false,
          code: "invalidCode",
          status: 400,
        };
      }

      const valid = safeCompare(
        challenge.codeHash,
        hashCode(email, code)
      );

      if (!valid) {
        const attempts = challenge.attempts + 1;

        await tx.appSetting.update({
          where: { key },
          data: {
            value: jsonChallenge({
              ...challenge,
              attempts,
            }),
          },
        });

        return {
          ok: false,
          code:
            attempts >= MAX_ATTEMPTS
              ? "attempts"
              : "invalidCode",
          status:
            attempts >= MAX_ATTEMPTS ? 429 : 400,
        };
      }

      const user = await tx.user.findFirst({
        where: {
          id: challenge.userId,
          email,
          isActive: true,
          isBlocked: false,
          emailVerifiedAt: { not: null },
          roles: {
            some: { role: "ORGANIZER" },
          },
        },
        select: { id: true },
      });

      if (!user) {
        return {
          ok: false,
          code: "invalidCode",
          status: 400,
        };
      }

      const token = randomBytes(32).toString("hex");
      const now = new Date();

      await tx.appSetting.update({
        where: { key },
        data: {
          value: jsonChallenge({
            ...challenge,
            verifiedAt: now.toISOString(),
            resetTokenHash: hashToken(token),
            resetTokenExpiresAt: new Date(
              now.getTime() + RESET_TOKEN_LIFETIME_MS
            ).toISOString(),
          }),
        },
      });

      await tx.securityEvent.create({
        data: {
          userId: user.id,
          type: "ORGANIZER_PASSWORD_RESET_CODE_VERIFIED",
        },
      });

      return {
        ok: true,
        token,
      };
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
      timeout: 15000,
    }
  );
}

/* ==========================================================
   ÉTAPE 2 : MODIFIER LE MOT DE PASSE

   Entrée :
   {
     action: "reset",
     email: "...",
     resetToken: "...",
     password: "...",
     confirmPassword: "..."
   }

   Toutes les anciennes sessions
   sont révoquées.
========================================================== */

async function resetPassword(
  prisma: PrismaClient,
  email: string,
  resetToken: string,
  password: string
): Promise<Result> {
  const key = getSettingKey(email);
  const submittedHash = hashToken(resetToken);

  // Hachage coûteux effectué avant
  // la transaction pour limiter sa durée.
  const newPasswordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  return prisma.$transaction(
    async (tx): Promise<Result> => {
      await lockChallenge(tx, key);

      const stored = await tx.appSetting.findUnique({
        where: { key },
        select: { value: true },
      });

      const challenge = parseChallenge(stored?.value);

      if (
        !challenge ||
        !challenge.verifiedAt ||
        !challenge.resetTokenHash ||
        !challenge.resetTokenExpiresAt
      ) {
        return {
          ok: false,
          code: "invalidToken",
          status: 400,
        };
      }

      const expiresAt = Date.parse(
        challenge.resetTokenExpiresAt
      );

      if (
        !Number.isFinite(expiresAt) ||
        Date.now() >= expiresAt ||
        !safeCompare(
          challenge.resetTokenHash,
          submittedHash
        )
      ) {
        return {
          ok: false,
          code: "invalidToken",
          status: 400,
        };
      }

      const user = await tx.user.findFirst({
        where: {
          id: challenge.userId,
          email,
          isActive: true,
          isBlocked: false,
          emailVerifiedAt: { not: null },
          roles: {
            some: { role: "ORGANIZER" },
          },
        },
        select: {
          id: true,
          passwordHash: true,
        },
      });

      if (!user) {
        return {
          ok: false,
          code: "invalidToken",
          status: 400,
        };
      }

      // Comparaison applicable aux anciens
      // mots de passe stockés avec Argon2.
      // La route login doit utiliser le même
      // algorithme de vérification.
      if (
        user.passwordHash?.startsWith("$argon2")
      ) {
        const unchanged = await argon2.verify(
          user.passwordHash,
          password
        );

        if (unchanged) {
          return {
            ok: false,
            code: "unchanged",
            status: 400,
          };
        }
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newPasswordHash,
        },
      });

      // Déconnecter toutes les sessions actives,
      // y compris celles sur d'autres appareils.
      await tx.session.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      // Le code et le jeton deviennent
      // immédiatement inutilisables.
      await tx.appSetting.delete({
        where: { key },
      });

      await tx.securityEvent.create({
        data: {
          userId: user.id,
          type: "ORGANIZER_PASSWORD_RESET_SUCCESS",
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "ORGANIZER_PASSWORD_CHANGED",
          entity: "User",
          entityId: user.id,
          metadata: {
            method: "EMAIL_RECOVERY",
          },
        },
      });

      return { ok: true };
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
      timeout: 20000,
    }
  );
}

/* ==========================================================
   POST — ROUTE PRINCIPALE
========================================================== */

export async function POST(request: NextRequest) {
  const language = getLanguage(request);

  try {
    validateOrigin(request);

    const body = await parseBody(request);
    const email = normalizeEmail(body.email);
    const prisma = getPrisma();

    if (body.action === "verify") {
      const code = normalizeCode(body.code);

      const result = await verifyCode(
        prisma,
        email,
        code
      );

      if (!result.ok) {
        return fail(
          result.code as keyof typeof MESSAGES.fr,
          result.status,
          language
        );
      }

      return json({
        success: true,
        step: "verified",
        message: MESSAGES[language].verified,
        resetToken: result.token,
        expiresIn: RESET_TOKEN_LIFETIME_MS / 1000,
      });
    }

    if (body.action === "reset") {
      const token = normalizeToken(body.resetToken);

      const password = validatePassword(
        body.password,
        body.confirmPassword
      );

      const result = await resetPassword(
        prisma,
        email,
        token,
        password
      );

      if (!result.ok) {
        return fail(
          result.code as keyof typeof MESSAGES.fr,
          result.status,
          language
        );
      }

      const response = json({
        success: true,
        step: "completed",
        message: MESSAGES[language].success,
        redirectTo: "/organizer/login",
      });

      response.cookies.set("tikemia_organizer_session", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });

      return response;
    }

    return fail("invalid", 400, language);
  } catch (error) {
    if (error instanceof ResetError) {
      return fail(error.code, error.status, language);
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return fail("unavailable", 503, language);
    }

    console.error(
      "[TIKEMIA PASSWORD RESET]",
      error instanceof Error
        ? error.name
        : "UnknownError"
    );

    return fail("unavailable", 503, language);
  }
}
