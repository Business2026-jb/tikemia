
"use client";

import {
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
} from "react";

import {
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  Clock3,
  SlidersHorizontal,
} from "lucide-react";

/* ============================================
   TIKEMIA — FILTRES DU DASHBOARD

   Fichier :
   src/components/organizer/DashboardFilters.tsx

   Fonctionnalités :
   - Cette semaine
   - Ce mois
   - Cette année
   - Période personnalisée
   - Dates de début et de fin
   - Vue rapide
   - FR / EN
   - Version PC et mobile
   - Pleine largeur

   Le composant transmet les filtres
   à la page principale.

   L'API reste responsable de calculer
   les statistiques réelles.
============================================ */

/* ============================================
   TYPES EXPORTÉS
============================================ */

export type DashboardPeriod =
  | "week"
  | "month"
  | "year"
  | "custom";

export type DashboardQuickView =
  | "monthly_sales"
  | "ticket_sales"
  | "revenue"
  | "events"
  | "fundraisers";

export type DashboardFilterValues = {
  period: DashboardPeriod;
  quickView: DashboardQuickView;
  startDate: string;
  endDate: string;
};

export type DashboardFiltersProps = {
  value?: DashboardFilterValues;

  onChange?: (
    filters: DashboardFilterValues
  ) => void;

  locale?: "fr" | "en";

  disabled?: boolean;

  className?: string;
};

/* ============================================
   VALEURS INITIALES

   Le mois en cours est sélectionné,
   comme sur l'architecture.

   L'API calculera les bornes réelles
   de la période.
============================================ */

export const DEFAULT_DASHBOARD_FILTERS:
  DashboardFilterValues = {
    period: "month",
    quickView: "monthly_sales",
    startDate: "",
    endDate: "",
  };

/* ============================================
   TRADUCTIONS FR / EN
============================================ */

const TEXT = {
  fr: {
    period: "Période",
    thisWeek: "Cette semaine",
    thisMonth: "Ce mois",
    thisYear: "Cette année",
    custom: "Personnalisé",
    quickView: "Vue rapide",
    monthlySales: "Ventes du mois",
    ticketSales: "Billets vendus",
    revenue: "Revenus générés",
    events: "Événements",
    fundraisers: "Cagnottes",
    startDate: "Date de début",
    endDate: "Date de fin",
    selectStart: "Sélectionner la date de début",
    selectEnd: "Sélectionner la date de fin",
    invalidRange:
      "La date de fin doit être égale ou postérieure à la date de début.",
    selectBoth:
      "Sélectionnez les deux dates pour appliquer cette période.",
    applied: "Période sélectionnée",
  },

  en: {
    period: "Period",
    thisWeek: "This week",
    thisMonth: "This month",
    thisYear: "This year",
    custom: "Custom",
    quickView: "Quick view",
    monthlySales: "Monthly sales",
    ticketSales: "Tickets sold",
    revenue: "Generated revenue",
    events: "Events",
    fundraisers: "Fundraisers",
    startDate: "Start date",
    endDate: "End date",
    selectStart: "Select start date",
    selectEnd: "Select end date",
    invalidRange:
      "The end date must be on or after the start date.",
    selectBoth:
      "Select both dates to apply this period.",
    applied: "Selected period",
  },
} as const;

/* ============================================
   CONFIGURATION DES FILTRES
============================================ */

const PERIOD_OPTIONS: DashboardPeriod[] = [
  "week",
  "month",
  "year",
  "custom",
];

const QUICK_VIEW_OPTIONS: DashboardQuickView[] = [
  "monthly_sales",
  "ticket_sales",
  "revenue",
  "events",
  "fundraisers",
];

/* ============================================
   UTILITAIRES
============================================ */

function subscribeDate(onChange: () => void) {
  const timer = window.setInterval(onChange, 60_000);
  window.addEventListener("focus", onChange);
  return () => { window.clearInterval(timer); window.removeEventListener("focus", onChange); };
}

