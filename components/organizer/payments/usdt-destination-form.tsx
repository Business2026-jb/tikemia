"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  Info,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

import type {
  PayoutCountryOption,
} from "@/components/organizer/payments/payout-country-selector";

export type UsdtDestinationFormValue = {
  accountName: string;
  cryptoAddress: string;
  cryptoNetwork: "TRC20";
  confirmationAddress: string;
  confirmationAccepted: boolean;
};

export type UsdtDestinationFormErrors = Partial<
  Record<
    | "accountName"
    | "cryptoAddress"
    | "confirmationAddress"
    | "confirmationAccepted",
    string
  >
>;

export type UsdtDestinationFormProps =
  Readonly<{
    country:
      | PayoutCountryOption
      | null;

    value:
      UsdtDestinationFormValue;

    onChange: (
      value:
        UsdtDestinationFormValue,
    ) => void;

    errors?:
      UsdtDestinationFormErrors;

    disabled?: boolean;

    title?: string;
    description?: string;

    showSecurityNotice?: boolean;

    className?: string;
  }>;

const TRC20_NETWORK =
  "TRC20" as const;

const TRON_ADDRESS_PATTERN =
  /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

function normalizeText(
  value: string,
): string {
  return value.trim();
}

function normalizeTronAddress(
  value: string,
): string {
  return value
    .replace(
      /\s+/g,
      "",
    )
    .trim();
}

function isTronAddressValid(
  value: string,
): boolean {
  return TRON_ADDRESS_PATTERN.test(
    normalizeTronAddress(
      value,
    ),
  );
}

function addressesMatch(
  address: string,
  confirmation: string,
): boolean {
  const normalizedAddress =
    normalizeTronAddress(
      address,
    );

  const normalizedConfirmation =
    normalizeTronAddress(
      confirmation,
    );

  return (
    Boolean(
      normalizedAddress,
    ) &&
    normalizedAddress ===
      normalizedConfirmation
  );
}

export function validateUsdtDestination(
  value:
    UsdtDestinationFormValue,
): UsdtDestinationFormErrors {
  const errors:
    UsdtDestinationFormErrors =
    {};

  if (
    normalizeText(
      value.accountName,
    ).length <
    2
  ) {
    errors.accountName =
      "Renseignez le nom du titulaire du portefeuille.";
  }

  if (
    !isTronAddressValid(
      value.cryptoAddress,
    )
  ) {
    errors.cryptoAddress =
      "L’adresse USDT TRC20 est invalide.";
  }

  if (
    !addressesMatch(
      value.cryptoAddress,
      value.confirmationAddress,
    )
  ) {
    errors.confirmationAddress =
      "Les deux adresses USDT ne correspondent pas.";
  }

  if (
    !value.confirmationAccepted
  ) {
    errors.confirmationAccepted =
      "Vous devez confirmer que l’adresse et le réseau sont exacts.";
  }

  return errors;
}

export function isUsdtDestinationComplete(
  value:
    UsdtDestinationFormValue,
): boolean {
  return (
    Object.keys(
      validateUsdtDestination(
        value,
      ),
    ).length ===
    0
  );
}

