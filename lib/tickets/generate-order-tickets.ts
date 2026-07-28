import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  TicketDocumentStatus,
  TicketDocumentType,
  TicketStatus,
} from "@prisma/client";
import * as QRCode from "qrcode";

import {
  PaymentError,
  PaymentValidationError,
} from "@/lib/payments/payment-errors";
import { prisma } from "@/lib/prisma";

const QR_VERSION =
  1;

const QR_ERROR_CORRECTION_LEVEL =
  "M" as const;

const QR_IMAGE_WIDTH =
  640;

const MAX_TICKET_CODE_ATTEMPTS =
  10;

type DatabaseClient =
  Prisma.TransactionClient |
  typeof prisma;

export type TicketQrPayload = {
  version: number;
  issuer: "TIKEMIA";

  ticketCode: string;
  orderReference: string;

  eventId: string;
  eventTitle: string;

  ticketTypeId: string;
  ticketCategory: string;

  unitPrice: string;
  currency: string;

  issuedAt: string;
  nonce: string;

  signature: string;
};

export type GeneratedOrderTicket = {
  id: string;
  code: string;

  event: {
    id: string;
    title: string;
    slug: string;
    venueName: string;
    city: string;
    country: string;
    startsAt: string;
    endsAt: string | null;
  };

  category: {
    id: string;
    name: string;
    description: string | null;
  };

  holder: {
    name: string;
    email: string;
    phone: string | null;
  };

  pricing: {
    unitPrice: string;
    platformFeePerTicket: string;
    totalPerTicket: string;
    currency: string;
  };

  qr: {
    version: number;
    value: string;
    tokenHash: string;
    imageDataUrl: string;
    imageMimeType: "image/png";
    imageFileName: string;
    imageFileSize: number;
    imageChecksum: string;
  };

  issuedAt: string;
  alreadyExisted: boolean;
};

export type GenerateOrderTicketsResult = {
  order: {
    id: string;
    reference: string;
    status: OrderStatus;
    currency: string;
    expectedTickets: number;
    generatedTickets: number;
  };

  tickets: GeneratedOrderTicket[];

  createdCount: number;
  existingCount: number;
};

export type GenerateOrderTicketsOptions = {
  orderId: string;

  transaction?: Prisma.TransactionClient;

  issuedAt?: Date;

  createQrDocumentRecord?: boolean;
};

export type VerifiedTicketQrPayload = {
  valid: true;
  payload: Omit<
    TicketQrPayload,
    "signature"
  >;
};

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeOrderId(
  value: string,
): string {
  const orderId =
    normalizeText(
      value,
    );

  if (!orderId) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        "L’identifiant de la commande est obligatoire.",

      status:
        400,
    });
  }

  return orderId;
}

function getTicketQrSecret(): string {
  const secret =
    normalizeText(
      process.env
        .TICKET_QR_SECRET,
    );

  if (
    secret.length <
    32
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_CONFIGURATION_ERROR",

      message:
        "La configuration de sécurité des QR codes est incomplète.",

      status:
        500,

      retryable:
        false,

      exposeMessage:
        false,
    });
  }

  return secret;
}

function base64UrlEncode(
  value: string,
): string {
  return Buffer
    .from(
      value,
      "utf8",
    )
    .toString(
      "base64url",
    );
}

function base64UrlDecode(
  value: string,
): string {
  return Buffer
    .from(
      value,
      "base64url",
    )
    .toString(
      "utf8",
    );
}

function hashValue(
  value: string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      value,
      "utf8",
    )
    .digest(
      "hex",
    );
}

function createSignature(
  encodedPayload: string,
): string {
  return createHmac(
    "sha256",
    getTicketQrSecret(),
  )
    .update(
      encodedPayload,
      "utf8",
    )
    .digest(
      "base64url",
    );
}

