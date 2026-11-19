import { getTrustedRequestOrigin } from "@/lib/tikemia-pay/providers";
import { getPlatformPrisma } from "@/lib/payments/fulfillment";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createHash,
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import {
  Prisma,
  PrismaClient,
} from "@/generated/prisma/client";

/* ==========================================================
   TIKEMIA — VÉRIFICATION DES MOYENS DE RETRAIT

   Fichier :
   src/app/api/organizer/withdrawals/verify/route.ts

   POST { action: "send", destinationId }
      Envoyer un OTP de 6 chiffres par email.

   POST {
     action: "confirm",
     destinationId,
     code,
     confirmDetails: true
   }
      Vérifier l'OTP et valider le moyen.

   Stockage temporaire :
   AppSetting, sans nouvelle table Prisma.

   Les codes sont hachés avec HMAC-SHA256.
   Aucun OTP brut n'est stocké dans PostgreSQL.

   L'API ne réalise aucun retrait.
========================================================== */


/* ==========================================================
   CONSTANTES
========================================================== */

const SESSION_COOKIE = "tikemia_organizer_session";

const SESSION_PATTERN = /^[a-f0-9]{64}$/i;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OTP_PATTERN = /^\d{6}$/;

const OTP_VALIDITY_MS = 10 * 60 * 1000;

const RESEND_DELAY_MS = 60 * 1000;

const SEND_WINDOW_MS = 60 * 60 * 1000;

const MAX_SENDS_PER_WINDOW = 5;

const MAX_OTP_ATTEMPTS = 5;

const MAX_BODY_BYTES = 2048;

const EMAIL_TIMEOUT_MS = 12000;

const SETTING_PREFIX = "withdrawal_otp:";

type Language = "fr" | "en";

type Action = "send" | "confirm";

type JsonObject = Record<string, unknown>;

type AuthenticatedOrganizer = {
  userId: string;
  email: string;
  fullName: string;
};

type VerificationState = {
  version: 1;
  challengeId: string;
  userId: string;
  destinationId: string;
  destinationVersion: string;
  codeHash: string;
  status: "sending" | "active" | "failed";
  expiresAt: string;
  nextSendAt: string;
  attempts: number;
  sendCount: number;
  windowStartedAt: string;
};

type DestinationRecord = {
  id: string;
  organizationId: string;
  type: string;
  provider: string;
  accountName: string;
  maskedAccountRef: string | null;
  isVerified: boolean;
  isActive: boolean;
  deletedAt: Date | null;
  updatedAt: Date;
};

type ErrorKey =
  | "unauthorized"
  | "forbidden"
  | "invalidRequest"
  | "invalidDestination"
  | "notFound"
  | "alreadyVerified"
  | "emailUnavailable"
  | "emailNotConfigured"
  | "emailFailed"
  | "tooManyRequests"
  | "sendTooSoon"
  | "codeNotSent"
  | "codeExpired"
  | "invalidCode"
  | "tooManyAttempts"
  | "confirmationRequired"
  | "destinationChanged"
  | "serverError";

class ApiError extends Error {
  constructor(
    public readonly key: ErrorKey,
    public readonly statusCode: number,
    public readonly retryAfter?: number
  ) {
    super(key);
    this.name = "ApiError";
  }
}

/* ==========================================================
   FRANÇAIS / ANGLAIS
========================================================== */

