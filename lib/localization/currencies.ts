/**
 * Catalogue central des devises utilisées par Tikemia.
 *
 * Règles importantes :
 * - Les codes utilisent la norme ISO 4217.
 * - Les montants restent enregistrés dans leur devise d’origine.
 * - Une devise d’événement ne devra plus être modifiée après une vente.
 * - La prise en charge réelle d’une devise par un prestataire de paiement
 *   sera gérée séparément.
 */

export const SUPPORTED_CURRENCY_CODES = [
  /*
   * Afrique de l’Ouest
   */
  "XOF",
  "NGN",
  "GHS",
  "GMD",
  "GNF",
  "SLL",
  "LRD",
  "CVE",
  "MRU",

  /*
   * Afrique centrale
   */
  "XAF",
  "CDF",
  "STN",

  /*
   * Afrique de l’Est
   */
  "KES",
  "UGX",
  "TZS",
  "RWF",
  "BIF",
  "ETB",
  "ERN",
  "DJF",
  "SOS",
  "SSP",
  "SDG",

  /*
   * Afrique australe
   */
  "ZAR",
  "BWP",
  "NAD",
  "ZMW",
  "MWK",
  "MZN",
  "AOA",
  "SZL",
  "LSL",
  "ZWL",
  "MGA",
  "MUR",
  "SCR",
  "KMF",

  /*
   * Afrique du Nord
   */
  "MAD",
  "DZD",
  "TND",
  "LYD",
  "EGP",

  /*
   * Europe
   */
  "EUR",
  "GBP",
  "CHF",
  "NOK",
  "SEK",
  "DKK",
  "PLN",
  "CZK",
  "HUF",
  "RON",
  "BGN",
  "RSD",
  "ALL",
  "MKD",
  "BAM",
  "ISK",
  "MDL",
  "UAH",
  "GEL",
  "TRY",

  /*
   * Devises internationales utiles
   */
  "USD",
  "CAD",
] as const;

export type SupportedCurrencyCode =
  (typeof SUPPORTED_CURRENCY_CODES)[number];

export type CurrencyRegion =
  | "WEST_AFRICA"
  | "CENTRAL_AFRICA"
  | "EAST_AFRICA"
  | "SOUTHERN_AFRICA"
  | "NORTH_AFRICA"
  | "EUROPE"
  | "INTERNATIONAL";

export type CurrencyDefinition = {
  code: SupportedCurrencyCode;

  /**
   * Nom français utilisé dans les interfaces Tikemia.
   */
  name: string;

  /**
   * Symbole d’affichage principal.
   */
  symbol: string;

  /**
   * Nombre habituel de décimales monétaires.
   *
   * Exemple :
   * XOF : 0
   * EUR : 2
   */
  decimals: number;

  /**
   * Zone principale d’utilisation.
   */
  region: CurrencyRegion;

  /**
   * Pays utilisant principalement cette devise.
   * Les valeurs utilisent les codes ISO 3166-1 alpha-2.
   */
  countryCodes: readonly string[];

  /**
   * Ordre conseillé dans les menus.
   */
  priority: number;

  /**
   * Permet de masquer provisoirement une devise sans supprimer
   * son historique dans la plateforme.
   */
  active: boolean;
};

