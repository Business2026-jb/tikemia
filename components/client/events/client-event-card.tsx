"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  CalendarDays,
  Clock3,
  Heart,
  MapPin,
  Ticket,
  UserRound,
} from "lucide-react";
import type {
  ReactNode,
} from "react";
import {
  useMemo,
  useState,
} from "react";

import type {
  ClientHomeEvent,
} from "@/lib/client/get-client-home-events";

export type ClientEventCardVariant =
  | "featured"
  | "grid"
  | "list";

export type ClientEventCardProps = {
  event: ClientHomeEvent;

  variant?: ClientEventCardVariant;

  eventBasePath?: string;

  initiallyFavorite?: boolean;
  favoriteDisabled?: boolean;

  showOrganizer?: boolean;
  showAvailability?: boolean;

  priority?: boolean;
  className?: string;

  onFavoriteChange?: (
    eventId: string,
    isFavorite: boolean,
  ) => void | Promise<void>;
};

type EventBadge = {
  label: string;
  className: string;
};

type AvailabilityDisplay = {
  label: string;
  value: string;
  valueClassName: string;
  urgency: boolean;
};

function getAvailabilityDisplay(
  event: ClientHomeEvent,
): AvailabilityDisplay {
  if (
    event.availability.soldOut
  ) {
    return {
      label:
        "Disponibilité",

      value:
        "Épuisé",

      valueClassName:
        "text-red-400",

      urgency:
        false,
    };
  }

  const availableTickets =
    Math.max(
      event.availability.availableTickets,
      0,
    );

  if (
    availableTickets > 0 &&
    availableTickets <= 10
  ) {
    return {
      label:
        "Dernières places",

      value:
        `${availableTickets} restante${
          availableTickets > 1
            ? "s"
            : ""
        }`,

      valueClassName:
        "text-orange-400",

      urgency:
        true,
    };
  }

  return {
    label:
      "Disponible",

    value:
      availableTickets.toLocaleString(
        "fr-FR",
      ),

    valueClassName:
      "text-lime-400",

    urgency:
      false,
  };
}

function cn(
  ...classes: Array<
    string | false | null | undefined
  >
): string {
  return classes
    .filter(Boolean)
    .join(" ");
}

function normalizeEventHref({
  basePath,
  slug,
}: {
  basePath: string;
  slug: string;
}): string {
  const normalizedBasePath =
    basePath.trim().replace(/\/+$/, "") ||
    "/events";

  return `${normalizedBasePath}/${encodeURIComponent(
    slug,
  )}`;
}

function formatEventDate(
  startsAt: string,
): string {
  const date =
    new Date(startsAt);

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
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

function formatEventTime(
  startsAt: string,
): string {
  const date =
    new Date(startsAt);

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
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}

function formatEventPrice(
  event: ClientHomeEvent,
): string {
  if (
    event.price.isFree
  ) {
    return "Gratuit";
  }

  const amount =
    Number.isFinite(
      event.price.amount,
    )
      ? event.price.amount
      : 0;

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency:
          event.price.currency ||
          event.currency ||
          "XOF",
        maximumFractionDigits:
          [
            "XOF",
            "XAF",
          ].includes(
            event.price.currency ||
              event.currency,
          )
            ? 0
            : 2,
      },
    ).format(amount);
  } catch {
    return `${amount.toLocaleString(
      "fr-FR",
    )} ${
      event.price.currency ||
      event.currency
    }`;
  }
}

function getEventBadge(
  event: ClientHomeEvent,
): EventBadge | null {
  if (
    event.isFeatured
  ) {
    return {
      label:
        "À la une",

      className:
        "border-amber-300/30 bg-amber-400 text-[#211500]",
    };
  }

  const publishedAt =
    event.publishedAt
      ? new Date(
          event.publishedAt,
        )
      : null;

  const sevenDaysAgo =
    Date.now() -
    7 *
      24 *
      60 *
      60 *
      1000;

  if (
    publishedAt &&
    !Number.isNaN(
      publishedAt.getTime(),
    ) &&
    publishedAt.getTime() >=
      sevenDaysAgo
  ) {
    return {
      label:
        "Nouveau",

      className:
        "border-lime-400/30 bg-lime-500 text-[#071000]",
    };
  }

  if (
    event.paidOrdersCount >=
      10 ||
    event.soldTicketsCount >=
      25
  ) {
    return {
      label:
        "Populaire",

      className:
        "border-red-400/30 bg-red-500 text-white",
    };
  }

  return null;
}

