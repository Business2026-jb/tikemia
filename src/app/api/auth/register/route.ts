import argon2 from "argon2";
import { compare as compareBcrypt } from "bcryptjs";
import { unstable_rethrow } from "next/navigation";

import {
  createHmac,
  randomInt,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";



import {
  NextRequest,
  NextResponse,
} from "next/server";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  PrismaClient,
  Prisma,
} from "@/generated/prisma/client";

import {
  parsePhoneNumberFromString,
} from "libphonenumber-js";

/* ==========================================================
   TIKEMIA — INSCRIPTION PUBLIQUE

   FICHIER :
   src/app/api/auth/register/route.ts

   MÉTHODE :
   POST /api/auth/register

   ENTRÉE :
   - email
   - phone
   - password
   - acceptTerms
   - locale (fr / en)

   ÉTAPES :
   1. Valider les données.
   2. Normaliser email et téléphone.
   3. Hacher le mot de passe.
   4. Créer un compte CLIENT non vérifié.
   5. Générer un OTP à six chiffres.
   6. Stocker uniquement son HMAC.
   7. Envoyer l'OTP par email.
   8. Diriger vers /verify-email.

   SÉCURITÉ :
   - Aucun mot de passe en clair en DB
   - Aucun code OTP en clair en DB
   - Aucun OTP dans la réponse JSON
   - Expiration après 10 minutes
   - Réémission contrôlée
   - Limitation par email
   - Aucun accès aux billets avant
     vérification de l'email
   - Aucune session ouverte ici

   PRISMA EXISTANT :
   - User
   - UserRole
   - UserEmailVerification

   AUCUNE MODIFICATION DU SCHÉMA.
========================================================== */

function scrypt(password: string, salt: Buffer, length: number, options: import("node:crypto").ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCallback(password, salt, length, options, (error, result) => error ? reject(error) : resolve(result)));
}

const OTP_DURATION_MINUTES = 10;
const OTP_COOLDOWN_SECONDS = 60;
const MAX_OTP_PER_HOUR = 5;

const MAX_BODY_BYTES = 8192;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_BYTES = 1024;

const VERIFY_URL = "/verify-email";

/* ==========================================================
   TYPES
========================================================== */

type Locale = "fr" | "en";

type RegistrationBody = {
  email?: unknown;
  phone?: unknown;
  phoneE164?: unknown;
  password?: unknown;
  acceptTerms?: unknown;
  locale?: unknown;
};

type ValidationResult =
  | {
      ok: true;
      email: string;
      phoneE164: string;
      countryCode: string | null;
      password: string;
      locale: Locale;
    }
  | {
      ok: false;
      error: string;
      status: number;
      locale: Locale;
    };

/* ==========================================================
   TRADUCTIONS
========================================================== */

const MESSAGES = {
  fr: {
    invalidRequest:
      "Les informations envoyées sont invalides.",

    invalidEmail:
      "Veuillez saisir une adresse email valide.",

    invalidPhone:
      "Veuillez saisir un numéro de téléphone international valide.",

    weakPassword:
      "Le mot de passe doit contenir au moins 12 caractères.",

    termsRequired:
      "Vous devez accepter les conditions d'utilisation et la politique de confidentialité.",

    alreadyRegistered:
      "Cette adresse email possède déjà un compte. Veuillez vous connecter.",

    invalidCredentials:
      "Impossible de poursuivre l'inscription avec ces informations.",

    tooManyRequests:
      "Trop de demandes de vérification. Veuillez réessayer plus tard.",

    waitBeforeRetry:
      "Un code a été demandé récemment. Veuillez patienter avant de réessayer.",

    configurationError:
      "Le service d'inscription est temporairement indisponible.",

    emailError:
      "Le code de vérification n'a pas pu être envoyé. Veuillez réessayer plus tard.",

    success:
      "Un code de vérification à six chiffres a été envoyé à votre adresse email.",
  },

  en: {
    invalidRequest:
      "Invalid registration information.",

    invalidEmail:
      "Please enter a valid email address.",

    invalidPhone:
      "Please enter a valid international phone number.",

    weakPassword:
      "Your password must contain at least 12 characters.",

    termsRequired:
      "You must accept the terms of use and privacy policy.",

    alreadyRegistered:
      "An account already exists with this email. Please sign in.",

    invalidCredentials:
      "Unable to continue registration with these details.",

    tooManyRequests:
      "Too many verification requests. Please try again later.",

    waitBeforeRetry:
      "A verification code was requested recently. Please wait before trying again.",

    configurationError:
      "Registration is temporarily unavailable.",

    emailError:
      "We could not send the verification email. Please try again later.",

    success:
      "A six-digit verification code has been sent to your email address.",
  },
} as const;

