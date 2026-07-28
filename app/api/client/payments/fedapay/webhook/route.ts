import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import {
  DeliveryChannel,
  DeliveryStatus,
  DeliveryType,
  OrderStatus,
  PaymentStatus,
  Prisma,
  TicketDocumentStatus,
  TicketDocumentType,
  TicketReservationStatus,
  TicketStatus,
  WebhookProcessingStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";

import {
  assertFedaPayTransactionMatches,
  getFedaPayTransaction,
  isFedaPayTransactionApproved,
  type FedaPayTransaction,
} from "@/lib/payments/providers/fedapay/fedapay-client";
import {
  getFedaPayConfig,
} from "@/lib/payments/providers/fedapay/config";
import {
  PaymentError,
  PaymentProviderError,
  PaymentValidationError,
  PaymentWebhookError,
  getPaymentError,
  getPaymentErrorLogContext,
} from "@/lib/payments/payment-errors";
import {
  generateOrderTickets,
} from "@/lib/tickets/generate-order-tickets";
import { prisma } from "@/lib/prisma";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const PAYMENT_PROVIDER =
  "FEDAPAY";

const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS =
  5 * 60;

const MAX_RAW_BODY_BYTES =
  1_000_000;

const MAX_PROCESSING_RETRIES =
  3;

type JsonRecord =
  Record<string, unknown>;

type ParsedWebhookEvent = {
  providerEventId: string;
  eventType: string;
  createdAt: string | null;
  transactionId: number;
  transactionReference: string | null;
  payload: JsonRecord;
};

type PaymentContext = {
  paymentId: string;
  paymentAttemptId: string | null;
  orderId: string;
  orderReference: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  amount: Prisma.Decimal;
  currency: string;
  providerTransactionId: string | null;
  providerReference: string | null;
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  ticketsIssuedAt: Date | null;
};

function jsonResponse(
  body: JsonRecord,
  status = 200,
) {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, max-age=0",

        Pragma:
          "no-cache",

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

function isRecord(
  value:
    unknown,
): value is JsonRecord {
  return (
    Boolean(
      value,
    ) &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value,
    )
  );
}

function toPrismaJsonValue(
  value:
    unknown,
): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(
      value,
      (
        key,
        item,
      ) => {
        if (
          typeof item ===
            "bigint"
        ) {
          return item.toString();
        }

        if (
          item instanceof
            Date
        ) {
          return item.toISOString();
        }

        if (
          item ===
          undefined
        ) {
          return null;
        }

        return item;
      },
    ),
  ) as Prisma.InputJsonValue;
}

function readString(
  record:
    JsonRecord,
  ...keys:
    string[]
): string | null {
  for (
    const key of
    keys
  ) {
    const value =
      record[
        key
      ];

    if (
      typeof value ===
        "string" &&
      value.trim()
    ) {
      return value.trim();
    }

    if (
      typeof value ===
        "number" &&
      Number.isFinite(
        value,
      )
    ) {
      return String(
        value,
      );
    }
  }

  return null;
}

function readNumber(
  record:
    JsonRecord,
  ...keys:
    string[]
): number | null {
  for (
    const key of
    keys
  ) {
    const value =
      record[
        key
      ];

    if (
      typeof value ===
        "number" &&
      Number.isFinite(
        value,
      )
    ) {
      return value;
    }

    if (
      typeof value ===
        "string"
    ) {
      const parsed =
        Number(
          value,
        );

      if (
        Number.isFinite(
          parsed,
        )
      ) {
        return parsed;
      }
    }
  }

  return null;
}

function readRecord(
  record:
    JsonRecord,
  ...keys:
    string[]
): JsonRecord | null {
  for (
    const key of
    keys
  ) {
    const value =
      record[
        key
      ];

    if (
      isRecord(
        value,
      )
    ) {
      return value;
    }
  }

  return null;
}

function hashRawBody(
  rawBody:
    string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      rawBody,
      "utf8",
    )
    .digest(
      "hex",
    );
}

