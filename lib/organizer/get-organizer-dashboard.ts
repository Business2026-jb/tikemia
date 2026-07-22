import "server-only";

import type {
  EventStatus,
  OrganizerActivityType,
  Prisma,
} from "@prisma/client";

import {
  DEFAULT_CURRENCY_CODE,
  getCurrencyDefinition,
  isSupportedCurrencyCode,
  type SupportedCurrencyCode,
} from "@/lib/localization/currencies";
import {
  getCurrencyDecimals,
  roundMoneyAmount,
} from "@/lib/localization/format-money";
import { prisma } from "@/lib/prisma";

const DEFAULT_PERIOD_DAYS = 30;
const DEFAULT_CURRENCY =
  DEFAULT_CURRENCY_CODE;
const MAX_PERIOD_DAYS = 365;
const RECENT_EVENTS_LIMIT = 6;
const RECENT_ACTIVITIES_LIMIT = 8;

const SOLD_TICKET_STATUSES = ["VALID", "USED"] as const;
const RESERVED_PAYOUT_STATUSES = [
  "PENDING",
  "PROCESSING",
  "PAID",
] as const;

type GetOrganizerDashboardParams = {
  organizerId: string;
  currency?: string;
  periodDays?: number;
  timeZone?: string;
};

export type DashboardTrend = {
  current: number;
  previous: number;
  percentage: number | null;
  direction: "up" | "down" | "stable";
};

export type DashboardSummary = {
  grossRevenue: number;
  platformFees: number;
  netRevenue: number;
  availableBalance: number;
  reservedPayouts: number;
  ticketsSold: number;
  remainingPlaces: number;
  activeEvents: number;
  totalEvents: number;
  participants: number;
  paidOrders: number;
};

export type DashboardCurrencySummary = {
  currency: SupportedCurrencyCode;
  grossRevenue: number;
  platformFees: number;
  netRevenue: number;
  reservedPayouts: number;
  availableBalance: number;
  paidOrders: number;
  ticketsSold: number;
};

export type DashboardCurrencyOption = {
  code: SupportedCurrencyCode;
  name: string;
  symbol: string;
  fractionDigits: number;
};

export type DashboardTrends = {
  grossRevenue: DashboardTrend;
  netRevenue: DashboardTrend;
  ticketsSold: DashboardTrend;
  paidOrders: DashboardTrend;
};

export type DashboardSalesPoint = {
  date: string;
  grossRevenue: number;
  netRevenue: number;
  platformFees: number;
  ticketsSold: number;
  paidOrders: number;
};

export type DashboardCategoryItem = {
  categoryId: string | null;
  categoryName: string;
  grossRevenue: number;
  netRevenue: number;
  ticketsSold: number;
  percentage: number;
};

export type DashboardRecentEvent = {
  id: string;
  title: string;
  slug: string;
  coverImage: string | null;
  venueName: string;
  city: string;
  country: string;
  startsAt: string;
  endsAt: string | null;
  status: EventStatus;
  currency: SupportedCurrencyCode;
  capacity: number;
  ticketsSold: number;
  remainingPlaces: number;
  grossRevenue: number;
  platformFees: number;
  netRevenue: number;
  paidOrders: number;
};

export type DashboardActivity = {
  id: string;
  type: OrganizerActivityType;
  title: string;
  description: string | null;
  amount: number | null;
  currency: SupportedCurrencyCode | null;
  createdAt: string;
  event: {
    id: string;
    title: string;
    slug: string;
  } | null;
};

export type OrganizerDashboardData = {
  generatedAt: string;

  period: {
    days: number;
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
    timeZone: string;
  };

  currency: SupportedCurrencyCode;
  currencyOptions: DashboardCurrencyOption[];
  revenueByCurrency: DashboardCurrencySummary[];
  summary: DashboardSummary;
  trends: DashboardTrends;
  salesChart: DashboardSalesPoint[];
  revenueByCategory: DashboardCategoryItem[];
  recentEvents: DashboardRecentEvent[];
  recentActivities: DashboardActivity[];
};

