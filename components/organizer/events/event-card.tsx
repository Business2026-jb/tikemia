"use client";

import Link from "next/link";
import {
  Archive,
  BadgeCheck,
  Ban,
  CalendarDays,
  CircleAlert,
  CircleX,
  Clock3,
  Eye,
  FileClock,
  ImageIcon,
  MapPin,
  Pencil,
  Ticket,
  Trash2,
  UsersRound,
  WalletCards,
} from "lucide-react";

import type {
  OrganizerEventListItem,
} from "@/lib/events/get-organizer-events";

type EventCardProps = {
  event: OrganizerEventListItem;
  onDelete: (
    event: OrganizerEventListItem,
  ) => void;
};

type EventStatusStyle = {
  label: string;
  className: string;
  icon: typeof BadgeCheck;
};

const defaultStatusConfig: EventStatusStyle = {
  label: "Statut inconnu",
  className:
    "border-white/[0.08] bg-white/[0.04] text-neutral-400",
  icon: CircleAlert,
};

const statusConfig: Record<string, EventStatusStyle> = {
  DRAFT: {
    label: "Brouillon",
    className:
      "border-neutral-500/25 bg-neutral-500/10 text-neutral-300",
    icon: FileClock,
  },

  PENDING: {
    label: "En cours d’examen",
    className:
      "border-orange-500/30 bg-orange-500/10 text-orange-300",
    icon: Clock3,
  },

  PUBLISHED: {
    label: "Publié",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-lime-400",
    icon: BadgeCheck,
  },

  SUSPENDED: {
    label: "Suspendu",
    className:
      "border-red-500/30 bg-red-500/10 text-red-300",
    icon: CircleAlert,
  },

  CANCELLED: {
    label: "Annulé",
    className:
      "border-red-500/30 bg-red-500/10 text-red-300",
    icon: Ban,
  },

  COMPLETED: {
    label: "Terminé",
    className:
      "border-blue-500/30 bg-blue-500/10 text-blue-300",
    icon: BadgeCheck,
  },

  REJECTED: {
    label: "Rejeté",
    className:
      "border-red-500/30 bg-red-500/10 text-red-300",
    icon: CircleX,
  },

  ARCHIVED: {
    label: "Archivé",
    className:
      "border-violet-500/30 bg-violet-500/10 text-violet-300",
    icon: Archive,
  },
};

function formatDateTime(
  value: string,
  timezone: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date indisponible";
  }

  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }
}

function formatMoney(
  value: number,
  currency: string,
): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits:
      currency === "XOF" ||
      currency === "XAF"
        ? 0
        : 2,
    maximumFractionDigits:
      currency === "XOF" ||
      currency === "XAF"
        ? 0
        : 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return value.toLocaleString("fr-FR");
}

function truncateDescription(
  value: string,
  maximumLength = 150,
): string {
  const normalized = value.trim();

  if (normalized.length <= maximumLength) {
    return normalized;
  }

  return `${normalized.slice(
    0,
    maximumLength,
  ).trimEnd()}…`;
}

