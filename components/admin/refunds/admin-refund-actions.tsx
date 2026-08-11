"use client";

import {
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  useState,
} from "react";

import ApproveRefundDialog from "@/components/admin/refunds/approve-refund-dialog";
import RejectRefundDialog from "@/components/admin/refunds/reject-refund-dialog";
import type {
  AdminRefundDetail,
} from "@/components/admin/refunds/admin-refunds-page";

export default function AdminRefundActions({
  refund,
  onComplete,
}: {
  refund:
    AdminRefundDetail;
  onComplete:
    (
      message: string,
    ) => Promise<void> |
    void;
}) {
  const [
    approveOpen,
    setApproveOpen,
  ] =
    useState(false);

  const [
    rejectOpen,
    setRejectOpen,
  ] =
    useState(false);

  const canDecide =
    refund.status ===
      "PENDING" &&
    (
      refund.workflowStage ===
        "FORWARDED_TO_ADMIN" ||
      refund.workflowStage ===
        "ADMIN_REVIEW"
    );

  if (!canDecide) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
        <p className="text-sm font-black text-white">
          Aucune action disponible
        </p>
        <p className="mt-1 text-xs leading-5 text-neutral-500">
          Cette demande a déjà quitté l’étape de décision administrative.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() =>
            setApproveOpen(
              true,
            )
          }
          className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-4 text-sm font-black text-black"
        >
          <CheckCircle2 className="h-4 w-4" />
          Approuver
        </button>

        <button
          type="button"
          onClick={() =>
            setRejectOpen(
              true,
            )
          }
          className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/[0.06] px-4 text-sm font-black text-red-200"
        >
          <XCircle className="h-4 w-4" />
          Refuser
        </button>
      </div>

      <ApproveRefundDialog
        refund={
          refund
        }
        open={
          approveOpen
        }
        onClose={() =>
          setApproveOpen(
            false,
          )
        }
        onComplete={
          onComplete
        }
      />

      <RejectRefundDialog
        refund={
          refund
        }
        open={
          rejectOpen
        }
        onClose={() =>
          setRejectOpen(
            false,
          )
        }
        onComplete={
          onComplete
        }
      />
    </>
  );
}
