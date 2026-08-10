"use client";

import {
  BadgeCheck,
  Ban,
  CircleCheck,
  CircleDashed,
} from "lucide-react";

export default function OrganizerStatusBadge({
  isActive,
  emailVerified,
  compact = false,
}: {
  isActive: boolean;
  emailVerified: boolean;
  compact?: boolean;
}) {
  if (!isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/20 bg-red-400/10 px-2.5 py-1 text-[11px] font-bold text-red-300">
        <Ban className="h-3.5 w-3.5" />
        {compact ? "Inactif" : "Compte inactif"}
      </span>
    );
  }

  if (!emailVerified) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[11px] font-bold text-amber-300">
        <CircleDashed className="h-3.5 w-3.5" />
        Non vérifié
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
      {compact ? (
        <CircleCheck className="h-3.5 w-3.5" />
      ) : (
        <BadgeCheck className="h-3.5 w-3.5" />
      )}
      Actif
    </span>
  );
}
