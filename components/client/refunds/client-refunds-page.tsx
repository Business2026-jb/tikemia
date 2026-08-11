"use client";

import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  TicketCheck,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import RefundDetailsDialog from "@/components/client/refunds/refund-details-dialog";
import RefundRequestCard from "@/components/client/refunds/refund-request-card";
import RefundRequestForm from "@/components/client/refunds/refund-request-form";
import RefundTicketSelector from "@/components/client/refunds/refund-ticket-selector";

export type RefundableTicketData =
  Readonly<{
    id: string;
    code: string;
    holderName: string;
    holderEmail: string;
    status: string;
    issuedAt: string;
    usedAt: string | null;

    ticketType: Readonly<{
      id: string;
      name: string;
      description: string | null;
    }>;

    event: Readonly<{
      id: string;
      slug: string;
      title: string;
      coverImage: string | null;
      venueName: string;
      city: string;
      country: string;
      startsAt: string;
      endsAt: string | null;
      organizerId: string;
    }>;

    order: Readonly<{
      id: string;
      reference: string;
      currency: string;
      paidAt: string;
      paymentId: string;
      paymentStatus: string;
      provider: string;
      providerTransactionId:
        string | null;
    }>;

    amount: Readonly<{
      requestedAmount: string;
      currency: string;
    }>;

    eligibility: Readonly<{
      eligible: true;
      deadline: string;
      remainingMs: number;
    }>;
  }>;

export type ClientRefundTicketData =
  Readonly<{
    id: string;
    code: string | null;
    ticketTypeName: string | null;
    requestedAmount: string | null;
    currentStatus: string | null;
  }>;

export type ClientRefundData =
  Readonly<{
    id: string;
    reference: string;
    status: string;
    workflowStage: string;
    amount: string;
    currency: string;
    reason: string | null;
    reasonCategory: string | null;
    requestedAt: string;
    processingAt: string | null;
    refundedAt: string | null;
    failedAt: string | null;
    failureReason: string | null;

    event: Readonly<{
      id: string;
      title: string;
      slug: string;
      startsAt: string;
      endsAt: string | null;
    }>;

    order: Readonly<{
      id: string;
      reference: string;
      paidAt: string | null;
    }>;

    payment: Readonly<{
      id: string;
      provider: string;
      providerReference:
        string | null;
      providerTransactionId:
        string | null;
      paidAt: string | null;
    }>;

    tickets:
      readonly ClientRefundTicketData[];
  }>;

type ApiErrorShape =
  Readonly<{
    code?: string;
    message?: string;
  }>;

type EligibleTicketsResponse =
  Readonly<{
    success?: boolean;
    data?: Readonly<{
      tickets?:
        readonly RefundableTicketData[];
      total?: number;
    }>;
    error?: ApiErrorShape;
  }>;

type RefundsResponse =
  Readonly<{
    success?: boolean;
    data?: Readonly<{
      refunds?:
        readonly ClientRefundData[];
      total?: number;
    }>;
    error?: ApiErrorShape;
  }>;

type CreateRefundResponse =
  Readonly<{
    success?: boolean;
    message?: string;
    data?: Readonly<{
      refund?: unknown;
    }>;
    error?: ApiErrorShape;
  }>;

async function readJson<T>(
  response: Response,
): Promise<T | null> {
  try {
    return await response.json() as T;
  } catch {
    return null;
  }
}

function getApiMessage(
  payload:
    | {
        error?: ApiErrorShape;
        message?: string;
      }
    | null,
  fallback: string,
): string {
  return (
    payload?.error?.message ??
    payload?.message ??
    fallback
  );
}

