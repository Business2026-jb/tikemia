"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  Archive,
  Ban,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Eye,
  FileClock,
  MapPin,
  RefreshCw,
  Search,
  TicketCheck,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type AdminEventStatus =
  | "DRAFT"
  | "PENDING"
  | "PUBLISHED"
  | "REJECTED"
  | "CANCELED"
  | "SUSPENDED"
  | "ARCHIVED"
  | "COMPLETED";

type AdminEventItem = {
  id: string;
  title: string;
  slug: string;
  coverImageUrl: string | null;

  status: AdminEventStatus;
  isFree: boolean;

  country: string;
  city: string;
  venueName: string | null;

  startsAt: string;
  endsAt: string | null;

  currency: string;

  ticketsSold: number;
  ticketsCapacity: number | null;
  grossRevenue: number;

  createdAt: string;
  updatedAt: string;

  organizer: {
    id: string;
    name: string;
    email: string;
    businessName: string | null;
    avatarUrl: string | null;
  };

  category: {
    id: string;
    name: string;
  } | null;
};

type AdminEventsSummary = {
  total: number;
  pending: number;
  published: number;
  draft: number;
  rejected: number;
  canceled: number;
  suspended: number;
  archived: number;
  completed: number;

  totalTicketsSold: number;
  totalRevenue: number;
  currency: string;
};

type AdminEventsPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

type AdminEventsApiResponse = {
  success: boolean;
  message?: string;
  code?: string;
  redirectTo?: string;
  data?: {
    events: AdminEventItem[];
    summary: AdminEventsSummary;
    pagination: AdminEventsPagination;
  };
};

type StatusFilter =
  | "ALL"
  | AdminEventStatus;

type SortValue =
  | "recent"
  | "oldest"
  | "start-asc"
  | "start-desc"
  | "most-sold"
  | "highest-revenue";

const PAGE_SIZE = 20;

const EMPTY_SUMMARY: AdminEventsSummary = {
  total: 0,
  pending: 0,
  published: 0,
  draft: 0,
  rejected: 0,
  canceled: 0,
  suspended: 0,
  archived: 0,
  completed: 0,
  totalTicketsSold: 0,
  totalRevenue: 0,
  currency: "XOF",
};

const EMPTY_PAGINATION: AdminEventsPagination = {
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false,
};

const STATUS_LABELS: Record<
  AdminEventStatus,
  string
> = {
  DRAFT: "Brouillon",
  PENDING: "En attente",
  PUBLISHED: "Publié",
  REJECTED: "Rejeté",
  CANCELED: "Annulé",
  SUSPENDED: "Suspendu",
  ARCHIVED: "Archivé",
  COMPLETED: "Terminé",
};

const STATUS_CLASSES: Record<
  AdminEventStatus,
  string
> = {
  DRAFT:
    "border-white/[0.09] bg-white/[0.04] text-neutral-300",
  PENDING:
    "border-amber-400/20 bg-amber-400/[0.08] text-amber-200",
  PUBLISHED:
    "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200",
  REJECTED:
    "border-rose-400/20 bg-rose-400/[0.08] text-rose-200",
  CANCELED:
    "border-orange-400/20 bg-orange-400/[0.08] text-orange-200",
  SUSPENDED:
    "border-red-400/20 bg-red-400/[0.08] text-red-200",
  ARCHIVED:
    "border-violet-400/20 bg-violet-400/[0.08] text-violet-200",
  COMPLETED:
    "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-200",
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

function normalizeCurrency(
  value: string | null | undefined,
): string {
  const normalized =
    value?.trim().toUpperCase() ?? "";

  return /^[A-Z]{3}$/.test(normalized)
    ? normalized
    : "XOF";
}

function formatMoney(
  value: number,
  currency: string,
): string {
  const safeValue =
    Number.isFinite(value)
      ? value
      : 0;

  const normalizedCurrency =
    normalizeCurrency(currency);

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency:
          normalizedCurrency,
        maximumFractionDigits: 0,
      },
    ).format(safeValue);
  } catch {
    return `${Math.round(
      safeValue,
    ).toLocaleString("fr-FR")} ${normalizedCurrency}`;
  }
}

