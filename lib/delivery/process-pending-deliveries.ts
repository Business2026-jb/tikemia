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
import { prisma } from "@/lib/prisma";
import {
  sendTicketWhatsApp,
  type SendTicketWhatsAppResult,
} from "@/lib/whatsapp/send-ticket-whatsapp";

const DEFAULT_BATCH_SIZE = 20;
const MAX_BATCH_SIZE = 100;
const DEFAULT_MAX_ATTEMPTS = 5;

const PROCESSABLE_DELIVERY_TYPES = [
  DeliveryType.PAYMENT_CONFIRMATION,
  DeliveryType.ORDER_CONFIRMATION,
  DeliveryType.TICKET_NOTIFICATION,
  DeliveryType.TICKET_PDF,
] as const;

export type ProcessPendingDeliveriesInput = Readonly<{
  limit?: number;
  maxAttempts?: number;
  includeFailed?: boolean;
  forceResend?: boolean;
  signal?: AbortSignal;
}>;

export type ProcessedDeliveryGroup = Readonly<{
  orderId: string;
  channel: DeliveryChannel;

  deliveryLogIds: readonly string[];

  status:
    | "SENT"
    | "SKIPPED"
    | "FAILED";

  provider:
    | "RESEND"
    | "META_WHATSAPP"
    | null;

  providerMessageIds: readonly string[];

  errorCode: string | null;
  errorMessage: string | null;
}>;

export type ProcessPendingDeliveriesResult =
  Readonly<{
    startedAt: Date;
    finishedAt: Date;
    durationMs: number;

    selectedLogs: number;
    ignoredLogs: number;
    selectedGroups: number;

    processedGroups: number;
    sentGroups: number;
    skippedGroups: number;
    failedGroups: number;

    results:
      readonly ProcessedDeliveryGroup[];
  }>;

type RawDeliveryCandidate = Readonly<{
  id: string;
  orderId: string | null;
  channel: DeliveryChannel;
  type: DeliveryType;
  status: DeliveryStatus;
  attempts: number;
  scheduledAt: Date | null;
}>;

type DeliveryCandidate = Readonly<{
  id: string;
  orderId: string;
  channel: DeliveryChannel;
  type: DeliveryType;
  status: DeliveryStatus;
  attempts: number;
  scheduledAt: Date;
}>;

type DeliveryGroup = Readonly<{
  orderId: string;
  channel: DeliveryChannel;
  logs: readonly DeliveryCandidate[];
}>;

type DeliveryExecutionResult =
  | SendTicketEmailResult
  | SendTicketWhatsAppResult;

export class DeliveryProcessingError extends Error {
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
      "DeliveryProcessingError";

    this.code = code;
    this.causeValue = causeValue;

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }
}

function normalizeLimit(
  value: number | undefined,
): number {
  if (value === undefined) {
    return DEFAULT_BATCH_SIZE;
  }

  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_BATCH_SIZE
  ) {
    throw new DeliveryProcessingError(
      `La limite doit être comprise entre 1 et ${MAX_BATCH_SIZE}.`,
      "DELIVERY_LIMIT_INVALID",
    );
  }

  return value;
}

function normalizeMaxAttempts(
  value: number | undefined,
): number {
  if (value === undefined) {
    return DEFAULT_MAX_ATTEMPTS;
  }

  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > 20
  ) {
    throw new DeliveryProcessingError(
      "maxAttempts doit être compris entre 1 et 20.",
      "DELIVERY_MAX_ATTEMPTS_INVALID",
    );
  }

  return value;
}

function assertNotAborted(
  signal: AbortSignal | undefined,
): void {
  if (!signal?.aborted) {
    return;
  }

  throw new DeliveryProcessingError(
    "Le traitement des livraisons a été annulé.",
    "DELIVERY_PROCESSING_ABORTED",
    signal.reason,
  );
}

