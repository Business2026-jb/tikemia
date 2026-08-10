"use client";

import {
  ChevronLeft,
  ChevronRight,
  Megaphone,
} from "lucide-react";

import type {
  AdminPromotionListItem,
  GetAdminPromotionsResult,
} from "@/lib/admin/promotions/get-admin-promotions";

import PromotionRow from "./promotion-row";

export default function PromotionsTable({
  promotions,
  pagination,
  loading,
  onOpen,
  onApprove,
  onReject,
  onSuspend,
  onCancel,
  onExtend,
  onPriority,
  onPageChange,
}: {
  promotions:
    readonly AdminPromotionListItem[];
  pagination:
    GetAdminPromotionsResult["pagination"];
  loading:
    boolean;
  onOpen:
    (id: string) => void;
  onApprove:
    (
      item:
        AdminPromotionListItem,
    ) => void;
  onReject:
    (
      item:
        AdminPromotionListItem,
    ) => void;
  onSuspend:
    (
      item:
        AdminPromotionListItem,
    ) => void;
  onCancel:
    (
      item:
        AdminPromotionListItem,
    ) => void;
  onExtend:
    (
      item:
        AdminPromotionListItem,
    ) => void;
  onPriority:
    (
      item:
        AdminPromotionListItem,
    ) => void;
  onPageChange:
    (page: number) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071019]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1550px] text-left text-sm">
          <thead className="bg-white/[0.025]">
            <tr className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-600">
              <th className="px-4 py-3">
                Événement
              </th>
              <th className="px-4 py-3">
                Organisateur
              </th>
              <th className="px-4 py-3">
                Paiement
              </th>
              <th className="px-4 py-3">
                Priorité
              </th>
              <th className="px-4 py-3">
                Statut
              </th>
              <th className="px-4 py-3">
                Période
              </th>
              <th className="px-4 py-3 text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {promotions.map(
              (promotion) => (
                <PromotionRow
                  key={promotion.id}
                  promotion={promotion}
                  onOpen={onOpen}
                  onApprove={onApprove}
                  onReject={onReject}
                  onSuspend={onSuspend}
                  onCancel={onCancel}
                  onExtend={onExtend}
                  onPriority={onPriority}
                />
              ),
            )}
          </tbody>
        </table>
      </div>

      {promotions.length ===
      0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/[0.07] text-fuchsia-300">
            <Megaphone className="h-5 w-5" />
          </div>

          <h3 className="mt-4 text-lg font-black text-white">
            Aucune promotion trouvée
          </h3>

          <p className="mt-2 max-w-md text-sm leading-6 text-neutral-600">
            Aucune demande ne correspond aux critères sélectionnés.
          </p>
        </div>
      ) : null}

      <footer className="flex flex-col gap-3 border-t border-white/[0.06] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-neutral-600">
          {pagination.totalItems.toLocaleString(
            "fr-FR",
          )}{" "}
          promotion(s) · Page{" "}
          {pagination.totalPages ===
          0
            ? 0
            : pagination.page}{" "}
          sur{" "}
          {pagination.totalPages}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={
              loading ||
              !pagination.hasPreviousPage
            }
            onClick={() =>
              onPageChange(
                pagination.page -
                  1,
              )
            }
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-white/[0.08] px-3 text-xs font-bold text-neutral-400 hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </button>

          <button
            type="button"
            disabled={
              loading ||
              !pagination.hasNextPage
            }
            onClick={() =>
              onPageChange(
                pagination.page +
                  1,
              )
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
