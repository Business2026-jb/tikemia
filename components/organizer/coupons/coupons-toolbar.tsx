"use client";

import {
  Archive,
  CalendarClock,
  ChevronDown,
  Filter,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  TicketPercent,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  useMemo,
  useState,
} from "react";

export type CouponsToolbarStatus =
  | "ALL"
  | "DRAFT"
  | "SCHEDULED"
  | "ACTIVE"
  | "EXPIRED"
  | "DISABLED"
  | "ARCHIVED";

export type CouponsToolbarDiscountType =
  | "ALL"
  | "PERCENTAGE"
  | "FIXED_AMOUNT"
  | "SERVICE_FEE";

export type CouponsToolbarDateFilter =
  | "all"
  | "active-now"
  | "scheduled"
  | "expired";

export type CouponsToolbarSort =
  | "recent"
  | "oldest"
  | "code-asc"
  | "code-desc"
  | "most-used"
  | "least-used"
  | "highest-discount"
  | "lowest-discount";

export type CouponsToolbarEventOption = {
  id: string;
  title: string;
};

export type CouponsToolbarFilters = {
  search: string;
  status: CouponsToolbarStatus;
  eventId: string;
  discountType: CouponsToolbarDiscountType;
  dateFilter: CouponsToolbarDateFilter;
  sort: CouponsToolbarSort;
};

export type CouponsToolbarProps = {
  value: CouponsToolbarFilters;

  events?: readonly CouponsToolbarEventOption[];

  totalResults?: number;
  isLoading?: boolean;
  disabled?: boolean;

  onChange: (
    nextValue: CouponsToolbarFilters,
  ) => void;

  onCreateCoupon?: () => void;
  onRefresh?: () => void;

  className?: string;
};

const STATUS_OPTIONS: Array<{
  value: CouponsToolbarStatus;
  label: string;
}> = [
  {
    value: "ALL",
    label: "Tous les statuts",
  },
  {
    value: "DRAFT",
    label: "Brouillon",
  },
  {
    value: "SCHEDULED",
    label: "Programmé",
  },
  {
    value: "ACTIVE",
    label: "Actif",
  },
  {
    value: "EXPIRED",
    label: "Expiré",
  },
  {
    value: "DISABLED",
    label: "Désactivé",
  },
  {
    value: "ARCHIVED",
    label: "Archivé",
  },
];

const DISCOUNT_TYPE_OPTIONS: Array<{
  value: CouponsToolbarDiscountType;
  label: string;
}> = [
  {
    value: "ALL",
    label: "Tous les types",
  },
  {
    value: "PERCENTAGE",
    label: "Pourcentage",
  },
  {
    value: "FIXED_AMOUNT",
    label: "Montant fixe",
  },
  {
    value: "SERVICE_FEE",
    label: "Frais de service",
  },
];

const DATE_FILTER_OPTIONS: Array<{
  value: CouponsToolbarDateFilter;
  label: string;
}> = [
  {
    value: "all",
    label: "Toutes les périodes",
  },
  {
    value: "active-now",
    label: "Actifs maintenant",
  },
  {
    value: "scheduled",
    label: "Programmés",
  },
  {
    value: "expired",
    label: "Expirés",
  },
];

const SORT_OPTIONS: Array<{
  value: CouponsToolbarSort;
  label: string;
}> = [
  {
    value: "recent",
    label: "Plus récents",
  },
  {
    value: "oldest",
    label: "Plus anciens",
  },
  {
    value: "code-asc",
    label: "Code A → Z",
  },
  {
    value: "code-desc",
    label: "Code Z → A",
  },
  {
    value: "most-used",
    label: "Plus utilisés",
  },
  {
    value: "least-used",
    label: "Moins utilisés",
  },
  {
    value: "highest-discount",
    label: "Réduction la plus élevée",
  },
  {
    value: "lowest-discount",
    label: "Réduction la plus faible",
  },
];

const DEFAULT_FILTERS: CouponsToolbarFilters = {
  search: "",
  status: "ALL",
  eventId: "",
  discountType: "ALL",
  dateFilter: "all",
  sort: "recent",
};

function joinClassNames(
  ...values: Array<
    string | false | null | undefined
  >
): string {
  return values
    .filter(Boolean)
    .join(" ");
}

