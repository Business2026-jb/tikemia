"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Grid2X2,
  List,
  SearchX,
  Sparkles,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

import ClientEventCard from "@/components/client/events/client-event-card";
import type {
  ClientHomeEvent,
  ClientHomePagination,
} from "@/lib/client/get-client-home-events";

export type ClientEventsViewMode =
  | "grid"
  | "list";

export type ClientAllEventsProps = {
  events: ClientHomeEvent[];
  pagination: ClientHomePagination;

  title?: string;
  description?: string;

  initialView?: ClientEventsViewMode;

  favoriteEventIds?: readonly string[];
  favoriteDisabled?: boolean;

  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionHref?: string;
  emptyActionLabel?: string;

  eventBasePath?: string;
  className?: string;

  onFavoriteChange?: (
    eventId: string,
    isFavorite: boolean,
  ) => void | Promise<void>;
};

function cn(
  ...classes: Array<
    string | false | null | undefined
  >
): string {
  return classes
    .filter(Boolean)
    .join(" ");
}

function normalizeViewMode(
  value:
    | ClientEventsViewMode
    | undefined,
): ClientEventsViewMode {
  return value === "list"
    ? "list"
    : "grid";
}

function normalizeFavoriteIds(
  values: readonly string[],
): Set<string> {
  return new Set(
    values
      .map(
        (
          value,
        ) =>
          value.trim(),
      )
      .filter(Boolean),
  );
}

function formatEventCount(
  value: number,
): string {
  const count =
    Math.max(
      Math.trunc(value),
      0,
    );

  return new Intl.NumberFormat(
    "fr-FR",
  ).format(
    count,
  );
}

