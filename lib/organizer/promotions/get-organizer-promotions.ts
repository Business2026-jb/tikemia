import "server-only";

import { createHash } from "node:crypto";

import {
  EventBoostStatus,
  EventStatus,
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
  type SubscriptionBillingPeriod,
} from "@prisma/client";
import { cookies } from "next/headers";

import {
  organizerPromotionsQuerySchema,
  type OrganizerPromotionsQueryInput,
} from "@/lib/organizer/promotions/promotion-schemas";
import {
  getSubscriptionPlans,
  type OrganizerSubscriptionPlan,
} from "@/lib/organizer/promotions/get-subscription-plans";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const DEFAULT_CURRENCY = "XOF";

/*
 * Règle de sécurité Premium :
 * seul un abonnement réellement ACTIVE peut donner des droits.
 *
 * PENDING, PAST_DUE, PAUSED, CANCELLED et EXPIRED restent des états
 * métier visibles dans l'interface et l'historique, mais ne doivent
 * jamais permettre de promouvoir un événement.
 */
const ACTIVE_SUBSCRIPTION_STATUSES =
  new Set<SubscriptionStatus>([
    SubscriptionStatus.ACTIVE,
  ]);

type SerializableDate =
  | string
  | null;

export type OrganizerPromotionOwner = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  preferredCurrency: string;
  hasBlueBadge: boolean;
  blueBadgeGrantedAt: SerializableDate;
  firstSubscribedAt: SerializableDate;
};

export type OrganizerPromotionSubscription = {
  id: string;
  status: SubscriptionStatus;
  startsAt: SerializableDate;
  endsAt: SerializableDate;
  trialEndsAt: SerializableDate;
  autoRenew: boolean;
  canceledAt: SerializableDate;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;

  isUsable: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  remainingDays: number | null;

  plan: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    price: number;
    currency: string;
    formattedPrice: string;
    billingPeriod:
      SubscriptionBillingPeriod;
    billingPeriodLabel: string;
    durationDays: number;
    maxBoostedEvents: number;
    priorityScore: number;
    features: OrganizerSubscriptionPlan["features"];
  };

  usage: {
    activeBoosts: number;
    remainingBoostSlots: number;
    usagePercentage: number;
  };
};

export type OrganizerPromotedEvent = {
  boostId: string;
  eventId: string;
  subscriptionId: string | null;
  source: string;
  status: EventBoostStatus;
  priorityScore: number;
  startsAt: string;
  endsAt: string;
  activatedAt: SerializableDate;
  pausedAt: SerializableDate;
  canceledAt: SerializableDate;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;

  isCurrentlyActive: boolean;
  isScheduled: boolean;
  isExpired: boolean;
  remainingDays: number;

  event: {
    id: string;
    title: string;
    slug: string;
    status: EventStatus;
    coverImage: string | null;
    startsAt: string;
    endsAt: SerializableDate;
    venueName: string;
    city: string;
    country: string;
    currency: string;
    publishedAt: SerializableDate;
  };

  metrics: {
    impressions: number;
    clicks: number;
    orders: number;
    tickets: number;
    revenue: number;
    conversionRate: number;
  };
};

export type OrganizerPromotionEligibleEvent = {
  id: string;
  title: string;
  slug: string;
  status: EventStatus;
  coverImage: string | null;
  startsAt: string;
  endsAt: SerializableDate;
  venueName: string;
  city: string;
  country: string;
  currency: string;
  publishedAt: SerializableDate;

  hasActiveBoost: boolean;
  activeBoostId: string | null;
  canBePromoted: boolean;
  ineligibilityReason: string | null;

  counts: {
    orders: number;
    tickets: number;
    ticketTypes: number;
  };
};

export type OrganizerPromotionPayment = {
  id: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  formattedAmount: string;
  provider: string;
  providerReference: string | null;
  status: PaymentStatus;
  failureReason: string | null;
  paidAt: SerializableDate;
  createdAt: string;
  updatedAt: string;
};

export type OrganizerPromotionHistoryItem = {
  id: string;
  type:
    | "SUBSCRIPTION"
    | "PAYMENT"
    | "BOOST";
  title: string;
  description: string | null;
  status: string;
  amount: number | null;
  currency: string | null;
  eventId: string | null;
  eventTitle: string | null;
  createdAt: string;
};

