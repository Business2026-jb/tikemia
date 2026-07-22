import "server-only";

import {
  EventStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  TicketStatus,
  type OrganizerActivityType,
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
const MAX_PERIOD_DAYS = 365;
const DEFAULT_TIMEZONE = "Africa/Porto-Novo";
const MAX_EVENT_ROWS = 100;
const TOP_ITEMS_LIMIT = 10;
const RECENT_ACTIVITIES_LIMIT = 12;

const SOLD_TICKET_STATUSES = [
  TicketStatus.VALID,
  TicketStatus.USED,
] as const;

export const ORGANIZER_STATISTICS_PERIODS = [
  7,
  30,
  90,
  180,
  365,
] as const;

export type OrganizerStatisticsPeriod =
  (typeof ORGANIZER_STATISTICS_PERIODS)[number];

export type GetOrganizerStatisticsParams = {
  organizerId: string;
  currency?: string | null;
  periodDays?: number | null;
  timeZone?: string | null;
  eventId?: string | null;
  dateFrom?: string | Date | null;
  dateTo?: string | Date | null;
};

export type StatisticsTrend = {
  current: number;
  previous: number;
  percentage: number | null;
  direction: "up" | "down" | "stable";
};

export type StatisticsCurrencyOption = {
  code: SupportedCurrencyCode;
  name: string;
  symbol: string;
  fractionDigits: number;
};

export type StatisticsSummary = {
  grossRevenue: number;
  platformFees: number;
  netRevenue: number;
  refundedRevenue: number;
  paidOrders: number;
  pendingOrders: number;
  failedOrders: number;
  cancelledOrders: number;
  refundedOrders: number;
  ticketsSold: number;
  validTickets: number;
  usedTickets: number;
  cancelledTickets: number;
  refundedTickets: number;
  participants: number;
  checkedInParticipants: number;
  expectedParticipants: number;
  attendanceRate: number;
  averageOrderValue: number;
  averageTicketPrice: number;
  activeEvents: number;
  totalEvents: number;
  remainingPlaces: number;
};

export type StatisticsTrends = {
  grossRevenue: StatisticsTrend;
  netRevenue: StatisticsTrend;
  paidOrders: StatisticsTrend;
  ticketsSold: StatisticsTrend;
  participants: StatisticsTrend;
  attendanceRate: StatisticsTrend;
};

export type StatisticsSalesPoint = {
  date: string;
  grossRevenue: number;
  platformFees: number;
  netRevenue: number;
  ticketsSold: number;
  paidOrders: number;
  participants: number;
  checkedInParticipants: number;
};

export type StatisticsRevenueBreakdown = {
  grossRevenue: number;
  platformFees: number;
  refundedRevenue: number;
  netRevenue: number;
  feeRate: number;
};

export type StatisticsEventPerformance = {
  id: string;
  title: string;
  slug: string;
  coverImage: string | null;
  categoryName: string;
  status: EventStatus;
  currency: SupportedCurrencyCode;
  startsAt: string;
  endsAt: string | null;
  venueName: string;
  city: string;
  country: string;
  capacity: number;
  ticketsSold: number;
  remainingPlaces: number;
  occupancyRate: number;
  grossRevenue: number;
  platformFees: number;
  netRevenue: number;
  paidOrders: number;
  averageOrderValue: number;
  participants: number;
  checkedInParticipants: number;
  attendanceRate: number;
};

export type StatisticsDistributionItem = {
  key: string;
  label: string;
  count: number;
  ticketsSold: number;
  grossRevenue: number;
  netRevenue: number;
  percentage: number;
};

export type StatisticsPaymentMethodItem = {
  key: string;
  method: string;
  provider: string;
  payments: number;
  successfulPayments: number;
  failedPayments: number;
  refundedPayments: number;
  amount: number;
  percentage: number;
};

export type StatisticsOrderStatusItem = {
  status: OrderStatus;
  count: number;
  percentage: number;
};

export type StatisticsTicketStatusItem = {
  status: TicketStatus;
  count: number;
  percentage: number;
};

export type StatisticsTopPerformers = {
  bestRevenueEvent: StatisticsEventPerformance | null;
  mostAttendedEvent: StatisticsEventPerformance | null;
  bestSellingTicketType: {
    id: string;
    name: string;
    eventId: string;
    eventTitle: string;
    quantity: number;
    grossRevenue: number;
  } | null;
  bestSalesDay: StatisticsSalesPoint | null;
  topCountry: StatisticsDistributionItem | null;
  topCity: StatisticsDistributionItem | null;
  topPaymentMethod: StatisticsPaymentMethodItem | null;
};

export type StatisticsActivity = {
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

export type OrganizerStatisticsData = {
  generatedAt: string;
  period: {
    days: number;
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
    timeZone: string;
    custom: boolean;
  };
  filters: {
    eventId: string | null;
    currency: SupportedCurrencyCode;
  };
  currency: SupportedCurrencyCode;
  currencyOptions: StatisticsCurrencyOption[];
  events: Array<{
    id: string;
    title: string;
    startsAt: string;
    status: EventStatus;
    currency: SupportedCurrencyCode;
  }>;
  summary: StatisticsSummary;
  trends: StatisticsTrends;
  salesChart: StatisticsSalesPoint[];
  revenueBreakdown: StatisticsRevenueBreakdown;
  eventPerformance: StatisticsEventPerformance[];
  revenueByCategory: StatisticsDistributionItem[];
  revenueByCountry: StatisticsDistributionItem[];
  revenueByCity: StatisticsDistributionItem[];
  revenueByCurrency: StatisticsDistributionItem[];
  salesByTicketType: StatisticsDistributionItem[];
  paymentMethods: StatisticsPaymentMethodItem[];
  orderStatuses: StatisticsOrderStatusItem[];
  ticketStatuses: StatisticsTicketStatusItem[];
  topPerformers: StatisticsTopPerformers;
  recentActivities: StatisticsActivity[];
};

export class GetOrganizerStatisticsError extends Error {
  readonly code: string;
  readonly status: number;

  constructor({
    code,
    message,
    status = 500,
  }: {
    code: string;
    message: string;
    status?: number;
  }) {
    super(message);
    this.name = "GetOrganizerStatisticsError";
    this.code = code;
    this.status = status;
  }
}

function decimalToNumber(
  value:
    | Prisma.Decimal
    | number
    | string
    | null
    | undefined,
): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(value.toString());

  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeMoney(
  value: number,
  currency: string,
): number {
  return roundMoneyAmount({
    amount: value,
    currency,
  });
}

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeCurrency(
  value: string | null | undefined,
): SupportedCurrencyCode {
  const normalized = normalizeText(value).toUpperCase();

  if (
    isSupportedCurrencyCode(normalized) &&
    getCurrencyDefinition(normalized)?.active
  ) {
    return normalized;
  }

  return DEFAULT_CURRENCY_CODE;
}

function normalizeTimeZone(
  value: string | null | undefined,
): string {
  const normalized = normalizeText(value) || DEFAULT_TIMEZONE;

  try {
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: normalized,
    }).format(new Date());

    return normalized;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function normalizePeriodDays(
  value: number | null | undefined,
): number {
  if (!Number.isInteger(value)) {
    return DEFAULT_PERIOD_DAYS;
  }

  return Math.min(
    Math.max(value ?? DEFAULT_PERIOD_DAYS, 1),
    MAX_PERIOD_DAYS,
  );
}

function parseDate(
  value: string | Date | null | undefined,
  endOfDay = false,
): Date | null {
  if (!value) {
    return null;
  }

  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (
    endOfDay &&
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
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

function getDateKey(
  date: Date,
  timeZone: string,
): string {
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

function createTrend(
  current: number,
  previous: number,
  currency?: string,
): StatisticsTrend {
  const normalizedCurrent = currency
    ? normalizeMoney(current, currency)
    : current;

  const normalizedPrevious = currency
    ? normalizeMoney(previous, currency)
    : previous;

  let percentage: number | null = null;

  if (normalizedPrevious !== 0) {
    percentage =
      Math.round(
        (((normalizedCurrent - normalizedPrevious) /
          Math.abs(normalizedPrevious)) *
          100 +
          Number.EPSILON) *
          100,
      ) / 100;
  } else if (normalizedCurrent === 0) {
    percentage = 0;
  }

  return {
    current: normalizedCurrent,
    previous: normalizedPrevious,
    percentage,
    direction:
      normalizedCurrent > normalizedPrevious
        ? "up"
        : normalizedCurrent < normalizedPrevious
          ? "down"
          : "stable",
  };
}

function percentage(value: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return (
    Math.round(
      ((value / total) * 100 + Number.EPSILON) * 100,
    ) / 100
  );
}

function buildCurrencyOption(
  code: SupportedCurrencyCode,
): StatisticsCurrencyOption {
  const definition = getCurrencyDefinition(code);

  return {
    code,
    name: definition?.name ?? code,
    symbol: definition?.symbol ?? code,
    fractionDigits:
      definition?.decimals ??
      getCurrencyDecimals(code),
  };
}

function getCapacity({
  eventCapacity,
  ticketTypes,
}: {
  eventCapacity: number;
  ticketTypes: Array<{ quantity: number }>;
}): number {
  const ticketTypeCapacity = ticketTypes.reduce(
    (sum, ticketType) => sum + ticketType.quantity,
    0,
  );

  return ticketTypeCapacity > 0
    ? ticketTypeCapacity
    : Math.max(eventCapacity, 0);
}

function buildPeriod({
  periodDays,
  dateFrom,
  dateTo,
}: {
  periodDays: number;
  dateFrom: Date | null;
  dateTo: Date | null;
}) {
  const now = new Date();

  if (dateFrom || dateTo) {
    const end = dateTo ?? now;
    const start =
      dateFrom ??
      startOfUtcDay(
        addDays(end, -(periodDays - 1)),
      );

    const spanMs = Math.max(
      end.getTime() - start.getTime(),
      0,
    );

    const days = Math.max(
      Math.ceil(spanMs / 86_400_000) + 1,
      1,
    );

    const previousEnd = new Date(start.getTime() - 1);
    const previousStart = new Date(
      previousEnd.getTime() -
        days * 86_400_000 +
        1,
    );

    return {
      days,
      start,
      end,
      previousStart,
      previousEnd,
      custom: true,
    };
  }

  const end = now;
  const start = startOfUtcDay(
    addDays(now, -(periodDays - 1)),
  );

  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = startOfUtcDay(
    addDays(start, -periodDays),
  );

  return {
    days: periodDays,
    start,
    end,
    previousStart,
    previousEnd,
    custom: false,
  };
}

export async function getOrganizerStatistics({
  organizerId,
  currency,
  periodDays,
  timeZone,
  eventId,
  dateFrom,
  dateTo,
}: GetOrganizerStatisticsParams): Promise<OrganizerStatisticsData> {
  const cleanOrganizerId = organizerId.trim();

  if (!cleanOrganizerId) {
    throw new GetOrganizerStatisticsError({
      code: "ORGANIZER_ID_REQUIRED",
      status: 400,
      message:
        "L’identifiant de l’organisateur est obligatoire.",
    });
  }

  const selectedCurrency = normalizeCurrency(currency);
  const selectedTimeZone = normalizeTimeZone(timeZone);
  const selectedPeriodDays = normalizePeriodDays(periodDays);
  const selectedEventId = normalizeText(eventId) || null;
  const normalizedDateFrom = parseDate(dateFrom);
  const normalizedDateTo = parseDate(dateTo, true);

  if (
    normalizedDateFrom &&
    normalizedDateTo &&
    normalizedDateFrom.getTime() >
      normalizedDateTo.getTime()
  ) {
    throw new GetOrganizerStatisticsError({
      code: "INVALID_DATE_RANGE",
      status: 422,
      message:
        "La date de début ne peut pas être postérieure à la date de fin.",
    });
  }

  const period = buildPeriod({
    periodDays: selectedPeriodDays,
    dateFrom: normalizedDateFrom,
    dateTo: normalizedDateTo,
  });

  try {
    const organizer = await prisma.user.findFirst({
      where: {
        id: cleanOrganizerId,
        role: "ORGANIZER",
      },
      select: {
        id: true,
        isActive: true,
        emailVerified: true,
      },
    });

    if (!organizer) {
      throw new GetOrganizerStatisticsError({
        code: "ORGANIZER_NOT_FOUND",
        status: 404,
        message:
          "Le compte organisateur est introuvable.",
      });
    }

    if (!organizer.isActive || !organizer.emailVerified) {
      throw new GetOrganizerStatisticsError({
        code: "ORGANIZER_FORBIDDEN",
        status: 403,
        message:
          "Ce compte organisateur ne peut pas consulter les statistiques.",
      });
    }

    if (selectedEventId) {
      const ownedEvent = await prisma.event.findFirst({
        where: {
          id: selectedEventId,
          organizerId: cleanOrganizerId,
        },
        select: {
          id: true,
        },
      });

      if (!ownedEvent) {
        throw new GetOrganizerStatisticsError({
          code: "EVENT_NOT_FOUND",
          status: 404,
          message:
            "L’événement sélectionné est introuvable.",
        });
      }
    }

    const eventWhere: Prisma.EventWhereInput = {
      organizerId: cleanOrganizerId,
      ...(selectedEventId ? { id: selectedEventId } : {}),
    };

    const orderBaseWhere: Prisma.OrderWhereInput = {
      event: eventWhere,
      currency: selectedCurrency,
    };

    const currentOrderWhere: Prisma.OrderWhereInput = {
      ...orderBaseWhere,
      createdAt: {
        gte: period.start,
        lte: period.end,
      },
    };

    const previousOrderWhere: Prisma.OrderWhereInput = {
      ...orderBaseWhere,
      createdAt: {
        gte: period.previousStart,
        lte: period.previousEnd,
      },
    };

    const ticketBaseWhere: Prisma.TicketWhereInput = {
      event: eventWhere,
      order: {
        currency: selectedCurrency,
      },
    };

    const currentTicketWhere: Prisma.TicketWhereInput = {
      ...ticketBaseWhere,
      createdAt: {
        gte: period.start,
        lte: period.end,
      },
    };

    const previousTicketWhere: Prisma.TicketWhereInput = {
      ...ticketBaseWhere,
      createdAt: {
        gte: period.previousStart,
        lte: period.previousEnd,
      },
    };

    const [
      allEvents,
      currentOrders,
      previousOrders,
      currentTickets,
      previousTickets,
      currentPayments,
      eventLifetimeOrders,
      eventLifetimeTickets,
      currencySource,
      recentActivities,
    ] = await Promise.all([
      prisma.event.findMany({
        where: eventWhere,
        orderBy: [
          { startsAt: "desc" },
          { createdAt: "desc" },
        ],
        take: MAX_EVENT_ROWS,
        select: {
          id: true,
          title: true,
          slug: true,
          coverImage: true,
          venueName: true,
          city: true,
          country: true,
          countryCode: true,
          timezone: true,
          startsAt: true,
          endsAt: true,
          currency: true,
          capacity: true,
          status: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          ticketTypes: {
            select: {
              id: true,
              name: true,
              price: true,
              quantity: true,
            },
          },
        },
      }),

      prisma.order.findMany({
        where: currentOrderWhere,
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          reference: true,
          eventId: true,
          customerId: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          currency: true,
          subtotal: true,
          platformFee: true,
          total: true,
          status: true,
          paidAt: true,
          createdAt: true,
          event: {
            select: {
              id: true,
              title: true,
              city: true,
              country: true,
              currency: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          items: {
            select: {
              ticketTypeId: true,
              quantity: true,
              unitPrice: true,
              subtotal: true,
              platformFee: true,
              total: true,
              ticketType: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),

      prisma.order.findMany({
        where: previousOrderWhere,
        select: {
          id: true,
          customerEmail: true,
          subtotal: true,
          platformFee: true,
          status: true,
          paidAt: true,
          createdAt: true,
        },
      }),

      prisma.ticket.findMany({
        where: currentTicketWhere,
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          eventId: true,
          ticketTypeId: true,
          holderEmail: true,
          status: true,
          usedAt: true,
          createdAt: true,
          event: {
            select: {
              id: true,
              title: true,
              city: true,
              country: true,
              currency: true,
            },
          },
          ticketType: {
            select: {
              id: true,
              name: true,
            },
          },
          order: {
            select: {
              id: true,
              status: true,
              currency: true,
            },
          },
        },
      }),

      prisma.ticket.findMany({
        where: previousTicketWhere,
        select: {
          holderEmail: true,
          status: true,
          usedAt: true,
          createdAt: true,
        },
      }),

      prisma.payment.findMany({
        where: {
          order: currentOrderWhere,
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          provider: true,
          method: true,
          amount: true,
          currency: true,
          status: true,
          paidAt: true,
          createdAt: true,
          order: {
            select: {
              id: true,
              eventId: true,
            },
          },
        },
      }),

      prisma.order.findMany({
        where: {
          ...orderBaseWhere,
          status: OrderStatus.PAID,
        },
        select: {
          id: true,
          eventId: true,
          subtotal: true,
          platformFee: true,
          total: true,
          customerEmail: true,
          items: {
            select: {
              ticketTypeId: true,
              quantity: true,
              subtotal: true,
              platformFee: true,
              ticketType: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),

      prisma.ticket.findMany({
        where: {
          event: eventWhere,
          order: {
            status: OrderStatus.PAID,
            currency: selectedCurrency,
          },
        },
        select: {
          id: true,
          eventId: true,
          ticketTypeId: true,
          holderEmail: true,
          status: true,
          usedAt: true,
        },
      }),

      prisma.order.findMany({
        where: {
          event: eventWhere,
        },
        distinct: ["currency"],
        select: {
          currency: true,
        },
      }),

      prisma.organizerActivity.findMany({
        where: {
          organizerId: cleanOrganizerId,
          ...(selectedEventId ? { eventId: selectedEventId } : {}),
          createdAt: {
            gte: period.start,
            lte: period.end,
          },
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
    ]);

    const paidCurrentOrders = currentOrders.filter(
      (order) => order.status === OrderStatus.PAID,
    );

    const paidPreviousOrders = previousOrders.filter(
      (order) => order.status === OrderStatus.PAID,
    );

    const soldCurrentTickets = currentTickets.filter(
      (ticket) =>
        ticket.order.status === OrderStatus.PAID &&
        SOLD_TICKET_STATUSES.includes(
          ticket.status as (typeof SOLD_TICKET_STATUSES)[number],
        ),
    );

    const soldPreviousTickets = previousTickets.filter(
      (ticket) =>
        SOLD_TICKET_STATUSES.includes(
          ticket.status as (typeof SOLD_TICKET_STATUSES)[number],
        ),
    );

    const currentGrossRevenue = paidCurrentOrders.reduce(
      (sum, order) => sum + decimalToNumber(order.subtotal),
      0,
    );

    const currentPlatformFees = paidCurrentOrders.reduce(
      (sum, order) => sum + decimalToNumber(order.platformFee),
      0,
    );

    const currentNetRevenue =
      currentGrossRevenue - currentPlatformFees;

    const previousGrossRevenue = paidPreviousOrders.reduce(
      (sum, order) => sum + decimalToNumber(order.subtotal),
      0,
    );

    const previousPlatformFees = paidPreviousOrders.reduce(
      (sum, order) => sum + decimalToNumber(order.platformFee),
      0,
    );

    const previousNetRevenue =
      previousGrossRevenue - previousPlatformFees;

    const refundedRevenue = currentPayments
      .filter(
        (payment) =>
          payment.status === PaymentStatus.REFUNDED,
      )
      .reduce(
        (sum, payment) =>
          sum + decimalToNumber(payment.amount),
        0,
      );

    const currentParticipantEmails = new Set(
      soldCurrentTickets
        .map((ticket) =>
          ticket.holderEmail.trim().toLowerCase(),
        )
        .filter(Boolean),
    );

    const previousParticipantEmails = new Set(
      soldPreviousTickets
        .map((ticket) =>
          ticket.holderEmail.trim().toLowerCase(),
        )
        .filter(Boolean),
    );

    const currentUsedTickets = currentTickets.filter(
      (ticket) =>
        ticket.status === TicketStatus.USED ||
        ticket.usedAt !== null,
    ).length;

    const currentExpectedTickets = currentTickets.filter(
      (ticket) =>
        ticket.status === TicketStatus.VALID &&
        ticket.usedAt === null,
    ).length;

    const previousUsedTickets = previousTickets.filter(
      (ticket) =>
        ticket.status === TicketStatus.USED ||
        ticket.usedAt !== null,
    ).length;

    const previousExpectedTickets = previousTickets.filter(
      (ticket) =>
        ticket.status === TicketStatus.VALID &&
        ticket.usedAt === null,
    ).length;

    const currentAttendanceRate = percentage(
      currentUsedTickets,
      currentUsedTickets + currentExpectedTickets,
    );

    const previousAttendanceRate = percentage(
      previousUsedTickets,
      previousUsedTickets + previousExpectedTickets,
    );

    const lifetimeOrderMap = new Map<
      string,
      {
        paidOrders: number;
        grossRevenue: number;
        platformFees: number;
      }
    >();

    for (const order of eventLifetimeOrders) {
      const current =
        lifetimeOrderMap.get(order.eventId) ?? {
          paidOrders: 0,
          grossRevenue: 0,
          platformFees: 0,
        };

      current.paidOrders += 1;
      current.grossRevenue += decimalToNumber(order.subtotal);
      current.platformFees += decimalToNumber(order.platformFee);
      lifetimeOrderMap.set(order.eventId, current);
    }

    const lifetimeTicketMap = new Map<
      string,
      {
        sold: number;
        valid: number;
        used: number;
        participantEmails: Set<string>;
      }
    >();

    for (const ticket of eventLifetimeTickets) {
      const current =
        lifetimeTicketMap.get(ticket.eventId) ?? {
          sold: 0,
          valid: 0,
          used: 0,
          participantEmails: new Set<string>(),
        };

      if (
        ticket.status === TicketStatus.VALID ||
        ticket.status === TicketStatus.USED
      ) {
        current.sold += 1;
      }

      if (ticket.status === TicketStatus.VALID) {
        current.valid += 1;
      } else if (ticket.status === TicketStatus.USED) {
        current.used += 1;
      }

      const email = ticket.holderEmail.trim().toLowerCase();

      if (email) {
        current.participantEmails.add(email);
      }

      lifetimeTicketMap.set(ticket.eventId, current);
    }

    const eventPerformance: StatisticsEventPerformance[] =
      allEvents.map((event) => {
        const orderStats =
          lifetimeOrderMap.get(event.id) ?? {
            paidOrders: 0,
            grossRevenue: 0,
            platformFees: 0,
          };

        const ticketStats =
          lifetimeTicketMap.get(event.id) ?? {
            sold: 0,
            valid: 0,
            used: 0,
            participantEmails: new Set<string>(),
          };

        const capacity = getCapacity({
          eventCapacity: event.capacity,
          ticketTypes: event.ticketTypes,
        });

        return {
          id: event.id,
          title: event.title,
          slug: event.slug,
          coverImage: event.coverImage,
          categoryName:
            event.category?.name ?? "Sans catégorie",
          status: event.status,
          currency: normalizeCurrency(event.currency),
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt?.toISOString() ?? null,
          venueName: event.venueName,
          city: event.city,
          country: event.country,
          capacity,
          ticketsSold: ticketStats.sold,
          remainingPlaces: Math.max(
            capacity - ticketStats.sold,
            0,
          ),
          occupancyRate: percentage(
            ticketStats.sold,
            capacity,
          ),
          grossRevenue: normalizeMoney(
            orderStats.grossRevenue,
            event.currency,
          ),
          platformFees: normalizeMoney(
            orderStats.platformFees,
            event.currency,
          ),
          netRevenue: normalizeMoney(
            orderStats.grossRevenue -
              orderStats.platformFees,
            event.currency,
          ),
          paidOrders: orderStats.paidOrders,
          averageOrderValue:
            orderStats.paidOrders > 0
              ? normalizeMoney(
                  orderStats.grossRevenue /
                    orderStats.paidOrders,
                  event.currency,
                )
              : 0,
          participants: ticketStats.participantEmails.size,
          checkedInParticipants: ticketStats.used,
          attendanceRate: percentage(
            ticketStats.used,
            ticketStats.used + ticketStats.valid,
          ),
        };
      });

    const totalCapacity = eventPerformance.reduce(
      (sum, event) => sum + event.capacity,
      0,
    );

    const lifetimeTicketsSold = eventPerformance.reduce(
      (sum, event) => sum + event.ticketsSold,
      0,
    );

    const chartMap = new Map<string, StatisticsSalesPoint>();

    for (let index = 0; index < period.days; index += 1) {
      const date = addDays(period.start, index);
      const key = getDateKey(date, selectedTimeZone);

      chartMap.set(key, {
        date: key,
        grossRevenue: 0,
        platformFees: 0,
        netRevenue: 0,
        ticketsSold: 0,
        paidOrders: 0,
        participants: 0,
        checkedInParticipants: 0,
      });
    }

    const dailyParticipantSets = new Map<string, Set<string>>();

    for (const order of paidCurrentOrders) {
      const key = getDateKey(
        order.paidAt ?? order.createdAt,
        selectedTimeZone,
      );

      const point = chartMap.get(key);

      if (!point) {
        continue;
      }

      const gross = decimalToNumber(order.subtotal);
      const fee = decimalToNumber(order.platformFee);

      point.grossRevenue += gross;
      point.platformFees += fee;
      point.netRevenue += gross - fee;
      point.paidOrders += 1;
    }

    for (const ticket of currentTickets) {
      const key = getDateKey(
        ticket.createdAt,
        selectedTimeZone,
      );

      const point = chartMap.get(key);

      if (!point) {
        continue;
      }

      if (
        ticket.status === TicketStatus.VALID ||
        ticket.status === TicketStatus.USED
      ) {
        point.ticketsSold += 1;
      }

      if (
        ticket.status === TicketStatus.USED ||
        ticket.usedAt !== null
      ) {
        point.checkedInParticipants += 1;
      }

      const email = ticket.holderEmail.trim().toLowerCase();

      if (email) {
        const set =
          dailyParticipantSets.get(key) ??
          new Set<string>();

        set.add(email);
        dailyParticipantSets.set(key, set);
      }
    }

    const salesChart = Array.from(chartMap.values()).map(
      (point) => ({
        ...point,
        grossRevenue: normalizeMoney(
          point.grossRevenue,
          selectedCurrency,
        ),
        platformFees: normalizeMoney(
          point.platformFees,
          selectedCurrency,
        ),
        netRevenue: normalizeMoney(
          point.netRevenue,
          selectedCurrency,
        ),
        participants:
          dailyParticipantSets.get(point.date)?.size ?? 0,
      }),
    );

    const categoryMap = new Map<
      string,
      Omit<StatisticsDistributionItem, "percentage">
    >();

    const countryMap = new Map<
      string,
      Omit<StatisticsDistributionItem, "percentage">
    >();

    const cityMap = new Map<
      string,
      Omit<StatisticsDistributionItem, "percentage">
    >();

    const currencyMap = new Map<
      string,
      Omit<StatisticsDistributionItem, "percentage">
    >();

    const ticketTypeMap = new Map<
      string,
      Omit<StatisticsDistributionItem, "percentage">
    >();

    for (const order of paidCurrentOrders) {
      const gross = decimalToNumber(order.subtotal);
      const fee = decimalToNumber(order.platformFee);
      const net = gross - fee;
      const ticketsSold = order.items.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );

      const categoryKey =
        order.event.category?.id ?? "uncategorized";

      const categoryItem =
        categoryMap.get(categoryKey) ?? {
          key: categoryKey,
          label:
            order.event.category?.name ?? "Sans catégorie",
          count: 0,
          ticketsSold: 0,
          grossRevenue: 0,
          netRevenue: 0,
        };

      categoryItem.count += 1;
      categoryItem.ticketsSold += ticketsSold;
      categoryItem.grossRevenue += gross;
      categoryItem.netRevenue += net;
      categoryMap.set(categoryKey, categoryItem);

      const countryKey =
        normalizeText(order.event.country) || "inconnu";

      const countryItem =
        countryMap.get(countryKey) ?? {
          key: countryKey,
          label:
            normalizeText(order.event.country) ||
            "Pays non renseigné",
          count: 0,
          ticketsSold: 0,
          grossRevenue: 0,
          netRevenue: 0,
        };

      countryItem.count += 1;
      countryItem.ticketsSold += ticketsSold;
      countryItem.grossRevenue += gross;
      countryItem.netRevenue += net;
      countryMap.set(countryKey, countryItem);

      const cityKey =
        normalizeText(order.event.city) || "inconnue";

      const cityItem =
        cityMap.get(cityKey) ?? {
          key: cityKey,
          label:
            normalizeText(order.event.city) ||
            "Ville non renseignée",
          count: 0,
          ticketsSold: 0,
          grossRevenue: 0,
          netRevenue: 0,
        };

      cityItem.count += 1;
      cityItem.ticketsSold += ticketsSold;
      cityItem.grossRevenue += gross;
      cityItem.netRevenue += net;
      cityMap.set(cityKey, cityItem);

      const currencyKey = normalizeCurrency(order.currency);

      const currencyItem =
        currencyMap.get(currencyKey) ?? {
          key: currencyKey,
          label: currencyKey,
          count: 0,
          ticketsSold: 0,
          grossRevenue: 0,
          netRevenue: 0,
        };

      currencyItem.count += 1;
      currencyItem.ticketsSold += ticketsSold;
      currencyItem.grossRevenue += gross;
      currencyItem.netRevenue += net;
      currencyMap.set(currencyKey, currencyItem);

      for (const item of order.items) {
        const current =
          ticketTypeMap.get(item.ticketTypeId) ?? {
            key: item.ticketTypeId,
            label: item.ticketType.name,
            count: 0,
            ticketsSold: 0,
            grossRevenue: 0,
            netRevenue: 0,
          };

        current.count += 1;
        current.ticketsSold += item.quantity;
        current.grossRevenue += decimalToNumber(item.subtotal);
        current.netRevenue +=
          decimalToNumber(item.subtotal) -
          decimalToNumber(item.platformFee);

        ticketTypeMap.set(item.ticketTypeId, current);
      }
    }

    function finalizeDistribution(
      map: Map<
        string,
        Omit<StatisticsDistributionItem, "percentage">
      >,
    ): StatisticsDistributionItem[] {
      const total = Array.from(map.values()).reduce(
        (sum, item) => sum + item.grossRevenue,
        0,
      );

      return Array.from(map.values())
        .map((item) => ({
          ...item,
          grossRevenue: normalizeMoney(
            item.grossRevenue,
            selectedCurrency,
          ),
          netRevenue: normalizeMoney(
            item.netRevenue,
            selectedCurrency,
          ),
          percentage: percentage(
            item.grossRevenue,
            total,
          ),
        }))
        .sort(
          (first, second) =>
            second.grossRevenue - first.grossRevenue,
        )
        .slice(0, TOP_ITEMS_LIMIT);
    }

    const paymentMap = new Map<
      string,
      Omit<StatisticsPaymentMethodItem, "percentage">
    >();

    for (const payment of currentPayments) {
      const key = `${payment.provider}::${payment.method}`;

      const current =
        paymentMap.get(key) ?? {
          key,
          method: payment.method,
          provider: payment.provider,
          payments: 0,
          successfulPayments: 0,
          failedPayments: 0,
          refundedPayments: 0,
          amount: 0,
        };

      current.payments += 1;

      if (payment.status === PaymentStatus.SUCCESS) {
        current.successfulPayments += 1;
      } else if (payment.status === PaymentStatus.FAILED) {
        current.failedPayments += 1;
      } else if (payment.status === PaymentStatus.REFUNDED) {
        current.refundedPayments += 1;
      }

      current.amount += decimalToNumber(payment.amount);
      paymentMap.set(key, current);
    }

    const paymentAmountTotal = Array.from(
      paymentMap.values(),
    ).reduce(
      (sum, item) => sum + item.amount,
      0,
    );

    const paymentMethods = Array.from(paymentMap.values())
      .map((item) => ({
        ...item,
        amount: normalizeMoney(
          item.amount,
          selectedCurrency,
        ),
        percentage: percentage(
          item.amount,
          paymentAmountTotal,
        ),
      }))
      .sort(
        (first, second) =>
          second.amount - first.amount,
      );

    const orderStatusMap = new Map<OrderStatus, number>();

    for (const order of currentOrders) {
      orderStatusMap.set(
        order.status,
        (orderStatusMap.get(order.status) ?? 0) + 1,
      );
    }

    const ticketStatusMap = new Map<TicketStatus, number>();

    for (const ticket of currentTickets) {
      ticketStatusMap.set(
        ticket.status,
        (ticketStatusMap.get(ticket.status) ?? 0) + 1,
      );
    }

    const orderStatuses = Object.values(OrderStatus).map(
      (status) => ({
        status,
        count: orderStatusMap.get(status) ?? 0,
        percentage: percentage(
          orderStatusMap.get(status) ?? 0,
          currentOrders.length,
        ),
      }),
    );

    const ticketStatuses = Object.values(TicketStatus).map(
      (status) => ({
        status,
        count: ticketStatusMap.get(status) ?? 0,
        percentage: percentage(
          ticketStatusMap.get(status) ?? 0,
          currentTickets.length,
        ),
      }),
    );

    const activeEvents = allEvents.filter(
      (event) =>
        event.status === EventStatus.PUBLISHED &&
        (
          event.endsAt
            ? event.endsAt >= new Date()
            : event.startsAt >= startOfUtcDay(new Date())
        ),
    ).length;

    const revenueBreakdown: StatisticsRevenueBreakdown = {
      grossRevenue: normalizeMoney(
        currentGrossRevenue,
        selectedCurrency,
      ),
      platformFees: normalizeMoney(
        currentPlatformFees,
        selectedCurrency,
      ),
      refundedRevenue: normalizeMoney(
        refundedRevenue,
        selectedCurrency,
      ),
      netRevenue: normalizeMoney(
        Math.max(
          currentNetRevenue - refundedRevenue,
          0,
        ),
        selectedCurrency,
      ),
      feeRate: percentage(
        currentPlatformFees,
        currentGrossRevenue,
      ),
    };

    const summary: StatisticsSummary = {
      grossRevenue: revenueBreakdown.grossRevenue,
      platformFees: revenueBreakdown.platformFees,
      netRevenue: revenueBreakdown.netRevenue,
      refundedRevenue: revenueBreakdown.refundedRevenue,
      paidOrders: paidCurrentOrders.length,
      pendingOrders: currentOrders.filter(
        (order) => order.status === OrderStatus.PENDING,
      ).length,
      failedOrders: currentOrders.filter(
        (order) => order.status === OrderStatus.FAILED,
      ).length,
      cancelledOrders: currentOrders.filter(
        (order) => order.status === OrderStatus.CANCELLED,
      ).length,
      refundedOrders: currentOrders.filter(
        (order) => order.status === OrderStatus.REFUNDED,
      ).length,
      ticketsSold: soldCurrentTickets.length,
      validTickets: currentTickets.filter(
        (ticket) => ticket.status === TicketStatus.VALID,
      ).length,
      usedTickets: currentTickets.filter(
        (ticket) => ticket.status === TicketStatus.USED,
      ).length,
      cancelledTickets: currentTickets.filter(
        (ticket) => ticket.status === TicketStatus.CANCELLED,
      ).length,
      refundedTickets: currentTickets.filter(
        (ticket) => ticket.status === TicketStatus.REFUNDED,
      ).length,
      participants: currentParticipantEmails.size,
      checkedInParticipants: currentUsedTickets,
      expectedParticipants: currentExpectedTickets,
      attendanceRate: currentAttendanceRate,
      averageOrderValue:
        paidCurrentOrders.length > 0
          ? normalizeMoney(
              currentGrossRevenue / paidCurrentOrders.length,
              selectedCurrency,
            )
          : 0,
      averageTicketPrice:
        soldCurrentTickets.length > 0
          ? normalizeMoney(
              currentGrossRevenue / soldCurrentTickets.length,
              selectedCurrency,
            )
          : 0,
      activeEvents,
      totalEvents: allEvents.length,
      remainingPlaces: Math.max(
        totalCapacity - lifetimeTicketsSold,
        0,
      ),
    };

    const revenueByCategory =
      finalizeDistribution(categoryMap);
    const revenueByCountry =
      finalizeDistribution(countryMap);
    const revenueByCity =
      finalizeDistribution(cityMap);
    const revenueByCurrency =
      finalizeDistribution(currencyMap);
    const salesByTicketType =
      finalizeDistribution(ticketTypeMap);

    const bestRevenueEvent =
      [...eventPerformance].sort(
        (first, second) =>
          second.netRevenue - first.netRevenue,
      )[0] ?? null;

    const mostAttendedEvent =
      [...eventPerformance].sort(
        (first, second) =>
          second.checkedInParticipants -
          first.checkedInParticipants,
      )[0] ?? null;

    const bestTicketTypeEntry =
      [...ticketTypeMap.entries()].sort(
        ([, first], [, second]) =>
          second.ticketsSold - first.ticketsSold,
      )[0];

    let bestSellingTicketType:
      | StatisticsTopPerformers["bestSellingTicketType"]
      | null = null;

    if (bestTicketTypeEntry) {
      const [ticketTypeId, ticketTypeData] =
        bestTicketTypeEntry;

      const matchingOrder = paidCurrentOrders.find(
        (order) =>
          order.items.some(
            (item) =>
              item.ticketTypeId === ticketTypeId,
          ),
      );

      bestSellingTicketType = {
        id: ticketTypeId,
        name: ticketTypeData.label,
        eventId: matchingOrder?.event.id ?? "",
        eventTitle:
          matchingOrder?.event.title ??
          "Événement non renseigné",
        quantity: ticketTypeData.ticketsSold,
        grossRevenue: normalizeMoney(
          ticketTypeData.grossRevenue,
          selectedCurrency,
        ),
      };
    }

    const bestSalesDay =
      [...salesChart].sort(
        (first, second) =>
          second.grossRevenue - first.grossRevenue,
      )[0] ?? null;

    const currencyCodes = Array.from(
      new Set([
        selectedCurrency,
        ...currencySource.map((item) =>
          normalizeCurrency(item.currency),
        ),
      ]),
    ).sort();

    return {
      generatedAt: new Date().toISOString(),

      period: {
        days: period.days,
        start: period.start.toISOString(),
        end: period.end.toISOString(),
        previousStart:
          period.previousStart.toISOString(),
        previousEnd:
          period.previousEnd.toISOString(),
        timeZone: selectedTimeZone,
        custom: period.custom,
      },

      filters: {
        eventId: selectedEventId,
        currency: selectedCurrency,
      },

      currency: selectedCurrency,
      currencyOptions: currencyCodes.map(
        buildCurrencyOption,
      ),

      events: allEvents.map((event) => ({
        id: event.id,
        title: event.title,
        startsAt: event.startsAt.toISOString(),
        status: event.status,
        currency: normalizeCurrency(event.currency),
      })),

      summary,

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
        paidOrders: createTrend(
          paidCurrentOrders.length,
          paidPreviousOrders.length,
        ),
        ticketsSold: createTrend(
          soldCurrentTickets.length,
          soldPreviousTickets.length,
        ),
        participants: createTrend(
          currentParticipantEmails.size,
          previousParticipantEmails.size,
        ),
        attendanceRate: createTrend(
          currentAttendanceRate,
          previousAttendanceRate,
        ),
      },

      salesChart,
      revenueBreakdown,
      eventPerformance,
      revenueByCategory,
      revenueByCountry,
      revenueByCity,
      revenueByCurrency,
      salesByTicketType,
      paymentMethods,
      orderStatuses,
      ticketStatuses,

      topPerformers: {
        bestRevenueEvent,
        mostAttendedEvent,
        bestSellingTicketType,
        bestSalesDay,
        topCountry: revenueByCountry[0] ?? null,
        topCity: revenueByCity[0] ?? null,
        topPaymentMethod: paymentMethods[0] ?? null,
      },

      recentActivities: recentActivities.map(
        (activity) => ({
          id: activity.id,
          type: activity.type,
          title: activity.title,
          description: activity.description,
          amount:
            activity.amount === null
              ? null
              : normalizeMoney(
                  decimalToNumber(activity.amount),
                  normalizeCurrency(activity.currency),
                ),
          currency:
            activity.currency
              ? normalizeCurrency(activity.currency)
              : null,
          createdAt: activity.createdAt.toISOString(),
          event: activity.event
            ? {
                id: activity.event.id,
                title: activity.event.title,
                slug: activity.event.slug,
              }
            : null,
        }),
      ),
    };
  } catch (error) {
    if (error instanceof GetOrganizerStatisticsError) {
      throw error;
    }

    console.error(
      "[GET_ORGANIZER_STATISTICS_ERROR]",
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

    throw new GetOrganizerStatisticsError({
      code: "GET_ORGANIZER_STATISTICS_FAILED",
      status: 500,
      message:
        "Impossible de charger les statistiques pour le moment.",
    });
  }
}