type MessageKey = keyof typeof MESSAGES.fr;

/* ==========================================================
   PRISMA 7

   Même approche que les API organisateur
   déjà développées dans TIKEMIA.
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
  body: Record<string, unknown>,
  status = 200,
  extraHeaders?: Record<string, string>
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

function failure(
  locale: Locale,
  code: MessageKey,
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
      ? { "Retry-After": String(retryAfter) }
      : undefined
  );
}

/* ==========================================================
   ORIGINE

   Requête provenant du site TIKEMIA.
========================================================== */

function validOrigin(
  request: NextRequest
): boolean {
  if (
    request.headers.get("sec-fetch-site") ===
    "cross-site"
  ) {
    return false;
  }

  const origin =
    request.headers.get("origin");

  if (!origin) {
    return true;
  }

  return origin === request.nextUrl.origin;
}

/* ==========================================================
   VALIDATION EMAIL
========================================================== */

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
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return null;
  }

  return email;
}

/* ==========================================================
   VALIDATION TÉLÉPHONE

   Le formulaire doit transmettre
   un numéro complet international.

   Exemples :
   +229...
   +225...
   +33...
   +234...

   La sélection automatique du pays
   est effectuée dans l'interface.

   Ici, le serveur valide le numéro.
========================================================== */

function normalizePhone(
  value: unknown
): {
  phoneE164: string;
  countryCode: string | null;
} | null {
  if (typeof value !== "string") {
    return null;
  }

  const raw = value.trim();

  if (
    !raw.startsWith("+") ||
    raw.length > 35
  ) {
    return null;
  }

  try {
    const phone =
      parsePhoneNumberFromString(raw);

    if (
      !phone ||
      !phone.isValid()
    ) {
      return null;
    }

    return {
      phoneE164: phone.number,
      countryCode: phone.country ?? null,
    };
  } catch {
    return null;
  }
}

/* ==========================================================
   VALIDATION DU FORMULAIRE
========================================================== */

function validateInput(
  body: RegistrationBody
): ValidationResult {
  const locale: Locale =
    body.locale === "en" ? "en" : "fr";

  const email =
    normalizeEmail(body.email);

  if (!email) {
    return {
      ok: false,
      error: "invalidEmail",
      status: 400,
      locale,
    };
  }

  const phone =
    normalizePhone(
      body.phoneE164 ?? body.phone
    );

  if (!phone) {
    return {
      ok: false,
      error: "invalidPhone",
      status: 400,
      locale,
    };
  }

  const password = body.password;

  if (
    typeof password !== "string" ||
    Array.from(password).length <
      MIN_PASSWORD_LENGTH ||
    Buffer.byteLength(password, "utf8") >
      MAX_PASSWORD_BYTES
  ) {
    return {
      ok: false,
      error: "weakPassword",
      status: 400,
      locale,
    };
  }

  if (body.acceptTerms !== true) {
    return {
      ok: false,
      error: "termsRequired",
      status: 400,
      locale,
    };
  }

  return {
    ok: true,
    email,
    phoneE164: phone.phoneE164,
    countryCode: phone.countryCode,
    password,
    locale,
  };
}

