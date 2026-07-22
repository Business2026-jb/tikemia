import "server-only";

import {
  OrderStatus,
  PaymentStatus,
  PayoutStatus,
  Prisma,
  type EventStatus,
} from "@prisma/client";

import {
  DEFAULT_CURRENCY_CODE,
  getCurrencyDefinition,
  isSupportedCurrencyCode,
  type SupportedCurrencyCode,
} from "@/lib/localization/currencies";
import { roundMoneyAmount } from "@/lib/localization/format-money";
import { prisma } from "@/lib/prisma";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PERIOD_DAYS = 30;
const MAX_PERIOD_DAYS = 3650;
const DEFAULT_TIME_ZONE = "Africa/Porto-Novo";

export const ORGANIZER_PAYMENTS_PERIODS = [7, 30, 90, 180, 365] as const;
export const ORGANIZER_PAYMENTS_SORTS = [
  "NEWEST",
  "OLDEST",
  "AMOUNT_HIGH",
  "AMOUNT_LOW",
] as const;

const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  PaymentStatus.PENDING,
  PaymentStatus.SUCCESS,
  PaymentStatus.FAILED,
  PaymentStatus.REFUNDED,
];

const PAYOUT_STATUSES: readonly PayoutStatus[] = [
  PayoutStatus.PENDING,
  PayoutStatus.PROCESSING,
  PayoutStatus.PAID,
  PayoutStatus.REJECTED,
];

export type OrganizerPaymentsPeriod =
  (typeof ORGANIZER_PAYMENTS_PERIODS)[number];

export type OrganizerPaymentsSort =
  (typeof ORGANIZER_PAYMENTS_SORTS)[number];

export type GetOrganizerPaymentsParams = {
  organizerId: string;
  page?: number;
  pageSize?: number;
  search?: string | null;
  eventId?: string | null;
  currency?: string | null;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  paymentProvider?: string | null;
  payoutStatus?: string | null;
  periodDays?: number | null;
  dateFrom?: string | Date | null;
  dateTo?: string | Date | null;
  timeZone?: string | null;
  sort?: OrganizerPaymentsSort | null;
};

export type OrganizerPaymentsTrend = {
  current: number;
  previous: number;
  percentage: number | null;
  direction: "up" | "down" | "stable";
};

export type OrganizerPaymentsPeriodData = {
  days: number;
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
  custom: boolean;
  timeZone: string;
};

export type OrganizerPaymentsCurrencyOption = {
  code: SupportedCurrencyCode;
  name: string;
  symbol: string;
  fractionDigits: number;
};

export type OrganizerPaymentListItem = {
  id: string;
  provider: string;
  providerReference: string | null;
  method: string;
  amount: number;
  currency: SupportedCurrencyCode;
  status: PaymentStatus;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  financials: {
    subtotal: number;
    platformFee: number;
    total: number;
    organizerNet: number;
  };
  order: {
    id: string;
    reference: string;
    status: OrderStatus;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    paidAt: string | null;
    createdAt: string;
  };
  event: {
    id: string;
    title: string;
    slug: string;
    coverImage: string | null;
    status: EventStatus;
    startsAt: string;
    city: string;
    country: string;
    countryCode: string;
  };
};

