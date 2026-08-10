"use client";

import {
  Filter,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

export type OrganizerFiltersValue = {
  search: string;
  status:
    | "all"
    | "active"
    | "inactive"
    | "verified"
    | "unverified";
  sort:
    | "newest"
    | "oldest"
    | "name_asc"
    | "name_desc";
};

export default function OrganizersFilters({
  value,
  loading,
  onChange,
  onReset,
}: {
  value: OrganizerFiltersValue;
  loading?: boolean;
  onChange: (value: OrganizerFiltersValue) => void;
  onReset: () => void;
}) {
  const hasFilters =
    value.search.trim().length > 0 ||
    value.status !== "all" ||
    value.sort !== "newest";

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#080d0f] p-3 sm:p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_190px_190px_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
          <input
            value={value.search}
            onChange={(event) =>
              onChange({
                ...value,
                search: event.target.value,
              })
            }
            placeholder="Nom, e-mail, téléphone, entreprise..."
            className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-emerald-400/30"
          />
        </label>

        <label className="relative">
          <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
          <select
            value={value.status}
            onChange={(event) =>
              onChange({
                ...value,
                status: event.target.value as OrganizerFiltersValue["status"],
              })
            }
            className="h-11 w-full appearance-none rounded-xl border border-white/[0.08] bg-[#080d0f] pl-10 pr-4 text-sm font-semibold text-neutral-300 outline-none focus:border-emerald-400/30"
          >
            <option value="all">Tous les comptes</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
            <option value="verified">E-mails vérifiés</option>
            <option value="unverified">Non vérifiés</option>
          </select>
        </label>

        <label className="relative">
          <SlidersHorizontal className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
          <select
            value={value.sort}
            onChange={(event) =>
              onChange({
                ...value,
                sort: event.target.value as OrganizerFiltersValue["sort"],
              })
            }
            className="h-11 w-full appearance-none rounded-xl border border-white/[0.08] bg-[#080d0f] pl-10 pr-4 text-sm font-semibold text-neutral-300 outline-none focus:border-emerald-400/30"
          >
            <option value="newest">Plus récents</option>
            <option value="oldest">Plus anciens</option>
            <option value="name_asc">Nom A → Z</option>
            <option value="name_desc">Nom Z → A</option>
          </select>
        </label>

        <button
          type="button"
          onClick={onReset}
          disabled={!hasFilters || loading}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-4 text-sm font-bold text-neutral-400 transition hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
        >
          <X className="h-4 w-4" />
          Réinitialiser
        </button>
      </div>
    </div>
  );
}
