import "server-only";

import {
  DeliveryChannel,
  DeliveryStatus,
  DeliveryType,
  Prisma,
} from "@prisma/client";

import {
  sendTicketEmail,
  type SendTicketEmailResult,
} from "@/lib/mail/send-ticket-email";
import {
  PaymentError,
  PaymentValidationError,
  getPaymentError,
  getPaymentErrorLogContext,
} from "@/lib/payments/payment-errors";
import { prisma } from "@/lib/prisma";

export type ProcessEmailDeliveriesOptions = {
  limit?: number;

  maxAttempts?: number;

  staleProcessingMinutes?: number;

  orderId?: string;

  forceResend?: boolean;

  logoPath?: string;

  now?: Date;
};

export type ProcessedEmailDeliveryItem = {
  orderId: string;
  orderReference: string | null;

  status:
    | "SENT"
    | "FAILED"
    | "SKIPPED";

  recipient: string | null;

  providerMessageId: string | null;

  deliveryLogIds: string[];

  attachmentsCount: number;

  errorCode: string | null;
  errorMessage: string | null;
};

export type ProcessEmailDeliveriesResult = {
  startedAt: string;
  finishedAt: string;

  selectedOrders: number;

  sentOrders: number;
  failedOrders: number;
  skippedOrders: number;

  recoveredStaleDeliveries: number;

  items: ProcessedEmailDeliveryItem[];
};

type DeliveryOrderGroup = {
  orderId: string;

  orderReference: string | null;

  recipient: string | null;

  deliveryLogIds: string[];

  attemptCount: number;
};

const DEFAULT_LIMIT =
  20;

const MAX_LIMIT =
  100;

const DEFAULT_MAX_ATTEMPTS =
  5;

const DEFAULT_STALE_PROCESSING_MINUTES =
  15;

const MIN_STALE_PROCESSING_MINUTES =
  5;

const MAX_STALE_PROCESSING_MINUTES =
  180;

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizePositiveInteger({
  value,
  fallback,
  minimum,
  maximum,
}: {
  value:
    number
    | undefined;

  fallback:
    number;

  minimum:
    number;

  maximum:
    number;
}): number {
  if (
    !Number.isInteger(
      value,
    )
  ) {
    return fallback;
  }

  return Math.min(
    Math.max(
      value as number,
      minimum,
    ),
    maximum,
  );
}

function truncateErrorMessage(
  value:
    string,
): string {
  return value
    .replace(
      /\s+/g,
      " ",
    )
    .trim()
    .slice(
      0,
      1_900,
    );
}

async function recoverStaleProcessingDeliveries({
  now,
  staleProcessingMinutes,
}: {
  now:
    Date;

  staleProcessingMinutes:
    number;
}): Promise<number> {
  const staleBefore =
    new Date(
      now.getTime() -
        staleProcessingMinutes *
          60_000,
    );

  const result =
    await prisma.deliveryLog.updateMany({
      where: {
        channel:
          DeliveryChannel.EMAIL,

        type:
          DeliveryType.TICKET_PDF,

        status:
          DeliveryStatus.PROCESSING,

        OR: [
          {
            lastAttemptAt: {
              lte:
                staleBefore,
            },
          },

          {
            lastAttemptAt:
              null,
          },
        ],
      },

      data: {
        status:
          DeliveryStatus.FAILED,

        failedAt:
          now,

        errorCode:
          "DELIVERY_PROCESSING_INTERRUPTED",

        errorMessage:
          "Traitement e-mail interrompu avant sa finalisation.",
      },
    });

  return result.count;
}

async function loadDeliveryGroups({
  limit,
  maxAttempts,
  orderId,
}: {
  limit:
    number;

  maxAttempts:
    number;

  orderId:
    string | null;
}): Promise<DeliveryOrderGroup[]> {
  const logs =
    await prisma.deliveryLog.findMany({
      where: {
        channel:
          DeliveryChannel.EMAIL,

        type:
          DeliveryType.TICKET_PDF,

        status: {
          in: [
            DeliveryStatus.PENDING,
            DeliveryStatus.FAILED,
          ],
        },

        attempts: {
          lt:
            maxAttempts,
        },

        orderId: orderId
          ? orderId
          : {
              not:
                null,
            },

        order: {
          status:
            "PAID",

          payment: {
            status:
              "SUCCESS",
          },
        },
      },

      orderBy: [
        {
          createdAt:
            "asc",
        },

        {
          id:
            "asc",
        },
      ],

      select: {
        id:
          true,

        orderId:
          true,

        recipient:
          true,

        attempts:
          true,

        order: {
          select: {
            reference:
              true,
          },
        },
      },

      take:
        limit *
        20,
    });

  const groups =
    new Map<
      string,
      DeliveryOrderGroup
    >();

  for (
    const log of
    logs
  ) {
    if (
      !log.orderId ||
      !log.order
    ) {
      continue;
    }

    const currentOrderId =
      log.orderId;

    const existing =
      groups.get(
        currentOrderId,
      );

    if (
      existing
    ) {
      existing.deliveryLogIds.push(
        log.id,
      );

      existing.attemptCount =
        Math.max(
          existing.attemptCount,
          log.attempts,
        );

      if (
        !existing.recipient &&
        log.recipient
      ) {
        existing.recipient =
          log.recipient;
      }

      continue;
    }

    groups.set(
      currentOrderId,
      {
        orderId:
          currentOrderId,

        orderReference:
          log.order.reference,

        recipient:
          log.recipient,

        deliveryLogIds: [
          log.id,
        ],

        attemptCount:
          log.attempts,
      },
    );

    if (
      groups.size >=
      limit
    ) {
      break;
    }
  }

  return Array.from(
    groups.values(),
  );
}

