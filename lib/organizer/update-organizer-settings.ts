import "server-only";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  getActiveCountries,
} from "@/lib/localization/countries";
import {
  getCurrencyDefinition,
  isSupportedCurrencyCode,
  type SupportedCurrencyCode,
} from "@/lib/localization/currencies";
import { prisma } from "@/lib/prisma";

const SUPPORTED_LANGUAGES = [
  "fr",
  "en",
] as const;

const SUPPORTED_DATE_FORMATS = [
  "DD/MM/YYYY",
  "DD-MM-YYYY",
  "YYYY-MM-DD",
  "MM/DD/YYYY",
] as const;

const SUPPORTED_THEMES = [
  "dark",
  "system",
] as const;

const MINIMUM_TICKETS_PER_ORDER = 1;
const MAXIMUM_TICKETS_PER_ORDER = 100;

const updateOrganizerSettingsSchema =
  z.object({
    organizerId: z
      .string()
      .trim()
      .min(
        1,
        "L’identifiant de l’organisateur est obligatoire.",
      ),

    preferences: z.object({
      language: z.enum(
        SUPPORTED_LANGUAGES,
        {
          message:
            "La langue sélectionnée n’est pas prise en charge.",
        },
      ),

      /*
       * La devise est validée après le parsing avec le
       * catalogue central lib/localization/currencies.ts.
       *
       * On n’utilise volontairement plus z.enum([...])
       * afin d’éviter de maintenir une deuxième liste.
       */
      currency: z
        .string()
        .trim()
        .toUpperCase()
        .regex(
          /^[A-Z]{3}$/,
          "La devise doit contenir exactement 3 lettres.",
        ),

      /*
       * Le fuseau horaire est validé après le parsing
       * avec la liste issue des pays actifs.
       */
      timezone: z
        .string()
        .trim()
        .min(
          1,
          "Le fuseau horaire est obligatoire.",
        )
        .max(
          100,
          "Le fuseau horaire est trop long.",
        ),

      dateFormat: z.enum(
        SUPPORTED_DATE_FORMATS,
        {
          message:
            "Le format de date sélectionné n’est pas pris en charge.",
        },
      ),

      theme: z.enum(
        SUPPORTED_THEMES,
        {
          message:
            "Le thème sélectionné n’est pas pris en charge.",
        },
      ),
    }),

    notifications: z.object({
      emailNotifications:
        z.boolean(),

      whatsappNotifications:
        z.boolean(),

      dashboardNotifications:
        z.boolean(),

      notifyTicketSales:
        z.boolean(),

      notifyPayments:
        z.boolean(),

      notifyRefunds:
        z.boolean(),

      notifyEventStatus:
        z.boolean(),

      notifySecurity:
        z.boolean(),
    }),

    ticketing: z.object({
      maxTicketsPerOrder: z
        .number()
        .int(
          "La limite de billets doit être un nombre entier.",
        )
        .min(
          MINIMUM_TICKETS_PER_ORDER,
          `La limite minimale est de ${MINIMUM_TICKETS_PER_ORDER} billet.`,
        )
        .max(
          MAXIMUM_TICKETS_PER_ORDER,
          `La limite maximale est de ${MAXIMUM_TICKETS_PER_ORDER} billets.`,
        ),

      showRemainingTickets:
        z.boolean(),

      allowTicketTransfer:
        z.boolean(),

      allowRefundRequests:
        z.boolean(),
    }),
  });

export type UpdateOrganizerSettingsInput =
  z.input<
    typeof updateOrganizerSettingsSchema
  >;

export type UpdateOrganizerSettingsResult = {
  message: string;

  settings: {
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

    metadata: {
      settingsId: string;
      updatedAt: string;
    };
  };
};

type UpdateOrganizerSettingsErrorParameters = {
  code: string;
  message: string;
  status?: number;
  fields?: Record<
    string,
    string[]
  >;
};

