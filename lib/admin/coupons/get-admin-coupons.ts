import "server-only";

import {
  Prisma,
  PromoCodeStatus,
  PromoDiscountType,
} from "@prisma/client";

import {
  AdminCouponError,
} from "@/lib/admin/coupons/admin-coupon-errors";
import { prisma } from "@/lib/prisma";

export type AdminCouponSort =
  | "recent"
  | "oldest"
  | "most_used"
  | "least_used"
  | "ending_soon"
  | "value_desc"
  | "value_asc";

export type GetAdminCouponsInput = Readonly<{
  search?: string | null;
  status?: PromoCodeStatus | "all";
  discountType?: PromoDiscountType | "all";
  organizerId?: string | null;
  eventId?: string | null;
  country?: string | null;
  startsFrom?: Date | string | null;
  startsTo?: Date | string | null;
  sort?: AdminCouponSort;
  page?: number;
  pageSize?: number;
}>;

export type AdminCouponListItem = Readonly<{
  id: string;
  organizerId: string;
  eventId: string;
  campaignId: string | null;
  code: string;
  description: string | null;
  discountType: PromoDiscountType;
  discountValue: string;
  minimumOrderAmount: string | null;
  maximumDiscount: string | null;
  maximumUses: number | null;
  usesPerCustomer: number | null;
  currentUses: number;
  startsAt: Date | null;
  expiresAt: Date | null;
  status: PromoCodeStatus;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  event: {
    id: string;
    title: string;
    slug: string;
    coverImage: string | null;
    status: string;
    city: string;
    country: string;
    currency: string;
    startsAt: Date;
    endsAt: Date | null;
  };
  organizer: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    country: string;
    businessName: string | null;
  };
  campaign: {
    id: string;
    name: string;
    status: string;
  } | null;
  usageSummary: {
    totalDiscount: string;
    discountsByCurrency: Readonly<Record<string, string>>;
  };
}>;

export type GetAdminCouponsResult = Readonly<{
  coupons: readonly AdminCouponListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  options: {
    organizers: readonly { id: string; name: string }[];
    events: readonly { id: string; title: string }[];
    countries: readonly string[];
  };
}>;

function normalizeText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function parseDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AdminCouponError({
      code: "ADMIN_COUPON_PERIOD_INVALID",
      message: "Une date de filtre est invalide.",
      status: 400,
    });
  }
  return date;
}

