"use client";

import {
  Ticket,
} from "lucide-react";

import type {
  AdminRefundDetail,
} from "@/components/admin/refunds/admin-refunds-page";

function money(
  amount: string,
  currency: string,
): string {
  const value =
    Number(
      amount,
    );

  return Number.isFinite(
    value,
  )
    ? `${value.toFixed(2)} ${currency}`
    : `${amount} ${currency}`;
}

export default function AdminRefundTicketList({
  refund,
}: {
  refund:
    AdminRefundDetail;
}) {
  return (
    <section>
      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.12em] text-neutral-600">
        Billets concernés
      </p>

      <div className="space-y-2">
        {refund.tickets.map(
          (
            ticket,
            index,
          ) => (
            <div
              key={
                ticket.id
              }
              className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-black/20 p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-400/15 bg-lime-400/[0.07] text-lime-300">
                <Ticket className="h-4 w-4" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">
                  {ticket.ticketTypeName ||
                    `Billet ${index + 1}`}
                </p>

                <p className="mt-1 truncate font-mono text-[10px] text-neutral-600">
                  {ticket.code ||
                    ticket.id}
                </p>

                <p className="mt-1 truncate text-xs text-neutral-500">
                  {ticket.holderName ||
                    refund.customer.name}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-xs font-black text-neutral-200">
                  {ticket.requestedAmount
                    ? money(
                        ticket.requestedAmount,
                        refund.currency,
                      )
                    : "—"}
                </p>

                <p className="mt-1 text-[10px] font-bold uppercase text-neutral-600">
                  {ticket.currentStatus ||
                    "INCONNU"}
                </p>
              </div>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
