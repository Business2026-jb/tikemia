"use client";

import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleX,
  Filter,
  ListFilter,
  MapPin,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  TicketCheck,
  UserRoundCheck,
  X,
} from "lucide-react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  OrganizerParticipantCountryOption,
  OrganizerParticipantEventOption,
  OrganizerParticipantTicketTypeOption,
  OrganizerParticipantsAppliedFilters,
  OrganizerParticipantsSort,
} from "@/lib/organizer/get-organizer-participants";

type ParticipantsToolbarProps = {
  events: OrganizerParticipantEventOption[];
  ticketTypes: OrganizerParticipantTicketTypeOption[];
  countries: OrganizerParticipantCountryOption[];
  appliedFilters: OrganizerParticipantsAppliedFilters;
  totalItems: number;
};

type SelectOption = {
  value: string;
  label: string;
};

const STATUS_OPTIONS: SelectOption[] = [
  {
    value: "",
    label: "Tous les statuts",
  },
  {
    value: "VALID",
    label: "Billets valides",
  },
  {
    value: "USED",
    label: "Billets utilisés",
  },
  {
    value: "CANCELLED",
    label: "Billets annulés",
  },
  {
    value: "REFUNDED",
    label: "Billets remboursés",
  },
];

const ATTENDANCE_OPTIONS: SelectOption[] = [
  {
    value: "",
    label: "Toutes les présences",
  },
  {
    value: "CHECKED_IN",
    label: "Déjà présents",
  },
  {
    value: "NOT_CHECKED_IN",
    label: "Pas encore présents",
  },
];

const SORT_OPTIONS: Array<{
  value: OrganizerParticipantsSort;
  label: string;
}> = [
  {
    value: "NEWEST",
    label: "Ajoutés récemment",
  },
  {
    value: "OLDEST",
    label: "Ajoutés anciennement",
  },
  {
    value: "NAME_ASC",
    label: "Nom A à Z",
  },
  {
    value: "NAME_DESC",
    label: "Nom Z à A",
  },
  {
    value: "EVENT_DATE_ASC",
    label: "Événements les plus proches",
  },
  {
    value: "EVENT_DATE_DESC",
    label: "Événements les plus éloignés",
  },
  {
    value: "CHECKED_IN_FIRST",
    label: "Présents en premier",
  },
];

