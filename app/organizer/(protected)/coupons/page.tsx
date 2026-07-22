"use client";

import {
  AlertCircle,
  BadgeCheck,
  RefreshCw,
  TicketPercent,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import CouponFormDialog, {
  type CouponCampaignOption,
  type CouponEventOption,
  type CouponFormSubmitPayload,
  type EditableCoupon,
} from "@/components/organizer/coupons/coupon-form-dialog";
import CouponsEmptyState from "@/components/organizer/coupons/coupons-empty-state";
import CouponsSummary, {
  type CouponsSummaryData,
} from "@/components/organizer/coupons/coupons-summary";
import CouponsTable, {
  type CouponTableItem,
  type CouponsTablePagination,
} from "@/components/organizer/coupons/coupons-table";
import CouponsToolbar, {
  type CouponsToolbarFilters,
} from "@/components/organizer/coupons/coupons-toolbar";

const DEFAULT_FILTERS: CouponsToolbarFilters = {
  search: "",
  status: "ALL",
  eventId: "",
  discountType: "ALL",
  dateFilter: "all",
  sort: "recent",
};

const EMPTY_SUMMARY: CouponsSummaryData = {
  totalCoupons: 0,
  activeCoupons: 0,
  draftCoupons: 0,
  scheduledCoupons: 0,
  expiredCoupons: 0,
  disabledCoupons: 0,
  archivedCoupons: 0,
  totalUsages: 0,
  totalDiscountsGranted: 0,
  totalAttributedOrders: 0,
  totalAttributedRevenue: 0,
  totalTicketsGenerated: 0,
  currency: "XOF",
};

const EMPTY_PAGINATION: CouponsTablePagination = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false,
};

type ApiFieldErrors =
  Record<
    string,
    string[] | string | undefined
  >;

type ApiErrorShape = {
  success?: boolean;
  code?: string;
  message?: string;
  fields?: ApiFieldErrors;
  redirectTo?: string;
};

type CouponsApiResponse = ApiErrorShape & {
  data?: {
    organizerId?: string;
    coupons?: CouponTableItem[];
    summary?: CouponsSummaryData;
    pagination?: CouponsTablePagination;
  };
};

type EventsApiResponse = ApiErrorShape & {
  data?: {
    events?: Array<{
      id: string;
      title: string;
      currency?: string;
      status?: string;
      startsAt?: string | null;
      endsAt?: string | null;
    }>;
  };
};

type CampaignsApiResponse = ApiErrorShape & {
  data?: {
    campaigns?: Array<{
      id: string;
      eventId: string;
      name: string;
      status?: string;
    }>;
  };
};

type FeedbackState = {
  type: "success" | "error";
  message: string;
} | null;

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

async function readJsonResponse<T>(
  response: Response,
): Promise<T> {
  const text =
    await response.text();

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      "La réponse du serveur n’est pas valide.",
    );
  }
}

function getErrorMessage(
  payload: ApiErrorShape | null | undefined,
  fallback: string,
): string {
  return (
    payload?.message?.trim() ||
    fallback
  );
}

function normalizeCoupon(
  value: unknown,
): CouponTableItem | null {
  if (!isObject(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.code !== "string" ||
    typeof value.event !== "object" ||
    value.event === null
  ) {
    return null;
  }

  return value as unknown as CouponTableItem;
}

function normalizeEditableCoupon(
  coupon: CouponTableItem,
): EditableCoupon {
  return {
    id: coupon.id,
    eventId:
      coupon.event.id,
    campaignId:
      coupon.campaign?.id ??
      null,
    code: coupon.code,
    description:
      coupon.description ??
      null,
    discountType:
      coupon.discountType,
    discountValue:
      coupon.discountValue,
    minimumOrderAmount:
      coupon.minimumOrderAmount ??
      null,
    maximumDiscount:
      coupon.maximumDiscount ??
      null,
    maximumUses:
      coupon.maximumUses ??
      null,
    usesPerCustomer:
      coupon.usesPerCustomer ??
      null,
    startsAt:
      coupon.startsAt ??
      null,
    expiresAt:
      coupon.expiresAt ??
      null,
    status:
      coupon.status,
    isActive:
      coupon.isActive,
  };
}

function hasActiveFilters(
  filters: CouponsToolbarFilters,
): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.status !== "ALL" ||
    filters.eventId.length > 0 ||
    filters.discountType !== "ALL" ||
    filters.dateFilter !== "all" ||
    filters.sort !== "recent"
  );
}

