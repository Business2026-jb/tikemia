export const SUPPORTED_LOCALES = [
  "fr",
  "en",
] as const;

export type AppLocale =
  (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale =
  "fr";

export const LOCALE_COOKIE_NAME =
  "tikemia_locale";

export const LOCALE_COOKIE_MAX_AGE =
  60 * 60 * 24 * 365;

export function isSupportedLocale(
  value:
    string | null | undefined,
): value is AppLocale {
  if (
    !value
  ) {
    return false;
  }

  return SUPPORTED_LOCALES.includes(
    value as AppLocale,
  );
}

export function normalizeLocale(
  value:
    string | null | undefined,
): AppLocale {
  return isSupportedLocale(
    value,
  )
    ? value
    : DEFAULT_LOCALE;
}