function safeCompare(
  left:
    string,
  right:
    string,
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

function parseSignatureHeader(
  signatureHeader:
    string,
): {
  timestamp: number | null;
  signatures: string[];
} {
  const normalized =
    normalizeText(
      signatureHeader,
    );

  if (!normalized) {
    return {
      timestamp:
        null,

      signatures:
        [],
    };
  }

  let timestamp:
    number | null =
    null;

  const signatures:
    string[] =
    [];

  for (
    const part of
    normalized.split(
      ",",
    )
  ) {
    const [
      rawKey,
      ...rawValueParts
    ] =
      part
        .trim()
        .split(
          "=",
        );

    const key =
      normalizeText(
        rawKey,
      ).toLowerCase();

    const value =
      normalizeText(
        rawValueParts.join(
          "=",
        ),
      );

    if (
      key ===
        "t"
    ) {
      const parsedTimestamp =
        Number.parseInt(
          value,
          10,
        );

      if (
        Number.isFinite(
          parsedTimestamp,
        )
      ) {
        timestamp =
          parsedTimestamp;
      }

      continue;
    }

    if (
      key ===
        "v1" ||
      key ===
        "sha256" ||
      key ===
        "signature"
    ) {
      if (
        value
      ) {
        signatures.push(
          value,
        );
      }
    }
  }

  if (
    signatures.length ===
      0 &&
    !normalized.includes(
      "=",
    )
  ) {
    signatures.push(
      normalized,
    );
  }

  return {
    timestamp,
    signatures,
  };
}

function verifyWebhookSignature({
  rawBody,
  signatureHeader,
  webhookSecret,
}: {
  rawBody:
    string;
  signatureHeader:
    string;
  webhookSecret:
    string;
}): void {
  const {
    timestamp,
    signatures,
  } =
    parseSignatureHeader(
      signatureHeader,
    );

  if (
    signatures.length ===
    0
  ) {
    throw new PaymentWebhookError({
      code:
        "PAYMENT_WEBHOOK_SIGNATURE_INVALID",

      message:
        "La signature du webhook FedaPay est absente.",

      status:
        400,

      retryable:
        false,

      provider:
        PAYMENT_PROVIDER,
    });
  }

  if (
    timestamp !==
      null
  ) {
    const nowInSeconds =
      Math.floor(
        Date.now() /
          1000,
      );

    if (
      Math.abs(
        nowInSeconds -
          timestamp,
      ) >
      WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS
    ) {
      throw new PaymentWebhookError({
        code:
          "PAYMENT_WEBHOOK_SIGNATURE_INVALID",

        message:
          "Le webhook FedaPay est trop ancien ou possède un horodatage invalide.",

        status:
          400,

        retryable:
          false,

        provider:
          PAYMENT_PROVIDER,
      });
    }
  }

  const signedPayloads =
    timestamp !==
      null
      ? [
          `${timestamp}.${rawBody}`,
          rawBody,
        ]
      : [
          rawBody,
        ];

  const expectedSignatures =
    signedPayloads.flatMap(
      (
        signedPayload,
      ) => {
        const digest =
          createHmac(
            "sha256",
            webhookSecret,
          )
            .update(
              signedPayload,
              "utf8",
            )
            .digest();

        return [
          digest.toString(
            "hex",
          ),
          digest.toString(
            "base64",
          ),
          digest.toString(
            "base64url",
          ),
        ];
      },
    );

  const valid =
    signatures.some(
      (
        receivedSignature,
      ) =>
        expectedSignatures.some(
          (
            expectedSignature,
          ) =>
            safeCompare(
              receivedSignature,
              expectedSignature,
            ),
        ),
    );

  if (
    !valid
  ) {
    throw new PaymentWebhookError({
      code:
        "PAYMENT_WEBHOOK_SIGNATURE_INVALID",

      message:
        "La signature du webhook FedaPay est invalide.",

      status:
        400,

      retryable:
        false,

      provider:
        PAYMENT_PROVIDER,
    });
  }
}

function parseWebhookPayload(
  payload:
    unknown,
  rawBody:
    string,
): ParsedWebhookEvent {
  if (
    !isRecord(
      payload,
    )
  ) {
    throw new PaymentWebhookError({
      code:
        "PAYMENT_WEBHOOK_INVALID",

      message:
        "Le contenu du webhook FedaPay est invalide.",

      status:
        400,

      retryable:
        false,

      provider:
        PAYMENT_PROVIDER,
    });
  }

  const eventType =
    readString(
      payload,
      "name",
      "type",
      "event",
    );

  if (
    !eventType
  ) {
    throw new PaymentWebhookError({
      code:
        "PAYMENT_WEBHOOK_INVALID",

      message:
        "Le type d’événement FedaPay est absent.",

      status:
        400,

      retryable:
        false,

      provider:
        PAYMENT_PROVIDER,
    });
  }

  const object =
    readRecord(
      payload,
      "object",
      "data",
    ) ??
    payload;

  const nestedObject =
    readRecord(
      object,
      "object",
      "transaction",
    ) ??
    object;

  const transactionId =
    readNumber(
      nestedObject,
      "id",
      "transaction_id",
      "transactionId",
    );

  if (
    transactionId ===
      null ||
    !Number.isSafeInteger(
      transactionId,
    ) ||
    transactionId <=
      0
  ) {
    throw new PaymentWebhookError({
      code:
        "PAYMENT_WEBHOOK_INVALID",

      message:
        "L’identifiant de transaction FedaPay est absent ou invalide.",

      status:
        400,

      retryable:
        false,

      provider:
        PAYMENT_PROVIDER,
    });
  }

  const providerEventId =
    readString(
      payload,
      "id",
      "event_id",
      "eventId",
    ) ??
    `${eventType}:${transactionId}:${hashRawBody(
      rawBody,
    )}`;

  return {
    providerEventId,

    eventType:
      eventType
        .trim()
        .toLowerCase(),

    createdAt:
      readString(
        payload,
        "created_at",
        "createdAt",
      ),

    transactionId,

    transactionReference:
      readString(
        nestedObject,
        "reference",
      ),

    payload,
  };
}

function sanitizeHeaders(
  headers:
    Headers,
): JsonRecord {
  const result:
    JsonRecord =
    {};

  for (
    const [
      key,
      value,
    ] of
    headers.entries()
  ) {
    const normalizedKey =
      key.toLowerCase();

    if (
      normalizedKey ===
        "authorization" ||
      normalizedKey ===
        "cookie"
    ) {
      result[
        key
      ] =
        "[REDACTED]";

      continue;
    }

    result[
      key
    ] =
      value.slice(
        0,
        2_000,
      );
  }

  return result;
}

function normalizePhoneForWhatsApp(
  value:
    string,
): string | null {
  const normalized =
    value.replace(
      /[^\d+]/g,
      "",
    );

  if (
    normalized.length <
      7
  ) {
    return null;
  }

  return normalized;
}

function getReservationQuantitiesByTicketType(
  reservations: Array<{
    ticketTypeId: string;
    quantity: number;
  }>,
): Map<string, number> {
  const quantities =
    new Map<string, number>();

  for (
    const reservation of
    reservations
  ) {
    quantities.set(
      reservation.ticketTypeId,
      (
        quantities.get(
          reservation.ticketTypeId,
        ) ?? 0
      ) + reservation.quantity,
    );
  }

  return quantities;
}

function assertReservationsMatchOrderItems({
  items,
  reservations,
  orderId,
  paymentId,
}: {
  items: Array<{
    ticketTypeId: string;
    quantity: number;
  }>;
  reservations: Array<{
    ticketTypeId: string;
    quantity: number;
  }>;
  orderId: string;
  paymentId: string;
}): void {
  const reservedQuantities =
    getReservationQuantitiesByTicketType(
      reservations,
    );

  const reservationsMatch =
    items.every(
      (item) =>
        reservedQuantities.get(
          item.ticketTypeId,
        ) === item.quantity,
    ) &&
    reservedQuantities.size ===
      items.length;

  if (!reservationsMatch) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_RESERVATION_CONFLICT",

      message:
        "Les réservations actives ne correspondent plus aux billets commandés.",

      status:
        409,

      retryable:
        false,

      orderId,
      paymentId,

      details: {
        expected: items,
        reservations,
      },
    });
  }
}