function formatDateTime(
  value: string | null | undefined,
): string {
  if (!value) {
    return "Non définie";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Date invalide";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}

function safeText(
  value: string | null | undefined,
  fallback: string,
): string {
  const normalized =
    value?.trim() ?? "";

  return normalized || fallback;
}

async function readJsonResponse<T>(
  response: Response,
): Promise<T> {
  const text =
    await response.text();

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      "La réponse du serveur n’est pas valide.",
    );
  }
}

function SummaryCard({
  label,
  value,
  description,
  icon,
  tone,
}: {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  tone:
    | "blue"
    | "amber"
    | "emerald"
    | "rose"
    | "violet"
    | "cyan";
}) {
  const toneClasses = {
    blue:
      "border-blue-400/20 bg-blue-400/[0.08] text-blue-300",
    amber:
      "border-amber-400/20 bg-amber-400/[0.08] text-amber-300",
    emerald:
      "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300",
    rose:
      "border-rose-400/20 bg-rose-400/[0.08] text-rose-300",
    violet:
      "border-violet-400/20 bg-violet-400/[0.08] text-violet-300",
    cyan:
      "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300",
  }[tone];

  return (
    <article className="rounded-2xl border border-white/[0.075] bg-[#07101a] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.13em] text-neutral-500">
            {label}
          </p>

          <p className="mt-2 truncate text-2xl font-black tracking-[-0.04em] text-white">
            {value}
          </p>

          <p className="mt-2 text-xs font-medium leading-5 text-neutral-500">
            {description}
          </p>
        </div>

        <div
          className={joinClassNames(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
            toneClasses,
          )}
        >
          {icon}
        </div>
      </div>
    </article>
  );
}

function EventsLoadingState() {
  return (
    <div className="space-y-3 p-4 lg:hidden">
      {Array.from({
        length: 4,
      }).map((_, index) => (
        <div
          key={index}
          className="h-60 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.035]"
        />
      ))}
    </div>
  );
}

