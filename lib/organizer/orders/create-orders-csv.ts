import "server-only";

import type {
  ExportOrdersDataResult,
  OrganizerOrdersExportCustomerSummary,
  OrganizerOrdersExportItem,
  OrganizerOrdersExportOrder,
  OrganizerOrdersExportTicketRow,
} from "@/lib/organizer/orders/export-orders-data";

const CSV_SEPARATOR = ";";
const CSV_LINE_BREAK = "\r\n";
const UTF8_BOM = "\uFEFF";

export type OrdersCsvSection =
  | "orders"
  | "items"
  | "tickets"
  | "customers"
  | "summary";

export type CreateOrdersCsvOptions = {
  section?: OrdersCsvSection;
  includeBom?: boolean;
  includeMetadata?: boolean;
};

export type CreateOrdersCsvResult = {
  content: string;
  filename: string;
  mimeType: string;
  rowCount: number;
};

export class CreateOrdersCsvError extends Error {
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

    this.name = "CreateOrdersCsvError";
    this.code = code;
    this.status = status;
  }
}

type CsvPrimitive =
  | string
  | number
  | boolean
  | null
  | undefined;

type CsvRow = CsvPrimitive[];

function normalizeSection(
  section: OrdersCsvSection | undefined,
): OrdersCsvSection {
  if (
    section === "items" ||
    section === "tickets" ||
    section === "customers" ||
    section === "summary"
  ) {
    return section;
  }

  return "orders";
}

function sanitizeFilenamePart(
  value: string,
  fallback: string,
): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .toLowerCase();

  return normalized || fallback;
}

function formatFilenameDate(
  value: string,
): string {
  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return new Date()
      .toISOString()
      .slice(0, 10);
  }

  return date
    .toISOString()
    .slice(0, 10);
}

function formatDateTime(
  value: string | null,
): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "UTC",
    },
  ).format(date);
}

function formatBoolean(
  value: boolean,
): string {
  return value
    ? "Oui"
    : "Non";
}

function formatStatus(
  value: string | null,
): string {
  const labels: Record<
    string,
    string
  > = {
    PENDING: "En attente",
    PAID: "Payée",
    CANCELLED: "Annulée",
    REFUNDED: "Remboursée",
    FAILED: "Échouée",
    SUCCESS: "Réussi",
    VALID: "Valide",
    USED: "Utilisé",
  };

  if (!value) {
    return "";
  }

  return labels[value] ?? value;
}

function normalizeCellValue(
  value: CsvPrimitive,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (
    typeof value === "boolean"
  ) {
    return formatBoolean(value);
  }

  if (
    typeof value === "number"
  ) {
    if (
      !Number.isFinite(value)
    ) {
      return "";
    }

    return String(value).replace(
      ".",
      ",",
    );
  }

  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n|\r|\n/g, " ")
    .trim();
}

function protectSpreadsheetFormula(
  value: string,
): string {
  if (
    /^[=+\-@]/.test(value)
  ) {
    return `'${value}`;
  }

  return value;
}

function escapeCsvCell(
  value: CsvPrimitive,
): string {
  const normalized =
    protectSpreadsheetFormula(
      normalizeCellValue(value),
    );

  const escaped =
    normalized.replace(
      /"/g,
      '""',
    );

  return `"${escaped}"`;
}

function serializeRows(
  rows: CsvRow[],
): string {
  return rows
    .map(
      (row) =>
        row
          .map(escapeCsvCell)
          .join(CSV_SEPARATOR),
    )
    .join(CSV_LINE_BREAK);
}

function createMetadataRows(
  data: ExportOrdersDataResult,
  section: OrdersCsvSection,
): CsvRow[] {
  const filterRows: CsvRow[] = [
    [
      "Section",
      section,
    ],
    [
      "Organisateur",
      data.organizer.name,
    ],
    [
      "Entreprise",
      data.organizer.businessName ?? "",
    ],
    [
      "E-mail organisateur",
      data.organizer.email,
    ],
    [
      "Pays organisateur",
      data.organizer.country ?? "",
    ],
    [
      "Date de génération",
      formatDateTime(
        data.generatedAt,
      ),
    ],
    [
      "Commandes exportées",
      data.metadata.exportedOrders,
    ],
    [
      "Commandes correspondantes",
      data.metadata.totalMatchingOrders,
    ],
    [
      "Export limité",
      data.metadata.truncated,
    ],
    [
      "Recherche",
      data.filters.search,
    ],
    [
      "Événement",
      data.filters.eventId ?? "",
    ],
    [
      "Statut commande",
      formatStatus(
        data.filters.status,
      ),
    ],
    [
      "Devise",
      data.filters.currency ?? "",
    ],
    [
      "Statut paiement",
      formatStatus(
        data.filters.paymentStatus,
      ),
    ],
    [
      "Moyen de paiement",
      data.filters.paymentMethod ?? "",
    ],
    [
      "Date de début",
      formatDateTime(
        data.filters.dateFrom,
      ),
    ],
    [
      "Date de fin",
      formatDateTime(
        data.filters.dateTo,
      ),
    ],
    [
      "Tri",
      data.filters.sort,
    ],
  ];

  return [
    [
      "RAPPORT COMMANDES TIKEMIA",
    ],
    ...filterRows,
    [],
  ];
}

