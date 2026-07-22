import "server-only";

import type {
  OrderStatus,
  PaymentStatus,
  TicketStatus,
} from "@prisma/client";

import {
  getCurrencyDefinition,
  type SupportedCurrencyCode,
} from "@/lib/localization/currencies";
import {
  formatMoney,
} from "@/lib/localization/format-money";
import {
  getOrganizerOrders,
  type GetOrganizerOrdersParams,
  type GetOrganizerOrdersResult,
  type OrganizerOrderListItem,
  type OrganizerOrdersCurrencyTotal,
  type OrganizerOrdersSort,
} from "@/lib/organizer/get-organizer-orders";

const EXPORT_PAGE_SIZE = 100;
const MAX_EXPORT_ORDERS = 50_000;

export type OrganizerOrdersExportFormat =
  | "csv"
  | "xlsx"
  | "pdf";

export type ExportOrdersDataParams = {
  organizerId: string;

  format?: OrganizerOrdersExportFormat;

  search?: string | null;
  eventId?: string | null;
  status?: string | null;
  currency?: string | null;
  paymentStatus?: string | null;
  paymentMethod?: string | null;

  dateFrom?: string | Date | null;
  dateTo?: string | Date | null;

  sort?: OrganizerOrdersSort;

  maxOrders?: number;
};

export type OrganizerOrdersExportOrganizer = {
  id: string;
  name: string;
  email: string;
  businessName: string | null;
  logo: string | null;
  country: string | null;
  countryCode: string | null;
};

export type OrganizerOrdersExportEvent = {
  id: string;
  title: string;
  slug: string;
  coverImage: string | null;
  startsAt: string;
  endsAt: string | null;
  venueName: string;
  city: string;
  country: string;
  countryCode: string;
  timezone: string;
  currency: SupportedCurrencyCode;
};

export type OrganizerOrdersExportCustomer = {
  id: string | null;
  name: string;
  email: string;
  phone: string;
  country: string | null;
  countryCode: string | null;
  isGuest: boolean;
};

export type OrganizerOrdersExportPayment = {
  id: string | null;
  provider: string | null;
  providerReference: string | null;
  method: string | null;
  amount: number | null;
  amountFormatted: string | null;
  currency: SupportedCurrencyCode | null;
  status: PaymentStatus | null;
  failureReason: string | null;
  paidAt: string | null;
};

export type OrganizerOrdersExportTicketSummary = {
  total: number;
  valid: number;
  used: number;
  cancelled: number;
  refunded: number;
};

export type OrganizerOrdersExportItem = {
  id: string;
  orderId: string;
  orderReference: string;
  eventId: string;
  eventTitle: string;

  ticketTypeId: string;
  ticketTypeName: string;
  ticketTypeDescription: string | null;

  quantity: number;

  currency: SupportedCurrencyCode;
  unitPrice: number;
  unitPriceFormatted: string;
  subtotal: number;
  subtotalFormatted: string;
  platformFee: number;
  platformFeeFormatted: string;
  total: number;
  totalFormatted: string;
};

export type OrganizerOrdersExportOrder = {
  id: string;
  reference: string;
  status: OrderStatus;

  currency: SupportedCurrencyCode;
  currencyName: string;
  currencySymbol: string;

  subtotal: number;
  subtotalFormatted: string;

  platformFee: number;
  platformFeeFormatted: string;

  total: number;
  totalFormatted: string;

  organizerNet: number;
  organizerNetFormatted: string;

  paidAt: string | null;
  createdAt: string;
  updatedAt: string;

  customer: OrganizerOrdersExportCustomer;
  event: OrganizerOrdersExportEvent;
  payment: OrganizerOrdersExportPayment;

  ticketSummary: OrganizerOrdersExportTicketSummary;

  itemsCount: number;
  ticketsCount: number;
};