/* ==========================================================
   MOT DE PASSE — SCRYPT

   Format stocké :
   scrypt:v1:N:r:p:salt:hash

   Algorithme de dérivation de clé
   résistant aux attaques hors ligne.

   IMPORTANT :
   La future API de connexion doit
   reconnaître le même format.

   Aucun mot de passe n'est journalisé.
========================================================== */

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;

async function hashPassword(
  password: string
): Promise<string> {
  const salt =
    randomBytes(32).toString("hex");

  const derived =
    (await scrypt(
      password,
      Buffer.from(salt, "hex"),
      SCRYPT_KEY_LENGTH,
      {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: 64 * 1024 * 1024,
      }
    )) as Buffer;

  return [
    "scrypt",
    "v1",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt,
    derived.toString("hex"),
  ].join(":");
}

/* ==========================================================
   VÉRIFICATION DU MOT DE PASSE

   Utilisée uniquement lorsqu'un compte
   non encore vérifié demande un
   nouveau code d'inscription.

   On ne remplace jamais le mot de
   passe d'un compte existant sans
   une authentification préalable.
========================================================== */

async function verifyPassword(
  password: string,
  stored: string | null
): Promise<boolean> {
  if (!stored) {
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
    return false;
  }

  const n = Number(parts[2]);
  const r = Number(parts[3]);
  const p = Number(parts[4]);
  const salt = parts[5];
  const expectedHex = parts[6];

  if (
    n !== SCRYPT_N ||
    r !== SCRYPT_R ||
    p !== SCRYPT_P ||
    !/^[a-f0-9]{64}$/i.test(salt) ||
    !/^[a-f0-9]{128}$/i.test(expectedHex)
  ) {
    return false;
  }

  const expected =
    Buffer.from(expectedHex, "hex");

  const actual =
    (await scrypt(
      password,
      Buffer.from(salt, "hex"),
      SCRYPT_KEY_LENGTH,
      {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: 64 * 1024 * 1024,
      }
    )) as Buffer;

  return timingSafeEqual(
    expected,
    actual
  );
}

/* ==========================================================
   OTP — GÉNÉRATION SÉCURISÉE

   randomInt utilise le générateur
   cryptographique de Node.js.

   Toujours exactement six chiffres,
   y compris les zéros initiaux.
========================================================== */

function createOtpCode(): string {
  return randomInt(
    0,
    1_000_000
  )
    .toString()
    .padStart(6, "0");
}

/* ==========================================================
   HACHAGE OTP

   EXACTEMENT compatible avec :
   src/app/api/auth/verify-email/route.ts

   On réutilise :
   - Le même secret
   - Le même préfixe
   - Le même ordre des données
   - Les mêmes séparateurs

   Aucun OTP stocké en clair.
========================================================== */

function hashVerificationCode(
  userId: string,
  email: string,
  code: string
): string {
  const secret =
    process.env.TIKEMIA_OTP_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "TIKEMIA_OTP_SECRET_NOT_CONFIGURED"
    );
  }

  return createHmac("sha256", secret)
    .update(
      "tikemia:email-verification:v1"
    )
    .update("\0")
    .update(userId)
    .update("\0")
    .update(email)
    .update("\0")
    .update(code)
    .digest("hex");
}

/* ==========================================================
   EMAIL — CONTENU

   Aucun lien contenant le code.
   Le client saisit les six chiffres
   sur la page de vérification.

   Les textes sont simples et
   professionnels.
========================================================== */

