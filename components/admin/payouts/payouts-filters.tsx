"use client";

import type {
  PayoutDestinationType,
  PayoutStatus,
} from "@prisma/client";
import {
  Search,
  X,
} from "lucide-react";

import type {
  AdminPayoutSort,
  GetAdminPayoutsResult,
} from "@/lib/admin/payouts/get-admin-payouts";

export type PayoutsFilterState = {
  search: string;
  status:
    | PayoutStatus
    | "all";
  destinationType:
    | PayoutDestinationType
    | "all";
  currency: string;
  dateFrom: string;
  dateTo: string;
  sort: AdminPayoutSort;
};

const STATUS_OPTIONS:
Array<{
  value:
    | PayoutStatus
    | "all";
  label: string;
}> = [
  {
    value: "all",
    label: "Tous les statuts",
  },
  {
    value: "PENDING",
    label: "En attente",
  },
  {
    value: "PROCESSING",
    label: "En traitement",
  },
  {
    value: "PAID",
    label: "Payé",
  },
  {
    value: "REJECTED",
    label: "Refusé",
  },
];

const SORT_OPTIONS:
Array<{
  value: AdminPayoutSort;
  label: string;
}> = [
  {
    value: "recent",
    label: "Plus récents",
  },
  {
    value: "oldest",
    label: "Plus anciens",
  },
  {
    value: "amount_desc",
    label: "Montant décroissant",
  },
  {
    value: "amount_asc",
    label: "Montant croissant",
  },
];

const controlClass =
  "h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-neutral-200 outline-none transition placeholder:text-neutral-700 focus:border-amber-400/30";

function methodLabel(
  type: PayoutDestinationType,
): string {
  switch (type) {
    case "BANK_ACCOUNT":
      return "Compte bancaire";

    case "MOBILE_MONEY":
      return "Mobile Money";

    case "CRYPTO_USDT_TRC20":
      return "USDT TRC20";

    default:
      return type;
  }
}

export default function PayoutsFilters({
  value,
  options,
  disabled,
  onChange,
  onReset,
}: {
  value:
    PayoutsFilterState;
  options:
    GetAdminPayoutsResult["options"];
  disabled:
    boolean;
  onChange:
    (
      next:
        PayoutsFilterState,
    ) => void;
  onReset:
    () => void;
}) {
  function update<
    K extends keyof PayoutsFilterState,
  >(
    key: K,
    nextValue:
      PayoutsFilterState[K],
  ) {
    onChange({
      ...value,
      [key]:
        nextValue,
    });
  }

  return (
    <section className="rounded-[24px] border border-white/[0.06] bg-white/[0.015] p-4 sm:p-5">
      <div className="grid gap-4 xl:grid-cols-12">
        <label className="xl:col-span-3">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Recherche
          </span>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

            <input
              value={
                value.search
              }
              disabled={
                disabled
              }
              onChange={(
                event,
              ) =>
                update(
                  "search",
                  event.target.value,
                )
              }
              placeholder="Référence, organisateur, e-mail..."
              className={`${controlClass} pl-10`}
            />
          </div>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Statut
          </span>

          <select
            value={
              value.status
            }
            disabled={
              disabled
            }
            onChange={(
              event,
            ) =>
              update(
                "status",
                event.target.value as
                  | PayoutStatus
                  | "all",
              )
            }
            className={
              controlClass
            }
          >
            {STATUS_OPTIONS.map(
              (
                option,
              ) => (
                <option
                  key={
                    option.value
                  }
                  value={
                    option.value
                  }
                >
                  {option.label}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Méthode
          </span>

          <select
            value={
              value.destinationType
            }
            disabled={
              disabled
            }
            onChange={(
              event,
            ) =>
              update(
                "destinationType",
                event.target.value as
                  | PayoutDestinationType
                  | "all",
              )
            }
            className={
              controlClass
            }
          >
            <option value="all">
              Toutes
            </option>

            {options.destinationTypes.map(
              (
                type,
              ) => (
                <option
                  key={
                    type
                  }
                  value={
                    type
                  }
                >
                  {methodLabel(
                    type,
                  )}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Devise
          </span>

          <select
            value={
              value.currency
            }
            disabled={
              disabled
            }
            onChange={(
              event,
            ) =>
              update(
                "currency",
                event.target.value,
              )
            }
            className={
              controlClass
            }
          >
            <option value="">
              Toutes
            </option>

            {options.currencies.map(
              (
                currency,
              ) => (
                <option
                  key={
                    currency
                  }
                  value={
                    currency
                  }
                >
                  {currency}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Du
          </span>

          <input
            type="date"
            value={
              value.dateFrom
            }
            disabled={
              disabled
            }
            onChange={(
              event,
            ) =>
              update(
                "dateFrom",
                event.target.value,
              )
            }
            className={
              controlClass
            }
          />
        </label>

        <label className="xl:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Au
          </span>

          <input
            type="date"
            value={
              value.dateTo
            }
            disabled={
              disabled
            }
            onChange={(
              event,
            ) =>
              update(
                "dateTo",
                event.target.value,
              )
            }
            className={
              controlClass
            }
          />
        </label>

        <label className="xl:col-span-3">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Trier par
          </span>

          <select
            value={
              value.sort
            }
            disabled={
              disabled
            }
            onChange={(
              event,
            ) =>
              update(
                "sort",
                event.target.value as AdminPayoutSort,
              )
            }
            className={
              controlClass
            }
          >
            {SORT_OPTIONS.map(
              (
                option,
              ) => (
                <option
                  key={
                    option.value
                  }
                  value={
                    option.value
                  }
                >
                  {option.label}
                </option>
              ),
            )}
          </select>
        </label>

        <div className="flex items-end xl:col-span-2">
          <button
            type="button"
            onClick={
              onReset
            }
            disabled={
              disabled
            }
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