function safeEquals(
  left: string,
  right: string,
): boolean {
  const leftBuffer =
    Buffer.from(
      left,
      "utf8",
    );

  const rightBuffer =
    Buffer.from(
      right,
      "utf8",
    );

  if (
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

function createTicketCode(): string {
  const date =
    new Date();

  const datePart =
    [
      date.getUTCFullYear(),
      String(
        date.getUTCMonth() +
          1,
      ).padStart(
        2,
        "0",
      ),
      String(
        date.getUTCDate(),
      ).padStart(
        2,
        "0",
      ),
    ].join(
      "",
    );

  const randomPart =
    randomBytes(
      7,
    )
      .toString(
        "hex",
      )
      .toUpperCase();

  return `TKM-${datePart}-${randomPart}`;
}

async function createUniqueTicketCode(
  database: DatabaseClient,
): Promise<string> {
  for (
    let attempt = 0;
    attempt <
    MAX_TICKET_CODE_ATTEMPTS;
    attempt +=
      1
  ) {
    const code =
      createTicketCode();

    const existing =
      await database
        .ticket
        .findUnique({
          where: {
            code,
          },

          select: {
            id:
              true,
          },
        });

    if (!existing) {
      return code;
    }
  }

  throw new PaymentError({
    code:
      "PAYMENT_TICKET_ISSUANCE_FAILED",

    message:
      "Impossible de générer un code de billet unique.",

    status:
      500,

    retryable:
      true,

    exposeMessage:
      false,
  });
}

function decimalToFixed(
  value: Prisma.Decimal,
): string {
  return value
    .toDecimalPlaces(
      2,
      Prisma.Decimal
        .ROUND_HALF_UP,
    )
    .toFixed(
      2,
    );
}

function divideAmount({
  amount,
  quantity,
}: {
  amount: Prisma.Decimal;
  quantity: number;
}): Prisma.Decimal {
  if (
    !Number.isInteger(
      quantity,
    ) ||
    quantity <=
      0
  ) {
    return new Prisma.Decimal(
      0,
    );
  }

  return amount
    .div(
      quantity,
    )
    .toDecimalPlaces(
      2,
      Prisma.Decimal
        .ROUND_HALF_UP,
    );
}

function createSignedQrValue({
  ticketCode,
  orderReference,
  eventId,
  eventTitle,
  ticketTypeId,
  ticketCategory,
  unitPrice,
  currency,
  issuedAt,
}: {
  ticketCode: string;
  orderReference: string;
  eventId: string;
  eventTitle: string;
  ticketTypeId: string;
  ticketCategory: string;
  unitPrice: string;
  currency: string;
  issuedAt: Date;
}): {
  value: string;
  tokenHash: string;
  payload: TicketQrPayload;
} {
  const nonce =
    randomBytes(
      24,
    ).toString(
      "base64url",
    );

  const unsignedPayload =
    {
      version:
        QR_VERSION,

      issuer:
        "TIKEMIA" as const,

      ticketCode,

      orderReference,

      eventId,

      eventTitle,

      ticketTypeId,

      ticketCategory,

      unitPrice,

      currency,

      issuedAt:
        issuedAt.toISOString(),

      nonce,
    };

  const encodedPayload =
    base64UrlEncode(
      JSON.stringify(
        unsignedPayload,
      ),
    );

  const signature =
    createSignature(
      encodedPayload,
    );

  const value =
    `TIKEMIA.${encodedPayload}.${signature}`;

  return {
    value,

    tokenHash:
      hashValue(
        nonce,
      ),

    payload: {
      ...unsignedPayload,
      signature,
    },
  };
}

async function generateQrImage(
  qrValue: string,
): Promise<{
  imageDataUrl: string;
  imageFileSize: number;
  imageChecksum: string;
}> {
  try {
    const imageDataUrl =
      await QRCode.toDataURL(
        qrValue,
        {
          type:
            "image/png",

          errorCorrectionLevel:
            QR_ERROR_CORRECTION_LEVEL,

          width:
            QR_IMAGE_WIDTH,

          margin:
            3,

          color: {
            dark:
              "#000000",

            light:
              "#FFFFFF",
          },
        },
      );

    const base64 =
      imageDataUrl.split(
        ",",
      )[1] ??
      "";

    const imageBuffer =
      Buffer.from(
        base64,
        "base64",
      );

    return {
      imageDataUrl,

      imageFileSize:
        imageBuffer.byteLength,

      imageChecksum:
        createHash(
          "sha256",
        )
          .update(
            imageBuffer,
          )
          .digest(
            "hex",
          ),
    };
  } catch (
    error
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Impossible de générer le QR code du billet.",

      status:
        500,

      retryable:
        true,

      exposeMessage:
        false,

      cause:
        error,
    });
  }
}

