"use client";

import { Gauge, Sparkles, Star } from "lucide-react";

function resolvePriority(score: number) {
  if (score >= 2000) {
    return {
      label: "Premium",
      className:
        "border-fuchsia-400/20 bg-fuchsia-400/[0.08] text-fuchsia-300",
      icon: Sparkles,
    };
  }

  if (score >= 1000) {
    return {
      label: "Prioritaire",
      className:
        "border-amber-400/20 bg-amber-400/[0.08] text-amber-300",
      icon: Star,
    };
  }

  return {
    label: "Standard",
    className:
      "border-white/[0.08] bg-white/[0.03] text-neutral-400",
    icon: Gauge,
  };
}

export default function PromotionPriorityBadge({
  score,
}: {
  score: number;
}) {
  const config = resolvePriority(score);
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${config.className}`}
      title={`Score de priorité : ${score}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label} · {score}
    </span>
  );
}
