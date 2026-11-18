import { getPlatformPrisma } from "@/lib/payments/fulfillment";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
} from "node:crypto";

import {
  Prisma,
  PrismaClient,
} from "@/generated/prisma/client";

/* ==========================================================
   TIKEMIA — MOT DE PASSE OUBLIÉ ORGANISATEUR

   ROUTE :
   POST /api/organizer/auth/forgot-password

   FONCTION :
   - Recevoir l'adresse email
   - Vérifier le compte organisateur
   - Générer un code alphanumérique
   - Envoyer le code par email
   - Conserver uniquement son hash HMAC
   - Protéger contre les envois abusifs

   CODE :
   - 8 caractères
   - Lettres majuscules et chiffres
   - Validité : 10 minutes
   - À usage unique après réinitialisation

   INTÉGRATION :
   /api/organizer/auth/reset-password

   STOCKAGE :
   Prisma AppSetting

   EMAIL :
   Resend API

   Aucun nouveau modèle Prisma.
   Aucun mot de passe n'est modifié ici.
========================================================== */


/* ==========================================================
   CONFIGURATION
========================================================== */

const MAX_BODY_BYTES = 2048;

const CODE_LENGTH = 8;
const CODE_EXPIRATION_MS = 10 * 60 * 1000;

const RESEND_DELAY_MS = 60 * 1000;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 5;

const EMAIL_TIMEOUT_MS = 12_000;

const RESET_PREFIX = "organizer_password_reset:";
const RATE_PREFIX = "organizer_password_reset_rate:";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  // Métadonnées utilisées uniquement
  // par la route d'envoi.
  deliveryState?: "pending" | "active";
  deliveryId?: string;
};

type RateState = {
  version: 1;
  windowStartedAt: string;
  count: number;
  nextAllowedAt: string;
};

type SendReservation = {
  allowed: boolean;
  userId: string | null;
  deliveryId: string | null;
};

type ApiErrorCode =
  | "INVALID_REQUEST"
  | "FORBIDDEN"
  | "NOT_CONFIGURED"
  | "SERVER_ERROR";

/* ==========================================================
   TEXTES FR / EN
========================================================== */

const MESSAGES = {
  fr: {
    invalid:
      "Veuillez saisir une adresse email valide.",

    forbidden:
      "Cette requête n'est pas autorisée.",

    notConfigured:
      "Le service de récupération du mot de passe n'est pas encore configuré.",

    serverError:
      "Le service est momentanément indisponible.",

    accepted:
      "Si cette adresse email correspond à un compte organisateur, un code de récupération vous sera envoyé.",

    subject:
      "TIKEMIA — Réinitialisation de votre mot de passe",

    emailIntro:
      "Vous avez demandé la réinitialisation du mot de passe de votre compte organisateur TIKEMIA.",

    emailCode:
      "Votre code de vérification :",

    emailExpiration:
      "Ce code est valable pendant 10 minutes.",

    emailSecurity:
      "Ne communiquez ce code à personne.",

    emailIgnore:
      "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",

    emailSignature:
      "L'équipe TIKEMIA",
  },

  en: {
    invalid:
      "Please enter a valid email address.",

    forbidden:
      "This request is not authorized.",

    notConfigured:
      "Password recovery is not configured yet.",

    serverError:
      "The service is temporarily unavailable.",

    accepted:
      "If this email address belongs to an organizer account, a recovery code will be sent.",

    subject:
      "TIKEMIA — Reset your password",

    emailIntro:
      "You requested a password reset for your TIKEMIA organizer account.",

    emailCode:
      "Your verification code:",

    emailExpiration:
      "This code is valid for 10 minutes.",

    emailSecurity:
      "Never share this code with anyone.",

    emailIgnore:
      "If you did not request this change, please ignore this email.",

    emailSignature:
      "The TIKEMIA Team",
  },
} as const;

/* ==========================================================
   PRISMA 7
========================================================== */



const getPrisma = getPlatformPrisma;

/* ==========================================================
   RÉPONSES
========================================================== */

