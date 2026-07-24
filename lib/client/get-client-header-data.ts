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
  settingsHref: string;
};

export type GetClientHeaderDataOptions = {
  loginHref?: string;
  registerHref?: string;

  ticketsHref?: string;
  ordersHref?: string;
  favoritesHref?: string;
  profileHref?: string;
  settingsHref?: string;
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

const DEFAULT_SETTINGS_HREF =
  "/account/settings";

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

  const fullName =
    normalizeText(
      client.fullName,
    );

  if (
    fullName &&
    fullName !==
      "Client Tikemia"
  ) {
    return fullName;
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

  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`
      .trim()
      .toUpperCase();

  if (initials) {
    return initials;
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

  return {
    id:
      client.id,

    firstName:
      client.firstName,

    lastName:
      client.lastName,

    email:
      client.email,

    avatarUrl:
      client.avatarUrl,

    unreadNotificationsCount:
      Math.max(
        client.unreadNotificationsCount,
        0,
      ),
  };
}

/**
 * Prépare toutes les données nécessaires au header client.
 *
 * Cette fonction est destinée aux composants serveur, notamment :
 *
 * - app/(client)/layout.tsx
 * - components/client/header/client-header.tsx
 *
 * Elle accepte aussi bien :
 *
 * - un visiteur invité ;
 * - un client connecté.
 *
 * Une absence de session ne provoque jamais d'erreur et retourne
 * simplement `user: null`.
 */
export async function getClientHeaderData(
  options: GetClientHeaderDataOptions = {},
): Promise<ClientHeaderData> {
  const client =
    await getCurrentClient();

  return {
    user:
      mapClientToHeaderUser(
        client,
      ),

    isAuthenticated:
      Boolean(client),

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

    settingsHref:
      normalizeHref({
        value:
          options.settingsHref,

        fallback:
          DEFAULT_SETTINGS_HREF,
      }),
  };
}