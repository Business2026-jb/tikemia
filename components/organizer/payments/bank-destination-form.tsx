"use client";

import {
  AlertCircle,
  Building2,
  CheckCircle2,
  CreditCard,
  Globe2,
  Landmark,
  MapPin,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  useMemo,
} from "react";

import type {
  PayoutCountryOption,
} from "@/components/organizer/payments/payout-country-selector";

export type BankDestinationFormValue = {
  accountName: string;
  bankName: string;
  bankAccountNumber: string;
  iban: string;
  swiftBic: string;
  bankCode: string;
  branchCode: string;
  bankAddress: string;
  confirmationAccepted: boolean;
};

export type BankDestinationFormErrors = Partial<
  Record<
    | "accountName"
    | "bankName"
    | "bankAccountNumber"
    | "iban"
    | "swiftBic"
    | "bankCode"
    | "branchCode"
    | "bankAddress"
    | "confirmationAccepted",
    string
  >
>;

export type BankDestinationFormProps =
  Readonly<{
    country:
      | PayoutCountryOption
      | null;

    value:
      BankDestinationFormValue;

    onChange: (
      value:
        BankDestinationFormValue,
    ) => void;

    errors?:
      BankDestinationFormErrors;

    disabled?: boolean;

    title?: string;
    description?: string;

    showSecurityNotice?: boolean;

    className?: string;
  }>;

function normalizeText(
  value: string,
): string {
  return value.trim();
}

function normalizeCompact(
  value: string,
): string {
  return value
    .replace(
      /\s+/g,
      "",
    )
    .toUpperCase();
}

function normalizeAccountNumber(
  value: string,
): string {
  return value
    .replace(
      /[^a-zA-Z0-9]/g,
      "",
    )
    .toUpperCase();
}

function normalizeIban(
  value: string,
): string {
  return normalizeCompact(
    value,
  );
}

function formatIban(
  value: string,
): string {
  return normalizeIban(
    value,
  ).replace(
    /(.{4})/g,
    "$1 ",
  ).trim();
}

function normalizeSwiftBic(
  value: string,
): string {
  return value
    .replace(
      /[^a-zA-Z0-9]/g,
      "",
    )
    .toUpperCase()
    .slice(
      0,
      11,
    );
}

function isIbanValid(
  value: string,
): boolean {
  const normalized =
    normalizeIban(
      value,
    );

  if (!normalized) {
    return true;
  }

  return (
    normalized.length >=
      8 &&
    normalized.length <=
      34 &&
    /^[A-Z0-9]+$/.test(
      normalized,
    )
  );
}

function isSwiftBicValid(
  value: string,
): boolean {
  const normalized =
    normalizeSwiftBic(
      value,
    );

  if (!normalized) {
    return true;
  }

  return /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(
    normalized,
  );
}

function isBankReferencePresent(
  value:
    BankDestinationFormValue,
): boolean {
  return Boolean(
    normalizeAccountNumber(
      value.bankAccountNumber,
    ) ||
      normalizeIban(
        value.iban,
      ),
  );
}

export function validateBankDestination(
  value:
    BankDestinationFormValue,
): BankDestinationFormErrors {
  const errors:
    BankDestinationFormErrors =
    {};

  if (
    normalizeText(
      value.accountName,
    ).length <
    2
  ) {
    errors.accountName =
      "Renseignez le nom complet du titulaire.";
  }

  if (
    normalizeText(
      value.bankName,
    ).length <
    2
  ) {
    errors.bankName =
      "Renseignez le nom de la banque.";
  }

  if (
    !isBankReferencePresent(
      value,
    )
  ) {
    errors.bankAccountNumber =
      "Renseignez un numéro de compte ou un IBAN.";
  }

  if (
    value.iban &&
    !isIbanValid(
      value.iban,
    )
  ) {
    errors.iban =
      "L’IBAN est invalide.";
  }

  if (
    value.swiftBic &&
    !isSwiftBicValid(
      value.swiftBic,
    )
  ) {
    errors.swiftBic =
      "Le code SWIFT/BIC est invalide.";
  }

  if (
    !value.confirmationAccepted
  ) {
    errors.confirmationAccepted =
      "Vous devez confirmer que les informations sont exactes.";
  }

  return errors;
}

export function isBankDestinationComplete(
  value:
    BankDestinationFormValue,
): boolean {
  return (
    Object.keys(
      validateBankDestination(
        value,
      ),
    ).length ===
    0
  );
}