export function verifyTicketQrValue(
  qrValue: string,
): VerifiedTicketQrPayload {
  const normalized =
    normalizeText(
      qrValue,
    );

  const parts =
    normalized.split(
      ".",
    );

  if (
    parts.length !==
      3 ||
    parts[0] !==
      "TIKEMIA"
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        "Le QR code du billet est invalide.",

      status:
        400,
    });
  }

  const encodedPayload =
    parts[1] ??
    "";

  const receivedSignature =
    parts[2] ??
    "";

  const expectedSignature =
    createSignature(
      encodedPayload,
    );

  if (
    !safeEquals(
      receivedSignature,
      expectedSignature,
    )
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_FORBIDDEN",

      message:
        "La signature du QR code est invalide.",

      status:
        403,
    });
  }

  let parsed:
    unknown;

  try {
    parsed =
      JSON.parse(
        base64UrlDecode(
          encodedPayload,
        ),
      );
  } catch {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        "Le contenu du QR code est invalide.",

      status:
        400,
    });
  }

  if (
    !parsed ||
    typeof parsed !==
      "object" ||
    Array.isArray(
      parsed,
    )
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        "Le contenu du QR code est invalide.",

      status:
        400,
    });
  }

  const payload =
    parsed as Omit<
      TicketQrPayload,
      "signature"
    >;

  if (
    payload.version !==
      QR_VERSION ||
    payload.issuer !==
      "TIKEMIA" ||
    !normalizeText(
      payload.ticketCode,
    ) ||
    !normalizeText(
      payload.orderReference,
    ) ||
    !normalizeText(
      payload.eventId,
    ) ||
    !normalizeText(
      payload.ticketTypeId,
    ) ||
    !normalizeText(
      payload.ticketCategory,
    ) ||
    !normalizeText(
      payload.unitPrice,
    ) ||
    !normalizeText(
      payload.currency,
    ) ||
    !normalizeText(
      payload.nonce,
    )
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        "Les informations du QR code sont incomplètes.",

      status:
        400,
    });
  }

  return {
    valid:
      true,

    payload,
  };
}

async function createTicketDocumentRecord({
  database,
  ticketId,
  ticketCode,
  qr,
}: {
  database: DatabaseClient;
  ticketId: string;
  ticketCode: string;
  qr: GeneratedOrderTicket["qr"];
}): Promise<void> {
  await database
    .ticketDocument
    .upsert({
      where: {
        ticketId_type: {
          ticketId,

          type:
            TicketDocumentType
              .QR_IMAGE,
        },
      },

      create: {
        ticketId,

        type:
          TicketDocumentType
            .QR_IMAGE,

        status:
          TicketDocumentStatus
            .PENDING,

        generationKey:
          `ticket:${ticketId}:qr:v${QR_VERSION}`,

        fileName:
          qr.imageFileName,

        mimeType:
          qr.imageMimeType,

        fileSize:
          qr.imageFileSize,

        checksum:
          qr.imageChecksum,

        metadata: {
          qrVersion:
            qr.version,

          ticketCode,

          generatedInMemory:
            true,
        },
      },

      update: {
        status:
          TicketDocumentStatus
            .PENDING,

        generationKey:
          `ticket:${ticketId}:qr:v${QR_VERSION}`,

        fileName:
          qr.imageFileName,

        mimeType:
          qr.imageMimeType,

        fileSize:
          qr.imageFileSize,

        checksum:
          qr.imageChecksum,

        failureReason:
          null,

        metadata: {
          qrVersion:
            qr.version,

          ticketCode,

          generatedInMemory:
            true,
        },
      },
    });
}

export async function generateOrderTickets({
  orderId: rawOrderId,
  transaction,
  issuedAt = new Date(),
  createQrDocumentRecord = true,
}: GenerateOrderTicketsOptions): Promise<
  GenerateOrderTicketsResult
