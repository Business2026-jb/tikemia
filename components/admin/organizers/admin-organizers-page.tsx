"use client";

import {
  AlertCircle,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type {
  AdminOrganizerListItem,
  GetAdminOrganizersResult,
} from "@/lib/admin/organizers/get-admin-organizers";

import DeleteOrganizerDialog from "./delete-organizer-dialog";
import OrganizerDetailsDialog from "./organizer-details-dialog";
import OrganizerEventsDialog from "./organizer-events-dialog";
import OrganizersFilters, {
  type OrganizerFiltersValue,
} from "./organizers-filters";
import OrganizersHeader from "./organizers-header";
import OrganizersTable from "./organizers-table";

const emptyData: GetAdminOrganizersResult = {
  organizers: [],
  pagination: {
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  },
  summary: {
    total: 0,
    active: 0,
    inactive: 0,
    verified: 0,
    unverified: 0,
  },
};

const defaultFilters: OrganizerFiltersValue = {
  search: "",
  status: "all",
  sort: "newest",
};

export default function AdminOrganizersPage() {
  const [data, setData] =
    useState<GetAdminOrganizersResult>(emptyData);
  const [filters, setFilters] =
    useState<OrganizerFiltersValue>(defaultFilters);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [detailsOrganizer, setDetailsOrganizer] =
    useState<AdminOrganizerListItem | null>(null);
  const [eventsOrganizer, setEventsOrganizer] =
    useState<AdminOrganizerListItem | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<AdminOrganizerListItem | null>(null);

  const loadOrganizers = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: "20",
          status: filters.status,
          sort: filters.sort,
        });

        if (filters.search.trim()) {
          params.set("search", filters.search.trim());
        }

        const response = await fetch(
          `/api/admin/organizers?${params.toString()}`,
          {
            cache: "no-store",
            signal,
          },
        );

        const payload = (await response.json()) as {
          success?: boolean;
          data?: GetAdminOrganizersResult;
          error?: string;
        };

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(
            payload.error || "Impossible de charger les organisateurs.",
          );
        }

        setData(payload.data);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }

        setError(
          caught instanceof Error
            ? caught.message
            : "Impossible de charger les organisateurs.",
        );
      } finally {
        setLoading(false);
      }
    },
    [filters, page],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => void loadOrganizers(controller.signal),
      filters.search ? 300 : 0,
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadOrganizers, refreshKey, filters.search]);

  function updateFilters(next: OrganizerFiltersValue) {
    setFilters(next);
    setPage(1);
  }

  function refresh() {
    setRefreshKey((value) => value + 1);
  }

  return (
    <div className="min-h-screen w-full bg-[#050809] text-white">
      <div className="w-full space-y-5 p-4 sm:p-5 lg:p-6 xl:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <OrganizersHeader summary={data.summary} />
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            title="Actualiser"
            className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-neutral-500 transition hover:text-white disabled:opacity-40"
          >
            {loading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </button>
        </div>

        <OrganizersFilters
          value={filters}
          loading={loading}
          onChange={updateFilters}
          onReset={() => {
            setFilters(defaultFilters);
            setPage(1);
          }}
        />

        {error ? (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-400/15 bg-red-400/[0.055] p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
              <p className="text-sm text-red-200">{error}</p>
            </div>
            <button
              type="button"
              onClick={refresh}
              className="shrink-0 text-xs font-black text-red-200"
            >
              Réessayer
            </button>
          </div>
        ) : null}

        <OrganizersTable
          data={data}
          loading={loading}
          onPageChange={setPage}
          onDetails={setDetailsOrganizer}
          onEvents={setEventsOrganizer}
          onDelete={setDeleteTarget}
        />
      </div>

      <OrganizerDetailsDialog
        organizer={detailsOrganizer}
        open={detailsOrganizer !== null}
        onClose={() => setDetailsOrganizer(null)}
      />

      <OrganizerEventsDialog
        organizer={eventsOrganizer}
        open={eventsOrganizer !== null}
        onClose={() => setEventsOrganizer(null)}
      />

      <DeleteOrganizerDialog
        organizer={deleteTarget}
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onSuccess={refresh}
      />
    </div>
  );
}