function getLanguage(
  request: NextRequest
): Language {
  const queryLocale =
    request.nextUrl.searchParams.get("locale");

  if (queryLocale === "fr" || queryLocale === "en") {
    return queryLocale;
  }

  const acceptLanguage =
    request.headers.get("accept-language") ?? "";

  return acceptLanguage.toLowerCase().startsWith("en")
    ? "en"
    : "fr";
}

function respond(
  body: JsonObject,
  status = 200
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      Vary: "Accept-Language",
    },
  });
}

function acceptedResponse(
  locale: Language
): NextResponse {
  return respond({
    success: true,
    message: MESSAGES[locale].accepted,
    nextStep: "verify",
    redirectTo: "/organizer/forgot-password",
  });
}

function errorResponse(
  code: ApiErrorCode,
  locale: Language
): NextResponse {
  const messages: Record<ApiErrorCode, string> = {
    INVALID_REQUEST: MESSAGES[locale].invalid,
    FORBIDDEN: MESSAGES[locale].forbidden,
    NOT_CONFIGURED: MESSAGES[locale].notConfigured,
    SERVER_ERROR: MESSAGES[locale].serverError,
  };

  const statuses: Record<ApiErrorCode, number> = {
    INVALID_REQUEST: 400,
    FORBIDDEN: 403,
    NOT_CONFIGURED: 503,
    SERVER_ERROR: 503,
  };

  return respond(
    {
      success: false,
      code,
      message: messages[code],
    },
    statuses[code]
  );
}

/* ==========================================================
   ORIGINE DE LA REQUÊTE

   Empêche les soumissions cross-origin
   depuis un navigateur.
========================================================== */

function checkOrigin(
  request: NextRequest
): boolean {
  const fetchSite =
    request.headers.get("sec-fetch-site");

  if (
    fetchSite &&
    fetchSite !== "same-origin" &&
    fetchSite !== "none"
  ) {
    return false;
  }

  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  try {
    return (
      new URL(origin).origin ===
      request.nextUrl.origin
    );
  } catch {
    return false;
  }
}

/* ==========================================================
   LECTURE JSON LIMITÉE
========================================================== */

async function readJson(
  request: NextRequest
): Promise<JsonObject | null> {
  const contentType =
    request.headers.get("content-type") ?? "";

  if (
    !contentType.toLowerCase().startsWith(
      "application/json"
    )
  ) {
    return null;
  }

  if (!request.body) {
    return null;
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];

  let total = 0;

  try {
    while (true) {
      const result = await reader.read();

      if (result.done) break;

      total += result.value.byteLength;

      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }

      chunks.push(result.value);
    }

    const bytes = new Uint8Array(total);

    let offset = 0;

    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
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
      return null;
    }

    return parsed as JsonObject;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

/* ==========================================================
   EMAIL
========================================================== */

function normalizeEmail(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const email = value.trim().toLowerCase();

  if (
    email.length < 5 ||
    email.length > 254 ||
    !EMAIL_PATTERN.test(email)
  ) {
    return null;
  }

  return email;
}

/* ==========================================================
   CODE ALPHANUMÉRIQUE

   Génération cryptographiquement sûre.

   Alphabet sans caractères ambigus :
   pas de 0, 1, I ou O.
========================================================== */

function createCode(): string {
  let code = "";

  for (let i = 0; i < CODE_LENGTH; i++) {
    const index = randomInt(ALPHABET.length);
    code += ALPHABET[index];
  }

  return code;
}

/* ==========================================================
   SECRET SERVEUR

   Doit correspondre exactement à celui
   de reset-password/route.ts.
========================================================== */

function getSecret(): string {
  const secret =
    process.env.TIKEMIA_PASSWORD_RESET_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("PASSWORD_RESET_SECRET_MISSING");
  }

  return secret;
}

/* ==========================================================
   CLÉS APPSETTING

   Contrat avec reset-password/route.ts :

   organizer_password_reset:
   + SHA256(email normalisé)
========================================================== */

function emailDigest(email: string): string {
  return createHash("sha256")
    .update(email, "utf8")
    .digest("hex");
}

function challengeKey(email: string): string {
  return `${RESET_PREFIX}${emailDigest(email)}`;
}

function rateKey(email: string): string {
  return `${RATE_PREFIX}${emailDigest(email)}`;
}

