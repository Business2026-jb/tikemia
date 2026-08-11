"use client";

import {
  CalendarDays,
  CircleDollarSign,
  Hash,
  ReceiptText,
  Ticket,
  X,
} from "lucide-react";
import {
  useEffect,
} from "react";

import type {
  ClientRefundData,
} from "@/components/client/refunds/client-refunds-page";
import RefundStatusBadge from "@/components/client/refunds/refund-status-badge";

function formatDate(
  value:
    string | null | undefined,
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
        "long",
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

export default function RefundDetailsDialog({
  refund,
  open,
  onClose,
}: {
  refund:
    ClientRefundData | null;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(
    () => {
      if (!open) {
        return;
      }

      const onKeyDown =
        (
          event:
            KeyboardEvent,
        ) => {
          if (
            event.key ===
            "Escape"
          ) {
            onClose();
          }
        };

      document.addEventListener(
        "keydown",
        onKeyDown,
      );

      const previousOverflow =
        document.body.style
          .overflow;

      document.body.style
        .overflow =
        "hidden";

      return () => {
        document.removeEventListener(
          "keydown",
          onKeyDown,
        );

        document.body.style
          .overflow =
          previousOverflow;
      };
    },
    [
      onClose,
      open,
    ],
  );

  if (
    !open ||
    !refund
  ) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={
        (
          event,
        ) => {
          if (
            event.target ===
            event.currentTarget
          ) {
            onClose();
          }
        }
      }
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="refund-details-title"
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] border border-white/[0.10] bg-[#071015] shadow-2xl sm:max-w-2xl sm:rounded-[28px]"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/[0.07] bg-[#071015]/95 p-5 backdrop-blur sm:p-6">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-lime-300">
              Détails du remboursement
            </p>

            <h2
              id="refund-details-title"
              className="mt-1 truncate text-xl font-black text-white"
            >
              {
                refund.event
                  .title
              }
            </h2>

            <p className="mt-1 font-mono text-[10px] text-neutral-600">
              {
                refund.reference
              }
            </p>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            aria-label="Fermer"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-400 transition hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <RefundStatusBadge
            workflowStage={
              refund.workflowStage
            }
            status={
              refund.status
            }
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <InformationCard
              icon={
                CircleDollarSign
              }
              label="Montant"
              value={formatMoney(
                refund.amount,
                refund.currency,
              )}
            />

            <InformationCard
              icon={
                CalendarDays
              }
              label="Demandé le"
              value={formatDate(
                refund.requestedAt,
              )}
            />

            <InformationCard
              icon={
                ReceiptText
              }
              label="Commande"
              value={
                refund.order
                  .reference
              }
            />

            <InformationCard
              icon={
                Hash
              }
              label="Référence"
              value={
                refund.reference
              }
            />
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-600">
              Motif de la demande
            </p>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-300">
              {refund.reason ||
                "Aucun motif détaillé."}
            </p>
          </div>

          {refund.failureReason && (
            <div className="rounded-2xl border border-red-400/15 bg-red-400/[0.06] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-red-300">
                Motif du refus / échec
              </p>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-red-100/80">
                {
                  refund.failureReason
                }
              </p>
            </div>
          )}

          <div>
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
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-lime-300">
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
                    </div>

                    {ticket.requestedAmount && (
                      <span className="shrink-0 text-xs font-black text-neutral-300">
                        {formatMoney(
                          ticket.requestedAmount,
                          refund.currency,
                        )}
                      </span>
                    )}
                  </div>
                ),
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-600">
              Suivi
            </p>

            <div className="mt-3 space-y-3 text-sm">
              <TimelineRow
                label="Demande envoyée"
                value={formatDate(
                  refund.requestedAt,
                )}
              />

              {refund.processingAt && (
                <TimelineRow
                  label="Traitement commencé"
                  value={formatDate(
                    refund.processingAt,
                  )}
                />
              )}

              {refund.refundedAt && (
                <TimelineRow
                  label="Remboursement confirmé"
                  value={formatDate(
                    refund.refundedAt,
                  )}
                />
              )}

              {refund.failedAt && (
                <TimelineRow
                  label="Échec enregistré"
                  value={formatDate(
                    refund.failedAt,
                  )}
                />
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function InformationCard({
  icon: Icon,
  label,
  value,
}: {
  icon:
    typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-lime-400/15 bg-lime-400/[0.07] text-lime-300">
        <Icon className="h-4 w-4" />
      </span>

      <p className="mt-3 text-[9px] font-black uppercase tracking-[0.12em] text-neutral-600">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-black text-white">
        {value}
      </p>
    </div>
  );
}

function TimelineRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.05] pb-3 last:border-0 last:pb-0">
      <span className="text-neutral-500">
        {label}
      </span>

      <span className="text-right font-bold text-neutral-200">
        {value}
      </span>
    </div>
  );
}