export default function BankDestinationForm({
  country,
  value,
  onChange,
  errors = {},
  disabled = false,
  title =
    "Compte bancaire",
  description =
    "Saisissez les coordonnées du compte bancaire qui recevra le retrait.",
  showSecurityNotice = true,
  className = "",
}: BankDestinationFormProps) {
  const requiresIban =
    useMemo(
      () =>
        country?.currency ===
          "EUR" ||
        [
          "FR",
          "BE",
          "DE",
          "IT",
        ].includes(
          country?.code ??
            "",
        ),
      [
        country?.code,
        country?.currency,
      ],
    );

  const updateValue =
    <TKey extends keyof BankDestinationFormValue>(
      key: TKey,
      fieldValue:
        BankDestinationFormValue[TKey],
    ) => {
      onChange({
        ...value,
        [key]:
          fieldValue,
      });
    };

  return (
    <section
      className={`w-full min-w-0 rounded-2xl border border-white/[0.08] bg-[#071014] p-4 sm:p-5 ${className}`}
    >
      <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/[0.07]">
              <Landmark className="h-[18px] w-[18px] text-sky-300" />
            </span>

            <div className="min-w-0">
              <h3 className="text-base font-black text-white">
                {title}
              </h3>

              <p className="mt-1 text-xs leading-5 text-neutral-600">
                {description}
              </p>
            </div>
          </div>
        </div>

        {country && (
          <div className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2">
            <span className="text-lg">
              {country.flag}
            </span>

            <div>
              <p className="text-[10px] font-black text-white">
                {country.name}
              </p>

              <p className="text-[9px] text-neutral-600">
                {country.currency}
              </p>
            </div>
          </div>
        )}
      </div>

      {!country ? (
        <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
          <div className="flex items-start gap-3">
            <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />

            <div>
              <p className="text-sm font-black text-amber-200">
                Sélectionnez d’abord un pays
              </p>

              <p className="mt-1 text-xs leading-5 text-amber-100/50">
                Les champs bancaires affichés peuvent dépendre du pays et de la devise.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {requiresIban && (
            <div className="mt-5 rounded-2xl border border-sky-500/15 bg-sky-500/[0.035] p-3.5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />

                <div className="min-w-0">
                  <p className="text-xs font-black text-sky-200">
                    IBAN recommandé
                  </p>

                  <p className="mt-1 text-[10px] leading-4 text-sky-100/45">
                    Pour ce pays ou cette devise, renseignez de préférence l’IBAN et le code SWIFT/BIC.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div>
              <label
                htmlFor="bank-account-name"
                className="mb-2 block text-[11px] font-black uppercase tracking-[0.09em] text-neutral-400"
              >
                Titulaire du compte
                <span
                  aria-hidden="true"
                  className="ml-1 text-red-400"
                >
                  *
                </span>
              </label>

              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

                <input
                  id="bank-account-name"
                  type="text"
                  value={
                    value.accountName
                  }
                  disabled={
                    disabled
                  }
                  autoComplete="name"
                  maxLength={
                    160
                  }
                  onChange={(
                    event,
                  ) =>
                    updateValue(
                      "accountName",
                      event.target
                        .value,
                    )
                  }
                  placeholder="Nom complet du titulaire"
                  className={`h-12 w-full rounded-xl border bg-[#040a0e] pl-10 pr-3.5 text-sm text-white outline-none transition placeholder:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 ${
                    errors.accountName
                      ? "border-red-500/35 focus:border-red-400/60"
                      : "border-white/[0.08] focus:border-sky-500/35 focus:ring-4 focus:ring-sky-500/[0.05]"
                  }`}
                />
              </div>

              {errors.accountName && (
                <p
                  role="alert"
                  className="mt-2 text-[11px] font-medium text-red-400"
                >
                  {errors.accountName}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="bank-name"
                className="mb-2 block text-[11px] font-black uppercase tracking-[0.09em] text-neutral-400"
              >
                Nom de la banque
                <span
                  aria-hidden="true"
                  className="ml-1 text-red-400"
                >
                  *
                </span>
              </label>

              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

                <input
                  id="bank-name"
                  type="text"
                  value={
                    value.bankName
                  }
                  disabled={
                    disabled
                  }
                  maxLength={
                    160
                  }
                  onChange={(
                    event,
                  ) =>
                    updateValue(
                      "bankName",
                      event.target
                        .value,
                    )
                  }
                  placeholder="Ex. Banque Atlantique"
                  className={`h-12 w-full rounded-xl border bg-[#040a0e] pl-10 pr-3.5 text-sm text-white outline-none transition placeholder:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 ${
                    errors.bankName
                      ? "border-red-500/35 focus:border-red-400/60"
                      : "border-white/[0.08] focus:border-sky-500/35 focus:ring-4 focus:ring-sky-500/[0.05]"
                  }`}
                />
              </div>

              {errors.bankName && (
                <p
                  role="alert"
                  className="mt-2 text-[11px] font-medium text-red-400"
                >
                  {errors.bankName}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <label
                htmlFor="bank-account-number"
                className="mb-2 block text-[11px] font-black uppercase tracking-[0.09em] text-neutral-400"
              >
                Numéro de compte
              </label>

              <div className="relative">
                <CreditCard className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

                <input
                  id="bank-account-number"
                  type="text"
                  value={
                    value.bankAccountNumber
                  }
                  disabled={
                    disabled
                  }
                  maxLength={
                    64
                  }
                  onChange={(
                    event,
                  ) =>
                    updateValue(
                      "bankAccountNumber",
                      normalizeAccountNumber(
                        event.target
                          .value,
                      ),
                    )
                  }
                  placeholder="Numéro de compte bancaire"
                  className={`h-12 w-full rounded-xl border bg-[#040a0e] pl-10 pr-3.5 text-sm text-white outline-none transition placeholder:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 ${
                    errors.bankAccountNumber
                      ? "border-red-500/35 focus:border-red-400/60"
                      : "border-white/[0.08] focus:border-sky-500/35 focus:ring-4 focus:ring-sky-500/[0.05]"
                  }`}
                />
              </div>

              {errors.bankAccountNumber && (
                <p
                  role="alert"
                  className="mt-2 text-[11px] font-medium text-red-400"
                >
                  {errors.bankAccountNumber}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="bank-iban"
                className="mb-2 block text-[11px] font-black uppercase tracking-[0.09em] text-neutral-400"
              >
                IBAN
                {requiresIban && (
                  <span className="ml-1 text-[9px] font-medium normal-case tracking-normal text-sky-400">
                    recommandé
                  </span>
                )}
              </label>

              <input
                id="bank-iban"
                type="text"
                value={
                  formatIban(
                    value.iban,
                  )
                }
                disabled={
                  disabled
                }
                maxLength={
                  42
                }
                onChange={(
                  event,
                ) =>
                  updateValue(
                    "iban",
                    normalizeIban(
                      event.target
                        .value,
                    ),
                  )
                }
                placeholder="FR76 3000 6000 0112 3456 7890 189"
                className={`h-12 w-full rounded-xl border bg-[#040a0e] px-3.5 text-sm text-white outline-none transition placeholder:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 ${
                  errors.iban
                    ? "border-red-500/35 focus:border-red-400/60"
                    : "border-white/[0.08] focus:border-sky-500/35 focus:ring-4 focus:ring-sky-500/[0.05]"
                }`}
              />

              {errors.iban && (
                <p
                  role="alert"
                  className="mt-2 text-[11px] font-medium text-red-400"
                >
                  {errors.iban}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div>
              <label
                htmlFor="bank-swift-bic"
                className="mb-2 block text-[11px] font-black uppercase tracking-[0.09em] text-neutral-400"
              >
                SWIFT / BIC
              </label>

              <input
                id="bank-swift-bic"
                type="text"
                value={
                  value.swiftBic
                }
                disabled={
                  disabled
                }
                maxLength={
                  11
                }
                onChange={(
                  event,
                ) =>
                  updateValue(
                    "swiftBic",
                    normalizeSwiftBic(
                      event.target
                        .value,
                    ),
                  )
                }
                placeholder="ABCDEFGHXXX"
                className={`h-12 w-full rounded-xl border bg-[#040a0e] px-3.5 text-sm text-white outline-none transition placeholder:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 ${
                  errors.swiftBic
                    ? "border-red-500/35 focus:border-red-400/60"
                    : "border-white/[0.08] focus:border-sky-500/35 focus:ring-4 focus:ring-sky-500/[0.05]"
                }`}
              />

              {errors.swiftBic && (
                <p
                  role="alert"
                  className="mt-2 text-[11px] font-medium text-red-400"
                >
                  {errors.swiftBic}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="bank-code"
                className="mb-2 block text-[11px] font-black uppercase tracking-[0.09em] text-neutral-400"
              >
                Code banque
              </label>

              <input
                id="bank-code"
                type="text"
                value={
                  value.bankCode
                }
                disabled={
                  disabled
                }
                maxLength={
                  32
                }
                onChange={(
                  event,
                ) =>
                  updateValue(
                    "bankCode",
                    event.target
                      .value,
                  )
                }
                placeholder="Facultatif"
                className={`h-12 w-full rounded-xl border bg-[#040a0e] px-3.5 text-sm text-white outline-none transition placeholder:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 ${
                  errors.bankCode
                    ? "border-red-500/35 focus:border-red-400/60"
                    : "border-white/[0.08] focus:border-sky-500/35 focus:ring-4 focus:ring-sky-500/[0.05]"
                }`}
              />

              {errors.bankCode && (
                <p
                  role="alert"
                  className="mt-2 text-[11px] font-medium text-red-400"
                >
                  {errors.bankCode}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="branch-code"
                className="mb-2 block text-[11px] font-black uppercase tracking-[0.09em] text-neutral-400"
              >
                Code agence
              </label>

              <input
                id="branch-code"
                type="text"
                value={
                  value.branchCode
                }
                disabled={
                  disabled
                }
                maxLength={
                  32
                }
                onChange={(
                  event,
                ) =>
                  updateValue(
                    "branchCode",
                    event.target
                      .value,
                  )
                }
                placeholder="Facultatif"
                className={`h-12 w-full rounded-xl border bg-[#040a0e] px-3.5 text-sm text-white outline-none transition placeholder:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 ${
                  errors.branchCode
                    ? "border-red-500/35 focus:border-red-400/60"
                    : "border-white/[0.08] focus:border-sky-500/35 focus:ring-4 focus:ring-sky-500/[0.05]"
                }`}
              />

              {errors.branchCode && (
                <p
                  role="alert"
                  className="mt-2 text-[11px] font-medium text-red-400"
                >
                  {errors.branchCode}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <label
              htmlFor="bank-address"
              className="mb-2 block text-[11px] font-black uppercase tracking-[0.09em] text-neutral-400"
            >
              Adresse de la banque
            </label>

            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-neutral-600" />

              <textarea
                id="bank-address"
                value={
                  value.bankAddress
                }
                disabled={
                  disabled
                }
                maxLength={
                  240
                }
                rows={
                  3
                }
                onChange={(
                  event,
                ) =>
                  updateValue(
                    "bankAddress",
                    event.target
                      .value,
                  )
                }
                placeholder="Adresse ou agence bancaire, facultatif"
                className={`min-h-24 w-full resize-y rounded-xl border bg-[#040a0e] py-3 pl-10 pr-3.5 text-sm leading-6 text-white outline-none transition placeholder:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 ${
                  errors.bankAddress
                    ? "border-red-500/35 focus:border-red-400/60"
                    : "border-white/[0.08] focus:border-sky-500/35 focus:ring-4 focus:ring-sky-500/[0.05]"
                }`}
              />
            </div>

            {errors.bankAddress && (
              <p
                role="alert"
                className="mt-2 text-[11px] font-medium text-red-400"
              >
                {errors.bankAddress}
              </p>
            )}
          </div>

          <div className="mt-5">
            <label
              className={`flex items-start gap-3 rounded-2xl border p-4 transition ${
                errors.confirmationAccepted
                  ? "border-red-500/25 bg-red-500/[0.035]"
                  : value.confirmationAccepted
                    ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                    : "border-white/[0.08] bg-white/[0.02]"
              } ${
                disabled
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer"
              }`}
            >
              <input
                type="checkbox"
                checked={
                  value.confirmationAccepted
                }
                disabled={
                  disabled
                }
                onChange={(
                  event,
                ) =>
                  updateValue(
                    "confirmationAccepted",
                    event.target
                      .checked,
                  )
                }
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-transparent accent-emerald-500"
              />

              <span className="min-w-0">
                <span className="block text-xs font-black text-white">
                  Je confirme que ces coordonnées bancaires sont exactes
                </span>

                <span className="mt-1 block text-[10px] leading-4 text-neutral-600">
                  Je confirme être le titulaire du compte ou être autorisé à l’utiliser pour recevoir ce retrait.
                </span>
              </span>
            </label>

            {errors.confirmationAccepted && (
              <p
                role="alert"
                className="mt-2 text-[11px] font-medium text-red-400"
              >
                {errors.confirmationAccepted}
              </p>
            )}
          </div>

          {!isBankReferencePresent(
            value,
          ) && (
            <div className="mt-5 rounded-2xl border border-amber-500/15 bg-amber-500/[0.035] p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />

                <div>
                  <p className="text-xs font-black text-amber-200">
                    Référence bancaire requise
                  </p>

                  <p className="mt-1 text-[10px] leading-4 text-amber-100/45">
                    Renseignez au moins un numéro de compte ou un IBAN avant de continuer.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {showSecurityNotice && (
        <div className="mt-5 rounded-2xl border border-sky-500/15 bg-sky-500/[0.035] p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />

            <div className="min-w-0">
              <p className="text-xs font-black text-sky-200">
                Coordonnées bancaires protégées
              </p>

              <p className="mt-1 text-[10px] leading-4 text-sky-100/45">
                Les numéros de compte et IBAN sont chiffrés avant leur enregistrement. Seules les dernières positions seront affichées ensuite.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}