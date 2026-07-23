import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ImageIcon,
  MapPin,
  TicketCheck,
  WalletCards,
} from "lucide-react";

import {
  formatMoney,
  groupMoneyByCurrency,
} from "@/lib/localization/format-money";
import type { DashboardRecentEvent } from "@/lib/organizer/get-organizer-dashboard";

type RecentEventsProps = {
  events: DashboardRecentEvent[];
};

type StatusStyle = {
  label: string;
  className: string;
};

const defaultStatusStyle: StatusStyle = {
  label: "Statut inconnu",
  className:
    "border-white/[0.08] bg-white/[0.04] text-neutral-400",
};

const statusLabels: Record<string, StatusStyle> = {
  DRAFT: {
    label: "Brouillon",
    className:
      "border-white/[0.08] bg-white/[0.04] text-neutral-400",
  },

  PENDING: {
    label: "En attente",
    className:
      "border-amber-500/25 bg-amber-500/10 text-amber-400",
  },

  PUBLISHED: {
    label: "Publié",
    className:
      "border-emerald-500/25 bg-emerald-500/10 text-lime-400",
  },

  SUSPENDED: {
    label: "Suspendu",
    className:
      "border-orange-500/25 bg-orange-500/10 text-orange-400",
  },

  CANCELLED: {
    label: "Annulé",
    className:
      "border-red-500/25 bg-red-500/10 text-red-400",
  },

  COMPLETED: {
    label: "Terminé",
    className:
      "border-sky-500/25 bg-sky-500/10 text-sky-400",
  },

  REJECTED: {
    label: "Rejeté",
    className:
      "border-red-500/25 bg-red-500/10 text-red-400",
  },

  ARCHIVED: {
    label: "Archivé",
    className:
      "border-violet-500/25 bg-violet-500/10 text-violet-400",
  },
};

function formatEventDate(
  date: string,
): string {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Date non disponible";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsedDate);
}

function calculateProgress(
  ticketsSold: number,
  capacity: number,
): number {
  if (
    !Number.isFinite(capacity) ||
    capacity <= 0
  ) {
    return 0;
  }

  return Math.min(
    Math.max(
      (ticketsSold / capacity) * 100,
      0,
    ),
    100,
  );
}

function getValidImageUrl(
  value: string | null | undefined,
): string | null {
  const normalizedValue =
    value?.trim();

  if (!normalizedValue) {
    return null;
  }

  try {
    const imageUrl =
      new URL(normalizedValue);

    if (
      imageUrl.protocol !== "https:" &&
      imageUrl.protocol !== "http:"
    ) {
      return null;
    }

    return imageUrl.toString();
  } catch {
    return normalizedValue.startsWith("/")
      ? normalizedValue
      : null;
  }
}

