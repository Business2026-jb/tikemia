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

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const DEFAULT_CLIENT_SESSION_COOKIE_NAME =
  "tikemia_client_session";

const LEGACY_SESSION_COOKIE_NAME =
  "tikemia_session";

const CLIENT_SESSION_COOKIE_NAME =
  process.env
    .CLIENT_SESSION_COOKIE_NAME
    ?.trim() ||
  DEFAULT_CLIENT_SESSION_COOKIE_NAME;

function hashSessionToken(
  token: string,
): string {
  return createHash(
    "sha256",
  )
    .update(
      token,
    )
    .digest(
      "hex",
    );
}

function getSessionCookieNames(): string[] {
  return Array.from(
    new Set(
      [
        CLIENT_SESSION_COOKIE_NAME,

        process.env
          .SESSION_COOKIE_NAME
          ?.trim(),

        DEFAULT_CLIENT_SESSION_COOKIE_NAME,

        LEGACY_SESSION_COOKIE_NAME,
      ].filter(
        (
          value,
        ): value is string =>
          Boolean(
            value?.trim(),
          ),
      ),
    ),
  );
}

function clearSessionCookies(
  response: NextResponse,
): void {
  for (
    const cookieName of
    getSessionCookieNames()
  ) {
    response.cookies.set({
      name:
        cookieName,

      value:
        "",

      httpOnly:
        true,

      secure:
        process.env
          .NODE_ENV ===
        "production",

      sameSite:
        "lax",

      path:
        "/",

      maxAge:
        0,

      expires:
        new Date(0),
    });
  }
}

export async function POST() {
  const cookieStore =
    await cookies();

  const sessionTokens =
    Array.from(
      new Set(
        getSessionCookieNames()
          .map(
            (
              cookieName,
            ) =>
              cookieStore
                .get(
                  cookieName,
                )
                ?.value
                ?.trim(),
          )
          .filter(
            (
              token,
            ): token is string =>
              Boolean(
                token,
              ),
          ),
      ),
    );

  let sessionDeletionFailed =
    false;

  try {
    const tokenHashes =
      sessionTokens.map(
        (
          token,
        ) =>
          hashSessionToken(
            token,
          ),
      );

    if (
      tokenHashes.length >
      0
    ) {
      await prisma.session.deleteMany({
        where: {
          tokenHash: {
            in:
              tokenHashes,
          },
        },
      });
    }
  } catch (
    error
  ) {
    sessionDeletionFailed =
      true;

    console.error(
      "[CLIENT_LOGOUT_SESSION_DELETE_ERROR]",
      error,
    );
  }

  const response =
    NextResponse.json(
      {
        success:
          !sessionDeletionFailed,

        message:
          sessionDeletionFailed
            ? "La session locale a été supprimée, mais une erreur est survenue lors de la suppression de la session en base."
            : "Déconnexion réussie.",

        redirectTo:
          "/",
      },
      {
        status:
          sessionDeletionFailed
            ? 500
            : 200,

        headers: {
          "Cache-Control":
            "no-store, max-age=0",

          Pragma:
            "no-cache",
        },
      },
    );

  clearSessionCookies(
    response,
  );

  return response;
}