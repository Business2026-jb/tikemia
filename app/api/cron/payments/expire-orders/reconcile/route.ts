import {
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
} from "@prisma/client";
import {
  NextResponse,
} from "next/server";

import {
  assertFedaPayTransactionMatches,
  getFedaPayTransaction,
  type FedaPayTransaction,
} from "@/lib/payments/providers/fedapay/fedapay-client";
import {
  getPaymentError,
  getPaymentErrorLogContext,
} from "@/lib/payments/payment-errors";
import {
  generateOrderTickets,
} from "@/lib/tickets/generate-order-tickets";
import {
  prisma,
} from "@/lib/prisma";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  60;

const PAYMENT_PROVIDER =
  "FEDAPAY";

const DEFAULT_LIMIT =
  20;

const MAX_LIMIT =
  100;

const DEFAULT_MINIMUM_AGE_MINUTES =
  2;

const MAX_MINIMUM_AGE_MINUTES =
  1_440;

const TRANSACTION_TIMEOUT_MS =
  45_000;

type JsonRecord =
  Record<string, unknown>;

type ReconciliationStatus =
  | "APPROVED"
  | "PENDING"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED"
  | "SKIPPED"
  | "ERROR";

type ReconciliationItem = {
  paymentId: string;
  orderId: string;
  orderReference: string;

  localPaymentStatus: PaymentStatus;
  providerStatus: string | null;

  status: ReconciliationStatus;

  ticketsCreated: number;
  reservationsReleased: number;
  reservedTicketsReleased: number;

  errorCode: string | null;
  errorMessage: string | null;
};

type PendingPaymentRecord = {
  id: string;
  orderId: string;

  providerTransactionId: string | null;
  providerReference: string | null;

  status: PaymentStatus;
  amount: Prisma.Decimal;
  currency: string;

  order: {
    id: string;
    reference: string;
    status: OrderStatus;

    customerId: string | null;
    customerEmail: string;
    customerPhone: string;

    reservationExpiresAt: Date | null;
    ticketsIssuedAt: Date | null;
  };
};

