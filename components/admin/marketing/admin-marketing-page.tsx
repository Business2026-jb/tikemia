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
  AdminMarketingCampaignListItem,
  GetAdminMarketingCampaignsResult,
} from "@/lib/admin/marketing/get-admin-marketing-campaigns";

import ApproveMarketingDialog from "./approve-marketing-dialog";
import CancelMarketingDialog from "./cancel-marketing-dialog";
import ExtendMarketingDialog from "./extend-marketing-dialog";
import MarketingDetailsDialog from "./marketing-details-dialog";
import MarketingFilters, {
  type MarketingFilterState,
} from "./marketing-filters";
import MarketingHeader from "./marketing-header";
import MarketingStatistics, {
  type MarketingStatisticsData,
} from "./marketing-statistics";
import MarketingTable from "./marketing-table";
import RejectMarketingDialog from "./reject-marketing-dialog";
import SuspendMarketingDialog from "./suspend-marketing-dialog";
import UpdateMarketingBudgetDialog from "./update-marketing-budget-dialog";
import UpdateMarketingPriorityDialog from "./update-marketing-priority-dialog";

const EMPTY_OPTIONS: GetAdminMarketingCampaignsResult["options"] = {
  organizers: [],
  events: [],
  countries: [],
};

const EMPTY_PAGINATION: GetAdminMarketingCampaignsResult["pagination"] = {
  page: 1,
  pageSize: 20,
  totalItems: 0,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false,
};

const INITIAL_FILTERS: MarketingFilterState = {
  search: "",
  status: "all",
  channel: "all",
  organizerId: "",
  eventId: "",
  country: "",
  startsFrom: "",
  startsTo: "",
  sort: "recent",
};

function buildQuery(
  filters: MarketingFilterState,
  page: number,
) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== "all") {
      params.set(key, value);
    }
  });

  params.set("page", String(page));
  params.set("pageSize", "20");

  return params;
}

function errorMessage(
  payload: {
    error?: string | { message?: string };
  },
  fallback: string,
) {
  return typeof payload.error === "string"
    ? payload.error
    : payload.error?.message || fallback;
}

export default function AdminMarketingPage() {
  const [data, setData] =
    useState<GetAdminMarketingCampaignsResult | null>(null);
  const [statistics, setStatistics] =
    useState<MarketingStatisticsData | null>(null);
  const [filters, setFilters] =
    useState<MarketingFilterState>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] =
    useState<AdminMarketingCampaignListItem | null>(null);
  const [rejectTarget, setRejectTarget] =
    useState<AdminMarketingCampaignListItem | null>(null);
  const [suspendTarget, setSuspendTarget] =
    useState<AdminMarketingCampaignListItem | null>(null);
  const [cancelTarget, setCancelTarget] =
    useState<AdminMarketingCampaignListItem | null>(null);
  const [extendTarget, setExtendTarget] =
    useState<AdminMarketingCampaignListItem | null>(null);
  const [budgetTarget, setBudgetTarget] =
    useState<AdminMarketingCampaignListItem | null>(null);
  const [priorityTarget, setPriorityTarget] =
    useState<AdminMarketingCampaignListItem | null>(null);

  const requestId = useRef(0);

  const load = useCallback(
    async (nextFilters: MarketingFilterState, nextPage: number) => {
      const id = ++requestId.current;

      setLoading(true);
      setError("");

      try {
        const params = buildQuery(nextFilters, nextPage);
        const statsParams = new URLSearchParams(params);

        statsParams.delete("page");
        statsParams.delete("pageSize");

        const [listResponse, statsResponse] = await Promise.all([
          fetch(`/api/admin/marketing?${params.toString()}`, {
            cache: "no-store",
          }),
          fetch(
            `/api/admin/marketing/statistics?${statsParams.toString()}`,
            {
              cache: "no-store",
            },
          ),
        ]);

        const listPayload = (await listResponse.json()) as {
          success?: boolean;
          data?: GetAdminMarketingCampaignsResult;
          error?: string | { message?: string };
        };

        const statsPayload = (await statsResponse.json()) as {
          success?: boolean;
          data?: MarketingStatisticsData;
          error?: string | { message?: string };
        };

        if (
          !listResponse.ok ||
          !listPayload.success ||
          !listPayload.data
        ) {
          throw new Error(
            errorMessage(
              listPayload,
              "Impossible de charger les campagnes marketing.",
            ),
          );
        }

        if (
          !statsResponse.ok ||
          !statsPayload.success ||
          !statsPayload.data
        ) {
          throw new Error(
            errorMessage(
              statsPayload,
              "Impossible de charger les statistiques.",
            ),
          );
        }

        if (id !== requestId.current) return;

        setData(listPayload.data);
        setStatistics(statsPayload.data);
      } catch (caught) {
        if (id !== requestId.current) return;

        setError(
          caught instanceof Error
            ? caught.message
            : "Impossible de charger les campagnes marketing.",
        );
      } finally {
        if (id === requestId.current) {
          setLoading(false);
        }
      }
    },
    [],
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
      channel: filters.channel,
      organizerId: filters.organizerId,
      eventId: filters.eventId,
      country: filters.country,
      startsFrom: filters.startsFrom,
      startsTo: filters.startsTo,
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
        <MarketingHeader
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
            <button type="button" onClick={() => setError("")}>
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
            <button type="button" onClick={() => setSuccess("")}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <MarketingStatistics
          statistics={statistics}
          loading={loading}
        />

        <MarketingFilters
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
              <LoaderCircle className="h-5 w-5 animate-spin text-fuchsia-300" />
              Chargement des campagnes marketing...
            </div>
          </div>
        ) : (
          <MarketingTable
            campaigns={data?.campaigns ?? []}
            pagination={data?.pagination ?? EMPTY_PAGINATION}
            loading={loading}
            onOpen={setDetailsId}
            onApprove={setApproveTarget}
            onReject={setRejectTarget}
            onSuspend={setSuspendTarget}
            onCancel={setCancelTarget}
            onExtend={setExtendTarget}
            onBudget={setBudgetTarget}
            onPriority={setPriorityTarget}
            onPageChange={setPage}
          />
        )}
      </div>

      <MarketingDetailsDialog
        campaignId={detailsId}
        open={detailsId !== null}
        onClose={() => setDetailsId(null)}
      />

      <ApproveMarketingDialog
        campaign={approveTarget}
        open={approveTarget !== null}
        onClose={() => setApproveTarget(null)}
        onSuccess={handleSuccess}
      />

      <RejectMarketingDialog
        campaign={rejectTarget}
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        onSuccess={handleSuccess}
      />

      <SuspendMarketingDialog
        campaign={suspendTarget}
        open={suspendTarget !== null}
        onClose={() => setSuspendTarget(null)}
        onSuccess={handleSuccess}
      />

      <CancelMarketingDialog
        campaign={cancelTarget}
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onSuccess={handleSuccess}
      />

      <ExtendMarketingDialog
        campaign={extendTarget}
        open={extendTarget !== null}
        onClose={() => setExtendTarget(null)}
        onSuccess={handleSuccess}
      />

      <UpdateMarketingBudgetDialog
        campaign={budgetTarget}
        open={budgetTarget !== null}
        onClose={() => setBudgetTarget(null)}
        onSuccess={handleSuccess}
      />

      <UpdateMarketingPriorityDialog
        campaign={priorityTarget}
        open={priorityTarget !== null}
        onClose={() => setPriorityTarget(null)}
        onSuccess={handleSuccess}
      />
    </main>
  );
}