function buildCouponsQuery({
  filters,
  page,
  pageSize,
}: {
  filters: CouponsToolbarFilters;
  page: number;
  pageSize: number;
}): string {
  const params =
    new URLSearchParams();

  params.set(
    "page",
    String(page),
  );
  params.set(
    "pageSize",
    String(pageSize),
  );
  params.set(
    "sort",
    filters.sort,
  );

  const search =
    filters.search.trim();

  if (search) {
    params.set(
      "search",
      search,
    );
  }

  if (
    filters.status !==
    "ALL"
  ) {
    params.set(
      "status",
      filters.status,
    );
  }

  if (filters.eventId) {
    params.set(
      "eventId",
      filters.eventId,
    );
  }

  if (
    filters.discountType !==
    "ALL"
  ) {
    params.set(
      "discountType",
      filters.discountType,
    );
  }

  if (
    filters.dateFilter !==
    "all"
  ) {
    params.set(
      "dateFilter",
      filters.dateFilter,
    );
  }

  return params.toString();
}

export default function OrganizerCouponsPage() {
  const [
    coupons,
    setCoupons,
  ] = useState<CouponTableItem[]>([]);

  const [
    summary,
    setSummary,
  ] = useState<CouponsSummaryData>(
    EMPTY_SUMMARY,
  );

  const [
    pagination,
    setPagination,
  ] = useState<CouponsTablePagination>(
    EMPTY_PAGINATION,
  );

  const [
    events,
    setEvents,
  ] = useState<CouponEventOption[]>([]);

  const [
    campaigns,
    setCampaigns,
  ] = useState<CouponCampaignOption[]>([]);

  const [
    filters,
    setFilters,
  ] = useState<CouponsToolbarFilters>(
    DEFAULT_FILTERS,
  );

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    feedback,
    setFeedback,
  ] = useState<FeedbackState>(null);

  const [
    fieldErrors,
    setFieldErrors,
  ] = useState<ApiFieldErrors>({});

  const [
    isDialogOpen,
    setIsDialogOpen,
  ] = useState(false);

  const [
    dialogMode,
    setDialogMode,
  ] = useState<
    "create" | "edit"
  >("create");

  const [
    selectedCoupon,
    setSelectedCoupon,
  ] = useState<EditableCoupon | null>(
    null,
  );

  const pageSize = 20;

  const filteredStateActive =
    useMemo(
      () =>
        hasActiveFilters(
          filters,
        ),
      [filters],
    );

  const loadEvents =
    useCallback(async () => {
      try {
        const response =
          await fetch(
            "/api/organizer/events?page=1&pageSize=100",
            {
              method: "GET",
              cache: "no-store",
              credentials:
                "same-origin",
            },
          );

        const payload =
          await readJsonResponse<EventsApiResponse>(
            response,
          );

        if (!response.ok) {
          if (
            response.status ===
              401 &&
            payload.redirectTo
          ) {
            window.location.href =
              payload.redirectTo;
          }

          return;
        }

        const normalizedEvents =
          (
            payload.data
              ?.events ?? []
          )
            .filter(
              (
                event,
              ): event is NonNullable<
                typeof event
              > =>
                typeof event.id ===
                  "string" &&
                typeof event.title ===
                  "string",
            )
            .map((event) => ({
              id: event.id,
              title:
                event.title,
              currency:
                event.currency ??
                "XOF",
              status:
                event.status,
              startsAt:
                event.startsAt ??
                null,
              endsAt:
                event.endsAt ??
                null,
            }));

        setEvents(
          normalizedEvents,
        );
      } catch (error) {
        console.error(
          "[COUPONS_PAGE_EVENTS_ERROR]",
          error,
        );
      }
    }, []);

  const loadCampaigns =
    useCallback(async () => {
      try {
        const response =
          await fetch(
            "/api/organizer/marketing/campaigns?page=1&pageSize=100",
            {
              method: "GET",
              cache: "no-store",
              credentials:
                "same-origin",
            },
          );

        if (!response.ok) {
          setCampaigns([]);
          return;
        }

        const payload =
          await readJsonResponse<CampaignsApiResponse>(
            response,
          );

        const normalizedCampaigns =
          (
            payload.data
              ?.campaigns ?? []
          )
            .filter(
              (
                campaign,
              ): campaign is NonNullable<
                typeof campaign
              > =>
                typeof campaign.id ===
                  "string" &&
                typeof campaign.eventId ===
                  "string" &&
                typeof campaign.name ===
                  "string",
            )
            .map((campaign) => ({
              id: campaign.id,
              eventId:
                campaign.eventId,
              name:
                campaign.name,
              status:
                campaign.status,
            }));

        setCampaigns(
          normalizedCampaigns,
        );
      } catch {
        setCampaigns([]);
      }
    }, []);

  const loadCoupons =
    useCallback(
      async ({
        silent = false,
      }: {
        silent?: boolean;
      } = {}) => {
        if (silent) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        try {
          const query =
            buildCouponsQuery({
              filters,
              page,
              pageSize,
            });

          const response =
            await fetch(
              `/api/organizer/coupons?${query}`,
              {
                method: "GET",
                cache: "no-store",
                credentials:
                  "same-origin",
              },
            );

          const payload =
            await readJsonResponse<CouponsApiResponse>(
              response,
            );

          if (!response.ok) {
            if (
              response.status ===
                401 &&
              payload.redirectTo
            ) {
              window.location.href =
                payload.redirectTo;
              return;
            }

            throw new Error(
              getErrorMessage(
                payload,
                "Impossible de charger les codes promo.",
              ),
            );
          }

          const nextCoupons =
            (
              payload.data
                ?.coupons ?? []
            )
              .map(
                normalizeCoupon,
              )
              .filter(
                (
                  coupon,
                ): coupon is CouponTableItem =>
                  coupon !==
                  null,
              );

          setCoupons(
            nextCoupons,
          );

          setSummary(
            payload.data
              ?.summary ??
              EMPTY_SUMMARY,
          );

          setPagination(
            payload.data
              ?.pagination ??
              {
                ...EMPTY_PAGINATION,
                page,
                pageSize,
              },
          );
        } catch (error) {
          setCoupons([]);
          setSummary(
            EMPTY_SUMMARY,
          );

          setFeedback({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Impossible de charger les codes promo.",
          });
        } finally {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      },
      [
        filters,
        page,
      ],
    );

  useEffect(() => {
    const timeoutId =
      window.setTimeout(() => {
        void Promise.all([
          loadEvents(),
          loadCampaigns(),
        ]);
      }, 0);

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [
    loadEvents,
    loadCampaigns,
  ]);

  useEffect(() => {
    const timeoutId =
      window.setTimeout(() => {
        void loadCoupons();
      }, 0);

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [loadCoupons]);

  function openCreateDialog() {
    setDialogMode(
      "create",
    );
    setSelectedCoupon(
      null,
    );
    setFieldErrors({});
    setFeedback(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(
    coupon: CouponTableItem,
  ) {
    setDialogMode(
      "edit",
    );
    setSelectedCoupon(
      normalizeEditableCoupon(
        coupon,
      ),
    );
    setFieldErrors({});
    setFeedback(null);
    setIsDialogOpen(true);
  }

  function closeDialog() {
    if (isSubmitting) {
      return;
    }

    setIsDialogOpen(false);
    setSelectedCoupon(
      null,
    );
    setFieldErrors({});
  }

  async function submitCoupon(
    payload:
      CouponFormSubmitPayload,
  ) {
    setIsSubmitting(true);
    setFieldErrors({});
    setFeedback(null);

    try {
      const isEditing =
        dialogMode ===
          "edit" &&
        selectedCoupon;

      const endpoint =
        isEditing
          ? `/api/organizer/coupons/${selectedCoupon.id}`
          : "/api/organizer/coupons";

      const response =
        await fetch(endpoint, {
          method:
            isEditing
              ? "PATCH"
              : "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials:
            "same-origin",
          body: JSON.stringify(
            payload,
          ),
        });

      const result =
        await readJsonResponse<ApiErrorShape>(
          response,
        );

      if (!response.ok) {
        setFieldErrors(
          result.fields ??
            {},
        );

        throw new Error(
          getErrorMessage(
            result,
            isEditing
              ? "Impossible de modifier ce code promo."
              : "Impossible de créer ce code promo.",
          ),
        );
      }

      setFeedback({
        type: "success",
        message:
          result.message ??
          (isEditing
            ? "Le code promo a été modifié."
            : "Le code promo a été créé."),
      });

      setIsDialogOpen(false);
      setSelectedCoupon(
        null,
      );

      await loadCoupons({
        silent: true,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Une erreur est survenue.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateCouponStatus(
    coupon: CouponTableItem,
    status:
      | "ACTIVE"
      | "DISABLED"
      | "ARCHIVED",
  ) {
    setFeedback(null);

    try {
      const response =
        await fetch(
          `/api/organizer/coupons/${coupon.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials:
              "same-origin",
            body: JSON.stringify({
              status,
              isActive:
                status ===
                "ACTIVE",
            }),
          },
        );

      const payload =
        await readJsonResponse<ApiErrorShape>(
          response,
        );

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            payload,
            "Impossible de modifier le statut du code promo.",
          ),
        );
      }

      setFeedback({
        type: "success",
        message:
          payload.message ??
          "Le statut du code promo a été mis à jour.",
      });

      await loadCoupons({
        silent: true,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible de modifier le statut.",
      });
    }
  }

  async function deleteCoupon(
    coupon: CouponTableItem,
  ) {
    const confirmed =
      window.confirm(
        `Supprimer définitivement le code promo « ${coupon.code} » ?`,
      );

    if (!confirmed) {
      return;
    }

    setFeedback(null);

    try {
      const response =
        await fetch(
          `/api/organizer/coupons/${coupon.id}`,
          {
            method: "DELETE",
            credentials:
              "same-origin",
          },
        );

      const payload =
        await readJsonResponse<ApiErrorShape>(
          response,
        );

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            payload,
            "Impossible de supprimer ce code promo.",
          ),
        );
      }

      setFeedback({
        type: "success",
        message:
          payload.message ??
          "Le code promo a été supprimé.",
      });

      if (
        coupons.length === 1 &&
        page > 1
      ) {
        setPage(
          page - 1,
        );
      } else {
        await loadCoupons({
          silent: true,
        });
      }
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible de supprimer ce code promo.",
      });
    }
  }

  function duplicateCoupon(
    coupon: CouponTableItem,
  ) {
    const editable =
      normalizeEditableCoupon(
        coupon,
      );

    setDialogMode(
      "create",
    );

    setSelectedCoupon({
      ...editable,
      id: `duplicate-${coupon.id}`,
      code: `${coupon.code}_COPY`,
      status: "DRAFT",
      isActive: false,
    });

    setFieldErrors({});
    setFeedback(null);
    setIsDialogOpen(true);
  }

  function clearFilters() {
    setFilters(
      DEFAULT_FILTERS,
    );
    setPage(1);
  }

  return (
    <main className="w-full min-w-0 px-4 py-5 sm:px-5 lg:px-6 xl:px-8">
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-white/[0.075] bg-[#071015] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300">
              <TicketPercent className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                Marketing
              </p>

              <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
                Codes promo
              </h1>

              <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-neutral-500">
                Créez, gérez et mesurez les promotions associées à vos événements.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              void loadCoupons({
                silent: true,
              });
            }}
            disabled={
              isLoading ||
              isRefreshing
            }
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-sm font-black text-white transition hover:border-white/[0.15] hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={
                isRefreshing
                  ? "h-4 w-4 animate-spin"
                  : "h-4 w-4"
              }
            />
            Actualiser
          </button>
        </header>

        {feedback ? (
          <div
            role={
              feedback.type ===
              "error"
                ? "alert"
                : "status"
            }
            className={
              feedback.type ===
              "error"
                ? "flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm font-semibold text-rose-200"
                : "flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-3 text-sm font-semibold text-emerald-200"
            }
          >
            {feedback.type ===
            "error" ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
            )}

            <span className="flex-1">
              {feedback.message}
            </span>

            <button
              type="button"
              onClick={() => {
                setFeedback(null);
              }}
              className="text-xs font-black underline underline-offset-4"
            >
              Fermer
            </button>
          </div>
        ) : null}

        <CouponsSummary
          summary={summary}
          isLoading={isLoading}
        />

        <CouponsToolbar
          value={filters}
          events={events}
          totalResults={
            pagination.total
          }
          isLoading={
            isLoading ||
            isRefreshing
          }
          onChange={(
            nextFilters,
          ) => {
            setFilters(
              nextFilters,
            );
            setPage(1);
          }}
          onRefresh={() => {
            void loadCoupons({
              silent: true,
            });
          }}
          onCreateCoupon={
            openCreateDialog
          }
        />

        {!isLoading &&
        coupons.length === 0 ? (
          <CouponsEmptyState
            hasActiveFilters={
              filteredStateActive
            }
            onCreateCoupon={
              openCreateDialog
            }
            onClearFilters={
              filteredStateActive
                ? clearFilters
                : undefined
            }
          />
        ) : (
          <CouponsTable
            coupons={coupons}
            pagination={
              pagination
            }
            isLoading={isLoading}
            disabled={
              isRefreshing ||
              isSubmitting
            }
            onView={
              openEditDialog
            }
            onEdit={
              openEditDialog
            }
            onDuplicate={
              duplicateCoupon
            }
            onActivate={(
              coupon,
            ) => {
              void updateCouponStatus(
                coupon,
                "ACTIVE",
              );
            }}
            onDisable={(
              coupon,
            ) => {
              void updateCouponStatus(
                coupon,
                "DISABLED",
              );
            }}
            onArchive={(
              coupon,
            ) => {
              void updateCouponStatus(
                coupon,
                "ARCHIVED",
              );
            }}
            onDelete={(
              coupon,
            ) => {
              void deleteCoupon(
                coupon,
              );
            }}
            onPageChange={
              setPage
            }
          />
        )}
      </div>

      <CouponFormDialog
        open={isDialogOpen}
        mode={dialogMode}
        coupon={selectedCoupon}
        events={events}
        campaigns={campaigns}
        defaultCurrency={
          summary.currency
        }
        isSubmitting={
          isSubmitting
        }
        errorMessage={
          feedback?.type ===
          "error"
            ? feedback.message
            : null
        }
        successMessage={
          feedback?.type ===
          "success"
            ? feedback.message
            : null
        }
        fieldErrors={
          fieldErrors
        }
        onClose={closeDialog}
        onSubmit={
          submitCoupon
        }
      />
    </main>
  );
}