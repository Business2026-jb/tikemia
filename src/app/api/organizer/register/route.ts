import { getTrustedRequestOrigin } from "@/lib/tikemia-pay/providers";
import { getPlatformPrisma } from "@/lib/payments/fulfillment";

import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomInt, randomBytes, createHash } from "node:crypto";

import { hash, compare } from "bcryptjs";
import {
  isSupportedCountry,
  parsePhoneNumberFromString,
} from "libphonenumber-js";

/* ============================================
   TIKEMIA — INSCRIPTION ORGANISATEUR

   POST /api/organizer/register

   Next.js App Router
   Prisma ORM 7
   PostgreSQL
   Resend

   Français / Anglais
============================================ */


/* ============================================
   CONFIGURATION
============================================ */

const OTP_EXPIRATION_MINUTES = 10;
const MAX_BODY_BYTES = 8192;

const TERMS_VERSION = "v1";
const PRIVACY_VERSION = "v1";

type Language = "fr" | "en";

type RegistrationInput = {
  passwordHash: string;
  fullName: string;
  organizationName: string | null;
  email: string;
  phoneE164: string;
  countryCode: string;
  locale: Language;
};

type RegistrationResult =
  | {
      status: "existing";
    }
  | {
      status: "created";
      userId: string;
      verificationId: string;
      deliveryId: string;
    };

/* ============================================
   MESSAGES FRANÇAIS / ANGLAIS
============================================ */

const MESSAGES = {
  fr: {
    invalidPassword: "Choisissez un mot de passe de 8 caractères minimum et de 72 octets maximum.",
    success:
      "Si votre inscription peut être traitée, un code de vérification sera envoyé à votre adresse e-mail.",

    invalidRequest:
      "Requête invalide.",

    invalidName:
      "Veuillez saisir votre nom et prénom.",

    invalidOrganization:
      "Nom d'organisation invalide.",

    invalidEmail:
      "Veuillez saisir une adresse e-mail valide.",

    invalidCountry:
      "Veuillez sélectionner un pays valide.",

    invalidPhone:
      "Veuillez saisir un numéro de téléphone valide.",

    termsRequired:
      "Veuillez accepter les conditions d'utilisation et la politique de confidentialité.",

    unavailable:
      "Le service est temporairement indisponible. Veuillez réessayer.",

    tooLarge:
      "Requête trop volumineuse.",
  },

  en: {
    invalidPassword: "Choose a password of at least 8 characters and at most 72 bytes.",
    success:
      "If your registration can be processed, a verification code will be sent to your email address.",

    invalidRequest:
      "Invalid request.",

    invalidName:
      "Please enter your full name.",

    invalidOrganization:
      "Invalid organization name.",

    invalidEmail:
      "Please enter a valid email address.",

    invalidCountry:
      "Please select a valid country.",

    invalidPhone:
      "Please enter a valid phone number.",

    termsRequired:
      "Please accept the Terms of Use and Privacy Policy.",

    unavailable:
      "The service is temporarily unavailable. Please try again.",

    tooLarge:
      "Request too large.",
  },
} as const;

type MessageKey = keyof typeof MESSAGES.fr;

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
  key: MessageKey,
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

function registrationResponse(language: Language) {
  return jsonResponse(
    {
      success: true,
      nextStep: "verify-email",
      message: MESSAGES[language].success,
    },
    202
  );
}

/* ============================================
   VALIDATION DES DONNÉES
============================================ */

function resolveLanguage(value: unknown): Language {
  return value === "en" ? "en" : "fr";
}

function normalizeFullName(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const name = value
    .trim()
    .replace(/\s+/g, " ");

  if (
    name.length < 3 ||
    name.length > 120 ||
    /[\u0000-\u001F\u007F]/.test(name)
  ) {
    return null;
  }

  return name;
}

