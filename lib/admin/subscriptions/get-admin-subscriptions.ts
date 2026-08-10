import "server-only";

import {
  Prisma,
  SubscriptionBillingPeriod,
  SubscriptionStatus,
} from "@prisma/client";

import {
  AdminSubscriptionError,
} from "@/lib/admin/subscriptions/admin-subscription-errors";
import {
  prisma,
} from "@/lib/prisma";

export type AdminSubscriptionSort =
  | "recent"
  | "oldest"
  | "ending_soon"
  | "price_desc"
  | "price_asc";

export type GetAdminSubscriptionsInput =
  Readonly<{
    search?: string | null;
    status?: SubscriptionStatus | "all";
    planId?: string | null;
    billingPeriod?:
      | SubscriptionBillingPeriod
      | "all";
    currency?: string | null;
    autoRenew?: boolean | null;
    endingBefore?: Date | string | null;
    sort?: AdminSubscriptionSort;
    page?: number;
    pageSize?: number;
  }>;

export type AdminSubscriptionListItem =
  Readonly<{
    id: string;
    organizerId: string;
    planId: string;
    status: SubscriptionStatus;
    startsAt: Date | null;
    endsAt: Date | null;
    trialEndsAt: Date | null;
    autoRenew: boolean;
    canceledAt: Date | null;
    cancellationReason: string | null;
    createdAt: Date;
    updatedAt: Date;

    organizer:
      Readonly<{
        id: string;
        fullName: string;
        email: string;
        phone: string;
        country: string;
        isActive: boolean;
        businessName: string | null;
      }>;

    plan:
      Readonly<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        price: string;
        currency: string;
        billingPeriod: SubscriptionBillingPeriod;
        durationDays: number;
        maxBoostedEvents: number;
        priorityScore: number;
        features: Prisma.JsonValue | null;
        isActive: boolean;
        isPublic: boolean;
      }>;

    counts:
      Readonly<{
        payments: number;
        boosts: number;
      }>;
  }>;

export type GetAdminSubscriptionsResult =
  Readonly<{
    subscriptions:
      readonly AdminSubscriptionListItem[];

    pagination:
      Readonly<{
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
        hasPreviousPage: boolean;
        hasNextPage: boolean;
      }>;

    filters:
      Readonly<{
        search: string;
        status:
          | SubscriptionStatus
          | "all";
        planId: string;
        billingPeriod:
          | SubscriptionBillingPeriod
          | "all";
        currency: string;
        autoRenew:
          | boolean
          | null;
        endingBefore:
          | string
          | null;
        sort:
          AdminSubscriptionSort;
      }>;

    options:
      Readonly<{
        plans:
          readonly {
            id: string;
            code: string;
            name: string;
          }[];
        currencies:
          readonly string[];
      }>;
  }>;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 5000;

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value
    ?.replace(/\s+/g, " ")
    .trim() ?? "";
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (
    value === undefined ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    return fallback;
  }

  return value;
}

function parseOptionalDate(
  value:
    | Date
    | string
    | null
    | undefined,
): Date | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    value instanceof Date
      ? new Date(
          value.getTime(),
        )
      : new Date(
          value,
        );

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    throw new AdminSubscriptionError({
      code:
        "ADMIN_SUBSCRIPTION_INVALID_DATE",
      message:
        "La date de fin est invalide.",
      status:
        400,
    });
  }

  return parsed;
}

function normalizeSort(
  value:
    | AdminSubscriptionSort
    | undefined,
): AdminSubscriptionSort {
  switch (value) {
    case "oldest":
    case "ending_soon":
    case "price_desc":
    case "price_asc":
      return value;

    case "recent":
    default:
      return "recent";
  }
}

