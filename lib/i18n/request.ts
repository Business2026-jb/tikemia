import {
  cookies,
} from "next/headers";

import {
  getRequestConfig,
} from "next-intl/server";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  normalizeLocale,
  type AppLocale,
} from "@/lib/i18n/config";

async function loadMessages(
  locale:
    AppLocale,
) {
  switch (
    locale
  ) {
    case "en":
      return (
        await import(
          "@/messages/en.json"
        )
      ).default;

    case "fr":
    default:
      return (
        await import(
          "@/messages/fr.json"
        )
      ).default;
  }
}

export default getRequestConfig(
  async () => {
    const cookieStore =
      await cookies();

    const cookieLocale =
      cookieStore.get(
        LOCALE_COOKIE_NAME,
      )?.value;

    const locale =
      normalizeLocale(
        cookieLocale,
      );

    const messages =
      await loadMessages(
        locale,
      );

    return {
      locale:
        locale ??
        DEFAULT_LOCALE,

      messages,
    };
  },
);