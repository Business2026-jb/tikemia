"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RotateCcw,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";

function config(
  stage:
    string |
    null |
    undefined,
  status:
    string |
    null |
    undefined,
) {
  const normalized =
    stage
      ?.trim()
      .toUpperCase() ??
    "";

  switch (
    normalized
  ) {
    case "ORGANIZER_REVIEW":
      return ["En attente organisateur", Clock3, "border-amber-400/20 bg-amber-400/[0.07] text-amber-300"] as const;
    case "FORWARDED_TO_ADMIN":
    case "ADMIN_REVIEW":
      return ["À valider par Tikemia", ShieldCheck, "border-sky-400/20 bg-sky-400/[0.07] text-sky-300"] as const;
    case "REFUND_PROCESSING":
      return ["Remboursement en traitement", RotateCcw, "border-violet-400/20 bg-violet-400/[0.07] text-violet-300"] as const;
    case "REFUNDED":
      return ["Remboursé", CheckCircle2, "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300"] as const;
    case "ORGANIZER_REJECTED":
      return ["Refusé par organisateur", XCircle, "border-red-400/20 bg-red-400/[0.07] text-red-300"] as const;
    case "ADMIN_REJECTED":
      return ["Refusé par Tikemia", XCircle, "border-red-400/20 bg-red-400/[0.07] text-red-300"] as const;
    case "REFUND_FAILED":
      return ["Échec du remboursement", AlertTriangle, "border-red-400/20 bg-red-400/[0.07] text-red-300"] as const;
    case "CANCELLED":
      return ["Clôturé", XCircle, "border-neutral-400/20 bg-neutral-400/[0.07] text-neutral-300"] as const;
    default:
      return [
        status === "SUCCESS"
          ? "Remboursé"
          : "En cours",
        status === "SUCCESS"
          ? CheckCircle2
          : Send,
        "border-white/[0.10] bg-white/[0.04] text-neutral-300",
      ] as const;
  }
}

export default function AdminRefundStatusBadge({
  workflowStage,
  status,
  compact = false,
}: {
  workflowStage?:
    string | null;
  status?:
    string | null;
  compact?: boolean;
}) {
  const [
    label,
    Icon,
    className,
  ] =
    config(
      workflowStage,
      status,
    );

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border font-black ${className} ${
        compact
          ? "px-2 py-1 text-[9px]"
          : "px-3 py-1.5 text-[10px]"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">
        {label}
      </span>
    </span>
  );
}
