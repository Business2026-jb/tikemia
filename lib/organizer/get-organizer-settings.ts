import "server-only";

import { createHash } from "node:crypto";

import { cookies } from "next/headers";

import {
  DEFAULT_COUNTRY_CODE,
  getActiveCountries,
  getCountryByCode,
  getDefaultCurrencyForCountry,
  getDefaultTimezoneForCountry,
} from "@/lib/localization/countries";
import {
  DEFAULT_CURRENCY_CODE,
  getCurrencyDefinition,
  getCurrencySelectOptions,
  isSupportedCurrencyCode,
  type SupportedCurrencyCode,
} from "@/lib/localization/currencies";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const DEFAULT_LANGUAGE = "fr";
const DEFAULT_DATE_FORMAT =
  "DD/MM/YYYY";
const DEFAULT_THEME = "dark";

const SUPPORTED_LANGUAGES =
  new Set([
    "fr",
    "en",
  ]);

const SUPPORTED_DATE_FORMATS =
  new Set([
    "DD/MM/YYYY",
    "DD-MM-YYYY",
    "YYYY-MM-DD",
    "MM/DD/YYYY",
  ]);

const SUPPORTED_THEMES =
  new Set([
    "dark",
    "system",
  ]);

export type OrganizerSettingsData = {
  organizer: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    emailVerified: boolean;
    isActive: boolean;
    initials: string;
    countryCode: string;
  };

  preferences: {
    language: string;
    currency: SupportedCurrencyCode;
    timezone: string;
    dateFormat: string;
    theme: string;
  };

  notifications: {
    emailNotifications: boolean;
    whatsappNotifications: boolean;
    dashboardNotifications: boolean;

    notifyTicketSales: boolean;
    notifyPayments: boolean;
    notifyRefunds: boolean;
    notifyEventStatus: boolean;
    notifySecurity: boolean;
  };

  ticketing: {
    maxTicketsPerOrder: number;
    showRemainingTickets: boolean;
    allowTicketTransfer: boolean;
    allowRefundRequests: boolean;
  };

  security: {
    emailVerified: boolean;
    accountActive: boolean;
    sessionsCount: number;
    currentSessionExpiresAt: string;
  };

  metadata: {
    settingsId: string;
    createdAt: string;
    updatedAt: string;
  };

  options: {
    languages: OrganizerSettingsOption[];
    currencies: OrganizerSettingsCurrencyOption[];
    timezones: OrganizerSettingsOption[];
    dateFormats: OrganizerSettingsOption[];
    themes: OrganizerSettingsOption[];
  };
};

export type OrganizerSettingsOption = {
  value: string;
  label: string;
  description?: string;
};

export type OrganizerSettingsCurrencyOption =
  OrganizerSettingsOption & {
    value: SupportedCurrencyCode;
    code: SupportedCurrencyCode;
    name: string;
    symbol: string;
    fractionDigits: number;
    region: string;
  };

export type GetOrganizerSettingsResult = {
  settings: OrganizerSettingsData;
};

export class GetOrganizerSettingsError extends Error {
  readonly code: string;
  readonly status: number;
  readonly redirectTo?: string;

  constructor({
    code,
    message,
    status = 500,
    redirectTo,
  }: {
    code: string;
    message: string;
    status?: number;
    redirectTo?: string;
  }) {
    super(message);

    this.name =
      "GetOrganizerSettingsError";

    this.code = code;
    this.status = status;
    this.redirectTo =
      redirectTo;
  }
}

const LANGUAGE_OPTIONS: OrganizerSettingsOption[] =
  [
    {
      value: "fr",
      label: "Français",
      description:
        "Langue principale de l’espace organisateur.",
    },
    {
      value: "en",
      label: "English",
      description:
        "Interface organisateur en anglais.",
    },
  ];

const DATE_FORMAT_OPTIONS: OrganizerSettingsOption[] =
  [
    {
      value: "DD/MM/YYYY",
      label: "31/12/2026",
    },
    {
      value: "DD-MM-YYYY",
      label: "31-12-2026",
    },
    {
      value: "YYYY-MM-DD",
      label: "2026-12-31",
    },
    {
      value: "MM/DD/YYYY",
      label: "12/31/2026",
    },
  ];

