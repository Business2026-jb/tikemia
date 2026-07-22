export type MarketingMetricNumber =
  | number
  | string
  | {
      toNumber(): number;
    }
  | null
  | undefined;

export type MarketingMetricCurrency =
  | string
  | null
  | undefined;

export type MarketingVisitRecord = {
  id?: string;
  campaignId?: string | null;
  eventId?: string | null;
  source?: string | null;
  medium?: string | null;
  channel?: string | null;
  visitedAt: Date | string;
};

export type MarketingAttributionRecord = {
  id?: string;
  campaignId?: string | null;
  eventId?: string | null;
  promoCodeId?: string | null;
  source?: string | null;
  medium?: string | null;
  revenue: MarketingMetricNumber;
  ticketsCount: MarketingMetricNumber;
  discountAmount?: MarketingMetricNumber;
  currency?: MarketingMetricCurrency;
  attributedAt: Date | string;
};

export type PromoCodeUsageRecord = {
  id?: string;
  promoCodeId?: string | null;
  orderId?: string | null;
  discountAmount: MarketingMetricNumber;
  currency?: MarketingMetricCurrency;
  usedAt: Date | string;
};

export type MarketingMetricPeriod = {
  startsAt: Date | string;
  endsAt: Date | string;
};

export type MarketingSummaryMetrics = {
  visits: number;
  orders: number;
  tickets: number;
  revenue: number;
  conversionRate: number;
  averageOrderValue: number;
  averageTicketValue: number;
  promoCodeUses: number;
  discountsGranted: number;
};

export type MarketingMetricComparison = {
  current: number;
  previous: number;
  absoluteChange: number;
  percentageChange: number | null;
  trend: "up" | "down" | "stable";
};

export type MarketingSummaryComparison = {
  visits: MarketingMetricComparison;
  orders: MarketingMetricComparison;
  tickets: MarketingMetricComparison;
  revenue: MarketingMetricComparison;
  conversionRate: MarketingMetricComparison;
  averageOrderValue: MarketingMetricComparison;
  averageTicketValue: MarketingMetricComparison;
  promoCodeUses: MarketingMetricComparison;
  discountsGranted: MarketingMetricComparison;
};

export type MarketingTimelineGroup =
  | "day"
  | "week"
  | "month";

export type MarketingTimelinePoint = {
  key: string;
  label: string;
  startsAt: string;
  endsAt: string;
  visits: number;
  orders: number;
  tickets: number;
  revenue: number;
  conversionRate: number;
  averageOrderValue: number;
};

export type MarketingSourceMetrics = {
  key: string;
  label: string;
  visits: number;
  orders: number;
  tickets: number;
  revenue: number;
  conversionRate: number;
  revenueShare: number;
};

export type MarketingCampaignMetrics = {
  campaignId: string;
  visits: number;
  orders: number;
  tickets: number;
  revenue: number;
  conversionRate: number;
  averageOrderValue: number;
};

export type MarketingCalculationInput = {
  visits?: readonly MarketingVisitRecord[];
  attributions?: readonly MarketingAttributionRecord[];
  promoCodeUsages?: readonly PromoCodeUsageRecord[];
  currency?: MarketingMetricCurrency;
};

export type MarketingComparisonInput = {
  current: MarketingCalculationInput;
  previous: MarketingCalculationInput;
};

export class MarketingMetricsError extends Error {
  readonly code: string;
  readonly cause?: unknown;

  constructor({
    code,
    message,
    cause,
  }: {
    code: string;
    message: string;
    cause?: unknown;
  }) {
    super(message);

    this.name =
      "MarketingMetricsError";

    this.code =
      code;

    this.cause =
      cause;
  }
}

const DEFAULT_SOURCE_LABEL =
  "Accès direct";

const DEFAULT_SOURCE_KEY =
  "direct";

const PERCENTAGE_DECIMALS =
  2;