export default function ClientRefundsPage() {
  const [
    tickets,
    setTickets,
  ] =
    useState<
      readonly RefundableTicketData[]
    >([]);

  const [
    refunds,
    setRefunds,
  ] =
    useState<
      readonly ClientRefundData[]
    >([]);

  const [
    selectedTicketIds,
    setSelectedTicketIds,
  ] =
    useState<
      readonly string[]
    >([]);

  const [
    selectedRefund,
    setSelectedRefund,
  ] =
    useState<ClientRefundData | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState("");

  const loadData =
    useCallback(
      async ({
        silent = false,
      }: {
        silent?: boolean;
      } = {}) => {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage("");

        try {
          const [
            ticketsResponse,
            refundsResponse,
          ] =
            await Promise.all([
              fetch(
                "/api/client/refunds/eligible-tickets",
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
              ),

              fetch(
                "/api/client/refunds",
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
              ),
            ]);

          const [
            ticketsPayload,
            refundsPayload,
          ] =
            await Promise.all([
              readJson<
                EligibleTicketsResponse
              >(
                ticketsResponse,
              ),
              readJson<
                RefundsResponse
              >(
                refundsResponse,
              ),
            ]);

          if (!ticketsResponse.ok) {
            throw new Error(
              getApiMessage(
                ticketsPayload,
                "Impossible de charger les billets remboursables.",
              ),
            );
          }

          if (!refundsResponse.ok) {
            throw new Error(
              getApiMessage(
                refundsPayload,
                "Impossible de charger vos demandes de remboursement.",
              ),
            );
          }

          const nextTickets =
            ticketsPayload?.data
              ?.tickets ??
            [];

          const nextRefunds =
            refundsPayload?.data
              ?.refunds ??
            [];

          setTickets(
            nextTickets,
          );

          setRefunds(
            nextRefunds,
          );

          setSelectedTicketIds(
            (
              current,
            ) =>
              current.filter(
                (ticketId) =>
                  nextTickets.some(
                    (ticket) =>
                      ticket.id ===
                      ticketId,
                  ),
              ),
          );
        } catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Une erreur est survenue pendant le chargement des remboursements.",
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [],
    );

  useEffect(
    () => {
      void loadData();
    },
    [loadData],
  );

  const selectedTickets =
    useMemo(
      () =>
        tickets.filter(
          (ticket) =>
            selectedTicketIds.includes(
              ticket.id,
            ),
        ),
      [
        tickets,
        selectedTicketIds,
      ],
    );

  const selectedAmount =
    useMemo(
      () =>
        selectedTickets.reduce(
          (
            total,
            ticket,
          ) => {
            const amount =
              Number(
                ticket.amount
                  .requestedAmount,
              );

            return total +
              (
                Number.isFinite(
                  amount,
                )
                  ? amount
                  : 0
              );
          },
          0,
        ),
      [
        selectedTickets,
      ],
    );

  const selectedCurrency =
    selectedTickets[0]
      ?.amount.currency ??
    tickets[0]
      ?.amount.currency ??
    "XOF";

  const toggleTicket =
    useCallback(
      (
        ticketId: string,
      ) => {
        setSuccessMessage("");

        setSelectedTicketIds(
          (
            current,
          ) =>
            current.includes(
              ticketId,
            )
              ? current.filter(
                  (id) =>
                    id !==
                    ticketId,
                )
              : [
                  ...current,
                  ticketId,
                ],
        );
      },
      [],
    );

  const submitRefund =
    useCallback(
      async ({
        reason,
        reasonCategory,
      }: {
        reason: string;
        reasonCategory:
          string | null;
      }) => {
        if (
          selectedTicketIds.length ===
          0
        ) {
          setErrorMessage(
            "Sélectionnez au moins un billet à rembourser.",
          );
          return false;
        }

        setSubmitting(true);
        setErrorMessage("");
        setSuccessMessage("");

        try {
          const response =
            await fetch(
              "/api/client/refunds",
              {
                method:
                  "POST",
                headers: {
                  Accept:
                    "application/json",
                  "Content-Type":
                    "application/json",
                },
                credentials:
                  "include",
                cache:
                  "no-store",
                body:
                  JSON.stringify({
                    ticketIds:
                      selectedTicketIds,
                    reason:
                      reason.trim(),
                    reasonCategory:
                      reasonCategory
                        ?.trim() ||
                      null,
                  }),
              },
            );

          const payload =
            await readJson<
              CreateRefundResponse
            >(
              response,
            );

          if (!response.ok) {
            throw new Error(
              getApiMessage(
                payload,
                "La demande de remboursement n’a pas pu être enregistrée.",
              ),
            );
          }

          setSelectedTicketIds(
            [],
          );

          setSuccessMessage(
            payload?.message ??
            "Votre demande a bien été transmise à l’organisateur.",
          );

          await loadData({
            silent:
              true,
          });

          return true;
        } catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Impossible d’envoyer la demande de remboursement.",
          );

          return false;
        } finally {
          setSubmitting(false);
        }
      },
      [
        loadData,
        selectedTicketIds,
      ],
    );

  if (loading) {
    return (
      <div className="flex min-h-[420px] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-lime-300">
            <Loader2 className="h-6 w-6 animate-spin" />
          </span>

          <p className="text-sm font-bold text-neutral-300">
            Chargement de vos remboursements…
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full space-y-6 pb-8">
        <section className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#071015]">
          <div className="flex flex-col gap-5 border-b border-white/[0.07] p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-lime-300">
                <RotateCcw className="h-5 w-5" />

                <span className="text-[11px] font-black uppercase tracking-[0.16em]">
                  Remboursements
                </span>
              </div>

              <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
                Demander le remboursement d’un billet
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
                Seuls les billets encore éligibles apparaissent ici. Une demande peut être déposée pendant la période autorisée après l’achat.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadData({
                  silent:
                    true,
                })
              }
              disabled={
                refreshing
              }
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm font-bold text-neutral-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCcw
                className={`h-4 w-4 ${
                  refreshing
                    ? "animate-spin"
                    : ""
                }`}
              />

              Actualiser
            </button>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
            <SummaryCard
              icon={
                TicketCheck
              }
              label="Billets éligibles"
              value={String(
                tickets.length,
              )}
            />

            <SummaryCard
              icon={
                ShieldCheck
              }
              label="Demandes envoyées"
              value={String(
                refunds.length,
              )}
            />

            <SummaryCard
              icon={
                CheckCircle2
              }
              label="Sélection actuelle"
              value={String(
                selectedTicketIds.length,
              )}
            />
          </div>
        </section>

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/[0.07] p-4 text-sm text-red-100"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />

            <p className="leading-6">
              {errorMessage}
            </p>
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-4 text-sm text-emerald-100"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />

            <p className="leading-6">
              {successMessage}
            </p>
          </div>
        )}

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <RefundTicketSelector
            tickets={
              tickets
            }
            selectedTicketIds={
              selectedTicketIds
            }
            onToggleTicket={
              toggleTicket
            }
          />

          <div className="xl:sticky xl:top-6 xl:self-start">
            <RefundRequestForm
              selectedTickets={
                selectedTickets
              }
              selectedAmount={
                selectedAmount
              }
              currency={
                selectedCurrency
              }
              submitting={
                submitting
              }
              onSubmit={
                submitRefund
              }
            />
          </div>
        </div>

        <section className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#071015]">
          <div className="border-b border-white/[0.07] p-5 sm:p-6">
            <h2 className="text-xl font-black tracking-[-0.03em] text-white">
              Mes demandes
            </h2>

            <p className="mt-1 text-sm text-neutral-500">
              Suivez ici chaque étape du traitement de vos remboursements.
            </p>
          </div>

          {refunds.length ===
          0 ? (
            <div className="p-8 text-center sm:p-12">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-neutral-500">
                <RotateCcw className="h-6 w-6" />
              </span>

              <h3 className="mt-4 text-base font-black text-white">
                Aucune demande
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">
                Vos prochaines demandes de remboursement apparaîtront ici.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">
              {refunds.map(
                (refund) => (
                  <RefundRequestCard
                    key={
                      refund.id
                    }
                    refund={
                      refund
                    }
                    onOpen={() =>
                      setSelectedRefund(
                        refund,
                      )
                    }
                  />
                ),
              )}
            </div>
          )}
        </section>
      </div>

      <RefundDetailsDialog
        refund={
          selectedRefund
        }
        open={
          Boolean(
            selectedRefund,
          )
        }
        onClose={() =>
          setSelectedRefund(
            null,
          )
        }
      />
    </>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon:
    typeof TicketCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <div className="flex items-center justify-between gap-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-lime-400/15 bg-lime-400/[0.07] text-lime-300">
          <Icon className="h-4.5 w-4.5" />
        </span>

        <span className="text-2xl font-black tracking-[-0.04em] text-white">
          {value}
        </span>
      </div>

      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </p>
    </div>
  );
}