export default function AdminEventsPage() {
  const [
    events,
    setEvents,
  ] = useState<AdminEventItem[]>([]);

  const [
    summary,
    setSummary,
  ] = useState<AdminEventsSummary>(
    EMPTY_SUMMARY,
  );

  const [
    pagination,
    setPagination,
  ] = useState<AdminEventsPagination>(
    EMPTY_PAGINATION,
  );

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState<StatusFilter>(
    "ALL",
  );

  const [
    country,
    setCountry,
  ] = useState("");

  const [
    sort,
    setSort,
  ] = useState<SortValue>(
    "recent",
  );

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const queryString =
    useMemo(() => {
      const params =
        new URLSearchParams();

      params.set(
        "page",
        String(page),
      );

      params.set(
        "pageSize",
        String(PAGE_SIZE),
      );

      params.set(
        "sort",
        sort,
      );

      const normalizedSearch =
        search.trim();

      if (normalizedSearch) {
        params.set(
          "search",
          normalizedSearch,
        );
      }

      if (status !== "ALL") {
        params.set(
          "status",
          status,
        );
      }

      if (country.trim()) {
        params.set(
          "country",
          country.trim(),
        );
      }

      return params.toString();
    }, [
      country,
      page,
      search,
      sort,
      status,
    ]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    status !== "ALL" ||
    country.trim().length > 0 ||
    sort !== "recent";

  const loadEvents =
    useCallback(
      async ({
        silent = false,
      }: {
        silent?: boolean;
      } = {}) => {
        if (silent) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        setErrorMessage(null);

        try {
          const response =
            await fetch(
              `/api/admin/events?${queryString}`,
              {
                method: "GET",
                cache: "no-store",
                credentials:
                  "same-origin",
              },
            );

          const payload =
            await readJsonResponse<AdminEventsApiResponse>(
              response,
            );

          if (!response.ok) {
            if (
              response.status ===
                401 &&
              payload.redirectTo
            ) {
              window.location.href =
                payload.redirectTo;
              return;
            }

            throw new Error(
              payload.message ||
                "Impossible de charger les événements.",
            );
          }

          setEvents(
            payload.data?.events ??
              [],
          );

          setSummary(
            payload.data?.summary ??
              EMPTY_SUMMARY,
          );

          setPagination(
            payload.data?.pagination ??
              {
                ...EMPTY_PAGINATION,
                page,
              },
          );
        } catch (error) {
          setEvents([]);
          setSummary(
            EMPTY_SUMMARY,
          );

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Impossible de charger les événements.",
          );
        } finally {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      },
      [
        page,
        queryString,
      ],
    );

  useEffect(() => {
    const timeoutId =
      window.setTimeout(() => {
        void loadEvents();
      }, 0);

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [loadEvents]);

  function resetFilters() {
    setSearch("");
    setStatus("ALL");
    setCountry("");
    setSort("recent");
    setPage(1);
  }

  return (
    <main className="w-full min-w-0 px-4 py-5 sm:px-5 lg:px-6 xl:px-8">
      <div className="flex flex-col gap-5">
        <header className="rounded-2xl border border-white/[0.075] bg-[#07101a] p-5 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-400/[0.08] text-blue-300">
                <CalendarCheck2 className="h-6 w-6" />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-300">
                  Administration Tikemia
                </p>

                <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
                  Gestion des événements
                </h1>

                <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-neutral-500">
                  Contrôlez tous les événements, ouvrez leur dossier complet et traitez les demandes de validation.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                void loadEvents({
                  silent: true,
                });
              }}
              disabled={
                isLoading ||
                isRefreshing
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-sm font-black text-white transition hover:border-blue-400/25 hover:bg-blue-400/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={joinClassNames(
                  "h-4 w-4",
                  isRefreshing &&
                    "animate-spin",
                )}
              />
              Actualiser
            </button>
          </div>
        </header>

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm font-semibold text-rose-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

            <span className="flex-1">
              {errorMessage}
            </span>

            <button
              type="button"
              onClick={() => {
                setErrorMessage(
                  null,
                );
              }}
              className="text-xs font-black underline underline-offset-4"
            >
              Fermer
            </button>
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Total événements"
            value={summary.total.toLocaleString(
              "fr-FR",
            )}
            description="Tous les événements enregistrés sur Tikemia."
            icon={
              <CalendarCheck2 className="h-5 w-5" />
            }
            tone="blue"
          />

          <SummaryCard
            label="En attente"
            value={summary.pending.toLocaleString(
              "fr-FR",
            )}
            description="Dossiers qui nécessitent une décision administrative."
            icon={
              <FileClock className="h-5 w-5" />
            }
            tone="amber"
          />

          <SummaryCard
            label="Publiés"
            value={summary.published.toLocaleString(
              "fr-FR",
            )}
            description="Événements actuellement visibles sur la plateforme."
            icon={
              <CheckCircle2 className="h-5 w-5" />
            }
            tone="emerald"
          />

          <SummaryCard
            label="Revenus générés"
            value={formatMoney(
              summary.totalRevenue,
              summary.currency,
            )}
            description={`${summary.totalTicketsSold.toLocaleString(
              "fr-FR",
            )} billet(s) vendu(s) au total.`}
            icon={
              <CircleDollarSign className="h-5 w-5" />
            }
            tone="violet"
          />
        </section>

        <section className="rounded-2xl border border-white/[0.075] bg-[#07101a] p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
            <label
              htmlFor="admin-events-search"
              className="relative block flex-1"
            >
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-neutral-500">
                Recherche
              </span>

              <Search className="pointer-events-none absolute bottom-3.5 left-3.5 h-4 w-4 text-neutral-600" />

              <input
                id="admin-events-search"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(
                    event.target.value,
                  );
                  setPage(1);
                }}
                placeholder="Titre, organisateur, ville, identifiant..."
                className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 pl-10 pr-4 text-sm font-semibold text-white outline-none transition placeholder:text-neutral-600 focus:border-blue-400/45 focus:ring-2 focus:ring-blue-400/10"
              />
            </label>

            <label className="block xl:w-48">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-neutral-500">
                Statut
              </span>

              <div className="relative">
                <select
                  value={status}
                  onChange={(event) => {
                    setStatus(
                      event.target
                        .value as StatusFilter,
                    );
                    setPage(1);
                  }}
                  className="h-11 w-full appearance-none rounded-xl border border-white/[0.08] bg-black/20 px-3 pr-9 text-sm font-bold text-white outline-none transition focus:border-blue-400/45 focus:ring-2 focus:ring-blue-400/10"
                >
                  <option value="ALL">
                    Tous les statuts
                  </option>

                  {Object.entries(
                    STATUS_LABELS,
                  ).map(
                    ([
                      value,
                      label,
                    ]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    ),
                  )}
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
              </div>
            </label>

            <label className="block xl:w-48">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-neutral-500">
                Pays
              </span>

              <input
                type="text"
                value={country}
                onChange={(event) => {
                  setCountry(
                    event.target.value,
                  );
                  setPage(1);
                }}
                placeholder="Tous les pays"
                className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3.5 text-sm font-semibold text-white outline-none transition placeholder:text-neutral-600 focus:border-blue-400/45 focus:ring-2 focus:ring-blue-400/10"
              />
            </label>

            <label className="block xl:w-56">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-neutral-500">
                Trier par
              </span>

              <div className="relative">
                <select
                  value={sort}
                  onChange={(event) => {
                    setSort(
                      event.target
                        .value as SortValue,
                    );
                    setPage(1);
                  }}
                  className="h-11 w-full appearance-none rounded-xl border border-white/[0.08] bg-black/20 px-3 pr-9 text-sm font-bold text-white outline-none transition focus:border-blue-400/45 focus:ring-2 focus:ring-blue-400/10"
                >
                  <option value="recent">
                    Plus récents
                  </option>
                  <option value="oldest">
                    Plus anciens
                  </option>
                  <option value="start-asc">
                    Date de début croissante
                  </option>
                  <option value="start-desc">
                    Date de début décroissante
                  </option>
                  <option value="most-sold">
                    Plus de billets vendus
                  </option>
                  <option value="highest-revenue">
                    Revenus les plus élevés
                  </option>
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
              </div>
            </label>

            <button
              type="button"
              onClick={resetFilters}
              disabled={
                !hasActiveFilters
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-xs font-black text-white transition hover:border-white/[0.15] hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <XCircle className="h-4 w-4" />
              Réinitialiser
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/[0.075] bg-[#07101a]">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1380px] border-collapse">
              <thead>
                <tr className="bg-white/[0.018]">
                  {[
                    "Événement",
                    "Organisateur",
                    "Lieu",
                    "Date",
                    "Billetterie",
                    "Revenus",
                    "Statut",
                    "Actions",
                  ].map((label) => (
                    <th
                      key={label}
                      className="px-5 py-3.5 text-left text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500 last:text-right"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  Array.from({
                    length: 6,
                  }).map((_, index) => (
                    <tr
                      key={index}
                      className="border-t border-white/[0.06]"
                    >
                      {Array.from({
                        length: 8,
                      }).map(
                        (
                          __,
                          cellIndex,
                        ) => (
                          <td
                            key={
                              cellIndex
                            }
                            className="px-5 py-4"
                          >
                            <div className="h-12 animate-pulse rounded-xl bg-white/[0.045]" />
                          </td>
                        ),
                      )}
                    </tr>
                  ))
                ) : (
                  events.map((event) => (
                    <tr
                      key={event.id}
                      className="border-t border-white/[0.06] transition hover:bg-white/[0.018]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex min-w-[280px] items-center gap-3">
                          <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.035]">
                            {event.coverImageUrl ? (
                              <Image
                                src={
                                  event.coverImageUrl
                                }
                                alt={
                                  event.title
                                }
                                fill
                                sizes="80px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-neutral-600">
                                <CalendarCheck2 className="h-5 w-5" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="max-w-[250px] truncate text-sm font-black text-white">
                              {event.title}
                            </p>

                            <p className="mt-1 max-w-[250px] truncate text-xs font-medium text-neutral-500">
                              {event.category?.name ??
                                "Sans catégorie"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="min-w-[190px]">
                          <p className="truncate text-sm font-extrabold text-white">
                            {safeText(
                              event.organizer
                                .businessName,
                              event.organizer
                                .name,
                            )}
                          </p>

                          <p className="mt-1 truncate text-xs font-medium text-neutral-500">
                            {
                              event.organizer
                                .email
                            }
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="min-w-[170px]">
                          <p className="flex items-center gap-2 text-sm font-bold text-neutral-300">
                            <MapPin className="h-4 w-4 text-blue-300" />
                            {event.city}
                          </p>

                          <p className="mt-1 truncate text-xs font-medium text-neutral-500">
                            {event.country}
                            {event.venueName
                              ? ` · ${event.venueName}`
                              : ""}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="min-w-[185px]">
                          <p className="text-xs font-bold text-neutral-300">
                            {formatDateTime(
                              event.startsAt,
                            )}
                          </p>

                          <p className="mt-1 text-xs font-medium text-neutral-500">
                            Fin :{" "}
                            {formatDateTime(
                              event.endsAt,
                            )}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="min-w-[145px]">
                          <p className="flex items-center gap-2 text-sm font-black text-white">
                            <TicketCheck className="h-4 w-4 text-emerald-300" />
                            {event.ticketsSold.toLocaleString(
                              "fr-FR",
                            )}
                          </p>

                          <p className="mt-1 text-xs font-medium text-neutral-500">
                            {event.ticketsCapacity ===
                            null
                              ? "Capacité illimitée"
                              : `sur ${event.ticketsCapacity.toLocaleString(
                                  "fr-FR",
                                )}`}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <p className="min-w-[150px] text-sm font-black text-white">
                          {formatMoney(
                            event.grossRevenue,
                            event.currency,
                          )}
                        </p>

                        <p className="mt-1 text-xs font-medium text-neutral-500">
                          {event.isFree
                            ? "Événement gratuit"
                            : "Événement payant"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={joinClassNames(
                            "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black",
                            STATUS_CLASSES[
                              event.status
                            ],
                          )}
                        >
                          {
                            STATUS_LABELS[
                              event.status
                            ]
                          }
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/admin/events/${event.id}`}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-400/20 bg-blue-400/[0.06] px-3.5 text-xs font-black text-blue-200 transition hover:border-blue-400/35 hover:bg-blue-400/[0.1]"
                        >
                          <Eye className="h-4 w-4" />
                          Examiner
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {isLoading ? (
            <EventsLoadingState />
          ) : (
            <div className="space-y-3 p-3 lg:hidden">
              {events.map((event) => (
                <article
                  key={event.id}
                  className="rounded-2xl border border-white/[0.075] bg-white/[0.018] p-4"
                >
                  <div className="flex gap-3">
                    <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.035]">
                      {event.coverImageUrl ? (
                        <Image
                          src={
                            event.coverImageUrl
                          }
                          alt={event.title}
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-neutral-600">
                          <CalendarCheck2 className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={joinClassNames(
                            "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black",
                            STATUS_CLASSES[
                              event.status
                            ],
                          )}
                        >
                          {
                            STATUS_LABELS[
                              event.status
                            ]
                          }
                        </span>
                      </div>

                      <h2 className="mt-2 line-clamp-2 text-sm font-black text-white">
                        {event.title}
                      </h2>

                      <p className="mt-1 truncate text-xs font-medium text-neutral-500">
                        {safeText(
                          event.organizer
                            .businessName,
                          event.organizer
                            .name,
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <MobileMetric
                      icon={
                        <MapPin className="h-4 w-4" />
                      }
                      label="Lieu"
                      value={`${event.city}, ${event.country}`}
                    />

                    <MobileMetric
                      icon={
                        <CalendarClock className="h-4 w-4" />
                      }
                      label="Début"
                      value={formatDateTime(
                        event.startsAt,
                      )}
                    />

                    <MobileMetric
                      icon={
                        <TicketCheck className="h-4 w-4" />
                      }
                      label="Billets"
                      value={event.ticketsSold.toLocaleString(
                        "fr-FR",
                      )}
                    />

                    <MobileMetric
                      icon={
                        <CircleDollarSign className="h-4 w-4" />
                      }
                      label="Revenus"
                      value={formatMoney(
                        event.grossRevenue,
                        event.currency,
                      )}
                    />
                  </div>

                  <Link
                    href={`/admin/events/${event.id}`}
                    className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 text-sm font-black text-white transition active:bg-blue-400"
                  >
                    <Eye className="h-4 w-4" />
                    Examiner l’événement
                  </Link>
                </article>
              ))}
            </div>
          )}

          {!isLoading &&
          events.length === 0 ? (
            <div className="flex min-h-[340px] flex-col items-center justify-center px-5 py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-400/[0.08] text-blue-300">
                <CalendarCheck2 className="h-7 w-7" />
              </div>

              <h2 className="mt-5 text-xl font-black text-white">
                Aucun événement trouvé
              </h2>

              <p className="mt-2 max-w-lg text-sm font-medium leading-6 text-neutral-500">
                Aucun événement ne correspond aux critères sélectionnés.
              </p>

              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={
                    resetFilters
                  }
                  className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 text-xs font-black text-white"
                >
                  <XCircle className="h-4 w-4" />
                  Effacer les filtres
                </button>
              ) : null}
            </div>
          ) : null}

          {pagination.totalPages > 1 ? (
            <footer className="flex flex-col gap-3 border-t border-white/[0.07] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-xs font-medium text-neutral-500">
                Page{" "}
                <strong className="text-neutral-300">
                  {pagination.page}
                </strong>{" "}
                sur{" "}
                <strong className="text-neutral-300">
                  {
                    pagination.totalPages
                  }
                </strong>{" "}
                ·{" "}
                {pagination.total.toLocaleString(
                  "fr-FR",
                )}{" "}
                événement(s)
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPage(
                      (
                        current,
                      ) =>
                        Math.max(
                          1,
                          current - 1,
                        ),
                    );
                  }}
                  disabled={
                    isLoading ||
                    isRefreshing ||
                    !pagination.hasPreviousPage
                  }
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 text-xs font-black text-white transition hover:border-white/[0.15] hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Précédent
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPage(
                      (
                        current,
                      ) =>
                        current + 1,
                    );
                  }}
                  disabled={
                    isLoading ||
                    isRefreshing ||
                    !pagination.hasNextPage
                  }
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 text-xs font-black text-white transition hover:border-white/[0.15] hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </footer>
          ) : null}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatusMiniCard
            label="Brouillons"
            value={summary.draft}
            icon={
              <FileClock className="h-4 w-4" />
            }
          />

          <StatusMiniCard
            label="Rejetés"
            value={summary.rejected}
            icon={
              <Ban className="h-4 w-4" />
            }
          />

          <StatusMiniCard
            label="Suspendus"
            value={summary.suspended}
            icon={
              <AlertCircle className="h-4 w-4" />
            }
          />

          <StatusMiniCard
            label="Archivés"
            value={summary.archived}
            icon={
              <Archive className="h-4 w-4" />
            }
          />
        </section>
      </div>
    </main>
  );
}

function MobileMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/15 p-3">
      <div className="flex items-center gap-2 text-blue-300">
        {icon}

        <span className="text-[10px] font-black uppercase tracking-[0.08em] text-neutral-500">
          {label}
        </span>
      </div>

      <p className="mt-2 line-clamp-2 text-xs font-black text-white">
        {value}
      </p>
    </div>
  );
}

function StatusMiniCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <article className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.075] bg-[#07101a] p-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-500">
          {label}
        </p>

        <p className="mt-1 text-xl font-black text-white">
          {value.toLocaleString(
            "fr-FR",
          )}
        </p>
      </div>

      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-neutral-300">
        {icon}
      </div>
    </article>
  );
}