export type OrganizerOrdersExportCustomerSummary = {
  key: string;
  id: string | null;
  name: string;
  email: string;
  phone: string;
  country: string | null;
  countryCode: string | null;
  isGuest: boolean;

  ordersCount: number;
  paidOrdersCount: number;
  ticketsCount: number;

  totalsByCurrency: Array<{
    currency: SupportedCurrencyCode;
    total: number;
    totalFormatted: string;
    organizerNet: number;
    organizerNetFormatted: string;
  }>;
};

export type OrganizerOrdersExportTicketRow = {
  orderId: string;
  orderReference: string;
  orderStatus: OrderStatus;

  eventId: string;
  eventTitle: string;

  customerName: string;
  customerEmail: string;
  customerPhone: string;

  ticketTypeId: string;
  ticketTypeName: string;
  quantity: number;

  currency: SupportedCurrencyCode;
  unitPrice: number;
  unitPriceFormatted: string;
  lineSubtotal: number;
  lineSubtotalFormatted: string;
  linePlatformFee: number;
  linePlatformFeeFormatted: string;
  lineTotal: number;
  lineTotalFormatted: string;

  createdAt: string;
  paidAt: string | null;
};

export type OrganizerOrdersExportFilters = {
  search: string;
  eventId: string | null;
  status: OrderStatus | null;
  currency: SupportedCurrencyCode | null;
  paymentStatus: PaymentStatus | null;
  paymentMethod: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  sort: OrganizerOrdersSort;
};

export type OrganizerOrdersExportSummary = {
  totalOrders: number;
  paidOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  refundedOrders: number;
  failedOrders: number;

  totalTickets: number;
  validTickets: number;
  usedTickets: number;
  cancelledTickets: number;
  refundedTickets: number;

  uniqueCustomers: number;
  guestOrders: number;
  registeredCustomerOrders: number;

  totalsByCurrency: Array<
    OrganizerOrdersCurrencyTotal & {
      subtotalFormatted: string;
      platformFeesFormatted: string;
      grossTotalFormatted: string;
      organizerNetFormatted: string;
    }
  >;
};

export type ExportOrdersDataResult = {
  generatedAt: string;
  format: OrganizerOrdersExportFormat;

  organizer: OrganizerOrdersExportOrganizer;

  summary: OrganizerOrdersExportSummary;
  filters: OrganizerOrdersExportFilters;

  orders: OrganizerOrdersExportOrder[];
  items: OrganizerOrdersExportItem[];
  tickets: OrganizerOrdersExportTicketRow[];
  customers: OrganizerOrdersExportCustomerSummary[];

  metadata: {
    exportedOrders: number;
    totalMatchingOrders: number;
    truncated: boolean;
    maxOrders: number;
    pagesLoaded: number;
  };
};

export class ExportOrdersDataError extends Error {
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

    this.name = "ExportOrdersDataError";
    this.code = code;
    this.status = status;
  }
}

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeFormat(
  value: OrganizerOrdersExportFormat | undefined,
): OrganizerOrdersExportFormat {
  return value === "xlsx" ||
    value === "pdf"
    ? value
    : "csv";
}

function normalizeMaximum(
  value: number | undefined,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return MAX_EXPORT_ORDERS;
  }

  return Math.min(
    Math.max(
      Math.trunc(value),
      1,
    ),
    MAX_EXPORT_ORDERS,
  );
}

function getCurrencyPresentation(
  currency: SupportedCurrencyCode,
) {
  const definition =
    getCurrencyDefinition(currency);

  return {
    name:
      definition?.name ??
      currency,

    symbol:
      definition?.symbol ??
      currency,
  };
}

function formatAmount(
  amount: number,
  currency: SupportedCurrencyCode,
): string {
  return formatMoney({
    amount,
    currency,
  });
}