const MONEY_DECIMALS =
  2;

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeSourceKey(
  value:
    | string
    | null
    | undefined,
): string {
  const normalized =
    normalizeText(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .replace(
        /[^a-z0-9]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      );

  return normalized ||
    DEFAULT_SOURCE_KEY;
}

function sourceLabelFromKey(
  value: string,
): string {
  if (
    value ===
    DEFAULT_SOURCE_KEY
  ) {
    return DEFAULT_SOURCE_LABEL;
  }

  return value
    .split("-")
    .filter(Boolean)
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1),
    )
    .join(" ");
}

function toFiniteNumber(
  value:
    MarketingMetricNumber,
): number {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  if (
    typeof value ===
    "number"
  ) {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  if (
    typeof value ===
    "string"
  ) {
    const normalized =
      value
        .trim()
        .replace(
          /\s/g,
          "",
        )
        .replace(
          ",",
          ".",
        );

    if (!normalized) {
      return 0;
    }

    const parsed =
      Number(normalized);

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  try {
    const parsed =
      value.toNumber();

    return Number.isFinite(parsed)
      ? parsed
      : 0;
  } catch {
    return 0;
  }
}

function roundNumber(
  value: number,
  decimals: number,
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor =
    10 ** decimals;

  return Math.round(
    (
      value +
      Number.EPSILON
    ) *
      factor,
  ) / factor;
}

function roundMoney(
  value: number,
): number {
  return roundNumber(
    value,
    MONEY_DECIMALS,
  );
}

function roundPercentage(
  value: number,
): number {
  return roundNumber(
    value,
    PERCENTAGE_DECIMALS,
  );
}

function safeDivide(
  numerator: number,
  denominator: number,
): number {
  if (
    !Number.isFinite(
      numerator,
    ) ||
    !Number.isFinite(
      denominator,
    ) ||
    denominator ===
      0
  ) {
    return 0;
  }

  return numerator /
    denominator;
}

function calculateConversionRate(
  orders: number,
  visits: number,
): number {
  return roundPercentage(
    safeDivide(
      orders,
      visits,
    ) *
      100,
  );
}

function parseDate(
  value:
    | Date
    | string,
  fieldName:
    string,
): Date {
  const parsed =
    value instanceof Date
      ? new Date(
          value.getTime(),
        )
      : new Date(value);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    throw new MarketingMetricsError({
      code:
        "INVALID_MARKETING_METRIC_DATE",

      message:
        `La date « ${fieldName} » est invalide.`,
    });
  }

  return parsed;
}

function normalizePeriod(
  period:
    MarketingMetricPeriod,
): {
  startsAt: Date;
  endsAt: Date;
} {
  const startsAt =
    parseDate(
      period.startsAt,
      "startsAt",
    );

  const endsAt =
    parseDate(
      period.endsAt,
      "endsAt",
    );

  if (
    endsAt.getTime() <
    startsAt.getTime()
  ) {
    throw new MarketingMetricsError({
      code:
        "INVALID_MARKETING_METRIC_PERIOD",

      message:
        "La date de fin de la période doit être postérieure ou égale à la date de début.",
    });
  }

  return {
    startsAt,
    endsAt,
  };
}

function isDateInsidePeriod(
  date:
    Date,
  period: {
    startsAt: Date;
    endsAt: Date;
  },
): boolean {
  const timestamp =
    date.getTime();

  return (
    timestamp >=
      period.startsAt.getTime() &&
    timestamp <=
      period.endsAt.getTime()
  );
}

function sumAttributionRevenue(
  attributions:
    readonly MarketingAttributionRecord[],
): number {
  return roundMoney(
    attributions.reduce(
      (
        total,
        attribution,
      ) =>
        total +
        Math.max(
          toFiniteNumber(
            attribution.revenue,
          ),
          0,
        ),
      0,
    ),
  );
}

function sumAttributionTickets(
  attributions:
    readonly MarketingAttributionRecord[],
): number {
  return Math.max(
    Math.round(
      attributions.reduce(
        (
          total,
          attribution,
        ) =>
          total +
          Math.max(
            toFiniteNumber(
              attribution.ticketsCount,
            ),
            0,
          ),
        0,
      ),
    ),
    0,
  );
}

function sumDiscounts({
  attributions,
  promoCodeUsages,
}: {
  attributions:
    readonly MarketingAttributionRecord[];
  promoCodeUsages:
    readonly PromoCodeUsageRecord[];
}): number {
  if (
    promoCodeUsages.length >
    0
  ) {
    return roundMoney(
      promoCodeUsages.reduce(
        (
          total,
          usage,
        ) =>
          total +
          Math.max(
            toFiniteNumber(
              usage.discountAmount,
            ),
            0,
          ),
        0,
      ),
    );
  }

  return roundMoney(
    attributions.reduce(
      (
        total,
        attribution,
      ) =>
        total +
        Math.max(
          toFiniteNumber(
            attribution.discountAmount,
          ),
          0,
        ),
      0,
    ),
  );
}

function createComparison(
  current: number,
  previous: number,
): MarketingMetricComparison {
  const absoluteChange =
    roundNumber(
      current -
        previous,
      MONEY_DECIMALS,
    );

  const percentageChange =
    previous ===
      0
      ? current ===
        0
        ? 0
        : null
      : roundPercentage(
          safeDivide(
            current -
              previous,
            Math.abs(
              previous,
            ),
          ) *
            100,
        );

  const trend =
    absoluteChange >
    0
      ? "up"
      : absoluteChange <
          0
        ? "down"
        : "stable";

  return {
    current,
    previous,
    absoluteChange,
    percentageChange,
    trend,
  };
}

function startOfDay(
  value: Date,
): Date {
  const result =
    new Date(value);

  result.setHours(
    0,
    0,
    0,
    0,
  );

  return result;
}

function endOfDay(
  value: Date,
): Date {
  const result =
    new Date(value);

  result.setHours(
    23,
    59,
    59,
    999,
  );

  return result;
}

function startOfWeek(
  value: Date,
): Date {
  const result =
    startOfDay(value);

  const day =
    result.getDay();

  const distanceFromMonday =
    day ===
    0
      ? 6
      : day -
        1;

  result.setDate(
    result.getDate() -
      distanceFromMonday,
  );

  return result;
}

function endOfWeek(
  value: Date,
): Date {
  const result =
    startOfWeek(value);

  result.setDate(
    result.getDate() +
      6,
  );

  return endOfDay(
    result,
  );
}

function startOfMonth(
  value: Date,
): Date {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    1,
    0,
    0,
    0,
    0,
  );
}

