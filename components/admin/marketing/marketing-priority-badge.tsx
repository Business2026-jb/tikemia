"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Minus,
} from "lucide-react";

import type {
  MarketingAuditPriority,
} from "@/lib/admin/marketing/create-marketing-audit-log";

const CONFIG: Record<
  MarketingAuditPriority,
  {
    label: string;
    className: string;
    icon: typeof Minus;
  }
> = {
  LOW: {
    label: "Faible",
    className:
      "border-neutral-400/20 bg-neutral-400/[0.08] text-neutral-300",
    icon: ArrowDown,
  },
  NORMAL: {
    label: "Normale",
    className:
      "border-sky-400/20 bg-sky-400/[0.08] text-sky-300",
    icon: Minus,
  },
  HIGH: {
    label: "Élevée",
    className:
      "border-amber-400/20 bg-amber-400/[0.08] text-amber-300",
    icon: ArrowUp,
  },
  URGENT: {
    label: "Urgente",
    className:
      "border-red-400/20 bg-red-400/[0.08] text-red-300",
    icon: AlertTriangle,
  },
};

export default function MarketingPriorityBadge({
  priority,
}: {
  priority: MarketingAuditPriority;
}) {
  const config = CONFIG[priority];
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
