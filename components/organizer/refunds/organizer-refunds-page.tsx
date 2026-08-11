"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCcw,
  RotateCcw,
  Search,
  Send,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import OrganizerRefundDetails from "@/components/organizer/refunds/organizer-refund-details";
import OrganizerRefundList from "@/components/organizer/refunds/organizer-refund-list";

export type OrganizerRefundWorkflowStage =
  | "ORGANIZER_REVIEW"
  | "ORGANIZER_REJECTED"
  | "FORWARDED_TO_ADMIN"
  | "ADMIN_REVIEW"
  | "ADMIN_REJECTED"
  | "REFUND_PROCESSING"
  | "REFUNDED"
  | "REFUND_FAILED"
  | "CANCELLED"
  | "UNKNOWN";

export type OrganizerRefundListItem =
  Readonly<{
    id: string;
    reference: string;
    status: string;
    workflowStage:
      OrganizerRefundWorkflowStage;
    amount: string;
    currency: string;
    reason:
      string | null;
    reasonCategory:
      string | null;
    requestedAt: string;
    processingAt:
      string | null;
    refundedAt:
      string | null;
    failedAt:
      string | null;
    failureReason:
      string | null;

    customer: Readonly<{
      id:
        string | null;
      name: string;
      email: string;
      phone: string;
    }>;

    event: Readonly<{
      id: string;
      title: string;
      slug: string;
      startsAt: string;
      endsAt:
        string | null;
    }>;

    order: Readonly<{
      id: string;
      reference: string;
      status: string;
      paidAt:
        string | null;
    }>;

    payment: Readonly<{
      id: string;
      provider: string;
      status: string;
      providerReference:
        string | null;
      providerTransactionId:
        string | null;
      paidAt:
        string | null;
    }>;

    ticketCount: number;
  }>;

export type OrganizerRefundTicket =
  Readonly<{
    id: string;
    code:
      string | null;
    currentStatus:
      string | null;
    holderName:
      string | null;
    holderEmail:
      string | null;
    holderPhone:
      string | null;
    usedAt:
      string | null;
    scannedAt:
      string | null;
    ticketTypeId:
      string | null;
    ticketTypeName:
      string | null;
    requestedAmount:
      string | null;
  }>;

export type OrganizerRefundDetail =
  Readonly<{
    id: string;
    reference: string;
    status: string;
    workflowStage:
      OrganizerRefundWorkflowStage;
    amount: string;
    currency: string;
    reason:
      string | null;
    reasonCategory:
      string | null;
    requestedAt: string;
    processingAt:
      string | null;
    refundedAt:
      string | null;
    failedAt:
      string | null;
    failureReason:
      string | null;

    customer: Readonly<{
      id:
        string | null;
      name: string;
      email: string;
      phone: string;
    }>;

    event: Readonly<{
      id: string;
      title: string;
      slug: string;
      startsAt: string;
      endsAt:
        string | null;
      organizerId?:
        string;
    }>;

    order: Readonly<{
      id: string;
      reference: string;
      status: string;
      subtotal?:
        string;
      platformFee?:
        string;
      total?:
        string;
      currency?:
        string;
      paidAt:
        string | null;
      refundedAt?:
        string | null;
    }>;

    payment: Readonly<{
      id: string;
      provider: string;
      method?:
        string;
      status: string;
      amount?:
        string;
      currency?:
        string;
      providerReference:
        string | null;
      providerTransactionId:
        string | null;
      initiatedAt?:
        string;
      paidAt:
        string | null;
      refundedAt?:
        string | null;
    }>;

    organizerDecision?:
      Readonly<{
        action:
          string | null;
        reason:
          string | null;
        note:
          string | null;
        decidedAt:
          string | null;
        organizerId:
          string | null;
      }>;

    adminDecision?:
      Readonly<{
        action:
          string | null;
        reason:
          string | null;
        note:
          string | null;
        decidedAt:
          string | null;
        adminId:
          string | null;
      }>;

    tickets:
      readonly OrganizerRefundTicket[];

    auditTrail?:
      readonly unknown[];
  }>;

type ApiError =
  Readonly<{
    code?: string;
    message?: string;
  }>;

type RefundListResponse =
  Readonly<{
    success?: boolean;
    data?: Readonly<{
      refunds?:
        readonly OrganizerRefundListItem[];
      total?: number;
    }>;
    error?: ApiError;
    message?: string;
  }>;

function getMessage(
  payload:
    | RefundListResponse
    | null,
  fallback: string,
): string {
  return (
    payload?.error?.message ??
    payload?.message ??
    fallback
  );
}

async function readJson(
  response: Response,
): Promise<RefundListResponse | null> {
  try {
    return await response.json() as RefundListResponse;
  } catch {
    return null;
  }
}

const FILTERS =
  [
    {
      value:
        "ALL",
      label:
        "Toutes",
    },
    {
      value:
        "ORGANIZER_REVIEW",
      label:
        "À examiner",
    },
    {
      value:
        "FORWARDED_TO_ADMIN",
      label:
        "Transmises",
    },
    {
      value:
        "REFUND_PROCESSING",
      label:
        "En traitement",
    },
    {
      value:
        "REFUNDED",
      label:
        "Remboursées",
    },
    {
      value:
        "ORGANIZER_REJECTED",
      label:
        "Refusées",
    },
  ] as const;