export default function ClientAllEvents({
  events,
  pagination,

  title =
    "Tous les événements",

  description =
    "Découvrez les événements disponibles et trouvez l’expérience qui vous correspond.",

  initialView =
    "grid",

  favoriteEventIds = [],
  favoriteDisabled = false,

  emptyTitle =
    "Aucun événement trouvé",

  emptyDescription =
    "Aucun événement ne correspond actuellement à votre recherche ou à vos filtres.",

  emptyActionHref =
    "/events",

  emptyActionLabel =
    "Voir tous les événements",

  eventBasePath =
    "/events",

  className,

  onFavoriteChange,
}: ClientAllEventsProps) {
  const [
    viewMode,
    setViewMode,
  ] =
    useState<ClientEventsViewMode>(
      normalizeViewMode(
        initialView,
      ),
    );

  const favoriteIds =
    useMemo(
      () =>
        normalizeFavoriteIds(
          favoriteEventIds,
        ),
      [
        favoriteEventIds,
      ],
    );

  const totalItems =
    Math.max(
      pagination.totalItems,
      0,
    );

  const currentPage =
    Math.max(
      pagination.page,
      1,
    );

  const totalPages =
    Math.max(
      pagination.totalPages,
      0,
    );

  const displayedCount =
    events.length;

  return (
    <section
      aria-labelledby="client-all-events-title"
      className={cn(
        "w-full min-w-0",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-4 border-b border-white/[0.07] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-500/20 bg-lime-500/[0.07] text-lime-300">
              <CalendarDays
                aria-hidden="true"
                className="h-[18px] w-[18px]"
              />
            </span>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="client-all-events-title"
                  className="text-xl font-black tracking-tight text-white sm:text-2xl"
                >
                  {
                    title
                  }
                </h2>

                <span className="inline-flex h-7 items-center rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 text-[10px] font-black text-neutral-400">
                  {
                    formatEventCount(
                      totalItems,
                    )
                  }
                </span>
              </div>

              <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-600 sm:text-sm">
                {
                  description
                }
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-[11px] font-semibold text-neutral-600 sm:inline">
            Affichage
          </span>

          <div
            role="group"
            aria-label="Choisir le mode d’affichage"
            className="inline-flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-1"
          >
            <button
              type="button"
              onClick={() =>
                setViewMode(
                  "grid",
                )
              }
              aria-label="Afficher en grille"
              aria-pressed={
                viewMode ===
                "grid"
              }
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-lime-400/70",
                viewMode ===
                  "grid"
                  ? "bg-lime-500/[0.1] text-lime-300"
                  : "text-neutral-600 hover:bg-white/[0.04] hover:text-white",
              )}
            >
              <Grid2X2
                aria-hidden="true"
                className="h-4 w-4"
              />
            </button>

            <button
              type="button"
              onClick={() =>
                setViewMode(
                  "list",
                )
              }
              aria-label="Afficher en liste"
              aria-pressed={
                viewMode ===
                "list"
              }
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-lime-400/70",
                viewMode ===
                  "list"
                  ? "bg-lime-500/[0.1] text-lime-300"
                  : "text-neutral-600 hover:bg-white/[0.04] hover:text-white",
              )}
            >
              <List
                aria-hidden="true"
                className="h-4 w-4"
              />
            </button>
          </div>
        </div>
      </div>

      {displayedCount >
      0 ? (
        <>
          <div
            role="list"
            aria-label="Liste des événements"
            className={cn(
              "mt-5 w-full min-w-0",
              viewMode ===
                "grid"
                ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                : "space-y-3",
            )}
          >
            {events.map(
              (
                event,
                index,
              ) => (
                <div
                  key={
                    event.id
                  }
                  role="listitem"
                  className="min-w-0"
                >
                  <ClientEventCard
                    event={
                      event
                    }
                    variant={
                      viewMode ===
                      "grid"
                        ? "grid"
                        : "list"
                    }
                    eventBasePath={
                      eventBasePath
                    }
                    priority={
                      index <
                      2
                    }
                    initiallyFavorite={
                      favoriteIds.has(
                        event.id,
                      )
                    }
                    favoriteDisabled={
                      favoriteDisabled
                    }
                    onFavoriteChange={
                      onFavoriteChange
                    }
                  />
                </div>
              ),
            )}
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.018] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-[11px] text-neutral-600">
              <Sparkles
                aria-hidden="true"
                className="h-3.5 w-3.5 text-orange-400"
              />

              <span>
                Page{" "}
                <strong className="font-black text-neutral-300">
                  {
                    currentPage
                  }
                </strong>

                {totalPages >
                  0 && (
                  <>
                    {" "}
                    sur{" "}
                    <strong className="font-black text-neutral-300">
                      {
                        totalPages
                      }
                    </strong>
                  </>
                )}
              </span>
            </div>

            <p className="text-[11px] text-neutral-600">
              {
                formatEventCount(
                  displayedCount,
                )
              }{" "}
              événement
              {displayedCount >
              1
                ? "s"
                : ""}{" "}
              affiché
              {displayedCount >
              1
                ? "s"
                : ""}
            </p>
          </div>
        </>
      ) : (
        <div className="mt-5 rounded-3xl border border-dashed border-white/[0.09] bg-white/[0.018] px-5 py-12 text-center sm:py-14">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.025] text-neutral-600">
            <SearchX
              aria-hidden="true"
              className="h-6 w-6"
            />
          </span>

          <h3 className="mt-4 text-lg font-black text-white">
            {
              emptyTitle
            }
          </h3>

          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-neutral-600">
            {
              emptyDescription
            }
          </p>

          <Link
            href={
              emptyActionHref
            }
            className="group mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-lime-500/20 bg-lime-500/[0.07] px-4 text-xs font-black text-lime-300 outline-none transition hover:border-lime-500/30 hover:bg-lime-500/[0.12] focus-visible:ring-2 focus-visible:ring-lime-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#03070a]"
          >
            {
              emptyActionLabel
            }

            <ArrowRight
              aria-hidden="true"
              className="h-4 w-4 transition group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      )}
    </section>
  );
}