function endOfMonth(
  value: Date,
): Date {
  return new Date(
    value.getFullYear(),
    value.getMonth() +
      1,
    0,
    23,
    59,
    59,
    999,
  );
}

function getBucketRange({
  date,
  groupBy,
}: {
  date: Date;
  groupBy:
    MarketingTimelineGroup;
}): {
  startsAt: Date;
  endsAt: Date;
} {
  if (
    groupBy ===
    "week"
  ) {
    return {
      startsAt:
        startOfWeek(
          date,
        ),

      endsAt:
        endOfWeek(
          date,
        ),
    };
  }

  if (
    groupBy ===
    "month"
  ) {
    return {
      startsAt:
        startOfMonth(
          date,
        ),

      endsAt:
        endOfMonth(
          date,
        ),
    };
  }

  return {
    startsAt:
      startOfDay(
        date,
      ),

    endsAt:
      endOfDay(
        date,
      ),
  };
}

function formatBucketKey({
  date,
  groupBy,
}: {
  date: Date;
  groupBy:
    MarketingTimelineGroup;
}): string {
  if (
    groupBy ===
    "month"
  ) {
    return [
      date.getFullYear(),
      String(
        date.getMonth() +
          1,
      ).padStart(
        2,
        "0",
      ),
    ].join("-");
  }

  return startOfDay(date)
    .toISOString()
    .slice(
      0,
      10,
    );
}