const THEME_OPTIONS: OrganizerSettingsOption[] =
  [
    {
      value: "dark",
      label: "Sombre",
      description:
        "Thème sombre Tikemia recommandé.",
    },
    {
      value: "system",
      label: "Système",
      description:
        "Suit automatiquement les préférences de l’appareil.",
    },
  ];

function buildCurrencyOptions(): OrganizerSettingsCurrencyOption[] {
  return getCurrencySelectOptions().map(
    (currency) => ({
      value:
        currency.value,

      code:
        currency.code,

      name:
        currency.name,

      symbol:
        currency.symbol,

      fractionDigits:
        currency.decimals,

      region:
        currency.region,

      label:
        `${currency.name} — ${currency.code} — ${currency.symbol}`,

      description:
        currency.decimals === 0
          ? "Cette devise n’utilise pas de décimales."
          : `Cette devise utilise jusqu’à ${currency.decimals} décimale${
              currency.decimals > 1
                ? "s"
                : ""
            }.`,
    }),
  );
}

function buildTimezoneOptions(): OrganizerSettingsOption[] {
  const timezoneMap =
    new Map<
      string,
      OrganizerSettingsOption
    >();

  for (
    const country of
    getActiveCountries()
  ) {
    if (
      timezoneMap.has(
        country.timezone,
      )
    ) {
      continue;
    }

    timezoneMap.set(
      country.timezone,
      {
        value:
          country.timezone,

        label:
          `${country.name} — ${country.timezone}`,

        description:
          `Fuseau horaire recommandé pour ${country.name}.`,
      },
    );
  }

  return Array.from(
    timezoneMap.values(),
  );
}

function hashSessionToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeCountryCode(
  value: string | null | undefined,
): string {
  const normalizedValue =
    value
      ?.trim()
      .toUpperCase() ?? "";

  return getCountryByCode(
    normalizedValue,
  )
    ? normalizedValue
    : DEFAULT_COUNTRY_CODE;
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

function buildInitials({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}): string {
  const firstInitial =
    firstName
      .trim()
      .charAt(0);

  const lastInitial =
    lastName
      .trim()
      .charAt(0);

  const initials =
    `${firstInitial}${lastInitial}`
      .trim()
      .toUpperCase();

  return initials || "OR";
}

function resolveLanguage(
  value: string,
): string {
  const normalizedValue =
    value.trim().toLowerCase();

  return SUPPORTED_LANGUAGES.has(
    normalizedValue,
  )
    ? normalizedValue
    : DEFAULT_LANGUAGE;
}

function resolveCurrency({
  value,
  countryCode,
}: {
  value: string;
  countryCode: string;
}): SupportedCurrencyCode {
  const normalizedValue =
    value.trim().toUpperCase();

  if (
    isSupportedCurrencyCode(
      normalizedValue,
    ) &&
    getCurrencyDefinition(
      normalizedValue,
    )?.active
  ) {
    return normalizedValue;
  }

  return (
    getDefaultCurrencyForCountry(
      countryCode,
    ) ??
    DEFAULT_CURRENCY_CODE
  );
}

function resolveTimezone({
  value,
  countryCode,
}: {
  value: string;
  countryCode: string;
}): string {
  const normalizedValue =
    value.trim();

  if (normalizedValue) {
    try {
      new Intl.DateTimeFormat(
        "fr-FR",
        {
          timeZone:
            normalizedValue,
        },
      ).format(new Date());

      return normalizedValue;
    } catch {
      // Le fuseau enregistré est invalide.
    }
  }

  return getDefaultTimezoneForCountry(
    countryCode,
  );
}

function resolveDateFormat(
  value: string,
): string {
  const normalizedValue =
    value.trim();

  return SUPPORTED_DATE_FORMATS.has(
    normalizedValue,
  )
    ? normalizedValue
    : DEFAULT_DATE_FORMAT;
}

function resolveTheme(
  value: string,
): string {
  const normalizedValue =
    value.trim().toLowerCase();

  return SUPPORTED_THEMES.has(
    normalizedValue,
  )
    ? normalizedValue
    : DEFAULT_THEME;
}

async function getAuthenticatedOrganizer() {
  const cookieStore =
    await cookies();

  const sessionCookieName =
    process.env
      .SESSION_COOKIE_NAME
      ?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;

  const sessionToken =
    cookieStore.get(
      sessionCookieName,
    )?.value;

  if (!sessionToken) {
    throw new GetOrganizerSettingsError({
      code:
        "UNAUTHORIZED",

      status:
        401,

      message:
        "Votre session est absente ou expirée.",

      redirectTo:
        "/organizer/login",
    });
  }

  const session =
    await prisma.session.findUnique(
      {
        where: {
          tokenHash:
            hashSessionToken(
              sessionToken,
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
              countryCode: true,
              role: true,
              emailVerified: true,
              isActive: true,

              _count: {
                select: {
                  sessions:
                    true,
                },
              },
            },
          },
        },
      },
    );

  if (!session) {
    throw new GetOrganizerSettingsError({
      code:
        "INVALID_SESSION",

      status:
        401,

      message:
        "Votre session n’est plus valide.",

      redirectTo:
        "/organizer/login",
    });
  }

  if (
    session.expiresAt.getTime() <=
    Date.now()
  ) {
    await prisma.session
      .delete({
        where: {
          id:
            session.id,
        },
      })
      .catch(
        (
          error: unknown,
        ) => {
          console.error(
            "[GET_ORGANIZER_SETTINGS_EXPIRED_SESSION_DELETE_ERROR]",
            error instanceof Error
              ? error.message
              : error,
          );
        },
      );

    throw new GetOrganizerSettingsError({
      code:
        "EXPIRED_SESSION",

      status:
        401,

      message:
        "Votre session a expiré. Reconnectez-vous.",

      redirectTo:
        "/organizer/login",
    });
  }

  if (
    session.user.role !==
      "ORGANIZER" ||
    !session.user.isActive
  ) {
    throw new GetOrganizerSettingsError({
      code:
        "FORBIDDEN",

      status:
        403,

      message:
        "Votre compte ne peut pas accéder aux paramètres organisateur.",

      redirectTo:
        "/organizer/login",
    });
  }

  return {
    sessionId:
      session.id,

    sessionExpiresAt:
      session.expiresAt,

    user:
      session.user,
  };
}

