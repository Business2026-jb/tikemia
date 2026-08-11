"use client";

import {
  Inbox,
} from "lucide-react";

import OrganizerRefundCard from "@/components/organizer/refunds/organizer-refund-card";
import type {
  OrganizerRefundListItem,
} from "@/components/organizer/refunds/organizer-refunds-page";

export default function OrganizerRefundList({
  refunds,
  onOpenRefund,
}: {
  refunds:
    readonly OrganizerRefundListItem[];
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
      <div className="p-8 text-center sm:p-12">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-neutral-500">
          <Inbox className="h-6 w-6" />
        </span>

        <h3 className="mt-4 text-base font-black text-white">
          Aucune demande
        </h3>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">
          Aucune demande de remboursement ne correspond actuellement à ce filtre.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2 2xl:grid-cols-3">
      {refunds.map(
        (refund) => (
          <OrganizerRefundCard
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
    </div>
  );
}