function createOrdersRows(
  orders: OrganizerOrdersExportOrder[],
): CsvRow[] {
  const header: CsvRow = [
    "ID commande",
    "Référence",
    "Statut commande",
    "Date création",
    "Date paiement",
    "Date mise à jour",

    "ID client",
    "Nom client",
    "E-mail client",
    "Téléphone client",
    "Pays client",
    "Code pays client",
    "Achat invité",

    "ID événement",
    "Événement",
    "Date début événement",
    "Date fin événement",
    "Lieu",
    "Ville",
    "Pays événement",
    "Code pays événement",

    "Devise",
    "Nom devise",
    "Symbole devise",

    "Sous-total numérique",
    "Sous-total formaté",
    "Commission Tikemia numérique",
    "Commission Tikemia formatée",
    "Total facturé numérique",
    "Total facturé formaté",
    "Net organisateur numérique",
    "Net organisateur formaté",

    "ID paiement",
    "Prestataire paiement",
    "Référence paiement",
    "Moyen de paiement",
    "Statut paiement",
    "Montant paiement numérique",
    "Montant paiement formaté",
    "Devise paiement",
    "Date paiement prestataire",
    "Motif échec",

    "Nombre de lignes",
    "Nombre de billets",
    "Billets valides",
    "Billets utilisés",
    "Billets annulés",
    "Billets remboursés",
  ];

  const rows = orders.map(
    (order): CsvRow => [
      order.id,
      order.reference,
      formatStatus(
        order.status,
      ),
      formatDateTime(
        order.createdAt,
      ),
      formatDateTime(
        order.paidAt,
      ),
      formatDateTime(
        order.updatedAt,
      ),

      order.customer.id,
      order.customer.name,
      order.customer.email,
      order.customer.phone,
      order.customer.country,
      order.customer.countryCode,
      order.customer.isGuest,

      order.event.id,
      order.event.title,
      formatDateTime(
        order.event.startsAt,
      ),
      formatDateTime(
        order.event.endsAt,
      ),
      order.event.venueName,
      order.event.city,
      order.event.country,
      order.event.countryCode,

      order.currency,
      order.currencyName,
      order.currencySymbol,

      order.subtotal,
      order.subtotalFormatted,
      order.platformFee,
      order.platformFeeFormatted,
      order.total,
      order.totalFormatted,
      order.organizerNet,
      order.organizerNetFormatted,

      order.payment.id,
      order.payment.provider,
      order.payment.providerReference,
      order.payment.method,
      formatStatus(
        order.payment.status,
      ),
      order.payment.amount,
      order.payment.amountFormatted,
      order.payment.currency,
      formatDateTime(
        order.payment.paidAt,
      ),
      order.payment.failureReason,

      order.itemsCount,
      order.ticketsCount,
      order.ticketSummary.valid,
      order.ticketSummary.used,
      order.ticketSummary.cancelled,
      order.ticketSummary.refunded,
    ],
  );

  return [
    header,
    ...rows,
  ];
}

function createItemsRows(
  items: OrganizerOrdersExportItem[],
): CsvRow[] {
  const header: CsvRow = [
    "ID ligne",
    "ID commande",
    "Référence commande",
    "ID événement",
    "Événement",
    "ID type de billet",
    "Type de billet",
    "Description",
    "Quantité",
    "Devise",
    "Prix unitaire numérique",
    "Prix unitaire formaté",
    "Sous-total numérique",
    "Sous-total formaté",
    "Commission numérique",
    "Commission formatée",
    "Total numérique",
    "Total formaté",
  ];

  const rows = items.map(
    (item): CsvRow => [
      item.id,
      item.orderId,
      item.orderReference,
      item.eventId,
      item.eventTitle,
      item.ticketTypeId,
      item.ticketTypeName,
      item.ticketTypeDescription,
      item.quantity,
      item.currency,
      item.unitPrice,
      item.unitPriceFormatted,
      item.subtotal,
      item.subtotalFormatted,
      item.platformFee,
      item.platformFeeFormatted,
      item.total,
      item.totalFormatted,
    ],
  );

  return [
    header,
    ...rows,
  ];
}