export type OrganizerPayoutListItem = {
  id: string;
  reference: string | null;
  amount: number;
  fee: number;
  netAmount: number;
  currency: SupportedCurrencyCode;
  status: PayoutStatus;
  note: string | null;
  requestedAt: string;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrganizerPaymentMethodPerformance = {
  key: string;
  method: string;
  provider: string;
  payments: number;
  successfulPayments: number;
  pendingPayments: number;
  failedPayments: number;
  refundedPayments: number;
  totalAmount: number;
  successfulAmount: number;
  refundedAmount: number;
  successRate: number;
  share: number;
};

export type OrganizerPaymentsChartPoint = {
  date: string;
  grossRevenue: number;
  platformFees: number;
  organizerNet: number;
  refundedAmount: number;
  successfulPayments: number;
  pendingPayments: number;
  failedPayments: number;
  refundedPayments: number;
  payoutRequested: number;
  payoutProcessed: number;
};

export type OrganizerPaymentsSummary = {
  grossRevenue: number;
  platformFees: number;
  organizerNet: number;
  refundedAmount: number;
  availableBalance: number;
  reservedBalance: number;
  totalPaidOut: number;
  rejectedPayoutAmount: number;
  totalPayments: number;
  successfulPayments: number;
  pendingPayments: number;
  failedPayments: number;
  refundedPayments: number;
  totalPayouts: number;
  pendingPayouts: number;
  processingPayouts: number;
  paidPayouts: number;
  rejectedPayouts: number;
  averagePaymentAmount: number;
  paymentSuccessRate: number;
};

export type OrganizerPaymentsTrends = {
  grossRevenue: OrganizerPaymentsTrend;
  platformFees: OrganizerPaymentsTrend;
  organizerNet: OrganizerPaymentsTrend;
  refundedAmount: OrganizerPaymentsTrend;
  successfulPayments: OrganizerPaymentsTrend;
  failedPayments: OrganizerPaymentsTrend;
};

export type OrganizerPaymentsData = {
  generatedAt: string;
  currency: SupportedCurrencyCode;
  period: OrganizerPaymentsPeriodData;
  summary: OrganizerPaymentsSummary;
  trends: OrganizerPaymentsTrends;
  payments: OrganizerPaymentListItem[];
  payouts: OrganizerPayoutListItem[];
  chart: OrganizerPaymentsChartPoint[];
  paymentMethods: OrganizerPaymentMethodPerformance[];
  filters: {
    events: Array<{
      id: string;
      title: string;
      slug: string;
      status: EventStatus;
      startsAt: string;
      currency: SupportedCurrencyCode;
    }>;
    currencies: OrganizerPaymentsCurrencyOption[];
    paymentStatuses: PaymentStatus[];
    payoutStatuses: PayoutStatus[];
    paymentMethods: string[];
    paymentProviders: string[];
  };
  appliedFilters: {
    search: string;
    eventId: string | null;
    currency: SupportedCurrencyCode;
    paymentStatus: PaymentStatus | null;
    paymentMethod: string | null;
    paymentProvider: string | null;
    payoutStatus: PayoutStatus | null;
    dateFrom: string | null;
    dateTo: string | null;
    periodDays: number;
    timeZone: string;
    sort: OrganizerPaymentsSort;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
};

export class GetOrganizerPaymentsError extends Error {
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
    this.name = "GetOrganizerPaymentsError";
    this.code = code;
    this.status = status;
  }
}

type InternalPeriod = {
  days: number;
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  custom: boolean;
};

const paymentSelect = {
  id: true,
  provider: true,
  providerReference: true,
  method: true,
  amount: true,
  currency: true,
  status: true,
  failureReason: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
  order: {
    select: {
      id: true,
      reference: true,
      status: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      currency: true,
      subtotal: true,
      platformFee: true,
      total: true,
      paidAt: true,
      createdAt: true,
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          coverImage: true,
          status: true,
          startsAt: true,
          city: true,
          country: true,
          countryCode: true,
        },
      },
    },
  },
} satisfies Prisma.PaymentSelect;

const payoutSelect = {
  id: true,
  reference: true,
  amount: true,
  fee: true,
  netAmount: true,
  currency: true,
  status: true,
  note: true,
  requestedAt: true,
  processedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PayoutSelect;

type PaymentQueryRow = Prisma.PaymentGetPayload<{
  select: typeof paymentSelect;
}>;

type PayoutQueryRow = Prisma.PayoutGetPayload<{
  select: typeof payoutSelect;
}>;

function normalizeText(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeInteger(
  value: number | null | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), minimum), maximum);
}

function normalizeSort(
  value: OrganizerPaymentsSort | null | undefined,
): OrganizerPaymentsSort {
  return ORGANIZER_PAYMENTS_SORTS.includes(
    value as OrganizerPaymentsSort,
  )
    ? (value as OrganizerPaymentsSort)
    : "NEWEST";
}

function normalizePaymentStatus(
  value: string | null | undefined,
): PaymentStatus | null {
  const normalized = normalizeText(value).toUpperCase();

  return PAYMENT_STATUSES.includes(normalized as PaymentStatus)
    ? (normalized as PaymentStatus)
    : null;
}

