"use client";

import type { PaymentStatus } from "@prisma/client";
import { Search, X } from "lucide-react";

import type {
  AdminPaymentSort,
  GetAdminPaymentsResult,
} from "@/lib/admin/payments/get-admin-payments";

export type PaymentsFilterState = {
  search: string;
  status: PaymentStatus | "all";
  provider: string;
  currency: string;
  method: string;
  dateFrom: string;
  dateTo: string;
  sort: AdminPaymentSort;
};

const STATUS_OPTIONS: Array<{
  value: PaymentStatus | "all";
  label: string;
}> = [
  { value: "all", label: "Tous les statuts" },
  { value: "PENDING", label: "En attente" },
  { value: "PROCESSING", label: "Traitement" },
  { value: "SUCCESS", label: "Réussi" },
  { value: "FAILED", label: "Échoué" },
  { value: "CANCELLED", label: "Annulé" },
  { value: "EXPIRED", label: "Expiré" },
  { value: "PARTIALLY_REFUNDED", label: "Remboursé partiellement" },
  { value: "REFUNDED", label: "Remboursé" },
  { value: "DISPUTED", label: "Litige" },
];

const SORT_OPTIONS: Array<{
  value: AdminPaymentSort;
  label: string;
}> = [
  { value: "recent", label: "Plus récents" },
  { value: "oldest", label: "Plus anciens" },
  { value: "amount_desc", label: "Montant décroissant" },
  { value: "amount_asc", label: "Montant croissant" },
];

const controlClass =
  "h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-neutral-200 outline-none transition placeholder:text-neutral-700 focus:border-sky-400/30";

export default function PaymentsFilters({
  value,
  options,
  disabled,
  onChange,
  onReset,
}: {
  value: PaymentsFilterState;
  options: GetAdminPaymentsResult["options"];
  disabled: boolean;
  onChange: (next: PaymentsFilterState) => void;
  onReset: () => void;
}) {
  function update<K extends keyof PaymentsFilterState>(
    key: K,
    nextValue: PaymentsFilterState[K],
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
              onChange={(event) => update("search", event.target.value)}
              placeholder="Référence, client, e-mail, événement..."
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
                event.target.value as PaymentStatus | "all",
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
            Fournisseur
          </span>
          <select
            value={value.provider}
            disabled={disabled}
            onChange={(event) => update("provider", event.target.value)}
            className={controlClass}
          >
            <option value="">Tous</option>
            {options.providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
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
            onChange={(event) => update("currency", event.target.value)}
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
            Méthode
          </span>
          <select
            value={value.method}
            disabled={disabled}
            onChange={(event) => update("method", event.target.value)}
            className={controlClass}
          >
            <option value="">Toutes</option>
            {options.methods.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </label>

        <label className="xl:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Du
          </span>
          <input
            type="date"
            value={value.dateFrom}
            disabled={disabled}
            onChange={(event) => update("dateFrom", event.target.value)}
            className={controlClass}
          />
        </label>

        <label className="xl:col-span-2">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Au
          </span>
          <input
            type="date"
            value={value.dateTo}
            disabled={disabled}
            onChange={(event) => update("dateTo", event.target.value)}
            className={controlClass}
          />
        </label>

        <label className="xl:col-span-3">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
            Trier par
          </span>
          <select
            value={value.sort}
            disabled={disabled}
            onChange={(event) =>
              update("sort", event.target.value as AdminPaymentSort)
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
