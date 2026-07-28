import "server-only";

import { createHash } from "node:crypto";

import { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

const CUSTOMER_LOGIN_PATH =
  "/login";

const DEFAULT_CLIENT_SESSION_COOKIE_NAME =
  "tikemia_client_session";

const LEGACY_SESSION_COOKIE_NAME =
  "tikemia_session";

export type CurrentClient = {
  id: string;

  firstName: string;
  lastName: string;
  fullName: string;

  email: string;
  phone: string;

  country: string;
  countryCode: string;
  dialCode: string;

  emailVerified: boolean;
  isActive: boolean;

  avatarUrl: string | null;
  unreadNotificationsCount: number;

  session: {
    id: string;
    expiresAt: string;
  };
};

export type RequireCurrentClientOptions = {
  redirectTo?: string;
  loginPath?: string;
};

type SessionCandidate = {
  cookieName: string;
  token: string;
};

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function hashSessionToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function buildFullName({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}): string {
  return `${firstName} ${lastName}`
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLoginPath(
  value: string | undefined,
): string {
  const normalized =
    normalizeText(value);

  if (
    !normalized ||
    !normalized.startsWith("/") ||
    normalized.startsWith("//")
  ) {
    return CUSTOMER_LOGIN_PATH;
  }

  return normalized;
}

function normalizeRedirectPath(
  value: string | undefined,
): string {
  const normalized =
    normalizeText(value);

  if (
    !normalized ||
    !normalized.startsWith("/") ||
    normalized.startsWith("//")
  ) {
    return "";
  }

  return normalized;
}

function createLoginRedirectUrl({
  loginPath,
  redirectTo,
}: {
  loginPath: string;
  redirectTo?: string;
}): string {
  const safeLoginPath =
    normalizeLoginPath(loginPath);

  const safeRedirectTo =
    normalizeRedirectPath(redirectTo);

  if (!safeRedirectTo) {
    return safeLoginPath;
  }

  const separator =
    safeLoginPath.includes("?")
      ? "&"
      : "?";

  return `${safeLoginPath}${separator}redirect=${encodeURIComponent(
    safeRedirectTo,
  )}`;
}

function getSessionCookieNames(): string[] {
  return Array.from(
    new Set(
      [
        normalizeText(
          process.env.CLIENT_SESSION_COOKIE_NAME,
        ),
        DEFAULT_CLIENT_SESSION_COOKIE_NAME,
        normalizeText(
          process.env.SESSION_COOKIE_NAME,
        ),
        LEGACY_SESSION_COOKIE_NAME,
      ].filter(Boolean),
    ),
  );
}

async function getSessionCandidates(): Promise<
  SessionCandidate[]
> {
  const cookieStore =
    await cookies();

  const candidates: SessionCandidate[] =
    [];

  for (
    const cookieName of
    getSessionCookieNames()
  ) {
    const token =
      normalizeText(
        cookieStore.get(cookieName)?.value,
      );

    if (!token) {
      continue;
    }

    if (
      candidates.some(
        (candidate) =>
          candidate.token === token,
      )
    ) {
      continue;
    }

    candidates.push({
      cookieName,
      token,
    });
  }

  return candidates;
}

async function deleteExpiredSession(
  sessionId: string,
): Promise<void> {
  try {
    await prisma.session.delete({
      where: {
        id: sessionId,
      },
    });
  } catch (error) {
    console.error(
      "[GET_CURRENT_CLIENT_EXPIRED_SESSION_DELETE_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
          }
        : error,
    );
  }
}

/**
 * Retourne le client actuellement connecté.
 *
 * La fonction accepte les noms de cookies actuels et historiques :
 *
 * - CLIENT_SESSION_COOKIE_NAME
 * - tikemia_client_session
 * - SESSION_COOKIE_NAME
 * - tikemia_session
 *
 * Chaque cookie trouvé est vérifié jusqu'à ce qu'une session client
 * valide soit reconnue. Un ancien cookie invalide ne bloque donc pas
 * la lecture d'un cookie client valide.
 *
 * Cette fonction ne redirige jamais.
 */
export async function getCurrentClient(): Promise<CurrentClient | null> {
  const sessionCandidates =
    await getSessionCandidates();

  if (
    sessionCandidates.length ===
    0
  ) {
    return null;
  }

  try {
    for (
      const candidate of
      sessionCandidates
    ) {
      const session =
        await prisma.session.findUnique({
          where: {
            tokenHash:
              hashSessionToken(
                candidate.token,
              ),
          },

          select: {
            id: true,
            expiresAt: true,

            user: {
              select: {
                id: true,

                firstName: true,
                lastName: true,

                email: true,
                phone: true,

                country: true,
                countryCode: true,
                dialCode: true,

                role: true,
                emailVerified: true,
                isActive: true,
              },
            },
          },
        });

      if (!session) {
        continue;
      }

      if (
        session.expiresAt.getTime() <=
        Date.now()
      ) {
        await deleteExpiredSession(
          session.id,
        );

        continue;
      }

      const client =
        session.user;

      if (
        client.role !==
          UserRole.CUSTOMER ||
        !client.emailVerified ||
        !client.isActive
      ) {
        continue;
      }

      const firstName =
        normalizeText(
          client.firstName,
        );

      const lastName =
        normalizeText(
          client.lastName,
        );

      const fullName =
        buildFullName({
          firstName,
          lastName,
        });

      return {
        id:
          client.id,

        firstName,
        lastName,

        fullName:
          fullName ||
          "Client Tikemia",

        email:
          normalizeText(
            client.email,
          ),

        phone:
          normalizeText(
            client.phone,
          ),

        country:
          normalizeText(
            client.country,
          ),

        countryCode:
          normalizeText(
            client.countryCode,
          ),

        dialCode:
          normalizeText(
            client.dialCode,
          ),

        emailVerified:
          client.emailVerified,

        isActive:
          client.isActive,

        avatarUrl:
          null,

        unreadNotificationsCount:
          0,

        session: {
          id:
            session.id,

          expiresAt:
            session.expiresAt.toISOString(),
        },
      };
    }

    return null;
  } catch (error) {
    console.error(
      "[GET_CURRENT_CLIENT_ERROR]",
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

    return null;
  }
}

/**
 * Retourne obligatoirement un client connecté.
 *
 * Pages protégées concernées :
 *
 * - /account/tickets
 * - /account/orders
 * - /account/profile
 * - /account/transfers
 * - /favorites
 */
export async function requireCurrentClient(
  options: RequireCurrentClientOptions = {},
): Promise<CurrentClient> {
  const client =
    await getCurrentClient();

  if (client) {
    return client;
  }

  redirect(
    createLoginRedirectUrl({
      loginPath:
        options.loginPath ??
        CUSTOMER_LOGIN_PATH,

      redirectTo:
        options.redirectTo,
    }),
  );
}