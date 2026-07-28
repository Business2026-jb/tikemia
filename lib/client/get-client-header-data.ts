import "server-only";

import {
  getCurrentClient,
  type CurrentClient,
} from "@/lib/client/get-current-client";

export type ClientHeaderUserData = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  unreadNotificationsCount: number;
};

export type ClientHeaderData = {
  user: ClientHeaderUserData | null;
  isAuthenticated: boolean;

  displayName: string;
  initials: string;

  loginHref: string;
  registerHref: string;

  ticketsHref: string;
  ordersHref: string;
  favoritesHref: string;
  profileHref: string;
};

export type GetClientHeaderDataOptions = {
  loginHref?: string;
  registerHref?: string;

  ticketsHref?: string;
  ordersHref?: string;
  favoritesHref?: string;
  profileHref?: string;
};

const DEFAULT_LOGIN_HREF =
  "/login";

const DEFAULT_REGISTER_HREF =
  "/register";

const DEFAULT_TICKETS_HREF =
  "/account/tickets";

const DEFAULT_ORDERS_HREF =
  "/account/orders";

const DEFAULT_FAVORITES_HREF =
  "/favorites";

const DEFAULT_PROFILE_HREF =
  "/account/profile";

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeHref({
  value,
  fallback,
}: {
  value: string | undefined;
  fallback: string;
}): string {
  const normalizedValue =
    normalizeText(value);

  if (!normalizedValue) {
    return fallback;
  }

  if (
    normalizedValue.startsWith("/") ||
    normalizedValue.startsWith("https://") ||
    normalizedValue.startsWith("http://")
  ) {
    return normalizedValue;
  }

  return fallback;
}

function getClientDisplayName(
  client: CurrentClient | null,
): string {
  if (!client) {
    return "Connexion";
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
    [firstName, lastName]
      .filter(Boolean)
      .join(" ");

  if (fullName) {
    return fullName;
  }

  const storedFullName =
    normalizeText(
      client.fullName,
    );

  if (
    storedFullName &&
    storedFullName !==
      "Client Tikemia"
  ) {
    return storedFullName;
  }

  const email =
    normalizeText(
      client.email,
    );

  if (email) {
    return email;
  }

  return "Mon compte";
}

function getClientInitials(
  client: CurrentClient | null,
): string {
  if (!client) {
    return "C";
  }

  const firstName =
    normalizeText(
      client.firstName,
    );

  const lastName =
    normalizeText(
      client.lastName,
    );

  const directInitials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`
      .trim()
      .toUpperCase();

  if (directInitials) {
    return directInitials;
  }

  const fullName =
    normalizeText(
      client.fullName,
    );

  if (fullName) {
    const parts =
      fullName
        .split(/\s+/)
        .filter(Boolean);

    const firstInitial =
      parts[0]?.charAt(0) ?? "";

    const lastInitial =
      parts.length > 1
        ? parts[
            parts.length - 1
          ]?.charAt(0) ?? ""
        : "";

    const fullNameInitials =
      `${firstInitial}${lastInitial}`
        .toUpperCase();

    if (fullNameInitials) {
      return fullNameInitials;
    }
  }

  const emailInitial =
    normalizeText(
      client.email,
    )
      .charAt(0)
      .toUpperCase();

  return emailInitial || "C";
}

function mapClientToHeaderUser(
  client: CurrentClient | null,
): ClientHeaderUserData | null {
  if (!client) {
    return null;
  }

  const unreadNotificationsCount =
    Number.isFinite(
      client.unreadNotificationsCount,
    )
      ? Math.max(
          client.unreadNotificationsCount,
          0,
        )
      : 0;

  return {
    id:
      client.id,

    firstName:
      normalizeText(
        client.firstName,
      ),

    lastName:
      normalizeText(
        client.lastName,
      ),

    email:
      normalizeText(
        client.email,
      ),

    avatarUrl:
      normalizeText(
        client.avatarUrl,
      ) || null,

    unreadNotificationsCount,
  };
}

/**
 * Prépare les données globales utilisées par :
 *
 * - components/client/header/client-header.tsx
 * - components/client/navigation/client-mobile-bottom-nav.tsx
 * - app/(client)/layout.tsx
 *
 * Cette fonction lit la session client avec getCurrentClient().
 * Elle ne crée aucune session et ne redirige jamais.
 */
export async function getClientHeaderData(
  options: GetClientHeaderDataOptions = {},
): Promise<ClientHeaderData> {
  let client: CurrentClient | null =
    null;

  try {
    client =
      await getCurrentClient();
  } catch (error) {
    console.error(
      "[GET_CLIENT_HEADER_DATA_ERROR]",
      error,
    );
  }

  const user =
    mapClientToHeaderUser(
      client,
    );

  return {
    user,

    isAuthenticated:
      user !== null,

    displayName:
      getClientDisplayName(
        client,
      ),

    initials:
      getClientInitials(
        client,
      ),

    loginHref:
      normalizeHref({
        value:
          options.loginHref,

        fallback:
          DEFAULT_LOGIN_HREF,
      }),

    registerHref:
      normalizeHref({
        value:
          options.registerHref,

        fallback:
          DEFAULT_REGISTER_HREF,
      }),

    ticketsHref:
      normalizeHref({
        value:
          options.ticketsHref,

        fallback:
          DEFAULT_TICKETS_HREF,
      }),

    ordersHref:
      normalizeHref({
        value:
          options.ordersHref,

        fallback:
          DEFAULT_ORDERS_HREF,
      }),

    favoritesHref:
      normalizeHref({
        value:
          options.favoritesHref,

        fallback:
          DEFAULT_FAVORITES_HREF,
      }),

    profileHref:
      normalizeHref({
        value:
          options.profileHref,

        fallback:
          DEFAULT_PROFILE_HREF,
      }),
  };
}