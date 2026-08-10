"use client";

import { RotateCcw, Search } from "lucide-react";

export type AdminEventsFiltersValue = {
  search: string;
  status: string;
  country: string;
  sort: string;
};

type EventsFiltersProps = {
  value: AdminEventsFiltersValue;
  onChange: (value: AdminEventsFiltersValue) => void;
};

export default function EventsFilters({
  value,
  onChange,
}: EventsFiltersProps) {
  function update(
    key: keyof AdminEventsFiltersValue,
    nextValue: string,
  ) {
    onChange({
      ...value,
      [key]: nextValue,
    });
  }

  function reset() {
    onChange({
      search: "",
      status: "all",
      country: "",
      sort: "recent",
    });
  }

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#07111d] p-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_180px_180px_190px_auto]">
        <label className="block">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
            Recherche
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
            <input
              type="search"
              value={value.search}
              onChange={(event) => update("search", event.target.value)}
              placeholder="Titre, organisateur, ville, identifiant..."
              className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 pl-10 pr-4 text-sm text-white outline-none placeholder:text-neutral-700 focus:border-sky-400/30"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
            Statut
          </span>
          <select
            value={value.status}
            onChange={(event) => update("status", event.target.value)}
            className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#07111d] px-3 text-sm text-white outline-none focus:border-sky-400/30"
          >
            <option value="all">Tous les statuts</option>
            <option value="PENDING">En attente</option>
            <option value="PUBLISHED">Publié</option>
            <option value="DRAFT">Brouillon</option>
            <option value="REJECTED">Refusé</option>
            <option value="SUSPENDED">Suspendu</option>
            <option value="CANCELLED">Annulé</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
            Pays
          </span>
          <input
            type="text"
            value={value.country}
            onChange={(event) => update("country", event.target.value)}
            placeholder="Tous les pays"
            className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 text-sm text-white outline-none placeholder:text-neutral-700 focus:border-sky-400/30"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
            Trier par
          </span>
          <select
            value={value.sort}
            onChange={(event) => update("sort", event.target.value)}
            className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#07111d] px-3 text-sm text-white outline-none focus:border-sky-400/30"
          >
            <option value="recent">Plus récents</option>
            <option value="oldest">Plus anciens</option>
            <option value="title_asc">Titre A-Z</option>
            <option value="title_desc">Titre Z-A</option>
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-4 text-sm font-bold text-neutral-500 transition hover:bg-white/[0.04] hover:text-white xl:w-auto"
          >
            <RotateCcw className="h-4 w-4" />
            Réinitialiser
          </button>
        </div>
      </div>
    </section>
  );
}
