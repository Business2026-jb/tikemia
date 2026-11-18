import { getPlatformPrisma } from "@/lib/payments/fulfillment";

import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomInt } from "node:crypto";

/* ============================================
   TIKEMIA — RENVOI DU CODE EMAIL

   POST /api/organizer/resend-code

   Prisma ORM 7 + PostgreSQL + Resend

   - Code OTP à 6 chiffres
   - HMAC-SHA256
   - Expiration : 10 minutes
   - Délai entre envois : 60 secondes
   - Limite : 5 demandes par heure
   - Français et anglais
   - Protection des données sensibles
============================================ */


/* ============================================
   CONFIGURATION
============================================ */

const OTP_EXPIRATION_MINUTES = 10;
const COOLDOWN_SECONDS = 60;
const MAX_REQUESTS_PER_HOUR = 5;
const MAX_BODY_BYTES = 4096;

type Language = "fr" | "en";

const MESSAGES = {
  fr: {
    generic:
      "Si votre compte est en attente de vérification, un nouveau code vous sera envoyé.",
    invalidEmail: "Adresse e-mail invalide.",
    invalidRequest: "Requête invalide.",
    tooLarge: "Requête trop volumineuse.",
    unavailable:
      "Service temporairement indisponible. Veuillez réessayer.",
    emailUnavailable:
      "Envoi indisponible. Veuillez réessayer.",
  },
  en: {
    generic:
      "If your account is awaiting verification, a new code will be sent.",
    invalidEmail: "Invalid email address.",
    invalidRequest: "Invalid request.",
    tooLarge: "Request too large.",
    unavailable:
      "Service temporarily unavailable. Please try again.",
    emailUnavailable:
      "Email service unavailable. Please try again.",
  },
} as const;

/* ============================================
   PRISMA 7
============================================ */



const getPrisma = getPlatformPrisma;

/* ============================================
   RÉPONSES
============================================ */

function respond(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function genericSuccess(language: Language) {
  return respond({
    success: true,
    message: MESSAGES[language].generic,
  });
}

function errorResponse(
  language: Language,
  key:
    | "invalidEmail"
    | "invalidRequest"
    | "tooLarge"
    | "unavailable"
    | "emailUnavailable",
  status: number
) {
  return respond(
    {
      success: false,
      message: MESSAGES[language][key],
    },
    status
  );
}

/* ============================================
   VALIDATION
============================================ */

function getLanguage(value: unknown): Language {
  return value === "en" ? "en" : "fr";
}

function normalizeEmail(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const email = value.trim().toLowerCase();

  if (
    email.length < 3 ||
    email.length > 254 ||
    /[\s<>]/.test(email)
  ) {
    return null;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }

  return email;
}

/* ============================================
   SÉCURITÉ OTP
============================================ */

function generateOTP(): string {
  return randomInt(0, 1_000_000)
    .toString()
    .padStart(6, "0");
}

function hashOTP(
  userId: string,
  email: string,
  code: string
): string {
  const secret = process.env.OTP_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("OTP_SECRET_NOT_CONFIGURED");
  }

  return createHmac("sha256", secret)
    .update(`${userId}:${email}:${code}`, "utf8")
    .digest("hex");
}

/* ============================================
   EMAIL RESEND
============================================ */

