import {
  DEFAULT_CURRENCY_CODE,
  getCurrencyDefinition,
  isSupportedCurrencyCode,
  type SupportedCurrencyCode,
} from "@/lib/localization/currencies";

export type SupportedContinent =
  | "AFRICA"
  | "EUROPE";

export type SupportedCountry = {
  /**
   * Code ISO 3166-1 alpha-2.
   */
  code: string;

  /**
   * Nom français affiché dans Tikemia.
   */
  name: string;

  /**
   * Nom international utile pour les recherches.
   */
  englishName: string;

  /**
   * Indicatif téléphonique international.
   */
  dialCode: string;

  /**
   * Devise principale proposée par défaut.
   */
  currency: SupportedCurrencyCode;

  /**
   * Fuseau horaire IANA proposé par défaut.
   */
  timezone: string;

  /**
   * Locale utilisée pour formater les dates et montants.
   */
  locale: string;

  continent: SupportedContinent;

  /**
   * Ordre d’affichage dans les menus Tikemia.
   */
  priority: number;

  /**
   * Permet de désactiver un pays sans supprimer
   * les données historiques déjà enregistrées.
   */
  active: boolean;
};

export type CountrySelectOption = {
  value: string;
  code: string;
  name: string;
  dialCode: string;
  currency: SupportedCurrencyCode;
  currencyName: string;
  currencySymbol: string;
  timezone: string;
  locale: string;
  continent: SupportedContinent;
  label: string;
};

