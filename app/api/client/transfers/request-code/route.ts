import {
  createHash,
  randomBytes,
  randomInt,
} from "node:crypto";

import {
  Prisma,
  TicketStatus,
  TicketTransferStatus,
  TransferEmailStatus,
} from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { sendTransferCodeEmail } from "@/lib/client/transfers/send-transfer-code-email";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLIENT_SESSION_COOKIE_NAME =
  process.env.CLIENT_SESSION_COOKIE_NAME?.trim() ||
  "tikemia_client_session";

const TRANSFER_CODE_EXPIRES_MINUTES = 10;
const MAX_TICKETS_PER_TRANSFER = 10;

const ACTIVE_TRANSFER_STATUSES: TicketTransferStatus[] = [
  TicketTransferStatus.PENDING_VERIFICATION,
  TicketTransferStatus.PROCESSING,
];

const requestCodeSchema = z
  .object({
    recipientId: z
      .string()
      .trim()
      .min(1, "Le destinataire est obligatoire.")
      .max(100, "Le destinataire est invalide."),

    ticketIds: z
      .array(
        z
          .string()
          .trim()
          .min(1, "Un billet sélectionné est invalide.")
          .max(100, "Un billet sélectionné est invalide."),
      )
      .min(1, "Sélectionnez au moins un billet.")
      .max(
        MAX_TICKETS_PER_TRANSFER,
        `Vous pouvez transférer au maximum ${MAX_TICKETS_PER_TRANSFER} billets à la fois.`,
      ),
  })
  .strict();

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

const globalForTransferCodeRateLimit =
  globalThis as typeof globalThis & {
    tikemiaTransferCodeRateLimit?: Map<
      string,
      RateLimitEntry
    >;
  };

const transferCodeRateLimit =
  globalForTransferCodeRateLimit
    .tikemiaTransferCodeRateLimit ??
  new Map<string, RateLimitEntry>();

if (process.env.NODE_ENV !== "production") {
  globalForTransferCodeRateLimit
    .tikemiaTransferCodeRateLimit =
    transferCodeRateLimit;
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, max-age=0",
      Pragma:
        "no-cache",
    },
  });
}

function hashValue(
  value: string,
): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function hashTransferCode({
  transferReference,
  code,
}: {
  transferReference: string;
  code: string;
}): string {
  const secret =
    process.env.TRANSFER_CODE_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    "";

  return hashValue(
    `${transferReference}:${code}:${secret}`,
  );
}

function generateCode(): string {
  return randomInt(
    100000,
    1000000,
  ).toString();
}

function generateTransferReference(): string {
  const datePart =
    new Date()
      .toISOString()
      .slice(0, 10)
      .replaceAll("-", "");

  const randomPart =
    randomBytes(5)
      .toString("hex")
      .toUpperCase();

  return `TRF-${datePart}-${randomPart}`;
}

function getRequestAddress(
  request: Request,
): string {
  return (
    request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim() ||
    request.headers
      .get("x-real-ip")
      ?.trim() ||
    "unknown"
  );
}

function consumeRateLimit(
  key: string,
): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now =
    Date.now();

  const current =
    transferCodeRateLimit.get(
      key,
    );

  if (
    !current ||
    current.resetAt <= now
  ) {
    transferCodeRateLimit.set(
      key,
      {
        count: 1,
        resetAt:
          now +
          RATE_LIMIT_WINDOW_MS,
      },
    );

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  if (
    current.count >=
    RATE_LIMIT_MAX_REQUESTS
  ) {
    return {
      allowed: false,
      retryAfterSeconds:
        Math.max(
          1,
          Math.ceil(
            (current.resetAt -
              now) /
              1000,
          ),
        ),
    };
  }

  current.count += 1;

  transferCodeRateLimit.set(
    key,
    current,
  );

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

async function getAuthenticatedCustomer() {
  const cookieStore =
    await cookies();

  const sessionToken =
    cookieStore
      .get(
        CLIENT_SESSION_COOKIE_NAME,
      )
      ?.value?.trim();

  if (!sessionToken) {
    return null;
  }

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash:
          hashValue(
            sessionToken,
          ),
      },

      select: {
        id: true,
        expiresAt: true,

        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
            emailVerified: true,
            isActive: true,
          },
        },
      },
    });

  if (!session) {
    return null;
  }

  if (
    session.expiresAt.getTime() <=
    Date.now()
  ) {
    await prisma.session
      .delete({
        where: {
          id:
            session.id,
        },
      })
      .catch(() => undefined);

    return null;
  }

  if (
    session.user.role !==
      "CUSTOMER" ||
    !session.user.emailVerified ||
    !session.user.isActive
  ) {
    return null;
  }

  return session.user;
}

function hasDuplicateValues(
  values: string[],
): boolean {
  return (
    new Set(values).size !==
    values.length
  );
}