export default function RecentEvents({
  events,
}: RecentEventsProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
      <header className="flex flex-col gap-4 border-b border-white/[0.07] px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <div className="flex items-center gap-2.5">
            <CalendarDays className="h-5 w-5 text-lime-400" />

            <h2 className="text-lg font-black tracking-[-0.02em] text-white">
              Événements récents
            </h2>
          </div>

          <p className="mt-1.5 text-sm text-neutral-500">
            Vos événements les plus récents et
            leurs performances.
          </p>
        </div>

        <Link
          href="/organizer/events"
          className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-xs font-bold text-neutral-300 transition hover:border-emerald-500/30 hover:bg-emerald-500/[0.05] hover:text-white"
        >
          Voir tous les événements
          <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      {events.length > 0 ? (
        <div className="divide-y divide-white/[0.06]">
          {events.map((event) => {
            const status =
              statusLabels[event.status] ??
              defaultStatusStyle;

            const progress =
              calculateProgress(
                event.ticketsSold,
                event.capacity,
              );

            const imageUrl =
              getValidImageUrl(
                event.coverImage,
              );

            return (
              <article
                key={event.id}
                className="group grid gap-4 px-4 py-4 transition hover:bg-white/[0.018] sm:px-5 lg:grid-cols-[112px_minmax(0,1fr)_minmax(250px,0.72fr)_auto] lg:items-center"
              >
                <Link
                  href={`/organizer/events/${event.id}`}
                  aria-label={`Voir l’événement ${event.title}`}
                  className="relative block h-[180px] w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#050b0f] sm:h-[220px] lg:h-[82px] lg:w-[112px]"
                >
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt={event.title}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-500/10 via-lime-500/[0.04] to-orange-500/10">
                      <ImageIcon className="h-7 w-7 text-neutral-700" />
                    </div>
                  )}

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                </Link>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${status.className}`}
                    >
                      {status.label}
                    </span>

                    <span className="text-[11px] text-neutral-600">
                      {formatEventDate(
                        event.startsAt,
                      )}
                    </span>

                    <span className="rounded-full border border-orange-500/20 bg-orange-500/[0.06] px-2 py-1 text-[10px] font-black text-orange-300">
                      {
                        event.currency
                      }
                    </span>
                  </div>

                  <Link
                    href={`/organizer/events/${event.id}`}
                    className="mt-2 block truncate text-base font-black tracking-[-0.02em] text-white transition hover:text-lime-400"
                  >
                    {event.title}
                  </Link>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-500">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-neutral-600" />

                      {event.city},{" "}
                      {event.country}
                    </span>

                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0 text-neutral-600" />

                      <span className="truncate">
                        {event.venueName}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] text-neutral-600">
                        Billets vendus
                      </p>

                      <p className="mt-1 text-sm font-black text-white">
                        {event.ticketsSold.toLocaleString(
                          "fr-FR",
                        )}

                        <span className="font-normal text-neutral-600">
                          {" "}
                          /{" "}
                          {event.capacity.toLocaleString(
                            "fr-FR",
                          )}
                        </span>
                      </p>
                    </div>

                    <TicketCheck className="h-5 w-5 text-lime-400" />
                  </div>

                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-lime-400 to-orange-400 transition-[width] duration-700"
                      style={{
                        width: `${progress}%`,
                      }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
                    <span className="text-neutral-600">
                      {progress.toLocaleString(
                        "fr-FR",
                        {
                          maximumFractionDigits: 1,
                        },
                      )}
                      % vendu
                    </span>

                    <span className="font-semibold text-neutral-400">
                      {event.remainingPlaces.toLocaleString(
                        "fr-FR",
                      )}{" "}
                      place
                      {event.remainingPlaces > 1
                        ? "s"
                        : ""}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 lg:min-w-[170px] lg:flex-col lg:items-end">
                  <div className="lg:text-right">
                    <p className="text-[11px] text-neutral-600">
                      Revenus nets
                    </p>

                    <p className="mt-1 break-words text-sm font-black text-lime-400">
                      {formatMoney({
                        amount:
                          event.netRevenue,

                        currency:
                          event.currency,
                      })}
                    </p>

                    <p className="mt-1 text-[11px] text-neutral-600">
                      {event.paidOrders.toLocaleString(
                        "fr-FR",
                      )}{" "}
                      commande
                      {event.paidOrders > 1
                        ? "s"
                        : ""}{" "}
                      payée
                      {event.paidOrders > 1
                        ? "s"
                        : ""}
                    </p>

                    <div className="mt-2 space-y-1 text-[10px] text-neutral-600">
                      <p>
                        Brut :{" "}
                        <span className="font-bold text-neutral-400">
                          {formatMoney({
                            amount:
                              event.grossRevenue,

                            currency:
                              event.currency,
                          })}
                        </span>
                      </p>

                      <p>
                        Commission :{" "}
                        <span className="font-bold text-neutral-400">
                          {formatMoney({
                            amount:
                              event.platformFees,

                            currency:
                              event.currency,
                          })}
                        </span>
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/organizer/events/${event.id}`}
                    aria-label={`Ouvrir ${event.title}`}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-neutral-500 transition hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-lime-400"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-10 sm:px-5">
          <div className="mx-auto max-w-[430px] rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.015] px-6 py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10">
              <CalendarDays className="h-6 w-6 text-lime-400" />
            </div>

            <h3 className="mt-4 text-base font-black text-white">
              Aucun événement créé
            </h3>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Créez votre premier événement pour
              commencer à vendre des billets sur
              Tikemia.
            </p>

            <Link
              href="/organizer/events/create"
              className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-xs font-black text-white shadow-[0_12px_35px_rgba(34,197,94,0.16)] transition hover:scale-[1.01]"
            >
              Créer un événement
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {events.length > 0 && (
        <div className="grid border-t border-white/[0.07] sm:grid-cols-3">
          <FooterMetric
            label="Événements affichés"
            value={events.length.toLocaleString(
              "fr-FR",
            )}
            icon={CalendarDays}
          />

          <FooterMetric
            label="Billets vendus"
            value={events
              .reduce(
                (sum, event) =>
                  sum +
                  event.ticketsSold,
                0,
              )
              .toLocaleString("fr-FR")}
            icon={TicketCheck}
          />

          <FooterRevenueMetric
            events={events}
          />
        </div>
      )}
    </section>
  );
}

type FooterMetricProps = {
  label: string;
  value: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  emphasis?: boolean;
};

function FooterMetric({
  label,
  value,
  icon: Icon,
  emphasis = false,
}: FooterMetricProps) {
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
          emphasis
            ? "border-emerald-500/25 bg-emerald-500/10"
            : "border-white/[0.08] bg-white/[0.03]"
        }`}
      >
        <Icon
          className={`h-4 w-4 ${
            emphasis
              ? "text-lime-400"
              : "text-neutral-500"
          }`}
        />
      </div>

      <div className="min-w-0">
        <p className="truncate text-[11px] text-neutral-600">
          {label}
        </p>

        <p
          className={`mt-1 truncate text-sm font-black ${
            emphasis
              ? "text-lime-400"
              : "text-white"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}


function FooterRevenueMetric({
  events,
}: {
  events: DashboardRecentEvent[];
}) {
  const totals =
    groupMoneyByCurrency(
      events.map(
        (event) => ({
          amount:
            event.netRevenue,

          currency:
            event.currency,
        }),
      ),
    );

  return (
    <div className="flex items-start gap-3 px-4 py-4 sm:border-l sm:border-white/[0.06]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
        <WalletCards className="h-4 w-4 text-lime-400" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-neutral-600">
          Revenus nets
        </p>

        {totals.length > 0 ? (
          <div className="mt-2 space-y-1.5">
            {totals.map(
              (total) => (
                <div
                  key={
                    total.currency
                  }
                  className="flex items-center justify-between gap-3"
                >
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-black text-neutral-500">
                    {
                      total.currency
                    }
                  </span>

                  <span className="min-w-0 truncate text-sm font-black text-lime-400">
                    {
                      total.formatted
                    }
                  </span>
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="mt-1 text-sm font-black text-lime-400">
            0
          </p>
        )}
      </div>
    </div>
  );
}