export const SUPPORTED_COUNTRIES: readonly SupportedCountry[] =
  [
    /*
     * Afrique de l’Ouest
     */
    {
      code: "BJ",
      name: "Bénin",
      englishName: "Benin",
      dialCode: "+229",
      currency: "XOF",
      timezone: "Africa/Porto-Novo",
      locale: "fr-BJ",
      continent: "AFRICA",
      priority: 1,
      active: true,
    },
    {
      code: "BF",
      name: "Burkina Faso",
      englishName: "Burkina Faso",
      dialCode: "+226",
      currency: "XOF",
      timezone: "Africa/Ouagadougou",
      locale: "fr-BF",
      continent: "AFRICA",
      priority: 10,
      active: true,
    },
    {
      code: "CI",
      name: "Côte d’Ivoire",
      englishName: "Ivory Coast",
      dialCode: "+225",
      currency: "XOF",
      timezone: "Africa/Abidjan",
      locale: "fr-CI",
      continent: "AFRICA",
      priority: 2,
      active: true,
    },
    {
      code: "CV",
      name: "Cap-Vert",
      englishName: "Cape Verde",
      dialCode: "+238",
      currency: "CVE",
      timezone: "Atlantic/Cape_Verde",
      locale: "pt-CV",
      continent: "AFRICA",
      priority: 30,
      active: true,
    },
    {
      code: "GM",
      name: "Gambie",
      englishName: "Gambia",
      dialCode: "+220",
      currency: "GMD",
      timezone: "Africa/Banjul",
      locale: "en-GM",
      continent: "AFRICA",
      priority: 31,
      active: true,
    },
    {
      code: "GH",
      name: "Ghana",
      englishName: "Ghana",
      dialCode: "+233",
      currency: "GHS",
      timezone: "Africa/Accra",
      locale: "en-GH",
      continent: "AFRICA",
      priority: 4,
      active: true,
    },
    {
      code: "GN",
      name: "Guinée",
      englishName: "Guinea",
      dialCode: "+224",
      currency: "GNF",
      timezone: "Africa/Conakry",
      locale: "fr-GN",
      continent: "AFRICA",
      priority: 32,
      active: true,
    },
    {
      code: "GW",
      name: "Guinée-Bissau",
      englishName: "Guinea-Bissau",
      dialCode: "+245",
      currency: "XOF",
      timezone: "Africa/Bissau",
      locale: "pt-GW",
      continent: "AFRICA",
      priority: 33,
      active: true,
    },
    {
      code: "LR",
      name: "Liberia",
      englishName: "Liberia",
      dialCode: "+231",
      currency: "LRD",
      timezone: "Africa/Monrovia",
      locale: "en-LR",
      continent: "AFRICA",
      priority: 34,
      active: true,
    },
    {
      code: "ML",
      name: "Mali",
      englishName: "Mali",
      dialCode: "+223",
      currency: "XOF",
      timezone: "Africa/Bamako",
      locale: "fr-ML",
      continent: "AFRICA",
      priority: 7,
      active: true,
    },
    {
      code: "MR",
      name: "Mauritanie",
      englishName: "Mauritania",
      dialCode: "+222",
      currency: "MRU",
      timezone: "Africa/Nouakchott",
      locale: "fr-MR",
      continent: "AFRICA",
      priority: 35,
      active: true,
    },
    {
      code: "NE",
      name: "Niger",
      englishName: "Niger",
      dialCode: "+227",
      currency: "XOF",
      timezone: "Africa/Niamey",
      locale: "fr-NE",
      continent: "AFRICA",
      priority: 8,
      active: true,
    },
    {
      code: "NG",
      name: "Nigeria",
      englishName: "Nigeria",
      dialCode: "+234",
      currency: "NGN",
      timezone: "Africa/Lagos",
      locale: "en-NG",
      continent: "AFRICA",
      priority: 3,
      active: true,
    },
    {
      code: "SN",
      name: "Sénégal",
      englishName: "Senegal",
      dialCode: "+221",
      currency: "XOF",
      timezone: "Africa/Dakar",
      locale: "fr-SN",
      continent: "AFRICA",
      priority: 6,
      active: true,
    },
    {
      code: "SL",
      name: "Sierra Leone",
      englishName: "Sierra Leone",
      dialCode: "+232",
      currency: "SLL",
      timezone: "Africa/Freetown",
      locale: "en-SL",
      continent: "AFRICA",
      priority: 36,
      active: true,
    },
    {
      code: "TG",
      name: "Togo",
      englishName: "Togo",
      dialCode: "+228",
      currency: "XOF",
      timezone: "Africa/Lome",
      locale: "fr-TG",
      continent: "AFRICA",
      priority: 5,
      active: true,
    },

    /*
     * Afrique centrale
     */
    {
      code: "CM",
      name: "Cameroun",
      englishName: "Cameroon",
      dialCode: "+237",
      currency: "XAF",
      timezone: "Africa/Douala",
      locale: "fr-CM",
      continent: "AFRICA",
      priority: 11,
      active: true,
    },
    {
      code: "CF",
      name: "République centrafricaine",
      englishName: "Central African Republic",
      dialCode: "+236",
      currency: "XAF",
      timezone: "Africa/Bangui",
      locale: "fr-CF",
      continent: "AFRICA",
      priority: 37,
      active: true,
    },
    {
      code: "TD",
      name: "Tchad",
      englishName: "Chad",
      dialCode: "+235",
      currency: "XAF",
      timezone: "Africa/Ndjamena",
      locale: "fr-TD",
      continent: "AFRICA",
      priority: 38,
      active: true,
    },
    {
      code: "CG",
      name: "République du Congo",
      englishName: "Republic of the Congo",
      dialCode: "+242",
      currency: "XAF",
      timezone: "Africa/Brazzaville",
      locale: "fr-CG",
      continent: "AFRICA",
      priority: 39,
      active: true,
    },
    {
      code: "CD",
      name: "République démocratique du Congo",
      englishName: "Democratic Republic of the Congo",
      dialCode: "+243",
      currency: "CDF",
      timezone: "Africa/Kinshasa",
      locale: "fr-CD",
      continent: "AFRICA",
      priority: 16,
      active: true,
    },
    {
      code: "GQ",
      name: "Guinée équatoriale",
      englishName: "Equatorial Guinea",
      dialCode: "+240",
      currency: "XAF",
      timezone: "Africa/Malabo",
      locale: "es-GQ",
      continent: "AFRICA",
      priority: 40,
      active: true,
    },
    {
      code: "GA",
      name: "Gabon",
      englishName: "Gabon",
      dialCode: "+241",
      currency: "XAF",
      timezone: "Africa/Libreville",
      locale: "fr-GA",
      continent: "AFRICA",
      priority: 12,
      active: true,
    },
    {
      code: "ST",
      name: "Sao Tomé-et-Principe",
      englishName: "Sao Tome and Principe",
      dialCode: "+239",
      currency: "STN",
      timezone: "Africa/Sao_Tome",
      locale: "pt-ST",
      continent: "AFRICA",
      priority: 41,
      active: true,
    },

    /*
     * Afrique de l’Est et Corne de l’Afrique
     */
    {
      code: "BI",
      name: "Burundi",
      englishName: "Burundi",
      dialCode: "+257",
      currency: "BIF",
      timezone: "Africa/Bujumbura",
      locale: "fr-BI",
      continent: "AFRICA",
      priority: 42,
      active: true,
    },
    {
      code: "DJ",
      name: "Djibouti",
      englishName: "Djibouti",
      dialCode: "+253",
      currency: "DJF",
      timezone: "Africa/Djibouti",
      locale: "fr-DJ",
      continent: "AFRICA",
      priority: 43,
      active: true,
    },
    {
      code: "ER",
      name: "Érythrée",
      englishName: "Eritrea",
      dialCode: "+291",
      currency: "ERN",
      timezone: "Africa/Asmara",
      locale: "en-ER",
      continent: "AFRICA",
      priority: 44,
      active: true,
    },
    {
      code: "ET",
      name: "Éthiopie",
      englishName: "Ethiopia",
      dialCode: "+251",
      currency: "ETB",
      timezone: "Africa/Addis_Ababa",
      locale: "en-ET",
      continent: "AFRICA",
      priority: 45,
      active: true,
    },
    {
      code: "KE",
      name: "Kenya",
      englishName: "Kenya",
      dialCode: "+254",
      currency: "KES",
      timezone: "Africa/Nairobi",
      locale: "en-KE",
      continent: "AFRICA",
      priority: 13,
      active: true,
    },
    {
      code: "RW",
      name: "Rwanda",
      englishName: "Rwanda",
      dialCode: "+250",
      currency: "RWF",
      timezone: "Africa/Kigali",
      locale: "fr-RW",
      continent: "AFRICA",
      priority: 17,
      active: true,
    },
    {
      code: "SO",
      name: "Somalie",
      englishName: "Somalia",
      dialCode: "+252",
      currency: "SOS",
      timezone: "Africa/Mogadishu",
      locale: "so-SO",
      continent: "AFRICA",
      priority: 46,
      active: true,
    },
    {
      code: "SS",
      name: "Soudan du Sud",
      englishName: "South Sudan",
      dialCode: "+211",
      currency: "SSP",
      timezone: "Africa/Juba",
      locale: "en-SS",
      continent: "AFRICA",
      priority: 47,
      active: true,
    },
    {
      code: "SD",
      name: "Soudan",
      englishName: "Sudan",
      dialCode: "+249",
      currency: "SDG",
      timezone: "Africa/Khartoum",
      locale: "ar-SD",
      continent: "AFRICA",
      priority: 48,
      active: true,
    },
    {
      code: "TZ",
      name: "Tanzanie",
      englishName: "Tanzania",
      dialCode: "+255",
      currency: "TZS",
      timezone: "Africa/Dar_es_Salaam",
      locale: "sw-TZ",
      continent: "AFRICA",
      priority: 18,
      active: true,
    },
    {
      code: "UG",
      name: "Ouganda",
      englishName: "Uganda",
      dialCode: "+256",
      currency: "UGX",
      timezone: "Africa/Kampala",
      locale: "en-UG",
      continent: "AFRICA",
      priority: 19,
      active: true,
    },

    /*
     * Afrique australe et océan Indien
     */
    {
      code: "AO",
      name: "Angola",
      englishName: "Angola",
      dialCode: "+244",
      currency: "AOA",
      timezone: "Africa/Luanda",
      locale: "pt-AO",
      continent: "AFRICA",
      priority: 49,
      active: true,
    },
    {
      code: "BW",
      name: "Botswana",
      englishName: "Botswana",
      dialCode: "+267",
      currency: "BWP",
      timezone: "Africa/Gaborone",
      locale: "en-BW",
      continent: "AFRICA",
      priority: 50,
      active: true,
    },
    {
      code: "KM",
      name: "Comores",
      englishName: "Comoros",
      dialCode: "+269",
      currency: "KMF",
      timezone: "Indian/Comoro",
      locale: "fr-KM",
      continent: "AFRICA",
      priority: 51,
      active: true,
    },
    {
      code: "SZ",
      name: "Eswatini",
      englishName: "Eswatini",
      dialCode: "+268",
      currency: "SZL",
      timezone: "Africa/Mbabane",
      locale: "en-SZ",
      continent: "AFRICA",
      priority: 52,
      active: true,
    },
    {
      code: "LS",
      name: "Lesotho",
      englishName: "Lesotho",
      dialCode: "+266",
      currency: "LSL",
      timezone: "Africa/Maseru",
      locale: "en-LS",
      continent: "AFRICA",
      priority: 53,
      active: true,
    },
    {
      code: "MG",
      name: "Madagascar",
      englishName: "Madagascar",
      dialCode: "+261",
      currency: "MGA",
      timezone: "Indian/Antananarivo",
      locale: "fr-MG",
      continent: "AFRICA",
      priority: 20,
      active: true,
    },
    {
      code: "MW",
      name: "Malawi",
      englishName: "Malawi",
      dialCode: "+265",
      currency: "MWK",
      timezone: "Africa/Blantyre",
      locale: "en-MW",
      continent: "AFRICA",
      priority: 54,
      active: true,
    },
    {
      code: "MU",
      name: "Maurice",
      englishName: "Mauritius",
      dialCode: "+230",
      currency: "MUR",
      timezone: "Indian/Mauritius",
      locale: "fr-MU",
      continent: "AFRICA",
      priority: 21,
      active: true,
    },
    {
      code: "MZ",
      name: "Mozambique",
      englishName: "Mozambique",
      dialCode: "+258",
      currency: "MZN",
      timezone: "Africa/Maputo",
      locale: "pt-MZ",
      continent: "AFRICA",
      priority: 55,
      active: true,
    },
    {
      code: "NA",
      name: "Namibie",
      englishName: "Namibia",
      dialCode: "+264",
      currency: "NAD",
      timezone: "Africa/Windhoek",
      locale: "en-NA",
      continent: "AFRICA",
      priority: 56,
      active: true,
    },
    {
      code: "SC",
      name: "Seychelles",
      englishName: "Seychelles",
      dialCode: "+248",
      currency: "SCR",
      timezone: "Indian/Mahe",
      locale: "fr-SC",
      continent: "AFRICA",
      priority: 57,
      active: true,
    },
    {
      code: "ZA",
      name: "Afrique du Sud",
      englishName: "South Africa",
      dialCode: "+27",
      currency: "ZAR",
      timezone: "Africa/Johannesburg",
      locale: "en-ZA",
      continent: "AFRICA",
      priority: 14,
      active: true,
    },
    {
      code: "ZM",
      name: "Zambie",
      englishName: "Zambia",
      dialCode: "+260",
      currency: "ZMW",
      timezone: "Africa/Lusaka",
      locale: "en-ZM",
      continent: "AFRICA",
      priority: 58,
      active: true,
    },
    {
      code: "ZW",
      name: "Zimbabwe",
      englishName: "Zimbabwe",
      dialCode: "+263",
      currency: "ZWL",
      timezone: "Africa/Harare",
      locale: "en-ZW",
      continent: "AFRICA",
      priority: 59,
      active: true,
    },

    /*
     * Afrique du Nord
     */
    {
      code: "DZ",
      name: "Algérie",
      englishName: "Algeria",
      dialCode: "+213",
      currency: "DZD",
      timezone: "Africa/Algiers",
      locale: "fr-DZ",
      continent: "AFRICA",
      priority: 22,
      active: true,
    },
    {
      code: "EG",
      name: "Égypte",
      englishName: "Egypt",
      dialCode: "+20",
      currency: "EGP",
      timezone: "Africa/Cairo",
      locale: "ar-EG",
      continent: "AFRICA",
      priority: 23,
      active: true,
    },
    {
      code: "LY",
      name: "Libye",
      englishName: "Libya",
      dialCode: "+218",
      currency: "LYD",
      timezone: "Africa/Tripoli",
      locale: "ar-LY",
      continent: "AFRICA",
      priority: 60,
      active: true,
    },
    {
      code: "MA",
      name: "Maroc",
      englishName: "Morocco",
      dialCode: "+212",
      currency: "MAD",
      timezone: "Africa/Casablanca",
      locale: "fr-MA",
      continent: "AFRICA",
      priority: 15,
      active: true,
    },
    {
      code: "TN",
      name: "Tunisie",
      englishName: "Tunisia",
      dialCode: "+216",
      currency: "TND",
      timezone: "Africa/Tunis",
      locale: "fr-TN",
      continent: "AFRICA",
      priority: 24,
      active: true,
    },

    /*
     * Europe utilisant l’euro
     */
    {
      code: "DE",
      name: "Allemagne",
      englishName: "Germany",
      dialCode: "+49",
      currency: "EUR",
      timezone: "Europe/Berlin",
      locale: "de-DE",
      continent: "EUROPE",
      priority: 102,
      active: true,
    },
    {
      code: "AD",
      name: "Andorre",
      englishName: "Andorra",
      dialCode: "+376",
      currency: "EUR",
      timezone: "Europe/Andorra",
      locale: "ca-AD",
      continent: "EUROPE",
      priority: 130,
      active: true,
    },
    {
      code: "AT",
      name: "Autriche",
      englishName: "Austria",
      dialCode: "+43",
      currency: "EUR",
      timezone: "Europe/Vienna",
      locale: "de-AT",
      continent: "EUROPE",
      priority: 131,
      active: true,
    },
    {
      code: "BE",
      name: "Belgique",
      englishName: "Belgium",
      dialCode: "+32",
      currency: "EUR",
      timezone: "Europe/Brussels",
      locale: "fr-BE",
      continent: "EUROPE",
      priority: 101,
      active: true,
    },
    {
      code: "BG",
      name: "Bulgarie",
      englishName: "Bulgaria",
      dialCode: "+359",
      currency: "EUR",
      timezone: "Europe/Sofia",
      locale: "bg-BG",
      continent: "EUROPE",
      priority: 132,
      active: true,
    },
    {
      code: "CY",
      name: "Chypre",
      englishName: "Cyprus",
      dialCode: "+357",
      currency: "EUR",
      timezone: "Asia/Nicosia",
      locale: "el-CY",
      continent: "EUROPE",
      priority: 133,
      active: true,
    },
    {
      code: "HR",
      name: "Croatie",
      englishName: "Croatia",
      dialCode: "+385",
      currency: "EUR",
      timezone: "Europe/Zagreb",
      locale: "hr-HR",
      continent: "EUROPE",
      priority: 134,
      active: true,
    },
    {
      code: "ES",
      name: "Espagne",
      englishName: "Spain",
      dialCode: "+34",
      currency: "EUR",
      timezone: "Europe/Madrid",
      locale: "es-ES",
      continent: "EUROPE",
      priority: 104,
      active: true,
    },
    {
      code: "EE",
      name: "Estonie",
      englishName: "Estonia",
      dialCode: "+372",
      currency: "EUR",
      timezone: "Europe/Tallinn",
      locale: "et-EE",
      continent: "EUROPE",
      priority: 135,
      active: true,
    },
    {
      code: "FI",
      name: "Finlande",
      englishName: "Finland",
      dialCode: "+358",
      currency: "EUR",
      timezone: "Europe/Helsinki",
      locale: "fi-FI",
      continent: "EUROPE",
      priority: 136,
      active: true,
    },
    {
      code: "FR",
      name: "France",
      englishName: "France",
      dialCode: "+33",
      currency: "EUR",
      timezone: "Europe/Paris",
      locale: "fr-FR",
      continent: "EUROPE",
      priority: 100,
      active: true,
    },
    {
      code: "GR",
      name: "Grèce",
      englishName: "Greece",
      dialCode: "+30",
      currency: "EUR",
      timezone: "Europe/Athens",
      locale: "el-GR",
      continent: "EUROPE",
      priority: 137,
      active: true,
    },
    {
      code: "IE",
      name: "Irlande",
      englishName: "Ireland",
      dialCode: "+353",
      currency: "EUR",
      timezone: "Europe/Dublin",
      locale: "en-IE",
      continent: "EUROPE",
      priority: 138,
      active: true,
    },
    {
      code: "IT",
      name: "Italie",
      englishName: "Italy",
      dialCode: "+39",
      currency: "EUR",
      timezone: "Europe/Rome",
      locale: "it-IT",
      continent: "EUROPE",
      priority: 103,
      active: true,
    },
    {
      code: "LV",
      name: "Lettonie",
      englishName: "Latvia",
      dialCode: "+371",
      currency: "EUR",
      timezone: "Europe/Riga",
      locale: "lv-LV",
      continent: "EUROPE",
      priority: 139,
      active: true,
    },
    {
      code: "LT",
      name: "Lituanie",
      englishName: "Lithuania",
      dialCode: "+370",
      currency: "EUR",
      timezone: "Europe/Vilnius",
      locale: "lt-LT",
      continent: "EUROPE",
      priority: 140,
      active: true,
    },
    {
      code: "LU",
      name: "Luxembourg",
      englishName: "Luxembourg",
      dialCode: "+352",
      currency: "EUR",
      timezone: "Europe/Luxembourg",
      locale: "fr-LU",
      continent: "EUROPE",
      priority: 141,
      active: true,
    },
    {
      code: "MT",
      name: "Malte",
      englishName: "Malta",
      dialCode: "+356",
      currency: "EUR",
      timezone: "Europe/Malta",
      locale: "mt-MT",
      continent: "EUROPE",
      priority: 142,
      active: true,
    },
    {
      code: "MC",
      name: "Monaco",
      englishName: "Monaco",
      dialCode: "+377",
      currency: "EUR",
      timezone: "Europe/Monaco",
      locale: "fr-MC",
      continent: "EUROPE",
      priority: 143,
      active: true,
    },
    {
      code: "ME",
      name: "Monténégro",
      englishName: "Montenegro",
      dialCode: "+382",
      currency: "EUR",
      timezone: "Europe/Podgorica",
      locale: "sr-ME",
      continent: "EUROPE",
      priority: 144,
      active: true,
    },
    {
      code: "NL",
      name: "Pays-Bas",
      englishName: "Netherlands",
      dialCode: "+31",
      currency: "EUR",
      timezone: "Europe/Amsterdam",
      locale: "nl-NL",
      continent: "EUROPE",
      priority: 105,
      active: true,
    },
    {
      code: "PT",
      name: "Portugal",
      englishName: "Portugal",
      dialCode: "+351",
      currency: "EUR",
      timezone: "Europe/Lisbon",
      locale: "pt-PT",
      continent: "EUROPE",
      priority: 106,
      active: true,
    },
    {
      code: "SM",
      name: "Saint-Marin",
      englishName: "San Marino",
      dialCode: "+378",
      currency: "EUR",
      timezone: "Europe/San_Marino",
      locale: "it-SM",
      continent: "EUROPE",
      priority: 145,
      active: true,
    },
    {
      code: "SK",
      name: "Slovaquie",
      englishName: "Slovakia",
      dialCode: "+421",
      currency: "EUR",
      timezone: "Europe/Bratislava",
      locale: "sk-SK",
      continent: "EUROPE",
      priority: 146,
      active: true,
    },
    {
      code: "SI",
      name: "Slovénie",
      englishName: "Slovenia",
      dialCode: "+386",
      currency: "EUR",
      timezone: "Europe/Ljubljana",
      locale: "sl-SI",
      continent: "EUROPE",
      priority: 147,
      active: true,
    },
    {
      code: "VA",
      name: "Vatican",
      englishName: "Vatican City",
      dialCode: "+379",
      currency: "EUR",
      timezone: "Europe/Vatican",
      locale: "it-VA",
      continent: "EUROPE",
      priority: 148,
      active: true,
    },
    {
      code: "XK",
      name: "Kosovo",
      englishName: "Kosovo",
      dialCode: "+383",
      currency: "EUR",
      timezone: "Europe/Belgrade",
      locale: "sq-XK",
      continent: "EUROPE",
      priority: 149,
      active: true,
    },

    /*
     * Autres devises européennes supportées
     */
    {
      code: "AL",
      name: "Albanie",
      englishName: "Albania",
      dialCode: "+355",
      currency: "ALL",
      timezone: "Europe/Tirane",
      locale: "sq-AL",
      continent: "EUROPE",
      priority: 150,
      active: true,
    },
    {
      code: "BA",
      name: "Bosnie-Herzégovine",
      englishName: "Bosnia and Herzegovina",
      dialCode: "+387",
      currency: "BAM",
      timezone: "Europe/Sarajevo",
      locale: "bs-BA",
      continent: "EUROPE",
      priority: 151,
      active: true,
    },
    {
      code: "CH",
      name: "Suisse",
      englishName: "Switzerland",
      dialCode: "+41",
      currency: "CHF",
      timezone: "Europe/Zurich",
      locale: "fr-CH",
      continent: "EUROPE",
      priority: 109,
      active: true,
    },
    {
      code: "CZ",
      name: "Tchéquie",
      englishName: "Czechia",
      dialCode: "+420",
      currency: "CZK",
      timezone: "Europe/Prague",
      locale: "cs-CZ",
      continent: "EUROPE",
      priority: 152,
      active: true,
    },
    {
      code: "DK",
      name: "Danemark",
      englishName: "Denmark",
      dialCode: "+45",
      currency: "DKK",
      timezone: "Europe/Copenhagen",
      locale: "da-DK",
      continent: "EUROPE",
      priority: 153,
      active: true,
    },
    {
      code: "GB",
      name: "Royaume-Uni",
      englishName: "United Kingdom",
      dialCode: "+44",
      currency: "GBP",
      timezone: "Europe/London",
      locale: "en-GB",
      continent: "EUROPE",
      priority: 107,
      active: true,
    },
    {
      code: "GE",
      name: "Géorgie",
      englishName: "Georgia",
      dialCode: "+995",
      currency: "GEL",
      timezone: "Asia/Tbilisi",
      locale: "ka-GE",
      continent: "EUROPE",
      priority: 154,
      active: true,
    },
    {
      code: "HU",
      name: "Hongrie",
      englishName: "Hungary",
      dialCode: "+36",
      currency: "HUF",
      timezone: "Europe/Budapest",
      locale: "hu-HU",
      continent: "EUROPE",
      priority: 155,
      active: true,
    },
    {
      code: "IS",
      name: "Islande",
      englishName: "Iceland",
      dialCode: "+354",
      currency: "ISK",
      timezone: "Atlantic/Reykjavik",
      locale: "is-IS",
      continent: "EUROPE",
      priority: 156,
      active: true,
    },
    {
      code: "LI",
      name: "Liechtenstein",
      englishName: "Liechtenstein",
      dialCode: "+423",
      currency: "CHF",
      timezone: "Europe/Vaduz",
      locale: "de-LI",
      continent: "EUROPE",
      priority: 157,
      active: true,
    },
    {
      code: "MD",
      name: "Moldavie",
      englishName: "Moldova",
      dialCode: "+373",
      currency: "MDL",
      timezone: "Europe/Chisinau",
      locale: "ro-MD",
      continent: "EUROPE",
      priority: 158,
      active: true,
    },
    {
      code: "MK",
      name: "Macédoine du Nord",
      englishName: "North Macedonia",
      dialCode: "+389",
      currency: "MKD",
      timezone: "Europe/Skopje",
      locale: "mk-MK",
      continent: "EUROPE",
      priority: 159,
      active: true,
    },
    {
      code: "NO",
      name: "Norvège",
      englishName: "Norway",
      dialCode: "+47",
      currency: "NOK",
      timezone: "Europe/Oslo",
      locale: "nb-NO",
      continent: "EUROPE",
      priority: 160,
      active: true,
    },
    {
      code: "PL",
      name: "Pologne",
      englishName: "Poland",
      dialCode: "+48",
      currency: "PLN",
      timezone: "Europe/Warsaw",
      locale: "pl-PL",
      continent: "EUROPE",
      priority: 161,
      active: true,
    },
    {
      code: "RO",
      name: "Roumanie",
      englishName: "Romania",
      dialCode: "+40",
      currency: "RON",
      timezone: "Europe/Bucharest",
      locale: "ro-RO",
      continent: "EUROPE",
      priority: 162,
      active: true,
    },
    {
      code: "RS",
      name: "Serbie",
      englishName: "Serbia",
      dialCode: "+381",
      currency: "RSD",
      timezone: "Europe/Belgrade",
      locale: "sr-RS",
      continent: "EUROPE",
      priority: 163,
      active: true,
    },
    {
      code: "SE",
      name: "Suède",
      englishName: "Sweden",
      dialCode: "+46",
      currency: "SEK",
      timezone: "Europe/Stockholm",
      locale: "sv-SE",
      continent: "EUROPE",
      priority: 164,
      active: true,
    },
    {
      code: "TR",
      name: "Turquie",
      englishName: "Turkey",
      dialCode: "+90",
      currency: "TRY",
      timezone: "Europe/Istanbul",
      locale: "tr-TR",
      continent: "EUROPE",
      priority: 165,
      active: true,
    },
    {
      code: "UA",
      name: "Ukraine",
      englishName: "Ukraine",
      dialCode: "+380",
      currency: "UAH",
      timezone: "Europe/Kyiv",
      locale: "uk-UA",
      continent: "EUROPE",
      priority: 166,
      active: true,
    },
  ] as const;