const TEXT = {
  fr: {
    unauthorized:
      "Veuillez vous connecter à votre espace organisateur.",

    forbidden:
      "Cette opération n'est pas autorisée.",

    invalidRequest:
      "La requête envoyée est invalide.",

    invalidDestination:
      "L'identifiant du moyen de retrait est invalide.",

    notFound:
      "Ce moyen de retrait est introuvable.",

    alreadyVerified:
      "Ce moyen de retrait est déjà validé.",

    emailUnavailable:
      "Votre adresse email doit être vérifiée avant cette opération.",

    emailNotConfigured:
      "L'envoi des emails de validation n'est pas encore configuré.",

    emailFailed:
      "Impossible d'envoyer le code par email pour le moment.",

    tooManyRequests:
      "Vous avez atteint la limite des envois. Réessayez plus tard.",

    sendTooSoon:
      "Un code a déjà été demandé. Veuillez patienter avant un nouvel envoi.",

    codeNotSent:
      "Demandez d'abord un code de vérification.",

    codeExpired:
      "Le code a expiré. Demandez-en un nouveau.",

    invalidCode:
      "Le code de vérification est incorrect.",

    tooManyAttempts:
      "Trop de tentatives incorrectes. Demandez un nouveau code.",

    confirmationRequired:
      "Veuillez confirmer que les informations du moyen de retrait sont exactes.",

    destinationChanged:
      "Les coordonnées du moyen de retrait ont changé. Demandez un nouveau code.",

    serverError:
      "Impossible de valider ce moyen de retrait pour le moment.",

    sent:
      "Un code de vérification à 6 chiffres a été envoyé à votre adresse email.",

    verified:
      "Votre moyen de retrait a été validé avec succès.",
  },

  en: {
    unauthorized:
      "Please sign in to your organizer account.",

    forbidden:
      "This operation is not authorized.",

    invalidRequest:
      "Invalid request.",

    invalidDestination:
      "Invalid withdrawal method identifier.",

    notFound:
      "Withdrawal method not found.",

    alreadyVerified:
      "This withdrawal method is already verified.",

    emailUnavailable:
      "Your email address must be verified before this operation.",

    emailNotConfigured:
      "Verification emails are not configured yet.",

    emailFailed:
      "Unable to send the verification email right now.",

    tooManyRequests:
      "You have reached the sending limit. Try again later.",

    sendTooSoon:
      "A code was already requested. Please wait before requesting another.",

    codeNotSent:
      "Please request a verification code first.",

    codeExpired:
      "The code has expired. Request a new one.",

    invalidCode:
      "Incorrect verification code.",

    tooManyAttempts:
      "Too many incorrect attempts. Request a new code.",

    confirmationRequired:
      "Please confirm that your withdrawal account details are correct.",

    destinationChanged:
      "The withdrawal account details have changed. Request a new code.",

    serverError:
      "Unable to verify this withdrawal method right now.",

    sent:
      "A 6-digit verification code was sent to your email address.",

    verified:
      "Your withdrawal method was verified successfully.",
  },
} as const;

/* ==========================================================
   PRISMA 7
========================================================== */



const getPrisma = getPlatformPrisma;

/* ==========================================================
   RÉPONSES
========================================================== */

function getLanguage(request: NextRequest): Language {
  const query = request.nextUrl.searchParams.get("locale");

  if (query === "fr" || query === "en") {
    return query;
  }

  return (
    request.headers.get("accept-language") ?? ""
  ).toLowerCase().startsWith("en")
    ? "en"
    : "fr";
}

function respond(
  data: Record<string, unknown>,
  status = 200,
  retryAfter?: number
) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...(retryAfter
        ? { "Retry-After": String(retryAfter) }
        : {}),
    },
  });
}

function failure(
  language: Language,
  error: ApiError
) {
  return respond(
    {
      success: false,
      message: TEXT[language][error.key],
      ...(error.retryAfter
        ? { retryAfter: error.retryAfter }
        : {}),
    },
    error.statusCode,
    error.retryAfter
  );
}

/* ==========================================================
   SÉCURITÉ DE L'ORIGINE
========================================================== */

function checkOrigin(request: NextRequest) {
  const fetchSite =
    request.headers.get("sec-fetch-site");

  if (fetchSite && fetchSite !== "same-origin") {
    throw new ApiError("forbidden", 403);
  }

  const origin = request.headers.get("origin");

  if (!origin) {
    throw new ApiError("forbidden", 403);
  }

  try {
    if (
      new URL(origin).origin !== getTrustedRequestOrigin(request)
    ) {
      throw new ApiError("forbidden", 403);
    }
  } catch {
    throw new ApiError("forbidden", 403);
  }
}

/* ==========================================================
   AUTHENTIFICATION ORGANISATEUR
========================================================== */

async function authenticate(
  request: NextRequest,
  prisma: PrismaClient
): Promise<AuthenticatedOrganizer> {
  const token =
    request.cookies.get(SESSION_COOKIE)?.value;

  if (!token || !SESSION_PATTERN.test(token)) {
    throw new ApiError("unauthorized", 401);
  }

  const tokenHash = createHash("sha256")
    .update(token, "utf8")
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
    throw new ApiError("unauthorized", 401);
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.userId,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      emailVerifiedAt: true,
      isActive: true,
      isBlocked: true,
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
    user.roles.length === 0
  ) {
    throw new ApiError("unauthorized", 401);
  }

  if (!user.emailVerifiedAt) {
    throw new ApiError("emailUnavailable", 403);
  }

  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
  };
}

