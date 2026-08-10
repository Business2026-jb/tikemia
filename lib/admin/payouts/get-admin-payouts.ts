import "server-only";

import {
  PayoutDestinationType,
  PayoutStatus,
  Prisma,
} from "@prisma/client";

import {
  AdminPayoutError,
} from "@/lib/admin/payouts/admin-payout-errors";
import {
  prisma,
} from "@/lib/prisma";

export type AdminPayoutSort =
  | "recent"
  | "oldest"
  | "amount_desc"
  | "amount_asc";

export type GetAdminPayoutsInput =
  Readonly<{
    search?: string | null;
    status?: PayoutStatus | "all";
    destinationType?: PayoutDestinationType | "all";
    currency?: string | null;
    dateFrom?: Date | string | null;
    dateTo?: Date | string | null;
    sort?: AdminPayoutSort;
    page?: number;
    pageSize?: number;
  }>;

export type AdminPayoutListItem =
  Readonly<{
    id: string;
    organizerId: string;
    reference: string | null;
    amount: string;
    fee: string;
    netAmount: string;
    currency: string;
    status: PayoutStatus;
    note: string | null;
    adminNote: string | null;
    rejectionReason: string | null;
    destinationId: string | null;
    destinationType: PayoutDestinationType | null;
    requestedAt: Date;
    processedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;

    organizer:
      Readonly<{
        id: string;
        fullName: string;
        email: string;
        phone: string;
        country: string;
        businessName: string | null;
      }>;

    destination:
      Readonly<{
        id: string;
        type: PayoutDestinationType;
        status: string;
        country: string;
        currency: string;
        accountName: string;
        mobileProvider: string | null;
        phoneCountryCode: string | null;
        phoneNumberLast4: string | null;
        bankName: string | null;
        bankAccountNumberLast4: string | null;
        ibanLast4: string | null;
        swiftBic: string | null;
        cryptoNetwork: string | null;
        cryptoAddressLast6: string | null;
        isDefault: boolean;
        isActive: boolean;
      } | null>;
  }>;

export type GetAdminPayoutsResult =
  Readonly<{
    payouts: readonly AdminPayoutListItem[];

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
        status: PayoutStatus | "all";
        destinationType:
          | PayoutDestinationType
          | "all";
        currency: string;
        dateFrom: string | null;
        dateTo: string | null;
        sort: AdminPayoutSort;
      }>;

    options:
      Readonly<{
        currencies: readonly string[];
        destinationTypes:
          readonly PayoutDestinationType[];
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
  value: AdminPayoutSort | undefined,
): AdminPayoutSort {
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
  label: string,
  endOfDay = false,
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
      ? new Date(value.getTime())
      : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new AdminPayoutError({
      code: "ADMIN_PAYOUT_DATE_INVALID",
      message: `${label} est invalide.`,
      status: 400,
      details: {
        field: label,
      },
    });
  }

  if (
    endOfDay &&
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      value.trim(),
    )
  ) {
    parsed.setHours(
      23,
      59,
      59,
      999,
    );
  }

  return parsed;
}