function formatBucketLabel({
  startsAt,
  endsAt,
  groupBy,
}: {
  startsAt: Date;
  endsAt: Date;
  groupBy:
    MarketingTimelineGroup;
}): string {
  if (
    groupBy ===
    "month"
  ) {
    return new Intl.DateTimeFormat(
      "fr-FR",
      {
        month:
          "short",

        year:
          "numeric",
      },
    ).format(
      startsAt,
    );
  }

  if (
    groupBy ===
    "week"
  ) {
    const startLabel =
      new Intl.DateTimeFormat(
        "fr-FR",
        {
          day:
            "2-digit",

          month:
            "short",
        },
      ).format(
        startsAt,
      );

    const endLabel =
      new Intl.DateTimeFormat(
        "fr-FR",
        {
          day:
            "2-digit",

          month:
            "short",
        },
      ).format(
        endsAt,
      );

    return `${startLabel} – ${endLabel}`;
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day:
        "2-digit",

      month:
        "short",
    },
  ).format(
    startsAt,
  );
}

function incrementDate({
  date,
  groupBy,
}: {
  date: Date;
  groupBy:
    MarketingTimelineGroup;
}): Date {
  const result =
    new Date(date);

  if (
    groupBy ===
    "month"
  ) {
    result.setMonth(
      result.getMonth() +
        1,
    );

    return startOfMonth(
      result,
    );
  }

  if (
    groupBy ===
    "week"
  ) {
    result.setDate(
      result.getDate() +
        7,
    );

    return startOfWeek(
      result,
    );
  }

  result.setDate(
    result.getDate() +
      1,
  );

  return startOfDay(
    result,
  );
}

export function calculateMarketingSummary(
  input:
    MarketingCalculationInput,
): MarketingSummaryMetrics {
  const visits =
    input.visits ??
    [];

  const attributions =
    input.attributions ??
    [];

  const promoCodeUsages =
    input.promoCodeUsages ??
    [];

  const visitCount =
    visits.length;

  const orderCount =
    attributions.length;

  const tickets =
    sumAttributionTickets(
      attributions,
    );

  const revenue =
    sumAttributionRevenue(
      attributions,
    );

  const discountsGranted =
    sumDiscounts({
      attributions,
      promoCodeUsages,
    });

  return {
    visits:
      visitCount,

    orders:
      orderCount,

    tickets,

    revenue,

    conversionRate:
      calculateConversionRate(
        orderCount,
        visitCount,
      ),

    averageOrderValue:
      roundMoney(
        safeDivide(
          revenue,
          orderCount,
        ),
      ),

    averageTicketValue:
      roundMoney(
        safeDivide(
          revenue,
          tickets,
        ),
      ),

    promoCodeUses:
      promoCodeUsages.length,

    discountsGranted,
  };
}

export function compareMarketingSummaries(
  input:
    MarketingComparisonInput,
): {
  current:
    MarketingSummaryMetrics;
  previous:
    MarketingSummaryMetrics;
  comparison:
    MarketingSummaryComparison;
} {
  const current =
    calculateMarketingSummary(
      input.current,
    );

  const previous =
    calculateMarketingSummary(
      input.previous,
    );

  return {
    current,
    previous,

    comparison: {
      visits:
        createComparison(
          current.visits,
          previous.visits,
        ),

      orders:
        createComparison(
          current.orders,
          previous.orders,
        ),

      tickets:
        createComparison(
          current.tickets,
          previous.tickets,
        ),

      revenue:
        createComparison(
          current.revenue,
          previous.revenue,
        ),

      conversionRate:
        createComparison(
          current.conversionRate,
          previous.conversionRate,
        ),

      averageOrderValue:
        createComparison(
          current.averageOrderValue,
          previous.averageOrderValue,
        ),

      averageTicketValue:
        createComparison(
          current.averageTicketValue,
          previous.averageTicketValue,
        ),

      promoCodeUses:
        createComparison(
          current.promoCodeUses,
          previous.promoCodeUses,
        ),

      discountsGranted:
        createComparison(
          current.discountsGranted,
          previous.discountsGranted,
        ),
    },
  };
}