export default function UsdtDestinationForm({
  country,
  value,
  onChange,
  errors = {},
  disabled = false,
  title =
    "Portefeuille USDT",
  description =
    "Renseignez une adresse USDT valide sur le réseau TRON TRC20.",
  showSecurityNotice = true,
  className = "",
}: UsdtDestinationFormProps) {
  const [
    copied,
    setCopied,
  ] = useState(false);

  const normalizedAddress =
    useMemo(
      () =>
        normalizeTronAddress(
          value.cryptoAddress,
        ),
      [
        value.cryptoAddress,
      ],
    );

  const addressValid =
    isTronAddressValid(
      value.cryptoAddress,
    );

  const confirmationMatches =
    addressesMatch(
      value.cryptoAddress,
      value.confirmationAddress,
    );

  const updateValue =
    <TKey extends keyof UsdtDestinationFormValue>(
      key: TKey,
      fieldValue:
        UsdtDestinationFormValue[TKey],
    ) => {
      onChange({
        ...value,
        [key]:
          fieldValue,
      });
    };

  const handleCopyAddress =
    async () => {
      if (
        !normalizedAddress ||
        !navigator.clipboard
      ) {
        return;
      }

      try {
        await navigator.clipboard.writeText(
          normalizedAddress,
        );

        setCopied(true);

        window.setTimeout(
          () => {
            setCopied(false);
          },
          1400,
        );
      } catch {
        setCopied(false);
      }
    };

  return (
    <section
      className={`w-full min-w-0 rounded-2xl border border-white/[0.08] bg-[#071014] p-4 sm:p-5 ${className}`}
    >
      <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/[0.07]">
              <CircleDollarSign className="h-[18px] w-[18px] text-violet-300" />
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

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {country && (
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2">
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

          <div className="inline-flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/[0.07] px-3 py-2">
            <Wallet className="h-3.5 w-3.5 text-violet-300" />

            <div>
              <p className="text-[10px] font-black text-violet-200">
                USDT
              </p>

              <p className="text-[9px] text-violet-100/45">
                TRON • TRC20
              </p>
            </div>
          </div>
        </div>
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
                Le pays du bénéficiaire reste obligatoire, même pour un retrait en USDT.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5 rounded-2xl border border-violet-500/15 bg-violet-500/[0.035] p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />

              <div className="min-w-0">
                <p className="text-xs font-black text-violet-200">
                  Réseau verrouillé sur TRC20
                </p>

                <p className="mt-1 text-[10px] leading-4 text-violet-100/45">
                  Tikemia enverra uniquement des USDT via le réseau TRON TRC20. N’utilisez pas une adresse ERC20, BEP20 ou un autre réseau.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div>
              <label
                htmlFor="usdt-account-name"
                className="mb-2 block text-[11px] font-black uppercase tracking-[0.09em] text-neutral-400"
              >
                Titulaire du portefeuille
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
                  id="usdt-account-name"
                  type="text"
                  value={
                    value.accountName
                  }
                  disabled={
                    disabled
                  }
                  maxLength={
                    160
                  }
                  autoComplete="name"
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
                      : "border-white/[0.08] focus:border-violet-500/35 focus:ring-4 focus:ring-violet-500/[0.05]"
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
                htmlFor="usdt-network"
                className="mb-2 block text-[11px] font-black uppercase tracking-[0.09em] text-neutral-400"
              >
                Réseau
              </label>

              <div className="relative">
                <Wallet className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

                <input
                  id="usdt-network"
                  type="text"
                  value={
                    TRC20_NETWORK
                  }
                  disabled
                  readOnly
                  className="h-12 w-full cursor-not-allowed rounded-xl border border-white/[0.08] bg-white/[0.02] pl-10 pr-3.5 text-sm font-black text-violet-300 outline-none opacity-90"
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label
              htmlFor="usdt-address"
              className="mb-2 block text-[11px] font-black uppercase tracking-[0.09em] text-neutral-400"
            >
              Adresse USDT TRC20
              <span
                aria-hidden="true"
                className="ml-1 text-red-400"
              >
                *
              </span>
            </label>

            <div className="relative">
              <input
                id="usdt-address"
                type="text"
                value={
                  value.cryptoAddress
                }
                disabled={
                  disabled
                }
                spellCheck={
                  false
                }
                autoComplete="off"
                maxLength={
                  34
                }
                onChange={(
                  event,
                ) =>
                  updateValue(
                    "cryptoAddress",
                    normalizeTronAddress(
                      event.target
                        .value,
                    ),
                  )
                }
                placeholder="TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                className={`h-12 w-full rounded-xl border bg-[#040a0e] px-3.5 pr-12 font-mono text-sm text-white outline-none transition placeholder:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 ${
                  errors.cryptoAddress
                    ? "border-red-500/35 focus:border-red-400/60"
                    : addressValid
                      ? "border-emerald-500/30 focus:border-emerald-500/45 focus:ring-4 focus:ring-emerald-500/[0.05]"
                      : "border-white/[0.08] focus:border-violet-500/35 focus:ring-4 focus:ring-violet-500/[0.05]"
                }`}
              />

              {normalizedAddress && (
                <button
                  type="button"
                  disabled={
                    disabled
                  }
                  aria-label="Copier l’adresse USDT"
                  onClick={() =>
                    void handleCopyAddress()
                  }
                  className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-neutral-500 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {copied ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
              <p
                className={`text-[10px] ${
                  errors.cryptoAddress
                    ? "text-red-400"
                    : addressValid
                      ? "text-emerald-400"
                      : "text-neutral-700"
                }`}
              >
                {errors.cryptoAddress ??
                  (addressValid
                    ? "Adresse TRC20 valide."
                    : "Une adresse TRON commence par T et contient 34 caractères.")}
              </p>

              <span className="shrink-0 text-[9px] text-neutral-700">
                {normalizedAddress.length}/34
              </span>
            </div>
          </div>

          <div className="mt-4">
            <label
              htmlFor="usdt-address-confirmation"
              className="mb-2 block text-[11px] font-black uppercase tracking-[0.09em] text-neutral-400"
            >
              Confirmer l’adresse
              <span
                aria-hidden="true"
                className="ml-1 text-red-400"
              >
                *
              </span>
            </label>

            <div className="relative">
              <input
                id="usdt-address-confirmation"
                type="text"
                value={
                  value.confirmationAddress
                }
                disabled={
                  disabled
                }
                spellCheck={
                  false
                }
                autoComplete="off"
                maxLength={
                  34
                }
                onChange={(
                  event,
                ) =>
                  updateValue(
                    "confirmationAddress",
                    normalizeTronAddress(
                      event.target
                        .value,
                    ),
                  )
                }
                placeholder="Répétez exactement l’adresse TRC20"
                className={`h-12 w-full rounded-xl border bg-[#040a0e] px-3.5 pr-11 font-mono text-sm text-white outline-none transition placeholder:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 ${
                  errors.confirmationAddress
                    ? "border-red-500/35 focus:border-red-400/60"
                    : confirmationMatches
                      ? "border-emerald-500/30 focus:border-emerald-500/45 focus:ring-4 focus:ring-emerald-500/[0.05]"
                      : "border-white/[0.08] focus:border-violet-500/35 focus:ring-4 focus:ring-violet-500/[0.05]"
                }`}
              />

              {confirmationMatches && (
                <CheckCircle2 className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-300" />
              )}
            </div>

            <p
              className={`mt-2 text-[10px] ${
                errors.confirmationAddress
                  ? "text-red-400"
                  : confirmationMatches
                    ? "text-emerald-400"
                    : "text-neutral-700"
              }`}
            >
              {errors.confirmationAddress ??
                (confirmationMatches
                  ? "Les deux adresses correspondent."
                  : "Cette vérification réduit le risque d’erreur de destination.")}
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-red-500/15 bg-red-500/[0.035] p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />

              <div>
                <p className="text-xs font-black text-red-200">
                  Vérification indispensable
                </p>

                <p className="mt-1 text-[10px] leading-4 text-red-100/45">
                  Un transfert envoyé vers une mauvaise adresse ou un mauvais réseau est généralement irréversible. Vérifiez chaque caractère avant de confirmer.
                </p>
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
                  Je confirme l’adresse et le réseau TRC20
                </span>

                <span className="mt-1 block text-[10px] leading-4 text-neutral-600">
                  Je confirme être responsable de cette adresse et avoir vérifié qu’elle accepte les USDT sur le réseau TRON TRC20.
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
                Adresse protégée
              </p>

              <p className="mt-1 text-[10px] leading-4 text-sky-100/45">
                L’adresse complète est chiffrée avant son enregistrement. Seuls quelques caractères masqués seront affichés ensuite dans votre espace.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}