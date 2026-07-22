"use client";

import {
  Banknote,
  Check,
  ChevronRight,
  CircleDollarSign,
  Landmark,
  LoaderCircle,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Smartphone,
  WalletCards,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  OrganizerPayoutDestinationOption,
  OrganizerPayoutDestinationType,
} from "@/lib/organizer/get-organizer-payout-destinations";

export type PayoutDestinationSelectorProps =
  Readonly<{
    value: string | null;
    onChange: (
      destination: OrganizerPayoutDestinationOption,
    ) => void;

    destinations?:
      readonly OrganizerPayoutDestinationOption[];

    endpoint?: string;
    countryCode?: string | null;
    currency?: string | null;

    allowedTypes?:
      readonly OrganizerPayoutDestinationType[];

    label?: string;
    description?: string;

    disabled?: boolean;
    required?: boolean;
    error?: string | null;

    showAddButton?: boolean;
    addButtonLabel?: string;
    onAddDestination?: () => void;

    className?: string;
  }>;

type ApiResponse = {
  success?: boolean;
  destinations?:
    OrganizerPayoutDestinationOption[];
  error?: {
    code?: string;
    message?: string;
  };
};

const TYPE_LABELS: Record<
  OrganizerPayoutDestinationType,
  string
> = {
  MOBILE_MONEY: "Mobile Money",
  BANK_ACCOUNT: "Virement bancaire",
  CRYPTO_USDT_TRC20: "USDT TRC20",
};

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

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

function getTypeIcon(
  type:
    OrganizerPayoutDestinationType,
) {
  if (
    type === "MOBILE_MONEY"
  ) {
    return Smartphone;
  }

  if (
    type === "BANK_ACCOUNT"
  ) {
    return Landmark;
  }

  return CircleDollarSign;
}

function getStatusLabel(
  destination:
    OrganizerPayoutDestinationOption,
): string {
  if (
    destination.status ===
    "VERIFIED"
  ) {
    return "Vérifié";
  }

  if (
    destination.status ===
    "PENDING"
  ) {
    return "En attente";
  }

  if (
    destination.status ===
    "REJECTED"
  ) {
    return "Rejeté";
  }

  return "Désactivé";
}

function getStatusClasses(
  destination:
    OrganizerPayoutDestinationOption,
): string {
  if (
    destination.status ===
    "VERIFIED"
  ) {
    return "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300";
  }

  if (
    destination.status ===
    "PENDING"
  ) {
    return "border-amber-500/20 bg-amber-500/[0.08] text-amber-300";
  }

  if (
    destination.status ===
    "REJECTED"
  ) {
    return "border-red-500/20 bg-red-500/[0.08] text-red-300";
  }

  return "border-white/[0.08] bg-white/[0.025] text-neutral-500";
}

function getDestinationReference(
  destination:
    OrganizerPayoutDestinationOption,
): string {
  return (
    normalizeText(
      destination.destinationReference,
    ) ||
    normalizeText(
      destination.maskedPhoneNumber,
    ) ||
    normalizeText(
      destination.maskedIban,
    ) ||
    normalizeText(
      destination.maskedBankAccountNumber,
    ) ||
    normalizeText(
      destination.maskedCryptoAddress,
    ) ||
    "Destination masquée"
  );
}

function getDestinationTitle(
  destination:
    OrganizerPayoutDestinationOption,
): string {
  return (
    normalizeText(
      destination.label,
    ) ||
    TYPE_LABELS[
      destination.type
    ]
  );
}

function getDestinationSubtitle(
  destination:
    OrganizerPayoutDestinationOption,
): string {
  return (
    normalizeText(
      destination.subtitle,
    ) ||
    [
      destination.accountName,
      destination.country,
      getDestinationReference(
        destination,
      ),
    ]
      .map(normalizeText)
      .filter(Boolean)
      .join(" • ")
  );
}