export function calculateMarketingTimeline({
  visits = [],
  attributions = [],
  period,
  groupBy = "day",
}: {
  visits?:
    readonly MarketingVisitRecord[];
  attributions?:
    readonly MarketingAttributionRecord[];
  period:
    MarketingMetricPeriod;
  groupBy?:
    MarketingTimelineGroup;
}): MarketingTimelinePoint[] {
  const normalizedPeriod =
    normalizePeriod(
      period,
    );

  const firstBucket =
    getBucketRange({
      date:
        normalizedPeriod.startsAt,

      groupBy,
    });

  const buckets =
    new Map<
      string,
      MarketingTimelinePoint
    >();

  let cursor =
    firstBucket.startsAt;

  while (
    cursor.getTime() <=
    normalizedPeriod.endsAt.getTime()
  ) {
    const range =
      getBucketRange({
        date:
          cursor,

        groupBy,
      });

    const key =
      formatBucketKey({
        date:
          range.startsAt,

        groupBy,
      });

    buckets.set(
      key,
      {
        key,

        label:
          formatBucketLabel({
            startsAt:
              range.startsAt,

            endsAt:
              range.endsAt,

            groupBy,
          }),

        startsAt:
          range.startsAt.toISOString(),

        endsAt:
          range.endsAt.toISOString(),

        visits:
          0,

        orders:
          0,

        tickets:
          0,

        revenue:
          0,

        conversionRate:
          0,

        averageOrderValue:
          0,
      },
    );

    cursor =
      incrementDate({
        date:
          cursor,

        groupBy,
      });
  }

  for (
    const visit of visits
  ) {
    const date =
      parseDate(
        visit.visitedAt,
        "visitedAt",
      );

    if (
      !isDateInsidePeriod(
        date,
        normalizedPeriod,
      )
    ) {
      continue;
    }

    const range =
      getBucketRange({
        date,
        groupBy,
      });

    const key =
      formatBucketKey({
        date:
          range.startsAt,

        groupBy,
      });

    const bucket =
      buckets.get(key);

    if (bucket) {
      bucket.visits +=
        1;
    }
  }

  for (
    const attribution of attributions
  ) {
    const date =
      parseDate(
        attribution.attributedAt,
        "attributedAt",
      );

    if (
      !isDateInsidePeriod(
        date,
        normalizedPeriod,
      )
    ) {
      continue;
    }

    const range =
      getBucketRange({
        date,
        groupBy,
      });

    const key =
      formatBucketKey({
        date:
          range.startsAt,

        groupBy,
      });

    const bucket =
      buckets.get(key);

    if (!bucket) {
      continue;
    }

    bucket.orders +=
      1;

    bucket.tickets +=
      Math.max(
        Math.round(
          toFiniteNumber(
            attribution.ticketsCount,
          ),
        ),
        0,
      );

    bucket.revenue =
      roundMoney(
        bucket.revenue +
          Math.max(
            toFiniteNumber(
              attribution.revenue,
            ),
            0,
          ),
      );
  }

  return Array.from(
    buckets.values(),
  ).map(
    (
      bucket,
    ) => ({
      ...bucket,

      conversionRate:
        calculateConversionRate(
          bucket.orders,
          bucket.visits,
        ),

      averageOrderValue:
        roundMoney(
          safeDivide(
            bucket.revenue,
            bucket.orders,
          ),
        ),
    }),
  );
}

