"use client";

import {
  CheckCheck,
  TicketX,
} from "lucide-react";

import RefundableTicketCard from "@/components/client/refunds/refundable-ticket-card";
import type {
  RefundableTicketData,
} from "@/components/client/refunds/client-refunds-page";

export default function RefundTicketSelector({
  tickets,
  selectedTicketIds,
  onToggleTicket,
}: {
  tickets:
    readonly RefundableTicketData[];
  selectedTicketIds:
    readonly string[];
  onToggleTicket:
    (
      ticketId: string,
    ) => void;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#071015]">
      <div className="flex flex-col gap-3 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="text-xl font-black tracking-[-0.03em] text-white">
            Choisissez les billets
          </h2>

          <p className="mt-1 text-sm text-neutral-500">
            Sélectionnez uniquement les billets que vous souhaitez faire rembourser.
          </p>
        </div>

        {selectedTicketIds.length >
          0 && (
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-lime-400/20 bg-lime-400/[0.07] px-3 py-1.5 text-xs font-black text-lime-300">
            <CheckCheck className="h-4 w-4" />

            {
              selectedTicketIds.length
            } sélectionné
            {selectedTicketIds.length >
            1
              ? "s"
              : ""}
          </span>
        )}
      </div>

      {tickets.length ===
      0 ? (
        <div className="p-8 text-center sm:p-12">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-neutral-500">
            <TicketX className="h-6 w-6" />
          </span>

          <h3 className="mt-4 text-base font-black text-white">
            Aucun billet remboursable
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">
            Aucun de vos billets ne remplit actuellement les conditions de remboursement.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">
          {tickets.map(
            (ticket) => (
              <RefundableTicketCard
                key={
                  ticket.id
                }
                ticket={
                  ticket
                }
                selected={
                  selectedTicketIds.includes(
                    ticket.id,
                  )
                }
                onToggle={() =>
                  onToggleTicket(
                    ticket.id,
                  )
                }
              />
            ),
          )}
        </div>
      )}
    </section>
  );
}
