"use client";

import {
  CheckCircle2,
  Clock3,
  ScanLine,
  Ticket,
  XCircle,
} from "lucide-react";

export type ScannerStatisticsData =
  Readonly<{
    totalTickets: number;
    validTickets: number;
    usedTickets: number;
    refusedScans: number;
    acceptedScans: number;
    remainingTickets: number;
    entryRate: number;
    lastScanAt:
      | string
      | null;
  }>;

function formatLastScan(
  value:
    | string
    | null,
): string {
  if (!value) {
    return "Aucun scan";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Aucun scan";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      hour:
        "2-digit",
      minute:
        "2-digit",
      second:
        "2-digit",
    },
  ).format(date);
}

export default function ScannerStatistics({
  statistics,
}: {
  statistics: ScannerStatisticsData;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <StatisticCard
        icon={Ticket}
        label="Billets émis"
        value={statistics.totalTickets}
        helper={`${statistics.remainingTickets} restant(s)`}
      />

      <StatisticCard
        icon={CheckCircle2}
        label="Entrées validées"
        value={statistics.usedTickets}
        helper={`${statistics.entryRate.toFixed(
          1,
        )} %`}
      />

      <StatisticCard
        icon={ScanLine}
        label="Scans acceptés"
        value={statistics.acceptedScans}
        helper="Historique total"
      />

      <StatisticCard
        icon={XCircle}
        label="Scans refusés"
        value={statistics.refusedScans}
        helper="Contrôles refusés"
      />

      <StatisticCard
        icon={Clock3}
        label="Dernier scan"
        value={formatLastScan(
          statistics.lastScanAt,
        )}
        helper={`${statistics.validTickets} billet(s) valide(s)`}
      />
    </section>
  );
}

function StatisticCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof Ticket;
  label: string;
  value:
    | number
    | string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#071015] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-lime-400/15 bg-lime-400/[0.07] text-lime-300">
          <Icon className="h-4.5 w-4.5" />
        </span>

        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-700">
          {label}
        </span>
      </div>

      <p className="mt-4 truncate text-2xl font-black tracking-[-0.04em] text-white">
        {value}
      </p>

      <p className="mt-1 text-[11px] text-neutral-600">
        {helper}
      </p>
    </div>
  );
}
