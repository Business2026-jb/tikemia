"use client";

import {
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import type {
  GetOrganizerOrdersResult,
  OrganizerOrdersSort,
} from "@/lib/organizer/get-organizer-orders";

type OrdersToolbarProps = {
  filters: GetOrganizerOrdersResult["filters"];
  appliedFilters: GetOrganizerOrdersResult["appliedFilters"];
  totalItems: number;
  exportBaseUrl?: string;
};

type ToolbarState = {
  search: string;
  eventId: string;
  status: string;
  currency: string;
  paymentStatus: string;
  paymentMethod: string;
  dateFrom: string;
  dateTo: string;
  sort: OrganizerOrdersSort;
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  PAID: "Payée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
  FAILED: "Échouée",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  SUCCESS: "Réussi",
  FAILED: "Échoué",
  REFUNDED: "Remboursé",
};

const SORT_OPTIONS: Array<{
  value: OrganizerOrdersSort;
  label: string;
}> = [
  {
    value: "NEWEST",
    label: "Plus récentes",
  },
  {
    value: "OLDEST",
    label: "Plus anciennes",
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

const inputClassName =
  "h-11 w-full rounded-xl border border-white/[0.08] bg-[#050b0f] px-3.5 text-sm text-white outline-none transition placeholder:text-neutral-700 hover:border-white/[0.13] focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60";

function toDateInputValue(
  value: string | null,
): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function buildInitialState(
  appliedFilters: GetOrganizerOrdersResult["appliedFilters"],
): ToolbarState {
  return {
    search:
      appliedFilters.search,
    eventId:
      appliedFilters.eventId ?? "",
    status:
      appliedFilters.status ?? "",
    currency:
      appliedFilters.currency ?? "",
    paymentStatus:
      appliedFilters.paymentStatus ?? "",
    paymentMethod:
      appliedFilters.paymentMethod ?? "",
    dateFrom:
      toDateInputValue(
        appliedFilters.dateFrom,
      ),
    dateTo:
      toDateInputValue(
        appliedFilters.dateTo,
      ),
    sort:
      appliedFilters.sort,
  };
}

function countActiveFilters(
  state: ToolbarState,
): number {
  return [
    state.eventId,
    state.status,
    state.currency,
    state.paymentStatus,
    state.paymentMethod,
    state.dateFrom,
    state.dateTo,
  ].filter(Boolean).length;
}

export default function OrdersToolbar({
  filters,
  appliedFilters,
  totalItems,
  exportBaseUrl = "/api/organizer/orders/export",
}: OrdersToolbarProps) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const searchParams =
    useSearchParams();

  const [isPending, startTransition] =
    useTransition();

  const initialState =
    useMemo(
      () =>
        buildInitialState(
          appliedFilters,
        ),
      [appliedFilters],
    );

  const [state, setState] =
    useState<ToolbarState>(
      initialState,
    );

  const [filtersOpen, setFiltersOpen] =
    useState(false);

  const [exportsOpen, setExportsOpen] =
    useState(false);

  useEffect(() => {
    setState(
      initialState,
    );
  }, [initialState]);

  const activeFiltersCount =
    countActiveFilters(
      state,
    );

  const hasAnyFilter =
    Boolean(
      state.search ||
        activeFiltersCount > 0 ||
        state.sort !== "NEWEST",
    );

  const updateUrl =
    useCallback(
      (
        nextState: ToolbarState,
        options?: {
          replace?: boolean;
        },
      ) => {
        const params =
          new URLSearchParams(
            searchParams.toString(),
          );

        const entries: Array<
          [string, string]
        > = [
          [
            "search",
            nextState.search.trim(),
          ],
          [
            "eventId",
            nextState.eventId,
          ],
          [
            "status",
            nextState.status,
          ],
          [
            "currency",
            nextState.currency,
          ],
          [
            "paymentStatus",
            nextState.paymentStatus,
          ],
          [
            "paymentMethod",
            nextState.paymentMethod,
          ],
          [
            "dateFrom",
            nextState.dateFrom,
          ],
          [
            "dateTo",
            nextState.dateTo,
          ],
          [
            "sort",
            nextState.sort,
          ],
        ];

        for (const [key, value] of entries) {
          if (
            value &&
            !(
              key === "sort" &&
              value === "NEWEST"
            )
          ) {
            params.set(
              key,
              value,
            );
          } else {
            params.delete(
              key,
            );
          }
        }

        params.delete("page");

        const query =
          params.toString();

        const destination =
          query
            ? `${pathname}?${query}`
            : pathname;

        startTransition(() => {
          if (options?.replace) {
            router.replace(
              destination,
              {
                scroll: false,
              },
            );
          } else {
            router.push(
              destination,
              {
                scroll: false,
              },
            );
          }
        });
      },
      [
        pathname,
        router,
        searchParams,
      ],
    );

  function updateField<
    Key extends keyof ToolbarState,
  >(
    key: Key,
    value: ToolbarState[Key],
  ) {
    setState(
      (current) => ({
        ...current,
        [key]: value,
      }),
    );
  }

  function submitFilters() {
    updateUrl(state);
    setFiltersOpen(false);
  }

  function clearFilters() {
    const clearedState: ToolbarState = {
      search: "",
      eventId: "",
      status: "",
      currency: "",
      paymentStatus: "",
      paymentMethod: "",
      dateFrom: "",
      dateTo: "",
      sort: "NEWEST",
    };

    setState(
      clearedState,
    );

    updateUrl(
      clearedState,
    );

    setFiltersOpen(false);
  }

  function submitSearch(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    updateUrl(state);
  }

  function createExportUrl(
    format: "csv" | "xlsx" | "pdf",
  ): string {
    const params =
      new URLSearchParams();

    params.set(
      "format",
      format,
    );

    const values: Array<
      [string, string]
    > = [
      [
        "search",
        state.search.trim(),
      ],
      [
        "eventId",
        state.eventId,
      ],
      [
        "status",
        state.status,
      ],
      [
        "currency",
        state.currency,
      ],
      [
        "paymentStatus",
        state.paymentStatus,
      ],
      [
        "paymentMethod",
        state.paymentMethod,
      ],
      [
        "dateFrom",
        state.dateFrom,
      ],
      [
        "dateTo",
        state.dateTo,
      ],
      [
        "sort",
        state.sort,
      ],
    ];

    for (const [key, value] of values) {
      if (value) {
        params.set(
          key,
          value,
        );
      }
    }

    return `${exportBaseUrl}?${params.toString()}`;
  }

  return (
    <section className="relative rounded-2xl border border-white/[0.08] bg-[#081015] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)] sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
              <SlidersHorizontal className="h-[18px] w-[18px] text-lime-400" />
            </div>

            <div>
              <h2 className="text-sm font-black text-white">
                Rechercher et filtrer
              </h2>

              <p className="mt-0.5 text-xs text-neutral-600">
                {totalItems.toLocaleString(
                  "fr-FR",
                )}{" "}
                commande
                {totalItems > 1
                  ? "s"
                  : ""}{" "}
                trouvée
                {totalItems > 1
                  ? "s"
                  : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row xl:min-w-[720px]">
          <form
            onSubmit={submitSearch}
            className="relative flex-1"
          >
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

            <input
              type="search"
              value={state.search}
              onChange={(event) =>
                updateField(
                  "search",
                  event.target.value,
                )
              }
              placeholder="Référence, client, e-mail, téléphone, événement..."
              className={`${inputClassName} pl-10 pr-12`}
            />

            {state.search && (
              <button
                type="button"
                onClick={() => {
                  const nextState = {
                    ...state,
                    search: "",
                  };

                  setState(
                    nextState,
                  );

                  updateUrl(
                    nextState,
                    {
                      replace:
                        true,
                    },
                  );
                }}
                aria-label="Effacer la recherche"
                className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-white/[0.05] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setFiltersOpen(
                  (current) =>
                    !current,
                )
              }
              className={`relative inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-black transition sm:flex-none ${
                filtersOpen ||
                activeFiltersCount > 0
                  ? "border-emerald-500/35 bg-emerald-500/10 text-lime-400"
                  : "border-white/[0.08] bg-white/[0.025] text-neutral-300 hover:border-white/[0.15] hover:text-white"
              }`}
            >
              <Filter className="h-4 w-4" />
              Filtres

              {activeFiltersCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-lime-400 px-1 text-[10px] font-black text-black">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            <div className="relative flex-1 sm:flex-none">
              <button
                type="button"
                onClick={() =>
                  setExportsOpen(
                    (current) =>
                      !current,
                  )
                }
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-orange-500/25 bg-orange-500/[0.07] px-4 text-xs font-black text-orange-300 transition hover:border-orange-500/40 hover:bg-orange-500/10 sm:w-auto"
              >
                <Download className="h-4 w-4" />
                Exporter
                <ChevronDown className="h-3.5 w-3.5" />
              </button>

              {exportsOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[230px] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#071015] p-2 shadow-[0_22px_70px_rgba(0,0,0,0.55)]">
                  <ExportLink
                    href={createExportUrl(
                      "csv",
                    )}
                    icon={FileText}
                    label="Exporter en CSV"
                    description="Données simples et universelles"
                  />

                  <ExportLink
                    href={createExportUrl(
                      "xlsx",
                    )}
                    icon={FileSpreadsheet}
                    label="Exporter en Excel"
                    description="Rapport détaillé multi-feuilles"
                  />

                  <ExportLink
                    href={createExportUrl(
                      "pdf",
                    )}
                    icon={FileText}
                    label="Exporter en PDF"
                    description="Rapport professionnel imprimable"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {filtersOpen && (
        <div className="mt-5 border-t border-white/[0.07] pt-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SelectField
              label="Événement"
              icon={CalendarDays}
              value={state.eventId}
              onChange={(value) =>
                updateField(
                  "eventId",
                  value,
                )
              }
              options={[
                {
                  value: "",
                  label:
                    "Tous les événements",
                },
                ...filters.events.map(
                  (event) => ({
                    value:
                      event.id,
                    label:
                      `${event.title} — ${event.currency}`,
                  }),
                ),
              ]}
            />

            <SelectField
              label="Statut de commande"
              icon={Filter}
              value={state.status}
              onChange={(value) =>
                updateField(
                  "status",
                  value,
                )
              }
              options={[
                {
                  value: "",
                  label:
                    "Tous les statuts",
                },
                ...filters.orderStatuses.map(
                  (status) => ({
                    value:
                      status,
                    label:
                      ORDER_STATUS_LABELS[
                        status
                      ] ?? status,
                  }),
                ),
              ]}
            />

            <SelectField
              label="Devise"
              icon={CircleDollarSign}
              value={state.currency}
              onChange={(value) =>
                updateField(
                  "currency",
                  value,
                )
              }
              options={[
                {
                  value: "",
                  label:
                    "Toutes les devises",
                },
                ...filters.currencies.map(
                  (currency) => ({
                    value:
                      currency.code,
                    label:
                      `${currency.name} — ${currency.code} — ${currency.symbol}`,
                  }),
                ),
              ]}
            />

            <SelectField
              label="Statut du paiement"
              icon={CircleDollarSign}
              value={
                state.paymentStatus
              }
              onChange={(value) =>
                updateField(
                  "paymentStatus",
                  value,
                )
              }
              options={[
                {
                  value: "",
                  label:
                    "Tous les paiements",
                },
                ...filters.paymentStatuses.map(
                  (status) => ({
                    value:
                      status,
                    label:
                      PAYMENT_STATUS_LABELS[
                        status
                      ] ?? status,
                  }),
                ),
              ]}
            />

            <SelectField
              label="Moyen de paiement"
              icon={CircleDollarSign}
              value={
                state.paymentMethod
              }
              onChange={(value) =>
                updateField(
                  "paymentMethod",
                  value,
                )
              }
              options={[
                {
                  value: "",
                  label:
                    "Tous les moyens",
                },
                ...filters.paymentMethods.map(
                  (method) => ({
                    value:
                      method,
                    label:
                      method,
                  }),
                ),
              ]}
            />

            <DateField
              label="Du"
              value={state.dateFrom}
              onChange={(value) =>
                updateField(
                  "dateFrom",
                  value,
                )
              }
            />

            <DateField
              label="Au"
              value={state.dateTo}
              onChange={(value) =>
                updateField(
                  "dateTo",
                  value,
                )
              }
            />

            <SelectField
              label="Trier par"
              icon={SlidersHorizontal}
              value={state.sort}
              onChange={(value) =>
                updateField(
                  "sort",
                  value as OrganizerOrdersSort,
                )
              }
              options={
                SORT_OPTIONS
              }
            />
          </div>

          <div className="mt-5 flex flex-col-reverse gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {hasAnyFilter && (
                <button
                  type="button"
                  onClick={clearFilters}
                  disabled={isPending}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.05] px-4 text-xs font-black text-red-400 transition hover:bg-red-500/10 disabled:opacity-60"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Réinitialiser
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={submitFilters}
              disabled={isPending}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-xs font-black text-white shadow-[0_12px_35px_rgba(34,197,94,0.16)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Chargement
                </>
              ) : (
                <>
                  <Filter className="h-4 w-4" />
                  Appliquer les filtres
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function SelectField({
  label,
  icon: Icon,
  value,
  options,
  onChange,
}: {
  label: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  value: string;
  options: Array<{
    value: string;
    label: string;
  }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-neutral-400">
        {label}
      </span>

      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

        <select
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          className={`${inputClassName} appearance-none pl-10 pr-10`}
        >
          {options.map(
            (option) => (
              <option
                key={`${label}-${option.value}`}
                value={option.value}
              >
                {option.label}
              </option>
            ),
          )}
        </select>

        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
      </div>
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-neutral-400">
        {label}
      </span>

      <div className="relative">
        <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

        <input
          type="date"
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          className={`${inputClassName} pl-10 [color-scheme:dark]`}
        />
      </div>
    </label>
  );
}

function ExportLink({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  label: string;
  description: string;
}) {
  return (
    <a
      href={href}
      onClick={() => {
        // Le téléchargement est géré par la route d’export.
      }}
      className="flex items-start gap-3 rounded-xl px-3 py-3 transition hover:bg-white/[0.045]"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03]">
        <Icon className="h-4 w-4 text-neutral-400" />
      </div>

      <div className="min-w-0">
        <p className="text-xs font-black text-white">
          {label}
        </p>

        <p className="mt-1 text-[10px] leading-4 text-neutral-600">
          {description}
        </p>
      </div>
    </a>
  );
}