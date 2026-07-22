import {
  DEFAULT_CURRENCY_CODE,
  getCurrencyDefinition,
  isSupportedCurrencyCode,
  type SupportedCurrencyCode,
} from "@/lib/localization/currencies";

export type MoneyAmount =
  | number
  | string
  | bigint
  | {
      toString(): string;
    };

export type FormatMoneyOptions = {
  amount: MoneyAmount;
  currency?: string | null;
  locale?: string | null;

  /**
   * Affiche le code ISO lorsque le symbole peut être ambigu.
   *
   * Exemple :
   * 10 000 XOF
   * 25 EUR
   */
  display?: "symbol" | "code" | "name";

  /**
   * Permet de remplacer le nombre de décimales défini
   * dans le catalogue central des devises.
   */
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;

  /**
   * Valeur utilisée lorsque le montant reçu est invalide.
   */
  fallbackAmount?: number;

  /**
   * Retourne uniquement la valeur formatée sans symbole
   * ni code monétaire.
   */
  withoutCurrency?: boolean;
};

export type MoneyValue = {
  amount: number;
  currency: SupportedCurrencyCode;
};

export type CurrencyTotal = {
  currency: SupportedCurrencyCode;
  amount: number;
  formatted: string;
};

const DEFAULT_LOCALE = "fr-FR";

function normalizeLocale(
  locale: string | null | undefined,
): string {
  const normalizedLocale =
    locale?.trim() ?? "";

  return normalizedLocale || DEFAULT_LOCALE;
}

function normalizeMoneyAmount(
  value: MoneyAmount,
  fallbackAmount = 0,
): number {
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : fallbackAmount;
  }

  if (typeof value === "bigint") {
    const convertedValue =
      Number(value);

    return Number.isFinite(
      convertedValue,
    )
      ? convertedValue
      : fallbackAmount;
  }

  const normalizedValue =
    String(value)
      .trim()
      .replace(/\s/g, "")
      .replace(",", ".");

  if (!normalizedValue) {
    return fallbackAmount;
  }

  const parsedValue =
    Number(normalizedValue);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : fallbackAmount;
}

function resolveCurrencyCode(
  currency: string | null | undefined,
): SupportedCurrencyCode {
  const normalizedCurrency =
    currency
      ?.trim()
      .toUpperCase();

  if (
    normalizedCurrency &&
    isSupportedCurrencyCode(
      normalizedCurrency,
    )
  ) {
    return normalizedCurrency;
  }

  return DEFAULT_CURRENCY_CODE;
}

function clampFractionDigits(
  value: number,
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(
    Math.max(
      Math.trunc(value),
      0,
    ),
    20,
  );
}

/**
 * Formate un montant avec sa devise.
 *
 * Exemple :
 *
 * formatMoney({
 *   amount: 15000,
 *   currency: "XOF",
 * });
 *
 * Résultat :
 * 15 000 F CFA
 */
export function formatMoney({
  amount,
  currency = DEFAULT_CURRENCY_CODE,
  locale = DEFAULT_LOCALE,
  display = "symbol",
  minimumFractionDigits,
  maximumFractionDigits,
  fallbackAmount = 0,
  withoutCurrency = false,
}: FormatMoneyOptions): string {
  const resolvedCurrency =
    resolveCurrencyCode(currency);

  const definition =
    getCurrencyDefinition(
      resolvedCurrency,
    );

  const defaultDecimals =
    definition?.decimals ?? 2;

  const normalizedMinimumFractionDigits =
    minimumFractionDigits ===
    undefined
      ? defaultDecimals
      : clampFractionDigits(
          minimumFractionDigits,
        );

  const normalizedMaximumFractionDigits =
    maximumFractionDigits ===
    undefined
      ? defaultDecimals
      : clampFractionDigits(
          maximumFractionDigits,
        );

  const safeMaximumFractionDigits =
    Math.max(
      normalizedMinimumFractionDigits,
      normalizedMaximumFractionDigits,
    );

  const normalizedAmount =
    normalizeMoneyAmount(
      amount,
      fallbackAmount,
    );

  const normalizedLocale =
    normalizeLocale(locale);

  try {
    if (withoutCurrency) {
      return new Intl.NumberFormat(
        normalizedLocale,
        {
          minimumFractionDigits:
            normalizedMinimumFractionDigits,

          maximumFractionDigits:
            safeMaximumFractionDigits,
        },
      ).format(normalizedAmount);
    }

    return new Intl.NumberFormat(
      normalizedLocale,
      {
        style: "currency",

        currency:
          resolvedCurrency,

        currencyDisplay:
          display,

        minimumFractionDigits:
          normalizedMinimumFractionDigits,

        maximumFractionDigits:
          safeMaximumFractionDigits,
      },
    ).format(normalizedAmount);
  } catch {
    const fallbackNumber =
      new Intl.NumberFormat(
        DEFAULT_LOCALE,
        {
          minimumFractionDigits:
            normalizedMinimumFractionDigits,

          maximumFractionDigits:
            safeMaximumFractionDigits,
        },
      ).format(normalizedAmount);

    if (withoutCurrency) {
      return fallbackNumber;
    }

    const currencyLabel =
      display === "name"
        ? definition?.name ??
          resolvedCurrency
        : display === "code"
          ? resolvedCurrency
          : definition?.symbol ??
            resolvedCurrency;

    return `${fallbackNumber} ${currencyLabel}`;
  }
}