const COUNTRY_BY_CODE = new Map<
  string,
  SupportedCountry
>(
  SUPPORTED_COUNTRIES.map(
    (country) => [
      country.code,
      country,
    ],
  ),
);

function normalizeCountryCode(
  value: string,
): string {
  return value
    .trim()
    .toUpperCase();
}

export function isSupportedCountryCode(
  value: unknown,
): value is string {
  if (
    typeof value !== "string"
  ) {
    return false;
  }

  return COUNTRY_BY_CODE.has(
    normalizeCountryCode(
      value,
    ),
  );
}

export function getCountryByCode(
  countryCode: string,
): SupportedCountry | null {
  const normalizedCode =
    normalizeCountryCode(
      countryCode,
    );

  if (!normalizedCode) {
    return null;
  }

  return (
    COUNTRY_BY_CODE.get(
      normalizedCode,
    ) ?? null
  );
}

export function getActiveCountries(): SupportedCountry[] {
  return [
    ...SUPPORTED_COUNTRIES,
  ]
    .filter(
      (country) =>
        country.active,
    )
    .sort(
      (first, second) =>
        first.priority -
        second.priority,
    );
}

export function getCountriesByContinent(
  continent: SupportedContinent,
): SupportedCountry[] {
  return getActiveCountries().filter(
    (country) =>
      country.continent ===
      continent,
  );
}