async function findPaymentContext(
  transaction:
    FedaPayTransaction,
): Promise<PaymentContext> {
  const providerTransactionId =
    String(
      transaction.id,
    );

  const metadataPaymentId =
    typeof transaction
      .customMetadata
      ?.paymentId ===
      "string"
      ? transaction
          .customMetadata
          .paymentId
      : null;

  const metadataOrderId =
    typeof transaction
      .customMetadata
      ?.orderId ===
      "string"
      ? transaction
          .customMetadata
          .orderId
      : null;

  const payment =
    await prisma.payment.findFirst({
      where: {
        provider:
          PAYMENT_PROVIDER,

        OR: [
          {
            providerTransactionId,
          },

          {
            providerReference:
              transaction.reference,
          },

          ...(metadataPaymentId
            ? [
                {
                  id:
                    metadataPaymentId,
                },
              ]
            : []),

          ...(metadataOrderId
            ? [
                {
                  orderId:
                    metadataOrderId,
                },
              ]
            : []),
        ],
      },

      select: {
        id:
          true,

        orderId:
          true,

        status:
          true,

        amount:
          true,

        currency:
          true,

        providerTransactionId:
          true,

        providerReference:
          true,

        attempts: {
          where: {
            OR: [
              {
                providerTransactionId,
              },

              {
                providerReference:
                  transaction.reference,
              },
            ],
          },

          orderBy: {
            createdAt:
              "desc",
          },

          take:
            1,

          select: {
            id:
              true,
          },
        },

        order: {
          select: {
            id:
              true,

            reference:
              true,

            status:
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
          },
        },
      },
    });

  if (
    !payment
  ) {
    throw new PaymentProviderError({
      code:
        "PAYMENT_PROVIDER_TRANSACTION_NOT_FOUND",

      message:
        "Aucun paiement Tikemia ne correspond à cette transaction FedaPay.",

      status:
        404,

      provider:
        PAYMENT_PROVIDER,

      providerReference:
        transaction.reference,
    });
  }

  return {
    paymentId:
      payment.id,

    paymentAttemptId:
      payment.attempts[0]
        ?.id ??
      null,

    orderId:
      payment.orderId,

    orderReference:
      payment.order
        .reference,

    paymentStatus:
      payment.status,

    orderStatus:
      payment.order
        .status,

    amount:
      payment.amount,

    currency:
      payment.currency,

    providerTransactionId:
      payment
        .providerTransactionId,

    providerReference:
      payment
        .providerReference,

    customerId:
      payment.order
        .customerId,

    customerName:
      payment.order
        .customerName,

    customerEmail:
      payment.order
        .customerEmail,

    customerPhone:
      payment.order
        .customerPhone,

    ticketsIssuedAt:
      payment.order
        .ticketsIssuedAt,
  };
}

