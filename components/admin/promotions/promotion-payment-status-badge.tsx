"use client";

import {
  CheckCircle2,
  CircleDollarSign,
  XCircle,
} from "lucide-react";

export default function PromotionPaymentStatusBadge({
  paid,
  amount,
  currency,
}: {
  paid: boolean;
  amount?: string | null;
  currency?: string | null;
}) {
  if (!paid) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/20 bg-red-400/[0.08] px-2.5 py-1 text-[11px] font-extrabold text-red-300">
        <XCircle className="h-3.5 w-3.5" />
        Non confirmé
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-2.5 py-1 text-[11px] font-extrabold text-emerald-300">
      {amount && currency ? (
        <CircleDollarSign className="h-3.5 w-3.5" />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5" />
      )}
      {amount && currency ? `${amount} ${currency}` : "Confirmé"}
    </span>
  );
}
