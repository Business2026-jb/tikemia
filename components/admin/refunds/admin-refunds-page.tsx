"use client";

import {
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import AdminRefundDetails from "@/components/admin/refunds/admin-refund-details";
import AdminRefundFilters from "@/components/admin/refunds/admin-refund-filters";
import AdminRefundsHeader from "@/components/admin/refunds/admin-refunds-header";
import AdminRefundsTable from "@/components/admin/refunds/admin-refunds-table";

export type AdminRefundWorkflowStage =
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

export type AdminRefundListItem =
  Readonly<{
    id: string;
    reference: string;
    status: string;
    workflowStage:
      AdminRefundWorkflowStage;
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

    organizer: Readonly<{
      id: string;
      name: string;
      email: string;
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

export type AdminRefundTicket =
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

export type AdminRefundDetail =
  Readonly<{
    id: string;
    reference: string;
    status: string;
    workflowStage: string;

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

    organizer: Readonly<{
      id: string;
      name: string;
      email: string;
    }>;

    event: Readonly<{
      id: string;
      title: string;
      slug: string;
      startsAt: string;
      endsAt:
        string | null;
      organizerId: string;
    }>;

    order: Readonly<{
      id: string;
      reference: string;
      status: string;
      subtotal: string;
      platformFee: string;
      total: string;
      currency: string;
      paidAt:
        string | null;
      refundedAt:
        string | null;
    }>;

    payment: Readonly<{
      id: string;
      provider: string;
      method: string;
      status: string;
      amount: string;
      currency: string;
      providerReference:
        string | null;
      providerTransactionId:
        string | null;
      initiatedAt: string;
      paidAt:
        string | null;
      refundedAt:
        string | null;
    }>;

    organizerDecision:
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

    adminDecision:
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
      readonly AdminRefundTicket[];

    auditTrail:
      readonly unknown[];
  }>;

type ApiPayload =
  Readonly<{
    success?: boolean;
    data?: Readonly<{
      refunds?:
        readonly AdminRefundListItem[];
      total?: number;
    }>;
    error?: Readonly<{
      code?: string;
      message?: string;
    }>;
    message?: string;
  }>;

async function readJson(
  response: Response,
): Promise<ApiPayload | null> {
  try {
    return await response.json() as ApiPayload;
  } catch {
    return null;
  }
}

export default function AdminRefundsPage() {
  const [
    refunds,
    setRefunds,
  ] =
    useState<
      readonly AdminRefundListItem[]
    >([]);

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    workflowStage,
    setWorkflowStage,
  ] =
    useState<
      AdminRefundWorkflowStage |
      "ALL"
    >(
      "FORWARDED_TO_ADMIN",
    );

  const [
    status,
    setStatus,
  ] =
    useState<
      string
    >(
      "ALL",
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

          if (
            workflowStage !==
            "ALL"
          ) {
            params.set(
              "workflowStage",
              workflowStage,
            );
          }

          if (
            status !==
            "ALL"
          ) {
            params.set(
              "status",
              status,
            );
          }

          params.set(
            "limit",
            "300",
          );

          const response =
            await fetch(
              `/api/admin/refunds?${params.toString()}`,
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
              "Impossible de charger les demandes de remboursement.",
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
        status,
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

  const handleActionComplete =
    useCallback(
      async (
        message: string,
      ) => {
        setSelectedRefundId(
          null,
        );
        setSuccessMessage(
          message,
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
        <AdminRefundsHeader
          refunds={
            refunds
          }
          refreshing={
            refreshing
          }
          onRefresh={() =>
            void loadRefunds({
              silent:
                true,
            })
          }
        />

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
          <AdminRefundFilters
            search={
              search
            }
            workflowStage={
              workflowStage
            }
            status={
              status
            }
            onSearchChange={
              setSearch
            }
            onWorkflowStageChange={
              setWorkflowStage
            }
            onStatusChange={
              setStatus
            }
          />

          {loading ? (
            <div className="flex min-h-[420px] items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-lime-300" />
            </div>
          ) : (
            <AdminRefundsTable
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

      <AdminRefundDetails
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