function createTicketRows(
  tickets: OrganizerOrdersExportTicketRow[],
): CsvRow[] {
  const header: CsvRow = [
    "ID commande",
    "Référence commande",
    "Statut commande",
    "ID événement",
    "Événement",
    "Nom client",
    "E-mail client",
    "Téléphone client",
    "ID type de billet",
    "Type de billet",
    "Quantité",
    "Devise",
    "Prix unitaire numérique",
    "Prix unitaire formaté",
    "Sous-total ligne numérique",
    "Sous-total ligne formaté",
    "Commission ligne numérique",
    "Commission ligne formatée",
    "Total ligne numérique",
    "Total ligne formaté",
    "Date création",
    "Date paiement",
  ];

  const rows = tickets.map(
    (ticket): CsvRow => [
      ticket.orderId,
      ticket.orderReference,
      formatStatus(
        ticket.orderStatus,
      ),
      ticket.eventId,
      ticket.eventTitle,
      ticket.customerName,
      ticket.customerEmail,
      ticket.customerPhone,
      ticket.ticketTypeId,
      ticket.ticketTypeName,
      ticket.quantity,
      ticket.currency,
      ticket.unitPrice,
      ticket.unitPriceFormatted,
      ticket.lineSubtotal,
      ticket.lineSubtotalFormatted,
      ticket.linePlatformFee,
      ticket.linePlatformFeeFormatted,
      ticket.lineTotal,
      ticket.lineTotalFormatted,
      formatDateTime(
        ticket.createdAt,
      ),
      formatDateTime(
        ticket.paidAt,
      ),
    ],
  );

  return [
    header,
    ...rows,
  ];
}

function createCustomerRows(
  customers: OrganizerOrdersExportCustomerSummary[],
): CsvRow[] {
  const header: CsvRow = [
    "Clé client",
    "ID client",
    "Nom",
    "E-mail",
    "Téléphone",
    "Pays",
    "Code pays",
    "Client invité",
    "Nombre de commandes",
    "Commandes payées",
    "Billets",
    "Devise",
    "Total facturé numérique",
    "Total facturé formaté",
    "Net organisateur numérique",
    "Net organisateur formaté",
  ];

  const rows = customers.flatMap(
    (customer): CsvRow[] => {
      if (
        customer.totalsByCurrency.length === 0
      ) {
        return [
          [
            customer.key,
            customer.id,
            customer.name,
            customer.email,
            customer.phone,
            customer.country,
            customer.countryCode,
            customer.isGuest,
            customer.ordersCount,
            customer.paidOrdersCount,
            customer.ticketsCount,
            "",
            0,
            "",
            0,
            "",
          ],
        ];
      }

      return customer.totalsByCurrency.map(
        (total): CsvRow => [
          customer.key,
          customer.id,
          customer.name,
          customer.email,
          customer.phone,
          customer.country,
          customer.countryCode,
          customer.isGuest,
          customer.ordersCount,
          customer.paidOrdersCount,
          customer.ticketsCount,
          total.currency,
          total.total,
          total.totalFormatted,
          total.organizerNet,
          total.organizerNetFormatted,
        ],
      );
    },
  );

  return [
    header,
    ...rows,
  ];
}

