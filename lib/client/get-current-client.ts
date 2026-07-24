import "server-only";

import { createHash } from "node:crypto";

import { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const CUSTOMER_LOGIN_PATH =
  "/login";

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

function createLoginRedirectUrl({
  loginPath,
  redirectTo,
}: {
  loginPath: string;
  redirectTo?: string;
}): string {
  const normalizedLoginPath =
    normalizeText(loginPath) ||
    CUSTOMER_LOGIN_PATH;

  const normalizedRedirectTo =
    normalizeText(redirectTo);

  if (!normalizedRedirectTo) {
    return normalizedLoginPath;
  }

  const separator =
    normalizedLoginPath.includes("?")
      ? "&"
      : "?";

  return `${normalizedLoginPath}${separator}redirect=${encodeURIComponent(
    normalizedRedirectTo,
  )}`;
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
 * Cette fonction ne redirige jamais :
 * - elle retourne `null` pour un visiteur invité ;
 * - elle retourne `null` si la session est absente, invalide ou expirée ;
 * - elle retourne `null` si le compte n'est pas un compte CUSTOMER actif
 *   et vérifié.
 *
 * Elle peut donc être utilisée en toute sécurité dans le layout client
 * commun aux visiteurs invités et aux clients connectés.
 */
export async function getCurrentClient(): Promise<CurrentClient | null> {
  const cookieStore =
    await cookies();

  const sessionCookieName =
    normalizeText(
      process.env
        .SESSION_COOKIE_NAME,
    ) ||
    SESSION_COOKIE_FALLBACK_NAME;

  const rawSessionToken =
    cookieStore.get(
      sessionCookieName,
    )?.value;

  if (!rawSessionToken) {
    return null;
  }

  const normalizedSessionToken =
    rawSessionToken.trim();

  if (!normalizedSessionToken) {
    return null;
  }

  try {
    const session =
      await prisma.session.findUnique({
        where: {
          tokenHash:
            hashSessionToken(
              normalizedSessionToken,
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
      return null;
    }

    if (
      session.expiresAt.getTime() <=
      Date.now()
    ) {
      await deleteExpiredSession(
        session.id,
      );

      return null;
    }

    const client =
      session.user;

    if (
      client.role !==
        UserRole.CUSTOMER ||
      !client.emailVerified ||
      !client.isActive
    ) {
      return null;
    }

    const firstName =
      normalizeText(
        client.firstName,
      );

    const lastName =
      normalizeText(
        client.lastName,
      );

    return {
      id:
        client.id,

      firstName,
      lastName,

      fullName:
        buildFullName({
          firstName,
          lastName,
        }) ||
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

      /*
       * Le schéma client actuel ne possède pas encore de champ avatar.
       * Cette valeur reste donc nulle jusqu'à l'ajout éventuel d'un
       * profil client dédié dans Prisma.
       */
      avatarUrl:
        null,

      /*
       * Le modèle de notifications client n'est pas encore présent
       * dans le schéma actuel. Le header reçoit donc zéro notification
       * non lue sans provoquer de requête ou d'erreur supplémentaire.
       */
      unreadNotificationsCount:
        0,

      session: {
        id:
          session.id,

        expiresAt:
          session.expiresAt.toISOString(),
      },
    };
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

    /*
     * La partie client accepte le mode invité.
     * En cas d'indisponibilité temporaire de la session ou de la base,
     * on retourne donc `null` au lieu de casser tout le layout.
     */
    return null;
  }
}

/**
 * Retourne obligatoirement un client connecté.
 *
 * Cette variante est destinée aux pages comme :
 * - /account/tickets
 * - /account/orders
 * - /account/profile
 * - /account/settings
 *
 * Un visiteur invité est redirigé vers la connexion.
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