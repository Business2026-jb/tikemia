"use client";

import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  RefreshCw,
  Users,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import CustomerDetailsDialog from "@/components/admin/customers/customer-details-dialog";
import CustomersFilters from "@/components/admin/customers/customers-filters";
import CustomersHeader from "@/components/admin/customers/customers-header";
import CustomersTable from "@/components/admin/customers/customers-table";

export type CustomerStatusFilter =
  | "all"
  | "registered"
  | "guest"
  | "active"
  | "inactive"
  | "verified"
  | "unverified";

export type CustomerSort =
  | "recent_purchase"
  | "oldest_purchase"
  | "most_orders"
  | "most_tickets"
  | "highest_spend"
  | "name_asc"
  | "name_desc";

export type AdminCustomerListItem = Readonly<{
  id: string;
  customerKey: string;
  accountType: "REGISTERED" | "GUEST";
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  country: string | null;
  countryCode: string | null;
  dialCode: string | null;
  emailVerified: boolean;
  isActive: boolean;
  registeredAt: string | null;
  firstPurchaseAt: string;
  lastPurchaseAt: string;
  ordersCount: number;
  ticketsCount: number;
  totalSpent: string;
  currency: string;
  currencies: readonly string[];
}>;

export type AdminCustomersResult = Readonly<{
  customers: readonly AdminCustomerListItem[];
  pagination: Readonly<{
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  }>;
  filters: Readonly<{
    search: string;
    status: CustomerStatusFilter;
    sort: CustomerSort;
  }>;
  summary: Readonly<{
    totalCustomers: number;
    registeredCustomers: number;
    guestCustomers: number;
    activeCustomers: number;
    totalOrders: number;
    totalTickets: number;
  }>;
}>;

type ApiResponse =
  | {
      success: true;
      data: AdminCustomersResult;
    }
  | {
      success: false;
      error?: {
        code?: string;
        message?: string;
      };
    };

const DEFAULT_PAGE_SIZE = 20;

async function readApiResponse(
  response: Response,
): Promise<ApiResponse> {
  const contentType =
    response.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(
      "Le serveur a renvoyé une réponse invalide.",
    );
  }

  return (await response.json()) as ApiResponse;
}

