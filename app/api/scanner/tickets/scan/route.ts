import {
  Prisma,
} from "@prisma/client";
import {
  NextResponse,
} from "next/server";
import {
  z,
} from "zod";

import {
  completeTicketScan,
} from "@/lib/scanner/complete-ticket-scan";
import {
  requireScanner,
} from "@/lib/scanner/require-scanner";
import {
  ScannerError,
  serializeScannerError,
} from "@/lib/scanner/scanner-errors";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export const maxDuration =
  30;

const optionalText =
  z.string()
    .trim()
    .max(
      500,
      "La valeur est trop longue.",
    )
    .nullable()
    .optional();

const requestSchema =
  z.object({
    eventId:
      z.string()
        .trim()
        .min(
          1,
          "L’identifiant de l’événement est obligatoire.",
        )
        .max(
          191,
          "L’identifiant de l’événement est invalide.",
        ),

    qrValue:
      z.string()
        .trim()
        .min(
          1,
          "Le QR code ou le code du billet est obligatoire.",
        )
        .max(
          10_000,
          "La valeur du QR code est trop longue.",
        ),

    deviceId:
      optionalText,

    deviceName:
      optionalText,

    gateName:
      optionalText,

    latitude:
      z.number()
        .finite()
        .min(
          -90,
          "La latitude est invalide.",
        )
        .max(
          90,
          "La latitude est invalide.",
        )
        .nullable()
        .optional(),

    longitude:
      z.number()
        .finite()
        .min(
          -180,
          "La longitude est invalide.",
        )
        .max(
          180,
          "La longitude est invalide.",
        )
        .nullable()
        .optional(),

    metadata:
      z.record(
        z.string(),
        z.unknown(),
      )
        .nullable()
        .optional(),
  })
    .strict();

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function getClientIpAddress(
  request: Request,
): string | null {
  const forwardedFor =
    normalizeText(
      request.headers.get(
        "x-forwarded-for",
      ),
    );

  if (forwardedFor) {
    return (
      forwardedFor
        .split(
          ",",
        )[0]
        ?.trim() ||
      null
    );
  }

  return (
    normalizeText(
      request.headers.get(
        "x-real-ip",
      ),
    ) ||
    normalizeText(
      request.headers.get(
        "cf-connecting-ip",
      ),
    ) ||
    null
  );
}

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

        "Content-Type":
          "application/json; charset=utf-8",

        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

async function readJsonBody(
  request: Request,
): Promise<unknown> {
  const contentType =
    request.headers.get(
      "content-type",
    ) ??
    "";

  if (
    !contentType
      .toLowerCase()
      .includes(
        "application/json",
      )
  ) {
    throw new ScannerError({
      code:
        "SCANNER_QR_INVALID",

      message:
        "Le format de la requête est invalide.",

      status:
        415,

      retryable:
        false,
    });
  }

  try {
    return await request.json();
  } catch {
    throw new ScannerError({
      code:
        "SCANNER_QR_INVALID",

      message:
        "Le corps de la requête JSON est invalide.",

      status:
        400,

      retryable:
        false,
    });
  }
}

function toPrismaJsonValue(
  value: unknown,
): Prisma.InputJsonValue | undefined {
  if (
    value === undefined ||
    value === null
  ) {
    return undefined;
  }

  if (
    typeof value ===
      "string" ||
    typeof value ===
      "boolean"
  ) {
    return value;
  }

  if (
    typeof value ===
    "number"
  ) {
    return Number.isFinite(
      value,
    )
      ? value
      : undefined;
  }

  if (
    Array.isArray(
      value,
    )
  ) {
    const items:
      Prisma.InputJsonValue[] =
      [];

    for (
      const item of value
    ) {
      const normalizedItem =
        toPrismaJsonValue(
          item,
        );

      if (
        normalizedItem !==
        undefined
      ) {
        items.push(
          normalizedItem,
        );
      }
    }

    return items;
  }

  if (
    typeof value ===
    "object"
  ) {
    const objectValue:
      Record<
        string,
        Prisma.InputJsonValue
      > =
      {};

    for (
      const [
        key,
        item,
      ] of Object.entries(
        value,
      )
    ) {
      const normalizedItem =
        toPrismaJsonValue(
          item,
        );

      if (
        normalizedItem !==
        undefined
      ) {
        objectValue[key] =
          normalizedItem;
      }
    }

    return objectValue;
  }

  return undefined;
}

export async function POST(
  request: Request,
): Promise<NextResponse> {
  try {
    const session =
      await requireScanner();

    const body =
      await readJsonBody(
        request,
      );

    const parsed =
      requestSchema.safeParse(
        body,
      );

    if (
      !parsed.success
    ) {
      throw new ScannerError({
        code:
          "SCANNER_QR_INVALID",

        message:
          parsed.error
            .issues[0]
            ?.message ??
          "Les informations du scan sont invalides.",

        status:
          400,

        retryable:
          false,

        details: {
          fields:
            parsed.error
              .flatten()
              .fieldErrors,
        },
      });
    }

    const metadata:
      Prisma.InputJsonValue
      | null
      | undefined =
      parsed.data.metadata ===
      null
        ? null
        : toPrismaJsonValue(
            parsed.data.metadata,
          );

    const scan =
      await completeTicketScan({
        scannerId:
          session.user.id,

        eventId:
          parsed.data.eventId,

        qrValue:
          parsed.data.qrValue,

        deviceId:
          parsed.data.deviceId,

        deviceName:
          parsed.data.deviceName,

        gateName:
          parsed.data.gateName,

        ipAddress:
          getClientIpAddress(
            request,
          ),

        userAgent:
          normalizeText(
            request.headers.get(
              "user-agent",
            ),
          ) ||
          null,

        latitude:
          parsed.data.latitude,

        longitude:
          parsed.data.longitude,

        metadata,
      });

    return jsonResponse(
      {
        success:
          true,

        message:
          scan.message,

        scan,
      },
      200,
    );
  } catch (
    error
  ) {
    console.error(
      "[SCANNER_TICKET_SCAN_ERROR]",
      error instanceof Error
        ? {
            name:
              error.name,

            message:
              error.message,

            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    const serialized =
      serializeScannerError(
        error,
      );

    return jsonResponse(
      {
        success:
          false,

        error: {
          code:
            serialized.code,

          message:
            serialized.message,

          retryable:
            serialized.retryable,

          details:
            serialized.details,
        },
      },
      serialized.status,
    );
  }
}