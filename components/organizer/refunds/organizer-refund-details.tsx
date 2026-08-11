"use client";

import {
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  Hash,
  Loader2,
  Mail,
  Phone,
  ReceiptText,
  Ticket,
  UserRound,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import OrganizerRefundActions from "@/components/organizer/refunds/organizer-refund-actions";
import OrganizerRefundStatusBadge from "@/components/organizer/refunds/organizer-refund-status-badge";
import type {
  OrganizerRefundDetail,
} from "@/components/organizer/refunds/organizer-refunds-page";

type ApiPayload =
  Readonly<{
    success?: boolean;
    data?: Readonly<{
      refund?:
        OrganizerRefundDetail;
    }>;
    error?: Readonly<{
      code?: string;
      message?: string;
    }>;
    message?: string;
  }>;

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
  amount:
    string | undefined,
  currency:
    string | undefined,
): string {
  if (!amount) {
    return "Non disponible";
  }

  const numeric =
    Number(
      amount,
    );

  const normalizedCurrency =
    currency ||
    "XOF";

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return `${amount} ${normalizedCurrency}`;
  }

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style:
          "currency",
        currency:
          normalizedCurrency.toUpperCase(),
        maximumFractionDigits:
          normalizedCurrency.toUpperCase() ===
          "XOF"
            ? 0
            : 2,
      },
    ).format(
      numeric,
    );
  } catch {
    return `${numeric.toFixed(2)} ${normalizedCurrency}`;
  }
}

async function readJson(
  response: Response,
): Promise<ApiPayload | null> {
  try {
    return await response.json() as ApiPayload;
  } catch {
    return null;
  }
}