export type GetOrganizerPromotionsResult = {
  organizer: OrganizerPromotionOwner;

  summary: {
    hasActiveSubscription: boolean;
    totalPlans: number;
    totalSubscriptions: number;
    activeBoosts: number;
    scheduledBoosts: number;
    pausedBoosts: number;
    remainingBoostSlots: number;
    promotedEvents: number;
    totalImpressions: number;
    totalClicks: number;
    totalOrders: number;
    totalTickets: number;
    totalRevenue: number;
    conversionRate: number;
  };

  currentSubscription:
    | OrganizerPromotionSubscription
    | null;

  plans: OrganizerSubscriptionPlan[];

  promotedEvents:
    OrganizerPromotedEvent[];

  eligibleEvents:
    OrganizerPromotionEligibleEvent[];

  recentPayments:
    OrganizerPromotionPayment[];

  history:
    OrganizerPromotionHistoryItem[];

  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };

  filters: {
    search: string;
    subscriptionStatus:
      | SubscriptionStatus
      | null;
    boostStatus:
      | EventBoostStatus
      | null;
    historyType:
      | "ALL"
      | "SUBSCRIPTION"
      | "PAYMENT"
      | "BOOST";
    sort: string;
    includeHistory: boolean;
    includeAvailableEvents: boolean;
    includePlans: boolean;
  };
};

export class GetOrganizerPromotionsError extends Error {
  readonly code: string;
  readonly status: number;
  readonly redirectTo?: string;
  readonly fields?: Record<
    string,
    string[]
  >;

  constructor({
    code,
    message,
    status = 500,
    redirectTo,
    fields,
  }: {
    code: string;
    message: string;
    status?: number;
    redirectTo?: string;
    fields?: Record<
      string,
      string[]
    >;
  }) {
    super(message);

    this.name =
      "GetOrganizerPromotionsError";
    this.code = code;
    this.status = status;
    this.redirectTo = redirectTo;
    this.fields = fields;
  }
}

function hashSessionToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function decimalToNumber(
  value:
    | Prisma.Decimal
    | number
    | string
    | null
    | undefined,
): number {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function normalizeCurrency(
  value: string | null | undefined,
): string {
  const normalized =
    value?.trim().toUpperCase();

  return normalized &&
    /^[A-Z]{3}$/.test(normalized)
    ? normalized
    : DEFAULT_CURRENCY;
}

function formatMoney(
  amount: number,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency,
        maximumFractionDigits:
          currency === "XOF" ? 0 : 2,
      },
    ).format(amount);
  } catch {
    return `${amount.toLocaleString(
      "fr-FR",
    )} ${currency}`;
  }
}

function getBillingPeriodLabel(
  period: SubscriptionBillingPeriod,
): string {
  switch (period) {
    case "ONE_TIME":
      return "Paiement unique";

    case "MONTHLY":
      return "Mensuel";

    case "QUARTERLY":
      return "Trimestriel";

    case "YEARLY":
      return "Annuel";

    default:
      return period;
  }
}

function toIsoString(
  value: Date | null | undefined,
): SerializableDate {
  return value
    ? value.toISOString()
    : null;
}

function getRemainingDays(
  endsAt: Date | null,
): number | null {
  if (!endsAt) {
    return null;
  }

  const milliseconds =
    endsAt.getTime() -
    Date.now();

  return Math.max(
    Math.ceil(
      milliseconds /
        (1000 * 60 * 60 * 24),
    ),
    0,
  );
}

function getBoostRemainingDays(
  endsAt: Date,
): number {
  return (
    getRemainingDays(endsAt) ?? 0
  );
}

function calculatePercentage(
  used: number,
  total: number,
): number {
  if (total <= 0) {
    return 0;
  }

  return Math.min(
    Math.max(
      Math.round(
        (used / total) * 100,
      ),
      0,
    ),
    100,
  );
}

function calculateConversionRate(
  conversions: number,
  visits: number,
): number {
  if (
    conversions <= 0 ||
    visits <= 0
  ) {
    return 0;
  }

  return Number(
    (
      (conversions / visits) *
      100
    ).toFixed(2),
  );
}

function buildDisplayName({
  firstName,
  lastName,
  businessName,
}: {
  firstName: string;
  lastName: string;
  businessName: string | null;
}): string {
  return (
    businessName?.trim() ||
    `${firstName.trim()} ${lastName.trim()}`.trim() ||
    "Organisateur Tikemia"
  );
}

