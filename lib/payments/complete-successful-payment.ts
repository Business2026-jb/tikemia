import "server-only";

import {
  DeliveryChannel,
  DeliveryStatus,
  DeliveryType,
  OrderStatus,
  PaymentStatus,
  Prisma,
  PromoCodeStatus,
  TicketReservationStatus,
} from "@prisma/client";

import {
  processEmailDeliveries,
} from "@/lib/deliveries/process-email-deliveries";
import { calculateCouponDiscount } from "@/lib/coupons/calculate-coupon-discount";
import { prisma } from "@/lib/prisma";
import {
  generateOrderTickets,
  type GenerateOrderTicketsResult,
} from "@/lib/tickets/generate-order-tickets";

const MONEROO_PROVIDER = "MONEROO";

const MAX_TRANSACTION_ATTEMPTS = 5;

const MAX_POST_COMPLETION_ATTEMPTS = 5;

const RETRY_BASE_DELAY_MS = 120;

const DELIVERY_SETTLE_ATTEMPTS = 6;

const DELIVERY_SETTLE_DELAY_MS = 300;

type CouponPaymentSnapshot = Readonly<{
  promoCodeId: string;
  code: string;
  discountType: string;
  discountValue: string;
  discountAmount: string;
  subtotalBeforeDiscount: string;
  platformFeeBeforeDiscount: string;
  discountedSubtotal: string;
  discountedPlatformFee: string;
  payableAmount: string;
  currency: string;
}>;

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

function readCouponSnapshot(
  metadata: Prisma.JsonValue | null,
): CouponPaymentSnapshot | null {
  const metadataObject =
    readJsonObject(
      metadata,
    );

  const coupon =
    metadataObject.coupon;

  if (
    !coupon ||
    typeof coupon !== "object" ||
    Array.isArray(coupon)
  ) {
    return null;
  }

  const value =
    coupon as Record<
      string,
      unknown
    >;

  const requiredFields = [
    "promoCodeId",
    "code",
    "discountType",
    "discountValue",
    "discountAmount",
    "subtotalBeforeDiscount",
    "platformFeeBeforeDiscount",
    "discountedSubtotal",
    "discountedPlatformFee",
    "payableAmount",
    "currency",
  ] as const;

  for (
    const field of
    requiredFields
  ) {
    if (
      typeof value[field] !==
        "string" ||
      !value[field]
        .trim()
    ) {
      throw new SuccessfulPaymentCompletionError(
        "Les informations du code promo enregistrées avec le paiement sont invalides.",
        "PAYMENT_COUPON_METADATA_INVALID",
      );
    }
  }

  return {
    promoCodeId:
      (
        value.promoCodeId as string
      ).trim(),

    code:
      (
        value.code as string
      )
        .trim()
        .toUpperCase(),

    discountType:
      (
        value.discountType as string
      ).trim(),

    discountValue:
      (
        value.discountValue as string
      ).trim(),

    discountAmount:
      (
        value.discountAmount as string
      ).trim(),

    subtotalBeforeDiscount:
      (
        value.subtotalBeforeDiscount as string
      ).trim(),

    platformFeeBeforeDiscount:
      (
        value.platformFeeBeforeDiscount as string
      ).trim(),

    discountedSubtotal:
      (
        value.discountedSubtotal as string
      ).trim(),

    discountedPlatformFee:
      (
        value.discountedPlatformFee as string
      ).trim(),

    payableAmount:
      (
        value.payableAmount as string
      ).trim(),

    currency:
      (
        value.currency as string
      )
        .trim()
        .toUpperCase(),
  };
}

function getKnownPrismaErrorCode(
  error: unknown,
): string | null {
  let current:
    unknown =
      error;

  for (
    let depth = 0;
    depth < 5;
    depth += 1
  ) {
    if (
      current instanceof
        Prisma.PrismaClientKnownRequestError
    ) {
      return current.code;
    }

    if (
      current instanceof
        SuccessfulPaymentCompletionError
    ) {
      current =
        current.causeValue;

      continue;
    }

    if (
      current instanceof Error
    ) {
      current =
        current.cause;

      continue;
    }

    break;
  }

  return null;
}

