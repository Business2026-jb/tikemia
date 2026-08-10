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

import type { AdminSubscriptionStatistics } from "@/lib/admin/subscriptions/get-admin-subscription-statistics";
import type {
  AdminSubscriptionListItem,
  GetAdminSubscriptionsResult,
} from "@/lib/admin/subscriptions/get-admin-subscriptions";

import ActivateSubscriptionDialog from "./activate-subscription-dialog";
import CancelSubscriptionDialog from "./cancel-subscription-dialog";
import ChangeSubscriptionPlanDialog from "./change-subscription-plan-dialog";
import ExtendSubscriptionDialog from "./extend-subscription-dialog";
import SubscriptionDetailsDialog from "./subscription-details-dialog";
import SubscriptionsFilters, {
  type SubscriptionsFilterState,
} from "./subscriptions-filters";
import SubscriptionsHeader from "./subscriptions-header";
import SubscriptionsStatistics from "./subscriptions-statistics";
import SubscriptionsTable from "./subscriptions-table";
import SuspendSubscriptionDialog from "./suspend-subscription-dialog";

type SubscriptionsApiPayload = {
  success?: boolean;
  data?: GetAdminSubscriptionsResult;
  error?: { message?: string } | string;
};

type StatisticsApiPayload = {
  success?: boolean;
  data?: AdminSubscriptionStatistics;
  error?: { message?: string } | string;
};

const EMPTY_OPTIONS: GetAdminSubscriptionsResult["options"] = {
  plans: [],
  currencies: [],
};

const EMPTY_PAGINATION: GetAdminSubscriptionsResult["pagination"] = {
  page: 1,
  pageSize: 20,
  totalItems: 0,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false,
};

const INITIAL_FILTERS: SubscriptionsFilterState = {
  search: "",
  status: "all",
  planId: "",
  billingPeriod: "all",
  currency: "",
  autoRenew: "all",
  endingBefore: "",
  sort: "recent",
};

function readErrorMessage(
  payload: {
    error?: { message?: string } | string;
  },
  fallback: string,
) {
  return typeof payload.error === "string"
    ? payload.error
    : payload.error?.message || fallback;
}

function buildQuery(
  filters: SubscriptionsFilterState,
  page: number,
  pageSize: number,
) {
  const params = new URLSearchParams();

  if (filters.search.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.planId) {
    params.set("planId", filters.planId);
  }

  if (filters.billingPeriod !== "all") {
    params.set("billingPeriod", filters.billingPeriod);
  }

  if (filters.currency) {
    params.set("currency", filters.currency);
  }

  if (filters.autoRenew !== "all") {
    params.set("autoRenew", filters.autoRenew);
  }

  if (filters.endingBefore) {
    params.set("endingBefore", filters.endingBefore);
  }

  params.set("sort", filters.sort);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  return params;
}

