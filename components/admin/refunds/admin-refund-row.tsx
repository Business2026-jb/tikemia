"use client";

import {
  ArrowUpRight,
  CalendarDays,
  Ticket,
} from "lucide-react";

import AdminRefundStatusBadge from "@/components/admin/refunds/admin-refund-status-badge";
import type {
  AdminRefundListItem,
} from "@/components/admin/refunds/admin-refunds-page";

function money(
  amount: string,
  currency: string,
): string {
  const value =
    Number(
      amount,
    );

  if (
    !Number.isFinite(
      value,
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
      value,
    );
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function date(
  value: string,
): string {
  const parsed =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return "—";
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
    },
  ).format(parsed);
}

export default function AdminRefundRow({
  refund,
  onOpen,
  mobile = false,
}: {
  refund:
    AdminRefundListItem;
  onOpen: () => void;
  mobile?: boolean;
}) {
  if (mobile) {
    return (
      <button
        type="button"
        onClick={
          onOpen
        }
        className="rounded-2xl border border-white/[0.07] bg-black/20 p-4 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-white">
              {
                refund.event
                  .title
              }
            </p>
            <p className="mt-1 font-mono text-[10px] text-neutral-600">
              {
                refund.reference
              }
            </p>
          </div>

          <ArrowUpRight className="h-4 w-4 shrink-0 text-neutral-600" />
        </div>

        <div className="mt-3">
          <AdminRefundStatusBadge
            workflowStage={
              refund.workflowStage
            }
            status={
              refund.status
            }
            compact
          />
        </div>

        <div className="mt-4 space-y-2 text-xs text-neutral-500">
          <p className="truncate">
            Client : <span className="font-bold text-neutral-300">{refund.customer.name}</span>
          </p>
          <p className="truncate">
            Organisateur : <span className="font-bold text-neutral-300">{refund.organizer.name}</span>
          </p>
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5">
              <Ticket className="h-3.5 w-3.5" />
              {refund.ticketCount} billet{refund.ticketCount > 1 ? "s" : ""}
            </span>
            <span className="font-black text-white">
              {money(
                refund.amount,
                refund.currency,
              )}
            </span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <tr className="border-b border-white/[0.05] transition hover:bg-white/[0.02]">
      <td className="px-5 py-4">
        <p className="max-w-[260px] truncate text-sm font-black text-white">
          {
            refund.event
              .title
          }
        </p>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-neutral-600">
          <span className="font-mono">
            {
              refund.reference
            }
          </span>
          <span>·</span>
          <CalendarDays className="h-3 w-3" />
          <span>
            {date(
              refund.requestedAt,
            )}
          </span>
        </div>
      </td>

      <td className="px-5 py-4">
        <p className="max-w-[180px] truncate text-sm font-bold text-neutral-200">
          {
            refund.customer
              .name
          }
        </p>
        <p className="max-w-[180px] truncate text-xs text-neutral-600">
          {
            refund.customer
              .email
          }
        </p>
      </td>

      <td className="px-5 py-4">
        <p className="max-w-[180px] truncate text-sm font-bold text-neutral-200">
          {
            refund.organizer
              .name
          }
        </p>
        <p className="max-w-[180px] truncate text-xs text-neutral-600">
          {
            refund.organizer
              .email
          }
        </p>
      </td>

      <td className="px-5 py-4">
        <p className="text-sm font-black text-white">
          {money(
            refund.amount,
            refund.currency,
          )}
        </p>
        <p className="mt-1 text-xs text-neutral-600">
          {refund.ticketCount} billet{refund.ticketCount > 1 ? "s" : ""}
        </p>
      </td>

      <td className="px-5 py-4">
        <AdminRefundStatusBadge
          workflowStage={
            refund.workflowStage
          }
          status={
            refund.status
          }
          compact
        />
      </td>

      <td className="px-5 py-4 text-right">
        <button
          type="button"
          onClick={
            onOpen
          }
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-xs font-black text-neutral-300 transition hover:text-white"
        >
          Voir
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}
