import { isSupportedCurrency } from "@/i18n/config";

/* ==========================================================
   TIKEMIA — CATALOGUE INTERNATIONAL DES MOYENS DE RETRAIT

   Fichier :
   src/lib/withdrawal-providers.ts

   Compatible :
   - Next.js App Router
   - TypeScript
   - Prisma 7
   - React
   - @iconify/react
   - libphonenumber-js

   Moyens de retrait :
   1. Mobile Money
   2. Compte bancaire
   3. Cryptomonnaie (BTC / USDT)

   IMPORTANT :
   Ce catalogue décrit des réseaux connus.

   La possibilité de recevoir un retrait TIKEMIA
   dépend obligatoirement de l'activation réelle
   d'une route de paiement par un prestataire.

   Aucune route de retrait n'est activée par défaut.
========================================================== */

import {
  parsePhoneNumberFromString,
  getCountries,
  getCountryCallingCode,
  isSupportedCountry,
  type CountryCode,
} from "libphonenumber-js";

/* ==========================================================
   TYPES PRINCIPAUX
========================================================== */

export type WithdrawalMethodType =
  | "MOBILE_MONEY"
  | "BANK_ACCOUNT"
  | "CRYPTO";

export type WithdrawalLocale =
  | "fr"
  | "en";

export type WithdrawalCurrency =
  | "XOF"
  | "XAF"
  | "EUR"
  | "USD"
  | "GBP"
  | "CAD"
  | "CHF"
  | "GHS"
  | "NGN"
  | "KES"
  | "UGX"
  | "TZS"
  | "RWF"
  | "ZMW"
  | "ZAR"
  | "CDF"
  | "GNF"
  | "MGA"
  | "MZN"
  | "MWK"
  | "BIF"
  | "ETB"
  | "EGP"
  | "MAD"
  | "TND"
  | "DZD"
  | "AOA"
  | "BWP"
  | "GMD"
  | "SLE"
  | "LRD"
  | "ZWL"
  | "DJF"
  | "SOS"
  | "SDG"
  | "SSP"
  | "MUR"
  | "SCR"
  | "KMF"
  | "SZL"
  | "LSL"
  | "NAD"
  | "CVE"
  | "STN"
  | "JPY"
  | "CNY"
  | "INR"
  | "AUD"
  | "NZD"
  | "AED"
  | "SAR"
  | "QAR"
  | "BDT"
  | "PKR"
  | "PHP"
  | "IDR"
  | "MYR"
  | "SGD"
  | "THB"
  | "VND"
  | "BRL"
  | "MXN"
  | "HKD"
  | "TRY"
  | "OTHER";

export type WithdrawalAvailability =
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "NOT_CONFIGURED";

export type CryptoAssetCode =
  | "BTC"
  | "USDT";

export type CryptoNetworkCode =
  | "BITCOIN"
  | "TRC20"
  | "ERC20"
  | "SOLANA"
  | "POLYGON"
  | "ARBITRUM";

export type ProviderCategory =
  | "MOBILE_MONEY"
  | "BANK_ACCOUNT"
  | "CRYPTO";

export interface WithdrawalCountry {
  code: string;
  name: string;
  callingCode: string;
  flag: string;
  isAfrican: boolean;
}

export interface MobileMoneyProvider {
  code: string;
  name: string;
  shortName: string;
  countries: readonly string[];
  icon: string;
  brandColor: string;
  type: "MOBILE_MONEY";
}

export interface CryptoAsset {
  code: CryptoAssetCode;
  name: string;
  symbol: string;
  icon: string;
  brandColor: string;
  networks: readonly CryptoNetworkCode[];
}

export interface CryptoNetwork {
  code: CryptoNetworkCode;
  name: string;
  assetCode: CryptoAssetCode;
  chain: string;
  addressFormat: string;
}

export interface WithdrawalMethodOption {
  type: WithdrawalMethodType;
  code: string;
  name: string;
  icon: string;
  available: boolean;
}

export interface WithdrawalProviderOption {
  logoUrl: string | null;
  code: string;
  name: string;
  shortName: string;
  type: ProviderCategory;
  icon: string;
  brandColor: string;
  countryCode: string | null;
  available: boolean;
}

export interface WithdrawalProviderCatalog {
  country: WithdrawalCountry;
  methods: WithdrawalMethodOption[];
  mobileMoney: WithdrawalProviderOption[];
  bank: WithdrawalProviderOption;
  crypto: WithdrawalProviderOption[];
  cryptoNetworks: CryptoNetwork[];
}

export interface EnabledWithdrawalRoute {
  method: WithdrawalMethodType;
  providerCode: string;
  countryCode: string;
  currency?: string;
  assetCode?: CryptoAssetCode;
  networkCode?: CryptoNetworkCode;
  enabled: boolean;
}

/* ==========================================================
   MÉTHODES DE RETRAIT

   Les noms correspondent aux types
   enregistrés dans PayoutDestination.type.
========================================================== */

export const WITHDRAWAL_METHOD_TYPES = {
  MOBILE_MONEY: "MOBILE_MONEY",
  BANK_ACCOUNT: "BANK_ACCOUNT",
  CRYPTO: "CRYPTO",
} as const;

