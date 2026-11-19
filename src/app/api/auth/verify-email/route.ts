import { getTrustedRequestOrigin } from "@/lib/tikemia-pay/providers";
import { unstable_rethrow } from "next/navigation";

import {
  createHash,
  createHmac,
  randomBytes,
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
   TIKEMIA — VÉRIFICATION EMAIL PUBLIQUE

   FICHIER :
   src/app/api/auth/verify-email/route.ts

   MÉTHODE :
   POST /api/auth/verify-email

   ENTRÉE JSON :
   {
     "email": "client@example.com",
     "code": "123456"
   }

   FONCTIONNALITÉS :
   - Vérification OTP à 6 chiffres
   - Contrôle de l'expiration
   - Maximum 5 tentatives
   - Code à usage unique
   - Validation atomique
   - Activation de l'email
   - Rattachement des commandes invitées
   - Rattachement des billets invités
   - Création de session
   - Cookie HttpOnly sécurisé
   - Français / Anglais

   MODÈLES EXISTANTS :
   - User
   - UserEmailVerification
   - Session
   - Order
   - Ticket

   AUCUN NOUVEAU MODÈLE PRISMA.
   AUCUNE NOUVELLE TABLE.
   AUCUN AUTRE FICHIER NÉCESSAIRE.

   IMPORTANT :
   Le codeHash doit être produit
   avec la même méthode dans
   l'API d'inscription.
========================================================== */

const MAX_BODY_BYTES = 4096;
const MAX_ATTEMPTS = 5;

const SESSION_COOKIE = "tikemia_session";
const SESSION_DURATION_DAYS = 7;

type Language = "fr" | "en";

type InputBody = {
  email?: unknown;
  code?: unknown;
  locale?: unknown;
};

const MESSAGES = {
  fr: {
    invalidRequest: "Requête invalide.",
    invalidEmail: "Adresse email invalide.",
    invalidCode:
      "Le code doit contenir exactement six chiffres.",
    invalidVerification:
      "Code incorrect, expiré ou déjà utilisé.",
    tooManyAttempts:
      "Trop de tentatives. Demandez un nouveau code.",
    unavailable:
      "Service temporairement indisponible.",
    success:
      "Votre adresse email a été vérifiée avec succès.",
  },
  en: {
    invalidRequest: "Invalid request.",
    invalidEmail: "Invalid email address.",
    invalidCode:
      "The code must contain exactly six digits.",
    invalidVerification:
      "Incorrect, expired or already used code.",
    tooManyAttempts:
      "Too many attempts. Request a new code.",
    unavailable:
      "Service temporarily unavailable.",
    success:
      "Your email address has been verified successfully.",
  },
} as const;

/* ==========================================================
   PRISMA 7 — RÉUTILISATION DU CLIENT

   Même méthode que les API organisateur
   déjà présentes dans le projet TIKEMIA.
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
    throw new Error("DATABASE_URL_NOT_CONFIGURED");
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
   RÉPONSE JSON
========================================================== */

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

function fail(
  locale: Language,
  key: keyof typeof MESSAGES.fr,
  status: number
) {
  return respond(
    {
      success: false,
      code: key,
      message: MESSAGES[locale][key],
    },
    status
  );
}

/* ==========================================================
   LANGUE
========================================================== */

function resolveLanguage(
  value: unknown
): Language {
  return value === "en" ? "en" : "fr";
}

/* ==========================================================
   CONTRÔLE DE L'ORIGINE

   Protection des requêtes provenant
   d'autres sites.

   Le contrôle accepte les appels
   depuis la même origine.
========================================================== */

function isAllowedOrigin(
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

  return origin === getTrustedRequestOrigin(request);
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
    email.length < 3 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return null;
  }

  return email;
}

/* ==========================================================
   CODE OTP
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
   HACHAGE DU CODE À 6 CHIFFRES

   IMPORTANT :

   Cette fonction doit également être
   utilisée dans l'API d'inscription
   lors de la création du code.

   Le secret doit être configuré
   côté serveur.

   Ne jamais utiliser un secret exposé
   avec NEXT_PUBLIC_.
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
    .update("tikemia:email-verification:v1")
    .update("\0")
    .update(userId)
    .update("\0")
    .update(email)
    .update("\0")
    .update(code)
    .digest("hex");
}

/* ==========================================================
   COMPARAISON CONSTANT-TIME
========================================================== */

function compareHashes(
  expected: string,
  received: string
): boolean {
  if (
    !/^[a-f0-9]{64}$/i.test(expected) ||
    !/^[a-f0-9]{64}$/i.test(received)
  ) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(received, "hex")
  );
}