/**
 * Version courte lorsque la fonction est appelée
 * avec trois arguments simples.
 *
 * Exemple :
 *
 * formatCurrencyAmount(
 *   10000,
 *   "XOF",
 *   "fr-BJ",
 * );
 */
export function formatCurrencyAmount(
  amount: MoneyAmount,
  currency: string,
  locale = DEFAULT_LOCALE,
): string {
  return formatMoney({
    amount,
    currency,
    locale,
  });
}

/**
 * Formate un montant avec le code ISO visible.
 *
 * Exemple :
 * 15 000 XOF
 */
export function formatMoneyWithCode({
  amount,
  currency,
  locale,
}: {
  amount: MoneyAmount;
  currency: string;
  locale?: string | null;
}): string {
  return formatMoney({
    amount,
    currency,
    locale,
    display: "code",
  });
}

/**
 * Formate seulement la partie numérique.
 *
 * Exemple :
 * 15 000
 */
export function formatMoneyNumber({
  amount,
  currency,
  locale,
}: {
  amount: MoneyAmount;
  currency?: string | null;
  locale?: string | null;
}): string {
  return formatMoney({
    amount,
    currency,
    locale,
    withoutCurrency: true,
  });
}

/**
 * Retourne le symbole d’une devise.
 */
export function getCurrencySymbol(
  currency: string,
): string {
  const resolvedCurrency =
    resolveCurrencyCode(currency);

  return (
    getCurrencyDefinition(
      resolvedCurrency,
    )?.symbol ??
    resolvedCurrency
  );
}

/**
 * Retourne le nombre de décimales officielles
 * configurées pour une devise.
 */
export function getCurrencyDecimals(
  currency: string,
): number {
  const resolvedCurrency =
    resolveCurrencyCode(currency);

  return (
    getCurrencyDefinition(
      resolvedCurrency,
    )?.decimals ?? 2
  );
}

/**
 * Arrondit un montant selon le nombre de décimales
 * configuré pour la devise.
 *
 * XOF :
 * 1500.75 devient 1501
 *
 * EUR :
 * 15.256 devient 15.26
 */
export function roundMoneyAmount({
  amount,
  currency,
}: {
  amount: MoneyAmount;
  currency: string;
}): number {
  const normalizedAmount =
    normalizeMoneyAmount(amount);

  const decimals =
    getCurrencyDecimals(
      currency,
    );

  const multiplier =
    10 ** decimals;

  return (
    Math.round(
      (normalizedAmount +
        Number.EPSILON) *
        multiplier,
    ) / multiplier
  );
}

/**
 * Transforme un montant dans son unité mineure.
 *
 * Exemples :
 *
 * 10 EUR devient 1000 centimes.
 * 10 XOF reste 10 car XOF utilise 0 décimale.
 */