export const WITHDRAWAL_METHODS = [
  {
    type: "MOBILE_MONEY",
    code: "MOBILE_MONEY",
    name: "Mobile Money",
    icon: "lucide:smartphone",
  },
  {
    type: "BANK_ACCOUNT",
    code: "BANK_ACCOUNT",
    name: "Compte bancaire",
    icon: "lucide:landmark",
  },
  {
    type: "CRYPTO",
    code: "CRYPTO",
    name: "Cryptomonnaie",
    icon: "lucide:bitcoin",
  },
] as const;

/* ==========================================================
   PAYS AFRICAINS

   ISO 3166-1 alpha-2.

   La présence ici permet de classer
   le pays dans l'interface.

   Cette liste ne garantit pas la disponibilité
   d'un partenaire de retrait dans le pays.
========================================================== */

export const AFRICAN_COUNTRY_CODES = [
  "DZ",
  "AO",
  "BJ",
  "BW",
  "BF",
  "BI",
  "CV",
  "CM",
  "CF",
  "TD",
  "KM",
  "CG",
  "CD",
  "CI",
  "DJ",
  "EG",
  "GQ",
  "ER",
  "SZ",
  "ET",
  "GA",
  "GM",
  "GH",
  "GN",
  "GW",
  "KE",
  "LS",
  "LR",
  "LY",
  "MG",
  "MW",
  "ML",
  "MR",
  "MU",
  "MA",
  "MZ",
  "NA",
  "NE",
  "NG",
  "RW",
  "ST",
  "SN",
  "SC",
  "SL",
  "SO",
  "ZA",
  "SS",
  "SD",
  "TZ",
  "TG",
  "TN",
  "UG",
  "ZM",
  "ZW",
] as const;

const AFRICAN_COUNTRY_SET =
  new Set<string>(
    AFRICAN_COUNTRY_CODES
  );

/* ==========================================================
   DEVISES PAR PAYS

   Les principales devises sont renseignées.

   Pour les autres pays, le code reste
   résolu par Intl lorsque possible.

   La devise du pays n'implique pas
   nécessairement qu'un retrait dans
   cette devise est autorisé.
========================================================== */

export const COUNTRY_CURRENCIES: Record<
  string,
  string
> = {
  BJ: "XOF",
  BF: "XOF",
  CI: "XOF",
  GW: "XOF",
  ML: "XOF",
  NE: "XOF",
  SN: "XOF",
  TG: "XOF",

  CM: "XAF",
  CF: "XAF",
  TD: "XAF",
  CG: "XAF",
  GQ: "XAF",
  GA: "XAF",

  GH: "GHS",
  NG: "NGN",
  KE: "KES",
  UG: "UGX",
  TZ: "TZS",
  RW: "RWF",
  ZM: "ZMW",
  ZA: "ZAR",
  CD: "CDF",
  GN: "GNF",
  MG: "MGA",
  MZ: "MZN",
  MW: "MWK",
  BI: "BIF",
  ET: "ETB",
  EG: "EGP",
  MA: "MAD",
  TN: "TND",
  DZ: "DZD",
  AO: "AOA",
  BW: "BWP",
  GM: "GMD",
  SL: "SLE",
  LR: "LRD",
  DJ: "DJF",
  SO: "SOS",
  SD: "SDG",
  SS: "SSP",
  MU: "MUR",
  SC: "SCR",
  KM: "KMF",
  SZ: "SZL",
  LS: "LSL",
  NA: "NAD",
  CV: "CVE",
  ST: "STN",

  FR: "EUR",
  DE: "EUR",
  BE: "EUR",
  ES: "EUR",
  IT: "EUR",
  PT: "EUR",
  NL: "EUR",
  AT: "EUR",
  IE: "EUR",
  FI: "EUR",
  GR: "EUR",
  LU: "EUR",
  CY: "EUR",
  MT: "EUR",
  EE: "EUR",
  LV: "EUR",
  LT: "EUR",
  SK: "EUR",
  SI: "EUR",
  HR: "EUR",

  US: "USD",
  GB: "GBP",
  CA: "CAD",
  CH: "CHF",
  JP: "JPY",
  CN: "CNY",
  IN: "INR",
  AU: "AUD",
  NZ: "NZD",
  AE: "AED",
  SA: "SAR",
  QA: "QAR",
  BD: "BDT",
  PK: "PKR",
  PH: "PHP",
  ID: "IDR",
  MY: "MYR",
  SG: "SGD",
  TH: "THB",
  VN: "VND",
  BR: "BRL",
  MX: "MXN",
  HK: "HKD",
  TR: "TRY",
};

/* ==========================================================
   CATALOGUE MOBILE MONEY

   Les pays indiqués correspondent
   à des implantations connues.

   La couverture opérationnelle doit être
   confirmée auprès du partenaire PSP.

   Icônes :
   - Utilisation d'une icône générique Iconify.
   - Aucun faux logo officiel n'est fabriqué.
   - Les logos de marques pourront être
     associés ultérieurement.
========================================================== */