export default function AdminSubscriptionsPage() {
  const [data, setData] =
    useState<GetAdminSubscriptionsResult | null>(null);
  const [statistics, setStatistics] =
    useState<AdminSubscriptionStatistics | null>(null);
  const [filters, setFilters] =
    useState<SubscriptionsFilterState>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [statisticsLoading, setStatisticsLoading] =
    useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedId, setSelectedId] =
    useState<string | null>(null);
  const [activateTarget, setActivateTarget] =
    useState<AdminSubscriptionListItem | null>(null);
  const [suspendTarget, setSuspendTarget] =
    useState<AdminSubscriptionListItem | null>(null);
  const [cancelTarget, setCancelTarget] =
    useState<AdminSubscriptionListItem | null>(null);
  const [extendTarget, setExtendTarget] =
    useState<AdminSubscriptionListItem | null>(null);
  const [changeTarget, setChangeTarget] =
    useState<AdminSubscriptionListItem | null>(null);

  const requestId = useRef(0);

  const load = useCallback(
    async (
      nextFilters: SubscriptionsFilterState,
      nextPage: number,
    ) => {
      const currentRequest = ++requestId.current;

      setLoading(true);
      setStatisticsLoading(true);
      setError("");

      try {
        const params = buildQuery(
          nextFilters,
          nextPage,
          pageSize,
        );

        const statisticsParams = new URLSearchParams(params);
        statisticsParams.delete("page");
        statisticsParams.delete("pageSize");

        const [subscriptionsResponse, statisticsResponse] =
          await Promise.all([
            fetch(
              `/api/admin/subscriptions?${params.toString()}`,
              {
                cache: "no-store",
              },
            ),
            fetch(
              `/api/admin/subscriptions/statistics?${statisticsParams.toString()}`,
              {
                cache: "no-store",
              },
            ),
          ]);

        const subscriptionsPayload =
          (await subscriptionsResponse.json()) as SubscriptionsApiPayload;

        const statisticsPayload =
          (await statisticsResponse.json()) as StatisticsApiPayload;

        if (
          !subscriptionsResponse.ok ||
          !subscriptionsPayload.success ||
          !subscriptionsPayload.data
        ) {
          throw new Error(
            readErrorMessage(
              subscriptionsPayload,
              "Impossible de charger les abonnements.",
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

        setData(subscriptionsPayload.data);
        setStatistics(statisticsPayload.data);
      } catch (caught) {
        if (currentRequest !== requestId.current) return;

        setError(
          caught instanceof Error
            ? caught.message
            : "Impossible de charger les abonnements.",
        );
      } finally {
        if (currentRequest === requestId.current) {
          setLoading(false);
          setStatisticsLoading(false);
        }
      }
    },
    [pageSize],
  );

  useEffect(() => {
    const timer = window.setTimeout(
      () => void load(filters, page),
      filters.search ? 350 : 0,
    );

    return () => window.clearTimeout(timer);
  }, [filters, page, load]);

  const exportFilters = useMemo(
    () => ({
      search: filters.search,
      status: filters.status,
      planId: filters.planId,
      billingPeriod: filters.billingPeriod,
      currency: filters.currency,
      autoRenew: filters.autoRenew,
      endingBefore: filters.endingBefore,
      sort: filters.sort,
    }),
    [filters],
  );

  function handleSuccess(message: string) {
    setSuccess(message);
    void load(filters, page);
  }

  return (
    <main className="min-h-full w-full bg-[#030708] text-white">
      <div className="w-full space-y-4 p-4 sm:p-5 lg:p-6">
        <SubscriptionsHeader
          loading={loading}
          filters={exportFilters}
          onRefresh={() => void load(filters, page)}
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
              <span>{success}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccess("")}
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <SubscriptionsStatistics
          statistics={statistics}
          loading={statisticsLoading}
        />

        <SubscriptionsFilters
          value={filters}
          options={data?.options ?? EMPTY_OPTIONS}
          disabled={loading && !data}
          onChange={(next) => {
            setPage(1);
            setFilters(next);
          }}
          onReset={() => {
            setPage(1);
            setFilters(INITIAL_FILTERS);
          }}
        />

        {!data && loading ? (
          <div className="flex min-h-80 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#071019]">
            <div className="flex items-center gap-3 text-sm font-bold text-neutral-500">
              <LoaderCircle className="h-5 w-5 animate-spin text-violet-300" />
              Chargement des abonnements...
            </div>
          </div>
        ) : (
          <SubscriptionsTable
            subscriptions={data?.subscriptions ?? []}
            pagination={data?.pagination ?? EMPTY_PAGINATION}
            loading={loading}
            onOpen={setSelectedId}
            onActivate={setActivateTarget}
            onSuspend={setSuspendTarget}
            onCancel={setCancelTarget}
            onExtend={setExtendTarget}
            onChangePlan={setChangeTarget}
            onPageChange={setPage}
          />
        )}
      </div>

      <SubscriptionDetailsDialog
        subscriptionId={selectedId}
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
      />

      <ActivateSubscriptionDialog
        subscription={activateTarget}
        open={activateTarget !== null}
        onClose={() => setActivateTarget(null)}
        onSuccess={handleSuccess}
      />

      <SuspendSubscriptionDialog
        subscription={suspendTarget}
        open={suspendTarget !== null}
        onClose={() => setSuspendTarget(null)}
        onSuccess={handleSuccess}
      />

      <CancelSubscriptionDialog
        subscription={cancelTarget}
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onSuccess={handleSuccess}
      />

      <ExtendSubscriptionDialog
        subscription={extendTarget}
        open={extendTarget !== null}
        onClose={() => setExtendTarget(null)}
        onSuccess={handleSuccess}
      />

      <ChangeSubscriptionPlanDialog
        subscription={changeTarget}
        plans={data?.options.plans ?? []}
        open={changeTarget !== null}
        onClose={() => setChangeTarget(null)}
        onSuccess={handleSuccess}
      />
    </main>
  );
}