export function buildAdminSubscriptionWhere(
  input:
    GetAdminSubscriptionsInput,
): Prisma.OrganizerSubscriptionWhereInput {
  const search =
    normalizeText(
      input.search,
    );

  const planId =
    normalizeText(
      input.planId,
    );

  const currency =
    normalizeText(
      input.currency,
    ).toUpperCase();

  const endingBefore =
    parseOptionalDate(
      input.endingBefore,
    );

  const where:
    Prisma.OrganizerSubscriptionWhereInput =
    {};

  if (
    input.status &&
    input.status !== "all"
  ) {
    where.status =
      input.status;
  }

  if (planId) {
    where.planId =
      planId;
  }

  if (
    input.billingPeriod &&
    input.billingPeriod !==
      "all"
  ) {
    where.plan = {
      is: {
        billingPeriod:
          input.billingPeriod,
      },
    };
  }

  if (currency) {
    where.plan = {
      is: {
        ...(where.plan &&
        "is" in where.plan
          ? where.plan.is
          : {}),
        currency: {
          equals:
            currency,
          mode:
            "insensitive",
        },
      },
    };
  }

  if (
    input.autoRenew !==
      undefined &&
    input.autoRenew !==
      null
  ) {
    where.autoRenew =
      input.autoRenew;
  }

  if (endingBefore) {
    where.endsAt = {
      not:
        null,
      lte:
        endingBefore,
    };
  }

  if (search) {
    where.OR = [
      {
        id: {
          contains:
            search,
          mode:
            "insensitive",
        },
      },
      {
        organizer: {
          is: {
            OR: [
              {
                firstName: {
                  contains:
                    search,
                  mode:
                    "insensitive",
                },
              },
              {
                lastName: {
                  contains:
                    search,
                  mode:
                    "insensitive",
                },
              },
              {
                email: {
                  contains:
                    search,
                  mode:
                    "insensitive",
                },
              },
              {
                phone: {
                  contains:
                    search,
                  mode:
                    "insensitive",
                },
              },
              {
                organizerProfile: {
                  is: {
                    businessName: {
                      contains:
                        search,
                      mode:
                        "insensitive",
                    },
                  },
                },
              },
            ],
          },
        },
      },
      {
        plan: {
          is: {
            OR: [
              {
                name: {
                  contains:
                    search,
                  mode:
                    "insensitive",
                },
              },
              {
                code: {
                  contains:
                    search,
                  mode:
                    "insensitive",
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

function buildOrderBy(
  sort:
    AdminSubscriptionSort,
): Prisma.OrganizerSubscriptionOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [
        {
          createdAt:
            "asc",
        },
        {
          id:
            "asc",
        },
      ];

    case "ending_soon":
      return [
        {
          endsAt:
            "asc",
        },
        {
          createdAt:
            "desc",
        },
      ];

    case "price_desc":
      return [
        {
          plan: {
            price:
              "desc",
          },
        },
        {
          createdAt:
            "desc",
        },
      ];

    case "price_asc":
      return [
        {
          plan: {
            price:
              "asc",
          },
        },
        {
          createdAt:
            "desc",
        },
      ];

    case "recent":
    default:
      return [
        {
          createdAt:
            "desc",
        },
        {
          id:
            "desc",
        },
      ];
  }
}

export async function getAdminSubscriptions(
  input:
    GetAdminSubscriptionsInput = {},
): Promise<GetAdminSubscriptionsResult> {
  const page =
    normalizePositiveInteger(
      input.page,
      DEFAULT_PAGE,
    );

  const pageSize =
    Math.min(
      normalizePositiveInteger(
        input.pageSize,
        DEFAULT_PAGE_SIZE,
      ),
      MAX_PAGE_SIZE,
    );

  const sort =
    normalizeSort(
      input.sort,
    );

  const where =
    buildAdminSubscriptionWhere(
      input,
    );

  try {
    const [
      totalItems,
      rows,
      plans,
    ] =
      await Promise.all([
        prisma.organizerSubscription.count({
          where,
        }),

        prisma.organizerSubscription.findMany({
          where,

          skip:
            (page - 1) *
            pageSize,

          take:
            pageSize,

          orderBy:
            buildOrderBy(
              sort,
            ),

          select: {
            id:
              true,
            organizerId:
              true,
            planId:
              true,
            status:
              true,
            startsAt:
              true,
            endsAt:
              true,
            trialEndsAt:
              true,
            autoRenew:
              true,
            canceledAt:
              true,
            cancellationReason:
              true,
            createdAt:
              true,
            updatedAt:
              true,

            organizer: {
              select: {
                id:
                  true,
                firstName:
                  true,
                lastName:
                  true,
                email:
                  true,
                phone:
                  true,
                country:
                  true,
                isActive:
                  true,

                organizerProfile: {
                  select: {
                    businessName:
                      true,
                  },
                },
              },
            },

            plan: {
              select: {
                id:
                  true,
                code:
                  true,
                name:
                  true,
                description:
                  true,
                price:
                  true,
                currency:
                  true,
                billingPeriod:
                  true,
                durationDays:
                  true,
                maxBoostedEvents:
                  true,
                priorityScore:
                  true,
                features:
                  true,
                isActive:
                  true,
                isPublic:
                  true,
              },
            },

            _count: {
              select: {
                payments:
                  true,
                boosts:
                  true,
              },
            },
          },
        }),

        prisma.subscriptionPlan.findMany({
          orderBy: [
            {
              sortOrder:
                "asc",
            },
            {
              name:
                "asc",
            },
          ],

          select: {
            id:
              true,
            code:
              true,
            name:
              true,
            currency:
              true,
          },
        }),
      ]);

    const subscriptions =
      rows.map(
        (
          subscription,
        ): AdminSubscriptionListItem => ({
          id:
            subscription.id,
          organizerId:
            subscription.organizerId,
          planId:
            subscription.planId,
          status:
            subscription.status,
          startsAt:
            subscription.startsAt,
          endsAt:
            subscription.endsAt,
          trialEndsAt:
            subscription.trialEndsAt,
          autoRenew:
            subscription.autoRenew,
          canceledAt:
            subscription.canceledAt,
          cancellationReason:
            subscription.cancellationReason,
          createdAt:
            subscription.createdAt,
          updatedAt:
            subscription.updatedAt,

          organizer: {
            id:
              subscription.organizer.id,
            fullName:
              `${subscription.organizer.firstName} ${subscription.organizer.lastName}`
                .replace(
                  /\s+/g,
                  " ",
                )
                .trim(),
            email:
              subscription.organizer.email,
            phone:
              subscription.organizer.phone,
            country:
              subscription.organizer.country,
            isActive:
              subscription.organizer.isActive,
            businessName:
              subscription.organizer
                .organizerProfile
                ?.businessName ??
              null,
          },

          plan: {
            ...subscription.plan,
            price:
              subscription.plan.price.toFixed(
                2,
              ),
          },

          counts: {
            payments:
              subscription._count.payments,
            boosts:
              subscription._count.boosts,
          },
        }),
      );

    const totalPages =
      totalItems === 0
        ? 0
        : Math.ceil(
            totalItems /
              pageSize,
          );

    const currencies =
      Array.from(
        new Set(
          plans.map(
            (
              plan,
            ) =>
              plan.currency,
          ),
        ),
      ).sort();

    return {
      subscriptions,

      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasPreviousPage:
          page > 1,
        hasNextPage:
          page <
          totalPages,
      },

      filters: {
        search:
          normalizeText(
            input.search,
          ),
        status:
          input.status &&
          input.status !==
            "all"
            ? input.status
            : "all",
        planId:
          normalizeText(
            input.planId,
          ),
        billingPeriod:
          input.billingPeriod &&
          input.billingPeriod !==
            "all"
            ? input.billingPeriod
            : "all",
        currency:
          normalizeText(
            input.currency,
          ).toUpperCase(),
        autoRenew:
          input.autoRenew ??
          null,
        endingBefore:
          parseOptionalDate(
            input.endingBefore,
          )?.toISOString() ??
          null,
        sort,
      },

      options: {
        plans:
          plans.map(
            (
              plan,
            ) => ({
              id:
                plan.id,
              code:
                plan.code,
              name:
                plan.name,
            }),
          ),
        currencies,
      },
    };
  } catch (error) {
    if (
      error instanceof
      AdminSubscriptionError
    ) {
      throw error;
    }

    throw new AdminSubscriptionError({
      code:
        "ADMIN_SUBSCRIPTION_QUERY_FAILED",
      message:
        "Impossible de charger les abonnements organisateurs.",
      status:
        500,
      cause:
        error,
    });
  }
}