export const MOBILE_MONEY_PROVIDERS:
  readonly MobileMoneyProvider[] = [
  {
    code: "MTN_MOMO",
    name: "MTN Mobile Money",
    shortName: "MTN MoMo",
    countries: [
      "BJ", "CI", "CM", "GH",
      "GN", "LR", "RW", "UG",
      "ZM", "CG", "SZ", "ZA",
      "SS", "NG",
    ],
    icon: "lucide:smartphone",
    brandColor: "#FFCC00",
    type: "MOBILE_MONEY",
  },
  {
    code: "MOOV_MONEY",
    name: "Moov Money",
    shortName: "Moov Money",
    countries: [
      "BJ", "BF", "ML", "TG",
      "NE", "GA",
    ],
    icon: "lucide:smartphone",
    brandColor: "#007B5E",
    type: "MOBILE_MONEY",
  },
  {
    code: "ORANGE_MONEY",
    name: "Orange Money",
    shortName: "Orange Money",
    countries: [
      "CI", "SN", "ML", "BF",
      "CM", "GN", "GW", "SL",
      "LR", "CD", "CF", "BW",
      "MG", "MA", "EG", "JO",
    ],
    icon: "lucide:smartphone",
    brandColor: "#FF7900",
    type: "MOBILE_MONEY",
  },
  {
    code: "WAVE",
    name: "Wave",
    shortName: "Wave",
    countries: [
      "SN", "CI", "ML",
      "BF", "GM", "UG",
    ],
    icon: "lucide:smartphone",
    brandColor: "#1788E5",
    type: "MOBILE_MONEY",
  },
  {
    code: "AIRTEL_MONEY",
    name: "Airtel Money",
    shortName: "Airtel Money",
    countries: [
      "UG", "KE", "TZ", "RW",
      "ZM", "MW", "CD", "CG",
      "GA", "TD", "NE", "MG",
      "NG", "SC",
    ],
    icon: "lucide:smartphone",
    brandColor: "#E60012",
    type: "MOBILE_MONEY",
  },
  {
    code: "MPESA",
    name: "M-Pesa",
    shortName: "M-Pesa",
    countries: [
      "KE", "TZ", "MZ",
      "CD", "LS", "ET",
    ],
    icon: "lucide:smartphone",
    brandColor: "#D5001C",
    type: "MOBILE_MONEY",
  },
  {
    code: "ECOCASH",
    name: "EcoCash",
    shortName: "EcoCash",
    countries: [
      "ZW", "BI",
    ],
    icon: "lucide:smartphone",
    brandColor: "#005BAA",
    type: "MOBILE_MONEY",
  },
  {
    code: "TMONEY",
    name: "T-Money",
    shortName: "T-Money",
    countries: [
      "TG",
    ],
    icon: "lucide:smartphone",
    brandColor: "#E8AD00",
    type: "MOBILE_MONEY",
  },
  {
    code: "MIXX_BY_YAS",
    name: "Mixx by Yas",
    shortName: "Mixx",
    countries: [
      "TG", "SN", "TZ",
    ],
    icon: "lucide:smartphone",
    brandColor: "#233989",
    type: "MOBILE_MONEY",
  },
  {
    code: "TELECEL_CASH",
    name: "Telecel Cash",
    shortName: "Telecel Cash",
    countries: [
      "GH",
    ],
    icon: "lucide:smartphone",
    brandColor: "#D71920",
    type: "MOBILE_MONEY",
  },
  {
    code: "AFRIMONEY",
    name: "Afrimoney",
    shortName: "Afrimoney",
    countries: [
      "GM", "SL", "CD",
      "AO",
    ],
    icon: "lucide:smartphone",
    brandColor: "#D70026",
    type: "MOBILE_MONEY",
  },
  {
    code: "ZEePAY",
    name: "Zeepay",
    shortName: "Zeepay",
    countries: [
      "GH", "CI", "ZM",
      "SL", "MZ",
    ],
    icon: "lucide:smartphone",
    brandColor: "#E6A900",
    type: "MOBILE_MONEY",
  },
  {
    code: "MVOLA",
    name: "MVola",
    shortName: "MVola",
    countries: [
      "MG", "KM",
    ],
    icon: "lucide:smartphone",
    brandColor: "#E60012",
    type: "MOBILE_MONEY",
  },
  {
    code: "TELEBIRR",
    name: "telebirr",
    shortName: "telebirr",
    countries: [
      "ET",
    ],
    icon: "lucide:smartphone",
    brandColor: "#158943",
    type: "MOBILE_MONEY",
  },
  {
    code: "LUMICASH",
    name: "Lumicash",
    shortName: "Lumicash",
    countries: [
      "BI",
    ],
    icon: "lucide:smartphone",
    brandColor: "#E32A28",
    type: "MOBILE_MONEY",
  },
  {
    code: "ZAMANI_CASH",
    name: "Zamani Cash",
    shortName: "Zamani Cash",
    countries: [
      "NE",
    ],
    icon: "lucide:smartphone",
    brandColor: "#EB7500",
    type: "MOBILE_MONEY",
  },
  {
    code: "WIZALL",
    name: "Wizall Money",
    shortName: "Wizall",
    countries: [
      "SN", "CI",
      "ML", "BF",
    ],
    icon: "lucide:smartphone",
    brandColor: "#00A76B",
    type: "MOBILE_MONEY",
  },
  {
    code: "SMARTCASH",
    name: "SmartCash",
    shortName: "SmartCash",
    countries: [
      "NG",
    ],
    icon: "lucide:smartphone",
    brandColor: "#E60012",
    type: "MOBILE_MONEY",
  },
  {
    code: "PALMPAY",
    name: "PalmPay",
    shortName: "PalmPay",
    countries: [
      "NG",
    ],
    icon: "lucide:smartphone",
    brandColor: "#7137C8",
    type: "MOBILE_MONEY",
  },
  {
    code: "UNITEL_MONEY",
    name: "Unitel Money",
    shortName: "Unitel Money",
    countries: [
      "AO",
    ],
    icon: "lucide:smartphone",
    brandColor: "#E13227",
    type: "MOBILE_MONEY",
  },
  {
    code: "DMONEY",
    name: "D-Money",
    shortName: "D-Money",
    countries: [
      "DJ",
    ],
    icon: "lucide:smartphone",
    brandColor: "#076AB4",
    type: "MOBILE_MONEY",
  },
  {
    code: "POSO_MONEY",
    name: "Poso Money",
    shortName: "Poso Money",
    countries: [
      "BW",
    ],
    icon: "lucide:smartphone",
    brandColor: "#164779",
    type: "MOBILE_MONEY",
  },
  {
    code: "TNM_MPAMBA",
    name: "TNM Mpamba",
    shortName: "Mpamba",
    countries: [
      "MW",
    ],
    icon: "lucide:smartphone",
    brandColor: "#C41E3A",
    type: "MOBILE_MONEY",
  },
  {
    code: "E_MOLA",
    name: "e-Mola",
    shortName: "e-Mola",
    countries: [
      "MZ",
    ],
    icon: "lucide:smartphone",
    brandColor: "#207F3F",
    type: "MOBILE_MONEY",
  },
  {
    code: "MKESH",
    name: "mKesh",
    shortName: "mKesh",
    countries: [
      "MZ",
    ],
    icon: "lucide:smartphone",
    brandColor: "#D71920",
    type: "MOBILE_MONEY",
  },
  {
    code: "WAAFI",
    name: "WAAFI",
    shortName: "WAAFI",
    countries: [
      "SO",
    ],
    icon: "lucide:smartphone",
    brandColor: "#009CDE",
    type: "MOBILE_MONEY",
  },
  {
    code: "ZAAD",
    name: "ZAAD",
    shortName: "ZAAD",
    countries: [
      "SO",
    ],
    icon: "lucide:smartphone",
    brandColor: "#007C43",
    type: "MOBILE_MONEY",
  },
];

