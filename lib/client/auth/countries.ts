export type ClientCountry = {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
};

export const CLIENT_COUNTRIES: ClientCountry[] = [
  { name: "Afrique du Sud", code: "ZA", dialCode: "+27", flag: "🇿🇦" },
  { name: "Algérie", code: "DZ", dialCode: "+213", flag: "🇩🇿" },
  { name: "Allemagne", code: "DE", dialCode: "+49", flag: "🇩🇪" },
  { name: "Angola", code: "AO", dialCode: "+244", flag: "🇦🇴" },
  { name: "Arabie saoudite", code: "SA", dialCode: "+966", flag: "🇸🇦" },
  { name: "Argentine", code: "AR", dialCode: "+54", flag: "🇦🇷" },
  { name: "Australie", code: "AU", dialCode: "+61", flag: "🇦🇺" },
  { name: "Autriche", code: "AT", dialCode: "+43", flag: "🇦🇹" },
  { name: "Belgique", code: "BE", dialCode: "+32", flag: "🇧🇪" },
  { name: "Bénin", code: "BJ", dialCode: "+229", flag: "🇧🇯" },
  { name: "Botswana", code: "BW", dialCode: "+267", flag: "🇧🇼" },
  { name: "Brésil", code: "BR", dialCode: "+55", flag: "🇧🇷" },
  { name: "Burkina Faso", code: "BF", dialCode: "+226", flag: "🇧🇫" },
  { name: "Burundi", code: "BI", dialCode: "+257", flag: "🇧🇮" },
  { name: "Cameroun", code: "CM", dialCode: "+237", flag: "🇨🇲" },
  { name: "Canada", code: "CA", dialCode: "+1", flag: "🇨🇦" },
  { name: "Cap-Vert", code: "CV", dialCode: "+238", flag: "🇨🇻" },
  { name: "Chine", code: "CN", dialCode: "+86", flag: "🇨🇳" },
  { name: "Chypre", code: "CY", dialCode: "+357", flag: "🇨🇾" },
  { name: "Colombie", code: "CO", dialCode: "+57", flag: "🇨🇴" },
  { name: "Comores", code: "KM", dialCode: "+269", flag: "🇰🇲" },
  { name: "Congo", code: "CG", dialCode: "+242", flag: "🇨🇬" },
  { name: "Corée du Sud", code: "KR", dialCode: "+82", flag: "🇰🇷" },
  { name: "Côte d’Ivoire", code: "CI", dialCode: "+225", flag: "🇨🇮" },
  { name: "Danemark", code: "DK", dialCode: "+45", flag: "🇩🇰" },
  { name: "Djibouti", code: "DJ", dialCode: "+253", flag: "🇩🇯" },
  { name: "Égypte", code: "EG", dialCode: "+20", flag: "🇪🇬" },
  { name: "Émirats arabes unis", code: "AE", dialCode: "+971", flag: "🇦🇪" },
  { name: "Espagne", code: "ES", dialCode: "+34", flag: "🇪🇸" },
  { name: "Estonie", code: "EE", dialCode: "+372", flag: "🇪🇪" },
  { name: "États-Unis", code: "US", dialCode: "+1", flag: "🇺🇸" },
  { name: "Éthiopie", code: "ET", dialCode: "+251", flag: "🇪🇹" },
  { name: "Finlande", code: "FI", dialCode: "+358", flag: "🇫🇮" },
  { name: "France", code: "FR", dialCode: "+33", flag: "🇫🇷" },
  { name: "Gabon", code: "GA", dialCode: "+241", flag: "🇬🇦" },
  { name: "Gambie", code: "GM", dialCode: "+220", flag: "🇬🇲" },
  { name: "Ghana", code: "GH", dialCode: "+233", flag: "🇬🇭" },
  { name: "Grèce", code: "GR", dialCode: "+30", flag: "🇬🇷" },
  { name: "Guinée", code: "GN", dialCode: "+224", flag: "🇬🇳" },
  { name: "Guinée-Bissau", code: "GW", dialCode: "+245", flag: "🇬🇼" },
  { name: "Guinée équatoriale", code: "GQ", dialCode: "+240", flag: "🇬🇶" },
  { name: "Hongrie", code: "HU", dialCode: "+36", flag: "🇭🇺" },
  { name: "Inde", code: "IN", dialCode: "+91", flag: "🇮🇳" },
  { name: "Indonésie", code: "ID", dialCode: "+62", flag: "🇮🇩" },
  { name: "Irlande", code: "IE", dialCode: "+353", flag: "🇮🇪" },
  { name: "Islande", code: "IS", dialCode: "+354", flag: "🇮🇸" },
  { name: "Israël", code: "IL", dialCode: "+972", flag: "🇮🇱" },
  { name: "Italie", code: "IT", dialCode: "+39", flag: "🇮🇹" },
  { name: "Japon", code: "JP", dialCode: "+81", flag: "🇯🇵" },
  { name: "Kenya", code: "KE", dialCode: "+254", flag: "🇰🇪" },
  { name: "Lesotho", code: "LS", dialCode: "+266", flag: "🇱🇸" },
  { name: "Lettonie", code: "LV", dialCode: "+371", flag: "🇱🇻" },
  { name: "Liban", code: "LB", dialCode: "+961", flag: "🇱🇧" },
  { name: "Liberia", code: "LR", dialCode: "+231", flag: "🇱🇷" },
  { name: "Libye", code: "LY", dialCode: "+218", flag: "🇱🇾" },
  { name: "Lituanie", code: "LT", dialCode: "+370", flag: "🇱🇹" },
  { name: "Luxembourg", code: "LU", dialCode: "+352", flag: "🇱🇺" },
  { name: "Madagascar", code: "MG", dialCode: "+261", flag: "🇲🇬" },
  { name: "Malaisie", code: "MY", dialCode: "+60", flag: "🇲🇾" },
  { name: "Malawi", code: "MW", dialCode: "+265", flag: "🇲🇼" },
  { name: "Mali", code: "ML", dialCode: "+223", flag: "🇲🇱" },
  { name: "Malte", code: "MT", dialCode: "+356", flag: "🇲🇹" },
  { name: "Maroc", code: "MA", dialCode: "+212", flag: "🇲🇦" },
  { name: "Maurice", code: "MU", dialCode: "+230", flag: "🇲🇺" },
  { name: "Mauritanie", code: "MR", dialCode: "+222", flag: "🇲🇷" },
  { name: "Mexique", code: "MX", dialCode: "+52", flag: "🇲🇽" },
  { name: "Mozambique", code: "MZ", dialCode: "+258", flag: "🇲🇿" },
  { name: "Namibie", code: "NA", dialCode: "+264", flag: "🇳🇦" },
  { name: "Niger", code: "NE", dialCode: "+227", flag: "🇳🇪" },
  { name: "Nigeria", code: "NG", dialCode: "+234", flag: "🇳🇬" },
  { name: "Norvège", code: "NO", dialCode: "+47", flag: "🇳🇴" },
  { name: "Nouvelle-Zélande", code: "NZ", dialCode: "+64", flag: "🇳🇿" },
  { name: "Ouganda", code: "UG", dialCode: "+256", flag: "🇺🇬" },
  { name: "Pays-Bas", code: "NL", dialCode: "+31", flag: "🇳🇱" },
  { name: "Pologne", code: "PL", dialCode: "+48", flag: "🇵🇱" },
  { name: "Portugal", code: "PT", dialCode: "+351", flag: "🇵🇹" },
  { name: "Qatar", code: "QA", dialCode: "+974", flag: "🇶🇦" },
  { name: "République centrafricaine", code: "CF", dialCode: "+236", flag: "🇨🇫" },
  { name: "République démocratique du Congo", code: "CD", dialCode: "+243", flag: "🇨🇩" },
  { name: "République tchèque", code: "CZ", dialCode: "+420", flag: "🇨🇿" },
  { name: "Roumanie", code: "RO", dialCode: "+40", flag: "🇷🇴" },
  { name: "Royaume-Uni", code: "GB", dialCode: "+44", flag: "🇬🇧" },
  { name: "Rwanda", code: "RW", dialCode: "+250", flag: "🇷🇼" },
  { name: "Sénégal", code: "SN", dialCode: "+221", flag: "🇸🇳" },
  { name: "Seychelles", code: "SC", dialCode: "+248", flag: "🇸🇨" },
  { name: "Sierra Leone", code: "SL", dialCode: "+232", flag: "🇸🇱" },
  { name: "Singapour", code: "SG", dialCode: "+65", flag: "🇸🇬" },
  { name: "Slovaquie", code: "SK", dialCode: "+421", flag: "🇸🇰" },
  { name: "Slovénie", code: "SI", dialCode: "+386", flag: "🇸🇮" },
  { name: "Somalie", code: "SO", dialCode: "+252", flag: "🇸🇴" },
  { name: "Soudan", code: "SD", dialCode: "+249", flag: "🇸🇩" },
  { name: "Soudan du Sud", code: "SS", dialCode: "+211", flag: "🇸🇸" },
  { name: "Suède", code: "SE", dialCode: "+46", flag: "🇸🇪" },
  { name: "Suisse", code: "CH", dialCode: "+41", flag: "🇨🇭" },
  { name: "Tanzanie", code: "TZ", dialCode: "+255", flag: "🇹🇿" },
  { name: "Tchad", code: "TD", dialCode: "+235", flag: "🇹🇩" },
  { name: "Thaïlande", code: "TH", dialCode: "+66", flag: "🇹🇭" },
  { name: "Togo", code: "TG", dialCode: "+228", flag: "🇹🇬" },
  { name: "Tunisie", code: "TN", dialCode: "+216", flag: "🇹🇳" },
  { name: "Turquie", code: "TR", dialCode: "+90", flag: "🇹🇷" },
  { name: "Ukraine", code: "UA", dialCode: "+380", flag: "🇺🇦" },
  { name: "Zambie", code: "ZM", dialCode: "+260", flag: "🇿🇲" },
  { name: "Zimbabwe", code: "ZW", dialCode: "+263", flag: "🇿🇼" },
].sort((firstCountry, secondCountry) =>
  firstCountry.name.localeCompare(
    secondCountry.name,
    "fr",
    {
      sensitivity: "base",
    },
  ),
);

export const DEFAULT_CLIENT_COUNTRY_CODE = "BJ";

export function findClientCountryByCode(
  countryCode: string | null | undefined,
): ClientCountry | null {
  const normalizedCode =
    countryCode?.trim().toUpperCase();

  if (!normalizedCode) {
    return null;
  }

  return (
    CLIENT_COUNTRIES.find(
      (country) =>
        country.code === normalizedCode,
    ) ?? null
  );
}

export function findClientCountryByDialCode(
  dialCode: string | null | undefined,
): ClientCountry | null {
  const normalizedDialCode =
    dialCode?.trim();

  if (!normalizedDialCode) {
    return null;
  }

  return (
    CLIENT_COUNTRIES.find(
      (country) =>
        country.dialCode === normalizedDialCode,
    ) ?? null
  );
}

export function getDefaultClientCountry(): ClientCountry {
  return (
    findClientCountryByCode(
      DEFAULT_CLIENT_COUNTRY_CODE,
    ) ?? CLIENT_COUNTRIES[0]
  );
}