"use client";

import Link from "next/link";
import {
  CalendarPlus2,
  FilterX,
  SearchX,
  Sparkles,
} from "lucide-react";

type EventsEmptyStateProps = {
  hasFilters: boolean;
  search?: string;
  onResetFilters?: () => void;
};

export default function EventsEmptyState({
  hasFilters,
  search = "",
  onResetFilters,
}: EventsEmptyStateProps) {
  const normalizedSearch = search.trim();

  if (hasFilters) {
    return (
      <section className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.1] bg-[#081015] px-5 py-10 text-center sm:px-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/25 bg-orange-500/10">
          {normalizedSearch ? (
            <SearchX className="h-7 w-7 text-orange-400" />
          ) : (
            <FilterX className="h-7 w-7 text-orange-400" />
          )}
        </div>

        <h2 className="mt-5 text-lg font-black tracking-[-0.02em] text-white sm:text-xl">
          Aucun événement trouvé
        </h2>

        <p className="mt-2 max-w-[520px] text-sm leading-6 text-neutral-500">
          {normalizedSearch
            ? `Aucun événement ne correspond à la recherche « ${normalizedSearch} ».`
            : "Aucun événement ne correspond aux filtres actuellement sélectionnés."}
        </p>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          {onResetFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.03] px-5 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              <FilterX className="h-4 w-4" />
              Réinitialiser les filtres
            </button>
          )}

          <Link
            href="/organizer/events/create"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-5 text-sm font-black text-white shadow-[0_14px_35px_rgba(34,197,94,0.16)] transition hover:scale-[1.01]"
          >
            <CalendarPlus2 className="h-4 w-4" />
            Créer un événement
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] px-5 py-10 text-center sm:px-8 sm:py-14">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.08),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.08),transparent_34%)]" />

      <div className="relative mx-auto flex max-w-[620px] flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 shadow-[0_12px_35px_rgba(34,197,94,0.08)]">
          <CalendarPlus2 className="h-7 w-7 text-lime-400" />
        </div>

        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-lime-400">
          <Sparkles className="h-3.5 w-3.5" />
          Premier événement
        </div>

        <h2 className="mt-5 text-xl font-black tracking-[-0.03em] text-white sm:text-2xl">
          Créez votre premier événement
        </h2>

        <p className="mt-3 text-sm leading-6 text-neutral-500">
          Ajoutez les informations, les images, les dates et les billets.
          Tikemia centralisera ensuite les ventes, les revenus et le suivi de
          votre événement dans cet espace.
        </p>

        <Link
          href="/organizer/events/create"
          className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-6 text-sm font-black text-white shadow-[0_16px_40px_rgba(34,197,94,0.18)] transition hover:scale-[1.01]"
        >
          <CalendarPlus2 className="h-4 w-4" />
          Créer mon premier événement
        </Link>
      </div>
    </section>
  );
}