/* ==========================================================
   LECTURE JSON LIMITÉE
========================================================== */

async function readBody(
  request: NextRequest
): Promise<JsonObject> {
  const contentType =
    request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ApiError("invalidRequest", 400);
  }

  if (!request.body) {
    throw new ApiError("invalidRequest", 400);
  }

  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let length = 0;

  try {
    while (true) {
      const chunk = await reader.read();

      if (chunk.done) break;

      length += chunk.value.byteLength;

      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new ApiError("invalidRequest", 400);
      }

      parts.push(chunk.value);
    }

    const bytes = new Uint8Array(length);
    let offset = 0;

    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.byteLength;
    }

    const parsed: unknown = JSON.parse(
      new TextDecoder("utf-8", {
        fatal: true,
      }).decode(bytes)
    );

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new ApiError("invalidRequest", 400);
    }

    return parsed as JsonObject;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError("invalidRequest", 400);
  } finally {
    reader.releaseLock();
  }
}

/* ==========================================================
   VALIDATION DU FORMULAIRE
========================================================== */

function parseAction(
  body: JsonObject
): Action {
  if (body.action === "send") return "send";

  if (
    body.action === "confirm" ||
    body.action === "verify"
  ) {
    return "confirm";
  }

  throw new ApiError("invalidRequest", 400);
}

function parseDestinationId(
  body: JsonObject
): string {
  if (
    typeof body.destinationId !== "string" ||
    !UUID_PATTERN.test(body.destinationId)
  ) {
    throw new ApiError("invalidDestination", 400);
  }

  return body.destinationId.toLowerCase();
}

/* ==========================================================
   CHARGEMENT DU MOYEN DE RETRAIT

   Seul le propriétaire de l'organisation
   peut demander ou confirmer le code.
========================================================== */

async function findDestination(
  prisma: PrismaClient,
  destinationId: string,
  userId: string
): Promise<DestinationRecord> {
  const destination =
    await prisma.payoutDestination.findFirst({
      where: {
        id: destinationId,
        isActive: true,
        deletedAt: null,
        organization: {
          ownerId: userId,
          isActive: true,
        },
      },
      select: {
        id: true,
        organizationId: true,
        type: true,
        provider: true,
        accountName: true,
        maskedAccountRef: true,
        isVerified: true,
        isActive: true,
        deletedAt: true,
        updatedAt: true,
      },
    });

  if (!destination) {
    throw new ApiError("notFound", 404);
  }

  return destination;
}

/* ==========================================================
   ÉTAT OTP DANS APPSETTING

   Un enregistrement par moyen de retrait.

   Clé :
   withdrawal_otp:<destinationId>

   Ne pas utiliser UserEmailVerification :
   cette table concerne la validation
   de l'adresse email du compte.
========================================================== */

function settingKey(destinationId: string): string {
  return `${SETTING_PREFIX}${destinationId}`;
}

function parseState(value: unknown): VerificationState | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const data = value as JsonObject;

  if (
    data.version !== 1 ||
    typeof data.challengeId !== "string" ||
    typeof data.userId !== "string" ||
    typeof data.destinationId !== "string" ||
    typeof data.destinationVersion !== "string" ||
    typeof data.codeHash !== "string" ||
    typeof data.expiresAt !== "string" ||
    typeof data.nextSendAt !== "string" ||
    typeof data.windowStartedAt !== "string" ||
    typeof data.attempts !== "number" ||
    typeof data.sendCount !== "number" ||
    (
      data.status !== "sending" &&
      data.status !== "active" &&
      data.status !== "failed"
    )
  ) {
    return null;
  }

  return data as VerificationState;
}

function stateAsJson(
  state: VerificationState
): Prisma.InputJsonValue {
  return {
    version: state.version,
    challengeId: state.challengeId,
    userId: state.userId,
    destinationId: state.destinationId,
    destinationVersion: state.destinationVersion,
    codeHash: state.codeHash,
    status: state.status,
    expiresAt: state.expiresAt,
    nextSendAt: state.nextSendAt,
    attempts: state.attempts,
    sendCount: state.sendCount,
    windowStartedAt: state.windowStartedAt,
  };
}