export default function AdminCustomersPage() {
  const [data, setData] =
    useState<AdminCustomersResult | null>(null);

  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState<CustomerStatusFilter>("all");

  const [sort, setSort] =
    useState<CustomerSort>("recent_purchase");

  const [page, setPage] =
    useState(1);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [selectedCustomer, setSelectedCustomer] =
    useState<AdminCustomerListItem | null>(null);

  const queryString =
    useMemo(() => {
      const params =
        new URLSearchParams();

      if (search.trim()) {
        params.set(
          "search",
          search.trim(),
        );
      }

      params.set(
        "status",
        status,
      );

      params.set(
        "sort",
        sort,
      );

      params.set(
        "page",
        String(page),
      );

      params.set(
        "pageSize",
        String(DEFAULT_PAGE_SIZE),
      );

      return params.toString();
    }, [
      page,
      search,
      sort,
      status,
    ]);

  const loadCustomers =
    useCallback(
      async (
        signal?: AbortSignal,
        background = false,
      ) => {
        if (background) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        try {
          const response =
            await fetch(
              `/api/admin/customers?${queryString}`,
              {
                method: "GET",
                cache: "no-store",
                signal,
                headers: {
                  Accept:
                    "application/json",
                },
              },
            );

          const payload =
            await readApiResponse(
              response,
            );

          if (
            !response.ok ||
            !payload.success
          ) {
            const message =
              !payload.success
                ? payload.error?.message
                : null;

            throw new Error(
              message ||
                "Impossible de charger les clients.",
            );
          }

          setData(
            payload.data,
          );
        } catch (caught) {
          if (
            caught instanceof DOMException &&
            caught.name === "AbortError"
          ) {
            return;
          }

          setError(
            caught instanceof Error
              ? caught.message
              : "Impossible de charger les clients.",
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [queryString],
    );

  useEffect(() => {
    const controller =
      new AbortController();

    void loadCustomers(
      controller.signal,
    );

    return () => {
      controller.abort();
    };
  }, [loadCustomers]);

  function handleSearchChange(
    value: string,
  ) {
    setSearch(value);
    setPage(1);
  }

  function handleStatusChange(
    value: CustomerStatusFilter,
  ) {
    setStatus(value);
    setPage(1);
  }

  function handleSortChange(
    value: CustomerSort,
  ) {
    setSort(value);
    setPage(1);
  }

  return (
    <div className="min-h-full w-full bg-[#030708] text-white">
      <div className="w-full px-4 py-5 sm:px-6 lg:px-8">
        <CustomersHeader
          summary={data?.summary ?? null}
          search={search}
          status={status}
          sort={sort}
        />

        <div className="mt-5">
          <CustomersFilters
            search={search}
            status={status}
            sort={sort}
            disabled={loading}
            onSearchChange={handleSearchChange}
            onStatusChange={handleStatusChange}
            onSortChange={handleSortChange}
            onRefresh={() =>
              void loadCustomers(
                undefined,
                true,
              )
            }
            refreshing={refreshing}
          />
        </div>

        {error ? (
          <div className="mt-5 flex items-start justify-between gap-4 rounded-2xl border border-red-400/15 bg-red-400/[0.055] p-4">
            <div className="flex min-w-0 gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
              <div className="min-w-0">
                <p className="text-sm font-black text-red-200">
                  Impossible de charger les clients
                </p>
                <p className="mt-1 text-xs leading-5 text-red-200/70">
                  {error}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadCustomers()
              }
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-red-300/15 bg-red-300/[0.06] px-3 text-xs font-bold text-red-100 transition hover:bg-red-300/[0.1]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Réessayer
            </button>
          </div>
        ) : null}

        <div className="mt-5">
          {loading && !data ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-white/[0.07] bg-[#071014]">
              <div className="text-center">
                <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-emerald-300" />
                <p className="mt-3 text-sm font-bold text-neutral-400">
                  Chargement des clients…
                </p>
              </div>
            </div>
          ) : data ? (
            <CustomersTable
              customers={data.customers}
              onViewCustomer={setSelectedCustomer}
            />
          ) : (
            <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-white/[0.07] bg-[#071014]">
              <div className="text-center">
                <Users className="mx-auto h-8 w-8 text-neutral-700" />
                <p className="mt-3 text-sm font-black text-neutral-400">
                  Aucune donnée disponible
                </p>
              </div>
            </div>
          )}
        </div>

        {data ? (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-neutral-500">
              Page{" "}
              <span className="font-black text-neutral-300">
                {data.pagination.page}
              </span>{" "}
              sur{" "}
              <span className="font-black text-neutral-300">
                {Math.max(
                  data.pagination.totalPages,
                  1,
                )}
              </span>{" "}
              ·{" "}
              {data.pagination.totalItems.toLocaleString(
                "fr-FR",
              )}{" "}
              client
              {data.pagination.totalItems > 1
                ? "s"
                : ""}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={
                  !data.pagination.hasPreviousPage ||
                  loading
                }
                onClick={() =>
                  setPage((current) =>
                    Math.max(
                      1,
                      current - 1,
                    ),
                  )
                }
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] px-3 text-xs font-bold text-neutral-300 transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </button>

              <button
                type="button"
                disabled={
                  !data.pagination.hasNextPage ||
                  loading
                }
                onClick={() =>
                  setPage((current) =>
                    current + 1,
                  )
                }
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] px-3 text-xs font-bold text-neutral-300 transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-35"
              >
                Suivant
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <CustomerDetailsDialog
        customer={selectedCustomer}
        open={selectedCustomer !== null}
        onClose={() =>
          setSelectedCustomer(null)
        }
      />
    </div>
  );
}
