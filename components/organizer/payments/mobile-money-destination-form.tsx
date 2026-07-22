"use client";

import {
  AlertCircle,
  CheckCircle2,
  Info,
  Phone,
  ShieldCheck,
  Smartphone,
  UserRound,
  WalletCards,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

import type {
  PayoutCountryCode,
  PayoutCountryOption,
} from "@/components/organizer/payments/payout-country-selector";

export type MobileMoneyProviderValue =
  | "MTN_MOMO"
  | "MOOV_MONEY"
  | "ORANGE_MONEY"
  | "WAVE";

export type MobileMoneyDestinationFormValue = {
  provider:
    | MobileMoneyProviderValue
    | null;

  accountName: string;
  phoneNumber: string;
  confirmationAccepted: boolean;
};

export type MobileMoneyDestinationFormErrors = Partial<
  Record<
    | "provider"
    | "accountName"
    | "phoneNumber"
    | "confirmationAccepted",
    string
  >
>;

export type MobileMoneyDestinationFormProps =
  Readonly<{
    country:
      | PayoutCountryOption
      | null;

    value:
      MobileMoneyDestinationFormValue;

    onChange: (
      value:
        MobileMoneyDestinationFormValue,
    ) => void;

    errors?:
      MobileMoneyDestinationFormErrors;

    disabled?: boolean;

    title?: string;
    description?: string;

    showSecurityNotice?: boolean;

    className?: string;
  }>;

type MobileMoneyProviderOption = {
  value: MobileMoneyProviderValue;
  label: string;
  shortLabel: string;
  description: string;
  supportedCountries:
    readonly PayoutCountryCode[];
};

const MOBILE_MONEY_PROVIDERS: readonly MobileMoneyProviderOption[] =
  [
    {
      value:
        "MTN_MOMO",
      label:
        "MTN Mobile Money",
      shortLabel:
        "MTN",
      description:
        "Recevez votre retrait directement sur votre compte MTN Mobile Money.",
      supportedCountries: [
        "BJ",
        "CI",
        "CM",
        "GA",
        "GH",
        "GN",
        "NG",
        "RW",
        "UG",
        "CD",
        "CG",
        "ZM" as PayoutCountryCode,
      ],
    },
    {
      value:
        "MOOV_MONEY",
      label:
        "Moov Money",
      shortLabel:
        "Moov",
      description:
        "Recevez votre retrait sur votre compte Moov Money enregistré.",
      supportedCountries: [
        "BJ",
        "TG",
        "CI",
        "NE",
        "BF",
        "ML",
        "GA",
      ],
    },
    {
      value:
        "ORANGE_MONEY",
      label:
        "Orange Money",
      shortLabel:
        "Orange",
      description:
        "Recevez votre retrait sur votre portefeuille Orange Money.",
      supportedCountries: [
        "CI",
        "SN",
        "CM",
        "ML",
        "GN",
        "CD",
        "BF",
      ],
    },
    {
      value:
        "WAVE",
      label:
        "Wave",
      shortLabel:
        "Wave",
      description:
        "Recevez votre retrait sur votre compte Wave.",
      supportedCountries: [
        "CI",
        "SN",
        "ML",
        "BF",
        "UG",
      ],
    },
  ] as const;

function normalizePhoneNumber(
  value: string,
): string {
  return value.replace(
    /\D/g,
    "",
  );
}

function formatPhoneNumber(
  value: string,
): string {
  const digits =
    normalizePhoneNumber(
      value,
    );

  return digits.replace(
    /(\d{2,3})(?=\d)/g,
    "$1 ",
  );
}

function getAvailableProviders(
  countryCode:
    | PayoutCountryCode
    | null,
): readonly MobileMoneyProviderOption[] {
  if (!countryCode) {
    return [];
  }

  return MOBILE_MONEY_PROVIDERS.filter(
    (
      provider,
    ) =>
      provider.supportedCountries.includes(
        countryCode,
      ),
  );
}

function isPhoneNumberValid(
  value: string,
): boolean {
  const digits =
    normalizePhoneNumber(
      value,
    );

  return (
    digits.length >=
      6 &&
    digits.length <=
      15
  );
}

function buildProviderClasses({
  selected,
  disabled,
}: {
  selected: boolean;
  disabled: boolean;
}): string {
  if (disabled) {
    return "cursor-not-allowed border-white/[0.06] bg-white/[0.015] opacity-45";
  }

  if (selected) {
    return "border-emerald-500/35 bg-emerald-500/[0.08] shadow-[0_0_0_3px_rgba(16,185,129,0.05)]";
  }

  return "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.035]";
}

export function validateMobileMoneyDestination(
  value:
    MobileMoneyDestinationFormValue,
): MobileMoneyDestinationFormErrors {
  const errors:
    MobileMoneyDestinationFormErrors =
    {};

  if (!value.provider) {
    errors.provider =
      "Sélectionnez un opérateur Mobile Money.";
  }

  if (
    value.accountName
      .trim()
      .length <
    2
  ) {
    errors.accountName =
      "Renseignez le nom complet du titulaire.";
  }

  if (
    !isPhoneNumberValid(
      value.phoneNumber,
    )
  ) {
    errors.phoneNumber =
      "Le numéro Mobile Money est invalide.";
  }

  if (
    !value.confirmationAccepted
  ) {
    errors.confirmationAccepted =
      "Vous devez confirmer que les informations sont exactes.";
  }

  return errors;
}

export function isMobileMoneyDestinationComplete(
  value:
    MobileMoneyDestinationFormValue,
): boolean {
  return (
    Object.keys(
      validateMobileMoneyDestination(
        value,
      ),
    ).length ===
    0
  );
}

export default function MobileMoneyDestinationForm({
  country,
  value,
  onChange,
  errors = {},
  disabled = false,
  title =
    "Compte Mobile Money",
  description =
    "Choisissez votre opérateur et saisissez les informations exactes du compte qui recevra le retrait.",
  showSecurityNotice = true,
  className = "",
}: MobileMoneyDestinationFormProps) {
  const [
    phoneFocused,
    setPhoneFocused,
  ] = useState(false);

  const availableProviders =
    useMemo(
      () =>
        getAvailableProviders(
          country?.code ??
            null,
        ),
      [
        country?.code,
      ],
    );

  const selectedProvider =
    useMemo(
      () =>
        availableProviders.find(
          (
            provider,
          ) =>
            provider.value ===
            value.provider,
        ) ??
        null,
      [
        availableProviders,
        value.provider,
      ],
    );

  const dialCode =
    country?.dialCode ??
    "";

  const phoneDigits =
    normalizePhoneNumber(
      value.phoneNumber,
    );

  const phoneValid =
    isPhoneNumberValid(
      value.phoneNumber,
    );

  const updateValue =
    <TKey extends keyof MobileMoneyDestinationFormValue>(
      key: TKey,
      fieldValue:
        MobileMoneyDestinationFormValue[TKey],
    ) => {
      onChange({
        ...value,
        [key]:
          fieldValue,
      });
    };

  const selectProvider =
    (
      provider:
        MobileMoneyProviderOption,
    ) => {
      if (disabled) {
        return;
      }

      updateValue(
        "provider",
        provider.value,
      );
    };

  return (
    <section
      className={`w-full min-w-0 rounded-2xl border border-white/[0.08] bg-[#071014] p-4 sm:p-5 ${className}`}
    >
      <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07]">
              <Smartphone className="h-4.5 w-4.5 text-emerald-300" />
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
                {country.dialCode} • {country.currency}
              </p>
            </div>
          </div>
        )}
      </div>

      {!country ? (
        <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />

            <div>
              <p className="text-sm font-black text-amber-200">
                Sélectionnez d’abord un pays
              </p>

              <p className="mt-1 text-xs leading-5 text-amber-100/50">
                Les opérateurs disponibles dépendent du pays du bénéficiaire.
              </p>
            </div>
          </div>
        </div>
      ) : availableProviders.length ===
        0 ? (
        <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />

            <div>
              <p className="text-sm font-black text-red-200">
                Mobile Money indisponible
              </p>

              <p className="mt-1 text-xs leading-5 text-red-100/50">
                Aucun opérateur Mobile Money n’est actuellement activé pour ce pays.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="text-[11px] font-black uppercase tracking-[0.09em] text-neutral-400">
                Opérateur Mobile Money
                <span
                  aria-hidden="true"
                  className="ml-1 text-red-400"
                >
                  *
                </span>
              </label>

              <span className="text-[9px] font-medium text-neutral-700">
                {availableProviders.length} option
                {availableProviders.length >
                1
                  ? "s"
                  : ""}
              </span>
            </div>

            <div
              role="radiogroup"
              aria-label="Opérateur Mobile Money"
              className="grid gap-3 sm:grid-cols-2"
            >
              {availableProviders.map(
                (
                  provider,
                ) => {
                  const selected =
                    provider.value ===
                    value.provider;

                  return (
                    <button
                      key={
                        provider.value
                      }
                      type="button"
                      role="radio"
                      aria-checked={
                        selected
                      }
                      disabled={
                        disabled
                      }
                      onClick={() =>
                        selectProvider(
                          provider,
                        )
                      }
                      className={`relative flex min-h-[88px] items-start gap-3 rounded-2xl border p-3.5 text-left transition ${buildProviderClasses(
                        {
                          selected,
                          disabled,
                        },
                      )}`}
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                          selected
                            ? "border-emerald-500/25 bg-emerald-500/[0.10] text-emerald-300"
                            : "border-white/[0.07] bg-white/[0.025] text-neutral-500"
                        }`}
                      >
                        <WalletCards className="h-4.5 w-4.5" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black text-white">
                          {provider.label}
                        </span>

                        <span className="mt-1 block text-[10px] leading-4 text-neutral-600">
                          {provider.description}
                        </span>
                      </span>

                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                          selected
                            ? "border-emerald-500/25 bg-emerald-500/[0.10] text-emerald-300"
                            : "border-white/[0.06] bg-white/[0.015] text-transparent"
                        }`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  );
                },
              )}
            </div>

            {errors.provider && (
              <p
                role="alert"
                className="mt-2 text-[11px] font-medium text-red-400"
              >
                {errors.provider}
              </p>
            )}
          </div>

          {selectedProvider && (
            <div className="mt-5 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.035] p-3.5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />

                <div className="min-w-0">
                  <p className="text-xs font-black text-emerald-200">
                    {selectedProvider.label} sélectionné
                  </p>

                  <p className="mt-1 text-[10px] leading-4 text-emerald-100/45">
                    Le numéro renseigné doit être actif et appartenir au titulaire indiqué.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div>
              <label
                htmlFor="mobile-money-account-name"
                className="mb-2 block text-[11px] font-black uppercase tracking-[0.09em] text-neutral-400"
              >
                Nom complet du titulaire
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
                  id="mobile-money-account-name"
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
                  placeholder="Nom et prénom du titulaire"
                  className={`h-12 w-full rounded-xl border bg-[#040a0e] pl-10 pr-3.5 text-sm text-white outline-none transition placeholder:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 ${
                    errors.accountName
                      ? "border-red-500/35 focus:border-red-400/60"
                      : "border-white/[0.08] focus:border-emerald-500/35 focus:ring-4 focus:ring-emerald-500/[0.05]"
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
                htmlFor="mobile-money-phone"
                className="mb-2 block text-[11px] font-black uppercase tracking-[0.09em] text-neutral-400"
              >
                Numéro Mobile Money
                <span
                  aria-hidden="true"
                  className="ml-1 text-red-400"
                >
                  *
                </span>
              </label>

              <div
                className={`flex h-12 overflow-hidden rounded-xl border bg-[#040a0e] transition ${
                  errors.phoneNumber
                    ? "border-red-500/35"
                    : phoneFocused
                      ? "border-emerald-500/35 ring-4 ring-emerald-500/[0.05]"
                      : "border-white/[0.08]"
                }`}
              >
                <div className="flex shrink-0 items-center gap-2 border-r border-white/[0.07] bg-white/[0.02] px-3">
                  <Phone className="h-3.5 w-3.5 text-neutral-600" />

                  <span className="text-xs font-black text-white">
                    {dialCode}
                  </span>
                </div>

                <input
                  id="mobile-money-phone"
                  type="tel"
                  inputMode="numeric"
                  value={
                    formatPhoneNumber(
                      value.phoneNumber,
                    )
                  }
                  disabled={
                    disabled
                  }
                  autoComplete="tel-national"
                  onFocus={() =>
                    setPhoneFocused(
                      true,
                    )
                  }
                  onBlur={() =>
                    setPhoneFocused(
                      false,
                    )
                  }
                  onChange={(
                    event,
                  ) =>
                    updateValue(
                      "phoneNumber",
                      normalizePhoneNumber(
                        event.target
                          .value,
                      ),
                    )
                  }
                  placeholder="01 97 00 00 00"
                  className="min-w-0 flex-1 bg-transparent px-3.5 text-sm text-white outline-none placeholder:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                />

                {phoneDigits &&
                  phoneValid && (
                    <span className="flex shrink-0 items-center px-3 text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                  )}
              </div>

              <div className="mt-2 flex items-center justify-between gap-3">
                <p
                  className={`text-[10px] ${
                    errors.phoneNumber
                      ? "text-red-400"
                      : "text-neutral-700"
                  }`}
                >
                  {errors.phoneNumber ??
                    "Saisissez uniquement le numéro national sans répéter l’indicatif."}
                </p>

                <span className="shrink-0 text-[9px] text-neutral-700">
                  {phoneDigits.length}/15
                </span>
              </div>
            </div>
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
                  Je confirme que ces informations sont exactes
                </span>

                <span className="mt-1 block text-[10px] leading-4 text-neutral-600">
                  Je confirme être le titulaire de ce compte ou être autorisé à l’utiliser pour recevoir ce retrait.
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
        </>
      )}

      {showSecurityNotice && (
        <div className="mt-5 rounded-2xl border border-sky-500/15 bg-sky-500/[0.035] p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />

            <div className="min-w-0">
              <p className="text-xs font-black text-sky-200">
                Informations sécurisées
              </p>

              <p className="mt-1 text-[10px] leading-4 text-sky-100/45">
                Tikemia chiffre les coordonnées sensibles avant leur enregistrement. Le numéro complet ne sera jamais affiché publiquement.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}