function getCategoryClassName(
  slug?: string,
): string {
  const normalized =
    slug
      ?.trim()
      .toLowerCase() ??
    "";

  if (
    normalized.includes(
      "festival",
    )
  ) {
    return "border-fuchsia-500/25 bg-fuchsia-500/[0.12] text-fuchsia-300";
  }

  if (
    normalized.includes(
      "conference",
    ) ||
    normalized.includes(
      "conférence",
    )
  ) {
    return "border-sky-500/25 bg-sky-500/[0.12] text-sky-300";
  }

  if (
    normalized.includes(
      "theatre",
    ) ||
    normalized.includes(
      "théâtre",
    )
  ) {
    return "border-orange-500/25 bg-orange-500/[0.12] text-orange-300";
  }

  if (
    normalized.includes(
      "sport",
    )
  ) {
    return "border-cyan-500/25 bg-cyan-500/[0.12] text-cyan-300";
  }

  return "border-lime-500/25 bg-lime-500/[0.11] text-lime-300";
}

function EventImage({
  event,
  priority,
  sizes,
}: {
  event: ClientHomeEvent;
  priority: boolean;
  sizes: string;
}) {
  if (
    !event.coverImage
  ) {
    return (
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(132,204,22,0.22),transparent_34%),radial-gradient(circle_at_85%_20%,rgba(249,115,22,0.2),transparent_34%),linear-gradient(145deg,#101c20,#05090c_65%)]"
      >
        <Ticket
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-white/10"
        />
      </div>
    );
  }

  return (
    <Image
      src={
        event.coverImage
      }
      alt={
        event.title
      }
      fill
      priority={
        priority
      }
      sizes={
        sizes
      }
      className="object-cover transition duration-500 group-hover:scale-[1.035]"
    />
  );
}

function FavoriteButton({
  event,
  initiallyFavorite,
  disabled,
  onFavoriteChange,
}: {
  event: ClientHomeEvent;
  initiallyFavorite: boolean;
  disabled: boolean;
  onFavoriteChange?: (
    eventId: string,
    isFavorite: boolean,
  ) => void | Promise<void>;
}) {
  const [
    isFavorite,
    setIsFavorite,
  ] =
    useState(
      initiallyFavorite,
    );

  const [
    isSubmitting,
    setIsSubmitting,
  ] =
    useState(false);

  async function handleFavoriteClick(): Promise<void> {
    if (
      disabled ||
      isSubmitting
    ) {
      return;
    }

    const nextValue =
      !isFavorite;

    setIsFavorite(
      nextValue,
    );

    if (
      !onFavoriteChange
    ) {
      return;
    }

    setIsSubmitting(
      true,
    );

    try {
      await onFavoriteChange(
        event.id,
        nextValue,
      );
    } catch (error) {
      setIsFavorite(
        !nextValue,
      );

      console.error(
        "[CLIENT_EVENT_CARD_FAVORITE_ERROR]",
        error,
      );
    } finally {
      setIsSubmitting(
        false,
      );
    }
  }

  return (
    <button
      type="button"
      aria-label={
        isFavorite
          ? `Retirer ${event.title} des favoris`
          : `Ajouter ${event.title} aux favoris`
      }
      aria-pressed={
        isFavorite
      }
      disabled={
        disabled ||
        isSubmitting
      }
      onClick={(
        clickEvent,
      ) => {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();

        void handleFavoriteClick();
      }}
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border backdrop-blur-md transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
        isFavorite
          ? "border-red-400/35 bg-red-500/20 text-red-400"
          : "border-white/20 bg-black/35 text-white hover:border-white/35 hover:bg-black/55",
      )}
    >
      <Heart
        className={cn(
          "h-[19px] w-[19px]",
          isFavorite &&
            "fill-current",
        )}
      />
    </button>
  );
}

function OrganizerLine({
  event,
}: {
  event: ClientHomeEvent;
}) {
  const organizerImage =
    event.organizer.logo ||
    event.organizer.avatar;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.09] bg-white/[0.04]">
        {organizerImage ? (
          <Image
            src={
              organizerImage
            }
            alt={
              event.organizer
                .displayName
            }
            fill
            sizes="24px"
            className="object-cover"
          />
        ) : (
          <UserRound
            aria-hidden="true"
            className="h-3.5 w-3.5 text-neutral-500"
          />
        )}
      </span>

      <span className="min-w-0 truncate text-[11px] text-neutral-500">
        Par{" "}
        <strong className="font-bold text-neutral-300">
          {
            event.organizer
              .displayName
          }
        </strong>
      </span>

      {event.organizer
        .hasBlueBadge && (
        <BadgeCheck
          aria-label="Organisateur vérifié"
          className="h-3.5 w-3.5 shrink-0 fill-sky-400 text-[#071014]"
        />
      )}
    </div>
  );
}