function serializeError(
  error: unknown,
): Readonly<{
  code: string;
  message: string;
}> {
  if (
    error instanceof
    DeliveryProcessingError
  ) {
    return {
      code:
        error.code,

      message:
        error.message,
    };
  }

  if (
    typeof error === "object" &&
    error !== null
  ) {
    const possibleCode =
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : null;

    const possibleMessage =
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : null;

    if (
      possibleCode ||
      possibleMessage
    ) {
      return {
        code:
          possibleCode ??
          "DELIVERY_PROCESSING_FAILED",

        message:
          possibleMessage ??
          "La livraison a échoué.",
      };
    }
  }

  if (error instanceof Error) {
    return {
      code:
        "DELIVERY_PROCESSING_FAILED",

      message:
        error.message,
    };
  }

  return {
    code:
      "DELIVERY_PROCESSING_FAILED",

    message:
      "Une erreur inconnue est survenue pendant la livraison.",
  };
}

function normalizeDeliveryCandidates(
  candidates: readonly RawDeliveryCandidate[],
): {
  valid: DeliveryCandidate[];
  ignored: number;
} {
  const valid:
    DeliveryCandidate[] = [];

  let ignored = 0;

  for (
    const candidate of candidates
  ) {
    if (
      !candidate.orderId ||
      !candidate.scheduledAt
    ) {
      ignored += 1;

      console.warn(
        "[DELIVERY_CANDIDATE_IGNORED]",
        {
          deliveryLogId:
            candidate.id,

          hasOrderId:
            Boolean(
              candidate.orderId,
            ),

          hasScheduledAt:
            Boolean(
              candidate.scheduledAt,
            ),

          channel:
            candidate.channel,

          type:
            candidate.type,

          status:
            candidate.status,
        },
      );

      continue;
    }

    valid.push({
      id:
        candidate.id,

      orderId:
        candidate.orderId,

      channel:
        candidate.channel,

      type:
        candidate.type,

      status:
        candidate.status,

      attempts:
        candidate.attempts,

      scheduledAt:
        candidate.scheduledAt,
    });
  }

  return {
    valid,
    ignored,
  };
}

function groupCandidates(
  candidates: readonly DeliveryCandidate[],
): DeliveryGroup[] {
  const groups =
    new Map<
      string,
      {
        orderId: string;
        channel: DeliveryChannel;
        logs: DeliveryCandidate[];
      }
    >();

  for (
    const candidate of candidates
  ) {
    const key =
      `${candidate.orderId}:${candidate.channel}`;

    const existing =
      groups.get(key);

    if (existing) {
      existing.logs.push(
        candidate,
      );

      continue;
    }

    groups.set(key, {
      orderId:
        candidate.orderId,

      channel:
        candidate.channel,

      logs: [
        candidate,
      ],
    });
  }

  return Array.from(
    groups.values(),
  );
}

function getProviderMessageIds(
  result: DeliveryExecutionResult,
): string[] {
  if (
    result.provider ===
    "RESEND"
  ) {
    return [
      result.providerMessageId,
    ];
  }

  return [
    ...result.providerMessageIds,
  ];
}

function normalizeProviderMessageIds(
  providerMessageIds: readonly string[],
): string[] {
  const uniqueIds =
    new Set<string>();

  for (
    const value of providerMessageIds
  ) {
    const normalizedValue =
      value.trim();

    if (normalizedValue) {
      uniqueIds.add(
        normalizedValue,
      );
    }
  }

  return Array.from(
    uniqueIds,
  );
}

function isUniqueConstraintError(
  error: unknown,
): boolean {
  return (
    error instanceof
      Prisma.PrismaClientKnownRequestError &&
    error.code ===
      "P2002"
  );
}

