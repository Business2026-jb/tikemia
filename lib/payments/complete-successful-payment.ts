import "server-only";

import {
  DeliveryChannel,
  DeliveryStatus,
  DeliveryType,
  OrderStatus,
  PaymentStatus,
  Prisma,
  TicketReservationStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  generateOrderTickets,
  type GenerateOrderTicketsResult,
} from "@/lib/tickets/generate-order-tickets";

const MONEROO_PROVIDER = "MONEROO";

const MAX_TRANSACTION_ATTEMPTS = 3;

export type CompleteSuccessfulPaymentInput = Readonly<{
  paymentId: string;
  providerTransactionId: string;
  providerReference?: string | null;
  gateway?: string | null;
  paymentMethod?: string | null;
  paidAt?: Date;
}>;

export type CompleteSuccessfulPaymentResult = Readonly<{
  paymentId: string;
  orderId: string;
  orderReference: string;
  alreadyCompleted: boolean;
  ticketsCreated: number;
  ticketsExisting: number;
  totalTickets: number;
}>;

export class SuccessfulPaymentCompletionError extends Error {
  readonly code: string;
  readonly causeValue: unknown;

  constructor(
    message: string,
    code: string,
    causeValue?: unknown,
  ) {
    super(message, {
      cause: causeValue,
    });

    this.name =
      "SuccessfulPaymentCompletionError";

    this.code = code;
    this.causeValue = causeValue;

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }
}

function normalizeRequiredText(
  value: string,
  fieldName: string,
): string {
  const normalizedValue =
    value.trim();

  if (!normalizedValue) {
    throw new SuccessfulPaymentCompletionError(
      `${fieldName} est obligatoire.`,
      "PAYMENT_COMPLETION_INPUT_INVALID",
    );
  }

  return normalizedValue;
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  const normalizedValue =
    value?.trim();

  return normalizedValue || null;
}

function validatePaidAt(
  value: Date,
): Date {
  if (
    !(value instanceof Date) ||
    Number.isNaN(value.getTime())
  ) {
    throw new SuccessfulPaymentCompletionError(
      "La date de confirmation du paiement est invalide.",
      "PAYMENT_COMPLETION_DATE_INVALID",
    );
  }

  return value;
}

function toJsonValue(
  value: unknown,
): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value),
  ) as Prisma.InputJsonValue;
}

function readJsonObject(
  value: Prisma.JsonValue | null,
): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return {
      ...value,
    };
  }

  return {};
}

