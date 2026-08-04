import "server-only";

import {
  createHash,
} from "node:crypto";

import {
  PaymentStatus,
  Prisma,
  WebhookProcessingStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  assertValidMonerooWebhookSignature,
} from "@/lib/payments/providers/moneroo/moneroo-signature";
import {
  isRecord,
} from "@/lib/payments/providers/moneroo/moneroo-types";
import {
  verifyMonerooPayment,
} from "@/lib/payments/verify-moneroo-payment";
import {
  completeSuccessfulPayment,
  type CompleteSuccessfulPaymentResult,
} from "@/lib/payments/complete-successful-payment";

const MONEROO_PROVIDER = "MONEROO";
const MAX_PROCESSING_ATTEMPTS = 5;

type JsonRecord = Record<string, unknown>;

export type ProcessMonerooWebhookInput = Readonly<{
  rawBody: string;
  signature: string | null | undefined;
  headers?: Headers | Record<string, string | string[] | undefined>;
}>;

export type ProcessMonerooWebhookResult = Readonly<{
  webhookEventId: string;
  providerEventId: string;
  eventType: string;
  duplicate: boolean;
  paymentId: string | null;
  orderId: string | null;
  paymentStatus: PaymentStatus | null;
  completion: CompleteSuccessfulPaymentResult | null;
}>;

export class MonerooWebhookProcessingError extends Error {
  readonly code: string;
  readonly webhookEventId: string | null;
  readonly causeValue: unknown;

  constructor(
    message: string,
    code: string,
    options: {
      webhookEventId?: string | null;
      cause?: unknown;
    } = {},
  ) {
    super(message, {
      cause: options.cause,
    });

    this.name = "MonerooWebhookProcessingError";
    this.code = code;
    this.webhookEventId =
      options.webhookEventId ?? null;
    this.causeValue = options.cause;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value),
  ) as Prisma.InputJsonValue;
}