function verificationEmailContent(
  code: string,
  locale: Locale
): {
  subject: string;
  text: string;
  html: string;
} {
  const fr = locale === "fr";

  const subject = fr
    ? "TIKEMIA — Vérifiez votre adresse email"
    : "TIKEMIA — Verify your email address";

  const headline = fr
    ? "Votre code de vérification"
    : "Your verification code";

  const expiration = fr
    ? "Ce code est valable pendant 10 minutes."
    : "This code is valid for 10 minutes.";

  const warning = fr
    ? "Si vous n'avez pas demandé cette inscription, ignorez cet email."
    : "If you did not request this registration, ignore this email.";

  return {
    subject,

    text:
      `TIKEMIA\n\n` +
      `${headline} : ${code}\n\n` +
      `${expiration}\n\n` +
      `${warning}`,

    html: `
      <!DOCTYPE html>
      <html lang="${fr ? "fr" : "en"}">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport"
                content="width=device-width,initial-scale=1" />
        </head>
        <body style="
          margin:0;
          padding:32px 16px;
          background:#f4f7f5;
          font-family:Arial,Helvetica,sans-serif;
          color:#182c20;
        ">
          <div style="
            max-width:520px;
            margin:0 auto;
            padding:32px 24px;
            border-radius:16px;
            background:#ffffff;
            border:1px solid #e0e9e2;
          ">
            <h1 style="
              margin:0 0 22px;
              color:#087c2d;
              font-size:28px;
            ">TIKEMIA</h1>

            <p style="
              margin:0 0 18px;
              font-size:17px;
              font-weight:bold;
            ">${headline}</p>

            <div style="
              padding:20px 12px;
              background:#edf8f0;
              border-radius:12px;
              text-align:center;
              font-size:36px;
              font-weight:bold;
              letter-spacing:8px;
              color:#075e2b;
            ">${code}</div>

            <p style="
              margin:22px 0 10px;
              font-size:14px;
            ">${expiration}</p>

            <p style="
              margin:0;
              color:#708177;
              font-size:12px;
              line-height:1.6;
            ">${warning}</p>
          </div>
        </body>
      </html>
    `,
  };
}

/* ==========================================================
   EMAIL — ENVOI

   Intégration directe avec Resend.

   Variables privées :
   - RESEND_API_KEY
   - TIKEMIA_EMAIL_FROM

   Le domaine d'expédition doit
   être vérifié chez le prestataire.

   Aucun envoi fictif.
   Aucun code retourné au navigateur.
========================================================== */

