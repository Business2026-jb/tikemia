"use client";

import {
  Check,
  ChevronDown,
  Globe2,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

export type PayoutCountryCode =
  | "BJ"
  | "TG"
  | "CI"
  | "SN"
  | "CM"
  | "GA"
  | "GH"
  | "NG"
  | "ML"
  | "NE"
  | "BF"
  | "GN"
  | "CD"
  | "CG"
  | "KE"
  | "RW"
  | "UG"
  | "TZ"
  | "FR"
  | "BE"
  | "DE"
  | "IT";

export type PayoutCountryOption = {
  code: PayoutCountryCode;
  name: string;
  dialCode: string;
  currency: string;
  flag: string;
  mobileMoneyAvailable: boolean;
  bankTransferAvailable: boolean;
  usdtTrc20Available: boolean;
};

export type PayoutCountrySelectorProps = Readonly<{
  value:
    | PayoutCountryCode
    | null;

  onChange: (
    country: PayoutCountryOption,
  ) => void;

  countries?: readonly PayoutCountryOption[];

  label?: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string | null;
  required?: boolean;
  className?: string;
}>;

export const PAYOUT_COUNTRIES: readonly PayoutCountryOption[] = [
  {
    code: "BJ",
    name: "Bénin",
    dialCode: "+229",
    currency: "XOF",
    flag: "🇧🇯",
    mobileMoneyAvailable: true,
    bankTransferAvailable: true,
    usdtTrc20Available: true,
  },
  {
    code: "TG",
    name: "Togo",
    dialCode: "+228",
    currency: "XOF",
    flag: "🇹🇬",
    mobileMoneyAvailable: true,
    bankTransferAvailable: true,
    usdtTrc20Available: true,
  },
  {
    code: "CI",
    name: "Côte d’Ivoire",
    dialCode: "+225",
    currency: "XOF",
    flag: "🇨🇮",
    mobileMoneyAvailable: true,
    bankTransferAvailable: true,
    usdtTrc20Available: true,
  },
  {
    code: "SN",
    name: "Sénégal",
    dialCode: "+221",
    currency: "XOF",
    flag: "🇸🇳",
    mobileMoneyAvailable: true,
    bankTransferAvailable: true,
    usdtTrc20Available: true,
  },
  {
    code: "CM",
    name: "Cameroun",
    dialCode: "+237",
    currency: "XAF",
    flag: "🇨🇲",
    mobileMoneyAvailable: true,
    bankTransferAvailable: true,
    usdtTrc20Available: true,
  },
  {
    code: "GA",
    name: "Gabon",
    dialCode: "+241",
    currency: "XAF",
    flag: "🇬🇦",
    mobileMoneyAvailable: true,
    bankTransferAvailable: true,
    usdtTrc20Available: true,
  },
  {
    code: "GH",
    name: "Ghana",
    dialCode: "+233",
    currency: "GHS",
    flag: "🇬🇭",
    mobileMoneyAvailable: true,
    bankTransferAvailable: true,
    usdtTrc20Available: true,
  },
  {
    code: "NG",
    name: "Nigeria",
    dialCode: "+234",
    currency: "NGN",
    flag: "🇳🇬",
    mobileMoneyAvailable: true,
    bankTransferAvailable: true,
    usdtTrc20Available: true,
  },
  {
    code: "ML",
    name: "Mali",
    dialCode: "+223",
    currency: "XOF",
    flag: "🇲🇱",
    mobileMoneyAvailable: true,
    bankTransferAvailable: true,
    usdtTrc20Available: true,
  },
  {
    code: "NE",
    name: "Niger",
    dialCode: "+227",
    currency: "XOF",
    flag: "🇳🇪",
    mobileMoneyAvailable: true,
    bankTransferAvailable: true,
    usdtTrc20Available: true,
  },
  {
    code: "BF",
    name: "Burkina Faso",
    dialCode: "+226",
    currency: "XOF",
    flag: "🇧🇫",
    mobileMoneyAvailable: true,
    bankTransferAvailable: true,
    usdtTrc20Available: true,
  },
  {
    code: "GN",
    name: "Guinée",
    dialCode: "+224",
    currency: "GNF",
    flag: "🇬🇳",
    mobileMoneyAvailable: true,
    bankTransferAvailable: true,
    usdtTrc20Available: true,
  },
  {
    code: "CD",
    name: "République démocratique du Congo",
    dialCode: "+243",
    currency: "CDF",
    flag: "🇨🇩",
    mobileMoneyAvailable: true,
    bankTransferAvailable: true,
    usdtTrc20Available: true,
  },
  {
    code: "CG",
    name: "République du Congo",
    dialCode: "+242",
    currency: "XAF",
    flag: "🇨🇬",
    mobileMoneyAvailable: true,
    bankTransferAvailable: true,
    usdtTrc20Available: true,
  },
  {
    code: "KE",
    name: "Kenya",
    dialCode: "+254",
    currency: "KES",
    flag: "🇰🇪",
    mobileMoneyAvailable: true,
    bankTransferAvailable: true,
    usdtTrc20Available: true,
  },
  {
    code: "RW",
    name: "Rwanda",
    dialCode: "+250",
    currency: "RWF",
    flag: "🇷🇼",
    mobileMoneyAvailable: true,
    bankTransferAvailable: true,
    usdtTrc20Available: true,
  },
  {
    code: "UG",
    name: "Ouganda",
    dialCode: "+256",
    currency: "UGX",
    flag: "🇺🇬",
    mobileMoneyAvailable: true,
    bankTransferAvailable: true,
    usdtTrc20Available: true,
  },
  {
    code: "TZ",
    name: "Tanzanie",
    dialCode: "+255",
    currency: "TZS",
    flag: "🇹🇿",
    mobileMoneyAvailable: true,
    bankTransferAvailable: true,
    usdtTrc20Available: true,
  },
  {
    code: "FR",
    name: "France",
    dialCode: "+33",
    currency: "EUR",
    flag: "🇫🇷",
    mobileMoneyAvailable: false,
    bankTransferAvailable: true,
    usdtTrc20Available: true,
  },
  {
    code: "BE",
    name: "Belgique",
    dialCode: "+32",
    currency: "EUR",
    flag: "🇧🇪",
    mobileMoneyAvailable: false,
    bankTransferAvailable: true,
    usdtTrc20Available: true,
  },
  {
    code: "DE",
    name: "Allemagne",
    dialCode: "+49",
    currency: "EUR",
    flag: "🇩🇪",
    mobileMoneyAvailable: false,
    bankTransferAvailable: true,
    usdtTrc20Available: true,
  },
  {
    code: "IT",
    name: "Italie",
    dialCode: "+39",
    currency: "EUR",
    flag: "🇮🇹",
    mobileMoneyAvailable: false,
    bankTransferAvailable: true,
    usdtTrc20Available: true,
  },
] as const;

function normalizeSearch(
  value: string,
): string {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .trim();
}

function availabilityLabel(
  country: PayoutCountryOption,
): string {
  const methods: string[] = [];

  if (
    country.mobileMoneyAvailable
  ) {
    methods.push(
      "Mobile Money",
    );
  }

  if (
    country.bankTransferAvailable
  ) {
    methods.push(
      "Banque",
    );
  }

  if (
    country.usdtTrc20Available
  ) {
    methods.push(
      "USDT",
    );
  }

  return methods.join(" • ");
}

export default function PayoutCountrySelector({
  value,
  onChange,
  countries = PAYOUT_COUNTRIES,
  label = "Pays du bénéficiaire",
  description =
    "Le pays sélectionné détermine les moyens de retrait, l’indicatif téléphonique et la devise disponibles.",
  placeholder =
    "Sélectionner un pays",
  disabled = false,
  error = null,
  required = true,
  className = "",
}: PayoutCountrySelectorProps) {
  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    search,
    setSearch,
  ] = useState("");

  const selectedCountry =
    useMemo(
      () =>
        countries.find(
          (
            country,
          ) =>
            country.code ===
            value,
        ) ??
        null,
      [
        countries,
        value,
      ],
    );

  const filteredCountries =
    useMemo(
      () => {
        const normalizedSearch =
          normalizeSearch(
            search,
          );

        if (
          !normalizedSearch
        ) {
          return [
            ...countries,
          ];
        }

        return countries.filter(
          (
            country,
          ) => {
            const haystack =
              normalizeSearch(
                [
                  country.name,
                  country.code,
                  country.dialCode,
                  country.currency,
                ].join(
                  " ",
                ),
              );

            return haystack.includes(
              normalizedSearch,
            );
          },
        );
      },
      [
        countries,
        search,
      ],
    );

  const closeSelector =
    () => {
      setOpen(false);
      setSearch("");
    };

  const selectCountry =
    (
      country: PayoutCountryOption,
    ) => {
      onChange(
        country,
      );

      closeSelector();
    };

  return (
    <div
      className={`w-full min-w-0 ${className}`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <label
            htmlFor="payout-country-selector-button"
            className="block text-[11px] font-black uppercase tracking-[0.09em] text-neutral-400"
          >
            {label}

            {required && (
              <span
                aria-hidden="true"
                className="ml-1 text-red-400"
              >
                *
              </span>
            )}
          </label>

          <p className="mt-1 max-w-2xl text-[11px] leading-5 text-neutral-600">
            {description}
          </p>
        </div>

        <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-2.5 py-1 text-[9px] font-bold text-emerald-300 sm:inline-flex">
          <ShieldCheck className="h-3 w-3" />
          Sécurisé
        </span>
      </div>

      <div className="relative">
        <button
          id="payout-country-selector-button"
          type="button"
          disabled={
            disabled
          }
          aria-haspopup="listbox"
          aria-expanded={
            open
          }
          
          onClick={() =>
            setOpen(
              (
                current,
              ) =>
                !current,
            )
          }
          className={`flex min-h-14 w-full min-w-0 items-center gap-3 rounded-xl border px-3.5 text-left transition ${
            error
              ? "border-red-500/35 bg-red-500/[0.035] focus:border-red-400/60"
              : open
                ? "border-emerald-500/35 bg-emerald-500/[0.035] shadow-[0_0_0_3px_rgba(16,185,129,0.07)]"
                : "border-white/[0.09] bg-[#050c10] hover:border-white/[0.16] hover:bg-white/[0.025]"
          } ${
            disabled
              ? "cursor-not-allowed opacity-50"
              : "cursor-pointer"
          }`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-xl">
            {selectedCountry
              ?.flag ?? (
              <Globe2 className="h-4 w-4 text-neutral-500" />
            )}
          </span>

          <span className="min-w-0 flex-1">
            {selectedCountry ? (
              <>
                <span className="block truncate text-sm font-black text-white">
                  {selectedCountry.name}
                </span>

                <span className="mt-0.5 block truncate text-[10px] text-neutral-500">
                  {selectedCountry.dialCode} • {selectedCountry.currency} • {availabilityLabel(
                    selectedCountry,
                  )}
                </span>
              </>
            ) : (
              <>
                <span className="block truncate text-sm font-bold text-neutral-400">
                  {placeholder}
                </span>

                <span className="mt-0.5 block truncate text-[10px] text-neutral-600">
                  Pays, devise et moyens disponibles
                </span>
              </>
            )}
          </span>

          <ChevronDown
            className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform ${
              open
                ? "rotate-180"
                : ""
            }`}
          />
        </button>

        {open && (
          <>
            <button
              type="button"
              aria-label="Fermer le sélecteur de pays"
              onClick={
                closeSelector
              }
              className="fixed inset-0 z-[139] cursor-default bg-transparent"
            />

            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[140] overflow-hidden rounded-2xl border border-white/[0.10] bg-[#071014] shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
              <div className="border-b border-white/[0.07] p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

                  <input
                    autoFocus
                    type="search"
                    value={
                      search
                    }
                    onChange={(
                      event,
                    ) =>
                      setSearch(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Rechercher un pays, un indicatif ou une devise…"
                    className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#040a0e] pl-10 pr-10 text-sm text-white outline-none placeholder:text-neutral-700 focus:border-emerald-500/35 focus:ring-4 focus:ring-emerald-500/[0.05]"
                  />

                  {search && (
                    <button
                      type="button"
                      aria-label="Effacer la recherche"
                      onClick={() =>
                        setSearch(
                          "",
                        )
                      }
                      className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[9px] font-bold uppercase tracking-[0.08em] text-neutral-700">
                  <span>
                    {filteredCountries.length} pays disponible
                    {filteredCountries.length >
                    1
                      ? "s"
                      : ""}
                  </span>

                  <span>
                    Sélection obligatoire
                  </span>
                </div>
              </div>

              <div
                role="listbox"
                aria-label={
                  label
                }
                className="max-h-[320px] overflow-y-auto p-2 [scrollbar-color:rgba(255,255,255,0.15)_transparent] [scrollbar-width:thin]"
              >
                {filteredCountries.length >
                0 ? (
                  filteredCountries.map(
                    (
                      country,
                    ) => {
                      const selected =
                        country.code ===
                        value;

                      return (
                        <button
                          key={
                            country.code
                          }
                          type="button"
                          role="option"
                          aria-selected={
                            selected
                          }
                          onClick={() =>
                            selectCountry(
                              country,
                            )
                          }
                          className={`flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                            selected
                              ? "bg-emerald-500/[0.09] text-white"
                              : "text-neutral-300 hover:bg-white/[0.035] hover:text-white"
                          }`}
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.02] text-xl">
                            {country.flag}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black">
                              {country.name}
                            </span>

                            <span className="mt-0.5 block truncate text-[10px] text-neutral-600">
                              {country.dialCode} • {country.currency}
                            </span>
                          </span>

                          <span className="hidden min-w-0 max-w-[190px] truncate text-[9px] font-medium text-neutral-700 md:block">
                            {availabilityLabel(
                              country,
                            )}
                          </span>

                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                              selected
                                ? "border-emerald-500/25 bg-emerald-500/[0.10] text-emerald-300"
                                : "border-white/[0.06] bg-white/[0.015] text-transparent"
                            }`}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        </button>
                      );
                    },
                  )
                ) : (
                  <div className="flex min-h-40 flex-col items-center justify-center px-5 py-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.02]">
                      <Globe2 className="h-5 w-5 text-neutral-700" />
                    </div>

                    <p className="mt-3 text-sm font-black text-white">
                      Aucun pays trouvé
                    </p>

                    <p className="mt-1 text-xs leading-5 text-neutral-600">
                      Vérifiez votre recherche ou essayez avec l’indicatif téléphonique.
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-white/[0.07] bg-white/[0.012] px-3 py-2.5">
                <p className="text-[9px] leading-4 text-neutral-700">
                  Seuls les pays et moyens de retrait actuellement pris en charge par Tikemia sont affichés.
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-2 text-[11px] font-medium text-red-400"
        >
          {error}
        </p>
      )}
    </div>
  );
}