"use client";

import type {
  SubscriptionBillingPeriod,
  SubscriptionStatus,
} from "@prisma/client";
import { Search, X } from "lucide-react";

import type {
  AdminSubscriptionSort,
  GetAdminSubscriptionsResult,
} from "@/lib/admin/subscriptions/get-admin-subscriptions";

export type SubscriptionsFilterState = {
  search: string;
  status: SubscriptionStatus | "all";
  planId: string;
  billingPeriod: SubscriptionBillingPeriod | "all";
  currency: string;
  autoRenew: "all" | "true" | "false";
  endingBefore: string;
  sort: AdminSubscriptionSort;
};

const controlClass =
  "h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-neutral-200 outline-none transition placeholder:text-neutral-700 focus:border-violet-400/30";

const STATUS_OPTIONS: Array<{
  value: SubscriptionStatus | "all";
  label: string;
}> = [
  { value: "all", label: "Tous les statuts" },
  { value: "PENDING", label: "En attente" },
  { value: "ACTIVE", label: "Actif" },
  { value: "PAST_DUE", label: "Paiement en retard" },
  { value: "PAUSED", label: "Suspendu" },
  { value: "CANCELLED", label: "Annulé" },
  { value: "EXPIRED", label: "Expiré" },
];

const BILLING_OPTIONS: Array<{
  value: SubscriptionBillingPeriod | "all";
  label: string;
}> = [
  { value: "all", label: "Toutes les périodes" },
  { value: "MONTHLY", label: "Mensuel" },
  { value: "QUARTERLY", label: "Trimestriel" },
  { value: "YEARLY", label: "Annuel" },
  { value: "ONE_TIME", label: "Paiement unique" },
];

const SORT_OPTIONS: Array<{
  value: AdminSubscriptionSort;
  label: string;
}> = [
  { value: "recent", label: "Plus récents" },
  { value: "oldest", label: "Plus anciens" },
  { value: "ending_soon", label: "Expire bientôt" },
  { value: "price_desc", label: "Prix décroissant" },
  { value: "price_asc", label: "Prix croissant" },
];

export default function SubscriptionsFilters({
  value,
  options,
  disabled,
  onChange,
  onReset,
}: {
  value: SubscriptionsFilterState;
  options: GetAdminSubscriptionsResult["options"];
  disabled: boolean;
  onChange: (next: SubscriptionsFilterState) => void;
  onReset: () => void;
}) {
  function update<K extends keyof SubscriptionsFilterState>(
    key: K,
    nextValue: SubscriptionsFilterState[K],
  ) {
    onChange({
      ...value,
      [key]: nextValue,
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
                update("search", event.target.value)
              }
              placeholder="Organisateur, e-mail, plan..."
              className={`${controlClass} pl-10`}
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
                  | SubscriptionStatus
                  | "all",
              )
            }
            className={controlClass}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Plan
          </span>
          <select
            value={value.planId}
            disabled={disabled}
            onChange={(event) =>
              update("planId", event.target.value)
            }
            className={controlClass}
          >
            <option value="">Tous les plans</option>
            {options.plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Période
          </span>
          <select
            value={value.billingPeriod}
            disabled={disabled}
            onChange={(event) =>
              update(
                "billingPeriod",
                event.target.value as
                  | SubscriptionBillingPeriod
                  | "all",
              )
            }
            className={controlClass}
          >
            {BILLING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Devise
          </span>
          <select
            value={value.currency}
            disabled={disabled}
            onChange={(event) =>
              update("currency", event.target.value)
            }
            className={controlClass}
          >
            <option value="">Toutes</option>
            {options.currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Renouvellement
          </span>
          <select
            value={value.autoRenew}
            disabled={disabled}
            onChange={(event) =>
              update(
                "autoRenew",
                event.target.value as
                  | "all"
                  | "true"
                  | "false",
              )
            }
            className={controlClass}
          >
            <option value="all">Tous</option>
            <option value="true">Automatique</option>
            <option value="false">Manuel</option>
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Expire avant
          </span>
          <input
            type="date"
            value={value.endingBefore}
            disabled={disabled}
            onChange={(event) =>
              update("endingBefore", event.target.value)
            }
            className={controlClass}
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
                event.target.value as AdminSubscriptionSort,
              )
            }
            className={controlClass}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
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
