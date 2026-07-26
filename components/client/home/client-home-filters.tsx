"use client";

import {
  CalendarDays,
  ChevronDown,
  Filter,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

import type {
  ClientHomeAppliedFilters,
  ClientHomeCategory,
  ClientHomeCityOption,
  ClientHomeEventSort,
} from "@/lib/client/get-client-home-events";

export type ClientHomeFiltersProps = {
  filters: ClientHomeAppliedFilters;
  categories: ClientHomeCategory[];
  cities: ClientHomeCityOption[];

  className?: string;
  searchPlaceholder?: string;
  basePath?: string;
  showAdvancedFilters?: boolean;
};

type FilterChanges = Record<
  string,
  string | number | null | undefined
>;

const SORT_OPTIONS: Array<{
  value: ClientHomeEventSort;
  label: string;
}> = [
  {
    value: "soonest",
    label: "Plus proches",
  },
  {
    value: "latest",
    label: "Plus récents",
  },
  {
    value: "popular",
    label: "Plus populaires",
  },
  {
    value: "price-low",
    label: "Prix croissant",
  },
  {
    value: "price-high",
    label: "Prix décroissant",
  },
];

function cn(
  ...classes: Array<
    string | false | null | undefined
  >
): string {
  return classes
    .filter(Boolean)
    .join(" ");
}

function normalizeText(
  value: string,
): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function normalizeDateInput(
  value: string | null,
): string {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  return date
    .toISOString()
    .slice(0, 10);
}

function createFilterStateKey(
  filters: ClientHomeAppliedFilters,
): string {
  return [
    filters.search,
    filters.category ?? "",
    filters.city ?? "",
    filters.countryCode ?? "",
    filters.dateFrom ?? "",
    filters.dateTo ?? "",
    filters.sort,
  ].join(":");
}

export default function ClientHomeFilters(
  props: ClientHomeFiltersProps,
) {
  return (
    <ClientHomeFiltersContent
      key={createFilterStateKey(
        props.filters,
      )}
      {...props}
    />
  );
}

function ClientHomeFiltersContent({
  filters,
  categories,
  cities,

  className,

  searchPlaceholder =
    "Rechercher un événement, un artiste, un organisateur ou un lieu…",

  basePath,

  showAdvancedFilters = true,
}: ClientHomeFiltersProps) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const searchParams =
    useSearchParams();

  const [
    advancedOpen,
    setAdvancedOpen,
  ] =
    useState(
      Boolean(
        filters.dateFrom ||
          filters.dateTo ||
          filters.countryCode,
      ),
    );

  const [
    searchValue,
    setSearchValue,
  ] =
    useState(
      filters.search,
    );

  const [
    dateFrom,
    setDateFrom,
  ] =
    useState(
      normalizeDateInput(
        filters.dateFrom,
      ),
    );

  const [
    dateTo,
    setDateTo,
  ] =
    useState(
      normalizeDateInput(
        filters.dateTo,
      ),
    );

  const currentPath =
    basePath?.trim() ||
    pathname;

  const activeFiltersCount =
    [
      Boolean(
        filters.search,
      ),
      Boolean(
        filters.category,
      ),
      Boolean(
        filters.city,
      ),
      Boolean(
        filters.countryCode,
      ),
      Boolean(
        filters.dateFrom,
      ),
      Boolean(
        filters.dateTo,
      ),
      filters.sort !==
        "soonest",
    ].filter(Boolean).length;

  const selectedCategory =
    useMemo(
      () =>
        categories.find(
          (
            category,
          ) =>
            category.slug ===
              filters.category ||
            category.id ===
              filters.category,
        ) ??
        null,
      [
        categories,
        filters.category,
      ],
    );

  const selectedCity =
    useMemo(
      () =>
        cities.find(
          (
            city,
          ) =>
            city.city ===
              filters.city &&
            (
              !filters.countryCode ||
              city.countryCode ===
                filters.countryCode
            ),
        ) ??
        null,
      [
        cities,
        filters.city,
        filters.countryCode,
      ],
    );

  function updateQuery(
    changes: FilterChanges,
  ): void {
    const params =
      new URLSearchParams(
        searchParams.toString(),
      );

    for (
      const [
        key,
        value,
      ] of Object.entries(
        changes,
      )
    ) {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        params.delete(
          key,
        );
      } else {
        params.set(
          key,
          String(value),
        );
      }
    }

    params.delete(
      "page",
    );

    const query =
      params.toString();

    router.replace(
      query
        ? `${currentPath}?${query}`
        : currentPath,
      {
        scroll:
          false,
      },
    );
  }

  function submitSearch(): void {
    updateQuery({
      search:
        normalizeText(
          searchValue,
        ) ||
        null,
    });
  }

  function applyCustomDates(): void {
    if (
      dateFrom &&
      dateTo &&
      dateFrom >
        dateTo
    ) {
      return;
    }

    updateQuery({
      dateFrom:
        dateFrom ||
        null,

      dateTo:
        dateTo ||
        null,
    });
  }

  function resetFilters(): void {
    setSearchValue(
      "",
    );

    setDateFrom(
      "",
    );

    setDateTo(
      "",
    );

    router.replace(
      currentPath,
      {
        scroll:
          false,
      },
    );
  }

  return (
    <section
      aria-labelledby="client-home-filters-title"
      className={cn(
        "w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071014]/96 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:rounded-3xl",
        className,
      )}
    >
      {/*
        En-tête visible sur tablette et ordinateur.
        Il est masqué sur mobile pour réduire fortement la hauteur.
      */}
      <div className="hidden border-b border-white/[0.07] px-5 py-4 sm:flex sm:items-center sm:justify-between xl:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-500/20 bg-lime-500/[0.07] text-lime-300">
            <SlidersHorizontal
              aria-hidden="true"
              className="h-4 w-4"
            />
          </span>

          <div className="min-w-0">
            <h2
              id="client-home-filters-title"
              className="truncate text-base font-black text-white sm:text-lg"
            >
              Rechercher et filtrer
            </h2>

            <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-600">
              Trouvez rapidement l’événement qui vous correspond.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeFiltersCount >
            0 && (
            <span className="inline-flex h-8 items-center rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-3 text-[10px] font-black text-emerald-300">
              {activeFiltersCount} filtre
              {activeFiltersCount >
              1
                ? "s"
                : ""}{" "}
              actif
              {activeFiltersCount >
              1
                ? "s"
                : ""}
            </span>
          )}

          {activeFiltersCount >
            0 && (
            <button
              type="button"
              onClick={
                resetFilters
              }
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 text-xs font-bold text-red-400 transition hover:bg-red-500/[0.1] active:scale-95"
            >
              <X
                aria-hidden="true"
                className="h-4 w-4"
              />
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/*
        Barre mobile compacte :
        recherche sur toute la largeur,
        puis deux colonnes pour les filtres.
      */}
      <div className="p-3 sm:hidden">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2
            id="client-home-filters-title-mobile"
            className="text-sm font-black text-white"
          >
            Trouver un événement
          </h2>

          {activeFiltersCount >
            0 && (
            <button
              type="button"
              onClick={
                resetFilters
              }
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-2.5 text-[10px] font-bold text-red-400"
            >
              <X
                aria-hidden="true"
                className="h-3.5 w-3.5"
              />
              Effacer
            </button>
          )}
        </div>

        <form
          role="search"
          onSubmit={(
            event,
          ) => {
            event.preventDefault();
            submitSearch();
          }}
          className="relative min-w-0"
        >
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-neutral-500"
          />

          <input
            value={
              searchValue
            }
            onChange={(
              event,
            ) =>
              setSearchValue(
                event.target.value,
              )
            }
            type="search"
            name="search"
            maxLength={
              120
            }
            autoComplete="off"
            placeholder="Événement, artiste, ville…"
            aria-label="Rechercher un événement"
            className="h-11 w-full rounded-xl border border-white/[0.1] bg-[#03090d] py-2.5 pl-10 pr-11 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-lime-500/35 focus:ring-2 focus:ring-lime-500/10"
          />

          <button
            type="submit"
            aria-label="Lancer la recherche"
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-lime-500/10 text-lime-300 transition active:scale-95"
          >
            <Search
              aria-hidden="true"
              className="h-4 w-4"
            />
          </button>
        </form>

        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <label className="block min-w-0">
            <span className="sr-only">
              Catégorie
            </span>

            <div className="relative">
              <Filter
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
              />

              <select
                value={
                  filters.category ??
                  ""
                }
                onChange={(
                  event,
                ) =>
                  updateQuery({
                    category:
                      event.target
                        .value ||
                      null,
                  })
                }
                className="h-11 w-full appearance-none rounded-xl border border-white/[0.1] bg-[#03090d] pl-9 pr-8 text-[12px] font-semibold text-neutral-300 outline-none transition focus:border-lime-500/35"
              >
                <option value="">
                  Catégories
                </option>

                {categories.map(
                  (
                    category,
                  ) => (
                    <option
                      key={
                        category.id
                      }
                      value={
                        category.slug
                      }
                    >
                      {
                        category.name
                      }
                    </option>
                  ),
                )}
              </select>

              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
              />
            </div>
          </label>

          <label className="block min-w-0">
            <span className="sr-only">
              Ville
            </span>

            <div className="relative">
              <MapPin
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
              />

              <select
                value={
                  selectedCity
                    ? `${selectedCity.city}|${selectedCity.countryCode}`
                    : ""
                }
                onChange={(
                  event,
                ) => {
                  const [
                    city,
                    countryCode,
                  ] =
                    event.target.value.split(
                      "|",
                    );

                  updateQuery({
                    city:
                      city ||
                      null,

                    countryCode:
                      countryCode ||
                      null,
                  });
                }}
                className="h-11 w-full appearance-none rounded-xl border border-white/[0.1] bg-[#03090d] pl-9 pr-8 text-[12px] font-semibold text-neutral-300 outline-none transition focus:border-lime-500/35"
              >
                <option value="">
                  Villes
                </option>

                {cities.map(
                  (
                    city,
                  ) => (
                    <option
                      key={`${city.city}-${city.countryCode}`}
                      value={`${city.city}|${city.countryCode}`}
                    >
                      {
                        city.city
                      }
                    </option>
                  ),
                )}
              </select>

              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
              />
            </div>
          </label>

          <label className="block min-w-0">
            <span className="sr-only">
              Trier les événements
            </span>

            <div className="relative">
              <CalendarDays
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
              />

              <select
                value={
                  filters.sort
                }
                onChange={(
                  event,
                ) =>
                  updateQuery({
                    sort:
                      event.target
                        .value,
                  })
                }
                className="h-11 w-full appearance-none rounded-xl border border-white/[0.1] bg-[#03090d] pl-9 pr-8 text-[12px] font-semibold text-neutral-300 outline-none transition focus:border-lime-500/35"
              >
                {SORT_OPTIONS.map(
                  (
                    option,
                  ) => (
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

              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
              />
            </div>
          </label>

          {showAdvancedFilters ? (
            <button
              type="button"
              onClick={() =>
                setAdvancedOpen(
                  (
                    current,
                  ) =>
                    !current,
                )
              }
              aria-expanded={
                advancedOpen
              }
              className={cn(
                "inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-[12px] font-black transition active:scale-[0.99]",
                advancedOpen
                  ? "border-orange-500/30 bg-orange-500/[0.09] text-orange-300"
                  : "border-white/[0.1] bg-white/[0.025] text-neutral-300",
              )}
            >
              <SlidersHorizontal
                aria-hidden="true"
                className="h-4 w-4"
              />
              Filtres
              {activeFiltersCount >
                0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-lime-500/15 px-1.5 text-[9px] text-lime-300">
                  {
                    activeFiltersCount
                  }
                </span>
              )}
            </button>
          ) : (
            <div />
          )}
        </div>
      </div>

      {/*
        Version tablette et ordinateur.
      */}
      <div className="hidden gap-3 px-5 py-4 sm:grid md:grid-cols-2 xl:grid-cols-[minmax(300px,1.55fr)_minmax(180px,0.8fr)_minmax(180px,0.8fr)_minmax(160px,0.7fr)_auto] xl:px-6">
        <form
          role="search"
          onSubmit={(
            event,
          ) => {
            event.preventDefault();
            submitSearch();
          }}
          className="relative min-w-0 md:col-span-2 xl:col-span-1"
        >
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500"
          />

          <input
            value={
              searchValue
            }
            onChange={(
              event,
            ) =>
              setSearchValue(
                event.target.value,
              )
            }
            type="search"
            name="search"
            maxLength={
              120
            }
            autoComplete="off"
            placeholder={
              searchPlaceholder
            }
            aria-label="Rechercher un événement"
            className="h-12 w-full rounded-xl border border-white/[0.1] bg-[#03090d] py-3 pl-12 pr-12 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-lime-500/35 focus:ring-2 focus:ring-lime-500/10"
          />

          <button
            type="submit"
            aria-label="Lancer la recherche"
            className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-lime-500/10 text-lime-300 transition hover:bg-lime-500/20 active:scale-95"
          >
            <Search
              aria-hidden="true"
              className="h-4 w-4"
            />
          </button>
        </form>

        <label className="block min-w-0">
          <span className="sr-only">
            Catégorie
          </span>

          <div className="relative">
            <Filter
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
            />

            <select
              value={
                filters.category ??
                ""
              }
              onChange={(
                event,
              ) =>
                updateQuery({
                  category:
                    event.target
                      .value ||
                    null,
                })
              }
              className="h-12 w-full appearance-none rounded-xl border border-white/[0.1] bg-[#03090d] pl-10 pr-10 text-sm font-semibold text-neutral-300 outline-none transition focus:border-lime-500/35 focus:ring-2 focus:ring-lime-500/10"
            >
              <option value="">
                Toutes les catégories
              </option>

              {categories.map(
                (
                  category,
                ) => (
                  <option
                    key={
                      category.id
                    }
                    value={
                      category.slug
                    }
                  >
                    {
                      category.name
                    }{" "}
                    (
                    {
                      category.eventCount
                    }
                    )
                  </option>
                ),
              )}
            </select>

            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
            />
          </div>
        </label>

        <label className="block min-w-0">
          <span className="sr-only">
            Ville
          </span>

          <div className="relative">
            <MapPin
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
            />

            <select
              value={
                selectedCity
                  ? `${selectedCity.city}|${selectedCity.countryCode}`
                  : ""
              }
              onChange={(
                event,
              ) => {
                const [
                  city,
                  countryCode,
                ] =
                  event.target.value.split(
                    "|",
                  );

                updateQuery({
                  city:
                    city ||
                    null,

                  countryCode:
                    countryCode ||
                    null,
                });
              }}
              className="h-12 w-full appearance-none rounded-xl border border-white/[0.1] bg-[#03090d] pl-10 pr-10 text-sm font-semibold text-neutral-300 outline-none transition focus:border-lime-500/35 focus:ring-2 focus:ring-lime-500/10"
            >
              <option value="">
                Toutes les villes
              </option>

              {cities.map(
                (
                  city,
                ) => (
                  <option
                    key={`${city.city}-${city.countryCode}`}
                    value={`${city.city}|${city.countryCode}`}
                  >
                    {
                      city.city
                    }{" "}
                    ·{" "}
                    {
                      city.country
                    }{" "}
                    (
                    {
                      city.eventCount
                    }
                    )
                  </option>
                ),
              )}
            </select>

            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
            />
          </div>
        </label>

        <label className="block min-w-0">
          <span className="sr-only">
            Trier les événements
          </span>

          <div className="relative">
            <CalendarDays
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
            />

            <select
              value={
                filters.sort
              }
              onChange={(
                event,
              ) =>
                updateQuery({
                  sort:
                    event.target
                      .value,
                })
              }
              className="h-12 w-full appearance-none rounded-xl border border-white/[0.1] bg-[#03090d] pl-10 pr-10 text-sm font-semibold text-neutral-300 outline-none transition focus:border-lime-500/35 focus:ring-2 focus:ring-lime-500/10"
            >
              {SORT_OPTIONS.map(
                (
                  option,
                ) => (
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

            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600"
            />
          </div>
        </label>

        {showAdvancedFilters && (
          <button
            type="button"
            onClick={() =>
              setAdvancedOpen(
                (
                  current,
                ) =>
                  !current,
              )
            }
            aria-expanded={
              advancedOpen
            }
            className={cn(
              "inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition active:scale-[0.99]",
              advancedOpen
                ? "border-orange-500/30 bg-orange-500/[0.09] text-orange-300"
                : "border-white/[0.1] bg-white/[0.025] text-neutral-300 hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-white",
            )}
          >
            <SlidersHorizontal
              aria-hidden="true"
              className="h-4 w-4"
            />
            Filtres
          </button>
        )}
      </div>

      {advancedOpen &&
        showAdvancedFilters && (
        <div className="border-t border-white/[0.07] bg-[#050c10] px-3 py-3 sm:px-5 sm:py-4 xl:px-6">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-[minmax(180px,0.8fr)_minmax(180px,0.8fr)_auto_minmax(0,1fr)]">
            <label className="block min-w-0">
              <span className="mb-1.5 block text-[11px] font-semibold text-neutral-600 sm:mb-2 sm:text-xs">
                Date de début
              </span>

              <input
                type="date"
                value={
                  dateFrom
                }
                onChange={(
                  event,
                ) =>
                  setDateFrom(
                    event.target
                      .value,
                  )
                }
                className="h-10 w-full rounded-xl border border-white/[0.09] bg-[#03090d] px-3 text-sm text-neutral-300 outline-none [color-scheme:dark] focus:border-lime-500/35 focus:ring-2 focus:ring-lime-500/10 sm:h-11"
              />
            </label>

            <label className="block min-w-0">
              <span className="mb-1.5 block text-[11px] font-semibold text-neutral-600 sm:mb-2 sm:text-xs">
                Date de fin
              </span>

              <input
                type="date"
                value={
                  dateTo
                }
                min={
                  dateFrom ||
                  undefined
                }
                onChange={(
                  event,
                ) =>
                  setDateTo(
                    event.target
                      .value,
                  )
                }
                className="h-10 w-full rounded-xl border border-white/[0.09] bg-[#03090d] px-3 text-sm text-neutral-300 outline-none [color-scheme:dark] focus:border-lime-500/35 focus:ring-2 focus:ring-lime-500/10 sm:h-11"
              />
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={
                  applyCustomDates
                }
                disabled={
                  Boolean(
                    dateFrom &&
                      dateTo &&
                      dateFrom >
                        dateTo,
                  )
                }
                className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-lime-500/25 bg-lime-500/[0.08] px-4 text-sm font-black text-lime-300 transition hover:bg-lime-500/[0.13] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 sm:h-11 md:w-auto"
              >
                Appliquer
              </button>
            </div>

            <div className="hidden items-end md:flex">
              <div className="w-full rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-700">
                  Sélection actuelle
                </p>

                <p className="mt-1 truncate text-sm font-bold text-white">
                  {selectedCategory
                    ?.name ??
                    "Toutes les catégories"}
                </p>

                <p className="mt-1 truncate text-xs text-neutral-600">
                  {selectedCity
                    ? `${selectedCity.city}, ${selectedCity.country}`
                    : "Toutes les villes"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/*
        Les raccourcis de catégories restent disponibles sur tablette
        et ordinateur. Ils sont masqués sur mobile pour éviter une section
        trop haute et répétitive.
      */}
      <div className="hidden min-w-0 gap-2 overflow-x-auto border-t border-white/[0.07] px-5 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex xl:px-6">
        <button
          type="button"
          onClick={() =>
            updateQuery({
              category:
                null,
            })
          }
          className={cn(
            "shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition active:scale-95",
            !filters.category
              ? "border-lime-500/25 bg-lime-500/[0.09] text-lime-300"
              : "border-white/[0.08] bg-white/[0.025] text-neutral-500 hover:text-white",
          )}
        >
          Tous
        </button>

        {categories
          .slice(
            0,
            10,
          )
          .map(
            (
              category,
            ) => {
              const active =
                filters.category ===
                  category.slug ||
                filters.category ===
                  category.id;

              return (
                <button
                  key={
                    category.id
                  }
                  type="button"
                  onClick={() =>
                    updateQuery({
                      category:
                        category.slug,
                    })
                  }
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition active:scale-95",
                    active
                      ? "border-lime-500/25 bg-lime-500/[0.09] text-lime-300"
                      : "border-white/[0.08] bg-white/[0.025] text-neutral-500 hover:border-white/[0.14] hover:text-white",
                  )}
                >
                  {
                    category.name
                  }{" "}
                  <span className="text-[10px] text-neutral-700">
                    {
                      category.eventCount
                    }
                  </span>
                </button>
              );
            },
          )}
      </div>
    </section>
  );
}