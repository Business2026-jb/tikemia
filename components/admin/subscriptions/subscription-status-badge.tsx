"use client";

import type { SubscriptionStatus } from "@prisma/client";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock3,
  PauseCircle,
  XCircle,
} from "lucide-react";

const CONFIG: Record<
  SubscriptionStatus,
  {
    label: string;
    className: string;
    icon: typeof CheckCircle2;
  }
> = {
  PENDING: {
    label: "En attente",
    className:
      "border-amber-400/20 bg-amber-400/[0.08] text-amber-300",
    icon: Clock3,
  },
  ACTIVE: {
    label: "Actif",
    className:
      "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300",
    icon: CheckCircle2,
  },
  PAST_DUE: {
    label: "Paiement en retard",
    className:
      "border-orange-400/20 bg-orange-400/[0.08] text-orange-300",
    icon: AlertTriangle,
  },
  PAUSED: {
    label: "Suspendu",
    className:
      "border-sky-400/20 bg-sky-400/[0.08] text-sky-300",
    icon: PauseCircle,
  },
  CANCELLED: {
    label: "Annulé",
    className:
      "border-red-400/20 bg-red-400/[0.08] text-red-300",
    icon: XCircle,
  },
  EXPIRED: {
    label: "Expiré",
    className:
      "border-neutral-400/20 bg-neutral-400/[0.08] text-neutral-300",
    icon: Ban,
  },
};

export default function SubscriptionStatusBadge({
  status,
}: {
  status: SubscriptionStatus;
}) {
  const config = CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${config.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}