export default function OrganizerRefundsPage() {
  const [
    refunds,
    setRefunds,
  ] =
    useState<
      readonly OrganizerRefundListItem[]
    >([]);

  const [
    workflowStage,
    setWorkflowStage,
  ] =
    useState<
      OrganizerRefundWorkflowStage |
      "ALL"
    >(
      "ORGANIZER_REVIEW",
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

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
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState("");

  const [
    selectedRefundId,
    setSelectedRefundId,
  ] =
    useState<
      string | null
    >(null);

  const loadRefunds =
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
          const params =
            new URLSearchParams();

          if (
            workflowStage !==
            "ALL"
          ) {
            params.set(
              "workflowStage",
              workflowStage,
            );
          }

          const normalizedSearch =
            search.trim();

          if (
            normalizedSearch
          ) {
            params.set(
              "search",
              normalizedSearch,
            );
          }

          params.set(
            "limit",
            "200",
          );

          const response =
            await fetch(
              `/api/organizer/refunds?${params.toString()}`,
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
              getMessage(
                payload,
                "Impossible de charger les demandes de remboursement.",
              ),
            );
          }

          setRefunds(
            payload?.data
              ?.refunds ??
            [],
          );
        } catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Une erreur est survenue pendant le chargement.",
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        search,
        workflowStage,
      ],
    );

  useEffect(
    () => {
      const timer =
        window.setTimeout(
          () => {
            void loadRefunds();
          },
          250,
        );

      return () =>
        window.clearTimeout(
          timer,
        );
    },
    [
      loadRefunds,
    ],
  );

  const summary =
    useMemo(
      () => ({
        total:
          refunds.length,
        review:
          refunds.filter(
            (refund) =>
              refund.workflowStage ===
              "ORGANIZER_REVIEW",
          ).length,
        forwarded:
          refunds.filter(
            (refund) =>
              refund.workflowStage ===
                "FORWARDED_TO_ADMIN" ||
              refund.workflowStage ===
                "ADMIN_REVIEW",
          ).length,
        completed:
          refunds.filter(
            (refund) =>
              refund.workflowStage ===
              "REFUNDED",
          ).length,
      }),
      [refunds],
    );

  const handleActionComplete =
    useCallback(
      async (
        message: string,
      ) => {
        setSuccessMessage(
          message,
        );
        setSelectedRefundId(
          null,
        );

        await loadRefunds({
          silent:
            true,
        });
      },
      [
        loadRefunds,
      ],
    );

  return (
    <>
      <div className="w-full space-y-6 pb-10">
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
                Demandes de remboursement
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
                Examinez les demandes liées à vos événements, puis transmettez les dossiers valides à Tikemia ou refusez-les avec un motif clair.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadRefunds({
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

          <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
            <SummaryCard
              icon={
                RotateCcw
              }
              label="Affichées"
              value={
                summary.total
              }
            />

            <SummaryCard
              icon={
                Clock3
              }
              label="À examiner"
              value={
                summary.review
              }
            />

            <SummaryCard
              icon={
                Send
              }
              label="Transmises"
              value={
                summary.forwarded
              }
            />

            <SummaryCard
              icon={
                CheckCircle2
              }
              label="Remboursées"
              value={
                summary.completed
              }
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

        <section className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#071015]">
          <div className="space-y-4 border-b border-white/[0.07] p-4 sm:p-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />

              <input
                type="search"
                value={
                  search
                }
                onChange={
                  (event) =>
                    setSearch(
                      event.target
                        .value,
                    )
                }
                placeholder="Rechercher par client, événement, référence…"
                className="h-12 w-full rounded-xl border border-white/[0.08] bg-black/20 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-700 focus:border-lime-400/35"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map(
                (filter) => {
                  const active =
                    workflowStage ===
                    filter.value;

                  return (
                    <button
                      key={
                        filter.value
                      }
                      type="button"
                      onClick={() =>
                        setWorkflowStage(
                          filter.value,
                        )
                      }
                      className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-black transition ${
                        active
                          ? "border-lime-400/30 bg-lime-400/[0.10] text-lime-300"
                          : "border-white/[0.08] bg-white/[0.025] text-neutral-500 hover:text-white"
                      }`}
                    >
                      {
                        filter.label
                      }
                    </button>
                  );
                },
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-lime-300" />
            </div>
          ) : (
            <OrganizerRefundList
              refunds={
                refunds
              }
              onOpenRefund={
                setSelectedRefundId
              }
            />
          )}
        </section>
      </div>

      <OrganizerRefundDetails
        refundId={
          selectedRefundId
        }
        open={
          Boolean(
            selectedRefundId,
          )
        }
        onClose={() =>
          setSelectedRefundId(
            null,
          )
        }
        onActionComplete={
          handleActionComplete
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
    typeof RotateCcw;
  label: string;
  value: number;
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
