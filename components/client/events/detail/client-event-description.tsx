"use client";

import {
  useState,
} from "react";

import {
  CalendarClock,
  ChevronDown,
  CircleCheck,
  Info,
  MapPin,
} from "lucide-react";

import type {
  ClientEventDetail,
} from "@/lib/client/get-client-event-detail";

export type ClientEventDescriptionProps = {
  event: ClientEventDetail;

  title?: string;
  practicalTitle?: string;

  showPracticalInformation?: boolean;

  className?: string;
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

function formatEventDate({
  value,
  timezone,
}: {
  value: string;
  timezone: string;
}): string {
  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle:
        "full",

      timeStyle:
        "short",

      timeZone:
        timezone ||
        undefined,
    },
  ).format(
    date,
  );
}

export default function ClientEventDescription({
  event,

  title =
    "À propos de l’événement",

  practicalTitle =
    "Informations pratiques",

  showPracticalInformation = true,

  className,
}: ClientEventDescriptionProps) {
  const [
    descriptionOpen,
    setDescriptionOpen,
  ] =
    useState(
      false,
    );

  const [
    practicalOpen,
    setPracticalOpen,
  ] =
    useState(
      false,
    );

  const startsAtLabel =
    formatEventDate({
      value:
        event.startsAt,

      timezone:
        event.timezone,
    });

  const endsAtLabel =
    event.endsAt
      ? formatEventDate({
          value:
            event.endsAt,

          timezone:
            event.timezone,
        })
      : "";

  const practicalItems =
    [
      startsAtLabel
        ? {
            id:
              "start",

            icon:
              CalendarClock,

            label:
              "Début",

            value:
              startsAtLabel,
          }
        : null,

      endsAtLabel
        ? {
            id:
              "end",

            icon:
              CalendarClock,

            label:
              "Fin",

            value:
              endsAtLabel,
          }
        : null,

      event.venueName
        ? {
            id:
              "venue",

            icon:
              MapPin,

            label:
              "Lieu",

            value:
              [
                event.venueName,
                event.city,
                event.country,
              ]
                .filter(Boolean)
                .join(", "),
          }
        : null,

      event.address
        ? {
            id:
              "address",

            icon:
              Info,

            label:
              "Adresse",

            value:
              event.address,
          }
        : null,
    ].filter(
      (
        item,
      ): item is {
        id: string;
        icon:
          typeof CalendarClock;
        label: string;
        value: string;
      } =>
        Boolean(
          item,
        ),
    );

  return (
    <div
      className={cn(
        "w-full space-y-4",
        className,
      )}
    >
      {/* À propos de l'événement */}
      <section
        className="w-full overflow-hidden rounded-3xl border border-white/[0.08] bg-[#071014] shadow-[0_18px_50px_rgba(0,0,0,0.2)]"
      >
        <button
          type="button"
          aria-expanded={
            descriptionOpen
          }
          aria-controls="client-event-description-content"
          onClick={() => {
            setDescriptionOpen(
              (
                current,
              ) =>
                !current,
            );
          }}
          className="group flex w-full items-center justify-between gap-4 p-4 text-left outline-none transition-colors duration-200 hover:bg-white/[0.02] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime-400/70 sm:p-5 lg:p-6"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-500/20 bg-lime-500/[0.07] text-lime-300">
              <Info
                aria-hidden="true"
                className="h-4 w-4"
              />
            </span>

            <h2
              id="client-event-description-title"
              className="min-w-0 text-base font-black text-white sm:text-lg"
            >
              {
                title
              }
            </h2>
          </div>

          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-400 transition-colors duration-200 group-hover:border-white/[0.12] group-hover:text-white">
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "h-4 w-4 transition-transform duration-300",
                descriptionOpen &&
                  "rotate-180",
              )}
            />
          </span>
        </button>

        <div
          id="client-event-description-content"
          aria-hidden={
            !descriptionOpen
          }
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
            descriptionOpen
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="border-t border-white/[0.07] px-4 pb-5 pt-4 sm:px-5 sm:pb-6 lg:px-6">
              {event.shortDescription && (
                <p className="mb-4 text-sm font-semibold leading-6 text-neutral-400">
                  {
                    event.shortDescription
                  }
                </p>
              )}

              <p className="whitespace-pre-line text-sm leading-7 text-neutral-300 sm:text-[15px] sm:leading-8">
                {
                  event.description
                }
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Informations pratiques */}
      {showPracticalInformation &&
        practicalItems.length >
          0 && (
          <section
            className="w-full overflow-hidden rounded-3xl border border-white/[0.08] bg-[#071014] shadow-[0_18px_50px_rgba(0,0,0,0.2)]"
          >
            <button
              type="button"
              aria-expanded={
                practicalOpen
              }
              aria-controls="client-event-practical-content"
              onClick={() => {
                setPracticalOpen(
                  (
                    current,
                  ) =>
                    !current,
                );
              }}
              className="group flex w-full items-center justify-between gap-4 p-4 text-left outline-none transition-colors duration-200 hover:bg-white/[0.02] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime-400/70 sm:p-5 lg:p-6"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-500/20 bg-lime-500/[0.07] text-lime-300">
                  <CircleCheck
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                </span>

                <h3 className="min-w-0 text-base font-black text-white sm:text-lg">
                  {
                    practicalTitle
                  }
                </h3>
              </div>

              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-400 transition-colors duration-200 group-hover:border-white/[0.12] group-hover:text-white">
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "h-4 w-4 transition-transform duration-300",
                    practicalOpen &&
                      "rotate-180",
                  )}
                />
              </span>
            </button>

            <div
              id="client-event-practical-content"
              aria-hidden={
                !practicalOpen
              }
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                practicalOpen
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="border-t border-white/[0.07] px-4 pb-5 pt-4 sm:px-5 sm:pb-6 lg:px-6">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {practicalItems.map(
                      (
                        item,
                      ) => {
                        const Icon =
                          item.icon;

                        return (
                          <article
                            key={
                              item.id
                            }
                            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"
                          >
                            <div className="flex items-start gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-400">
                                <Icon
                                  aria-hidden="true"
                                  className="h-4 w-4"
                                />
                              </span>

                              <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
                                  {
                                    item.label
                                  }
                                </p>

                                <p className="mt-1 text-sm font-semibold leading-6 text-neutral-300">
                                  {
                                    item.value
                                  }
                                </p>
                              </div>
                            </div>
                          </article>
                        );
                      },
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
    </div>
  );
}