function escapeHTML(value: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return value.replace(
    /[&<>"']/g,
    (character) => entities[character] ?? character
  );
}

function buildEmail(
  code: string,
  language: Language
) {
  const isFrench = language === "fr";

  const subject = isFrench
    ? "TIKEMIA — Code de vérification"
    : "TIKEMIA — Verification code";

  const title = isFrench
    ? "Vérification de votre adresse e-mail"
    : "Verify your email address";

  const description = isFrench
    ? "Voici votre nouveau code de vérification :"
    : "Here is your new verification code:";

  const expiration = isFrench
    ? "Ce code expire dans 10 minutes."
    : "This code expires in 10 minutes.";

  const warning = isFrench
    ? "Si vous n'avez pas demandé ce code, ignorez cet e-mail."
    : "If you did not request this code, ignore this email.";

  const html = `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  />
</head>
<body style="
  margin:0;
  padding:24px 12px;
  background:#f5f7f5;
  font-family:Arial,Helvetica,sans-serif;
  color:#111827;
">
  <table
    role="presentation"
    cellpadding="0"
    cellspacing="0"
    width="100%"
    style="max-width:480px;margin:0 auto;"
  >
    <tr>
      <td style="
        background:#ffffff;
        padding:28px 22px;
        border:1px solid #e5e9ef;
        border-radius:16px;
        text-align:center;
      ">
        <h1 style="
          color:#007c16;
          font-size:28px;
          margin:0 0 22px;
        ">
          TIKEMIA
        </h1>

        <h2 style="
          color:#003b1c;
          font-size:20px;
          line-height:1.4;
          margin:0 0 18px;
        ">
          ${escapeHTML(title)}
        </h2>

        <p style="
          font-size:15px;
          line-height:1.6;
        ">
          ${escapeHTML(description)}
        </p>

        <div style="
          margin:24px 0;
          padding:20px 10px;
          background:#e9fae6;
          border:1px solid #b9eaba;
          border-radius:12px;
        ">
          <span style="
            color:#004b20;
            font-size:34px;
            font-weight:800;
            letter-spacing:6px;
          ">
            ${escapeHTML(code)}
          </span>
        </div>

        <p style="
          color:#374151;
          font-size:14px;
        ">
          ${escapeHTML(expiration)}
        </p>

        <p style="
          color:#6b7280;
          font-size:12px;
          line-height:1.6;
          margin-top:22px;
        ">
          ${escapeHTML(warning)}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = [
    "TIKEMIA",
    title,
    description,
    code,
    expiration,
    warning,
  ].join("\n\n");

  return {
    subject,
    html,
    text,
  };
}

async function sendEmail(
  email: string,
  code: string,
  language: Language
): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error("RESEND_NOT_CONFIGURED");
  }

  const content = buildEmail(code, language);

  const response = await fetch(
    "https://api.resend.com/emails",
    {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: content.subject,
        html: content.html,
        text: content.text,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `RESEND_HTTP_${response.status}`
    );
  }

  const payload: unknown = await response.json();

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("id" in payload) ||
    typeof payload.id !== "string"
  ) {
    throw new Error("RESEND_INVALID_RESPONSE");
  }

  return payload.id;
}

/* ============================================
   ROUTE PRINCIPALE
============================================ */

export async function POST(request: NextRequest) {
  let language: Language = "fr";

  try {
    /* ----------------------------------------
       1. VÉRIFICATION DE LA CONFIGURATION
    ---------------------------------------- */

    if (
      !process.env.DATABASE_URL ||
      !process.env.RESEND_API_KEY ||
      !process.env.RESEND_FROM_EMAIL ||
      !process.env.OTP_SECRET ||
      process.env.OTP_SECRET.length < 32
    ) {
      console.error(
        "[TIKEMIA] Configuration OTP indisponible."
      );

      return errorResponse(
        language,
        "unavailable",
        503
      );
    }

    /* ----------------------------------------
       2. CONTRÔLE DE LA REQUÊTE
    ---------------------------------------- */

    const contentType =
      request.headers.get("content-type") ?? "";

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

    const contentLengthHeader =
      request.headers.get("content-length");

    if (contentLengthHeader !== null) {
      const contentLength = Number(
        contentLengthHeader
      );

      if (
        !Number.isFinite(contentLength) ||
        contentLength > MAX_BODY_BYTES
      ) {
        return errorResponse(
          language,
          "tooLarge",
          413
        );
      }
    }

    const rawBody = await request.text();

    if (
      Buffer.byteLength(rawBody, "utf8") >
      MAX_BODY_BYTES
    ) {
      return errorResponse(
        language,
        "tooLarge",
        413
      );
    }

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

    const input = body as Record<string, unknown>;

    language = getLanguage(input.locale);

    if (input.purpose !== undefined && input.purpose !== "login") return errorResponse(language, "invalidRequest", 400);
    const loginCode = input.purpose === "login";
    const email = normalizeEmail(input.email);

    if (!email) {
      return errorResponse(
        language,
        "invalidEmail",
        400
      );
    }

    /* ----------------------------------------
       3. RECHERCHE DE L'UTILISATEUR
    ---------------------------------------- */

    const prisma = getPrisma();

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        email: true,
        isActive: true,
        isBlocked: true,
        emailVerifiedAt: true,
      },
    });

    // Ne jamais indiquer publiquement
    // si une adresse email existe.

    if (
      !user ||
      !user.isActive ||
      user.isBlocked ||
      (!loginCode && user.emailVerifiedAt !== null)
    ) {
      return genericSuccess(language);
    }

    /* ----------------------------------------
       4. DATES ET CODE OTP
    ---------------------------------------- */

    if (loginCode && !await prisma.userRole.findFirst({ where: { userId: user.id, role: "ORGANIZER" }, select: { id: true } })) return genericSuccess(language);

    const now = new Date();

    const cooldownStart = new Date(
      now.getTime() -
        COOLDOWN_SECONDS * 1000
    );

    const hourStart = new Date(
      now.getTime() - 60 * 60 * 1000
    );

    const expiresAt = new Date(
      now.getTime() +
        OTP_EXPIRATION_MINUTES * 60 * 1000
    );

    const code = generateOTP();

    const codeHash = hashOTP(
      user.id,
      user.email,
      code
    );

    /* ----------------------------------------
       5. RÉSERVATION ATOMIQUE

       Prisma 7 infère automatiquement
       le type de tx lorsque son client
       est correctement généré.
    ---------------------------------------- */

    const reservation = await prisma.$transaction(
      async (tx) => {
        // Verrou PostgreSQL propre à l'utilisateur.
        // Il évite les renvois simultanés
        // pour un même compte.

        await tx.$queryRaw<{ locked: number }[]>`
          SELECT 1 AS locked
          FROM (
            SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${user.id}))) AS authentication_lock
          ) AS lock_row
        `;

        const latest =
          await tx.userEmailVerification.findFirst({
            where: {
              userId: user.id,
            },
            orderBy: [
              { createdAt: "desc" },
              { id: "desc" },
            ],
            select: {
              createdAt: true,
            },
          });

        if (
          latest &&
          latest.createdAt >= cooldownStart
        ) {
          return null;
        }

        const requestsInHour =
          await tx.userEmailVerification.count({
            where: {
              userId: user.id,
              createdAt: {
                gte: hourStart,
              },
            },
          });

        if (
          requestsInHour >=
          MAX_REQUESTS_PER_HOUR
        ) {
          return null;
        }

        const verification =
          await tx.userEmailVerification.create({
            data: {
              userId: user.id,
              email: user.email,
              codeHash,
              attempts: 0,
              expiresAt,
            },
            select: {
              id: true,
            },
          });

        const delivery =
          await tx.emailDelivery.create({
            data: {
              userId: user.id,
              recipient: user.email,
              template: "ORGANIZER_EMAIL_OTP",
              locale: language,
              subject:
                language === "fr"
                  ? "TIKEMIA — Code de vérification"
                  : "TIKEMIA — Verification code",
              status: "QUEUED",
              attempts: 0,
            },
            select: {
              id: true,
            },
          });

        return {
          verificationId: verification.id,
          deliveryId: delivery.id,
        };
      },
      {
        timeout: 10000,
      }
    );

    if (reservation === null) {
      return genericSuccess(language);
    }

    /* ----------------------------------------
       6. PRÉPARER L'ENVOI
    ---------------------------------------- */

    await prisma.emailDelivery.update({
      where: {
        id: reservation.deliveryId,
      },
      data: {
        status: "SENDING",
        attempts: {
          increment: 1,
        },
      },
    });

    /* ----------------------------------------
       7. ENVOYER AVEC RESEND
    ---------------------------------------- */

    let providerMessageId: string;

    try {
      providerMessageId = await sendEmail(
        user.email,
        code,
        language
      );
    } catch {
      console.error(
        "[TIKEMIA] Resend n'a pas confirmé l'envoi OTP."
      );

      // Le code de cette tentative est
      // désactivé, mais reste enregistré
      // pour le suivi et la limitation.

      try {
        await prisma.$transaction(async (tx) => {
          await tx.userEmailVerification.update({
            where: {
              id: reservation.verificationId,
            },
            data: {
              consumedAt: new Date(),
            },
          });

          await tx.emailDelivery.update({
            where: {
              id: reservation.deliveryId,
            },
            data: {
              status: "FAILED",
            },
          });
        });
      } catch {
        console.error(
          "[TIKEMIA] Échec du suivi de l'envoi OTP."
        );
      }

      return errorResponse(
        language,
        "emailUnavailable",
        503
      );
    }

    /* ----------------------------------------
       8. CONFIRMER L'ENVOI

       Resend a accepté l'email.
       On invalide les anciens codes.
    ---------------------------------------- */

    try {
      await prisma.$transaction(async (tx) => {
        await tx.userEmailVerification.updateMany({
          where: {
            userId: user.id,
            id: {
              not: reservation.verificationId,
            },
            consumedAt: null,
          },
          data: {
            consumedAt: new Date(),
          },
        });

        await tx.emailDelivery.update({
          where: {
            id: reservation.deliveryId,
          },
          data: {
            status: "SENT",
            providerMessageId,
            sentAt: new Date(),
          },
        });
      });
    } catch {
      // Ne pas supprimer un code après
      // qu'un email a été accepté par Resend.
      // La situation devra être rapprochée
      // avec les journaux du fournisseur.

      console.error(
        "[TIKEMIA] Email accepté, finalisation DB incomplète."
      );
    }

    return genericSuccess(language);
  } catch (error: unknown) {
    console.error(
      "[TIKEMIA] Erreur interne du renvoi OTP.",
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
