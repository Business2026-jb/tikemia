"use client";

import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  ShoppingBag,
} from "lucide-react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  useCallback,
  useMemo,
  useTransition,
} from "react";

import OrdersTable from "@/components/organizer/orders/orders-table";
import OrderCard from "@/components/organizer/orders/order-card";
import OrdersEmptyState from "@/components/organizer/orders/orders-empty-state";
import OrdersToolbar from "@/components/organizer/orders/orders-toolbar";
import type {
  GetOrganizerOrdersResult,
} from "@/lib/organizer/get-organizer-orders";

type OrdersListClientProps = {
  data: GetOrganizerOrdersResult;
  hasEvents?: boolean;
};

const MAX_VISIBLE_PAGES = 5;

function getVisiblePages({
  currentPage,
  totalPages,
}: {
  currentPage: number;
  totalPages: number;
}): number[] {
  if (
    totalPages <=
    MAX_VISIBLE_PAGES
  ) {
    return Array.from(
      {
        length:
          totalPages,
      },
      (_, index) =>
        index + 1,
    );
  }

  const half =
    Math.floor(
      MAX_VISIBLE_PAGES / 2,
    );

  let start =
    Math.max(
      currentPage - half,
      1,
    );

  let end =
    start +
    MAX_VISIBLE_PAGES -
    1;

  if (
    end >
    totalPages
  ) {
    end =
      totalPages;

    start =
      end -
      MAX_VISIBLE_PAGES +
      1;
  }

  return Array.from(
    {
      length:
        end - start + 1,
    },
    (_, index) =>
      start + index,
  );
}

function hasActiveFilters(
  filters: GetOrganizerOrdersResult["appliedFilters"],
): boolean {
  return Boolean(
    filters.search ||
      filters.eventId ||
      filters.status ||
      filters.currency ||
      filters.paymentStatus ||
      filters.paymentMethod ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.sort !==
        "NEWEST",
  );
}

