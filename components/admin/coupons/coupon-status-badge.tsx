"use client";

import type {
  PromoCodeStatus,
} from "@prisma/client";

import {
  Archive,
  CheckCircle2,
  Clock3,
  FileClock,
  PauseCircle,
  TimerOff,
  type LucideIcon,
} from "lucide-react";

type CouponStatusConfig = {
  label: string;
  className: string;
  icon: LucideIcon;
};

const CONFIG: Record<
  PromoCodeStatus,
  CouponStatusConfig
> = {
  DRAFT: {
    label: "Brouillon",
    className:
      "border-white/[0.09] bg-white/[0.04] text-neutral-300",
    icon: FileClock,
  },

  ACTIVE: {
    label: "Actif",
    className:
      "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300",
    icon: CheckCircle2,
  },

  SCHEDULED: {
    label: "Programmé",
    className:
      "border-amber-400/20 bg-amber-400/[0.08] text-amber-300",
    icon: Clock3,
  },

  DISABLED: {
    label: "Suspendu",
    className:
      "border-sky-400/20 bg-sky-400/[0.08] text-sky-300",
    icon: PauseCircle,
  },

  EXPIRED: {
    label: "Expiré",
    className:
      "border-neutral-400/20 bg-neutral-400/[0.08] text-neutral-300",
    icon: TimerOff,
  },

  ARCHIVED: {
    label: "Archivé",
    className:
      "border-red-400/20 bg-red-400/[0.08] text-red-300",
    icon: Archive,
  },
};

type CouponStatusBadgeProps = {
  status: PromoCodeStatus;
};

export default function CouponStatusBadge({
  status,
}: CouponStatusBadgeProps) {
  const config = CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${config.className}`}
    >
      <Icon
        className="h-3.5 w-3.5"
        aria-hidden="true"
      />

      {config.label}
    </span>
  );
}