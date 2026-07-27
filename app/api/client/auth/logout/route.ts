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

const CLIENT_SESSION_COOKIE_NAME =
  process.env
    .CLIENT_SESSION_COOKIE_NAME
    ?.trim() ||
  "tikemia_client_session";

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

function clearClientSessionCookie(
  response: NextResponse,
): void {
  response.cookies.set({
    name:
      CLIENT_SESSION_COOKIE_NAME,

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

export async function POST() {
  try {
    const cookieStore =
      await cookies();

    const sessionToken =
      cookieStore.get(
        CLIENT_SESSION_COOKIE_NAME,
      )?.value;

    if (
      sessionToken
    ) {
      const tokenHash =
        hashSessionToken(
          sessionToken,
        );

      await prisma.session
        .deleteMany({
          where: {
            tokenHash,
          },
        })
        .catch(
          (
            error,
          ) => {
            console.error(
              "[CLIENT_LOGOUT_SESSION_DELETE_ERROR]",
              error,
            );
          },
        );
    }

    const response =
      NextResponse.json(
        {
          success:
            true,

          message:
            "Déconnexion réussie.",

          redirectTo:
            "/login",
        },
        {
          status:
            200,

          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );

    clearClientSessionCookie(
      response,
    );

    return response;
  } catch (
    error
  ) {
    console.error(
      "[CLIENT_LOGOUT_ERROR]",
      error,
    );

    /*
     * Même si la suppression en base échoue,
     * on supprime le cookie local afin de déconnecter
     * le client de son navigateur.
     */
    const response =
      NextResponse.json(
        {
          success:
            false,

          message:
            "La session locale a été supprimée, mais une erreur est survenue.",

          redirectTo:
            "/login",
        },
        {
          status:
            500,

          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );

    clearClientSessionCookie(
      response,
    );

    return response;
  }
}