
/**
 * ============================================
 * TIKEMIA — CONFIGURATION INTERNATIONALE
 * ============================================
 *
 * Langues officielles :
 * - Français (fr) : langue par défaut
 * - Anglais (en) : seconde langue
 *
 * Configuration commune à toute la plateforme.
 * Compatible Next.js App Router / TypeScript.
 *
 * Aucun accès direct au navigateur dans ce fichier.
 * Utilisable côté serveur et côté client.
 * ============================================
 */

/* ============================================
   1. LANGUES AUTORISÉES
============================================ */

export const locales = ["fr", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";

/** Devises proposées dans le même ordre sur toute la plateforme. */
export const SUPPORTED_CURRENCIES = ["XOF", "XAF", "NGN", "ZAR", "EUR", "USD", "GHS", "GNF"] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export function currencyDecimals(currency: string): number {
  if (["XOF", "XAF", "GNF"].includes(currency)) return 0;
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function currencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    XOF: "FCFA", XAF: "FCFA (BEAC)", NGN: "₦", ZAR: "R",
    EUR: "€", USD: "$", GHS: "₵", GNF: "GNF",
  };
  return symbols[currency] ?? currency;
}

export function currencyLabel(currency: string, locale: string = "fr"): string {
  const labels: Record<string, readonly [string, string]> = {
    XOF: ["FCFA (BCEAO)", "FCFA (BCEAO)"],
    XAF: ["FCFA (BEAC)", "FCFA (BEAC)"],
    NGN: ["Naira (₦)", "Naira (₦)"],
    ZAR: ["Rand (R)", "Rand (R)"],
    EUR: ["Euro (€)", "Euro (€)"],
    USD: ["Dollar US ($)", "US dollar ($)"],
    GHS: ["Cedi ghanéen (₵)", "Ghanaian cedi (₵)"],
    GNF: ["Franc guinéen (GNF)", "Guinean franc (GNF)"],
  };
  return labels[currency]?.[locale === "en" ? 1 : 0] ?? currency;
}

/** Formate les unités mineures sans conversion flottante ni conversion de devise. */
export function formatMinorMoney(amountMinor: string | bigint, currency: string, locale: string = "fr"): string {
  try {
    const amount = BigInt(amountMinor);
    const digits = currencyDecimals(currency);
    const divisor = 10n ** BigInt(digits);
    const absolute = amount < 0n ? -amount : amount;
    const language = locale === "en" ? "en-US" : "fr-FR";
    const whole = new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(absolute / divisor);
    const separator = new Intl.NumberFormat(language).formatToParts(1.1).find(part => part.type === "decimal")?.value ?? ".";
    const fraction = digits ? separator + (absolute % divisor).toString().padStart(digits, "0") : "";
    return `${amount < 0n ? "-" : ""}${whole}${fraction} ${currencySymbol(currency)}`;
  } catch {
    return "—";
  }
}

/* ============================================
   2. INFORMATIONS SUR LES LANGUES
============================================ */

export const localeDetails = {
  fr: {
    code: "fr",
    name: "Français",
    nativeName: "Français",
    shortName: "FR",
    htmlLang: "fr",
    intlLocale: "fr-FR",
    direction: "ltr",
  },

  en: {
    code: "en",
    name: "Anglais",
    nativeName: "English",
    shortName: "EN",
    htmlLang: "en",
    intlLocale: "en-GB",
    direction: "ltr",
  },
} as const;

/* ============================================
   3. PARAMÈTRES GÉNÉRAUX
============================================ */

export const i18nConfig = {
  locales,
  defaultLocale,
  localeDetails,

  // Langue par défaut si aucune préférence.
  fallbackLocale: defaultLocale,

  // Noms réservés pour les préférences.
  cookieName: "tikemia_locale",
  storageKey: "tikemia_locale",

  // Durée suggérée : 1 an.
  cookieMaxAge: 60 * 60 * 24 * 365,

  // Préfixes possibles pour les futures URL.
  localePrefix: {
    fr: "/fr",
    en: "/en",
  },

  // Langues écrites de gauche à droite.
  defaultDirection: "ltr",
} as const;

/* ============================================
   4. VÉRIFIER UNE LANGUE
============================================ */

/**
 * Vérifie que la valeur est une langue
 * officiellement prise en charge.
 *
 * Exemples :
 * isLocale("fr") = true
 * isLocale("en") = true
 * isLocale("de") = false
 */

