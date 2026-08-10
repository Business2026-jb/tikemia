"use client";

import { CalendarDays, RefreshCw } from "lucide-react";

type EventsHeaderProps = {
  loading?: boolean;
  onRefresh: () => void;
};

export default function EventsHeader({
  loading = false,
  onRefresh,
}: EventsHeaderProps) {
  return (
    <header className="rounded-2xl border border-white/[0.08] bg-[#07111d] p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/[0.08] text-sky-300">
            <CalendarDays className="h-5 w-5" />
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-300">
              Administration Tikemia
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Gestion des événements
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
              Contrôlez les événements créés par les organisateurs et gérez leur
              modération depuis un seul espace.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 text-sm font-bold text-white transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </button>
      </div>
    </header>
  );
}
