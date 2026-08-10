import "server-only";

import {
  OrderStatus,
  Prisma,
  UserRole,
} from "@prisma/client";

import {
  AdminCustomerError,
} from "@/lib/admin/customers/customer-errors";
import {
  prisma,
} from "@/lib/prisma";

export const CUSTOMER_PURCHASE_STATUSES = [
  OrderStatus.PAID,
  OrderStatus.PARTIALLY_REFUNDED,
  OrderStatus.REFUNDED,
] as const;

export type AdminCustomerStatusFilter =
  | "all"
  | "registered"
  | "guest"
  | "active"
  | "inactive"
  | "verified"
  | "unverified";

export type AdminCustomerSort =
  | "recent_purchase"
  | "oldest_purchase"
  | "most_orders"
  | "most_tickets"
  | "highest_spend"
  | "name_asc"
  | "name_desc";

export type GetAdminCustomersInput = Readonly<{
  search?: string | null;
  status?: AdminCustomerStatusFilter;
  sort?: AdminCustomerSort;
  page?: number;
  pageSize?: number;
  exportAll?: boolean;
}>;

export type AdminCustomerListItem = Readonly<{
  id: string;
  customerKey: string;
  accountType: "REGISTERED" | "GUEST";
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  country: string | null;
  countryCode: string | null;
  dialCode: string | null;
  emailVerified: boolean;
  isActive: boolean;
  registeredAt: Date | null;
  firstPurchaseAt: Date;
  lastPurchaseAt: Date;
  ordersCount: number;
  ticketsCount: number;
  totalSpent: string;
  currency: string;
  currencies: readonly string[];
}>;

export type GetAdminCustomersResult = Readonly<{
  customers: readonly AdminCustomerListItem[];

  pagination: Readonly<{
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  }>;

  filters: Readonly<{
    search: string;
    status: AdminCustomerStatusFilter;
    sort: AdminCustomerSort;
  }>;

  summary: Readonly<{
    totalCustomers: number;
    registeredCustomers: number;
    guestCustomers: number;
    activeCustomers: number;
    totalOrders: number;
    totalTickets: number;
  }>;
}>;

