"use client";

import Image from "next/image";
import {
  CalendarDays,
  ChevronRight,
  MapPin,
  ScanLine,
  Ticket,
} from "lucide-react";

import type {
  ScannerStatisticsData,
} from "@/components/scanner/scanner-statistics";

export type ScannerEventItem =
  Readonly<{
    assignmentId: string;
    gateName:
      | string
      | null;
    assignedAt: string;
    event: Readonly<{
      id: string;
      slug: string;
      title: string;
      coverImage:
        | string
        | null;
      venueName: string;
      city: string;
      country: string;
      startsAt: string;
      endsAt:
        | string
        | null;
      timezone: string;
      status: string;
      organizerName: string;
    }>;
    statistics: ScannerStatisticsData;
  }>;

function formatDate(
  value: string,
): string {
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
        "short",
      day:
        "2-digit",
      month:
        "short",
      year:
        "numeric",
      hour:
        "2-digit",
      minute:
        "2-digit",
    },
  ).format(date);
}

export default function ScannerEventCard({
  item,
  selected,
  onSelect,
}: {
  item: ScannerEventItem;
  selected: boolean;
  onSelect: (
    item: ScannerEventItem,
  ) => void;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onSelect(item)
      }
      className={`group w-full overflow-hidden rounded-[24px] border text-left transition ${
        selected
          ? "border-lime-400/35 bg-lime-400/[0.07] shadow-[0_18px_60px_rgba(132,204,22,0.10)]"
          : "border-white/[0.08] bg-[#071015] hover:border-white/[0.14]"
      }`}
    >
      <div className="grid min-w-0 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="relative aspect-[16/9] overflow-hidden bg-[#03090d] sm:aspect-auto">
          {item.event.coverImage ? (
            <Image
              src={item.event.coverImage}
              alt={item.event.title}
              fill
              sizes="(max-width: 640px) 100vw, 180px"
              className="object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full min-h-32 items-center justify-center">
              <Ticket className="h-12 w-12 text-white/[0.10]" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        </div>

        <div className="min-w-0 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-lime-400">
                {item.gateName ||
                  "Contrôle d’accès"}
              </p>

              <h3 className="mt-2 truncate text-lg font-black tracking-[-0.03em] text-white">
                {item.event.title}
              </h3>

              <p className="mt-1 truncate text-xs text-neutral-600">
                {item.event.organizerName}
              </p>
            </div>

            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
                selected
                  ? "border-lime-400/25 bg-lime-400/[0.12] text-lime-300"
                  : "border-white/[0.08] bg-white/[0.03] text-neutral-600 group-hover:text-white"
              }`}
            >
              <ChevronRight className="h-5 w-5" />
            </span>
          </div>

          <div className="mt-4 grid gap-2 text-xs text-neutral-500 sm:grid-cols-2">
            <span className="flex min-w-0 items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-lime-400" />
              <span className="truncate">
                {formatDate(
                  item.event.startsAt,
                )}
              </span>
            </span>

            <span className="flex min-w-0 items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-orange-400" />
              <span className="truncate">
                {item.event.venueName},{" "}
                {item.event.city}
              </span>
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat
              label="Émis"
              value={item.statistics.totalTickets}
            />

            <MiniStat
              label="Entrées"
              value={item.statistics.usedTickets}
            />

            <MiniStat
              label="Restants"
              value={item.statistics.remainingTickets}
            />
          </div>
        </div>
      </div>
    </button>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <p className="text-[8px] font-black uppercase tracking-[0.12em] text-neutral-700">
        {label}
      </p>

      <p className="mt-1 text-sm font-black text-white">
        {value}
      </p>
    </div>
  );
}