function SelectField({
  id,
  label,
  value,
  disabled,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  options: ReadonlyArray<{
    value: string;
    label: string;
  }>;
  onChange: (
    event: ChangeEvent<HTMLSelectElement>,
  ) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="block"
    >
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </span>

      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="h-10 w-full appearance-none rounded-xl border border-white/[0.08] bg-black/20 px-3 pr-9 text-xs font-bold text-white outline-none transition focus:border-emerald-400/45 focus:ring-2 focus:ring-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>

        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
        />
      </div>
    </label>
  );
}

export default function CouponsToolbar({
  value,
  events = [],
  totalResults = 0,
  isLoading = false,
  disabled = false,
  onChange,
  onCreateCoupon,
  onRefresh,
  className,
}: CouponsToolbarProps) {
  const [
    showAdvancedFilters,
    setShowAdvancedFilters,
  ] = useState(false);

  const isDisabled =
    disabled || isLoading;

  const activeFiltersCount =
    useMemo(() => {
      let count = 0;

      if (value.search.trim()) {
        count += 1;
      }

      if (
        value.status !==
        "ALL"
      ) {
        count += 1;
      }

      if (value.eventId) {
        count += 1;
      }

      if (
        value.discountType !==
        "ALL"
      ) {
        count += 1;
      }

      if (
        value.dateFilter !==
        "all"
      ) {
        count += 1;
      }

      if (
        value.sort !==
        "recent"
      ) {
        count += 1;
      }

      return count;
    }, [value]);

  const hasActiveFilters =
    activeFiltersCount > 0;

  function updateFilter<
    K extends keyof CouponsToolbarFilters,
  >(
    key: K,
    nextValue:
      CouponsToolbarFilters[K],
  ) {
    onChange({
      ...value,
      [key]: nextValue,
    });
  }

  function clearFilters() {
    onChange({
      ...DEFAULT_FILTERS,
    });
  }

  return (
    <section
      className={joinClassNames(
        "rounded-2xl border border-white/[0.075] bg-[#071015] p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
              <TicketPercent
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              Codes promo
            </div>

            <span className="text-xs font-semibold text-neutral-500">
              {totalResults.toLocaleString(
                "fr-FR",
              )}{" "}
              résultat
              {totalResults > 1
                ? "s"
                : ""}
            </span>
          </div>

          <h2 className="mt-2 text-lg font-black tracking-[-0.025em] text-white">
            Rechercher et filtrer
          </h2>

          <p className="mt-1 text-xs font-medium leading-5 text-neutral-500">
            Retrouvez rapidement un code promo par événement, statut, période ou type de réduction.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isDisabled}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-xs font-black text-white transition hover:border-white/[0.15] hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                aria-hidden="true"
                className={joinClassNames(
                  "h-4 w-4",
                  isLoading &&
                    "animate-spin",
                )}
              />
              Actualiser
            </button>
          ) : null}

          {onCreateCoupon ? (
            <button
              type="button"
              onClick={onCreateCoupon}
              disabled={isDisabled}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-black text-[#03110b] shadow-[0_12px_30px_rgba(16,185,129,0.16)] transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071015] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus
                aria-hidden="true"
                className="h-4 w-4"
              />
              Créer un code promo
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label
          htmlFor="coupons-search"
          className="relative block flex-1"
        >
          <span className="sr-only">
            Rechercher un code promo
          </span>

          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
          />

          <input
            id="coupons-search"
            type="search"
            value={value.search}
            onChange={(event) => {
              updateFilter(
                "search",
                event.target.value,
              );
            }}
            placeholder="Rechercher par code, événement, campagne..."
            autoComplete="off"
            disabled={isDisabled}
            className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 pl-10 pr-10 text-sm font-semibold text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-400/45 focus:ring-2 focus:ring-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-50"
          />

          {value.search ? (
            <button
              type="button"
              aria-label="Effacer la recherche"
              onClick={() => {
                updateFilter(
                  "search",
                  "",
                );
              }}
              disabled={isDisabled}
              className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
            </button>
          ) : null}
        </label>

        <div className="grid gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-3">
          <div className="min-w-[190px]">
            <SelectField
              id="coupons-status"
              label="Statut"
              value={value.status}
              disabled={isDisabled}
              options={STATUS_OPTIONS}
              onChange={(event) => {
                updateFilter(
                  "status",
                  event.target
                    .value as CouponsToolbarStatus,
                );
              }}
            />
          </div>

          <div className="min-w-[190px]">
            <SelectField
              id="coupons-event"
              label="Événement"
              value={value.eventId}
              disabled={isDisabled}
              options={[
                {
                  value: "",
                  label:
                    "Tous les événements",
                },
                ...events.map(
                  (event) => ({
                    value:
                      event.id,
                    label:
                      event.title,
                  }),
                ),
              ]}
              onChange={(event) => {
                updateFilter(
                  "eventId",
                  event.target.value,
                );
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setShowAdvancedFilters(
                (current) => !current,
              );
            }}
            disabled={isDisabled}
            aria-expanded={
              showAdvancedFilters
            }
            className="mt-[18px] inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-xs font-black text-white transition hover:border-white/[0.15] hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <SlidersHorizontal
              aria-hidden="true"
              className="h-4 w-4"
            />
            Plus de filtres

            {activeFiltersCount > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-400 px-1.5 text-[10px] font-black text-[#03110b]">
                {activeFiltersCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {showAdvancedFilters ? (
        <div className="mt-4 grid gap-3 rounded-2xl border border-white/[0.065] bg-black/15 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <SelectField
            id="coupons-discount-type"
            label="Type de réduction"
            value={
              value.discountType
            }
            disabled={isDisabled}
            options={
              DISCOUNT_TYPE_OPTIONS
            }
            onChange={(event) => {
              updateFilter(
                "discountType",
                event.target
                  .value as CouponsToolbarDiscountType,
              );
            }}
          />

          <SelectField
            id="coupons-date-filter"
            label="Période"
            value={
              value.dateFilter
            }
            disabled={isDisabled}
            options={
              DATE_FILTER_OPTIONS
            }
            onChange={(event) => {
              updateFilter(
                "dateFilter",
                event.target
                  .value as CouponsToolbarDateFilter,
              );
            }}
          />

          <SelectField
            id="coupons-sort"
            label="Trier par"
            value={value.sort}
            disabled={isDisabled}
            options={SORT_OPTIONS}
            onChange={(event) => {
              updateFilter(
                "sort",
                event.target
                  .value as CouponsToolbarSort,
              );
            }}
          />

          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              disabled={
                isDisabled ||
                !hasActiveFilters
              }
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-xs font-black text-white transition hover:border-white/[0.15] hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X
                aria-hidden="true"
                className="h-4 w-4"
              />
              Réinitialiser
            </button>
          </div>
        </div>
      ) : null}

      {hasActiveFilters ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[11px] font-bold text-neutral-400">
            <Filter
              aria-hidden="true"
              className="h-3.5 w-3.5"
            />
            {activeFiltersCount} filtre
            {activeFiltersCount > 1
              ? "s"
              : ""}{" "}
            actif
            {activeFiltersCount > 1
              ? "s"
              : ""}
          </div>

          {value.status !==
          "ALL" ? (
            <FilterChip
              icon={
                <Archive className="h-3.5 w-3.5" />
              }
              label={
                STATUS_OPTIONS.find(
                  (option) =>
                    option.value ===
                    value.status,
                )?.label ??
                value.status
              }
              onRemove={() => {
                updateFilter(
                  "status",
                  "ALL",
                );
              }}
              disabled={isDisabled}
            />
          ) : null}

          {value.eventId ? (
            <FilterChip
              icon={
                <TicketPercent className="h-3.5 w-3.5" />
              }
              label={
                events.find(
                  (event) =>
                    event.id ===
                    value.eventId,
                )?.title ??
                "Événement"
              }
              onRemove={() => {
                updateFilter(
                  "eventId",
                  "",
                );
              }}
              disabled={isDisabled}
            />
          ) : null}

          {value.dateFilter !==
          "all" ? (
            <FilterChip
              icon={
                <CalendarClock className="h-3.5 w-3.5" />
              }
              label={
                DATE_FILTER_OPTIONS.find(
                  (option) =>
                    option.value ===
                    value.dateFilter,
                )?.label ??
                "Période"
              }
              onRemove={() => {
                updateFilter(
                  "dateFilter",
                  "all",
                );
              }}
              disabled={isDisabled}
            />
          ) : null}

          <button
            type="button"
            onClick={clearFilters}
            disabled={isDisabled}
            className="text-[11px] font-black text-emerald-300 transition hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Tout effacer
          </button>
        </div>
      ) : null}
    </section>
  );
}

function FilterChip({
  icon,
  label,
  onRemove,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.055] px-3 py-1.5 text-[11px] font-bold text-emerald-200">
      {icon}

      <span className="max-w-[220px] truncate">
        {label}
      </span>

      <button
        type="button"
        aria-label={`Retirer le filtre ${label}`}
        onClick={onRemove}
        disabled={disabled}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-emerald-300 transition hover:bg-emerald-400/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <X
          aria-hidden="true"
          className="h-3 w-3"
        />
      </button>
    </span>
  );
}