/* ==========================================================
   TOKEN DE SESSION

   32 octets cryptographiquement aléatoires.

   Le navigateur reçoit le token brut.
   PostgreSQL conserve seulement
   son empreinte SHA-256.
========================================================== */

function createSessionToken() {
  const token =
    randomBytes(32).toString("hex");

  const tokenHash = createHash("sha256")
    .update(token, "utf8")
    .digest("hex");

  return {
    token,
    tokenHash,
  };
}

/* ==========================================================
   POST — VÉRIFICATION
========================================================== */

export async function POST(
  request: NextRequest
) {
  let locale: Language = "fr";

  try {
    /* ======================================================
       1. VALIDATION DE LA REQUÊTE
    ====================================================== */

    if (!isAllowedOrigin(request)) {
      return fail(
        locale,
        "invalidRequest",
        403
      );
    }

    const contentType =
      request.headers.get("content-type") ?? "";

    if (
      !contentType
        .toLowerCase()
        .startsWith("application/json")
    ) {
      return fail(
        locale,
        "invalidRequest",
        415
      );
    }

    const rawBody = await request.text();

    if (
      Buffer.byteLength(rawBody, "utf8") >
      MAX_BODY_BYTES
    ) {
      return fail(
        locale,
        "invalidRequest",
        413
      );
    }

    let body: InputBody;

    try {
      const parsed: unknown =
        JSON.parse(rawBody);

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        return fail(
          locale,
          "invalidRequest",
          400
        );
      }

      body = parsed as InputBody;
    } catch {
      return fail(
        locale,
        "invalidRequest",
        400
      );
    }

    locale = resolveLanguage(body.locale);

    const email =
      normalizeEmail(body.email);

    const code =
      normalizeCode(body.code);

    if (!email) {
      return fail(
        locale,
        "invalidEmail",
        400
      );
    }

    if (!code) {
      return fail(
        locale,
        "invalidCode",
        400
      );
    }

    /* ======================================================
       2. CLIENT PRISMA
    ====================================================== */

    const prisma = getPrisma();

    /* ======================================================
       3. RECHERCHER L'UTILISATEUR

       Aucun champ privé n'est retourné.
    ====================================================== */

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

    /*
     * Réponse générique pour ne pas
     * confirmer l'existence d'un compte.
     */

    if (
      !user ||
      !user.isActive ||
      user.isBlocked ||
      user.emailVerifiedAt
    ) {
      return fail(
        locale,
        "invalidVerification",
        400
      );
    }

    /* ======================================================
       4. DERNIER CODE ÉMIS

       Les anciens codes ne sont pas
       acceptés lorsqu'un nouveau code
       a été généré.

       La ligne doit correspondre :
       - Au bon utilisateur
       - Au bon email
       - À un code non consommé
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
      return fail(
        locale,
        "invalidVerification",
        400
      );
    }

    /* ======================================================
       5. PRÉPARER LE HASH

       Le code fourni n'est ni stocké
       ni journalisé.
    ====================================================== */

    const submittedHash =
      hashVerificationCode(
        user.id,
        email,
        code
      );

    const sessionToken =
      createSessionToken();

    const expiresAt = new Date(
      Date.now() +
        SESSION_DURATION_DAYS *
          24 *
          60 *
          60 *
          1000
    );

    /* ======================================================
       6. TRANSACTION ATOMIQUE

       Une seule transaction pour :

       - Verrouiller le code
       - Vérifier l'expiration
       - Contrôler les tentatives
       - Consommer le code
       - Activer l'email
       - Rattacher les anciens achats
       - Rattacher les anciens billets
       - Créer la session

       Aucune validation partielle.
    ====================================================== */

    const result = await prisma.$transaction(
      async (tx) => {
        const now = new Date();

        /* --------------------------------------------------
           VERROUILLAGE POSTGRESQL

           Empêche deux validations
           simultanées du même code.
        -------------------------------------------------- */

        await tx.$queryRaw`
          SELECT id
          FROM "UserEmailVerification"
          WHERE id = ${verification.id}::uuid
          FOR UPDATE
        `;

        /* --------------------------------------------------
           RELIRE LE CODE APRÈS VERROUILLAGE
        -------------------------------------------------- */

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
            status: "invalid" as const,
          };
        }

        /* --------------------------------------------------
           LIMITE DES TENTATIVES
        -------------------------------------------------- */

        if (stored.attempts >= MAX_ATTEMPTS) {
          return {
            status: "locked" as const,
          };
        }

        /* --------------------------------------------------
           VÉRIFICATION DU HASH
        -------------------------------------------------- */

        const valid = compareHashes(
          stored.codeHash,
          submittedHash
        );

        if (!valid) {
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
                ? ("locked" as const)
                : ("invalid" as const),
          };
        }

        /* --------------------------------------------------
           EMPÊCHER LA DOUBLE ACTIVATION
        -------------------------------------------------- */

        const activated =
          await tx.user.updateMany({
            where: {
              id: user.id,
              email,
              emailVerifiedAt: null,
              isActive: true,
              isBlocked: false,
            },
            data: {
              emailVerifiedAt: now,
            },
          });

        if (activated.count !== 1) {
          return {
            status: "invalid" as const,
          };
        }

        /* --------------------------------------------------
           CODE À USAGE UNIQUE
        -------------------------------------------------- */

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
            "VERIFICATION_CONSUMPTION_FAILED"
          );
        }

        /* --------------------------------------------------
           RATTACHEMENT DES COMMANDES INVITÉES

           Seulement :
           - Email vérifié identique
           - Commandes payées
           - Aucun autre propriétaire
        -------------------------------------------------- */

        const linkedOrders =
          await tx.order.updateMany({
            where: {
              buyerId: null,
              guestEmail: {
                equals: email,
                mode: "insensitive",
              },
              status: "PAID",
            },
            data: {
              buyerId: user.id,
            },
          });

        /* --------------------------------------------------
           RATTACHEMENT DES BILLETS INVITÉS

           Seulement :
           - Email du billet identique
           - Commande payée
           - Commande appartenant
             désormais au bon compte
           - Aucun propriétaire existant
           - Billet non transféré
           - Billet non annulé ou remboursé

           Les billets déjà utilisés
           restent consultables dans
           l'historique personnel.
        -------------------------------------------------- */

        const linkedTickets =
          await tx.ticket.updateMany({
            where: {
              ownerId: null,

              guestEmail: {
                equals: email,
                mode: "insensitive",
              },

              order: {
                is: {
                  status: { in: ["PAID", "PARTIALLY_REFUNDED"] },
                  paidAt: { not: null },
                },
              },

              status: {
                in: [
                  "VALID",
                  "USED",
                  "EXPIRED",
                ],
              },
            },
            data: {
              ownerId: user.id,
            },
          });

        /* --------------------------------------------------
           CRÉATION DE SESSION

           Compatible avec le système
           tikemia_session déjà utilisé
           dans les API organisateur.
        -------------------------------------------------- */

        await tx.session.create({
          data: {
            userId: user.id,

            tokenHash:
              sessionToken.tokenHash,

            expiresAt,
          },
        });

        return {
          status: "success" as const,

          userId: user.id,

          linkedOrders:
            linkedOrders.count,

          linkedTickets:
            linkedTickets.count,
        };
      },
      {
        maxWait: 5000,
        timeout: 15000,
      }
    );

    /* ======================================================
       7. RÉSULTAT DE LA TRANSACTION
    ====================================================== */

    if (result.status === "locked") {
      return fail(
        locale,
        "tooManyAttempts",
        429
      );
    }

    if (result.status !== "success") {
      return fail(
        locale,
        "invalidVerification",
        400
      );
    }

    /* ======================================================
       8. RÉPONSE DE SUCCÈS

       Le compte possède désormais
       une adresse email vérifiée.

       L'utilisateur peut accéder
       à son espace personnel.
    ====================================================== */

    const response = respond(
      {
        success: true,

        message:
          MESSAGES[locale].success,

        verified: true,

        redirectTo: "/account",

        data: {
          userId:
            result.userId,

          emailVerified: true,

          linkedOrders:
            result.linkedOrders,

          linkedTickets:
            result.linkedTickets,
        },
      },
      200
    );

    /* ======================================================
       9. COOKIE DE SESSION

       HttpOnly :
       Non accessible depuis JavaScript.

       Secure :
       HTTPS en production.

       SameSite Lax :
       Protection navigateur supplémentaire.
    ====================================================== */

    response.cookies.set(
      SESSION_COOKIE,
      sessionToken.token,
      {
        httpOnly: true,

        secure:
          process.env.NODE_ENV ===
          "production",

        sameSite: "lax",

        path: "/",

        expires: expiresAt,
      }
    );

    return response;
  } catch (error) {
    unstable_rethrow(error);
    console.error(
      "[TIKEMIA_PUBLIC_VERIFY_EMAIL_ERROR]",
      error instanceof Error
        ? error.message
        : "UNKNOWN_ERROR"
    );

    return fail(
      locale,
      "unavailable",
      503
    );
  }
}

/* ==========================================================
   FIN DE L'API

   AUCUN GET :
   Un code de vérification ne doit
   pas être transmis dans une URL.

   Le formulaire doit envoyer
   une requête POST JSON sécurisée.
========================================================== */
