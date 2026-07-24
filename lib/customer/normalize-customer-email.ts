import "server-only";

/**
 * Normalise une adresse e-mail client afin de permettre
 * les comparaisons, recherches et rapprochements entre
 * commandes invitées et comptes créés ultérieurement.
 */

const GMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
]);

export function normalizeCustomerEmail(
  value: string | null | undefined,
): string {
  if (!value) {
    return "";
  }

  const email = value
    .trim()
    .normalize("NFKC")
    .toLowerCase();

  const atIndex = email.indexOf("@");

  if (
    atIndex <= 0 ||
    atIndex !== email.lastIndexOf("@")
  ) {
    return "";
  }

  let localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  if (!domain) {
    return "";
  }

  if (GMAIL_DOMAINS.has(domain)) {
    const plusIndex = localPart.indexOf("+");

    if (plusIndex >= 0) {
      localPart = localPart.slice(0, plusIndex);
    }

    localPart = localPart.replace(/\./g, "");
  }

  return `${localPart}@${domain}`;
}

export function areCustomerEmailsEqual(
  first: string | null | undefined,
  second: string | null | undefined,
): boolean {
  const a = normalizeCustomerEmail(first);
  const b = normalizeCustomerEmail(second);

  return a !== "" && a === b;
}