function normalizeOrganizationName(
  value: unknown
): string | null | undefined {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const name = value
    .trim()
    .replace(/\s+/g, " ");

  if (!name) {
    return null;
  }

  if (
    name.length > 160 ||
    /[\u0000-\u001F\u007F]/.test(name)
  ) {
    return undefined;
  }

  return name;
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

function normalizeCountry(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const country = value.trim().toUpperCase();

  if (
    !/^[A-Z]{2}$/.test(country) ||
    !isSupportedCountry(country)
  ) {
    return null;
  }

  return country;
}

function normalizePhone(
  phoneValue: unknown,
  dialCodeValue: unknown
): string | null {
  if (
    typeof phoneValue !== "string" ||
    typeof dialCodeValue !== "string"
  ) {
    return null;
  }

  const dialCode = dialCodeValue.trim();
  const phone = phoneValue.trim();

  if (!/^\+[1-9]\d{0,3}$/.test(dialCode)) {
    return null;
  }

  if (!/^[+\d\s().-]+$/.test(phone)) {
    return null;
  }

  const phoneWithoutSeparators = phone.replace(
    /[\s().-]/g,
    ""
  );

  let internationalNumber: string;

  if (phoneWithoutSeparators.startsWith("+")) {
    internationalNumber = phoneWithoutSeparators;
  } else {
    // Certains pays conservent le zéro initial (Bénin, Italie).
    // La bibliothèque applique les règles propres à chaque indicatif.
    internationalNumber = `${dialCode}${phoneWithoutSeparators}`;
  }

  if (!/^\+[1-9]\d{6,14}$/.test(internationalNumber)) {
    return null;
  }

  const parsedPhone = parsePhoneNumberFromString(
    internationalNumber
  );

  if (
    !parsedPhone ||
    !parsedPhone.isValid()
  ) {
    return null;
  }

  // Un indicatif téléphonique peut être
  // différent du pays de résidence.

  return parsedPhone.number;
}

/* ============================================
   CODE OTP
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

  // Identique aux routes verify-email
  // et resend-code de TIKEMIA.

  return createHmac("sha256", secret)
    .update(`${userId}:${email}:${code}`, "utf8")
    .digest("hex");
}

/* ============================================
   EMAIL DE VÉRIFICATION
============================================ */

function buildVerificationEmail(
  code: string,
  language: Language
) {
  const french = language === "fr";

  const subject = french
    ? "TIKEMIA — Vérification de votre inscription"
    : "TIKEMIA — Verify your registration";

  const heading = french
    ? "Vérification de votre adresse e-mail"
    : "Verify your email address";

  const description = french
    ? "Voici votre code de vérification :"
    : "Here is your verification code:";

  const expiry = french
    ? "Ce code expire dans 10 minutes."
    : "This code expires in 10 minutes.";

  const warning = french
    ? "Si vous n'avez pas demandé cette inscription, ignorez cet e-mail."
    : "If you did not request this registration, ignore this email.";

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
  color:#111827;
  font-family:Arial,Helvetica,sans-serif;
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
        padding:28px 22px;
        background:#ffffff;
        border:1px solid #e5e9ef;
        border-radius:16px;
        text-align:center;
      ">
        <h1 style="
          margin:0 0 22px;
          color:#007c16;
          font-size:28px;
          font-weight:800;
        ">
          TIKEMIA
        </h1>

        <h2 style="
          margin:0 0 18px;
          color:#003b1c;
          font-size:20px;
          line-height:1.4;
        ">
          ${heading}
        </h2>

        <p style="
          font-size:15px;
          line-height:1.6;
        ">
          ${description}
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
            ${code}
          </span>
        </div>

        <p style="
          color:#374151;
          font-size:14px;
        ">
          ${expiry}
        </p>

        <p style="
          margin-top:22px;
          color:#6b7280;
          font-size:12px;
          line-height:1.6;
        ">
          ${warning}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = [
    "TIKEMIA",
    "",
    heading,
    description,
    "",
    code,
    "",
    expiry,
    warning,
  ].join("\n");

  return {
    subject,
    html,
    text,
  };
}

/* ============================================
   RESEND — ENVOI SERVEUR
============================================ */

async function sendVerificationEmail(
  email: string,
  code: string,
  language: Language
): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    throw new Error("RESEND_NOT_CONFIGURED");
  }

  const content = buildVerificationEmail(
    code,
    language
  );

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
        from: fromEmail,
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
      process.env.OTP_SECRET.length < 32 ||
      !process.env.RESEND_API_KEY ||
      !process.env.RESEND_FROM_EMAIL
    ) {
      console.error(
        "[TIKEMIA] Configuration inscription incomplète."
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

    const origin = request.headers.get("origin");

    if (
      origin &&
      origin !== getTrustedRequestOrigin(request)
    ) {
      return errorResponse(
        language,
        "invalidRequest",
        403
      );
    }

    /* ----------------------------------------
       3. CONTENT-TYPE
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

    /* ----------------------------------------
       4. TAILLE DES DONNÉES
    ---------------------------------------- */

    const contentLengthHeader =
      request.headers.get("content-length");

    if (contentLengthHeader !== null) {
      const contentLength = Number(
        contentLengthHeader
      );

      if (
        !Number.isFinite(contentLength) ||
        contentLength < 0 ||
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

    /* ----------------------------------------
       5. LECTURE JSON
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

    language = resolveLanguage(input.locale);

    /* ----------------------------------------
       6. VALIDATION DU FORMULAIRE
    ---------------------------------------- */

    const fullName = normalizeFullName(
      input.fullName
    );

    if (!fullName) {
      return errorResponse(
        language,
        "invalidName",
        400
      );
    }

    const organizationName =
      normalizeOrganizationName(
        input.organizationName
      );

    if (organizationName === undefined) {
      return errorResponse(
        language,
        "invalidOrganization",
        400
      );
    }

    const email = normalizeEmail(
      input.email
    );

    if (!email) {
      return errorResponse(
        language,
        "invalidEmail",
        400
      );
    }

    const countryCode = normalizeCountry(
      input.countryCode
    );

    if (!countryCode) {
      return errorResponse(
        language,
        "invalidCountry",
        400
      );
    }

    const phoneE164 = normalizePhone(
      input.phoneNumber,
      input.dialCode
    );

    if (!phoneE164) {
      return errorResponse(
        language,
        "invalidPhone",
        400
      );
    }

    // Une seule case d'acceptation
    // pour les deux documents juridiques.

    if (input.acceptedTerms !== true) {
      return errorResponse(
        language,
        "termsRequired",
        400
      );
    }

    if (typeof input.password !== "string" || input.password.length < 8 || Buffer.byteLength(input.password, "utf8") > 72 || input.password.trim().length === 0 || /^(.)\1+$/u.test(input.password)) return errorResponse(language, "invalidPassword", 400);
    const passwordHash = await hash(input.password, 12);

    const registration: RegistrationInput = {
      passwordHash,
      fullName,
      organizationName,
      email,
      phoneE164,
      countryCode,
      locale: language,
    };

    /* ----------------------------------------
       7. PRÉPARER PRISMA ET L'OTP
    ---------------------------------------- */

    const prisma = getPrisma();

    const code = generateOTP();

    const now = new Date();

    const expiresAt = new Date(
      now.getTime() +
        OTP_EXPIRATION_MINUTES * 60 * 1000
    );

    /* ----------------------------------------
       8. CRÉATION ATOMIQUE

       Une transaction PostgreSQL
       enregistre ensemble :

       - Utilisateur
       - Rôle ORGANIZER
       - Organisation
       - Membre organisateur
       - Code OTP
       - Journal d'email
       - Trace d'acceptation

       Le verrou évite les inscriptions
       simultanées avec le même email.
    ---------------------------------------- */

    const result: RegistrationResult =
      await prisma.$transaction(
        async (tx): Promise<RegistrationResult> => {

          await tx.$queryRaw<
            { locked: number }[]
          >`
            SELECT 1 AS locked
            FROM (
              SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${registration.email}))) AS authentication_lock
            ) AS lock_row
          `;

          /* ----------------------------------
             Vérifier si le compte existe
          ---------------------------------- */

          const existingUser =
            await tx.user.findUnique({
              where: {
                email: registration.email,
              },
              select: {
                id: true,
              },
            });

          if (existingUser) {
            return {
              status: "existing",
            };
          }

          /* ----------------------------------
             Créer le compte
          ---------------------------------- */

          const user = await tx.user.create({
            data: {
              fullName: registration.fullName,
              passwordHash: registration.passwordHash,
              email: registration.email,

              phoneE164:
                registration.phoneE164,

              countryCode:
                registration.countryCode,

              preferredLocale:
                registration.locale,

              emailVerifiedAt: null,

              isActive: true,
              isBlocked: false,
            },
            select: {
              id: true,
              email: true,
            },
          });

          /* ----------------------------------
             Attribuer le rôle organisateur
          ---------------------------------- */

          await tx.userRole.create({
            data: {
              userId: user.id,
              role: "ORGANIZER",
            },
          });

          /* ----------------------------------
             Créer l'espace organisateur

             Si aucun nom d'organisation
             n'est fourni, le nom complet
             identifie l'espace personnel.
          ---------------------------------- */

          const organization =
            await tx.organization.create({
              data: {
                ownerId: user.id,

                name:
                  registration.organizationName ??
                  registration.fullName,

                email: registration.email,

                phoneE164:
                  registration.phoneE164,

                countryCode:
                  registration.countryCode,
              },
              select: {
                id: true,
              },
            });

          /* ----------------------------------
             Associer l'utilisateur
             à son espace organisateur
          ---------------------------------- */

          await tx.organizerMember.create({
            data: {
              organizationId:
                organization.id,

              userId: user.id,

              role: "OWNER",
              isActive: true,
            },
          });

          /* ----------------------------------
             Initialiser la vérification
             de l'organisateur
          ---------------------------------- */

          await tx.organizerVerification.create({
            data: {
              organizationId:
                organization.id,

              status: "PENDING",
            },
          });

          /* ----------------------------------
             Enregistrer le code OTP
          ---------------------------------- */

          const verification =
            await tx.userEmailVerification.create({
              data: {
                userId: user.id,
                email: user.email,

                codeHash: hashOTP(
                  user.id,
                  user.email,
                  code
                ),

                attempts: 0,
                expiresAt,
              },
              select: {
                id: true,
              },
            });

          /* ----------------------------------
             Préparer le suivi de l'email
          ---------------------------------- */

          const emailContent =
            buildVerificationEmail(
              code,
              registration.locale
            );

          const delivery =
            await tx.emailDelivery.create({
              data: {
                userId: user.id,

                recipient:
                  registration.email,

                template:
                  "ORGANIZER_EMAIL_OTP",

                locale:
                  registration.locale,

                subject:
                  emailContent.subject,

                status: "QUEUED",
                attempts: 0,
              },
              select: {
                id: true,
              },
            });

          /* ----------------------------------
             Conserver la preuve
             d'acceptation des conditions

             Les versions doivent correspondre
             aux documents juridiques publiés.
          ---------------------------------- */

          await tx.auditLog.create({
            data: {
              actorId: user.id,

              action:
                "ORGANIZER_TERMS_ACCEPTED",

              entity: "User",
              entityId: user.id,

              metadata: {
                acceptedAt:
                  now.toISOString(),

                termsVersion:
                  TERMS_VERSION,

                privacyVersion:
                  PRIVACY_VERSION,

                registrationLocale:
                  registration.locale,
              },
            },
          });

          return {
            status: "created",
            userId: user.id,
            verificationId:
              verification.id,
            deliveryId:
              delivery.id,
          };
        },
        {
          timeout: 10000,
        }
      );

    /* ----------------------------------------
       9. COMPTE DÉJÀ EXISTANT

       Pas de divulgation d'existence
       du compte à l'utilisateur.

       Un compte non vérifié pourra
       utiliser la route resend-code.
    ---------------------------------------- */

    if (result.status === "existing") {
      return registrationResponse(language);
    }

    /* ----------------------------------------
       10. PRÉPARER L'ENVOI RESEND
    ---------------------------------------- */

    await prisma.emailDelivery.update({
      where: {
        id: result.deliveryId,
      },
      data: {
        status: "SENDING",

        attempts: {
          increment: 1,
        },
      },
    });

    /* ----------------------------------------
       11. ENVOYER LE CODE
    ---------------------------------------- */

    let providerMessageId: string;

    try {
      providerMessageId =
        await sendVerificationEmail(
          registration.email,
          code,
          language
        );
    } catch (error: unknown) {
      console.error(
        "[TIKEMIA] Envoi initial OTP non confirmé.",
        { code: error instanceof Error && /^RESEND_[A-Z0-9_]+$/.test(error.message)
          ? error.message : "EMAIL_DELIVERY_FAILED" }
      );

      // Le compte reste enregistré.
      // L'utilisateur pourra demander
      // un nouveau code avec resend-code.

      try {
        await prisma.$transaction(
          async (tx) => {
            await tx.userEmailVerification.update({
              where: {
                id: result.verificationId,
              },
              data: {
                consumedAt: new Date(),
              },
            });

            await tx.emailDelivery.update({
              where: {
                id: result.deliveryId,
              },
              data: {
                status: "FAILED",
              },
            });
          }
        );
      } catch {
        console.error(
          "[TIKEMIA] Échec du suivi de l'email initial."
        );
      }

      return registrationResponse(language);
    }

    /* ----------------------------------------
       12. CONFIRMER L'ENVOI ACCEPTÉ
           PAR RESEND
    ---------------------------------------- */

    try {
      await prisma.emailDelivery.update({
        where: {
          id: result.deliveryId,
        },
        data: {
          status: "SENT",

          providerMessageId,

          sentAt: new Date(),
        },
      });
    } catch {
      // Resend a accepté l'email.
      // Ne pas supprimer le code OTP.

      console.error(
        "[TIKEMIA] Envoi accepté, suivi DB incomplet."
      );
    }

    /* ----------------------------------------
       13. RÉPONSE FINALE
    ---------------------------------------- */

    return registrationResponse(language);

  } catch (error: unknown) {
    console.error(
      "[TIKEMIA] Échec du traitement d'inscription.",
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


let loginDummyHash: Promise<string> | null = null;
const loginRequests = new Map<string, { count: number; until: number }>();

// La connexion partage le compte et le mot de passe de l'inscription.
export async function PATCH(request: NextRequest) {
  let language: Language = "fr";
  try {
    if (request.headers.get("origin") !== getTrustedRequestOrigin(request) || request.headers.get("sec-fetch-site") === "cross-site") return errorResponse(language, "invalidRequest", 403);
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return errorResponse(language, "invalidRequest", 415);
    const reader = request.body?.getReader();
    if (!reader) return errorResponse(language, "invalidRequest", 400);
    const chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > MAX_BODY_BYTES) { await reader.cancel(); return errorResponse(language, "tooLarge", 413); } chunks.push(part.value); } } finally { reader.releaseLock(); }
    let value: unknown;
    try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return errorResponse(language, "invalidRequest", 400); }
    if (!value || typeof value !== "object" || Array.isArray(value)) return errorResponse(language, "invalidRequest", 400);
    const body = value as Record<string, unknown>;
    language = resolveLanguage(body.locale);
    const email = normalizeEmail(body.email);
    const password = body.password;
    const invalid = () => jsonResponse({ success: false, message: language === "fr" ? "Adresse email ou mot de passe incorrect." : "Incorrect email or password." }, 401);
    if (!email || typeof password !== "string" || password.length === 0 || Buffer.byteLength(password, "utf8") > 72) return invalid();
    const requestKey = createHash("sha256").update(email).digest("hex");
    const now = Date.now();
    for (const [key, entry] of loginRequests) if (entry.until <= now) loginRequests.delete(key);
    const attempts = loginRequests.get(requestKey);
    if (attempts && attempts.count >= 10) return jsonResponse({ success: false, message: language === "fr" ? "Trop de tentatives. Réessayez plus tard." : "Too many attempts. Try again later." }, 429);
    if (!attempts && loginRequests.size >= 10000) return errorResponse(language, "unavailable", 503);
    loginRequests.set(requestKey, { count: (attempts?.count ?? 0) + 1, until: attempts?.until ?? now + 15 * 60_000 });
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true, emailVerifiedAt: true, isActive: true, isBlocked: true, roles: { where: { role: "ORGANIZER" }, select: { id: true }, take: 1 } } });
    if (user && await prisma.securityEvent.count({ where: { userId: user.id, type: "ORGANIZER_LOGIN_FAILED", createdAt: { gte: new Date(now - 15 * 60_000) } } }) >= 5) return jsonResponse({ success: false, message: language === "fr" ? "Trop de tentatives. Réessayez plus tard." : "Too many attempts. Try again later." }, 429);
    loginDummyHash ??= hash(randomBytes(32).toString("hex"), 12);
    const validHash = user?.passwordHash && /^\$2[ab]\$\d{2}\$/.test(user.passwordHash) ? user.passwordHash : await loginDummyHash;
    const matches = await compare(password, validHash);
    if (!matches || !user?.passwordHash || !user.emailVerifiedAt || !user.isActive || user.isBlocked || user.roles.length === 0) {
      if (user) await prisma.securityEvent.create({ data: { userId: user.id, type: "ORGANIZER_LOGIN_FAILED" } });
      return invalid();
    }
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000);
    const created = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${user.id}))) AS login_lock`;
      const current = await tx.user.findFirst({ where: { id: user.id, passwordHash: user.passwordHash, isActive: true, isBlocked: false, emailVerifiedAt: { not: null }, roles: { some: { role: "ORGANIZER" } } }, select: { id: true } });
      if (!current) return false;
      await tx.session.create({ data: { userId: user.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt } });
      await tx.securityEvent.create({ data: { userId: user.id, type: "ORGANIZER_LOGIN_SUCCEEDED" } });
      return true;
    }, { timeout: 15000 });
    if (!created) return invalid();
    loginRequests.delete(requestKey);
    const response = jsonResponse({ success: true, redirectTo: "/organizer/dashboard" });
    response.cookies.set("tikemia_organizer_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60, expires: expiresAt });
    return response;
  } catch { return errorResponse(language, "unavailable", 503); }
}
