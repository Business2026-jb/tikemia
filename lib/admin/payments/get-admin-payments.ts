import "server-only";

import {
  PaymentStatus,
  Prisma,
} from "@prisma/client";

import {
  AdminPaymentError,
} from "@/lib/admin/payments/admin-payment-errors";
import {
  prisma,
} from "@/lib/prisma";

export type AdminPaymentSort =
  | "recent"
  | "oldest"
  | "amount_desc"
  | "amount_asc";

export type GetAdminPaymentsInput =
  Readonly<{
    search?: string | null;
    status?: PaymentStatus | "all";
    provider?: string | null;
    currency?: string | null;
    method?: string | null;
    dateFrom?: Date | string | null;
    dateTo?: Date | string | null;
    sort?: AdminPaymentSort;
    page?: number;
    pageSize?: number;
  }>;

export type AdminPaymentListItem =
  Readonly<{
    id: string;
    orderId: string;
    provider: string;
    providerReference: string | null;
    providerTransactionId: string | null;
    method: string;
    amount: string;
    currency: string;
    status: PaymentStatus;
    customerEmail: string | null;
    customerPhone: string | null;
    failureCode: string | null;
    failureReason: string | null;
    initiatedAt: Date;
    paidAt: Date | null;
    failedAt: Date | null;
    cancelledAt: Date | null;
    refundedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;

    order:
      Readonly<{
        reference: string;
        customerId: string | null;
        customerName: string;
        customerEmail: string;
        customerPhone: string;
        subtotal: string;
        platformFee: string;
        total: string;
        currency: string;
        status: string;
        ticketsCount: number;
      }>;

    event:
      Readonly<{
        id: string;
        title: string;
        slug: string;
        city: string;
        country: string;
        startsAt: Date;
      }>;

    organizer:
      Readonly<{
        id: string;
        fullName: string;
        email: string;
        businessName: string | null;
      }>;

    attemptsCount: number;
    refundsCount: number;
    refundedAmount: string;
  }>;

export type GetAdminPaymentsResult =
  Readonly<{
    payments: readonly AdminPaymentListItem[];

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
        status: PaymentStatus | "all";
        provider: string;
        currency: string;
        method: string;
        dateFrom: string | null;
        dateTo: string | null;
        sort: AdminPaymentSort;
      }>;

    options:
      Readonly<{
        providers: readonly string[];
        currencies: readonly string[];
        methods: readonly string[];
      }>;
  }>;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 5000;

function normalizeText(
  value: string | null | undefined,
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

function normalizeSort(
  value: AdminPaymentSort | undefined,
): AdminPaymentSort {
  switch (value) {
    case "oldest":
    case "amount_desc":
    case "amount_asc":
      return value;

    case "recent":
    default:
      return "recent";
  }
}

function parseOptionalDate(
  value: Date | string | null | undefined,
  fieldName: string,
  endOfDay = false,
): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed =
    value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new AdminPaymentError({
      code: "ADMIN_PAYMENT_DATE_INVALID",
      message: `${fieldName} est invalide.`,
      status: 400,
      details: {
        field: fieldName,
      },
    });
  }

  if (endOfDay && typeof value === "string") {
    const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

    if (dateOnlyPattern.test(value.trim())) {
      parsed.setHours(
        23,
        59,
        59,
        999,
      );
    }
  }

  return parsed;
}