export default function OrganizerRefundDetails({
  refundId,
  open,
  onClose,
  onActionComplete,
}: {
  refundId:
    string | null;
  open: boolean;
  onClose: () => void;
  onActionComplete:
    (
      message: string,
    ) => Promise<void> |
    void;
}) {
  const [
    refund,
    setRefund,
  ] =
    useState<
      OrganizerRefundDetail |
      null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  useEffect(
    () => {
      if (
        !open ||
        !refundId
      ) {
        setRefund(
          null,
        );
        setErrorMessage(
          "",
        );
        return;
      }

      const currentRefundId =
        refundId;

      let cancelled =
        false;

      async function load() {
        setLoading(
          true,
        );
        setErrorMessage(
          "",
        );

        try {
          const response =
            await fetch(
              `/api/organizer/refunds/${encodeURIComponent(
                currentRefundId,
              )}`,
              {
                method:
                  "GET",
                headers: {
                  Accept:
                    "application/json",
                },
                credentials:
                  "include",
                cache:
                  "no-store",
              },
            );

          const payload =
            await readJson(
              response,
            );

          if (!response.ok) {
            throw new Error(
              payload?.error
                ?.message ??
              payload?.message ??
              "Impossible de charger cette demande.",
            );
          }

          if (
            !payload?.data
              ?.refund
          ) {
            throw new Error(
              "Les détails de cette demande sont indisponibles.",
            );
          }

          if (!cancelled) {
            setRefund(
              payload.data
                .refund,
            );
          }
        } catch (error) {
          if (!cancelled) {
            setErrorMessage(
              error instanceof Error
                ? error.message
                : "Impossible de charger cette demande.",
            );
          }
        } finally {
          if (!cancelled) {
            setLoading(
              false,
            );
          }
        }
      }

      void load();

      return () => {
        cancelled =
          true;
      };
    },
    [
      open,
      refundId,
    ],
  );

  useEffect(
    () => {
      if (!open) {
        return;
      }

      const previous =
        document.body.style
          .overflow;

      document.body.style
        .overflow =
        "hidden";

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

      return () => {
        document.body.style
          .overflow =
          previous;

        document.removeEventListener(
          "keydown",
          onKeyDown,
        );
      };
    },
    [
      onClose,
      open,
    ],
  );

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-5"
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
        aria-labelledby="organizer-refund-details-title"
        className="max-h-[94dvh] w-full overflow-y-auto rounded-t-[28px] border border-white/[0.10] bg-[#071015] shadow-2xl sm:max-w-3xl sm:rounded-[28px]"
      >
        <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-white/[0.07] bg-[#071015]/95 p-5 backdrop-blur sm:p-6">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-lime-300">
              Demande de remboursement
            </p>

            <h2
              id="organizer-refund-details-title"
              className="mt-1 truncate text-xl font-black text-white"
            >
              {refund?.event
                .title ??
                "Chargement…"}
            </h2>

            {refund && (
              <p className="mt-1 font-mono text-[10px] text-neutral-600">
                {
                  refund.reference
                }
              </p>
            )}
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

        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-lime-300" />
          </div>
        ) : errorMessage ? (
          <div className="p-6">
            <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.07] p-4 text-sm text-red-100">
              {
                errorMessage
              }
            </div>
          </div>
        ) : refund ? (
          <div className="space-y-6 p-5 sm:p-6">
            <OrganizerRefundStatusBadge
              workflowStage={
                refund.workflowStage
              }
              status={
                refund.status
              }
            />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <InfoCard
                icon={
                  CircleDollarSign
                }
                label="Montant"
                value={formatMoney(
                  refund.amount,
                  refund.currency,
                )}
              />

              <InfoCard
                icon={
                  Ticket
                }
                label="Billets"
                value={String(
                  refund.tickets
                    .length,
                )}
              />

              <InfoCard
                icon={
                  CalendarDays
                }
                label="Demandé le"
                value={formatDate(
                  refund.requestedAt,
                )}
              />

              <InfoCard
                icon={
                  Hash
                }
                label="Référence"
                value={
                  refund.reference
                }
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-600">
                  Client
                </p>

                <div className="mt-4 space-y-3">
                  <DetailRow
                    icon={
                      UserRound
                    }
                    label="Nom"
                    value={
                      refund.customer
                        .name
                    }
                  />

                  <DetailRow
                    icon={
                      Mail
                    }
                    label="E-mail"
                    value={
                      refund.customer
                        .email
                    }
                  />

                  <DetailRow
                    icon={
                      Phone
                    }
                    label="Téléphone"
                    value={
                      refund.customer
                        .phone ||
                      "Non renseigné"
                    }
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-600">
                  Paiement
                </p>

                <div className="mt-4 space-y-3">
                  <DetailRow
                    icon={
                      CreditCard
                    }
                    label="Prestataire"
                    value={
                      refund.payment
                        .provider
                    }
                  />

                  <DetailRow
                    icon={
                      ReceiptText
                    }
                    label="Commande"
                    value={
                      refund.order
                        .reference
                    }
                  />

                  <DetailRow
                    icon={
                      Hash
                    }
                    label="Transaction"
                    value={
                      refund.payment
                        .providerTransactionId ??
                      refund.payment
                        .providerReference ??
                      "Non disponible"
                    }
                  />
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-600">
                Motif du client
              </p>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-300">
                {refund.reason ||
                  "Aucun motif détaillé."}
              </p>
            </section>

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

                        <p className="mt-1 text-xs text-neutral-500">
                          {ticket.holderName ||
                            refund.customer.name}
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
            </section>

            {(refund.organizerDecision
              ?.note ||
              refund.organizerDecision
                ?.reason) && (
              <section className="rounded-2xl border border-sky-400/15 bg-sky-400/[0.05] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-300">
                  Votre décision
                </p>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-300">
                  {refund.organizerDecision
                    .reason ??
                    refund.organizerDecision
                      .note}
                </p>
              </section>
            )}

            {refund.failureReason && (
              <section className="rounded-2xl border border-red-400/15 bg-red-400/[0.05] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-red-300">
                  Motif d’échec / refus
                </p>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-red-100/75">
                  {
                    refund.failureReason
                  }
                </p>
              </section>
            )}

            <OrganizerRefundActions
              refund={
                refund
              }
              onComplete={
                onActionComplete
              }
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function InfoCard({
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

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon:
    typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-neutral-400">
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.1em] text-neutral-600">
          {label}
        </p>

        <p className="mt-1 break-all text-sm font-bold text-neutral-200">
          {value}
        </p>
      </div>
    </div>
  );
}