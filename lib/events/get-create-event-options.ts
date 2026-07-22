import "server-only";

import {
  DEFAULT_EVENT_CURRENCY,
  TIKEMIA_PLATFORM_FEE_PERCENT,
} from "@/lib/events/pricing";
import {
  getActiveCountries,
  getCountryByCode,
  type SupportedContinent,
} from "@/lib/localization/countries";
import {
  DEFAULT_CURRENCY_CODE,
  getActiveCurrencies,
  getCurrencyDefinition,
  isSupportedCurrencyCode,
  type CurrencyRegion,
  type SupportedCurrencyCode,
} from "@/lib/localization/currencies";
import { prisma } from "@/lib/prisma";

const MAX_TICKET_TYPES = 20;
const MAX_EVENT_CAPACITY = 1_000_000;
const DEFAULT_MAX_PER_ORDER = 10;
const MAX_PER_ORDER_LIMIT = 100;

const MINIMUM_TITLE_LENGTH = 3;
const MAXIMUM_TITLE_LENGTH = 140;

const MINIMUM_DESCRIPTION_LENGTH = 30;
const MAXIMUM_DESCRIPTION_LENGTH = 20_000;

export type CreateEventCategoryOption = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
};

export type CreateEventCountryOption = {
  name: string;
  code: string;
  dialCode: string;

  currency: SupportedCurrencyCode;
  currencyName: string;
  currencySymbol: string;

  timezone: string;
  locale: string;
  continent: SupportedContinent;

  label: string;
};

export type CreateEventCurrencyOption = {
  code: SupportedCurrencyCode;
  name: string;
  symbol: string;

  /**
   * Conservé avec ce nom pour rester compatible
   * avec les formulaires déjà créés.
   */
  fractionDigits: number;

  region: CurrencyRegion;
  countryCodes: readonly string[];

  label: string;
};

export type CreateEventOptions = {
  categories: CreateEventCategoryOption[];

  countries: CreateEventCountryOption[];

  currencies: CreateEventCurrencyOption[];

  rules: {
    platformFeePercent: number;
    defaultCurrency: SupportedCurrencyCode;

    maxTicketTypes: number;
    maxEventCapacity: number;

    defaultMaxPerOrder: number;
    maxPerOrderLimit: number;

    minimumTitleLength: number;
    maximumTitleLength: number;

    minimumDescriptionLength: number;
    maximumDescriptionLength: number;
  };
};

type GetCreateEventOptionsErrorParameters = {
  code: string;
  message: string;
  status?: number;
};

export class GetCreateEventOptionsError extends Error {
  readonly code: string;
  readonly status: number;

  constructor({
    code,
    message,
    status = 500,
  }: GetCreateEventOptionsErrorParameters) {
    super(message);

    this.name =
      "GetCreateEventOptionsError";

    this.code = code;
    this.status = status;
  }
}

function resolveDefaultEventCurrency(): SupportedCurrencyCode {
  const normalizedCurrency =
    String(
      DEFAULT_EVENT_CURRENCY,
    )
      .trim()
      .toUpperCase();

  if (
    isSupportedCurrencyCode(
      normalizedCurrency,
    )
  ) {
    const definition =
      getCurrencyDefinition(
        normalizedCurrency,
      );

    if (
      definition?.active
    ) {
      return normalizedCurrency;
    }
  }

  return DEFAULT_CURRENCY_CODE;
}

function buildCountryOptions(): CreateEventCountryOption[] {
  return getActiveCountries().map(
    (country) => {
      const currency =
        getCurrencyDefinition(
          country.currency,
        );

      return {
        name:
          country.name,

        code:
          country.code,

        dialCode:
          country.dialCode,

        currency:
          country.currency,

        currencyName:
          currency?.name ??
          country.currency,

        currencySymbol:
          currency?.symbol ??
          country.currency,

        timezone:
          country.timezone,

        locale:
          country.locale,

        continent:
          country.continent,

        label:
          `${country.name} — ${country.currency}`,
      };
    },
  );
}

function buildCurrencyOptions(): CreateEventCurrencyOption[] {
  return getActiveCurrencies().map(
    (currency) => ({
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

      countryCodes:
        currency.countryCodes,

      label:
        `${currency.name} — ${currency.code}`,
    }),
  );
}

