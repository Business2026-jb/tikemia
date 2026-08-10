"use client";

import {
  Filter,
  Search,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import type {
  AdminOrderSort,
  GetAdminOrdersResult,
} from "@/lib/admin/orders/get-admin-orders";

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  PAID: "Payée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
  FAILED: "Échouée",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  SUCCESS: "Réussi",
  FAILED: "Échoué",
  REFUNDED: "Remboursé",
};

export default function OrdersFilters({
  data,
  disabled,
  hasActiveFilters,
  onNavigate,
  onReset,
}: {
  data: GetAdminOrdersResult;
  disabled: boolean;
  hasActiveFilters: boolean;
  onNavigate: (
    changes: Record<string, string | null>,
  ) => void;
  onReset: () => void;
}) {
  const [
    search,
    setSearch,
  ] =
    useState(
      data.appliedFilters.search,
    );

  const [
    filtersOpen,
    setFiltersOpen,
  ] =
    useState(false);

  useEffect(() => {
    setSearch(
      data.appliedFilters.search,
    );
  }, [
    data.appliedFilters.search,
  ]);

  function submitSearch(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    onNavigate({
      search:
        search.trim() ||
        null,
    });
  }

  function resetAll() {
    setSearch("");
    onReset();
  }

  return (
    <section className="mt-5 rounded-3xl border border-white/[0.08] bg-[#071014] p-3 sm:p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <form
          onSubmit={submitSearch}
          className="flex min-w-0 flex-1 gap-2"
        >
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

            <input
              value={search}
              disabled={disabled}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Référence, client, événement, organisateur..."
              className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#050b0e] pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-emerald-400/30 disabled:opacity-50"
            />
          </label>

          <button
            type="submit"
            disabled={disabled}
            className="h-11 rounded-xl bg-emerald-400 px-4 text-sm font-black text-[#04100a] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Rechercher
          </button>
        </form>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              setFiltersOpen(
                (current) =>
                  !current,
              )
            }
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.07] disabled:opacity-50 xl:flex-none"
          >
            <Filter className="h-4 w-4" />
            Filtres
          </button>

          {hasActiveFilters ? (
            <button
              type="button"
              disabled={disabled}
              onClick={resetAll}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-red-400/15 bg-red-400/[0.05] px-4 text-sm font-bold text-red-300 transition hover:bg-red-400/[0.09] disabled:opacity-50 xl:flex-none"
            >
              <X className="h-4 w-4" />
              Effacer
            </button>
          ) : null}
        </div>
      </div>

      {filtersOpen ? (
        <div className="mt-3 grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-2 xl:grid-cols-6">
          <select
            value={data.appliedFilters.status}
            disabled={disabled}
            onChange={(event) =>
              onNavigate({
                status:
                  event.target.value,
              })
            }
            className="h-11 rounded-xl border border-white/[0.08] bg-[#050b0e] px-3 text-sm text-neutral-300 outline-none disabled:opacity-50"
          >
            <option value="all">
              Tous les statuts
            </option>

            {data.options.statuses.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {ORDER_STATUS_LABELS[
                    status
                  ] ?? status}
                </option>
              ),
            )}
          </select>

          <select
            value={
              data.appliedFilters
                .paymentStatus
            }
            disabled={disabled}
            onChange={(event) =>
              onNavigate({
                paymentStatus:
                  event.target.value,
              })
            }
            className="h-11 rounded-xl border border-white/[0.08] bg-[#050b0e] px-3 text-sm text-neutral-300 outline-none disabled:opacity-50"
          >
            <option value="all">
              Tous les paiements
            </option>

            {data.options.paymentStatuses.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {PAYMENT_STATUS_LABELS[
                    status
                  ] ?? status}
                </option>
              ),
            )}
          </select>

          <select
            value={
              data.appliedFilters
                .paymentMethod
            }
            disabled={disabled}
            onChange={(event) =>
              onNavigate({
                paymentMethod:
                  event.target.value ||
                  null,
              })
            }
            className="h-11 rounded-xl border border-white/[0.08] bg-[#050b0e] px-3 text-sm text-neutral-300 outline-none disabled:opacity-50"
          >
            <option value="">
              Toutes les méthodes
            </option>

            {data.options.paymentMethods.map(
              (method) => (
                <option
                  key={method}
                  value={method}
                >
                  {method}
                </option>
              ),
            )}
          </select>

          <select
            value={
              data.appliedFilters
                .currency
            }
            disabled={disabled}
            onChange={(event) =>
              onNavigate({
                currency:
                  event.target.value ||
                  null,
              })
            }
            className="h-11 rounded-xl border border-white/[0.08] bg-[#050b0e] px-3 text-sm text-neutral-300 outline-none disabled:opacity-50"
          >
            <option value="">
              Toutes les devises
            </option>

            {data.options.currencies.map(
              (currency) => (
                <option
                  key={currency}
                  value={currency}
                >
                  {currency}
                </option>
              ),
            )}
          </select>

          <input
            type="date"
            value={
              data.appliedFilters
                .dateFrom
            }
            disabled={disabled}
            onChange={(event) =>
              onNavigate({
                dateFrom:
                  event.target.value ||
                  null,
              })
            }
            aria-label="Date de début"
            className="h-11 rounded-xl border border-white/[0.08] bg-[#050b0e] px-3 text-sm text-neutral-300 outline-none disabled:opacity-50"
          />

          <input
            type="date"
            value={
              data.appliedFilters
                .dateTo
            }
            disabled={disabled}
            onChange={(event) =>
              onNavigate({
                dateTo:
                  event.target.value ||
                  null,
              })
            }
            aria-label="Date de fin"
            className="h-11 rounded-xl border border-white/[0.08] bg-[#050b0e] px-3 text-sm text-neutral-300 outline-none disabled:opacity-50"
          />

          <select
            value={
              data.appliedFilters
                .sort
            }
            disabled={disabled}
            onChange={(event) =>
              onNavigate({
                sort:
                  event.target
                    .value as AdminOrderSort,
              })
            }
            className="h-11 rounded-xl border border-white/[0.08] bg-[#050b0e] px-3 text-sm text-neutral-300 outline-none disabled:opacity-50 sm:col-span-2 xl:col-span-2"
          >
            <option value="NEWEST">
              Plus récentes
            </option>
            <option value="OLDEST">
              Plus anciennes
            </option>
            <option value="TOTAL_DESC">
              Montant décroissant
            </option>
            <option value="TOTAL_ASC">
              Montant croissant
            </option>
          </select>
        </div>
      ) : null}
    </section>
  );
}