/* ==========================================================
   HACHAGE DU CODE

   Même contrat que reset-password/route.ts.

   HMAC-SHA256 avec une clé secrète serveur.
========================================================== */

function hashCode(
  email: string,
  code: string
): string {
  return createHmac("sha256", getSecret())
    .update(
      `TIKEMIA_RESET_CODE_V1:${email}:${code}`
    )
    .digest("hex");
}

/* ==========================================================
   STOCKAGE TEMPORAIRE
========================================================== */

function parseRateState(
  value: unknown
): RateState | null {
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
    typeof row.windowStartedAt !== "string" ||
    typeof row.nextAllowedAt !== "string" ||
    typeof row.count !== "number" ||
    !Number.isInteger(row.count) ||
    row.count < 0
  ) {
    return null;
  }

  return {
    version: 1,
    windowStartedAt: row.windowStartedAt,
    nextAllowedAt: row.nextAllowedAt,
    count: row.count,
  };
}

function challengeJson(
  state: ResetChallenge
): Prisma.InputJsonValue {
  return {
    version: state.version,
    userId: state.userId,
    codeHash: state.codeHash,
    expiresAt: state.expiresAt,
    attempts: state.attempts,
    verifiedAt: state.verifiedAt,
    resetTokenHash: state.resetTokenHash,
    resetTokenExpiresAt:
      state.resetTokenExpiresAt,
    deliveryState: state.deliveryState ?? "pending",
    deliveryId: state.deliveryId ?? "",
  };
}

function rateJson(
  state: RateState
): Prisma.InputJsonValue {
  return {
    version: state.version,
    windowStartedAt: state.windowStartedAt,
    count: state.count,
    nextAllowedAt: state.nextAllowedAt,
  };
}

/* ==========================================================
   VERROU POSTGRESQL

   Toutes les demandes concernant le
   même email sont sérialisées.

   Le verrou utilise la même clé que
   reset-password/route.ts.
========================================================== */

async function lockEmail(
  tx: Prisma.TransactionClient,
  email: string
): Promise<void> {
  const key = challengeKey(email);

  await tx.$queryRaw`
    SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${key}))) AS authentication_lock
  `;
}

/* ==========================================================
   CONFIGURATION DE L'EMAIL
========================================================== */

function checkConfiguration(): void {
  getSecret();

  if (
    !process.env.RESEND_API_KEY ||
    !(process.env.TIKEMIA_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || process.env.TIKEMIA_EMAIL_FROM)
  ) {
    throw new Error("RESET_EMAIL_NOT_CONFIGURED");
  }
}

/* ==========================================================
   CONSTRUCTION DU MESSAGE EMAIL
========================================================== */

function buildEmail(
  code: string,
  locale: Language
) {
  const t = MESSAGES[locale];

  const text = [
    "TIKEMIA",
    "",
    t.emailIntro,
    "",
    t.emailCode,
    "",
    code,
    "",
    t.emailExpiration,
    t.emailSecurity,
    "",
    t.emailIgnore,
    "",
    t.emailSignature,
  ].join("\n");

  return {
    subject: t.subject,
    text,
  };
}

/* ==========================================================
   ENVOI RÉEL AVEC RESEND

   Aucun code n'est affiché dans les logs.
   Aucun code n'est retourné au navigateur.
========================================================== */

async function sendEmail(
  email: string,
  code: string,
  locale: Language,
  deliveryId: string
): Promise<boolean> {
  const message = buildEmail(code, locale);

  try {
    const response = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": deliveryId,
        },
        body: JSON.stringify({
          from: (process.env.TIKEMIA_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || process.env.TIKEMIA_EMAIL_FROM),
          to: [email],
          subject: message.subject,
          text: message.text,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(
          EMAIL_TIMEOUT_MS
        ),
      }
    );

    if (!response.ok) {
      console.error(
        "[TIKEMIA PASSWORD RECOVERY] Email delivery failed:",
        response.status
      );

      return false;
    }

    return true;
  } catch {
    console.error(
      "[TIKEMIA PASSWORD RECOVERY] Email provider unavailable"
    );

    return false;
  }
}

