import "server-only";

import { NextResponse } from "next/server";

import {
  MonerooWebhookProcessingError,
  processMonerooWebhook,
} from "@/lib/payments/process-moneroo-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_WEBHOOK_BODY_BYTES =
  1 * 1024 * 1024;

type WebhookErrorDetails = Readonly<{
  name: string;
  code: string | null;
  message: string;
}>;

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,

    headers: {
      "Cache-Control":
        "no-store, max-age=0",

      Pragma:
        "no-cache",

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

function getWebhookSignature(
  request: Request,
): string {
  return (
    normalizeText(
      request.headers.get(
        "x-moneroo-signature",
      ),
    ) ||
    normalizeText(
      request.headers.get(
        "X-Moneroo-Signature",
      ),
    )
  );
}

function getContentLength(
  request: Request,
): number | null {
  const rawValue =
    normalizeText(
      request.headers.get(
        "content-length",
      ),
    );

  if (!rawValue) {
    return null;
  }

  const parsedValue =
    Number(rawValue);

  if (
    !Number.isSafeInteger(
      parsedValue,
    ) ||
    parsedValue < 0
  ) {
    return null;
  }

  return parsedValue;
}

function getBodySizeInBytes(
  rawBody: string,
): number {
  return Buffer.byteLength(
    rawBody,
    "utf8",
  );
}

function sanitizeHeaders(
  request: Request,
): Record<string, string> {
  const headers:
    Record<string, string> = {};

  request.headers.forEach(
    (value, key) => {
      const normalizedKey =
        key.toLowerCase();

      if (
        normalizedKey ===
          "authorization" ||
        normalizedKey ===
          "cookie"
      ) {
        return;
      }

      headers[normalizedKey] =
        value;
    },
  );

  return headers;
}

function getErrorDetails(
  error: unknown,
): WebhookErrorDetails {
  if (
    error instanceof
    MonerooWebhookProcessingError
  ) {
    return {
      name:
        error.name,

      code:
        error.code,

      message:
        error.message,
    };
  }

  if (error instanceof Error) {
    const possibleCode =
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : null;

    return {
      name:
        error.name,

      code:
        possibleCode,

      message:
        error.message,
    };
  }

  return {
    name:
      "UnknownError",

    code:
      null,

    message:
      "Une erreur inconnue est survenue.",
  };
}

function isSignatureError(
  error: unknown,
): boolean {
  const details =
    getErrorDetails(error);

  const normalizedCode =
    details.code
      ?.trim()
      .toUpperCase() ?? "";

  const normalizedMessage =
    details.message
      .trim()
      .toLowerCase();

  return (
    normalizedCode.includes(
      "SIGNATURE",
    ) ||
    normalizedCode.includes(
      "WEBHOOK_SECRET",
    ) ||
    normalizedMessage.includes(
      "signature",
    )
  );
}

function isInvalidPayloadError(
  error: unknown,
): boolean {
  const details =
    getErrorDetails(error);

  const normalizedCode =
    details.code
      ?.trim()
      .toUpperCase() ?? "";

  return (
    normalizedCode.includes(
      "BODY_EMPTY",
    ) ||
    normalizedCode.includes(
      "JSON_INVALID",
    ) ||
    normalizedCode.includes(
      "PAYLOAD_INVALID",
    ) ||
    normalizedCode.includes(
      "PAYMENT_ID_MISSING",
    )
  );
}

function isAlreadyProcessedResult(
  duplicate: boolean,
): string {
  return duplicate
    ? "Le webhook Moneroo avait déjà été traité."
    : "Le webhook Moneroo a été traité.";
}

export async function POST(
  request: Request,
): Promise<NextResponse> {
  const receivedAt =
    new Date();

  const contentLength =
    getContentLength(request);

  if (
    contentLength !== null &&
    contentLength >
      MAX_WEBHOOK_BODY_BYTES
  ) {
    return jsonResponse(
      {
        success: false,

        error: {
          code:
            "MONEROO_WEBHOOK_BODY_TOO_LARGE",

          message:
            "Le contenu du webhook est trop volumineux.",
        },
      },
      413,
    );
  }

  const signature =
    getWebhookSignature(request);

  if (!signature) {
    return jsonResponse(
      {
        success: false,

        error: {
          code:
            "MONEROO_WEBHOOK_SIGNATURE_MISSING",

          message:
            "La signature du webhook Moneroo est absente.",
        },
      },
      403,
    );
  }

  let rawBody: string;

  try {
    /*
     * La signature Moneroo doit être vérifiée sur le corps brut exact.
     * Il ne faut donc pas appeler request.json() avant cette étape.
     */
    rawBody =
      await request.text();
  } catch (error) {
    console.error(
      "[MONEROO_WEBHOOK_BODY_READ_ERROR]",
      {
        receivedAt:
          receivedAt.toISOString(),

        error:
          getErrorDetails(error),
      },
    );

    return jsonResponse(
      {
        success: false,

        error: {
          code:
            "MONEROO_WEBHOOK_BODY_READ_FAILED",

          message:
            "Impossible de lire le contenu du webhook.",
        },
      },
      400,
    );
  }

  const bodySize =
    getBodySizeInBytes(
      rawBody,
    );

  if (bodySize === 0) {
    return jsonResponse(
      {
        success: false,

        error: {
          code:
            "MONEROO_WEBHOOK_BODY_EMPTY",

          message:
            "Le contenu du webhook Moneroo est vide.",
        },
      },
      400,
    );
  }

  if (
    bodySize >
    MAX_WEBHOOK_BODY_BYTES
  ) {
    return jsonResponse(
      {
        success: false,

        error: {
          code:
            "MONEROO_WEBHOOK_BODY_TOO_LARGE",

          message:
            "Le contenu du webhook est trop volumineux.",
        },
      },
      413,
    );
  }

  try {
    const result =
      await processMonerooWebhook({
        rawBody,

        signature,

        headers:
          sanitizeHeaders(
            request,
          ),
      });

    return jsonResponse({
      success: true,

      message:
        isAlreadyProcessedResult(
          result.duplicate,
        ),

      webhook: {
        id:
          result.webhookEventId,

        providerEventId:
          result.providerEventId,

        eventType:
          result.eventType,

        duplicate:
          result.duplicate,

        receivedAt:
          receivedAt.toISOString(),
      },

      payment: {
        id:
          result.paymentId,

        orderId:
          result.orderId,

        status:
          result.paymentStatus,
      },

      completion:
        result.completion,
    });
  } catch (error) {
    const details =
      getErrorDetails(error);

    const webhookEventId =
      error instanceof
      MonerooWebhookProcessingError
        ? error.webhookEventId
        : null;

    if (isSignatureError(error)) {
      console.warn(
        "[MONEROO_WEBHOOK_SIGNATURE_REJECTED]",
        {
          code:
            details.code,

          message:
            details.message,

          bodySize,

          receivedAt:
            receivedAt.toISOString(),
        },
      );

      return jsonResponse(
        {
          success: false,

          error: {
            code:
              details.code ??
              "MONEROO_WEBHOOK_SIGNATURE_INVALID",

            message:
              "La signature du webhook Moneroo est invalide.",
          },
        },
        403,
      );
    }

    if (
      isInvalidPayloadError(
        error,
      )
    ) {
      console.warn(
        "[MONEROO_WEBHOOK_PAYLOAD_REJECTED]",
        {
          webhookEventId,

          code:
            details.code,

          message:
            details.message,

          bodySize,

          receivedAt:
            receivedAt.toISOString(),
        },
      );

      return jsonResponse(
        {
          success: false,

          error: {
            code:
              details.code ??
              "MONEROO_WEBHOOK_PAYLOAD_INVALID",

            message:
              details.message,
          },
        },
        400,
      );
    }

    console.error(
      "[MONEROO_WEBHOOK_PROCESSING_ERROR]",
      {
        webhookEventId,

        name:
          details.name,

        code:
          details.code,

        message:
          details.message,

        bodySize,

        receivedAt:
          receivedAt.toISOString(),
      },
    );

    /*
     * Une réponse 500 permet à Moneroo de considérer que le traitement
     * n’est pas terminé et de réessayer selon sa politique de livraison.
     */
    return jsonResponse(
      {
        success: false,

        error: {
          code:
            details.code ??
            "MONEROO_WEBHOOK_PROCESSING_FAILED",

          message:
            "Impossible de traiter le webhook Moneroo pour le moment.",
        },
      },
      500,
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return jsonResponse(
    {
      success: false,

      error: {
        code:
          "METHOD_NOT_ALLOWED",

        message:
          "Cette route accepte uniquement les requêtes POST de Moneroo.",
      },
    },
    405,
  );
}