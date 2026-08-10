"use client";

import type { EventBoostStatus } from "@prisma/client";
import {
  Ban,
  CheckCircle2,
  Clock3,
  PauseCircle,
  TimerOff,
} from "lucide-react";

const CONFIG: Record<
  EventBoostStatus,
  {
    label: string;
    className: string;
    icon: typeof CheckCircle2;
  }
> = {
  SCHEDULED: {
    label: "Programmée",
    className:
      "border-amber-400/20 bg-amber-400/[0.08] text-amber-300",
    icon: Clock3,
  },
  ACTIVE: {
    label: "Active",
    className:
      "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300",
    icon: CheckCircle2,
  },
  PAUSED: {
    label: "Suspendue",
    className:
      "border-sky-400/20 bg-sky-400/[0.08] text-sky-300",
    icon: PauseCircle,
  },
  CANCELLED: {
    label: "Annulée",
    className:
      "border-red-400/20 bg-red-400/[0.08] text-red-300",
    icon: Ban,
  },
  EXPIRED: {
    label: "Expirée",
    className:
      "border-neutral-400/20 bg-neutral-400/[0.08] text-neutral-300",
    icon: TimerOff,
  },
};

export default function PromotionStatusBadge({
  status,
}: {
  status: EventBoostStatus;
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