/* ==========================================================
   CRYPTOMONNAIES

   BTC :
   Réseau Bitcoin natif.

   USDT :
   Réseaux distincts.
   Chaque réseau doit être vérifié séparément.

   Les retraits crypto sont désactivés
   tant qu'aucune route n'est activée.
========================================================== */

export const CRYPTO_ASSETS:
  readonly CryptoAsset[] = [
  {
    code: "BTC",
    name: "Bitcoin",
    symbol: "BTC",
    icon: "logos:bitcoin",
    brandColor: "#F7931A",
    networks: [
      "BITCOIN",
    ],
  },
  {
    code: "USDT",
    name: "Tether USD",
    symbol: "USDT",
    icon: "logos:tether",
    brandColor: "#26A17B",
    networks: [
      "TRC20",
      "ERC20",
      "SOLANA",
      "POLYGON",
      "ARBITRUM",
    ],
  },
];

export const CRYPTO_NETWORKS:
  readonly CryptoNetwork[] = [
  {
    code: "BITCOIN",
    name: "Bitcoin Mainnet",
    assetCode: "BTC",
    chain: "Bitcoin",
    addressFormat:
      "Bitcoin mainnet address",
  },
  {
    code: "TRC20",
    name: "TRON (TRC20)",
    assetCode: "USDT",
    chain: "Tron",
    addressFormat:
      "TRON address",
  },
  {
    code: "ERC20",
    name: "Ethereum (ERC20)",
    assetCode: "USDT",
    chain: "Ethereum",
    addressFormat:
      "Ethereum address",
  },
  {
    code: "SOLANA",
    name: "Solana",
    assetCode: "USDT",
    chain: "Solana",
    addressFormat:
      "Solana address",
  },
  {
    code: "POLYGON",
    name: "Polygon",
    assetCode: "USDT",
    chain: "Polygon",
    addressFormat:
      "Polygon address",
  },
  {
    code: "ARBITRUM",
    name: "Arbitrum",
    assetCode: "USDT",
    chain: "Arbitrum",
    addressFormat:
      "Arbitrum address",
  },
];

/* ==========================================================
   PAYS UTILISANT L'IBAN

   Liste indicative pour l'interface bancaire.

   La validation définitive doit être réalisée
   côté serveur selon les règles bancaires
   et les pays réellement desservis.

   Les autres pays utilisent un numéro de
   compte et un code bancaire local.
========================================================== */