export const SUPPORTED_CURRENCIES: readonly CurrencyDefinition[] =
  [
    /*
     * Afrique de l’Ouest
     */
    {
      code: "XOF",
      name: "Franc CFA BCEAO",
      symbol: "F CFA",
      decimals: 0,
      region: "WEST_AFRICA",
      countryCodes: [
        "BJ",
        "BF",
        "CI",
        "GW",
        "ML",
        "NE",
        "SN",
        "TG",
      ],
      priority: 1,
      active: true,
    },
    {
      code: "NGN",
      name: "Naira nigérian",
      symbol: "₦",
      decimals: 2,
      region: "WEST_AFRICA",
      countryCodes: ["NG"],
      priority: 2,
      active: true,
    },
    {
      code: "GHS",
      name: "Cedi ghanéen",
      symbol: "GH₵",
      decimals: 2,
      region: "WEST_AFRICA",
      countryCodes: ["GH"],
      priority: 3,
      active: true,
    },
    {
      code: "GNF",
      name: "Franc guinéen",
      symbol: "FG",
      decimals: 0,
      region: "WEST_AFRICA",
      countryCodes: ["GN"],
      priority: 20,
      active: true,
    },
    {
      code: "GMD",
      name: "Dalasi gambien",
      symbol: "D",
      decimals: 2,
      region: "WEST_AFRICA",
      countryCodes: ["GM"],
      priority: 21,
      active: true,
    },
    {
      code: "SLL",
      name: "Leone sierra-léonais",
      symbol: "Le",
      decimals: 2,
      region: "WEST_AFRICA",
      countryCodes: ["SL"],
      priority: 22,
      active: true,
    },
    {
      code: "LRD",
      name: "Dollar libérien",
      symbol: "L$",
      decimals: 2,
      region: "WEST_AFRICA",
      countryCodes: ["LR"],
      priority: 23,
      active: true,
    },
    {
      code: "CVE",
      name: "Escudo cap-verdien",
      symbol: "Esc",
      decimals: 2,
      region: "WEST_AFRICA",
      countryCodes: ["CV"],
      priority: 24,
      active: true,
    },
    {
      code: "MRU",
      name: "Ouguiya mauritanien",
      symbol: "UM",
      decimals: 2,
      region: "WEST_AFRICA",
      countryCodes: ["MR"],
      priority: 25,
      active: true,
    },

    /*
     * Afrique centrale
     */
    {
      code: "XAF",
      name: "Franc CFA BEAC",
      symbol: "FCFA",
      decimals: 0,
      region: "CENTRAL_AFRICA",
      countryCodes: [
        "CM",
        "CF",
        "TD",
        "CG",
        "GQ",
        "GA",
      ],
      priority: 4,
      active: true,
    },
    {
      code: "CDF",
      name: "Franc congolais",
      symbol: "FC",
      decimals: 2,
      region: "CENTRAL_AFRICA",
      countryCodes: ["CD"],
      priority: 26,
      active: true,
    },
    {
      code: "STN",
      name: "Dobra de Sao Tomé-et-Principe",
      symbol: "Db",
      decimals: 2,
      region: "CENTRAL_AFRICA",
      countryCodes: ["ST"],
      priority: 27,
      active: true,
    },

    /*
     * Afrique de l’Est
     */
    {
      code: "KES",
      name: "Shilling kényan",
      symbol: "KSh",
      decimals: 2,
      region: "EAST_AFRICA",
      countryCodes: ["KE"],
      priority: 5,
      active: true,
    },
    {
      code: "UGX",
      name: "Shilling ougandais",
      symbol: "USh",
      decimals: 0,
      region: "EAST_AFRICA",
      countryCodes: ["UG"],
      priority: 28,
      active: true,
    },
    {
      code: "TZS",
      name: "Shilling tanzanien",
      symbol: "TSh",
      decimals: 2,
      region: "EAST_AFRICA",
      countryCodes: ["TZ"],
      priority: 29,
      active: true,
    },
    {
      code: "RWF",
      name: "Franc rwandais",
      symbol: "FRw",
      decimals: 0,
      region: "EAST_AFRICA",
      countryCodes: ["RW"],
      priority: 30,
      active: true,
    },
    {
      code: "BIF",
      name: "Franc burundais",
      symbol: "FBu",
      decimals: 0,
      region: "EAST_AFRICA",
      countryCodes: ["BI"],
      priority: 31,
      active: true,
    },
    {
      code: "ETB",
      name: "Birr éthiopien",
      symbol: "Br",
      decimals: 2,
      region: "EAST_AFRICA",
      countryCodes: ["ET"],
      priority: 32,
      active: true,
    },
    {
      code: "ERN",
      name: "Nakfa érythréen",
      symbol: "Nfk",
      decimals: 2,
      region: "EAST_AFRICA",
      countryCodes: ["ER"],
      priority: 33,
      active: true,
    },
    {
      code: "DJF",
      name: "Franc djiboutien",
      symbol: "Fdj",
      decimals: 0,
      region: "EAST_AFRICA",
      countryCodes: ["DJ"],
      priority: 34,
      active: true,
    },
    {
      code: "SOS",
      name: "Shilling somalien",
      symbol: "Sh.So.",
      decimals: 2,
      region: "EAST_AFRICA",
      countryCodes: ["SO"],
      priority: 35,
      active: true,
    },
    {
      code: "SSP",
      name: "Livre sud-soudanaise",
      symbol: "SS£",
      decimals: 2,
      region: "EAST_AFRICA",
      countryCodes: ["SS"],
      priority: 36,
      active: true,
    },
    {
      code: "SDG",
      name: "Livre soudanaise",
      symbol: "ج.س.",
      decimals: 2,
      region: "EAST_AFRICA",
      countryCodes: ["SD"],
      priority: 37,
      active: true,
    },

    /*
     * Afrique australe
     */
    {
      code: "ZAR",
      name: "Rand sud-africain",
      symbol: "R",
      decimals: 2,
      region: "SOUTHERN_AFRICA",
      countryCodes: ["ZA"],
      priority: 6,
      active: true,
    },
    {
      code: "BWP",
      name: "Pula botswanais",
      symbol: "P",
      decimals: 2,
      region: "SOUTHERN_AFRICA",
      countryCodes: ["BW"],
      priority: 38,
      active: true,
    },
    {
      code: "NAD",
      name: "Dollar namibien",
      symbol: "N$",
      decimals: 2,
      region: "SOUTHERN_AFRICA",
      countryCodes: ["NA"],
      priority: 39,
      active: true,
    },
    {
      code: "ZMW",
      name: "Kwacha zambien",
      symbol: "ZK",
      decimals: 2,
      region: "SOUTHERN_AFRICA",
      countryCodes: ["ZM"],
      priority: 40,
      active: true,
    },
    {
      code: "MWK",
      name: "Kwacha malawite",
      symbol: "MK",
      decimals: 2,
      region: "SOUTHERN_AFRICA",
      countryCodes: ["MW"],
      priority: 41,
      active: true,
    },
    {
      code: "MZN",
      name: "Metical mozambicain",
      symbol: "MT",
      decimals: 2,
      region: "SOUTHERN_AFRICA",
      countryCodes: ["MZ"],
      priority: 42,
      active: true,
    },
    {
      code: "AOA",
      name: "Kwanza angolais",
      symbol: "Kz",
      decimals: 2,
      region: "SOUTHERN_AFRICA",
      countryCodes: ["AO"],
      priority: 43,
      active: true,
    },
    {
      code: "SZL",
      name: "Lilangeni eswatinien",
      symbol: "L",
      decimals: 2,
      region: "SOUTHERN_AFRICA",
      countryCodes: ["SZ"],
      priority: 44,
      active: true,
    },
    {
      code: "LSL",
      name: "Loti lesothan",
      symbol: "L",
      decimals: 2,
      region: "SOUTHERN_AFRICA",
      countryCodes: ["LS"],
      priority: 45,
      active: true,
    },
    {
      code: "ZWL",
      name: "Dollar zimbabwéen",
      symbol: "Z$",
      decimals: 2,
      region: "SOUTHERN_AFRICA",
      countryCodes: ["ZW"],
      priority: 46,
      active: true,
    },
    {
      code: "MGA",
      name: "Ariary malgache",
      symbol: "Ar",
      decimals: 2,
      region: "SOUTHERN_AFRICA",
      countryCodes: ["MG"],
      priority: 47,
      active: true,
    },
    {
      code: "MUR",
      name: "Roupie mauricienne",
      symbol: "₨",
      decimals: 2,
      region: "SOUTHERN_AFRICA",
      countryCodes: ["MU"],
      priority: 48,
      active: true,
    },
    {
      code: "SCR",
      name: "Roupie seychelloise",
      symbol: "₨",
      decimals: 2,
      region: "SOUTHERN_AFRICA",
      countryCodes: ["SC"],
      priority: 49,
      active: true,
    },
    {
      code: "KMF",
      name: "Franc comorien",
      symbol: "CF",
      decimals: 0,
      region: "SOUTHERN_AFRICA",
      countryCodes: ["KM"],
      priority: 50,
      active: true,
    },

    /*
     * Afrique du Nord
     */
    {
      code: "MAD",
      name: "Dirham marocain",
      symbol: "DH",
      decimals: 2,
      region: "NORTH_AFRICA",
      countryCodes: ["MA"],
      priority: 7,
      active: true,
    },
    {
      code: "DZD",
      name: "Dinar algérien",
      symbol: "DA",
      decimals: 2,
      region: "NORTH_AFRICA",
      countryCodes: ["DZ"],
      priority: 8,
      active: true,
    },
    {
      code: "TND",
      name: "Dinar tunisien",
      symbol: "DT",
      decimals: 3,
      region: "NORTH_AFRICA",
      countryCodes: ["TN"],
      priority: 9,
      active: true,
    },
    {
      code: "LYD",
      name: "Dinar libyen",
      symbol: "LD",
      decimals: 3,
      region: "NORTH_AFRICA",
      countryCodes: ["LY"],
      priority: 51,
      active: true,
    },
    {
      code: "EGP",
      name: "Livre égyptienne",
      symbol: "E£",
      decimals: 2,
      region: "NORTH_AFRICA",
      countryCodes: ["EG"],
      priority: 10,
      active: true,
    },

    /*
     * Europe
     */
    {
      code: "EUR",
      name: "Euro",
      symbol: "€",
      decimals: 2,
      region: "EUROPE",
      countryCodes: [
        "AT",
        "BE",
        "CY",
        "DE",
        "EE",
        "ES",
        "FI",
        "FR",
        "GR",
        "HR",
        "IE",
        "IT",
        "LT",
        "LU",
        "LV",
        "MT",
        "NL",
        "PT",
        "SI",
        "SK",
      ],
      priority: 11,
      active: true,
    },
    {
      code: "GBP",
      name: "Livre sterling",
      symbol: "£",
      decimals: 2,
      region: "EUROPE",
      countryCodes: ["GB"],
      priority: 12,
      active: true,
    },
    {
      code: "CHF",
      name: "Franc suisse",
      symbol: "CHF",
      decimals: 2,
      region: "EUROPE",
      countryCodes: ["CH", "LI"],
      priority: 13,
      active: true,
    },
    {
      code: "NOK",
      name: "Couronne norvégienne",
      symbol: "kr",
      decimals: 2,
      region: "EUROPE",
      countryCodes: ["NO"],
      priority: 52,
      active: true,
    },
    {
      code: "SEK",
      name: "Couronne suédoise",
      symbol: "kr",
      decimals: 2,
      region: "EUROPE",
      countryCodes: ["SE"],
      priority: 53,
      active: true,
    },
    {
      code: "DKK",
      name: "Couronne danoise",
      symbol: "kr",
      decimals: 2,
      region: "EUROPE",
      countryCodes: ["DK"],
      priority: 54,
      active: true,
    },
    {
      code: "PLN",
      name: "Zloty polonais",
      symbol: "zł",
      decimals: 2,
      region: "EUROPE",
      countryCodes: ["PL"],
      priority: 55,
      active: true,
    },
    {
      code: "CZK",
      name: "Couronne tchèque",
      symbol: "Kč",
      decimals: 2,
      region: "EUROPE",
      countryCodes: ["CZ"],
      priority: 56,
      active: true,
    },
    {
      code: "HUF",
      name: "Forint hongrois",
      symbol: "Ft",
      decimals: 2,
      region: "EUROPE",
      countryCodes: ["HU"],
      priority: 57,
      active: true,
    },
    {
      code: "RON",
      name: "Leu roumain",
      symbol: "lei",
      decimals: 2,
      region: "EUROPE",
      countryCodes: ["RO"],
      priority: 58,
      active: true,
    },
    {
      code: "BGN",
      name: "Lev bulgare",
      symbol: "лв",
      decimals: 2,
      region: "EUROPE",
      countryCodes: ["BG"],
      priority: 59,
      active: true,
    },
    {
      code: "RSD",
      name: "Dinar serbe",
      symbol: "дин.",
      decimals: 2,
      region: "EUROPE",
      countryCodes: ["RS"],
      priority: 60,
      active: true,
    },
    {
      code: "ALL",
      name: "Lek albanais",
      symbol: "L",
      decimals: 2,
      region: "EUROPE",
      countryCodes: ["AL"],
      priority: 61,
      active: true,
    },
    {
      code: "MKD",
      name: "Denar macédonien",
      symbol: "ден",
      decimals: 2,
      region: "EUROPE",
      countryCodes: ["MK"],
      priority: 62,
      active: true,
    },
    {
      code: "BAM",
      name: "Mark convertible de Bosnie-Herzégovine",
      symbol: "KM",
      decimals: 2,
      region: "EUROPE",
      countryCodes: ["BA"],
      priority: 63,
      active: true,
    },
    {
      code: "ISK",
      name: "Couronne islandaise",
      symbol: "kr",
      decimals: 0,
      region: "EUROPE",
      countryCodes: ["IS"],
      priority: 64,
      active: true,
    },
    {
      code: "MDL",
      name: "Leu moldave",
      symbol: "L",
      decimals: 2,
      region: "EUROPE",
      countryCodes: ["MD"],
      priority: 65,
      active: true,
    },
    {
      code: "UAH",
      name: "Hryvnia ukrainienne",
      symbol: "₴",
      decimals: 2,
      region: "EUROPE",
      countryCodes: ["UA"],
      priority: 66,
      active: true,
    },
    {
      code: "GEL",
      name: "Lari géorgien",
      symbol: "₾",
      decimals: 2,
      region: "EUROPE",
      countryCodes: ["GE"],
      priority: 67,
      active: true,
    },
    {
      code: "TRY",
      name: "Livre turque",
      symbol: "₺",
      decimals: 2,
      region: "EUROPE",
      countryCodes: ["TR"],
      priority: 68,
      active: true,
    },

    /*
     * International
     */
    {
      code: "USD",
      name: "Dollar américain",
      symbol: "$",
      decimals: 2,
      region: "INTERNATIONAL",
      countryCodes: ["US"],
      priority: 14,
      active: true,
    },
    {
      code: "CAD",
      name: "Dollar canadien",
      symbol: "CA$",
      decimals: 2,
      region: "INTERNATIONAL",
      countryCodes: ["CA"],
      priority: 69,
      active: true,
    },
  ] as const;