async function getAuthenticatedOrganizer() {
  const cookieStore = await cookies();

  const sessionCookieName =
    process.env.SESSION_COOKIE_NAME?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;

  const sessionToken =
    cookieStore.get(
      sessionCookieName,
    )?.value;

  if (!sessionToken) {
    throw new GetOrganizerPromotionsError({
      code: "UNAUTHORIZED",
      status: 401,
      message:
        "Votre session est absente ou expirée.",
      redirectTo:
        "/organizer/login",
    });
  }

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash:
          hashSessionToken(
            sessionToken,
          ),
      },

      select: {
        id: true,
        expiresAt: true,

        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            emailVerified: true,
            isActive: true,

            organizerProfile: {
              select: {
                businessName: true,
                hasBlueBadge: true,
                blueBadgeGrantedAt: true,
                firstSubscribedAt: true,
              },
            },

            organizerSettings: {
              select: {
                currency: true,
              },
            },
          },
        },
      },
    });

  if (!session) {
    throw new GetOrganizerPromotionsError({
      code: "INVALID_SESSION",
      status: 401,
      message:
        "Votre session n’est plus valide.",
      redirectTo:
        "/organizer/login",
    });
  }

  if (
    session.expiresAt.getTime() <=
    Date.now()
  ) {
    await prisma.session
      .delete({
        where: {
          id: session.id,
        },
      })
      .catch((error: unknown) => {
        console.error(
          "[GET_ORGANIZER_PROMOTIONS_EXPIRED_SESSION_DELETE_ERROR]",
          error instanceof Error
            ? error.message
            : error,
        );
      });

    throw new GetOrganizerPromotionsError({
      code: "EXPIRED_SESSION",
      status: 401,
      message:
        "Votre session a expiré. Reconnectez-vous.",
      redirectTo:
        "/organizer/login",
    });
  }

  if (
    session.user.role !==
      "ORGANIZER" ||
    !session.user.emailVerified ||
    !session.user.isActive
  ) {
    throw new GetOrganizerPromotionsError({
      code: "FORBIDDEN",
      status: 403,
      message:
        "Votre compte organisateur ne peut pas accéder à la Visibilité Premium.",
    });
  }

  return session.user;
}

function normalizeFeatures(
  value: Prisma.JsonValue | null,
): OrganizerSubscriptionPlan["features"] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        if (typeof item === "string") {
          const label =
            item.trim();

          return label
            ? {
                key:
                  `feature-${index + 1}`,
                label,
                description: null,
                included: true,
              }
            : null;
        }

        if (
          typeof item === "object" &&
          item !== null &&
          !Array.isArray(item)
        ) {
          const object =
            item as Record<
              string,
              Prisma.JsonValue
            >;

          const key =
            typeof object.key ===
              "string"
              ? object.key.trim()
              : `feature-${index + 1}`;

          const label =
            typeof object.label ===
              "string"
              ? object.label.trim()
              : key
                  .replace(
                    /[_-]+/g,
                    " ",
                  )
                  .trim();

          if (!label) {
            return null;
          }

          return {
            key,
            label,
            description:
              typeof object.description ===
                "string" &&
              object.description.trim()
                ? object.description.trim()
                : null,
            included:
              typeof object.included ===
              "boolean"
                ? object.included
                : true,
          };
        }

        return null;
      })
      .filter(
        (
          feature,
        ): feature is OrganizerSubscriptionPlan["features"][number] =>
          feature !== null,
      );
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    return Object.entries(
      value as Record<
        string,
        Prisma.JsonValue
      >,
    ).map(([key, item]) => ({
      key,
      label: key
        .replace(/[_-]+/g, " ")
        .trim(),
      description:
        typeof item === "string"
          ? item
          : null,
      included:
        typeof item === "boolean"
          ? item
          : true,
    }));
  }

  return [];
}

function buildHistory({
  subscriptions,
  payments,
  boosts,
}: {
  subscriptions: Array<{
    id: string;
    status: SubscriptionStatus;
    startsAt: Date | null;
    endsAt: Date | null;
    createdAt: Date;
    plan: {
      name: string;
      currency: string;
      price: Prisma.Decimal;
    };
  }>;
  payments: Array<{
    id: string;
    subscriptionId: string;
    amount: Prisma.Decimal;
    currency: string;
    provider: string;
    status: PaymentStatus;
    failureReason: string | null;
    createdAt: Date;
  }>;
  boosts: Array<{
    id: string;
    eventId: string;
    status: EventBoostStatus;
    cancellationReason: string | null;
    createdAt: Date;
    event: {
      title: string;
    };
  }>;
}): OrganizerPromotionHistoryItem[] {
  const subscriptionItems =
    subscriptions.map(
      (subscription) => ({
        id:
          `subscription:${subscription.id}`,
        type:
          "SUBSCRIPTION" as const,
        title:
          `Abonnement ${subscription.plan.name}`,
        description:
          subscription.endsAt
            ? `Période du ${
                subscription.startsAt?.toLocaleDateString(
                  "fr-FR",
                ) ?? "—"
              } au ${subscription.endsAt.toLocaleDateString(
                "fr-FR",
              )}`
            : null,
        status:
          subscription.status,
        amount:
          decimalToNumber(
            subscription.plan.price,
          ),
        currency:
          normalizeCurrency(
            subscription.plan.currency,
          ),
        eventId: null,
        eventTitle: null,
        createdAt:
          subscription.createdAt.toISOString(),
      }),
    );

  const paymentItems =
    payments.map((payment) => ({
      id:
        `payment:${payment.id}`,
      type: "PAYMENT" as const,
      title:
        `Paiement ${payment.provider}`,
      description:
        payment.failureReason,
      status:
        payment.status,
      amount:
        decimalToNumber(
          payment.amount,
        ),
      currency:
        normalizeCurrency(
          payment.currency,
        ),
      eventId: null,
      eventTitle: null,
      createdAt:
        payment.createdAt.toISOString(),
    }));

  const boostItems =
    boosts.map((boost) => ({
      id:
        `boost:${boost.id}`,
      type: "BOOST" as const,
      title:
        `Promotion de ${boost.event.title}`,
      description:
        boost.cancellationReason,
      status:
        boost.status,
      amount: null,
      currency: null,
      eventId:
        boost.eventId,
      eventTitle:
        boost.event.title,
      createdAt:
        boost.createdAt.toISOString(),
    }));

  return [
    ...subscriptionItems,
    ...paymentItems,
    ...boostItems,
  ].sort(
    (first, second) =>
      new Date(
        second.createdAt,
      ).getTime() -
      new Date(
        first.createdAt,
      ).getTime(),
  );
}