export const IBAN_COUNTRY_CODES =
  new Set<string>([
    "AD", "AE", "AL", "AT", "AZ",
    "BA", "BE", "BG", "BH", "BR",
    "BY", "CH", "CR", "CY", "CZ",
    "DE", "DK", "DO", "EE", "EG",
    "ES", "FI", "FO", "FR", "GB",
    "GE", "GI", "GL", "GR", "GT",
    "HR", "HU", "IE", "IL", "IQ",
    "IS", "IT", "JO", "KW", "KZ",
    "LB", "LC", "LI", "LT", "LU",
    "LV", "MC", "MD", "ME", "MK",
    "MN", "MR", "MT", "MU", "NL",
    "NO", "PK", "PL", "PS", "PT",
    "QA", "RO", "RS", "SA", "SC",
    "SE", "SI", "SK", "SM", "ST",
    "SV", "TL", "TN", "TR", "UA",
    "VA", "VG", "XK",
  ]);

/* ==========================================================
   ACTIVATION REELLE DES RETRAITS

   Par défaut :
   AUCUNE ROUTE ACTIVE.

   Le serveur recevra cette configuration
   depuis les partenaires de paiement et
   les paramètres administrateur.

   Ne jamais confondre :
   - Opérateur connu
   - Retrait opérationnel
========================================================== */

export const DEFAULT_ENABLED_ROUTES:
  readonly EnabledWithdrawalRoute[] = [];

/* ==========================================================
   UTILITAIRES PAYS
========================================================== */

export function normalizeCountryCode(
  value: string
): string {
  return value
    .trim()
    .toUpperCase();
}

export function isValidCountryCode(
  value: string
): boolean {
  const code =
    normalizeCountryCode(value);

  return isSupportedCountry(
    code
  );
}

export function isAfricanCountry(
  countryCode: string
): boolean {
  return AFRICAN_COUNTRY_SET.has(
    normalizeCountryCode(countryCode)
  );
}

export function getCountryFlag(
  countryCode: string
): string {
  const code =
    normalizeCountryCode(countryCode);

  if (
    !/^[A-Z]{2}$/.test(code)
  ) {
    return "🌍";
  }

  return String.fromCodePoint(
    ...Array.from(code).map(
      (character) =>
        character.charCodeAt(0) +
        127397
    )
  );
}

export function getCountryCurrency(
  countryCode: string
): string | null {
  const code =
    normalizeCountryCode(countryCode);

  const currency = COUNTRY_CURRENCIES[code];
  return isSupportedCurrency(currency) ? currency : null;
}

export function getCountryName(
  countryCode: string,
  locale: WithdrawalLocale = "fr"
): string {
  const code =
    normalizeCountryCode(countryCode);

  if (
    !isValidCountryCode(code)
  ) {
    return code;
  }

  try {
    const displayNames =
      new Intl.DisplayNames(
        [locale],
        {
          type: "region",
        }
      );

    return (
      displayNames.of(code) ??
      code
    );
  } catch {
    return code;
  }
}

export function getCountryDialCode(
  countryCode: string
): string | null {
  const code =
    normalizeCountryCode(countryCode);

  if (
    !isValidCountryCode(code)
  ) {
    return null;
  }

  try {
    return (
      "+" +
      getCountryCallingCode(
        code as CountryCode
      )
    );
  } catch {
    return null;
  }
}

/* ==========================================================
   PAYS INTERNATIONAUX

   Utilise la liste maintenue dans
   libphonenumber-js.

   Pas de liste manuelle des 200+ pays.
========================================================== */

export function getWithdrawalCountries(
  locale: WithdrawalLocale = "fr"
): WithdrawalCountry[] {
  return getCountries()
    .map((code) => ({
      code,

      name: getCountryName(
        code,
        locale
      ),

      callingCode:
        getCountryDialCode(code) ??
        "",

      flag:
        getCountryFlag(code),

      isAfrican:
        isAfricanCountry(code),
    }))
    .sort((a, b) =>
      a.name.localeCompare(
        b.name,
        locale,
        {
          sensitivity: "base",
        }
      )
    );
}

export function getWithdrawalCountry(
  countryCode: string,
  locale: WithdrawalLocale = "fr"
): WithdrawalCountry | null {
  const code =
    normalizeCountryCode(countryCode);

  if (
    !isValidCountryCode(code)
  ) {
    return null;
  }

  return {
    code,
    name:
      getCountryName(
        code,
        locale
      ),

    callingCode:
      getCountryDialCode(
        code
      ) ?? "",

    flag:
      getCountryFlag(code),

    isAfrican:
      isAfricanCountry(code),
  };
}

/* ==========================================================
   MOBILE MONEY PAR PAYS
========================================================== */

export function getMobileMoneyProviders(
  countryCode: string
): MobileMoneyProvider[] {
  const code =
    normalizeCountryCode(countryCode);

  if (
    !isValidCountryCode(code)
  ) {
    return [];
  }

  return MOBILE_MONEY_PROVIDERS
    .filter(
      (provider) =>
        provider.countries.includes(
          code
        )
    )
    .sort((a, b) =>
      a.name.localeCompare(
        b.name
      )
    );
}

export function getMobileMoneyProvider(
  providerCode: string
): MobileMoneyProvider | null {
  const code =
    providerCode
      .trim()
      .toUpperCase();

  return (
    MOBILE_MONEY_PROVIDERS.find(
      (provider) =>
        provider.code.toUpperCase() ===
        code
    ) ?? null
  );
}

