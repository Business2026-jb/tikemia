import {
  createHash,
  timingSafeEqual,
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

import {
  sendTransferRecipientNotificationEmail,
  type TransferTicketPdfAttachment,
} from "@/lib/client/transfers/send-transfer-recipient-notification-email";
import { sendTransferSenderConfirmationEmail } from "@/lib/client/transfers/send-transfer-sender-confirmation-email";
import { prisma } from "@/lib/prisma";
import { generateTicketPdf } from "@/lib/tickets/generate-ticket-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CLIENT_SESSION_COOKIE_NAME =
  process.env.CLIENT_SESSION_COOKIE_NAME?.trim() ||
  "tikemia_client_session";

const MAX_VERIFICATION_ATTEMPTS = 5;

const ACTIVE_TRANSFER_STATUSES: TicketTransferStatus[] = [
  TicketTransferStatus.PENDING_VERIFICATION,
  TicketTransferStatus.PROCESSING,
];

const confirmTransferSchema = z
  .object({
    reference: z
      .string()
      .trim()
      .min(
        8,
        "La référence du transfert est invalide.",
      )
      .max(
        100,
        "La référence du transfert est invalide.",
      ),

    code: z
      .string()
      .trim()
      .regex(
        /^\d{6}$/,
        "Le code doit contenir exactement 6 chiffres.",
      ),
  })
  .strict();

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type AuthenticatedCustomer = Readonly<{
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}>;

const RATE_LIMIT_WINDOW_MS =
  10 * 60 * 1000;

const RATE_LIMIT_MAX_REQUESTS =
  12;

const globalForConfirmTransferRateLimit =
  globalThis as typeof globalThis & {
    tikemiaConfirmTransferRateLimit?: Map<
      string,
      RateLimitEntry
    >;
  };

const confirmTransferRateLimit =
  globalForConfirmTransferRateLimit
    .tikemiaConfirmTransferRateLimit ??
  new Map<
    string,
    RateLimitEntry
  >();

globalForConfirmTransferRateLimit
  .tikemiaConfirmTransferRateLimit =
  confirmTransferRateLimit;

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, max-age=0",

        Pragma:
          "no-cache",

        Expires:
          "0",

        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeEmail(
  value:
    | string
    | null
    | undefined,
): string {
  return normalizeText(
    value,
  ).toLowerCase();
}

function hashValue(
  value: string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      value,
    )
    .digest(
      "hex",
    );
}

function getTransferCodeSecret():
  string {
  const secret =
    normalizeText(
      process.env
        .TRANSFER_CODE_SECRET,
    ) ||
    normalizeText(
      process.env
        .SESSION_SECRET,
    );

  if (!secret) {
    throw new Error(
      "TRANSFER_CODE_SECRET_NOT_CONFIGURED",
    );
  }

  if (secret.length < 32) {
    throw new Error(
      "TRANSFER_CODE_SECRET_TOO_SHORT",
    );
  }

  return secret;
}

function hashTransferCode({
  transferReference,
  code,
}: {
  transferReference: string;
  code: string;
}): string {
  const secret =
    getTransferCodeSecret();

  return hashValue(
    `${transferReference}:${code}:${secret}`,
  );
}

function safeHashEquals(
  leftHash: string,
  rightHash: string,
): boolean {
  if (
    !/^[a-f0-9]{64}$/i.test(
      leftHash,
    ) ||
    !/^[a-f0-9]{64}$/i.test(
      rightHash,
    )
  ) {
    return false;
  }

  const leftBuffer =
    Buffer.from(
      leftHash,
      "hex",
    );

  const rightBuffer =
    Buffer.from(
      rightHash,
      "hex",
    );

  if (
    leftBuffer.length === 0 ||
    leftBuffer.length !==
      rightBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    leftBuffer,
    rightBuffer,
  );
}

function maskEmail(
  email: string,
): string {
  const normalized =
    normalizeEmail(
      email,
    );

  const [
    localPart,
    domain,
  ] =
    normalized.split(
      "@",
    );

  if (
    !localPart ||
    !domain
  ) {
    return normalized;
  }

  const visibleLength =
    Math.min(
      2,
      localPart.length,
    );

  const visiblePart =
    localPart.slice(
      0,
      visibleLength,
    );

  const hiddenPart =
    "*".repeat(
      Math.max(
        2,
        localPart.length -
          visibleLength,
      ),
    );

  return `${visiblePart}${hiddenPart}@${domain}`;
}

