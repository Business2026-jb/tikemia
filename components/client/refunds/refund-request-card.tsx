"use client";

import {
  ArrowUpRight,
  CalendarDays,
  Receipt,
  Ticket,
} from "lucide-react";

import type {
  ClientRefundData,
} from "@/components/client/refunds/client-refunds-page";
import RefundStatusBadge from "@/components/client/refunds/refund-status-badge";

function formatDate(
  value: string,
): string {
  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Date indisponible";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day:
        "2-digit",
      month:
        "short",
      year:
        "numeric",
      hour:
        "2-digit",
      minute:
        "2-digit",
    },
  ).format(date);
}

function formatMoney(
  amount: string,
  currency: string,
): string {
  const numeric =
    Number(amount);

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return `${amount} ${currency}`;
  }

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style:
          "currency",
        currency:
          currency.toUpperCase(),
        maximumFractionDigits:
          currency.toUpperCase() ===
          "XOF"
            ? 0
            : 2,
      },
    ).format(
      numeric,
    );
  } catch {
    return `${numeric.toFixed(2)} ${currency}`;
  }
}

export default function RefundRequestCard({
  refund,
  onOpen,
}: {
  refund:
    ClientRefundData;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onOpen
      }
      className="group w-full rounded-2xl border border-white/[0.07] bg-black/20 p-4 text-left transition hover:border-white/[0.14] hover:bg-white/[0.025]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">
            {
              refund.event
                .title
            }
          </p>

          <p className="mt-1 font-mono text-[10px] font-bold text-neutral-600">
            {
              refund.reference
            }
          </p>
        </div>

        <ArrowUpRight className="h-4 w-4 shrink-0 text-neutral-600 transition group-hover:text-lime-300" />
      </div>

      <div className="mt-4">
        <RefundStatusBadge
          workflowStage={
            refund.workflowStage
          }
          status={
            refund.status
          }
          compact
        />
      </div>

      <div className="mt-4 grid gap-2 text-xs text-neutral-500">
        <span className="inline-flex items-center gap-2">
          <Receipt className="h-3.5 w-3.5" />

          <span className="font-black text-neutral-200">
            {formatMoney(
              refund.amount,
              refund.currency,
            )}
          </span>
        </span>

        <span className="inline-flex items-center gap-2">
          <Ticket className="h-3.5 w-3.5" />

          {
            refund.tickets
              .length
          } billet
          {refund.tickets
            .length >
          1
            ? "s"
            : ""}
        </span>

        <span className="inline-flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5" />

          {formatDate(
            refund.requestedAt,
          )}
        </span>
      </div>
    </button>
  );
}