export function calculateMarketingSources({
  visits = [],
  attributions = [],
}: {
  visits?:
    readonly MarketingVisitRecord[];
  attributions?:
    readonly MarketingAttributionRecord[];
}): MarketingSourceMetrics[] {
  const sources =
    new Map<
      string,
      MarketingSourceMetrics
    >();

  for (
    const visit of visits
  ) {
    const key =
      normalizeSourceKey(
        visit.source ??
        visit.channel,
      );

    const existing =
      sources.get(key) ??
      {
        key,

        label:
          sourceLabelFromKey(
            key,
          ),

        visits:
          0,

        orders:
          0,

        tickets:
          0,

        revenue:
          0,

        conversionRate:
          0,

        revenueShare:
          0,
      };

    existing.visits +=
      1;

    sources.set(
      key,
      existing,
    );
  }

  for (
    const attribution of attributions
  ) {
    const key =
      normalizeSourceKey(
        attribution.source ??
        attribution.medium,
      );

    const existing =
      sources.get(key) ??
      {
        key,

        label:
          sourceLabelFromKey(
            key,
          ),

        visits:
          0,

        orders:
          0,

        tickets:
          0,

        revenue:
          0,

        conversionRate:
          0,

        revenueShare:
          0,
      };

    existing.orders +=
      1;

    existing.tickets +=
      Math.max(
        Math.round(
          toFiniteNumber(
            attribution.ticketsCount,
          ),
        ),
        0,
      );

    existing.revenue =
      roundMoney(
        existing.revenue +
          Math.max(
            toFiniteNumber(
              attribution.revenue,
            ),
            0,
          ),
      );

    sources.set(
      key,
      existing,
    );
  }

  const totalRevenue =
    Array.from(
      sources.values(),
    ).reduce(
      (
        total,
        source,
      ) =>
        total +
        source.revenue,
      0,
    );

  return Array.from(
    sources.values(),
  )
    .map(
      (
        source,
      ) => ({
        ...source,

        conversionRate:
          calculateConversionRate(
            source.orders,
            source.visits,
          ),

        revenueShare:
          roundPercentage(
            safeDivide(
              source.revenue,
              totalRevenue,
            ) *
              100,
          ),
      }),
    )
    .sort(
      (
        left,
        right,
      ) =>
        right.revenue -
          left.revenue ||
        right.orders -
          left.orders ||
        right.visits -
          left.visits,
    );
}

export function calculateCampaignMetrics({
  campaignId,
  visits = [],
  attributions = [],
}: {
  campaignId: string;
  visits?:
    readonly MarketingVisitRecord[];
  attributions?:
    readonly MarketingAttributionRecord[];
}): MarketingCampaignMetrics {
  const normalizedCampaignId =
    normalizeText(
      campaignId,
    );

  if (
    !normalizedCampaignId
  ) {
    throw new MarketingMetricsError({
      code:
        "MARKETING_CAMPAIGN_ID_REQUIRED",

      message:
        "L’identifiant de la campagne est obligatoire.",
    });
  }

  const campaignVisits =
    visits.filter(
      (
        visit,
      ) =>
        normalizeText(
          visit.campaignId,
        ) ===
        normalizedCampaignId,
    );

  const campaignAttributions =
    attributions.filter(
      (
        attribution,
      ) =>
        normalizeText(
          attribution.campaignId,
        ) ===
        normalizedCampaignId,
    );

  const summary =
    calculateMarketingSummary({
      visits:
        campaignVisits,

      attributions:
        campaignAttributions,
    });

  return {
    campaignId:
      normalizedCampaignId,

    visits:
      summary.visits,

    orders:
      summary.orders,

    tickets:
      summary.tickets,

    revenue:
      summary.revenue,

    conversionRate:
      summary.conversionRate,

    averageOrderValue:
      summary.averageOrderValue,
  };
}