/* ==========================================================
   HMAC DU CODE OTP

   L'OTP à 6 chiffres est trop court
   pour être protégé par un SHA-256 simple.

   Une clé serveur secrète est nécessaire :

   TIKEMIA_WITHDRAWAL_OTP_SECRET
========================================================== */

function getOtpSecret(): string {
  const secret =
    process.env.TIKEMIA_WITHDRAWAL_OTP_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("WITHDRAWAL_OTP_SECRET_MISSING");
  }

  return secret;
}

function hashOtp(
  code: string,
  userId: string,
  destinationId: string,
  challengeId: string
): string {
  return createHmac("sha256", getOtpSecret())
    .update(
      [
        "TIKEMIA_WITHDRAWAL_OTP_V1",
        userId,
        destinationId,
        challengeId,
        code,
      ].join(":"),
      "utf8"
    )
    .digest("hex");
}

function codeMatches(
  submittedCode: string,
  state: VerificationState
): boolean {
  const actual = Buffer.from(
    hashOtp(
      submittedCode,
      state.userId,
      state.destinationId,
      state.challengeId
    ),
    "hex"
  );

  const expected = Buffer.from(
    state.codeHash,
    "hex"
  );

  return (
    actual.length === expected.length &&
    timingSafeEqual(actual, expected)
  );
}

/* ==========================================================
   MASQUAGE DE L'EMAIL
========================================================== */

function maskEmail(email: string): string {
  const at = email.indexOf("@");

  if (at < 1) return "••••";

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  return `${local.slice(0, 2)}••••@${domain}`;
}

/* ==========================================================
   ENVOI EMAIL — RESEND

   Configuration serveur :
   RESEND_API_KEY
   TIKEMIA_FROM_EMAIL

   Aucun code OTP n'est retourné au client.
========================================================== */

function checkEmailConfiguration() {
  if (
    !process.env.RESEND_API_KEY ||
    !(process.env.TIKEMIA_FROM_EMAIL || process.env.RESEND_FROM_EMAIL)
  ) {
    throw new ApiError("emailNotConfigured", 503);
  }
}

async function sendOtpEmail(args: {
  email: string;
  code: string;
  locale: Language;
  idempotencyKey: string;
}): Promise<void> {
  checkEmailConfiguration();

  const french = args.locale === "fr";

  const subject = french
    ? "TIKEMIA — Validation de votre moyen de retrait"
    : "TIKEMIA — Verify your withdrawal method";

  const text = french
    ? [
        "TIKEMIA",
        "",
        "Vous avez demandé la validation d'un moyen de retrait.",
        "",
        `Votre code de vérification : ${args.code}`,
        "",
        "Ce code expire dans 10 minutes.",
        "Ne communiquez jamais ce code à une autre personne.",
        "",
        "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
      ].join("\n")
    : [
        "TIKEMIA",
        "",
        "You requested verification of a withdrawal method.",
        "",
        `Your verification code: ${args.code}`,
        "",
        "This code expires in 10 minutes.",
        "Never share this code with anyone.",
        "",
        "If you did not request this, ignore this email.",
      ].join("\n");

  let response: Response;

  try {
    response = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": args.idempotencyKey,
        },
        body: JSON.stringify({
          from: (process.env.TIKEMIA_FROM_EMAIL || process.env.RESEND_FROM_EMAIL),
          to: [args.email],
          subject,
          text,
        }),
        signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
        cache: "no-store",
      }
    );
  } catch {
    throw new ApiError("emailFailed", 503);
  }

  if (!response.ok) {
    console.error(
      "[TIKEMIA WITHDRAWAL OTP] Email provider status:",
      response.status
    );

    throw new ApiError("emailFailed", 503);
  }
}

/* ==========================================================
   VERROUILLAGE POSTGRESQL

   Empêche deux requêtes simultanées
   d'utiliser ou de remplacer le même OTP.

   Le verrou est limité au moyen de retrait.
========================================================== */

async function lockDestination(
  tx: Prisma.TransactionClient,
  destinationId: string
) {
  await tx.$queryRaw`
    SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${destinationId}))) AS lock_row
  `;
}

