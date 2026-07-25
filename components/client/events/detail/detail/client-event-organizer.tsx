"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  ExternalLink,
  MapPin,
  TicketCheck,
  UsersRound,
} from "lucide-react";

import type {
  ClientEventDetailOrganizer,
} from "@/lib/client/get-client-event-detail";

export type ClientEventOrganizerProps = {
  organizer: ClientEventDetailOrganizer;

  title?: string;

  showDescription?: boolean;
  showStatistics?: boolean;

  profileHref?: string | null;

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

function formatCount(
  value: number,
): string {
  return new Intl.NumberFormat(
    "fr-FR",
    {
      notation:
        value >= 10_000
          ? "compact"
          : "standard",

      maximumFractionDigits:
        value >= 10_000
          ? 1
          : 0,
    },
  ).format(
    Math.max(
      Math.trunc(value),
      0,
    ),
  );
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

export default function ClientEventOrganizer({
  organizer,

  title =
    "Organisateur",

  showDescription = true,
  showStatistics = true,

  profileHref = null,

  className,
}: ClientEventOrganizerProps) {
  const organizerImage =
    organizer.logo ||
    organizer.avatar;

  const location =
    [
      organizer.city,
      organizer.address,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <section
      aria-labelledby="client-event-organizer-title"
      className={cn(
        "w-full rounded-3xl border border-white/[0.08] bg-[#071014] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)] sm:p-5 lg:p-6",
        className,
      )}
    >
      <div className="mb-5 flex items-center gap-3 border-b border-white/[0.07] pb-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-500/20 bg-lime-500/[0.07] text-lime-300">
          <Building2
            aria-hidden="true"
            className="h-4 w-4"
          />
        </span>

        <div className="min-w-0">
          <h2
            id="client-event-organizer-title"
            className="text-base font-black text-white sm:text-lg"
          >
            {
              title
            }
          </h2>

          <p className="mt-1 text-xs text-neutral-600">
            Informations sur l’organisateur de cet événement.
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.04] shadow-[0_12px_30px_rgba(0,0,0,0.22)] sm:h-20 sm:w-20">
            {organizerImage ? (
              <Image
                src={
                  organizerImage
                }
                alt={
                  organizer.displayName
                }
                fill
                sizes="80px"
                className="object-cover"
              />
            ) : (
              <span className="text-lg font-black text-neutral-400 sm:text-xl">
                {
                  getOrganizerInitials(
                    organizer.displayName,
                  )
                }
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-black text-white sm:text-xl">
                {
                  organizer.displayName
                }
              </h3>

              {organizer.hasBlueBadge && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-500/20 bg-lime-500/[0.08] px-2.5 py-1 text-[10px] font-black text-lime-300">
                  <BadgeCheck
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  />

                  Organisateur vérifié
                </span>
              )}
            </div>

            {organizer.businessType && (
              <p className="mt-1 text-xs font-semibold text-neutral-500">
                {
                  organizer.businessType
                }
              </p>
            )}

            {location && (
              <div className="mt-2 flex min-w-0 items-start gap-2 text-xs text-neutral-500">
                <MapPin
                  aria-hidden="true"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-600"
                />

                <span className="line-clamp-2">
                  {
                    location
                  }
                </span>
              </div>
            )}
          </div>
        </div>

        {profileHref && (
          <Link
            href={
              profileHref
            }
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-xs font-black text-neutral-300 outline-none transition hover:border-lime-500/20 hover:bg-lime-500/[0.07] hover:text-lime-300 focus-visible:ring-2 focus-visible:ring-lime-400/70"
          >
            Voir le profil

            <ExternalLink
              aria-hidden="true"
              className="h-4 w-4"
            />
          </Link>
        )}
      </div>

      {showDescription &&
        organizer.description && (
        <p className="mt-5 text-sm leading-7 text-neutral-400">
          {
            organizer.description
          }
        </p>
      )}

      {showStatistics && (
        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-3 py-3 text-center sm:px-4">
            <Building2
              aria-hidden="true"
              className="mx-auto h-4 w-4 text-lime-400"
            />

            <p className="mt-2 text-base font-black text-white sm:text-lg">
              {
                formatCount(
                  organizer.publishedEventsCount,
                )
              }
            </p>

            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.08em] text-neutral-600 sm:text-[10px]">
              Événements
            </p>
          </article>

          <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-3 py-3 text-center sm:px-4">
            <TicketCheck
              aria-hidden="true"
              className="mx-auto h-4 w-4 text-orange-400"
            />

            <p className="mt-2 text-base font-black text-white sm:text-lg">
              {
                formatCount(
                  organizer.soldTicketsCount,
                )
              }
            </p>

            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.08em] text-neutral-600 sm:text-[10px]">
              Billets vendus
            </p>
          </article>

          <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-3 py-3 text-center sm:px-4">
            <UsersRound
              aria-hidden="true"
              className="mx-auto h-4 w-4 text-red-400"
            />

            <p className="mt-2 text-base font-black text-white sm:text-lg">
              {
                formatCount(
                  organizer.paidOrdersCount,
                )
              }
            </p>

            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.08em] text-neutral-600 sm:text-[10px]">
              Commandes
            </p>
          </article>
        </div>
      )}
    </section>
  );
}