/**
 * Map optimisée pour éviter de parcourir tout le tableau
 * lors de chaque recherche.
 */
const CURRENCY_BY_CODE =
  new Map<
    SupportedCurrencyCode,
    CurrencyDefinition
  >(
    SUPPORTED_CURRENCIES.map(
      (currency) => [
        currency.code,
        currency,
      ],
    ),
  );

/**
 * Vérifie qu’une valeur est un code de devise
 * officiellement supporté par Tikemia.
 */
export function isSupportedCurrencyCode(
  value: unknown,
): value is SupportedCurrencyCode {
  return (
    typeof value === "string" &&
    CURRENCY_BY_CODE.has(
      value
        .trim()
        .toUpperCase() as SupportedCurrencyCode,
    )
  );
}

/**
 * Normalise puis retourne un code de devise valide.
 */
export function normalizeCurrencyCode(
  value: string,
): SupportedCurrencyCode | null {
  const normalizedValue =
    value.trim().toUpperCase();

  if (
    !isSupportedCurrencyCode(
      normalizedValue,
    )
  ) {
    return null;
  }

  return normalizedValue;
}

/**
 * Retourne les informations complètes d’une devise.
 */
export function getCurrencyDefinition(
  code: string,
): CurrencyDefinition | null {
  const normalizedCode =
    normalizeCurrencyCode(code);

  if (!normalizedCode) {
    return null;
  }

  return (
    CURRENCY_BY_CODE.get(
      normalizedCode,
    ) ?? null
  );
}