function mapOrder(
  order: OrganizerOrderListItem,
): OrganizerOrdersExportOrder {
  const currencyPresentation =
    getCurrencyPresentation(
      order.currency,
    );

  return {
    id:
      order.id,

    reference:
      order.reference,

    status:
      order.status,

    currency:
      order.currency,

    currencyName:
      currencyPresentation.name,

    currencySymbol:
      currencyPresentation.symbol,

    subtotal:
      order.subtotal,

    subtotalFormatted:
      formatAmount(
        order.subtotal,
        order.currency,
      ),

    platformFee:
      order.platformFee,

    platformFeeFormatted:
      formatAmount(
        order.platformFee,
        order.currency,
      ),

    total:
      order.total,

    totalFormatted:
      formatAmount(
        order.total,
        order.currency,
      ),

    organizerNet:
      order.organizerNet,

    organizerNetFormatted:
      formatAmount(
        order.organizerNet,
        order.currency,
      ),

    paidAt:
      order.paidAt,

    createdAt:
      order.createdAt,

    updatedAt:
      order.updatedAt,

    customer: {
      id:
        order.customer.id,

      name:
        order.customer.name,

      email:
        order.customer.email,

      phone:
        order.customer.phone,

      country:
        order.customer.country,

      countryCode:
        order.customer.countryCode,

      isGuest:
        order.customer.isGuest,
    },

    event: {
      id:
        order.event.id,

      title:
        order.event.title,

      slug:
        order.event.slug,

      coverImage:
        order.event.coverImage,

      startsAt:
        order.event.startsAt,

      endsAt:
        order.event.endsAt,

      venueName:
        order.event.venueName,

      city:
        order.event.city,

      country:
        order.event.country,

      countryCode:
        order.event.countryCode,

      timezone:
        order.event.timezone,

      currency:
        order.event.currency,
    },

    payment:
      order.payment
        ? {
            id:
              order.payment.id,

            provider:
              order.payment.provider,

            providerReference:
              order.payment.providerReference,

            method:
              order.payment.method,

            amount:
              order.payment.amount,

            amountFormatted:
              formatAmount(
                order.payment.amount,
                order.payment.currency,
              ),

            currency:
              order.payment.currency,

            status:
              order.payment.status,

            failureReason:
              order.payment.failureReason,

            paidAt:
              order.payment.paidAt,
          }
        : {
            id:
              null,

            provider:
              null,

            providerReference:
              null,

            method:
              null,

            amount:
              null,

            amountFormatted:
              null,

            currency:
              null,

            status:
              null,

            failureReason:
              null,

            paidAt:
              null,
          },

    ticketSummary: {
      total:
        order.ticketSummary.total,

      valid:
        order.ticketSummary.valid,

      used:
        order.ticketSummary.used,

      cancelled:
        order.ticketSummary.cancelled,

      refunded:
        order.ticketSummary.refunded,
    },

    itemsCount:
      order.items.length,

    ticketsCount:
      order.ticketSummary.total,
  };
}

function mapItems(
  orders: OrganizerOrderListItem[],
): OrganizerOrdersExportItem[] {
  return orders.flatMap(
    (order) =>
      order.items.map(
        (item) => ({
          id:
            item.id,

          orderId:
            order.id,

          orderReference:
            order.reference,

          eventId:
            order.event.id,

          eventTitle:
            order.event.title,

          ticketTypeId:
            item.ticketTypeId,

          ticketTypeName:
            item.ticketTypeName,

          ticketTypeDescription:
            item.ticketTypeDescription,

          quantity:
            item.quantity,

          currency:
            order.currency,

          unitPrice:
            item.unitPrice,

          unitPriceFormatted:
            formatAmount(
              item.unitPrice,
              order.currency,
            ),

          subtotal:
            item.subtotal,

          subtotalFormatted:
            formatAmount(
              item.subtotal,
              order.currency,
            ),

          platformFee:
            item.platformFee,

          platformFeeFormatted:
            formatAmount(
              item.platformFee,
              order.currency,
            ),

          total:
            item.total,

          totalFormatted:
            formatAmount(
              item.total,
              order.currency,
            ),
        }),
      ),
  );
}