function jsonResponse(
  body:
    JsonRecord,
  status =
    200,
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

function secureEquals(
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

function getCronSecret(): string {
  const secret =
    normalizeText(
      process.env
        .CRON_SECRET,
    );

  if (!secret) {
    throw new Error(
      "CRON_SECRET_MISSING",
    );
  }

  return secret;
}

function getAuthorizationToken(
  request:
    Request,
): string {
  const authorization =
    normalizeText(
      request.headers.get(
        "authorization",
      ),
    );

  if (
    authorization
      .toLowerCase()
      .startsWith(
        "bearer ",
      )
  ) {
    return authorization
      .slice(
        7,
      )
      .trim();
  }

  return normalizeText(
    request.headers.get(
      "x-cron-secret",
    ),
  );
}

function assertAuthorized(
  request:
    Request,
): void {
  const receivedSecret =
    getAuthorizationToken(
      request,
    );

  const expectedSecret =
    getCronSecret();

  if (
    !receivedSecret ||
    !secureEquals(
      receivedSecret,
      expectedSecret,
    )
  ) {
    throw new Error(
      "CRON_UNAUTHORIZED",
    );
  }
}

function parsePositiveInteger({
  value,
  fallback,
  maximum,
}: {
  value:
    string | null;
  fallback:
    number;
  maximum:
    number;
}): number {
  const parsed =
    Number.parseInt(
      value ?? "",
      10,
    );

  if (
    !Number.isInteger(
      parsed,
    ) ||
    parsed <=
      0
  ) {
    return fallback;
  }

  return Math.min(
    parsed,
    maximum,
  );
}

function parseProviderTransactionId(
  value:
    string | null,
): number | null {
  const normalized =
    normalizeText(
      value,
    );

  if (
    !/^\d+$/.test(
      normalized,
    )
  ) {
    return null;
  }

  const parsed =
    Number.parseInt(
      normalized,
      10,
    );

  return Number.isSafeInteger(
    parsed,
  ) &&
  parsed >
    0
    ? parsed
    : null;
}

function toPrismaJsonValue(
  value:
    unknown,
): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(
      value,
      (
        _key,
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

function normalizePhoneForWhatsApp(
  value:
    string,
): string | null {
  const digits =
    value.replace(
      /\D/g,
      "",
    );

  return digits.length >=
      8 &&
    digits.length <=
      15
    ? digits
    : null;
}

async function createDeliveryLogIfMissing({
  database,
  data,
}: {
  database:
    Prisma.TransactionClient;

  data:
    Prisma.DeliveryLogUncheckedCreateInput;
}): Promise<void> {
  const existing =
    await database
      .deliveryLog
      .findFirst({
        where: {
          orderId:
            data.orderId ??
            null,

          ticketId:
            data.ticketId ??
            null,

          channel:
            data.channel,

          type:
            data.type,

          recipient:
            data.recipient,

          status: {
            in: [
              DeliveryStatus.PENDING,
              DeliveryStatus.PROCESSING,
              DeliveryStatus.SENT,
              DeliveryStatus.DELIVERED,
            ],
          },
        },

        select: {
          id:
            true,
        },
      });

  if (
    existing
  ) {
    return;
  }

  await database
    .deliveryLog
    .create({
      data,
    });
}

async function finalizeApprovedPayment({
  payment,
  providerTransaction,
}: {
  payment:
    PendingPaymentRecord;

  providerTransaction:
    FedaPayTransaction;
}): Promise<{
  ticketsCreated: number;
}> {
  const now =
    new Date();

  return prisma.$transaction(
    async (
      database,
    ) => {
      const current =
        await database
          .payment
          .findUnique({
            where: {
              id:
                payment.id,
            },

            select: {
              id:
                true,

              status:
                true,

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
                    },
                  },
                },
              },
            },
          });

      if (
        !current
      ) {
        throw new Error(
          "PAYMENT_NOT_FOUND",
        );
      }

      if (
        current.status ===
          PaymentStatus.SUCCESS &&
        current.order.status ===
          OrderStatus.PAID &&
        current.order
          .ticketsIssuedAt
      ) {
        return {
          ticketsCreated:
            0,
        };
      }

      if (
        current.status !==
          PaymentStatus.PENDING &&
        current.status !==
          PaymentStatus.PROCESSING
      ) {
        throw new Error(
          "PAYMENT_STATUS_CONFLICT",
        );
      }

      if (
        current.order.status !==
          OrderStatus.PENDING &&
        current.order.status !==
          OrderStatus.PROCESSING
      ) {
        throw new Error(
          "ORDER_STATUS_CONFLICT",
        );
      }

      const orderedQuantities =
        new Map<
          string,
          number
        >();

      for (
        const item of
        current.order.items
      ) {
        orderedQuantities.set(
          item.ticketTypeId,
          (
            orderedQuantities.get(
              item.ticketTypeId,
            ) ??
            0
          ) +
          item.quantity,
        );
      }

      const reservedQuantities =
        new Map<
          string,
          number
        >();

      for (
        const reservation of
        current.order
          .reservations
      ) {
        reservedQuantities.set(
          reservation.ticketTypeId,
          (
            reservedQuantities.get(
              reservation.ticketTypeId,
            ) ??
            0
          ) +
          reservation.quantity,
        );
      }

      if (
        orderedQuantities.size !==
        reservedQuantities.size
      ) {
        throw new Error(
          "RESERVATION_MISMATCH",
        );
      }

      for (
        const [
          ticketTypeId,
          orderedQuantity,
        ] of
        orderedQuantities
      ) {
        if (
          reservedQuantities.get(
            ticketTypeId,
          ) !==
          orderedQuantity
        ) {
          throw new Error(
            `RESERVATION_MISMATCH:${ticketTypeId}`,
          );
        }
      }

      for (
        const reservation of
        current.order
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
          throw new Error(
            `RESERVED_STOCK_CONFLICT:${reservation.ticketTypeId}`,
          );
        }
      }

      await database
        .ticketReservation
        .updateMany({
          where: {
            orderId:
              current.order.id,

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
              current.id,
          },

          data: {
            status:
              PaymentStatus.SUCCESS,

            providerTransactionId:
              String(
                providerTransaction.id,
              ),

            providerReference:
              providerTransaction.reference,

            paidAt:
              providerTransaction
                .approvedAt
                ? new Date(
                    providerTransaction
                      .approvedAt,
                  )
                : now,

            failedAt:
              null,

            cancelledAt:
              null,

            failureCode:
              null,

            failureReason:
              null,
          },
        });

      await database
        .paymentAttempt
        .updateMany({
          where: {
            paymentId:
              current.id,

            status: {
              in: [
                PaymentStatus.PENDING,
                PaymentStatus.PROCESSING,
              ],
            },
          },

          data: {
            status:
              PaymentStatus.SUCCESS,

            providerTransactionId:
              String(
                providerTransaction.id,
              ),

            providerReference:
              providerTransaction.reference,

            paidAt:
              providerTransaction
                .approvedAt
                ? new Date(
                    providerTransaction
                      .approvedAt,
                  )
                : now,

            responsePayload:
              toPrismaJsonValue(
                providerTransaction.raw,
              ),

            failedAt:
              null,

            cancelledAt:
              null,

            failureCode:
              null,

            failureReason:
              null,
          },
        });

      await database
        .order
        .update({
          where: {
            id:
              current.order.id,
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

            cancelledAt:
              null,

            expiredAt:
              null,
          },
        });

      const generated =
        await generateOrderTickets({
          orderId:
            current.order.id,

          transaction:
            database,

          issuedAt:
            now,

          createQrDocumentRecord:
            true,
        });

      const whatsappRecipient =
        normalizePhoneForWhatsApp(
          current.order
            .customerPhone,
        );

      for (
        const ticket of
        generated.tickets
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
                  current.order
                    .reference,

                ticketCode:
                  ticket.code,

                ticketCategory:
                  ticket.category
                    .name,

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
                  current.order
                    .reference,

                ticketCode:
                  ticket.code,

                ticketCategory:
                  ticket.category
                    .name,

                unitPrice:
                  ticket.pricing
                    .unitPrice,

                currency:
                  ticket.pricing
                    .currency,
              },
            },
          });

        await createDeliveryLogIfMissing({
          database,

          data: {
            userId:
              current.order
                .customerId,

            orderId:
              current.order.id,

            ticketId:
              ticket.id,

            channel:
              DeliveryChannel.EMAIL,

            type:
              DeliveryType.TICKET_PDF,

            status:
              DeliveryStatus.PENDING,

            recipient:
              current.order
                .customerEmail,

            subject:
              `Votre billet Tikemia ${ticket.code}`,

            attachmentName:
              `${ticket.code}.pdf`,

            metadata: {
              ticketCode:
                ticket.code,

              orderReference:
                current.order
                  .reference,

              ticketCategory:
                ticket.category
                  .name,

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
          whatsappRecipient
        ) {
          await createDeliveryLogIfMissing({
            database,

            data: {
              userId:
                current.order
                  .customerId,

              orderId:
                current.order.id,

              ticketId:
                ticket.id,

              channel:
                DeliveryChannel.WHATSAPP,

              type:
                DeliveryType.TICKET_PDF,

              status:
                DeliveryStatus.PENDING,

              recipient:
                whatsappRecipient,

              attachmentName:
                `${ticket.code}.pdf`,

              metadata: {
                ticketCode:
                  ticket.code,

                orderReference:
                  current.order
                    .reference,

                ticketCategory:
                  ticket.category
                    .name,

                unitPrice:
                  ticket.pricing
                    .unitPrice,

                currency:
                  ticket.pricing
                    .currency,
              },
            },
          });
        }
      }

      await createDeliveryLogIfMissing({
        database,

        data: {
          userId:
            current.order
              .customerId,

          orderId:
            current.order.id,

          channel:
            DeliveryChannel.EMAIL,

          type:
            DeliveryType.PAYMENT_CONFIRMATION,

          status:
            DeliveryStatus.PENDING,

          recipient:
            current.order
              .customerEmail,

          subject:
            `Paiement confirmé — ${current.order.reference}`,
        },
      });

      await createDeliveryLogIfMissing({
        database,

        data: {
          userId:
            current.order
              .customerId,

          orderId:
            current.order.id,

          channel:
            DeliveryChannel.EMAIL,

          type:
            DeliveryType.ORDER_CONFIRMATION,

          status:
            DeliveryStatus.PENDING,

          recipient:
            current.order
              .customerEmail,

          subject:
            `Commande confirmée — ${current.order.reference}`,
        },
      });

      return {
        ticketsCreated:
          generated.createdCount,
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
        TRANSACTION_TIMEOUT_MS,
    },
  );
}