function getRequestAddress(
  request: Request,
): string {
  return (
    request.headers
      .get(
        "x-forwarded-for",
      )
      ?.split(
        ",",
      )[0]
      ?.trim() ||
    request.headers
      .get(
        "x-real-ip",
      )
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
    confirmTransferRateLimit.get(
      key,
    );

  if (
    !current ||
    current.resetAt <= now
  ) {
    confirmTransferRateLimit.set(
      key,
      {
        count:
          1,

        resetAt:
          now +
          RATE_LIMIT_WINDOW_MS,
      },
    );

    return {
      allowed:
        true,

      retryAfterSeconds:
        0,
    };
  }

  if (
    current.count >=
    RATE_LIMIT_MAX_REQUESTS
  ) {
    return {
      allowed:
        false,

      retryAfterSeconds:
        Math.max(
          1,
          Math.ceil(
            (
              current.resetAt -
              now
            ) /
              1000,
          ),
        ),
    };
  }

  current.count +=
    1;

  confirmTransferRateLimit.set(
    key,
    current,
  );

  return {
    allowed:
      true,

    retryAfterSeconds:
      0,
  };
}

async function getAuthenticatedCustomer():
  Promise<AuthenticatedCustomer | null> {
  const cookieStore =
    await cookies();

  const sessionToken =
    normalizeText(
      cookieStore.get(
        CLIENT_SESSION_COOKIE_NAME,
      )?.value,
    );

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
        id:
          true,

        expiresAt:
          true,

        user: {
          select: {
            id:
              true,

            firstName:
              true,

            lastName:
              true,

            email:
              true,

            phone:
              true,

            role:
              true,

            emailVerified:
              true,

            isActive:
              true,
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
      .catch(
        () =>
          undefined,
      );

    return null;
  }

  if (
    session.user.role !==
      "CUSTOMER" ||
    !session.user
      .emailVerified ||
    !session.user
      .isActive
  ) {
    return null;
  }

  const email =
    normalizeEmail(
      session.user.email,
    );

  if (!email) {
    return null;
  }

  return {
    id:
      session.user.id,

    firstName:
      normalizeText(
        session.user.firstName,
      ),

    lastName:
      normalizeText(
        session.user.lastName,
      ),

    email,

    phone:
      normalizeText(
        session.user.phone,
      ) || null,
  };
}

function ticketBelongsToSender({
  ownerId,
  holderEmail,
  senderId,
  senderEmail,
}: {
  ownerId:
    string | null;
  holderEmail:
    string | null;
  senderId:
    string;
  senderEmail:
    string;
}): boolean {
  if (
    ownerId ===
    senderId
  ) {
    return true;
  }

  const normalizedHolderEmail =
    normalizeEmail(
      holderEmail,
    );

  const normalizedSenderEmail =
    normalizeEmail(
      senderEmail,
    );

  return (
    Boolean(
      normalizedHolderEmail,
    ) &&
    normalizedHolderEmail ===
      normalizedSenderEmail
  );
}

function isTransferAllowedByOrganizer(
  allowTicketTransfer:
    | boolean
    | null
    | undefined,
): boolean {
  /*
   * Règle commune aux trois routes :
   *
   * false       → transfert interdit
   * true        → transfert autorisé
   * null/absent → transfert autorisé par défaut
   */
  return (
    allowTicketTransfer !==
    false
  );
}

function buildCurrentOwnerWhere({
  senderId,
  senderEmail,
}: {
  senderId: string;
  senderEmail: string;
}): Prisma.TicketWhereInput {
  const normalizedSenderEmail =
    normalizeEmail(
      senderEmail,
    );

  const ownershipConditions:
    Prisma.TicketWhereInput[] = [
    {
      ownerId:
        senderId,
    },
  ];

  if (normalizedSenderEmail) {
    ownershipConditions.push({
      holderEmail: {
        equals:
          normalizedSenderEmail,

        mode:
          Prisma.QueryMode.insensitive,
      },
    });
  }

  return {
    OR:
      ownershipConditions,
  };
}

type TransferPdfGenerationResult =
  | Readonly<{
      success: true;
      attachments: TransferTicketPdfAttachment[];
      error: null;
    }>
  | Readonly<{
      success: false;
      attachments: [];
      error: string;
    }>;

async function generateTransferredTicketPdfAttachments({
  ticketIds,
  generatedAt,
}: {
  ticketIds: readonly string[];
  generatedAt: Date;
}): Promise<TransferPdfGenerationResult> {
  try {
    const generatedPdfs =
      await Promise.all(
        ticketIds.map(
          async (
            ticketId,
          ) => {
            /*
             * Le PDF est généré après la transaction.
             * Le billet contient donc déjà le nouveau
             * propriétaire et les informations du destinataire.
             */
            return generateTicketPdf({
              ticketId,
              generatedAt,
            });
          },
        ),
      );

    if (
      generatedPdfs.length !==
      ticketIds.length
    ) {
      return {
        success:
          false,

        attachments:
          [],

        error:
          "Tous les billets PDF transférés n’ont pas pu être générés.",
      };
    }

    const attachments =
      generatedPdfs.map(
        (
          pdf,
        ): TransferTicketPdfAttachment => ({
          filename:
            pdf.fileName,

          contentBase64:
            pdf.buffer.toString(
              "base64",
            ),
        }),
      );

    return {
      success:
        true,

      attachments,

      error:
        null,
    };
  } catch (error) {
    console.error(
      "[CLIENT_TRANSFER_PDF_GENERATION_ERROR]",
      error instanceof Error
        ? {
            name:
              error.name,

            message:
              error.message,

            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    return {
      success:
        false,

      attachments:
        [],

      error:
        error instanceof Error
          ? error.message
          : "Impossible de générer les billets PDF transférés.",
    };
  }
}

async function registerInvalidAttempt({
  transferId,
  currentAttempts,
}: {
  transferId: string;
  currentAttempts: number;
}): Promise<{
  nextAttempts: number;
  reachedLimit: boolean;
  remainingAttempts: number;
}> {
  const nextAttempts =
    currentAttempts +
    1;

  const reachedLimit =
    nextAttempts >=
    MAX_VERIFICATION_ATTEMPTS;

  await prisma.ticketTransfer.update({
    where: {
      id:
        transferId,
    },

    data: {
      verificationAttempts:
        nextAttempts,

      ...(reachedLimit
        ? {
            status:
              TicketTransferStatus.FAILED,

            failedAt:
              new Date(),

            failureReason:
              "Nombre maximal de tentatives de vérification atteint.",
          }
        : {}),
    },
  });

  return {
    nextAttempts,
    reachedLimit,

    remainingAttempts:
      Math.max(
        0,
        MAX_VERIFICATION_ATTEMPTS -
          nextAttempts,
      ),
  };
}

export async function POST(
  request: Request,
): Promise<NextResponse> {
  try {
    const customer =
      await getAuthenticatedCustomer();

    if (!customer) {
      return jsonResponse(
        {
          success:
            false,

          code:
            "UNAUTHORIZED",

          message:
            "Connectez-vous à votre compte Tikemia pour confirmer ce transfert.",
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

    if (
      !rateLimit.allowed
    ) {
      return NextResponse.json(
        {
          success:
            false,

          code:
            "TOO_MANY_REQUESTS",

          message:
            "Trop de tentatives ont été effectuées. Réessayez dans quelques minutes.",
        },
        {
          status:
            429,

          headers: {
            "Cache-Control":
              "no-store, max-age=0",

            "Retry-After":
              String(
                rateLimit
                  .retryAfterSeconds,
              ),

            "X-Content-Type-Options":
              "nosniff",
          },
        },
      );
    }

    let rawBody:
      unknown;

    try {
      rawBody =
        await request.json();
    } catch {
      return jsonResponse(
        {
          success:
            false,

          code:
            "INVALID_JSON",

          message:
            "La requête envoyée est invalide.",
        },
        400,
      );
    }

    const parsedBody =
      confirmTransferSchema.safeParse(
        rawBody,
      );

    if (
      !parsedBody.success
    ) {
      return jsonResponse(
        {
          success:
            false,

          code:
            "INVALID_REQUEST",

          message:
            parsedBody.error
              .issues[0]
              ?.message ||
            "Les informations de confirmation sont invalides.",
        },
        400,
      );
    }

    const {
      reference,
      code,
    } =
      parsedBody.data;

    const existingTransfer =
      await prisma.ticketTransfer.findUnique({
        where: {
          reference,
        },

        select: {
          id:
            true,

          reference:
            true,

          senderId:
            true,

          recipientId:
            true,

          status:
            true,

          verificationCodeHash:
            true,

          verificationAttempts:
            true,

          verificationExpiresAt:
            true,

          completedAt:
            true,

          recipient: {
            select: {
              id:
                true,

              firstName:
                true,

              lastName:
                true,

              email:
                true,

              phone:
                true,

              role:
                true,

              emailVerified:
                true,

              isActive:
                true,
            },
          },

          items: {
            select: {
              id:
                true,

              ticketId:
                true,
            },
          },
        },
      });

    if (
      !existingTransfer ||
      existingTransfer.senderId !==
        customer.id
    ) {
      return jsonResponse(
        {
          success:
            false,

          code:
            "TRANSFER_NOT_FOUND",

          message:
            "Ce transfert est introuvable ou ne vous appartient pas.",
        },
        404,
      );
    }

    if (
      existingTransfer.status ===
      TicketTransferStatus.COMPLETED
    ) {
      return jsonResponse({
        success:
          true,

        code:
          "ALREADY_COMPLETED",

        message:
          "Ce transfert a déjà été confirmé.",

        transfer: {
          reference:
            existingTransfer.reference,

          completedAt:
            existingTransfer.completedAt
              ?.toISOString() ??
            null,

          ticketsCount:
            existingTransfer.items.length,
        },
      });
    }

    if (
      existingTransfer.status ===
      TicketTransferStatus.PROCESSING
    ) {
      return jsonResponse(
        {
          success:
            false,

          code:
            "TRANSFER_PROCESSING",

          message:
            "Ce transfert est déjà en cours de traitement.",
        },
        409,
      );
    }

    if (
      existingTransfer.status !==
      TicketTransferStatus.PENDING_VERIFICATION
    ) {
      return jsonResponse(
        {
          success:
            false,

          code:
            "TRANSFER_NOT_CONFIRMABLE",

          message:
            "Ce transfert ne peut plus être confirmé.",
        },
        409,
      );
    }

    const now =
      new Date();

    if (
      existingTransfer
        .verificationExpiresAt
        .getTime() <=
      now.getTime()
    ) {
      await prisma.ticketTransfer.updateMany({
        where: {
          id:
            existingTransfer.id,

          status:
            TicketTransferStatus.PENDING_VERIFICATION,
        },

        data: {
          status:
            TicketTransferStatus.EXPIRED,

          expiredAt:
            now,

          failureReason:
            "Le code de confirmation a expiré.",
        },
      });

      return jsonResponse(
        {
          success:
            false,

          code:
            "CODE_EXPIRED",

          message:
            "Le code de confirmation a expiré. Demandez un nouveau code.",
        },
        410,
      );
    }

    if (
      existingTransfer
        .verificationAttempts >=
      MAX_VERIFICATION_ATTEMPTS
    ) {
      return jsonResponse(
        {
          success:
            false,

          code:
            "MAX_ATTEMPTS_REACHED",

          message:
            "Le nombre maximal de tentatives a été atteint. Recommencez le transfert.",
        },
        423,
      );
    }

    const submittedHash =
      hashTransferCode({
        transferReference:
          existingTransfer.reference,

        code,
      });

    const codeIsValid =
      safeHashEquals(
        existingTransfer
          .verificationCodeHash,

        submittedHash,
      );

    if (!codeIsValid) {
      const attempt =
        await registerInvalidAttempt({
          transferId:
            existingTransfer.id,

          currentAttempts:
            existingTransfer
              .verificationAttempts,
        });

      return jsonResponse(
        {
          success:
            false,

          code:
            attempt.reachedLimit
              ? "MAX_ATTEMPTS_REACHED"
              : "INVALID_CODE",

          message:
            attempt.reachedLimit
              ? "Le nombre maximal de tentatives a été atteint. Recommencez le transfert."
              : "Le code de confirmation est incorrect.",

          remainingAttempts:
            attempt.remainingAttempts,
        },
        attempt.reachedLimit
          ? 423
          : 400,
      );
    }

    if (
      existingTransfer
        .recipient.role !==
        "CUSTOMER" ||
      !existingTransfer
        .recipient.emailVerified ||
      !existingTransfer
        .recipient.isActive
    ) {
      await prisma.ticketTransfer.update({
        where: {
          id:
            existingTransfer.id,
        },

        data: {
          status:
            TicketTransferStatus.FAILED,

          failedAt:
            now,

          failureReason:
            "Le compte du destinataire n’est plus disponible.",
        },
      });

      return jsonResponse(
        {
          success:
            false,

          code:
            "RECIPIENT_UNAVAILABLE",

          message:
            "Le compte Tikemia du destinataire n’est plus disponible.",
        },
        409,
      );
    }

    const completedTransfer =
      await prisma.$transaction(
        async (
          transaction,
        ) => {
          const transfer =
            await transaction.ticketTransfer.findUnique({
              where: {
                id:
                  existingTransfer.id,
              },

              select: {
                id:
                  true,

                reference:
                  true,

                senderId:
                  true,

                recipientId:
                  true,

                status:
                  true,

                verificationExpiresAt:
                  true,

                sender: {
                  select: {
                    id:
                      true,

                    firstName:
                      true,

                    lastName:
                      true,

                    email:
                      true,

                    phone:
                      true,

                    role:
                      true,

                    emailVerified:
                      true,

                    isActive:
                      true,
                  },
                },

                recipient: {
                  select: {
                    id:
                      true,

                    firstName:
                      true,

                    lastName:
                      true,

                    email:
                      true,

                    phone:
                      true,

                    role:
                      true,

                    emailVerified:
                      true,

                    isActive:
                      true,
                  },
                },

                items: {
                  orderBy: {
                    createdAt:
                      "asc",
                  },

                  select: {
                    id:
                      true,

                    ticketId:
                      true,

                    newOwnerId:
                      true,

                    newHolderName:
                      true,

                    newHolderEmail:
                      true,

                    newHolderPhone:
                      true,

                    ticket: {
                      select: {
                        id:
                          true,

                        code:
                          true,

                        ownerId:
                          true,

                        status:
                          true,

                        holderName:
                          true,

                        holderEmail:
                          true,

                        holderPhone:
                          true,

                        event: {
                          select: {
                            id:
                              true,

                            title:
                              true,

                            startsAt:
                              true,

                            endsAt:
                              true,

                            venueName:
                              true,

                            city:
                              true,

                            status:
                              true,

                            organizer: {
                              select: {
                                organizerSettings: {
                                  select: {
                                    allowTicketTransfer:
                                      true,
                                  },
                                },
                              },
                            },
                          },
                        },

                        ticketType: {
                          select: {
                            id:
                              true,

                            name:
                              true,
                          },
                        },

                        transferItems: {
                          where: {
                            transfer: {
                              id: {
                                not:
                                  existingTransfer.id,
                              },

                              status: {
                                in:
                                  ACTIVE_TRANSFER_STATUSES,
                              },
                            },
                          },

                          select: {
                            id:
                              true,
                          },

                          take:
                            1,
                        },
                      },
                    },
                  },
                },
              },
            });

          if (
            !transfer ||
            transfer.senderId !==
              customer.id
          ) {
            throw new Error(
              "TRANSFER_NOT_FOUND",
            );
          }

          if (
            transfer.status !==
            TicketTransferStatus.PENDING_VERIFICATION
          ) {
            throw new Error(
              "TRANSFER_STATUS_CHANGED",
            );
          }

          if (
            transfer
              .verificationExpiresAt
              .getTime() <=
            Date.now()
          ) {
            throw new Error(
              "TRANSFER_CODE_EXPIRED",
            );
          }

          if (
            transfer.sender.role !==
              "CUSTOMER" ||
            !transfer.sender
              .emailVerified ||
            !transfer.sender
              .isActive
          ) {
            throw new Error(
              "SENDER_UNAVAILABLE",
            );
          }

          if (
            transfer.recipient.role !==
              "CUSTOMER" ||
            !transfer.recipient
              .emailVerified ||
            !transfer.recipient
              .isActive
          ) {
            throw new Error(
              "RECIPIENT_UNAVAILABLE",
            );
          }

          if (
            transfer.senderId ===
            transfer.recipientId
          ) {
            throw new Error(
              "SELF_TRANSFER_NOT_ALLOWED",
            );
          }

          if (
            transfer.items.length ===
            0
          ) {
            throw new Error(
              "NO_TRANSFER_ITEMS",
            );
          }

          const eventIds =
            new Set<string>();

          for (
            const item of
            transfer.items
          ) {
            const ticket =
              item.ticket;

            eventIds.add(
              ticket.event.id,
            );

            if (
              !ticketBelongsToSender({
                ownerId:
                  ticket.ownerId,

                holderEmail:
                  ticket.holderEmail,

                senderId:
                  transfer.senderId,

                senderEmail:
                  transfer.sender.email,
              })
            ) {
              throw new Error(
                "TICKET_OWNER_CHANGED",
              );
            }

            if (
              ticket.status !==
              TicketStatus.VALID
            ) {
              throw new Error(
                "TICKET_NOT_VALID",
              );
            }

            if (
              ticket.event.status !==
              "PUBLISHED"
            ) {
              throw new Error(
                "EVENT_NOT_PUBLISHED",
              );
            }

            if (
              ticket.event
                .startsAt
                .getTime() <=
              Date.now()
            ) {
              throw new Error(
                "EVENT_ALREADY_STARTED",
              );
            }

            if (
              !isTransferAllowedByOrganizer(
                ticket.event
                  .organizer
                  .organizerSettings
                  ?.allowTicketTransfer,
              )
            ) {
              throw new Error(
                "TRANSFER_DISABLED",
              );
            }

            if (
              ticket
                .transferItems
                .length >
              0
            ) {
              throw new Error(
                "TICKET_RESERVED_ELSEWHERE",
              );
            }

            if (
              item.newOwnerId !==
                transfer.recipientId ||
              normalizeEmail(
                item.newHolderEmail,
              ) !==
                normalizeEmail(
                  transfer.recipient.email,
                )
            ) {
              throw new Error(
                "RECIPIENT_DATA_MISMATCH",
              );
            }
          }

          if (
            eventIds.size !==
            1
          ) {
            throw new Error(
              "MULTIPLE_EVENTS_NOT_ALLOWED",
            );
          }

          const processingUpdate =
            await transaction.ticketTransfer.updateMany({
              where: {
                id:
                  transfer.id,

                status:
                  TicketTransferStatus.PENDING_VERIFICATION,
              },

              data: {
                status:
                  TicketTransferStatus.PROCESSING,

                verificationVerifiedAt:
                  new Date(),
              },
            });

          if (
            processingUpdate.count !==
            1
          ) {
            throw new Error(
              "TRANSFER_STATUS_CHANGED",
            );
          }

          const transferredAt =
            new Date();

          const recipientFullName =
            `${normalizeText(
              transfer.recipient.firstName,
            )} ${normalizeText(
              transfer.recipient.lastName,
            )}`
              .replace(
                /\s+/g,
                " ",
              )
              .trim();

          const recipientEmail =
            normalizeEmail(
              transfer.recipient.email,
            );

          for (
            const item of
            transfer.items
          ) {
            const ticketUpdate =
              await transaction.ticket.updateMany({
                where: {
                  id:
                    item.ticketId,

                  status:
                    TicketStatus.VALID,

                  AND: [
                    buildCurrentOwnerWhere({
                      senderId:
                        transfer.senderId,

                      senderEmail:
                        transfer.sender.email,
                    }),

                    {
                      transferItems: {
                        none: {
                          transfer: {
                            id: {
                              not:
                                transfer.id,
                            },

                            status: {
                              in:
                                ACTIVE_TRANSFER_STATUSES,
                            },
                          },
                        },
                      },
                    },
                  ],
                },

                data: {
                  ownerId:
                    transfer.recipientId,

                  holderName:
                    recipientFullName,

                  holderEmail:
                    recipientEmail,

                  holderPhone:
                    transfer.recipient.phone,
                },
              });

            if (
              ticketUpdate.count !==
              1
            ) {
              throw new Error(
                "TICKET_UPDATE_CONFLICT",
              );
            }

            await transaction.ticketTransferItem.update({
              where: {
                id:
                  item.id,
              },

              data: {
                newOwnerId:
                  transfer.recipientId,

                newHolderName:
                  recipientFullName,

                newHolderEmail:
                  recipientEmail,

                newHolderPhone:
                  transfer.recipient.phone,

                transferredAt,
              },
            });
          }

          return transaction.ticketTransfer.update({
            where: {
              id:
                transfer.id,
            },

            data: {
              status:
                TicketTransferStatus.COMPLETED,

              completedAt:
                transferredAt,

              failureReason:
                null,

              senderEmailStatus:
                TransferEmailStatus.PENDING,

              senderEmailFailureReason:
                null,

              recipientEmailStatus:
                TransferEmailStatus.PENDING,

              recipientEmailFailureReason:
                null,
            },

            select: {
              id:
                true,

              reference:
                true,

              completedAt:
                true,

              sender: {
                select: {
                  id:
                    true,

                  firstName:
                    true,

                  lastName:
                    true,

                  email:
                    true,
                },
              },

              recipient: {
                select: {
                  id:
                    true,

                  firstName:
                    true,

                  lastName:
                    true,

                  email:
                    true,
                },
              },

              items: {
                orderBy: {
                  createdAt:
                    "asc",
                },

                select: {
                  ticket: {
                    select: {
                      id:
                        true,

                      code:
                        true,

                      event: {
                        select: {
                          id:
                            true,

                          title:
                            true,

                          startsAt:
                            true,

                          venueName:
                            true,

                          city:
                            true,
                        },
                      },

                      ticketType: {
                        select: {
                          name:
                            true,
                        },
                      },
                    },
                  },
                },
              },
            },
          });
        },
        {
          isolationLevel:
            Prisma
              .TransactionIsolationLevel
              .Serializable,

          maxWait:
            5000,

          timeout:
            15000,
        },
      );

    const firstTransferredTicket =
      completedTransfer
        .items[0]
        ?.ticket;

    if (!firstTransferredTicket) {
      throw new Error(
        "COMPLETED_TRANSFER_WITHOUT_TICKETS",
      );
    }

    const completedAt =
      completedTransfer
        .completedAt ??
      new Date();

    const senderFullName =
      `${normalizeText(
        completedTransfer.sender.firstName,
      )} ${normalizeText(
        completedTransfer.sender.lastName,
      )}`
        .replace(
          /\s+/g,
          " ",
        )
        .trim();

    const recipientFullName =
      `${normalizeText(
        completedTransfer.recipient.firstName,
      )} ${normalizeText(
        completedTransfer.recipient.lastName,
      )}`
        .replace(
          /\s+/g,
          " ",
        )
        .trim();

    const transferredTickets =
      completedTransfer.items.map(
        (
          item,
        ) => ({
          ticketTypeName:
            item.ticket
              .ticketType
              .name,

          ticketCode:
            item.ticket.code,
        }),
      );

    const transferPdfGeneration =
      await generateTransferredTicketPdfAttachments({
        ticketIds:
          completedTransfer.items.map(
            (
              item,
            ) =>
              item.ticket.id,
          ),

        generatedAt:
          completedAt,
      });

    const [
      senderEmailResult,
      recipientEmailResult,
    ] =
      await Promise.all([
        sendTransferSenderConfirmationEmail({
          to:
            completedTransfer.sender.email,

          firstName:
            completedTransfer.sender.firstName,

          recipientName:
            recipientFullName,

          recipientMaskedEmail:
            maskEmail(
              completedTransfer.recipient.email,
            ),

          transferReference:
            completedTransfer.reference,

          eventTitle:
            firstTransferredTicket.event.title,

          eventStartsAt:
            firstTransferredTicket.event.startsAt,

          eventVenueName:
            firstTransferredTicket.event.venueName,

          eventCity:
            firstTransferredTicket.event.city,

          tickets:
            transferredTickets,

          completedAt,
        }),

        transferPdfGeneration.success
          ? sendTransferRecipientNotificationEmail({
              to:
                completedTransfer.recipient.email,

          firstName:
            completedTransfer.recipient.firstName,

          senderName:
            senderFullName,

          senderMaskedEmail:
            maskEmail(
              completedTransfer.sender.email,
            ),

          transferReference:
            completedTransfer.reference,

          eventTitle:
            firstTransferredTicket.event.title,

          eventStartsAt:
            firstTransferredTicket.event.startsAt,

          eventVenueName:
            firstTransferredTicket.event.venueName,

          eventCity:
            firstTransferredTicket.event.city,

          tickets:
            transferredTickets,

          completedAt,

              pdfAttachments:
                transferPdfGeneration.attachments,
            })
          : Promise.resolve({
              success:
                false as const,

              messageId:
                null,

              attachedPdfCount:
                0,

              error:
                transferPdfGeneration.error,
            }),
      ]);

    await prisma.ticketTransfer
      .update({
        where: {
          id:
            completedTransfer.id,
        },

        data: {
          senderEmailStatus:
            senderEmailResult.success
              ? TransferEmailStatus.SENT
              : TransferEmailStatus.FAILED,

          senderEmailSentAt:
            senderEmailResult.success
              ? new Date()
              : null,

          senderEmailFailureReason:
            senderEmailResult.success
              ? null
              : senderEmailResult.error,

          recipientEmailStatus:
            recipientEmailResult.success
              ? TransferEmailStatus.SENT
              : TransferEmailStatus.FAILED,

          recipientEmailSentAt:
            recipientEmailResult.success
              ? new Date()
              : null,

          recipientEmailFailureReason:
            recipientEmailResult.success
              ? null
              : recipientEmailResult.error,
        },
      })
      .catch(
        (
          emailStatusUpdateError,
        ) => {
          /*
           * Le transfert est déjà terminé.
           * Une erreur d’enregistrement des statuts d’e-mail
           * ne doit jamais annuler ou masquer le transfert.
           */
          console.error(
            "[CLIENT_TRANSFER_EMAIL_STATUS_UPDATE_ERROR]",
            emailStatusUpdateError,
          );
        },
      );

    return jsonResponse({
      success:
        true,

      message:
        "Le transfert a été effectué avec succès.",

      transfer: {
        reference:
          completedTransfer.reference,

        completedAt:
          completedAt.toISOString(),

        ticketsCount:
          completedTransfer.items.length,

        event: {
          id:
            firstTransferredTicket.event.id,

          title:
            firstTransferredTicket.event.title,

          startsAt:
            firstTransferredTicket.event.startsAt.toISOString(),

          venueName:
            firstTransferredTicket.event.venueName,

          city:
            firstTransferredTicket.event.city,
        },

        recipient: {
          id:
            completedTransfer.recipient.id,

          firstName:
            completedTransfer.recipient.firstName,

          lastName:
            completedTransfer.recipient.lastName,

          fullName:
            recipientFullName,

          maskedEmail:
            maskEmail(
              completedTransfer.recipient.email,
            ),
        },

        emails: {
          senderConfirmationSent:
            senderEmailResult.success,

          recipientNotificationSent:
            recipientEmailResult.success,

          recipientPdfAttached:
            recipientEmailResult.success
              ? recipientEmailResult.attachedPdfCount >
                0
              : false,

          recipientPdfCount:
            recipientEmailResult.success
              ? recipientEmailResult.attachedPdfCount
              : 0,
        },
      },
    });
  } catch (error) {
    console.error(
      "[CLIENT_TRANSFER_CONFIRM_ERROR]",
      error instanceof Error
        ? {
            name:
              error.name,

            message:
              error.message,

            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    if (
      error instanceof Error &&
      (
        error.message ===
          "TRANSFER_CODE_SECRET_NOT_CONFIGURED" ||
        error.message ===
          "TRANSFER_CODE_SECRET_TOO_SHORT"
      )
    ) {
      return jsonResponse(
        {
          success:
            false,

          code:
            "TRANSFER_CONFIGURATION_ERROR",

          message:
            "La configuration sécurisée du transfert est incomplète.",
        },
        500,
      );
    }

    if (
      error instanceof Error
    ) {
      const knownErrors: Record<
        string,
        {
          status: number;
          code: string;
          message: string;
        }
      > = {
        TRANSFER_NOT_FOUND: {
          status:
            404,

          code:
            "TRANSFER_NOT_FOUND",

          message:
            "Ce transfert est introuvable.",
        },

        TRANSFER_STATUS_CHANGED: {
          status:
            409,

          code:
            "TRANSFER_STATUS_CHANGED",

          message:
            "Le statut du transfert a changé. Actualisez la page.",
        },

        TRANSFER_CODE_EXPIRED: {
          status:
            410,

          code:
            "CODE_EXPIRED",

          message:
            "Le code de confirmation a expiré.",
        },

        SENDER_UNAVAILABLE: {
          status:
            409,

          code:
            "SENDER_UNAVAILABLE",

          message:
            "Votre compte Tikemia n’est plus disponible pour ce transfert.",
        },

        RECIPIENT_UNAVAILABLE: {
          status:
            409,

          code:
            "RECIPIENT_UNAVAILABLE",

          message:
            "Le compte Tikemia du destinataire n’est plus disponible.",
        },

        SELF_TRANSFER_NOT_ALLOWED: {
          status:
            409,

          code:
            "SELF_TRANSFER_NOT_ALLOWED",

          message:
            "Vous ne pouvez pas transférer des billets vers votre propre compte.",
        },

        NO_TRANSFER_ITEMS: {
          status:
            409,

          code:
            "NO_TRANSFER_ITEMS",

          message:
            "Aucun billet n’est associé à ce transfert.",
        },

        TICKET_OWNER_CHANGED: {
          status:
            409,

          code:
            "TICKET_OWNER_CHANGED",

          message:
            "Un billet sélectionné ne vous appartient plus.",
        },

        TICKET_NOT_VALID: {
          status:
            409,

          code:
            "TICKET_NOT_VALID",

          message:
            "Un billet sélectionné n’est plus valide.",
        },

        EVENT_NOT_PUBLISHED: {
          status:
            409,

          code:
            "EVENT_NOT_PUBLISHED",

          message:
            "L’événement n’est plus disponible.",
        },

        EVENT_ALREADY_STARTED: {
          status:
            409,

          code:
            "EVENT_ALREADY_STARTED",

          message:
            "Le transfert est impossible après le début de l’événement.",
        },

        TRANSFER_DISABLED: {
          status:
            409,

          code:
            "TRANSFER_DISABLED",

          message:
            "L’organisateur a désactivé le transfert des billets pour cet événement.",
        },

        TICKET_RESERVED_ELSEWHERE: {
          status:
            409,

          code:
            "TICKET_RESERVED_ELSEWHERE",

          message:
            "Un billet est déjà réservé dans un autre transfert.",
        },

        RECIPIENT_DATA_MISMATCH: {
          status:
            409,

          code:
            "RECIPIENT_DATA_MISMATCH",

          message:
            "Les informations du destinataire ne correspondent plus.",
        },

        MULTIPLE_EVENTS_NOT_ALLOWED: {
          status:
            400,

          code:
            "MULTIPLE_EVENTS_NOT_ALLOWED",

          message:
            "Les billets doivent appartenir au même événement.",
        },

        TICKET_UPDATE_CONFLICT: {
          status:
            409,

          code:
            "TICKET_UPDATE_CONFLICT",

          message:
            "Un billet a été modifié pendant le transfert. Réessayez.",
        },

        COMPLETED_TRANSFER_WITHOUT_TICKETS: {
          status:
            500,

          code:
            "COMPLETED_TRANSFER_WITHOUT_TICKETS",

          message:
            "Le transfert a été effectué, mais ses informations ne peuvent pas être affichées.",
        },
      };

      const knownError =
        knownErrors[
          error.message
        ];

      if (knownError) {
        return jsonResponse(
          {
            success:
              false,

            code:
              knownError.code,

            message:
              knownError.message,
          },
          knownError.status,
        );
      }
    }

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError
    ) {
      if (
        error.code ===
        "P2034"
      ) {
        return jsonResponse(
          {
            success:
              false,

            code:
              "TRANSFER_CONCURRENCY_CONFLICT",

            message:
              "Le transfert a rencontré une modification simultanée. Réessayez.",
          },
          409,
        );
      }

      if (
        error.code ===
        "P2002"
      ) {
        return jsonResponse(
          {
            success:
              false,

            code:
              "TRANSFER_CONFLICT",

            message:
              "Un billet est déjà associé à un autre transfert actif.",
          },
          409,
        );
      }
    }

    return jsonResponse(
      {
        success:
          false,

        code:
          "INTERNAL_ERROR",

        message:
          "Impossible de confirmer le transfert pour le moment. Réessayez.",
      },
      500,
    );
  }
}