export function getAfricanCountries(): SupportedCountry[] {
  return getCountriesByContinent(
    "AFRICA",
  );
}

export function getEuropeanCountries(): SupportedCountry[] {
  return getCountriesByContinent(
    "EUROPE",
  );
}

export function getCountrySelectOptions(): CountrySelectOption[] {
  return getActiveCountries().map(
    (country) => {
      const currency =
        getCurrencyDefinition(
          country.currency,
        );

      return {
        value:
          country.code,

        code:
          country.code,

        name:
          country.name,

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
          `${country.name} (${country.dialCode})`,
      };
    },
  );
}

export function getDefaultCurrencyForCountry(
  countryCode: string,
): SupportedCurrencyCode {
  const country =
    getCountryByCode(
      countryCode,
    );

  if (
    country &&
    isSupportedCurrencyCode(
      country.currency,
    )
  ) {
    return country.currency;
  }

  return DEFAULT_CURRENCY_CODE;
}

export function getDefaultTimezoneForCountry(
  countryCode: string,
): string {
  return (
    getCountryByCode(
      countryCode,
    )?.timezone ??
    "Africa/Porto-Novo"
  );
}

export function getDefaultLocaleForCountry(
  countryCode: string,
): string {
  return (
    getCountryByCode(
      countryCode,
    )?.locale ??
    "fr-FR"
  );
}

export function getDialCodeForCountry(
  countryCode: string,
): string | null {
  return (
    getCountryByCode(
      countryCode,
    )?.dialCode ??
    null
  );
}

export function validateCountryCurrencyPair({
  countryCode,
  currencyCode,
}: {
  countryCode: string;
  currencyCode: string;
}): boolean {
  const country =
    getCountryByCode(
      countryCode,
    );

  if (
    !country ||
    !isSupportedCurrencyCode(
      currencyCode,
    )
  ) {
    return false;
  }

  return (
    country.currency ===
    currencyCode
      .trim()
      .toUpperCase()
  );
}

export const DEFAULT_COUNTRY_CODE =
  "BJ";