export function isMobileMoneyProviderInCountry(
  providerCode: string,
  countryCode: string
): boolean {
  const provider =
    getMobileMoneyProvider(
      providerCode
    );

  if (!provider) {
    return false;
  }

  return provider.countries.includes(
    normalizeCountryCode(
      countryCode
    )
  );
}

/* ==========================================================
   BANQUE INTERNATIONALE
========================================================== */

export function countryUsesIban(
  countryCode: string
): boolean {
  return IBAN_COUNTRY_CODES.has(
    normalizeCountryCode(countryCode)
  );
}

export interface BankFieldConfiguration {
  countryCode: string;
  usesIban: boolean;
  requiresAccountName: boolean;
  requiresBankName: boolean;
  accountField:
    | "IBAN"
    | "ACCOUNT_NUMBER";
  swiftFieldAvailable: boolean;
  routingCodeFieldAvailable: boolean;
}

export function getBankFieldConfiguration(
  countryCode: string
): BankFieldConfiguration {
  const code =
    normalizeCountryCode(countryCode);

  const usesIban =
    countryUsesIban(code);

  return {
    countryCode: code,
    usesIban,
    requiresAccountName: true,
    requiresBankName: true,

    accountField:
      usesIban
        ? "IBAN"
        : "ACCOUNT_NUMBER",

    swiftFieldAvailable: true,

    routingCodeFieldAvailable:
      !usesIban,
  };
}

/* ==========================================================
   CRYPTO
========================================================== */

export function getCryptoAssets():
  CryptoAsset[] {
  return [
    ...CRYPTO_ASSETS,
  ];
}

export function getCryptoAsset(
  assetCode: string
): CryptoAsset | null {
  const code =
    assetCode
      .trim()
      .toUpperCase();

  return (
    CRYPTO_ASSETS.find(
      (asset) =>
        asset.code === code
    ) ?? null
  );
}

export function getCryptoNetworks(
  assetCode: string
): CryptoNetwork[] {
  const asset =
    getCryptoAsset(
      assetCode
    );

  if (!asset) {
    return [];
  }

  return CRYPTO_NETWORKS.filter(
    (network) =>
      network.assetCode ===
      asset.code
  );
}

export function getCryptoNetwork(
  assetCode: string,
  networkCode: string
): CryptoNetwork | null {
  const asset =
    getCryptoAsset(
      assetCode
    );

  if (!asset) {
    return null;
  }

  const code =
    networkCode
      .trim()
      .toUpperCase();

  return (
    CRYPTO_NETWORKS.find(
      (network) =>
        network.assetCode ===
          asset.code &&
        network.code === code
    ) ?? null
  );
}

/* ==========================================================
   ACTIVATION D'UNE ROUTE DE RETRAIT

   Le serveur doit injecter les routes
   réellement disponibles.

   Cela permet de désactiver un réseau
   sans modifier le catalogue.
========================================================== */

export function isWithdrawalRouteEnabled(
  method: WithdrawalMethodType,
  providerCode: string,
  countryCode: string,
  routes: readonly EnabledWithdrawalRoute[] =
    DEFAULT_ENABLED_ROUTES,
  options?: {
    currency?: string;
    assetCode?: CryptoAssetCode;
    networkCode?: CryptoNetworkCode;
  }
): boolean {
  const country =
    normalizeCountryCode(
      countryCode
    );

  const provider =
    providerCode
      .trim()
      .toUpperCase();

  if (
    !isValidCountryCode(country)
  ) {
    return false;
  }

  return routes.some(
    (route) => {
      if (!route.enabled) {
        return false;
      }

      if (
        route.method !== method
      ) {
        return false;
      }

      if (
        route.providerCode
          .toUpperCase() !==
        provider
      ) {
        return false;
      }

      if (
        route.countryCode
          .toUpperCase() !==
        country
      ) {
        return false;
      }

      if (
        route.currency &&
        route.currency.toUpperCase() !==
          options?.currency?.toUpperCase()
      ) {
        return false;
      }

      if (
        route.assetCode &&
        route.assetCode !==
          options?.assetCode
      ) {
        return false;
      }

      if (
        route.networkCode &&
        route.networkCode !==
          options?.networkCode
      ) {
        return false;
      }

      return true;
    }
  );
}

/* ==========================================================
   MOBILE MONEY AVEC DISPONIBILITE
========================================================== */

export function getMobileMoneyOptions(
  countryCode: string,
  routes: readonly EnabledWithdrawalRoute[] =
    DEFAULT_ENABLED_ROUTES
): WithdrawalProviderOption[] {
  const country =
    normalizeCountryCode(
      countryCode
    );

  return getMobileMoneyProviders(
    country
  ).map(
    (provider) => ({
      code:
        provider.code,

      name:
        provider.name,

      shortName:
        provider.shortName,

      type:
        "MOBILE_MONEY" as const,

      logoUrl: getWithdrawalProviderLogo(provider.code),
      icon:
        provider.icon,

      brandColor:
        provider.brandColor,

      countryCode:
        country,

      available:
        isWithdrawalRouteEnabled(
          "MOBILE_MONEY",
          provider.code,
          country,
          routes
        ),
    })
  );
}

/* ==========================================================
   BANQUE AVEC DISPONIBILITE
========================================================== */

