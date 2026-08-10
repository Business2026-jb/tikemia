"use client";

import type {
  EventBoostSource,
  EventBoostStatus,
} from "@prisma/client";
import {
  Search,
  X,
} from "lucide-react";

import type {
  AdminPromotionSort,
  GetAdminPromotionsResult,
} from "@/lib/admin/promotions/get-admin-promotions";

export type PromotionsFilterState = {
  search: string;
  status:
    | EventBoostStatus
    | "all";
  source:
    | EventBoostSource
    | "all";
  organizerId: string;
  country: string;
  startsFrom: string;
  startsTo: string;
  sort:
    AdminPromotionSort;
};

const control =
  "h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-neutral-200 outline-none transition placeholder:text-neutral-700 focus:border-fuchsia-400/30";

export default function PromotionsFilters({
  value,
  options,
  disabled,
  onChange,
  onReset,
}: {
  value:
    PromotionsFilterState;
  options:
    GetAdminPromotionsResult["options"];
  disabled:
    boolean;
  onChange:
    (
      value:
        PromotionsFilterState,
    ) => void;
  onReset:
    () => void;
}) {
  function update<
    K extends keyof PromotionsFilterState,
  >(
    key: K,
    next:
      PromotionsFilterState[K],
  ) {
    onChange({
      ...value,
      [key]:
        next,
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
              onChange={(event) =>
                update(
                  "search",
                  event.target.value,
                )
              }
              placeholder="Événement, organisateur, ville..."
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
                event.target.value as
                  | EventBoostStatus
                  | "all",
              )
            }
            className={control}
          >
            <option value="all">
              Tous
            </option>
            <option value="SCHEDULED">
              Programmée
            </option>
            <option value="ACTIVE">
              Active
            </option>
            <option value="PAUSED">
              Suspendue
            </option>
            <option value="CANCELLED">
              Annulée
            </option>
            <option value="EXPIRED">
              Expirée
            </option>
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Source
          </span>

          <select
            value={value.source}
            disabled={disabled}
            onChange={(event) =>
              update(
                "source",
                event.target.value as
                  | EventBoostSource
                  | "all",
              )
            }
            className={control}
          >
            <option value="all">
              Toutes
            </option>
            <option value="SUBSCRIPTION">
              Abonnement
            </option>
            <option value="ADMIN">
              Administration
            </option>
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Organisateur
          </span>

          <select
            value={value.organizerId}
            disabled={disabled}
            onChange={(event) =>
              update(
                "organizerId",
                event.target.value,
              )
            }
            className={control}
          >
            <option value="">
              Tous
            </option>

            {options.organizers.map(
              (organizer) => (
                <option
                  key={organizer.id}
                  value={organizer.id}
                >
                  {organizer.name}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Pays
          </span>

          <select
            value={value.country}
            disabled={disabled}
            onChange={(event) =>
              update(
                "country",
                event.target.value,
              )
            }
            className={control}
          >
            <option value="">
              Tous
            </option>

            {options.countries.map(
              (country) => (
                <option
                  key={country}
                  value={country}
                >
                  {country}
                </option>
              ),
            )}
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
            onChange={(event) =>
              update(
                "startsFrom",
                event.target.value,
              )
            }
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
            onChange={(event) =>
              update(
                "startsTo",
                event.target.value,
              )
            }
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
              update(
                "sort",
                event.target.value as AdminPromotionSort,
              )
            }
            className={control}
          >
            <option value="recent">
              Plus récentes
            </option>
            <option value="oldest">
              Plus anciennes
            </option>
            <option value="starts_soon">
              Début proche
            </option>
            <option value="ends_soon">
              Fin proche
            </option>
            <option value="priority_desc">
              Priorité décroissante
            </option>
            <option value="priority_asc">
              Priorité croissante
            </option>
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
