import {
  createHash,
} from "node:crypto";

import {
  cookies,
} from "next/headers";
import {
  NextResponse,
} from "next/server";

import {
  prisma,
} from "@/lib/prisma";
import {
  SCANNER_SESSION_COOKIE_NAME,
} from "@/lib/scanner/get-scanner-session";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

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

        "Referrer-Policy":
          "same-origin",
      },
    },
  );
}

function hashSessionToken(
  token: string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      token,
      "utf8",
    )
    .digest(
      "hex",
    );
}

function getCookieSecureFlag():
  boolean {
  return (
    process.env.NODE_ENV ===
      "production" ||
    process.env
      .NEXT_PUBLIC_APP_URL
      ?.trim()
      .startsWith(
        "https://",
      ) === true ||
    process.env
      .APP_URL
      ?.trim()
      .startsWith(
        "https://",
      ) === true
  );
}

async function clearScannerCookie():
  Promise<void> {
  const cookieStore =
    await cookies();

  cookieStore.set(
    SCANNER_SESSION_COOKIE_NAME,
    "",
    {
      httpOnly:
        true,

      secure:
        getCookieSecureFlag(),

      sameSite:
        "lax",

      path:
        "/",

      maxAge:
        0,

      expires:
        new Date(0),
    },
  );
}

async function deleteCurrentScannerSession():
  Promise<void> {
  const cookieStore =
    await cookies();

  const rawToken =
    normalizeText(
      cookieStore.get(
        SCANNER_SESSION_COOKIE_NAME,
      )?.value,
    );

  if (!rawToken) {
    return;
  }

  await prisma.session.deleteMany({
    where: {
      tokenHash:
        hashSessionToken(
          rawToken,
        ),
    },
  });
}

async function handleLogout():
  Promise<NextResponse> {
  try {
    await deleteCurrentScannerSession()
      .catch(
        (
          error,
        ) => {
          console.error(
            "[SCANNER_AUTH_LOGOUT_SESSION_DELETE_ERROR]",
            error,
          );
        },
      );

    await clearScannerCookie();

    return jsonResponse({
      success:
        true,

      message:
        "Déconnexion du scanner réussie.",

      redirectTo:
        "/scanner/login",
    });
  } catch (error) {
    console.error(
      "[SCANNER_AUTH_LOGOUT_ERROR]",
      error,
    );

    await clearScannerCookie()
      .catch(
        () =>
          undefined,
      );

    return jsonResponse({
      success:
        true,

      message:
        "La session locale du scanner a été fermée.",

      redirectTo:
        "/scanner/login",
    });
  }
}

export async function POST():
  Promise<NextResponse> {
  return handleLogout();
}

export async function DELETE():
  Promise<NextResponse> {
  return handleLogout();
}
