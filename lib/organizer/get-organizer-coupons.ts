import "server-only";

import { createHash } from "node:crypto";

import {
  Prisma,
  PromoCodeStatus,
  PromoDiscountType,
  UserRole,
} from "@prisma/client";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DEFAULT_CURRENCY = "XOF";

export type OrganizerCouponSort =
  | "recent"
  | "oldest"
  | "code-asc"
  | "code-desc"
  | "most-used"
  | "least-used"
  | "highest-discount"
  | "lowest-discount";

export type OrganizerCouponDateFilter =
  | "all"
  | "active-now"
  | "scheduled"
  | "expired";

export type GetOrganizerCouponsInput = {
  page?: number;
  pageSize?: number;
  search?: string | null;
  status?: PromoCodeStatus | null;
  statuses?: readonly PromoCodeStatus[];
  eventId?: string | null;
  campaignId?: string | null;
  discountType?: PromoDiscountType | null;
  currency?: string | null;
  dateFilter?: OrganizerCouponDateFilter;
  from?: Date | string | null;
  to?: Date | string | null;
  sort?: OrganizerCouponSort;
};

export type OrganizerCouponEventItem = {
  id: string;
  title: string;
  slug: string;
  status: string;
  startsAt: string;
  endsAt: string;
  currency: string;
};

export type OrganizerCouponCampaignItem = {
  id: string;
  name: string;
  status: string;
  trackingCode: string;
};

export type OrganizerCouponItem = {
  id: string;
  organizerId: string;
  eventId: string;
  campaignId: string | null;
  code: string;
  description: string | null;
  discountType: PromoDiscountType;
  discountValue: number;
  minimumOrderAmount: number | null;
  maximumDiscount: number | null;
  maximumUses: number | null;
  usesPerCustomer: number | null;
  currentUses: number;
  remainingUses: number | null;
  usageRate: number;
  startsAt: string | null;
  expiresAt: string | null;
  status: PromoCodeStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  currency: string;
  event: OrganizerCouponEventItem;
  campaign: OrganizerCouponCampaignItem | null;
  performance: {
    usages: number;
    uniqueCustomers: number;
    discountsGranted: number;
    attributedOrders: number;
    attributedRevenue: number;
    ticketsGenerated: number;
    averageOrderValue: number;
    conversionRate: number;
  };
};

export type OrganizerCouponsSummary = {
  totalCoupons: number;
  activeCoupons: number;
  draftCoupons: number;
  scheduledCoupons: number;
  expiredCoupons: number;
  disabledCoupons: number;
  archivedCoupons: number;
  totalUsages: number;
  totalDiscountsGranted: number;
  totalAttributedOrders: number;
  totalAttributedRevenue: number;
  totalTicketsGenerated: number;
  currency: string;
};

export type OrganizerCouponsPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type GetOrganizerCouponsResult = {
  organizerId: string;
  coupons: OrganizerCouponItem[];
  summary: OrganizerCouponsSummary;
  pagination: OrganizerCouponsPagination;
};

export type GetOrganizerCouponsErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_QUERY"
  | "LOAD_FAILED";

export class GetOrganizerCouponsError extends Error {
  readonly code: GetOrganizerCouponsErrorCode;
  readonly status: number;

  constructor({
    code,
    status,
    message,
  }: {
    code: GetOrganizerCouponsErrorCode;
    status: number;
    message: string;
  }) {
    super(message);
    this.name = "GetOrganizerCouponsError";
    this.code = code;
    this.status = status;
  }
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function normalizePageSize(value: number | undefined): number {
  return Math.min(
    normalizePositiveInteger(value, DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
}

function normalizeOptionalText(
  value: string | null | undefined,
  maximumLength: number,
): string {
  return value?.trim().slice(0, maximumLength) ?? "";
}

function normalizeCurrency(value: string | null | undefined): string {
  const normalized = normalizeOptionalText(value, 3).toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "";
}

function parseOptionalDate(
  value: Date | string | null | undefined,
  label: string,
): Date | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new GetOrganizerCouponsError({
      code: "INVALID_QUERY",
      status: 400,
      message: `La valeur de ${label} n’est pas une date valide.`,
    });
  }

  return date;
}

function toNumber(
  value: Prisma.Decimal | number | string | null | undefined,
): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return value.toNumber();
}

