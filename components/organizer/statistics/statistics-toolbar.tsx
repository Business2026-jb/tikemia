"use client";

import {
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  RefreshCcw,
  SlidersHorizontal,
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
  OrganizerStatisticsData,
  OrganizerStatisticsPeriod,
  StatisticsCurrencyOption,
} from "@/lib/organizer/get-organizer-statistics";

type StatisticsToolbarProps = {
  period: OrganizerStatisticsData["period"];
  filters: OrganizerStatisticsData["filters"];
  events: OrganizerStatisticsData["events"];
  currencyOptions: StatisticsCurrencyOption[];
  exportBaseUrl?: string;
};

type ExportFormat = "csv" | "xlsx" | "pdf";

const PERIOD_OPTIONS: Array<{
  value: OrganizerStatisticsPeriod;
  label: string;
}> = [
  {
    value: 7,
    label: "7 derniers jours",
  },
  {
    value: 30,
    label: "30 derniers jours",
  },
  {
    value: 90,
    label: "90 derniers jours",
  },
  {
    value: 180,
    label: "6 derniers mois",
  },
  {
    value: 365,
    label: "12 derniers mois",
  },
];

function normalizeDateInput(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function formatPeriodLabel({
  start,
  end,
}: {
  start: string;
  end: string;
}): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    return "Période actuelle";
  }

  const formatter = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return `${formatter.format(startDate)} — ${formatter.format(endDate)}`;
}

function createExportUrl({
  baseUrl,
  format,
  searchParams,
}: {
  baseUrl: string;
  format: ExportFormat;
  searchParams: URLSearchParams;
}): string {
  const params = new URLSearchParams(searchParams.toString());

  params.set("format", format);

  return `${baseUrl}?${params.toString()}`;
}

