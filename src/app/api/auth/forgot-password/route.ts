import { getTrustedRequestOrigin } from "@/lib/tikemia-pay/providers";
import { unstable_rethrow } from "next/navigation";

import {
  createHmac,
  randomInt,
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
   TIKEMIA — MOT DE PASSE OUBLIÉ

   FICHIER :
   src/app/api/auth/forgot-password/route.ts

   ROUTE :
   POST /api/auth/forgot-password

   ENTRÉE JSON :
   {
     "email": "client@example.com",
     "locale": "fr"
   }

   FONCTION :
   - Recevoir l'adresse email
   - Vérifier le format de l'email
   - Rechercher un compte vérifié
   - Générer un code à six chiffres
   - Protéger le code par HMAC-SHA256
   - Enregistrer le code dans Prisma
   - Envoyer le code par email
   - Limiter les demandes répétées
   - Invalider les anciens codes

   COMPATIBLE AVEC :
   src/app/api/auth/reset-password/route.ts

   RÈGLES :
   - Email uniquement
   - Aucun numéro de téléphone
   - Aucun code retourné dans le JSON
   - Code valable 10 minutes
   - Un nouveau code toutes les 60 secondes
   - Maximum cinq codes par heure
   - Cinq tentatives de validation par code
   - Aucune session créée
   - Aucun mot de passe modifié ici

   MODÈLES PRISMA EXISTANTS :
   - User
   - UserEmailVerification

   AUCUN NOUVEAU MODÈLE.
   AUCUNE MIGRATION PRISMA.
   AUCUN NOUVEAU FICHIER.
========================================================== */

/* ==========================================================
   CONFIGURATION
========================================================== */

const MAX_BODY_BYTES = 4096;

const OTP_LENGTH = 6;

const OTP_EXPIRATION_MINUTES = 10;

const OTP_COOLDOWN_SECONDS = 60;

const MAX_CODES_PER_HOUR = 5;

const EMAIL_TIMEOUT_MS = 10000;

/*
 * OBLIGATOIRE :
 *
 * Ce contexte doit être identique
 * à celui de reset-password/route.ts.
 *
 * Il est différent du contexte
 * utilisé pour l'inscription.
 */

const RESET_HMAC_CONTEXT =
  "tikemia:password-reset:v1";

type Locale = "fr" | "en";

type RequestBody = {
  email?: unknown;
  locale?: unknown;
};

/* ==========================================================
   TEXTES FRANÇAIS / ANGLAIS
========================================================== */

const MESSAGES = {
  fr: {
    invalidRequest:
      "La demande est invalide.",

    invalidEmail:
      "Veuillez saisir une adresse email valide.",

    accepted:
      "Si cette adresse email possède un compte TIKEMIA, un code de réinitialisation vous sera envoyé.",

    unavailable:
      "Le service de récupération du mot de passe est temporairement indisponible.",

    emailSubject:
      "TIKEMIA — Réinitialisation du mot de passe",

    emailTitle:
      "Réinitialisation de votre mot de passe",

    emailIntro:
      "Voici votre code de vérification pour définir un nouveau mot de passe.",

    emailExpiration:
      "Ce code est valable pendant 10 minutes.",

    emailWarning:
      "Si vous n'avez pas demandé cette opération, ignorez cet email.",

    emailSecurity:
      "Ne communiquez ce code à personne.",
  },

  en: {
    invalidRequest:
      "Invalid request.",

    invalidEmail:
      "Please enter a valid email address.",

    accepted:
      "If this email address has a TIKEMIA account, a password reset code will be sent.",

    unavailable:
      "Password recovery is temporarily unavailable.",

    emailSubject:
      "TIKEMIA — Password reset",

    emailTitle:
      "Reset your password",

    emailIntro:
      "Here is your verification code to set a new password.",

    emailExpiration:
      "This code is valid for 10 minutes.",

    emailWarning:
      "If you did not request this operation, ignore this email.",

    emailSecurity:
      "Never share this code with anyone.",
  },
} as const;

/* ==========================================================
   PRISMA 7 — CLIENT PARTAGÉ

   Même fonctionnement que les
   autres API d'authentification
   déjà préparées pour TIKEMIA.

   PostgreSQL via PrismaPg.
========================================================== */

const prismaGlobal =
  globalThis as typeof globalThis & {
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

  const prisma = new PrismaClient({
    adapter,
  });

  prismaGlobal.tikemiaPrisma =
    prisma;

  return prisma;
}

/* ==========================================================
   RÉPONSES HTTP
========================================================== */

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  retryAfter?: number
) {
  const headers: Record<string, string> = {
    "Cache-Control":
      "no-store, no-cache, must-revalidate",

    "X-Content-Type-Options":
      "nosniff",
  };

  if (
    retryAfter !== undefined &&
    retryAfter > 0
  ) {
    headers["Retry-After"] =
      String(retryAfter);
  }

  return NextResponse.json(body, {
    status,
    headers,
  });
}

