import { createClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";

import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
} from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  Prisma,
  PrismaClient,
} from "@/generated/prisma/client";

/*
  TIKEMIA
  /api/public/account/transfer

  GET  : billets transférables
  POST : demande + code OTP

  Aucun transfert avant vérification.
  Aucun QR code envoyé par cette route.
*/

const COOKIE_NAME = "tikemia_session";

const MAX_BODY_BYTES = 8192;
const MAX_TICKETS_PER_REQUEST = 20;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const OTP_EXPIRY_MINUTES = 10;
const OTP_COOLDOWN_SECONDS = 60;
const MAX_REQUESTS_PER_HOUR = 5;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Locale = "fr" | "en";

type TransferBody = {
  ticketIds?: unknown;
  recipientEmail?: unknown;
  locale?: unknown;
};

type TransferResponse =
  | {
      kind: "created";
      transferIds: string[];
      expiresAt: string;
      email: string;
    }
  | {
      kind: "rejected";
      status: number;
      code: string;
    };

const messages = {
  fr: {
    unauthorized: "Connexion requise.",
    invalid: "Demande invalide.",
    unavailable: "Service indisponible.",
    noTickets: "Billet indisponible.",
    selfTransfer: "Destinataire invalide.",
    pending: "Transfert déjà en attente.",
    cooldown: "Veuillez réessayer plus tard.",
    limit: "Limite de demandes atteinte.",
    emailFailed: "Envoi du code impossible.",
    sent: "Code envoyé par email.",
  },
  en: {
    unauthorized: "Sign in required.",
    invalid: "Invalid request.",
    unavailable: "Service unavailable.",
    noTickets: "Ticket unavailable.",
    selfTransfer: "Invalid recipient.",
    pending: "Transfer already pending.",
    cooldown: "Please try again later.",
    limit: "Request limit reached.",
    emailFailed: "Unable to send code.",
    sent: "Code sent by email.",
  },
} as const;

type ErrorCode = keyof typeof messages.fr;

/* ======================================================
   PRISMA
====================================================== */

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
    throw new Error("DATABASE_URL_MISSING");
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

/* ======================================================
   RÉPONSES
====================================================== */

async function respond(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(await resolveAccountMedia(data), {
    status,
    headers: {
      "Cache-Control":
        "private, no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie",
    },
  });
}

function fail(
  locale: Locale,
  code: ErrorCode,
  status: number
) {
  return respond(
    {
      success: false,
      code,
      message: messages[locale][code],
    },
    status
  );
}

function validOrigin(request: NextRequest) {
  if (
    request.headers.get("sec-fetch-site") ===
    "cross-site"
  ) {
    return false;
  }

  const origin = request.headers.get("origin");

  return (
    !origin ||
    origin === request.nextUrl.origin
  );
}

/* ======================================================
   SESSION CLIENT
====================================================== */

function readTokenHash(
  request: NextRequest
): string | null {
  const token =
    request.cookies.get(COOKIE_NAME)?.value;

  if (
    !token ||
    !/^[a-f0-9]{64}$/i.test(token)
  ) {
    return null;
  }

  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

async function authenticatedUser(
  request: NextRequest,
  prisma: PrismaClient
) {
  const tokenHash = readTokenHash(request);

  if (!tokenHash) {
    return null;
  }

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash,
      },
      select: {
        revokedAt: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            emailVerifiedAt: true,
            isActive: true,
            isBlocked: true,
            roles: {
              where: {
                role: "CLIENT",
              },
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt <= new Date()
  ) {
    return null;
  }

  const user = session.user;

  if (
    !user.isActive ||
    user.isBlocked ||
    !user.emailVerifiedAt ||
    user.roles.length === 0
  ) {
    return null;
  }

  return user;
}

/* ======================================================
   VALIDATION
====================================================== */

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

function parseTicketIds(
  value: unknown
): string[] | null {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_TICKETS_PER_REQUEST
  ) {
    return null;
  }

  if (
    !value.every(
      (id): id is string =>
        typeof id === "string" &&
        UUID_REGEX.test(id)
    )
  ) {
    return null;
  }

  const ids = [...value].sort();

  if (new Set(ids).size !== ids.length) {
    return null;
  }

  return ids;
}

function positiveInt(
  value: string | null,
  fallback: number,
  maximum: number
) {
  if (!value || !/^\d+$/.test(value)) {
    return fallback;
  }

  const number = Number(value);

  return Number.isSafeInteger(number)
    ? Math.max(1, Math.min(number, maximum))
    : fallback;
}