async function claimDeliveryGroup({
  group,
  maxAttempts,
  claimedAt,
}: {
  group: DeliveryGroup;
  maxAttempts: number;
  claimedAt: Date;
}): Promise<string[]> {
  const logIds =
    group.logs.map(
      (log) => log.id,
    );

  if (
    logIds.length === 0
  ) {
    return [];
  }

  const claimableLogs =
    await prisma.deliveryLog.findMany({
      where: {
        id: {
          in:
            logIds,
        },

        orderId:
          group.orderId,

        channel:
          group.channel,

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
        id: true,
      },
    });

  const claimableLogIds =
    claimableLogs.map(
      (log) => log.id,
    );

  if (
    claimableLogIds.length === 0
  ) {
    return [];
  }

  const updateResult =
    await prisma.deliveryLog.updateMany({
      where: {
        id: {
          in:
            claimableLogIds,
        },

        orderId:
          group.orderId,

        channel:
          group.channel,

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

      data: {
        status:
          DeliveryStatus.PROCESSING,

        failedAt:
          null,

        errorCode:
          null,

        errorMessage:
          null,

        lastAttemptAt:
          claimedAt,
      },
    });

  if (
    updateResult.count === 0
  ) {
    return [];
  }

  const claimedLogs =
    await prisma.deliveryLog.findMany({
      where: {
        id: {
          in:
            claimableLogIds,
        },

        orderId:
          group.orderId,

        channel:
          group.channel,

        status:
          DeliveryStatus.PROCESSING,

        lastAttemptAt:
          claimedAt,
      },

      select: {
        id: true,
      },
    });

  return claimedLogs.map(
    (log) => log.id,
  );
}

async function persistClaimedLogsSent({
  deliveryLogIds,
  provider,
  providerMessageIds,
  sentAt,
}: {
  deliveryLogIds: readonly string[];
  provider: string;
  providerMessageIds: readonly string[];
  sentAt: Date;
}): Promise<void> {
  const normalizedProviderMessageIds =
    normalizeProviderMessageIds(
      providerMessageIds,
    );

  await prisma.$transaction(
    deliveryLogIds.map(
      (
        deliveryLogId,
        index,
      ) => {
        /*
         * providerMessageId possède une contrainte unique.
         *
         * Un seul e-mail Resend peut couvrir plusieurs DeliveryLog
         * de la même commande. Le premier journal reçoit donc
         * l’identifiant Resend et les autres restent à null.
         *
         * Pour WhatsApp, plusieurs identifiants éventuels sont
         * distribués un par un entre les journaux.
         */
        const providerMessageId =
          normalizedProviderMessageIds[
            index
          ] ?? null;

        return prisma.deliveryLog.updateMany({
          where: {
            id:
              deliveryLogId,

            status:
              DeliveryStatus.PROCESSING,
          },

          data: {
            status:
              DeliveryStatus.SENT,

            provider,

            providerMessageId,

            sentAt,

            failedAt:
              null,

            errorCode:
              null,

            errorMessage:
              null,

            lastAttemptAt:
              sentAt,
          },
        });
      },
    ),
  );
}

async function persistClaimedLogsSentWithoutProviderIds({
  deliveryLogIds,
  provider,
  sentAt,
}: {
  deliveryLogIds: readonly string[];
  provider: string;
  sentAt: Date;
}): Promise<void> {
  await prisma.deliveryLog.updateMany({
    where: {
      id: {
        in: [
          ...deliveryLogIds,
        ],
      },

      status:
        DeliveryStatus.PROCESSING,
    },

    data: {
      status:
        DeliveryStatus.SENT,

      provider,

      providerMessageId:
        null,

      sentAt,

      failedAt:
        null,

      errorCode:
        null,

      errorMessage:
        null,

      lastAttemptAt:
        sentAt,
    },
  });
}

async function markClaimedLogsSent({
  deliveryLogIds,
  provider,
  providerMessageIds,
  sentAt,
}: {
  deliveryLogIds: readonly string[];
  provider: string;
  providerMessageIds: readonly string[];
  sentAt: Date;
}): Promise<void> {
  if (
    deliveryLogIds.length === 0
  ) {
    return;
  }

  try {
    await persistClaimedLogsSent({
      deliveryLogIds,
      provider,
      providerMessageIds,
      sentAt,
    });
  } catch (error) {
    /*
     * L’envoi auprès du fournisseur a déjà réussi.
     *
     * En cas de collision historique sur providerMessageId,
     * il est plus sûr de marquer les journaux comme envoyés
     * sans identifiant fournisseur plutôt que de renvoyer
     * le même e-mail ou le même message WhatsApp.
     */
    if (
      !isUniqueConstraintError(
        error,
      )
    ) {
      throw error;
    }

    console.warn(
      "[DELIVERY_PROVIDER_MESSAGE_ID_CONFLICT]",
      {
        deliveryLogIds:
          [
            ...deliveryLogIds,
          ],

        provider,

        providerMessageIds:
          [
            ...providerMessageIds,
          ],

        message:
          "Collision détectée sur providerMessageId. Les journaux seront marqués comme envoyés sans identifiant fournisseur.",
      },
    );

    await persistClaimedLogsSentWithoutProviderIds({
      deliveryLogIds,
      provider,
      sentAt,
    });
  }
}

async function markClaimedLogsFailed({
  deliveryLogIds,
  errorCode,
  errorMessage,
  failedAt,
}: {
  deliveryLogIds: readonly string[];
  errorCode: string;
  errorMessage: string;
  failedAt: Date;
}): Promise<void> {
  if (
    deliveryLogIds.length === 0
  ) {
    return;
  }

  await prisma.deliveryLog
    .updateMany({
      where: {
        id: {
          in: [
            ...deliveryLogIds,
          ],
        },

        status:
          DeliveryStatus.PROCESSING,
      },

      data: {
        status:
          DeliveryStatus.FAILED,

        failedAt,

        errorCode:
          errorCode.slice(
            0,
            255,
          ),

        errorMessage:
          errorMessage.slice(
            0,
            2_000,
          ),

        attempts: {
          increment:
            1,
        },

        lastAttemptAt:
          failedAt,
      },
    })
    .catch(
      (
        persistenceError,
      ) => {
        console.error(
          "[DELIVERY_FAILURE_PERSIST_ERROR]",
          {
            deliveryLogIds,

            error:
              persistenceError instanceof Error
                ? {
                    name:
                      persistenceError.name,

                    message:
                      persistenceError.message,
                  }
                : String(
                    persistenceError,
                  ),
          },
        );
      },
    );
}

async function executeDeliveryGroup({
  group,
  forceResend,
  signal,
}: {
  group: DeliveryGroup;
  forceResend: boolean;
  signal?: AbortSignal;
}): Promise<DeliveryExecutionResult> {
  assertNotAborted(
    signal,
  );

  if (
    group.channel ===
    DeliveryChannel.EMAIL
  ) {
    return sendTicketEmail({
      orderId:
        group.orderId,

      forceResend,

      generatedAt:
        new Date(),
    });
  }

  if (
    group.channel ===
    DeliveryChannel.WHATSAPP
  ) {
    return sendTicketWhatsApp({
      orderId:
        group.orderId,

      forceResend,

      generatedAt:
        new Date(),

      signal,
    });
  }

  throw new DeliveryProcessingError(
    `Le canal ${group.channel} n’est pas pris en charge.`,
    "DELIVERY_CHANNEL_NOT_SUPPORTED",
  );
}

async function processOneGroup({
  group,
  maxAttempts,
  forceResend,
  signal,
}: {
  group: DeliveryGroup;
  maxAttempts: number;
  forceResend: boolean;
  signal?: AbortSignal;
}): Promise<ProcessedDeliveryGroup> {
  assertNotAborted(
    signal,
  );

  const claimedAt =
    new Date();

  const deliveryLogIds =
    await claimDeliveryGroup({
      group,
      maxAttempts,
      claimedAt,
    });

  if (
    deliveryLogIds.length === 0
  ) {
    return Object.freeze({
      orderId:
        group.orderId,

      channel:
        group.channel,

      deliveryLogIds:
        Object.freeze([]),

      status:
        "SKIPPED",

      provider:
        null,

      providerMessageIds:
        Object.freeze([]),

      errorCode:
        null,

      errorMessage:
        null,
    });
  }

  try {
    const executionResult =
      await executeDeliveryGroup({
        group,
        forceResend,
        signal,
      });

    const providerMessageIds =
      normalizeProviderMessageIds(
        getProviderMessageIds(
          executionResult,
        ),
      );

    if (
      providerMessageIds.length === 0
    ) {
      throw new DeliveryProcessingError(
        "Le fournisseur n’a retourné aucun identifiant de message.",
        "DELIVERY_PROVIDER_MESSAGE_ID_MISSING",
      );
    }

    const parsedSentAt =
      new Date(
        executionResult.sentAt,
      );

    const sentAt =
      Number.isNaN(
        parsedSentAt.getTime(),
      )
        ? new Date()
        : parsedSentAt;

    await markClaimedLogsSent({
      deliveryLogIds,

      provider:
        executionResult.provider,

      providerMessageIds,

      sentAt,
    });

    return Object.freeze({
      orderId:
        group.orderId,

      channel:
        group.channel,

      deliveryLogIds:
        Object.freeze([
          ...deliveryLogIds,
        ]),

      status:
        "SENT",

      provider:
        executionResult.provider,

      providerMessageIds:
        Object.freeze([
          ...providerMessageIds,
        ]),

      errorCode:
        null,

      errorMessage:
        null,
    });
  } catch (error) {
    const serializedError =
      serializeError(
        error,
      );

    await markClaimedLogsFailed({
      deliveryLogIds,

      errorCode:
        serializedError.code,

      errorMessage:
        serializedError.message,

      failedAt:
        new Date(),
    });

    console.error(
      "[DELIVERY_GROUP_PROCESSING_ERROR]",
      {
        orderId:
          group.orderId,

        channel:
          group.channel,

        deliveryLogIds,

        code:
          serializedError.code,

        message:
          serializedError.message,
      },
    );

    return Object.freeze({
      orderId:
        group.orderId,

      channel:
        group.channel,

      deliveryLogIds:
        Object.freeze([
          ...deliveryLogIds,
        ]),

      status:
        "FAILED",

      provider:
        null,

      providerMessageIds:
        Object.freeze([]),

      errorCode:
        serializedError.code,

      errorMessage:
        serializedError.message,
    });
  }
}

export async function processPendingDeliveries(
  input: ProcessPendingDeliveriesInput = {},
): Promise<ProcessPendingDeliveriesResult> {
  const startedAt =
    new Date();

  const limit =
    normalizeLimit(
      input.limit,
    );

  const maxAttempts =
    normalizeMaxAttempts(
      input.maxAttempts,
    );

  const includeFailed =
    input.includeFailed ??
    true;

  const forceResend =
    input.forceResend ??
    false;

  assertNotAborted(
    input.signal,
  );

  const processableStatuses:
    DeliveryStatus[] =
    includeFailed
      ? [
          DeliveryStatus.PENDING,
          DeliveryStatus.FAILED,
        ]
      : [
          DeliveryStatus.PENDING,
        ];

  const rawCandidates:
    RawDeliveryCandidate[] =
    await prisma.deliveryLog.findMany({
      where: {
        orderId: {
          not:
            null,
        },

        channel: {
          in: [
            DeliveryChannel.EMAIL,
            DeliveryChannel.WHATSAPP,
          ],
        },

        type: {
          in: [
            ...PROCESSABLE_DELIVERY_TYPES,
          ],
        },

        status: {
          in:
            processableStatuses,
        },

        attempts: {
          lt:
            maxAttempts,
        },

        scheduledAt: {
          not:
            null,

          lte:
            startedAt,
        },
      },

      orderBy: [
        {
          scheduledAt:
            "asc",
        },

        {
          createdAt:
            "asc",
        },
      ],

      take:
        limit,

      select: {
        id:
          true,

        orderId:
          true,

        channel:
          true,

        type:
          true,

        status:
          true,

        attempts:
          true,

        scheduledAt:
          true,
      },
    });

  const normalizedCandidates =
    normalizeDeliveryCandidates(
      rawCandidates,
    );

  const candidates =
    normalizedCandidates.valid;

  const groups =
    groupCandidates(
      candidates,
    );

  const results:
    ProcessedDeliveryGroup[] = [];

  for (
    const group of groups
  ) {
    assertNotAborted(
      input.signal,
    );

    const result =
      await processOneGroup({
        group,
        maxAttempts,
        forceResend,

        signal:
          input.signal,
      });

    results.push(
      result,
    );
  }

  const finishedAt =
    new Date();

  const sentGroups =
    results.filter(
      (result) =>
        result.status ===
        "SENT",
    ).length;

  const skippedGroups =
    results.filter(
      (result) =>
        result.status ===
        "SKIPPED",
    ).length;

  const failedGroups =
    results.filter(
      (result) =>
        result.status ===
        "FAILED",
    ).length;

  return Object.freeze({
    startedAt,
    finishedAt,

    durationMs:
      finishedAt.getTime() -
      startedAt.getTime(),

    selectedLogs:
      candidates.length,

    ignoredLogs:
      normalizedCandidates.ignored,

    selectedGroups:
      groups.length,

    processedGroups:
      results.length,

    sentGroups,
    skippedGroups,
    failedGroups,

    results:
      Object.freeze(
        results,
      ),
  });
}