function isRetryableTransactionError(
  error: unknown,
): boolean {
  return (
    getKnownPrismaErrorCode(
      error,
    ) === "P2034"
  );
}

function isRetryableCompletionError(
  error: unknown,
): boolean {
  if (
    isRetryableTransactionError(
      error,
    )
  ) {
    return true;
  }

  return (
    error instanceof
      SuccessfulPaymentCompletionError &&
    (
      error.code ===
        "TICKET_RESERVATION_CONCURRENT_UPDATE" ||
      error.code ===
        "PAYMENT_COUPON_CONCURRENT_UPDATE"
    )
  );
}

function isRetryablePostCompletionError(
  error: unknown,
): boolean {
  const code =
    getKnownPrismaErrorCode(
      error,
    );

  return (
    code === "P2034" ||
    code === "P2002"
  );
}

function getRetryDelayMs(
  attempt: number,
): number {
  const exponent =
    Math.max(
      0,
      attempt - 1,
    );

  const baseDelay =
    Math.min(
      1_200,
      RETRY_BASE_DELAY_MS *
        2 ** exponent,
    );

  const jitter =
    Math.floor(
      Math.random() * 90,
    );

  return baseDelay + jitter;
}

async function waitForRetry(
  attempt: number,
): Promise<void> {
  await new Promise<void>(
    (resolve) => {
      setTimeout(
        resolve,
        getRetryDelayMs(
          attempt,
        ),
      );
    },
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

async function finalizeCouponUsage({
  transaction,
  payment,
  paidAt,
}: {
  transaction:
    Prisma.TransactionClient;

  payment: {
    initiatedAt:
      Date;

    amount:
      Prisma.Decimal;

    currency:
      string;

    metadata:
      Prisma.JsonValue
      | null;

    order: {
      id:
        string;

      eventId:
        string;

      customerId:
        string
        | null;

      customerEmail:
        string;

      subtotal:
        Prisma.Decimal;

      platformFee:
        Prisma.Decimal;

      total:
        Prisma.Decimal;

      currency:
        string;
    };
  };

  paidAt:
    Date;
}): Promise<
  Prisma.Decimal
> {
  const couponSnapshot =
    readCouponSnapshot(
      payment.metadata,
    );

  if (
    !couponSnapshot
  ) {
    return payment.order.total;
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
    couponSnapshot.currency !==
      paymentCurrency ||
    couponSnapshot.currency !==
      orderCurrency
  ) {
    throw new SuccessfulPaymentCompletionError(
      "La devise du code promo ne correspond pas au paiement.",
      "PAYMENT_COUPON_CURRENCY_MISMATCH",
    );
  }

  const coupon =
    await transaction
      .promoCode
      .findUnique({
        where: {
          id:
            couponSnapshot
              .promoCodeId,
        },

        select: {
          id:
            true,

          eventId:
            true,

          code:
            true,

          discountType:
            true,

          discountValue:
            true,

          minimumOrderAmount:
            true,

          maximumDiscount:
            true,

          maximumUses:
            true,

          usesPerCustomer:
            true,

          currentUses:
            true,

          startsAt:
            true,

          expiresAt:
            true,

          status:
            true,

          isActive:
            true,
        },
      });

  if (
    !coupon
  ) {
    throw new SuccessfulPaymentCompletionError(
      "Le code promo associé au paiement est introuvable.",
      "PAYMENT_COUPON_NOT_FOUND",
    );
  }

  if (
    coupon.eventId !==
      payment.order.eventId ||
    coupon.code
      .trim()
      .toUpperCase() !==
      couponSnapshot.code
  ) {
    throw new SuccessfulPaymentCompletionError(
      "Le code promo ne correspond pas à la commande.",
      "PAYMENT_COUPON_ORDER_MISMATCH",
    );
  }

  const validationDate =
    payment.initiatedAt;

  if (
    coupon.status !==
      PromoCodeStatus.ACTIVE ||
    !coupon.isActive ||
    (
      coupon.startsAt &&
      coupon.startsAt >
        validationDate
    ) ||
    (
      coupon.expiresAt &&
      coupon.expiresAt <=
        validationDate
    )
  ) {
    throw new SuccessfulPaymentCompletionError(
      "Le code promo n’était pas valide au moment de la création du paiement.",
      "PAYMENT_COUPON_NOT_ACTIVE",
    );
  }

  if (
    coupon.minimumOrderAmount &&
    payment.order.subtotal.lessThan(
      coupon.minimumOrderAmount,
    )
  ) {
    throw new SuccessfulPaymentCompletionError(
      "Le montant minimum du code promo n’est pas respecté.",
      "PAYMENT_COUPON_MINIMUM_NOT_REACHED",
    );
  }

  const calculation =
    calculateCouponDiscount({
      discountType:
        coupon.discountType,

      discountValue:
        coupon.discountValue,

      subtotal:
        payment.order.subtotal,

      platformFee:
        payment.order.platformFee,

      maximumDiscount:
        coupon.maximumDiscount,
    });

  const expectedAmount =
    calculation.finalTotal;

  if (
    !new Prisma.Decimal(
      couponSnapshot
        .subtotalBeforeDiscount,
    ).equals(
      payment.order.subtotal,
    ) ||
    !new Prisma.Decimal(
      couponSnapshot
        .platformFeeBeforeDiscount,
    ).equals(
      payment.order.platformFee,
    ) ||
    !new Prisma.Decimal(
      couponSnapshot
        .discountAmount,
    ).equals(
      calculation.discountAmount,
    ) ||
    !new Prisma.Decimal(
      couponSnapshot
        .discountedSubtotal,
    ).equals(
      calculation.discountedSubtotal,
    ) ||
    !new Prisma.Decimal(
      couponSnapshot
        .discountedPlatformFee,
    ).equals(
      calculation.discountedPlatformFee,
    ) ||
    !new Prisma.Decimal(
      couponSnapshot
        .payableAmount,
    ).equals(
      expectedAmount,
    ) ||
    !new Prisma.Decimal(
      couponSnapshot
        .discountValue,
    ).equals(
      coupon.discountValue,
    ) ||
    couponSnapshot
      .discountType !==
      coupon.discountType
  ) {
    throw new SuccessfulPaymentCompletionError(
      "Le calcul du code promo ne correspond plus au paiement enregistré.",
      "PAYMENT_COUPON_CALCULATION_MISMATCH",
    );
  }

  if (
    !payment.amount.equals(
      expectedAmount,
    )
  ) {
    throw new SuccessfulPaymentCompletionError(
      "Le montant payé ne correspond pas au total après réduction.",
      "PAYMENT_AMOUNT_MISMATCH",
    );
  }

  const existingUsage =
    await transaction
      .promoCodeUsage
      .findFirst({
        where: {
          orderId:
            payment.order.id,
        },

        select: {
          id:
            true,

          promoCodeId:
            true,

          discountAmount:
            true,

          currency:
            true,
        },
      });

  if (
    existingUsage
  ) {
    if (
      existingUsage.promoCodeId !==
        coupon.id ||
      !existingUsage
        .discountAmount
        .equals(
          calculation
            .discountAmount,
        ) ||
      existingUsage.currency
        .trim()
        .toUpperCase() !==
        orderCurrency
    ) {
      throw new SuccessfulPaymentCompletionError(
        "L’utilisation du code promo enregistrée ne correspond pas au paiement.",
        "PAYMENT_COUPON_USAGE_MISMATCH",
      );
    }

    return expectedAmount;
  }

  if (
    coupon.maximumUses !==
      null &&
    coupon.currentUses >=
      coupon.maximumUses
  ) {
    throw new SuccessfulPaymentCompletionError(
      "La limite d’utilisation de ce code promo est atteinte.",
      "PAYMENT_COUPON_USAGE_LIMIT_REACHED",
    );
  }

  if (
    coupon.usesPerCustomer !==
      null
  ) {
    const customerUsageCount =
      await transaction
        .promoCodeUsage
        .count({
          where: {
            promoCodeId:
              coupon.id,

            OR: [
              ...(
                payment.order
                  .customerId
                  ? [
                      {
                        customerId:
                          payment.order
                            .customerId,
                      },
                    ]
                  : []
              ),

              {
                customerEmail:
                  payment.order
                    .customerEmail
                    .trim()
                    .toLowerCase(),
              },
            ],
          },
        });

    if (
      customerUsageCount >=
        coupon.usesPerCustomer
    ) {
      throw new SuccessfulPaymentCompletionError(
        "La limite d’utilisation du code promo par client est atteinte.",
        "PAYMENT_COUPON_CUSTOMER_LIMIT_REACHED",
      );
    }
  }

  const couponUpdate =
    await transaction
      .promoCode
      .updateMany({
        where: {
          id:
            coupon.id,

          status:
            PromoCodeStatus.ACTIVE,

          isActive:
            true,

          currentUses:
            coupon.currentUses,

          ...(
            coupon.maximumUses !==
              null
              ? {
                  AND: [
                    {
                      currentUses: {
                        lt:
                          coupon.maximumUses,
                      },
                    },
                  ],
                }
              : {}
          ),
        },

        data: {
          currentUses: {
            increment:
              1,
          },
        },
      });

  if (
    couponUpdate.count !==
      1
  ) {
    throw new SuccessfulPaymentCompletionError(
      "Le code promo a atteint sa limite pendant la confirmation du paiement.",
      "PAYMENT_COUPON_CONCURRENT_UPDATE",
    );
  }

  await transaction
    .promoCodeUsage
    .create({
      data: {
        promoCodeId:
          coupon.id,

        orderId:
          payment.order.id,

        customerId:
          payment.order
            .customerId,

        customerEmail:
          payment.order
            .customerEmail
            .trim()
            .toLowerCase(),

        discountAmount:
          calculation
            .discountAmount,

        currency:
          orderCurrency,

        usedAt:
          paidAt,
      },
    });

  return expectedAmount;
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

            initiatedAt:
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

                eventId:
                  true,

                customerId:
                  true,

                customerEmail:
                  true,

                subtotal:
                  true,

                platformFee:
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

      /*
       * Les contrôles d’identité du paiement restent obligatoires même lors
       * d’un rejeu du webhook. En revanche, un paiement déjà finalisé ne doit
       * pas recalculer ni revalider un code promo qui a pu être désactivé ou
       * modifié après le paiement initial.
       */
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

      const expectedPaymentAmount =
        await finalizeCouponUsage({
          transaction,

          payment,

          paidAt,
        });

      if (
        !payment.amount.equals(
          expectedPaymentAmount,
        )
      ) {
        throw new SuccessfulPaymentCompletionError(
          "Le montant du paiement ne correspond pas au montant attendu.",
          "PAYMENT_AMOUNT_MISMATCH",
        );
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
        isRetryableCompletionError(
          error,
        ) &&
        attempt <
          MAX_TRANSACTION_ATTEMPTS
      ) {
        await waitForRetry(
          attempt,
        );

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

async function generateOrderTicketsWithRetry({
  orderId,
  issuedAt,
}: {
  orderId: string;
  issuedAt: Date;
}): Promise<GenerateOrderTicketsResult> {
  for (
    let attempt = 1;
    attempt <=
      MAX_POST_COMPLETION_ATTEMPTS;
    attempt += 1
  ) {
    try {
      return await generateOrderTickets({
        orderId,
        issuedAt,
        createQrDocumentRecord:
          true,
      });
    } catch (error) {
      if (
        isRetryablePostCompletionError(
          error,
        ) &&
        attempt <
          MAX_POST_COMPLETION_ATTEMPTS
      ) {
        await waitForRetry(
          attempt,
        );

        continue;
      }

      throw error;
    }
  }

  throw new SuccessfulPaymentCompletionError(
    "Impossible de générer les billets après plusieurs tentatives.",
    "PAYMENT_TICKET_ISSUANCE_RETRY_EXHAUSTED",
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
  attachmentName: string | null;
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

        attachmentName:
          null,

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
        DeliveryType.TICKET_PDF,

      recipient:
        holderEmail,

      subject:
        `Votre billet Tikemia ${ticket.code}`,

      attachmentName:
        `${ticket.code}.pdf`,

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

        attachmentName:
          `${ticket.code}.pdf`,

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
                DeliveryType.TICKET_PDF,
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

            attachmentName:
              candidate.attachmentName,

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


async function ensureDeliveryLogsWithRetry({
  orderId,
  ticketResult,
}: {
  orderId: string;
  ticketResult: GenerateOrderTicketsResult;
}): Promise<void> {
  for (
    let attempt = 1;
    attempt <=
      MAX_POST_COMPLETION_ATTEMPTS;
    attempt += 1
  ) {
    try {
      await ensureDeliveryLogs({
        orderId,
        ticketResult,
      });

      return;
    } catch (error) {
      if (
        isRetryablePostCompletionError(
          error,
        ) &&
        attempt <
          MAX_POST_COMPLETION_ATTEMPTS
      ) {
        await waitForRetry(
          attempt,
        );

        continue;
      }

      throw error;
    }
  }

  throw new SuccessfulPaymentCompletionError(
    "Impossible de préparer les livraisons après plusieurs tentatives.",
    "PAYMENT_DELIVERY_PREPARATION_RETRY_EXHAUSTED",
  );
}


async function hasSentTicketEmail({
  orderId,
}: {
  orderId: string;
}): Promise<boolean> {
  const sentDelivery =
    await prisma.deliveryLog.findFirst({
      where: {
        orderId,

        channel:
          DeliveryChannel.EMAIL,

        type:
          DeliveryType.TICKET_PDF,

        status:
          DeliveryStatus.SENT,

        providerMessageId: {
          not:
            null,
        },
      },

      select: {
        id:
          true,
      },
    });

  return Boolean(
    sentDelivery,
  );
}

async function waitForSentTicketEmail({
  orderId,
}: {
  orderId: string;
}): Promise<boolean> {
  for (
    let attempt = 1;
    attempt <=
      DELIVERY_SETTLE_ATTEMPTS;
    attempt += 1
  ) {
    if (
      await hasSentTicketEmail({
        orderId,
      })
    ) {
      return true;
    }

    if (
      attempt <
        DELIVERY_SETTLE_ATTEMPTS
    ) {
      await new Promise<void>(
        (resolve) => {
          setTimeout(
            resolve,
            DELIVERY_SETTLE_DELAY_MS,
          );
        },
      );
    }
  }

  return false;
}


async function sendTicketEmailImmediately({
  orderId,
  orderReference,
  waitForExistingDelivery = false,
}: {
  orderId: string;
  orderReference: string;
  waitForExistingDelivery?: boolean;
}): Promise<void> {
  if (
    waitForExistingDelivery &&
    await waitForSentTicketEmail({
      orderId,
    })
  ) {
    return;
  }

  let result:
    Awaited<
      ReturnType<
        typeof processEmailDeliveries
      >
    >;

  try {
    result =
      await processEmailDeliveries({
        orderId,

        limit:
          1,

        maxAttempts:
          5,

        forceResend:
          false,
      });
  } catch (error) {
    /*
     * Un autre traitement peut avoir finalisé exactement le même e-mail
     * pendant notre tentative. Avant de considérer l'envoi comme échoué,
     * on laisse brièvement le DeliveryLog concurrent se stabiliser.
     */
    if (
      await waitForSentTicketEmail({
        orderId,
      })
    ) {
      return;
    }

    throw new SuccessfulPaymentCompletionError(
      "L'e-mail contenant les billets n'a pas pu être envoyé pour le moment.",
      "PAYMENT_EMAIL_DELIVERY_NOT_SENT",
      error,
    );
  }

  if (
    result.sentOrders > 0
  ) {
    return;
  }

  /*
   * Lors d'un rejeu du webhook ou d'une vérification navigateur concurrente,
   * l'e-mail peut déjà avoir été envoyé par l'autre traitement.
   */
  const alreadySent =
    await waitForSentTicketEmail({
      orderId,
    });

  if (alreadySent) {
    return;
  }

  const failedItem =
    result.items.find(
      (item) =>
        item.status ===
        "FAILED",
    );

  const skippedItem =
    result.items.find(
      (item) =>
        item.status ===
        "SKIPPED",
    );

  throw new SuccessfulPaymentCompletionError(
    failedItem?.errorMessage ||
      skippedItem?.errorMessage ||
      "L'e-mail contenant les billets n'a pas été envoyé.",
    failedItem?.errorCode ||
      "PAYMENT_EMAIL_DELIVERY_NOT_SENT",
    {
      orderId,
      orderReference,
      selectedOrders:
        result.selectedOrders,
      sentOrders:
        result.sentOrders,
      failedOrders:
        result.failedOrders,
      skippedOrders:
        result.skippedOrders,
      recoveredStaleDeliveries:
        result.recoveredStaleDeliveries,
      items:
        result.items,
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
      await generateOrderTicketsWithRetry({
        orderId:
          prepared.orderId,

        issuedAt:
          paidAt,
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

  let deliveriesPrepared =
    true;

  try {
    await ensureDeliveryLogsWithRetry({
      orderId:
        prepared.orderId,

      ticketResult,
    });
  } catch (error) {
    deliveriesPrepared =
      false;

    /*
     * Le paiement et les billets sont déjà définitivement confirmés.
     * Une panne ou une concurrence sur la couche de livraison ne doit donc
     * jamais transformer la page de succès du paiement en erreur.
     *
     * Les DeliveryLog restent réconciliables séparément et un rejeu futur
     * de completeSuccessfulPayment() peut à nouveau préparer l'envoi.
     */
    console.error(
      "[PAYMENT_DELIVERY_PREPARATION_DEFERRED]",
      {
        paymentId,
        orderId:
          prepared.orderId,
        orderReference:
          prepared.orderReference,
        error:
          error instanceof Error
            ? {
                name:
                  error.name,
                message:
                  error.message,
              }
            : {
                message:
                  String(error),
              },
      },
    );
  }

  if (deliveriesPrepared) {
    try {
      await sendTicketEmailImmediately({
        orderId:
          prepared.orderId,

        orderReference:
          prepared.orderReference,

        /*
         * Lorsqu'un autre appel a déjà marqué la commande PAID, on lui laisse
         * d'abord le temps de terminer son envoi avant de tenter le nôtre.
         */
        waitForExistingDelivery:
          prepared.alreadyCompleted,
      });
    } catch (error) {
      /*
       * Même principe : le paiement et les billets restent valides.
       * L'e-mail est un effet secondaire réessayable et ne doit pas produire
       * PAYMENT_INTERNAL_ERROR côté client après un paiement réussi.
       */
      console.error(
        "[PAYMENT_EMAIL_DELIVERY_DEFERRED]",
        {
          paymentId,
          orderId:
            prepared.orderId,
          orderReference:
            prepared.orderReference,
          error:
            error instanceof Error
              ? {
                  name:
                    error.name,
                  message:
                    error.message,
                }
              : {
                  message:
                    String(error),
                },
        },
      );
    }
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