export default function OrdersListClient({
  data,
  hasEvents = true,
}: OrdersListClientProps) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const searchParams =
    useSearchParams();

  const [
    isPending,
    startTransition,
  ] = useTransition();

  const filtersAreActive =
    hasActiveFilters(
      data.appliedFilters,
    );

  const visiblePages =
    useMemo(
      () =>
        getVisiblePages({
          currentPage:
            data.pagination.page,

          totalPages:
            data.pagination.totalPages,
        }),
      [
        data.pagination.page,
        data.pagination.totalPages,
      ],
    );

  const firstVisibleItem =
    data.pagination.totalItems > 0
      ? (
          data.pagination.page -
          1
        ) *
          data.pagination.pageSize +
        1
      : 0;

  const lastVisibleItem =
    Math.min(
      data.pagination.page *
        data.pagination.pageSize,
      data.pagination.totalItems,
    );

  const navigateToPage =
    useCallback(
      (
        page: number,
      ) => {
        const safePage =
          Math.min(
            Math.max(
              page,
              1,
            ),
            data.pagination.totalPages,
          );

        const params =
          new URLSearchParams(
            searchParams.toString(),
          );

        if (
          safePage <= 1
        ) {
          params.delete(
            "page",
          );
        } else {
          params.set(
            "page",
            String(
              safePage,
            ),
          );
        }

        const query =
          params.toString();

        const destination =
          query
            ? `${pathname}?${query}`
            : pathname;

        startTransition(
          () => {
            router.push(
              destination,
              {
                scroll:
                  false,
              },
            );
          },
        );
      },
      [
        data.pagination.totalPages,
        pathname,
        router,
        searchParams,
      ],
    );

  const resetFilters =
    useCallback(
      () => {
        startTransition(
          () => {
            router.push(
              pathname,
              {
                scroll:
                  false,
              },
            );
          },
        );
      },
      [
        pathname,
        router,
      ],
    );

  return (
    <div className="space-y-5">
      <OrdersToolbar
        filters={
          data.filters
        }
        appliedFilters={
          data.appliedFilters
        }
        totalItems={
          data.pagination.totalItems
        }
      />

      {data.orders.length > 0 ? (
        <>
          <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#081015] shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
            <header className="flex flex-col gap-3 border-b border-white/[0.07] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
                  <ShoppingBag className="h-[18px] w-[18px] text-lime-400" />
                </div>

                <div className="min-w-0">
                  <h2 className="text-sm font-black text-white">
                    Liste des commandes
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-neutral-600">
                    Affichage de{" "}
                    <span className="font-bold text-neutral-400">
                      {firstVisibleItem.toLocaleString(
                        "fr-FR",
                      )}
                    </span>{" "}
                    à{" "}
                    <span className="font-bold text-neutral-400">
                      {lastVisibleItem.toLocaleString(
                        "fr-FR",
                      )}
                    </span>{" "}
                    sur{" "}
                    <span className="font-bold text-neutral-400">
                      {data.pagination.totalItems.toLocaleString(
                        "fr-FR",
                      )}
                    </span>{" "}
                    commande
                    {data.pagination.totalItems >
                    1
                      ? "s"
                      : ""}
                  </p>
                </div>
              </div>

              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-neutral-500">
                <ListFilter className="h-3.5 w-3.5" />

                Page{" "}
                {data.pagination.page.toLocaleString(
                  "fr-FR",
                )}{" "}
                sur{" "}
                {data.pagination.totalPages.toLocaleString(
                  "fr-FR",
                )}
              </div>
            </header>

            <>
  {/* Mobile, tablette et écrans classiques */}
  <div className="space-y-4 bg-[#050b0f]/45 p-3 sm:p-4 lg:p-5 2xl:hidden">
    {data.orders.map((order) => (
      <OrderCard
        key={order.id}
        order={order}
      />
    ))}
  </div>

  {/* Très grands écrans */}
  <div className="hidden 2xl:block">
    <OrdersTable orders={data.orders} />
  </div>
</>
          </section>

          <OrdersPagination
            page={
              data.pagination.page
            }
            totalPages={
              data.pagination.totalPages
            }
            totalItems={
              data.pagination.totalItems
            }
            pageSize={
              data.pagination.pageSize
            }
            hasPreviousPage={
              data.pagination.hasPreviousPage
            }
            hasNextPage={
              data.pagination.hasNextPage
            }
            visiblePages={
              visiblePages
            }
            isPending={
              isPending
            }
            onPageChange={
              navigateToPage
            }
          />
        </>
      ) : (
        <OrdersEmptyState
          hasFilters={
            filtersAreActive
          }
          hasEvents={
            hasEvents
          }
          onResetFilters={
            filtersAreActive
              ? resetFilters
              : undefined
          }
        />
      )}

      {isPending && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-5 backdrop-blur-[2px]">
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.09] bg-[#081015] px-5 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-lime-400" />

            <div>
              <p className="text-xs font-black text-white">
                Chargement des commandes
              </p>

              <p className="mt-0.5 text-[10px] text-neutral-600">
                Mise à jour sécurisée de la liste.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrdersPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  hasPreviousPage,
  hasNextPage,
  visiblePages,
  isPending,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  visiblePages: number[];
  isPending: boolean;
  onPageChange: (
    page: number,
  ) => void;
}) {
  if (
    totalItems === 0 ||
    totalPages <= 1
  ) {
    return null;
  }

  const firstItem =
    (
      page -
      1
    ) *
      pageSize +
    1;

  const lastItem =
    Math.min(
      page *
        pageSize,
      totalItems,
    );

  const showStartEllipsis =
    visiblePages.length > 0 &&
    visiblePages[0] > 1;

  const showEndEllipsis =
    visiblePages.length > 0 &&
    visiblePages[
      visiblePages.length -
        1
    ] < totalPages;

  return (
    <nav
      aria-label="Pagination des commandes"
      className="rounded-2xl border border-white/[0.08] bg-[#081015] px-4 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.16)] sm:px-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold text-neutral-400">
            {firstItem.toLocaleString(
              "fr-FR",
            )}{" "}
            –{" "}
            {lastItem.toLocaleString(
              "fr-FR",
            )}{" "}
            sur{" "}
            {totalItems.toLocaleString(
              "fr-FR",
            )}
          </p>

          <p className="mt-1 text-[10px] text-neutral-600">
            {pageSize.toLocaleString(
              "fr-FR",
            )}{" "}
            commandes maximum par page
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <PaginationButton
              label="Précédente"
              icon={ChevronLeft}
              disabled={
                !hasPreviousPage ||
                isPending
              }
              onClick={() =>
                onPageChange(
                  page - 1,
                )
              }
            />

            <PaginationButton
              label="Suivante"
              icon={ChevronRight}
              iconAfter
              disabled={
                !hasNextPage ||
                isPending
              }
              onClick={() =>
                onPageChange(
                  page + 1,
                )
              }
            />
          </div>

          <div className="flex items-center justify-center gap-1.5">
            {showStartEllipsis && (
              <>
                <PageButton
                  page={1}
                  active={
                    page === 1
                  }
                  disabled={
                    isPending
                  }
                  onClick={
                    onPageChange
                  }
                />

                <span className="px-1 text-xs text-neutral-700">
                  …
                </span>
              </>
            )}

            {visiblePages.map(
              (
                pageNumber,
              ) => (
                <PageButton
                  key={
                    pageNumber
                  }
                  page={
                    pageNumber
                  }
                  active={
                    pageNumber ===
                    page
                  }
                  disabled={
                    isPending
                  }
                  onClick={
                    onPageChange
                  }
                />
              ),
            )}

            {showEndEllipsis && (
              <>
                <span className="px-1 text-xs text-neutral-700">
                  …
                </span>

                <PageButton
                  page={
                    totalPages
                  }
                  active={
                    page ===
                    totalPages
                  }
                  disabled={
                    isPending
                  }
                  onClick={
                    onPageChange
                  }
                />
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

function PaginationButton({
  label,
  icon: Icon,
  iconAfter = false,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  iconAfter?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={
        disabled
      }
      onClick={
        onClick
      }
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 text-[11px] font-black text-neutral-300 transition hover:border-emerald-500/25 hover:bg-emerald-500/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
    >
      {!iconAfter && (
        <Icon className="h-3.5 w-3.5" />
      )}

      {label}

      {iconAfter && (
        <Icon className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function PageButton({
  page,
  active,
  disabled,
  onClick,
}: {
  page: number;
  active: boolean;
  disabled: boolean;
  onClick: (
    page: number,
  ) => void;
}) {
  return (
    <button
      type="button"
      aria-current={
        active
          ? "page"
          : undefined
      }
      aria-label={`Aller à la page ${page}`}
      disabled={
        disabled
      }
      onClick={() =>
        onClick(
          page,
        )
      }
      className={`flex h-9 min-w-9 items-center justify-center rounded-xl border px-2 text-[11px] font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? "border-emerald-500/35 bg-emerald-500/10 text-lime-400"
          : "border-white/[0.08] bg-white/[0.02] text-neutral-500 hover:border-white/[0.15] hover:text-white"
      }`}
    >
      {page.toLocaleString(
        "fr-FR",
      )}
    </button>
  );
}