function errorResponse(
  locale: Locale,
  code: "invalidRequest" | "invalidEmail" | "unavailable",
  status: number
) {
  return jsonResponse(
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
   ORIGINE DE LA REQUÊTE

   Les formulaires publics utilisent
   des requêtes POST de même origine.

   Ne pas accepter les appels provenant
   explicitement d'un site tiers.
========================================================== */

function validOrigin(
  request: NextRequest
): boolean {
  const fetchSite =
    request.headers.get(
      "sec-fetch-site"
    );

  if (fetchSite === "cross-site") {
    return false;
  }

  const origin =
    request.headers.get("origin");

  if (!origin) {
    return true;
  }

  return (
    origin === getTrustedRequestOrigin(request)
  );
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
    email.length > 254
  ) {
    return null;
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    return null;
  }

  return email;
}

/* ==========================================================
   GÉNÉRATION CRYPTOGRAPHIQUE DU CODE

   Code à six chiffres :

   000000 à 999999.

   randomInt utilise le générateur
   cryptographiquement sûr de Node.js.

   Aucun Math.random().
========================================================== */

function generateResetCode(): string {
  return randomInt(
    0,
    10 ** OTP_LENGTH
  )
    .toString()
    .padStart(OTP_LENGTH, "0");
}

/* ==========================================================
   HACHAGE DU CODE

   COMPATIBILITÉ OBLIGATOIRE AVEC :

   src/app/api/auth/reset-password/route.ts

   Fonction :
   hashResetCode(userId, email, code)

   Même :
   - Clé secrète
   - Contexte
   - Séparateurs
   - Ordre des paramètres
   - Encodage hexadécimal

   Les codes d'inscription ne peuvent
   pas remplacer les codes de reset
   car leur contexte HMAC est différent.
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

  return createHmac(
    "sha256",
    secret
  )
    .update(
      RESET_HMAC_CONTEXT
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
   PRÉPARATION DU MESSAGE EMAIL

   Simple et professionnel.

   Aucun lien contenant le code.

   Le code sera saisi dans
   le formulaire TIKEMIA.
========================================================== */

function buildEmailContent(
  code: string,
  locale: Locale
) {
  const t = MESSAGES[locale];

  const text = [
    "TIKEMIA",
    "",
    t.emailTitle,
    "",
    t.emailIntro,
    "",
    code,
    "",
    t.emailExpiration,
    t.emailSecurity,
    "",
    t.emailWarning,
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >
</head>

<body style="
  margin:0;
  padding:32px 16px;
  background-color:#f4f7f5;
  font-family:Arial,Helvetica,sans-serif;
  color:#172e20;
">

  <div style="
    max-width:520px;
    margin:0 auto;
    border:1px solid #e1e9e3;
    border-radius:16px;
    padding:32px 24px;
    background-color:#ffffff;
  ">

    <div style="
      margin-bottom:24px;
      font-size:29px;
      font-weight:800;
      color:#087b2c;
    ">
      TIKEMIA
    </div>

    <h1 style="
      margin:0 0 15px;
      font-size:22px;
      line-height:1.3;
      color:#153d25;
    ">
      ${t.emailTitle}
    </h1>

    <p style="
      font-size:14px;
      line-height:1.7;
      margin:0 0 20px;
    ">
      ${t.emailIntro}
    </p>

    <div style="
      background-color:#edf8f0;
      border-radius:12px;
      padding:22px 12px;
      text-align:center;
      color:#065b27;
      font-size:36px;
      font-weight:800;
      letter-spacing:8px;
    ">
      ${code}
    </div>

    <p style="
      margin:23px 0 8px;
      font-size:14px;
      line-height:1.7;
    ">
      ${t.emailExpiration}
    </p>

    <p style="
      margin:0 0 17px;
      font-size:13px;
      color:#486756;
    ">
      ${t.emailSecurity}
    </p>

    <div style="
      border-top:1px solid #e5ece6;
      padding-top:17px;
      font-size:12px;
      line-height:1.7;
      color:#758578;
    ">
      ${t.emailWarning}
    </div>

  </div>

</body>
</html>
`;

  return {
    subject: t.emailSubject,
    text,
    html,
  };
}

/* ==========================================================
   ENVOI EMAIL VIA RESEND

   VARIABLES D'ENVIRONNEMENT :
   - RESEND_API_KEY
   - TIKEMIA_EMAIL_FROM

   Aucun code n'est affiché
   dans la réponse HTTP.

   Aucun mode simulé.
========================================================== */

async function sendResetEmail(
  destination: string,
  code: string,
  locale: Locale
): Promise<void> {
  const apiKey =
    process.env.RESEND_API_KEY;

  const sender =
    (process.env.TIKEMIA_EMAIL_FROM || process.env.RESEND_FROM_EMAIL);

  if (
    !apiKey ||
    !sender
  ) {
    throw new Error(
      "EMAIL_PROVIDER_NOT_CONFIGURED"
    );
  }

  const content =
    buildEmailContent(
      code,
      locale
    );

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      EMAIL_TIMEOUT_MS
    );

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

          to: [destination],

          subject:
            content.subject,

          text: content.text,

          html: content.html,
        }),

        signal:
          controller.signal,

        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(
        "RESET_EMAIL_DELIVERY_REJECTED"
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
        "RESET_EMAIL_INVALID_RESPONSE"
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}

/* ==========================================================
   RÉPONSE STANDARD

   Même réponse pour :
   - Compte existant
   - Compte inexistant
   - Compte non vérifié
   - Compte désactivé
   - Demande limitée

   Cette uniformité évite de révéler
   si un email est inscrit sur TIKEMIA.
========================================================== */

function acceptedResponse(
  locale: Locale
) {
  return jsonResponse(
    {
      success: true,

      message:
        MESSAGES[locale].accepted,

      resetRequested: true,

      nextStep:
        "verify-reset-code",

      data: {
        codeLength:
          OTP_LENGTH,

        expiresInSeconds:
          OTP_EXPIRATION_MINUTES * 60,
      },
    },
    200
  );
}

/* ==========================================================
   POST — DEMANDE DE RÉINITIALISATION
========================================================== */

export async function POST(
  request: NextRequest
) {
  let locale: Locale = "fr";

  try {
    /* ======================================================
       1. VALIDATION DE L'ORIGINE
    ====================================================== */

    if (!validOrigin(request)) {
      return errorResponse(
        locale,
        "invalidRequest",
        403
      );
    }

    /* ======================================================
       2. TYPE DE CONTENU
    ====================================================== */

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
        locale,
        "invalidRequest",
        415
      );
    }

    /* ======================================================
       3. TAILLE DU CORPS
    ====================================================== */

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
      return errorResponse(
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
      return errorResponse(
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
        return errorResponse(
          locale,
          "invalidRequest",
          400
        );
      }

      body =
        parsed as RequestBody;
    } catch {
      return errorResponse(
        locale,
        "invalidRequest",
        400
      );
    }

    /* ======================================================
       5. VALIDATION EMAIL

       Aucun numéro de téléphone.

       Seule l'adresse email est acceptée.
    ====================================================== */

    locale =
      resolveLocale(
        body.locale
      );

    const email =
      normalizeEmail(
        body.email
      );

    if (!email) {
      return errorResponse(
        locale,
        "invalidEmail",
        400
      );
    }

    /* ======================================================
       6. VÉRIFIER LA CONFIGURATION

       On vérifie les services avant
       de créer un nouveau code.

       Une erreur d'infrastructure
       ne doit pas être interprétée
       comme un email envoyé.
    ====================================================== */

    if (
      !process.env.TIKEMIA_OTP_SECRET ||
      process.env.TIKEMIA_OTP_SECRET.length < 32 ||
      !process.env.RESEND_API_KEY ||
      !(process.env.TIKEMIA_EMAIL_FROM || process.env.RESEND_FROM_EMAIL)
    ) {
      console.error(
        "[TIKEMIA_FORGOT_PASSWORD_CONFIGURATION]"
      );

      return errorResponse(
        locale,
        "unavailable",
        503
      );
    }

    const prisma =
      getPrisma();

    /* ======================================================
       7. RECHERCHE DU COMPTE

       Le reset concerne uniquement
       les comptes actifs dont l'email
       a déjà été vérifié.

       Nous ne dévoilons pas
       l'existence d'un compte.
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
      return acceptedResponse(
        locale
      );
    }

    /* ======================================================
       8. GÉNÉRATION DU CODE

       Nouveau code cryptographique
       de six chiffres.

       HMAC lié :
       - À l'identifiant utilisateur
       - À son email vérifié
       - Au contexte password-reset

       Le code en clair restera
       uniquement en mémoire avant
       son envoi au fournisseur email.
    ====================================================== */

    const code =
      generateResetCode();

    const codeHash =
      hashResetCode(
        user.id,
        email,
        code
      );

    const now =
      new Date();

    const expiration =
      new Date(
        now.getTime() +
        OTP_EXPIRATION_MINUTES *
        60 *
        1000
      );

    const hourlyCutoff =
      new Date(
        now.getTime() -
        60 * 60 * 1000
      );

    /*
     * Les codes d'inscription ont été
     * émis avant la vérification email.

     * Comme le schéma ne possède
     * pas de champ "purpose", on compte
     * seulement les demandes émises
     * après l'activation du compte.
     */

    const countFrom =
      user.emailVerifiedAt > hourlyCutoff
        ? user.emailVerifiedAt
        : hourlyCutoff;

    /* ======================================================
       9. TRANSACTION PRISMA

       - Verrouiller l'utilisateur
       - Contrôler les demandes
       - Invalider les anciens codes
       - Enregistrer le nouveau HMAC

       Le verrou évite deux demandes
       simultanées qui contourneraient
       la limite de fréquence.
    ====================================================== */

    const issued =
      await prisma.$transaction(
        async (tx) => {

          /* ==============================================
             VERROUILLAGE UTILISATEUR

             Le modèle User possède
             un identifiant UUID.
          ============================================== */

          await tx.$queryRaw`
            SELECT "id"
            FROM "User"
            WHERE "id" = ${user.id}::uuid
            FOR UPDATE
          `;

          /* ==============================================
             RELIRE LE COMPTE

             Vérification de sécurité
             après verrouillage.
          ============================================== */

          const currentUser =
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
              },
            });

          if (
            !currentUser ||
            currentUser.email !== email ||
            !currentUser.isActive ||
            currentUser.isBlocked ||
            !currentUser.emailVerifiedAt
          ) {
            return {
              created: false as const,
              verificationId: null,
            };
          }

          /* ==============================================
             LIMITE DES DEMANDES

             Maximum 5 demandes
             après vérification du compte
             dans une fenêtre d'une heure.
          ============================================== */

          const requestCount =
            await tx.userEmailVerification.count({
              where: {
                userId:
                  currentUser.id,

                createdAt: {
                  gte: countFrom,
                },
              },
            });

          if (
            requestCount >=
            MAX_CODES_PER_HOUR
          ) {
            return {
              created: false as const,
              verificationId: null,
            };
          }

          /* ==============================================
             TEMPORISATION DE 60 SECONDES
          ============================================== */

          const latest =
            await tx.userEmailVerification.findFirst({
              where: {
                userId:
                  currentUser.id,

                createdAt: {
                  gte:
                    currentUser.emailVerifiedAt,
                },
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
                createdAt: true,
              },
            });

          if (latest) {
            const elapsed =
              now.getTime() -
              latest.createdAt.getTime();

            if (
              elapsed <
              OTP_COOLDOWN_SECONDS *
              1000
            ) {
              return {
                created: false as const,
                verificationId: null,
              };
            }
          }

          /* ==============================================
             ANNULER LES ANCIENS CODES

             Un seul code actif
             par compte.
          ============================================== */

          await tx.userEmailVerification.updateMany({
            where: {
              userId:
                currentUser.id,

              consumedAt: null,
            },

            data: {
              consumedAt:
                now,
            },
          });

          /* ==============================================
             ENREGISTRER LE NOUVEAU CODE

             Le code en clair ne va
             jamais dans PostgreSQL.
          ============================================== */

          const verification =
            await tx.userEmailVerification.create({
              data: {
                userId:
                  currentUser.id,

                email,

                codeHash,

                attempts: 0,

                expiresAt:
                  expiration,
              },

              select: {
                id: true,
              },
            });

          return {
            created: true as const,

            verificationId:
              verification.id,
          };
        },
        {
          maxWait: 5000,
          timeout: 10000,
        }
      );

    /* ======================================================
       10. DEMANDE LIMITÉE

       On conserve une réponse générique.

       Un visiteur ne peut pas savoir
       si le compte existe, ni si le
       code a été temporairement limité.
    ====================================================== */

    if (
      !issued.created ||
      !issued.verificationId
    ) {
      return acceptedResponse(
        locale
      );
    }

    /* ======================================================
       11. ENVOI EMAIL RÉEL

       Les informations d'envoi
       restent sur le serveur.

       L'adresse destinataire est
       celle du compte vérifié.
    ====================================================== */

    try {
      await sendResetEmail(
        user.email,
        code,
        locale
      );
    } catch {
      /*
       * Le fournisseur n'a pas confirmé
       * l'acceptation de l'email.

       * Le code est invalidé pour éviter
       * de conserver un code inutilisable.
       */

      await prisma.userEmailVerification.updateMany({
        where: {
          id:
            issued.verificationId,

          consumedAt: null,
        },

        data: {
          consumedAt:
            new Date(),
        },
      });

      console.error(
        "[TIKEMIA_FORGOT_PASSWORD_EMAIL_FAILED]"
      );

      return errorResponse(
        locale,
        "unavailable",
        503
      );
    }

    /* ======================================================
       12. SUCCÈS

       Le prestataire a accepté
       la demande d'envoi.

       Le code ne figure jamais
       dans la réponse JSON.

       L'utilisateur peut saisir
       son code puis son nouveau
       mot de passe.
    ====================================================== */

    return acceptedResponse(
      locale
    );

  } catch (error) {
    unstable_rethrow(error);
    /* ======================================================
       13. GESTION DES ERREURS

       Aucune donnée secrète exposée.

       Ne jamais journaliser :
       - Le code
       - Le secret HMAC
       - Les clés Resend
       - Le mot de passe du client
    ====================================================== */

    console.error(
      "[TIKEMIA_FORGOT_PASSWORD_ERROR]",
      error instanceof Error
        ? error.name
        : "UNKNOWN_ERROR"
    );

    return errorResponse(
      locale,
      "unavailable",
      503
    );
  }
}

/* ==========================================================
   FIN DE L'API

   SEULE LA MÉTHODE POST EST AUTORISÉE.

   AUCUN CODE OTP DANS L'URL.

   AUCUN MOT DE PASSE MODIFIÉ ICI.

   LA SUITE SE PASSE DANS :
   /api/auth/reset-password
========================================================== */