async function finalizeApprovedPayment({
  context,
  transaction,
  webhookEventId,
}: {
  context:
    PaymentContext;
  transaction:
    FedaPayTransaction;
  webhookEventId:
    string;
}) {
  const now =
    new Date();

  return prisma.$transaction(
    async (
      database,
    ) => {
      const currentOrder =
        await database
          .order
          .findUnique({
            where: {
              id:
                context.orderId,
            },

            select: {
              id:
                true,

              status:
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

              items: {
                select: {
                  id:
                    true,

                  ticketTypeId:
                    true,

                  quantity:
                    true,
                },
              },

              reservations: {
                where: {
                  status:
                    TicketReservationStatus
                      .PENDING,
                },

                select: {
                  id:
                    true,

                  ticketTypeId:
                    true,

                  quantity:
                    true,

                  expiresAt:
                    true,
                },
              },
            },
          });

      if (
        !currentOrder
      ) {
        throw new PaymentValidationError({
          code:
            "PAYMENT_ORDER_NOT_FOUND",

          message:
            "La commande associée au paiement est introuvable.",

          status:
            404,

          orderId:
            context.orderId,

          paymentId:
            context.paymentId,
        });
      }

      if (
        currentOrder.status ===
          OrderStatus.PAID &&
        currentOrder
          .ticketsIssuedAt
      ) {
        await database
          .paymentWebhookEvent
          .update({
            where: {
              id:
                webhookEventId,
            },

            data: {
              paymentId:
                context.paymentId,

              paymentAttemptId:
                context
                  .paymentAttemptId,

              orderId:
                currentOrder.id,

              status:
                WebhookProcessingStatus
                  .PROCESSED,

              processedAt:
                now,

              lastError:
                null,
            },
          });

        return {
          alreadyProcessed:
            true,

          createdTickets:
            0,
        };
      }

      if (
        currentOrder.status ===
          OrderStatus.CANCELLED ||
        currentOrder.status ===
          OrderStatus.EXPIRED ||
        currentOrder.status ===
          OrderStatus.REFUNDED
      ) {
        throw new PaymentValidationError({
          code:
            "PAYMENT_ORDER_NOT_PAYABLE",

          message:
            "La commande ne peut plus être finalisée.",

          status:
            409,

          orderId:
            currentOrder.id,

          paymentId:
            context.paymentId,

          details: {
            orderStatus:
              currentOrder.status,
          },
        });
      }

      assertReservationsMatchOrderItems({
        items:
          currentOrder.items.map(
            (
              item,
            ) => ({
              ticketTypeId:
                item.ticketTypeId,

              quantity:
                item.quantity,
            }),
          ),

        reservations:
          currentOrder.reservations.map(
            (
              reservation,
            ) => ({
              ticketTypeId:
                reservation.ticketTypeId,

              quantity:
                reservation.quantity,
            }),
          ),

        orderId:
          currentOrder.id,

        paymentId:
          context.paymentId,
      });

      for (
        const reservation of
        currentOrder
          .reservations
      ) {
        const stockUpdate =
          await database
            .ticketType
            .updateMany({
              where: {
                id:
                  reservation
                    .ticketTypeId,

                reserved: {
                  gte:
                    reservation
                      .quantity,
                },
              },

              data: {
                reserved: {
                  decrement:
                    reservation
                      .quantity,
                },

                sold: {
                  increment:
                    reservation
                      .quantity,
                },
              },
            });

        if (
          stockUpdate.count !==
          1
        ) {
          throw new PaymentValidationError({
            code:
              "PAYMENT_RESERVATION_CONFLICT",

            message:
              "Le stock réservé ne peut pas être confirmé automatiquement.",

            status:
              409,

            retryable:
              false,

            orderId:
              currentOrder.id,

            paymentId:
              context.paymentId,

            details: {
              ticketTypeId:
                reservation
                  .ticketTypeId,

              quantity:
                reservation
                  .quantity,
            },
          });
        }
      }

      await database
        .ticketReservation
        .updateMany({
          where: {
            orderId:
              currentOrder.id,

            status:
              TicketReservationStatus
                .PENDING,
          },

          data: {
            status:
              TicketReservationStatus
                .CONFIRMED,

            confirmedAt:
              now,
          },
        });

      await database
        .payment
        .update({
          where: {
            id:
              context.paymentId,
          },

          data: {
            status:
              PaymentStatus.SUCCESS,

            providerTransactionId:
              String(
                transaction.id,
              ),

            providerReference:
              transaction.reference,

            paidAt:
              transaction.approvedAt
                ? new Date(
                    transaction
                      .approvedAt,
                  )
                : now,

            failureCode:
              null,

            failureReason:
              null,

            failedAt:
              null,

            cancelledAt:
              null,
          },
        });

      if (
        context
          .paymentAttemptId
      ) {
        await database
          .paymentAttempt
          .update({
            where: {
              id:
                context
                  .paymentAttemptId,
            },

            data: {
              status:
                PaymentStatus.SUCCESS,

              providerTransactionId:
                String(
                  transaction.id,
                ),

              providerReference:
                transaction.reference,

              paidAt:
                transaction.approvedAt
                  ? new Date(
                      transaction
                        .approvedAt,
                    )
                  : now,

              responsePayload:
                toPrismaJsonValue(
                  transaction.raw,
                ),

              failureCode:
                null,

              failureReason:
                null,

              failedAt:
                null,

              cancelledAt:
                null,
            },
          });
      }

      await database
        .order
        .update({
          where: {
            id:
              currentOrder.id,
          },

          data: {
            status:
              OrderStatus.PAID,

            paymentConfirmedAt:
              now,

            paidAt:
              now,

            failedAt:
              null,

            expiredAt:
              null,

            cancelledAt:
              null,
          },
        });

      const ticketGeneration =
        await generateOrderTickets({
          orderId:
            currentOrder.id,

          transaction:
            database,

          issuedAt:
            now,

          createQrDocumentRecord:
            true,
        });

      for (
        const ticket of
        ticketGeneration.tickets
      ) {
        await database
          .ticketDocument
          .upsert({
            where: {
              ticketId_type: {
                ticketId:
                  ticket.id,

                type:
                  TicketDocumentType
                    .PDF,
              },
            },

            create: {
              ticketId:
                ticket.id,

              type:
                TicketDocumentType
                  .PDF,

              status:
                TicketDocumentStatus
                  .PENDING,

              generationKey:
                `ticket:${ticket.id}:pdf:v1`,

              fileName:
                `${ticket.code}.pdf`,

              mimeType:
                "application/pdf",

              metadata: {
                orderReference:
                  context.orderReference,

                ticketCode:
                  ticket.code,

                ticketCategory:
                  ticket.category.name,

                unitPrice:
                  ticket.pricing
                    .unitPrice,

                currency:
                  ticket.pricing
                    .currency,
              },
            },

            update: {
              status:
                TicketDocumentStatus
                  .PENDING,

              generationKey:
                `ticket:${ticket.id}:pdf:v1`,

              fileName:
                `${ticket.code}.pdf`,

              mimeType:
                "application/pdf",

              failureReason:
                null,

              metadata: {
                orderReference:
                  context.orderReference,

                ticketCode:
                  ticket.code,

                ticketCategory:
                  ticket.category.name,

                unitPrice:
                  ticket.pricing
                    .unitPrice,

                currency:
                  ticket.pricing
                    .currency,
              },
            },
          });

        if (
          !ticket.alreadyExisted
        ) {
          const whatsappRecipient =
            normalizePhoneForWhatsApp(
              currentOrder
                .customerPhone,
            );

          await database
            .deliveryLog
            .createMany({
              data: [
                {
                  userId:
                    currentOrder
                      .customerId,

                  orderId:
                    currentOrder.id,

                  ticketId:
                    ticket.id,

                  channel:
                    DeliveryChannel
                      .EMAIL,

                  type:
                    DeliveryType
                      .TICKET_PDF,

                  status:
                    DeliveryStatus
                      .PENDING,

                  recipient:
                    currentOrder
                      .customerEmail,

                  subject:
                    `Votre billet Tikemia ${ticket.code}`,

                  attachmentName:
                    `${ticket.code}.pdf`,

                  metadata: {
                    ticketCode:
                      ticket.code,

                    orderReference:
                      context.orderReference,

                    ticketCategory:
                      ticket.category.name,

                    unitPrice:
                      ticket.pricing
                        .unitPrice,

                    currency:
                      ticket.pricing
                        .currency,
                  },
                },

                ...(whatsappRecipient
                  ? [
                      {
                        userId:
                          currentOrder
                            .customerId,

                        orderId:
                          currentOrder.id,

                        ticketId:
                          ticket.id,

                        channel:
                          DeliveryChannel
                            .WHATSAPP,

                        type:
                          DeliveryType
                            .TICKET_PDF,

                        status:
                          DeliveryStatus
                            .PENDING,

                        recipient:
                          whatsappRecipient,

                        attachmentName:
                          `${ticket.code}.pdf`,

                        metadata: {
                          ticketCode:
                            ticket.code,

                          orderReference:
                            context.orderReference,

                          ticketCategory:
                            ticket.category.name,

                          unitPrice:
                            ticket.pricing
                              .unitPrice,

                          currency:
                            ticket.pricing
                              .currency,
                        },
                      },
                    ]
                  : []),
              ],
            });
        }
      }

      await database
        .deliveryLog
        .createMany({
          data: [
            {
              userId:
                currentOrder
                  .customerId,

              orderId:
                currentOrder.id,

              channel:
                DeliveryChannel.EMAIL,

              type:
                DeliveryType
                  .PAYMENT_CONFIRMATION,

              status:
                DeliveryStatus.PENDING,

              recipient:
                currentOrder
                  .customerEmail,

              subject:
                `Paiement confirmé — ${context.orderReference}`,

              metadata: {
                orderReference:
                  context.orderReference,

                paymentId:
                  context.paymentId,

                amount:
                  context.amount.toFixed(
                    2,
                  ),

                currency:
                  context.currency,
              },
            },

            {
              userId:
                currentOrder
                  .customerId,

              orderId:
                currentOrder.id,

              channel:
                DeliveryChannel.EMAIL,

              type:
                DeliveryType
                  .ORDER_CONFIRMATION,

              status:
                DeliveryStatus.PENDING,

              recipient:
                currentOrder
                  .customerEmail,

              subject:
                `Commande confirmée — ${context.orderReference}`,

              metadata: {
                orderReference:
                  context.orderReference,
              },
            },
          ],
        });

      await database
        .paymentWebhookEvent
        .update({
          where: {
            id:
              webhookEventId,
          },

          data: {
            paymentId:
              context.paymentId,

            paymentAttemptId:
              context
                .paymentAttemptId,

            orderId:
              currentOrder.id,

            status:
              WebhookProcessingStatus
                .PROCESSED,

            processedAt:
              now,

            lastError:
              null,
          },
        });

      return {
        alreadyProcessed:
          false,

        createdTickets:
          ticketGeneration
            .createdCount,
      };
    },
    {
      isolationLevel:
        Prisma
          .TransactionIsolationLevel
          .Serializable,

      maxWait:
        10_000,

      timeout:
        45_000,
    },
  );
}
async function finalizeRefundedPayment({
  context,
  transaction,
  webhookEventId,
}: {
  context:
    PaymentContext;
  transaction:
    FedaPayTransaction;
  webhookEventId:
    string;
}) {
  const now =
    new Date();

  await prisma.$transaction(
    async (
      database,
    ) => {
      const currentOrder =
        await database.order.findUnique({
          where: {
            id:
              context.orderId,
          },

          select: {
            id:
              true,

            status:
              true,

            items: {
              select: {
                ticketTypeId:
                  true,

                quantity:
                  true,
              },
            },
          },
        });

      if (!currentOrder) {
        throw new PaymentValidationError({
          code:
            "PAYMENT_ORDER_NOT_FOUND",

          message:
            "La commande remboursée est introuvable.",

          status:
            404,

          orderId:
            context.orderId,

          paymentId:
            context.paymentId,
        });
      }

      if (
        currentOrder.status !==
        OrderStatus.REFUNDED
      ) {
        for (
          const item of
          currentOrder.items
        ) {
          const stockUpdate =
            await database.ticketType.updateMany({
              where: {
                id:
                  item.ticketTypeId,

                sold: {
                  gte:
                    item.quantity,
                },
              },

              data: {
                sold: {
                  decrement:
                    item.quantity,
                },
              },
            });

          if (
            stockUpdate.count !==
            1
          ) {
            throw new PaymentValidationError({
              code:
                "PAYMENT_STOCK_INSUFFICIENT",

              message:
                "Le stock vendu ne peut pas être corrigé automatiquement après le remboursement.",

              status:
                409,

              retryable:
                false,

              orderId:
                currentOrder.id,

              paymentId:
                context.paymentId,

              details: {
                ticketTypeId:
                  item.ticketTypeId,

                quantity:
                  item.quantity,
              },
            });
          }
        }
      }

      await database.ticket.updateMany({
        where: {
          orderId:
            currentOrder.id,

          status: {
            not:
              TicketStatus.REFUNDED,
          },
        },

        data: {
          status:
            TicketStatus.REFUNDED,
        },
      });

      await database.payment.update({
        where: {
          id:
            context.paymentId,
        },

        data: {
          status:
            PaymentStatus.REFUNDED,

          providerTransactionId:
            String(
              transaction.id,
            ),

          providerReference:
            transaction.reference,

          refundedAt:
            transaction.refundedAt
              ? new Date(
                  transaction.refundedAt,
                )
              : now,

          failureCode:
            null,

          failureReason:
            null,
        },
      });

      if (
        context.paymentAttemptId
      ) {
        await database.paymentAttempt.update({
          where: {
            id:
              context.paymentAttemptId,
          },

          data: {
            status:
              PaymentStatus.REFUNDED,

            providerTransactionId:
              String(
                transaction.id,
              ),

            providerReference:
              transaction.reference,

            responsePayload:
              toPrismaJsonValue(
                transaction.raw,
              ),
          },
        });
      }

      await database.order.update({
        where: {
          id:
            currentOrder.id,
        },

        data: {
          status:
            OrderStatus.REFUNDED,

          refundedAt:
            now,
        },
      });

      await database.paymentWebhookEvent.update({
        where: {
          id:
            webhookEventId,
        },

        data: {
          paymentId:
            context.paymentId,

          paymentAttemptId:
            context.paymentAttemptId,

          orderId:
            currentOrder.id,

          status:
            WebhookProcessingStatus.PROCESSED,

          processedAt:
            now,

          lastError:
            null,
        },
      });
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,

      maxWait:
        10_000,

      timeout:
        20_000,
    },
  );
}

