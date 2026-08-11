"use client";

import {
  Inbox,
} from "lucide-react";

import AdminRefundRow from "@/components/admin/refunds/admin-refund-row";
import type {
  AdminRefundListItem,
} from "@/components/admin/refunds/admin-refunds-page";

export default function AdminRefundsTable({
  refunds,
  onOpenRefund,
}: {
  refunds:
    readonly AdminRefundListItem[];
  onOpenRefund:
    (
      refundId: string,
    ) => void;
}) {
  if (
    refunds.length ===
    0
  ) {
    return (
      <div className="p-10 text-center">
        <Inbox className="mx-auto h-7 w-7 text-neutral-600" />
        <h3 className="mt-4 text-base font-black text-white">
          Aucun remboursement
        </h3>
        <p className="mt-2 text-sm text-neutral-500">
          Aucun dossier ne correspond aux filtres sélectionnés.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1080px]">
          <thead>
            <tr className="border-b border-white/[0.07] text-left text-[10px] font-black uppercase tracking-[0.1em] text-neutral-600">
              <th className="px-5 py-4">
                Demande
              </th>
              <th className="px-5 py-4">
                Client
              </th>
              <th className="px-5 py-4">
                Organisateur
              </th>
              <th className="px-5 py-4">
                Montant
              </th>
              <th className="px-5 py-4">
                Statut
              </th>
              <th className="px-5 py-4 text-right">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {refunds.map(
              (refund) => (
                <AdminRefundRow
                  key={
                    refund.id
                  }
                  refund={
                    refund
                  }
                  onOpen={() =>
                    onOpenRefund(
                      refund.id,
                    )
                  }
                />
              ),
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-4 lg:hidden">
        {refunds.map(
          (refund) => (
            <AdminRefundRow
              key={
                refund.id
              }
              refund={
                refund
              }
              mobile
              onOpen={() =>
                onOpenRefund(
                  refund.id,
                )
              }
            />
          ),
        )}
      </div>
    </>
  );
}
