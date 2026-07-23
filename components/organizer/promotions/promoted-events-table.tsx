"use client";

import Image from "next/image";
import Link from "next/link";
import {
  CalendarClock,
  CalendarDays,
  CircleAlert,
  Eye,
  MapPin,
  MousePointerClick,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  TicketCheck,
  Trash2,
  TrendingUp,
  Zap,
} from "lucide-react";

import type { OrganizerPromotedEvent } from "@/lib/organizer/promotions/get-organizer-promotions";

type PromotedEventsTableProps = {
  events: OrganizerPromotedEvent[];
  processingBoostId?: string | null;
  onPause?: (
    event: OrganizerPromotedEvent,
  ) => void;
  onResume?: (
    event: OrganizerPromotedEvent,
  ) => void;
  onRemove?: (
    event: OrganizerPromotedEvent,
  ) => void;
};

type StatusTone =
  | "emerald"
  | "sky"
  | "orange"
  | "red"
  | "neutral";

type StatusConfig = {
  label: string;
  tone: StatusTone;
};

const statusStyles: Record<
  StatusTone,
  {
    badge: string;
    dot: string;
  }
> = {
  emerald: {
    badge:
      "border-emerald-500/25 bg-emerald-500/10 text-lime-400",
    dot: "bg-lime-400",
  },

  sky: {
    badge:
      "border-sky-500/25 bg-sky-500/10 text-sky-300",
    dot: "bg-sky-400",
  },

  orange: {
    badge:
      "border-orange-500/25 bg-orange-500/10 text-orange-300",
    dot: "bg-orange-400",
  },

  red: {
    badge:
      "border-red-500/25 bg-red-500/10 text-red-300",
    dot: "bg-red-400",
  },

  neutral: {
    badge:
      "border-white/[0.08] bg-white/[0.035] text-neutral-400",
    dot: "bg-neutral-500",
  },
};

function getStatusConfig(
  event: OrganizerPromotedEvent,
): StatusConfig {
  if (
    event.isExpired ||
    event.status === "EXPIRED"
  ) {
    return {
      label: "Expirée",
      tone: "neutral",
    };
  }

  switch (event.status) {
    case "ACTIVE":
      return {
        label: "Active",
        tone: "emerald",
      };

    case "SCHEDULED":
      return {
        label: "Programmée",
        tone: "sky",
      };

    case "PAUSED":
      return {
        label: "En pause",
        tone: "orange",
      };

    case "CANCELLED":
      return {
        label: "Retirée",
        tone: "red",
      };

    default:
      return {
        label: event.status,
        tone: "neutral",
      };
  }
}

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "Non définie";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Date invalide";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(parsed);
}

function formatInteger(
  value: number,
): string {
  return new Intl.NumberFormat(
    "fr-FR",
    {
      maximumFractionDigits: 0,
    },
  ).format(value);
}

function formatPercentage(
  value: number,
): string {
  return `${new Intl.NumberFormat(
    "fr-FR",
    {
      maximumFractionDigits: 2,
    },
  ).format(value)} %`;
}

function formatMoney(
  amount: number,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency,
        maximumFractionDigits:
          currency === "XOF" ? 0 : 2,
      },
    ).format(amount);
  } catch {
    return `${formatInteger(
      amount,
    )} ${currency}`;
  }
}

function canPause(
  event: OrganizerPromotedEvent,
): boolean {
  return (
    event.status === "ACTIVE" &&
    !event.isExpired
  );
}

function canResume(
  event: OrganizerPromotedEvent,
): boolean {
  return (
    event.status === "PAUSED" &&
    !event.isExpired
  );
}

function canRemove(
  event: OrganizerPromotedEvent,
): boolean {
  return (
    event.status !== "CANCELLED" &&
    event.status !== "EXPIRED"
  );
}