/* ==========================================================
   SAUVEGARDER L'ÉTAT OTP
========================================================== */

async function saveState(
  tx: Prisma.TransactionClient,
  state: VerificationState
) {
  const key = settingKey(state.destinationId);

  await tx.appSetting.upsert({
    where: {
      key,
    },
    create: {
      key,
      value: stateAsJson(state),
    },
    update: {
      value: stateAsJson(state),
    },
  });
}

/* ==========================================================
   ENVOYER LE CODE

   - Vérifier le moyen
   - Contrôler le délai de renvoi
   - Limiter les demandes par heure
   - Générer un code cryptographiquement
   - Enregistrer uniquement son HMAC
   - Envoyer par email

   Le code est activé uniquement après
   l'acceptation de l'envoi par Resend.
========================================================== */

async function sendCode(
  request: NextRequest,
  language: Language,
  prisma: PrismaClient,
  organizer: AuthenticatedOrganizer,
  destinationId: string
) {
  checkEmailConfiguration();
  getOtpSecret();

  const destination = await findDestination(
    prisma,
    destinationId,
    organizer.userId
  );

  if (destination.isVerified) {
    throw new ApiError("alreadyVerified", 409);
  }

  const code = String(
    randomInt(0, 1_000_000)
  ).padStart(6, "0");

  const challengeId = randomUUID();

  await prisma.$transaction(
    async (tx) => {
      await lockDestination(tx, destinationId);

      const currentDestination =
        await tx.payoutDestination.findFirst({
          where: {
            id: destinationId,
            isActive: true,
            deletedAt: null,
            organization: {
              ownerId: organizer.userId,
              isActive: true,
            },
          },
          select: {
            id: true,
            updatedAt: true,
            isVerified: true,
          },
        });

      if (!currentDestination) {
        throw new ApiError("notFound", 404);
      }

      if (currentDestination.isVerified) {
        throw new ApiError("alreadyVerified", 409);
      }

      const key = settingKey(destinationId);

      const stored = await tx.appSetting.findUnique({
        where: {
          key,
        },
        select: {
          value: true,
        },
      });

      const previous = parseState(stored?.value);

      const now = Date.now();

      if (
        previous &&
        previous.userId === organizer.userId &&
        now < Date.parse(previous.nextSendAt)
      ) {
        throw new ApiError(
          "sendTooSoon",
          429,
          Math.max(
            1,
            Math.ceil(
              (Date.parse(previous.nextSendAt) - now) /
                1000
            )
          )
        );
      }

      const sameWindow =
        previous &&
        previous.userId === organizer.userId &&
        now - Date.parse(previous.windowStartedAt) <
          SEND_WINDOW_MS;

      const sendCount = sameWindow
        ? previous.sendCount + 1
        : 1;

      if (sendCount > MAX_SENDS_PER_WINDOW) {
        throw new ApiError(
          "tooManyRequests",
          429,
          Math.max(
            1,
            Math.ceil(
              (
                Date.parse(previous!.windowStartedAt) +
                SEND_WINDOW_MS -
                now
              ) / 1000
            )
          )
        );
      }

      const next: VerificationState = {
        version: 1,
        challengeId,
        userId: organizer.userId,
        destinationId,
        destinationVersion:
          currentDestination.updatedAt.toISOString(),
        codeHash: hashOtp(
          code,
          organizer.userId,
          destinationId,
          challengeId
        ),
        status: "sending",
        expiresAt: new Date(
          now + OTP_VALIDITY_MS
        ).toISOString(),
        nextSendAt: new Date(
          now + RESEND_DELAY_MS
        ).toISOString(),
        attempts: 0,
        sendCount,
        windowStartedAt: sameWindow
          ? previous!.windowStartedAt
          : new Date(now).toISOString(),
      };

      await saveState(tx, next);

      return next;
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
      timeout: 15000,
    }
  );

  /* --------------------------------------------------------
     ENVOI RÉEL DE L'EMAIL
  -------------------------------------------------------- */

  try {
    await sendOtpEmail({
      email: organizer.email,
      code,
      locale: language,
      idempotencyKey: challengeId,
    });
  } catch (error) {
    /* ------------------------------------------------------
       Marquer le défi comme non utilisable
       si l'envoi n'a pas été accepté.
    ------------------------------------------------------ */

    try {
      await prisma.$transaction(async (tx) => {
        await lockDestination(tx, destinationId);

        const current = await tx.appSetting.findUnique({
          where: {
            key: settingKey(destinationId),
          },
        });

        const state = parseState(current?.value);

        if (
          state &&
          state.challengeId === challengeId &&
          state.status === "sending"
        ) {
          await saveState(tx, {
            ...state,
            status: "failed",
          });
        }
      });
    } catch {
      console.error(
        "[TIKEMIA WITHDRAWAL OTP] Failed to update email delivery state"
      );
    }

    throw error;
  }

  /* --------------------------------------------------------
     ACTIVER LE CODE APRÈS ENVOI

     Si une autre requête a remplacé le défi,
     ne pas activer l'ancien code.
  -------------------------------------------------------- */

  await prisma.$transaction(async (tx) => {
    await lockDestination(tx, destinationId);

    const current = await tx.appSetting.findUnique({
      where: {
        key: settingKey(destinationId),
      },
    });

    const state = parseState(current?.value);

    if (
      !state ||
      state.challengeId !== challengeId ||
      state.status !== "sending"
    ) {
      throw new ApiError("codeNotSent", 409);
    }

    await saveState(tx, {
      ...state,
      status: "active",
    });

    await tx.securityEvent.create({
      data: {
        userId: organizer.userId,
        type: "WITHDRAWAL_METHOD_OTP_SENT",
        metadata: {
          destinationId,
          channel: "email",
        },
      },
    });
  });

  return respond({
    success: true,
    action: "send",
    message: TEXT[language].sent,
    destinationId,
    email: maskEmail(organizer.email),
    expiresIn: OTP_VALIDITY_MS / 1000,
    resendAfter: RESEND_DELAY_MS / 1000,
  });
}