function mapTicketRows(
  orders: OrganizerOrderListItem[],
): OrganizerOrdersExportTicketRow[] {
  return orders.flatMap(
    (order) =>
      order.items.map(
        (item) => ({
          orderId:
            order.id,

          orderReference:
            order.reference,

          orderStatus:
            order.status,

          eventId:
            order.event.id,

          eventTitle:
            order.event.title,

          customerName:
            order.customer.name,

          customerEmail:
            order.customer.email,

          customerPhone:
            order.customer.phone,

          ticketTypeId:
            item.ticketTypeId,

          ticketTypeName:
            item.ticketTypeName,

          quantity:
            item.quantity,

          currency:
            order.currency,

          unitPrice:
            item.unitPrice,

          unitPriceFormatted:
            formatAmount(
              item.unitPrice,
              order.currency,
            ),

          lineSubtotal:
            item.subtotal,

          lineSubtotalFormatted:
            formatAmount(
              item.subtotal,
              order.currency,
            ),

          linePlatformFee:
            item.platformFee,

          linePlatformFeeFormatted:
            formatAmount(
              item.platformFee,
              order.currency,
            ),

          lineTotal:
            item.total,

          lineTotalFormatted:
            formatAmount(
              item.total,
              order.currency,
            ),

          createdAt:
            order.createdAt,

          paidAt:
            order.paidAt,
        }),
      ),
  );
}

function buildCustomerSummaries(
  orders: OrganizerOrderListItem[],
): OrganizerOrdersExportCustomerSummary[] {
  type CustomerAccumulator = {
    key: string;
    id: string | null;
    name: string;
    email: string;
    phone: string;
    country: string | null;
    countryCode: string | null;
    isGuest: boolean;
    ordersCount: number;
    paidOrdersCount: number;
    ticketsCount: number;

    totalsByCurrency: Map<
      SupportedCurrencyCode,
      {
        total: number;
        organizerNet: number;
      }
    >;
  };

  const customerMap =
    new Map<
      string,
      CustomerAccumulator
    >();

  for (const order of orders) {
    const normalizedEmail =
      normalizeText(
        order.customer.email,
      ).toLowerCase();

    const normalizedPhone =
      normalizeText(
        order.customer.phone,
      );

    const key =
      order.customer.id ??
      normalizedEmail ??
      normalizedPhone ??
      order.reference;

    const safeKey =
      key ||
      order.reference;

    let customer =
      customerMap.get(
        safeKey,
      );

    if (!customer) {
      customer = {
        key:
          safeKey,

        id:
          order.customer.id,

        name:
          order.customer.name,

        email:
          order.customer.email,

        phone:
          order.customer.phone,

        country:
          order.customer.country,

        countryCode:
          order.customer.countryCode,

        isGuest:
          order.customer.isGuest,

        ordersCount:
          0,

        paidOrdersCount:
          0,

        ticketsCount:
          0,

        totalsByCurrency:
          new Map(),
      };

      customerMap.set(
        safeKey,
        customer,
      );
    }

    customer.ordersCount += 1;
    customer.ticketsCount +=
      order.ticketSummary.total;

    if (
      order.status ===
      "PAID"
    ) {
      customer.paidOrdersCount += 1;

      const currencyTotal =
        customer.totalsByCurrency.get(
          order.currency,
        ) ?? {
          total:
            0,

          organizerNet:
            0,
        };

      currencyTotal.total +=
        order.total;

      currencyTotal.organizerNet +=
        order.organizerNet;

      customer.totalsByCurrency.set(
        order.currency,
        currencyTotal,
      );
    }
  }

  return Array.from(
    customerMap.values(),
  )
    .map(
      (customer) => ({
        key:
          customer.key,

        id:
          customer.id,

        name:
          customer.name,

        email:
          customer.email,

        phone:
          customer.phone,

        country:
          customer.country,

        countryCode:
          customer.countryCode,

        isGuest:
          customer.isGuest,

        ordersCount:
          customer.ordersCount,

        paidOrdersCount:
          customer.paidOrdersCount,

        ticketsCount:
          customer.ticketsCount,

        totalsByCurrency:
          Array.from(
            customer.totalsByCurrency.entries(),
          )
            .map(
              ([
                currency,
                values,
              ]) => ({
                currency,

                total:
                  values.total,

                totalFormatted:
                  formatAmount(
                    values.total,
                    currency,
                  ),

                organizerNet:
                  values.organizerNet,

                organizerNetFormatted:
                  formatAmount(
                    values.organizerNet,
                    currency,
                  ),
              }),
            )
            .sort(
              (
                first,
                second,
              ) =>
                first.currency.localeCompare(
                  second.currency,
                ),
            ),
      }),
    )
    .sort(
      (
        first,
        second,
      ) =>
        first.name.localeCompare(
          second.name,
          "fr",
        ),
    );
}

