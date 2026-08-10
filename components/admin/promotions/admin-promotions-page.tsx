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
  AdminPromotionListItem,
  GetAdminPromotionsResult,
} from "@/lib/admin/promotions/get-admin-promotions";

import ApprovePromotionDialog from "./approve-promotion-dialog";
import CancelPromotionDialog from "./cancel-promotion-dialog";
import ExtendPromotionDialog from "./extend-promotion-dialog";
import PromotionDetailsDialog from "./promotion-details-dialog";
import PromotionsFilters, {
  type PromotionsFilterState,
} from "./promotions-filters";
import PromotionsHeader from "./promotions-header";
import PromotionsStatistics from "./promotions-statistics";
import PromotionsTable from "./promotions-table";
import RejectPromotionDialog from "./reject-promotion-dialog";
import SuspendPromotionDialog from "./suspend-promotion-dialog";
import UpdatePromotionPriorityDialog from "./update-promotion-priority-dialog";

type Statistics = {
  totalPromotions: number;
  scheduledPromotions: number;
  activePromotions: number;
  pausedPromotions: number;
  cancelledPromotions: number;
  expiredPromotions: number;
  awaitingReviewPromotions: number;
  averagePriority: number;
  revenueByCurrency: Readonly<Record<string, string>>;
};

const EMPTY_OPTIONS:
  GetAdminPromotionsResult["options"] = {
    countries:
      [],
    organizers:
      [],
  };

const EMPTY_PAGINATION:
  GetAdminPromotionsResult["pagination"] = {
    page:
      1,
    pageSize:
      20,
    totalItems:
      0,
    totalPages:
      0,
    hasPreviousPage:
      false,
    hasNextPage:
      false,
  };

const INITIAL_FILTERS:
  PromotionsFilterState = {
    search:
      "",
    status:
      "all",
    source:
      "all",
    organizerId:
      "",
    country:
      "",
    startsFrom:
      "",
    startsTo:
      "",
    sort:
      "recent",
  };

function message(
  payload: {
    error?:
      | string
      | {
          message?:
            string;
        };
  },
  fallback:
    string,
) {
  return typeof payload.error ===
    "string"
    ? payload.error
    : payload.error?.message ||
        fallback;
}

function query(
  filters:
    PromotionsFilterState,
  page:
    number,
) {
  const params =
    new URLSearchParams();

  Object.entries(
    filters,
  ).forEach(
    ([key, value]) => {
      if (
        value &&
        value !== "all"
      ) {
        params.set(
          key,
          value,
        );
      }
    },
  );

  params.set(
    "page",
    String(page),
  );

  params.set(
    "pageSize",
    "20",
  );

  return params;
}