/* ======================================================
   VALIDITÉ DES BILLETS

   Le client doit être propriétaire.
   Les billets scannés sont exclus.
   Les commandes doivent être payées.
   Les séances doivent être utilisables.
====================================================== */

function activeSchedule(
  now: Date
): Prisma.EventScheduleWhereInput {
  return {
    OR: [
      {
        endsAt: {
          gt: now,
        },
      },
      {
        endsAt: null,
        startsAt: {
          gte: now,
        },
      },
    ],
  };
}

function transferableWhere(
  ownerId: string,
  now: Date
): Prisma.TicketWhereInput {
  return {
    ownerId,

    status: "VALID",
    usedAt: null,

    scans: {
      none: {
        result: "VALID",
      },
    },

    order: {
      is: {
        status: {
          in: [
            "PAID",
            "PARTIALLY_REFUNDED",
          ],
        },
        paidAt: {
          not: null,
        },
      },
    },

    event: {
      is: {
        status: "PUBLISHED",
      },
    },

    transfers: {
      none: {
        status: "PENDING",
        expiresAt: {
          gt: now,
        },
      },
    },

    OR: [
      {
        scheduleId: {
          not: null,
        },
        schedule: {
          is: activeSchedule(now),
        },
      },
      {
        scheduleId: null,
        event: {
          is: {
            schedules: {
              some: activeSchedule(now),
            },
          },
        },
      },
    ],
  };
}

/* ======================================================
   IMAGE PUBLIQUE
====================================================== */

function publicImageUrl(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null;
  }

  const image = value.trim();

  if (
    image.startsWith("/") &&
    !image.startsWith("//") &&
    !image.includes("\\") &&
    !/[\u0000-\u001f]/.test(image)
  ) {
    return image;
  }

  if (/^[a-zA-Z0-9_/-]+\.(?:jpe?g|png|webp)$/i.test(image) && !image.split("/").includes("..")) return image;

  try {
    const url = new URL(image);

    if (url.protocol === "https:") {
      return url.toString();
    }

    if (
      process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(
        url.hostname
      )
    ) {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

/* ======================================================
   CODE OTP

   EXACTEMENT LE MÊME HMAC QUE :
   /api/public/account/transfer/verify

   Le code est lié :
   - Au propriétaire
   - À son email
   - À la liste des transferts

   Le code brut n'est jamais stocké.
====================================================== */

function otpSecret(): string {
  const secret =
    process.env.TIKEMIA_OTP_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("OTP_SECRET_MISSING");
  }

  return secret;
}

function generateCode() {
  return randomInt(0, 1_000_000)
    .toString()
    .padStart(6, "0");
}

function hashTransferOtp(
  userId: string,
  email: string,
  transferIds: string[],
  code: string
): string {
  const ids = [...transferIds].sort();

  return createHmac(
    "sha256",
    otpSecret()
  )
    .update("tikemia:ticket-transfer-otp:v1")
    .update("\0")
    .update(userId)
    .update("\0")
    .update(email.toLowerCase())
    .update("\0")
    .update(ids.join(","))
    .update("\0")
    .update(code)
    .digest("hex");
}

function transferTokenHash() {
  const token = randomBytes(32);

  return createHash("sha256")
    .update(token)
    .digest("hex");
}

/* ======================================================
   EMAIL OTP — RESEND

   Les variables existantes sont :
   RESEND_API_KEY
   TIKEMIA_EMAIL_FROM

   Le code va uniquement à l'email
   vérifié du propriétaire actuel.
====================================================== */

async function sendCodeEmail(
  email: string,
  code: string,
  locale: Locale
): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from =
    process.env.TIKEMIA_EMAIL_FROM;

  if (!key || !from) {
    throw new Error("EMAIL_NOT_CONFIGURED");
  }

  const title =
    locale === "fr"
      ? "Code de transfert TIKEMIA"
      : "TIKEMIA transfer code";

  const text =
    locale === "fr"
      ? `TIKEMIA\n\nCode : ${code}\n\nValidité : 10 minutes.\nNe partagez pas ce code.`
      : `TIKEMIA\n\nCode: ${code}\n\nValid for 10 minutes.\nDo not share this code.`;

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    10_000
  );

  try {
    const response = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject: title,
          text,
        }),
        cache: "no-store",
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error("EMAIL_SEND_REJECTED");
    }

    const result: unknown =
      await response.json();

    if (
      !result ||
      typeof result !== "object" ||
      !("id" in result) ||
      typeof result.id !== "string"
    ) {
      throw new Error("EMAIL_SEND_UNCONFIRMED");
    }
  } finally {
    clearTimeout(timeout);
  }
}

