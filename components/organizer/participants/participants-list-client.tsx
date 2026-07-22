"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ListChecks,
  UsersRound,
} from "lucide-react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  useMemo,
} from "react";

import ParticipantCard from "@/components/organizer/participants/participant-card";
import ParticipantsEmptyState from "@/components/organizer/participants/participants-empty-state";
import ParticipantsTable from "@/components/organizer/participants/participants-table";
import ParticipantsToolbar from "@/components/organizer/participants/participants-toolbar";
import type {
  GetOrganizerParticipantsResult,
  OrganizerParticipantListItem,
} from "@/lib/organizer/get-organizer-participants";

type ParticipantsListClientProps = {
  data: GetOrganizerParticipantsResult;
};

type PaginationButtonProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon: typeof ChevronLeft;
};

const PAGE_SIZE_OPTIONS = [
  10,
  20,
  30,
  50,
  100,
] as const;

function formatNumber(
  value: number,
): string {
  return new Intl.NumberFormat(
    "fr-FR",
    {
      maximumFractionDigits: 0,
    },
  ).format(value);
}

function hasActiveFilters(
  data: GetOrganizerParticipantsResult,
): boolean {
  const {
    appliedFilters,
  } = data;

  return Boolean(
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
}

function getVisiblePages({
  currentPage,
  totalPages,
}: {
  currentPage: number;
  totalPages: number;
}): number[] {
  if (totalPages <= 5) {
    return Array.from(
      {
        length: totalPages,
      },
      (
        _,
        index,
      ) => index + 1,
    );
  }

  if (currentPage <= 3) {
    return [
      1,
      2,
      3,
      4,
      5,
    ];
  }

  if (
    currentPage >=
    totalPages - 2
  ) {
    return [
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    currentPage - 2,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    currentPage + 2,
  ];
}

function PaginationButton({
  label,
  onClick,
  disabled = false,
  icon: Icon,
}: PaginationButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.025] text-neutral-400 transition hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-white/[0.08] disabled:hover:bg-white/[0.025] disabled:hover:text-neutral-400"
    >
      <Icon
        className="h-4 w-4"
        aria-hidden="true"
      />
    </button>
  );
}

function ParticipantsCards({
  participants,
}: {
  participants: OrganizerParticipantListItem[];
}) {
  return (
    <section className="grid gap-4 lg:hidden">
      {participants.map(
        (participant) => (
          <ParticipantCard
            key={
              participant.id
            }
            participant={
              participant
            }
          />
        ),
      )}
    </section>
  );
}