function getOrderBy(
  sort: OrganizerCouponSort,
): Prisma.PromoCodeOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "code-asc":
      return [{ code: "asc" }, { createdAt: "desc" }];
    case "code-desc":
      return [{ code: "desc" }, { createdAt: "desc" }];
    case "most-used":
      return [{ currentUses: "desc" }, { createdAt: "desc" }];
    case "least-used":
      return [{ currentUses: "asc" }, { createdAt: "desc" }];
    case "highest-discount":
      return [{ discountValue: "desc" }, { createdAt: "desc" }];
    case "lowest-discount":
      return [{ discountValue: "asc" }, { createdAt: "desc" }];
    case "recent":
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

async function getAuthenticatedOrganizerId(): Promise<string> {
  const cookieStore = await cookies();
  const sessionCookieName =
    process.env.SESSION_COOKIE_NAME?.trim() || "tikemia_session";
  const rawSessionToken = cookieStore.get(sessionCookieName)?.value;

  if (!rawSessionToken) {
    throw new GetOrganizerCouponsError({
      code: "UNAUTHORIZED",
      status: 401,
      message: "Votre session a expiré. Connectez-vous de nouveau.",
    });
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(rawSessionToken) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          role: true,
          emailVerified: true,
          isActive: true,
        },
      },
    },
  });

  if (!session) {
    throw new GetOrganizerCouponsError({
      code: "UNAUTHORIZED",
      status: 401,
      message: "Votre session n’est plus valide. Connectez-vous de nouveau.",
    });
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session
      .delete({ where: { id: session.id } })
      .catch(() => undefined);

    throw new GetOrganizerCouponsError({
      code: "UNAUTHORIZED",
      status: 401,
      message: "Votre session a expiré. Connectez-vous de nouveau.",
    });
  }

  if (session.user.role !== UserRole.ORGANIZER) {
    throw new GetOrganizerCouponsError({
      code: "FORBIDDEN",
      status: 403,
      message: "Ce compte ne correspond pas à un espace organisateur.",
    });
  }

  if (!session.user.isActive || !session.user.emailVerified) {
    throw new GetOrganizerCouponsError({
      code: "FORBIDDEN",
      status: 403,
      message: "Votre compte organisateur ne peut pas accéder à cette ressource.",
    });
  }

  return session.user.id;
}

