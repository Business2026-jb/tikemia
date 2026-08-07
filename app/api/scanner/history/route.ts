import {
  TicketScanResult,
} from "@prisma/client";
import {
  NextResponse,
} from "next/server";

import {
  getScannerHistory,
} from "@/lib/scanner/get-scanner-history";
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

const DEFAULT_PAGE =
  1;

const DEFAULT_LIMIT =
  30;

const MAX_LIMIT =
  100;

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function readInteger(
  value:
    | string
    | null,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  const normalized =
    normalizeText(
      value,
    );

  if (!normalized) {
    return defaultValue;
  }

  const parsed =
    Number(
      normalized,
    );

  if (
    !Number.isInteger(
      parsed,
    ) ||
    parsed <
      minimum ||
    parsed >
      maximum
  ) {
    throw new ScannerError({
      code:
        "SCANNER_INTERNAL_ERROR",

      message:
        `La valeur doit être un entier compris entre ${minimum} et ${maximum}.`,

      status:
        400,

      retryable:
        false,
    });
  }

  return parsed;
}

function readScanResult(
  value:
    | string
    | null,
): TicketScanResult | null {
  const normalized =
    normalizeText(
      value,
    ).toUpperCase();

  if (!normalized) {
    return null;
  }

  if (
    !Object.values(
      TicketScanResult,
    ).includes(
      normalized as
        TicketScanResult,
    )
  ) {
    throw new ScannerError({
      code:
        "SCANNER_INTERNAL_ERROR",

      message:
        "Le filtre de résultat du scan est invalide.",

      status:
        400,

      retryable:
        false,
    });
  }

  return normalized as
    TicketScanResult;
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

        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

export async function GET(
  request: Request,
): Promise<NextResponse> {
  try {
    const session =
      await requireScanner();

    const url =
      new URL(
        request.url,
      );

    const eventId =
      normalizeText(
        url.searchParams.get(
          "eventId",
        ),
      ) ||
      null;

    const page =
      readInteger(
        url.searchParams.get(
          "page",
        ),
        DEFAULT_PAGE,
        1,
        100_000,
      );

    const limit =
      readInteger(
        url.searchParams.get(
          "limit",
        ),
        DEFAULT_LIMIT,
        1,
        MAX_LIMIT,
      );

    const result =
      readScanResult(
        url.searchParams.get(
          "result",
        ),
      );

    const history =
      await getScannerHistory({
        scannerId:
          session.user.id,

        eventId,

        result,

        page,

        limit,
      });

    return jsonResponse({
      success:
        true,

      message:
        history.items.length > 0
          ? "Historique des scans chargé."
          : "Aucun scan ne correspond aux filtres.",

      items:
        history.items,

      pagination:
        history.pagination,
    });
  } catch (error) {
    console.error(
      "[SCANNER_HISTORY_GET_ERROR]",
      error,
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