export default function EventCard({
  event,
  onDelete,
}: EventCardProps) {
  const status =
    statusConfig[event.status] ??
    defaultStatusConfig;

  const StatusIcon = status.icon;

  const priceLabel =
    event.minimumTicketPrice ===
    event.maximumTicketPrice
      ? formatMoney(
          event.minimumTicketPrice,
          event.currency,
        )
      : `${formatMoney(
          event.minimumTicketPrice,
          event.currency,
        )} – ${formatMoney(
          event.maximumTicketPrice,
          event.currency,
        )}`;

  return (
    <article className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] shadow-[0_18px_50px_rgba(0,0,0,0.18)] transition duration-300 hover:-translate-y-0.5 hover:border-white/[0.14] hover:shadow-[0_24px_65px_rgba(0,0,0,0.3)]">
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden bg-[#050b0f]">
        {event.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.coverImage}
            alt={event.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-500/10 via-lime-500/[0.04] to-orange-500/10">
            <ImageIcon className="h-9 w-9 text-neutral-700" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black backdrop-blur-md ${status.className}`}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {status.label}
          </span>

          {event.category && (
            <span className="max-w-[55%] truncate rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md">
              {event.category.name}
            </span>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-lg border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] font-bold text-neutral-200 backdrop-blur-md">
              {event.ticketTypesCount} type
              {event.ticketTypesCount > 1
                ? "s"
                : ""}{" "}
              de billet
              {event.ticketTypesCount > 1
                ? "s"
                : ""}
            </span>

            <span className="rounded-lg border border-emerald-500/20 bg-black/60 px-2.5 py-1 text-[10px] font-black text-lime-400 backdrop-blur-md">
              {priceLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="p-4">
        <div>
          <h2 className="line-clamp-2 text-base font-black leading-6 tracking-[-0.02em] text-white">
            {event.title}
          </h2>

          <p className="mt-2 line-clamp-3 text-xs leading-5 text-neutral-500">
            {truncateDescription(
              event.description,
            )}
          </p>
        </div>

        <div className="mt-4 space-y-2.5">
          <InformationLine
            icon={CalendarDays}
            label="Date"
            value={formatDateTime(
              event.startsAt,
              event.timezone,
            )}
          />

          <InformationLine
            icon={MapPin}
            label="Lieu"
            value={`${event.venueName}, ${event.city}, ${event.country}`}
          />
        </div>

        {/* Statistiques */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Metric
            icon={Ticket}
            label="Billets vendus"
            value={formatNumber(
              event.ticketsSold,
            )}
            detail={`sur ${formatNumber(
              event.capacity,
            )}`}
          />

          <Metric
            icon={UsersRound}
            label="Places restantes"
            value={formatNumber(
              event.placesRemaining,
            )}
            detail={`${event.salesProgressPercent} % vendu`}
          />

          <Metric
            icon={WalletCards}
            label="Revenu net"
            value={formatMoney(
              event.organizerNetRevenue,
              event.currency,
            )}
            detail={`${event.paidOrdersCount} commande${
              event.paidOrdersCount > 1
                ? "s"
                : ""
            }`}
            highlight
          />

          <Metric
            icon={CalendarDays}
            label="Mise à jour"
            value={new Intl.DateTimeFormat(
              "fr-FR",
              {
                dateStyle: "medium",
              },
            ).format(
              new Date(event.updatedAt),
            )}
            detail={status.label}
          />
        </div>

        {/* Progression */}
        <div className="mt-4">
          <div className="flex items-center justify-between gap-4 text-[11px]">
            <span className="text-neutral-600">
              Progression des ventes
            </span>

            <span className="font-black text-lime-400">
              {event.salesProgressPercent} %
            </span>
          </div>

          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-lime-400 to-orange-500 transition-[width] duration-500"
              style={{
                width: `${event.salesProgressPercent}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <footer className="grid grid-cols-2 gap-2 border-t border-white/[0.07] bg-black/10 p-3 sm:grid-cols-3">
        <Link
          href={`/organizer/events/${event.id}`}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-3 text-xs font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white"
        >
          <Eye className="h-4 w-4" />
          Voir
        </Link>

        {event.canEdit ? (
          <Link
            href={`/organizer/events/${event.id}/edit`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3 text-xs font-bold text-lime-400 transition hover:bg-emerald-500/12"
          >
            <Pencil className="h-4 w-4" />
            Modifier
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex h-10 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.015] px-3 text-xs font-bold text-neutral-700"
          >
            <Pencil className="h-4 w-4" />
            Modifier
          </button>
        )}

        {event.canDelete ? (
          <button
            type="button"
            onClick={() => {
              onDelete(event);
            }}
            className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.07] px-3 text-xs font-bold text-red-300 transition hover:bg-red-500/15 sm:col-span-1"
          >
            <Trash2 className="h-4 w-4" />
            Supprimer
          </button>
        ) : (
          <button
            type="button"
            disabled
            title="Cet événement ne peut plus être supprimé."
            className="col-span-2 inline-flex h-10 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.015] px-3 text-xs font-bold text-neutral-700 sm:col-span-1"
          >
            <Trash2 className="h-4 w-4" />
            Supprimer
          </button>
        )}
      </footer>
    </article>
  );
}

type IconComponent = typeof Ticket;

function InformationLine({
  icon: Icon,
  label,
  value,
}: {
  icon: IconComponent;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />

      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.1em] text-neutral-700">
          {label}
        </p>

        <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-neutral-300">
          {value}
        </p>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  highlight = false,
}: {
  icon: IconComponent;
  label: string;
  value: string;
  detail: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight
          ? "border-emerald-500/18 bg-emerald-500/[0.04]"
          : "border-white/[0.07] bg-white/[0.02]"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={`h-3.5 w-3.5 ${
            highlight
              ? "text-lime-400"
              : "text-neutral-600"
          }`}
        />

        <p className="text-[10px] leading-4 text-neutral-600">
          {label}
        </p>
      </div>

      <p
        className={`mt-2 break-words text-sm font-black leading-5 ${
          highlight
            ? "text-lime-400"
            : "text-white"
        }`}
      >
        {value}
      </p>

      <p className="mt-1 text-[10px] leading-4 text-neutral-700">
        {detail}
      </p>
    </div>
  );
}