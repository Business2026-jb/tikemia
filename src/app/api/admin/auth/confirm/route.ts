import { getTrustedRequestOrigin } from "@/lib/tikemia-pay/providers";
import { hash as hashPassword } from "bcryptjs";
import { unstable_rethrow } from "next/navigation";

import { createHash, randomBytes } from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  PrismaClient,
} from "@/generated/prisma/client";


/*
  TIKEMIA — CONFIRMATION ADMINISTRATEUR

  POST /api/admin/auth/confirm

  Fonctionnement :
  1. Recevoir le jeton du lien email.
  2. Vérifier son empreinte en base.
  3. Vérifier sa durée de validité.
  4. Vérifier le compte administrateur.
  5. Consommer le lien une seule fois.
  6. Créer la session administrateur.
  7. Déposer un cookie HttpOnly sécurisé.

  Aucun compte créé ici.
  Aucun mot de passe transmis ici.
  Aucun accès sans confirmation.

  Français uniquement.
*/

/* ============================================
   CONFIGURATION
============================================ */

const ADMIN_EMAIL = (
  process.env.TIKEMIA_ADMIN_EMAIL ??
  "gestion@tikemia.com"
)
  .trim()
  .toLowerCase();

const SESSION_COOKIE =
  "tikemia_admin_session";

const CONFIRMATION_CONTEXT =
  "tikemia:admin:confirm:v1:";

const SESSION_DURATION_SECONDS =
  7 * 24 * 60 * 60;

const MAX_BODY_BYTES = 2048;

const TOKEN_REGEX = /^[a-f0-9]{64}$/i;

type ConfirmBody = {
  action?: unknown;
  password?: unknown;
  confirmPassword?: unknown;
  token?: unknown;
};

/* ============================================
   PRISMA
============================================ */

const prismaGlobal =
  globalThis as typeof globalThis & {
    tikemiaAdminPrisma?: PrismaClient;
  };

function getPrisma(): PrismaClient {
  if (prismaGlobal.tikemiaAdminPrisma) {
    return prismaGlobal.tikemiaAdminPrisma;
  }

  const connectionString =
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL_MANQUANTE");
  }

  const adapter = new PrismaPg({
    connectionString,
  });

  const prisma = new PrismaClient({
    adapter,
  });

  prismaGlobal.tikemiaAdminPrisma = prisma;

  return prisma;
}

/* ============================================
   RÉPONSES
============================================ */

function respond(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "private, no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      Vary: "Cookie",
    },
  });
}

function fail(
  code: string,
  message: string,
  status: number
) {
  return respond(
    {
      success: false,
      code,
      message,
    },
    status
  );
}

/* ============================================
   SÉCURITÉ DE LA REQUÊTE
============================================ */

