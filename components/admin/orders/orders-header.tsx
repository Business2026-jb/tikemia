"use client";

import {
  RefreshCw,
  ShoppingBag,
} from "lucide-react";

export default function OrdersHeader({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className="rounded-3xl border border-white/[0.08] bg-[#071014] p-4 shadow-[0_24px_75px_rgba(0,0,0,0.22)] sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5">
            <ShoppingBag className="h-3.5 w-3.5 text-emerald-300" />

            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
              Administration Tikemia
            </span>
          </div>

          <h1 className="mt-4 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
            Commandes
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
            Suivez les commandes, paiements, commissions, clients et ventes des
            événements depuis un espace unique.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-xl border border-white/[0.09] bg-white/[0.04] px-4 text-sm font-bold text-neutral-200 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              refreshing ? "animate-spin" : ""
            }`}
          />

          Actualiser
        </button>
      </div>
    </header>
  );
}