export function isLocale(
  value: unknown
): value is Locale {
  return (
    typeof value === "string" &&
    locales.some((locale) => locale === value)
  );
}

/* ============================================
   5. NORMALISER UNE LANGUE
============================================ */

/**
 * Accepte :
 * fr, FR, fr-FR, fr_BE
 * en, EN, en-US, en_GB
 *
 * Toute autre langue revient au français.
 */

export function normalizeLocale(
  value: unknown
): Locale {
  if (typeof value !== "string") {
    return defaultLocale;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");

  const baseLanguage = normalized.split("-")[0];

  return isLocale(baseLanguage)
    ? baseLanguage
    : defaultLocale;
}

/* ============================================
   6. INFORMATIONS D'UNE LANGUE
============================================ */

export function getLocaleDetails(
  locale: unknown
) {
  const safeLocale = normalizeLocale(locale);

  return localeDetails[safeLocale];
}

/* ============================================
   7. LANGUE DU NAVIGATEUR
============================================ */

/**
 * Analyse une liste de langues du navigateur.
 *
 * Exemple :
 * "en-US,en;q=0.9,fr;q=0.8"
 *
 * Retourne "en" si l'anglais est prioritaire.
 * Retourne "fr" si aucune langue compatible.
 */

export function detectLocaleFromHeader(
  acceptLanguage: string | null | undefined
): Locale {
  if (!acceptLanguage) {
    return defaultLocale;
  }

  const candidates = acceptLanguage
    .split(",")
    .map((entry, index) => {
      const [language, ...parameters] = entry
        .trim()
        .split(";");

      const qualityParameter = parameters.find(
        (parameter) =>
          parameter.trim().startsWith("q=")
      );

      const qualityValue = qualityParameter
        ? Number(
            qualityParameter
              .trim()
              .slice(2)
          )
        : 1;

      const quality =
        Number.isFinite(qualityValue) &&
        qualityValue >= 0 &&
        qualityValue <= 1
          ? qualityValue
          : 0;

      return {
        language: language.trim(),
        quality,
        index,
      };
    })
    .filter(
      (candidate) =>
        candidate.language.length > 0 &&
        candidate.quality > 0
    )
    .sort(
      (a, b) =>
        b.quality - a.quality ||
        a.index - b.index
    );

  for (const candidate of candidates) {
    const baseLanguage = candidate.language
      .toLowerCase()
      .replace(/_/g, "-")
      .split("-")[0];

    if (isLocale(baseLanguage)) {
      return baseLanguage;
    }
  }

  return defaultLocale;
}

/* ============================================
   8. RÉSOUDRE LA LANGUE ACTIVE
============================================ */

/**
 * Ordre de priorité :
 *
 * 1. Langue explicitement choisie
 * 2. Préférence déjà enregistrée
 * 3. Langue du navigateur (si activée)
 * 4. Français par défaut
 */

export function resolveLocale({
  selectedLocale,
  savedLocale,
  browserLanguage,
  useBrowserLanguage = false,
}: {
  selectedLocale?: unknown;
  savedLocale?: unknown;
  browserLanguage?: string | null;
  useBrowserLanguage?: boolean;
} = {}): Locale {
  if (
    typeof selectedLocale === "string" &&
    selectedLocale.trim() !== ""
  ) {
    const baseLanguage = selectedLocale
      .trim()
      .toLowerCase()
      .replace(/_/g, "-")
      .split("-")[0];

    if (isLocale(baseLanguage)) {
      return baseLanguage;
    }
  }

  if (
    typeof savedLocale === "string" &&
    savedLocale.trim() !== ""
  ) {
    const baseLanguage = savedLocale
      .trim()
      .toLowerCase()
      .replace(/_/g, "-")
      .split("-")[0];

    if (isLocale(baseLanguage)) {
      return baseLanguage;
    }
  }

  if (useBrowserLanguage) {
    return detectLocaleFromHeader(
      browserLanguage
    );
  }

  return defaultLocale;
}

/* ============================================
   9. CRÉER DES CHEMINS MULTILINGUES
============================================ */

/**
 * Prépare les futurs chemins :
 *
 * /fr/organizer
 * /en/organizer
 *
 * Le préfixage des routes devra être
 * activé dans l'architecture Next.js.
 */

export function getLocalizedPath(
  pathname: string,
  locale: Locale
): string {
  const safeLocale = normalizeLocale(locale);

  const normalizedPath = pathname.startsWith("/")
    ? pathname
    : `/${pathname}`;

  const segments = normalizedPath
    .split("/")
    .filter(Boolean);

  if (
    segments.length > 0 &&
    isLocale(segments[0])
  ) {
    segments.shift();
  }

  const remainingPath = segments.join("/");

  return remainingPath
    ? `/${safeLocale}/${remainingPath}`
    : `/${safeLocale}`;
}

/* ============================================
   10. FORMATAGE DES NOMBRES
============================================ */

export function formatNumber(
  value: number,
  locale: Locale = defaultLocale
): string {
  return new Intl.NumberFormat(
    localeDetails[locale].intlLocale
  ).format(value);
}

/* ============================================
   11. FORMATAGE DES MONTANTS
============================================ */

/**
 * Exemple :
 *
 * formatMoney(25000, "XOF", "fr")
 * formatMoney(25000, "XOF", "en")
 *
 * Le changement de langue ne convertit
 * jamais automatiquement la devise.
 */

export function formatMoney(
  amount: number,
  currency: string = "XOF",
  locale: Locale = defaultLocale
): string {
  return new Intl.NumberFormat(
    localeDetails[locale].intlLocale,
    {
      style: "currency",
      currency,
      maximumFractionDigits:
        currencyDecimals(currency),
    }
  ).formatToParts(amount).map(part => part.type === "currency" ? currencySymbol(currency) : part.value).join("");
}

/* ============================================
   12. FORMATAGE DES DATES
============================================ */

/**
 * Les dates sont formatées selon la langue.
 * Le fuseau horaire doit être fourni
 * selon le contexte de l'événement.
 */

export function formatDate(
  date: Date | string | number,
  locale: Locale = defaultLocale,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const parsedDate =
    date instanceof Date
      ? date
      : new Date(date);

  if (
    Number.isNaN(parsedDate.getTime())
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    localeDetails[locale].intlLocale,
    {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
      ...options,
    }
  ).format(parsedDate);
}

/* ============================================
   13. EXPORT PAR DÉFAUT
============================================ */

export default i18nConfig;


export const EVENT_CATEGORY_DEFINITIONS = [
  {
    "key": "concerts",
    "icon": "Music2",
    "color": "#079b15"
  },
  {
    "key": "culture",
    "icon": "Drama",
    "color": "#f28c00"
  },
  {
    "key": "formation",
    "icon": "GraduationCap",
    "color": "#7622bd"
  },
  {
    "key": "soirees",
    "icon": "Martini",
    "color": "#f97316"
  },
  {
    "key": "tourisme",
    "icon": "Palmtree",
    "color": "#08a64b"
  },
  {
    "key": "sport",
    "icon": "Trophy",
    "color": "#7724bf"
  },
  {
    "key": "festival",
    "icon": "Tent",
    "color": "#ff7a00"
  },
  {
    "key": "science",
    "icon": "FlaskConical",
    "color": "#2580e9"
  },
  {
    "key": "religieux",
    "icon": "Church",
    "color": "#eb4034"
  },
  {
    "key": "gastronomie",
    "icon": "UtensilsCrossed",
    "color": "#ff7416"
  },
  {
    "key": "business",
    "icon": "BriefcaseBusiness",
    "color": "#ee9400"
  },
  {
    "key": "autres",
    "icon": "Ellipsis",
    "color": "#7026a8"
  }
] as const;
export const EVENT_CATEGORY_NAMES = {
  fr: {
    concerts: "Concerts",
    culture: "Culture",
    formation: "Formation",
    soirees: "Soirées",
    tourisme: "Tourisme",
    sport: "Sport",
    festival: "Festival",
    science: "Science",
    religieux: "Religieux",
    gastronomie: "Gastronomie",
    business: "Business",
    autres: "Autres",
  },

  en: {
    concerts: "Concerts",
    culture: "Culture",
    formation: "Training",
    soirees: "Parties",
    tourisme: "Tourism",
    sport: "Sports",
    festival: "Festivals",
    science: "Science",
    religieux: "Religious",
    gastronomie: "Food",
    business: "Business",
    autres: "Other",
  },
};
export function eventCategoryLabel(key: string, locale: string = "fr"): string {
  const language = locale === "en" ? "en" : "fr";
  return EVENT_CATEGORY_NAMES[language][key as keyof typeof EVENT_CATEGORY_NAMES.fr] ?? key;
}
export function publicationSlug(title: string, fallback = "evenement"): string {
  return title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100).replace(/-+$/g, "") || fallback;
}
