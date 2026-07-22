"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
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
  useTransition,
} from "react";

import DeleteEventDialog from "@/components/organizer/events/delete-event-dialog";
import EventCard from "@/components/organizer/events/event-card";
import EventsEmptyState from "@/components/organizer/events/events-empty-state";
import type {
  OrganizerEventListItem,
  OrganizerEventsPagination,
  OrganizerEventsSort,
  OrganizerEventsStatusFilter,
} from "@/lib/events/get-organizer-events";

type EventsListClientProps = {
  events: OrganizerEventListItem[];

  pagination: OrganizerEventsPagination;

  filters: {
    search: string;
    status: OrganizerEventsStatusFilter;
    sort: OrganizerEventsSort;
  };
};

type SelectedEvent = {
  id: string;
  title: string;
  status: OrganizerEventListItem["status"];
} | null;

export default function EventsListClient({
  events,
  pagination,
  filters,
}: EventsListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isPending, startTransition] =
    useTransition();

  const [selectedEvent, setSelectedEvent] =
    useState<SelectedEvent>(null);

  const [successMessage, setSuccessMessage] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  const hasFilters = useMemo(() => {
    return (
      Boolean(filters.search.trim()) ||
      filters.status !== "ALL" ||
      filters.sort !== "created-desc"
    );
  }, [
    filters.search,
    filters.sort,
    filters.status,
  ]);

  useEffect(() => {
    if (!successMessage && !errorMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSuccessMessage("");
      setErrorMessage("");
    }, 6_000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [errorMessage, successMessage]);

  function openDeleteDialog(
    event: OrganizerEventListItem,
  ) {
    setSuccessMessage("");
    setErrorMessage("");

    setSelectedEvent({
      id: event.id,
      title: event.title,
      status: event.status,
    });
  }

  function closeDeleteDialog() {
    setSelectedEvent(null);
  }

  function handleDeleted(message?: string) {
    setSelectedEvent(null);

    setSuccessMessage(
      message ??
        "L’événement a été supprimé avec succès.",
    );

    setErrorMessage("");

    startTransition(() => {
      router.refresh();
    });
  }

  function resetFilters() {
    setSuccessMessage("");
    setErrorMessage("");

    startTransition(() => {
      router.push(pathname, {
        scroll: false,
      });
    });
  }

  function changePage(page: number) {
    if (
      page < 1 ||
      page > pagination.totalPages ||
      page === pagination.page
    ) {
      return;
    }

    const parameters = new URLSearchParams(
      searchParams.toString(),
    );

    if (page === 1) {
      parameters.delete("page");
    } else {
      parameters.set("page", String(page));
    }

    const queryString = parameters.toString();

    startTransition(() => {
      router.push(
        queryString
          ? `${pathname}?${queryString}`
          : pathname,
        {
          scroll: true,
        },
      );
    });
  }

  const pageNumbers = useMemo(() => {
    return buildPaginationItems(
      pagination.page,
      pagination.totalPages,
    );
  }, [
    pagination.page,
    pagination.totalPages,
  ]);

  return (
    <div className="space-y-5">
      {successMessage && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3 text-sm leading-6 text-emerald-200"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-lime-400" />

          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-sm leading-6 text-red-300"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

          <span>{errorMessage}</span>
        </div>
      )}

      {isPending && (
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#081015] px-4 py-3 text-xs text-neutral-500">
          <LoaderCircle className="h-4 w-4 animate-spin text-lime-400" />

          Mise à jour de la liste...
        </div>
      )}

      {events.length === 0 ? (
        <EventsEmptyState
          hasFilters={hasFilters}
          search={filters.search}
          onResetFilters={
            hasFilters
              ? resetFilters
              : undefined
          }
        />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onDelete={openDeleteDialog}
              />
            ))}
          </section>

          <Pagination
            pagination={pagination}
            pageNumbers={pageNumbers}
            disabled={isPending}
            onPageChange={changePage}
          />
        </>
      )}

      <DeleteEventDialog
        open={selectedEvent !== null}
        eventId={selectedEvent?.id ?? ""}
        eventTitle={selectedEvent?.title ?? ""}
        eventStatus={
          selectedEvent?.status ?? "DRAFT"
        }
        onClose={closeDeleteDialog}
        onDeleted={handleDeleted}
      />
    </div>
  );
}

