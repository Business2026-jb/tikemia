"use client";

import {
  CheckCircle2,
  Clock3,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import {
  useMemo,
} from "react";

import type {
  AdminRefundListItem,
} from "@/components/admin/refunds/admin-refunds-page";

export default function AdminRefundsHeader({
  refunds,
  refreshing,
  onRefresh,
}: {
  refunds:
    readonly AdminRefundListItem[];
  refreshing:
    boolean;
  onRefresh: () => void;
}) {
  const summary =
    useMemo(
      () => ({
        total:
          refunds.length,
        waiting:
          refunds.filter(
            (refund) =>
              refund.workflowStage ===
                "FORWARDED_TO_ADMIN" ||
              refund.workflowStage ===
                "ADMIN_REVIEW",
          ).length,
        processing:
          refunds.filter(
            (refund) =>
              refund.workflowStage ===
              "REFUND_PROCESSING",
          ).length,
        refunded:
          refunds.filter(
            (refund) =>
              refund.workflowStage ===
              "REFUNDED",
          ).length,
      }),
      [refunds],
    );

  return (
    <section className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#071015]">
      <div className="flex flex-col gap-5 border-b border-white/[0.07] p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-lime-300">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-[11px] font-black uppercase tracking-[0.16em]">
              Administration Tikemia
            </span>
          </div>

          <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
            Remboursements
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
            Analysez les demandes transmises par les organisateurs avant toute décision finale.
          </p>
        </div>

        <button
          type="button"
          onClick={
            onRefresh
          }
          disabled={
            refreshing
          }
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm font-bold text-neutral-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCcw
            className={`h-4 w-4 ${
              refreshing
                ? "animate-spin"
                : ""
            }`}
          />
          Actualiser
        </button>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
        <Summary
          icon={
            RotateCcw
          }
          label="Affichées"
          value={
            summary.total
          }
        />

        <Summary
          icon={
            Clock3
          }
          label="À valider"
          value={
            summary.waiting
          }
        />

        <Summary
          icon={
            RotateCcw
          }
          label="En traitement"
          value={
            summary.processing
          }
        />

        <Summary
          icon={
            CheckCircle2
          }
          label="Remboursées"
          value={
            summary.refunded
          }
        />
      </div>
    </section>
  );
}

function Summary({
  icon: Icon,
  label,
  value,
}: {
  icon:
    typeof RotateCcw;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <div className="flex items-center justify-between gap-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-lime-400/15 bg-lime-400/[0.07] text-lime-300">
          <Icon className="h-4 w-4" />
        </span>

        <span className="text-2xl font-black text-white">
          {value}
        </span>
      </div>

      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </p>
    </div>
  );
}
