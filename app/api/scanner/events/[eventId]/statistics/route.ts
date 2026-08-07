import {
  NextResponse,
} from "next/server";

import {
  getScannerEvents,
} from "@/lib/scanner/get-scanner-events";
import {
  requireScanner,
} from "@/lib/scanner/require-scanner";
import {
  ScannerError,
  serializeScannerError,
} from "@/lib/scanner/scanner-errors";
import {
  assertScannerCanAccessEvent,
} from "@/lib/scanner/scanner-permissions";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

type ScannerEventStatisticsRouteProps = {
  params: Promise<{
    eventId: string;
  }>;
};

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
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
  _request: Request,
  {
    params,
  }: ScannerEventStatisticsRouteProps,
): Promise<NextResponse> {
  try {
    const session =
      await requireScanner();

    const {
      eventId: rawEventId,
    } =
      await params;

    const eventId =
      normalizeText(
        rawEventId,
      );

    if (!eventId) {
      throw new ScannerError({
        code:
          "SCANNER_EVENT_NOT_FOUND",

        message:
          "L’identifiant de l’événement est obligatoire.",

        status:
          400,

        retryable:
          false,
      });
    }

    await assertScannerCanAccessEvent({
      scannerId:
        session.user.id,

      eventId,

      allowCompletedEvent:
        true,
    });

    const events =
      await getScannerEvents({
        scannerId:
          session.user.id,
      });

    const event =
      events.find(
        (
          item,
        ) =>
          item.event.id ===
          eventId,
      );

    if (!event) {
      throw new ScannerError({
        code:
          "SCANNER_EVENT_NOT_FOUND",

        message:
          "Les statistiques de cet événement sont indisponibles.",

        status:
          404,

        retryable:
          false,

        details: {
          eventId,
        },
      });
    }

    return jsonResponse({
      success:
        true,

      message:
        "Statistiques du contrôle d’accès chargées.",

      event: {
        id:
          event.event.id,

        title:
          event.event.title,

        gateName:
          event.gateName,
      },

      statistics:
        event.statistics,
    });
  } catch (error) {
    console.error(
      "[SCANNER_EVENT_STATISTICS_GET_ERROR]",
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
