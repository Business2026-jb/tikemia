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

type StatusConfiguration =
  Readonly<{
    label: string;
    className: string;
    icon:
      typeof Clock3;
  }>;

function getConfiguration(
  workflowStage:
    string | null | undefined,
  financialStatus:
    string | null | undefined,
): StatusConfiguration {
  const stage =
    workflowStage
      ?.trim()
      .toUpperCase() ??
    "";

  const status =
    financialStatus
      ?.trim()
      .toUpperCase() ??
    "";

  switch (stage) {
    case "ORGANIZER_REVIEW":
    case "REQUESTED":
      return {
        label:
          "En attente organisateur",
        className:
          "border-amber-400/20 bg-amber-400/[0.07] text-amber-300",
        icon:
          Clock3,
      };

    case "FORWARDED_TO_ADMIN":
    case "ADMIN_REVIEW":
      return {
        label:
          "Transmis à Tikemia",
        className:
          "border-sky-400/20 bg-sky-400/[0.07] text-sky-300",
        icon:
          Send,
      };

    case "REFUND_PROCESSING":
      return {
        label:
          "Remboursement en traitement",
        className:
          "border-violet-400/20 bg-violet-400/[0.07] text-violet-300",
        icon:
          RotateCcw,
      };

    case "REFUNDED":
      return {
        label:
          "Remboursé",
        className:
          "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300",
        icon:
          CheckCircle2,
      };

    case "ORGANIZER_REJECTED":
      return {
        label:
          "Refusé par l’organisateur",
        className:
          "border-red-400/20 bg-red-400/[0.07] text-red-300",
        icon:
          XCircle,
      };

    case "ADMIN_REJECTED":
      return {
        label:
          "Refusé par Tikemia",
        className:
          "border-red-400/20 bg-red-400/[0.07] text-red-300",
        icon:
          ShieldCheck,
      };

    case "REFUND_FAILED":
      return {
        label:
          "Échec du remboursement",
        className:
          "border-red-400/20 bg-red-400/[0.07] text-red-300",
        icon:
          AlertTriangle,
      };

    case "CANCELLED":
      return {
        label:
          "Demande clôturée",
        className:
          "border-neutral-400/20 bg-neutral-400/[0.07] text-neutral-300",
        icon:
          XCircle,
      };

    default:
      if (
        status ===
        "SUCCESS"
      ) {
        return {
          label:
            "Remboursé",
          className:
            "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300",
          icon:
            CheckCircle2,
        };
      }

      if (
        status ===
        "PROCESSING"
      ) {
        return {
          label:
            "En traitement",
          className:
            "border-violet-400/20 bg-violet-400/[0.07] text-violet-300",
          icon:
            RotateCcw,
        };
      }

      return {
        label:
          "En cours d’examen",
        className:
          "border-white/[0.10] bg-white/[0.04] text-neutral-300",
        icon:
          Clock3,
      };
  }
}

export default function RefundStatusBadge({
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
  const configuration =
    getConfiguration(
      workflowStage,
      status,
    );

  const Icon =
    configuration.icon;

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border font-black ${configuration.className} ${
        compact
          ? "px-2 py-1 text-[9px]"
          : "px-3 py-1.5 text-[10px]"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />

      <span className="truncate">
        {
          configuration.label
        }
      </span>
    </span>
  );
}