type CustomerAccumulator = {
  normalizedEmail: string;
  email: string;
  names: Map<string, number>;
  phones: Map<string, number>;
  customerIds: Set<string>;
  currencies: Set<string>;
  firstPurchaseAt: Date;
  lastPurchaseAt: Date;
  ordersCount: number;
  ticketsCount: number;
  totalsByCurrency: Map<string, Prisma.Decimal>;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_EXPORT_SIZE = 10_000;

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeEmail(
  value: string,
): string {
  return value.trim().toLowerCase();
}

function positiveInteger(
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

function normalizePageSize(
  value: number | undefined,
  exportAll: boolean,
): number {
  const maximum = exportAll
    ? MAX_EXPORT_SIZE
    : MAX_PAGE_SIZE;

  return Math.min(
    positiveInteger(
      value,
      exportAll
        ? MAX_EXPORT_SIZE
        : DEFAULT_PAGE_SIZE,
    ),
    maximum,
  );
}

function normalizeStatus(
  value: AdminCustomerStatusFilter | undefined,
): AdminCustomerStatusFilter {
  switch (value) {
    case "registered":
    case "guest":
    case "active":
    case "inactive":
    case "verified":
    case "unverified":
      return value;

    default:
      return "all";
  }
}

function normalizeSort(
  value: AdminCustomerSort | undefined,
): AdminCustomerSort {
  switch (value) {
    case "oldest_purchase":
    case "most_orders":
    case "most_tickets":
    case "highest_spend":
    case "name_asc":
    case "name_desc":
      return value;

    default:
      return "recent_purchase";
  }
}

function addFrequency(
  map: Map<string, number>,
  value: string | null | undefined,
): void {
  const normalized = normalizeText(value);

  if (!normalized) {
    return;
  }

  map.set(
    normalized,
    (map.get(normalized) ?? 0) + 1,
  );
}

function mostFrequentValue(
  map: Map<string, number>,
): string | null {
  let selected: string | null = null;
  let selectedCount = -1;

  for (const [value, count] of map.entries()) {
    if (count > selectedCount) {
      selected = value;
      selectedCount = count;
    }
  }

  return selected;
}

function encodeGuestCustomerId(
  email: string,
): string {
  return `guest_${Buffer.from(
    normalizeEmail(email),
    "utf8",
  ).toString("base64url")}`;
}

function customerMatchesSearch(
  customer: AdminCustomerListItem,
  search: string,
): boolean {
  if (!search) {
    return true;
  }

  const haystack = [
    customer.fullName,
    customer.email,
    customer.phone ?? "",
    customer.country ?? "",
  ]
    .join(" ")
    .toLocaleLowerCase("fr");

  return haystack.includes(
    search.toLocaleLowerCase("fr"),
  );
}

function customerMatchesStatus(
  customer: AdminCustomerListItem,
  status: AdminCustomerStatusFilter,
): boolean {
  switch (status) {
    case "registered":
      return customer.accountType === "REGISTERED";

    case "guest":
      return customer.accountType === "GUEST";

    case "active":
      return (
        customer.accountType === "REGISTERED" &&
        customer.isActive
      );

    case "inactive":
      return (
        customer.accountType === "REGISTERED" &&
        !customer.isActive
      );

    case "verified":
      return (
        customer.accountType === "REGISTERED" &&
        customer.emailVerified
      );

    case "unverified":
      return (
        customer.accountType === "REGISTERED" &&
        !customer.emailVerified
      );

    default:
      return true;
  }
}

function compareCustomers(
  left: AdminCustomerListItem,
  right: AdminCustomerListItem,
  sort: AdminCustomerSort,
): number {
  switch (sort) {
    case "oldest_purchase":
      return (
        left.firstPurchaseAt.getTime() -
        right.firstPurchaseAt.getTime()
      );

    case "most_orders":
      return (
        right.ordersCount -
          left.ordersCount ||
        right.lastPurchaseAt.getTime() -
          left.lastPurchaseAt.getTime()
      );

    case "most_tickets":
      return (
        right.ticketsCount -
          left.ticketsCount ||
        right.lastPurchaseAt.getTime() -
          left.lastPurchaseAt.getTime()
      );

    case "highest_spend":
      return (
        Number(right.totalSpent) -
          Number(left.totalSpent) ||
        right.lastPurchaseAt.getTime() -
          left.lastPurchaseAt.getTime()
      );

    case "name_asc":
      return left.fullName.localeCompare(
        right.fullName,
        "fr",
        {
          sensitivity: "base",
        },
      );

    case "name_desc":
      return right.fullName.localeCompare(
        left.fullName,
        "fr",
        {
          sensitivity: "base",
        },
      );

    default:
      return (
        right.lastPurchaseAt.getTime() -
        left.lastPurchaseAt.getTime()
      );
  }
}

export async function getAdminCustomers(
  input: GetAdminCustomersInput = {},
): Promise<GetAdminCustomersResult> {
  const search = normalizeText(input.search);
  const status = normalizeStatus(input.status);
  const sort = normalizeSort(input.sort);
  const exportAll = input.exportAll === true;

  const page = exportAll
    ? 1
    : positiveInteger(
        input.page,
        DEFAULT_PAGE,
      );

  const pageSize = normalizePageSize(
    input.pageSize,
    exportAll,
  );

  try {
    /*
     * Les achats invités et les achats liés à un compte sont tous lus.
     * Le regroupement par e-mail garantit qu'un même acheteur n'apparaît
     * qu'une seule fois, même s'il a commandé avant de créer son compte.
     */
    const orders = await prisma.order.findMany({
      where: {
        status: {
          in: [
            ...CUSTOMER_PURCHASE_STATUSES,
          ],
        },

        customerEmail: {
          not:
            "",
        },
      },

      orderBy: {
        createdAt:
          "asc",
      },

      select: {
        customerId:
          true,

        customerName:
          true,

        customerEmail:
          true,

        customerPhone:
          true,

        currency:
          true,

        total:
          true,

        paidAt:
          true,

        paymentConfirmedAt:
          true,

        createdAt:
          true,

        _count: {
          select: {
            tickets:
              true,
          },
        },
      },
    });

    const accumulators =
      new Map<
        string,
        CustomerAccumulator
      >();

    for (const order of orders) {
      const normalizedEmail =
        normalizeEmail(
          order.customerEmail,
        );

      if (!normalizedEmail) {
        continue;
      }

      const purchaseAt =
        order.paidAt ??
        order.paymentConfirmedAt ??
        order.createdAt;

      let accumulator =
        accumulators.get(
          normalizedEmail,
        );

      if (!accumulator) {
        accumulator = {
          normalizedEmail,
          email:
            order.customerEmail.trim(),

          names:
            new Map(),

          phones:
            new Map(),

          customerIds:
            new Set(),

          currencies:
            new Set(),

          firstPurchaseAt:
            purchaseAt,

          lastPurchaseAt:
            purchaseAt,

          ordersCount:
            0,

          ticketsCount:
            0,

          totalsByCurrency:
            new Map(),
        };

        accumulators.set(
          normalizedEmail,
          accumulator,
        );
      }

      addFrequency(
        accumulator.names,
        order.customerName,
      );

      addFrequency(
        accumulator.phones,
        order.customerPhone,
      );

      if (order.customerId) {
        accumulator.customerIds.add(
          order.customerId,
        );
      }

      accumulator.currencies.add(
        order.currency,
      );

      accumulator.ordersCount +=
        1;

      accumulator.ticketsCount +=
        order._count.tickets;

      if (
        purchaseAt <
        accumulator.firstPurchaseAt
      ) {
        accumulator.firstPurchaseAt =
          purchaseAt;
      }

      if (
        purchaseAt >
        accumulator.lastPurchaseAt
      ) {
        accumulator.lastPurchaseAt =
          purchaseAt;
      }

      const currentTotal =
        accumulator.totalsByCurrency.get(
          order.currency,
        ) ??
        new Prisma.Decimal(
          0,
        );

      accumulator.totalsByCurrency.set(
        order.currency,
        currentTotal.plus(
          order.total,
        ),
      );
    }

    const emails = [
      ...accumulators.keys(),
    ];

    const linkedCustomerIds = [
      ...new Set(
        [...accumulators.values()]
          .flatMap(
            (item) => [
              ...item.customerIds,
            ],
          ),
      ),
    ];

    const registeredUsers =
      emails.length === 0 &&
      linkedCustomerIds.length === 0
        ? []
        : await prisma.user.findMany({
            where: {
              role:
                UserRole.CUSTOMER,

              OR: [
                ...(emails.length > 0
                  ? [
                      {
                        email: {
                          in:
                            emails,
                        },
                      },
                    ]
                  : []),

                ...(linkedCustomerIds.length > 0
                  ? [
                      {
                        id: {
                          in:
                            linkedCustomerIds,
                        },
                      },
                    ]
                  : []),
              ],
            },

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

              countryCode:
                true,

              dialCode:
                true,

              emailVerified:
                true,

              isActive:
                true,

              createdAt:
                true,
            },
          });

    const userByEmail =
      new Map(
        registeredUsers.map(
          (user) => [
            normalizeEmail(
              user.email,
            ),
            user,
          ],
        ),
      );

    const allCustomers:
      AdminCustomerListItem[] =
      [...accumulators.values()].map(
        (item) => {
          const user =
            userByEmail.get(
              item.normalizedEmail,
            );

          const orderName =
            mostFrequentValue(
              item.names,
            );

          const fullName =
            user
              ? `${user.firstName} ${user.lastName}`
                  .replace(
                    /\s+/g,
                    " ",
                  )
                  .trim()
              : orderName ||
                item.email;

          const firstName =
            user?.firstName ??
            null;

          const lastName =
            user?.lastName ??
            null;

          const currencies = [
            ...item.currencies,
          ].sort();

          /*
           * L'interface possède une colonne unique "Montant dépensé".
           * Si plusieurs devises existent, la devise du dernier achat est
           * privilégiée et la liste complète reste disponible.
           */
          const primaryCurrency =
            currencies.length === 1
              ? currencies[0]!
              : currencies[0] ??
                "XOF";

          const totalSpent =
            item.totalsByCurrency
              .get(
                primaryCurrency,
              )
              ?.toFixed(
                2,
              ) ??
            "0.00";

          return {
            id:
              user?.id ??
              encodeGuestCustomerId(
                item.email,
              ),

            customerKey:
              user
                ? `user:${user.id}`
                : `guest:${item.normalizedEmail}`,

            accountType:
              user
                ? "REGISTERED"
                : "GUEST",

            firstName,
            lastName,
            fullName,

            email:
              user?.email ??
              item.email,

            phone:
              user?.phone ??
              mostFrequentValue(
                item.phones,
              ),

            country:
              user?.country ??
              null,

            countryCode:
              user?.countryCode ??
              null,

            dialCode:
              user?.dialCode ??
              null,

            emailVerified:
              user?.emailVerified ??
              false,

            isActive:
              user?.isActive ??
              true,

            registeredAt:
              user?.createdAt ??
              null,

            firstPurchaseAt:
              item.firstPurchaseAt,

            lastPurchaseAt:
              item.lastPurchaseAt,

            ordersCount:
              item.ordersCount,

            ticketsCount:
              item.ticketsCount,

            totalSpent,
            currency:
              primaryCurrency,

            currencies,
          };
        },
      );

    const filteredCustomers =
      allCustomers
        .filter(
          (customer) =>
            customerMatchesSearch(
              customer,
              search,
            ),
        )
        .filter(
          (customer) =>
            customerMatchesStatus(
              customer,
              status,
            ),
        )
        .sort(
          (left, right) =>
            compareCustomers(
              left,
              right,
              sort,
            ),
        );

    const totalItems =
      filteredCustomers.length;

    const totalPages =
      totalItems === 0
        ? 0
        : Math.ceil(
            totalItems /
              pageSize,
          );

    const customers =
      exportAll
        ? filteredCustomers.slice(
            0,
            pageSize,
          )
        : filteredCustomers.slice(
            (page - 1) *
              pageSize,
            page *
              pageSize,
          );

    return {
      customers,

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
        search,
        status,
        sort,
      },

      summary: {
        totalCustomers:
          allCustomers.length,

        registeredCustomers:
          allCustomers.filter(
            (customer) =>
              customer.accountType ===
              "REGISTERED",
          ).length,

        guestCustomers:
          allCustomers.filter(
            (customer) =>
              customer.accountType ===
              "GUEST",
          ).length,

        activeCustomers:
          allCustomers.filter(
            (customer) =>
              customer.accountType ===
                "REGISTERED" &&
              customer.isActive,
          ).length,

        totalOrders:
          allCustomers.reduce(
            (sum, customer) =>
              sum +
              customer.ordersCount,
            0,
          ),

        totalTickets:
          allCustomers.reduce(
            (sum, customer) =>
              sum +
              customer.ticketsCount,
            0,
          ),
      },
    };
  } catch (error) {
    throw new AdminCustomerError({
      code:
        "ADMIN_CUSTOMERS_QUERY_INVALID",

      message:
        "Impossible de charger les clients Tikemia.",

      status:
        500,

      cause:
        error,
    });
  }
}