export function buildAdminCouponWhere(
  input: GetAdminCouponsInput,
): Prisma.PromoCodeWhereInput {
  const search = normalizeText(input.search);
  const organizerId = normalizeText(input.organizerId);
  const eventId = normalizeText(input.eventId);
  const country = normalizeText(input.country);
  const startsFrom = parseDate(input.startsFrom);
  const startsTo = parseDate(input.startsTo);

  const where: Prisma.PromoCodeWhereInput = {};

  if (input.status && input.status !== "all") where.status = input.status;
  if (input.discountType && input.discountType !== "all") {
    where.discountType = input.discountType;
  }
  if (organizerId) where.organizerId = organizerId;
  if (eventId) where.eventId = eventId;

  if (country) {
    where.event = {
      is: {
        country: {
          equals: country,
          mode: "insensitive",
        },
      },
    };
  }

  if (startsFrom || startsTo) {
    where.startsAt = {
      ...(startsFrom ? { gte: startsFrom } : {}),
      ...(startsTo ? { lte: startsTo } : {}),
    };
  }

  if (search) {
    where.OR = [
      {
        code: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        event: {
          is: {
            OR: [
              {
                title: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                slug: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                city: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          },
        },
      },
      {
        organizer: {
          is: {
            OR: [
              {
                firstName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                lastName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                email: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                organizerProfile: {
                  is: {
                    businessName: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                },
              },
            ],
          },
        },
      },
    ];
  }

  return where;
}

function orderBy(
  sort: AdminCouponSort | undefined,
): Prisma.PromoCodeOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "most_used":
      return [{ currentUses: "desc" }, { createdAt: "desc" }];
    case "least_used":
      return [{ currentUses: "asc" }, { createdAt: "desc" }];
    case "ending_soon":
      return [{ expiresAt: "asc" }, { createdAt: "desc" }];
    case "value_desc":
      return [{ discountValue: "desc" }, { createdAt: "desc" }];
    case "value_asc":
      return [{ discountValue: "asc" }, { createdAt: "desc" }];
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

export async function getAdminCoupons(
  input: GetAdminCouponsInput = {},
): Promise<GetAdminCouponsResult> {
  const page =
    Number.isInteger(input.page) && Number(input.page) > 0
      ? Number(input.page)
      : 1;

  const pageSize = Math.min(
    Number.isInteger(input.pageSize) && Number(input.pageSize) > 0
      ? Number(input.pageSize)
      : 20,
    100,
  );

  const where = buildAdminCouponWhere(input);

  try {
    const [totalItems, rows, organizers, events, countries] =
      await Promise.all([
        prisma.promoCode.count({ where }),
        prisma.promoCode.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: orderBy(input.sort),
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
                coverImage: true,
                status: true,
                city: true,
                country: true,
                currency: true,
                startsAt: true,
                endsAt: true,
              },
            },
            organizer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                country: true,
                organizerProfile: {
                  select: {
                    businessName: true,
                  },
                },
              },
            },
            campaign: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
            usages: {
              select: {
                discountAmount: true,
                currency: true,
              },
            },
          },
        }),
        prisma.user.findMany({
          where: {
            role: "ORGANIZER",
            marketingPromoCodes: {
              some: {},
            },
          },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
          select: {
            id: true,
            firstName: true,
            lastName: true,
            organizerProfile: {
              select: {
                businessName: true,
              },
            },
          },
        }),
        prisma.event.findMany({
          where: {
            marketingPromoCodes: {
              some: {},
            },
          },
          orderBy: {
            title: "asc",
          },
          select: {
            id: true,
            title: true,
          },
        }),
        prisma.event.findMany({
          where: {
            marketingPromoCodes: {
              some: {},
            },
          },
          distinct: ["country"],
          orderBy: {
            country: "asc",
          },
          select: {
            country: true,
          },
        }),
      ]);

    const coupons: AdminCouponListItem[] = rows.map((row) => {
      const discounts: Record<string, Prisma.Decimal> = {};
      let totalDiscount = new Prisma.Decimal(0);

      for (const usage of row.usages) {
        totalDiscount = totalDiscount.plus(usage.discountAmount);
        discounts[usage.currency] = (
          discounts[usage.currency] ?? new Prisma.Decimal(0)
        ).plus(usage.discountAmount);
      }

      return {
        id: row.id,
        organizerId: row.organizerId,
        eventId: row.eventId,
        campaignId: row.campaignId,
        code: row.code,
        description: row.description,
        discountType: row.discountType,
        discountValue: row.discountValue.toFixed(2),
        minimumOrderAmount: row.minimumOrderAmount?.toFixed(2) ?? null,
        maximumDiscount: row.maximumDiscount?.toFixed(2) ?? null,
        maximumUses: row.maximumUses,
        usesPerCustomer: row.usesPerCustomer,
        currentUses: row.currentUses,
        startsAt: row.startsAt,
        expiresAt: row.expiresAt,
        status: row.status,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        event: row.event,
        organizer: {
          id: row.organizer.id,
          fullName: `${row.organizer.firstName} ${row.organizer.lastName}`
            .replace(/\s+/g, " ")
            .trim(),
          email: row.organizer.email,
          phone: row.organizer.phone,
          country: row.organizer.country,
          businessName:
            row.organizer.organizerProfile?.businessName ?? null,
        },
        campaign: row.campaign,
        usageSummary: {
          totalDiscount: totalDiscount.toFixed(2),
          discountsByCurrency: Object.fromEntries(
            Object.entries(discounts).map(([currency, amount]) => [
              currency,
              amount.toFixed(2),
            ]),
          ),
        },
      };
    });

    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

    return {
      coupons,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
      options: {
        organizers: organizers.map((organizer) => ({
          id: organizer.id,
          name:
            organizer.organizerProfile?.businessName ||
            `${organizer.firstName} ${organizer.lastName}`
              .replace(/\s+/g, " ")
              .trim(),
        })),
        events,
        countries: countries.map((item) => item.country),
      },
    };
  } catch (error) {
    if (error instanceof AdminCouponError) throw error;

    throw new AdminCouponError({
      code: "ADMIN_COUPON_QUERY_FAILED",
      message: "Impossible de charger les codes promo.",
      status: 500,
      cause: error,
    });
  }
}
