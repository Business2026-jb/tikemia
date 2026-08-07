import {
  timingSafeEqual,
} from "node:crypto";

import { NextResponse } from "next/server";

import {
  DeliveryProcessingError,
  processPendingDeliveries,
} from "@/lib/delivery/process-pending-deliveries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_MAX_ATTEMPTS = 5;
const MAX_MAX_ATTEMPTS = 20;

class UnauthorizedDeliveryCronError extends Error {
  constructor() {
    super(
      "Accès non autorisé.",
    );

    this.name =
      "UnauthorizedDeliveryCronError";

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }
}

class DeliveryCronConfigurationError extends Error {
  constructor(message: string) {
    super(message);

    this.name =
      "DeliveryCronConfigurationError";

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }
}

class InvalidDeliveryCronParameterError extends Error {
  constructor(message: string) {
    super(message);

    this.name =
      "InvalidDeliveryCronParameterError";

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }
}

type SerializedError = Readonly<{
  name: string;
  message: string;
  code: string | null;
  meta: unknown;
  stack: string | null;
}>;

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

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readOptionalStringProperty(
  value: unknown,
  propertyName: string,
): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const propertyValue =
    value[propertyName];

  if (
    typeof propertyValue !==
    "string"
  ) {
    return null;
  }

  const normalizedValue =
    propertyValue.trim();

  return normalizedValue || null;
}

function readUnknownProperty(
  value: unknown,
  propertyName: string,
): unknown {
  if (!isRecord(value)) {
    return null;
  }

  return value[propertyName] ?? null;
}

function serializeError(
  error: unknown,
): SerializedError {
  const name =
    error instanceof Error
      ? error.name
      : readOptionalStringProperty(
          error,
          "name",
        ) ?? "UnknownError";

  const message =
    error instanceof Error
      ? error.message
      : readOptionalStringProperty(
          error,
          "message",
        ) ?? String(error);

  const code =
    readOptionalStringProperty(
      error,
      "code",
    );

  const meta =
    readUnknownProperty(
      error,
      "meta",
    );

  const stack =
    error instanceof Error &&
    typeof error.stack ===
      "string"
      ? error.stack
      : null;

  return {
    name,
    message,
    code,
    meta,
    stack,
  };
}

function isDebugErrorResponseEnabled():
  boolean {
  const value =
    normalizeText(
      process.env
        .DELIVERY_CRON_DEBUG_ERRORS,
    ).toLowerCase();

  return (
    value === "true" ||
    value === "1" ||
    value === "yes"
  );
}