/* ==========================================================
   RÉSERVER UNE DEMANDE D'ENVOI

   Protections :
   - 60 secondes entre les demandes
   - Maximum 5 demandes par heure/email
   - Protection contre demandes concurrentes
   - Même réponse pour email connu/inconnu

   Si l'email n'existe pas :
   aucun code n'est envoyé.

   Le compteur de limitation fonctionne
   quand même pour cet email.
========================================================== */

async function reserveSend(
  prisma: PrismaClient,
  email: string,
  code: string,
  deliveryId: string
): Promise<SendReservation> {
  return prisma.$transaction(
    async (tx): Promise<SendReservation> => {
      await lockEmail(tx, email);

      const currentTime = Date.now();

      const existingRate =
        await tx.appSetting.findUnique({
          where: {
            key: rateKey(email),
          },
          select: {
            value: true,
          },
        });

      const previousRate =
        parseRateState(existingRate?.value);

      /* ----------------------------------------------------
         Vérifier le délai entre deux envois
      ---------------------------------------------------- */

      if (
        previousRate &&
        currentTime <
          Date.parse(previousRate.nextAllowedAt)
      ) {
        return {
          allowed: false,
          userId: null,
          deliveryId: null,
        };
      }

      /* ----------------------------------------------------
         Fenêtre de limitation
      ---------------------------------------------------- */

      const sameWindow =
        previousRate !== null &&
        Number.isFinite(
          Date.parse(previousRate.windowStartedAt)
        ) &&
        currentTime -
          Date.parse(previousRate.windowStartedAt) <
          RATE_WINDOW_MS;

      const count = sameWindow
        ? previousRate!.count + 1
        : 1;

      if (count > MAX_SENDS_PER_WINDOW) {
        return {
          allowed: false,
          userId: null,
          deliveryId: null,
        };
      }

      const newRate: RateState = {
        version: 1,
        windowStartedAt: sameWindow
          ? previousRate!.windowStartedAt
          : new Date(currentTime).toISOString(),
        count,
        nextAllowedAt: new Date(
          currentTime + RESEND_DELAY_MS
        ).toISOString(),
      };

      await tx.appSetting.upsert({
        where: {
          key: rateKey(email),
        },
        create: {
          key: rateKey(email),
          value: rateJson(newRate),
        },
        update: {
          value: rateJson(newRate),
        },
      });

      /* ----------------------------------------------------
         Rechercher uniquement un organisateur
         actif, non bloqué et email vérifié.
      ---------------------------------------------------- */

      const user = await tx.user.findFirst({
        where: {
          email,
          isActive: true,
          isBlocked: false,
          emailVerifiedAt: {
            not: null,
          },
          roles: {
            some: {
              role: "ORGANIZER",
            },
          },
        },
        select: {
          id: true,
        },
      });

      if (!user) {
        return {
          allowed: true,
          userId: null,
          deliveryId: null,
        };
      }

      /* ----------------------------------------------------
         Créer un défi temporaire NON ACTIF.

         On enregistre un hash aléatoire
         pendant l'envoi de l'email.

         Le véritable hash du code sera
         enregistré seulement après
         acceptation par Resend.

         Ce défi est compatible avec le
         contrat de reset-password/route.ts.
      ---------------------------------------------------- */

      const placeholderHash = randomBytes(32)
        .toString("hex");

      const challenge: ResetChallenge = {
        version: 1,
        userId: user.id,
        codeHash: placeholderHash,
        expiresAt: new Date(
          currentTime + CODE_EXPIRATION_MS
        ).toISOString(),
        attempts: 0,
        verifiedAt: null,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        deliveryState: "pending",
        deliveryId,
      };

      await tx.appSetting.upsert({
        where: {
          key: challengeKey(email),
        },
        create: {
          key: challengeKey(email),
          value: challengeJson(challenge),
        },
        update: {
          value: challengeJson(challenge),
        },
      });

      return {
        allowed: true,
        userId: user.id,
        deliveryId,
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
   FINALISER L'ENVOI

   Si l'email a été accepté :
     activer le véritable code.

   Si l'envoi a échoué :
     laisser le défi inutilisable.

   Un ancien envoi ne peut pas écraser
   un code plus récent.
========================================================== */

async function finalizeSend(
  prisma: PrismaClient,
  email: string,
  code: string,
  deliveryId: string,
  delivered: boolean
): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await lockEmail(tx, email);

      const stored = await tx.appSetting.findUnique({
        where: {
          key: challengeKey(email),
        },
        select: {
          value: true,
        },
      });

      if (!stored) return;

      const raw = stored.value;

      if (
        !raw ||
        typeof raw !== "object" ||
        Array.isArray(raw)
      ) {
        return;
      }

      const state = raw as JsonObject;

      if (
        state.version !== 1 ||
        state.deliveryId !== deliveryId ||
        state.deliveryState !== "pending" ||
        typeof state.userId !== "string"
      ) {
        return;
      }

      if (!delivered) {
        // Ne pas activer de code en cas
        // d'échec de livraison.
        return;
      }

      const activatedAt = Date.now();

      const challenge: ResetChallenge = {
        version: 1,
        userId: state.userId,
        codeHash: hashCode(email, code),
        expiresAt: new Date(
          activatedAt + CODE_EXPIRATION_MS
        ).toISOString(),
        attempts: 0,
        verifiedAt: null,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        deliveryState: "active",
        deliveryId,
      };

      await tx.appSetting.update({
        where: {
          key: challengeKey(email),
        },
        data: {
          value: challengeJson(challenge),
        },
      });

      /* ----------------------------------------------------
         Journalisation, sans jamais
         enregistrer le code ni l'email.
      ---------------------------------------------------- */

      await tx.securityEvent.create({
        data: {
          userId: state.userId,
          type: "ORGANIZER_PASSWORD_RESET_EMAIL_SENT",
          metadata: {
            channel: "email",
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
}

/* ==========================================================
   POST — POINT D'ENTRÉE

   JSON accepté :

   {
     "email": "organisateur@example.com"
   }

   ou :

   {
     "action": "send",
     "email": "organisateur@example.com"
   }
========================================================== */

export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  const locale = getLanguage(request);

  try {
    /* ------------------------------------------------------
       Vérification de sécurité
    ------------------------------------------------------ */

    if (!checkOrigin(request)) {
      return errorResponse(
        "FORBIDDEN",
        locale
      );
    }

    const body = await readJson(request);

    if (!body) {
      return errorResponse(
        "INVALID_REQUEST",
        locale
      );
    }

    if (
      body.action !== undefined &&
      body.action !== "send"
    ) {
      return errorResponse(
        "INVALID_REQUEST",
        locale
      );
    }

    const email = normalizeEmail(body.email);

    if (!email) {
      return errorResponse(
        "INVALID_REQUEST",
        locale
      );
    }

    /* ------------------------------------------------------
       Vérifier la configuration serveur
       avant d'enregistrer un code.
    ------------------------------------------------------ */

    try {
      checkConfiguration();
    } catch {
      return errorResponse(
        "NOT_CONFIGURED",
        locale
      );
    }

    const prisma = getPrisma();

    /* ------------------------------------------------------
       Générer le code et réserver la demande
    ------------------------------------------------------ */

    const code = createCode();

    const deliveryId = randomUUID();

    const reservation = await reserveSend(
      prisma,
      email,
      code,
      deliveryId
    );

    /* ------------------------------------------------------
       Même réponse pour :
       - adresse inconnue
       - limite d'envois atteinte
       - adresse connue

       Ne révèle pas l'existence du compte.
    ------------------------------------------------------ */

    if (
      !reservation.allowed ||
      !reservation.userId
    ) {
      return acceptedResponse(locale);
    }

    /* ------------------------------------------------------
       Envoyer le code par email
    ------------------------------------------------------ */

    const delivered = await sendEmail(
      email,
      code,
      locale,
      deliveryId
    );

    /* ------------------------------------------------------
       Enregistrer le véritable hash
       uniquement après livraison acceptée.
    ------------------------------------------------------ */

    await finalizeSend(
      prisma,
      email,
      code,
      deliveryId,
      delivered
    );

    return acceptedResponse(locale);
  } catch (error) {
    console.error(
      "[TIKEMIA FORGOT PASSWORD]",
      error instanceof Error
        ? error.name
        : "UnknownError"
    );

    return errorResponse(
      "SERVER_ERROR",
      locale
    );
  }
}