async function claimDeliveryGroup({
  group,
  now,
  maxAttempts,
}: {
  group:
    DeliveryOrderGroup;

  now:
    Date;

  maxAttempts:
    number;
}): Promise<boolean> {
  return prisma.$transaction(
    async (
      transaction,
    ) => {
      const claimableLogs =
        await transaction.deliveryLog.findMany({
          where: {
            id: {
              in:
                group.deliveryLogIds,
            },

            channel:
              DeliveryChannel.EMAIL,

            type:
              DeliveryType.TICKET_PDF,

            status: {
              in: [
                DeliveryStatus.PENDING,
                DeliveryStatus.FAILED,
              ],
            },

            attempts: {
              lt:
                maxAttempts,
            },
          },

          select: {
            id:
              true,
          },
        });

      if (
        claimableLogs.length !==
        group.deliveryLogIds.length
      ) {
        return false;
      }

      const claimResult =
        await transaction.deliveryLog.updateMany({
          where: {
            id: {
              in:
                claimableLogs.map(
                  (
                    log,
                  ) =>
                    log.id,
                ),
            },

            status: {
              in: [
                DeliveryStatus.PENDING,
                DeliveryStatus.FAILED,
              ],
            },
          },

          data: {
            status:
              DeliveryStatus.PROCESSING,

            lastAttemptAt:
              now,

            failedAt:
              null,

            errorCode:
              null,

            errorMessage:
              null,

            attempts: {
              increment:
                1,
            },
          },
        });

      return (
        claimResult.count ===
        claimableLogs.length
      );
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel
          .Serializable,

      maxWait:
        10_000,

      timeout:
        15_000,
    },
  );
}

async function markDeliveryGroupFailed({
  group,
  now,
  error,
}: {
  group:
    DeliveryOrderGroup;

  now:
    Date;

  error:
    unknown;
}): Promise<void> {
  const paymentError =
    getPaymentError(
      error,
      {
        code:
          "PAYMENT_TICKET_ISSUANCE_FAILED",

        message:
          "Impossible d’envoyer les billets par e-mail.",

        status:
          500,

        exposeMessage:
          false,

        orderId:
          group.orderId,
      },
    );

  await prisma.deliveryLog.updateMany({
    where: {
      id: {
        in:
          group.deliveryLogIds,
      },

      status:
        DeliveryStatus.PROCESSING,
    },

    data: {
      status:
        DeliveryStatus.FAILED,

      failedAt:
        now,

      errorCode:
        paymentError.code,

      errorMessage:
        truncateErrorMessage(
          paymentError.message,
        ),
    },
  });
}

function mapSentResult({
  group,
  result,
}: {
  group:
    DeliveryOrderGroup;

  result:
    SendTicketEmailResult;
}): ProcessedEmailDeliveryItem {
  return {
    orderId:
      result.orderId,

    orderReference:
      result.orderReference,

    status:
      "SENT",

    recipient:
      result.recipient,

    providerMessageId:
      result.providerMessageId,

    deliveryLogIds:
      result.deliveryLogIds.length >
        0
        ? result.deliveryLogIds
        : group.deliveryLogIds,

    attachmentsCount:
      result.attachmentsCount,

    errorCode:
      null,

    errorMessage:
      null,
  };
}

export async function processEmailDeliveries(
  options:
    ProcessEmailDeliveriesOptions =
    {},
): Promise<
  ProcessEmailDeliveriesResult