function normalizeText(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function readFirstString(
  record: JsonRecord,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = normalizeText(record[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

function readNestedRecord(
  record: JsonRecord,
  keys: readonly string[],
): JsonRecord | null {
  for (const key of keys) {
    const value = record[key];

    if (isRecord(value)) {
      return value;
    }
  }

  return null;
}

function parsePayload(rawBody: string): JsonRecord {
  if (!rawBody.trim()) {
    throw new MonerooWebhookProcessingError(
      "Le corps du webhook Moneroo est vide.",
      "MONEROO_WEBHOOK_BODY_EMPTY",
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch (error) {
    throw new MonerooWebhookProcessingError(
      "Le corps du webhook Moneroo n'est pas un JSON valide.",
      "MONEROO_WEBHOOK_JSON_INVALID",
      {
        cause: error,
      },
    );
  }

  if (!isRecord(parsed)) {
    throw new MonerooWebhookProcessingError(
      "Le contenu du webhook Moneroo est invalide.",
      "MONEROO_WEBHOOK_PAYLOAD_INVALID",
    );
  }

  return parsed;
}

function extractPaymentId(payload: JsonRecord): string | null {
  const data = readNestedRecord(payload, [
    "data",
    "payment",
    "object",
    "resource",
  ]);

  const nestedPayment = data
    ? readNestedRecord(data, [
        "payment",
        "object",
        "resource",
      ])
    : null;

  return (
    (data
      ? readFirstString(data, [
          "payment_id",
          "paymentId",
          "transaction_id",
          "transactionId",
          "id",
        ])
      : null) ??
    (nestedPayment
      ? readFirstString(nestedPayment, [
          "payment_id",
          "paymentId",
          "transaction_id",
          "transactionId",
          "id",
        ])
      : null) ??
    readFirstString(payload, [
      "payment_id",
      "paymentId",
      "transaction_id",
      "transactionId",
    ])
  );
}

function extractEventType(payload: JsonRecord): string {
  return (
    readFirstString(payload, [
      "event",
      "type",
      "name",
      "event_type",
    ]) ??
    "payment.updated"
  );
}

function extractProviderEventId(
  payload: JsonRecord,
  rawBody: string,
  paymentId: string | null,
  eventType: string,
): string {
  const explicitId = readFirstString(payload, [
    "event_id",
    "eventId",
    "webhook_id",
    "webhookId",
    "id",
  ]);

  if (explicitId && explicitId !== paymentId) {
    return explicitId;
  }

  return createHash("sha256")
    .update(
      [
        MONEROO_PROVIDER,
        eventType,
        paymentId ?? "",
        rawBody,
      ].join(":"),
      "utf8",
    )
    .digest("hex");
}

function sanitizeHeaders(
  headers:
    | Headers
    | Record<string, string | string[] | undefined>
    | undefined,
): JsonRecord {
  if (!headers) {
    return {};
  }

  const result: JsonRecord = {};

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      const normalizedKey = key.toLowerCase();

      if (
        normalizedKey === "authorization" ||
        normalizedKey === "cookie"
      ) {
        return;
      }

      result[normalizedKey] = value;
    });

    return result;
  }

  for (const [key, value] of Object.entries(headers)) {
    const normalizedKey = key.toLowerCase();

    if (
      normalizedKey === "authorization" ||
      normalizedKey === "cookie"
    ) {
      continue;
    }

    result[normalizedKey] = Array.isArray(value)
      ? value.join(",")
      : value ?? null;
  }

  return result;
}

async function markWebhookFailed(
  webhookEventId: string,
  error: unknown,
): Promise<void> {
  const message =
    error instanceof Error
      ? error.message
      : "Erreur inconnue pendant le traitement du webhook Moneroo.";

  await prisma.paymentWebhookEvent
    .update({
      where: {
        id: webhookEventId,
      },
      data: {
        status: WebhookProcessingStatus.FAILED,
        failedAt: new Date(),
        lastError: message.slice(0, 2_000),
      },
    })
    .catch(() => undefined);
}

export async function processMonerooWebhook(
  input: ProcessMonerooWebhookInput,
): Promise<ProcessMonerooWebhookResult> {
  assertValidMonerooWebhookSignature(
    input.rawBody,
    input.signature,
  );

  const payload = parsePayload(input.rawBody);
  const paymentIdFromWebhook =
    extractPaymentId(payload);
  const eventType = extractEventType(payload);
  const providerEventId = extractProviderEventId(
    payload,
    input.rawBody,
    paymentIdFromWebhook,
    eventType,
  );
  const now = new Date();

  const webhookEvent =
    await prisma.paymentWebhookEvent.upsert({
      where: {
        provider_providerEventId: {
          provider: MONEROO_PROVIDER,
          providerEventId,
        },
      },
      create: {
        provider: MONEROO_PROVIDER,
        providerEventId,
        eventType,
        payload: toJsonValue(payload),
        headers: toJsonValue(
          sanitizeHeaders(input.headers),
        ),
        signatureVerified: true,
        status:
          WebhookProcessingStatus.PROCESSING,
        processingAttempts: 1,
        receivedAt: now,
        processingStartedAt: now,
      },
      update: {
        eventType,
        payload: toJsonValue(payload),
        headers: toJsonValue(
          sanitizeHeaders(input.headers),
        ),
        signatureVerified: true,
        processingAttempts: {
          increment: 1,
        },
        processingStartedAt: now,
        failedAt: null,
        lastError: null,
      },
      select: {
        id: true,
        status: true,
        processingAttempts: true,
        paymentId: true,
        orderId: true,
      },
    });

  if (
    webhookEvent.status ===
      WebhookProcessingStatus.PROCESSED ||
    webhookEvent.status ===
      WebhookProcessingStatus.IGNORED
  ) {
    return Object.freeze({
      webhookEventId: webhookEvent.id,
      providerEventId,
      eventType,
      duplicate: true,
      paymentId: webhookEvent.paymentId,
      orderId: webhookEvent.orderId,
      paymentStatus: null,
      completion: null,
    });
  }

  if (
    webhookEvent.processingAttempts >
    MAX_PROCESSING_ATTEMPTS
  ) {
    await prisma.paymentWebhookEvent.update({
      where: {
        id: webhookEvent.id,
      },
      data: {
        status: WebhookProcessingStatus.FAILED,
        failedAt: new Date(),
        lastError:
          "Le nombre maximal de tentatives de traitement est dépassé.",
      },
    });

    throw new MonerooWebhookProcessingError(
      "Le nombre maximal de tentatives de traitement du webhook est dépassé.",
      "MONEROO_WEBHOOK_MAX_ATTEMPTS_EXCEEDED",
      {
        webhookEventId: webhookEvent.id,
      },
    );
  }

  try {
    if (!paymentIdFromWebhook) {
      throw new MonerooWebhookProcessingError(
        "L'identifiant du paiement Moneroo est absent du webhook.",
        "MONEROO_WEBHOOK_PAYMENT_ID_MISSING",
        {
          webhookEventId: webhookEvent.id,
        },
      );
    }

    const verified = await verifyMonerooPayment({
      providerTransactionId:
        paymentIdFromWebhook,
    });

    await prisma.paymentWebhookEvent.update({
      where: {
        id: webhookEvent.id,
      },
      data: {
        paymentId: verified.paymentId,
        orderId: verified.orderId,
      },
    });

    let completion:
      | CompleteSuccessfulPaymentResult
      | null = null;

    if (verified.status === PaymentStatus.SUCCESS) {
      completion = await completeSuccessfulPayment({
        paymentId: verified.paymentId,
        providerTransactionId:
          verified.providerTransactionId,
        providerReference:
          verified.providerReference,
        gateway: verified.gateway,
        paymentMethod: verified.paymentMethod,
        paidAt: verified.verifiedAt,
      });
    }

    const ignored =
      verified.status === PaymentStatus.PENDING ||
      verified.status === PaymentStatus.PROCESSING;

    await prisma.paymentWebhookEvent.update({
      where: {
        id: webhookEvent.id,
      },
      data: {
        status: ignored
          ? WebhookProcessingStatus.IGNORED
          : WebhookProcessingStatus.PROCESSED,
        processedAt: new Date(),
        failedAt: null,
        lastError: null,
      },
    });

    return Object.freeze({
      webhookEventId: webhookEvent.id,
      providerEventId,
      eventType,
      duplicate: false,
      paymentId: verified.paymentId,
      orderId: verified.orderId,
      paymentStatus: verified.status,
      completion,
    });
  } catch (error) {
    await markWebhookFailed(
      webhookEvent.id,
      error,
    );

    if (
      error instanceof
      MonerooWebhookProcessingError
    ) {
      throw error;
    }

    throw new MonerooWebhookProcessingError(
      "Impossible de traiter le webhook Moneroo.",
      "MONEROO_WEBHOOK_PROCESSING_FAILED",
      {
        webhookEventId: webhookEvent.id,
        cause: error,
      },
    );
  }
}
