"use client";

import {
  Search,
} from "lucide-react";

import type {
  AdminRefundWorkflowStage,
} from "@/components/admin/refunds/admin-refunds-page";

const STAGES =
  [
    ["ALL", "Toutes"],
    ["FORWARDED_TO_ADMIN", "À valider"],
    ["ADMIN_REVIEW", "Examen admin"],
    ["REFUND_PROCESSING", "Traitement"],
    ["REFUNDED", "Remboursées"],
    ["ADMIN_REJECTED", "Refusées"],
    ["REFUND_FAILED", "Échecs"],
  ] as const;

const STATUSES =
  [
    ["ALL", "Tous statuts"],
    ["PENDING", "Pending"],
    ["PROCESSING", "Processing"],
    ["SUCCESS", "Success"],
    ["FAILED", "Failed"],
    ["CANCELLED", "Cancelled"],
  ] as const;

export default function AdminRefundFilters({
  search,
  workflowStage,
  status,
  onSearchChange,
  onWorkflowStageChange,
  onStatusChange,
}: {
  search: string;
  workflowStage:
    AdminRefundWorkflowStage |
    "ALL";
  status: string;
  onSearchChange:
    (
      value: string,
    ) => void;
  onWorkflowStageChange:
    (
      value:
        AdminRefundWorkflowStage |
        "ALL",
    ) => void;
  onStatusChange:
    (
      value: string,
    ) => void;
}) {
  return (
    <div className="space-y-4 border-b border-white/[0.07] p-4 sm:p-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

          <input
            type="search"
            value={
              search
            }
            onChange={
              (event) =>
                onSearchChange(
                  event.target
                    .value,
                )
            }
            placeholder="Client, organisateur, événement, référence…"
            className="h-12 w-full rounded-xl border border-white/[0.08] bg-black/20 pl-10 pr-4 text-sm text-white outline-none placeholder:text-neutral-700 focus:border-lime-400/35"
          />
        </div>

        <select
          value={
            status
          }
          onChange={
            (event) =>
              onStatusChange(
                event.target
                  .value,
              )
          }
          className="h-12 rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm font-bold text-white outline-none"
        >
          {STATUSES.map(
            (
              [
                value,
                label,
              ],
            ) => (
              <option
                key={
                  value
                }
                value={
                  value
                }
              >
                {label}
              </option>
            ),
          )}
        </select>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {STAGES.map(
          (
            [
              value,
              label,
            ],
          ) => {
            const active =
              workflowStage ===
              value;

            return (
              <button
                key={
                  value
                }
                type="button"
                onClick={() =>
                  onWorkflowStageChange(
                    value,
                  )
                }
                className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-black transition ${
                  active
                    ? "border-lime-400/30 bg-lime-400/[0.10] text-lime-300"
                    : "border-white/[0.08] bg-white/[0.025] text-neutral-500 hover:text-white"
                }`}
              >
                {label}
              </button>
            );
          },
        )}
      </div>
    </div>
  );
}