function mapSummary(
  summary: GetOrganizerOrdersResult["summary"],
): OrganizerOrdersExportSummary {
  return {
    totalOrders:
      summary.totalOrders,

    paidOrders:
      summary.paidOrders,

    pendingOrders:
      summary.pendingOrders,

    cancelledOrders:
      summary.cancelledOrders,

    refundedOrders:
      summary.refundedOrders,

    failedOrders:
      summary.failedOrders,

    totalTickets:
      summary.totalTickets,

    validTickets:
      summary.validTickets,

    usedTickets:
      summary.usedTickets,

    cancelledTickets:
      summary.cancelledTickets,

    refundedTickets:
      summary.refundedTickets,

    uniqueCustomers:
      summary.uniqueCustomers,

    guestOrders:
      summary.guestOrders,

    registeredCustomerOrders:
      summary.registeredCustomerOrders,

    totalsByCurrency:
      summary.totalsByCurrency.map(
        (item) => ({
          ...item,

          subtotalFormatted:
            formatAmount(
              item.subtotal,
              item.currency,
            ),

          platformFeesFormatted:
            formatAmount(
              item.platformFees,
              item.currency,
            ),

          grossTotalFormatted:
            formatAmount(
              item.grossTotal,
              item.currency,
            ),

          organizerNetFormatted:
            formatAmount(
              item.organizerNet,
              item.currency,
            ),
        }),
      ),
  };
}

function buildServiceParams({
  organizerId,
  search,
  eventId,
  status,
  currency,
  paymentStatus,
  paymentMethod,
  dateFrom,
  dateTo,
  sort,
}: ExportOrdersDataParams): Omit<
  GetOrganizerOrdersParams,
  "page" | "pageSize"
> {
  return {
    organizerId,

    search:
      search ?? null,

    eventId:
      eventId ?? null,

    status:
      status ?? null,

    currency:
      currency ?? null,

    paymentStatus:
      paymentStatus ?? null,

    paymentMethod:
      paymentMethod ?? null,

    dateFrom:
      dateFrom ?? null,

    dateTo:
      dateTo ?? null,

    sort:
      sort ?? "NEWEST",
  };
}

async function loadOrganizerProfile(
  organizerId: string,
): Promise<OrganizerOrdersExportOrganizer> {
  const organizer =
    await import(
      "@/lib/prisma"
    ).then(
      ({
        prisma,
      }) =>
        prisma.user.findFirst({
          where: {
            id:
              organizerId,

            role:
              "ORGANIZER",
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

            country:
              true,

            countryCode:
              true,

            organizerProfile: {
              select: {
                businessName:
                  true,

                logo:
                  true,
              },
            },
          },
        }),
    );

  if (!organizer) {
    throw new ExportOrdersDataError({
      code:
        "ORGANIZER_NOT_FOUND",

      status:
        404,

      message:
        "Le compte organisateur est introuvable.",
    });
  }

  return {
    id:
      organizer.id,

    name:
      `${organizer.firstName} ${organizer.lastName}`
        .replace(/\s+/g, " ")
        .trim() ||
      "Organisateur Tikemia",

    email:
      organizer.email,

    businessName:
      organizer.organizerProfile?.businessName ??
      null,

    logo:
      organizer.organizerProfile?.logo ??
      null,

    country:
      organizer.country,

    countryCode:
      organizer.countryCode,
  };
}