function secureTextEquals(
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

function getConfiguredCronSecret():
  string {
  const secret =
    normalizeText(
      process.env
        .DELIVERY_PROCESSING_CRON_SECRET,
    ) ||
    normalizeText(
      process.env
        .CRON_SECRET,
    );

  if (!secret) {
    throw new DeliveryCronConfigurationError(
      "Le secret du cron de livraison n’est pas configuré.",
    );
  }

  if (secret.length < 32) {
    throw new DeliveryCronConfigurationError(
      "Le secret du cron de livraison est trop court.",
    );
  }

  return secret;
}

function readBearerToken(
  request: Request,
): string {
  const authorization =
    normalizeText(
      request.headers.get(
        "authorization",
      ),
    );

  if (
    !authorization
      .toLowerCase()
      .startsWith("bearer ")
  ) {
    return "";
  }

  return authorization
    .slice(7)
    .trim();
}

function getSuppliedSecret(
  request: Request,
): string {
  const url =
    new URL(
      request.url,
    );

  return (
    readBearerToken(
      request,
    ) ||
    normalizeText(
      request.headers.get(
        "x-cron-secret",
      ),
    ) ||
    normalizeText(
      url.searchParams.get(
        "secret",
      ),
    )
  );
}

function assertAuthorized(
  request: Request,
): void {
  const configuredSecret =
    getConfiguredCronSecret();

  const suppliedSecret =
    getSuppliedSecret(
      request,
    );

  if (
    !suppliedSecret ||
    !secureTextEquals(
      suppliedSecret,
      configuredSecret,
    )
  ) {
    throw new UnauthorizedDeliveryCronError();
  }
}

function readIntegerParameter({
  request,
  name,
  defaultValue,
  minimum,
  maximum,
}: {
  request: Request;
  name: string;
  defaultValue: number;
  minimum: number;
  maximum: number;
}): number {
  const url =
    new URL(
      request.url,
    );

  const rawValue =
    normalizeText(
      url.searchParams.get(
        name,
      ),
    );

  if (!rawValue) {
    return defaultValue;
  }

  const parsedValue =
    Number(
      rawValue,
    );

  if (
    !Number.isInteger(
      parsedValue,
    ) ||
    parsedValue < minimum ||
    parsedValue > maximum
  ) {
    throw new InvalidDeliveryCronParameterError(
      `${name} doit être un entier compris entre ${minimum} et ${maximum}.`,
    );
  }

  return parsedValue;
}

function readBooleanParameter({
  request,
  name,
  defaultValue,
}: {
  request: Request;
  name: string;
  defaultValue: boolean;
}): boolean {
  const url =
    new URL(
      request.url,
    );

  const rawValue =
    normalizeText(
      url.searchParams.get(
        name,
      ),
    ).toLowerCase();

  if (!rawValue) {
    return defaultValue;
  }

  if (
    rawValue === "true" ||
    rawValue === "1"
  ) {
    return true;
  }

  if (
    rawValue === "false" ||
    rawValue === "0"
  ) {
    return false;
  }

  throw new InvalidDeliveryCronParameterError(
    `${name} doit être true, false, 1 ou 0.`,
  );
}

async function handleDeliveryProcessing(
  request: Request,
): Promise<NextResponse> {
  const requestStartedAt =
    new Date();

  try {
    assertAuthorized(
      request,
    );

    const limit =
      readIntegerParameter({
        request,
        name:
          "limit",

        defaultValue:
          DEFAULT_LIMIT,

        minimum:
          1,

        maximum:
          MAX_LIMIT,
      });

    const maxAttempts =
      readIntegerParameter({
        request,
        name:
          "maxAttempts",

        defaultValue:
          DEFAULT_MAX_ATTEMPTS,

        minimum:
          1,

        maximum:
          MAX_MAX_ATTEMPTS,
      });

    const includeFailed =
      readBooleanParameter({
        request,
        name:
          "includeFailed",

        defaultValue:
          true,
      });

    const forceResend =
      readBooleanParameter({
        request,
        name:
          "forceResend",

        defaultValue:
          false,
      });

    const result =
      await processPendingDeliveries({
        limit,
        maxAttempts,
        includeFailed,
        forceResend,

        signal:
          request.signal,
      });

    return jsonResponse({
      success:
        true,

      message:
        result.failedGroups > 0
          ? "Le traitement est terminé, mais certaines livraisons ont échoué."
          : "Le traitement des livraisons est terminé.",

      processing: {
        startedAt:
          result.startedAt.toISOString(),

        finishedAt:
          result.finishedAt.toISOString(),

        durationMs:
          result.durationMs,

        selectedLogs:
          result.selectedLogs,

        ignoredLogs:
          result.ignoredLogs,

        selectedGroups:
          result.selectedGroups,

        processedGroups:
          result.processedGroups,

        sentGroups:
          result.sentGroups,

        skippedGroups:
          result.skippedGroups,

        failedGroups:
          result.failedGroups,

        results:
          result.results,
      },
    });
  } catch (error) {
    if (
      error instanceof
      UnauthorizedDeliveryCronError
    ) {
      return jsonResponse(
        {
          success:
            false,

          error: {
            code:
              "DELIVERY_CRON_UNAUTHORIZED",

            message:
              "Accès non autorisé.",
          },
        },
        401,
      );
    }

    if (
      error instanceof
      InvalidDeliveryCronParameterError
    ) {
      return jsonResponse(
        {
          success:
            false,

          error: {
            code:
              "DELIVERY_CRON_PARAMETER_INVALID",

            message:
              error.message,
          },
        },
        400,
      );
    }

    if (
      error instanceof
      DeliveryCronConfigurationError
    ) {
      console.error(
        "[DELIVERY_PROCESSING_CRON_CONFIGURATION_ERROR]",
        {
          name:
            error.name,

          message:
            error.message,

          requestStartedAt:
            requestStartedAt.toISOString(),
        },
      );

      return jsonResponse(
        {
          success:
            false,

          error: {
            code:
              "DELIVERY_CRON_CONFIGURATION_ERROR",

            message:
              isDebugErrorResponseEnabled()
                ? error.message
                : "La configuration du traitement des livraisons est incomplète.",
          },
        },
        500,
      );
    }

    if (
      error instanceof
      DeliveryProcessingError
    ) {
      const serializedError =
        serializeError(
          error,
        );

      console.error(
        "[DELIVERY_PROCESSING_CRON_ERROR]",
        {
          ...serializedError,

          requestStartedAt:
            requestStartedAt.toISOString(),
        },
      );

      return jsonResponse(
        {
          success:
            false,

          error: {
            code:
              error.code,

            message:
              error.message,

            ...(isDebugErrorResponseEnabled()
              ? {
                  debug: {
                    name:
                      serializedError.name,

                    code:
                      serializedError.code,

                    meta:
                      serializedError.meta,

                    stack:
                      serializedError.stack,
                  },
                }
              : {}),
          },
        },
        500,
      );
    }

    const serializedError =
      serializeError(
        error,
      );

    console.error(
      "[DELIVERY_PROCESSING_CRON_ERROR]",
      {
        ...serializedError,

        requestStartedAt:
          requestStartedAt.toISOString(),
      },
    );

    const debugEnabled =
      isDebugErrorResponseEnabled();

    return jsonResponse(
      {
        success:
          false,

        error: {
          code:
            serializedError.code ??
            "DELIVERY_PROCESSING_CRON_FAILED",

          message:
            debugEnabled
              ? serializedError.message
              : "Impossible de traiter les livraisons pour le moment.",

          ...(debugEnabled
            ? {
                debug: {
                  name:
                    serializedError.name,

                  originalCode:
                    serializedError.code,

                  meta:
                    serializedError.meta,

                  stack:
                    serializedError.stack,
                },
              }
            : {}),
        },
      },
      500,
    );
  }
}

export async function GET(
  request: Request,
): Promise<NextResponse> {
  return handleDeliveryProcessing(
    request,
  );
}

export async function POST(
  request: Request,
): Promise<NextResponse> {
  return handleDeliveryProcessing(
    request,
  );
}