function decimalToNumber(
  value: Prisma.Decimal | number | string | null | undefined,
): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const numberValue =
    typeof value === "number" ? value : Number(value.toString());

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizeMoney(
  value: number,
  currency: string = DEFAULT_CURRENCY,
): number {
  return roundMoneyAmount({
    amount: value,
    currency,
  });
}

function normalizePeriodDays(value?: number): number {
  if (!Number.isInteger(value)) {
    return DEFAULT_PERIOD_DAYS;
  }

  return Math.min(Math.max(value ?? DEFAULT_PERIOD_DAYS, 1), MAX_PERIOD_DAYS);
}

function normalizeCurrency(
  value?: string,
): SupportedCurrencyCode {
  const currency =
    value?.trim().toUpperCase() ?? "";

  if (
    isSupportedCurrencyCode(currency) &&
    getCurrencyDefinition(currency)?.active
  ) {
    return currency;
  }

  return DEFAULT_CURRENCY;
}

function normalizeTimeZone(value?: string): string {
  const timeZone = value?.trim() || "Africa/Porto-Novo";

  try {
    new Intl.DateTimeFormat("fr-FR", {
      timeZone,
    }).format(new Date());

    return timeZone;
  } catch {
    return "Africa/Porto-Novo";
  }
}

function getDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return date.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function startOfUtcDay(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function createTrend(
  current: number,
  previous: number,
  currency: string = DEFAULT_CURRENCY,
): DashboardTrend {
  const normalizedCurrent =
    normalizeMoney(current, currency);

  const normalizedPrevious =
    normalizeMoney(previous, currency);

  let percentage: number | null = null;

  if (normalizedPrevious !== 0) {
    percentage =
      Math.round(
        (((normalizedCurrent -
          normalizedPrevious) /
          Math.abs(normalizedPrevious)) *
          100 +
          Number.EPSILON) *
          100,
      ) / 100;
  } else if (normalizedCurrent === 0) {
    percentage = 0;
  }

  let direction: DashboardTrend["direction"] = "stable";

  if (normalizedCurrent > normalizedPrevious) {
    direction = "up";
  } else if (normalizedCurrent < normalizedPrevious) {
    direction = "down";
  }

  return {
    current: normalizedCurrent,
    previous: normalizedPrevious,
    percentage,
    direction,
  };
}

function calculateRemainingPlaces(
  capacity: number,
  ticketTypeQuantity: number,
  ticketsSold: number,
): number {
  const availableCapacity =
    ticketTypeQuantity > 0 ? ticketTypeQuantity : capacity;

  return Math.max(availableCapacity - ticketsSold, 0);
}

function toSupportedCurrency(
  value: string | null | undefined,
): SupportedCurrencyCode | null {
  const normalizedValue =
    value?.trim().toUpperCase() ?? "";

  if (
    !isSupportedCurrencyCode(
      normalizedValue,
    )
  ) {
    return null;
  }

  const definition =
    getCurrencyDefinition(
      normalizedValue,
    );

  return definition?.active
    ? normalizedValue
    : null;
}

function buildCurrencyOption(
  currency: SupportedCurrencyCode,
): DashboardCurrencyOption {
  const definition =
    getCurrencyDefinition(currency);

  return {
    code: currency,
    name:
      definition?.name ??
      currency,
    symbol:
      definition?.symbol ??
      currency,
    fractionDigits:
      definition?.decimals ??
      getCurrencyDecimals(currency),
  };
}

export async function getOrganizerDashboard({
  organizerId,
  currency,
  periodDays,
  timeZone,
}: GetOrganizerDashboardParams): Promise<OrganizerDashboardData> {
  const cleanOrganizerId = organizerId.trim();

  if (!cleanOrganizerId) {
    throw new Error("L’identifiant de l’organisateur est obligatoire.");
  }

  const selectedCurrency = normalizeCurrency(currency);
  const selectedPeriodDays = normalizePeriodDays(periodDays);
  const selectedTimeZone = normalizeTimeZone(timeZone);

  const now = new Date();
  const currentPeriodEnd = now;
  const currentPeriodStart = startOfUtcDay(
    addDays(now, -(selectedPeriodDays - 1)),
  );

  const previousPeriodEnd = new Date(
    currentPeriodStart.getTime() - 1,
  );

  const previousPeriodStart = startOfUtcDay(
    addDays(currentPeriodStart, -selectedPeriodDays),
  );

  const activeEventWhere = {
    organizerId: cleanOrganizerId,
    status: "PUBLISHED" as const,
    OR: [
      {
        endsAt: {
          gte: now,
        },
      },
      {
        endsAt: null,
        startsAt: {
          gte: startOfUtcDay(now),
        },
      },
    ],
  };

  const paidOrderBaseWhere = {
    event: {
      organizerId: cleanOrganizerId,
    },
    status: "PAID" as const,
    currency: selectedCurrency,
    paidAt: {
      not: null,
    },
  };

  const soldTicketBaseWhere = {
    event: {
      organizerId: cleanOrganizerId,
    },
    order: {
      status: "PAID" as const,
    },
    status: {
      in: [...SOLD_TICKET_STATUSES],
    },
  };

  const [
    organizer,
    totalEvents,
    activeEvents,
    allOrganizerEvents,
    currentRevenue,
    previousRevenue,
    currentPaidOrders,
    previousPaidOrders,
    currentTicketsSold,
    previousTicketsSold,
    totalTicketsSold,
    participants,
    reservedPayouts,
    currentPeriodOrders,
    currentPeriodTickets,
    recentEvents,
    recentActivities,
    categoryOrders,
    allPaidOrdersByCurrency,
    allReservedPayoutsByCurrency,
    allSoldTicketsForCurrencyBreakdown,
  ] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: cleanOrganizerId,
        role: "ORGANIZER",
        isActive: true,
      },
      select: {
        id: true,
      },
    }),

    prisma.event.count({
      where: {
        organizerId: cleanOrganizerId,
      },
    }),

    prisma.event.count({
      where: activeEventWhere,
    }),

    prisma.event.findMany({
      where: {
        organizerId: cleanOrganizerId,
        status: {
          not: "CANCELLED",
        },
      },
      select: {
        id: true,
        capacity: true,
        ticketTypes: {
          select: {
            quantity: true,
          },
        },
      },
    }),

    prisma.order.aggregate({
      where: {
        ...paidOrderBaseWhere,
        paidAt: {
          gte: currentPeriodStart,
          lte: currentPeriodEnd,
        },
      },
      _sum: {
        subtotal: true,
        platformFee: true,
      },
    }),

    prisma.order.aggregate({
      where: {
        ...paidOrderBaseWhere,
        paidAt: {
          gte: previousPeriodStart,
          lte: previousPeriodEnd,
        },
      },
      _sum: {
        subtotal: true,
        platformFee: true,
      },
    }),

    prisma.order.count({
      where: {
        ...paidOrderBaseWhere,
        paidAt: {
          gte: currentPeriodStart,
          lte: currentPeriodEnd,
        },
      },
    }),

    prisma.order.count({
      where: {
        ...paidOrderBaseWhere,
        paidAt: {
          gte: previousPeriodStart,
          lte: previousPeriodEnd,
        },
      },
    }),

    prisma.ticket.count({
      where: {
        ...soldTicketBaseWhere,
        createdAt: {
          gte: currentPeriodStart,
          lte: currentPeriodEnd,
        },
      },
    }),

    prisma.ticket.count({
      where: {
        ...soldTicketBaseWhere,
        createdAt: {
          gte: previousPeriodStart,
          lte: previousPeriodEnd,
        },
      },
    }),

    prisma.ticket.count({
      where: soldTicketBaseWhere,
    }),

    prisma.ticket.findMany({
      where: soldTicketBaseWhere,
      distinct: ["holderEmail"],
      select: {
        holderEmail: true,
      },
    }),

    prisma.payout.aggregate({
      where: {
        organizerId: cleanOrganizerId,
        currency: selectedCurrency,
        status: {
          in: [...RESERVED_PAYOUT_STATUSES],
        },
      },
      _sum: {
        netAmount: true,
      },
    }),

    prisma.order.findMany({
      where: {
        ...paidOrderBaseWhere,
        paidAt: {
          gte: currentPeriodStart,
          lte: currentPeriodEnd,
        },
      },
      select: {
        paidAt: true,
        subtotal: true,
        platformFee: true,
      },
      orderBy: {
        paidAt: "asc",
      },
    }),

    prisma.ticket.findMany({
      where: {
        ...soldTicketBaseWhere,
        createdAt: {
          gte: currentPeriodStart,
          lte: currentPeriodEnd,
        },
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    }),

    prisma.event.findMany({
      where: {
        organizerId: cleanOrganizerId,
      },
      orderBy: [
        {
          startsAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: RECENT_EVENTS_LIMIT,
      select: {
        id: true,
        title: true,
        slug: true,
        coverImage: true,
        venueName: true,
        city: true,
        country: true,
        startsAt: true,
        endsAt: true,
        status: true,
        currency: true,
        capacity: true,
        ticketTypes: {
          select: {
            quantity: true,
          },
        },
      },
    }),

    prisma.organizerActivity.findMany({
      where: {
        organizerId: cleanOrganizerId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: RECENT_ACTIVITIES_LIMIT,
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        amount: true,
        currency: true,
        createdAt: true,
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    }),

    prisma.order.findMany({
      where: {
        ...paidOrderBaseWhere,
        paidAt: {
          gte: currentPeriodStart,
          lte: currentPeriodEnd,
        },
      },
      select: {
        subtotal: true,
        platformFee: true,
        items: {
          select: {
            quantity: true,
          },
        },
        event: {
          select: {
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),

    prisma.order.findMany({
      where: {
        event: {
          organizerId:
            cleanOrganizerId,
        },
        status: "PAID",
        paidAt: {
          not: null,
        },
      },
      select: {
        currency: true,
        subtotal: true,
        platformFee: true,
      },
    }),

    prisma.payout.findMany({
      where: {
        organizerId:
          cleanOrganizerId,
        status: {
          in: [
            ...RESERVED_PAYOUT_STATUSES,
          ],
        },
      },
      select: {
        currency: true,
        netAmount: true,
      },
    }),

    prisma.ticket.findMany({
      where: soldTicketBaseWhere,
      select: {
        event: {
          select: {
            currency: true,
          },
        },
      },
    }),
  ]);

  if (!organizer) {
    throw new Error(
      "Le compte organisateur est introuvable ou n’est pas actif.",
    );
  }

  const eventIds = allOrganizerEvents.map((event) => event.id);
  const recentEventIds = recentEvents.map((event) => event.id);

  const [
    ticketCountsByEvent,
    recentEventTicketCounts,
    recentEventRevenue,
    lifetimeRevenue,
  ] = await Promise.all([
    eventIds.length > 0
      ? prisma.ticket.groupBy({
          by: ["eventId"],
          where: {
            eventId: {
              in: eventIds,
            },
            order: {
              status: "PAID",
            },
            status: {
              in: [...SOLD_TICKET_STATUSES],
            },
          },
          _count: {
            id: true,
          },
        })
      : Promise.resolve([]),

    recentEventIds.length > 0
      ? prisma.ticket.groupBy({
          by: ["eventId"],
          where: {
            eventId: {
              in: recentEventIds,
            },
            order: {
              status: "PAID",
            },
            status: {
              in: [...SOLD_TICKET_STATUSES],
            },
          },
          _count: {
            id: true,
          },
        })
      : Promise.resolve([]),

    recentEventIds.length > 0
      ? prisma.order.groupBy({
          by: ["eventId"],
          where: {
            eventId: {
              in: recentEventIds,
            },
            status: "PAID",
          },
          _count: {
            id: true,
          },
          _sum: {
            subtotal: true,
            platformFee: true,
          },
        })
      : Promise.resolve([]),

    prisma.order.aggregate({
      where: paidOrderBaseWhere,
      _sum: {
        subtotal: true,
        platformFee: true,
      },
    }),
  ]);

  const lifetimeGrossRevenue = decimalToNumber(
    lifetimeRevenue._sum.subtotal,
  );

  const lifetimePlatformFees = decimalToNumber(
    lifetimeRevenue._sum.platformFee,
  );

  const lifetimeNetRevenue =
    lifetimeGrossRevenue - lifetimePlatformFees;

  const reservedPayoutAmount = decimalToNumber(
    reservedPayouts._sum.netAmount,
  );

  const availableBalance = Math.max(
    lifetimeNetRevenue - reservedPayoutAmount,
    0,
  );

  const currentGrossRevenue = decimalToNumber(
    currentRevenue._sum.subtotal,
  );

  const currentPlatformFees = decimalToNumber(
    currentRevenue._sum.platformFee,
  );

  const currentNetRevenue =
    currentGrossRevenue - currentPlatformFees;

  const previousGrossRevenue = decimalToNumber(
    previousRevenue._sum.subtotal,
  );

  const previousPlatformFees = decimalToNumber(
    previousRevenue._sum.platformFee,
  );

  const previousNetRevenue =
    previousGrossRevenue - previousPlatformFees;

  const ticketCountMap = new Map(
    ticketCountsByEvent.map((item) => [
      item.eventId,
      item._count.id,
    ]),
  );

  const remainingPlaces = allOrganizerEvents.reduce(
    (total, event) => {
      const ticketTypeQuantity = event.ticketTypes.reduce(
        (sum, ticketType) => sum + ticketType.quantity,
        0,
      );

      const sold = ticketCountMap.get(event.id) ?? 0;

      return (
        total +
        calculateRemainingPlaces(
          event.capacity,
          ticketTypeQuantity,
          sold,
        )
      );
    },
    0,
  );

  const chartMap = new Map<string, DashboardSalesPoint>();

  for (let index = 0; index < selectedPeriodDays; index += 1) {
    const date = addDays(currentPeriodStart, index);
    const key = getDateKey(date, selectedTimeZone);

    chartMap.set(key, {
      date: key,
      grossRevenue: 0,
      netRevenue: 0,
      platformFees: 0,
      ticketsSold: 0,
      paidOrders: 0,
    });
  }

  for (const order of currentPeriodOrders) {
    if (!order.paidAt) {
      continue;
    }

    const key = getDateKey(order.paidAt, selectedTimeZone);
    const point = chartMap.get(key);

    if (!point) {
      continue;
    }

    const grossRevenue = decimalToNumber(order.subtotal);
    const platformFees = decimalToNumber(order.platformFee);

    point.grossRevenue += grossRevenue;
    point.platformFees += platformFees;
    point.netRevenue += grossRevenue - platformFees;
    point.paidOrders += 1;
  }

  for (const ticket of currentPeriodTickets) {
    const key = getDateKey(ticket.createdAt, selectedTimeZone);
    const point = chartMap.get(key);

    if (point) {
      point.ticketsSold += 1;
    }
  }

  const salesChart = Array.from(chartMap.values()).map((point) => ({
    ...point,
    grossRevenue: normalizeMoney(point.grossRevenue, selectedCurrency),
    platformFees: normalizeMoney(point.platformFees, selectedCurrency),
    netRevenue: normalizeMoney(point.netRevenue, selectedCurrency),
  }));

  const categoryMap = new Map<
    string,
    Omit<DashboardCategoryItem, "percentage">
  >();

  for (const order of categoryOrders) {
    const category = order.event.category;
    const key = category?.id ?? "uncategorized";

    const currentCategory = categoryMap.get(key) ?? {
      categoryId: category?.id ?? null,
      categoryName: category?.name ?? "Sans catégorie",
      grossRevenue: 0,
      netRevenue: 0,
      ticketsSold: 0,
    };

    const grossRevenue = decimalToNumber(order.subtotal);
    const platformFees = decimalToNumber(order.platformFee);
    const ticketsSold = order.items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    currentCategory.grossRevenue += grossRevenue;
    currentCategory.netRevenue += grossRevenue - platformFees;
    currentCategory.ticketsSold += ticketsSold;

    categoryMap.set(key, currentCategory);
  }

  const categoryGrossTotal = Array.from(categoryMap.values()).reduce(
    (sum, category) => sum + category.grossRevenue,
    0,
  );

  const revenueByCategory = Array.from(categoryMap.values())
    .map((category) => ({
      ...category,
      grossRevenue: normalizeMoney(category.grossRevenue, selectedCurrency),
      netRevenue: normalizeMoney(category.netRevenue, selectedCurrency),
      percentage:
        categoryGrossTotal > 0
          ? Math.round(
              (((category.grossRevenue /
                categoryGrossTotal) *
                100 +
                Number.EPSILON) *
                100),
            ) / 100
          : 0,
    }))
    .sort((a, b) => b.grossRevenue - a.grossRevenue);

  const recentTicketCountMap = new Map(
    recentEventTicketCounts.map((item) => [
      item.eventId,
      item._count.id,
    ]),
  );

  const recentRevenueMap = new Map(
    recentEventRevenue.map((item) => [
      item.eventId,
      {
        paidOrders: item._count.id,
        grossRevenue: decimalToNumber(item._sum.subtotal),
        platformFees: decimalToNumber(item._sum.platformFee),
      },
    ]),
  );

  const dashboardRecentEvents: DashboardRecentEvent[] =
    recentEvents.map((event) => {
      const ticketsSoldForEvent =
        recentTicketCountMap.get(event.id) ?? 0;

      const ticketTypeQuantity = event.ticketTypes.reduce(
        (sum, ticketType) => sum + ticketType.quantity,
        0,
      );

      const revenue = recentRevenueMap.get(event.id) ?? {
        paidOrders: 0,
        grossRevenue: 0,
        platformFees: 0,
      };

      return {
        id: event.id,
        title: event.title,
        slug: event.slug,
        coverImage: event.coverImage,
        venueName: event.venueName,
        city: event.city,
        country: event.country,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt?.toISOString() ?? null,
        status: event.status,
        currency:
          toSupportedCurrency(
            event.currency,
          ) ??
          DEFAULT_CURRENCY,
        capacity:
          ticketTypeQuantity > 0
            ? ticketTypeQuantity
            : event.capacity,
        ticketsSold: ticketsSoldForEvent,
        remainingPlaces: calculateRemainingPlaces(
          event.capacity,
          ticketTypeQuantity,
          ticketsSoldForEvent,
        ),
        grossRevenue: normalizeMoney(revenue.grossRevenue, event.currency),
        platformFees: normalizeMoney(revenue.platformFees, event.currency),
        netRevenue: normalizeMoney(
          revenue.grossRevenue - revenue.platformFees,
          event.currency,
        ),
        paidOrders: revenue.paidOrders,
      };
    });

  const currencySummaryMap =
    new Map<
      SupportedCurrencyCode,
      DashboardCurrencySummary
    >();

  function ensureCurrencySummary(
    currencyCode: SupportedCurrencyCode,
  ): DashboardCurrencySummary {
    const existing =
      currencySummaryMap.get(
        currencyCode,
      );

    if (existing) {
      return existing;
    }

    const created: DashboardCurrencySummary = {
      currency:
        currencyCode,
      grossRevenue:
        0,
      platformFees:
        0,
      netRevenue:
        0,
      reservedPayouts:
        0,
      availableBalance:
        0,
      paidOrders:
        0,
      ticketsSold:
        0,
    };

    currencySummaryMap.set(
      currencyCode,
      created,
    );

    return created;
  }

  for (
    const order of
    allPaidOrdersByCurrency
  ) {
    const orderCurrency =
      toSupportedCurrency(
        order.currency,
      );

    if (!orderCurrency) {
      continue;
    }

    const summary =
      ensureCurrencySummary(
        orderCurrency,
      );

    const grossRevenue =
      decimalToNumber(
        order.subtotal,
      );

    const platformFees =
      decimalToNumber(
        order.platformFee,
      );

    summary.grossRevenue +=
      grossRevenue;

    summary.platformFees +=
      platformFees;

    summary.netRevenue +=
      grossRevenue -
      platformFees;

    summary.paidOrders +=
      1;
  }

  for (
    const payout of
    allReservedPayoutsByCurrency
  ) {
    const payoutCurrency =
      toSupportedCurrency(
        payout.currency,
      );

    if (!payoutCurrency) {
      continue;
    }

    const summary =
      ensureCurrencySummary(
        payoutCurrency,
      );

    summary.reservedPayouts +=
      decimalToNumber(
        payout.netAmount,
      );
  }

  for (
    const ticket of
    allSoldTicketsForCurrencyBreakdown
  ) {
    const ticketCurrency =
      toSupportedCurrency(
        ticket.event.currency,
      );

    if (!ticketCurrency) {
      continue;
    }

    const summary =
      ensureCurrencySummary(
        ticketCurrency,
      );

    summary.ticketsSold +=
      1;
  }

  if (
    !currencySummaryMap.has(
      selectedCurrency,
    )
  ) {
    ensureCurrencySummary(
      selectedCurrency,
    );
  }

  const revenueByCurrency =
    Array.from(
      currencySummaryMap.values(),
    )
      .map(
        (summary) => {
          const available =
            Math.max(
              summary.netRevenue -
                summary.reservedPayouts,
              0,
            );

          return {
            ...summary,

            grossRevenue:
              normalizeMoney(
                summary.grossRevenue,
                summary.currency,
              ),

            platformFees:
              normalizeMoney(
                summary.platformFees,
                summary.currency,
              ),

            netRevenue:
              normalizeMoney(
                summary.netRevenue,
                summary.currency,
              ),

            reservedPayouts:
              normalizeMoney(
                summary.reservedPayouts,
                summary.currency,
              ),

            availableBalance:
              normalizeMoney(
                available,
                summary.currency,
              ),
          };
        },
      )
      .sort(
        (first, second) => {
          if (
            first.currency ===
            selectedCurrency
          ) {
            return -1;
          }

          if (
            second.currency ===
            selectedCurrency
          ) {
            return 1;
          }

          return first.currency.localeCompare(
            second.currency,
          );
        },
      );

  const currencyOptions =
    revenueByCurrency.map(
      (summary) =>
        buildCurrencyOption(
          summary.currency,
        ),
    );

  return {
    generatedAt: now.toISOString(),

    period: {
      days: selectedPeriodDays,
      start: currentPeriodStart.toISOString(),
      end: currentPeriodEnd.toISOString(),
      previousStart: previousPeriodStart.toISOString(),
      previousEnd: previousPeriodEnd.toISOString(),
      timeZone: selectedTimeZone,
    },

    currency:
      selectedCurrency,

    currencyOptions,

    revenueByCurrency,

    summary: {
      grossRevenue: normalizeMoney(lifetimeGrossRevenue, selectedCurrency),
      platformFees: normalizeMoney(lifetimePlatformFees, selectedCurrency),
      netRevenue: normalizeMoney(lifetimeNetRevenue, selectedCurrency),
      availableBalance: normalizeMoney(availableBalance, selectedCurrency),
      reservedPayouts: normalizeMoney(reservedPayoutAmount, selectedCurrency),
      ticketsSold: totalTicketsSold,
      remainingPlaces,
      activeEvents,
      totalEvents,
      participants: participants.length,
      paidOrders: currentPaidOrders,
    },

    trends: {
      grossRevenue: createTrend(
        currentGrossRevenue,
        previousGrossRevenue,
        selectedCurrency,
      ),

      netRevenue: createTrend(
        currentNetRevenue,
        previousNetRevenue,
        selectedCurrency,
      ),

      ticketsSold: createTrend(
        currentTicketsSold,
        previousTicketsSold,
      ),

      paidOrders: createTrend(
        currentPaidOrders,
        previousPaidOrders,
      ),
    },

    salesChart,
    revenueByCategory,
    recentEvents: dashboardRecentEvents,

    recentActivities: recentActivities.map(
      (activity) => {
        const activityCurrency =
          toSupportedCurrency(
            activity.currency,
          );

        return {
          id:
            activity.id,

          type:
            activity.type,

          title:
            activity.title,

          description:
            activity.description,

          amount:
            activity.amount === null
              ? null
              : normalizeMoney(
                  decimalToNumber(
                    activity.amount,
                  ),
                  activityCurrency ??
                    selectedCurrency,
                ),

          currency:
            activityCurrency,

          createdAt:
            activity.createdAt.toISOString(),

          event:
            activity.event,
        };
      },
    ),
  };
}