> {
  const orderId =
    normalizeOrderId(
      rawOrderId,
    );

  const database:
    DatabaseClient =
    transaction ??
    prisma;

  const order =
    await database
      .order
      .findUnique({
        where: {
          id:
            orderId,
        },

        select: {
          id:
            true,

          reference:
            true,

          status:
            true,

          currency:
            true,

          customerId:
            true,

          customerName:
            true,

          customerEmail:
            true,

          customerPhone:
            true,

          ticketsIssuedAt:
            true,

          payment: {
            select: {
              id:
                true,

              status:
                true,

              amount:
                true,

              currency:
                true,
            },
          },

          event: {
            select: {
              id:
                true,

              title:
                true,

              slug:
                true,

              venueName:
                true,

              city:
                true,

              country:
                true,

              startsAt:
                true,

              endsAt:
                true,
            },
          },

          items: {
            orderBy: {
              id:
                "asc",
            },

            select: {
              id:
                true,

              ticketTypeId:
                true,

              quantity:
                true,

              unitPrice:
                true,

              platformFee:
                true,

              total:
                true,

              ticketType: {
                select: {
                  id:
                    true,

                  name:
                    true,

                  description:
                    true,
                },
              },

              tickets: {
                orderBy: {
                  createdAt:
                    "asc",
                },

                select: {
                  id:
                    true,

                  code:
                    true,

                  qrCodeValue:
                    true,

                  qrTokenHash:
                    true,

                  qrVersion:
                    true,

                  issuedAt:
                    true,

                  holderName:
                    true,

                  holderEmail:
                    true,

                  holderPhone:
                    true,
                },
              },
            },
          },
        },
      });

  if (!order) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_ORDER_NOT_FOUND",

      message:
        "La commande est introuvable.",

      status:
        404,

      orderId,
    });
  }

  if (
    order.status !==
      OrderStatus.PAID ||
    order.payment?.status !==
      PaymentStatus.SUCCESS
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_ORDER_NOT_PAYABLE",

      message:
        "Les billets ne peuvent être générés qu’après confirmation du paiement.",

      status:
        409,

      orderId:
        order.id,

      details: {
        orderStatus:
          order.status,

        paymentStatus:
          order.payment?.status ??
          null,
      },
    });
  }

  const expectedTickets =
    order.items.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.quantity,
      0,
    );

  const existingTickets =
    order.items.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.tickets.length,
      0,
    );

  if (
    existingTickets >
    expectedTickets
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Le nombre de billets existants dépasse la quantité commandée.",

      status:
        500,

      retryable:
        false,

      exposeMessage:
        false,

      orderId:
        order.id,
    });
  }

  const generatedTickets:
    GeneratedOrderTicket[] =
    [];

  let createdCount =
    0;

  let existingCount =
    0;

  for (
    const item of
    order.items
  ) {
    if (
      item.tickets.length >
      item.quantity
    ) {
      throw new PaymentError({
        code:
          "PAYMENT_TICKET_ISSUANCE_FAILED",

        message:
          "Une catégorie contient plus de billets que la quantité commandée.",

        status:
          500,

        retryable:
          false,

        exposeMessage:
          false,

        orderId:
          order.id,

        details: {
          orderItemId:
            item.id,

          orderedQuantity:
            item.quantity,

          existingQuantity:
            item.tickets.length,
        },
      });
    }

    const feePerTicket =
      divideAmount({
        amount:
          item.platformFee,

        quantity:
          item.quantity,
      });

    const totalPerTicket =
      divideAmount({
        amount:
          item.total,

        quantity:
          item.quantity,
      });

    for (
      const existingTicket of
      item.tickets
    ) {
      const verified =
        verifyTicketQrValue(
          existingTicket
            .qrCodeValue,
        );

      const qrImage =
        await generateQrImage(
          existingTicket
            .qrCodeValue,
        );

      const ticketResult:
        GeneratedOrderTicket = {
          id:
            existingTicket.id,

          code:
            existingTicket.code,

          event: {
            id:
              order.event.id,

            title:
              order.event.title,

            slug:
              order.event.slug,

            venueName:
              order.event
                .venueName,

            city:
              order.event.city,

            country:
              order.event.country,

            startsAt:
              order.event
                .startsAt
                .toISOString(),

            endsAt:
              order.event.endsAt
                ?.toISOString() ??
              null,
          },

          category: {
            id:
              item.ticketType.id,

            name:
              item.ticketType.name,

            description:
              item.ticketType
                .description,
          },

          holder: {
            name:
              existingTicket
                .holderName,

            email:
              existingTicket
                .holderEmail,

            phone:
              existingTicket
                .holderPhone,
          },

          pricing: {
            unitPrice:
              verified.payload
                .unitPrice,

            platformFeePerTicket:
              decimalToFixed(
                feePerTicket,
              ),

            totalPerTicket:
              decimalToFixed(
                totalPerTicket,
              ),

            currency:
              order.currency,
          },

          qr: {
            version:
              existingTicket
                .qrVersion,

            value:
              existingTicket
                .qrCodeValue,

            tokenHash:
              existingTicket
                .qrTokenHash ??
              hashValue(
                verified.payload
                  .nonce,
              ),

            imageDataUrl:
              qrImage.imageDataUrl,

            imageMimeType:
              "image/png",

            imageFileName:
              `${existingTicket.code}-qr.png`,

            imageFileSize:
              qrImage.imageFileSize,

            imageChecksum:
              qrImage.imageChecksum,
          },

          issuedAt:
            existingTicket
              .issuedAt
              .toISOString(),

          alreadyExisted:
            true,
        };

      if (
        createQrDocumentRecord
      ) {
        await createTicketDocumentRecord({
          database,

          ticketId:
            ticketResult.id,

          ticketCode:
            ticketResult.code,

          qr:
            ticketResult.qr,
        });
      }

      generatedTickets.push(
        ticketResult,
      );

      existingCount +=
        1;
    }

    const missingTickets =
      item.quantity -
      item.tickets.length;

    for (
      let index = 0;
      index <
      missingTickets;
      index +=
        1
    ) {
      const code =
        await createUniqueTicketCode(
          database,
        );

      const signedQr =
        createSignedQrValue({
          ticketCode:
            code,

          orderReference:
            order.reference,

          eventId:
            order.event.id,

          eventTitle:
            order.event.title,

          ticketTypeId:
            item.ticketType.id,

          ticketCategory:
            item.ticketType.name,

          unitPrice:
            decimalToFixed(
              item.unitPrice,
            ),

          currency:
            order.currency,

          issuedAt,
        });

      const qrImage =
        await generateQrImage(
          signedQr.value,
        );

      const ticket =
        await database
          .ticket
          .create({
            data: {
              code,

              qrCodeValue:
                signedQr.value,

              qrTokenHash:
                signedQr
                  .tokenHash,

              qrVersion:
                QR_VERSION,

              eventId:
                order.event.id,

              orderId:
                order.id,

              orderItemId:
                item.id,

              ticketTypeId:
                item.ticketType.id,

              ownerId:
                order.customerId,

              holderName:
                order.customerName,

              holderEmail:
                order.customerEmail,

              holderPhone:
                order.customerPhone,

              status:
                TicketStatus.VALID,

              issuedAt,

              qrGeneratedAt:
                issuedAt,
            },

            select: {
              id:
                true,

              code:
                true,

              issuedAt:
                true,
            },
          });

      const ticketResult:
        GeneratedOrderTicket = {
          id:
            ticket.id,

          code:
            ticket.code,

          event: {
            id:
              order.event.id,

            title:
              order.event.title,

            slug:
              order.event.slug,

            venueName:
              order.event
                .venueName,

            city:
              order.event.city,

            country:
              order.event.country,

            startsAt:
              order.event
                .startsAt
                .toISOString(),

            endsAt:
              order.event.endsAt
                ?.toISOString() ??
              null,
          },

          category: {
            id:
              item.ticketType.id,

            name:
              item.ticketType.name,

            description:
              item.ticketType
                .description,
          },

          holder: {
            name:
              order.customerName,

            email:
              order.customerEmail,

            phone:
              order.customerPhone,
          },

          pricing: {
            unitPrice:
              decimalToFixed(
                item.unitPrice,
              ),

            platformFeePerTicket:
              decimalToFixed(
                feePerTicket,
              ),

            totalPerTicket:
              decimalToFixed(
                totalPerTicket,
              ),

            currency:
              order.currency,
          },

          qr: {
            version:
              QR_VERSION,

            value:
              signedQr.value,

            tokenHash:
              signedQr
                .tokenHash,

            imageDataUrl:
              qrImage.imageDataUrl,

            imageMimeType:
              "image/png",

            imageFileName:
              `${ticket.code}-qr.png`,

            imageFileSize:
              qrImage.imageFileSize,

            imageChecksum:
              qrImage.imageChecksum,
          },

          issuedAt:
            ticket.issuedAt
              .toISOString(),

          alreadyExisted:
            false,
        };

      if (
        createQrDocumentRecord
      ) {
        await createTicketDocumentRecord({
          database,

          ticketId:
            ticketResult.id,

          ticketCode:
            ticketResult.code,

          qr:
            ticketResult.qr,
        });
      }

      generatedTickets.push(
        ticketResult,
      );

      createdCount +=
        1;
    }
  }

  if (
    generatedTickets.length !==
    expectedTickets
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Le nombre final de billets ne correspond pas à la commande.",

      status:
        500,

      retryable:
        true,

      exposeMessage:
        false,

      orderId:
        order.id,

      details: {
        expectedTickets,

        generatedTickets:
          generatedTickets.length,
      },
    });
  }

  if (
    !order.ticketsIssuedAt
  ) {
    await database
      .order
      .update({
        where: {
          id:
            order.id,
        },

        data: {
          ticketsIssuedAt:
            issuedAt,

          finalizedAt:
            issuedAt,
        },
      });
  }

  return {
    order: {
      id:
        order.id,

      reference:
        order.reference,

      status:
        order.status,

      currency:
        order.currency,

      expectedTickets,

      generatedTickets:
        generatedTickets.length,
    },

    tickets:
      generatedTickets,

    createdCount,

    existingCount,
  };
}