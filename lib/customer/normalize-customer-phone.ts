import "server-only";

/**
 * Utilitaires de normalisation des numéros de téléphone clients.
 *
 * Objectifs :
 * - comparer proprement les numéros saisis au checkout invité ;
 * - rapprocher les anciennes commandes avec un compte client ;
 * - produire un numéro international stable au format E.164 simplifié ;
 * - éviter de rattacher une commande à partir d’un numéro invalide.
 */

const MIN_E164_DIGITS = 8;
const MAX_E164_DIGITS = 15;

export type NormalizeCustomerPhoneOptions = {
  /**
   * Indicatif international, avec ou sans signe `+`.
   *
   * Exemples :
   * - "+229"
   * - "229"
   * - "+33"
   */
  dialCode?: string | null;

  /**
   * Code pays ISO 3166-1 alpha-2.
   *
   * Il sert uniquement à retrouver un indicatif par défaut
   * lorsque `dialCode` n’est pas fourni.
   *
   * Exemples :
   * - "BJ"
   * - "FR"
   * - "CI"
   */
  countryCode?: string | null;
};

const COUNTRY_DIAL_CODES: Readonly<Record<string, string>> = {
  BE: "32",
  BJ: "229",
  BF: "226",
  CM: "237",
  CI: "225",
  DE: "49",
  ES: "34",
  FR: "33",
  GA: "241",
  GH: "233",
  GN: "224",
  IT: "39",
  LU: "352",
  ML: "223",
  NE: "227",
  NG: "234",
  NL: "31",
  PT: "351",
  SN: "221",
  TG: "228",
} as const;

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim().normalize("NFKC") ?? "";
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizeCountryCode(
  value: string | null | undefined,
): string {
  return normalizeText(value)
    .toUpperCase()
    .slice(0, 2);
}

function normalizeDialCode(
  value: string | null | undefined,
): string {
  return digitsOnly(
    normalizeText(value),
  ).slice(0, 4);
}

function getDialCodeFromCountryCode(
  countryCode: string | null | undefined,
): string {
  const normalizedCountryCode =
    normalizeCountryCode(countryCode);

  if (!normalizedCountryCode) {
    return "";
  }

  return (
    COUNTRY_DIAL_CODES[
      normalizedCountryCode
    ] ?? ""
  );
}

function resolveDialCode({
  dialCode,
  countryCode,
}: NormalizeCustomerPhoneOptions): string {
  return (
    normalizeDialCode(dialCode) ||
    getDialCodeFromCountryCode(
      countryCode,
    )
  );
}

function removeInternationalPrefix(
  value: string,
): string {
  const normalized =
    normalizeText(value);

  if (
    normalized.startsWith("00")
  ) {
    return normalized.slice(2);
  }

  return normalized;
}

function removeNationalTrunkPrefix(
  nationalNumber: string,
): string {
  if (
    nationalNumber.startsWith("0") &&
    nationalNumber.length >
      MIN_E164_DIGITS
  ) {
    return nationalNumber.replace(
      /^0+/,
      "",
    );
  }

  return nationalNumber;
}

function isValidInternationalDigits(
  value: string,
): boolean {
  return (
    value.length >=
      MIN_E164_DIGITS &&
    value.length <=
      MAX_E164_DIGITS
  );
}

/**
 * Normalise un numéro client au format international :
 *
 * `+<indicatif><numéro national>`
 *
 * Exemples :
 *
 * - `01 60 10 51 78` avec `BJ` devient `+2290160105178`
 * - `06 12 34 56 78` avec `FR` devient `+33612345678`
 * - `00229 97 00 00 00` devient `+22997000000`
 * - `+229 97 00 00 00` reste `+22997000000`
 *
 * Une chaîne vide est retournée lorsque le numéro ne peut pas
 * être considéré comme suffisamment fiable.
 */
export function normalizeCustomerPhone(
  value: string | null | undefined,
  options: NormalizeCustomerPhoneOptions = {},
): string {
  const rawValue =
    normalizeText(value);

  if (!rawValue) {
    return "";
  }

  const withoutInternationalPrefix =
    removeInternationalPrefix(
      rawValue,
    );

  const digits =
    digitsOnly(
      withoutInternationalPrefix,
    );

  if (!digits) {
    return "";
  }

  const hadExplicitInternationalPrefix =
    rawValue.startsWith("+") ||
    rawValue.startsWith("00");

  if (
    hadExplicitInternationalPrefix
  ) {
    return isValidInternationalDigits(
      digits,
    )
      ? `+${digits}`
      : "";
  }

  const dialCode =
    resolveDialCode(options);

  if (!dialCode) {
    return isValidInternationalDigits(
      digits,
    )
      ? `+${digits}`
      : "";
  }

  if (
    digits.startsWith(
      dialCode,
    )
  ) {
    return isValidInternationalDigits(
      digits,
    )
      ? `+${digits}`
      : "";
  }

  const nationalNumber =
    removeNationalTrunkPrefix(
      digits,
    );

  const internationalDigits =
    `${dialCode}${nationalNumber}`;

  if (
    !isValidInternationalDigits(
      internationalDigits,
    )
  ) {
    return "";
  }

  return `+${internationalDigits}`;
}

/**
 * Retourne uniquement les chiffres d’un numéro normalisé.
 *
 * Exemple :
 *
 * `+22997000000` devient `22997000000`.
 */
export function getCustomerPhoneDigits(
  value: string | null | undefined,
  options: NormalizeCustomerPhoneOptions = {},
): string {
  return digitsOnly(
    normalizeCustomerPhone(
      value,
      options,
    ),
  );
}

/**
 * Compare deux numéros après normalisation.
 *
 * La comparaison ne retourne `true` que si les deux numéros
 * produisent une valeur internationale non vide et identique.
 */
export function areCustomerPhonesEqual({
  first,
  second,
  firstOptions = {},
  secondOptions = {},
}: {
  first: string | null | undefined;
  second: string | null | undefined;
  firstOptions?: NormalizeCustomerPhoneOptions;
  secondOptions?: NormalizeCustomerPhoneOptions;
}): boolean {
  const normalizedFirst =
    normalizeCustomerPhone(
      first,
      firstOptions,
    );

  const normalizedSecond =
    normalizeCustomerPhone(
      second,
      secondOptions,
    );

  return (
    normalizedFirst !== "" &&
    normalizedFirst ===
      normalizedSecond
  );
}

/**
 * Vérifie qu’un numéro peut être normalisé vers un numéro
 * international suffisamment fiable.
 */
export function isValidCustomerPhone(
  value: string | null | undefined,
  options: NormalizeCustomerPhoneOptions = {},
): boolean {
  return (
    normalizeCustomerPhone(
      value,
      options,
    ) !== ""
  );
}