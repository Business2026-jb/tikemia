"use client";

import {
  Archive,
  CheckCircle2,
  Clock3,
  FilePenLine,
  PauseCircle,
  TimerOff,
  type LucideIcon,
} from "lucide-react";

import type {
  AdminMarketingCampaignListItem,
} from "@/lib/admin/marketing/get-admin-marketing-campaigns";

type MarketingStatus =
  AdminMarketingCampaignListItem["status"];

const CONFIG: Record<
  MarketingStatus,
  {
    label: string;
    className: string;
    icon: LucideIcon;
  }
> = {
  DRAFT: {
    label: "Brouillon",
    className:
      "border-neutral-400/20 bg-neutral-400/[0.08] text-neutral-300",
    icon: FilePenLine,
  },
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
  COMPLETED: {
    label: "Terminée",
    className:
      "border-violet-400/20 bg-violet-400/[0.08] text-violet-300",
    icon: TimerOff,
  },
  ARCHIVED: {
    label: "Archivée",
    className:
      "border-red-400/20 bg-red-400/[0.08] text-red-300",
    icon: Archive,
  },
};

export default function MarketingStatusBadge({
  status,
}: {
  status: MarketingStatus;
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