function validOrigin(
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

  const origin =
    request.headers.get("origin");

  if (!origin) {
    return fetchSite === "same-origin";
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

/* ============================================
   HASH DU JETON DE CONFIRMATION

   La route LOGIN doit utiliser
   exactement la même fonction logique.

   Jeton original :
   randomBytes(32).toString("hex")

   Empreinte enregistrée :
   SHA-256(contexte + jeton)

   Aucun jeton original en base.
============================================ */

function hashConfirmationToken(
  token: string, recovery = false
): string {
  return createHash("sha256")
    .update(
      (recovery ? "tikemia:admin:recovery:v1:" : CONFIRMATION_CONTEXT) +
        token.toLowerCase(),
      "utf8"
    )
    .digest("hex");
}

/* ============================================
   SESSION

   Compatible avec :
   /api/admin/dashboard

   Le cookie contient 32 octets
   aléatoires encodés en hexadécimal.

   Session.tokenHash conserve
   SHA-256 des octets du jeton.
============================================ */

function createSessionCredentials() {
  const rawToken = randomBytes(32);

  return {
    token: rawToken.toString("hex"),

    tokenHash: createHash("sha256")
      .update(rawToken)
      .digest("hex"),
  };
}

/* ============================================
   LECTURE SÉCURISÉE DU JSON
============================================ */

async function readBody(
  request: NextRequest
): Promise<ConfirmBody | null> {
  const contentType = (
    request.headers.get("content-type") ??
    ""
  ).toLowerCase();

  if (
    !contentType.startsWith(
      "application/json"
    )
  ) {
    return null;
  }

  const contentLength =
    request.headers.get("content-length");

  if (contentLength !== null) {
    const length = Number(contentLength);

    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > MAX_BODY_BYTES
    ) {
      return null;
    }
  }

  /*
    Lecture bornée pour empêcher
    une requête JSON trop volumineuse.
  */

  const reader = request.body?.getReader();

  if (!reader) {
    return null;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } =
        await reader.read();

      if (done) {
        break;
      }

      total += value.byteLength;

      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined =
    Buffer.concat(chunks);

  let parsed: unknown;

  try {
    parsed = JSON.parse(
      combined.toString("utf8")
    );
  } catch {
    return null;
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    return null;
  }

  return parsed as ConfirmBody;
}

/* ============================================
   POST — CONFIRMATION DU LIEN
============================================ */

export async function POST(
  request: NextRequest
) {
  try {
    /* ----------------------------------------
       1. PROVENANCE
    ---------------------------------------- */

    if (!validOrigin(request)) {
      return fail(
        "ORIGINE_NON_AUTORISEE",
        "Cette demande n'est pas autorisée.",
        403
      );
    }

    /* ----------------------------------------
       2. LECTURE
    ---------------------------------------- */

    const body = await readBody(request);

    if (!body) {
      return fail(
        "DEMANDE_INVALIDE",
        "La demande de confirmation est invalide.",
        400
      );
    }

    /* ----------------------------------------
       3. VALIDATION DU JETON
    ---------------------------------------- */

    const token = body.token;

    if (
      typeof token !== "string" ||
      !TOKEN_REGEX.test(token)
    ) {
      return fail(
        "LIEN_INVALIDE",
        "Le lien de confirmation est invalide ou expiré.",
        400
      );
    }

    const recovery = body.action === "reset";
    if (body.action !== undefined && !["confirm", "reset"].includes(String(body.action))) return fail("DEMANDE_INVALIDE", "Demande invalide.", 400);
    if (recovery && (typeof body.password !== "string" || Array.from(body.password).length < 12 || Buffer.byteLength(body.password, "utf8") > 72 || body.password !== body.confirmPassword)) return fail("MOT_DE_PASSE_INVALIDE", "Choisissez un mot de passe de 12 caracteres minimum et de 72 octets maximum, puis confirmez-le.", 400);
    const codeHash = hashConfirmationToken(token, recovery);

    const prisma = getPrisma();

    /* ----------------------------------------
       4. RECHERCHE DE LA CONFIRMATION
    ---------------------------------------- */

    const verification =
      await prisma.userEmailVerification.findFirst({
        where: {
          codeHash,
          consumedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },

        select: {
          id: true,
          userId: true,
          email: true,
          expiresAt: true,

          user: {
            select: {
              id: true,
              email: true,
              isActive: true,
              isBlocked: true,

              roles: {
                select: {
                  role: true,
                },
              },
            },
          },
        },
      });

    if (!verification) {
      return fail(
        "LIEN_INVALIDE",
        "Ce lien est invalide, expiré ou déjà utilisé.",
        400
      );
    }

    /* ----------------------------------------
       5. VÉRIFICATION DU COMPTE ADMIN
    ---------------------------------------- */

    const user = verification.user;

    const emailMatches =
      verification.email
        .trim()
        .toLowerCase() === ADMIN_EMAIL &&
      user.email
        .trim()
        .toLowerCase() === ADMIN_EMAIL;

    const hasAdminRole =
      user.roles.some(
        ({ role }) =>
          role === "ADMIN" ||
          role === "SUPER_ADMIN"
      );

    if (
      !emailMatches ||
      !user.isActive ||
      user.isBlocked ||
      !hasAdminRole
    ) {
      return fail(
        "ACCES_NON_AUTORISE",
        "Ce compte n'est pas autorisé à accéder à l'administration.",
        403
      );
    }

    /* ----------------------------------------
       6. CRÉATION DES IDENTIFIANTS
          DE SESSION
    ---------------------------------------- */

    const now = new Date();

    const expiresAt = new Date(
      now.getTime() +
        SESSION_DURATION_SECONDS * 1000
    );

    const newPasswordHash = recovery ? await hashPassword(body.password as string, 12) : null;
    const credentials =
      createSessionCredentials();

    /*
      Les données de navigateur sont
      facultatives et limitées.

      Le jeton original n'est jamais
      inscrit dans les journaux.
    */

    const userAgent =
      request.headers
        .get("user-agent")
        ?.slice(0, 500) ?? null;

    /* ----------------------------------------
       7. TRANSACTION ATOMIQUE

       Le lien doit être consommé
       avant la création de session,
       dans la même transaction.

       Deux requêtes simultanées ne
       peuvent pas consommer le même
       lien de confirmation.
    ---------------------------------------- */

    const authenticated =
      await prisma.$transaction(
        async (tx) => {
          const consumed =
            await tx.userEmailVerification.updateMany({
              where: {
                id: verification.id,
                userId: verification.userId,
                codeHash,
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
            return false;
          }

          /*
            Une seule session active
            pour ce compte administrateur.

            Les anciennes sessions de
            ce compte sont révoquées.
          */

          await tx.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now, ...(newPasswordHash ? { passwordHash: newPasswordHash } : {}) } });
          if (newPasswordHash) await tx.securityEvent.create({ data: { userId: user.id, type: "ADMIN_PASSWORD_RESET" } });
          if (newPasswordHash) await tx.session.updateMany({
            where: {
              userId: user.id,
              revokedAt: null,
              expiresAt: {
                gt: now,
              },
            },

            data: {
              revokedAt: now,
            },
          });

          await tx.session.create({
            data: {
              userId: user.id,

              tokenHash:
                credentials.tokenHash,

              expiresAt,

              userAgent,
            },
          });

          return true;
        },
        {
          isolationLevel:
            "Serializable",

          maxWait: 5000,
          timeout: 10000,
        }
      );

    if (!authenticated) {
      return fail(
        "LIEN_DEJA_UTILISE",
        "Ce lien de confirmation a déjà été utilisé.",
        409
      );
    }

    /* ----------------------------------------
       8. RÉPONSE DE CONNEXION
    ---------------------------------------- */

    const response = respond({
      success: true,

      message:
        "Connexion administrateur confirmée avec succès.",

      redirectTo: "/admin",

      data: {
        authenticated: true,
        role: "administrateur",
        expiresAt:
          expiresAt.toISOString(),
      },
    });

    /* ----------------------------------------
       9. COOKIE SÉCURISÉ

       HttpOnly :
       inaccessible au JavaScript.

       SameSite Strict :
       réduit les risques CSRF.

       Path "/" :
       disponible sur /admin ET
       /api/admin/dashboard.

       Secure :
       obligatoire en production HTTPS.
    ---------------------------------------- */

    response.cookies.set({
      name: SESSION_COOKIE,

      value:
        credentials.token,

      httpOnly: true,

      secure:
        process.env.NODE_ENV ===
        "production",

      sameSite: "strict",

      path: "/",

      maxAge:
        SESSION_DURATION_SECONDS,

      expires: expiresAt,

      priority: "high",
    });

    return response;
  } catch (error) {
    unstable_rethrow(error);
    console.error(
      "[TIKEMIA_ADMIN_CONFIRM]",

      error instanceof Error
        ? error.name
        : "ERREUR_INCONNUE"
    );

    return fail(
      "CONFIRMATION_INDISPONIBLE",
      "La confirmation est momentanément indisponible.",
      503
    );
  }
}

/* ============================================
   GET

   Un simple chargement de lien ne
   doit jamais ouvrir de session.

   Cela évite qu'un scanner automatique
   de liens email consomme le jeton.

   La page /admin/confirm doit envoyer
   le jeton via POST, après une action
   explicite de confirmation.
============================================ */

export async function GET() {
  return fail(
    "METHODE_NON_AUTORISEE",
    "Utilisez la page de confirmation administrateur.",
    405
  );
}

export async function DELETE(request: NextRequest) {
  if (!validOrigin(request)) return fail("ORIGINE_INVALIDE", "Requete refusee.", 403);
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (token && TOKEN_REGEX.test(token)) {
      const tokenHash = createHash("sha256").update(Buffer.from(token, "hex")).digest("hex");
      await getPrisma().session.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    const response = respond({ success: true });
    response.cookies.set({ name: SESSION_COOKIE, value: "", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    unstable_rethrow(error);
    return fail("DECONNEXION_INDISPONIBLE", "La deconnexion est momentanement indisponible.", 503);
  }
}
