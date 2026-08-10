"use client";

import {
  CheckCircle2,
  CircleDashed,
  CircleOff,
  Clock3,
  XCircle,
} from "lucide-react";

export type MarketingPaymentStatus =
  | "PAID"
  | "PENDING"
  | "FAILED"
  | "REFUNDED"
  | "NOT_REQUIRED";

const CONFIG = {
  PAID: {
    label: "Payé",
    className:
      "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300",
    icon: CheckCircle2,
  },
  PENDING: {
    label: "En attente",
    className:
      "border-amber-400/20 bg-amber-400/[0.08] text-amber-300",
    icon: Clock3,
  },
  FAILED: {
    label: "Échec",
    className:
      "border-red-400/20 bg-red-400/[0.08] text-red-300",
    icon: XCircle,
  },
  REFUNDED: {
    label: "Remboursé",
    className:
      "border-violet-400/20 bg-violet-400/[0.08] text-violet-300",
    icon: CircleDashed,
  },
  NOT_REQUIRED: {
    label: "Non requis",
    className:
      "border-neutral-400/20 bg-neutral-400/[0.08] text-neutral-300",
    icon: CircleOff,
  },
} as const;

export default function MarketingPaymentStatusBadge({
  status,
}: {
  status: MarketingPaymentStatus;
}) {
  const config = CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${config.className}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {config.label}
    </span>
  );
}
