"use client";

import { RefreshCw, Sparkles } from "lucide-react";

import ExportSubscriptionsButton, {
  type SubscriptionExportFilters,
} from "./export-subscriptions-button";

export default function SubscriptionsHeader({
  loading,
  filters,
  onRefresh,
}: {
  loading: boolean;
  filters: SubscriptionExportFilters;
  onRefresh: () => void;
}) {
  return (
    <header className="rounded-2xl border border-white/[0.08] bg-[#071019] p-5 sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/[0.08] text-violet-300">
            <Sparkles className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-violet-300">
              Administration Tikemia
            </p>

            <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Abonnements organisateurs
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
              Suivez les plans actifs, contrôlez les privilèges, suspendez,
              annulez, prolongez ou changez les abonnements des organisateurs.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-sm font-bold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading ? "animate-spin" : ""
              }`}
            />
            Actualiser
          </button>

          <ExportSubscriptionsButton filters={filters} />
        </div>
      </div>
    </header>
  );
}