export async function exportOrdersData(
  params: ExportOrdersDataParams,
): Promise<ExportOrdersDataResult> {
  const organizerId =
    params.organizerId.trim();

  if (!organizerId) {
    throw new ExportOrdersDataError({
      code:
        "ORGANIZER_ID_REQUIRED",

      status:
        400,

      message:
        "L’identifiant de l’organisateur est obligatoire.",
    });
  }

  const format =
    normalizeFormat(
      params.format,
    );

  const maxOrders =
    normalizeMaximum(
      params.maxOrders,
    );

  const baseParams =
    buildServiceParams({
      ...params,
      organizerId,
    });

  try {
    const [
      organizer,
      firstPage,
    ] = await Promise.all([
      loadOrganizerProfile(
        organizerId,
      ),

      getOrganizerOrders({
        ...baseParams,

        page:
          1,

        pageSize:
          EXPORT_PAGE_SIZE,
      }),
    ]);

    const totalMatchingOrders =
      firstPage.pagination.totalItems;

    const exportLimit =
      Math.min(
        totalMatchingOrders,
        maxOrders,
      );

    const totalPagesToLoad =
      Math.max(
        Math.ceil(
          exportLimit /
            EXPORT_PAGE_SIZE,
        ),
        1,
      );

    const allOrders: OrganizerOrderListItem[] = [
      ...firstPage.orders,
    ];

    for (
      let page = 2;
      page <= totalPagesToLoad;
      page += 1
    ) {
      const pageResult =
        await getOrganizerOrders({
          ...baseParams,

          page,

          pageSize:
            EXPORT_PAGE_SIZE,
        });

      allOrders.push(
        ...pageResult.orders,
      );

      if (
        allOrders.length >=
        exportLimit
      ) {
        break;
      }
    }

    const limitedOrders =
      allOrders.slice(
        0,
        exportLimit,
      );

    return {
      generatedAt:
        new Date().toISOString(),

      format,

      organizer,

      summary:
        mapSummary(
          firstPage.summary,
        ),

      filters: {
        ...firstPage.appliedFilters,
      },

      orders:
        limitedOrders.map(
          mapOrder,
        ),

      items:
        mapItems(
          limitedOrders,
        ),

      tickets:
        mapTicketRows(
          limitedOrders,
        ),

      customers:
        buildCustomerSummaries(
          limitedOrders,
        ),

      metadata: {
        exportedOrders:
          limitedOrders.length,

        totalMatchingOrders,

        truncated:
          totalMatchingOrders >
          limitedOrders.length,

        maxOrders,

        pagesLoaded:
          Math.min(
            totalPagesToLoad,
            Math.max(
              Math.ceil(
                limitedOrders.length /
                  EXPORT_PAGE_SIZE,
              ),
              1,
            ),
          ),
      },
    };
  } catch (error) {
    if (
      error instanceof
      ExportOrdersDataError
    ) {
      throw error;
    }

    console.error(
      "[EXPORT_ORDERS_DATA_ERROR]",
      error instanceof Error
        ? {
            name:
              error.name,

            message:
              error.message,

            stack:
              process.env.NODE_ENV ===
              "development"
                ? error.stack
                : undefined,
          }
        : error,
    );

    throw new ExportOrdersDataError({
      code:
        "EXPORT_ORDERS_DATA_FAILED",

      status:
        500,

      message:
        "Impossible de préparer les données d’export des commandes pour le moment.",
    });
  }
}