"use client";

import {
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  List,
  LoaderCircle,
  RefreshCcw,
  Rows3,
  SearchX,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

import PaymentCard from "@/components/organizer/payments/payment-card";
import PaymentsTable from "@/components/organizer/payments/payments-table";
import type {
  OrganizerPaymentsData,
} from "@/lib/organizer/get-organizer-payments";

type PaymentsListClientProps = {
  payments: OrganizerPaymentsData["payments"];
  currency: OrganizerPaymentsData["currency"];
  pagination: OrganizerPaymentsData["pagination"];
  title?: string;
  description?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

type ViewMode =
  | "table"
  | "cards"
  | "compact";

const VIEW_STORAGE_KEY =
  "tikemia-organizer-payments-view";

function isViewMode(
  value: string | null,
): value is ViewMode {
  return (
    value === "table" ||
    value === "cards" ||
    value === "compact"
  );
}

function normalizePage(
  value: number,
  totalPages: number,
): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(
    Math.max(
      Math.trunc(value),
      1,
    ),
    Math.max(
      totalPages,
      1,
    ),
  );
}

function EmptyList({
  title,
  description,
  onRefresh,
  isRefreshing,
}: {
  title: string;
  description: string;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.075] bg-[#071014]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.045),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.03),transparent_28%)]" />

      <div className="relative flex min-h-[380px] w-full flex-col items-center justify-center px-5 py-14 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.025]">
          <SearchX className="h-7 w-7 text-neutral-600" />
        </div>

        <h2 className="mt-5 text-lg font-black text-white">
          {title}
        </h2>

        <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-500">
          {description}
        </p>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-xs font-bold text-neutral-300 transition hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRefreshing ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}

          Actualiser
        </button>
      </div>
    </section>
  );
}