async function sendVerificationEmail(
  email: string,
  code: string,
  locale: Locale
): Promise<void> {
  const apiKey =
    process.env.RESEND_API_KEY;

  const sender =
    (process.env.TIKEMIA_EMAIL_FROM || process.env.RESEND_FROM_EMAIL);

  if (!apiKey || !sender) {
    throw new Error(
      "EMAIL_PROVIDER_NOT_CONFIGURED"
    );
  }

  const content =
    verificationEmailContent(
      code,
      locale
    );

  const controller =
    new AbortController();

  const timeout =
    setTimeout(() => {
      controller.abort();
    }, 10000);

  try {
    const response = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${apiKey}`,

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          from: sender,
          to: [email],
          subject: content.subject,
          text: content.text,
          html: content.html,
        }),

        signal: controller.signal,
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(
        "EMAIL_PROVIDER_REJECTED"
      );
    }

    const result: unknown =
      await response.json();

    if (
      !result ||
      typeof result !== "object" ||
      !("id" in result) ||
      typeof result.id !== "string"
    ) {
      throw new Error(
        "EMAIL_PROVIDER_INVALID_RESPONSE"
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}

/* ==========================================================
   POST /api/auth/register
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
      return failure(
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
      return failure(
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
      Buffer.byteLength(
        rawBody,
        "utf8"
      ) > MAX_BODY_BYTES
    ) {
      return failure(
        locale,
        "invalidRequest",
        413
      );
    }

    /* ======================================================
       2. LECTURE JSON
    ====================================================== */

    let body: RegistrationBody;

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

      body =
        parsed as RegistrationBody;
    } catch {
      return failure(
        locale,
        "invalidRequest",
        400
      );
    }

    /* ======================================================
       3. VALIDATION
    ====================================================== */

    const input =
      validateInput(body);

    locale = input.locale;

    if (!input.ok) {
      const messageKey =
        input.error as MessageKey;

      return failure(
        locale,
        messageKey,
        input.status
      );
    }

    /* ======================================================
       4. CONFIGURATION

       On vérifie avant de créer
       un compte en base.

       Aucun faux envoi d'email.
    ====================================================== */

    if (
      !process.env.TIKEMIA_OTP_SECRET ||
      process.env.TIKEMIA_OTP_SECRET
        .length < 32 ||
      !process.env.RESEND_API_KEY ||
      !(process.env.TIKEMIA_EMAIL_FROM || process.env.RESEND_FROM_EMAIL)
    ) {
      return failure(
        locale,
        "configurationError",
        503
      );
    }

    const prisma = getPrisma();

    /* ======================================================
       5. UTILISATEUR EXISTANT

       Compte déjà vérifié :
       pas de nouvelle inscription.

       Compte non vérifié :
       vérifier le mot de passe
       avant de renvoyer un code.

       Ne jamais écraser le compte
       d'un autre utilisateur.
    ====================================================== */

    const existing =
      await prisma.user.findUnique({
        where: {
          email: input.email,
        },

        select: {
          id: true,
          email: true,
          phoneE164: true,
          passwordHash: true,
          isActive: true,
          isBlocked: true,
          emailVerifiedAt: true,
        },
      });

    if (existing?.emailVerifiedAt) {
      return failure(
        locale,
        "alreadyRegistered",
        409
      );
    }

    if (
      existing &&
      (
        !existing.isActive ||
        existing.isBlocked
      )
    ) {
      return failure(
        locale,
        "invalidCredentials",
        403
      );
    }

    if (existing) {
      const passwordMatches =
        await verifyPassword(
          input.password,
          existing.passwordHash
        );

      if (!passwordMatches) {
        return failure(
          locale,
          "invalidCredentials",
          400
        );
      }
    }

    /* ======================================================
       6. LIMITATION DES CODES

       Maximum :
       - Un nouveau code toutes
         les 60 secondes
       - Cinq codes par heure
         pour ce compte

       Les tentatives de vérification
       sont limitées séparément
       dans /api/auth/verify-email.
    ====================================================== */

    const now = new Date();

    const oneHourAgo = new Date(
      now.getTime() -
        60 * 60 * 1000
    );

    if (existing) {
      const recentCodes =
        await prisma.userEmailVerification.findMany({
          where: {
            userId: existing.id,
            createdAt: {
              gte: oneHourAgo,
            },
          },

          orderBy: {
            createdAt: "desc",
          },

          select: {
            createdAt: true,
          },
        });

      if (
        recentCodes.length >=
        MAX_OTP_PER_HOUR
      ) {
        return failure(
          locale,
          "tooManyRequests",
          429,
          3600
        );
      }

      const latest =
        recentCodes[0];

      if (latest) {
        const elapsed =
          now.getTime() -
          latest.createdAt.getTime();

        if (
          elapsed <
          OTP_COOLDOWN_SECONDS *
            1000
        ) {
          const retryAfter =
            Math.ceil(
              (
                OTP_COOLDOWN_SECONDS *
                1000 -
                elapsed
              ) / 1000
            );

          return failure(
            locale,
            "waitBeforeRetry",
            429,
            retryAfter
          );
        }
      }
    }

    /* ======================================================
       7. PRÉPARER LE MOT DE PASSE

       Uniquement pour un nouveau compte.

       Un ancien compte non vérifié
       conserve son hash original.
    ====================================================== */

    const passwordHash =
      existing
        ? null
        : await hashPassword(
            input.password
          );

    /* ======================================================
       8. GÉNÉRER LE CODE OTP
    ====================================================== */

    const code =
      createOtpCode();

    const otpExpiresAt = new Date(
      Date.now() +
        OTP_DURATION_MINUTES *
          60 *
          1000
    );

    /* ======================================================
       9. CRÉATION TRANSACTIONNELLE

       Pour un nouveau compte :
       - User
       - Role CLIENT
       - OTP

       Pour un compte non vérifié :
       - Nouveau OTP
       - Invalidation des anciens
         codes non consommés

       Aucune session ici.
    ====================================================== */

    const verification =
      await prisma.$transaction(
        async (tx) => {
          let userId: string;

          if (existing) {
            userId = existing.id;
          } else {
            const created =
              await tx.user.create({
                data: {
                  /*
                   * Le formulaire public
                   * ne demande pas de nom.
                   *
                   * Ce champ Prisma est
                   * obligatoire.
                   *
                   * On ne fabrique donc
                   * aucune identité.
                   */

                  fullName: "",

                  email:
                    input.email,

                  phoneE164:
                    input.phoneE164,

                  countryCode:
                    input.countryCode,

                  passwordHash:
                    passwordHash!,

                  emailVerifiedAt:
                    null,

                  preferredLocale:
                    locale,

                  isActive: true,

                  isBlocked: false,

                  roles: {
                    create: {
                      role: "CLIENT",
                    },
                  },
                },

                select: {
                  id: true,
                },
              });

            userId = created.id;
          }

          /*
           * Les codes précédents
           * deviennent inutilisables.
           */

          await tx.userEmailVerification.updateMany({
            where: {
              userId,
              consumedAt: null,
            },

            data: {
              consumedAt:
                new Date(),
            },
          });

          const codeHash =
            hashVerificationCode(
              userId,
              input.email,
              code
            );

          const createdVerification =
            await tx.userEmailVerification.create({
              data: {
                userId,

                email:
                  input.email,

                codeHash,

                attempts: 0,

                expiresAt:
                  otpExpiresAt,
              },

              select: {
                id: true,
              },
            });

          return {
            id:
              createdVerification.id,

            userId,
          };
        },
        {
          maxWait: 5000,
          timeout: 15000,
        }
      );

    /* ======================================================
       10. ENVOI RÉEL DE L'EMAIL

       Le code n'est jamais envoyé
       dans la réponse API.

       On utilise le prestataire
       email configuré.
    ====================================================== */

    try {
      await sendVerificationEmail(
        input.email,
        code,
        locale
      );
    } catch {
      /*
       * En cas d'échec :
       * - Le compte n'est pas activé.
       * - Le code non envoyé est annulé.
       * - Le client reçoit une erreur.
       *
       * Une nouvelle demande reste
       * possible après temporisation.
       */

      await prisma.userEmailVerification.updateMany({
        where: {
          id: verification.id,
          consumedAt: null,
        },

        data: {
          consumedAt: new Date(),
        },
      });

      return failure(
        locale,
        "emailError",
        503
      );
    }

    /* ======================================================
       11. RÉPONSE

       Aucun code OTP exposé.
       Aucun token de session exposé.

       Le client doit maintenant
       vérifier son adresse email.
    ====================================================== */

    return respond(
      {
        success: true,

        verificationRequired: true,

        message:
          MESSAGES[locale].success,

        redirectTo:
          VERIFY_URL,

        data: {
          email:
            input.email,

          expiresInSeconds:
            OTP_DURATION_MINUTES *
            60,

          resendAfterSeconds:
            OTP_COOLDOWN_SECONDS,
        },
      },
      existing ? 200 : 201
    );
  } catch (error) {
    unstable_rethrow(error);
    /*
     * Conflit email unique :
     * deux inscriptions concurrentes.
     */

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return failure(
        locale,
        "alreadyRegistered",
        409
      );
    }

    console.error(
      "[TIKEMIA_PUBLIC_REGISTER_ERROR]",
      error instanceof Error
        ? error.message
        : "UNKNOWN_ERROR"
    );

    return failure(
      locale,
      "configurationError",
      503
    );
  }
}
