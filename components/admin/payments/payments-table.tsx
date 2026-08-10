"use client";

import { ChevronLeft, ChevronRight, CreditCard } from "lucide-react";

import type {
  AdminPaymentListItem,
  GetAdminPaymentsResult,
} from "@/lib/admin/payments/get-admin-payments";

import PaymentRow from "./payment-row";

export default function PaymentsTable({
  payments,
  pagination,
  loading,
  onOpen,
  onPageChange,
}: {
  payments: readonly AdminPaymentListItem[];
  pagination: GetAdminPaymentsResult["pagination"];
  loading: boolean;
  onOpen: (paymentId: string) => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071019]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1320px] text-left text-sm">
          <thead className="bg-white/[0.025]">
            <tr className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-600">
              <th className="px-4 py-3">Paiement</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Événement</th>
              <th className="px-4 py-3">Organisateur</th>
              <th className="px-4 py-3">Canal</th>
              <th className="px-4 py-3 text-right">Montant</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>

          <tbody>
            {payments.map((payment) => (
              <PaymentRow
                key={payment.id}
                payment={payment}
                onOpen={onOpen}
              />
            ))}
          </tbody>
        </table>
      </div>

      {payments.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/[0.07] text-sky-300">
            <CreditCard className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-lg font-black text-white">
            Aucun paiement trouvé
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-neutral-600">
            Aucun paiement ne correspond actuellement aux critères sélectionnés.
          </p>
        </div>
      ) : null}

      <footer className="flex flex-col gap-3 border-t border-white/[0.06] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-neutral-600">
          {pagination.totalItems.toLocaleString("fr-FR")} paiement(s) · Page{" "}
          {pagination.totalPages === 0 ? 0 : pagination.page} sur{" "}
          {pagination.totalPages}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading || !pagination.hasPreviousPage}
            onClick={() => onPageChange(pagination.page - 1)}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-white/[0.08] px-3 text-xs font-bold text-neutral-400 hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </button>

          <button
            type="button"
            disabled={loading || !pagination.hasNextPage}
            onClick={() => onPageChange(pagination.page + 1)}
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