export function calculateTopCampaigns({
  campaignIds,
  visits = [],
  attributions = [],
  limit = 10,
  orderBy = "revenue",
}: {
  campaignIds:
    readonly string[];
  visits?:
    readonly MarketingVisitRecord[];
  attributions?:
    readonly MarketingAttributionRecord[];
  limit?:
    number;
  orderBy?:
    | "visits"
    | "orders"
    | "tickets"
    | "revenue"
    | "conversionRate";
}): MarketingCampaignMetrics[] {
  const normalizedLimit =
    Math.max(
      Math.min(
        Math.floor(limit),
        100,
      ),
      1,
    );

  return Array.from(
    new Set(
      campaignIds
        .map(
          (
            campaignId,
          ) =>
            normalizeText(
              campaignId,
            ),
        )
        .filter(Boolean),
    ),
  )
    .map(
      (
        campaignId,
      ) =>
        calculateCampaignMetrics({
          campaignId,
          visits,
          attributions,
        }),
    )
    .sort(
      (
        left,
        right,
      ) =>
        right[
          orderBy
        ] -
        left[
          orderBy
        ],
    )
    .slice(
      0,
      normalizedLimit,
    );
}

export function filterMarketingDataByPeriod({
  visits = [],
  attributions = [],
  promoCodeUsages = [],
  period,
}: {
  visits?:
    readonly MarketingVisitRecord[];
  attributions?:
    readonly MarketingAttributionRecord[];
  promoCodeUsages?:
    readonly PromoCodeUsageRecord[];
  period:
    MarketingMetricPeriod;
}): MarketingCalculationInput {
  const normalizedPeriod =
    normalizePeriod(
      period,
    );

  return {
    visits:
      visits.filter(
        (
          visit,
        ) =>
          isDateInsidePeriod(
            parseDate(
              visit.visitedAt,
              "visitedAt",
            ),
            normalizedPeriod,
          ),
      ),

    attributions:
      attributions.filter(
        (
          attribution,
        ) =>
          isDateInsidePeriod(
            parseDate(
              attribution.attributedAt,
              "attributedAt",
            ),
            normalizedPeriod,
          ),
      ),

    promoCodeUsages:
      promoCodeUsages.filter(
        (
          usage,
        ) =>
          isDateInsidePeriod(
            parseDate(
              usage.usedAt,
              "usedAt",
            ),
            normalizedPeriod,
          ),
      ),
  };
}

export function calculateReturnOnInvestment({
  revenue,
  budget,
}: {
  revenue:
    MarketingMetricNumber;
  budget:
    MarketingMetricNumber;
}): number | null {
  const normalizedRevenue =
    Math.max(
      toFiniteNumber(
        revenue,
      ),
      0,
    );

  const normalizedBudget =
    Math.max(
      toFiniteNumber(
        budget,
      ),
      0,
    );

  if (
    normalizedBudget ===
    0
  ) {
    return null;
  }

  return roundPercentage(
    safeDivide(
      normalizedRevenue -
        normalizedBudget,
      normalizedBudget,
    ) *
      100,
  );
}

export function calculateCostPerAcquisition({
  budget,
  orders,
}: {
  budget:
    MarketingMetricNumber;
  orders:
    MarketingMetricNumber;
}): number | null {
  const normalizedBudget =
    Math.max(
      toFiniteNumber(
        budget,
      ),
      0,
    );

  const normalizedOrders =
    Math.max(
      toFiniteNumber(
        orders,
      ),
      0,
    );

  if (
    normalizedOrders ===
    0
  ) {
    return null;
  }

  return roundMoney(
    safeDivide(
      normalizedBudget,
      normalizedOrders,
    ),
  );
}

export function calculateCostPerVisit({
  budget,
  visits,
}: {
  budget:
    MarketingMetricNumber;
  visits:
    MarketingMetricNumber;
}): number | null {
  const normalizedBudget =
    Math.max(
      toFiniteNumber(
        budget,
      ),
      0,
    );

  const normalizedVisits =
    Math.max(
      toFiniteNumber(
        visits,
      ),
      0,
    );

  if (
    normalizedVisits ===
    0
  ) {
    return null;
  }

  return roundMoney(
    safeDivide(
      normalizedBudget,
      normalizedVisits,
    ),
  );
}

export default calculateMarketingSummary;