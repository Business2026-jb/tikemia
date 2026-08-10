"use client";

import type {
  PromoCodeStatus,
  PromoDiscountType,
} from "@prisma/client";
import {
  Search,
  X,
} from "lucide-react";

import type {
  AdminCouponSort,
  GetAdminCouponsResult,
} from "@/lib/admin/coupons/get-admin-coupons";

export type CouponsFilterState = {
  search: string;
  status:
    | PromoCodeStatus
    | "all";
  discountType:
    | PromoDiscountType
    | "all";
  organizerId: string;
  eventId: string;
  country: string;
  startsFrom: string;
  startsTo: string;
  sort:
    AdminCouponSort;
};

const control =
  "h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-neutral-200 outline-none transition placeholder:text-neutral-700 focus:border-fuchsia-400/30";

export default function CouponsFilters({
  value,
  options,
  disabled,
  onChange,
  onReset,
}: {
  value:
    CouponsFilterState;
  options:
    GetAdminCouponsResult["options"];
  disabled:
    boolean;
  onChange:
    (
      value:
        CouponsFilterState,
    ) => void;
  onReset:
    () => void;
}) {
  function update<
    K extends keyof CouponsFilterState,
  >(
    key: K,
    next:
      CouponsFilterState[K],
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
              placeholder="Code, événement, organisateur..."
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
                  | PromoCodeStatus
                  | "all",
              )
            }
            className={control}
          >
            <option value="all">
              Tous
            </option>
            <option value="ACTIVE">
              Actif
            </option>
            <option value="SCHEDULED">
              Programmé
            </option>
            <option value="DISABLED">
              Suspendu
            </option>
            <option value="EXPIRED">
              Expiré
            </option>
            <option value="ARCHIVED">
              Archivé
            </option>
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Type
          </span>

          <select
            value={value.discountType}
            disabled={disabled}
            onChange={(event) =>
              update(
                "discountType",
                event.target.value as
                  | PromoDiscountType
                  | "all",
              )
            }
            className={control}
          >
            <option value="all">
              Tous
            </option>
            <option value="PERCENTAGE">
              Pourcentage
            </option>
            <option value="FIXED_AMOUNT">
              Montant fixe
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
            Événement
          </span>

          <select
            value={value.eventId}
            disabled={disabled}
            onChange={(event) =>
              update(
                "eventId",
                event.target.value,
              )
            }
            className={control}
          >
            <option value="">
              Tous
            </option>

            {options.events.map(
              (event) => (
                <option
                  key={event.id}
                  value={event.id}
                >
                  {event.title}
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
                event.target.value as
                  AdminCouponSort,
              )
            }
            className={control}
          >
            <option value="recent">
              Plus récents
            </option>
            <option value="oldest">
              Plus anciens
            </option>
            <option value="most_used">
              Plus utilisés
            </option>
            <option value="least_used">
              Moins utilisés
            </option>
            <option value="ending_soon">
              Expiration proche
            </option>
            <option value="value_desc">
              Réduction décroissante
            </option>
            <option value="value_asc">
              Réduction croissante
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
