"use client";

import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  AdminPayoutStatistics,
} from "@/lib/admin/payouts/get-admin-payout-statistics";
import type {
  AdminPayoutListItem,
  GetAdminPayoutsResult,
} from "@/lib/admin/payouts/get-admin-payouts";

import ApprovePayoutDialog from "./approve-payout-dialog";
import PayoutDetailsDialog from "./payout-details-dialog";
import PayoutsFilters, {
  type PayoutsFilterState,
} from "./payouts-filters";
import PayoutsHeader from "./payouts-header";
import PayoutsStatistics from "./payouts-statistics";
import PayoutsTable from "./payouts-table";
import RejectPayoutDialog from "./reject-payout-dialog";
import RequestPayoutInformationDialog from "./request-payout-information-dialog";

type PayoutsApiPayload = {
  success?: boolean;
  data?:
    GetAdminPayoutsResult;
  error?:
    | {
        message?: string;
      }
    | string;
};

type StatisticsApiPayload = {
  success?: boolean;
  data?:
    AdminPayoutStatistics;
  error?:
    | {
        message?: string;
      }
    | string;
};

const EMPTY_OPTIONS:
  GetAdminPayoutsResult["options"] = {
    currencies: [],
    destinationTypes: [],
  };

const EMPTY_PAGINATION:
  GetAdminPayoutsResult["pagination"] = {
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  };

const INITIAL_FILTERS:
  PayoutsFilterState = {
    search: "",
    status: "all",
    destinationType: "all",
    currency: "",
    dateFrom: "",
    dateTo: "",
    sort: "recent",
  };

function readErrorMessage(
  payload: {
    error?:
      | {
          message?: string;
        }
      | string;
  },
  fallback: string,
): string {
  if (
    typeof payload.error ===
    "string"
  ) {
    return payload.error;
  }

  return (
    payload.error?.message ||
    fallback
  );
}

function buildQuery(
  filters:
    PayoutsFilterState,
  page: number,
  pageSize: number,
): URLSearchParams {
  const params =
    new URLSearchParams();

  if (
    filters.search.trim()
  ) {
    params.set(
      "search",
      filters.search.trim(),
    );
  }

  if (
    filters.status !==
    "all"
  ) {
    params.set(
      "status",
      filters.status,
    );
  }

  if (
    filters.destinationType !==
    "all"
  ) {
    params.set(
      "destinationType",
      filters.destinationType,
    );
  }

  if (
    filters.currency
  ) {
    params.set(
      "currency",
      filters.currency,
    );
  }

  if (
    filters.dateFrom
  ) {
    params.set(
      "dateFrom",
      filters.dateFrom,
    );
  }

  if (
    filters.dateTo
  ) {
    params.set(
      "dateTo",
      filters.dateTo,
    );
  }

  params.set(
    "sort",
    filters.sort,
  );

  params.set(
    "page",
    String(page),
  );

  params.set(
    "pageSize",
    String(pageSize),
  );

  return params;
}