export function getBankOption(
  countryCode: string,
  routes: readonly EnabledWithdrawalRoute[] =
    DEFAULT_ENABLED_ROUTES
): WithdrawalProviderOption {
  const country =
    normalizeCountryCode(
      countryCode
    );

  return {
    logoUrl: getWithdrawalProviderLogo("BANK_TRANSFER"),
    code: "BANK_TRANSFER",
    name: "Virement bancaire",
    shortName: "Banque",
    type: "BANK_ACCOUNT",
    icon: "lucide:landmark",
    brandColor: "#142B50",
    countryCode: country,

    available:
      isWithdrawalRouteEnabled(
        "BANK_ACCOUNT",
        "BANK_TRANSFER",
        country,
        routes
      ),
  };
}

/* ==========================================================
   CRYPTO AVEC DISPONIBILITE

   BTC et USDT restent affichables
   dans le catalogue même s'ils ne sont
   pas encore activés pour les retraits.
========================================================== */

export function getCryptoOptions(
  countryCode: string,
  routes: readonly EnabledWithdrawalRoute[] =
    DEFAULT_ENABLED_ROUTES
): WithdrawalProviderOption[] {
  const country =
    normalizeCountryCode(
      countryCode
    );

  return CRYPTO_ASSETS.map(
    (asset) => ({
      code:
        asset.code,

      name:
        asset.name,

      shortName:
        asset.symbol,

      type:
        "CRYPTO" as const,

      logoUrl: getWithdrawalProviderLogo(asset.code),
      icon:
        asset.icon,

      brandColor:
        asset.brandColor,

      countryCode:
        country,

      available:
        asset.networks.some(
          (networkCode) =>
            isWithdrawalRouteEnabled(
              "CRYPTO",
              asset.code,
              country,
              routes,
              {
                assetCode:
                  asset.code,

                networkCode,
              }
            )
        ),
    })
  );
}

/* ==========================================================
   METHODES DISPONIBLES POUR UN PAYS
========================================================== */

export function getWithdrawalMethods(
  countryCode: string,
  routes: readonly EnabledWithdrawalRoute[] =
    DEFAULT_ENABLED_ROUTES
): WithdrawalMethodOption[] {
  const mobileMoney =
    getMobileMoneyOptions(
      countryCode,
      routes
    );

  const bank =
    getBankOption(
      countryCode,
      routes
    );

  const crypto =
    getCryptoOptions(
      countryCode,
      routes
    );

  return [
    {
      type:
        "MOBILE_MONEY",

      code:
        "MOBILE_MONEY",

      name:
        "Mobile Money",

      icon:
        "lucide:smartphone",

      available:
        mobileMoney.some(
          (provider) =>
            provider.available
        ),
    },
    {
      type:
        "BANK_ACCOUNT",

      code:
        "BANK_ACCOUNT",

      name:
        "Compte bancaire",

      icon:
        "lucide:landmark",

      available:
        bank.available,
    },
    {
      type:
        "CRYPTO",

      code:
        "CRYPTO",

      name:
        "Cryptomonnaie",

      icon:
        "lucide:bitcoin",

      available:
        crypto.some(
          (asset) =>
            asset.available
        ),
    },
  ];
}

/* ==========================================================
   CATALOGUE COMPLET POUR LES API

   Utilisation prévue :
   GET /api/organizer/settings/
       withdrawal-providers?country=BJ
========================================================== */

export function getWithdrawalCatalog(
  countryCode: string,
  locale: WithdrawalLocale = "fr",
  routes: readonly EnabledWithdrawalRoute[] =
    DEFAULT_ENABLED_ROUTES
): WithdrawalProviderCatalog | null {
  const country =
    getWithdrawalCountry(
      countryCode,
      locale
    );

  if (!country) {
    return null;
  }

  return {
    country,

    methods:
      getWithdrawalMethods(
        country.code,
        routes
      ),

    mobileMoney:
      getMobileMoneyOptions(
        country.code,
        routes
      ),

    bank:
      getBankOption(
        country.code,
        routes
      ),

    crypto:
      getCryptoOptions(
        country.code,
        routes
      ),

    cryptoNetworks: [
      ...CRYPTO_NETWORKS,
    ],
  };
}

/* ==========================================================
   FILTRAGE DES OPERATEURS ACTIVES
========================================================== */

export function getEnabledMobileMoneyProviders(
  countryCode: string,
  routes: readonly EnabledWithdrawalRoute[]
): WithdrawalProviderOption[] {
  return getMobileMoneyOptions(
    countryCode,
    routes
  ).filter(
    (provider) =>
      provider.available
  );
}

export function getEnabledCryptoAssets(
  countryCode: string,
  routes: readonly EnabledWithdrawalRoute[]
): WithdrawalProviderOption[] {
  return getCryptoOptions(
    countryCode,
    routes
  ).filter(
    (asset) =>
      asset.available
  );
}

/* ==========================================================
   DISPONIBILITE PAR MOYEN
========================================================== */