/* ======================================================
   GET — LISTE DES BILLETS TRANSFÉRABLES

   Le frontend pourra utiliser cette
   liste pour sélectionner un ou
   plusieurs billets.

   Aucun QR, aucun PDF.
====================================================== */

export async function GET(
  request: NextRequest
) {
  try {
    if (!readTokenHash(request)) return fail("fr", "unauthorized", 401);
    const prisma = getPrisma();

    const user = await authenticatedUser(
      request,
      prisma
    );

    if (!user) {
      return fail("fr", "unauthorized", 401);
    }

    const params =
      request.nextUrl.searchParams;

    const page = positiveInt(
      params.get("page"),
      1,
      10000
    );

    const limit = positiveInt(
      params.get("limit"),
      DEFAULT_LIMIT,
      MAX_LIMIT
    );

    const now = new Date();

    const where = transferableWhere(
      user.id,
      now
    );

    const [total, tickets] =
      await Promise.all([
        prisma.ticket.count({
          where,
        }),

        prisma.ticket.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,

          orderBy: [
            {
              issuedAt: "desc",
            },
            {
              id: "desc",
            },
          ],

          select: {
            id: true,
            number: true,
            status: true,

            category: {
              select: {
                id: true,
                name: true,
              },
            },

            schedule: {
              select: {
                startsAt: true,
                endsAt: true,
              },
            },

            event: {
              select: {
                id: true,
                slug: true,
                title: true,
                timeZone: true,

                venue: {
                  select: {
                    name: true,
                    city: true,
                    country: true,
                  },
                },

                images: {
                  take: 1,
                  orderBy: [
                    {
                      isPrimary: "desc",
                    },
                    {
                      position: "asc",
                    },
                  ],
                  select: {
                    storageKey: true,
                  },
                },
              },
            },
          },
        }),
      ]);

    const data = tickets.map((ticket) => ({
      id: ticket.id,
      number: ticket.number,
      status: ticket.status,

      category: {
        id: ticket.category.id,
        name: ticket.category.name,
      },

      event: {
        id: ticket.event.id,
        slug: ticket.event.slug,
        title: ticket.event.title,
        timeZone: ticket.event.timeZone,

        imageUrl: publicImageUrl(
          ticket.event.images[0]?.storageKey
        ),

        venue: ticket.event.venue,
      },

      schedule: ticket.schedule
        ? {
            startsAt:
              ticket.schedule.startsAt.toISOString(),
            endsAt:
              ticket.schedule.endsAt
                ?.toISOString() ?? null,
          }
        : null,
    }));

    const totalPages = Math.ceil(
      total / limit
    );

    return respond({
      success: true,
      data: {
        tickets: data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });

  } catch (error) {
    unstable_rethrow(error);
    console.error(
      "[TIKEMIA_TRANSFER_GET]",
      error instanceof Error
        ? error.name
        : "UNKNOWN_ERROR"
    );

    return fail("fr", "unavailable", 503);
  }
}

/* ======================================================
   POST — DEMANDE DE TRANSFERT

   ENTRÉE :
   {
     "ticketIds": ["uuid-1", "uuid-2"],
     "recipientEmail": "client@example.com",
     "locale": "fr"
   }

   SORTIE :
   {
     "success": true,
     "transferIds": [...],
     "expiresAt": "...",
     "nextStep": "verify"
   }
====================================================== */