function ViewModeButton({
  mode,
  currentMode,
  label,
  icon: Icon,
  onChange,
}: {
  mode: ViewMode;
  currentMode: ViewMode;
  label: string;
  icon: typeof List;
  onChange: (
    mode: ViewMode,
  ) => void;
}) {
  const active =
    mode === currentMode;

  return (
    <button
      type="button"
      onClick={() =>
        onChange(mode)
      }
      aria-pressed={active}
      title={label}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-[11px] font-bold transition ${
        active
          ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300"
          : "border-white/[0.08] bg-white/[0.02] text-neutral-500 hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />

      <span className="hidden sm:inline">
        {label}
      </span>
    </button>
  );
}

export default function PaymentsListClient({
  payments,
  currency,
  pagination,
  title = "Liste des paiements",
  description =
    "Consultez les transactions, les clients, les commandes et les montants financiers.",
  emptyTitle =
    "Aucun paiement disponible",
  emptyDescription =
    "Aucune transaction ne correspond aux filtres sélectionnés.",
}: PaymentsListClientProps) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const searchParams =
    useSearchParams();

  const [
    viewMode,
    setViewMode,
  ] = useState<ViewMode>(
    "table",
  );

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false);

  useEffect(() => {
  const timeoutId = window.setTimeout(() => {
    const storedView =
      window.localStorage.getItem(VIEW_STORAGE_KEY);

    if (isViewMode(storedView)) {
      setViewMode(storedView);
    }
  }, 0);

  return () => {
    window.clearTimeout(timeoutId);
  };
}, []);

  const handleViewModeChange =
    useCallback(
      (
        nextMode: ViewMode,
      ) => {
        setViewMode(
          nextMode,
        );

        window.localStorage.setItem(
          VIEW_STORAGE_KEY,
          nextMode,
        );
      },
      [],
    );

  const updatePage =
    useCallback(
      (
        page: number,
      ) => {
        const normalizedPage =
          normalizePage(
            page,
            pagination.totalPages,
          );

        const params =
          new URLSearchParams(
            searchParams.toString(),
          );

        if (
          normalizedPage <= 1
        ) {
          params.delete(
            "page",
          );
        } else {
          params.set(
            "page",
            String(
              normalizedPage,
            ),
          );
        }

        const query =
          params.toString();

        router.push(
          query
            ? `${pathname}?${query}`
            : pathname,
        );
      },
      [
        pagination.totalPages,
        pathname,
        router,
        searchParams,
      ],
    );

  const handleRefresh =
    useCallback(() => {
      setIsRefreshing(true);

      router.refresh();

      window.setTimeout(
        () => {
          setIsRefreshing(false);
        },
        700,
      );
    }, [router]);

  const startItem =
    pagination.totalItems === 0
      ? 0
      : (
          pagination.page -
          1
        ) *
          pagination.pageSize +
        1;

  const endItem =
    Math.min(
      pagination.page *
        pagination.pageSize,
      pagination.totalItems,
    );

  const canGoPrevious =
    pagination.hasPreviousPage &&
    !isRefreshing;

  const canGoNext =
    pagination.hasNextPage &&
    !isRefreshing;

  const cardsClassName =
    useMemo(
      () =>
        viewMode === "compact"
          ? "grid w-full min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          : "grid w-full min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-3",
      [viewMode],
    );

  if (
    payments.length === 0
  ) {
    return (
      <EmptyList
        title={emptyTitle}
        description={emptyDescription}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />
    );
  }

  return (
    <section className="w-full min-w-0 space-y-4">
      <div className="flex w-full min-w-0 flex-col gap-3 rounded-2xl border border-white/[0.075] bg-[#071014] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between xl:px-6">
        <div className="min-w-0">
          <h2 className="truncate text-base font-black text-white sm:text-lg">
            {title}
          </h2>

          <p className="mt-1 text-xs leading-5 text-neutral-500">
            {description}
          </p>

          <p className="mt-2 text-[10px] text-neutral-600">
            Résultats {startItem} à{" "}
            {endItem} sur{" "}
            {pagination.totalItems}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-xl border border-white/[0.07] bg-[#050c10] p-1">
            <ViewModeButton
              mode="table"
              currentMode={viewMode}
              label="Tableau"
              icon={List}
              onChange={
                handleViewModeChange
              }
            />

            <ViewModeButton
              mode="cards"
              currentMode={viewMode}
              label="Cartes"
              icon={Grid2X2}
              onChange={
                handleViewModeChange
              }
            />

            <ViewModeButton
              mode="compact"
              currentMode={viewMode}
              label="Compact"
              icon={Rows3}
              onChange={
                handleViewModeChange
              }
            />
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-[11px] font-bold text-neutral-400 transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRefreshing ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="h-3.5 w-3.5" />
            )}

            Actualiser
          </button>
        </div>
      </div>

      {viewMode === "table" ? (
        <PaymentsTable
          payments={payments}
          currency={currency}
          pagination={pagination}
          title="Transactions"
          description="Vue détaillée de toutes les opérations financières affichées."
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
        />
      ) : (
        <div className={cardsClassName}>
          {payments.map(
            (payment) => (
              <PaymentCard
                key={payment.id}
                payment={payment}
                compact={
                  viewMode ===
                  "compact"
                }
                showFinancialDetails={
                  viewMode !==
                  "compact"
                }
                showCustomerDetails={
                  viewMode !==
                  "compact"
                }
              />
            ),
          )}
        </div>
      )}

      <div className="flex w-full min-w-0 flex-col gap-3 rounded-2xl border border-white/[0.075] bg-[#071014] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 xl:px-6">
        <div className="text-[10px] text-neutral-600">
          Page{" "}
          <strong className="text-neutral-300">
            {pagination.page}
          </strong>{" "}
          sur{" "}
          <strong className="text-neutral-300">
            {pagination.totalPages}
          </strong>
          {" • "}
          {pagination.pageSize} résultats par page
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              updatePage(
                pagination.page -
                  1,
              )
            }
            disabled={
              !canGoPrevious
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-xs font-bold text-neutral-300 transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </button>

          <button
            type="button"
            onClick={() =>
              updatePage(
                pagination.page +
                  1,
              )
            }
            disabled={
              !canGoNext
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 text-xs font-bold text-emerald-300 transition hover:border-emerald-500/40 hover:bg-emerald-500/[0.13] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Suivant
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}