"use client";

import type { PaymentStatus } from "@prisma/client";
import { AlertTriangle, LoaderCircle, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AdminPaymentStatistics } from "@/lib/admin/payments/get-admin-payment-statistics";
import type {
  AdminPaymentSort,
  GetAdminPaymentsResult,
} from "@/lib/admin/payments/get-admin-payments";

import PaymentDetailsDialog from "./payment-details-dialog";
import PaymentsFilters, {
  type PaymentsFilterState,
} from "./payments-filters";
import PaymentsHeader from "./payments-header";
import PaymentsStatistics from "./payments-statistics";
import PaymentsTable from "./payments-table";

type PaymentsApiPayload = {
  success?: boolean;
  data?: GetAdminPaymentsResult;
  error?: { message?: string } | string;
};

type StatisticsApiPayload = {
  success?: boolean;
  data?: AdminPaymentStatistics;
  error?: { message?: string } | string;
};

const EMPTY_OPTIONS: GetAdminPaymentsResult["options"] = {
  providers: [],
  currencies: [],
  methods: [],
};

const EMPTY_PAGINATION: GetAdminPaymentsResult["pagination"] = {
  page: 1,
  pageSize: 20,
  totalItems: 0,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false,
};

const INITIAL_FILTERS: PaymentsFilterState = {
  search: "",
  status: "all",
  provider: "",
  currency: "",
  method: "",
  dateFrom: "",
  dateTo: "",
  sort: "recent",
};

function readErrorMessage(
  payload: { error?: { message?: string } | string },
  fallback: string,
) {
  if (typeof payload.error === "string") {
    return payload.error;
  }

  return payload.error?.message || fallback;
}

function buildQuery(
  filters: PaymentsFilterState,
  page: number,
  pageSize: number,
) {
  const params = new URLSearchParams();

  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.provider) params.set("provider", filters.provider);
  if (filters.currency) params.set("currency", filters.currency);
  if (filters.method) params.set("method", filters.method);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  params.set("sort", filters.sort);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  return params;
}

export default function AdminPaymentsPage() {
  const [data, setData] = useState<GetAdminPaymentsResult | null>(null);
  const [statistics, setStatistics] =
    useState<AdminPaymentStatistics | null>(null);
  const [filters, setFilters] =
    useState<PaymentsFilterState>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [statisticsLoading, setStatisticsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPaymentId, setSelectedPaymentId] =
    useState<string | null>(null);

  const requestId = useRef(0);

  const load = useCallback(
    async (
      nextFilters: PaymentsFilterState,
      nextPage: number,
    ) => {
      const currentRequest = ++requestId.current;
      const controller = new AbortController();

      setLoading(true);
      setStatisticsLoading(true);
      setError("");

      try {
        const params = buildQuery(nextFilters, nextPage, pageSize);
        const statisticsParams = new URLSearchParams(params);
        statisticsParams.delete("page");
        statisticsParams.delete("pageSize");

        const [paymentsResponse, statisticsResponse] = await Promise.all([
          fetch(`/api/admin/payments?${params.toString()}`, {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch(
            `/api/admin/payments/statistics?${statisticsParams.toString()}`,
            {
              cache: "no-store",
              signal: controller.signal,
            },
          ),
        ]);

        const paymentsPayload =
          (await paymentsResponse.json()) as PaymentsApiPayload;
        const statisticsPayload =
          (await statisticsResponse.json()) as StatisticsApiPayload;

        if (!paymentsResponse.ok || !paymentsPayload.success || !paymentsPayload.data) {
          throw new Error(
            readErrorMessage(
              paymentsPayload,
              "Impossible de charger les paiements.",
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

        if (currentRequest !== requestId.current) return;

        setData(paymentsPayload.data);
        setStatistics(statisticsPayload.data);
      } catch (caught) {
        if (currentRequest !== requestId.current) return;

        setError(
          caught instanceof Error
            ? caught.message
            : "Impossible de charger les paiements.",
        );
      } finally {
        if (currentRequest === requestId.current) {
          setLoading(false);
          setStatisticsLoading(false);
        }
      }

      return () => controller.abort();
    },
    [pageSize],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(filters, page);
    }, filters.search ? 350 : 0);

    return () => window.clearTimeout(timer);
  }, [filters, page, load]);

  const exportFilters = useMemo(
    () => ({
      search: filters.search,
      status: filters.status,
      provider: filters.provider,
      currency: filters.currency,
      method: filters.method,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      sort: filters.sort,
    }),
    [filters],
  );

  function handleFiltersChange(next: PaymentsFilterState) {
    setPage(1);
    setFilters(next);
  }

  function handleReset() {
    setPage(1);
    setFilters(INITIAL_FILTERS);
  }

  function handleRefresh() {
    void load(filters, page);
  }

  return (
    <main className="min-h-full w-full bg-[#030708] text-white">
      <div className="w-full space-y-4 p-4 sm:p-5 lg:p-6">
        <PaymentsHeader
          loading={loading}
          filters={exportFilters}
          onRefresh={handleRefresh}
        />

        {error ? (
          <div className="flex items-start justify-between gap-4 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-300">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError("")}
              className="text-red-300/60 hover:text-red-200"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <PaymentsStatistics
          statistics={statistics}
          loading={statisticsLoading}
        />

        <PaymentsFilters
          value={filters}
          options={data?.options ?? EMPTY_OPTIONS}
          disabled={loading && !data}
          onChange={handleFiltersChange}
          onReset={handleReset}
        />

        <div className="relative">
          {loading && data ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-1 justify-center overflow-hidden rounded-full">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-sky-400/70" />
            </div>
          ) : null}

          {!data && loading ? (
            <div className="flex min-h-80 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#071019]">
              <div className="flex items-center gap-3 text-sm font-bold text-neutral-500">
                <LoaderCircle className="h-5 w-5 animate-spin text-sky-300" />
                Chargement des paiements...
              </div>
            </div>
          ) : (
            <PaymentsTable
              payments={data?.payments ?? []}
              pagination={data?.pagination ?? EMPTY_PAGINATION}
              loading={loading}
              onOpen={setSelectedPaymentId}
              onPageChange={setPage}
            />
          )}
        </div>
      </div>

      <PaymentDetailsDialog
        paymentId={selectedPaymentId}
        open={selectedPaymentId !== null}
        onClose={() => setSelectedPaymentId(null)}
      />
    </main>
  );
}

export type {
  AdminPaymentSort,
  PaymentStatus,
};