/* ==========================================================
   CONFIRMER LE CODE

   - OTP obligatoire
   - Case de confirmation obligatoire
   - Comparaison en temps constant
   - 5 tentatives maximum
   - Vérification de la version du moyen
   - Validation atomique dans PostgreSQL
   - Suppression de l'OTP après succès
========================================================== */

async function confirmCode(
  language: Language,
  prisma: PrismaClient,
  organizer: AuthenticatedOrganizer,
  destinationId: string,
  code: string,
  confirmDetails: boolean
) {
  if (!OTP_PATTERN.test(code)) {
    throw new ApiError("invalidCode", 400);
  }

  if (!confirmDetails) {
    throw new ApiError("confirmationRequired", 400);
  }

  getOtpSecret();

  /*
   * Retourner le résultat de la transaction
   * sans lever d'erreur après un mauvais OTP.
   *
   * Ainsi, l'incrémentation du nombre de
   * tentatives est bien conservée en base.
   */

  const result = await prisma.$transaction(
    async (tx): Promise<
      | { success: true; verifiedAt: Date }
      | { success: false; reason: ErrorKey }
    > => {
      await lockDestination(tx, destinationId);

      const destination =
        await tx.payoutDestination.findFirst({
          where: {
            id: destinationId,
            isActive: true,
            deletedAt: null,
            organization: {
              ownerId: organizer.userId,
              isActive: true,
            },
          },
          select: {
            id: true,
            isVerified: true,
            updatedAt: true,
          },
        });

      if (!destination) {
        return {
          success: false,
          reason: "notFound",
        };
      }

      if (destination.isVerified) {
        return {
          success: false,
          reason: "alreadyVerified",
        };
      }

      const key = settingKey(destinationId);

      const stored = await tx.appSetting.findUnique({
        where: {
          key,
        },
      });

      const state = parseState(stored?.value);

      if (
        !state ||
        state.userId !== organizer.userId ||
        state.destinationId !== destinationId ||
        state.status !== "active"
      ) {
        return {
          success: false,
          reason: "codeNotSent",
        };
      }

      if (Date.now() > Date.parse(state.expiresAt)) {
        return {
          success: false,
          reason: "codeExpired",
        };
      }

      if (state.attempts >= MAX_OTP_ATTEMPTS) {
        return {
          success: false,
          reason: "tooManyAttempts",
        };
      }

      /* ----------------------------------------------------
         Le code est invalidé si les coordonnées
         ont été modifiées depuis son émission.
      ---------------------------------------------------- */

      if (
        destination.updatedAt.toISOString() !==
        state.destinationVersion
      ) {
        return {
          success: false,
          reason: "destinationChanged",
        };
      }

      const valid = codeMatches(code, state);

      if (!valid) {
        const attempts = state.attempts + 1;

        await saveState(tx, {
          ...state,
          attempts,
        });

        await tx.securityEvent.create({
          data: {
            userId: organizer.userId,
            type: "WITHDRAWAL_METHOD_OTP_FAILED",
            metadata: {
              destinationId,
              attempts,
            },
          },
        });

        return {
          success: false,
          reason:
            attempts >= MAX_OTP_ATTEMPTS
              ? "tooManyAttempts"
              : "invalidCode",
        };
      }

      const verifiedAt = new Date();

      /* ----------------------------------------------------
         Valider uniquement le moyen demandé.
      ---------------------------------------------------- */

      const updated =
        await tx.payoutDestination.updateMany({
          where: {
            id: destinationId,
            isActive: true,
            deletedAt: null,
            isVerified: false,
            updatedAt: destination.updatedAt,
            organization: {
              ownerId: organizer.userId,
              isActive: true,
            },
          },
          data: {
            isVerified: true,
            verifiedAt,
          },
        });

      if (updated.count !== 1) {
        return {
          success: false,
          reason: "destinationChanged",
        };
      }

      /* ----------------------------------------------------
         OTP à usage unique.
      ---------------------------------------------------- */

      await tx.appSetting.delete({
        where: {
          key,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: organizer.userId,
          action: "PAYOUT_DESTINATION_VERIFIED",
          entity: "PayoutDestination",
          entityId: destinationId,
          metadata: {
            verificationMethod: "EMAIL_OTP",
          },
        },
      });

      await tx.securityEvent.create({
        data: {
          userId: organizer.userId,
          type: "WITHDRAWAL_METHOD_VERIFIED",
          metadata: {
            destinationId,
            channel: "email",
          },
        },
      });

      return {
        success: true,
        verifiedAt,
      };
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
      timeout: 15000,
    }
  );

  if (!result.success) {
    const status =
      result.reason === "notFound"
        ? 404
        : result.reason === "invalidCode"
          ? 400
          : result.reason === "tooManyAttempts"
            ? 429
            : 409;

    throw new ApiError(result.reason, status);
  }

  return respond({
    success: true,
    action: "confirm",
    message: TEXT[language].verified,
    destination: {
      id: destinationId,
      isVerified: true,
      verifiedAt: result.verifiedAt.toISOString(),
    },
  });
}