export function getWithdrawalAvailability(
  method: WithdrawalMethodType,
  countryCode: string,
  routes: readonly EnabledWithdrawalRoute[] =
    DEFAULT_ENABLED_ROUTES
): WithdrawalAvailability {
  const country =
    normalizeCountryCode(
      countryCode
    );

  if (
    !isValidCountryCode(country)
  ) {
    return "UNAVAILABLE";
  }

  if (
    routes.length === 0
  ) {
    return "NOT_CONFIGURED";
  }

  const methods =
    getWithdrawalMethods(
      country,
      routes
    );

  const selected =
    methods.find(
      (item) =>
        item.type === method
    );

  if (!selected) {
    return "UNAVAILABLE";
  }

  return selected.available
    ? "AVAILABLE"
    : "UNAVAILABLE";
}

/* ==========================================================
   VERIFICATION DE COHERENCE

   Avant tout paiement réel :
   - compte vérifié
   - pays autorisé
   - opérateur disponible
   - devise autorisée
   - route partenaire activée
   - conformité appliquée côté serveur
========================================================== */

export function canUseWithdrawalProvider(
  method: WithdrawalMethodType,
  providerCode: string,
  countryCode: string,
  routes: readonly EnabledWithdrawalRoute[],
  options?: {
    currency?: string;
    assetCode?: CryptoAssetCode;
    networkCode?: CryptoNetworkCode;
  }
): boolean {
  const country =
    normalizeCountryCode(
      countryCode
    );

  if (
    !isValidCountryCode(country)
  ) {
    return false;
  }

  if (
    method === "MOBILE_MONEY"
  ) {
    if (
      !isMobileMoneyProviderInCountry(
        providerCode,
        country
      )
    ) {
      return false;
    }
  }

  if (
    method === "BANK_ACCOUNT" &&
    providerCode !== "BANK_TRANSFER"
  ) {
    return false;
  }

  if (
    method === "CRYPTO"
  ) {
    const assetCode =
      options?.assetCode;

    const networkCode =
      options?.networkCode;

    if (
      !assetCode ||
      !networkCode
    ) {
      return false;
    }

    if (
      providerCode.toUpperCase() !==
      assetCode
    ) {
      return false;
    }

    if (
      !getCryptoNetwork(
        assetCode,
        networkCode
      )
    ) {
      return false;
    }
  }

  return isWithdrawalRouteEnabled(
    method,
    providerCode,
    country,
    routes,
    options
  );
}

/* ==========================================================
   VALEURS PAR DEFAUT DU FORMULAIRE
========================================================== */

export function getDefaultWithdrawalCountry():
  string {
  return "BJ";
}

export function getDefaultWithdrawalMethod():
  WithdrawalMethodType {
  return "MOBILE_MONEY";
}

/* ==========================================================
   EXPORT GLOBAL

   Permet une importation centralisée
   lorsque plusieurs options sont nécessaires.
========================================================== */

export const withdrawalProviders = {
  methods:
    WITHDRAWAL_METHODS,

  mobileMoney:
    MOBILE_MONEY_PROVIDERS,

  cryptoAssets:
    CRYPTO_ASSETS,

  cryptoNetworks:
    CRYPTO_NETWORKS,

  getCountries:
    getWithdrawalCountries,

  getCountry:
    getWithdrawalCountry,

  getCountryCurrency:
    getCountryCurrency,

  getMobileMoneyProviders:
    getMobileMoneyProviders,

  getMobileMoneyOptions:
    getMobileMoneyOptions,

  getBankOption:
    getBankOption,

  getCryptoOptions:
    getCryptoOptions,

  getWithdrawalMethods:
    getWithdrawalMethods,

  getWithdrawalCatalog:
    getWithdrawalCatalog,

  getWithdrawalAvailability:
    getWithdrawalAvailability,

  canUseWithdrawalProvider:
    canUseWithdrawalProvider,
};

/** Logos locaux : une association stable, independante du pays et de la session. */
export function getWithdrawalProviderLogo(code: string): string | null {
  const logos: Record<string, string> = {
    MTN_MOMO: "mtn-momo", MOOV_MONEY: "moov-money", ORANGE_MONEY: "orange-money",
    WAVE: "wave", AIRTEL_MONEY: "airtel-money", MPESA: "mpesa", ECOCASH: "ecocash",
    TMONEY: "t-money", MIXX_BY_YAS: "mixx", BTC: "bitcoin", USDT: "usdt", BANK_TRANSFER: "bank",
  };
  const filename = logos[code.toUpperCase()];
  return filename ? "/payment-logos/" + filename + ".svg" : null;
}

/** Accepte un numero local, +indicatif ou 00indicatif, sans changer le pays choisi. */
export function normalizeWithdrawalPhone(reference: string, countryCode: string): string | null {
  if (!isSupportedCountry(countryCode as CountryCode)) return null;
  const compact = reference.normalize("NFKC").trim().replace(/[\s().-]/g, "");
  if (!/^\+?\d+$/.test(compact)) return null;
  const input = compact.startsWith("00") ? "+" + compact.slice(2) : compact;
  const candidates = [input];
  const callingCode = getCountryCallingCode(countryCode as CountryCode);
  if (!input.startsWith("+") && input.startsWith(callingCode)) candidates.push("+" + input);
  for (const value of candidates) {
    const phone = parsePhoneNumberFromString(value, { defaultCountry: countryCode as CountryCode, extract: false });
    if (phone?.isValid() && phone.country === countryCode) return phone.number;
  }
  return null;
}
