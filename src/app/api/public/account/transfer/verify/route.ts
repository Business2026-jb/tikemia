import { getTrustedRequestOrigin } from "@/lib/tikemia-pay/providers";
import { after } from "next/server";
import { runEmailWorker } from "@/lib/email/worker";
import { createTicketQrToken } from "@/lib/tickets/qr";
import { unstable_rethrow } from "next/navigation";

import {
  createHash,
  createHmac,
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

/* ======================================================
   TIKEMIA — CONFIRMATION TRANSFERT
   POST /api/public/account/transfer/verify

   - Session obligatoire
   - OTP à six chiffres
   - Un ou plusieurs billets
   - Transaction atomique
   - Anciens QR invalidés
   - Nouveau propriétaire
   - Livraison PDF mise en file
====================================================== */

const COOKIE = "tikemia_session";
const MAX_BODY_BYTES = 8192;
const MAX_TICKETS = 20;
const MAX_ATTEMPTS = 5;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Locale = "fr" | "en";

type RequestBody = {
  transferIds?: unknown;
  code?: unknown;
  locale?: unknown;
};

type Result =
  | {
      kind: "success";
      deliveryId: string;
      count: number;
      recipientEmail: string;
    }
  | {
      kind: "error";
      status: number;
      code: string;
    };

const TEXT = {
  fr: {
    unauthorized: "Connexion requise.",
    invalid: "Demande invalide.",
    code: "Code incorrect ou expiré.",
    attempts: "Demandez un nouveau code.",
    tickets: "Billet indisponible.",
    unavailable: "Service indisponible.",
    success: "Transfert confirmé.",
  },
  en: {
    unauthorized: "Sign in required.",
    invalid: "Invalid request.",
    code: "Invalid or expired code.",
    attempts: "Request a new code.",
    tickets: "Ticket unavailable.",
    unavailable: "Service unavailable.",
    success: "Transfer confirmed.",
  },
};

const prismaGlobal =
  globalThis as typeof globalThis & {
    tikemiaPrisma?: PrismaClient;
  };

function getPrisma() {
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

function json(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function fail(
  locale: Locale,
  code: keyof typeof TEXT.fr,
  status: number
) {
  return json(
    {
      success: false,
      code,
      message: TEXT[locale][code],
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

  return !origin ||
    origin === getTrustedRequestOrigin(request);
}

function sessionHash(
  request: NextRequest
): string | null {
  const token =
    request.cookies.get(COOKIE)?.value;

  if (
    !token ||
    !/^[a-f0-9]{64}$/i.test(token)
  ) {
    return null;
  }

  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function getSecret(): string {
  const secret =
    process.env.TIKEMIA_OTP_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("OTP_SECRET_MISSING");
  }

  return secret;
}

/* ======================================================
   OTP LIÉ À L'ENSEMBLE DES TRANSFERTS

   La route de demande doit utiliser
   exactement cette méthode.

   Elle crée :
   - Les TicketTransfer PENDING
   - Un UserEmailVerification
   - Un code envoyé à l'expéditeur

   Le code est lié :
   - Au propriétaire
   - À son email
   - Aux identifiants des transferts
====================================================== */

function hashTransferOtp(
  userId: string,
  email: string,
  transferIds: string[],
  code: string
): string {
  const ids = [...transferIds].sort();

  return createHmac(
    "sha256",
    getSecret()
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

function sameHash(
  first: string,
  second: string
) {
  if (
    !/^[a-f0-9]{64}$/i.test(first) ||
    !/^[a-f0-9]{64}$/i.test(second)
  ) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(first, "hex"),
    Buffer.from(second, "hex")
  );
}

/* ======================================================
   NOUVEAU JETON QR

   Un jeton différent pour chaque
   nouveau transfert.

   Le PDF devra encoder la valeur
   opaque retournée par cette fonction.

   La base conserve uniquement
   SHA-256(jeton).

   Le service PDF pourra reconstruire
   le jeton à partir de :
   - ticketId
   - transferId
   - TIKEMIA_OTP_SECRET

   La valeur brute n'est jamais
   retournée au navigateur.
====================================================== */

function newQrToken(ticketId: string, transferId: string): string { return createTicketQrToken(ticketId, transferId); }

function qrDigest(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function isUsableDate(
  schedule: {
    startsAt: Date;
    endsAt: Date | null;
  } | null,
  eventSchedules: Array<{
    startsAt: Date;
    endsAt: Date | null;
  }>,
  now: Date
) {
  function active(item: {
    startsAt: Date;
    endsAt: Date | null;
  }) {
    return item.endsAt
      ? item.endsAt > now
      : item.startsAt >= now;
  }

  if (schedule) {
    return active(schedule);
  }

  return eventSchedules.some(active);
}

/* ======================================================
   POST
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

    const contentLength = Number(
      request.headers.get("content-length") ?? "0"
    );

    if (
      contentLength > MAX_BODY_BYTES
    ) {
      return fail(locale, "invalid", 413);
    }

    const raw = await request.text();

    if (
      Buffer.byteLength(raw, "utf8") >
      MAX_BODY_BYTES
    ) {
      return fail(locale, "invalid", 413);
    }

    let body: RequestBody;

    try {
      const parsed: unknown = JSON.parse(raw);

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        return fail(locale, "invalid", 400);
      }

      body = parsed as RequestBody;
    } catch {
      return fail(locale, "invalid", 400);
    }

    locale =
      body.locale === "en" ? "en" : "fr";

    if (
      !Array.isArray(body.transferIds) ||
      body.transferIds.length === 0 ||
      body.transferIds.length > MAX_TICKETS ||
      !body.transferIds.every(
        (id): id is string =>
          typeof id === "string" &&
          UUID_REGEX.test(id)
      ) ||
      typeof body.code !== "string" ||
      !/^\d{6}$/.test(body.code)
    ) {
      return fail(locale, "invalid", 400);
    }

    const transferIds =
      [...body.transferIds].sort();

    if (
      new Set(transferIds).size !==
      transferIds.length
    ) {
      return fail(locale, "invalid", 400);
    }

    const secret = getSecret();
    void secret;

    const hash = sessionHash(request);

    if (!hash) {
      return fail(locale, "unauthorized", 401);
    }

    const prisma = getPrisma();
    const now = new Date();

    const session =
      await prisma.session.findUnique({
        where: {
          tokenHash: hash,
        },
        select: {
          expiresAt: true,
          revokedAt: true,
          user: {
            select: {
              id: true,
              email: true,
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
      session.expiresAt <= now ||
      !session.user.emailVerifiedAt ||
      !session.user.isActive ||
      session.user.isBlocked ||
      session.user.roles.length === 0
    ) {
      return fail(
        locale,
        "unauthorized",
        401
      );
    }

    const user = session.user;

    /* ==================================================
       TRANSACTION ATOMIQUE

       Tous les billets changent
       de propriétaire ensemble.

       Si un contrôle échoue,
       aucun billet n'est transféré.
    ================================================== */

    const result =
      await prisma.$transaction<Result>(
        async (tx) => {
          const current = new Date();

          /* ==============================================
             VERROUILLER LE COMPTE

             Sérialise les confirmations
             d'un même expéditeur.
          ============================================== */

          await tx.$queryRaw`
            SELECT "id"
            FROM "User"
            WHERE "id" = ${user.id}::uuid
            FOR UPDATE
          `;

          /* ==============================================
             VERROUILLER LES TRANSFERTS
          ============================================== */

          for (const id of transferIds) {
            const locked = await tx.$queryRaw<
              Array<{ id: string }>
            >`
              SELECT "id"
              FROM "TicketTransfer"
              WHERE "id" = ${id}::uuid
              FOR UPDATE
            `;

            if (locked.length !== 1) {
              return {
                kind: "error",
                status: 400,
                code: "tickets",
              };
            }
          }

          const transfers =
            await tx.ticketTransfer.findMany({
              where: {
                id: {
                  in: transferIds,
                },
              },
              select: {
                id: true,
                ticketId: true,
                senderId: true,
                recipientEmail: true,
                status: true,
                expiresAt: true,
              },
              orderBy: {
                id: "asc",
              },
            });

          if (
            transfers.length !==
            transferIds.length
          ) {
            return {
              kind: "error",
              status: 400,
              code: "tickets",
            };
          }

          const recipientEmail =
            transfers[0].recipientEmail
              .trim()
              .toLowerCase();

          if (
            !recipientEmail ||
            recipientEmail ===
              user.email.toLowerCase() ||
            transfers.some(
              (transfer) =>
                transfer.senderId !== user.id ||
                transfer.status !== "PENDING" ||
                transfer.expiresAt <= current ||
                transfer.recipientEmail
                  .trim()
                  .toLowerCase() !==
                  recipientEmail
            ) ||
            new Set(
              transfers.map(
                (transfer) =>
                  transfer.ticketId
              )
            ).size !== transfers.length
          ) {
            return {
              kind: "error",
              status: 400,
              code: "tickets",
            };
          }

          /* ==============================================
             VERROUILLER LES BILLETS
          ============================================== */

          const ticketIds =
            transfers
              .map((item) => item.ticketId)
              .sort();

          for (const id of ticketIds) {
            const locked = await tx.$queryRaw<
              Array<{ id: string }>
            >`
              SELECT "id"
              FROM "Ticket"
              WHERE "id" = ${id}::uuid
              FOR UPDATE
            `;

            if (locked.length !== 1) {
              return {
                kind: "error",
                status: 409,
                code: "tickets",
              };
            }
          }

          /* ==============================================
             RECHERCHER LE CODE OTP

             Le code doit être celui
             émis après la demande
             de transfert actuelle.
          ============================================== */

          const firstTransfer =
            transfers[0];

          const oldestRequest =
            await tx.ticketTransfer.findUnique({
              where: {
                id: firstTransfer.id,
              },
              select: {
                createdAt: true,
              },
            });

          if (!oldestRequest) {
            return {
              kind: "error",
              status: 400,
              code: "code",
            };
          }

          const otp =
            await tx.userEmailVerification.findFirst({
              where: {
                userId: user.id,
                email: user.email,
                consumedAt: null,
                createdAt: {
                  gte: new Date(
                    oldestRequest.createdAt.getTime() -
                    60_000
                  ),
                },
              },
              orderBy: {
                createdAt: "desc",
              },
              select: {
                id: true,
                codeHash: true,
                attempts: true,
                expiresAt: true,
                consumedAt: true,
              },
            });

          if (!otp) {
            return {
              kind: "error",
              status: 400,
              code: "code",
            };
          }

          await tx.$queryRaw`
            SELECT "id"
            FROM "UserEmailVerification"
            WHERE "id" = ${otp.id}::uuid
            FOR UPDATE
          `;

          const lockedOtp =
            await tx.userEmailVerification.findUnique({
              where: {
                id: otp.id,
              },
              select: {
                id: true,
                codeHash: true,
                attempts: true,
                consumedAt: true,
                expiresAt: true,
              },
            });

          if (
            !lockedOtp ||
            lockedOtp.consumedAt !== null ||
            lockedOtp.expiresAt <= current
          ) {
            return {
              kind: "error",
              status: 400,
              code: "code",
            };
          }

          if (
            lockedOtp.attempts >= MAX_ATTEMPTS
          ) {
            return {
              kind: "error",
              status: 429,
              code: "attempts",
            };
          }

          const expectedHash =
            hashTransferOtp(
              user.id,
              user.email,
              transferIds,
              body.code as string
            );

          if (
            !sameHash(
              lockedOtp.codeHash,
              expectedHash
            )
          ) {
            const nextAttempts =
              lockedOtp.attempts + 1;

            await tx.userEmailVerification.update({
              where: {
                id: lockedOtp.id,
              },
              data: {
                attempts: nextAttempts,
                ...(nextAttempts >= MAX_ATTEMPTS
                  ? {
                      consumedAt: current,
                    }
                  : {}),
              },
            });

            return {
              kind: "error",
              status:
                nextAttempts >= MAX_ATTEMPTS
                  ? 429
                  : 400,
              code:
                nextAttempts >= MAX_ATTEMPTS
                  ? "attempts"
                  : "code",
            };
          }

          /* ==============================================
             DESTINATAIRE

             Un compte non vérifié
             n'est pas reconnu comme
             propriétaire authentifié.

             Dans ce cas, le billet
             est lié à guestEmail.
          ============================================== */

          const recipient =
            await tx.user.findUnique({
              where: {
                email: recipientEmail,
              },
              select: {
                id: true,
                emailVerifiedAt: true,
                isActive: true,
                isBlocked: true,
              },
            });

          const recipientId =
            recipient &&
            recipient.emailVerifiedAt &&
            recipient.isActive &&
            !recipient.isBlocked
              ? recipient.id
              : null;

          /* ==============================================
             VÉRIFIER TOUS LES BILLETS

             - Propriétaire
             - Statut VALID
             - Aucun scan réussi
             - Paiement confirmé
             - Événement publié
             - Date utilisable
          ============================================== */

          const tickets =
            await tx.ticket.findMany({
              where: {
                id: {
                  in: ticketIds,
                },
              },
              select: {
                id: true,
                ownerId: true,
                status: true,
                usedAt: true,
                order: {
                  select: {
                    status: true,
                    paidAt: true,
                  },
                },
                scans: {
                  where: {
                    result: "VALID",
                  },
                  take: 1,
                  select: {
                    id: true,
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
                    status: true,
                    schedules: {
                      select: {
                        startsAt: true,
                        endsAt: true,
                      },
                    },
                  },
                },
              },
            });

          if (
            tickets.length !==
            ticketIds.length
          ) {
            return {
              kind: "error",
              status: 409,
              code: "tickets",
            };
          }

          for (const ticket of tickets) {
            const valid =
              ticket.ownerId === user.id &&
              ticket.status === "VALID" &&
              ticket.usedAt === null &&
              ticket.scans.length === 0 &&
              ticket.order.paidAt !== null &&
              (
                ticket.order.status === "PAID" ||
                ticket.order.status ===
                  "PARTIALLY_REFUNDED"
              ) &&
              ticket.event.status ===
                "PUBLISHED" &&
              isUsableDate(
                ticket.schedule,
                ticket.event.schedules,
                current
              );

            if (!valid) {
              return {
                kind: "error",
                status: 409,
                code: "tickets",
              };
            }
          }

          /* ==============================================
             TRANSFERT DES BILLETS

             Le même enregistrement
             Ticket est conservé.

             On remplace :
             - Le propriétaire
             - L'ancien QR
             - La référence PDF

             L'ancien PDF devient
             obsolète immédiatement.
          ============================================== */

          for (const transfer of transfers) {
            const token =
              newQrToken(
                transfer.ticketId,
                transfer.id
              );

            const digest =
              qrDigest(token);

            const updated =
              await tx.ticket.updateMany({
                where: {
                  id: transfer.ticketId,
                  ownerId: user.id,
                  status: "VALID",
                  usedAt: null,
                },
                data: {
                  ownerId: recipientId,
                  guestEmail:
                    recipientId
                      ? null
                      : recipientEmail,
                  qrTokenHash: digest,
                  pdfStorageKey: null,
                },
              });

            if (updated.count !== 1) {
              throw new Error(
                "TRANSFER_CONCURRENT_MODIFICATION"
              );
            }

            await tx.ticketTransfer.update({
              where: {
                id: transfer.id,
              },
              data: {
                recipientId,
                status: "ACCEPTED",
                acceptedAt: current,
              },
            });
          }

          /* ==============================================
             CODE À USAGE UNIQUE
          ============================================== */

          await tx.userEmailVerification.update({
            where: {
              id: lockedOtp.id,
            },
            data: {
              consumedAt: current,
            },
          });

          /* ==============================================
             LIVRAISON EMAIL

             Crée une demande persistante
             pour le système de livraison
             transactionnelle.

             L'email n'est pas déclaré
             envoyé avant son traitement.

             Le générateur PDF doit :
             - Recréer les jetons QR
             - Générer les PDF
             - Envoyer les billets
             - Passer EmailDelivery à SENT
          ============================================== */

          const delivery =
            await tx.emailDelivery.create({
              data: {
                userId: recipientId,
                recipient: recipientEmail,
                template:
                  "TICKET_TRANSFER_PDF",
                locale,
                subject:
                  locale === "fr"
                    ? "TIKEMIA — Vos billets transférés"
                    : "TIKEMIA — Your transferred tickets",
                status: "QUEUED",
              },
              select: {
                id: true,
              },
            });

          /* ==============================================
             AUDIT

             L'identifiant de livraison
             et les transferts permettent
             au traitement PDF existant
             de retrouver les billets.

             Aucun OTP et aucun jeton
             QR brut dans les journaux.
          ============================================== */

          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action:
                "TICKET_TRANSFER_CONFIRMED",
              entity:
                "EmailDelivery",
              entityId:
                delivery.id,
              metadata: {
                transferIds,
                ticketIds,
                deliveryId: delivery.id,
                count: transfers.length,
                recipientEmail,
              },
            },
          });

          return {
            kind: "success",
            count: transfers.length,
            deliveryId: delivery.id,
            recipientEmail,
          };
        },
        {
          isolationLevel:
            "Serializable",
          maxWait: 5000,
          timeout: 20000,
        }
      );

    if (result.kind === "error") {
      const key =
        result.code === "code"
          ? "code"
          : result.code === "attempts"
            ? "attempts"
            : "tickets";

      return fail(
        locale,
        key,
        result.status
      );
    }

    after(async () => { await runEmailWorker({ batchSize: 1, deliveryId: result.deliveryId }); });
    return json({
      success: true,
      message: TEXT[locale].success,
      transferredCount: result.count,
      recipientEmail: result.recipientEmail,
      deliveryStatus: "QUEUED",
      redirectTo: "/account/tickets",
    });

  } catch (error) {
    unstable_rethrow(error);
    console.error(
      "[TIKEMIA_TRANSFER_VERIFY]",
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