async function releaseReservationsAndUpdateFailure({
  context,
  transaction,
  webhookEventId,
  eventType,
}: {
  context:
    PaymentContext;
  transaction:
    FedaPayTransaction;
  webhookEventId:
    string;
  eventType:
    string;
}) {
  const now =
    new Date();

  const paymentStatus =
    eventType.includes(
      "cancel",
    )
      ? PaymentStatus.CANCELLED
      : PaymentStatus.FAILED;

  const orderStatus =
    eventType.includes(
      "cancel",
    )
      ? OrderStatus.CANCELLED
      : OrderStatus.FAILED;

  await prisma.$transaction(
    async (
      database,
    ) => {
      const reservations =
        await database
          .ticketReservation
          .findMany({
            where: {
              orderId:
                context.orderId,

              status:
                TicketReservationStatus
                  .PENDING,
            },

            select: {
              id:
                true,

              ticketTypeId:
                true,

              quantity:
                true,
            },
          });

      for (
        const reservation of
        reservations
      ) {
        const ticketType =
          await database
            .ticketType
            .findUnique({
              where: {
                id:
                  reservation
                    .ticketTypeId,
              },

              select: {
                reserved:
                  true,
              },
            });

        if (
          ticketType
        ) {
          await database
            .ticketType
            .update({
              where: {
                id:
                  reservation
                    .ticketTypeId,
              },

              data: {
                reserved:
                  Math.max(
                    0,
                    ticketType.reserved -
                      reservation
                        .quantity,
                  ),
              },
            });
        }
      }

      await database
        .ticketReservation
        .updateMany({
          where: {
            orderId:
              context.orderId,

            status:
              TicketReservationStatus
                .PENDING,
          },

          data: {
            status:
              eventType.includes(
                "cancel",
              )
                ? TicketReservationStatus
                    .CANCELLED
                : TicketReservationStatus
                    .RELEASED,

            releasedAt:
              now,

            cancelledAt:
              eventType.includes(
                "cancel",
              )
                ? now
                : null,
          },
        });

      await database
        .payment
        .update({
          where: {
            id:
              context.paymentId,
          },

          data: {
            status:
              paymentStatus,

            providerTransactionId:
              String(
                transaction.id,
              ),

            providerReference:
              transaction.reference,

            failureCode:
              transaction.lastErrorCode,

            failureReason:
              eventType,

            failedAt:
              paymentStatus ===
                PaymentStatus.FAILED
                ? now
                : null,

            cancelledAt:
              paymentStatus ===
                PaymentStatus.CANCELLED
                ? now
                : null,

          },
        });

      if (
        context
          .paymentAttemptId
      ) {
        await database
          .paymentAttempt
          .update({
            where: {
              id:
                context
                  .paymentAttemptId,
            },

            data: {
              status:
                paymentStatus,

              providerTransactionId:
                String(
                  transaction.id,
                ),

              providerReference:
                transaction.reference,

              responsePayload:
                toPrismaJsonValue(
                  transaction.raw,
                ),

              failureCode:
                transaction
                  .lastErrorCode,

              failureReason:
                eventType,

              failedAt:
                paymentStatus ===
                  PaymentStatus.FAILED
                  ? now
                  : null,

              cancelledAt:
                paymentStatus ===
                  PaymentStatus.CANCELLED
                  ? now
                  : null,
            },
          });
      }

      await database
        .order
        .update({
          where: {
            id:
              context.orderId,
          },

          data: {
            status:
              orderStatus,

            failedAt:
              orderStatus ===
                OrderStatus.FAILED
                ? now
                : null,

            cancelledAt:
              orderStatus ===
                OrderStatus.CANCELLED
                ? now
                : null,

          },
        });

      await database
        .paymentWebhookEvent
        .update({
          where: {
            id:
              webhookEventId,
          },

          data: {
            paymentId:
              context.paymentId,

            paymentAttemptId:
              context
                .paymentAttemptId,

            orderId:
              context.orderId,

            status:
              WebhookProcessingStatus
                .PROCESSED,

            processedAt:
              now,

            lastError:
              null,
          },
        });
    },
    {
      isolationLevel:
        Prisma
          .TransactionIsolationLevel
          .Serializable,

      maxWait:
        10_000,

      timeout:
        20_000,
    },
  );
}

