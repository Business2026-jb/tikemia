"use client";

import {
  Check,
  ChevronDown,
  Filter,
  LoaderCircle,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

import type {
  OrganizerEventsSort,
  OrganizerEventsStatusCounts,
  OrganizerEventsStatusFilter,
} from "@/lib/events/get-organizer-events";

type EventsToolbarProps = {
  search: string;
  status: OrganizerEventsStatusFilter;
  sort: OrganizerEventsSort;
  statusCounts: OrganizerEventsStatusCounts;
};

type StatusOption = {
  value: OrganizerEventsStatusFilter;
  label: string;
  countKey: keyof OrganizerEventsStatusCounts;
};

const statusOptions: readonly StatusOption[] = [
  {
    value: "ALL",
    label: "Tous",
    countKey: "all",
  },
  {
    value: "DRAFT",
    label: "Brouillons",
    countKey: "draft",
  },
  {
    value: "PENDING",
    label: "En examen",
    countKey: "pending",
  },
  {
    value: "PUBLISHED",
    label: "Publiés",
    countKey: "published",
  },
  {
    value: "SUSPENDED",
    label: "Suspendus",
    countKey: "suspended",
  },
  {
    value: "CANCELLED",
    label: "Annulés",
    countKey: "cancelled",
  },
  {
    value: "COMPLETED",
    label: "Terminés",
    countKey: "completed",
  },
];

const sortOptions: ReadonlyArray<{
  value: OrganizerEventsSort;
  label: string;
}> = [
  {
    value: "created-desc",
    label: "Plus récents",
  },
  {
    value: "created-asc",
    label: "Plus anciens",
  },
  {
    value: "updated-desc",
    label: "Modifiés récemment",
  },
  {
    value: "updated-asc",
    label: "Modifiés anciennement",
  },
  {
    value: "start-asc",
    label: "Date de début croissante",
  },
  {
    value: "start-desc",
    label: "Date de début décroissante",
  },
  {
    value: "title-asc",
    label: "Titre de A à Z",
  },
  {
    value: "title-desc",
    label: "Titre de Z à A",
  },
];

export default function EventsToolbar({
  search,
  status,
  sort,
  statusCounts,
}: EventsToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isPending, startTransition] =
    useTransition();

  const [searchValue, setSearchValue] =
    useState(search);

  const [mobileFiltersOpen, setMobileFiltersOpen] =
    useState(false);

  useEffect(() => {
    setSearchValue(search);
  }, [search]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(search.trim()) ||
      status !== "ALL" ||
      sort !== "created-desc",
    [search, sort, status],
  );

  function navigateWithParameters(
    updates: Record<
      string,
      string | null | undefined
    >,
  ) {
    const parameters = new URLSearchParams(
      searchParams.toString(),
    );

    Object.entries(updates).forEach(
      ([key, value]) => {
        const normalizedValue =
          value?.trim() ?? "";

        if (!normalizedValue) {
          parameters.delete(key);
          return;
        }

        parameters.set(key, normalizedValue);
      },
    );

    /*
     * Toute modification de filtre revient à la première page.
     */
    parameters.delete("page");

    const queryString = parameters.toString();

    startTransition(() => {
      router.push(
        queryString
          ? `${pathname}?${queryString}`
          : pathname,
        {
          scroll: false,
        },
      );
    });
  }

  function handleSearchSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    navigateWithParameters({
      search: searchValue || null,
    });
  }

  function clearSearch() {
    setSearchValue("");

    navigateWithParameters({
      search: null,
    });
  }

  function handleStatusChange(
    nextStatus: OrganizerEventsStatusFilter,
  ) {
    navigateWithParameters({
      status:
        nextStatus === "ALL"
          ? null
          : nextStatus,
    });

    setMobileFiltersOpen(false);
  }

  function handleSortChange(
    nextSort: OrganizerEventsSort,
  ) {
    navigateWithParameters({
      sort:
        nextSort === "created-desc"
          ? null
          : nextSort,
    });
  }

  function resetFilters() {
    setSearchValue("");
    setMobileFiltersOpen(false);

    startTransition(() => {
      router.push(pathname, {
        scroll: false,
      });
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
      {/* Recherche et actions */}
      <div className="flex flex-col gap-3 border-b border-white/[0.07] p-4 lg:flex-row lg:items-center lg:justify-between">
        <form
          onSubmit={handleSearchSubmit}
          className="relative w-full lg:max-w-[560px]"
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

          <input
            type="search"
            value={searchValue}
            onChange={(event) => {
              setSearchValue(event.target.value);
            }}
            placeholder="Rechercher par titre, catégorie, ville ou lieu..."
            maxLength={120}
            className="h-12 w-full rounded-xl border border-white/[0.09] bg-[#050b0f] pl-11 pr-24 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10"
          />

          {searchValue && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Effacer la recherche"
              className="absolute right-[68px] top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-white/[0.05] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="absolute right-1.5 top-1/2 inline-flex h-9 -translate-y-1/2 items-center justify-center rounded-lg bg-emerald-500/15 px-3 text-xs font-black text-lime-400 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              "Chercher"
            )}
          </button>
        </form>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMobileFiltersOpen(
                (current) => !current,
              );
            }}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-xs font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white lg:hidden"
          >
            <Filter className="h-4 w-4" />
            Filtres

            {hasActiveFilters && (
              <span className="h-2 w-2 rounded-full bg-lime-400" />
            )}
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              disabled={isPending}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-xs font-bold text-neutral-400 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Filtres desktop */}
      <div className="hidden items-center justify-between gap-4 p-4 lg:flex">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {statusOptions.map((option) => {
            const active =
              status === option.value;

            const count =
              statusCounts[option.countKey];

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  handleStatusChange(
                    option.value,
                  );
                }}
                disabled={isPending}
                className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  active
                    ? "border-emerald-500/35 bg-emerald-500/10 text-lime-400"
                    : "border-white/[0.08] bg-white/[0.02] text-neutral-500 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                {active && (
                  <Check className="h-3.5 w-3.5" />
                )}

                {option.label}

                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    active
                      ? "bg-emerald-500/15 text-lime-300"
                      : "bg-white/[0.05] text-neutral-600"
                  }`}
                >
                  {count.toLocaleString("fr-FR")}
                </span>
              </button>
            );
          })}
        </div>

        <SortSelect
          value={sort}
          disabled={isPending}
          onChange={handleSortChange}
        />
      </div>

      {/* Filtres mobile */}
      {mobileFiltersOpen && (
        <div className="border-t border-white/[0.07] p-4 lg:hidden">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-lime-400" />

            <h2 className="text-sm font-black text-white">
              Filtrer les événements
            </h2>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {statusOptions.map((option) => {
              const active =
                status === option.value;

              const count =
                statusCounts[option.countKey];

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    handleStatusChange(
                      option.value,
                    );
                  }}
                  disabled={isPending}
                  className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    active
                      ? "border-emerald-500/35 bg-emerald-500/10 text-lime-400"
                      : "border-white/[0.08] bg-white/[0.02] text-neutral-500"
                  }`}
                >
                  <span>{option.label}</span>

                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      active
                        ? "bg-emerald-500/15 text-lime-300"
                        : "bg-white/[0.05] text-neutral-600"
                    }`}
                  >
                    {count.toLocaleString(
                      "fr-FR",
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <SortSelect
              value={sort}
              disabled={isPending}
              fullWidth
              onChange={handleSortChange}
            />
          </div>
        </div>
      )}

      {isPending && (
        <div className="flex items-center gap-2 border-t border-white/[0.07] bg-emerald-500/[0.025] px-4 py-2.5 text-[11px] text-neutral-500">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin text-lime-400" />
          Mise à jour de la liste...
        </div>
      )}
    </section>
  );
}

type SortSelectProps = {
  value: OrganizerEventsSort;
  disabled?: boolean;
  fullWidth?: boolean;
  onChange: (
    value: OrganizerEventsSort,
  ) => void;
};

function SortSelect({
  value,
  disabled = false,
  fullWidth = false,
  onChange,
}: SortSelectProps) {
  return (
    <label
      className={`relative block ${
        fullWidth
          ? "w-full"
          : "w-[230px] shrink-0"
      }`}
    >
      <span className="sr-only">
        Trier les événements
      </span>

      <SlidersHorizontal className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

      <select
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(
            event.target
              .value as OrganizerEventsSort,
          );
        }}
        className="h-11 w-full appearance-none rounded-xl border border-white/[0.09] bg-[#050b0f] pl-10 pr-10 text-xs font-bold text-neutral-300 outline-none transition focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sortOptions.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>

      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
    </label>
  );
}