/**
 * Retourne toutes les devises actives dans l’ordre
 * recommandé pour les menus.
 */
export function getActiveCurrencies(): CurrencyDefinition[] {
  return SUPPORTED_CURRENCIES
    .filter(
      (currency) =>
        currency.active,
    )
    .sort(
      (first, second) =>
        first.priority -
        second.priority,
    );
}

/**
 * Retourne les devises actives d’une zone donnée.
 */
export function getCurrenciesByRegion(
  region: CurrencyRegion,
): CurrencyDefinition[] {
  return getActiveCurrencies().filter(
    (currency) =>
      currency.region === region,
  );
}

/**
 * Retourne la devise principale associée à un pays.
 */
export function getCurrencyByCountryCode(
  countryCode: string,
): CurrencyDefinition | null {
  const normalizedCountryCode =
    countryCode
      .trim()
      .toUpperCase();

  if (!normalizedCountryCode) {
    return null;
  }

  return (
    getActiveCurrencies().find(
      (currency) =>
        currency.countryCodes.includes(
          normalizedCountryCode,
        ),
    ) ?? null
  );
}

/**
 * Structure prête à utiliser dans un <select>.
 */
export type CurrencySelectOption = {
  value: SupportedCurrencyCode;
  label: string;
  code: SupportedCurrencyCode;
  name: string;
  symbol: string;
  decimals: number;
  region: CurrencyRegion;
};

export function getCurrencySelectOptions(): CurrencySelectOption[] {
  return getActiveCurrencies().map(
    (currency) => ({
      value:
        currency.code,

      label:
        `${currency.name} — ${currency.code}`,

      code:
        currency.code,

      name:
        currency.name,

      symbol:
        currency.symbol,

      decimals:
        currency.decimals,

      region:
        currency.region,
    }),
  );
}

/**
 * Valeur de secours utilisée uniquement lorsqu’aucune
 * devise valide n’est disponible.
 */
export const DEFAULT_CURRENCY_CODE: SupportedCurrencyCode =
  "XOF";