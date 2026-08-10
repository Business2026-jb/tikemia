"use client";

import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  useCallback,
  useMemo,
  useState,
  useTransition,
} from "react";

import OrderDetailsDialog from "./order-details-dialog";
import OrdersFilters from "./orders-filters";
import OrdersHeader from "./orders-header";
import OrdersStatistics from "./orders-statistics";
import OrdersTable from "./orders-table";

import type {
  AdminOrderListItem,
  GetAdminOrdersResult,
} from "@/lib/admin/orders/get-admin-orders";

type AdminOrdersPageProps = {
  data: GetAdminOrdersResult;
};

export default function AdminOrdersPage({
  data,
}: AdminOrdersPageProps) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const searchParams =
    useSearchParams();

  const [
    isPending,
    startTransition,
  ] =
    useTransition();

  const [
    selectedOrder,
    setSelectedOrder,
  ] =
    useState<
      AdminOrderListItem | null
    >(null);

  const hasActiveFilters =
    useMemo(
      () =>
        Boolean(
          data.appliedFilters
            .search ||
            data.appliedFilters
              .status !==
              "all" ||
            data.appliedFilters
              .paymentStatus !==
              "all" ||
            data.appliedFilters
              .paymentMethod ||
            data.appliedFilters
              .currency ||
            data.appliedFilters
              .dateFrom ||
            data.appliedFilters
              .dateTo ||
            data.appliedFilters
              .sort !==
              "NEWEST",
        ),
      [
        data.appliedFilters,
      ],
    );

  const navigate =
    useCallback(
      (
        changes: Record<
          string,
          string | null
        >,
      ) => {
        const params =
          new URLSearchParams(
            searchParams.toString(),
          );

        Object.entries(
          changes,
        ).forEach(
          ([
            key,
            value,
          ]) => {
            if (
              !value ||
              value ===
                "all" ||
              (
                key ===
                  "sort" &&
                value ===
                  "NEWEST"
              )
            ) {
              params.delete(
                key,
              );
            } else {
              params.set(
                key,
                value,
              );
            }
          },
        );

        if (
          !Object.prototype.hasOwnProperty.call(
            changes,
            "page",
          )
        ) {
          params.delete(
            "page",
          );
        }

        const query =
          params.toString();

        startTransition(
          () => {
            router.push(
              query
                ? `${pathname}?${query}`
                : pathname,
            );
          },
        );
      },
      [
        pathname,
        router,
        searchParams,
      ],
    );

  function resetFilters() {
    startTransition(
      () => {
        router.push(
          pathname,
        );
      },
    );
  }

  function refreshPage() {
    startTransition(
      () => {
        router.refresh();
      },
    );
  }

  return (
    <>
      <main className="min-h-screen w-full bg-[#04090c] px-3 py-4 text-white sm:px-5 sm:py-5 lg:px-7 lg:py-6">
        <div className="w-full min-w-0">
          <OrdersHeader
            refreshing={
              isPending
            }
            onRefresh={
              refreshPage
            }
          />

          <OrdersStatistics
            statistics={
              data.statistics
            }
          />

          <OrdersFilters
            data={data}
            disabled={
              isPending
            }
            hasActiveFilters={
              hasActiveFilters
            }
            onNavigate={
              navigate
            }
            onReset={
              resetFilters
            }
          />

          <OrdersTable
            data={data}
            disabled={
              isPending
            }
            onNavigate={
              navigate
            }
            onOpenOrder={
              setSelectedOrder
            }
          />
        </div>
      </main>

      <OrderDetailsDialog
        order={
          selectedOrder
        }
        open={
          Boolean(
            selectedOrder,
          )
        }
        onClose={() =>
          setSelectedOrder(
            null,
          )
        }
      />
    </>
  );
}