/* ==========================================================
   GESTION DES ERREURS
========================================================== */

function handleError(
  error: unknown,
  language: Language
) {
  if (error instanceof ApiError) {
    return failure(language, error);
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (
      error.code === "P2034" ||
      error.code === "P2002"
    )
  ) {
    return failure(
      language,
      new ApiError("serverError", 503)
    );
  }

  console.error(
    "[TIKEMIA WITHDRAWAL VERIFY]",
    error instanceof Error
      ? error.name
      : "UnknownError"
  );

  return failure(
    language,
    new ApiError("serverError", 503)
  );
}

/* ==========================================================
   POST — POINT D'ENTRÉE UNIQUE

   ENVOI :
   {
     "action": "send",
     "destinationId": "UUID"
   }

   CONFIRMATION :
   {
     "action": "confirm",
     "destinationId": "UUID",
     "code": "123456",
     "confirmDetails": true
   }
========================================================== */

export async function POST(request: NextRequest) {
  const language = getLanguage(request);

  try {
    checkOrigin(request);

    const prisma = getPrisma();

    const organizer = await authenticate(
      request,
      prisma
    );

    const body = await readBody(request);

    const action = parseAction(body);

    const destinationId = parseDestinationId(body);

    if (action === "send") {
      return await sendCode(
        request,
        language,
        prisma,
        organizer,
        destinationId
      );
    }

    return await confirmCode(
      language,
      prisma,
      organizer,
      destinationId,
      body.code as string,
      body.confirmDetails === true
    );
  } catch (error) {
    return handleError(error, language);
  }
}