function getLocalToday(): string {
  const date = new Date();

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function getPeriodLabel(
  period: DashboardPeriod,
  locale: "fr" | "en"
): string {
  const t = TEXT[locale];

  switch (period) {
    case "week":
      return t.thisWeek;

    case "month":
      return t.thisMonth;

    case "year":
      return t.thisYear;

    case "custom":
      return t.custom;
  }
}

function getQuickViewLabel(
  value: DashboardQuickView,
  locale: "fr" | "en"
): string {
  const t = TEXT[locale];

  switch (value) {
    case "monthly_sales":
      return t.monthlySales;

    case "ticket_sales":
      return t.ticketSales;

    case "revenue":
      return t.revenue;

    case "events":
      return t.events;

    case "fundraisers":
      return t.fundraisers;
  }
}

/* ============================================
   COMPOSANT PRINCIPAL
============================================ */

export default function DashboardFilters({
  value,
  onChange,
  locale = "fr",
  disabled = false,
  className = "",
}: DashboardFiltersProps) {
  /* ==========================================
     ÉTAT INTERNE

     Le composant fonctionne :
     - Avec un état local
     - Avec un état contrôlé par la page

     Si "value" est fourni, la page
     principale contrôle les filtres.
  ========================================== */

  const [internalValue, setInternalValue] =
    useState<DashboardFilterValues>({
      ...DEFAULT_DASHBOARD_FILTERS,
    });

  const filters = value ?? internalValue;

  const t = TEXT[locale];

  /* ==========================================
     DATE MAXIMALE

     Les statistiques utilisent des
     périodes passées ou en cours.
  ========================================== */

  const today = useSyncExternalStore(subscribeDate, getLocalToday, () => "");

  /* ==========================================
     VALIDATION DE LA PÉRIODE
  ========================================== */

  const customDateError = useMemo(() => {
    if (filters.period !== "custom") {
      return null;
    }

    const start = filters.startDate;
    const end = filters.endDate;

    if (
      !start ||
      !end ||
      !validDate(start) ||
      !validDate(end)
    ) {
      return null;
    }

    if (end < start) {
      return t.invalidRange;
    }

    return null;
  }, [
    filters.period,
    filters.startDate,
    filters.endDate,
    t.invalidRange,
  ]);

  const customRangeComplete =
    filters.period !== "custom" ||
    (
      validDate(filters.startDate) &&
      validDate(filters.endDate) &&
      filters.startDate <= filters.endDate &&
      filters.startDate <= today &&
      filters.endDate <= today
    );

  /* ==========================================
     APPLIQUER LES MODIFICATIONS

     Le parent récupère le nouvel état
     via la fonction onChange.
  ========================================== */

  const updateFilters = useCallback(
    (nextFilters: DashboardFilterValues) => {
      if (disabled) {
        return;
      }

      if (value === undefined) {
        setInternalValue(nextFilters);
      }

      onChange?.(nextFilters);
    },
    [
      disabled,
      value,
      onChange,
    ]
  );

  /* ==========================================
     CHANGER DE PÉRIODE
  ========================================== */

  function handlePeriodChange(
    nextPeriod: DashboardPeriod
  ) {
    updateFilters({
      ...filters,
      period: nextPeriod,
    });
  }

  /* ==========================================
     CHANGER LA VUE RAPIDE
  ========================================== */

  function handleQuickViewChange(
    nextQuickView: DashboardQuickView
  ) {
    updateFilters({
      ...filters,
      quickView: nextQuickView,
    });
  }

  /* ==========================================
     CHANGER LES DATES
  ========================================== */

  function handleDateChange(
    field: "startDate" | "endDate",
    nextDate: string
  ) {
    if (
      nextDate &&
      (
        !validDate(nextDate) ||
        nextDate > today
      )
    ) {
      return;
    }

    updateFilters({
      ...filters,
      [field]: nextDate,
    });
  }

  /* ==========================================
     BOUTON DE PÉRIODE SUR PC
  ========================================== */

  function renderPeriodButton(
    period: DashboardPeriod
  ) {
    const selected = filters.period === period;

    const Icon =
      period === "custom"
        ? CalendarRange
        : null;

    return (
      <button
        key={period}
        type="button"
        onClick={() =>
          handlePeriodChange(period)
        }
        disabled={disabled}
        aria-pressed={selected}
        className={[
          "inline-flex min-h-10",
          "shrink-0 items-center",
          "justify-center gap-2",
          "rounded-full border",
          "px-4 py-2",
          "text-sm font-bold",
          "whitespace-nowrap",
          "shadow-sm transition-all",
          "focus-visible:outline-2",
          "focus-visible:outline-offset-2",
          "focus-visible:outline-green-700",
          "disabled:cursor-not-allowed",
          "disabled:opacity-50",
          selected
            ? [
                "border-[#05821b]",
                "bg-linear-to-b",
                "from-[#24c800]",
                "to-[#006b17]",
                "text-white",
                "shadow-green-900/10",
              ].join(" ")
            : [
                "border-[#e0e5eb]",
                "bg-white",
                "text-[#142138]",
                "hover:border-green-400",
                "hover:bg-green-50",
              ].join(" "),
        ].join(" ")}
      >
        {getPeriodLabel(period, locale)}

        {Icon && (
          <Icon
            size={16}
            strokeWidth={2}
            aria-hidden="true"
          />
        )}
      </button>
    );
  }

  /* ==========================================
     CHAMP DATE PERSONNALISÉE
  ========================================== */

  function renderDateInput(
    field: "startDate" | "endDate"
  ) {
    const isStart = field === "startDate";

    const label = isStart
      ? t.startDate
      : t.endDate;

    const id = isStart
      ? "dashboard-filter-start-date"
      : "dashboard-filter-end-date";

    const min =
      !isStart && validDate(filters.startDate)
        ? filters.startDate
        : undefined;

    function handleChange(
      event: ChangeEvent<HTMLInputElement>
    ) {
      handleDateChange(
        field,
        event.currentTarget.value
      );
    }

    return (
      <div className="w-full min-w-0">
        <label
          htmlFor={id}
          className="mb-1.5 block text-xs font-bold text-[#142138]"
        >
          {label}
        </label>

        <div className="relative w-full min-w-0">
          <CalendarDays
            size={17}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-green-700"
          />

          <input
            id={id}
            type="date"
            value={filters[field]}
            onChange={handleChange}
            min={min}
            max={today || undefined}
            disabled={disabled}
            aria-invalid={
              Boolean(customDateError)
            }
            className={[
              "h-11 w-full min-w-0",
              "rounded-xl border",
              "border-[#dce3ea]",
              "bg-white py-2",
              "pr-3 pl-10",
              "text-sm font-medium",
              "text-[#142138]",
              "outline-none",
              "focus:border-green-600",
              "focus:ring-2",
              "focus:ring-green-100",
              "disabled:cursor-not-allowed",
              "disabled:opacity-50",
            ].join(" ")}
          />
        </div>
      </div>
    );
  }

  /* ==========================================
     AFFICHAGE
  ========================================== */

  return (
    <section
      aria-label={t.period}
      className={[
        "flex w-full min-w-0",
        "flex-col gap-3",
        className,
      ].join(" ")}
    >
      {/* ======================================
          VERSION PC

          Boutons alignés horizontalement.
          Vue rapide sur la droite.

          La barre occupe toute la largeur
          disponible après le menu latéral.
      ====================================== */}

      <div className="hidden w-full min-w-0 flex-wrap items-center justify-between gap-x-5 gap-y-3 lg:flex">
        {/* FILTRES DE PÉRIODE */}

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="mr-2 text-sm font-extrabold whitespace-nowrap text-[#173d2b]">
            {t.period} :
          </span>

          <div
            role="group"
            aria-label={t.period}
            className="flex flex-wrap items-center gap-2"
          >
            {PERIOD_OPTIONS.map((period) =>
              renderPeriodButton(period)
            )}
          </div>
        </div>

        {/* VUE RAPIDE */}

        <div className="flex min-w-0 items-center gap-3">
          <span className="text-sm font-extrabold whitespace-nowrap text-[#173d2b]">
            {t.quickView} :
          </span>

          <div className="relative min-w-45">
            <select
              aria-label={t.quickView}
              value={filters.quickView}
              onChange={(event) =>
                handleQuickViewChange(
                  event.currentTarget
                    .value as DashboardQuickView
                )
              }
              disabled={disabled}
              className={[
                "h-10 w-full appearance-none",
                "rounded-full border",
                "border-[#dce3ea]",
                "bg-white py-2",
                "pr-10 pl-4",
                "text-sm font-bold",
                "text-[#142138]",
                "shadow-sm outline-none",
                "focus:border-green-600",
                "focus:ring-2",
                "focus:ring-green-100",
                "disabled:opacity-50",
              ].join(" ")}
            >
              {QUICK_VIEW_OPTIONS.map((option) => (
                <option
                  key={option}
                  value={option}
                >
                  {getQuickViewLabel(
                    option,
                    locale
                  )}
                </option>
              ))}
            </select>

            <ChevronDown
              size={17}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#142138]"
            />
          </div>
        </div>
      </div>

      {/* ======================================
          VERSION MOBILE ET TABLETTE

          Sélecteur pleine largeur.
          Pas de dépassement horizontal.
      ====================================== */}

      <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
        {/* SÉLECTION DE PÉRIODE */}

        <div className="relative w-full min-w-0">
          <CalendarDays
            size={19}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[#173d2b]"
          />

          <select
            aria-label={t.period}
            value={filters.period}
            onChange={(event) =>
              handlePeriodChange(
                event.currentTarget
                  .value as DashboardPeriod
              )
            }
            disabled={disabled}
            className={[
              "h-12 w-full min-w-0",
              "appearance-none rounded-xl",
              "border border-[#dce3ea]",
              "bg-white py-2.5",
              "pr-10 pl-11",
              "text-sm font-extrabold",
              "text-[#142138]",
              "shadow-sm outline-none",
              "focus:border-green-600",
              "focus:ring-2",
              "focus:ring-green-100",
              "disabled:opacity-50",
            ].join(" ")}
          >
            {PERIOD_OPTIONS.map((period) => (
              <option
                key={period}
                value={period}
              >
                {getPeriodLabel(
                  period,
                  locale
                )}
              </option>
            ))}
          </select>

          <ChevronDown
            size={19}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#142138]"
          />
        </div>

        {/* VUE RAPIDE MOBILE */}

        <div className="relative w-full min-w-0">
          <SlidersHorizontal
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[#173d2b]"
          />

          <select
            aria-label={t.quickView}
            value={filters.quickView}
            onChange={(event) =>
              handleQuickViewChange(
                event.currentTarget
                  .value as DashboardQuickView
              )
            }
            disabled={disabled}
            className={[
              "h-12 w-full min-w-0",
              "appearance-none rounded-xl",
              "border border-[#dce3ea]",
              "bg-white py-2.5",
              "pr-10 pl-11",
              "text-sm font-bold",
              "text-[#142138]",
              "shadow-sm outline-none",
              "focus:border-green-600",
              "focus:ring-2",
              "focus:ring-green-100",
              "disabled:opacity-50",
            ].join(" ")}
          >
            {QUICK_VIEW_OPTIONS.map((option) => (
              <option
                key={option}
                value={option}
              >
                {getQuickViewLabel(
                  option,
                  locale
                )}
              </option>
            ))}
          </select>

          <ChevronDown
            size={19}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#142138]"
          />
        </div>
      </div>

      {/* ======================================
          PÉRIODE PERSONNALISÉE

          Visible seulement si l'option
          "Personnalisé" est sélectionnée.

          Deux champs sur PC.
          Champs empilés sur petit mobile.
      ====================================== */}

      {filters.period === "custom" && (
        <div className="w-full min-w-0 rounded-2xl border border-[#e1e8ed] bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-3 flex items-center gap-2">
            <CalendarRange
              size={20}
              aria-hidden="true"
              className="text-green-700"
            />

            <h3 className="text-sm font-extrabold text-[#142138]">
              {t.custom}
            </h3>
          </div>

          <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            {renderDateInput("startDate")}
            {renderDateInput("endDate")}
          </div>

          {/* VALIDATION VISUELLE */}

          {customDateError ? (
            <p
              role="alert"
              className="mt-3 text-xs font-semibold text-red-600"
            >
              {customDateError}
            </p>
          ) : !customRangeComplete ? (
            <p
              role="status"
              className="mt-3 flex items-start gap-2 text-xs text-gray-500"
            >
              <Clock3
                size={15}
                aria-hidden="true"
                className="shrink-0"
              />

              {t.selectBoth}
            </p>
          ) : (
            <p
              role="status"
              className="mt-3 flex items-center gap-2 text-xs font-bold text-green-700"
            >
              <Check
                size={16}
                aria-hidden="true"
              />

              {t.applied} :{" "}
              {filters.startDate} —{" "}
              {filters.endDate}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
