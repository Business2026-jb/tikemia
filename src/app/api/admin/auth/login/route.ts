import argon2 from "argon2";
import { unstable_rethrow } from "next/navigation";

import {
  createHash,
  randomBytes,
  scrypt,
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

import { compare } from "bcryptjs";


/*
  TIKEMIA — CONNEXION ADMINISTRATEUR

  POST /api/admin/auth/login

  1. Vérifier email + mot de passe
  2. Vérifier le rôle administrateur
  3. Limiter les tentatives abusives
  4. Générer un lien temporaire
  5. Enregistrer son empreinte
  6. Envoyer le lien par email

  Aucune inscription administrateur.
  Aucune session ouverte ici.
  Session créée uniquement dans
  /api/admin/auth/confirm.

  Langue : français uniquement.
*/

/* ======================================================
   CONFIGURATION
====================================================== */

const ADMIN_EMAIL = (
  process.env.TIKEMIA_ADMIN_EMAIL ??
  "gestion@tikemia.com"
)
  .trim()
  .toLowerCase();

const CONFIRMATION_CONTEXT =
  "tikemia:admin:confirm:v1:";

const LINK_VALIDITY_MS =
  10 * 60 * 1000;

const MAX_BODY_BYTES = 4096;

const RATE_WINDOW_MS =
  15 * 60 * 1000;

const MAX_FAILED_ATTEMPTS = 8;

const MAX_EMAIL_REQUESTS = 3;

const EMAIL_TIMEOUT_MS = 12_000;

const GENERIC_SUCCESS =
  "Si les identifiants sont valides, un lien de confirmation sera envoyé à l'adresse administrateur.";

const EVENT_LOGIN_FAILED =
  "ADMIN_LOGIN_FAILED";

const EVENT_LOGIN_LINK_SENT =
  "ADMIN_LOGIN_LINK_SENT";

type LoginInput = {
  action?: unknown;
  email?: unknown;
  password?: unknown;
};

/* ======================================================
   PRISMA
====================================================== */

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
    throw new Error(
      "DATABASE_URL_MANQUANTE"
    );
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

/* ======================================================
   RÉPONSES HTTP
====================================================== */

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

function errorResponse(
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

/* ======================================================
   VÉRIFICATION DE L'ORIGINE
====================================================== */

function validOrigin(
  request: NextRequest
): boolean {
  const fetchSite =
    request.headers.get(
      "sec-fetch-site"
    );

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
    return (
      fetchSite === "same-origin" ||
      fetchSite === "none"
    );
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

/* ======================================================
   VALIDATION DES ENTRÉES
====================================================== */

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
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    return null;
  }

  return email;
}

function validPasswordInput(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 1024
  );
}

/* ======================================================
   LECTURE JSON LIMITÉE

   Limite le volume des données reçues
   avant de traiter les identifiants.
====================================================== */

