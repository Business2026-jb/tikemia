"use client";

import {
  CalendarDays,
  CircleDollarSign,
  Hash,
  Loader2,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import AdminRefundActions from "@/components/admin/refunds/admin-refund-actions";
import AdminRefundCustomerCard from "@/components/admin/refunds/admin-refund-customer-card";
import AdminRefundOrganizerCard from "@/components/admin/refunds/admin-refund-organizer-card";
import AdminRefundPaymentCard from "@/components/admin/refunds/admin-refund-payment-card";
import AdminRefundStatusBadge from "@/components/admin/refunds/admin-refund-status-badge";
import AdminRefundTicketList from "@/components/admin/refunds/admin-refund-ticket-list";
import type {
  AdminRefundDetail,
} from "@/components/admin/refunds/admin-refunds-page";

type Payload =
  Readonly<{
    success?: boolean;
    data?: Readonly<{
      refund?:
        AdminRefundDetail;
    }>;
    error?: Readonly<{
      message?: string;
    }>;
    message?: string;
  }>;

async function json(
  response: Response,
): Promise<Payload | null> {
  try {
    return await response.json() as Payload;
  } catch {
    return null;
  }
}

function date(
  value:
    string | null,
): string {
  if (!value) {
    return "Non disponible";
  }

  const parsed =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      parsed.getTime(),
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
  ).format(
    parsed,
  );
}

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
      },
    ).format(
      value,
    );
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export default function AdminRefundDetails({
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
      AdminRefundDetail |
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
              `/api/admin/refunds/${encodeURIComponent(
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
            await json(
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
              "Les détails du remboursement sont indisponibles.",
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

      const handler =
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
        handler,
      );

      return () => {
        document.body.style
          .overflow =
          previous;
        document.removeEventListener(
          "keydown",
          handler,
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
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-5"
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
        className="max-h-[95dvh] w-full overflow-y-auto rounded-t-[28px] border border-white/[0.10] bg-[#071015] shadow-2xl sm:max-w-5xl sm:rounded-[28px]"
      >
        <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-white/[0.07] bg-[#071015]/95 p-5 backdrop-blur sm:p-6">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-lime-300">
              Dossier de remboursement
            </p>
            <h2 className="mt-1 truncate text-xl font-black text-white">
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-[450px] items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-lime-300" />
          </div>
        ) : errorMessage ? (
          <div className="p-6">
            <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.07] p-4 text-sm text-red-100">
              {errorMessage}
            </div>
          </div>
        ) : refund ? (
          <div className="space-y-6 p-5 sm:p-6">
            <AdminRefundStatusBadge
              workflowStage={
                refund.workflowStage
              }
              status={
                refund.status
              }
            />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Info
                icon={
                  CircleDollarSign
                }
                label="Montant demandé"
                value={money(
                  refund.amount,
                  refund.currency,
                )}
              />
              <Info
                icon={
                  CalendarDays
                }
                label="Demandé le"
                value={date(
                  refund.requestedAt,
                )}
              />
              <Info
                icon={
                  Hash
                }
                label="Référence"
                value={
                  refund.reference
                }
              />
              <Info
                icon={
                  CalendarDays
                }
                label="Paiement le"
                value={date(
                  refund.payment
                    .paidAt,
                )}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <AdminRefundCustomerCard
                refund={
                  refund
                }
              />
              <AdminRefundOrganizerCard
                refund={
                  refund
                }
              />
              <AdminRefundPaymentCard
                refund={
                  refund
                }
              />
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

            {(refund.organizerDecision
              .note ||
              refund.organizerDecision
                .reason) && (
              <section className="rounded-2xl border border-sky-400/15 bg-sky-400/[0.05] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-300">
                  Décision organisateur
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-300">
                  {refund.organizerDecision
                    .reason ??
                    refund.organizerDecision
                      .note}
                </p>
              </section>
            )}

            <AdminRefundTicketList
              refund={
                refund
              }
            />

            {refund.failureReason && (
              <section className="rounded-2xl border border-red-400/15 bg-red-400/[0.05] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-red-300">
                  Motif d’échec / refus
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-red-100/80">
                  {
                    refund.failureReason
                  }
                </p>
              </section>
            )}

            <AdminRefundActions
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

function Info({
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