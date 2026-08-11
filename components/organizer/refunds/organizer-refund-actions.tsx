"use client";

import {
  Send,
  XCircle,
} from "lucide-react";
import {
  useState,
} from "react";

import ForwardRefundDialog from "@/components/organizer/refunds/forward-refund-dialog";
import RejectRefundDialog from "@/components/organizer/refunds/reject-refund-dialog";
import type {
  OrganizerRefundDetail,
} from "@/components/organizer/refunds/organizer-refunds-page";

export default function OrganizerRefundActions({
  refund,
  onComplete,
}: {
  refund:
    OrganizerRefundDetail;
  onComplete:
    (
      message: string,
    ) => Promise<void> |
    void;
}) {
  const [
    forwardOpen,
    setForwardOpen,
  ] =
    useState(false);

  const [
    rejectOpen,
    setRejectOpen,
  ] =
    useState(false);

  const canReview =
    refund.workflowStage ===
      "ORGANIZER_REVIEW" &&
    refund.status ===
      "PENDING";

  if (!canReview) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
        <p className="text-sm font-black text-white">
          Décision enregistrée
        </p>

        <p className="mt-1 text-xs leading-5 text-neutral-500">
          Cette demande n’est plus modifiable depuis l’espace organisateur.
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
            setForwardOpen(
              true,
            )
          }
          className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-lime-500 to-orange-500 px-4 text-sm font-black text-black transition hover:brightness-105 active:scale-[0.99]"
        >
          <Send className="h-4 w-4" />
          Transmettre à Tikemia
        </button>

        <button
          type="button"
          onClick={() =>
            setRejectOpen(
              true,
            )
          }
          className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/[0.06] px-4 text-sm font-black text-red-200 transition hover:bg-red-400/[0.10] active:scale-[0.99]"
        >
          <XCircle className="h-4 w-4" />
          Refuser la demande
        </button>
      </div>

      <ForwardRefundDialog
        refund={
          refund
        }
        open={
          forwardOpen
        }
        onClose={() =>
          setForwardOpen(
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
