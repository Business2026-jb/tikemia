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
  serializeScannerError,
} from "@/lib/scanner/scanner-errors";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

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

export async function GET():
  Promise<NextResponse> {
  try {
    const session =
      await requireScanner();

    const events =
      await getScannerEvents({
        scannerId:
          session.user.id,
      });

    return jsonResponse({
      success:
        true,

      message:
        events.length > 0
          ? "Événements autorisés chargés."
          : "Aucun événement n’est affecté à ce compte scanner.",

      scanner: {
        id:
          session.user.id,

        firstName:
          session.user.firstName,

        lastName:
          session.user.lastName,

        email:
          session.user.email,
      },

      summary: {
        eventsCount:
          events.length,
      },

      events,
    });
  } catch (error) {
    console.error(
      "[SCANNER_EVENTS_GET_ERROR]",
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