export async function getOrganizerCoupons(
  input: GetOrganizerCouponsInput = {},
): Promise<GetOrganizerCouponsResult> {
  try {
    const organizerId = await getAuthenticatedOrganizerId();
    const page = normalizePositiveInteger(input.page, DEFAULT_PAGE);
    const pageSize = normalizePageSize(input.pageSize);
    const search = normalizeOptionalText(input.search, 120);
    const eventId = normalizeOptionalText(input.eventId, 191);
    const campaignId = normalizeOptionalText(input.campaignId, 191);
    const currency = normalizeCurrency(input.currency);
    const from = parseOptionalDate(input.from, "la date de début");
    const to = parseOptionalDate(input.to, "la date de fin");

    if (from && to && from.getTime() > to.getTime()) {
      throw new GetOrganizerCouponsError({
        code: "INVALID_QUERY",
        status: 400,
        message: "La date de début ne peut pas être postérieure à la date de fin.",
      });
    }

    const requestedStatuses = input.statuses?.length
      ? Array.from(new Set(input.statuses))
      : input.status
        ? [input.status]
        : [];

    const now = new Date();
    const dateFilter = input.dateFilter ?? "all";

    const where: Prisma.PromoCodeWhereInput = {
      organizerId,
      ...(requestedStatuses.length
        ? { status: { in: requestedStatuses } }
        : {}),
      ...(eventId ? { eventId } : {}),
      ...(campaignId ? { campaignId } : {}),
      ...(input.discountType ? { discountType: input.discountType } : {}),
      ...(currency ? { event: { currency } } : {}),
      ...(search
        ? {
            OR: [
              {
                code: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                description: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                event: {
                  title: {
                    contains: search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
              {
                campaign: {
                  name: {
                    contains: search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
            ],
          }
        : {}),
      ...(dateFilter === "active-now"
        ? {
            isActive: true,
            startsAt: { lte: now },
            AND: [
              {
                OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
              },
            ],
          }
        : {}),
      ...(dateFilter === "scheduled" ? { startsAt: { gt: now } } : {}),
      ...(dateFilter === "expired" ? { expiresAt: { lt: now } } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const skip = (page - 1) * pageSize;

    const [coupons, total, summaryRows] = await Promise.all([
      prisma.promoCode.findMany({
        where,
        select: {
          id: true,
          organizerId: true,
          eventId: true,
          campaignId: true,
          code: true,
          description: true,
          discountType: true,
          discountValue: true,
          minimumOrderAmount: true,
          maximumDiscount: true,
          maximumUses: true,
          usesPerCustomer: true,
          currentUses: true,
          startsAt: true,
          expiresAt: true,
          status: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          event: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              startsAt: true,
              endsAt: true,
              currency: true,
            },
          },
          campaign: {
            select: {
              id: true,
              name: true,
              status: true,
              trackingCode: true,
            },
          },
          usages: {
            select: {
              customerId: true,
              customerEmail: true,
              discountAmount: true,
            },
          },
          attributions: {
            select: {
              revenue: true,
              ticketsCount: true,
              orderId: true,
            },
          },
        },
        orderBy: getOrderBy(input.sort ?? "recent"),
        skip,
        take: pageSize,
      }),
      prisma.promoCode.count({ where }),
      prisma.promoCode.findMany({
        where: { organizerId },
        select: {
          status: true,
          currentUses: true,
          event: { select: { currency: true } },
          usages: { select: { discountAmount: true } },
          attributions: {
            select: {
              revenue: true,
              ticketsCount: true,
              orderId: true,
            },
          },
        },
      }),
    ]);

    const normalizedCoupons: OrganizerCouponItem[] = coupons.map((coupon) => {
      const usages = coupon.usages.length;
      const uniqueCustomers = new Set(
        coupon.usages.map(
          (usage) => usage.customerId ?? usage.customerEmail,
        ),
      ).size;
      const discountsGranted = coupon.usages.reduce(
        (totalDiscount, usage) =>
          totalDiscount + toNumber(usage.discountAmount),
        0,
      );
      const attributedOrders = new Set(
        coupon.attributions.map((attribution) => attribution.orderId),
      ).size;
      const attributedRevenue = coupon.attributions.reduce(
        (totalRevenue, attribution) =>
          totalRevenue + toNumber(attribution.revenue),
        0,
      );
      const ticketsGenerated = coupon.attributions.reduce(
        (totalTickets, attribution) =>
          totalTickets + attribution.ticketsCount,
        0,
      );
      const averageOrderValue =
        attributedOrders > 0 ? attributedRevenue / attributedOrders : 0;
      const conversionRate =
        usages > 0
          ? Math.min(100, (attributedOrders / usages) * 100)
          : 0;
      const remainingUses =
        coupon.maximumUses === null
          ? null
          : Math.max(0, coupon.maximumUses - coupon.currentUses);
      const usageRate =
        coupon.maximumUses && coupon.maximumUses > 0
          ? Math.min(100, (coupon.currentUses / coupon.maximumUses) * 100)
          : 0;

      return {
        id: coupon.id,
        organizerId: coupon.organizerId,
        eventId: coupon.eventId,
        campaignId: coupon.campaignId,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: toNumber(coupon.discountValue),
        minimumOrderAmount:
          coupon.minimumOrderAmount === null
            ? null
            : toNumber(coupon.minimumOrderAmount),
        maximumDiscount:
          coupon.maximumDiscount === null
            ? null
            : toNumber(coupon.maximumDiscount),
        maximumUses: coupon.maximumUses,
        usesPerCustomer: coupon.usesPerCustomer,
        currentUses: coupon.currentUses,
        remainingUses,
        usageRate,
        startsAt: coupon.startsAt?.toISOString() ?? null,
        expiresAt: coupon.expiresAt?.toISOString() ?? null,
        status: coupon.status,
        isActive: coupon.isActive,
        createdAt: coupon.createdAt.toISOString(),
        updatedAt: coupon.updatedAt.toISOString(),
        currency:
          coupon.event.currency.trim().toUpperCase() || DEFAULT_CURRENCY,
        event: {
          id: coupon.event.id,
          title: coupon.event.title,
          slug: coupon.event.slug,
          status: coupon.event.status,
          startsAt: coupon.event.startsAt.toISOString(),
          endsAt: coupon.event.endsAt?.toISOString() ?? "",
          currency:
            coupon.event.currency.trim().toUpperCase() || DEFAULT_CURRENCY,
        },
        campaign: coupon.campaign
          ? {
              id: coupon.campaign.id,
              name: coupon.campaign.name,
              status: coupon.campaign.status,
              trackingCode: coupon.campaign.trackingCode,
            }
          : null,
        performance: {
          usages,
          uniqueCustomers,
          discountsGranted,
          attributedOrders,
          attributedRevenue,
          ticketsGenerated,
          averageOrderValue,
          conversionRate,
        },
      };
    });

    const summaryCurrency =
      summaryRows
        .find((coupon) => coupon.event.currency?.trim())
        ?.event.currency.trim().toUpperCase() || DEFAULT_CURRENCY;

    const summary: OrganizerCouponsSummary = {
      totalCoupons: summaryRows.length,
      activeCoupons: summaryRows.filter(
        (coupon) => coupon.status === PromoCodeStatus.ACTIVE,
      ).length,
      draftCoupons: summaryRows.filter(
        (coupon) => coupon.status === PromoCodeStatus.DRAFT,
      ).length,
      scheduledCoupons: summaryRows.filter(
        (coupon) => coupon.status === PromoCodeStatus.SCHEDULED,
      ).length,
      expiredCoupons: summaryRows.filter(
        (coupon) => coupon.status === PromoCodeStatus.EXPIRED,
      ).length,
      disabledCoupons: summaryRows.filter(
        (coupon) => coupon.status === PromoCodeStatus.DISABLED,
      ).length,
      archivedCoupons: summaryRows.filter(
        (coupon) => coupon.status === PromoCodeStatus.ARCHIVED,
      ).length,
      totalUsages: summaryRows.reduce(
        (totalUsages, coupon) => totalUsages + coupon.currentUses,
        0,
      ),
      totalDiscountsGranted: summaryRows.reduce(
        (totalDiscount, coupon) =>
          totalDiscount +
          coupon.usages.reduce(
            (subtotal, usage) => subtotal + toNumber(usage.discountAmount),
            0,
          ),
        0,
      ),
      totalAttributedOrders: new Set(
        summaryRows.flatMap((coupon) =>
          coupon.attributions.map((attribution) => attribution.orderId),
        ),
      ).size,
      totalAttributedRevenue: summaryRows.reduce(
        (totalRevenue, coupon) =>
          totalRevenue +
          coupon.attributions.reduce(
            (subtotal, attribution) =>
              subtotal + toNumber(attribution.revenue),
            0,
          ),
        0,
      ),
      totalTicketsGenerated: summaryRows.reduce(
        (totalTickets, coupon) =>
          totalTickets +
          coupon.attributions.reduce(
            (subtotal, attribution) =>
              subtotal + attribution.ticketsCount,
            0,
          ),
        0,
      ),
      currency: summaryCurrency,
    };

    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    return {
      organizerId,
      coupons: normalizedCoupons,
      summary,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
    };
  } catch (error) {
    if (error instanceof GetOrganizerCouponsError) {
      throw error;
    }

    console.error(
      "[GET_ORGANIZER_COUPONS_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV === "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    throw new GetOrganizerCouponsError({
      code: "LOAD_FAILED",
      status: 500,
      message: "Impossible de charger les codes promo pour le moment.",
    });
  }
}

export default getOrganizerCoupons;