async function finalizeTerminalPayment({
  payment,
  providerTransaction,
}: {
  payment:
    PendingPaymentRecord;

  providerTransaction:
    FedaPayTransaction;
}): Promise<{
  reservationsReleased: number;
  reservedTicketsReleased: number;
}> {
  const now =
    new Date();

  return prisma.$transaction(
    async (
      database,
    ) => {
      const current =
        await database
          .payment
          .findUnique({
            where: {
              id:
                payment.id,
            },

            select: {
              id:
                true,

              status:
                true,

              order: {
                select: {
                  id:
                    true,

                  status:
                    true,

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
                    },
                  },
                },
              },
            },
          });

      if (
        !current
      ) {
        throw new Error(
          "PAYMENT_NOT_FOUND",
        );
      }

      if (
        current.status !==
          PaymentStatus.PENDING &&
        current.status !==
          PaymentStatus.PROCESSING
      ) {
        return {
          reservationsReleased:
            0,

          reservedTicketsReleased:
            0,
        };
      }

      let reservedTicketsReleased =
        0;

      for (
        const reservation of
        current.order
          .reservations
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

          reservedTicketsReleased +=
            reservation.quantity;
        }
      }

      const reservationsUpdate =
        await database
          .ticketReservation
          .updateMany({
            where: {
              orderId:
                current.order.id,

              status:
                TicketReservationStatus
                  .PENDING,
            },

            data: {
              status:
                providerTransaction
                  .status ===
                  "canceled"
                  ? TicketReservationStatus
                      .CANCELLED
                  : TicketReservationStatus
                      .RELEASED,

              releasedAt:
                now,

              cancelledAt:
                providerTransaction
                  .status ===
                  "canceled"
                  ? now
                  : null,
            },
          });

      const paymentStatus =
        providerTransaction
          .status ===
          "canceled"
          ? PaymentStatus.CANCELLED
          : providerTransaction
                .status ===
                "refunded"
            ? PaymentStatus.REFUNDED
            : PaymentStatus.FAILED;

      const orderStatus =
        providerTransaction
          .status ===
          "canceled"
          ? OrderStatus.CANCELLED
          : providerTransaction
                .status ===
                "refunded"
            ? OrderStatus.REFUNDED
            : OrderStatus.FAILED;

      await database
        .payment
        .update({
          where: {
            id:
              current.id,
          },

          data: {
            status:
              paymentStatus,

            providerTransactionId:
              String(
                providerTransaction.id,
              ),

            providerReference:
              providerTransaction.reference,

            failureCode:
              providerTransaction
                .lastErrorCode,

            failureReason:
              providerTransaction
                .rawStatus,

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

            refundedAt:
              paymentStatus ===
                PaymentStatus.REFUNDED
                ? now
                : null,
          },
        });

      await database
        .paymentAttempt
        .updateMany({
          where: {
            paymentId:
              current.id,

            status: {
              in: [
                PaymentStatus.PENDING,
                PaymentStatus.PROCESSING,
              ],
            },
          },

          data: {
            status:
              paymentStatus,

            providerTransactionId:
              String(
                providerTransaction.id,
              ),

            providerReference:
              providerTransaction.reference,

            responsePayload:
              toPrismaJsonValue(
                providerTransaction.raw,
              ),

            failureCode:
              providerTransaction
                .lastErrorCode,

            failureReason:
              providerTransaction
                .rawStatus,

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

      await database
        .order
        .updateMany({
          where: {
            id:
              current.order.id,

            status: {
              in: [
                OrderStatus.PENDING,
                OrderStatus.PROCESSING,
              ],
            },
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

            refundedAt:
              orderStatus ===
                OrderStatus.REFUNDED
                ? now
                : null,
          },
        });

      return {
        reservationsReleased:
          reservationsUpdate.count,

        reservedTicketsReleased,
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
        25_000,
    },
  );
}

async function reconcilePayment(
  payment:
    PendingPaymentRecord,
): Promise<
  ReconciliationItem
> {
  const transactionId =
    parseProviderTransactionId(
      payment
        .providerTransactionId,
    );

  if (
    !transactionId
  ) {
    return {
      paymentId:
        payment.id,

      orderId:
        payment.order.id,

      orderReference:
        payment.order
          .reference,

      localPaymentStatus:
        payment.status,

      providerStatus:
        null,

      status:
        "SKIPPED",

      ticketsCreated:
        0,

      reservationsReleased:
        0,

      reservedTicketsReleased:
        0,

      errorCode:
        "INVALID_PROVIDER_TRANSACTION_ID",

      errorMessage:
        "L’identifiant de transaction FedaPay est absent ou invalide.",
    };
  }

  try {
    const providerTransaction =
      await getFedaPayTransaction(
        transactionId,
      );

    assertFedaPayTransactionMatches({
      transaction:
        providerTransaction,

      expectedAmount:
        payment.amount
          .toNumber(),

      expectedCurrency:
        payment.currency,

      expectedReference:
        payment.order
          .reference,
    });

    if (
      providerTransaction.status ===
      "approved"
    ) {
      const finalized =
        await finalizeApprovedPayment({
          payment,

          providerTransaction,
        });

      return {
        paymentId:
          payment.id,

        orderId:
          payment.order.id,

        orderReference:
          payment.order
            .reference,

        localPaymentStatus:
          payment.status,

        providerStatus:
          providerTransaction
            .status,

        status:
          "APPROVED",

        ticketsCreated:
          finalized
            .ticketsCreated,

        reservationsReleased:
          0,

        reservedTicketsReleased:
          0,

        errorCode:
          null,

        errorMessage:
          null,
      };
    }

    if (
      providerTransaction.status ===
      "pending" ||
      providerTransaction.status ===
      "transferred" ||
      providerTransaction.status ===
      "unknown"
    ) {
      return {
        paymentId:
          payment.id,

        orderId:
          payment.order.id,

        orderReference:
          payment.order
            .reference,

        localPaymentStatus:
          payment.status,

        providerStatus:
          providerTransaction
            .status,

        status:
          "PENDING",

        ticketsCreated:
          0,

        reservationsReleased:
          0,

        reservedTicketsReleased:
          0,

        errorCode:
          null,

        errorMessage:
          null,
      };
    }

    const finalized =
      await finalizeTerminalPayment({
        payment,

        providerTransaction,
      });

    const status:
      ReconciliationStatus =
      providerTransaction.status ===
        "canceled"
        ? "CANCELLED"
        : providerTransaction.status ===
            "refunded"
          ? "REFUNDED"
          : "FAILED";

    return {
      paymentId:
        payment.id,

      orderId:
        payment.order.id,

      orderReference:
        payment.order
          .reference,

      localPaymentStatus:
        payment.status,

      providerStatus:
        providerTransaction
          .status,

      status,

      ticketsCreated:
        0,

      reservationsReleased:
        finalized
          .reservationsReleased,

      reservedTicketsReleased:
        finalized
          .reservedTicketsReleased,

      errorCode:
        null,

      errorMessage:
        null,
    };
  } catch (
    error
  ) {
    const paymentError =
      getPaymentError(
        error,
        {
          code:
            "PAYMENT_INTERNAL_ERROR",

          message:
            "Impossible de rapprocher ce paiement avec FedaPay.",

          status:
            500,

          exposeMessage:
            false,

          provider:
            PAYMENT_PROVIDER,

          paymentId:
            payment.id,

          orderId:
            payment.order.id,
        },
      );

    console.error(
      "[CRON_RECONCILE_PAYMENT_ITEM_ERROR]",
      getPaymentErrorLogContext(
        paymentError,
      ),
    );

    return {
      paymentId:
        payment.id,

      orderId:
        payment.order.id,

      orderReference:
        payment.order
          .reference,

      localPaymentStatus:
        payment.status,

      providerStatus:
        null,

      status:
        "ERROR",

      ticketsCreated:
        0,

      reservationsReleased:
        0,

      reservedTicketsReleased:
        0,

      errorCode:
        paymentError.code,

      errorMessage:
        paymentError.exposeMessage
          ? paymentError.message
          : "Le rapprochement du paiement a échoué.",
    };
  }
}

async function execute(
  request:
    Request,
) {
  const startedAt =
    Date.now();

  try {
    assertAuthorized(
      request,
    );

    const url =
      new URL(
        request.url,
      );

    const limit =
      parsePositiveInteger({
        value:
          url.searchParams.get(
            "limit",
          ),

        fallback:
          DEFAULT_LIMIT,

        maximum:
          MAX_LIMIT,
      });

    const minimumAgeMinutes =
      parsePositiveInteger({
        value:
          url.searchParams.get(
            "minimumAgeMinutes",
          ),

        fallback:
          DEFAULT_MINIMUM_AGE_MINUTES,

        maximum:
          MAX_MINIMUM_AGE_MINUTES,
      });

    const requestedPaymentId =
      normalizeText(
        url.searchParams.get(
          "paymentId",
        ),
      ) ||
      null;

    const requestedOrderId =
      normalizeText(
        url.searchParams.get(
          "orderId",
        ),
      ) ||
      null;

    const createdBefore =
      new Date(
        Date.now() -
          minimumAgeMinutes *
            60_000,
      );

    const payments =
      await prisma
        .payment
        .findMany({
          where: {
            provider:
              PAYMENT_PROVIDER,

            status: {
              in: [
                PaymentStatus.PENDING,
                PaymentStatus.PROCESSING,
              ],
            },

            providerTransactionId: {
              not:
                null,
            },

            createdAt: {
              lte:
                createdBefore,
            },

            ...(requestedPaymentId
              ? {
                  id:
                    requestedPaymentId,
                }
              : {}),

            ...(requestedOrderId
              ? {
                  orderId:
                    requestedOrderId,
                }
              : {}),
          },

          orderBy: [
            {
              updatedAt:
                "asc",
            },

            {
              createdAt:
                "asc",
            },
          ],

          select: {
            id:
              true,

            orderId:
              true,

            providerTransactionId:
              true,

            providerReference:
              true,

            status:
              true,

            amount:
              true,

            currency:
              true,

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

                customerEmail:
                  true,

                customerPhone:
                  true,

                reservationExpiresAt:
                  true,

                ticketsIssuedAt:
                  true,
              },
            },
          },

          take:
            limit,
        });

    const results:
      ReconciliationItem[] =
      [];

    for (
      const payment of
      payments
    ) {
      results.push(
        await reconcilePayment(
          payment,
        ),
      );
    }

    const counts =
      results.reduce(
        (
          accumulator,
          item,
        ) => {
          accumulator[
            item.status
          ] =
            (
              accumulator[
                item.status
              ] ??
              0
            ) +
            1;

          return accumulator;
        },
        {} as Record<
          ReconciliationStatus,
          number
        >,
      );

    return jsonResponse({
      success:
        (
          counts.ERROR ??
          0
        ) ===
        0,

      durationMs:
        Date.now() -
        startedAt,

      summary: {
        selectedPayments:
          payments.length,

        approved:
          counts.APPROVED ??
          0,

        pending:
          counts.PENDING ??
          0,

        failed:
          counts.FAILED ??
          0,

        cancelled:
          counts.CANCELLED ??
          0,

        refunded:
          counts.REFUNDED ??
          0,

        skipped:
          counts.SKIPPED ??
          0,

        errors:
          counts.ERROR ??
          0,

        ticketsCreated:
          results.reduce(
            (
              total,
              item,
            ) =>
              total +
              item.ticketsCreated,
            0,
          ),

        reservationsReleased:
          results.reduce(
            (
              total,
              item,
            ) =>
              total +
              item
                .reservationsReleased,
            0,
          ),

        reservedTicketsReleased:
          results.reduce(
            (
              total,
              item,
            ) =>
              total +
              item
                .reservedTicketsReleased,
            0,
          ),
      },

      results,
    });
  } catch (
    error
  ) {
    if (
      error instanceof
        Error &&
      error.message ===
        "CRON_UNAUTHORIZED"
    ) {
      return jsonResponse(
        {
          success:
            false,

          error: {
            code:
              "CRON_UNAUTHORIZED",

            message:
              "Accès non autorisé.",
          },
        },
        401,
      );
    }

    if (
      error instanceof
        Error &&
      error.message ===
        "CRON_SECRET_MISSING"
    ) {
      console.error(
        "[CRON_RECONCILE_CONFIGURATION_ERROR]",
        {
          message:
            "CRON_SECRET est absent.",
        },
      );

      return jsonResponse(
        {
          success:
            false,

          error: {
            code:
              "CRON_CONFIGURATION_ERROR",

            message:
              "La configuration du rapprochement automatique est incomplète.",
          },
        },
        500,
      );
    }

    const paymentError =
      getPaymentError(
        error,
        {
          code:
            "PAYMENT_INTERNAL_ERROR",

          message:
            "Impossible de rapprocher les paiements FedaPay.",

          status:
            500,

          exposeMessage:
            false,

          provider:
            PAYMENT_PROVIDER,
        },
      );

    console.error(
      "[CRON_RECONCILE_PAYMENTS_ERROR]",
      getPaymentErrorLogContext(
        paymentError,
      ),
    );

    return jsonResponse(
      {
        success:
          false,

        durationMs:
          Date.now() -
          startedAt,

        error: {
          code:
            paymentError.code,

          message:
            paymentError.exposeMessage
              ? paymentError.message
              : "Le rapprochement des paiements a échoué.",
        },
      },
      paymentError.status,
    );
  }
}

export async function GET(
  request:
    Request,
) {
  return execute(
    request,
  );
}

export async function POST(
  request:
    Request,
) {
  return execute(
    request,
  );
}