export async function getOrganizerPromotions(
  input: Partial<OrganizerPromotionsQueryInput> = {},
): Promise<GetOrganizerPromotionsResult> {
  try {
    const organizer =
      await getAuthenticatedOrganizer();

    const parsedInput =
      organizerPromotionsQuerySchema.safeParse(
        input,
      );

    if (!parsedInput.success) {
      const fields: Record<
        string,
        string[]
      > = {};

      for (
        const issue of
        parsedInput.error.issues
      ) {
        const path =
          issue.path.length > 0
            ? issue.path.join(".")
            : "_form";

        if (!fields[path]) {
          fields[path] = [];
        }

        fields[path].push(
          issue.message,
        );
      }

      throw new GetOrganizerPromotionsError({
        code: "INVALID_QUERY",
        status: 400,
        message:
          "Les filtres de la page Premium sont invalides.",
        fields,
      });
    }

    const filters =
      parsedInput.data;

    const preferredCurrency =
      normalizeCurrency(
        organizer.organizerSettings
          ?.currency,
      );

    const now = new Date();

    const [
      plansResult,
      subscriptions,
      boosts,
      eligibleEvents,
      payments,
      totalSubscriptions,
    ] = await Promise.all([
      filters.includePlans
        ? getSubscriptionPlans({
            currency:
              preferredCurrency,
          })
        : Promise.resolve(null),

      prisma.organizerSubscription.findMany({
        where: {
          organizerId:
            organizer.id,

          ...(filters
            .subscriptionStatus
            ? {
                status:
                  filters
                    .subscriptionStatus,
              }
            : {}),
        },

        orderBy: [
          {
            createdAt: "desc",
          },
          {
            id: "desc",
          },
        ],

        select: {
          id: true,
          status: true,
          startsAt: true,
          endsAt: true,
          trialEndsAt: true,
          autoRenew: true,
          canceledAt: true,
          cancellationReason: true,
          createdAt: true,
          updatedAt: true,

          plan: {
            select: {
              id: true,
              code: true,
              name: true,
              description: true,
              price: true,
              currency: true,
              billingPeriod: true,
              durationDays: true,
              maxBoostedEvents: true,
              priorityScore: true,
              features: true,
            },
          },

          _count: {
            select: {
              boosts: {
                where: {
                  status: {
                    in: [
                      EventBoostStatus.SCHEDULED,
                      EventBoostStatus.ACTIVE,
                      EventBoostStatus.PAUSED,
                    ],
                  },
                },
              },
            },
          },
        },
      }),

      prisma.eventBoost.findMany({
        where: {
          organizerId:
            organizer.id,

          ...(filters.boostStatus
            ? {
                status:
                  filters.boostStatus,
              }
            : {}),

          ...(filters.search
            ? {
                event: {
                  title: {
                    contains:
                      filters.search,
                    mode:
                      "insensitive",
                  },
                },
              }
            : {}),
        },

        orderBy: [
          {
            priorityScore: "desc",
          },
          {
            startsAt: "desc",
          },
          {
            createdAt: "desc",
          },
        ],

        select: {
          id: true,
          organizerId: true,
          eventId: true,
          subscriptionId: true,
          source: true,
          status: true,
          priorityScore: true,
          startsAt: true,
          endsAt: true,
          activatedAt: true,
          pausedAt: true,
          canceledAt: true,
          cancellationReason: true,
          createdAt: true,
          updatedAt: true,

          event: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              coverImage: true,
              startsAt: true,
              endsAt: true,
              venueName: true,
              city: true,
              country: true,
              currency: true,
              publishedAt: true,

              _count: {
                select: {
                  marketingVisits: true,
                  orders: true,
                  tickets: true,
                },
              },

              orders: {
                where: {
                  status: "PAID",
                },
                select: {
                  total: true,
                },
              },
            },
          },
        },
      }),

      filters.includeAvailableEvents
        ? prisma.event.findMany({
            where: {
              organizerId:
                organizer.id,

              status: {
                in: [
                  EventStatus.PUBLISHED,
                  EventStatus.SUSPENDED,
                ],
              },

              ...(filters.search
                ? {
                    OR: [
                      {
                        title: {
                          contains:
                            filters.search,
                          mode:
                            "insensitive",
                        },
                      },
                      {
                        city: {
                          contains:
                            filters.search,
                          mode:
                            "insensitive",
                        },
                      },
                    ],
                  }
                : {}),
            },

            orderBy: [
              {
                startsAt: "asc",
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
              coverImage: true,
              startsAt: true,
              endsAt: true,
              venueName: true,
              city: true,
              country: true,
              currency: true,
              publishedAt: true,

              boosts: {
                where: {
                  status: {
                    in: [
                      EventBoostStatus.SCHEDULED,
                      EventBoostStatus.ACTIVE,
                      EventBoostStatus.PAUSED,
                    ],
                  },
                },
                take: 1,
                orderBy: {
                  createdAt: "desc",
                },
                select: {
                  id: true,
                  status: true,
                },
              },

              _count: {
                select: {
                  orders: true,
                  tickets: true,
                  ticketTypes: true,
                },
              },
            },
          })
        : Promise.resolve([]),

      prisma.subscriptionPayment.findMany({
        where: {
          organizerId:
            organizer.id,
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 20,

        select: {
          id: true,
          subscriptionId: true,
          amount: true,
          currency: true,
          provider: true,
          providerReference: true,
          status: true,
          failureReason: true,
          paidAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

      prisma.organizerSubscription.count({
        where: {
          organizerId:
            organizer.id,
        },
      }),
    ]);

    /*
     * L'abonnement "courant" utilisable est recherché en priorité.
     * Une souscription n'accorde des droits Premium que si :
     * - son statut est ACTIVE ;
     * - startsAt existe et a déjà commencé ;
     * - endsAt existe et est encore dans le futur.
     *
     * Si aucun abonnement utilisable n'existe, on conserve le dernier
     * abonnement uniquement pour afficher son état (PENDING, CANCELLED,
     * EXPIRED, etc.). Cette valeur de secours ne donnera aucun droit.
     */
    const usableSubscriptionRaw =
      subscriptions.find(
        (subscription) =>
          ACTIVE_SUBSCRIPTION_STATUSES.has(
            subscription.status,
          ) &&
          subscription.startsAt !== null &&
          subscription.startsAt.getTime() <=
            now.getTime() &&
          subscription.endsAt !== null &&
          subscription.endsAt.getTime() >
            now.getTime(),
      ) ??
      null;

    const currentSubscriptionRaw =
      usableSubscriptionRaw ??
      subscriptions[0] ??
      null;

    const currentSubscription:
      | OrganizerPromotionSubscription
      | null =
      currentSubscriptionRaw
        ? (() => {
            const planPrice =
              decimalToNumber(
                currentSubscriptionRaw
                  .plan.price,
              );

            const planCurrency =
              normalizeCurrency(
                currentSubscriptionRaw
                  .plan.currency,
              );

            const activeBoosts =
              currentSubscriptionRaw
                ._count.boosts;

            const remainingBoostSlots =
              Math.max(
                currentSubscriptionRaw
                  .plan.maxBoostedEvents -
                  activeBoosts,
                0,
              );

            const remainingDays =
              getRemainingDays(
                currentSubscriptionRaw
                  .endsAt,
              );

            const isExpired =
              currentSubscriptionRaw
                .status ===
                SubscriptionStatus.EXPIRED ||
              (
                currentSubscriptionRaw
                  .endsAt !== null &&
                currentSubscriptionRaw
                  .endsAt.getTime() <=
                  now.getTime()
              );

            const isUsable =
              currentSubscriptionRaw.status ===
                SubscriptionStatus.ACTIVE &&
              currentSubscriptionRaw.startsAt !==
                null &&
              currentSubscriptionRaw.startsAt.getTime() <=
                now.getTime() &&
              currentSubscriptionRaw.endsAt !==
                null &&
              currentSubscriptionRaw.endsAt.getTime() >
                now.getTime() &&
              !isExpired;

            const usableRemainingBoostSlots =
              isUsable
                ? remainingBoostSlots
                : 0;

            return {
              id:
                currentSubscriptionRaw.id,
              status:
                currentSubscriptionRaw.status,
              startsAt:
                toIsoString(
                  currentSubscriptionRaw
                    .startsAt,
                ),
              endsAt:
                toIsoString(
                  currentSubscriptionRaw
                    .endsAt,
                ),
              trialEndsAt:
                toIsoString(
                  currentSubscriptionRaw
                    .trialEndsAt,
                ),
              autoRenew:
                currentSubscriptionRaw
                  .autoRenew,
              canceledAt:
                toIsoString(
                  currentSubscriptionRaw
                    .canceledAt,
                ),
              cancellationReason:
                currentSubscriptionRaw
                  .cancellationReason,
              createdAt:
                currentSubscriptionRaw
                  .createdAt.toISOString(),
              updatedAt:
                currentSubscriptionRaw
                  .updatedAt.toISOString(),

              isUsable,
              isExpired,
              isExpiringSoon:
                remainingDays !== null &&
                remainingDays <= 7 &&
                !isExpired,
              remainingDays,

              plan: {
                id:
                  currentSubscriptionRaw
                    .plan.id,
                code:
                  currentSubscriptionRaw
                    .plan.code,
                name:
                  currentSubscriptionRaw
                    .plan.name,
                description:
                  currentSubscriptionRaw
                    .plan.description,
                price:
                  planPrice,
                currency:
                  planCurrency,
                formattedPrice:
                  formatMoney(
                    planPrice,
                    planCurrency,
                  ),
                billingPeriod:
                  currentSubscriptionRaw
                    .plan.billingPeriod,
                billingPeriodLabel:
                  getBillingPeriodLabel(
                    currentSubscriptionRaw
                      .plan.billingPeriod,
                  ),
                durationDays:
                  currentSubscriptionRaw
                    .plan.durationDays,
                maxBoostedEvents:
                  currentSubscriptionRaw
                    .plan.maxBoostedEvents,
                priorityScore:
                  currentSubscriptionRaw
                    .plan.priorityScore,
                features:
                  normalizeFeatures(
                    currentSubscriptionRaw
                      .plan.features,
                  ),
              },

              usage: {
                activeBoosts:
                  isUsable
                    ? activeBoosts
                    : 0,
                remainingBoostSlots:
                  usableRemainingBoostSlots,
                usagePercentage:
                  isUsable
                    ? calculatePercentage(
                        activeBoosts,
                        currentSubscriptionRaw
                          .plan.maxBoostedEvents,
                      )
                    : 0,
              },
            };
          })()
        : null;

    const normalizedBoosts:
      OrganizerPromotedEvent[] =
      boosts.map((boost) => {
        const impressions =
          boost.event._count
            .marketingVisits;

        const clicks = impressions;

        const orders =
          boost.event._count.orders;

        const tickets =
          boost.event._count.tickets;

        const revenue =
          boost.event.orders.reduce(
            (total, order) =>
              total +
              decimalToNumber(
                order.total,
              ),
            0,
          );

        const isCurrentlyActive =
          boost.status ===
            EventBoostStatus.ACTIVE &&
          boost.startsAt.getTime() <=
            now.getTime() &&
          boost.endsAt.getTime() >
            now.getTime();

        return {
          boostId: boost.id,
          eventId:
            boost.eventId,
          subscriptionId:
            boost.subscriptionId,
          source:
            boost.source,
          status:
            boost.status,
          priorityScore:
            boost.priorityScore,
          startsAt:
            boost.startsAt.toISOString(),
          endsAt:
            boost.endsAt.toISOString(),
          activatedAt:
            toIsoString(
              boost.activatedAt,
            ),
          pausedAt:
            toIsoString(
              boost.pausedAt,
            ),
          canceledAt:
            toIsoString(
              boost.canceledAt,
            ),
          cancellationReason:
            boost.cancellationReason,
          createdAt:
            boost.createdAt.toISOString(),
          updatedAt:
            boost.updatedAt.toISOString(),

          isCurrentlyActive,
          isScheduled:
            boost.status ===
              EventBoostStatus.SCHEDULED ||
            boost.startsAt.getTime() >
              now.getTime(),
          isExpired:
            boost.status ===
              EventBoostStatus.EXPIRED ||
            boost.endsAt.getTime() <=
              now.getTime(),
          remainingDays:
            getBoostRemainingDays(
              boost.endsAt,
            ),

          event: {
            id:
              boost.event.id,
            title:
              boost.event.title,
            slug:
              boost.event.slug,
            status:
              boost.event.status,
            coverImage:
              boost.event.coverImage,
            startsAt:
              boost.event.startsAt.toISOString(),
            endsAt:
              toIsoString(
                boost.event.endsAt,
              ),
            venueName:
              boost.event.venueName,
            city:
              boost.event.city,
            country:
              boost.event.country,
            currency:
              normalizeCurrency(
                boost.event.currency,
              ),
            publishedAt:
              toIsoString(
                boost.event
                  .publishedAt,
              ),
          },

          metrics: {
            impressions,
            clicks,
            orders,
            tickets,
            revenue,
            conversionRate:
              calculateConversionRate(
                orders,
                clicks,
              ),
          },
        };
      });

    const hasUsableSubscription =
      Boolean(
        currentSubscription?.isUsable,
      );

    const normalizedEligibleEvents:
      OrganizerPromotionEligibleEvent[] =
      eligibleEvents.map((event) => {
        const activeBoost =
          event.boosts[0] ??
          null;

        const eventHasEnded =
          event.endsAt
            ? event.endsAt.getTime() <=
              now.getTime()
            : event.startsAt.getTime() <=
              now.getTime();

        const isPublished =
          event.status ===
          EventStatus.PUBLISHED;

        const canBePromoted =
          hasUsableSubscription &&
          isPublished &&
          !eventHasEnded &&
          !activeBoost;

        let ineligibilityReason:
          | string
          | null = null;

        if (!hasUsableSubscription) {
          ineligibilityReason =
            "Un abonnement Premium actif et payé est nécessaire pour promouvoir cet événement.";
        } else if (!isPublished) {
          ineligibilityReason =
            "Seuls les événements publiés peuvent être promus.";
        } else if (eventHasEnded) {
          ineligibilityReason =
            "Cet événement est déjà terminé.";
        } else if (activeBoost) {
          ineligibilityReason =
            "Cet événement possède déjà une promotion active ou programmée.";
        }

        return {
          id: event.id,
          title:
            event.title,
          slug:
            event.slug,
          status:
            event.status,
          coverImage:
            event.coverImage,
          startsAt:
            event.startsAt.toISOString(),
          endsAt:
            toIsoString(
              event.endsAt,
            ),
          venueName:
            event.venueName,
          city:
            event.city,
          country:
            event.country,
          currency:
            normalizeCurrency(
              event.currency,
            ),
          publishedAt:
            toIsoString(
              event.publishedAt,
            ),

          hasActiveBoost:
            Boolean(activeBoost),
          activeBoostId:
            activeBoost?.id ??
            null,
          canBePromoted,
          ineligibilityReason,

          counts: {
            orders:
              event._count.orders,
            tickets:
              event._count.tickets,
            ticketTypes:
              event._count
                .ticketTypes,
          },
        };
      });

    const normalizedPayments:
      OrganizerPromotionPayment[] =
      payments.map((payment) => {
        const amount =
          decimalToNumber(
            payment.amount,
          );

        const currency =
          normalizeCurrency(
            payment.currency,
          );

        return {
          id: payment.id,
          subscriptionId:
            payment.subscriptionId,
          amount,
          currency,
          formattedAmount:
            formatMoney(
              amount,
              currency,
            ),
          provider:
            payment.provider,
          providerReference:
            payment.providerReference,
          status:
            payment.status,
          failureReason:
            payment.failureReason,
          paidAt:
            toIsoString(
              payment.paidAt,
            ),
          createdAt:
            payment.createdAt.toISOString(),
          updatedAt:
            payment.updatedAt.toISOString(),
        };
      });

    const historyAll =
      buildHistory({
        subscriptions:
          subscriptions.map(
            (subscription) => ({
              id:
                subscription.id,
              status:
                subscription.status,
              startsAt:
                subscription.startsAt,
              endsAt:
                subscription.endsAt,
              createdAt:
                subscription.createdAt,
              plan: {
                name:
                  subscription.plan
                    .name,
                currency:
                  subscription.plan
                    .currency,
                price:
                  subscription.plan
                    .price,
              },
            }),
          ),
        payments,
        boosts:
          boosts.map((boost) => ({
            id: boost.id,
            eventId:
              boost.eventId,
            status:
              boost.status,
            cancellationReason:
              boost.cancellationReason,
            createdAt:
              boost.createdAt,
            event: {
              title:
                boost.event.title,
            },
          })),
      });

    const filteredHistory =
      historyAll.filter((item) => {
        if (
          filters.historyType !==
            "ALL" &&
          item.type !==
            filters.historyType
        ) {
          return false;
        }

        if (
          filters.search &&
          ![
            item.title,
            item.description ?? "",
            item.eventTitle ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(
              filters.search.toLowerCase(),
            )
        ) {
          return false;
        }

        return true;
      });

    const total =
      filteredHistory.length;

    const totalPages =
      total === 0
        ? 0
        : Math.ceil(
            total /
              filters.pageSize,
          );

    const startIndex =
      (filters.page - 1) *
      filters.pageSize;

    const paginatedHistory =
      filters.includeHistory
        ? filteredHistory.slice(
            startIndex,
            startIndex +
              filters.pageSize,
          )
        : [];

    const activeBoosts =
      normalizedBoosts.filter(
        (boost) =>
          boost.status ===
          EventBoostStatus.ACTIVE,
      ).length;

    const scheduledBoosts =
      normalizedBoosts.filter(
        (boost) =>
          boost.status ===
          EventBoostStatus.SCHEDULED,
      ).length;

    const pausedBoosts =
      normalizedBoosts.filter(
        (boost) =>
          boost.status ===
          EventBoostStatus.PAUSED,
      ).length;

    const totalImpressions =
      normalizedBoosts.reduce(
        (totalValue, boost) =>
          totalValue +
          boost.metrics.impressions,
        0,
      );

    const totalClicks =
      normalizedBoosts.reduce(
        (totalValue, boost) =>
          totalValue +
          boost.metrics.clicks,
        0,
      );

    const totalOrders =
      normalizedBoosts.reduce(
        (totalValue, boost) =>
          totalValue +
          boost.metrics.orders,
        0,
      );

    const totalTickets =
      normalizedBoosts.reduce(
        (totalValue, boost) =>
          totalValue +
          boost.metrics.tickets,
        0,
      );

    const totalRevenue =
      normalizedBoosts.reduce(
        (totalValue, boost) =>
          totalValue +
          boost.metrics.revenue,
        0,
      );

    const plans =
      plansResult?.plans ??
      [];

    return {
      organizer: {
        id: organizer.id,
        firstName:
          organizer.firstName.trim(),
        lastName:
          organizer.lastName.trim(),
        displayName:
          buildDisplayName({
            firstName:
              organizer.firstName,
            lastName:
              organizer.lastName,
            businessName:
              organizer
                .organizerProfile
                ?.businessName ??
              null,
          }),
        email:
          organizer.email,
        preferredCurrency,
        hasBlueBadge:
          organizer.organizerProfile
            ?.hasBlueBadge ??
          false,
        blueBadgeGrantedAt:
          toIsoString(
            organizer.organizerProfile
              ?.blueBadgeGrantedAt,
          ),
        firstSubscribedAt:
          toIsoString(
            organizer.organizerProfile
              ?.firstSubscribedAt,
          ),
      },

      summary: {
        hasActiveSubscription:
          Boolean(
            currentSubscription
              ?.isUsable,
          ),
        totalPlans:
          plans.length,
        totalSubscriptions,
        activeBoosts,
        scheduledBoosts,
        pausedBoosts,
        remainingBoostSlots:
          currentSubscription
            ?.isUsable
            ? currentSubscription
                .usage
                .remainingBoostSlots
            : 0,
        promotedEvents:
          normalizedBoosts.length,
        totalImpressions,
        totalClicks,
        totalOrders,
        totalTickets,
        totalRevenue,
        conversionRate:
          calculateConversionRate(
            totalOrders,
            totalClicks,
          ),
      },

      currentSubscription,

      plans,

      promotedEvents:
        normalizedBoosts,

      eligibleEvents:
        normalizedEligibleEvents,

      recentPayments:
        normalizedPayments,

      history:
        paginatedHistory,

      pagination: {
        page:
          filters.page,
        pageSize:
          filters.pageSize,
        total,
        totalPages,
        hasPreviousPage:
          filters.page > 1,
        hasNextPage:
          filters.page <
          totalPages,
      },

      filters: {
        search:
          filters.search ?? "",
        subscriptionStatus:
          filters
            .subscriptionStatus ??
          null,
        boostStatus:
          filters.boostStatus ??
          null,
        historyType:
          filters.historyType,
        sort:
          filters.sort,
        includeHistory:
          filters.includeHistory,
        includeAvailableEvents:
          filters
            .includeAvailableEvents,
        includePlans:
          filters.includePlans,
      },
    };
  } catch (error) {
    if (
      error instanceof
      GetOrganizerPromotionsError
    ) {
      throw error;
    }

    console.error(
      "[GET_ORGANIZER_PROMOTIONS_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    throw new GetOrganizerPromotionsError({
      code:
        "GET_ORGANIZER_PROMOTIONS_FAILED",
      status: 500,
      message:
        "Impossible de charger la Visibilité Premium pour le moment.",
    });
  }
}