export async function getCreateEventOptions(): Promise<CreateEventOptions> {
  try {
    const categories =
      await prisma.eventCategory.findMany(
        {
          where: {
            isActive: true,
          },

          orderBy: [
            {
              name: "asc",
            },
          ],

          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            icon: true,
          },
        },
      );

    if (
      categories.length === 0
    ) {
      throw new GetCreateEventOptionsError(
        {
          code:
            "NO_ACTIVE_EVENT_CATEGORY",

          status: 503,

          message:
            "Aucune catégorie active n’est disponible. Exécutez le seed des catégories Tikemia.",
        },
      );
    }

    const countries =
      buildCountryOptions();

    const currencies =
      buildCurrencyOptions();

    if (
      countries.length === 0
    ) {
      throw new GetCreateEventOptionsError(
        {
          code:
            "NO_ACTIVE_COUNTRY",

          status: 503,

          message:
            "Aucun pays actif n’est disponible pour la création d’événement.",
        },
      );
    }

    if (
      currencies.length === 0
    ) {
      throw new GetCreateEventOptionsError(
        {
          code:
            "NO_ACTIVE_CURRENCY",

          status: 503,

          message:
            "Aucune devise active n’est disponible pour la création d’événement.",
        },
      );
    }

    return {
      categories,

      countries,

      currencies,

      rules: {
        platformFeePercent:
          TIKEMIA_PLATFORM_FEE_PERCENT,

        defaultCurrency:
          resolveDefaultEventCurrency(),

        maxTicketTypes:
          MAX_TICKET_TYPES,

        maxEventCapacity:
          MAX_EVENT_CAPACITY,

        defaultMaxPerOrder:
          DEFAULT_MAX_PER_ORDER,

        maxPerOrderLimit:
          MAX_PER_ORDER_LIMIT,

        minimumTitleLength:
          MINIMUM_TITLE_LENGTH,

        maximumTitleLength:
          MAXIMUM_TITLE_LENGTH,

        minimumDescriptionLength:
          MINIMUM_DESCRIPTION_LENGTH,

        maximumDescriptionLength:
          MAXIMUM_DESCRIPTION_LENGTH,
      },
    };
  } catch (error) {
    if (
      error instanceof
      GetCreateEventOptionsError
    ) {
      throw error;
    }

    console.error(
      "[GET_CREATE_EVENT_OPTIONS_ERROR]",
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

    throw new GetCreateEventOptionsError(
      {
        code:
          "GET_CREATE_EVENT_OPTIONS_FAILED",

        status: 500,

        message:
          "Impossible de charger les options de création d’événement.",
      },
    );
  }
}

export function getCountryOptionByCode(
  countryCode: string,
): CreateEventCountryOption | null {
  const country =
    getCountryByCode(
      countryCode,
    );

  if (
    !country ||
    !country.active
  ) {
    return null;
  }

  const currency =
    getCurrencyDefinition(
      country.currency,
    );

  if (
    !currency ||
    !currency.active
  ) {
    return null;
  }

  return {
    name:
      country.name,

    code:
      country.code,

    dialCode:
      country.dialCode,

    currency:
      country.currency,

    currencyName:
      currency.name,

    currencySymbol:
      currency.symbol,

    timezone:
      country.timezone,

    locale:
      country.locale,

    continent:
      country.continent,

    label:
      `${country.name} — ${country.currency}`,
  };
}

export function getCurrencyOptionByCode(
  currencyCode: string,
): CreateEventCurrencyOption | null {
  const normalizedCurrency =
    currencyCode
      .trim()
      .toUpperCase();

  if (
    !isSupportedCurrencyCode(
      normalizedCurrency,
    )
  ) {
    return null;
  }

  const currency =
    getCurrencyDefinition(
      normalizedCurrency,
    );

  if (
    !currency ||
    !currency.active
  ) {
    return null;
  }

  return {
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

    countryCodes:
      currency.countryCodes,

    label:
      `${currency.name} — ${currency.code}`,
  };
}

export function isSupportedEventCurrency(
  currency: string,
): currency is SupportedCurrencyCode {
  const normalizedCurrency =
    currency
      .trim()
      .toUpperCase();

  if (
    !isSupportedCurrencyCode(
      normalizedCurrency,
    )
  ) {
    return false;
  }

  const definition =
    getCurrencyDefinition(
      normalizedCurrency,
    );

  return Boolean(
    definition?.active,
  );
}

export function getRecommendedCurrencyForCountry(
  countryCode: string,
): SupportedCurrencyCode {
  const country =
    getCountryOptionByCode(
      countryCode,
    );

  return (
    country?.currency ??
    resolveDefaultEventCurrency()
  );
}

export function getRecommendedTimezoneForCountry(
  countryCode: string,
): string {
  const country =
    getCountryOptionByCode(
      countryCode,
    );

  return (
    country?.timezone ??
    "Africa/Porto-Novo"
  );
}