export class UpdateOrganizerSettingsError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: Record<
    string,
    string[]
  >;

  constructor({
    code,
    message,
    status = 400,
    fields,
  }: UpdateOrganizerSettingsErrorParameters) {
    super(message);

    this.name =
      "UpdateOrganizerSettingsError";

    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

type ValidatedPreferences = {
  language:
    (typeof SUPPORTED_LANGUAGES)[number];

  currency:
    SupportedCurrencyCode;

  timezone:
    string;

  dateFormat:
    (typeof SUPPORTED_DATE_FORMATS)[number];

  theme:
    (typeof SUPPORTED_THEMES)[number];
};

function flattenValidationErrors(
  error: z.ZodError,
): Record<string, string[]> {
  const fields: Record<
    string,
    string[]
  > = {};

  for (
    const issue of
    error.issues
  ) {
    const fieldPath =
      issue.path.join(".");

    const key =
      fieldPath ||
      "settings";

    if (!fields[key]) {
      fields[key] = [];
    }

    fields[key].push(
      issue.message,
    );
  }

  return fields;
}

function isValidTimeZone(
  timezone: string,
): boolean {
  try {
    new Intl.DateTimeFormat(
      "fr-FR",
      {
        timeZone:
          timezone,
      },
    ).format(new Date());

    return true;
  } catch {
    return false;
  }
}

function getSupportedTimezones(): Set<string> {
  return new Set(
    getActiveCountries().map(
      (country) =>
        country.timezone,
    ),
  );
}

function validatePreferences(
  preferences: z.output<
    typeof updateOrganizerSettingsSchema
  >["preferences"],
): ValidatedPreferences {
  const normalizedCurrency =
    preferences.currency
      .trim()
      .toUpperCase();

  if (
    !isSupportedCurrencyCode(
      normalizedCurrency,
    )
  ) {
    throw new UpdateOrganizerSettingsError({
      code:
        "UNSUPPORTED_CURRENCY",

      status: 422,

      message:
        "La devise sélectionnée n’est pas prise en charge.",

      fields: {
        "preferences.currency":
          [
            "Sélectionnez une devise disponible sur Tikemia.",
          ],
      },
    });
  }

  const currencyDefinition =
    getCurrencyDefinition(
      normalizedCurrency,
    );

  if (
    !currencyDefinition ||
    !currencyDefinition.active
  ) {
    throw new UpdateOrganizerSettingsError({
      code:
        "INACTIVE_CURRENCY",

      status: 422,

      message:
        "La devise sélectionnée n’est pas actuellement disponible.",

      fields: {
        "preferences.currency":
          [
            "Sélectionnez une devise active.",
          ],
      },
    });
  }

  const normalizedTimezone =
    preferences.timezone
      .trim();

  if (
    !isValidTimeZone(
      normalizedTimezone,
    )
  ) {
    throw new UpdateOrganizerSettingsError({
      code:
        "INVALID_TIMEZONE",

      status: 422,

      message:
        "Le fuseau horaire sélectionné n’est pas valide.",

      fields: {
        "preferences.timezone":
          [
            "Sélectionnez un fuseau horaire valide.",
          ],
      },
    });
  }

  const supportedTimezones =
    getSupportedTimezones();

  if (
    !supportedTimezones.has(
      normalizedTimezone,
    )
  ) {
    throw new UpdateOrganizerSettingsError({
      code:
        "UNSUPPORTED_TIMEZONE",

      status: 422,

      message:
        "Le fuseau horaire sélectionné n’est pas pris en charge par Tikemia.",

      fields: {
        "preferences.timezone":
          [
            "Sélectionnez un fuseau horaire proposé dans les paramètres.",
          ],
      },
    });
  }

  return {
    language:
      preferences.language,

    currency:
      normalizedCurrency,

    timezone:
      normalizedTimezone,

    dateFormat:
      preferences.dateFormat,

    theme:
      preferences.theme,
  };
}

function validateNotificationConsistency({
  emailNotifications,
  whatsappNotifications,
  dashboardNotifications,
  notifyTicketSales,
  notifyPayments,
  notifyRefunds,
  notifyEventStatus,
  notifySecurity,
}: {
  emailNotifications: boolean;
  whatsappNotifications: boolean;
  dashboardNotifications: boolean;
  notifyTicketSales: boolean;
  notifyPayments: boolean;
  notifyRefunds: boolean;
  notifyEventStatus: boolean;
  notifySecurity: boolean;
}): void {
  const hasAnyChannel =
    emailNotifications ||
    whatsappNotifications ||
    dashboardNotifications;

  const hasAnyNotificationType =
    notifyTicketSales ||
    notifyPayments ||
    notifyRefunds ||
    notifyEventStatus ||
    notifySecurity;

  /*
   * L’organisateur peut désactiver toutes les notifications.
   * On bloque uniquement un état incohérent dans lequel
   * des types sont actifs, mais aucun canal ne peut les recevoir.
   */
  if (
    hasAnyNotificationType &&
    !hasAnyChannel
  ) {
    throw new UpdateOrganizerSettingsError({
      code:
        "NOTIFICATION_CHANNEL_REQUIRED",

      status: 422,

      message:
        "Activez au moins un canal de notification ou désactivez les types de notifications sélectionnés.",

      fields: {
        "notifications.emailNotifications":
          [
            "Activez au moins un canal de notification.",
          ],

        "notifications.whatsappNotifications":
          [
            "Activez au moins un canal de notification.",
          ],

        "notifications.dashboardNotifications":
          [
            "Activez au moins un canal de notification.",
          ],
      },
    });
  }
}

export async function updateOrganizerSettings(
  input: UpdateOrganizerSettingsInput,
): Promise<UpdateOrganizerSettingsResult> {
  const validation =
    updateOrganizerSettingsSchema.safeParse(
      input,
    );

  if (
    !validation.success
  ) {
    throw new UpdateOrganizerSettingsError({
      code:
        "VALIDATION_ERROR",

      status: 422,

      message:
        "Certains paramètres sont invalides.",

      fields:
        flattenValidationErrors(
          validation.error,
        ),
    });
  }

  const data =
    validation.data;

  const validatedPreferences =
    validatePreferences(
      data.preferences,
    );

  validateNotificationConsistency(
    data.notifications,
  );

  try {
    const organizer =
      await prisma.user.findFirst(
        {
          where: {
            id:
              data.organizerId,

            role:
              "ORGANIZER",
          },

          select: {
            id:
              true,

            isActive:
              true,

            emailVerified:
              true,
          },
        },
      );

    if (!organizer) {
      throw new UpdateOrganizerSettingsError({
        code:
          "ORGANIZER_NOT_FOUND",

        status: 404,

        message:
          "Le compte organisateur est introuvable.",
      });
    }

    if (
      !organizer.isActive
    ) {
      throw new UpdateOrganizerSettingsError({
        code:
          "ORGANIZER_DISABLED",

        status: 403,

        message:
          "Ce compte organisateur est désactivé.",
      });
    }

    if (
      !organizer.emailVerified
    ) {
      throw new UpdateOrganizerSettingsError({
        code:
          "EMAIL_NOT_VERIFIED",

        status: 403,

        message:
          "Votre adresse e-mail doit être vérifiée avant de modifier les paramètres.",
      });
    }

    const settingsData = {
      language:
        validatedPreferences.language,

      currency:
        validatedPreferences.currency,

      timezone:
        validatedPreferences.timezone,

      dateFormat:
        validatedPreferences.dateFormat,

      theme:
        validatedPreferences.theme,

      emailNotifications:
        data.notifications
          .emailNotifications,

      whatsappNotifications:
        data.notifications
          .whatsappNotifications,

      dashboardNotifications:
        data.notifications
          .dashboardNotifications,

      notifyTicketSales:
        data.notifications
          .notifyTicketSales,

      notifyPayments:
        data.notifications
          .notifyPayments,

      notifyRefunds:
        data.notifications
          .notifyRefunds,

      notifyEventStatus:
        data.notifications
          .notifyEventStatus,

      notifySecurity:
        data.notifications
          .notifySecurity,

      maxTicketsPerOrder:
        data.ticketing
          .maxTicketsPerOrder,

      showRemainingTickets:
        data.ticketing
          .showRemainingTickets,

      allowTicketTransfer:
        data.ticketing
          .allowTicketTransfer,

      allowRefundRequests:
        data.ticketing
          .allowRefundRequests,
    };

    const updatedSettings =
      await prisma.organizerSettings.upsert(
        {
          where: {
            organizerId:
              organizer.id,
          },

          create: {
            organizerId:
              organizer.id,

            ...settingsData,
          },

          update:
            settingsData,

          select: {
            id:
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

            updatedAt:
              true,
          },
        },
      );

    /*
     * La devise enregistrée vient du catalogue central et a déjà
     * été validée. Le cast est donc sûr à cet endroit précis.
     */
    const updatedCurrency =
      updatedSettings.currency as SupportedCurrencyCode;

    return {
      message:
        "Vos paramètres organisateur ont été mis à jour avec succès.",

      settings: {
        preferences: {
          language:
            updatedSettings.language,

          currency:
            updatedCurrency,

          timezone:
            updatedSettings.timezone,

          dateFormat:
            updatedSettings.dateFormat,

          theme:
            updatedSettings.theme,
        },

        notifications: {
          emailNotifications:
            updatedSettings.emailNotifications,

          whatsappNotifications:
            updatedSettings.whatsappNotifications,

          dashboardNotifications:
            updatedSettings.dashboardNotifications,

          notifyTicketSales:
            updatedSettings.notifyTicketSales,

          notifyPayments:
            updatedSettings.notifyPayments,

          notifyRefunds:
            updatedSettings.notifyRefunds,

          notifyEventStatus:
            updatedSettings.notifyEventStatus,

          notifySecurity:
            updatedSettings.notifySecurity,
        },

        ticketing: {
          maxTicketsPerOrder:
            updatedSettings.maxTicketsPerOrder,

          showRemainingTickets:
            updatedSettings.showRemainingTickets,

          allowTicketTransfer:
            updatedSettings.allowTicketTransfer,

          allowRefundRequests:
            updatedSettings.allowRefundRequests,
        },

        metadata: {
          settingsId:
            updatedSettings.id,

          updatedAt:
            updatedSettings.updatedAt.toISOString(),
        },
      },
    };
  } catch (error) {
    if (
      error instanceof
      UpdateOrganizerSettingsError
    ) {
      throw error;
    }

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code ===
        "P2025"
    ) {
      throw new UpdateOrganizerSettingsError({
        code:
          "ORGANIZER_NOT_FOUND",

        status: 404,

        message:
          "Le compte organisateur est introuvable.",
      });
    }

    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code ===
        "P2002"
    ) {
      throw new UpdateOrganizerSettingsError({
        code:
          "ORGANIZER_SETTINGS_ALREADY_EXIST",

        status: 409,

        message:
          "Les paramètres de cet organisateur existent déjà et n’ont pas pu être synchronisés.",
      });
    }

    console.error(
      "[UPDATE_ORGANIZER_SETTINGS_ERROR]",
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

    throw new UpdateOrganizerSettingsError({
      code:
        "UPDATE_ORGANIZER_SETTINGS_FAILED",

      status: 500,

      message:
        "Impossible de mettre à jour vos paramètres pour le moment.",
    });
  }
}