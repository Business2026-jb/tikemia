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
  AdminCouponListItem,
  GetAdminCouponsResult,
} from "@/lib/admin/coupons/get-admin-coupons";

import ActivateCouponDialog from "./activate-coupon-dialog";
import CancelCouponDialog from "./cancel-coupon-dialog";
import CouponDetailsDialog from "./coupon-details-dialog";
import CouponsFilters, {
  type CouponsFilterState,
} from "./coupons-filters";
import CouponsHeader from "./coupons-header";
import CouponsStatistics, {
  type CouponStatisticsData,
} from "./coupons-statistics";
import CouponsTable from "./coupons-table";
import ExtendCouponDialog from "./extend-coupon-dialog";
import SuspendCouponDialog from "./suspend-coupon-dialog";
import UpdateCouponDialog from "./update-coupon-dialog";

const EMPTY_OPTIONS:
  GetAdminCouponsResult["options"] = {
    organizers:
      [],
    events:
      [],
    countries:
      [],
  };

const EMPTY_PAGINATION:
  GetAdminCouponsResult["pagination"] = {
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
  CouponsFilterState = {
    search:
      "",
    status:
      "all",
    discountType:
      "all",
    organizerId:
      "",
    eventId:
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

function errorMessage(
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

function buildQuery(
  filters:
    CouponsFilterState,
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

export default function AdminCouponsPage() {
  const [data, setData] =
    useState<GetAdminCouponsResult | null>(
      null,
    );

  const [statistics, setStatistics] =
    useState<CouponStatisticsData | null>(
      null,
    );

  const [filters, setFilters] =
    useState<CouponsFilterState>(
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

  const [activateTarget, setActivateTarget] =
    useState<AdminCouponListItem | null>(
      null,
    );

  const [suspendTarget, setSuspendTarget] =
    useState<AdminCouponListItem | null>(
      null,
    );

  const [cancelTarget, setCancelTarget] =
    useState<AdminCouponListItem | null>(
      null,
    );

  const [extendTarget, setExtendTarget] =
    useState<AdminCouponListItem | null>(
      null,
    );

  const [updateTarget, setUpdateTarget] =
    useState<AdminCouponListItem | null>(
      null,
    );

  const requestId =
    useRef(0);

  const load =
    useCallback(
      async (
        nextFilters:
          CouponsFilterState,
        nextPage:
          number,
      ) => {
        const id =
          ++requestId.current;

        setLoading(true);
        setError("");

        try {
          const params =
            buildQuery(
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
                `/api/admin/coupons?${params.toString()}`,
                {
                  cache:
                    "no-store",
                },
              ),
              fetch(
                `/api/admin/coupons/statistics?${statsParams.toString()}`,
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
                GetAdminCouponsResult;
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
                CouponStatisticsData;
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
              errorMessage(
                listPayload,
                "Impossible de charger les codes promo.",
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
              : "Impossible de charger les codes promo.",
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
        discountType:
          filters.discountType,
        organizerId:
          filters.organizerId,
        eventId:
          filters.eventId,
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
        <CouponsHeader
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

        <CouponsStatistics
          statistics={statistics}
          loading={loading}
        />

        <CouponsFilters
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
              Chargement des codes promo...
            </div>
          </div>
        ) : (
          <CouponsTable
            coupons={
              data?.coupons ??
              []
            }
            pagination={
              data?.pagination ??
              EMPTY_PAGINATION
            }
            loading={loading}
            onOpen={setDetailsId}
            onActivate={setActivateTarget}
            onSuspend={setSuspendTarget}
            onCancel={setCancelTarget}
            onExtend={setExtendTarget}
            onUpdate={setUpdateTarget}
            onPageChange={setPage}
          />
        )}
      </div>

      <CouponDetailsDialog
        couponId={detailsId}
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

      <ActivateCouponDialog
        coupon={activateTarget}
        open={
          activateTarget !==
          null
        }
        onClose={() =>
          setActivateTarget(
            null,
          )
        }
        onSuccess={handleSuccess}
      />

      <SuspendCouponDialog
        coupon={suspendTarget}
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

      <CancelCouponDialog
        coupon={cancelTarget}
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

      <ExtendCouponDialog
        coupon={extendTarget}
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

      <UpdateCouponDialog
        coupon={updateTarget}
        open={
          updateTarget !==
          null
        }
        onClose={() =>
          setUpdateTarget(
            null,
          )
        }
        onSuccess={handleSuccess}
      />
    </main>
  );
}