function createSummaryRows(
  data: ExportOrdersDataResult,
): CsvRow[] {
  const rows: CsvRow[] = [
    [
      "INDICATEUR",
      "VALEUR",
      "DEVISE",
      "VALEUR FORMATÉE",
    ],
    [
      "Commandes totales",
      data.summary.totalOrders,
      "",
      "",
    ],
    [
      "Commandes payées",
      data.summary.paidOrders,
      "",
      "",
    ],
    [
      "Commandes en attente",
      data.summary.pendingOrders,
      "",
      "",
    ],
    [
      "Commandes annulées",
      data.summary.cancelledOrders,
      "",
      "",
    ],
    [
      "Commandes remboursées",
      data.summary.refundedOrders,
      "",
      "",
    ],
    [
      "Commandes échouées",
      data.summary.failedOrders,
      "",
      "",
    ],
    [
      "Billets totaux",
      data.summary.totalTickets,
      "",
      "",
    ],
    [
      "Billets valides",
      data.summary.validTickets,
      "",
      "",
    ],
    [
      "Billets utilisés",
      data.summary.usedTickets,
      "",
      "",
    ],
    [
      "Billets annulés",
      data.summary.cancelledTickets,
      "",
      "",
    ],
    [
      "Billets remboursés",
      data.summary.refundedTickets,
      "",
      "",
    ],
    [
      "Clients uniques",
      data.summary.uniqueCustomers,
      "",
      "",
    ],
    [
      "Achats invités",
      data.summary.guestOrders,
      "",
      "",
    ],
    [
      "Commandes clients enregistrés",
      data.summary.registeredCustomerOrders,
      "",
      "",
    ],
  ];

  for (
    const total of
    data.summary.totalsByCurrency
  ) {
    rows.push(
      [
        "Commandes dans la devise",
        total.ordersCount,
        total.currency,
        "",
      ],
      [
        "Commandes payées dans la devise",
        total.paidOrdersCount,
        total.currency,
        "",
      ],
      [
        "Billets dans la devise",
        total.ticketsCount,
        total.currency,
        "",
      ],
      [
        "Sous-total",
        total.subtotal,
        total.currency,
        total.subtotalFormatted,
      ],
      [
        "Commissions Tikemia",
        total.platformFees,
        total.currency,
        total.platformFeesFormatted,
      ],
      [
        "Total facturé",
        total.grossTotal,
        total.currency,
        total.grossTotalFormatted,
      ],
      [
        "Net organisateur",
        total.organizerNet,
        total.currency,
        total.organizerNetFormatted,
      ],
    );
  }

  return rows;
}

function buildRows({
  data,
  section,
  includeMetadata,
}: {
  data: ExportOrdersDataResult;
  section: OrdersCsvSection;
  includeMetadata: boolean;
}): CsvRow[] {
  const metadataRows =
    includeMetadata
      ? createMetadataRows(
          data,
          section,
        )
      : [];

  let sectionRows: CsvRow[];

  switch (section) {
    case "items":
      sectionRows =
        createItemsRows(
          data.items,
        );
      break;

    case "tickets":
      sectionRows =
        createTicketRows(
          data.tickets,
        );
      break;

    case "customers":
      sectionRows =
        createCustomerRows(
          data.customers,
        );
      break;

    case "summary":
      sectionRows =
        createSummaryRows(
          data,
        );
      break;

    case "orders":
    default:
      sectionRows =
        createOrdersRows(
          data.orders,
        );
      break;
  }

  return [
    ...metadataRows,
    ...sectionRows,
  ];
}

function getSectionRowCount(
  data: ExportOrdersDataResult,
  section: OrdersCsvSection,
): number {
  switch (section) {
    case "items":
      return data.items.length;

    case "tickets":
      return data.tickets.length;

    case "customers":
      return data.customers.length;

    case "summary":
      return (
        14 +
        data.summary.totalsByCurrency.length *
          7
      );

    case "orders":
    default:
      return data.orders.length;
  }
}

export function createOrdersCsv(
  data: ExportOrdersDataResult,
  options: CreateOrdersCsvOptions = {},
): CreateOrdersCsvResult {
  if (!data) {
    throw new CreateOrdersCsvError({
      code:
        "EXPORT_DATA_REQUIRED",

      status:
        400,

      message:
        "Les données d’export des commandes sont obligatoires.",
    });
  }

  const section =
    normalizeSection(
      options.section,
    );

  const includeBom =
    options.includeBom !== false;

  const includeMetadata =
    options.includeMetadata !== false;

  try {
    const rows =
      buildRows({
        data,
        section,
        includeMetadata,
      });

    const body =
      serializeRows(rows);

    const content =
      includeBom
        ? `${UTF8_BOM}${body}`
        : body;

    const organizerName =
      data.organizer.businessName ??
      data.organizer.name;

    const filename =
      [
        "tikemia",
        "commandes",
        section,
        sanitizeFilenamePart(
          organizerName,
          "organisateur",
        ),
        formatFilenameDate(
          data.generatedAt,
        ),
      ].join("-") +
      ".csv";

    return {
      content,
      filename,
      mimeType:
        "text/csv; charset=utf-8",

      rowCount:
        getSectionRowCount(
          data,
          section,
        ),
    };
  } catch (error) {
    if (
      error instanceof
      CreateOrdersCsvError
    ) {
      throw error;
    }

    console.error(
      "[CREATE_ORDERS_CSV_ERROR]",
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

    throw new CreateOrdersCsvError({
      code:
        "CREATE_ORDERS_CSV_FAILED",

      status:
        500,

      message:
        "Impossible de créer le fichier CSV des commandes pour le moment.",
    });
  }
}