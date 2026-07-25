"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  CalendarDays,
  Clock3,
  MapPin,
  Ticket,
} from "lucide-react";

import type {
  ClientEventDetail,
} from "@/lib/client/get-client-event-detail";

export type ClientEventSummaryProps = {
  event: ClientEventDetail;

  organizerProfileHref?: string | null;

  showOrganizer?: boolean;
  showAvailability?: boolean;
  showPrice?: boolean;

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
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Date à confirmer";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      weekday:
        "long",

      day:
        "2-digit",

      month:
        "long",

      year:
        "numeric",

      timeZone:
        timezone ||
        undefined,
    },
  ).format(date);
}

function formatEventTime({
  value,
  timezone,
}: {
  value: string;
  timezone: string;
}): string {
  const date =
    new Date(value);

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
      hour:
        "2-digit",

      minute:
        "2-digit",

      timeZone:
        timezone ||
        undefined,
    },
  ).format(date);
}

function formatMoney({
  amount,
  currency,
}: {
  amount: number;
  currency: string;
}): string {
  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style:
          "currency",

        currency,

        maximumFractionDigits:
          [
            "XOF",
            "XAF",
          ].includes(
            currency,
          )
            ? 0
            : 2,
      },
    ).format(
      Math.max(
        amount,
        0,
      ),
    );
  } catch {
    return `${Math.max(
      amount,
      0,
    ).toLocaleString(
      "fr-FR",
    )} ${currency}`;
  }
}

function getOrganizerInitials(
  displayName: string,
): string {
  const parts =
    displayName
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (
    parts.length === 0
  ) {
    return "T";
  }

  if (
    parts.length === 1
  ) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0]?.[0] ?? ""}${
    parts[parts.length - 1]?.[0] ?? ""
  }`.toUpperCase();
}

function getAvailabilityLabel(
  event: ClientEventDetail,
): {
  label: string;
  className: string;
} {
  if (
    event.availability.soldOut
  ) {
    return {
      label:
        "Complet",

      className:
        "border-red-500/20 bg-red-500/[0.08] text-red-400",
    };
  }

  if (
    !event.sales.isOpen
  ) {
    return {
      label:
        event.sales.status ===
        "NOT_STARTED"
          ? "Vente à venir"
          : "Vente indisponible",

      className:
        "border-white/[0.08] bg-white/[0.03] text-neutral-500",
    };
  }

  if (
    event.availability.availableTickets <=
    10
  ) {
    return {
      label:
        `${event.availability.availableTickets} place${
          event.availability.availableTickets > 1
            ? "s"
            : ""
        } restante${
          event.availability.availableTickets > 1
            ? "s"
            : ""
        }`,

      className:
        "border-orange-500/20 bg-orange-500/[0.08] text-orange-300",
    };
  }

  return {
    label:
      `${event.availability.availableTickets.toLocaleString(
        "fr-FR",
      )} places disponibles`,

    className:
      "border-lime-500/20 bg-lime-500/[0.08] text-lime-300",
  };
}

export default function ClientEventSummary({
  event,

  organizerProfileHref =
    null,

  showOrganizer = true,
  showAvailability = true,
  showPrice = true,

  className,
}: ClientEventSummaryProps) {
  const organizerImage =
    event.organizer.logo ||
    event.organizer.avatar;

  const eventDate =
    formatEventDate({
      value:
        event.startsAt,

      timezone:
        event.timezone,
    });

  const eventTime =
    formatEventTime({
      value:
        event.startsAt,

      timezone:
        event.timezone,
    });

  const availability =
    getAvailabilityLabel(
      event,
    );

  return (
    <section
      aria-labelledby="client-event-summary-title"
      className={cn(
        "w-full rounded-3xl border border-white/[0.08] bg-[#071014] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)] sm:p-5 lg:p-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {event.category && (
          <span className="inline-flex rounded-full border border-lime-500/20 bg-lime-500/[0.08] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-lime-300">
            {
              event.category.name
            }
          </span>
        )}

        {event.isFeatured && (
          <span className="inline-flex rounded-full border border-orange-500/20 bg-orange-500/[0.08] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-orange-300">
            À la une
          </span>
        )}

        {showAvailability && (
          <span
            className={cn(
              "inline-flex rounded-full border px-3 py-1.5 text-[10px] font-black",
              availability.className,
            )}
          >
            {
              availability.label
            }
          </span>
        )}
      </div>

      <h1
        id="client-event-summary-title"
        className="mt-4 text-3xl font-black leading-tight tracking-[-0.03em] text-white sm:text-4xl lg:text-5xl"
      >
        {
          event.title
        }
      </h1>

      {event.shortDescription && (
        <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-400 sm:text-base sm:leading-8">
          {
            event.shortDescription
          }
        </p>
      )}

      {showOrganizer && (
        <div className="mt-5 flex min-w-0 items-center gap-3 border-t border-white/[0.07] pt-5">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.09] bg-white/[0.04]">
            {organizerImage ? (
              <Image
                src={
                  organizerImage
                }
                alt={
                  event.organizer.displayName
                }
                fill
                sizes="44px"
                className="object-cover"
              />
            ) : (
              <span className="text-xs font-black text-neutral-400">
                {
                  getOrganizerInitials(
                    event.organizer.displayName,
                  )
                }
              </span>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
              Organisé par
            </p>

            <div className="mt-1 flex min-w-0 items-center gap-2">
              {organizerProfileHref ? (
                <Link
                  href={
                    organizerProfileHref
                  }
                  className="truncate text-sm font-black text-white outline-none transition hover:text-lime-300 focus-visible:ring-2 focus-visible:ring-lime-400/70"
                >
                  {
                    event.organizer.displayName
                  }
                </Link>
              ) : (
                <span className="truncate text-sm font-black text-white">
                  {
                    event.organizer.displayName
                  }
                </span>
              )}

              {event.organizer.hasBlueBadge && (
                <BadgeCheck
                  aria-label="Organisateur vérifié"
                  className="h-4 w-4 shrink-0 text-lime-400"
                />
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-400">
              <CalendarDays
                aria-hidden="true"
                className="h-4 w-4"
              />
            </span>

            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
                Date
              </p>

              <p className="mt-1 text-sm font-black capitalize text-white">
                {
                  eventDate
                }
              </p>

              {eventTime && (
                <p className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                  <Clock3
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />

                  {
                    eventTime
                  }
                </p>
              )}
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-400">
              <MapPin
                aria-hidden="true"
                className="h-4 w-4"
              />
            </span>

            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
                Lieu
              </p>

              <p className="mt-1 text-sm font-black text-white">
                {
                  event.venueName
                }
              </p>

              <p className="mt-1 text-xs leading-5 text-neutral-500">
                {
                  [
                    event.city,
                    event.country,
                  ]
                    .filter(Boolean)
                    .join(", ")
                }
              </p>
            </div>
          </div>
        </article>
      </div>

      {showPrice && (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-lime-500/15 bg-lime-500/[0.045] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-500/20 bg-lime-500/[0.08] text-lime-300">
              <Ticket
                aria-hidden="true"
                className="h-4 w-4"
              />
            </span>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
                Tarif
              </p>

              <p className="mt-1 text-sm font-bold text-neutral-400">
                {event.price.isFree
                  ? "Entrée gratuite"
                  : "À partir de"}
              </p>
            </div>
          </div>

          <p className="text-xl font-black text-lime-400 sm:text-2xl">
            {event.price.isFree
              ? "Gratuit"
              : formatMoney({
                  amount:
                    event.price.minimum,

                  currency:
                    event.price.currency,
                })}
          </p>
        </div>
      )}
    </section>
  );
}