function isRetryableTransactionError(
  error: unknown,
): boolean {
  return (
    error instanceof
      Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

function isOrderNotCompletable(
  status: OrderStatus,
): boolean {
  return (
    status === OrderStatus.CANCELLED ||
    status === OrderStatus.EXPIRED ||
    status === OrderStatus.REFUNDED
  );
}

async function confirmPendingReservation({
  transaction,
  reservation,
  paidAt,
  orderId,
}: {
  transaction: Prisma.TransactionClient;

  reservation: {
    id: string;
    ticketTypeId: string;
    quantity: number;
    status: TicketReservationStatus;
  };

  paidAt: Date;
  orderId: string;
}): Promise<void> {
  if (
    !Number.isInteger(
      reservation.quantity,
    ) ||
    reservation.quantity <= 0
  ) {
    throw new SuccessfulPaymentCompletionError(
      "La quantité réservée est invalide.",
      "TICKET_RESERVATION_QUANTITY_INVALID",
    );
  }

  if (
    reservation.status ===
    TicketReservationStatus.CONFIRMED
  ) {
    return;
  }

  if (
    reservation.status !==
    TicketReservationStatus.PENDING
  ) {
    throw new SuccessfulPaymentCompletionError(
      "Une réservation de billets ne peut plus être confirmée.",
      "TICKET_RESERVATION_NOT_CONFIRMABLE",
    );
  }

  /*
   * La condition reserved >= quantity empêche reserved de devenir négatif.
   * Toute la transaction sera annulée si le stock réservé est incohérent.
   */
  const ticketTypeUpdate =
    await transaction.ticketType.updateMany({
      where: {
        id:
          reservation.ticketTypeId,

        reserved: {
          gte:
            reservation.quantity,
        },
      },

      data: {
        sold: {
          increment:
            reservation.quantity,
        },

        reserved: {
          decrement:
            reservation.quantity,
        },
      },
    });

  if (
    ticketTypeUpdate.count !== 1
  ) {
    throw new SuccessfulPaymentCompletionError(
      "Le stock réservé de la catégorie de billet est insuffisant ou incohérent.",
      "TICKET_RESERVED_STOCK_MISMATCH",
    );
  }

  /*
   * La réservation n'est confirmée que si elle est toujours PENDING.
   * Cela empêche deux traitements concurrents de confirmer deux fois
   * la même réservation.
   */
  const reservationUpdate =
    await transaction.ticketReservation.updateMany({
      where: {
        id:
          reservation.id,

        status:
          TicketReservationStatus.PENDING,
      },

      data: {
        status:
          TicketReservationStatus.CONFIRMED,

        confirmedAt:
          paidAt,

        releasedAt:
          null,

        cancelledAt:
          null,
      },
    });

  if (
    reservationUpdate.count !== 1
  ) {
    throw new SuccessfulPaymentCompletionError(
      "La réservation a été modifiée pendant la confirmation du paiement.",
      "TICKET_RESERVATION_CONCURRENT_UPDATE",
    );
  }

  const updatedReservation =
    await transaction.ticketReservation.findUnique({
      where: {
        id:
          reservation.id,
      },

      select: {
        orderId:
          true,

        status:
          true,
      },
    });

  if (
    !updatedReservation ||
    updatedReservation.orderId !==
      orderId ||
    updatedReservation.status !==
      TicketReservationStatus.CONFIRMED
  ) {
    throw new SuccessfulPaymentCompletionError(
      "La réservation confirmée ne correspond pas à la commande.",
      "TICKET_RESERVATION_ORDER_MISMATCH",
    );
  }
}

async function prepareSuccessfulPaymentOnce({
  paymentId,
  providerTransactionId,
  providerReference,
  gateway,
  paymentMethod,
  paidAt,
}: {
  paymentId: string;
  providerTransactionId: string;
  providerReference: string | null;
  gateway: string | null;
  paymentMethod: string | null;
  paidAt: Date;
}): Promise<{
  orderId: string;
  orderReference: string;
  alreadyCompleted: boolean;
}> {
  return prisma.$transaction(
    async (transaction) => {
      const payment =
        await transaction.payment.findUnique({
          where: {
            id:
              paymentId,
          },

          select: {
            id:
              true,

            orderId:
              true,

            provider:
              true,

            providerTransactionId:
              true,

            providerReference:
              true,

            amount:
              true,

            currency:
              true,

            status:
              true,

            metadata:
              true,

            paidAt:
              true,

            order: {
              select: {
                id:
                  true,

                reference:
                  true,

                status:
                  true,

                total:
                  true,

                currency:
                  true,

                paidAt:
                  true,

                paymentConfirmedAt:
                  true,

                ticketsIssuedAt:
                  true,

                reservations: {
                  orderBy: {
                    createdAt:
                      "asc",
                  },

                  select: {
                    id:
                      true,

                    ticketTypeId:
                      true,

                    quantity:
                      true,

                    status:
                      true,
                  },
                },
              },
            },
          },
        });

      if (!payment) {
        throw new SuccessfulPaymentCompletionError(
          "Le paiement Tikemia est introuvable.",
          "PAYMENT_NOT_FOUND",
        );
      }

      if (
        payment.provider !==
        MONEROO_PROVIDER
      ) {
        throw new SuccessfulPaymentCompletionError(
          "Ce paiement n’appartient pas au fournisseur Moneroo.",
          "PAYMENT_PROVIDER_INVALID",
        );
      }

      if (
        payment.orderId !==
        payment.order.id
      ) {
        throw new SuccessfulPaymentCompletionError(
          "Le paiement ne correspond pas à la commande.",
          "PAYMENT_ORDER_MISMATCH",
        );
      }

      if (
        !payment.amount.equals(
          payment.order.total,
        )
      ) {
        throw new SuccessfulPaymentCompletionError(
          "Le montant du paiement ne correspond pas au total de la commande.",
          "PAYMENT_AMOUNT_MISMATCH",
        );
      }

      const paymentCurrency =
        payment.currency
          .trim()
          .toUpperCase();

      const orderCurrency =
        payment.order.currency
          .trim()
          .toUpperCase();

      if (
        paymentCurrency !==
        orderCurrency
      ) {
        throw new SuccessfulPaymentCompletionError(
          "La devise du paiement ne correspond pas à celle de la commande.",
          "PAYMENT_CURRENCY_MISMATCH",
        );
      }

      if (
        payment.providerTransactionId &&
        payment.providerTransactionId !==
          providerTransactionId
      ) {
        throw new SuccessfulPaymentCompletionError(
          "L’identifiant de transaction Moneroo ne correspond pas au paiement enregistré.",
          "PAYMENT_TRANSACTION_MISMATCH",
        );
      }

      if (
        providerReference &&
        payment.providerReference &&
        payment.providerReference !==
          providerReference
      ) {
        throw new SuccessfulPaymentCompletionError(
          "La référence Moneroo ne correspond pas au paiement enregistré.",
          "PAYMENT_REFERENCE_MISMATCH",
        );
      }

      const alreadyCompleted =
        payment.status ===
          PaymentStatus.SUCCESS &&
        payment.order.status ===
          OrderStatus.PAID;

      if (alreadyCompleted) {
        return {
          orderId:
            payment.order.id,

          orderReference:
            payment.order.reference,

          alreadyCompleted:
            true,
        };
      }

      if (
        isOrderNotCompletable(
          payment.order.status,
        )
      ) {
        throw new SuccessfulPaymentCompletionError(
          "Cette commande ne peut plus être finalisée automatiquement.",
          "ORDER_NOT_COMPLETABLE",
        );
      }

      if (
        payment.order.reservations.length ===
        0
      ) {
        throw new SuccessfulPaymentCompletionError(
          "Aucune réservation n’est associée à cette commande.",
          "TICKET_RESERVATION_NOT_FOUND",
        );
      }

      const latestAttempt =
        await transaction.paymentAttempt.findFirst({
          where: {
            paymentId:
              payment.id,

            provider:
              MONEROO_PROVIDER,
          },

          orderBy: {
            createdAt:
              "desc",
          },

          select: {
            id:
              true,

            providerTransactionId:
              true,

            providerReference:
              true,

            status:
              true,
          },
        });

      if (
        latestAttempt
          ?.providerTransactionId &&
        latestAttempt
          .providerTransactionId !==
          providerTransactionId
      ) {
        throw new SuccessfulPaymentCompletionError(
          "La transaction Moneroo ne correspond pas à la dernière tentative de paiement.",
          "PAYMENT_ATTEMPT_TRANSACTION_MISMATCH",
        );
      }

      const previousMetadata =
        readJsonObject(
          payment.metadata,
        );

      await transaction.payment.update({
        where: {
          id:
            payment.id,
        },

        data: {
          providerTransactionId,

          providerReference:
            providerReference ??
            payment.providerReference,

          status:
            PaymentStatus.SUCCESS,

          paidAt:
            payment.paidAt ??
            paidAt,

          failedAt:
            null,

          cancelledAt:
            null,

          failureCode:
            null,

          failureReason:
            null,

          metadata:
            toJsonValue({
              ...previousMetadata,

              gateway,

              paymentMethod,

              completedAt:
                paidAt.toISOString(),

              completionProvider:
                MONEROO_PROVIDER,
            }),
        },
      });

      if (latestAttempt) {
        await transaction.paymentAttempt.update({
          where: {
            id:
              latestAttempt.id,
          },

          data: {
            providerTransactionId,

            providerReference:
              providerReference ??
              latestAttempt.providerReference ??
              payment.providerReference,

            status:
              PaymentStatus.SUCCESS,

            paidAt,

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
      }

      await transaction.order.update({
        where: {
          id:
            payment.order.id,
        },

        data: {
          status:
            OrderStatus.PAID,

          paymentConfirmedAt:
            payment.order
              .paymentConfirmedAt ??
            paidAt,

          paidAt:
            payment.order.paidAt ??
            paidAt,

          cancelledAt:
            null,

          failedAt:
            null,

          expiredAt:
            null,
        },
      });

      for (
        const reservation of
        payment.order.reservations
      ) {
        await confirmPendingReservation({
          transaction,

          reservation,

          paidAt,

          orderId:
            payment.order.id,
        });
      }

      const unconfirmedReservations =
        await transaction.ticketReservation.count({
          where: {
            orderId:
              payment.order.id,

            status: {
              not:
                TicketReservationStatus.CONFIRMED,
            },
          },
        });

      if (
        unconfirmedReservations > 0
      ) {
        throw new SuccessfulPaymentCompletionError(
          "Toutes les réservations de la commande n’ont pas été confirmées.",
          "TICKET_RESERVATION_CONFIRMATION_INCOMPLETE",
        );
      }

      return {
        orderId:
          payment.order.id,

        orderReference:
          payment.order.reference,

        alreadyCompleted:
          false,
      };
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel
          .Serializable,

      maxWait:
        10_000,

      timeout:
        30_000,
    },
  );
}

async function prepareSuccessfulPayment({
  paymentId,
  providerTransactionId,
  providerReference,
  gateway,
  paymentMethod,
  paidAt,
}: {
  paymentId: string;
  providerTransactionId: string;
  providerReference: string | null;
  gateway: string | null;
  paymentMethod: string | null;
  paidAt: Date;
}): Promise<{
  orderId: string;
  orderReference: string;
  alreadyCompleted: boolean;
}> {
  for (
    let attempt = 1;
    attempt <=
    MAX_TRANSACTION_ATTEMPTS;
    attempt += 1
  ) {
    try {
      return await prepareSuccessfulPaymentOnce({
        paymentId,
        providerTransactionId,
        providerReference,
        gateway,
        paymentMethod,
        paidAt,
      });
    } catch (error) {
      if (
        isRetryableTransactionError(
          error,
        ) &&
        attempt <
          MAX_TRANSACTION_ATTEMPTS
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new SuccessfulPaymentCompletionError(
    "Impossible de finaliser le paiement après plusieurs tentatives.",
    "PAYMENT_COMPLETION_TRANSACTION_FAILED",
  );
}

type DeliveryCandidate = Readonly<{
  userId: string | null;
  orderId: string;
  ticketId: string | null;
  channel: DeliveryChannel;
  type: DeliveryType;
  recipient: string;
  subject: string | null;
  metadata: Prisma.InputJsonValue;
}>;

function buildDeliveryKey({
  channel,
  type,
  recipient,
  ticketId,
}: {
  channel: DeliveryChannel;
  type: DeliveryType;
  recipient: string;
  ticketId: string | null;
}): string {
  return [
    channel,
    type,
    recipient.trim().toLowerCase(),
    ticketId ?? "",
  ].join(":");
}

async function ensureDeliveryLogs({
  orderId,
  ticketResult,
}: {
  orderId: string;
  ticketResult: GenerateOrderTicketsResult;
}): Promise<void> {
  const order =
    await prisma.order.findUnique({
      where: {
        id:
          orderId,
      },

      select: {
        id:
          true,

        customerId:
          true,

        customerEmail:
          true,

        customerPhone:
          true,

        reference:
          true,
      },
    });

  if (!order) {
    throw new SuccessfulPaymentCompletionError(
      "La commande est introuvable pendant la préparation des livraisons.",
      "ORDER_NOT_FOUND",
    );
  }

  const customerEmail =
    normalizeRequiredText(
      order.customerEmail,
      "L’adresse e-mail du client",
    ).toLowerCase();

  const candidates:
    DeliveryCandidate[] = [
      {
        userId:
          order.customerId,

        orderId,

        ticketId:
          null,

        channel:
          DeliveryChannel.EMAIL,

        type:
          DeliveryType.PAYMENT_CONFIRMATION,

        recipient:
          customerEmail,

        subject:
          `Paiement confirmé - ${order.reference}`,

        metadata:
          toJsonValue({
            orderReference:
              order.reference,
          }),
      },
    ];

  for (
    const ticket of
    ticketResult.tickets
  ) {
    const holderEmail =
      normalizeRequiredText(
        ticket.holder.email,
        "L’adresse e-mail du titulaire",
      ).toLowerCase();

    candidates.push({
      userId:
        order.customerId,

      orderId,

      ticketId:
        ticket.id,

      channel:
        DeliveryChannel.EMAIL,

      type:
        DeliveryType.TICKET_NOTIFICATION,

      recipient:
        holderEmail,

      subject:
        `Votre billet ${ticket.code}`,

      metadata:
        toJsonValue({
          ticketCode:
            ticket.code,

          eventTitle:
            ticket.event.title,

          alreadyExisted:
            ticket.alreadyExisted,
        }),
    });

    const holderPhone =
      normalizeOptionalText(
        ticket.holder.phone,
      );

    if (holderPhone) {
      candidates.push({
        userId:
          order.customerId,

        orderId,

        ticketId:
          ticket.id,

        channel:
          DeliveryChannel.WHATSAPP,

        type:
          DeliveryType.TICKET_NOTIFICATION,

        recipient:
          holderPhone,

        subject:
          null,

        metadata:
          toJsonValue({
            ticketCode:
              ticket.code,

            eventTitle:
              ticket.event.title,

            alreadyExisted:
              ticket.alreadyExisted,
          }),
      });
    }
  }

  await prisma.$transaction(
    async (transaction) => {
      const existingLogs =
        await transaction.deliveryLog.findMany({
          where: {
            orderId,

            type: {
              in: [
                DeliveryType.PAYMENT_CONFIRMATION,
                DeliveryType.ORDER_CONFIRMATION,
                DeliveryType.TICKET_NOTIFICATION,
              ],
            },
          },

          select: {
            channel:
              true,

            type:
              true,

            recipient:
              true,

            ticketId:
              true,
          },
        });

      const existingKeys =
        new Set(
          existingLogs.map(
            (log) =>
              buildDeliveryKey({
                channel:
                  log.channel,

                type:
                  log.type,

                recipient:
                  log.recipient,

                ticketId:
                  log.ticketId,
              }),
          ),
        );

      for (
        const candidate of
        candidates
      ) {
        const key =
          buildDeliveryKey({
            channel:
              candidate.channel,

            type:
              candidate.type,

            recipient:
              candidate.recipient,

            ticketId:
              candidate.ticketId,
          });

        if (
          existingKeys.has(key)
        ) {
          continue;
        }

        await transaction.deliveryLog.create({
          data: {
            userId:
              candidate.userId,

            orderId:
              candidate.orderId,

            ticketId:
              candidate.ticketId,

            channel:
              candidate.channel,

            type:
              candidate.type,

            status:
              DeliveryStatus.PENDING,

            recipient:
              candidate.recipient,

            subject:
              candidate.subject,

            scheduledAt:
              new Date(),

            metadata:
              candidate.metadata,
          },
        });

        existingKeys.add(key);
      }
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel
          .Serializable,

      maxWait:
        10_000,

      timeout:
        30_000,
    },
  );
}

export async function completeSuccessfulPayment(
  input: CompleteSuccessfulPaymentInput,
): Promise<CompleteSuccessfulPaymentResult> {
  const paymentId =
    normalizeRequiredText(
      input.paymentId,
      "L’identifiant du paiement",
    );

  const providerTransactionId =
    normalizeRequiredText(
      input.providerTransactionId,
      "L’identifiant de transaction Moneroo",
    );

  const providerReference =
    normalizeOptionalText(
      input.providerReference,
    );

  const gateway =
    normalizeOptionalText(
      input.gateway,
    );

  const paymentMethod =
    normalizeOptionalText(
      input.paymentMethod,
    );

  const paidAt =
    validatePaidAt(
      input.paidAt ??
      new Date(),
    );

  const prepared =
    await prepareSuccessfulPayment({
      paymentId,
      providerTransactionId,
      providerReference,
      gateway,
      paymentMethod,
      paidAt,
    });

  let ticketResult:
    GenerateOrderTicketsResult;

  try {
    ticketResult =
      await generateOrderTickets({
        orderId:
          prepared.orderId,

        issuedAt:
          paidAt,

        createQrDocumentRecord:
          true,
      });
  } catch (error) {
    throw new SuccessfulPaymentCompletionError(
      "Le paiement est confirmé, mais la génération des billets doit être relancée.",
      "PAYMENT_TICKET_ISSUANCE_FAILED",
      error,
    );
  }

  if (
    ticketResult.order.expectedTickets !==
      ticketResult.order.generatedTickets ||
    ticketResult.tickets.length !==
      ticketResult.order.expectedTickets
  ) {
    throw new SuccessfulPaymentCompletionError(
      "Le nombre de billets générés ne correspond pas à la commande.",
      "PAYMENT_TICKET_COUNT_MISMATCH",
    );
  }

  try {
    await ensureDeliveryLogs({
      orderId:
        prepared.orderId,

      ticketResult,
    });
  } catch (error) {
    /*
     * Le paiement et les billets sont déjà confirmés.
     * L’erreur est remontée afin que le webhook ou la réconciliation
     * puisse relancer uniquement la préparation des livraisons.
     */
    throw new SuccessfulPaymentCompletionError(
      "Le paiement et les billets sont confirmés, mais les livraisons doivent être préparées à nouveau.",
      "PAYMENT_DELIVERY_PREPARATION_FAILED",
      error,
    );
  }

  return Object.freeze({
    paymentId,

    orderId:
      prepared.orderId,

    orderReference:
      prepared.orderReference,

    alreadyCompleted:
      prepared.alreadyCompleted,

    ticketsCreated:
      ticketResult.createdCount,

    ticketsExisting:
      ticketResult.existingCount,

    totalTickets:
      ticketResult.tickets.length,
  });
}