export default function AdminPromotionsPage() {
  const [data, setData] =
    useState<GetAdminPromotionsResult | null>(
      null,
    );

  const [statistics, setStatistics] =
    useState<Statistics | null>(
      null,
    );

  const [filters, setFilters] =
    useState<PromotionsFilterState>(
      INITIAL_FILTERS,
    );

  const [page, setPage] =
    useState(1);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [detailsId, setDetailsId] =
    useState<string | null>(
      null,
    );

  const [approveTarget, setApproveTarget] =
    useState<AdminPromotionListItem | null>(
      null,
    );

  const [rejectTarget, setRejectTarget] =
    useState<AdminPromotionListItem | null>(
      null,
    );

  const [suspendTarget, setSuspendTarget] =
    useState<AdminPromotionListItem | null>(
      null,
    );

  const [cancelTarget, setCancelTarget] =
    useState<AdminPromotionListItem | null>(
      null,
    );

  const [extendTarget, setExtendTarget] =
    useState<AdminPromotionListItem | null>(
      null,
    );

  const [priorityTarget, setPriorityTarget] =
    useState<AdminPromotionListItem | null>(
      null,
    );

  const requestId =
    useRef(0);

  const load =
    useCallback(
      async (
        nextFilters:
          PromotionsFilterState,
        nextPage:
          number,
      ) => {
        const id =
          ++requestId.current;

        setLoading(true);
        setError("");

        try {
          const params =
            query(
              nextFilters,
              nextPage,
            );

          const statsParams =
            new URLSearchParams(
              params,
            );

          statsParams.delete(
            "page",
          );
          statsParams.delete(
            "pageSize",
          );

          const [
            listResponse,
            statsResponse,
          ] =
            await Promise.all([
              fetch(
                `/api/admin/promotions?${params.toString()}`,
                {
                  cache:
                    "no-store",
                },
              ),
              fetch(
                `/api/admin/promotions/statistics?${statsParams.toString()}`,
                {
                  cache:
                    "no-store",
                },
              ),
            ]);

          const listPayload =
            (await listResponse.json()) as {
              success?:
                boolean;
              data?:
                GetAdminPromotionsResult;
              error?:
                | string
                | {
                    message?:
                      string;
                  };
            };

          const statsPayload =
            (await statsResponse.json()) as {
              success?:
                boolean;
              data?:
                Statistics;
              error?:
                | string
                | {
                    message?:
                      string;
                  };
            };

          if (
            !listResponse.ok ||
            !listPayload.success ||
            !listPayload.data
          ) {
            throw new Error(
              message(
                listPayload,
                "Impossible de charger les promotions.",
              ),
            );
          }

          if (
            !statsResponse.ok ||
            !statsPayload.success ||
            !statsPayload.data
          ) {
            throw new Error(
              message(
                statsPayload,
                "Impossible de charger les statistiques.",
              ),
            );
          }

          if (
            id !==
            requestId.current
          ) {
            return;
          }

          setData(
            listPayload.data,
          );

          setStatistics(
            statsPayload.data,
          );
        } catch (caught) {
          if (
            id !==
            requestId.current
          ) {
            return;
          }

          setError(
            caught instanceof Error
              ? caught.message
              : "Impossible de charger les promotions.",
          );
        } finally {
          if (
            id ===
            requestId.current
          ) {
            setLoading(false);
          }
        }
      },
      [],
    );

  useEffect(() => {
    const timer =
      window.setTimeout(
        () =>
          void load(
            filters,
            page,
          ),
        filters.search
          ? 350
          : 0,
      );

    return () =>
      window.clearTimeout(
        timer,
      );
  }, [filters, page, load]);

  const exportFilters =
    useMemo(
      () => ({
        search:
          filters.search,
        status:
          filters.status,
        source:
          filters.source,
        organizerId:
          filters.organizerId,
        country:
          filters.country,
        startsFrom:
          filters.startsFrom,
        startsTo:
          filters.startsTo,
        sort:
          filters.sort,
      }),
      [filters],
    );

  function handleSuccess(
    value:
      string,
  ) {
    setSuccess(
      value,
    );

    void load(
      filters,
      page,
    );
  }

  return (
    <main className="min-h-full w-full bg-[#030708] text-white">
      <div className="w-full space-y-4 p-4 sm:p-5 lg:p-6">
        <PromotionsHeader
          loading={loading}
          filters={exportFilters}
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
              <span>{error}</span>
            </div>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
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
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <PromotionsStatistics
          statistics={statistics}
          loading={loading}
        />

        <PromotionsFilters
          value={filters}
          options={
            data?.options ??
            EMPTY_OPTIONS
          }
          disabled={
            loading &&
            !data
          }
          onChange={(next) => {
            setPage(1);
            setFilters(next);
          }}
          onReset={() => {
            setPage(1);
            setFilters(
              INITIAL_FILTERS,
            );
          }}
        />

        {!data &&
        loading ? (
          <div className="flex min-h-80 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#071019]">
            <div className="flex items-center gap-3 text-sm font-bold text-neutral-500">
              <LoaderCircle className="h-5 w-5 animate-spin text-fuchsia-300" />
              Chargement des promotions...
            </div>
          </div>
        ) : (
          <PromotionsTable
            promotions={
              data?.promotions ??
              []
            }
            pagination={
              data?.pagination ??
              EMPTY_PAGINATION
            }
            loading={loading}
            onOpen={setDetailsId}
            onApprove={setApproveTarget}
            onReject={setRejectTarget}
            onSuspend={setSuspendTarget}
            onCancel={setCancelTarget}
            onExtend={setExtendTarget}
            onPriority={setPriorityTarget}
            onPageChange={setPage}
          />
        )}
      </div>

      <PromotionDetailsDialog
        promotionId={detailsId}
        open={
          detailsId !==
          null
        }
        onClose={() =>
          setDetailsId(
            null,
          )
        }
      />

      <ApprovePromotionDialog
        promotion={approveTarget}
        open={
          approveTarget !==
          null
        }
        onClose={() =>
          setApproveTarget(
            null,
          )
        }
        onSuccess={handleSuccess}
      />

      <RejectPromotionDialog
        promotion={rejectTarget}
        open={
          rejectTarget !==
          null
        }
        onClose={() =>
          setRejectTarget(
            null,
          )
        }
        onSuccess={handleSuccess}
      />

      <SuspendPromotionDialog
        promotion={suspendTarget}
        open={
          suspendTarget !==
          null
        }
        onClose={() =>
          setSuspendTarget(
            null,
          )
        }
        onSuccess={handleSuccess}
      />

      <CancelPromotionDialog
        promotion={cancelTarget}
        open={
          cancelTarget !==
          null
        }
        onClose={() =>
          setCancelTarget(
            null,
          )
        }
        onSuccess={handleSuccess}
      />

      <ExtendPromotionDialog
        promotion={extendTarget}
        open={
          extendTarget !==
          null
        }
        onClose={() =>
          setExtendTarget(
            null,
          )
        }
        onSuccess={handleSuccess}
      />

      <UpdatePromotionPriorityDialog
        promotion={priorityTarget}
        open={
          priorityTarget !==
          null
        }
        onClose={() =>
          setPriorityTarget(
            null,
          )
        }
        onSuccess={handleSuccess}
      />
    </main>
  );
}
