"use client";

import { Crown } from "lucide-react";

export default function SubscriptionPlanBadge({
  name,
  code,
}: {
  name: string;
  code?: string | null;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/15 bg-violet-400/[0.07] px-2.5 py-1 text-[11px] font-extrabold text-violet-300">
      <Crown className="h-3.5 w-3.5" />
      {name}
      {code ? (
        <span className="text-violet-300/50">
          · {code}
        </span>
      ) : null}
    </span>
  );
}
