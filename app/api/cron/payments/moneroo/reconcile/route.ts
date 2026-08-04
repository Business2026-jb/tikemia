import {
  timingSafeEqual,
} from "node:crypto";

import { NextResponse } from "next/server";

import {
  MonerooReconciliationError,
  reconcileMonerooPayments,
} from "@/lib/payments/reconcile-moneroo-payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 100;
const DEFAULT_MINIMUM_AGE_MS = 60_000;

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options":
        "nosniff",
    },
  });
}

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function secureTextEquals(
  left: string,
  right: string,
): boolean {
  const leftBuffer = Buffer.from(
    left,
    "utf8",
  );

  const rightBuffer = Buffer.from(
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

function getConfiguredCronSecret(): string {
  const secret =
    normalizeText(
      process.env
        .MONEROO_RECONCILIATION_CRON_SECRET,
    ) ||
    normalizeText(
      process.env.CRON_SECRET,
    );

  if (!secret) {
    throw new Error(
      "Le secret du cron Moneroo n’est pas configuré.",
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

function readRequestSecret(
  request: Request,
): string {
  const url = new URL(
    request.url,
  );

  return (
    readBearerToken(request) ||
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
    readRequestSecret(request);

  if (
    !suppliedSecret ||
    !secureTextEquals(
      suppliedSecret,
      configuredSecret,
    )
  ) {
    throw new UnauthorizedCronRequestError();
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
  const url = new URL(
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
    Number(rawValue);

  if (
    !Number.isInteger(
      parsedValue,
    ) ||
    parsedValue < minimum ||
    parsedValue > maximum
  ) {
    throw new InvalidCronParameterError(
      `${name} doit être un entier compris entre ${minimum} et ${maximum}.`,
    );
  }

  return parsedValue;
}

class UnauthorizedCronRequestError extends Error {
  constructor() {
    super(
      "Accès non autorisé.",
    );

    this.name =
      "UnauthorizedCronRequestError";

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }
}

class InvalidCronParameterError extends Error {
  constructor(
    message: string,
  ) {
    super(message);

    this.name =
      "InvalidCronParameterError";

    Object.setPrototypeOf(
      this,
      new.target.prototype,
    );
  }
}

async function handleReconciliation(
  request: Request,
) {
  const requestStartedAt =
    new Date();

  try {
    assertAuthorized(
      request,
    );

    const limit =
      readIntegerParameter({
        request,
        name: "limit",
        defaultValue:
          DEFAULT_BATCH_SIZE,
        minimum: 1,
        maximum:
          MAX_BATCH_SIZE,
      });

    const minimumAgeMs =
      readIntegerParameter({
        request,
        name:
          "minimumAgeMs",
        defaultValue:
          DEFAULT_MINIMUM_AGE_MS,
        minimum: 0,
        maximum:
          24 * 60 * 60 * 1_000,
      });

    const result =
      await reconcileMonerooPayments({
        limit,
        minimumAgeMs,
        signal:
          request.signal,
      });

    return jsonResponse({
      success: true,
      message:
        "La réconciliation Moneroo est terminée.",
      reconciliation: {
        startedAt:
          result.startedAt.toISOString(),
        finishedAt:
          result.finishedAt.toISOString(),
        durationMs:
          result.durationMs,
        selected:
          result.selected,
        processed:
          result.processed,
        completed:
          result.completed,
        updated:
          result.updated,
        unchanged:
          result.unchanged,
        skipped:
          result.skipped,
        failed:
          result.failed,
        results:
          result.results,
      },
    });
  } catch (error) {
    if (
      error instanceof
      UnauthorizedCronRequestError
    ) {
      return jsonResponse(
        {
          success: false,
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
      InvalidCronParameterError
    ) {
      return jsonResponse(
        {
          success: false,
          error: {
            code:
              "CRON_INVALID_PARAMETER",
            message:
              error.message,
          },
        },
        400,
      );
    }

    if (
      error instanceof
      MonerooReconciliationError
    ) {
      console.error(
        "[MONEROO_RECONCILIATION_CRON_ERROR]",
        {
          name:
            error.name,
          code:
            error.code,
          message:
            error.message,
          requestStartedAt:
            requestStartedAt.toISOString(),
        },
      );

      return jsonResponse(
        {
          success: false,
          error: {
            code:
              error.code,
            message:
              error.message,
          },
        },
        500,
      );
    }

    console.error(
      "[MONEROO_RECONCILIATION_CRON_ERROR]",
      {
        name:
          error instanceof Error
            ? error.name
            : "UnknownError",
        message:
          error instanceof Error
            ? error.message
            : String(error),
        requestStartedAt:
          requestStartedAt.toISOString(),
      },
    );

    return jsonResponse(
      {
        success: false,
        error: {
          code:
            "MONEROO_RECONCILIATION_CRON_FAILED",
          message:
            "Impossible d’exécuter la réconciliation Moneroo pour le moment.",
        },
      },
      500,
    );
  }
}

export async function GET(
  request: Request,
) {
  return handleReconciliation(
    request,
  );
}

export async function POST(
  request: Request,
) {
  return handleReconciliation(
    request,
  );
}
