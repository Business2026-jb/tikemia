import {
  timingSafeEqual,
} from "node:crypto";

import {
  NextResponse,
} from "next/server";

import {
  processEmailDeliveries,
} from "@/lib/deliveries/process-email-deliveries";
import {
  getPaymentError,
  getPaymentErrorLogContext,
} from "@/lib/payments/payment-errors";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  60;

const DEFAULT_LIMIT =
  20;

const MAX_LIMIT =
  100;

const DEFAULT_MAX_ATTEMPTS =
  5;

const DEFAULT_STALE_PROCESSING_MINUTES =
  15;

type JsonRecord =
  Record<string, unknown>;

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
      "CRON_SECRET est absent.",
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

  return (
    normalizeText(
      request.headers.get(
        "x-cron-secret",
      ),
    ) ||
    normalizeText(
      new URL(
        request.url,
      ).searchParams.get(
        "secret",
      ),
    )
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

    const maxAttempts =
      parsePositiveInteger({
        value:
          url.searchParams.get(
            "maxAttempts",
          ),

        fallback:
          DEFAULT_MAX_ATTEMPTS,

        maximum:
          20,
      });

    const staleProcessingMinutes =
      parsePositiveInteger({
        value:
          url.searchParams.get(
            "staleProcessingMinutes",
          ),

        fallback:
          DEFAULT_STALE_PROCESSING_MINUTES,

        maximum:
          180,
      });

    const orderId =
      normalizeText(
        url.searchParams.get(
          "orderId",
        ),
      ) ||
      undefined;

    const forceResend =
      url.searchParams.get(
        "forceResend",
      ) ===
      "true";

    const result =
      await processEmailDeliveries({
        limit,

        maxAttempts,

        staleProcessingMinutes,

        orderId,

        forceResend,
      });

    return jsonResponse({
      success:
        true,

      durationMs:
        Date.now() -
        startedAt,

      result,
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

    const paymentError =
      getPaymentError(
        error,
        {
          code:
            "PAYMENT_INTERNAL_ERROR",

          message:
            "Impossible de traiter les livraisons e-mail.",

          status:
            500,

          exposeMessage:
            false,
        },
      );

    console.error(
      "[CRON_EMAIL_DELIVERIES_ERROR]",
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
              : "Le traitement des livraisons e-mail a échoué.",
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