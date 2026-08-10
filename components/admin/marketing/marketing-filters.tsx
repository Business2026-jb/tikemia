"use client";

import { Search, X } from "lucide-react";

import type {
  AdminMarketingCampaignListItem,
  AdminMarketingSort,
  GetAdminMarketingCampaignsResult,
} from "@/lib/admin/marketing/get-admin-marketing-campaigns";

export type MarketingFilterState = {
  search: string;
  status: AdminMarketingCampaignListItem["status"] | "all";
  channel: AdminMarketingCampaignListItem["channel"] | "all";
  organizerId: string;
  eventId: string;
  country: string;
  startsFrom: string;
  startsTo: string;
  sort: AdminMarketingSort;
};

const control =
  "h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-neutral-200 outline-none transition placeholder:text-neutral-700 focus:border-fuchsia-400/30";

export default function MarketingFilters({
  value,
  options,
  disabled,
  onChange,
  onReset,
}: {
  value: MarketingFilterState;
  options: GetAdminMarketingCampaignsResult["options"];
  disabled: boolean;
  onChange: (value: MarketingFilterState) => void;
  onReset: () => void;
}) {
  function update<K extends keyof MarketingFilterState>(
    key: K,
    next: MarketingFilterState[K],
  ) {
    onChange({
      ...value,
      [key]: next,
    });
  }

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#071019] p-4">
      <div className="grid gap-3 xl:grid-cols-12">
        <label className="xl:col-span-4">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Recherche
          </span>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

            <input
              value={value.search}
              disabled={disabled}
              onChange={(event) => update("search", event.target.value)}
              placeholder="Campagne, événement, organisateur..."
              className={`${control} pl-10`}
            />
          </div>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Statut
          </span>

          <select
            value={value.status}
            disabled={disabled}
            onChange={(event) =>
              update(
                "status",
                event.target.value as MarketingFilterState["status"],
              )
            }
            className={control}
          >
            <option value="all">Tous</option>
            <option value="DRAFT">Brouillon</option>
            <option value="SCHEDULED">Programmée</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Suspendue</option>
            <option value="COMPLETED">Terminée</option>
            <option value="ARCHIVED">Archivée</option>
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Canal
          </span>

          <select
            value={value.channel}
            disabled={disabled}
            onChange={(event) =>
              update(
                "channel",
                event.target.value as MarketingFilterState["channel"],
              )
            }
            className={control}
          >
            <option value="all">Tous</option>
            <option value="SOCIAL_MEDIA">Réseaux sociaux</option>
            <option value="EMAIL">E-mail</option>
            <option value="SMS">SMS</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="SEARCH_ENGINE">Moteur de recherche</option>
            <option value="DISPLAY">Display</option>
            <option value="AFFILIATE">Affiliation</option>
            <option value="OTHER">Autre</option>
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Organisateur
          </span>

          <select
            value={value.organizerId}
            disabled={disabled}
            onChange={(event) => update("organizerId", event.target.value)}
            className={control}
          >
            <option value="">Tous</option>
            {options.organizers.map((organizer) => (
              <option key={organizer.id} value={organizer.id}>
                {organizer.name}
              </option>
            ))}
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Événement
          </span>

          <select
            value={value.eventId}
            disabled={disabled}
            onChange={(event) => update("eventId", event.target.value)}
            className={control}
          >
            <option value="">Tous</option>
            {options.events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Pays
          </span>

          <select
            value={value.country}
            disabled={disabled}
            onChange={(event) => update("country", event.target.value)}
            className={control}
          >
            <option value="">Tous</option>
            {options.countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Début après
          </span>

          <input
            type="date"
            value={value.startsFrom}
            disabled={disabled}
            onChange={(event) => update("startsFrom", event.target.value)}
            className={control}
          />
        </label>

        <label className="xl:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Début avant
          </span>

          <input
            type="date"
            value={value.startsTo}
            disabled={disabled}
            onChange={(event) => update("startsTo", event.target.value)}
            className={control}
          />
        </label>

        <label className="xl:col-span-3">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Trier
          </span>

          <select
            value={value.sort}
            disabled={disabled}
            onChange={(event) =>
              update("sort", event.target.value as AdminMarketingSort)
            }
            className={control}
          >
            <option value="recent">Plus récentes</option>
            <option value="oldest">Plus anciennes</option>
            <option value="budget_desc">Budget décroissant</option>
            <option value="budget_asc">Budget croissant</option>
            <option value="visits_desc">Plus de visites</option>
            <option value="orders_desc">Plus de commandes</option>
            <option value="revenue_desc">Revenus décroissants</option>
            <option value="ending_soon">Fin proche</option>
          </select>
        </label>

        <div className="flex items-end xl:col-span-2">
          <button
            type="button"
            onClick={onReset}
            disabled={disabled}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-4 text-sm font-bold text-neutral-500 transition hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            Réinitialiser
          </button>
        </div>
      </div>
    </section>
  );
}
