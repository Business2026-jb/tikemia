"use client";

import type { PaymentStatus } from "@prisma/client";
import {
  Ban,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";

const CONFIG: Record<
  PaymentStatus,
  {
    label: string;
    className: string;
    icon: typeof CheckCircle2;
  }
> = {
  PENDING: {
    label: "En attente",
    className: "border-amber-400/20 bg-amber-400/[0.08] text-amber-300",
    icon: Clock3,
  },
  PROCESSING: {
    label: "Traitement",
    className: "border-sky-400/20 bg-sky-400/[0.08] text-sky-300",
    icon: LoaderCircle,
  },
  SUCCESS: {
    label: "Réussi",
    className: "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300",
    icon: CheckCircle2,
  },
  FAILED: {
    label: "Échoué",
    className: "border-red-400/20 bg-red-400/[0.08] text-red-300",
    icon: XCircle,
  },
  CANCELLED: {
    label: "Annulé",
    className: "border-neutral-400/20 bg-neutral-400/[0.08] text-neutral-300",
    icon: Ban,
  },
  EXPIRED: {
    label: "Expiré",
    className: "border-orange-400/20 bg-orange-400/[0.08] text-orange-300",
    icon: Clock3,
  },
  PARTIALLY_REFUNDED: {
    label: "Remboursé partiellement",
    className: "border-violet-400/20 bg-violet-400/[0.08] text-violet-300",
    icon: RefreshCcw,
  },
  REFUNDED: {
    label: "Remboursé",
    className: "border-purple-400/20 bg-purple-400/[0.08] text-purple-300",
    icon: RotateCcw,
  },
  DISPUTED: {
    label: "Litige",
    className: "border-rose-400/20 bg-rose-400/[0.08] text-rose-300",
    icon: ShieldAlert,
  },
};

export default function PaymentStatusBadge({
  status,
}: {
  status: PaymentStatus;
}) {
  const config = CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${config.className}`}
    >
      <Icon
        className={`h-3.5 w-3.5 ${
          status === "PROCESSING" ? "animate-spin" : ""
        }`}
      />
      {config.label}
    </span>
  );
}