export function buildAdminPaymentWhere(
  input: GetAdminPaymentsInput,
): Prisma.PaymentWhereInput {
  const search = normalizeText(input.search);
  const provider = normalizeText(input.provider);
  const currency = normalizeText(input.currency).toUpperCase();
  const method = normalizeText(input.method);

  const dateFrom = parseOptionalDate(
    input.dateFrom,
    "La date de début",
  );

  const dateTo = parseOptionalDate(
    input.dateTo,
    "La date de fin",
    true,
  );

  if (
    dateFrom &&
    dateTo &&
    dateFrom.getTime() > dateTo.getTime()
  ) {
    throw new AdminPaymentError({
      code: "ADMIN_PAYMENT_DATE_INVALID",
      message:
        "La date de début ne peut pas être postérieure à la date de fin.",
      status: 400,
    });
  }

  const where: Prisma.PaymentWhereInput = {};

  if (
    input.status &&
    input.status !== "all"
  ) {
    where.status = input.status;
  }

  if (provider) {
    where.provider = {
      equals: provider,
      mode: "insensitive",
    };
  }

  if (currency) {
    where.currency = {
      equals: currency,
      mode: "insensitive",
    };
  }

  if (method) {
    where.method = {
      equals: method,
      mode: "insensitive",
    };
  }

  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom
        ? {
            gte: dateFrom,
          }
        : {}),

      ...(dateTo
        ? {
            lte: dateTo,
          }
        : {}),
    };
  }

  if (search) {
    where.OR = [
      {
        id: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        providerReference: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        providerTransactionId: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        customerEmail: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        customerPhone: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        order: {
          is: {
            OR: [
              {
                reference: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                customerName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                customerEmail: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                customerPhone: {
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
                        city: {
                          contains: search,
                          mode: "insensitive",
                        },
                      },
                      {
                        country: {
                          contains: search,
                          mode: "insensitive",
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
                    ],
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

function buildOrderBy(
  sort: AdminPaymentSort,
): Prisma.PaymentOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [
        {
          createdAt: "asc",
        },
        {
          id: "asc",
        },
      ];

    case "amount_desc":
      return [
        {
          amount: "desc",
        },
        {
          createdAt: "desc",
        },
      ];

    case "amount_asc":
      return [
        {
          amount: "asc",
        },
        {
          createdAt: "desc",
        },
      ];

    case "recent":
    default:
      return [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ];
  }
}

function uniqueSorted(
  values: readonly string[],
): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).sort((left, right) =>
    left.localeCompare(
      right,
      "fr",
      {
        sensitivity: "base",
      },
    ),
  );
}

export async function getAdminPayments(
  input: GetAdminPaymentsInput = {},
): Promise<GetAdminPaymentsResult> {
  const page = normalizePositiveInteger(
    input.page,
    DEFAULT_PAGE,
  );

  const pageSize = Math.min(
    normalizePositiveInteger(
      input.pageSize,
      DEFAULT_PAGE_SIZE,
    ),
    MAX_PAGE_SIZE,
  );

  const sort = normalizeSort(
    input.sort,
  );

  const where = buildAdminPaymentWhere(
    input,
  );

  try {
    const [
      totalItems,
      rawPayments,
      optionRows,
    ] = await Promise.all([
      prisma.payment.count({
        where,
      }),

      prisma.payment.findMany({
        where,

        skip:
          (page - 1) *
          pageSize,

        take: pageSize,

        orderBy:
          buildOrderBy(sort),

        select: {
          id: true,
          orderId: true,
          provider: true,
          providerReference: true,
          providerTransactionId: true,
          method: true,
          amount: true,
          currency: true,
          status: true,
          customerEmail: true,
          customerPhone: true,
          failureCode: true,
          failureReason: true,
          initiatedAt: true,
          paidAt: true,
          failedAt: true,
          cancelledAt: true,
          refundedAt: true,
          createdAt: true,
          updatedAt: true,

          order: {
            select: {
              reference: true,
              customerId: true,
              customerName: true,
              customerEmail: true,
              customerPhone: true,
              subtotal: true,
              platformFee: true,
              total: true,
              currency: true,
              status: true,

              event: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  city: true,
                  country: true,
                  startsAt: true,

                  organizer: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,

                      organizerProfile: {
                        select: {
                          businessName: true,
                        },
                      },
                    },
                  },
                },
              },

              _count: {
                select: {
                  tickets: true,
                },
              },
            },
          },

          attempts: {
            select: {
              id: true,
            },
          },

          refunds: {
            select: {
              amount: true,
            },
          },
        },
      }),

      prisma.payment.findMany({
        distinct: [
          "provider",
          "currency",
          "method",
        ],

        select: {
          provider: true,
          currency: true,
          method: true,
        },
      }),
    ]);

    const payments:
      AdminPaymentListItem[] =
      rawPayments.map((payment) => {
        const organizer =
          payment.order.event.organizer;

        const refundedAmount =
          payment.refunds.reduce(
            (total, refund) =>
              total.plus(
                refund.amount,
              ),
            new Prisma.Decimal(0),
          );

        return {
          id: payment.id,
          orderId: payment.orderId,
          provider: payment.provider,
          providerReference:
            payment.providerReference,
          providerTransactionId:
            payment.providerTransactionId,
          method: payment.method,
          amount:
            payment.amount.toFixed(2),
          currency: payment.currency,
          status: payment.status,
          customerEmail:
            payment.customerEmail,
          customerPhone:
            payment.customerPhone,
          failureCode:
            payment.failureCode,
          failureReason:
            payment.failureReason,
          initiatedAt:
            payment.initiatedAt,
          paidAt:
            payment.paidAt,
          failedAt:
            payment.failedAt,
          cancelledAt:
            payment.cancelledAt,
          refundedAt:
            payment.refundedAt,
          createdAt:
            payment.createdAt,
          updatedAt:
            payment.updatedAt,

          order: {
            reference:
              payment.order.reference,
            customerId:
              payment.order.customerId,
            customerName:
              payment.order.customerName,
            customerEmail:
              payment.order.customerEmail,
            customerPhone:
              payment.order.customerPhone,
            subtotal:
              payment.order.subtotal.toFixed(
                2,
              ),
            platformFee:
              payment.order.platformFee.toFixed(
                2,
              ),
            total:
              payment.order.total.toFixed(
                2,
              ),
            currency:
              payment.order.currency,
            status:
              payment.order.status,
            ticketsCount:
              payment.order._count.tickets,
          },

          event: {
            id:
              payment.order.event.id,
            title:
              payment.order.event.title,
            slug:
              payment.order.event.slug,
            city:
              payment.order.event.city,
            country:
              payment.order.event.country,
            startsAt:
              payment.order.event.startsAt,
          },

          organizer: {
            id:
              organizer.id,
            fullName:
              `${organizer.firstName} ${organizer.lastName}`
                .replace(/\s+/g, " ")
                .trim(),
            email:
              organizer.email,
            businessName:
              organizer.organizerProfile
                ?.businessName ??
              null,
          },

          attemptsCount:
            payment.attempts.length,
          refundsCount:
            payment.refunds.length,
          refundedAmount:
            refundedAmount.toFixed(2),
        };
      });

    const totalPages =
      totalItems === 0
        ? 0
        : Math.ceil(
            totalItems /
              pageSize,
          );

    const dateFrom = parseOptionalDate(
      input.dateFrom,
      "La date de début",
    );

    const dateTo = parseOptionalDate(
      input.dateTo,
      "La date de fin",
      true,
    );

    return {
      payments,

      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasPreviousPage:
          page > 1,
        hasNextPage:
          page < totalPages,
      },

      filters: {
        search:
          normalizeText(input.search),
        status:
          input.status &&
          input.status !== "all"
            ? input.status
            : "all",
        provider:
          normalizeText(input.provider),
        currency:
          normalizeText(
            input.currency,
          ).toUpperCase(),
        method:
          normalizeText(input.method),
        dateFrom:
          dateFrom?.toISOString() ??
          null,
        dateTo:
          dateTo?.toISOString() ??
          null,
        sort,
      },

      options: {
        providers:
          uniqueSorted(
            optionRows.map(
              (row) =>
                row.provider,
            ),
          ),

        currencies:
          uniqueSorted(
            optionRows.map(
              (row) =>
                row.currency,
            ),
          ),

        methods:
          uniqueSorted(
            optionRows.map(
              (row) =>
                row.method,
            ),
          ),
      },
    };
  } catch (error) {
    if (
      error instanceof
      AdminPaymentError
    ) {
      throw error;
    }

    throw new AdminPaymentError({
      code:
        "ADMIN_PAYMENT_QUERY_INVALID",
      message:
        "Impossible de charger les paiements Tikemia.",
      status: 500,
      cause: error,
    });
  }
}