export async function POST(
  request: NextRequest
) {
  let locale: Locale = "fr";

  try {
    if (!validOrigin(request)) {
      return fail(locale, "invalid", 403);
    }

    const contentType =
      request.headers.get("content-type") ?? "";

    if (
      !contentType.toLowerCase()
        .startsWith("application/json")
    ) {
      return fail(locale, "invalid", 415);
    }

    const raw = await request.text();

    if (
      Buffer.byteLength(raw, "utf8") >
      MAX_BODY_BYTES
    ) {
      return fail(locale, "invalid", 413);
    }

    let body: TransferBody;

    try {
      const parsed: unknown = JSON.parse(raw);

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        return fail(locale, "invalid", 400);
      }

      body = parsed as TransferBody;
    } catch {
      return fail(locale, "invalid", 400);
    }

    locale =
      body.locale === "en" ? "en" : "fr";

    const ticketIds =
      parseTicketIds(body.ticketIds);

    const recipientEmail =
      normalizeEmail(body.recipientEmail);

    if (!ticketIds || !recipientEmail) {
      return fail(locale, "invalid", 400);
    }

    otpSecret();

    if (
      !process.env.RESEND_API_KEY ||
      !process.env.TIKEMIA_EMAIL_FROM
    ) {
      return fail(locale, "unavailable", 503);
    }

    const prisma = getPrisma();

    const user = await authenticatedUser(
      request,
      prisma
    );

    if (!user) {
      return fail(
        locale,
        "unauthorized",
        401
      );
    }

    if (
      recipientEmail ===
      user.email.trim().toLowerCase()
    ) {
      return fail(
        locale,
        "selfTransfer",
        400
      );
    }

    const code = generateCode();

    /*
      Transaction : réserver les demandes
      sans modifier les billets ni leurs QR.
    */

    const result =
      await prisma.$transaction<TransferResponse>(
        async (tx) => {
          const now = new Date();

          const expiresAt = new Date(
            now.getTime() +
            OTP_EXPIRY_MINUTES * 60_000
          );

          const hourAgo = new Date(
            now.getTime() -
            60 * 60_000
          );

          const cooldownStart = new Date(
            now.getTime() -
            OTP_COOLDOWN_SECONDS * 1000
          );

          /* Verrouiller l'expéditeur. */

          const lockedUser =
            await tx.$queryRaw<
              Array<{ id: string }>
            >`
              SELECT "id"
              FROM "User"
              WHERE "id" = ${user.id}::uuid
              FOR UPDATE
            `;

          if (lockedUser.length !== 1) {
            return {
              kind: "rejected",
              status: 401,
              code: "unauthorized",
            };
          }

          /* Limiter la fréquence des codes. */

          const latestOtp =
            await tx.userEmailVerification.findFirst({
              where: {
                userId: user.id,
                createdAt: {
                  gte: hourAgo,
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
            latestOtp &&
            latestOtp.createdAt >
              cooldownStart
          ) {
            return {
              kind: "rejected",
              status: 429,
              code: "cooldown",
            };
          }

          const recentOtpCount =
            await tx.userEmailVerification.count({
              where: {
                userId: user.id,
                createdAt: {
                  gte: hourAgo,
                },
              },
            });

          if (
            recentOtpCount >=
            MAX_REQUESTS_PER_HOUR
          ) {
            return {
              kind: "rejected",
              status: 429,
              code: "limit",
            };
          }

          /* Verrouiller les billets choisis. */

          for (const ticketId of ticketIds) {
            const locked =
              await tx.$queryRaw<
                Array<{ id: string }>
              >`
                SELECT "id"
                FROM "Ticket"
                WHERE "id" = ${ticketId}::uuid
                FOR UPDATE
              `;

            if (locked.length !== 1) {
              return {
                kind: "rejected",
                status: 409,
                code: "noTickets",
              };
            }
          }

          /*
            Valider tous les billets
            avant d'enregistrer la demande.
          */

          const validTickets =
            await tx.ticket.findMany({
              where: {
                AND: [
                  transferableWhere(
                    user.id,
                    now
                  ),
                  {
                    id: {
                      in: ticketIds,
                    },
                  },
                ],
              },
              select: {
                id: true,
              },
            });

          if (
            validTickets.length !==
            ticketIds.length
          ) {
            const pending =
              await tx.ticketTransfer.count({
                where: {
                  ticketId: {
                    in: ticketIds,
                  },
                  status: "PENDING",
                  expiresAt: {
                    gt: now,
                  },
                },
              });

            return {
              kind: "rejected",
              status: 409,
              code:
                pending > 0
                  ? "pending"
                  : "noTickets",
            };
          }

          /*
            Le destinataire peut avoir
            un compte ou non.

            Aucun compte n'est créé
            automatiquement ici.
          */

          const recipient =
            await tx.user.findUnique({
              where: {
                email: recipientEmail,
              },
              select: {
                id: true,
                fullName: true,
                emailVerifiedAt: true,
                isActive: true,
                isBlocked: true,
              },
            });

          const verifiedRecipient =
            recipient &&
            recipient.emailVerifiedAt &&
            recipient.isActive &&
            !recipient.isBlocked
              ? recipient
              : null;

          /*
            recipientName est obligatoire
            dans le modèle existant.

            Si aucun nom vérifié n'est
            disponible, conserver l'email
            plutôt qu'inventer un nom.
          */

          const recipientName =
            verifiedRecipient?.fullName
              ?.trim() ||
            recipientEmail;

          /*
            Créer un TicketTransfer
            par billet sélectionné.

            Tous les transferts sont liés
            au même OTP par leur liste
            d'identifiants.
          */

          const transfers: string[] = [];

          for (const ticketId of ticketIds) {
            const transfer =
              await tx.ticketTransfer.create({
                data: {
                  ticketId,
                  senderId: user.id,

                  recipientId:
                    verifiedRecipient?.id ??
                    null,

                  recipientName,
                  recipientEmail,

                  tokenHash:
                    transferTokenHash(),

                  status: "PENDING",
                  expiresAt,
                },
                select: {
                  id: true,
                },
              });

            transfers.push(transfer.id);
          }

          const transferIds =
            transfers.sort();

          /*
            Enregistrer l'OTP lié
            précisément à ces transferts.
          */

          const codeHash =
            hashTransferOtp(
              user.id,
              user.email,
              transferIds,
              code
            );

          await tx.userEmailVerification.create({
            data: {
              userId: user.id,
              email: user.email,

              codeHash,
              attempts: 0,
              expiresAt,
            },
          });

          return {
            kind: "created",
            transferIds,
            expiresAt:
              expiresAt.toISOString(),
            email: user.email,
          };
        },
        {
          isolationLevel: "Serializable",
          maxWait: 5000,
          timeout: 15000,
        }
      );

    if (result.kind === "rejected") {
      const errorCode =
        result.code as ErrorCode;

      return fail(
        locale,
        errorCode in messages.fr
          ? errorCode
          : "invalid",
        result.status
      );
    }

    /*
      Envoyer le code uniquement
      au propriétaire actuel.
    */

    try {
      await sendCodeEmail(
        result.email,
        code,
        locale
      );
    } catch {
      /*
        Si l'envoi n'a pas été confirmé,
        annuler les demandes créées.

        Aucun billet n'a été modifié.
      */

      await prisma.$transaction(async (tx) => {
        await tx.ticketTransfer.updateMany({
          where: {
            id: {
              in: result.transferIds,
            },
            status: "PENDING",
          },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
          },
        });

        const transferOtpHash =
          hashTransferOtp(
            user.id,
            user.email,
            result.transferIds,
            code
          );

        await tx.userEmailVerification.updateMany({
          where: {
            userId: user.id,
            codeHash: transferOtpHash,
            consumedAt: null,
          },
          data: {
            consumedAt: new Date(),
          },
        });
      });

      return fail(
        locale,
        "emailFailed",
        503
      );
    }

    return respond({
      success: true,
      message: messages[locale].sent,
      transferIds: result.transferIds,
      expiresAt: result.expiresAt,
      nextStep: "verify",
    });

  } catch (error) {
    unstable_rethrow(error);
    console.error(
      "[TIKEMIA_TRANSFER_POST]",
      error instanceof Error
        ? error.name
        : "UNKNOWN_ERROR"
    );

    return fail(
      locale,
      "unavailable",
      503
    );
  }
}

async function resolveAccountMedia<T>(body: T): Promise<T> {
  const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const entries: Array<{ record: Record<string, unknown>; field: string; path: string; bucket: string }> = [];
  function collect(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(collect); return; }
    const record = value as Record<string, unknown>;
    for (const [field, child] of Object.entries(record)) {
      if (["imageUrl", "avatarUrl"].includes(field) && typeof child === "string" && /^[a-zA-Z0-9_/-]+\.(?:jpe?g|png|webp)$/i.test(child) && !child.startsWith("/") && !child.split("/").includes("..")) {
        entries.push({ record, field, path: child, bucket: field === "avatarUrl" ? process.env.SUPABASE_AVATAR_BUCKET || "profile-avatars" : process.env.SUPABASE_EVENT_BUCKET || "event-images" });
        record[field] = null;
      } else if (child && typeof child === "object") collect(child);
    }
  }
  collect(body);
  if (!base || !secret || !entries.length) return body;
  const client = createClient(base, secret, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(10000) }) } });
  await Promise.all([...new Set(entries.map(item => item.bucket))].map(async bucket => {
    const paths = [...new Set(entries.filter(item => item.bucket === bucket).map(item => item.path))];
    try {
      const { data, error } = await client.storage.from(bucket).createSignedUrls(paths, 300);
      if (!error && data) for (const item of entries) if (item.bucket === bucket) item.record[item.field] = data.find(file => file.path === item.path)?.signedUrl ?? null;
    } catch { /* Keep an unavailable image isolated from the account data. */ }
  }));
  return body;
}