export function toMinorCurrencyUnit({
  amount,
  currency,
}: {
  amount: MoneyAmount;
  currency: string;
}): number {
  const resolvedCurrency =
    resolveCurrencyCode(currency);

  const decimals =
    getCurrencyDecimals(
      resolvedCurrency,
    );

  const normalizedAmount =
    roundMoneyAmount({
      amount,
      currency:
        resolvedCurrency,
    });

  return Math.round(
    normalizedAmount *
      10 ** decimals,
  );
}

/**
 * Transforme une unité mineure en montant principal.
 *
 * Exemples :
 *
 * 1000 centimes EUR devient 10 EUR.
 * 1000 XOF reste 1000 XOF.
 */
export function fromMinorCurrencyUnit({
  amount,
  currency,
}: {
  amount: MoneyAmount;
  currency: string;
}): number {
  const resolvedCurrency =
    resolveCurrencyCode(currency);

  const decimals =
    getCurrencyDecimals(
      resolvedCurrency,
    );

  const normalizedAmount =
    normalizeMoneyAmount(amount);

  return roundMoneyAmount({
    amount:
      normalizedAmount /
      10 ** decimals,

    currency:
      resolvedCurrency,
  });
}

/**
 * Vérifie que deux montants utilisent la même devise.
 */
export function haveSameCurrency(
  firstCurrency: string,
  secondCurrency: string,
): boolean {
  const first =
    resolveCurrencyCode(
      firstCurrency,
    );

  const second =
    resolveCurrencyCode(
      secondCurrency,
    );

  return first === second;
}

/**
 * Additionne plusieurs montants uniquement lorsqu’ils
 * utilisent tous la même devise.
 *
 * Une erreur est levée si plusieurs devises sont mélangées.
 */
export function sumMoneyValues(
  values: readonly MoneyValue[],
): MoneyValue {
  if (values.length === 0) {
    return {
      amount: 0,
      currency:
        DEFAULT_CURRENCY_CODE,
    };
  }

  const currency =
    values[0].currency;

  for (const value of values) {
    if (
      value.currency !== currency
    ) {
      throw new Error(
        "Impossible d’additionner des montants utilisant des devises différentes.",
      );
    }
  }

  const total =
    values.reduce(
      (sum, value) =>
        sum +
        normalizeMoneyAmount(
          value.amount,
        ),
      0,
    );

  return {
    amount:
      roundMoneyAmount({
        amount: total,
        currency,
      }),

    currency,
  };
}

/**
 * Regroupe des montants par devise.
 *
 * Cette fonction est importante pour le dashboard.
 * Elle évite d’additionner directement XOF, EUR, NGN
 * ou toute autre devise différente.
 */
export function groupMoneyByCurrency(
  values: readonly MoneyValue[],
  locale = DEFAULT_LOCALE,
): CurrencyTotal[] {
  const totals =
    new Map<
      SupportedCurrencyCode,
      number
    >();

  for (const value of values) {
    const currency =
      resolveCurrencyCode(
        value.currency,
      );

    const currentTotal =
      totals.get(currency) ?? 0;

    totals.set(
      currency,
      currentTotal +
        normalizeMoneyAmount(
          value.amount,
        ),
    );
  }

  return Array.from(
    totals.entries(),
  )
    .map(
      ([currency, amount]) => {
        const roundedAmount =
          roundMoneyAmount({
            amount,
            currency,
          });

        return {
          currency,
          amount:
            roundedAmount,

          formatted:
            formatMoney({
              amount:
                roundedAmount,

              currency,
              locale,
            }),
        };
      },
    )
    .sort(
      (first, second) =>
        first.currency.localeCompare(
          second.currency,
        ),
    );
}

/**
 * Vérifie si un montant est positif ou nul.
 */
export function isValidMoneyAmount(
  amount: MoneyAmount,
): boolean {
  const normalizedAmount =
    normalizeMoneyAmount(
      amount,
      Number.NaN,
    );

  return (
    Number.isFinite(
      normalizedAmount,
    ) &&
    normalizedAmount >= 0
  );
}

/**
 * Vérifie si un montant est strictement positif.
 */
export function isPositiveMoneyAmount(
  amount: MoneyAmount,
): boolean {
  const normalizedAmount =
    normalizeMoneyAmount(
      amount,
      Number.NaN,
    );

  return (
    Number.isFinite(
      normalizedAmount,
    ) &&
    normalizedAmount > 0
  );
}