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
import {
  prisma,
} from "@/lib/prisma";

export type ProcessEmailDeliveriesOptions =
  Readonly<{
    limit?: number;
    maxAttempts?: number;
    staleProcessingMinutes?: number;
    orderId?: string;
    forceResend?: boolean;
    logoPath?: string;
    now?: Date;
  }>;

export type ProcessedEmailDeliveryItem =
  Readonly<{
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
  }>;

export type ProcessEmailDeliveriesResult =
  Readonly<{
    startedAt: string;
    finishedAt: string;

    selectedOrders: number;
    sentOrders: number;
    failedOrders: number;
    skippedOrders: number;

    recoveredStaleDeliveries: number;

    items:
      ProcessedEmailDeliveryItem[];
  }>;

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

/*
 * TICKET_NOTIFICATION is kept for compatibility with deliveries
 * already created by the former payment flow.
 *
 * TICKET_PDF is the definitive delivery type used for the e-mail
 * containing the PDF attachments.
 */
const EMAIL_TICKET_DELIVERY_TYPES:
  DeliveryType[] = [
    DeliveryType.TICKET_NOTIFICATION,
    DeliveryType.TICKET_PDF,
  ];

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
    | number
    | undefined;
  fallback: number;
  minimum: number;
  maximum: number;
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

function validateDate(
  value: Date,
  field: string,
): Date {
  if (
    !(value instanceof Date) ||
    Number.isNaN(
      value.getTime(),
    )
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        `${field} est invalide.`,

      status:
        400,

      details: {
        field,
      },
    });
  }

  return value;
}

function truncateErrorMessage(
  value: string,
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

function getClaimableStatuses({
  forceResend,
}: {
  forceResend: boolean;
}): DeliveryStatus[] {
  if (forceResend) {
    return [
      DeliveryStatus.PENDING,
      DeliveryStatus.FAILED,
      DeliveryStatus.SENT,
    ];
  }

  return [
    DeliveryStatus.PENDING,
    DeliveryStatus.FAILED,
  ];
}

async function recoverStaleProcessingDeliveries({
  now,
  staleProcessingMinutes,
  orderId,
}: {
  now: Date;
  staleProcessingMinutes: number;
  orderId: string | null;
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

        type: {
          in:
            EMAIL_TICKET_DELIVERY_TYPES,
        },

        status:
          DeliveryStatus.PROCESSING,

        orderId:
          orderId ??
          {
            not:
              null,
          },

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

        sentAt:
          null,

        errorCode:
          "DELIVERY_PROCESSING_INTERRUPTED",

        errorMessage:
          "Le traitement de l’e-mail a été interrompu avant sa finalisation.",
      },
    });

  return result.count;
}