async function processWebhookEvent({
  parsedEvent,
  webhookEventId,
}: {
  parsedEvent:
    ParsedWebhookEvent;
  webhookEventId:
    string;
}) {
  const transaction =
    await getFedaPayTransaction(
      parsedEvent
        .transactionId,
    );

  const context =
    await findPaymentContext(
      transaction,
    );

  assertFedaPayTransactionMatches({
    transaction,

    expectedAmount:
      context.amount.toNumber(),

    expectedCurrency:
      context.currency,

    expectedReference:
      context.orderReference,
  });

  const eventType =
    parsedEvent
      .eventType;

  if (
    isFedaPayTransactionApproved(
      transaction,
    )
  ) {
    return finalizeApprovedPayment({
      context,
      transaction,
      webhookEventId,
    });
  }

  if (
    transaction.status ===
      "refunded"
  ) {
    await finalizeRefundedPayment({
      context,
      transaction,
      webhookEventId,
    });

    return {
      alreadyProcessed:
        context.orderStatus ===
        OrderStatus.REFUNDED,

      createdTickets:
        0,
    };
  }

  if (
    transaction.status ===
      "declined" ||
    transaction.status ===
      "canceled"
  ) {
    if (
      context.paymentStatus ===
        PaymentStatus.SUCCESS ||
      context.orderStatus ===
        OrderStatus.PAID
    ) {
      await prisma.paymentWebhookEvent.update({
        where: {
          id:
            webhookEventId,
        },

        data: {
          paymentId:
            context.paymentId,

          paymentAttemptId:
            context.paymentAttemptId,

          orderId:
            context.orderId,

          status:
            WebhookProcessingStatus.IGNORED,

          processedAt:
            new Date(),

          lastError:
            "Événement de paiement obsolète ignoré après confirmation.",
        },
      });

      return {
        alreadyProcessed:
          true,

        createdTickets:
          0,
      };
    }

    await releaseReservationsAndUpdateFailure({
      context,
      transaction,
      webhookEventId,
      eventType,
    });

    return {
      alreadyProcessed:
        false,

      createdTickets:
        0,
    };
  }

  await prisma
    .paymentWebhookEvent
    .update({
      where: {
        id:
          webhookEventId,
      },

      data: {
        paymentId:
          context.paymentId,

        paymentAttemptId:
          context
            .paymentAttemptId,

        orderId:
          context.orderId,

        status:
          WebhookProcessingStatus
            .IGNORED,

        processedAt:
          new Date(),

        lastError:
          null,
      },
    });

  return {
    alreadyProcessed:
      false,

    createdTickets:
      0,
  };
}

