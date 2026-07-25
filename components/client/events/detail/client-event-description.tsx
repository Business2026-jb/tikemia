"use client";

import {
  CalendarClock,
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
    <section
      aria-labelledby="client-event-description-title"
      className={cn(
        "w-full rounded-3xl border border-white/[0.08] bg-[#071014] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)] sm:p-5 lg:p-6",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-white/[0.07] pb-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-500/20 bg-lime-500/[0.07] text-lime-300">
          <Info
            aria-hidden="true"
            className="h-4 w-4"
          />
        </span>

        <div className="min-w-0">
          <h2
            id="client-event-description-title"
            className="text-base font-black text-white sm:text-lg"
          >
            {
              title
            }
          </h2>

          {event.shortDescription && (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-600">
              {
                event.shortDescription
              }
            </p>
          )}
        </div>
      </div>

      <div className="mt-5">
        <p className="whitespace-pre-line text-sm leading-7 text-neutral-300 sm:text-[15px] sm:leading-8">
          {
            event.description
          }
        </p>
      </div>

      {showPracticalInformation &&
        practicalItems.length >
          0 && (
        <div className="mt-6 border-t border-white/[0.07] pt-5">
          <div className="flex items-center gap-2">
            <CircleCheck
              aria-hidden="true"
              className="h-4 w-4 text-lime-400"
            />

            <h3 className="text-sm font-black text-white sm:text-base">
              {
                practicalTitle
              }
            </h3>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
      )}
    </section>
  );
}