export async function POST(
  request: Request,
) {
  try {
    const customer =
      await getAuthenticatedCustomer();

    if (!customer) {
      return jsonResponse(
        {
          success: false,
          code: "UNAUTHORIZED",
          message:
            "Connectez-vous à votre compte Tikemia pour effectuer un transfert.",
        },
        401,
      );
    }

    const rateLimit =
      consumeRateLimit(
        `${customer.id}:${getRequestAddress(
          request,
        )}`,
      );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: "TOO_MANY_REQUESTS",
          message:
            "Trop de codes ont été demandés. Réessayez dans quelques minutes.",
        },
        {
          status: 429,
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
            "Retry-After":
              String(
                rateLimit.retryAfterSeconds,
              ),
          },
        },
      );
    }

    let rawBody: unknown;

    try {
      rawBody =
        await request.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_JSON",
          message:
            "La requête envoyée est invalide.",
        },
        400,
      );
    }

    const parsedBody =
      requestCodeSchema.safeParse(
        rawBody,
      );

    if (!parsedBody.success) {
      return jsonResponse(
        {
          success: false,
          code: "INVALID_REQUEST",
          message:
            parsedBody.error.issues[0]
              ?.message ||
            "Les informations du transfert sont invalides.",
        },
        400,
      );
    }

    const {
      recipientId,
      ticketIds,
    } =
      parsedBody.data;

    if (
      hasDuplicateValues(
        ticketIds,
      )
    ) {
      return jsonResponse(
        {
          success: false,
          code: "DUPLICATE_TICKETS",
          message:
            "Un même billet ne peut pas être sélectionné plusieurs fois.",
        },
        400,
      );
    }

    if (
      recipientId ===
      customer.id
    ) {
      return jsonResponse(
        {
          success: false,
          code: "SELF_TRANSFER_NOT_ALLOWED",
          message:
            "Vous ne pouvez pas transférer des billets vers votre propre compte.",
        },
        409,
      );
    }

    const recipient =
      await prisma.user.findFirst({
        where: {
          id:
            recipientId,
          role:
            "CUSTOMER",
          emailVerified:
            true,
          isActive:
            true,
        },

        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      });

    if (!recipient) {
      return jsonResponse(
        {
          success: false,
          code: "RECIPIENT_NOT_FOUND",
          message:
            "Le compte Tikemia du destinataire est introuvable ou indisponible.",
        },
        404,
      );
    }

    const now =
      new Date();

    const tickets =
      await prisma.ticket.findMany({
        where: {
          id: {
            in:
              ticketIds,
          },

          ownerId:
            customer.id,

          status:
            TicketStatus.VALID,

          event: {
            status:
              "PUBLISHED",

            startsAt: {
              gt:
                now,
            },

            organizer: {
              organizerSettings: {
                is: {
                  allowTicketTransfer:
                    true,
                },
              },
            },
          },

          transferItems: {
            none: {
              transfer: {
                status: {
                  in:
                    ACTIVE_TRANSFER_STATUSES,
                },
              },
            },
          },
        },

        select: {
          id: true,
          holderName: true,
          holderEmail: true,
          holderPhone: true,
          ownerId: true,

          event: {
            select: {
              id: true,
              title: true,
              startsAt: true,
            },
          },

          ticketType: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

    if (
      tickets.length !==
      ticketIds.length
    ) {
      return jsonResponse(
        {
          success: false,
          code: "TICKETS_NOT_TRANSFERABLE",
          message:
            "Un ou plusieurs billets ne sont plus disponibles pour le transfert. Actualisez la page et réessayez.",
        },
        409,
      );
    }

    const eventIds =
      new Set(
        tickets.map(
          (ticket) =>
            ticket.event.id,
        ),
      );

    if (
      eventIds.size !==
      1
    ) {
      return jsonResponse(
        {
          success: false,
          code: "MULTIPLE_EVENTS_NOT_ALLOWED",
          message:
            "Les billets d’un même transfert doivent appartenir au même événement.",
        },
        400,
      );
    }

    const transferReference =
      generateTransferReference();

    const code =
      generateCode();

    const verificationExpiresAt =
      new Date(
        now.getTime() +
          TRANSFER_CODE_EXPIRES_MINUTES *
            60 *
            1000,
      );

    const recipientFullName =
      `${recipient.firstName} ${recipient.lastName}`.trim();

    let transfer:
      | {
          id: string;
          reference: string;
        }
      | null =
      null;

    try {
      transfer =
        await prisma.$transaction(
          async (
            transaction,
          ) => {
            const stillAvailableCount =
              await transaction.ticket.count({
                where: {
                  id: {
                    in:
                      ticketIds,
                  },

                  ownerId:
                    customer.id,

                  status:
                    TicketStatus.VALID,

                  event: {
                    status:
                      "PUBLISHED",

                    startsAt: {
                      gt:
                        new Date(),
                    },

                    organizer: {
                      organizerSettings: {
                        is: {
                          allowTicketTransfer:
                            true,
                        },
                      },
                    },
                  },

                  transferItems: {
                    none: {
                      transfer: {
                        status: {
                          in:
                            ACTIVE_TRANSFER_STATUSES,
                        },
                      },
                    },
                  },
                },
              });

            if (
              stillAvailableCount !==
              ticketIds.length
            ) {
              throw new Error(
                "TICKETS_NO_LONGER_AVAILABLE",
              );
            }

            return transaction.ticketTransfer.create({
              data: {
                reference:
                  transferReference,

                senderId:
                  customer.id,

                recipientId:
                  recipient.id,

                status:
                  TicketTransferStatus.PENDING_VERIFICATION,

                verificationCodeHash:
                  hashTransferCode({
                    transferReference,
                    code,
                  }),

                verificationAttempts:
                  0,

                verificationResendCount:
                  0,

                verificationExpiresAt,

                verificationCodeSentAt:
                  now,

                verificationEmailStatus:
                  TransferEmailStatus.PENDING,

                items: {
                  create:
                    tickets.map(
                      (
                        ticket,
                      ) => ({
                        ticketId:
                          ticket.id,

                        previousOwnerId:
                          ticket.ownerId,

                        previousHolderName:
                          ticket.holderName,

                        previousHolderEmail:
                          ticket.holderEmail,

                        previousHolderPhone:
                          ticket.holderPhone,

                        newOwnerId:
                          recipient.id,

                        newHolderName:
                          recipientFullName,

                        newHolderEmail:
                          recipient.email,

                        newHolderPhone:
                          recipient.phone,
                      }),
                    ),
                },
              },

              select: {
                id: true,
                reference: true,
              },
            });
          },
          {
            isolationLevel:
              Prisma.TransactionIsolationLevel.Serializable,

            maxWait:
              5000,

            timeout:
              10000,
          },
        );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message ===
          "TICKETS_NO_LONGER_AVAILABLE"
      ) {
        return jsonResponse(
          {
            success: false,
            code: "TICKETS_NOT_TRANSFERABLE",
            message:
              "Un ou plusieurs billets viennent d’être réservés ou ne sont plus transférables.",
          },
          409,
        );
      }

      throw error;
    }

    const emailResult =
      await sendTransferCodeEmail({
        to:
          customer.email,

        firstName:
          customer.firstName,

        code,

        expiresInMinutes:
          TRANSFER_CODE_EXPIRES_MINUTES,

        transferReference:
          transfer.reference,

        recipientName:
          recipientFullName,

        ticketsCount:
          tickets.length,
      });

    if (!emailResult.success) {
      await prisma.ticketTransfer.update({
        where: {
          id:
            transfer.id,
        },

        data: {
          status:
            TicketTransferStatus.FAILED,

          failedAt:
            new Date(),

          failureReason:
            "Impossible d’envoyer le code de confirmation.",

          verificationEmailStatus:
            TransferEmailStatus.FAILED,

          verificationEmailFailureReason:
            emailResult.error,
        },
      });

      return jsonResponse(
        {
          success: false,
          code: "EMAIL_SEND_FAILED",
          message:
            "Le code de confirmation n’a pas pu être envoyé. Aucun billet n’a été transféré.",
        },
        502,
      );
    }

    await prisma.ticketTransfer.update({
      where: {
        id:
          transfer.id,
      },

      data: {
        verificationEmailStatus:
          TransferEmailStatus.SENT,

        verificationEmailFailureReason:
          null,

        verificationCodeSentAt:
          new Date(),
      },
    });

    return jsonResponse(
      {
        success: true,

        message:
          "Un code de confirmation a été envoyé à votre adresse e-mail.",

        transfer: {
          reference:
            transfer.reference,

          ticketsCount:
            tickets.length,

          recipient: {
            id:
              recipient.id,

            firstName:
              recipient.firstName,

            lastName:
              recipient.lastName,

            fullName:
              recipientFullName,
          },

          event: {
            id:
              tickets[0].event.id,

            title:
              tickets[0].event.title,

            startsAt:
              tickets[0].event.startsAt.toISOString(),
          },

          expiresAt:
            verificationExpiresAt.toISOString(),

          expiresInMinutes:
            TRANSFER_CODE_EXPIRES_MINUTES,
        },
      },
      201,
    );
  } catch (error) {
    console.error(
      "[CLIENT_TRANSFER_REQUEST_CODE_ERROR]",
      error,
    );

    return jsonResponse(
      {
        success: false,
        code: "INTERNAL_ERROR",
        message:
          "Impossible de préparer le transfert pour le moment. Réessayez.",
      },
      500,
    );
  }
}