export default function PromotedEventsTable({
  events,
  processingBoostId = null,
  onPause,
  onResume,
  onRemove,
}: PromotedEventsTableProps) {
  if (events.length === 0) {
    return (
      <PromotedEventsEmptyState />
    );
  }

  return (
    <section
      aria-labelledby="promoted-events-title"
      className="w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071015] shadow-[0_20px_60px_rgba(0,0,0,0.28)]"
    >
      <header className="flex flex-col gap-3 border-b border-white/[0.07] bg-gradient-to-r from-emerald-500/[0.055] via-transparent to-orange-500/[0.035] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-lime-400">
            <Zap className="h-4.5 w-4.5" />
          </div>

          <div>
            <h2
              id="promoted-events-title"
              className="text-base font-black tracking-[-0.02em] text-white sm:text-lg"
            >
              Événements promus
            </h2>

            <p className="mt-1 text-xs leading-5 text-neutral-500">
              Suivez la position, la durée et les performances de vos promotions actives.
            </p>
          </div>
        </div>

        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-neutral-400">
          <Sparkles className="h-3.5 w-3.5 text-lime-400" />
          {formatInteger(events.length)} promotion
          {events.length > 1 ? "s" : ""}
        </span>
      </header>

      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full min-w-[1180px] border-collapse">
          <thead>
            <tr className="border-b border-white/[0.07] bg-white/[0.018]">
              <TableHead>
                Événement
              </TableHead>

              <TableHead>
                Statut
              </TableHead>

              <TableHead>
                Période
              </TableHead>

              <TableHead align="right">
                Priorité
              </TableHead>

              <TableHead align="right">
                Impressions
              </TableHead>

              <TableHead align="right">
                Clics
              </TableHead>

              <TableHead align="right">
                Conversion
              </TableHead>

              <TableHead align="right">
                Revenus
              </TableHead>

              <TableHead align="right">
                Actions
              </TableHead>
            </tr>
          </thead>

          <tbody>
            {events.map((event) => (
              <DesktopEventRow
                key={event.boostId}
                event={event}
                isProcessing={
                  processingBoostId ===
                  event.boostId
                }
                onPause={onPause}
                onResume={onResume}
                onRemove={onRemove}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-3 sm:p-4 xl:hidden">
        {events.map((event) => (
          <MobileEventCard
            key={event.boostId}
            event={event}
            isProcessing={
              processingBoostId ===
              event.boostId
            }
            onPause={onPause}
            onResume={onResume}
            onRemove={onRemove}
          />
        ))}
      </div>
    </section>
  );
}

function DesktopEventRow({
  event,
  isProcessing,
  onPause,
  onResume,
  onRemove,
}: {
  event: OrganizerPromotedEvent;
  isProcessing: boolean;
  onPause?: (
    event: OrganizerPromotedEvent,
  ) => void;
  onResume?: (
    event: OrganizerPromotedEvent,
  ) => void;
  onRemove?: (
    event: OrganizerPromotedEvent,
  ) => void;
}) {
  const status =
    getStatusConfig(event);

  return (
    <tr className="border-b border-white/[0.055] transition last:border-b-0 hover:bg-white/[0.022]">
      <td className="px-4 py-4">
        <EventIdentity event={event} />
      </td>

      <td className="px-4 py-4">
        <StatusBadge
          config={status}
        />
      </td>

      <td className="px-4 py-4">
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center gap-2 text-neutral-400">
            <CalendarDays className="h-3.5 w-3.5 text-neutral-600" />
            <span>
              {formatDate(
                event.startsAt,
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 text-neutral-500">
            <CalendarClock className="h-3.5 w-3.5 text-neutral-600" />
            <span>
              {formatDate(
                event.endsAt,
              )}
            </span>
          </div>

          <p className="text-[10px] font-bold text-neutral-600">
            {event.remainingDays} jour
            {event.remainingDays > 1
              ? "s"
              : ""}{" "}
            restant
            {event.remainingDays > 1
              ? "s"
              : ""}
          </p>
        </div>
      </td>

      <td className="px-4 py-4 text-right">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/[0.07] px-2.5 py-1 text-xs font-black text-violet-300">
          <TrendingUp className="h-3.5 w-3.5" />
          {formatInteger(
            event.priorityScore,
          )}
        </span>
      </td>

      <td className="px-4 py-4 text-right">
        <MetricValue
          value={formatInteger(
            event.metrics.impressions,
          )}
          icon="eye"
        />
      </td>

      <td className="px-4 py-4 text-right">
        <MetricValue
          value={formatInteger(
            event.metrics.clicks,
          )}
          icon="click"
        />
      </td>

      <td className="px-4 py-4 text-right">
        <span className="text-sm font-black text-lime-400">
          {formatPercentage(
            event.metrics
              .conversionRate,
          )}
        </span>
      </td>

      <td className="px-4 py-4 text-right">
        <span className="whitespace-nowrap text-sm font-black text-white">
          {formatMoney(
            event.metrics.revenue,
            event.event.currency,
          )}
        </span>
      </td>

      <td className="px-4 py-4">
        <div className="flex justify-end gap-2">
          <EventActions
            event={event}
            isProcessing={
              isProcessing
            }
            onPause={onPause}
            onResume={onResume}
            onRemove={onRemove}
            compact
          />
        </div>
      </td>
    </tr>
  );
}

function MobileEventCard({
  event,
  isProcessing,
  onPause,
  onResume,
  onRemove,
}: {
  event: OrganizerPromotedEvent;
  isProcessing: boolean;
  onPause?: (
    event: OrganizerPromotedEvent,
  ) => void;
  onResume?: (
    event: OrganizerPromotedEvent,
  ) => void;
  onRemove?: (
    event: OrganizerPromotedEvent,
  ) => void;
}) {
  const status =
    getStatusConfig(event);

  return (
    <article className="overflow-hidden rounded-2xl border border-white/[0.075] bg-white/[0.022]">
      <div className="relative aspect-[16/8] overflow-hidden bg-[#0a1419]">
        {event.event.coverImage ? (
          <Image
            src={
              event.event.coverImage
            }
            alt={event.event.title}
            fill
            sizes="(max-width: 1280px) 100vw, 480px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Sparkles className="h-8 w-8 text-neutral-700" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-transparent" />

        <div className="absolute left-3 top-3">
          <StatusBadge
            config={status}
          />
        </div>

        <div className="absolute bottom-3 right-3 rounded-full border border-violet-500/25 bg-black/65 px-2.5 py-1 text-[10px] font-black text-violet-300 backdrop-blur-md">
          Priorité{" "}
          {formatInteger(
            event.priorityScore,
          )}
        </div>
      </div>

      <div className="p-4">
        <EventIdentity
          event={event}
          hideImage
        />

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <MobileMetric
            label="Impressions"
            value={formatInteger(
              event.metrics
                .impressions,
            )}
            icon="eye"
          />

          <MobileMetric
            label="Clics"
            value={formatInteger(
              event.metrics.clicks,
            )}
            icon="click"
          />

          <MobileMetric
            label="Billets"
            value={formatInteger(
              event.metrics.tickets,
            )}
            icon="ticket"
          />

          <MobileMetric
            label="Conversion"
            value={formatPercentage(
              event.metrics
                .conversionRate,
            )}
            icon="trend"
            emphasis
          />
        </div>

        <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/20 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-neutral-600">
                Période Premium
              </p>

              <p className="mt-1 text-xs font-bold text-neutral-300">
                {formatDate(
                  event.startsAt,
                )}{" "}
                –{" "}
                {formatDate(
                  event.endsAt,
                )}
              </p>
            </div>

            <span className="shrink-0 text-xs font-black text-orange-300">
              {event.remainingDays} j
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.045] px-3.5 py-3">
          <span className="text-xs font-bold text-neutral-400">
            Revenus attribués
          </span>

          <span className="text-sm font-black text-lime-400">
            {formatMoney(
              event.metrics.revenue,
              event.event.currency,
            )}
          </span>
        </div>

        <div className="mt-4">
          <EventActions
            event={event}
            isProcessing={
              isProcessing
            }
            onPause={onPause}
            onResume={onResume}
            onRemove={onRemove}
          />
        </div>
      </div>
    </article>
  );
}

function EventIdentity({
  event,
  hideImage = false,
}: {
  event: OrganizerPromotedEvent;
  hideImage?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {!hideImage && (
        <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a1419]">
          {event.event.coverImage ? (
            <Image
              src={
                event.event.coverImage
              }
              alt={event.event.title}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Sparkles className="h-5 w-5 text-neutral-700" />
            </div>
          )}
        </div>
      )}

      <div className="min-w-0">
        <Link
          href={`/organizer/events/${encodeURIComponent(
            event.eventId,
          )}`}
          className="line-clamp-2 text-sm font-black leading-5 text-white transition hover:text-lime-400"
        >
          {event.event.title}
        </Link>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-neutral-600">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {event.event.city},{" "}
            {event.event.country}
          </span>

          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {formatDate(
              event.event.startsAt,
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  config,
}: {
  config: StatusConfig;
}) {
  const styles =
    statusStyles[config.tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.07em] ${styles.badge}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${styles.dot}`}
      />
      {config.label}
    </span>
  );
}

function MetricValue({
  value,
  icon,
}: {
  value: string;
  icon: "eye" | "click";
}) {
  return (
    <span className="inline-flex items-center justify-end gap-1.5 text-sm font-black text-neutral-300">
      {icon === "eye" ? (
        <Eye className="h-3.5 w-3.5 text-neutral-600" />
      ) : (
        <MousePointerClick className="h-3.5 w-3.5 text-neutral-600" />
      )}

      {value}
    </span>
  );
}

function MobileMetric({
  label,
  value,
  icon,
  emphasis = false,
}: {
  label: string;
  value: string;
  icon:
    | "eye"
    | "click"
    | "ticket"
    | "trend";
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
          emphasis
            ? "border-emerald-500/25 bg-emerald-500/10 text-lime-400"
            : "border-white/[0.07] bg-white/[0.035] text-neutral-500"
        }`}
      >
        {icon === "eye" ? (
          <Eye className="h-3.5 w-3.5" />
        ) : icon === "click" ? (
          <MousePointerClick className="h-3.5 w-3.5" />
        ) : icon === "ticket" ? (
          <TicketCheck className="h-3.5 w-3.5" />
        ) : (
          <TrendingUp className="h-3.5 w-3.5" />
        )}
      </div>

      <p className="mt-2.5 text-[9px] font-black uppercase tracking-[0.08em] text-neutral-600">
        {label}
      </p>

      <p
        className={`mt-1 truncate text-sm font-black ${
          emphasis
            ? "text-lime-400"
            : "text-white"
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function EventActions({
  event,
  isProcessing,
  onPause,
  onResume,
  onRemove,
  compact = false,
}: {
  event: OrganizerPromotedEvent;
  isProcessing: boolean;
  onPause?: (
    event: OrganizerPromotedEvent,
  ) => void;
  onResume?: (
    event: OrganizerPromotedEvent,
  ) => void;
  onRemove?: (
    event: OrganizerPromotedEvent,
  ) => void;
  compact?: boolean;
}) {
  const buttonSize =
    compact
      ? "h-9 w-9 px-0"
      : "h-10 flex-1 px-3";

  return (
    <div
      className={`flex gap-2 ${
        compact
          ? "justify-end"
          : "w-full"
      }`}
    >
      <Link
        href={`/organizer/events/${encodeURIComponent(
          event.eventId,
        )}`}
        aria-label={`Voir ${event.event.title}`}
        title="Voir l’événement"
        className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] text-xs font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white ${buttonSize}`}
      >
        <Eye className="h-4 w-4" />
        {!compact && <span>Voir</span>}
      </Link>

      {canPause(event) &&
        onPause && (
          <button
            type="button"
            onClick={() =>
              onPause(event)
            }
            disabled={isProcessing}
            aria-label={`Mettre en pause ${event.event.title}`}
            title="Mettre en pause"
            className={`inline-flex items-center justify-center gap-2 rounded-xl border border-orange-500/25 bg-orange-500/[0.06] text-xs font-bold text-orange-300 transition hover:bg-orange-500/10 disabled:cursor-not-allowed disabled:opacity-50 ${buttonSize}`}
          >
            {isProcessing ? (
              <RotateCcw className="h-4 w-4 animate-spin" />
            ) : (
              <Pause className="h-4 w-4" />
            )}

            {!compact && (
              <span>Pause</span>
            )}
          </button>
        )}

      {canResume(event) &&
        onResume && (
          <button
            type="button"
            onClick={() =>
              onResume(event)
            }
            disabled={isProcessing}
            aria-label={`Réactiver ${event.event.title}`}
            title="Réactiver"
            className={`inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] text-xs font-bold text-lime-400 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50 ${buttonSize}`}
          >
            {isProcessing ? (
              <RotateCcw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}

            {!compact && (
              <span>Réactiver</span>
            )}
          </button>
        )}

      {canRemove(event) &&
        onRemove && (
          <button
            type="button"
            onClick={() =>
              onRemove(event)
            }
            disabled={isProcessing}
            aria-label={`Retirer ${event.event.title} de la promotion`}
            title="Retirer la promotion"
            className={`inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.055] text-xs font-bold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50 ${buttonSize}`}
          >
            {isProcessing ? (
              <RotateCcw className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}

            {!compact && (
              <span>Retirer</span>
            )}
          </button>
        )}
    </div>
  );
}

function TableHead({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-3.5 text-[10px] font-black uppercase tracking-[0.08em] text-neutral-600 ${
        align === "right"
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function PromotedEventsEmptyState() {
  return (
    <section
      aria-labelledby="promoted-events-empty-title"
      className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071015] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] sm:p-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/[0.055] via-transparent to-orange-500/[0.035]" />

      <div className="relative flex flex-col items-center justify-center py-8 text-center sm:py-12">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-lime-400">
          <Zap className="h-6 w-6" />
        </div>

        <h2
          id="promoted-events-empty-title"
          className="mt-4 text-lg font-black tracking-[-0.025em] text-white"
        >
          Aucun événement promu
        </h2>

        <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-500">
          Activez une formule Premium puis choisissez un événement publié pour le faire apparaître parmi les premières positions Tikemia.
        </p>

        <div className="mt-5 inline-flex items-start gap-3 rounded-xl border border-orange-500/20 bg-orange-500/[0.055] px-4 py-3 text-left">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />

          <p className="text-[11px] leading-5 text-orange-200/70">
            Seuls les événements publiés et non terminés peuvent être ajoutés à la Visibilité Premium.
          </p>
        </div>
      </div>
    </section>
  );
}