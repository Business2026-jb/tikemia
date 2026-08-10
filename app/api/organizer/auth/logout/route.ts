import { createHash } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const RESPONSE_HEADERS = {
  "Cache-Control":
    "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
} as const;

type LogoutResponse =
  | {
      success: true;
      message: string;
      redirectTo: string;
    }
  | {
      success: false;
      message: string;
      code: string;
      redirectTo?: string;
    };

function hashSessionToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function getSessionCookieName(): string {
  return (
    process.env.SESSION_COOKIE_NAME?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME
  );
}

function clearSessionCookie(
  response: NextResponse<LogoutResponse>,
  cookieName: string,
): void {
  /*
   * Les attributs importants pour supprimer correctement le cookie
   * doivent correspondre au cookie de connexion, surtout `path`.
   *
   * Le cookie de session Tikemia est utilisé sur toute l'application.
   */
  response.cookies.set(
    cookieName,
    "",
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    },
  );
}

function successResponse(
  cookieName: string,
): NextResponse<LogoutResponse> {
  const response =
    NextResponse.json<LogoutResponse>(
      {
        success: true,
        message:
          "Vous êtes maintenant déconnecté.",
        redirectTo:
          "/organizer/login",
      },
      {
        status: 200,
        headers:
          RESPONSE_HEADERS,
      },
    );

  clearSessionCookie(
    response,
    cookieName,
  );

  return response;
}

function errorResponse({
  cookieName,
  code,
  message,
  status,
}: {
  cookieName: string;
  code: string;
  message: string;
  status: number;
}): NextResponse<LogoutResponse> {
  const response =
    NextResponse.json<LogoutResponse>(
      {
        success: false,
        code,
        message,
        redirectTo:
          "/organizer/login",
      },
      {
        status,
        headers:
          RESPONSE_HEADERS,
      },
    );

  /*
   * Même si la suppression en base rencontre exceptionnellement une
   * erreur, on invalide le cookie dans ce navigateur afin de ne pas
   * laisser une session locale continuer à être utilisée.
   */
  clearSessionCookie(
    response,
    cookieName,
  );

  return response;
}

export async function POST(): Promise<
  NextResponse<LogoutResponse>
> {
  const cookieName =
    getSessionCookieName();

  try {
    const cookieStore =
      await cookies();

    const rawSessionToken =
      cookieStore.get(
        cookieName,
      )?.value?.trim();

    /*
     * La déconnexion est volontairement idempotente.
     *
     * Si le cookie est déjà absent ou expiré, l'utilisateur est déjà
     * déconnecté : on renvoie tout de même 200 pour permettre au
     * composant client de retourner vers /organizer/login.
     */
    if (!rawSessionToken) {
      return successResponse(
        cookieName,
      );
    }

    const tokenHash =
      hashSessionToken(
        rawSessionToken,
      );

    /*
     * deleteMany évite une erreur si la session a déjà été supprimée
     * par expiration, par une autre déconnexion ou par une opération
     * de sécurité.
     */
    await prisma.session.deleteMany({
      where: {
        tokenHash,
      },
    });

    return successResponse(
      cookieName,
    );
  } catch (error) {
    console.error(
      "[ORGANIZER_LOGOUT_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
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

    return errorResponse({
      cookieName,
      code:
        "ORGANIZER_LOGOUT_FAILED",
      status: 500,
      message:
        "Impossible de vous déconnecter pour le moment.",
    });
  }
}