export default function ParticipantsListClient({
  data,
}: ParticipantsListClientProps) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const searchParams =
    useSearchParams();

  const activeFilters =
    hasActiveFilters(data);

  const {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasPreviousPage,
    hasNextPage,
  } = data.pagination;

  const visiblePages =
    useMemo(
      () =>
        getVisiblePages({
          currentPage:
            page,
          totalPages,
        }),
      [
        page,
        totalPages,
      ],
    );

  const firstVisibleItem =
    totalItems === 0
      ? 0
      : (page - 1) *
          pageSize +
        1;

  const lastVisibleItem =
    Math.min(
      page * pageSize,
      totalItems,
    );

  function updatePagination(
    changes: Record<
      string,
      string | number | null
    >,
  ) {
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

    const query =
      params.toString();

    router.replace(
      query
        ? `${pathname}?${query}`
        : pathname,
      {
        scroll: false,
      },
    );
  }

  function goToPage(
    nextPage: number,
  ) {
    const safePage =
      Math.min(
        Math.max(
          nextPage,
          1,
        ),
        totalPages,
      );

    if (
      safePage === page
    ) {
      return;
    }

    updatePagination({
      page:
        safePage,
    });

    window.requestAnimationFrame(
      () => {
        window.scrollTo({
          top:
            0,
          behavior:
            "smooth",
        });
      },
    );
  }

  function changePageSize(
    nextPageSize: number,
  ) {
    updatePagination({
      page:
        1,
      pageSize:
        nextPageSize,
    });
  }

  const hasParticipants =
    data.participants.length >
    0;

  return (
    <div className="space-y-5">
      <ParticipantsToolbar
        events={
          data.options.events
        }
        ticketTypes={
          data.options
            .ticketTypes
        }
        countries={
          data.options
            .countries
        }
        appliedFilters={
          data.appliedFilters
        }
        totalItems={
          data.pagination
            .totalItems
        }
      />

      {hasParticipants ? (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-[#071014] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08]">
                <UsersRound className="h-4 w-4 text-emerald-300" />
              </div>

              <div>
                <p className="text-sm font-bold text-white">
                  {formatNumber(
                    totalItems,
                  )}{" "}
                  participant
                  {totalItems > 1
                    ? "s"
                    : ""}
                </p>

                <p className="mt-0.5 text-xs text-neutral-500">
                  Affichage de{" "}
                  {formatNumber(
                    firstVisibleItem,
                  )}{" "}
                  à{" "}
                  {formatNumber(
                    lastVisibleItem,
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <ListChecks className="h-4 w-4" />

              <span>
                Page{" "}
                <strong className="font-bold text-neutral-300">
                  {page}
                </strong>{" "}
                sur{" "}
                <strong className="font-bold text-neutral-300">
                  {totalPages}
                </strong>
              </span>
            </div>
          </div>

          <ParticipantsTable
            participants={
              data.participants
            }
          />

          <ParticipantsCards
            participants={
              data.participants
            }
          />

          <section className="overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014]">
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="text-xs font-semibold text-neutral-500">
                  Lignes par page
                </span>

                <select
                  value={
                    pageSize
                  }
                  onChange={(
                    event,
                  ) =>
                    changePageSize(
                      Number(
                        event
                          .target
                          .value,
                      ),
                    )
                  }
                  aria-label="Nombre de participants par page"
                  className="h-9 min-w-[95px] rounded-lg border border-white/[0.09] bg-[#040b0f] px-3 text-xs font-bold text-neutral-300 outline-none transition [color-scheme:dark] focus:border-emerald-500/45 focus:ring-2 focus:ring-emerald-500/10"
                >
                  {PAGE_SIZE_OPTIONS.map(
                    (
                      option,
                    ) => (
                      <option
                        key={
                          option
                        }
                        value={
                          option
                        }
                      >
                        {option}
                      </option>
                    ),
                  )}
                </select>

                <span className="text-xs text-neutral-600">
                  sur{" "}
                  {formatNumber(
                    totalItems,
                  )}{" "}
                  résultat
                  {totalItems > 1
                    ? "s"
                    : ""}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-end">
                <PaginationButton
                  label="Première page"
                  icon={
                    ChevronsLeft
                  }
                  disabled={
                    !hasPreviousPage
                  }
                  onClick={() =>
                    goToPage(1)
                  }
                />

                <PaginationButton
                  label="Page précédente"
                  icon={
                    ChevronLeft
                  }
                  disabled={
                    !hasPreviousPage
                  }
                  onClick={() =>
                    goToPage(
                      page - 1,
                    )
                  }
                />

                <div className="flex items-center gap-1">
                  {visiblePages.map(
                    (
                      pageNumber,
                    ) => {
                      const isActive =
                        pageNumber ===
                        page;

                      return (
                        <button
                          key={
                            pageNumber
                          }
                          type="button"
                          onClick={() =>
                            goToPage(
                              pageNumber,
                            )
                          }
                          aria-current={
                            isActive
                              ? "page"
                              : undefined
                          }
                          className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-xs font-black transition ${
                            isActive
                              ? "border-emerald-500/35 bg-emerald-500/12 text-emerald-300"
                              : "border-white/[0.08] bg-white/[0.025] text-neutral-500 hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-white"
                          }`}
                        >
                          {
                            pageNumber
                          }
                        </button>
                      );
                    },
                  )}
                </div>

                <PaginationButton
                  label="Page suivante"
                  icon={
                    ChevronRight
                  }
                  disabled={
                    !hasNextPage
                  }
                  onClick={() =>
                    goToPage(
                      page + 1,
                    )
                  }
                />

                <PaginationButton
                  label="Dernière page"
                  icon={
                    ChevronsRight
                  }
                  disabled={
                    !hasNextPage
                  }
                  onClick={() =>
                    goToPage(
                      totalPages,
                    )
                  }
                />
              </div>
            </div>
          </section>
        </>
      ) : (
        <ParticipantsEmptyState
          hasActiveFilters={
            activeFilters
          }
          eventsCount={
            data.options.events
              .length
          }
        />
      )}
    </div>
  );
}