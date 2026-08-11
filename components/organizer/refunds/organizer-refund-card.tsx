"use client";

import {
  ArrowUpRight,
  CalendarDays,
  Mail,
  ReceiptText,
  Ticket,
  UserRound,
} from "lucide-react";

import OrganizerRefundStatusBadge from "@/components/organizer/refunds/organizer-refund-status-badge";
import type {
  OrganizerRefundListItem,
} from "@/components/organizer/refunds/organizer-refunds-page";

function formatDate(
  value:
    string | null,
): string {
  if (!value) {
    return "Non disponible";
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Non disponible";
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
    Number(
      amount,
    );

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

export default function OrganizerRefundCard({
  refund,
  onOpen,
}: {
  refund:
    OrganizerRefundListItem;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onOpen
      }
      className="group min-w-0 rounded-2xl border border-white/[0.07] bg-black/20 p-4 text-left transition hover:border-white/[0.14] hover:bg-white/[0.025]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-black text-white">
            {
              refund.event
                .title
            }
          </p>

          <p className="mt-1 truncate font-mono text-[10px] font-bold text-neutral-600">
            {
              refund.reference
            }
          </p>
        </div>

        <ArrowUpRight className="h-4 w-4 shrink-0 text-neutral-600 transition group-hover:text-lime-300" />
      </div>

      <div className="mt-4">
        <OrganizerRefundStatusBadge
          workflowStage={
            refund.workflowStage
          }
          status={
            refund.status
          }
          compact
        />
      </div>

      <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 p-3">
        <div className="flex items-start gap-2">
          <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-lime-300" />

          <div className="min-w-0">
            <p className="truncate text-sm font-black text-neutral-100">
              {
                refund.customer
                  .name
              }
            </p>

            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-neutral-600">
              <Mail className="h-3 w-3 shrink-0" />
              {
                refund.customer
                  .email
              }
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-neutral-500">
        <span className="inline-flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <ReceiptText className="h-3.5 w-3.5" />
            Montant
          </span>

          <span className="font-black text-white">
            {formatMoney(
              refund.amount,
              refund.currency,
            )}
          </span>
        </span>

        <span className="inline-flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <Ticket className="h-3.5 w-3.5" />
            Billets
          </span>

          <span className="font-black text-neutral-300">
            {
              refund.ticketCount
            }
          </span>
        </span>

        <span className="inline-flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDate(
            refund.requestedAt,
          )}
        </span>
      </div>

      {refund.reason && (
        <p className="mt-4 line-clamp-2 text-xs leading-5 text-neutral-500">
          {
            refund.reason
          }
        </p>
      )}
    </button>
  );
}
