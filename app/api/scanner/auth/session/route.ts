import {
  NextResponse,
} from "next/server";

import {
  getScannerSession,
} from "@/lib/scanner/get-scanner-session";

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

        "Referrer-Policy":
          "same-origin",
      },
    },
  );
}

export async function GET():
  Promise<NextResponse> {
  try {
    const session =
      await getScannerSession();

    if (!session) {
      return jsonResponse(
        {
          success:
            false,

          authenticated:
            false,

          error: {
            code:
              "SCANNER_UNAUTHENTICATED",

            message:
              "Aucune session scanner active.",
          },
        },
        401,
      );
    }

    return jsonResponse({
      success:
        true,

      authenticated:
        true,

      message:
        "Session scanner active.",

      accessMode:
        session.accessMode,

      scanner: {
        id:
          session.user.id,

        firstName:
          session.user.firstName,

        lastName:
          session.user.lastName,

        email:
          session.user.email,

        phone:
          session.user.phone,

        role:
          session.user.role,

        emailVerified:
          session.user.emailVerified,

        isActive:
          session.user.isActive,
      },

      session: {
        id:
          session.sessionId,

        expiresAt:
          session.expiresAt.toISOString(),

        sourceCookie:
          session.cookieName,
      },
    });
  } catch (error) {
    console.error(
      "[SCANNER_AUTH_SESSION_ERROR]",
      error instanceof Error
        ? {
            name:
              error.name,

            message:
              error.message,
          }
        : error,
    );

    return jsonResponse(
      {
        success:
          false,

        authenticated:
          false,

        error: {
          code:
            "SCANNER_SESSION_CHECK_FAILED",

          message:
            "Impossible de vérifier la session scanner pour le moment.",
        },
      },
      500,
    );
  }
}