type PaginationProps = {
  pagination: OrganizerEventsPagination;
  pageNumbers: Array<number | "ellipsis">;
  disabled: boolean;
  onPageChange: (page: number) => void;
};

function Pagination({
  pagination,
  pageNumbers,
  disabled,
  onPageChange,
}: PaginationProps) {
  if (
    pagination.totalItems === 0 ||
    pagination.totalPages <= 1
  ) {
    return null;
  }

  const firstVisibleItem =
    (pagination.page - 1) *
      pagination.pageSize +
    1;

  const lastVisibleItem = Math.min(
    pagination.page * pagination.pageSize,
    pagination.totalItems,
  );

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#081015] p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs leading-5 text-neutral-500">
        Affichage de{" "}
        <span className="font-bold text-neutral-300">
          {firstVisibleItem.toLocaleString(
            "fr-FR",
          )}
        </span>{" "}
        à{" "}
        <span className="font-bold text-neutral-300">
          {lastVisibleItem.toLocaleString(
            "fr-FR",
          )}
        </span>{" "}
        sur{" "}
        <span className="font-bold text-neutral-300">
          {pagination.totalItems.toLocaleString(
            "fr-FR",
          )}
        </span>{" "}
        événement
        {pagination.totalItems > 1 ? "s" : ""}
      </p>

      <nav
        aria-label="Pagination des événements"
        className="flex flex-wrap items-center gap-2"
      >
        <button
          type="button"
          disabled={
            disabled ||
            !pagination.hasPreviousPage
          }
          onClick={() => {
            onPageChange(
              pagination.page - 1,
            );
          }}
          aria-label="Page précédente"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-3 text-xs font-bold text-neutral-400 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ChevronLeft className="h-4 w-4" />

          <span className="hidden sm:inline">
            Précédent
          </span>
        </button>

        {pageNumbers.map((item, index) => {
          if (item === "ellipsis") {
            return (
              <span
                key={`ellipsis-${index}`}
                className="flex h-10 w-8 items-center justify-center text-sm text-neutral-700"
              >
                …
              </span>
            );
          }

          const active =
            item === pagination.page;

          return (
            <button
              key={item}
              type="button"
              disabled={disabled}
              onClick={() => {
                onPageChange(item);
              }}
              aria-current={
                active ? "page" : undefined
              }
              className={`flex h-10 min-w-10 items-center justify-center rounded-xl border px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                active
                  ? "border-emerald-500/40 bg-emerald-500/12 text-lime-400"
                  : "border-white/[0.08] bg-white/[0.02] text-neutral-500 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {item}
            </button>
          );
        })}

        <button
          type="button"
          disabled={
            disabled ||
            !pagination.hasNextPage
          }
          onClick={() => {
            onPageChange(
              pagination.page + 1,
            );
          }}
          aria-label="Page suivante"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-3 text-xs font-bold text-neutral-400 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
        >
          <span className="hidden sm:inline">
            Suivant
          </span>

          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </section>
  );
}

function buildPaginationItems(
  currentPage: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from(
      {
        length: totalPages,
      },
      (_, index) => index + 1,
    );
  }

  const pages: Array<number | "ellipsis"> =
    [1];

  const lowerBoundary = Math.max(
    currentPage - 1,
    2,
  );

  const upperBoundary = Math.min(
    currentPage + 1,
    totalPages - 1,
  );

  if (lowerBoundary > 2) {
    pages.push("ellipsis");
  }

  for (
    let page = lowerBoundary;
    page <= upperBoundary;
    page += 1
  ) {
    pages.push(page);
  }

  if (upperBoundary < totalPages - 1) {
    pages.push("ellipsis");
  }

  pages.push(totalPages);

  return pages;
}