async function readInput(
  request: NextRequest
): Promise<LoginInput | null> {
  const contentType = (
    request.headers.get(
      "content-type"
    ) ?? ""
  ).toLowerCase();

  if (
    !contentType.startsWith(
      "application/json"
    )
  ) {
    return null;
  }

  const lengthHeader =
    request.headers.get(
      "content-length"
    );

  if (lengthHeader !== null) {
    const length = Number(lengthHeader);

    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > MAX_BODY_BYTES
    ) {
      return null;
    }
  }

  const reader =
    request.body?.getReader();

  if (!reader) {
    return null;
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } =
        await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (
        totalBytes > MAX_BODY_BYTES
      ) {
        await reader.cancel();
        return null;
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(
      Buffer.concat(chunks)
        .toString("utf8")
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

  return parsed as LoginInput;
}

/* ======================================================
   MOT DE PASSE ADMINISTRATEUR

   Le hash bcrypt est conservé dans
   TIKEMIA_ADMIN_PASSWORD_HASH.

   Aucun mot de passe en clair
   dans le code source.
====================================================== */

function getPasswordHash(): string {
  const configured = process.env.TIKEMIA_ADMIN_PASSWORD_HASH;
  const encoded = process.env.TIKEMIA_ADMIN_PASSWORD_HASH_BASE64;
  const hash = configured && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(configured)
    ? configured
    : encoded ? Buffer.from(encoded, "base64").toString("utf8") : configured;

  if (
    !hash ||
    !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(
      hash
    )
  ) {
    throw new Error(
      "ADMIN_PASSWORD_HASH_MANQUANT"
    );
  }

  return hash;
}

async function checkPassword(password: string, storedHash?: string | null): Promise<boolean> {
  const stored = storedHash || getPasswordHash();
  try {
    if (stored.startsWith("$argon2")) return await argon2.verify(stored, password);
    if (/^\$2[aby]\$/.test(stored)) return await compare(password, stored);
    const parts = stored.split(":");
    if (parts.length !== 7 || parts[0] !== "scrypt" || parts[1] !== "v1" || !["16384", "32768"].includes(parts[2]) || parts[3] !== "8" || parts[4] !== "1" || !/^[a-f0-9]{64}$/i.test(parts[5]) || !/^[a-f0-9]{128}$/i.test(parts[6])) return false;
    const actual = await new Promise<Buffer>((resolve, reject)=>scrypt(password, Buffer.from(parts[5], "hex"), 64, { N: Number(parts[2]), r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key)=>error ? reject(error) : resolve(key)));
    return timingSafeEqual(actual, Buffer.from(parts[6], "hex"));
  } catch { return false; }
}

/* ======================================================
   DÉTECTION IP

   Les en-têtes ci-dessous ne doivent
   être utilisés que si l'application
   est derrière un hébergement de
   confiance qui les définit lui-même.

   Ne pas accepter un X-Forwarded-For
   arbitraire.
====================================================== */

function getTrustedIp(
  request: NextRequest
): string | null {
  const forwardedByVercel =
    request.headers.get(
      "x-vercel-forwarded-for"
    );

  const forwardedByCloudflare =
    request.headers.get(
      "cf-connecting-ip"
    );

  const candidate =
    forwardedByVercel?.split(",")[0]
      ?.trim() ||
    forwardedByCloudflare?.trim() ||
    null;

  return candidate
    ? candidate.slice(0, 64)
    : null;
}

/* ======================================================
   LIMITATION DES TENTATIVES

   Utilise SecurityEvent déjà présent
   dans Prisma.

   Aucune nouvelle table.

   Les tentatives sont limitées par
   compte et, si connue, par IP.

   Pour une installation multi-instance,
   la protection doit être complétée
   par un limiteur atomique au niveau
   de l'hébergement ou du proxy.
====================================================== */

async function checkRateLimit(
  prisma: PrismaClient,
  userId: string,
  ipAddress: string | null
): Promise<boolean> {
  const from = new Date(
    Date.now() - RATE_WINDOW_MS
  );

  const failedCount =
    await prisma.securityEvent.count({
      where: {
        userId,
        type: EVENT_LOGIN_FAILED,

        createdAt: {
          gte: from,
        },

        ...(ipAddress
          ? {
              ipAddress,
            }
          : {}),
      },
    });

  if (
    failedCount >= MAX_FAILED_ATTEMPTS
  ) {
    return false;
  }

  const sentCount =
    await prisma.securityEvent.count({
      where: {
        userId,
        type: EVENT_LOGIN_LINK_SENT,

        createdAt: {
          gte: from,
        },
      },
    });

  return (
    sentCount < MAX_EMAIL_REQUESTS
  );
}

/* ======================================================
   JOURNAL DE SÉCURITÉ
====================================================== */

async function logSecurityEvent(
  prisma: PrismaClient,
  args: {
    userId: string | null;
    type: string;
    ipAddress: string | null;
    userAgent: string | null;
  }
) {
  await prisma.securityEvent.create({
    data: {
      userId: args.userId,
      type: args.type,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    },
  });
}

/* ======================================================
   JETON DE CONFIRMATION

   Compatible exactement avec :

   /api/admin/auth/confirm

   Jeton original :
   32 octets aléatoires en hexadécimal.

   Base de données :
   SHA256(
     "tikemia:admin:confirm:v1:"
     + jeton
   )

   Le jeton original n'est jamais
   enregistré dans Prisma.
====================================================== */

function generateConfirmationToken(recovery = false) {
  const token = randomBytes(32)
    .toString("hex");

  const codeHash = createHash(
    "sha256"
  )
    .update(
      (recovery ? "tikemia:admin:recovery:v1:" : CONFIRMATION_CONTEXT) + token,
      "utf8"
    )
    .digest("hex");

  return {
    token,
    codeHash,
  };
}

/* ======================================================
   ADRESSE DU SITE

   URL définie côté serveur.

   Jamais construite avec un Host
   arbitraire envoyé par le navigateur.
====================================================== */

function getSiteUrl(): URL {
  const configured =
    process.env.TIKEMIA_APP_URL;

  if (!configured) {
    throw new Error(
      "TIKEMIA_APP_URL_MANQUANTE"
    );
  }

  const url = new URL(configured);

  const localDevelopment =
    process.env.NODE_ENV !==
      "production" &&
    url.protocol === "http:" &&
    (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1"
    );

  if (
    (
      url.protocol !== "https:" &&
      !localDevelopment
    ) ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new Error(
      "TIKEMIA_APP_URL_INVALIDE"
    );
  }

  return url;
}

function buildConfirmationLink(
  token: string
): string {
  const base = getSiteUrl();

  const url = new URL(
    "/admin/confirm",
    base
  );

  /*
    Le jeton est placé dans
    le fragment de l'URL.

    Un fragment n'est pas transmis
    au serveur par le navigateur.

    La page /admin/confirm doit
    lire window.location.hash,
    puis envoyer le jeton via POST.
  */

  url.hash = `token=${token}`;

  return url.toString();
}

/* ======================================================
   ENVOI EMAIL — RESEND

   Aucun nouveau fichier nécessaire.

   La clé est exclusivement serveur.

   L'adresse d'expédition doit être
   autorisée et vérifiée chez Resend.

   Si TIKEMIA dispose déjà d'un
   transport email fonctionnel,
   cette seule fonction pourra
   être raccordée à ce transport.
====================================================== */

async function sendConfirmationEmail(
  args: {
    recipient: string;
    confirmationLink: string;
    recovery?: boolean;
    deliveryId: string;
  }
): Promise<string | null> {
  const apiKey =
    process.env.RESEND_API_KEY;

  const from =
    (process.env.TIKEMIA_MAIL_FROM || process.env.RESEND_FROM_EMAIL);

  if (!apiKey || !from) {
    throw new Error(
      "CONFIGURATION_EMAIL_MANQUANTE"
    );
  }

  const subject = args.recovery ? "TIKEMIA — Réinitialisation du mot de passe administrateur" : "TIKEMIA — Confirmation de connexion administrateur";

  const text = [
    "Bonjour,",
    "",
    args.recovery ? "Une réinitialisation de votre mot de passe administrateur a été demandée." : "Une connexion à l'espace administrateur TIKEMIA a été demandée.",
    "",
    "Pour confirmer votre connexion, ouvrez le lien suivant :",
    args.confirmationLink,
    "",
    "Ce lien expire dans 10 minutes et ne peut être utilisé qu'une seule fois.",
    "",
    "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
    "",
    "Sécurité TIKEMIA",
  ].join("\n");

  const escapedLink =
    args.confirmationLink
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const html = `
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport"
              content="width=device-width, initial-scale=1">
      </head>
      <body style="
        margin:0;
        padding:32px 12px;
        background:#f5f8f6;
        font-family:Arial,Helvetica,sans-serif;
        color:#152637;
      ">
        <div style="
          max-width:540px;
          margin:0 auto;
          padding:32px 24px;
          background:#ffffff;
          border:1px solid #e4ebe6;
          border-radius:18px;
        ">
          <h1 style="
            margin:0 0 8px;
            color:#087d35;
            font-size:25px;
            font-weight:800;
          ">
            TIKEMIA
          </h1>

          <p style="
            margin:0 0 24px;
            color:#637487;
            font-size:13px;
          ">
            Sécurité administrateur
          </p>

          <h2 style="
            margin:0 0 16px;
            font-size:20px;
            color:#17283a;
          ">
            ${args.recovery ? "Choisissez un nouveau mot de passe" : "Confirmez votre connexion"}
          </h2>

          <p style="
            font-size:14px;
            line-height:1.8;
          ">
            Une demande de connexion à
            l'espace administrateur TIKEMIA
            a été effectuée.
          </p>

          <p style="
            font-size:14px;
            line-height:1.8;
          ">
            Cliquez sur le bouton ci-dessous
            pour confirmer votre identité.
          </p>

          <div style="
            margin:30px 0;
            text-align:center;
          ">
            <a href="${escapedLink}"
               style="
                 display:inline-block;
                 padding:15px 26px;
                 background:#087d35;
                 color:#ffffff;
                 border-radius:10px;
                 font-size:14px;
                 font-weight:700;
                 text-decoration:none;
               ">
              ${args.recovery ? "Réinitialiser mon mot de passe" : "Confirmer ma connexion"}
            </a>
          </div>

          <p style="
            font-size:12px;
            line-height:1.8;
            color:#65778b;
          ">
            Ce lien est valable 10 minutes
            et ne peut être utilisé
            qu'une seule fois.
          </p>

          <p style="
            margin-top:24px;
            padding-top:18px;
            border-top:1px solid #edf1ed;
            font-size:12px;
            line-height:1.8;
            color:#7a8793;
          ">
            Si vous n'avez pas demandé
            cette connexion, ignorez
            simplement ce message.
          </p>
        </div>
      </body>
    </html>
  `;

  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    EMAIL_TIMEOUT_MS
  );

  try {
    const response = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,

        headers: {
          Authorization:
            `Bearer ${apiKey}`,

          "Content-Type":
            "application/json",

          Accept:
            "application/json",

          "Idempotency-Key":
            args.deliveryId,
        },

        body: JSON.stringify({
          from,
          to: [args.recipient],
          subject,
          text,
          html,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        "ENVOI_EMAIL_ECHOUE"
      );
    }

    const result: unknown =
      await response.json();

    if (
      result &&
      typeof result === "object" &&
      "id" in result &&
      typeof result.id === "string"
    ) {
      return result.id;
    }

    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/* ======================================================
   ROUTE POST
====================================================== */

export async function POST(
  request: NextRequest
) {
  try {
    /* ----------------------------------------
       1. ORIGINE
    ---------------------------------------- */

    if (!validOrigin(request)) {
      return errorResponse(
        "ORIGINE_NON_AUTORISEE",
        "Cette demande n'est pas autorisée.",
        403
      );
    }

    /* ----------------------------------------
       2. LECTURE JSON
    ---------------------------------------- */

    const input =
      await readInput(request);

    if (!input) {
      return errorResponse(
        "DEMANDE_INVALIDE",
        "Les informations transmises sont invalides.",
        400
      );
    }

    const recovery = input.action === "recover";
    if (input.action !== undefined && !["recover", "login"].includes(String(input.action))) return errorResponse("DEMANDE_INVALIDE", "Demande invalide.", 400);
    const email =
      normalizeEmail(input.email);

    const password =
      input.password;

    if (
      !email ||
      (!recovery && !validPasswordInput(password))
    ) {
      return errorResponse(
        "CHAMPS_INVALIDES",
        "Veuillez saisir une adresse email et un mot de passe valides.",
        400
      );
    }

    const prisma = getPrisma();

    const ipAddress =
      getTrustedIp(request);

    const userAgent =
      request.headers
        .get("user-agent")
        ?.slice(0, 500) ?? null;

    /* ----------------------------------------
       3. COMPTE ADMINISTRATEUR

       Un seul email autorisé.
       Compte initial défini par la configuration serveur ; accès après validation email.
    ---------------------------------------- */

    let user =
      await prisma.user.findUnique({
        where: {
          email: ADMIN_EMAIL,
        },

        select: {
          id: true,
          email: true,
          isActive: true,
          isBlocked: true,
          passwordHash: true,

          roles: {
            select: {
              role: true,
            },
          },
        },
      });

    /*
      Le contrôle du mot de passe
      est exécuté sans utiliser
      l'email fourni pour rechercher
      un compte public quelconque.
    */

    let passwordValid =
      recovery ? true : await checkPassword(password as string, user?.passwordHash);

    // Le secret administrateur configure est distinct du mot de passe public.
    // Une reinitialisation admin invalide aussi cet ancien secret configure.
    if (!recovery && !passwordValid && email === ADMIN_EMAIL && user &&
        user.isActive && !user.isBlocked &&
        user.roles.some(({ role }) => role === "ADMIN" || role === "SUPER_ADMIN")) {
      const reset = await prisma.securityEvent.findFirst({
        where: { userId: user.id, type: "ADMIN_PASSWORD_RESET" },
        select: { id: true },
      });
      if (!reset) {
        passwordValid = await checkPassword(password as string);
      }
    }

    const emailValid =
      email === ADMIN_EMAIL;

    if (!user && emailValid && (recovery || passwordValid)) {
      await prisma.user.upsert({ where: { email: ADMIN_EMAIL }, update: {}, create: { email: ADMIN_EMAIL, fullName: "Admin TIKEMIA", passwordHash: getPasswordHash(), roles: { create: { role: "ADMIN" } } } });
      user = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL }, select: { id: true, email: true, passwordHash: true, isActive: true, isBlocked: true, roles: { select: { role: true } } } });
    }
    const roleValid =
      user?.roles.some(
        ({ role }) =>
          role === "ADMIN" ||
          role === "SUPER_ADMIN"
      ) ?? false;

    const accountValid =
      Boolean(
        user &&
        emailValid &&
        passwordValid &&
        roleValid &&
        user.isActive &&
        !user.isBlocked
      );

    /* ----------------------------------------
       4. ÉCHEC D'AUTHENTIFICATION

       Même réponse générique pour
       éviter d'indiquer si un email
       ou mot de passe est correct.
    ---------------------------------------- */

    if (!accountValid || !user) {
      await logSecurityEvent(
        prisma,
        {
          userId:
            emailValid
              ? user?.id ?? null
              : null,

          type: EVENT_LOGIN_FAILED,
          ipAddress,
          userAgent,
        }
      );

      if (!recovery) return errorResponse("IDENTIFIANTS_INVALIDES", "Adresse email ou mot de passe incorrect.", 401);
      return respond({ success: true, message: GENERIC_SUCCESS });
    }

    /* ----------------------------------------
       5. LIMITATION DES TENTATIVES
    ---------------------------------------- */

    const allowed =
      await checkRateLimit(
        prisma,
        user.id,
        ipAddress
      );

    if (!allowed) {
      return errorResponse(
        "TROP_DE_TENTATIVES",
        "Trop de demandes ont été effectuées. Veuillez réessayer dans quelques minutes.",
        429
      );
    }

    /* ----------------------------------------
       6. PRÉPARATION DU LIEN
    ---------------------------------------- */

    const now = new Date();

    const expiresAt = new Date(
      now.getTime() +
        LINK_VALIDITY_MS
    );

    const generated =
      generateConfirmationToken(recovery);

    let confirmationLink = buildConfirmationLink(generated.token);
    if (recovery) { const url = new URL(confirmationLink); url.hash = new URLSearchParams({ token: generated.token, mode: "reset" }).toString(); confirmationLink = url.toString(); }

    const subject =
      "TIKEMIA — Confirmation de connexion administrateur";

    /* ----------------------------------------
       7. ENREGISTREMENT

       Révocation des anciens liens
       non utilisés du même compte.

       Création d'un nouveau lien et
       d'un suivi d'envoi email.

       Aucun nouveau modèle Prisma.
    ---------------------------------------- */

    const delivery =
      await prisma.$transaction(
        async (tx) => {
          await tx.userEmailVerification.updateMany({
            where: {
              userId: user.id,
              email: ADMIN_EMAIL,

              consumedAt: null,

              expiresAt: {
                gt: now,
              },
            },

            data: {
              consumedAt: now,
            },
          });

          await tx.userEmailVerification.create({
            data: {
              userId: user.id,
              email: ADMIN_EMAIL,

              codeHash:
                generated.codeHash,

              attempts: 0,

              expiresAt,
            },
          });

          return tx.emailDelivery.create({
            data: {
              userId: user.id,

              recipient:
                ADMIN_EMAIL,

              template:
                "ADMIN_LOGIN_CONFIRMATION",

              locale: "fr",

              subject,

              status: "QUEUED",

              attempts: 0,
            },

            select: {
              id: true,
            },
          });
        }
      );

    /* ----------------------------------------
       8. ENVOI DU MAIL
    ---------------------------------------- */

    try {
      const providerMessageId =
        await sendConfirmationEmail({
          recipient: ADMIN_EMAIL,
          confirmationLink,
          recovery,
          deliveryId: delivery.id,
        });

      await prisma.emailDelivery.update({
        where: {
          id: delivery.id,
        },

        data: {
          status: "SENT",
          sentAt: new Date(),
          attempts: {
            increment: 1,
          },
          providerMessageId,
        },
      });
    } catch (mailError) {
      /*
        Si l'envoi échoue, le lien
        nouvellement créé est révoqué.

        On ne renvoie jamais le
        jeton au navigateur.
      */

      await prisma.userEmailVerification.updateMany({
        where: {
          userId: user.id,

          codeHash:
            generated.codeHash,

          consumedAt: null,
        },

        data: {
          consumedAt: new Date(),
        },
      });

      await prisma.emailDelivery.update({
        where: {
          id: delivery.id,
        },

        data: {
          status: "FAILED",

          attempts: {
            increment: 1,
          },
        },
      });

      console.error(
        "[TIKEMIA_ADMIN_EMAIL]",
        mailError instanceof Error
          ? mailError.name
          : "ERREUR_INCONNUE"
      );

      return errorResponse(
        "ENVOI_INDISPONIBLE",
        "Le service d'envoi du lien de confirmation est momentanément indisponible.",
        503
      );
    }

    /* ----------------------------------------
       9. JOURNAL DE SÉCURITÉ
    ---------------------------------------- */

    await logSecurityEvent(
      prisma,
      {
        userId: user.id,
        type: EVENT_LOGIN_LINK_SENT,
        ipAddress,
        userAgent,
      }
    );

    /* ----------------------------------------
       10. RÉPONSE

       Aucune ouverture de session ici.

       Aucun jeton renvoyé.

       Le client doit ouvrir le lien
       reçu par email.
    ---------------------------------------- */

    return respond({
      success: true,

      message:
        "Un lien de confirmation a été envoyé à votre adresse email administrateur.",

      requiresEmailConfirmation: true,

      expiresInSeconds:
        LINK_VALIDITY_MS / 1000,
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error(
      "[TIKEMIA_ADMIN_LOGIN]",
      error instanceof Error
        ? error.name
        : "ERREUR_INCONNUE"
    );

    return errorResponse(
      "CONNEXION_INDISPONIBLE",
      "Le service de connexion administrateur est momentanément indisponible.",
      503
    );
  }
}

/* ======================================================
   GET NON AUTORISÉ
====================================================== */

export async function GET() {
  return errorResponse(
    "METHODE_NON_AUTORISEE",
    "Utilisez le formulaire de connexion administrateur.",
    405
  );
}