export default function StatisticsToolbar({
  period,
  filters,
  events,
  currencyOptions,
  exportBaseUrl = "/api/organizer/statistics/export",
}: StatisticsToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [customDatesOpen, setCustomDatesOpen] = useState(
    period.custom,
  );
  const [dateFrom, setDateFrom] = useState(
    normalizeDateInput(period.start),
  );
  const [dateTo, setDateTo] = useState(
    normalizeDateInput(period.end),
  );

  const selectedEvent = useMemo(
    () =>
      events.find(
        (event) => event.id === filters.eventId,
      ) ?? null,
    [events, filters.eventId],
  );

  const selectedCurrency = useMemo(
    () =>
      currencyOptions.find(
        (currency) => currency.code === filters.currency,
      ) ?? null,
    [currencyOptions, filters.currency],
  );

  const hasActiveFilters = Boolean(
    filters.eventId ||
      filters.currency !== currencyOptions[0]?.code ||
      period.custom ||
      period.days !== 30,
  );

  const activeFiltersCount = [
    Boolean(filters.eventId),
    filters.currency !== currencyOptions[0]?.code,
    period.custom,
    !period.custom && period.days !== 30,
  ].filter(Boolean).length;

  function updateQuery(
    changes: Record<
      string,
      string | number | null | undefined
    >,
  ): void {
    const params = new URLSearchParams(
      searchParams.toString(),
    );

    for (const [key, value] of Object.entries(changes)) {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    }

    const query = params.toString();

    router.replace(
      query ? `${pathname}?${query}` : pathname,
      {
        scroll: false,
      },
    );
  }

  function applyPresetPeriod(
    value: OrganizerStatisticsPeriod,
  ): void {
    setCustomDatesOpen(false);

    updateQuery({
      periodDays: value,
      dateFrom: null,
      dateTo: null,
    });
  }

  function applyCustomPeriod(): void {
    if (!dateFrom || !dateTo) {
      return;
    }

    updateQuery({
      dateFrom,
      dateTo,
      periodDays: null,
    });

    setCustomDatesOpen(true);
  }

  function resetFilters(): void {
    setCustomDatesOpen(false);
    setDateFrom("");
    setDateTo("");

    router.replace(pathname, {
      scroll: false,
    });
  }

  useEffect(() => {
    setDateFrom(normalizeDateInput(period.start));
    setDateTo(normalizeDateInput(period.end));
    setCustomDatesOpen(period.custom);
  }, [period.end, period.start, period.custom]);

  const periodLabel = formatPeriodLabel({
    start: period.start,
    end: period.end,
  });

  return (
    <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014]">
      <div className="flex w-full min-w-0 flex-col gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between xl:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-black text-white sm:text-lg">
              Filtres statistiques
            </h2>

            <span className="inline-flex h-7 items-center rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-2.5 text-[11px] font-bold text-emerald-300">
              {periodLabel}
            </span>
          </div>

          <p className="mt-1 text-xs leading-5 text-neutral-500 sm:text-sm">
            Ajustez la période, l’événement et la devise sans quitter la page.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:justify-end">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-sm font-semibold text-neutral-300 transition hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-white lg:flex-none"
          >
            <RefreshCcw className="h-4 w-4" />
            Actualiser
          </button>

          <button
            type="button"
            onClick={() =>
              setFiltersOpen((current) => !current)
            }
            aria-expanded={filtersOpen}
            className={`inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition lg:flex-none ${
              filtersOpen || activeFiltersCount > 0
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
                filtersOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      <div className="grid w-full min-w-0 gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-[minmax(190px,0.9fr)_minmax(220px,1.15fr)_minmax(190px,0.8fr)_auto] xl:px-6">
        <label className="block min-w-0">
          <span className="mb-2 block text-xs font-semibold text-neutral-500">
            Période
          </span>

          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

            <select
              value={
                period.custom
                  ? "CUSTOM"
                  : String(period.days)
              }
              onChange={(event) => {
                const value = event.target.value;

                if (value === "CUSTOM") {
                  setCustomDatesOpen(true);
                  setFiltersOpen(true);
                  return;
                }

                applyPresetPeriod(
                  Number(value) as OrganizerStatisticsPeriod,
                );
              }}
              className="h-11 w-full appearance-none rounded-xl border border-white/[0.09] bg-[#03090d] pl-10 pr-9 text-sm font-medium text-neutral-300 outline-none transition focus:border-emerald-500/45 focus:ring-2 focus:ring-emerald-500/10"
            >
              {PERIOD_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}

              <option value="CUSTOM">
                Période personnalisée
              </option>
            </select>

            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
          </div>
        </label>

        <label className="block min-w-0">
          <span className="mb-2 block text-xs font-semibold text-neutral-500">
            Événement
          </span>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

            <select
              value={filters.eventId ?? ""}
              onChange={(event) =>
                updateQuery({
                  eventId: event.target.value,
                })
              }
              className="h-11 w-full appearance-none rounded-xl border border-white/[0.09] bg-[#03090d] pl-10 pr-9 text-sm font-medium text-neutral-300 outline-none transition focus:border-emerald-500/45 focus:ring-2 focus:ring-emerald-500/10"
            >
              <option value="">
                Tous les événements
              </option>

              {events.map((event) => (
                <option
                  key={event.id}
                  value={event.id}
                >
                  {event.title}
                </option>
              ))}
            </select>

            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
          </div>
        </label>

        <label className="block min-w-0">
          <span className="mb-2 block text-xs font-semibold text-neutral-500">
            Devise
          </span>

          <div className="relative">
            <CircleDollarSign className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

            <select
              value={filters.currency}
              onChange={(event) =>
                updateQuery({
                  currency: event.target.value,
                })
              }
              className="h-11 w-full appearance-none rounded-xl border border-white/[0.09] bg-[#03090d] pl-10 pr-9 text-sm font-medium text-neutral-300 outline-none transition focus:border-emerald-500/45 focus:ring-2 focus:ring-emerald-500/10"
            >
              {currencyOptions.map((currency) => (
                <option
                  key={currency.code}
                  value={currency.code}
                >
                  {currency.code} — {currency.name}
                </option>
              ))}
            </select>

            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
          </div>
        </label>

        <div className="flex min-w-0 items-end">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/15 xl:w-auto"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Options avancées
          </button>
        </div>
      </div>

      {filtersOpen && (
        <div className="w-full min-w-0 border-t border-white/[0.07] bg-[#050c10] px-4 py-5 sm:px-5 xl:px-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-white">
                  Paramètres avancés
                </p>

                <p className="mt-1 text-xs text-neutral-500">
                  Définissez une période personnalisée ou réinitialisez les filtres.
                </p>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold text-neutral-400 transition hover:bg-red-500/10 hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                  Tout réinitialiser
                </button>
              )}
            </div>

            <div className="grid w-full min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(180px,0.8fr)_minmax(180px,0.8fr)_auto_minmax(0,1fr)]">
              <label className="block min-w-0">
                <span className="mb-2 block text-xs font-semibold text-neutral-500">
                  Date de début
                </span>

                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) =>
                    setDateFrom(event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-white/[0.09] bg-[#03090d] px-3 text-sm text-neutral-300 outline-none transition [color-scheme:dark] focus:border-emerald-500/45 focus:ring-2 focus:ring-emerald-500/10"
                />
              </label>

              <label className="block min-w-0">
                <span className="mb-2 block text-xs font-semibold text-neutral-500">
                  Date de fin
                </span>

                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(event) =>
                    setDateTo(event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-white/[0.09] bg-[#03090d] px-3 text-sm text-neutral-300 outline-none transition [color-scheme:dark] focus:border-emerald-500/45 focus:ring-2 focus:ring-emerald-500/10"
                />
              </label>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={applyCustomPeriod}
                  disabled={
                    !dateFrom ||
                    !dateTo ||
                    dateFrom > dateTo
                  }
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Check className="h-4 w-4" />
                  Appliquer
                </button>
              </div>

              <div className="flex min-w-0 items-end">
                <div className="w-full rounded-xl border border-white/[0.07] bg-white/[0.018] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-600">
                    Sélection actuelle
                  </p>

                  <p className="mt-1 truncate text-sm font-bold text-white">
                    {selectedEvent?.title ??
                      "Tous les événements"}
                  </p>

                  <p className="mt-1 text-xs text-neutral-500">
                    {selectedCurrency
                      ? `${selectedCurrency.code} — ${selectedCurrency.name}`
                      : filters.currency}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex w-full min-w-0 flex-col gap-3 border-t border-white/[0.07] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between xl:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-neutral-600">
            Filtres actifs :
          </span>

          <span className="inline-flex max-w-full items-center rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-xs font-semibold text-neutral-300">
            {periodLabel}
          </span>

          {selectedEvent && (
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/[0.07] py-1 pl-2.5 pr-1.5 text-xs font-semibold text-sky-300">
              <span className="max-w-[220px] truncate">
                {selectedEvent.title}
              </span>

              <button
                type="button"
                onClick={() =>
                  updateQuery({
                    eventId: null,
                  })
                }
                aria-label="Retirer le filtre événement"
                className="flex h-5 w-5 items-center justify-center rounded-full transition hover:bg-sky-500/20 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {selectedCurrency && (
            <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-1 text-xs font-semibold text-emerald-300">
              {selectedCurrency.code}
            </span>
          )}
        </div>

        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 lg:w-auto">
          <a
            href={createExportUrl({
              baseUrl: exportBaseUrl,
              format: "csv",
              searchParams,
            })}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-xs font-bold text-neutral-300 transition hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-white"
          >
            <FileText className="h-4 w-4" />
            CSV
          </a>

          <a
            href={createExportUrl({
              baseUrl: exportBaseUrl,
              format: "xlsx",
              searchParams,
            })}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/15"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </a>

          <a
            href={createExportUrl({
              baseUrl: exportBaseUrl,
              format: "pdf",
              searchParams,
            })}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-orange-500/25 bg-orange-500/[0.08] px-4 text-xs font-bold text-orange-300 transition hover:bg-orange-500/15"
          >
            <Download className="h-4 w-4" />
            PDF
          </a>
        </div>
      </div>
    </section>
  );
}