function normalizePayoutStatus(
  value: string | null | undefined,
): PayoutStatus | null {
  const normalized = normalizeText(value).toUpperCase();

  return PAYOUT_STATUSES.includes(normalized as PayoutStatus)
    ? (normalized as PayoutStatus)
    : null;
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

function resolveRowCurrency(
  value: string | null | undefined,
  fallback: SupportedCurrencyCode,
): SupportedCurrencyCode {
  const normalized = normalizeText(value).toUpperCase();
  return isSupportedCurrencyCode(normalized) ? normalized : fallback;
}

function normalizeTimeZone(
  value: string | null | undefined,
): string {
  const normalized = normalizeText(value) || DEFAULT_TIME_ZONE;

  try {
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: normalized,
    }).format(new Date());

    return normalized;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
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
    /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
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

function buildPeriod({
  periodDays,
  dateFrom,
  dateTo,
}: {
  periodDays: number;
  dateFrom: Date | null;
  dateTo: Date | null;
}): InternalPeriod {
  const now = new Date();

  if (dateFrom || dateTo) {
    const end = dateTo ?? now;
    const start =
      dateFrom ??
      startOfUtcDay(addDays(end, -(periodDays - 1)));

    const spanMs = Math.max(end.getTime() - start.getTime(), 0);
    const days = Math.max(Math.ceil(spanMs / 86_400_000) + 1, 1);
    const previousEnd = new Date(start.getTime() - 1);
    const previousStart = new Date(
      previousEnd.getTime() - days * 86_400_000 + 1,
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
  const start = startOfUtcDay(addDays(now, -(periodDays - 1)));
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = startOfUtcDay(addDays(start, -periodDays));

  return {
    days: periodDays,
    start,
    end,
    previousStart,
    previousEnd,
    custom: false,
  };
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

  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeMoney(
  value: number,
  currency: SupportedCurrencyCode,
): number {
  return roundMoneyAmount({
    amount: Number.isFinite(value) ? value : 0,
    currency,
  });
}

function calculatePercentage(value: number, total: number): number {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return 0;
  }

  return (
    Math.round(((value / total) * 100 + Number.EPSILON) * 100) /
    100
  );
}

function createTrend(
  current: number,
  previous: number,
  currency?: SupportedCurrencyCode,
): OrganizerPaymentsTrend {
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

function buildDateKeys({
  start,
  end,
  timeZone,
}: {
  start: Date;
  end: Date;
  timeZone: string;
}): string[] {
  const keys: string[] = [];
  const cursor = startOfUtcDay(start);
  const final = startOfUtcDay(end);

  while (cursor.getTime() <= final.getTime()) {
    keys.push(getDateKey(cursor, timeZone));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return keys;
}

function buildCurrencyOption(
  code: SupportedCurrencyCode,
): OrganizerPaymentsCurrencyOption {
  const definition = getCurrencyDefinition(code);

  return {
    code,
    name: definition?.name ?? code,
    symbol: definition?.symbol ?? code,
    fractionDigits: definition?.decimals ?? 2,
  };
}

function getPaymentOrderBy(
  sort: OrganizerPaymentsSort,
): Prisma.PaymentOrderByWithRelationInput[] {
  if (sort === "OLDEST") {
    return [{ createdAt: "asc" }, { id: "asc" }];
  }

  if (sort === "AMOUNT_HIGH") {
    return [{ amount: "desc" }, { createdAt: "desc" }];
  }

  if (sort === "AMOUNT_LOW") {
    return [{ amount: "asc" }, { createdAt: "desc" }];
  }

  return [{ createdAt: "desc" }, { id: "desc" }];
}

function buildPaymentWhere({
  organizerId,
  search,
  eventId,
  currency,
  paymentStatus,
  paymentMethod,
  paymentProvider,
  dateFrom,
  dateTo,
}: {
  organizerId: string;
  search: string;
  eventId: string | null;
  currency: SupportedCurrencyCode;
  paymentStatus: PaymentStatus | null;
  paymentMethod: string | null;
  paymentProvider: string | null;
  dateFrom: Date;
  dateTo: Date;
}): Prisma.PaymentWhereInput {
  const where: Prisma.PaymentWhereInput = {
    currency,
    createdAt: {
      gte: dateFrom,
      lte: dateTo,
    },
    order: {
      event: {
        organizerId,
        ...(eventId ? { id: eventId } : {}),
      },
    },
  };

  if (paymentStatus) {
    where.status = paymentStatus;
  }

  if (paymentMethod) {
    where.method = {
      equals: paymentMethod,
      mode: "insensitive",
    };
  }

  if (paymentProvider) {
    where.provider = {
      equals: paymentProvider,
      mode: "insensitive",
    };
  }

  if (search) {
    where.OR = [
      {
        providerReference: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        provider: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        method: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        order: {
          reference: {
            contains: search,
            mode: "insensitive",
          },
        },
      },
      {
        order: {
          customerName: {
            contains: search,
            mode: "insensitive",
          },
        },
      },
      {
        order: {
          customerEmail: {
            contains: search,
            mode: "insensitive",
          },
        },
      },
      {
        order: {
          customerPhone: {
            contains: search,
            mode: "insensitive",
          },
        },
      },
      {
        order: {
          event: {
            title: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      },
    ];
  }

  return where;
}

function toPaymentListItem({
  payment,
  selectedCurrency,
}: {
  payment: PaymentQueryRow;
  selectedCurrency: SupportedCurrencyCode;
}): OrganizerPaymentListItem {
  const rowCurrency = resolveRowCurrency(
    payment.currency,
    selectedCurrency,
  );

  const subtotal = decimalToNumber(payment.order.subtotal);
  const platformFee = decimalToNumber(payment.order.platformFee);
  const total = decimalToNumber(payment.order.total);

  return {
    id: payment.id,
    provider: payment.provider,
    providerReference: payment.providerReference,
    method: payment.method,
    amount: normalizeMoney(
      decimalToNumber(payment.amount),
      rowCurrency,
    ),
    currency: rowCurrency,
    status: payment.status,
    failureReason: payment.failureReason,
    paidAt: payment.paidAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
    financials: {
      subtotal: normalizeMoney(subtotal, rowCurrency),
      platformFee: normalizeMoney(platformFee, rowCurrency),
      total: normalizeMoney(total, rowCurrency),
      organizerNet: normalizeMoney(
        Math.max(subtotal - platformFee, 0),
        rowCurrency,
      ),
    },
    order: {
      id: payment.order.id,
      reference: payment.order.reference,
      status: payment.order.status,
      customerName: payment.order.customerName,
      customerEmail: payment.order.customerEmail,
      customerPhone: payment.order.customerPhone,
      paidAt: payment.order.paidAt?.toISOString() ?? null,
      createdAt: payment.order.createdAt.toISOString(),
    },
    event: {
      id: payment.order.event.id,
      title: payment.order.event.title,
      slug: payment.order.event.slug,
      coverImage: payment.order.event.coverImage,
      status: payment.order.event.status,
      startsAt: payment.order.event.startsAt.toISOString(),
      city: payment.order.event.city,
      country: payment.order.event.country,
      countryCode: payment.order.event.countryCode,
    },
  };
}

function toPayoutListItem({
  payout,
  selectedCurrency,
}: {
  payout: PayoutQueryRow;
  selectedCurrency: SupportedCurrencyCode;
}): OrganizerPayoutListItem {
  const rowCurrency = resolveRowCurrency(
    payout.currency,
    selectedCurrency,
  );

  return {
    id: payout.id,
    reference: payout.reference,
    amount: normalizeMoney(decimalToNumber(payout.amount), rowCurrency),
    fee: normalizeMoney(decimalToNumber(payout.fee), rowCurrency),
    netAmount: normalizeMoney(
      decimalToNumber(payout.netAmount),
      rowCurrency,
    ),
    currency: rowCurrency,
    status: payout.status,
    note: payout.note,
    requestedAt: payout.requestedAt.toISOString(),
    processedAt: payout.processedAt?.toISOString() ?? null,
    createdAt: payout.createdAt.toISOString(),
    updatedAt: payout.updatedAt.toISOString(),
  };
}

function summarizePayments({
  payments,
  currency,
}: {
  payments: PaymentQueryRow[];
  currency: SupportedCurrencyCode;
}) {
  let grossRevenue = 0;
  let platformFees = 0;
  let organizerNet = 0;
  let refundedAmount = 0;
  let successfulPayments = 0;
  let pendingPayments = 0;
  let failedPayments = 0;
  let refundedPayments = 0;

  for (const payment of payments) {
    const paymentAmount = decimalToNumber(payment.amount);

    if (payment.status === PaymentStatus.SUCCESS) {
      successfulPayments += 1;

      const subtotal = decimalToNumber(payment.order.subtotal);
      const platformFee = decimalToNumber(
        payment.order.platformFee,
      );

      grossRevenue += subtotal;
      platformFees += platformFee;
      organizerNet += Math.max(subtotal - platformFee, 0);
    } else if (payment.status === PaymentStatus.PENDING) {
      pendingPayments += 1;
    } else if (payment.status === PaymentStatus.FAILED) {
      failedPayments += 1;
    } else if (payment.status === PaymentStatus.REFUNDED) {
      refundedPayments += 1;
      refundedAmount += paymentAmount;
    }
  }

  return {
    grossRevenue: normalizeMoney(grossRevenue, currency),
    platformFees: normalizeMoney(platformFees, currency),
    organizerNet: normalizeMoney(organizerNet, currency),
    refundedAmount: normalizeMoney(refundedAmount, currency),
    totalPayments: payments.length,
    successfulPayments,
    pendingPayments,
    failedPayments,
    refundedPayments,
    averagePaymentAmount:
      successfulPayments > 0
        ? normalizeMoney(grossRevenue / successfulPayments, currency)
        : 0,
    paymentSuccessRate: calculatePercentage(
      successfulPayments,
      payments.length,
    ),
  };
}

function summarizePayouts({
  payouts,
  currency,
}: {
  payouts: PayoutQueryRow[];
  currency: SupportedCurrencyCode;
}) {
  let pendingPayouts = 0;
  let processingPayouts = 0;
  let paidPayouts = 0;
  let rejectedPayouts = 0;
  let reservedBalance = 0;
  let totalPaidOut = 0;
  let rejectedPayoutAmount = 0;

  for (const payout of payouts) {
    const amount = decimalToNumber(payout.amount);

    if (payout.status === PayoutStatus.PENDING) {
      pendingPayouts += 1;
      reservedBalance += amount;
    } else if (payout.status === PayoutStatus.PROCESSING) {
      processingPayouts += 1;
      reservedBalance += amount;
    } else if (payout.status === PayoutStatus.PAID) {
      paidPayouts += 1;
      totalPaidOut += amount;
    } else if (payout.status === PayoutStatus.REJECTED) {
      rejectedPayouts += 1;
      rejectedPayoutAmount += amount;
    }
  }

  return {
    totalPayouts: payouts.length,
    pendingPayouts,
    processingPayouts,
    paidPayouts,
    rejectedPayouts,
    reservedBalance: normalizeMoney(reservedBalance, currency),
    totalPaidOut: normalizeMoney(totalPaidOut, currency),
    rejectedPayoutAmount: normalizeMoney(
      rejectedPayoutAmount,
      currency,
    ),
  };
}

function buildPaymentMethods({
  payments,
  currency,
}: {
  payments: PaymentQueryRow[];
  currency: SupportedCurrencyCode;
}): OrganizerPaymentMethodPerformance[] {
  const map = new Map<
    string,
    OrganizerPaymentMethodPerformance
  >();

  const successfulTotal = payments.reduce(
    (total, payment) =>
      payment.status === PaymentStatus.SUCCESS
        ? total + decimalToNumber(payment.amount)
        : total,
    0,
  );

  for (const payment of payments) {
    const method = normalizeText(payment.method) || "Non renseigné";
    const provider = normalizeText(payment.provider) || "Non renseigné";
    const key = `${method.toLowerCase()}::${provider.toLowerCase()}`;

    const current = map.get(key) ?? {
      key,
      method,
      provider,
      payments: 0,
      successfulPayments: 0,
      pendingPayments: 0,
      failedPayments: 0,
      refundedPayments: 0,
      totalAmount: 0,
      successfulAmount: 0,
      refundedAmount: 0,
      successRate: 0,
      share: 0,
    };

    const amount = decimalToNumber(payment.amount);
    current.payments += 1;
    current.totalAmount += amount;

    if (payment.status === PaymentStatus.SUCCESS) {
      current.successfulPayments += 1;
      current.successfulAmount += amount;
    } else if (payment.status === PaymentStatus.PENDING) {
      current.pendingPayments += 1;
    } else if (payment.status === PaymentStatus.FAILED) {
      current.failedPayments += 1;
    } else if (payment.status === PaymentStatus.REFUNDED) {
      current.refundedPayments += 1;
      current.refundedAmount += amount;
    }

    map.set(key, current);
  }

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      totalAmount: normalizeMoney(item.totalAmount, currency),
      successfulAmount: normalizeMoney(
        item.successfulAmount,
        currency,
      ),
      refundedAmount: normalizeMoney(item.refundedAmount, currency),
      successRate: calculatePercentage(
        item.successfulPayments,
        item.payments,
      ),
      share: calculatePercentage(
        item.successfulAmount,
        successfulTotal,
      ),
    }))
    .sort(
      (first, second) =>
        second.successfulAmount - first.successfulAmount ||
        second.successfulPayments - first.successfulPayments,
    );
}

function buildChart({
  period,
  timeZone,
  payments,
  payouts,
  currency,
}: {
  period: InternalPeriod;
  timeZone: string;
  payments: PaymentQueryRow[];
  payouts: PayoutQueryRow[];
  currency: SupportedCurrencyCode;
}): OrganizerPaymentsChartPoint[] {
  const points = new Map<string, OrganizerPaymentsChartPoint>();

  for (const dateKey of buildDateKeys({
    start: period.start,
    end: period.end,
    timeZone,
  })) {
    points.set(dateKey, {
      date: dateKey,
      grossRevenue: 0,
      platformFees: 0,
      organizerNet: 0,
      refundedAmount: 0,
      successfulPayments: 0,
      pendingPayments: 0,
      failedPayments: 0,
      refundedPayments: 0,
      payoutRequested: 0,
      payoutProcessed: 0,
    });
  }

  for (const payment of payments) {
    const point = points.get(
      getDateKey(payment.createdAt, timeZone),
    );

    if (!point) {
      continue;
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      const subtotal = decimalToNumber(payment.order.subtotal);
      const platformFee = decimalToNumber(
        payment.order.platformFee,
      );

      point.successfulPayments += 1;
      point.grossRevenue += subtotal;
      point.platformFees += platformFee;
      point.organizerNet += Math.max(subtotal - platformFee, 0);
    } else if (payment.status === PaymentStatus.PENDING) {
      point.pendingPayments += 1;
    } else if (payment.status === PaymentStatus.FAILED) {
      point.failedPayments += 1;
    } else if (payment.status === PaymentStatus.REFUNDED) {
      point.refundedPayments += 1;
      point.refundedAmount += decimalToNumber(payment.amount);
    }
  }

  for (const payout of payouts) {
    const requestedPoint = points.get(
      getDateKey(payout.requestedAt, timeZone),
    );

    if (requestedPoint) {
      requestedPoint.payoutRequested += decimalToNumber(
        payout.amount,
      );
    }

    if (
      payout.status === PayoutStatus.PAID &&
      payout.processedAt
    ) {
      const processedPoint = points.get(
        getDateKey(payout.processedAt, timeZone),
      );

      if (processedPoint) {
        processedPoint.payoutProcessed += decimalToNumber(
          payout.amount,
        );
      }
    }
  }

  return Array.from(points.values()).map((point) => ({
    ...point,
    grossRevenue: normalizeMoney(point.grossRevenue, currency),
    platformFees: normalizeMoney(point.platformFees, currency),
    organizerNet: normalizeMoney(point.organizerNet, currency),
    refundedAmount: normalizeMoney(point.refundedAmount, currency),
    payoutRequested: normalizeMoney(point.payoutRequested, currency),
    payoutProcessed: normalizeMoney(point.payoutProcessed, currency),
  }));
}

export async function getOrganizerPayments({
  organizerId,
  page,
  pageSize,
  search,
  eventId,
  currency,
  paymentStatus,
  paymentMethod,
  paymentProvider,
  payoutStatus,
  periodDays,
  dateFrom,
  dateTo,
  timeZone,
  sort,
}: GetOrganizerPaymentsParams): Promise<OrganizerPaymentsData> {
  const cleanOrganizerId = normalizeText(organizerId);

  if (!cleanOrganizerId) {
    throw new GetOrganizerPaymentsError({
      code: "ORGANIZER_ID_REQUIRED",
      status: 400,
      message: "L’identifiant de l’organisateur est obligatoire.",
    });
  }

  const selectedPage = normalizeInteger(
    page,
    DEFAULT_PAGE,
    1,
    Number.MAX_SAFE_INTEGER,
  );

  const selectedPageSize = normalizeInteger(
    pageSize,
    DEFAULT_PAGE_SIZE,
    1,
    MAX_PAGE_SIZE,
  );

  const selectedSearch = normalizeText(search);
  const selectedEventId = normalizeOptionalText(eventId);
  const selectedCurrency = normalizeCurrency(currency);
  const selectedPaymentStatus = normalizePaymentStatus(
    paymentStatus,
  );
  const selectedPaymentMethod = normalizeOptionalText(
    paymentMethod,
  );
  const selectedPaymentProvider = normalizeOptionalText(
    paymentProvider,
  );
  const selectedPayoutStatus = normalizePayoutStatus(payoutStatus);
  const selectedPeriodDays = normalizeInteger(
    periodDays,
    DEFAULT_PERIOD_DAYS,
    1,
    MAX_PERIOD_DAYS,
  );
  const selectedTimeZone = normalizeTimeZone(timeZone);
  const selectedSort = normalizeSort(sort);
  const parsedDateFrom = parseDate(dateFrom);
  const parsedDateTo = parseDate(dateTo, true);

  if (
    parsedDateFrom &&
    parsedDateTo &&
    parsedDateFrom.getTime() > parsedDateTo.getTime()
  ) {
    throw new GetOrganizerPaymentsError({
      code: "INVALID_DATE_RANGE",
      status: 422,
      message:
        "La date de début ne peut pas être postérieure à la date de fin.",
    });
  }

  const period = buildPeriod({
    periodDays: selectedPeriodDays,
    dateFrom: parsedDateFrom,
    dateTo: parsedDateTo,
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
      throw new GetOrganizerPaymentsError({
        code: "ORGANIZER_NOT_FOUND",
        status: 404,
        message: "Le compte organisateur est introuvable.",
      });
    }

    if (!organizer.isActive || !organizer.emailVerified) {
      throw new GetOrganizerPaymentsError({
        code: "ORGANIZER_FORBIDDEN",
        status: 403,
        message:
          "Ce compte organisateur ne peut pas consulter les paiements.",
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
        throw new GetOrganizerPaymentsError({
          code: "EVENT_NOT_FOUND",
          status: 404,
          message: "L’événement sélectionné est introuvable.",
        });
      }
    }

    const paymentWhere = buildPaymentWhere({
      organizerId: cleanOrganizerId,
      search: selectedSearch,
      eventId: selectedEventId,
      currency: selectedCurrency,
      paymentStatus: selectedPaymentStatus,
      paymentMethod: selectedPaymentMethod,
      paymentProvider: selectedPaymentProvider,
      dateFrom: period.start,
      dateTo: period.end,
    });

    const currentPeriodWhere = buildPaymentWhere({
      organizerId: cleanOrganizerId,
      search: "",
      eventId: selectedEventId,
      currency: selectedCurrency,
      paymentStatus: null,
      paymentMethod: null,
      paymentProvider: null,
      dateFrom: period.start,
      dateTo: period.end,
    });

    const previousPeriodWhere = buildPaymentWhere({
      organizerId: cleanOrganizerId,
      search: "",
      eventId: selectedEventId,
      currency: selectedCurrency,
      paymentStatus: null,
      paymentMethod: null,
      paymentProvider: null,
      dateFrom: period.previousStart,
      dateTo: period.previousEnd,
    });

    const lifetimePaymentWhere: Prisma.PaymentWhereInput = {
      currency: selectedCurrency,
      order: {
        event: {
          organizerId: cleanOrganizerId,
          ...(selectedEventId ? { id: selectedEventId } : {}),
        },
      },
    };

    const payoutWhere: Prisma.PayoutWhereInput = {
      organizerId: cleanOrganizerId,
      currency: selectedCurrency,
      ...(selectedPayoutStatus
        ? {
            status: selectedPayoutStatus,
          }
        : {}),
    };

    const periodPayoutWhere: Prisma.PayoutWhereInput = {
      organizerId: cleanOrganizerId,
      currency: selectedCurrency,
      requestedAt: {
        gte: period.start,
        lte: period.end,
      },
    };

    const [
      totalItems,
      paginatedPayments,
      currentPeriodPayments,
      previousPeriodPayments,
      lifetimePayments,
      filteredPayouts,
      periodPayouts,
      lifetimePayouts,
      events,
      paymentFilterSource,
      currencySource,
    ] = await Promise.all([
      prisma.payment.count({
        where: paymentWhere,
      }),

      prisma.payment.findMany({
        where: paymentWhere,
        orderBy: getPaymentOrderBy(selectedSort),
        skip: (selectedPage - 1) * selectedPageSize,
        take: selectedPageSize,
        select: paymentSelect,
      }),

      prisma.payment.findMany({
        where: currentPeriodWhere,
        orderBy: {
          createdAt: "asc",
        },
        select: paymentSelect,
      }),

      prisma.payment.findMany({
        where: previousPeriodWhere,
        select: paymentSelect,
      }),

      prisma.payment.findMany({
        where: lifetimePaymentWhere,
        select: paymentSelect,
      }),

      prisma.payout.findMany({
        where: payoutWhere,
        orderBy: [
          {
            requestedAt: "desc",
          },
          {
            id: "desc",
          },
        ],
        select: payoutSelect,
      }),

      prisma.payout.findMany({
        where: periodPayoutWhere,
        orderBy: {
          requestedAt: "asc",
        },
        select: payoutSelect,
      }),

      prisma.payout.findMany({
        where: {
          organizerId: cleanOrganizerId,
          currency: selectedCurrency,
        },
        select: payoutSelect,
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
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          startsAt: true,
          currency: true,
        },
      }),

      prisma.payment.findMany({
        where: {
          order: {
            event: {
              organizerId: cleanOrganizerId,
            },
          },
        },
        distinct: ["method", "provider"],
        select: {
          method: true,
          provider: true,
        },
      }),

      prisma.order.findMany({
        where: {
          event: {
            organizerId: cleanOrganizerId,
          },
        },
        distinct: ["currency"],
        select: {
          currency: true,
        },
      }),
    ]);

    const currentSummary = summarizePayments({
      payments: currentPeriodPayments,
      currency: selectedCurrency,
    });

    const previousSummary = summarizePayments({
      payments: previousPeriodPayments,
      currency: selectedCurrency,
    });

    const lifetimeSummary = summarizePayments({
      payments: lifetimePayments,
      currency: selectedCurrency,
    });

    const payoutSummary = summarizePayouts({
      payouts: lifetimePayouts,
      currency: selectedCurrency,
    });

    const availableBalance = normalizeMoney(
      Math.max(
        lifetimeSummary.organizerNet -
          lifetimeSummary.refundedAmount -
          payoutSummary.reservedBalance -
          payoutSummary.totalPaidOut,
        0,
      ),
      selectedCurrency,
    );

    const summary: OrganizerPaymentsSummary = {
      grossRevenue: currentSummary.grossRevenue,
      platformFees: currentSummary.platformFees,
      organizerNet: currentSummary.organizerNet,
      refundedAmount: currentSummary.refundedAmount,
      availableBalance,
      reservedBalance: payoutSummary.reservedBalance,
      totalPaidOut: payoutSummary.totalPaidOut,
      rejectedPayoutAmount: payoutSummary.rejectedPayoutAmount,
      totalPayments: currentSummary.totalPayments,
      successfulPayments: currentSummary.successfulPayments,
      pendingPayments: currentSummary.pendingPayments,
      failedPayments: currentSummary.failedPayments,
      refundedPayments: currentSummary.refundedPayments,
      totalPayouts: payoutSummary.totalPayouts,
      pendingPayouts: payoutSummary.pendingPayouts,
      processingPayouts: payoutSummary.processingPayouts,
      paidPayouts: payoutSummary.paidPayouts,
      rejectedPayouts: payoutSummary.rejectedPayouts,
      averagePaymentAmount: currentSummary.averagePaymentAmount,
      paymentSuccessRate: currentSummary.paymentSuccessRate,
    };

    const trends: OrganizerPaymentsTrends = {
      grossRevenue: createTrend(
        currentSummary.grossRevenue,
        previousSummary.grossRevenue,
        selectedCurrency,
      ),
      platformFees: createTrend(
        currentSummary.platformFees,
        previousSummary.platformFees,
        selectedCurrency,
      ),
      organizerNet: createTrend(
        currentSummary.organizerNet,
        previousSummary.organizerNet,
        selectedCurrency,
      ),
      refundedAmount: createTrend(
        currentSummary.refundedAmount,
        previousSummary.refundedAmount,
        selectedCurrency,
      ),
      successfulPayments: createTrend(
        currentSummary.successfulPayments,
        previousSummary.successfulPayments,
      ),
      failedPayments: createTrend(
        currentSummary.failedPayments,
        previousSummary.failedPayments,
      ),
    };

    const currencyCodes = Array.from(
      new Set([
        selectedCurrency,
        ...currencySource
          .map((item) => normalizeText(item.currency).toUpperCase())
          .filter(
            (code): code is SupportedCurrencyCode =>
              isSupportedCurrencyCode(code),
          ),
      ]),
    ).sort();

    const paymentMethods = Array.from(
      new Set(
        paymentFilterSource
          .map((item) => normalizeText(item.method))
          .filter(Boolean),
      ),
    ).sort((first, second) => first.localeCompare(second, "fr"));

    const paymentProviders = Array.from(
      new Set(
        paymentFilterSource
          .map((item) => normalizeText(item.provider))
          .filter(Boolean),
      ),
    ).sort((first, second) => first.localeCompare(second, "fr"));

    const totalPages = Math.max(
      Math.ceil(totalItems / selectedPageSize),
      1,
    );

    return {
      generatedAt: new Date().toISOString(),
      currency: selectedCurrency,
      period: {
        days: period.days,
        start: period.start.toISOString(),
        end: period.end.toISOString(),
        previousStart: period.previousStart.toISOString(),
        previousEnd: period.previousEnd.toISOString(),
        custom: period.custom,
        timeZone: selectedTimeZone,
      },
      summary,
      trends,
      payments: paginatedPayments.map((payment) =>
        toPaymentListItem({
          payment,
          selectedCurrency,
        }),
      ),
      payouts: filteredPayouts.map((payout) =>
        toPayoutListItem({
          payout,
          selectedCurrency,
        }),
      ),
      chart: buildChart({
        period,
        timeZone: selectedTimeZone,
        payments: currentPeriodPayments,
        payouts: periodPayouts,
        currency: selectedCurrency,
      }),
      paymentMethods: buildPaymentMethods({
        payments: currentPeriodPayments,
        currency: selectedCurrency,
      }),
      filters: {
        events: events.map((event) => ({
          id: event.id,
          title: event.title,
          slug: event.slug,
          status: event.status,
          startsAt: event.startsAt.toISOString(),
          currency: resolveRowCurrency(
            event.currency,
            selectedCurrency,
          ),
        })),
        currencies: currencyCodes.map(buildCurrencyOption),
        paymentStatuses: [...PAYMENT_STATUSES],
        payoutStatuses: [...PAYOUT_STATUSES],
        paymentMethods,
        paymentProviders,
      },
      appliedFilters: {
        search: selectedSearch,
        eventId: selectedEventId,
        currency: selectedCurrency,
        paymentStatus: selectedPaymentStatus,
        paymentMethod: selectedPaymentMethod,
        paymentProvider: selectedPaymentProvider,
        payoutStatus: selectedPayoutStatus,
        dateFrom: parsedDateFrom?.toISOString() ?? null,
        dateTo: parsedDateTo?.toISOString() ?? null,
        periodDays: selectedPeriodDays,
        timeZone: selectedTimeZone,
        sort: selectedSort,
      },
      pagination: {
        page: selectedPage,
        pageSize: selectedPageSize,
        totalItems,
        totalPages,
        hasPreviousPage: selectedPage > 1,
        hasNextPage: selectedPage < totalPages,
      },
    };
  } catch (error) {
    if (error instanceof GetOrganizerPaymentsError) {
      throw error;
    }

    console.error(
      "[GET_ORGANIZER_PAYMENTS_ERROR]",
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

    throw new GetOrganizerPaymentsError({
      code: "GET_ORGANIZER_PAYMENTS_FAILED",
      status: 500,
      message:
        "Impossible de charger les paiements et retraits pour le moment.",
    });
  }
}