function normalizeSearchValue(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function getDateInputValue(
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

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(value);
}

function getStatusLabel(
  status: string | null,
): string {
  switch (status) {
    case "VALID":
      return "Billets valides";

    case "USED":
      return "Billets utilisés";

    case "CANCELLED":
      return "Billets annulés";

    case "REFUNDED":
      return "Billets remboursés";

    default:
      return "Tous les statuts";
  }
}

function getAttendanceLabel(
  attendance: string | null,
): string {
  switch (attendance) {
    case "CHECKED_IN":
      return "Déjà présents";

    case "NOT_CHECKED_IN":
      return "Pas encore présents";

    default:
      return "Toutes les présences";
  }
}

function getSortLabel(
  sort: OrganizerParticipantsSort,
): string {
  return (
    SORT_OPTIONS.find(
      (option) => option.value === sort,
    )?.label ?? "Ajoutés récemment"
  );
}

export default function ParticipantsToolbar({
  events,
  ticketTypes,
  countries,
  appliedFilters,
  totalItems,
}: ParticipantsToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(
    appliedFilters.search,
  );

  const [filtersOpen, setFiltersOpen] =
    useState(false);

  const activeEvent = useMemo(
    () =>
      events.find(
        (event) =>
          event.id === appliedFilters.eventId,
      ) ?? null,
    [
      appliedFilters.eventId,
      events,
    ],
  );

  const activeTicketType = useMemo(
    () =>
      ticketTypes.find(
        (ticketType) =>
          ticketType.id ===
          appliedFilters.ticketTypeId,
      ) ?? null,
    [
      appliedFilters.ticketTypeId,
      ticketTypes,
    ],
  );

  const filteredTicketTypes = useMemo(() => {
    if (!appliedFilters.eventId) {
      return ticketTypes;
    }

    return ticketTypes.filter(
      (ticketType) =>
        ticketType.eventId ===
        appliedFilters.eventId,
    );
  }, [
    appliedFilters.eventId,
    ticketTypes,
  ]);

  const hasActiveFilters = Boolean(
    appliedFilters.search ||
      appliedFilters.eventId ||
      appliedFilters.ticketTypeId ||
      appliedFilters.status ||
      appliedFilters.attendance ||
      appliedFilters.country ||
      appliedFilters.dateFrom ||
      appliedFilters.dateTo ||
      appliedFilters.sort !== "NEWEST",
  );

  const activeFiltersCount = [
    Boolean(appliedFilters.eventId),
    Boolean(appliedFilters.ticketTypeId),
    Boolean(appliedFilters.status),
    Boolean(appliedFilters.attendance),
    Boolean(appliedFilters.country),
    Boolean(appliedFilters.dateFrom),
    Boolean(appliedFilters.dateTo),
    appliedFilters.sort !== "NEWEST",
  ].filter(Boolean).length;

  function updateQuery(
    changes: Record<
      string,
      string | null | undefined
    >,
  ) {
    const params = new URLSearchParams(
      searchParams.toString(),
    );

    for (
      const [key, value] of
      Object.entries(changes)
    ) {
      const normalized =
        normalizeSearchValue(value);

      if (normalized) {
        params.set(key, normalized);
      } else {
        params.delete(key);
      }
    }

    params.delete("page");

    const query = params.toString();

    router.replace(
      query
        ? `${pathname}?${query}`
        : pathname,
      {
        scroll: false,
      },
    );
  }

  function handleEventChange(
    eventId: string,
  ) {
    updateQuery({
      eventId,
      ticketTypeId: null,
    });
  }

  function handleResetFilters() {
    setSearch("");

    router.replace(pathname, {
      scroll: false,
    });

    setFiltersOpen(false);
  }

  useEffect(() => {
    setSearch(appliedFilters.search);
  }, [appliedFilters.search]);

  useEffect(() => {
    const normalizedSearch =
      search.trim();

    if (
      normalizedSearch ===
      appliedFilters.search
    ) {
      return;
    }

    const timeout = window.setTimeout(
      () => {
        updateQuery({
          search: normalizedSearch,
        });
      },
      450,
    );

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    search,
    appliedFilters.search,
  ]);

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014]">
      <div className="border-b border-white/[0.07] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-black text-white sm:text-lg">
                Liste des participants
              </h2>

              <span className="inline-flex h-7 items-center rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-2.5 text-xs font-bold text-emerald-300">
                {formatNumber(totalItems)}
              </span>
            </div>

            <p className="mt-1 text-xs leading-5 text-neutral-500 sm:text-sm">
              Recherchez, filtrez et contrôlez les
              participants de vos événements.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() =>
                router.refresh()
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-sm font-semibold text-neutral-300 transition hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-white"
            >
              <RefreshCcw className="h-4 w-4" />
              Actualiser
            </button>

            <button
              type="button"
              onClick={() =>
                setFiltersOpen(
                  (current) => !current,
                )
              }
              aria-expanded={filtersOpen}
              className={`relative inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition ${
                filtersOpen ||
                activeFiltersCount > 0
                  ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                  : "border-white/[0.09] bg-white/[0.025] text-neutral-300 hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtres

              {activeFiltersCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-400 px-1 text-[10px] font-black text-[#041007]">
                  {activeFiltersCount}
                </span>
              )}

              <ChevronDown
                className={`h-4 w-4 transition ${
                  filtersOpen
                    ? "rotate-180"
                    : ""
                }`}
              />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-neutral-600" />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Nom, e-mail, téléphone, code billet, commande ou événement..."
              className="h-12 w-full rounded-xl border border-white/[0.09] bg-[#040b0f] pl-11 pr-11 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-emerald-500/45 focus:ring-2 focus:ring-emerald-500/10"
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
                aria-label="Effacer la recherche"
                className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="relative min-w-0 lg:w-[250px]">
            <ListFilter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

            <select
              value={appliedFilters.sort}
              onChange={(event) =>
                updateQuery({
                  sort:
                    event.target.value,
                })
              }
              aria-label="Trier les participants"
              className="h-12 w-full appearance-none rounded-xl border border-white/[0.09] bg-[#040b0f] pl-10 pr-10 text-sm font-medium text-neutral-300 outline-none transition focus:border-emerald-500/45 focus:ring-2 focus:ring-emerald-500/10"
            >
              {SORT_OPTIONS.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ),
              )}
            </select>

            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
          </div>
        </div>
      </div>

      {filtersOpen && (
        <div className="border-b border-white/[0.07] bg-[#050c10] px-4 py-5 sm:px-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-emerald-400" />

              <p className="text-sm font-bold text-white">
                Filtres avancés
              </p>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold text-neutral-400 transition hover:bg-red-500/10 hover:text-red-400"
              >
                <CircleX className="h-4 w-4" />
                Réinitialiser
              </button>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FilterSelect
              label="Événement"
              icon={CalendarDays}
              value={
                appliedFilters.eventId ??
                ""
              }
              onChange={
                handleEventChange
              }
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
            />

            <FilterSelect
              label="Type de billet"
              icon={TicketCheck}
              value={
                appliedFilters.ticketTypeId ??
                ""
              }
              onChange={(value) =>
                updateQuery({
                  ticketTypeId:
                    value,
                })
              }
              disabled={
                filteredTicketTypes.length ===
                0
              }
              options={[
                {
                  value: "",
                  label:
                    "Tous les types",
                },
                ...filteredTicketTypes.map(
                  (ticketType) => ({
                    value:
                      ticketType.id,
                    label:
                      appliedFilters.eventId
                        ? ticketType.name
                        : `${ticketType.name} — ${ticketType.eventTitle}`,
                  }),
                ),
              ]}
            />

            <FilterSelect
              label="Statut du billet"
              icon={CheckCircle2}
              value={
                appliedFilters.status ??
                ""
              }
              onChange={(value) =>
                updateQuery({
                  status: value,
                })
              }
              options={STATUS_OPTIONS}
            />

            <FilterSelect
              label="Présence"
              icon={UserRoundCheck}
              value={
                appliedFilters.attendance ??
                ""
              }
              onChange={(value) =>
                updateQuery({
                  attendance:
                    value,
                })
              }
              options={
                ATTENDANCE_OPTIONS
              }
            />

            <FilterSelect
              label="Pays"
              icon={MapPin}
              value={
                appliedFilters.country ??
                ""
              }
              onChange={(value) =>
                updateQuery({
                  country: value,
                })
              }
              options={[
                {
                  value: "",
                  label:
                    "Tous les pays",
                },
                ...countries.map(
                  (country) => ({
                    value:
                      country.name,
                    label:
                      country.code
                        ? `${country.name} (${country.code})`
                        : country.name,
                  }),
                ),
              ]}
            />

            <DateFilter
              label="Acheté à partir du"
              value={getDateInputValue(
                appliedFilters.dateFrom,
              )}
              onChange={(value) =>
                updateQuery({
                  dateFrom: value,
                })
              }
            />

            <DateFilter
              label="Acheté jusqu’au"
              value={getDateInputValue(
                appliedFilters.dateTo,
              )}
              onChange={(value) =>
                updateQuery({
                  dateTo: value,
                })
              }
            />

            <div className="flex items-end">
              <button
                type="button"
                onClick={() =>
                  setFiltersOpen(false)
                }
                className="flex h-11 w-full items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/15"
              >
                Afficher les résultats
              </button>
            </div>
          </div>
        </div>
      )}

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
          <span className="mr-1 text-xs font-semibold text-neutral-600">
            Filtres actifs :
          </span>

          {appliedFilters.search && (
            <ActiveFilter
              label={`Recherche : ${appliedFilters.search}`}
              onRemove={() => {
                setSearch("");

                updateQuery({
                  search: null,
                });
              }}
            />
          )}

          {activeEvent && (
            <ActiveFilter
              label={activeEvent.title}
              onRemove={() =>
                updateQuery({
                  eventId: null,
                  ticketTypeId: null,
                })
              }
            />
          )}

          {activeTicketType && (
            <ActiveFilter
              label={
                activeTicketType.name
              }
              onRemove={() =>
                updateQuery({
                  ticketTypeId: null,
                })
              }
            />
          )}

          {appliedFilters.status && (
            <ActiveFilter
              label={getStatusLabel(
                appliedFilters.status,
              )}
              onRemove={() =>
                updateQuery({
                  status: null,
                })
              }
            />
          )}

          {appliedFilters.attendance && (
            <ActiveFilter
              label={getAttendanceLabel(
                appliedFilters.attendance,
              )}
              onRemove={() =>
                updateQuery({
                  attendance: null,
                })
              }
            />
          )}

          {appliedFilters.country && (
            <ActiveFilter
              label={
                appliedFilters.country
              }
              onRemove={() =>
                updateQuery({
                  country: null,
                })
              }
            />
          )}

          {appliedFilters.dateFrom && (
            <ActiveFilter
              label={`Depuis le ${getDateInputValue(
                appliedFilters.dateFrom,
              )}`}
              onRemove={() =>
                updateQuery({
                  dateFrom: null,
                })
              }
            />
          )}

          {appliedFilters.dateTo && (
            <ActiveFilter
              label={`Jusqu’au ${getDateInputValue(
                appliedFilters.dateTo,
              )}`}
              onRemove={() =>
                updateQuery({
                  dateTo: null,
                })
              }
            />
          )}

          {appliedFilters.sort !==
            "NEWEST" && (
            <ActiveFilter
              label={getSortLabel(
                appliedFilters.sort,
              )}
              onRemove={() =>
                updateQuery({
                  sort: "NEWEST",
                })
              }
            />
          )}

          <button
            type="button"
            onClick={handleResetFilters}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-neutral-500 transition hover:bg-red-500/10 hover:text-red-400"
          >
            <X className="h-3.5 w-3.5" />
            Tout effacer
          </button>
        </div>
      )}
    </section>
  );
}

type FilterSelectProps = {
  label: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

function FilterSelect({
  label,
  icon: Icon,
  value,
  options,
  onChange,
  disabled = false,
}: FilterSelectProps) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-xs font-semibold text-neutral-500">
        {label}
      </span>

      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

        <select
          value={value}
          disabled={disabled}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="h-11 w-full appearance-none rounded-xl border border-white/[0.09] bg-[#03090d] pl-10 pr-9 text-sm text-neutral-300 outline-none transition disabled:cursor-not-allowed disabled:opacity-50 focus:border-emerald-500/45 focus:ring-2 focus:ring-emerald-500/10"
        >
          {options.map((option) => (
            <option
              key={`${option.value}-${option.label}`}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>

        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
      </div>
    </label>
  );
}

type DateFilterProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function DateFilter({
  label,
  value,
  onChange,
}: DateFilterProps) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-xs font-semibold text-neutral-500">
        {label}
      </span>

      <div className="relative">
        <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

        <input
          type="date"
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="h-11 w-full rounded-xl border border-white/[0.09] bg-[#03090d] pl-10 pr-3 text-sm text-neutral-300 outline-none transition [color-scheme:dark] focus:border-emerald-500/45 focus:ring-2 focus:ring-emerald-500/10"
        />
      </div>
    </label>
  );
}

type ActiveFilterProps = {
  label: string;
  onRemove: () => void;
};

function ActiveFilter({
  label,
  onRemove,
}: ActiveFilterProps) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] py-1 pl-2.5 pr-1.5 text-xs font-semibold text-emerald-300">
      <span className="max-w-[220px] truncate">
        {label}
      </span>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Supprimer le filtre ${label}`}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-emerald-400 transition hover:bg-emerald-500/20 hover:text-white"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}