function EventMeta({
  icon: Icon,
  children,
  className,
}: {
  icon:
    | typeof CalendarDays
    | typeof MapPin
    | typeof Clock3;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-start gap-2 text-xs text-neutral-500",
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-600"
      />

      <span className="min-w-0 truncate">
        {children}
      </span>
    </div>
  );
}

export default function ClientEventCard({
  event,

  variant = "grid",

  eventBasePath = "/events",

  initiallyFavorite = false,
  favoriteDisabled = false,

  showOrganizer = true,
  showAvailability = true,

  priority = false,
  className,

  onFavoriteChange,
}: ClientEventCardProps) {
  const eventHref =
    normalizeEventHref({
      basePath:
        eventBasePath,

      slug:
        event.slug,
    });

  const eventDate =
    useMemo(
      () =>
        formatEventDate(
          event.startsAt,
        ),
      [
        event.startsAt,
      ],
    );

  const eventTime =
    useMemo(
      () =>
        formatEventTime(
          event.startsAt,
        ),
      [
        event.startsAt,
      ],
    );

  const eventPrice =
    useMemo(
      () =>
        formatEventPrice(
          event,
        ),
      [
        event,
      ],
    );

  const badge =
    useMemo(
      () =>
        getEventBadge(
          event,
        ),
      [
        event,
      ],
    );

  const availability =
    useMemo(
      () =>
        getAvailabilityDisplay(
          event,
        ),
      [
        event,
      ],
    );

  if (
    variant === "list"
  ) {
    return (
      <article
        className={cn(
          "group relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071014] transition hover:-translate-y-0.5 hover:border-white/[0.14] hover:shadow-[0_18px_50px_rgba(0,0,0,0.28)]",
          className,
        )}
      >
        <Link
          href={
            eventHref
          }
          aria-label={`Voir l’événement ${event.title}`}
          className="grid min-w-0 grid-cols-[112px_minmax(0,1fr)] outline-none focus-visible:ring-2 focus-visible:ring-lime-400/70 focus-visible:ring-inset sm:grid-cols-[190px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]"
        >
          <div className="relative min-h-[158px] overflow-hidden sm:min-h-[190px]">
            <EventImage
              event={
                event
              }
              priority={
                priority
              }
              sizes="(max-width: 640px) 112px, (max-width: 1024px) 190px, 240px"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />

            {badge && (
              <span
                className={cn(
                  "absolute left-2 top-2 inline-flex h-6 items-center rounded-lg border px-2 text-[9px] font-black uppercase tracking-[0.05em]",
                  badge.className,
                )}
              >
                {
                  badge.label
                }
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-col justify-between p-3 sm:p-4">
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {event.category && (
                    <span
                      className={cn(
                        "inline-flex rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-[0.06em]",
                        getCategoryClassName(
                          event.category
                            .slug,
                        ),
                      )}
                    >
                      {
                        event.category
                          .name
                      }
                    </span>
                  )}

                  <h2 className="mt-2 line-clamp-2 text-base font-black leading-tight text-white sm:text-lg">
                    {
                      event.title
                    }
                  </h2>
                </div>

                <FavoriteButton
                  event={
                    event
                  }
                  initiallyFavorite={
                    initiallyFavorite
                  }
                  disabled={
                    favoriteDisabled
                  }
                  onFavoriteChange={
                    onFavoriteChange
                  }
                />
              </div>

              {showOrganizer && (
                <div className="mt-2">
                  <OrganizerLine
                    event={
                      event
                    }
                  />
                </div>
              )}

              <div className="mt-3 grid gap-2">
                <EventMeta
                  icon={
                    CalendarDays
                  }
                >
                  {eventDate}
                  {eventTime
                    ? ` · ${eventTime}`
                    : ""}
                </EventMeta>

                <EventMeta
                  icon={
                    MapPin
                  }
                >
                  {event.venueName}
                  {event.city
                    ? `, ${event.city}`
                    : ""}
                </EventMeta>
              </div>
            </div>

            <div className="mt-4 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] text-neutral-600">
                  {event.price
                    .isFree
                    ? "Entrée"
                    : "À partir de"}
                </p>

                <p className="truncate text-sm font-black text-lime-400 sm:text-base">
                  {
                    eventPrice
                  }
                </p>
              </div>

              {showAvailability && (
                <div className="shrink-0 text-right">
                  <p className="text-[10px] text-neutral-600">
                    {
                      availability.label
                    }
                  </p>

                  <p
                    className={cn(
                      "text-sm font-black sm:text-base",
                      availability.valueClassName,
                    )}
                  >
                    {
                      availability.value
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        </Link>
      </article>
    );
  }

  const featured =
    variant === "featured";

  return (
    <article
      className={cn(
        "group relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071014] transition hover:-translate-y-1 hover:border-white/[0.15] hover:shadow-[0_22px_60px_rgba(0,0,0,0.34)]",
        featured
          ? "w-[84vw] max-w-[300px] shrink-0 snap-start min-[390px]:w-[78vw] sm:w-[280px] lg:w-auto"
          : "w-full",
        className,
      )}
    >
      <Link
        href={
          eventHref
        }
        aria-label={`Voir l’événement ${event.title}`}
        className="flex h-full min-w-0 flex-col outline-none focus-visible:ring-2 focus-visible:ring-lime-400/70 focus-visible:ring-inset"
      >
        <div
          className={cn(
            "relative overflow-hidden",
            featured
              ? "aspect-[1.28/1]"
              : "aspect-[1.35/1]",
          )}
        >
          <EventImage
            event={
              event
            }
            priority={
              priority
            }
            sizes={
              featured
                ? "(max-width: 640px) 250px, (max-width: 1024px) 280px, 20vw"
                : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            }
          />

          <div className="absolute inset-0 bg-gradient-to-t from-[#071014] via-black/5 to-black/35" />

          {badge && (
            <span
              className={cn(
                "absolute left-3 top-3 inline-flex h-7 items-center rounded-lg border px-2.5 text-[10px] font-black uppercase tracking-[0.05em]",
                badge.className,
              )}
            >
              {
                badge.label
              }
            </span>
          )}

          <div className="absolute right-3 top-3">
            <FavoriteButton
              event={
                event
              }
              initiallyFavorite={
                initiallyFavorite
              }
              disabled={
                favoriteDisabled
              }
              onFavoriteChange={
                onFavoriteChange
              }
            />
          </div>

          {availability.urgency && (
            <div className="absolute inset-x-3 bottom-3 rounded-xl border border-orange-500/30 bg-orange-500/18 px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.08em] text-orange-300 backdrop-blur-md">
              Dernières places
            </div>
          )}

          {event.availability
            .soldOut && (
            <div className="absolute inset-x-3 bottom-3 rounded-xl border border-red-500/25 bg-red-500/15 px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.08em] text-red-300 backdrop-blur-md">
              Complet
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-3.5 sm:p-4">
          {event.category && (
            <span
              className={cn(
                "w-fit rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-[0.06em]",
                getCategoryClassName(
                  event.category.slug,
                ),
              )}
            >
              {
                event.category.name
              }
            </span>
          )}

          <h2 className="mt-2 line-clamp-2 text-base font-black leading-tight text-white sm:text-lg">
            {
              event.title
            }
          </h2>

          {showOrganizer && (
            <div className="mt-2">
              <OrganizerLine
                event={
                  event
                }
              />
            </div>
          )}

          <div className="mt-3 space-y-2">
            <EventMeta
              icon={
                CalendarDays
              }
            >
              {eventDate}
              {eventTime
                ? ` · ${eventTime}`
                : ""}
            </EventMeta>

            <EventMeta
              icon={
                MapPin
              }
            >
              {event.venueName}
              {event.city
                ? `, ${event.city}`
                : ""}
            </EventMeta>
          </div>

          <div className="mt-auto flex items-end justify-between gap-3 pt-4">
            <div className="min-w-0">
              <p className="text-[10px] text-neutral-600">
                {event.price.isFree
                  ? "Entrée"
                  : "À partir de"}
              </p>

              <p className="truncate text-sm font-black text-lime-400 sm:text-base">
                {
                  eventPrice
                }
              </p>
            </div>

            {showAvailability && (
              <div className="shrink-0 text-right">
                <p className="text-[9px] text-neutral-600">
                  {
                    availability.label
                  }
                </p>

                <p
                  className={cn(
                    "text-sm font-black",
                    availability.valueClassName,
                  )}
                >
                  {
                    availability.value
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}