export async function POST(
  request:
    Request,
) {
  let webhookEventId:
    string | null =
    null;

  try {
    const contentLength =
      Number.parseInt(
        request.headers.get(
          "content-length",
        ) ??
        "0",
        10,
      );

    if (
      Number.isFinite(
        contentLength,
      ) &&
      contentLength >
        MAX_RAW_BODY_BYTES
    ) {
      throw new PaymentWebhookError({
        code:
          "PAYMENT_WEBHOOK_INVALID",

        message:
          "Le webhook FedaPay dépasse la taille autorisée.",

        status:
          413,

        retryable:
          false,

        provider:
          PAYMENT_PROVIDER,
      });
    }

    const rawBody =
      await request.text();

    if (
      Buffer.byteLength(
        rawBody,
        "utf8",
      ) >
      MAX_RAW_BODY_BYTES
    ) {
      throw new PaymentWebhookError({
        code:
          "PAYMENT_WEBHOOK_INVALID",

        message:
          "Le webhook FedaPay dépasse la taille autorisée.",

        status:
          413,

        retryable:
          false,

        provider:
          PAYMENT_PROVIDER,
      });
    }

    const config =
      getFedaPayConfig();

    const signatureHeader =
      normalizeText(
        request.headers.get(
          config
            .webhookSignatureHeader,
        ),
      ) ||
      normalizeText(
        request.headers.get(
          "x-fedapay-signature",
        ),
      );

    verifyWebhookSignature({
      rawBody,
      signatureHeader,
      webhookSecret:
        config.webhookSecret,
    });

    let payload:
      unknown;

    try {
      payload =
        JSON.parse(
          rawBody,
        );
    } catch {
      throw new PaymentWebhookError({
        code:
          "PAYMENT_WEBHOOK_INVALID",

        message:
          "Le webhook FedaPay ne contient pas un JSON valide.",

        status:
          400,

        retryable:
          false,

        provider:
          PAYMENT_PROVIDER,
      });
    }

    const parsedEvent =
      parseWebhookPayload(
        payload,
        rawBody,
      );

    const now =
      new Date();

    const webhookEvent =
      await prisma.paymentWebhookEvent.upsert({
        where: {
          provider_providerEventId: {
            provider:
              PAYMENT_PROVIDER,

            providerEventId:
              parsedEvent.providerEventId,
          },
        },

        create: {
          provider:
            PAYMENT_PROVIDER,

          providerEventId:
            parsedEvent.providerEventId,

          eventType:
            parsedEvent.eventType,

          payload:
            toPrismaJsonValue(
              parsedEvent.payload,
            ),

          headers:
            toPrismaJsonValue(
              sanitizeHeaders(
                request.headers,
              ),
            ),

          signatureVerified:
            true,

          status:
            WebhookProcessingStatus.PROCESSING,

          processingAttempts:
            1,

          receivedAt:
            now,

          processingStartedAt:
            now,
        },

        update: {
          eventType:
            parsedEvent.eventType,

          payload:
            toPrismaJsonValue(
              parsedEvent.payload,
            ),

          headers:
            toPrismaJsonValue(
              sanitizeHeaders(
                request.headers,
              ),
            ),

          signatureVerified:
            true,

          processingAttempts: {
            increment:
              1,
          },

          processingStartedAt:
            now,

          failedAt:
            null,

          lastError:
            null,
        },

        select: {
          id:
            true,

          status:
            true,

          processingAttempts:
            true,
        },
      });

    if (
      webhookEvent.status ===
        WebhookProcessingStatus.PROCESSED ||
      webhookEvent.status ===
        WebhookProcessingStatus.IGNORED
    ) {
      return jsonResponse({
        success:
          true,

        received:
          true,

        duplicate:
          true,

        message:
          "Événement déjà traité.",
      });
    }

    webhookEventId =
      webhookEvent.id;

    await prisma.paymentWebhookEvent.update({
      where: {
        id:
          webhookEvent.id,
      },

      data: {
        status:
          WebhookProcessingStatus.PROCESSING,
      },
    });

    if (
      webhookEvent
        .processingAttempts >
      MAX_PROCESSING_RETRIES
    ) {
      throw new PaymentWebhookError({
        code:
          "PAYMENT_WEBHOOK_INVALID",

        message:
          "Le nombre maximal de tentatives internes du webhook est dépassé.",

        status:
          409,

        retryable:
          false,

        provider:
          PAYMENT_PROVIDER,

        details: {
          webhookEventId,
        },
      });
    }

    const result =
      await processWebhookEvent({
        parsedEvent,
        webhookEventId,
      });

    return jsonResponse({
      success:
        true,

      received:
        true,

      duplicate:
        result
          .alreadyProcessed,

      ticketsCreated:
        result
          .createdTickets,
    });
  } catch (
    error
  ) {
    const paymentError =
      getPaymentError(
        error,
        {
          code:
            "PAYMENT_WEBHOOK_INVALID",

          message:
            "Impossible de traiter le webhook FedaPay.",

          status:
            500,

          exposeMessage:
            false,

          provider:
            PAYMENT_PROVIDER,
        },
      );

    console.error(
      "[FEDAPAY_WEBHOOK_ERROR]",
      getPaymentErrorLogContext(
        paymentError,
      ),
    );

    if (
      webhookEventId
    ) {
      await prisma
        .paymentWebhookEvent
        .update({
          where: {
            id:
              webhookEventId,
          },

          data: {
            status:
              WebhookProcessingStatus
                .FAILED,

            failedAt:
              new Date(),

            lastError:
              paymentError.message
                .slice(
                  0,
                  2_000,
                ),
          },
        })
        .catch(
          (
            persistenceError,
          ) => {
            console.error(
              "[FEDAPAY_WEBHOOK_FAILURE_PERSIST_ERROR]",
              getPaymentErrorLogContext(
                persistenceError,
              ),
            );
          },
        );
    }

    return jsonResponse(
      paymentError.toJSON() as unknown as JsonRecord,
      paymentError.status,
    );
  }
}