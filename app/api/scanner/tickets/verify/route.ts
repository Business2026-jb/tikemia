import {
  NextResponse,
} from "next/server";
import {
  z,
} from "zod";

import {
  requireScanner,
} from "@/lib/scanner/require-scanner";
import {
  ScannerError,
  serializeScannerError,
} from "@/lib/scanner/scanner-errors";
import {
  verifyTicketForScan,
} from "@/lib/scanner/verify-ticket-for-scan";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

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
  });

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

async function readJsonBody(
  request: Request,
): Promise<unknown> {
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

    if (!parsed.success) {
      throw new ScannerError({
        code:
          "SCANNER_QR_INVALID",

        message:
          parsed.error.issues[0]
            ?.message ??
          "Les informations du billet sont invalides.",

        status:
          400,

        retryable:
          false,

        details: {
          fields:
            parsed.error.flatten()
              .fieldErrors,
        },
      });
    }

    const verification =
      await verifyTicketForScan({
        scannerId:
          session.user.id,

        eventId:
          parsed.data.eventId,

        qrValue:
          parsed.data.qrValue,
      });

    return jsonResponse({
      success:
        true,

      message:
        verification.message,

      verification,
    });
  } catch (error) {
    console.error(
      "[SCANNER_TICKET_VERIFY_ERROR]",
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