export default function PayoutDestinationSelector({
  value,
  onChange,
  destinations:
    providedDestinations,
  endpoint =
    "/api/organizer/payments/destinations",
  countryCode = null,
  currency = null,
  allowedTypes,
  label =
    "Moyen de retrait",
  description =
    "Sélectionnez le compte sur lequel vous souhaitez recevoir votre retrait.",
  disabled = false,
  required = true,
  error = null,
  showAddButton = true,
  addButtonLabel =
    "Ajouter un moyen",
  onAddDestination,
  className = "",
}: PayoutDestinationSelectorProps) {
  const [
    remoteDestinations,
    setRemoteDestinations,
  ] = useState<
    OrganizerPayoutDestinationOption[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(
    !providedDestinations,
  );

  const [
    loadError,
    setLoadError,
  ] = useState<
    string | null
  >(null);

  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    search,
    setSearch,
  ] = useState("");

  const destinations = useMemo<
    OrganizerPayoutDestinationOption[]
  >(
    () =>
      providedDestinations
        ? [...providedDestinations]
        : remoteDestinations,
    [
      providedDestinations,
      remoteDestinations,
    ],
  );

  const isLoading =
    providedDestinations
      ? false
      : loading;

  const loadDestinations =
    useCallback(
      async (
        signal?: AbortSignal,
      ) => {
        if (
          providedDestinations
        ) {
          return;
        }

        setLoading(true);
        setLoadError(null);

      try {
        const params =
          new URLSearchParams();

        if (
          countryCode?.trim()
        ) {
          params.set(
            "countryCode",
            countryCode
              .trim()
              .toUpperCase(),
          );
        }

        if (
          currency?.trim()
        ) {
          params.set(
            "currency",
            currency
              .trim()
              .toUpperCase(),
          );
        }

        const url =
          params.size > 0
            ? `${endpoint}?${params.toString()}`
            : endpoint;

        const response =
          await fetch(
            url,
            {
              method: "GET",
              headers: {
                Accept:
                  "application/json",
              },
              cache:
                "no-store",
              signal,
            },
          );

        let result:
          | ApiResponse
          | null = null;

        try {
          result =
            (await response.json()) as
              ApiResponse;
        } catch {
          result = null;
        }

        if (!response.ok) {
          throw new Error(
            result?.error?.message ??
              "Impossible de charger les moyens de retrait.",
          );
        }

        setRemoteDestinations(
          Array.isArray(
            result?.destinations,
          )
            ? result.destinations
            : [],
        );
        } catch (loadFailure) {
          if (
            loadFailure instanceof DOMException &&
            loadFailure.name ===
              "AbortError"
          ) {
            return;
          }

          setRemoteDestinations([]);

          setLoadError(
            loadFailure instanceof Error
              ? loadFailure.message
              : "Impossible de charger les moyens de retrait.",
          );
        } finally {
          if (!signal?.aborted) {
            setLoading(false);
          }
        }
      },
      [
        countryCode,
        currency,
        endpoint,
        providedDestinations,
      ],
    );

  useEffect(() => {
    if (
      providedDestinations
    ) {
      return;
    }

    const controller =
      new AbortController();

    const timeoutId =
      window.setTimeout(() => {
        void loadDestinations(
          controller.signal,
        );
      }, 0);

    return () => {
      window.clearTimeout(
        timeoutId,
      );
      controller.abort();
    };
  }, [
    loadDestinations,
    providedDestinations,
  ]);

  const filteredDestinations =
    useMemo(() => {
      const normalizedCountryCode =
        normalizeText(
          countryCode,
        )
          .toUpperCase();

      const normalizedCurrency =
        normalizeText(
          currency,
        )
          .toUpperCase();

      const normalizedSearch =
        normalizeSearch(
          search,
        );

      return destinations
        .filter(
          (
            destination,
          ) => {
            if (
              !destination.isActive
            ) {
              return false;
            }

            if (
              allowedTypes &&
              !allowedTypes.includes(
                destination.type,
              )
            ) {
              return false;
            }

            if (
              normalizedCountryCode &&
              destination.countryCode.toUpperCase() !==
                normalizedCountryCode
            ) {
              return false;
            }

            if (
              normalizedCurrency &&
              destination.currency.toUpperCase() !==
                normalizedCurrency
            ) {
              return false;
            }

            if (
              !normalizedSearch
            ) {
              return true;
            }

            const haystack =
              normalizeSearch(
                [
                  getDestinationTitle(
                    destination,
                  ),
                  getDestinationSubtitle(
                    destination,
                  ),
                  destination.country,
                  destination.countryCode,
                  destination.currency,
                  destination.accountName,
                  destination.mobileProvider,
                  destination.bankName,
                  destination.cryptoNetwork,
                  getDestinationReference(
                    destination,
                  ),
                ].join(" "),
              );

            return haystack.includes(
              normalizedSearch,
            );
          },
        )
        .sort(
          (
            first,
            second,
          ) => {
            if (
              first.isDefault !==
              second.isDefault
            ) {
              return first.isDefault
                ? -1
                : 1;
            }

            if (
              first.canBeUsed !==
              second.canBeUsed
            ) {
              return first.canBeUsed
                ? -1
                : 1;
            }

            return getDestinationTitle(
              first,
            ).localeCompare(
              getDestinationTitle(
                second,
              ),
              "fr",
            );
          },
        );
    }, [
      allowedTypes,
      countryCode,
      currency,
      destinations,
      search,
    ]);

  const selectedDestination =
    useMemo(
      () =>
        destinations.find(
          (
            destination,
          ) =>
            destination.id ===
            value,
        ) ??
        null,
      [
        destinations,
        value,
      ],
    );

  const closeSelector =
    useCallback(() => {
      setOpen(false);
      setSearch("");
    }, []);

  const handleSelect =
    useCallback(
      (
        destination:
          OrganizerPayoutDestinationOption,
      ) => {
        if (
          disabled ||
          !destination.canBeUsed
        ) {
          return;
        }

        onChange(
          destination,
        );

        closeSelector();
      },
      [
        closeSelector,
        disabled,
        onChange,
      ],
    );

  const handleAddDestination =
    useCallback(() => {
      closeSelector();
      onAddDestination?.();
    }, [
      closeSelector,
      onAddDestination,
    ]);

  return (
    <div
      className={`w-full min-w-0 ${className}`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <label
            htmlFor="payout-destination-selector-button"
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
          Coordonnées protégées
        </span>
      </div>

      <div className="relative">
        <button
          id="payout-destination-selector-button"
          type="button"
          disabled={
            disabled ||
            isLoading
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
          className={`flex min-h-[72px] w-full min-w-0 items-center gap-3 rounded-2xl border px-3.5 text-left transition ${
            error ||
            loadError
              ? "border-red-500/35 bg-red-500/[0.035]"
              : open
                ? "border-emerald-500/35 bg-emerald-500/[0.035] shadow-[0_0_0_3px_rgba(16,185,129,0.07)]"
                : "border-white/[0.09] bg-[#050c10] hover:border-white/[0.16] hover:bg-white/[0.025]"
          } ${
            disabled ||
            isLoading
              ? "cursor-not-allowed opacity-60"
              : "cursor-pointer"
          }`}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025]">
            {isLoading ? (
              <LoaderCircle className="h-4 w-4 animate-spin text-emerald-400" />
            ) : selectedDestination ? (
              (() => {
                const Icon =
                  getTypeIcon(
                    selectedDestination.type,
                  );

                return (
                  <Icon className="h-[18px] w-[18px] text-emerald-300" />
                );
              })()
            ) : (
              <WalletCards className="h-[18px] w-[18px] text-neutral-500" />
            )}
          </span>

          <span className="min-w-0 flex-1">
            {isLoading ? (
              <>
                <span className="block text-sm font-black text-white">
                  Chargement des moyens…
                </span>

                <span className="mt-0.5 block text-[10px] text-neutral-600">
                  Connexion sécurisée à votre espace financier
                </span>
              </>
            ) : selectedDestination ? (
              <>
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-black text-white">
                    {getDestinationTitle(
                      selectedDestination,
                    )}
                  </span>

                  {selectedDestination.isDefault && (
                    <span className="rounded-full border border-sky-500/20 bg-sky-500/[0.08] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-sky-300">
                      Par défaut
                    </span>
                  )}

                  <span
                    className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] ${getStatusClasses(
                      selectedDestination,
                    )}`}
                  >
                    {getStatusLabel(
                      selectedDestination,
                    )}
                  </span>
                </span>

                <span className="mt-1 block truncate text-[10px] text-neutral-500">
                  {getDestinationSubtitle(
                    selectedDestination,
                  )}
                </span>
              </>
            ) : (
              <>
                <span className="block truncate text-sm font-bold text-neutral-400">
                  Sélectionner un moyen de retrait
                </span>

                <span className="mt-0.5 block truncate text-[10px] text-neutral-600">
                  Mobile Money, banque ou USDT TRC20
                </span>
              </>
            )}
          </span>

          <ChevronRight
            className={`h-4 w-4 shrink-0 text-neutral-600 transition-transform ${
              open
                ? "rotate-90"
                : ""
            }`}
          />
        </button>

        {open && (
          <>
            <button
              type="button"
              aria-label="Fermer la liste des moyens de retrait"
              onClick={
                closeSelector
              }
              className="fixed inset-0 z-[149] cursor-default bg-transparent"
            />

            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[150] overflow-hidden rounded-2xl border border-white/[0.10] bg-[#071014] shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
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
                    placeholder="Rechercher un opérateur, une banque ou un compte…"
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
                    {filteredDestinations.length} moyen
                    {filteredDestinations.length > 1
                      ? "s"
                      : ""}
                  </span>

                  {!providedDestinations && (
                    <button
                      type="button"
                      onClick={() =>
                        void loadDestinations()
                      }
                      className="inline-flex items-center gap-1.5 text-neutral-600 transition hover:text-white"
                    >
                      <RefreshCcw className="h-3 w-3" />
                      Actualiser
                    </button>
                  )}
                </div>
              </div>

              <div
                role="listbox"
                aria-label={
                  label
                }
                className="max-h-[360px] overflow-y-auto p-2 [scrollbar-color:rgba(255,255,255,0.15)_transparent] [scrollbar-width:thin]"
              >
                {filteredDestinations.length > 0 ? (
                  filteredDestinations.map(
                    (
                      destination,
                    ) => {
                      const selected =
                        destination.id ===
                        value;

                      const Icon =
                        getTypeIcon(
                          destination.type,
                        );

                      return (
                        <button
                          key={
                            destination.id
                          }
                          type="button"
                          role="option"
                          aria-selected={
                            selected
                          }
                          disabled={
                            !destination.canBeUsed
                          }
                          onClick={() =>
                            handleSelect(
                              destination,
                            )
                          }
                          className={`flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                            selected
                              ? "bg-emerald-500/[0.09] text-white"
                              : destination.canBeUsed
                                ? "text-neutral-300 hover:bg-white/[0.035] hover:text-white"
                                : "cursor-not-allowed opacity-50"
                          }`}
                        >
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.02]">
                            <Icon className="h-[18px] w-[18px] text-neutral-400" />
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="flex min-w-0 flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-black">
                                {getDestinationTitle(
                                  destination,
                                )}
                              </span>

                              {destination.isDefault && (
                                <span className="rounded-full border border-sky-500/20 bg-sky-500/[0.08] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] text-sky-300">
                                  Par défaut
                                </span>
                              )}

                              <span
                                className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.08em] ${getStatusClasses(
                                  destination,
                                )}`}
                              >
                                {getStatusLabel(
                                  destination,
                                )}
                              </span>
                            </span>

                            <span className="mt-1 block truncate text-[10px] text-neutral-600">
                              {getDestinationSubtitle(
                                destination,
                              )}
                            </span>
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
                  <div className="flex min-h-44 flex-col items-center justify-center px-5 py-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.02]">
                      <Banknote className="h-5 w-5 text-neutral-700" />
                    </div>

                    <p className="mt-3 text-sm font-black text-white">
                      Aucun moyen disponible
                    </p>

                    <p className="mt-1 max-w-sm text-xs leading-5 text-neutral-600">
                      Ajoutez un moyen de retrait ou modifiez les filtres de pays et de devise.
                    </p>
                  </div>
                )}
              </div>

              {showAddButton && (
                <div className="border-t border-white/[0.07] bg-white/[0.012] p-3">
                  <button
                    type="button"
                    onClick={
                      handleAddDestination
                    }
                    disabled={
                      !onAddDestination
                    }
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-4 text-sm font-black text-emerald-300 transition hover:bg-emerald-500/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    {addButtonLabel}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {(error ||
        loadError) && (
        <p
          role="alert"
          className="mt-2 text-[11px] font-medium text-red-400"
        >
          {error ??
            loadError}
        </p>
      )}
    </div>
  );
}