> {
  const startedAt =
    options.now ??
    new Date();

  const limit =
    normalizePositiveInteger({
      value:
        options.limit,

      fallback:
        DEFAULT_LIMIT,

      minimum:
        1,

      maximum:
        MAX_LIMIT,
    });

  const maxAttempts =
    normalizePositiveInteger({
      value:
        options.maxAttempts,

      fallback:
        DEFAULT_MAX_ATTEMPTS,

      minimum:
        1,

      maximum:
        20,
    });

  const staleProcessingMinutes =
    normalizePositiveInteger({
      value:
        options.staleProcessingMinutes,

      fallback:
        DEFAULT_STALE_PROCESSING_MINUTES,

      minimum:
        MIN_STALE_PROCESSING_MINUTES,

      maximum:
        MAX_STALE_PROCESSING_MINUTES,
    });

  const orderId =
    normalizeText(
      options.orderId,
    ) ||
    null;

  const recoveredStaleDeliveries =
    await recoverStaleProcessingDeliveries({
      now:
        startedAt,

      staleProcessingMinutes,
    });

  const groups =
    await loadDeliveryGroups({
      limit,
      maxAttempts,
      orderId,
    });

  const items:
    ProcessedEmailDeliveryItem[] =
    [];

  let sentOrders =
    0;

  let failedOrders =
    0;

  let skippedOrders =
    0;

  for (
    const group of
    groups
  ) {
    let claimed =
      false;

    try {
      claimed =
        await claimDeliveryGroup({
          group,

          now:
            new Date(),

          maxAttempts,
        });

      if (
        !claimed
      ) {
        skippedOrders +=
          1;

        items.push({
          orderId:
            group.orderId,

          orderReference:
            group.orderReference,

          status:
            "SKIPPED",

          recipient:
            group.recipient,

          providerMessageId:
            null,

          deliveryLogIds:
            group.deliveryLogIds,

          attachmentsCount:
            0,

          errorCode:
            null,

          errorMessage:
            "Cette livraison est déjà traitée par un autre processus.",
        });

        continue;
      }

      const result =
        await sendTicketEmail({
          orderId:
            group.orderId,

          forceResend:
            options.forceResend ??
            false,

          logoPath:
            options.logoPath,

          generatedAt:
            new Date(),
        });

      sentOrders +=
        1;

      items.push(
        mapSentResult({
          group,
          result,
        }),
      );
    } catch (
      error
    ) {
      failedOrders +=
        1;

      console.error(
        "[PROCESS_EMAIL_DELIVERY_ERROR]",
        getPaymentErrorLogContext(
          error,
        ),
      );

      if (
        claimed
      ) {
        await markDeliveryGroupFailed({
          group,

          now:
            new Date(),

          error,
        }).catch(
          (
            persistenceError,
          ) => {
            console.error(
              "[PROCESS_EMAIL_DELIVERY_FAILURE_PERSIST_ERROR]",
              getPaymentErrorLogContext(
                persistenceError,
              ),
            );
          },
        );
      }

      const paymentError =
        getPaymentError(
          error,
          {
            code:
              "PAYMENT_TICKET_ISSUANCE_FAILED",

            message:
              "Impossible d’envoyer les billets par e-mail.",

            status:
              500,

            exposeMessage:
              false,

            orderId:
              group.orderId,
          },
        );

      items.push({
        orderId:
          group.orderId,

        orderReference:
          group.orderReference,

        status:
          "FAILED",

        recipient:
          group.recipient,

        providerMessageId:
          null,

        deliveryLogIds:
          group.deliveryLogIds,

        attachmentsCount:
          0,

        errorCode:
          paymentError.code,

        errorMessage:
          paymentError.exposeMessage
            ? paymentError.message
            : "L’envoi des billets a échoué.",
      });
    }
  }

  const finishedAt =
    new Date();

  return {
    startedAt:
      startedAt.toISOString(),

    finishedAt:
      finishedAt.toISOString(),

    selectedOrders:
      groups.length,

    sentOrders,

    failedOrders,

    skippedOrders,

    recoveredStaleDeliveries,

    items,
  };
}

export async function processSingleOrderTicketEmail({
  orderId,
  forceResend = false,
  logoPath,
}: {
  orderId: string;
  forceResend?: boolean;
  logoPath?: string;
}): Promise<
  ProcessedEmailDeliveryItem
> {
  const normalizedOrderId =
    normalizeIdentifier({
      value:
        orderId,

      field:
        "orderId",
    });

  const result =
    await processEmailDeliveries({
      limit:
        1,

      orderId:
        normalizedOrderId,

      forceResend,

      logoPath,
    });

  const item =
    result.items[0];

  if (
    !item
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Aucune livraison e-mail en attente n’a été trouvée pour cette commande.",

      status:
        404,

      retryable:
        false,

      exposeMessage:
        true,

      orderId:
        normalizedOrderId,
    });
  }

  return item;
}

function normalizeIdentifier({
  value,
  field,
}: {
  value: string;
  field: string;
}): string {
  const normalized =
    normalizeText(
      value,
    );

  if (!normalized) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        `${field} est obligatoire.`,

      status:
        400,

      details: {
        field,
      },
    });
  }

  return normalized;
}