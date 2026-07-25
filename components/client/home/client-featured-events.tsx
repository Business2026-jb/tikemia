"use client";

import Link from "next/link";
import {
  ArrowRight,
  Flame,
  Sparkles,
} from "lucide-react";

import ClientEventCard from "@/components/client/events/client-event-card";
import type {
  ClientHomeEvent,
} from "@/lib/client/get-client-home-events";

export type ClientFeaturedEventsProps = {
  events: ClientHomeEvent[];

  title?: string;
  description?: string;

  viewAllHref?: string;
  viewAllLabel?: string;

  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionHref?: string;
  emptyActionLabel?: string;

  priorityCount?: number;

  favoriteEventIds?: readonly string[];
  favoriteDisabled?: boolean;

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

function normalizePriorityCount(
  value: number | undefined,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    return 2;
  }

  return Math.min(
    value,
    6,
  );
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

export default function ClientFeaturedEvents({
  events,

  title =
    "Événements à ne pas manquer",

  description =
    "Une sélection d’événements mis en avant pour vivre les meilleures expériences.",

  viewAllHref =
    "/events?featured=true",

  viewAllLabel =
    "Voir tout",

  emptyTitle =
    "Aucun événement à la une",

  emptyDescription =
    "Les prochains événements mis en avant apparaîtront ici.",

  emptyActionHref =
    "/events",

  emptyActionLabel =
    "Explorer les événements",

  priorityCount = 2,

  favoriteEventIds = [],
  favoriteDisabled = false,

  className,

  onFavoriteChange,
}: ClientFeaturedEventsProps) {
  const normalizedPriorityCount =
    normalizePriorityCount(
      priorityCount,
    );

  const favoriteIds =
    normalizeFavoriteIds(
      favoriteEventIds,
    );

  return (
    <section
      aria-labelledby="client-featured-events-title"
      className={cn(
        "w-full min-w-0",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/[0.08] text-orange-300">
              <Flame
                aria-hidden="true"
                className="h-4 w-4"
              />
            </span>

            <div className="min-w-0">
              <h2
                id="client-featured-events-title"
                className="truncate text-xl font-black tracking-tight text-white sm:text-2xl"
              >
                {
                  title
                }
              </h2>

              <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-600 sm:text-sm">
                {
                  description
                }
              </p>
            </div>
          </div>
        </div>

        <Link
          href={
            viewAllHref
          }
          className="group inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-lime-500/20 bg-lime-500/[0.06] px-4 text-xs font-black text-lime-300 outline-none transition hover:border-lime-500/30 hover:bg-lime-500/[0.1] focus-visible:ring-2 focus-visible:ring-lime-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#03070a] sm:self-auto"
        >
          {
            viewAllLabel
          }

          <ArrowRight
            aria-hidden="true"
            className="h-4 w-4 transition group-hover:translate-x-0.5"
          />
        </Link>
      </div>

      {events.length > 0 ? (
        <div className="relative mt-5">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-4 top-0 z-10 hidden h-full w-10 bg-gradient-to-r from-[#03070a] to-transparent sm:block lg:hidden"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-4 top-0 z-10 hidden h-full w-10 bg-gradient-to-l from-[#03070a] to-transparent sm:block lg:hidden"
          />

          <div
            role="list"
            aria-label="Événements mis en avant"
            className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-3 [overscroll-behavior-x:contain] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-5 sm:scroll-px-5 sm:gap-4 sm:px-5 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0 xl:grid-cols-5"
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
                  className="snap-start"
                >
                  <ClientEventCard
                    event={
                      event
                    }
                    variant="featured"
                    priority={
                      index <
                      normalizedPriorityCount
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
                    className="lg:w-full"
                  />
                </div>
              ),
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 lg:hidden">
            <p className="min-w-0 text-[10px] font-medium text-neutral-700">
              Faites glisser pour voir plus d’événements
            </p>

            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-neutral-600">
              <Sparkles
                aria-hidden="true"
                className="h-3 w-3"
              />

              {
                events.length
              }{" "}
              sélection
              {events.length > 1
                ? "s"
                : ""}
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-3xl border border-dashed border-white/[0.09] bg-white/[0.018] px-5 py-10 text-center sm:py-12">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/[0.07] text-orange-300">
            <Sparkles
              aria-hidden="true"
              className="h-5 w-5"
            />
          </span>

          <h3 className="mt-4 text-base font-black text-white">
            {
              emptyTitle
            }
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-600">
            {
              emptyDescription
            }
          </p>

          <Link
            href={
              emptyActionHref
            }
            className="mt-5 inline-flex h-10 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-xs font-black text-neutral-300 outline-none transition hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-white focus-visible:ring-2 focus-visible:ring-lime-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#03070a]"
          >
            {
              emptyActionLabel
            }
          </Link>
        </div>
      )}
    </section>
  );
}