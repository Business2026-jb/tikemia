"use client";

import {
  CheckCircle2,
  Clock3,
  LoaderCircle,
  XCircle,
} from "lucide-react";
import type {
  PayoutStatus,
} from "@prisma/client";

const CONFIG: Record<
  PayoutStatus,
  {
    label: string;
    className: string;
    icon:
      | typeof CheckCircle2
      | typeof Clock3
      | typeof LoaderCircle
      | typeof XCircle;
  }
> = {
  PENDING: {
    label: "En attente",
    className:
      "border-amber-400/20 bg-amber-400/[0.08] text-amber-300",
    icon: Clock3,
  },

  PROCESSING: {
    label: "En traitement",
    className:
      "border-sky-400/20 bg-sky-400/[0.08] text-sky-300",
    icon: LoaderCircle,
  },

  PAID: {
    label: "Payé",
    className:
      "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300",
    icon: CheckCircle2,
  },

  REJECTED: {
    label: "Refusé",
    className:
      "border-red-400/20 bg-red-400/[0.08] text-red-300",
    icon: XCircle,
  },
};

export default function PayoutStatusBadge({
  status,
}: {
  status: PayoutStatus;
}) {
  const config =
    CONFIG[status];

  const Icon =
    config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${config.className}`}
    >
      <Icon
        className={`h-3.5 w-3.5 ${
          status === "PROCESSING"
            ? "animate-spin"
            : ""
        }`}
      />

      {config.label}
    </span>
  );
}
