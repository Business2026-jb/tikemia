"use client";

import {
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Download,
  Filter,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  WalletCards,
  X,
} from "lucide-react";
import {
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

import type {
  OrganizerPaymentsData,
  OrganizerPaymentsSort,
} from "@/lib/organizer/get-organizer-payments";

type PaymentsToolbarProps = {
  filters: OrganizerPaymentsData["filters"];
  appliedFilters: OrganizerPaymentsData["appliedFilters"];
  pagination: OrganizerPaymentsData["pagination"];
  period: OrganizerPaymentsData["period"];
  generatedAt?: string;
  exportBaseUrl?: string;
  onRequestPayout?: () => void;
};

type ExportFormat =
  | "csv"
  | "xlsx"
  | "pdf";

const PERIOD_OPTIONS = [
  {
    value: "7",
    label: "7 jours",
  },
  {
    value: "30",
    label: "30 jours",
  },
  {
    value: "90",
    label: "90 jours",
  },
  {
    value: "180",
    label: "6 mois",
  },
  {
    value: "365",
    label: "1 an",
  },
] as const;

const SORT_OPTIONS: Array<{
  value: OrganizerPaymentsSort;
  label: string;
}> = [
  {
    value: "NEWEST",
    label: "Plus récents",
  },
  {
    value: "OLDEST",
    label: "Plus anciens",
  },
  {
    value: "AMOUNT_HIGH",
    label: "Montant décroissant",
  },
  {
    value: "AMOUNT_LOW",
    label: "Montant croissant",
  },
];

function formatGeneratedAt(
  value: string | undefined,
): string {
  if (!value) {
    return "Actualisé maintenant";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Actualisé récemment";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
  ).format(date);
}

function normalizeLabel(
  value: string,
): string {
  return value
    .trim()
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .toLowerCase()
    .replace(
      /(^|\s)\S/g,
      (character) =>
        character.toUpperCase(),
    );
}

export default function PaymentsToolbar({
  filters,
  appliedFilters,
  pagination,
  period,
  generatedAt,
  exportBaseUrl =
    "/api/organizer/payments/export",
  onRequestPayout,
}: PaymentsToolbarProps) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const searchParams =
    useSearchParams();

  const [
    searchValue,
    setSearchValue,
  ] = useState(
    appliedFilters.search,
  );

  const [
    mobileFiltersOpen,
    setMobileFiltersOpen,
  ] = useState(false);

  const [
    exportOpen,
    setExportOpen,
  ] = useState(false);

  const activeFilterCount =
    useMemo(() => {
      let count = 0;

      if (
        appliedFilters.search
      ) {
        count += 1;
      }

      if (
        appliedFilters.eventId
      ) {
        count += 1;
      }

      if (
        appliedFilters.paymentStatus
      ) {
        count += 1;
      }

      if (
        appliedFilters.payoutStatus
      ) {
        count += 1;
      }

      if (
        appliedFilters.paymentMethod
      ) {
        count += 1;
      }

      if (
        appliedFilters.paymentProvider
      ) {
        count += 1;
      }

      if (
        appliedFilters.currency !==
        "XOF"
      ) {
        count += 1;
      }

      if (
        appliedFilters.periodDays !==
        30
      ) {
        count += 1;
      }

      if (
        appliedFilters.dateFrom ||
        appliedFilters.dateTo
      ) {
        count += 1;
      }

      if (
        appliedFilters.sort !==
        "NEWEST"
      ) {
        count += 1;
      }

      return count;
    }, [
      appliedFilters,
    ]);

  const updateSearchParams =
    useCallback(
      (
        updates: Record<
          string,
          string | null
        >,
      ) => {
        const params =
          new URLSearchParams(
            searchParams.toString(),
          );

        for (
          const [
            key,
            value,
          ] of Object.entries(
            updates,
          )
        ) {
          if (
            value === null ||
            value === ""
          ) {
            params.delete(key);
          } else {
            params.set(
              key,
              value,
            );
          }
        }

        params.delete("page");

        const query =
          params.toString();

        router.push(
          query
            ? `${pathname}?${query}`
            : pathname,
        );
      },
      [
        pathname,
        router,
        searchParams,
      ],
    );

  const handleSearchSubmit =
    useCallback(
      (
        event:
          React.FormEvent<HTMLFormElement>,
      ) => {
        event.preventDefault();

        updateSearchParams({
          search:
            searchValue.trim() ||
            null,
        });
      },
      [
        searchValue,
        updateSearchParams,
      ],
    );

  const resetFilters =
    useCallback(() => {
      setSearchValue("");

      router.push(pathname);

      setMobileFiltersOpen(
        false,
      );
    }, [
      pathname,
      router,
    ]);

  const refreshPage =
    useCallback(() => {
      router.refresh();
    }, [router]);

  const buildExportUrl =
    useCallback(
      (
        format:
          ExportFormat,
      ): string => {
        const params =
          new URLSearchParams(
            searchParams.toString(),
          );

        params.set(
          "format",
          format,
        );

        return `${exportBaseUrl}?${params.toString()}`;
      },
      [
        exportBaseUrl,
        searchParams,
      ],
    );

  const requestPayout =
    useCallback(() => {
      setExportOpen(false);

      if (
        onRequestPayout
      ) {
        onRequestPayout();
        return;
      }

      router.push(
        "/organizer/payments?payout=request",
      );
    }, [
      onRequestPayout,
      router,
    ]);

  const filterFields = (
    <>
      <div className="min-w-0">
        <label
          htmlFor="payments-period"
          className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600"
        >
          Période
        </label>

        <select
          id="payments-period"
          value={String(
            appliedFilters.periodDays,
          )}
          onChange={(
            event,
          ) =>
            updateSearchParams({
              periodDays:
                event.target.value,
              dateFrom: null,
              dateTo: null,
            })
          }
          className="h-11 w-full min-w-0 rounded-xl border border-white/[0.08] bg-[#050c10] px-3 text-sm font-semibold text-neutral-300 outline-none transition focus:border-emerald-500/35"
        >
          {PERIOD_OPTIONS.map(
            (option) => (
              <option
                key={
                  option.value
                }
                value={
                  option.value
                }
              >
                {
                  option.label
                }
              </option>
            ),
          )}
        </select>
      </div>

      <div className="min-w-0">
        <label
          htmlFor="payments-event"
          className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600"
        >
          Événement
        </label>

        <select
          id="payments-event"
          value={
            appliedFilters.eventId ??
            ""
          }
          onChange={(
            event,
          ) =>
            updateSearchParams({
              eventId:
                event.target.value ||
                null,
            })
          }
          className="h-11 w-full min-w-0 rounded-xl border border-white/[0.08] bg-[#050c10] px-3 text-sm font-semibold text-neutral-300 outline-none transition focus:border-emerald-500/35"
        >
          <option value="">
            Tous les événements
          </option>

          {filters.events.map(
            (event) => (
              <option
                key={
                  event.id
                }
                value={
                  event.id
                }
              >
                {
                  event.title
                }
              </option>
            ),
          )}
        </select>
      </div>

      <div className="min-w-0">
        <label
          htmlFor="payment-status"
          className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600"
        >
          Statut paiement
        </label>

        <select
          id="payment-status"
          value={
            appliedFilters.paymentStatus ??
            ""
          }
          onChange={(
            event,
          ) =>
            updateSearchParams({
              paymentStatus:
                event.target.value ||
                null,
            })
          }
          className="h-11 w-full min-w-0 rounded-xl border border-white/[0.08] bg-[#050c10] px-3 text-sm font-semibold text-neutral-300 outline-none transition focus:border-emerald-500/35"
        >
          <option value="">
            Tous les statuts
          </option>

          {filters.paymentStatuses.map(
            (status) => (
              <option
                key={
                  status
                }
                value={
                  status
                }
              >
                {normalizeLabel(
                  status,
                )}
              </option>
            ),
          )}
        </select>
      </div>

      <div className="min-w-0">
        <label
          htmlFor="payout-status"
          className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600"
        >
          Statut retrait
        </label>

        <select
          id="payout-status"
          value={
            appliedFilters.payoutStatus ??
            ""
          }
          onChange={(
            event,
          ) =>
            updateSearchParams({
              payoutStatus:
                event.target.value ||
                null,
            })
          }
          className="h-11 w-full min-w-0 rounded-xl border border-white/[0.08] bg-[#050c10] px-3 text-sm font-semibold text-neutral-300 outline-none transition focus:border-emerald-500/35"
        >
          <option value="">
            Tous les retraits
          </option>

          {filters.payoutStatuses.map(
            (status) => (
              <option
                key={
                  status
                }
                value={
                  status
                }
              >
                {normalizeLabel(
                  status,
                )}
              </option>
            ),
          )}
        </select>
      </div>

      <div className="min-w-0">
        <label
          htmlFor="payment-method"
          className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600"
        >
          Méthode
        </label>

        <select
          id="payment-method"
          value={
            appliedFilters.paymentMethod ??
            ""
          }
          onChange={(
            event,
          ) =>
            updateSearchParams({
              paymentMethod:
                event.target.value ||
                null,
            })
          }
          className="h-11 w-full min-w-0 rounded-xl border border-white/[0.08] bg-[#050c10] px-3 text-sm font-semibold text-neutral-300 outline-none transition focus:border-emerald-500/35"
        >
          <option value="">
            Toutes les méthodes
          </option>

          {filters.paymentMethods.map(
            (method) => (
              <option
                key={
                  method
                }
                value={
                  method
                }
              >
                {normalizeLabel(
                  method,
                )}
              </option>
            ),
          )}
        </select>
      </div>

      <div className="min-w-0">
        <label
          htmlFor="payment-provider"
          className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600"
        >
          Prestataire
        </label>

        <select
          id="payment-provider"
          value={
            appliedFilters.paymentProvider ??
            ""
          }
          onChange={(
            event,
          ) =>
            updateSearchParams({
              paymentProvider:
                event.target.value ||
                null,
            })
          }
          className="h-11 w-full min-w-0 rounded-xl border border-white/[0.08] bg-[#050c10] px-3 text-sm font-semibold text-neutral-300 outline-none transition focus:border-emerald-500/35"
        >
          <option value="">
            Tous les prestataires
          </option>

          {filters.paymentProviders.map(
            (provider) => (
              <option
                key={
                  provider
                }
                value={
                  provider
                }
              >
                {normalizeLabel(
                  provider,
                )}
              </option>
            ),
          )}
        </select>
      </div>

      <div className="min-w-0">
        <label
          htmlFor="payment-currency"
          className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600"
        >
          Devise
        </label>

        <select
          id="payment-currency"
          value={
            appliedFilters.currency
          }
          onChange={(
            event,
          ) =>
            updateSearchParams({
              currency:
                event.target.value,
            })
          }
          className="h-11 w-full min-w-0 rounded-xl border border-white/[0.08] bg-[#050c10] px-3 text-sm font-semibold text-neutral-300 outline-none transition focus:border-emerald-500/35"
        >
          {filters.currencies.map(
            (currency) => (
              <option
                key={
                  currency.code
                }
                value={
                  currency.code
                }
              >
                {currency.code} —{" "}
                {
                  currency.name
                }
              </option>
            ),
          )}
        </select>
      </div>

      <div className="min-w-0">
        <label
          htmlFor="payment-sort"
          className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-600"
        >
          Trier par
        </label>

        <select
          id="payment-sort"
          value={
            appliedFilters.sort
          }
          onChange={(
            event,
          ) =>
            updateSearchParams({
              sort:
                event.target
                  .value,
            })
          }
          className="h-11 w-full min-w-0 rounded-xl border border-white/[0.08] bg-[#050c10] px-3 text-sm font-semibold text-neutral-300 outline-none transition focus:border-emerald-500/35"
        >
          {SORT_OPTIONS.map(
            (option) => (
              <option
                key={
                  option.value
                }
                value={
                  option.value
                }
              >
                {
                  option.label
                }
              </option>
            ),
          )}
        </select>
      </div>
    </>
  );

  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.055),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.035),transparent_28%)]" />

      <div className="relative flex w-full min-w-0 flex-col gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-5 xl:flex-row xl:items-center xl:justify-between xl:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-1 text-[10px] font-bold text-emerald-300">
              <WalletCards className="h-3.5 w-3.5" />
              Centre financier
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1 text-[10px] font-semibold text-neutral-500">
              <CalendarDays className="h-3.5 w-3.5" />
              {period.days} jour
              {period.days > 1
                ? "s"
                : ""}
            </span>
          </div>

          <h2 className="mt-3 text-lg font-black text-white sm:text-xl">
            Paiements et retraits
          </h2>

          <p className="mt-1 text-xs leading-5 text-neutral-500">
            Recherchez, filtrez, exportez et suivez toutes vos opérations financières.
          </p>

          <p className="mt-2 text-[10px] text-neutral-600">
            {formatGeneratedAt(
              generatedAt,
            )}
            {" • "}
            {pagination.totalItems} transaction
            {pagination.totalItems > 1
              ? "s"
              : ""}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
          <button
            type="button"
            onClick={
              refreshPage
            }
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-sm font-bold text-neutral-300 transition hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-white sm:w-auto"
          >
            <RefreshCcw className="h-4 w-4" />
            Actualiser
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setExportOpen(
                  (
                    current,
                  ) =>
                    !current,
                )
              }
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/[0.07] px-4 text-sm font-bold text-sky-300 transition hover:bg-sky-500/[0.12] sm:w-auto"
            >
              <Download className="h-4 w-4" />
              Exporter
              <ChevronDown className="h-4 w-4" />
            </button>

            {exportOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-48 overflow-hidden rounded-xl border border-white/[0.09] bg-[#081015] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
                {(
                  [
                    [
                      "csv",
                      "Exporter en CSV",
                    ],
                    [
                      "xlsx",
                      "Exporter en Excel",
                    ],
                    [
                      "pdf",
                      "Exporter en PDF",
                    ],
                  ] as const
                ).map(
                  ([
                    format,
                    label,
                  ]) => (
                    <a
                      key={
                        format
                      }
                      href={buildExportUrl(
                        format,
                      )}
                      onClick={() =>
                        setExportOpen(
                          false,
                        )
                      }
                      className="flex h-10 items-center rounded-lg px-3 text-xs font-semibold text-neutral-300 transition hover:bg-white/[0.055] hover:text-white"
                    >
                      {label}
                    </a>
                  ),
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={
              requestPayout
            }
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.1] px-5 text-sm font-black text-emerald-300 transition hover:border-emerald-400/45 hover:bg-emerald-500/[0.16] sm:w-auto"
          >
            <CircleDollarSign className="h-4 w-4" />
            Demander un retrait
          </button>
        </div>
      </div>

      <div className="relative border-b border-white/[0.07] px-4 py-4 sm:px-5 xl:px-6">
        <form
          onSubmit={
            handleSearchSubmit
          }
          className="flex w-full min-w-0 flex-col gap-3 lg:flex-row"
        >
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

            <input
              value={
                searchValue
              }
              onChange={(
                event,
              ) =>
                setSearchValue(
                  event.target
                    .value,
                )
              }
              type="search"
              placeholder="Rechercher un client, une commande, un événement ou une référence…"
              className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#050c10] pl-10 pr-4 text-sm text-white outline-none placeholder:text-neutral-700 focus:border-emerald-500/35"
            />
          </div>

          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-5 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/[0.12]"
          >
            <Search className="h-4 w-4" />
            Rechercher
          </button>

          <button
            type="button"
            onClick={() =>
              setMobileFiltersOpen(
                (
                  current,
                ) =>
                  !current,
              )
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-sm font-bold text-neutral-300 lg:hidden"
          >
            <Filter className="h-4 w-4" />
            Filtres
            {activeFilterCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-black text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={
                resetFilters
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.055] px-4 text-sm font-bold text-red-300 transition hover:bg-red-500/[0.1]"
            >
              <X className="h-4 w-4" />
              Réinitialiser
            </button>
          )}
        </form>
      </div>

      <div className="relative hidden w-full min-w-0 grid-cols-2 gap-3 px-4 py-4 sm:px-5 lg:grid xl:grid-cols-4 2xl:grid-cols-8 xl:px-6">
        {filterFields}
      </div>

      {mobileFiltersOpen && (
        <div className="relative grid w-full min-w-0 grid-cols-1 gap-3 border-t border-white/[0.07] px-4 py-4 sm:grid-cols-2 sm:px-5 lg:hidden">
          <div className="col-span-full flex items-center gap-2 text-xs font-bold text-neutral-400">
            <SlidersHorizontal className="h-4 w-4 text-orange-300" />
            Filtres avancés
          </div>

          {filterFields}
        </div>
      )}
    </section>
  );
}