export default function AdminPayoutsPage() {
  const [
    data,
    setData,
  ] =
    useState<GetAdminPayoutsResult | null>(
      null,
    );

  const [
    statistics,
    setStatistics,
  ] =
    useState<AdminPayoutStatistics | null>(
      null,
    );

  const [
    filters,
    setFilters,
  ] =
    useState<PayoutsFilterState>(
      INITIAL_FILTERS,
    );

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    pageSize,
  ] = useState(20);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    statisticsLoading,
    setStatisticsLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    selectedPayoutId,
    setSelectedPayoutId,
  ] = useState<string | null>(
    null,
  );

  const [
    approveTarget,
    setApproveTarget,
  ] =
    useState<AdminPayoutListItem | null>(
      null,
    );

  const [
    rejectTarget,
    setRejectTarget,
  ] =
    useState<AdminPayoutListItem | null>(
      null,
    );

  const [
    informationTarget,
    setInformationTarget,
  ] =
    useState<AdminPayoutListItem | null>(
      null,
    );

  const requestId =
    useRef(0);

  const load =
    useCallback(
      async (
        nextFilters:
          PayoutsFilterState,
        nextPage:
          number,
      ) => {
        const currentRequest =
          ++requestId.current;

        setLoading(true);
        setStatisticsLoading(true);
        setError("");

        try {
          const params =
            buildQuery(
              nextFilters,
              nextPage,
              pageSize,
            );

          const statisticsParams =
            new URLSearchParams(
              params,
            );

          statisticsParams.delete(
            "page",
          );

          statisticsParams.delete(
            "pageSize",
          );

          const [
            payoutsResponse,
            statisticsResponse,
          ] =
            await Promise.all([
              fetch(
                `/api/admin/payouts?${params.toString()}`,
                {
                  cache:
                    "no-store",
                },
              ),

              fetch(
                `/api/admin/payouts/statistics?${statisticsParams.toString()}`,
                {
                  cache:
                    "no-store",
                },
              ),
            ]);

          const payoutsPayload =
            (await payoutsResponse.json()) as PayoutsApiPayload;

          const statisticsPayload =
            (await statisticsResponse.json()) as StatisticsApiPayload;

          if (
            !payoutsResponse.ok ||
            !payoutsPayload.success ||
            !payoutsPayload.data
          ) {
            throw new Error(
              readErrorMessage(
                payoutsPayload,
                "Impossible de charger les retraits.",
              ),
            );
          }

          if (
            !statisticsResponse.ok ||
            !statisticsPayload.success ||
            !statisticsPayload.data
          ) {
            throw new Error(
              readErrorMessage(
                statisticsPayload,
                "Impossible de charger les statistiques.",
              ),
            );
          }

          if (
            currentRequest !==
            requestId.current
          ) {
            return;
          }

          setData(
            payoutsPayload.data,
          );

          setStatistics(
            statisticsPayload.data,
          );
        } catch (caught) {
          if (
            currentRequest !==
            requestId.current
          ) {
            return;
          }

          setError(
            caught instanceof Error
              ? caught.message
              : "Impossible de charger les retraits.",
          );
        } finally {
          if (
            currentRequest ===
            requestId.current
          ) {
            setLoading(false);
            setStatisticsLoading(false);
          }
        }
      },
      [
        pageSize,
      ],
    );

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          void load(
            filters,
            page,
          );
        },
        filters.search
          ? 350
          : 0,
      );

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [
    filters,
    page,
    load,
  ]);

  const exportFilters =
    useMemo(
      () => ({
        search:
          filters.search,
        status:
          filters.status,
        destinationType:
          filters.destinationType,
        currency:
          filters.currency,
        dateFrom:
          filters.dateFrom,
        dateTo:
          filters.dateTo,
        sort:
          filters.sort,
      }),
      [
        filters,
      ],
    );

  function handleFiltersChange(
    next:
      PayoutsFilterState,
  ) {
    setPage(1);
    setFilters(next);
  }

  function handleReset() {
    setPage(1);
    setFilters(
      INITIAL_FILTERS,
    );
  }

  function handleSuccess(
    message: string,
  ) {
    setSuccess(
      message,
    );

    void load(
      filters,
      page,
    );
  }

  return (
    <main className="min-h-full w-full bg-[#030708] text-white">
      <div className="w-full space-y-4 p-4 sm:p-5 lg:p-6">
        <PayoutsHeader
          loading={
            loading
          }
          filters={
            exportFilters
          }
          onRefresh={() =>
            void load(
              filters,
              page,
            )
          }
        />

        {error ? (
          <div className="flex items-start justify-between gap-4 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-300">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

              <span>
                {error}
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {success ? (
          <div className="flex items-start justify-between gap-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-300">
            <div className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />

              <span>
                {success}
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                setSuccess("")
              }
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <PayoutsStatistics
          statistics={
            statistics
          }
          loading={
            statisticsLoading
          }
        />

        <PayoutsFilters
          value={
            filters
          }
          options={
            data?.options ??
            EMPTY_OPTIONS
          }
          disabled={
            loading &&
            !data
          }
          onChange={
            handleFiltersChange
          }
          onReset={
            handleReset
          }
        />

        {!data &&
        loading ? (
          <div className="flex min-h-80 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#071019]">
            <div className="flex items-center gap-3 text-sm font-bold text-neutral-500">
              <LoaderCircle className="h-5 w-5 animate-spin text-amber-300" />

              Chargement des retraits...
            </div>
          </div>
        ) : (
          <PayoutsTable
            payouts={
              data?.payouts ??
              []
            }
            pagination={
              data?.pagination ??
              EMPTY_PAGINATION
            }
            loading={
              loading
            }
            onOpen={
              setSelectedPayoutId
            }
            onApprove={
              setApproveTarget
            }
            onReject={
              setRejectTarget
            }
            onRequestInformation={
              setInformationTarget
            }
            onPageChange={
              setPage
            }
          />
        )}
      </div>

      <PayoutDetailsDialog
        payoutId={
          selectedPayoutId
        }
        open={
          selectedPayoutId !==
          null
        }
        onClose={() =>
          setSelectedPayoutId(
            null,
          )
        }
      />

      <ApprovePayoutDialog
        payout={
          approveTarget
        }
        open={
          approveTarget !==
          null
        }
        onClose={() =>
          setApproveTarget(
            null,
          )
        }
        onSuccess={
          handleSuccess
        }
      />

      <RejectPayoutDialog
        payout={
          rejectTarget
        }
        open={
          rejectTarget !==
          null
        }
        onClose={() =>
          setRejectTarget(
            null,
          )
        }
        onSuccess={
          handleSuccess
        }
      />

      <RequestPayoutInformationDialog
        payout={
          informationTarget
        }
        open={
          informationTarget !==
          null
        }
        onClose={() =>
          setInformationTarget(
            null,
          )
        }
        onSuccess={
          handleSuccess
        }
      />
    </main>
  );
}
