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

import type {
  OrganizerRefundWorkflowStage,
} from "@/components/organizer/refunds/organizer-refunds-page";

function getStatus(
  stage:
    OrganizerRefundWorkflowStage |
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
      return {
        label:
          "À examiner",
        icon:
          Clock3,
        className:
          "border-amber-400/20 bg-amber-400/[0.07] text-amber-300",
      };

    case "FORWARDED_TO_ADMIN":
    case "ADMIN_REVIEW":
      return {
        label:
          "Transmise à Tikemia",
        icon:
          Send,
        className:
          "border-sky-400/20 bg-sky-400/[0.07] text-sky-300",
      };

    case "REFUND_PROCESSING":
      return {
        label:
          "Remboursement en traitement",
        icon:
          RotateCcw,
        className:
          "border-violet-400/20 bg-violet-400/[0.07] text-violet-300",
      };

    case "REFUNDED":
      return {
        label:
          "Remboursée",
        icon:
          CheckCircle2,
        className:
          "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300",
      };

    case "ORGANIZER_REJECTED":
      return {
        label:
          "Refusée par vous",
        icon:
          XCircle,
        className:
          "border-red-400/20 bg-red-400/[0.07] text-red-300",
      };

    case "ADMIN_REJECTED":
      return {
        label:
          "Refusée par Tikemia",
        icon:
          ShieldCheck,
        className:
          "border-red-400/20 bg-red-400/[0.07] text-red-300",
      };

    case "REFUND_FAILED":
      return {
        label:
          "Échec du remboursement",
        icon:
          AlertTriangle,
        className:
          "border-red-400/20 bg-red-400/[0.07] text-red-300",
      };

    case "CANCELLED":
      return {
        label:
          "Clôturée",
        icon:
          XCircle,
        className:
          "border-neutral-400/20 bg-neutral-400/[0.07] text-neutral-300",
      };

    default:
      return {
        label:
          status ===
          "SUCCESS"
            ? "Remboursée"
            : "En cours",
        icon:
          Clock3,
        className:
          "border-white/[0.10] bg-white/[0.04] text-neutral-300",
      };
  }
}

export default function OrganizerRefundStatusBadge({
  workflowStage,
  status,
  compact = false,
}: {
  workflowStage?:
    OrganizerRefundWorkflowStage |
    string |
    null;
  status?:
    string |
    null;
  compact?: boolean;
}) {
  const config =
    getStatus(
      workflowStage,
      status,
    );

  const Icon =
    config.icon;

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border font-black ${config.className} ${
        compact
          ? "px-2 py-1 text-[9px]"
          : "px-3 py-1.5 text-[10px]"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">
        {
          config.label
        }
      </span>
    </span>
  );
}