export async function getOrganizerSettings(): Promise<GetOrganizerSettingsResult> {
  try {
    const authentication =
      await getAuthenticatedOrganizer();

    const organizer =
      authentication.user;

    const organizerCountryCode =
      normalizeCountryCode(
        organizer.countryCode,
      );

    const defaultCurrency =
      getDefaultCurrencyForCountry(
        organizerCountryCode,
      );

    const defaultTimezone =
      getDefaultTimezoneForCountry(
        organizerCountryCode,
      );

    const settings =
      await prisma.organizerSettings.upsert(
        {
          where: {
            organizerId:
              organizer.id,
          },

          create: {
            organizerId:
              organizer.id,

            language:
              DEFAULT_LANGUAGE,

            currency:
              defaultCurrency,

            timezone:
              defaultTimezone,

            dateFormat:
              DEFAULT_DATE_FORMAT,

            theme:
              DEFAULT_THEME,

            emailNotifications:
              true,

            whatsappNotifications:
              true,

            dashboardNotifications:
              true,

            notifyTicketSales:
              true,

            notifyPayments:
              true,

            notifyRefunds:
              true,

            notifyEventStatus:
              true,

            notifySecurity:
              true,

            maxTicketsPerOrder:
              10,

            showRemainingTickets:
              true,

            allowTicketTransfer:
              true,

            allowRefundRequests:
              false,
          },

          update:
            {},

          select: {
            id:
              true,

            organizerId:
              true,

            language:
              true,

            currency:
              true,

            timezone:
              true,

            dateFormat:
              true,

            theme:
              true,

            emailNotifications:
              true,

            whatsappNotifications:
              true,

            dashboardNotifications:
              true,

            notifyTicketSales:
              true,

            notifyPayments:
              true,

            notifyRefunds:
              true,

            notifyEventStatus:
              true,

            notifySecurity:
              true,

            maxTicketsPerOrder:
              true,

            showRemainingTickets:
              true,

            allowTicketTransfer:
              true,

            allowRefundRequests:
              true,

            createdAt:
              true,

            updatedAt:
              true,
          },
        },
      );

    const firstName =
      normalizeText(
        organizer.firstName,
      );

    const lastName =
      normalizeText(
        organizer.lastName,
      );

    const currencyOptions =
      buildCurrencyOptions();

    const timezoneOptions =
      buildTimezoneOptions();

    const resolvedCurrency =
      resolveCurrency({
        value:
          settings.currency,

        countryCode:
          organizerCountryCode,
      });

    const resolvedTimezone =
      resolveTimezone({
        value:
          settings.timezone,

        countryCode:
          organizerCountryCode,
      });

    return {
      settings: {
        organizer: {
          id:
            organizer.id,

          firstName,
          lastName,

          fullName:
            buildFullName({
              firstName,
              lastName,
            }),

          email:
            normalizeText(
              organizer.email,
            ),

          emailVerified:
            organizer.emailVerified,

          isActive:
            organizer.isActive,

          initials:
            buildInitials({
              firstName,
              lastName,
            }),

          countryCode:
            organizerCountryCode,
        },

        preferences: {
          language:
            resolveLanguage(
              settings.language,
            ),

          currency:
            resolvedCurrency,

          timezone:
            resolvedTimezone,

          dateFormat:
            resolveDateFormat(
              settings.dateFormat,
            ),

          theme:
            resolveTheme(
              settings.theme,
            ),
        },

        notifications: {
          emailNotifications:
            settings.emailNotifications,

          whatsappNotifications:
            settings.whatsappNotifications,

          dashboardNotifications:
            settings.dashboardNotifications,

          notifyTicketSales:
            settings.notifyTicketSales,

          notifyPayments:
            settings.notifyPayments,

          notifyRefunds:
            settings.notifyRefunds,

          notifyEventStatus:
            settings.notifyEventStatus,

          notifySecurity:
            settings.notifySecurity,
        },

        ticketing: {
          maxTicketsPerOrder:
            settings.maxTicketsPerOrder,

          showRemainingTickets:
            settings.showRemainingTickets,

          allowTicketTransfer:
            settings.allowTicketTransfer,

          allowRefundRequests:
            settings.allowRefundRequests,
        },

        security: {
          emailVerified:
            organizer.emailVerified,

          accountActive:
            organizer.isActive,

          sessionsCount:
            organizer._count.sessions,

          currentSessionExpiresAt:
            authentication.sessionExpiresAt.toISOString(),
        },

        metadata: {
          settingsId:
            settings.id,

          createdAt:
            settings.createdAt.toISOString(),

          updatedAt:
            settings.updatedAt.toISOString(),
        },

        options: {
          languages:
            LANGUAGE_OPTIONS,

          currencies:
            currencyOptions,

          timezones:
            timezoneOptions,

          dateFormats:
            DATE_FORMAT_OPTIONS,

          themes:
            THEME_OPTIONS,
        },
      },
    };
  } catch (error) {
    if (
      error instanceof
      GetOrganizerSettingsError
    ) {
      throw error;
    }

    console.error(
      "[GET_ORGANIZER_SETTINGS_ERROR]",
      error instanceof Error
        ? {
            name:
              error.name,

            message:
              error.message,

            stack:
              process.env
                .NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    throw new GetOrganizerSettingsError({
      code:
        "GET_ORGANIZER_SETTINGS_FAILED",

      status:
        500,

      message:
        "Impossible de charger vos paramètres organisateur pour le moment.",
    });
  }
}