"use client";

import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

import type {
  AdminSubscriptionListItem,
  GetAdminSubscriptionsResult,
} from "@/lib/admin/subscriptions/get-admin-subscriptions";

import SubscriptionRow from "./subscription-row";

export default function SubscriptionsTable({
  subscriptions,
  pagination,
  loading,
  onOpen,
  onActivate,
  onSuspend,
  onCancel,
  onExtend,
  onChangePlan,
  onPageChange,
}: {
  subscriptions: readonly AdminSubscriptionListItem[];
  pagination: GetAdminSubscriptionsResult["pagination"];
  loading: boolean;
  onOpen: (subscriptionId: string) => void;
  onActivate: (subscription: AdminSubscriptionListItem) => void;
  onSuspend: (subscription: AdminSubscriptionListItem) => void;
  onCancel: (subscription: AdminSubscriptionListItem) => void;
  onExtend: (subscription: AdminSubscriptionListItem) => void;
  onChangePlan: (subscription: AdminSubscriptionListItem) => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071019]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1450px] text-left text-sm">
          <thead className="bg-white/[0.025]">
            <tr className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-600">
              <th className="px-4 py-3">Organisateur</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3 text-right">Prix</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Période</th>
              <th className="px-4 py-3">Renouvellement</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {subscriptions.map((subscription) => (
              <SubscriptionRow
                key={subscription.id}
                subscription={subscription}
                onOpen={onOpen}
                onActivate={onActivate}
                onSuspend={onSuspend}
                onCancel={onCancel}
                onExtend={onExtend}
                onChangePlan={onChangePlan}
              />
            ))}
          </tbody>
        </table>
      </div>

      {subscriptions.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/[0.07] text-violet-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-lg font-black text-white">
            Aucun abonnement trouvé
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-neutral-600">
            Aucun abonnement ne correspond aux critères sélectionnés.
          </p>
        </div>
      ) : null}

      <footer className="flex flex-col gap-3 border-t border-white/[0.06] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-neutral-600">
          {pagination.totalItems.toLocaleString("fr-FR")} abonnement(s) ·
          Page{" "}
          {pagination.totalPages === 0
            ? 0
            : pagination.page}{" "}
          sur {pagination.totalPages}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading || !pagination.hasPreviousPage}
            onClick={() =>
              onPageChange(pagination.page - 1)
            }
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-white/[0.08] px-3 text-xs font-bold text-neutral-400 hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </button>

          <button
            type="button"
            disabled={loading || !pagination.hasNextPage}
            onClick={() =>
              onPageChange(pagination.page + 1)
            }
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-white/[0.08] px-3 text-xs font-bold text-neutral-400 hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            Suivant
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </section>
  );
}
