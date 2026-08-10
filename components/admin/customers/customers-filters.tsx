"use client";

import {
  RefreshCw,
  Search,
} from "lucide-react";

import type {
  CustomerSort,
  CustomerStatusFilter,
} from "@/components/admin/customers/admin-customers-page";

export default function CustomersFilters({
  search,
  status,
  sort,
  disabled,
  refreshing,
  onSearchChange,
  onStatusChange,
  onSortChange,
  onRefresh,
}: {
  search: string;
  status: CustomerStatusFilter;
  sort: CustomerSort;
  disabled: boolean;
  refreshing: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: CustomerStatusFilter) => void;
  onSortChange: (value: CustomerSort) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.065] bg-[#071014] p-3 lg:flex-row lg:items-center">
      <label className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
        <input
          type="search"
          value={search}
          disabled={disabled}
          onChange={(event) =>
            onSearchChange(
              event.target.value,
            )
          }
          placeholder="Rechercher par nom, e-mail ou téléphone…"
          className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 pl-10 pr-4 text-sm text-white outline-none placeholder:text-neutral-700 focus:border-emerald-400/25 disabled:opacity-50"
        />
      </label>

      <select
        value={status}
        disabled={disabled}
        onChange={(event) =>
          onStatusChange(
            event.target.value as CustomerStatusFilter,
          )
        }
        className="h-11 rounded-xl border border-white/[0.08] bg-[#091216] px-3 text-sm font-semibold text-neutral-300 outline-none focus:border-emerald-400/25 disabled:opacity-50"
      >
        <option value="all">
          Tous les clients
        </option>
        <option value="registered">
          Comptes inscrits
        </option>
        <option value="guest">
          Acheteurs invités
        </option>
        <option value="active">
          Comptes actifs
        </option>
        <option value="inactive">
          Comptes inactifs
        </option>
        <option value="verified">
          E-mails vérifiés
        </option>
        <option value="unverified">
          E-mails non vérifiés
        </option>
      </select>

      <select
        value={sort}
        disabled={disabled}
        onChange={(event) =>
          onSortChange(
            event.target.value as CustomerSort,
          )
        }
        className="h-11 rounded-xl border border-white/[0.08] bg-[#091216] px-3 text-sm font-semibold text-neutral-300 outline-none focus:border-emerald-400/25 disabled:opacity-50"
      >
        <option value="recent_purchase">
          Achat le plus récent
        </option>
        <option value="oldest_purchase">
          Achat le plus ancien
        </option>
        <option value="most_orders">
          Plus de commandes
        </option>
        <option value="most_tickets">
          Plus de billets
        </option>
        <option value="highest_spend">
          Plus gros acheteurs
        </option>
        <option value="name_asc">
          Nom A → Z
        </option>
        <option value="name_desc">
          Nom Z → A
        </option>
      </select>

      <button
        type="button"
        onClick={onRefresh}
        disabled={
          disabled ||
          refreshing
        }
        aria-label="Actualiser la liste"
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-4 text-xs font-black text-neutral-300 transition hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        <RefreshCw
          className={`h-4 w-4 ${
            refreshing
              ? "animate-spin"
              : ""
          }`}
        />
        Actualiser
      </button>
    </div>
  );
}