export function buildAdminPayoutWhere(
  input: GetAdminPayoutsInput,
): Prisma.PayoutWhereInput {
  const search = normalizeText(
    input.search,
  );

  const currency = normalizeText(
    input.currency,
  ).toUpperCase();

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
    dateFrom.getTime() >
      dateTo.getTime()
  ) {
    throw new AdminPayoutError({
      code:
        "ADMIN_PAYOUT_DATE_INVALID",
      message:
        "La date de début ne peut pas être postérieure à la date de fin.",
      status: 400,
    });
  }

  const where:
    Prisma.PayoutWhereInput =
    {};

  if (
    input.status &&
    input.status !== "all"
  ) {
    where.status =
      input.status;
  }

  if (
    input.destinationType &&
    input.destinationType !==
      "all"
  ) {
    where.destinationType =
      input.destinationType;
  }

  if (currency) {
    where.currency = {
      equals: currency,
      mode: "insensitive",
    };
  }

  if (
    dateFrom ||
    dateTo
  ) {
    where.requestedAt = {
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
        reference: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        note: {
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
                phone: {
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
      {
        destination: {
          is: {
            OR: [
              {
                accountName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                bankName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                phoneNumberLast4: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                bankAccountNumberLast4: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                ibanLast4: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                cryptoAddressLast6: {
                  contains: search,
                  mode: "insensitive",
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
  sort: AdminPayoutSort,
): Prisma.PayoutOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [
        {
          requestedAt: "asc",
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
          requestedAt: "desc",
        },
      ];

    case "amount_asc":
      return [
        {
          amount: "asc",
        },
        {
          requestedAt: "desc",
        },
      ];

    case "recent":
    default:
      return [
        {
          requestedAt: "desc",
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
        .map((value) =>
          value.trim(),
        )
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

export async function getAdminPayouts(
  input: GetAdminPayoutsInput = {},
): Promise<GetAdminPayoutsResult> {
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
    buildAdminPayoutWhere(
      input,
    );

  try {
    const [
      totalItems,
      rows,
      optionRows,
    ] =
      await Promise.all([
        prisma.payout.count({
          where,
        }),

        prisma.payout.findMany({
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
            id: true,
            organizerId: true,
            reference: true,
            amount: true,
            fee: true,
            netAmount: true,
            currency: true,
            status: true,
            note: true,
            adminNote: true,
            rejectionReason: true,
            destinationId: true,
            destinationType: true,
            requestedAt: true,
            processedAt: true,
            createdAt: true,
            updatedAt: true,

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

            destination: {
              select: {
                id: true,
                type: true,
                status: true,
                country: true,
                currency: true,
                accountName: true,
                mobileProvider: true,
                phoneCountryCode: true,
                phoneNumberLast4: true,
                bankName: true,
                bankAccountNumberLast4: true,
                ibanLast4: true,
                swiftBic: true,
                cryptoNetwork: true,
                cryptoAddressLast6: true,
                isDefault: true,
                isActive: true,
              },
            },
          },
        }),

        prisma.payout.findMany({
          distinct: [
            "currency",
            "destinationType",
          ],

          select: {
            currency: true,
            destinationType: true,
          },
        }),
      ]);

    const payouts:
      AdminPayoutListItem[] =
      rows.map((payout) => ({
        id:
          payout.id,
        organizerId:
          payout.organizerId,
        reference:
          payout.reference,
        amount:
          payout.amount.toFixed(2),
        fee:
          payout.fee.toFixed(2),
        netAmount:
          payout.netAmount.toFixed(2),
        currency:
          payout.currency,
        status:
          payout.status,
        note:
          payout.note,
        adminNote:
          payout.adminNote,
        rejectionReason:
          payout.rejectionReason,
        destinationId:
          payout.destinationId,
        destinationType:
          payout.destinationType,
        requestedAt:
          payout.requestedAt,
        processedAt:
          payout.processedAt,
        createdAt:
          payout.createdAt,
        updatedAt:
          payout.updatedAt,

        organizer: {
          id:
            payout.organizer.id,
          fullName:
            `${payout.organizer.firstName} ${payout.organizer.lastName}`
              .replace(/\s+/g, " ")
              .trim(),
          email:
            payout.organizer.email,
          phone:
            payout.organizer.phone,
          country:
            payout.organizer.country,
          businessName:
            payout.organizer
              .organizerProfile
              ?.businessName ??
            null,
        },

        destination:
          payout.destination
            ? {
                id:
                  payout.destination.id,
                type:
                  payout.destination.type,
                status:
                  payout.destination.status,
                country:
                  payout.destination.country,
                currency:
                  payout.destination.currency,
                accountName:
                  payout.destination.accountName,
                mobileProvider:
                  payout.destination.mobileProvider,
                phoneCountryCode:
                  payout.destination.phoneCountryCode,
                phoneNumberLast4:
                  payout.destination.phoneNumberLast4,
                bankName:
                  payout.destination.bankName,
                bankAccountNumberLast4:
                  payout.destination.bankAccountNumberLast4,
                ibanLast4:
                  payout.destination.ibanLast4,
                swiftBic:
                  payout.destination.swiftBic,
                cryptoNetwork:
                  payout.destination.cryptoNetwork,
                cryptoAddressLast6:
                  payout.destination.cryptoAddressLast6,
                isDefault:
                  payout.destination.isDefault,
                isActive:
                  payout.destination.isActive,
              }
            : null,
      }));

    const totalPages =
      totalItems === 0
        ? 0
        : Math.ceil(
            totalItems /
              pageSize,
          );

    const dateFrom =
      parseOptionalDate(
        input.dateFrom,
        "La date de début",
      );

    const dateTo =
      parseOptionalDate(
        input.dateTo,
        "La date de fin",
        true,
      );

    return {
      payouts,

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
        destinationType:
          input.destinationType &&
          input.destinationType !==
            "all"
            ? input.destinationType
            : "all",
        currency:
          normalizeText(
            input.currency,
          ).toUpperCase(),
        dateFrom:
          dateFrom?.toISOString() ??
          null,
        dateTo:
          dateTo?.toISOString() ??
          null,
        sort,
      },

      options: {
        currencies:
          uniqueSorted(
            optionRows.map(
              (row) =>
                row.currency,
            ),
          ),

        destinationTypes:
          Array.from(
            new Set(
              optionRows
                .map(
                  (row) =>
                    row.destinationType,
                )
                .filter(
                  (
                    value,
                  ): value is PayoutDestinationType =>
                    value !== null,
                ),
            ),
          ),
      },
    };
  } catch (error) {
    if (
      error instanceof
      AdminPayoutError
    ) {
      throw error;
    }

    throw new AdminPayoutError({
      code:
        "ADMIN_PAYOUT_QUERY_INVALID",
      message:
        "Impossible de charger les demandes de retrait.",
      status: 500,
      cause: error,
    });
  }
}
