"use client";

import Link from "next/link";
import {
  ArrowRight,
  Grid2X2,
  List,
  SearchX,
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
      .map((value) =>
        value.trim(),
      )
      .filter(Boolean),
  );
}

function formatEventCount(
  value: number,
): string {
  const count = Math.max(
    Math.trunc(value),
    0,
  );

  return new Intl.NumberFormat(
    "fr-FR",
  ).format(count);
}

export default function ClientAllEvents({
  events,
  pagination,

  title = "Tous les événements",

  description =
    "Découvrez les meilleurs événements près de chez vous.",

  initialView = "grid",

  favoriteEventIds = [],
  favoriteDisabled = false,

  emptyTitle =
    "Aucun événement trouvé",

  emptyDescription =
    "Aucun événement ne correspond actuellement à votre recherche ou à vos filtres.",

  emptyActionHref = "/events",

  emptyActionLabel =
    "Voir tous les événements",

  eventBasePath = "/events",

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
      [favoriteEventIds],
    );

  const totalItems = Math.max(
    pagination.totalItems,
    0,
  );

  const currentPage = Math.max(
    pagination.page,
    1,
  );

  const totalPages = Math.max(
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
      <div className="flex min-w-0 items-end justify-between gap-4">
        <div className="min-w-0">
          <h2
            id="client-all-events-title"
            className="text-[22px] font-black leading-tight tracking-[-0.025em] text-white sm:text-2xl lg:text-3xl"
          >
            {title}
          </h2>

          <p className="mt-1 text-xs leading-5 text-neutral-500 sm:text-sm">
            {description}
          </p>
        </div>

        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <span className="hidden text-[11px] font-semibold text-neutral-500 lg:inline">
            Affichage
          </span>

          <div
            role="group"
            aria-label="Choisir le mode d’affichage"
            className="inline-flex rounded-xl border border-white/[0.09] bg-[#071014] p-1 shadow-[0_12px_35px_rgba(0,0,0,0.25)]"
          >
            <button
              type="button"
              onClick={() =>
                setViewMode("grid")
              }
              aria-label="Afficher en grille"
              aria-pressed={
                viewMode === "grid"
              }
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-lime-400/70",
                viewMode === "grid"
                  ? "border border-lime-500/20 bg-lime-500/[0.14] text-lime-400"
                  : "text-neutral-500 hover:bg-white/[0.04] hover:text-white",
              )}
            >
              <Grid2X2
                aria-hidden="true"
                className="h-[18px] w-[18px]"
              />
            </button>

            <button
              type="button"
              onClick={() =>
                setViewMode("list")
              }
              aria-label="Afficher en liste"
              aria-pressed={
                viewMode === "list"
              }
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-lime-400/70",
                viewMode === "list"
                  ? "border border-lime-500/20 bg-lime-500/[0.14] text-lime-400"
                  : "text-neutral-500 hover:bg-white/[0.04] hover:text-white",
              )}
            >
              <List
                aria-hidden="true"
                className="h-[19px] w-[19px]"
              />
            </button>
          </div>
        </div>
      </div>

      {displayedCount > 0 ? (
        <>
          {/*
            VERSION MOBILE

            Sur téléphone, les événements sont toujours
            affichés en liste horizontale comme sur
            l’image de référence.
          */}
          <div
            role="list"
            aria-label="Liste des événements"
            className="mt-5 space-y-3 sm:hidden"
          >
            {events.map(
              (
                event,
                index,
              ) => (
                <div
                  key={event.id}
                  role="listitem"
                  className="min-w-0 overflow-hidden"
                >
                  <ClientEventCard
                    event={event}
                    variant="list"
                    eventBasePath={
                      eventBasePath
                    }
                    priority={
                      index < 2
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

          {/*
            VERSION TABLETTE ET PC

            Le visiteur peut choisir entre la grille
            et la liste sans modifier la présentation
            mobile.
          */}
          <div
            role="list"
            aria-label="Liste des événements"
            className={cn(
              "mt-6 hidden w-full min-w-0 sm:block",
              viewMode === "grid"
                ? "sm:grid sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4"
                : "sm:space-y-3",
            )}
          >
            {events.map(
              (
                event,
                index,
              ) => (
                <div
                  key={event.id}
                  role="listitem"
                  className="min-w-0"
                >
                  <ClientEventCard
                    event={event}
                    variant={
                      viewMode === "grid"
                        ? "grid"
                        : "list"
                    }
                    eventBasePath={
                      eventBasePath
                    }
                    priority={
                      index < 2
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

          <div className="mt-5 flex flex-col gap-2 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] font-medium text-neutral-600">
              {formatEventCount(
                totalItems,
              )}{" "}
              événement
              {totalItems > 1
                ? "s"
                : ""}{" "}
              disponible
              {totalItems > 1
                ? "s"
                : ""}
            </p>

            {totalPages > 0 && (
              <p className="text-[11px] font-medium text-neutral-600">
                Page{" "}
                <strong className="font-black text-neutral-300">
                  {currentPage}
                </strong>{" "}
                sur{" "}
                <strong className="font-black text-neutral-300">
                  {totalPages}
                </strong>
              </p>
            )}
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
            {emptyTitle}
          </h3>

          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-neutral-600">
            {emptyDescription}
          </p>

          <Link
            href={emptyActionHref}
            className="group mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-lime-500/20 bg-lime-500/[0.07] px-4 text-xs font-black text-lime-300 outline-none transition hover:border-lime-500/30 hover:bg-lime-500/[0.12] focus-visible:ring-2 focus-visible:ring-lime-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#03070a]"
          >
            {emptyActionLabel}

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