async function loadDeliveryGroups({
  limit,
  maxAttempts,
  orderId,
  forceResend,
}: {
  limit: number;
  maxAttempts: number;
  orderId: string | null;
  forceResend: boolean;
}): Promise<DeliveryOrderGroup[]> {
  const claimableStatuses =
    getClaimableStatuses({
      forceResend,
    });

  /*
   * On sélectionne d’abord les commandes, puis tous leurs journaux.
   * Cela évite de récupérer seulement une partie des billets d’une
   * commande lorsque celle-ci contient plusieurs pièces jointes.
   */
  const orderCandidates =
    await prisma.deliveryLog.findMany({
      where: {
        channel:
          DeliveryChannel.EMAIL,

        type: {
          in:
            EMAIL_TICKET_DELIVERY_TYPES,
        },

        status: {
          in:
            claimableStatuses,
        },

        attempts:
          forceResend
            ? undefined
            : {
                lt:
                  maxAttempts,
              },

        orderId:
          orderId
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

      distinct: [
        "orderId",
      ],

      select: {
        orderId:
          true,
      },

      take:
        limit,
    });

  const selectedOrderIds =
    orderCandidates
      .map(
        (
          item,
        ) =>
          item.orderId,
      )
      .filter(
        (
          value,
        ): value is string =>
          Boolean(
            value,
          ),
      );

  if (
    selectedOrderIds.length ===
    0
  ) {
    return [];
  }

  const logs =
    await prisma.deliveryLog.findMany({
      where: {
        channel:
          DeliveryChannel.EMAIL,

        type: {
          in:
            EMAIL_TICKET_DELIVERY_TYPES,
        },

        status: {
          in:
            claimableStatuses,
        },

        attempts:
          forceResend
            ? undefined
            : {
                lt:
                  maxAttempts,
              },

        orderId: {
          in:
            selectedOrderIds,
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
    });

  const groups =
    new Map<
      string,
      DeliveryOrderGroup
    >();

  for (
    const log of logs
  ) {
    if (
      !log.orderId ||
      !log.order
    ) {
      continue;
    }

    const existing =
      groups.get(
        log.orderId,
      );

    if (existing) {
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
      log.orderId,
      {
        orderId:
          log.orderId,

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
  }

  return selectedOrderIds
    .map(
      (
        selectedOrderId,
      ) =>
        groups.get(
          selectedOrderId,
        ),
    )
    .filter(
      (
        group,
      ): group is DeliveryOrderGroup =>
        Boolean(
          group,
        ),
    );
}

async function claimDeliveryGroup({
  group,
  now,
  maxAttempts,
  forceResend,
}: {
  group: DeliveryOrderGroup;
  now: Date;
  maxAttempts: number;
  forceResend: boolean;
}): Promise<boolean> {
  const claimableStatuses =
    getClaimableStatuses({
      forceResend,
    });

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

            orderId:
              group.orderId,

            channel:
              DeliveryChannel.EMAIL,

            type: {
              in:
                EMAIL_TICKET_DELIVERY_TYPES,
            },

            status: {
              in:
                claimableStatuses,
            },

            attempts:
              forceResend
                ? undefined
                : {
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
        claimableLogs.length ===
          0 ||
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

            orderId:
              group.orderId,

            status: {
              in:
                claimableStatuses,
            },
          },

          data: {
            status:
              DeliveryStatus.PROCESSING,

            lastAttemptAt:
              now,

            sentAt:
              null,

            failedAt:
              null,

            errorCode:
              null,

            errorMessage:
              null,

            providerMessageId:
              forceResend
                ? null
                : undefined,

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

async function markDeliveryGroupSent({
  group,
  sentAt,
  providerMessageId,
}: {
  group: DeliveryOrderGroup;
  sentAt: Date;
  providerMessageId: string;
}): Promise<void> {
  await prisma.deliveryLog.updateMany({
    where: {
      id: {
        in:
          group.deliveryLogIds,
      },

      orderId:
        group.orderId,

      channel:
        DeliveryChannel.EMAIL,

      type: {
        in:
          EMAIL_TICKET_DELIVERY_TYPES,
      },

      status:
        DeliveryStatus.PROCESSING,
    },

    data: {
      status:
        DeliveryStatus.SENT,

      provider:
        "RESEND",

      providerMessageId,

      sentAt,

      failedAt:
        null,

      errorCode:
        null,

      errorMessage:
        null,
    },
  });
}

async function markDeliveryGroupFailed({
  group,
  now,
  error,
}: {
  group: DeliveryOrderGroup;
  now: Date;
  error: unknown;
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

      orderId:
        group.orderId,

      channel:
        DeliveryChannel.EMAIL,

      type: {
        in:
          EMAIL_TICKET_DELIVERY_TYPES,
      },

      status:
        DeliveryStatus.PROCESSING,
    },

    data: {
      status:
        DeliveryStatus.FAILED,

      failedAt:
        now,

      sentAt:
        null,

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
  group: DeliveryOrderGroup;
  result: SendTicketEmailResult;
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
    validateDate(
      options.now ??
        new Date(),
      "now",
    );

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

  const forceResend =
    options.forceResend ===
    true;

  /*
   * Un renvoi forcé doit toujours viser une commande précise.
   * Cette protection empêche un renvoi massif accidentel.
   */
  if (
    forceResend &&
    !orderId
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        "orderId est obligatoire pour forcer le renvoi d’un e-mail.",

      status:
        400,

      details: {
        field:
          "orderId",
      },
    });
  }

  const recoveredStaleDeliveries =
    await recoverStaleProcessingDeliveries({
      now:
        startedAt,

      staleProcessingMinutes,

      orderId,
    });

  const groups =
    await loadDeliveryGroups({
      limit,
      maxAttempts,
      orderId,
      forceResend,
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
    const group of groups
  ) {
    let claimed =
      false;

    try {
      const claimTime =
        new Date();

      claimed =
        await claimDeliveryGroup({
          group,

          now:
            claimTime,

          maxAttempts,

          forceResend,
        });

      if (!claimed) {
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

          forceResend,

          logoPath:
            options.logoPath,

          generatedAt:
            new Date(),
        });

      if (
        result.orderId !==
        group.orderId
      ) {
        throw new PaymentError({
          code:
            "PAYMENT_TICKET_ISSUANCE_FAILED",

          message:
            "Le résultat de l’envoi ne correspond pas à la commande traitée.",

          status:
            500,

          retryable:
            true,

          exposeMessage:
            false,

          orderId:
            group.orderId,
        });
      }

      if (
        result.attachmentsCount <=
        0
      ) {
        throw new PaymentError({
          code:
            "PAYMENT_TICKET_ISSUANCE_FAILED",

          message:
            "Aucun billet PDF n’a été joint à l’e-mail.",

          status:
            500,

          retryable:
            true,

          exposeMessage:
            false,

          orderId:
            group.orderId,
        });
      }

      await markDeliveryGroupSent({
        group,

        sentAt:
          new Date(
            result.sentAt,
          ),

        providerMessageId:
          result.providerMessageId,
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
        {
          orderId:
            group.orderId,

          orderReference:
            group.orderReference,

          deliveryLogIds:
            group.deliveryLogIds,

          ...getPaymentErrorLogContext(
            error,
          ),
        },
      );

      if (claimed) {
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
              {
                orderId:
                  group.orderId,

                deliveryLogIds:
                  group.deliveryLogIds,

                ...getPaymentErrorLogContext(
                  persistenceError,
                ),
              },
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

  if (!item) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        forceResend
          ? "Aucun billet e-mail n’a été trouvé pour cette commande."
          : "Aucune livraison de billet par e-mail en attente n’a été trouvée pour cette commande.",

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