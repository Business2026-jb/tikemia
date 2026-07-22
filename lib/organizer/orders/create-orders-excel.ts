import "server-only";

import ExcelJS from "exceljs";

import type {
  ExportOrdersDataResult,
  OrganizerOrdersExportCustomerSummary,
  OrganizerOrdersExportItem,
  OrganizerOrdersExportOrder,
  OrganizerOrdersExportTicketRow,
} from "@/lib/organizer/orders/export-orders-data";

const EXCEL_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const MAX_EXCEL_CELL_LENGTH = 32_767;

export type CreateOrdersExcelOptions = {
  includeSummary?: boolean;
  includeOrders?: boolean;
  includeItems?: boolean;
  includeTickets?: boolean;
  includeCustomers?: boolean;
  includeFilters?: boolean;
};

export type CreateOrdersExcelResult = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  worksheets: string[];
};

export class CreateOrdersExcelError extends Error {
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

    this.name = "CreateOrdersExcelError";
    this.code = code;
    this.status = status;
  }
}

type WorksheetColumnDefinition = {
  header: string;
  key: string;
  width: number;
  style?: Partial<ExcelJS.Style>;
};

const COLORS = {
  background: "FF071014",
  backgroundSoft: "FF0B151B",
  backgroundMuted: "FF101B21",
  border: "FF25333A",
  white: "FFFFFFFF",
  text: "FFD6DEE2",
  muted: "FF89969D",
  green: "FF84CC16",
  greenDark: "FF166534",
  orange: "FFF97316",
  orangeDark: "FF9A3412",
  blue: "FF38BDF8",
  blueDark: "FF075985",
  red: "FFF87171",
  redDark: "FF991B1B",
  violet: "FFC084FC",
  violetDark: "FF6B21A8",
  amber: "FFFBBF24",
  amberDark: "FF92400E",
} as const;

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

  if (Number.isNaN(date.getTime())) {
    return new Date()
      .toISOString()
      .slice(0, 10);
  }

  return date
    .toISOString()
    .slice(0, 10);
}

function safeCellText(
  value:
    | string
    | null
    | undefined,
): string {
  const normalized =
    value?.replace(/\u0000/g, "").trim() ?? "";

  if (
    normalized.length <=
    MAX_EXCEL_CELL_LENGTH
  ) {
    return normalized;
  }

  return normalized.slice(
    0,
    MAX_EXCEL_CELL_LENGTH,
  );
}

function toExcelDate(
  value: string | null,
): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
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

function getCurrencyNumberFormat(
  fractionDigits: number,
): string {
  if (fractionDigits <= 0) {
    return '#,##0';
  }

  return `#,##0.${"0".repeat(
    Math.min(
      fractionDigits,
      3,
    ),
  )}`;
}

function getCurrencyFractionDigits(
  data: ExportOrdersDataResult,
  currency: string,
): number {
  const definition =
    data.summary.totalsByCurrency.find(
      (item) =>
        item.currency === currency,
    );

  if (!definition) {
    return currency === "XOF" ||
      currency === "XAF"
      ? 0
      : 2;
  }

  return currency === "XOF" ||
    currency === "XAF"
    ? 0
    : 2;
}

function applyWorksheetBaseStyle(
  worksheet: ExcelJS.Worksheet,
): void {
  worksheet.properties.defaultRowHeight = 20;
  worksheet.views = [
    {
      state: "frozen",
      ySplit: 1,
      showGridLines: false,
    },
  ];

  worksheet.eachRow(
    (
      row,
    ) => {
      row.alignment = {
        vertical: "middle",
      };
    },
  );
}

function styleHeaderRow(
  row: ExcelJS.Row,
): void {
  row.height = 30;

  row.eachCell(
    (
      cell,
    ) => {
      cell.font = {
        bold: true,
        color: {
          argb:
            COLORS.white,
        },
        size: 10,
      };

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb:
            COLORS.background,
        },
      };

      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };

      cell.border = {
        top: {
          style: "thin",
          color: {
            argb:
              COLORS.border,
          },
        },
        left: {
          style: "thin",
          color: {
            argb:
              COLORS.border,
          },
        },
        bottom: {
          style: "thin",
          color: {
            argb:
              COLORS.border,
          },
        },
        right: {
          style: "thin",
          color: {
            argb:
              COLORS.border,
          },
        },
      };
    },
  );
}

function styleDataRows(
  worksheet: ExcelJS.Worksheet,
  startRow = 2,
): void {
  for (
    let rowIndex = startRow;
    rowIndex <= worksheet.rowCount;
    rowIndex += 1
  ) {
    const row =
      worksheet.getRow(
        rowIndex,
      );

    const background =
      rowIndex % 2 === 0
        ? COLORS.backgroundSoft
        : COLORS.backgroundMuted;

    row.eachCell(
      (
        cell,
      ) => {
        cell.font = {
          color: {
            argb:
              COLORS.text,
          },
          size: 10,
        };

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb:
              background,
          },
        };

        cell.alignment = {
          vertical: "middle",
          wrapText: true,
        };

        cell.border = {
          bottom: {
            style: "hair",
            color: {
              argb:
                COLORS.border,
            },
          },
        };
      },
    );
  }
}

function addColumns(
  worksheet: ExcelJS.Worksheet,
  columns: WorksheetColumnDefinition[],
): void {
  worksheet.columns =
    columns.map(
      (
        column,
      ) => ({
        header:
          column.header,
        key:
          column.key,
        width:
          column.width,
        style:
          column.style,
      }),
    );

  styleHeaderRow(
    worksheet.getRow(1),
  );
}

function setAutoFilter(
  worksheet: ExcelJS.Worksheet,
): void {
  if (
    worksheet.columnCount === 0
  ) {
    return;
  }

  worksheet.autoFilter = {
    from: {
      row: 1,
      column: 1,
    },
    to: {
      row: 1,
      column:
        worksheet.columnCount,
    },
  };
}

function applyDateFormat(
  worksheet: ExcelJS.Worksheet,
  keys: string[],
): void {
  for (const key of keys) {
    const column =
      worksheet.getColumn(key);

    column.numFmt =
      "dd/mm/yyyy hh:mm";
  }
}

function applyCurrencyFormat({
  worksheet,
  data,
  amountKey,
  currencyKey,
}: {
  worksheet: ExcelJS.Worksheet;
  data: ExportOrdersDataResult;
  amountKey: string;
  currencyKey: string;
}): void {
  for (
    let rowIndex = 2;
    rowIndex <= worksheet.rowCount;
    rowIndex += 1
  ) {
    const row =
      worksheet.getRow(
        rowIndex,
      );

    const currency =
      String(
        row.getCell(
          currencyKey,
        ).value ?? "",
      );

    const fractionDigits =
      getCurrencyFractionDigits(
        data,
        currency,
      );

    row.getCell(
      amountKey,
    ).numFmt =
      getCurrencyNumberFormat(
        fractionDigits,
      );
  }
}

function addWorkbookProperties({
  workbook,
  data,
}: {
  workbook: ExcelJS.Workbook;
  data: ExportOrdersDataResult;
}): void {
  workbook.creator = "Tikemia";
  workbook.lastModifiedBy = "Tikemia";
  workbook.created =
    new Date(
      data.generatedAt,
    );
  workbook.modified =
    new Date();
  workbook.company = "Tikemia";
  workbook.subject =
    "Rapport des commandes organisateur";
  workbook.title =
    `Commandes Tikemia — ${
      data.organizer.businessName ??
      data.organizer.name
    }`;
  workbook.description =
    "Rapport professionnel des commandes, clients, billets, paiements et revenus.";
  workbook.keywords =
    "Tikemia, commandes, billets, événements, paiements, export";
  workbook.category =
    "Rapports organisateur";
}

function createSummaryWorksheet({
  workbook,
  data,
}: {
  workbook: ExcelJS.Workbook;
  data: ExportOrdersDataResult;
}): ExcelJS.Worksheet {
  const worksheet =
    workbook.addWorksheet(
      "Résumé",
      {
        properties: {
          tabColor: {
            argb:
              COLORS.green,
          },
        },
      },
    );

  worksheet.views = [
    {
      showGridLines: false,
    },
  ];

  worksheet.columns = [
    {
      width: 34,
    },
    {
      width: 24,
    },
    {
      width: 18,
    },
    {
      width: 28,
    },
  ];

  worksheet.mergeCells(
    "A1:D1",
  );

  const titleCell =
    worksheet.getCell(
      "A1",
    );

  titleCell.value =
    "RAPPORT COMMANDES TIKEMIA";
  titleCell.font = {
    bold: true,
    size: 18,
    color: {
      argb:
        COLORS.white,
    },
  };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
      argb:
        COLORS.background,
    },
  };
  titleCell.alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  worksheet.getRow(1).height = 36;

  const organizerName =
    data.organizer.businessName ??
    data.organizer.name;

  const infoRows = [
    [
      "Organisateur",
      organizerName,
      "E-mail",
      data.organizer.email,
    ],
    [
      "Pays",
      data.organizer.country ?? "",
      "Date de génération",
      toExcelDate(
        data.generatedAt,
      ),
    ],
    [
      "Commandes exportées",
      data.metadata.exportedOrders,
      "Commandes correspondantes",
      data.metadata.totalMatchingOrders,
    ],
    [
      "Export limité",
      data.metadata.truncated
        ? "Oui"
        : "Non",
      "Limite maximale",
      data.metadata.maxOrders,
    ],
  ];

  for (const values of infoRows) {
    worksheet.addRow(
      values,
    );
  }

  worksheet.getColumn(4).numFmt =
    "dd/mm/yyyy hh:mm";

  worksheet.addRow([]);
  worksheet.addRow([
    "INDICATEUR",
    "VALEUR",
    "DEVISE",
    "VALEUR FORMATÉE",
  ]);

  const summaryStart =
    worksheet.rowCount;

  const summaryRows: Array<
    [
      string,
      number | string,
      string,
      string,
    ]
  > = [
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
    const row of
    summaryRows
  ) {
    worksheet.addRow(
      row,
    );
  }

  for (
    const total of
    data.summary.totalsByCurrency
  ) {
    worksheet.addRow([
      "Commandes dans la devise",
      total.ordersCount,
      total.currency,
      "",
    ]);

    worksheet.addRow([
      "Commandes payées",
      total.paidOrdersCount,
      total.currency,
      "",
    ]);

    worksheet.addRow([
      "Billets vendus",
      total.ticketsCount,
      total.currency,
      "",
    ]);

    worksheet.addRow([
      "Sous-total",
      total.subtotal,
      total.currency,
      total.subtotalFormatted,
    ]);

    worksheet.addRow([
      "Commission Tikemia",
      total.platformFees,
      total.currency,
      total.platformFeesFormatted,
    ]);

    worksheet.addRow([
      "Total facturé",
      total.grossTotal,
      total.currency,
      total.grossTotalFormatted,
    ]);

    worksheet.addRow([
      "Net organisateur",
      total.organizerNet,
      total.currency,
      total.organizerNetFormatted,
    ]);
  }

  const headerRow =
    worksheet.getRow(
      summaryStart,
    );

  styleHeaderRow(
    headerRow,
  );

  for (
    let rowIndex =
      summaryStart + 1;
    rowIndex <= worksheet.rowCount;
    rowIndex += 1
  ) {
    const row =
      worksheet.getRow(
        rowIndex,
      );

    row.eachCell(
      (
        cell,
      ) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb:
              rowIndex % 2 === 0
                ? COLORS.backgroundSoft
                : COLORS.backgroundMuted,
          },
        };

        cell.font = {
          color: {
            argb:
              COLORS.text,
          },
        };

        cell.border = {
          bottom: {
            style: "hair",
            color: {
              argb:
                COLORS.border,
            },
          },
        };
      },
    );

    const currency =
      String(
        row.getCell(3).value ?? "",
      );

    if (
      currency &&
      typeof row.getCell(2).value ===
        "number"
    ) {
      row.getCell(2).numFmt =
        getCurrencyNumberFormat(
          getCurrencyFractionDigits(
            data,
            currency,
          ),
        );
    }
  }

  worksheet.addRow([]);
  worksheet.addRow([
    "FILTRES APPLIQUÉS",
    "",
    "",
    "",
  ]);

  const filtersHeader =
    worksheet.getRow(
      worksheet.rowCount,
    );

  worksheet.mergeCells(
    filtersHeader.number,
    1,
    filtersHeader.number,
    4,
  );

  styleHeaderRow(
    filtersHeader,
  );

  const filters = [
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
      toExcelDate(
        data.filters.dateFrom,
      ),
    ],
    [
      "Date de fin",
      toExcelDate(
        data.filters.dateTo,
      ),
    ],
    [
      "Tri",
      data.filters.sort,
    ],
  ];

  for (const filter of filters) {
    worksheet.addRow([
      filter[0],
      filter[1],
      "",
      "",
    ]);
  }

  worksheet.getColumn(2).alignment = {
    wrapText: true,
    vertical: "middle",
  };

  worksheet.pageSetup = {
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.35,
      right: 0.35,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  };

  worksheet.headerFooter = {
    oddFooter:
      "&LTikemia&CPage &P sur &N&RConfidentiel",
  };

  return worksheet;
}

function createOrdersWorksheet({
  workbook,
  data,
}: {
  workbook: ExcelJS.Workbook;
  data: ExportOrdersDataResult;
}): ExcelJS.Worksheet {
  const worksheet =
    workbook.addWorksheet(
      "Commandes",
      {
        properties: {
          tabColor: {
            argb:
              COLORS.orange,
          },
        },
      },
    );

  addColumns(
    worksheet,
    [
      {
        header: "ID commande",
        key: "id",
        width: 28,
      },
      {
        header: "Référence",
        key: "reference",
        width: 20,
      },
      {
        header: "Statut",
        key: "status",
        width: 16,
      },
      {
        header: "Créée le",
        key: "createdAt",
        width: 20,
      },
      {
        header: "Payée le",
        key: "paidAt",
        width: 20,
      },
      {
        header: "Client",
        key: "customerName",
        width: 24,
      },
      {
        header: "E-mail client",
        key: "customerEmail",
        width: 30,
      },
      {
        header: "Téléphone",
        key: "customerPhone",
        width: 20,
      },
      {
        header: "Pays client",
        key: "customerCountry",
        width: 18,
      },
      {
        header: "Achat invité",
        key: "isGuest",
        width: 14,
      },
      {
        header: "Événement",
        key: "eventTitle",
        width: 34,
      },
      {
        header: "Début événement",
        key: "eventStartsAt",
        width: 20,
      },
      {
        header: "Lieu",
        key: "venue",
        width: 28,
      },
      {
        header: "Ville",
        key: "city",
        width: 18,
      },
      {
        header: "Pays événement",
        key: "eventCountry",
        width: 18,
      },
      {
        header: "Devise",
        key: "currency",
        width: 12,
      },
      {
        header: "Sous-total",
        key: "subtotal",
        width: 18,
      },
      {
        header: "Commission",
        key: "platformFee",
        width: 18,
      },
      {
        header: "Total facturé",
        key: "total",
        width: 18,
      },
      {
        header: "Net organisateur",
        key: "organizerNet",
        width: 20,
      },
      {
        header: "Prestataire",
        key: "provider",
        width: 18,
      },
      {
        header: "Moyen paiement",
        key: "paymentMethod",
        width: 20,
      },
      {
        header: "Statut paiement",
        key: "paymentStatus",
        width: 18,
      },
      {
        header: "Référence paiement",
        key: "paymentReference",
        width: 26,
      },
      {
        header: "Montant paiement",
        key: "paymentAmount",
        width: 18,
      },
      {
        header: "Billets",
        key: "ticketsCount",
        width: 12,
      },
      {
        header: "Valides",
        key: "validTickets",
        width: 12,
      },
      {
        header: "Utilisés",
        key: "usedTickets",
        width: 12,
      },
      {
        header: "Annulés",
        key: "cancelledTickets",
        width: 12,
      },
      {
        header: "Remboursés",
        key: "refundedTickets",
        width: 14,
      },
    ],
  );

  for (
    const order of
    data.orders
  ) {
    worksheet.addRow({
      id:
        order.id,
      reference:
        order.reference,
      status:
        formatStatus(
          order.status,
        ),
      createdAt:
        toExcelDate(
          order.createdAt,
        ),
      paidAt:
        toExcelDate(
          order.paidAt,
        ),
      customerName:
        safeCellText(
          order.customer.name,
        ),
      customerEmail:
        safeCellText(
          order.customer.email,
        ),
      customerPhone:
        safeCellText(
          order.customer.phone,
        ),
      customerCountry:
        safeCellText(
          order.customer.country,
        ),
      isGuest:
        order.customer.isGuest
          ? "Oui"
          : "Non",
      eventTitle:
        safeCellText(
          order.event.title,
        ),
      eventStartsAt:
        toExcelDate(
          order.event.startsAt,
        ),
      venue:
        safeCellText(
          order.event.venueName,
        ),
      city:
        safeCellText(
          order.event.city,
        ),
      eventCountry:
        safeCellText(
          order.event.country,
        ),
      currency:
        order.currency,
      subtotal:
        order.subtotal,
      platformFee:
        order.platformFee,
      total:
        order.total,
      organizerNet:
        order.organizerNet,
      provider:
        safeCellText(
          order.payment.provider,
        ),
      paymentMethod:
        safeCellText(
          order.payment.method,
        ),
      paymentStatus:
        formatStatus(
          order.payment.status,
        ),
      paymentReference:
        safeCellText(
          order.payment.providerReference,
        ),
      paymentAmount:
        order.payment.amount,
      ticketsCount:
        order.ticketSummary.total,
      validTickets:
        order.ticketSummary.valid,
      usedTickets:
        order.ticketSummary.used,
      cancelledTickets:
        order.ticketSummary.cancelled,
      refundedTickets:
        order.ticketSummary.refunded,
    });
  }

  applyWorksheetBaseStyle(
    worksheet,
  );

  styleDataRows(
    worksheet,
  );

  setAutoFilter(
    worksheet,
  );

  applyDateFormat(
    worksheet,
    [
      "createdAt",
      "paidAt",
      "eventStartsAt",
    ],
  );

  for (const key of [
    "subtotal",
    "platformFee",
    "total",
    "organizerNet",
    "paymentAmount",
  ]) {
    applyCurrencyFormat({
      worksheet,
      data,
      amountKey:
        key,
      currencyKey:
        "currency",
    });
  }

  worksheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.2,
      right: 0.2,
      top: 0.4,
      bottom: 0.4,
      header: 0.2,
      footer: 0.2,
    },
  };

  worksheet.headerFooter = {
    oddHeader:
      "&LTikemia — Commandes&C&F&RPage &P sur &N",
    oddFooter:
      "&LDocument confidentiel&RExport organisateur",
  };

  return worksheet;
}

function createItemsWorksheet({
  workbook,
  data,
}: {
  workbook: ExcelJS.Workbook;
  data: ExportOrdersDataResult;
}): ExcelJS.Worksheet {
  const worksheet =
    workbook.addWorksheet(
      "Articles",
      {
        properties: {
          tabColor: {
            argb:
              COLORS.blue,
          },
        },
      },
    );

  addColumns(
    worksheet,
    [
      {
        header: "ID ligne",
        key: "id",
        width: 28,
      },
      {
        header: "Référence commande",
        key: "orderReference",
        width: 20,
      },
      {
        header: "Événement",
        key: "eventTitle",
        width: 34,
      },
      {
        header: "Type de billet",
        key: "ticketTypeName",
        width: 24,
      },
      {
        header: "Description",
        key: "description",
        width: 34,
      },
      {
        header: "Quantité",
        key: "quantity",
        width: 12,
      },
      {
        header: "Devise",
        key: "currency",
        width: 12,
      },
      {
        header: "Prix unitaire",
        key: "unitPrice",
        width: 18,
      },
      {
        header: "Sous-total",
        key: "subtotal",
        width: 18,
      },
      {
        header: "Commission",
        key: "platformFee",
        width: 18,
      },
      {
        header: "Total",
        key: "total",
        width: 18,
      },
    ],
  );

  for (
    const item of
    data.items
  ) {
    worksheet.addRow({
      id:
        item.id,
      orderReference:
        item.orderReference,
      eventTitle:
        safeCellText(
          item.eventTitle,
        ),
      ticketTypeName:
        safeCellText(
          item.ticketTypeName,
        ),
      description:
        safeCellText(
          item.ticketTypeDescription,
        ),
      quantity:
        item.quantity,
      currency:
        item.currency,
      unitPrice:
        item.unitPrice,
      subtotal:
        item.subtotal,
      platformFee:
        item.platformFee,
      total:
        item.total,
    });
  }

  applyWorksheetBaseStyle(
    worksheet,
  );

  styleDataRows(
    worksheet,
  );

  setAutoFilter(
    worksheet,
  );

  for (const key of [
    "unitPrice",
    "subtotal",
    "platformFee",
    "total",
  ]) {
    applyCurrencyFormat({
      worksheet,
      data,
      amountKey:
        key,
      currencyKey:
        "currency",
    });
  }

  return worksheet;
}

function createTicketsWorksheet({
  workbook,
  data,
}: {
  workbook: ExcelJS.Workbook;
  data: ExportOrdersDataResult;
}): ExcelJS.Worksheet {
  const worksheet =
    workbook.addWorksheet(
      "Billets",
      {
        properties: {
          tabColor: {
            argb:
              COLORS.violet,
          },
        },
      },
    );

  addColumns(
    worksheet,
    [
      {
        header: "Référence commande",
        key: "orderReference",
        width: 20,
      },
      {
        header: "Statut commande",
        key: "orderStatus",
        width: 16,
      },
      {
        header: "Événement",
        key: "eventTitle",
        width: 34,
      },
      {
        header: "Client",
        key: "customerName",
        width: 24,
      },
      {
        header: "E-mail",
        key: "customerEmail",
        width: 30,
      },
      {
        header: "Téléphone",
        key: "customerPhone",
        width: 20,
      },
      {
        header: "Type de billet",
        key: "ticketTypeName",
        width: 24,
      },
      {
        header: "Quantité",
        key: "quantity",
        width: 12,
      },
      {
        header: "Devise",
        key: "currency",
        width: 12,
      },
      {
        header: "Prix unitaire",
        key: "unitPrice",
        width: 18,
      },
      {
        header: "Sous-total",
        key: "lineSubtotal",
        width: 18,
      },
      {
        header: "Commission",
        key: "linePlatformFee",
        width: 18,
      },
      {
        header: "Total ligne",
        key: "lineTotal",
        width: 18,
      },
      {
        header: "Créée le",
        key: "createdAt",
        width: 20,
      },
      {
        header: "Payée le",
        key: "paidAt",
        width: 20,
      },
    ],
  );

  for (
    const ticket of
    data.tickets
  ) {
    worksheet.addRow({
      orderReference:
        ticket.orderReference,
      orderStatus:
        formatStatus(
          ticket.orderStatus,
        ),
      eventTitle:
        safeCellText(
          ticket.eventTitle,
        ),
      customerName:
        safeCellText(
          ticket.customerName,
        ),
      customerEmail:
        safeCellText(
          ticket.customerEmail,
        ),
      customerPhone:
        safeCellText(
          ticket.customerPhone,
        ),
      ticketTypeName:
        safeCellText(
          ticket.ticketTypeName,
        ),
      quantity:
        ticket.quantity,
      currency:
        ticket.currency,
      unitPrice:
        ticket.unitPrice,
      lineSubtotal:
        ticket.lineSubtotal,
      linePlatformFee:
        ticket.linePlatformFee,
      lineTotal:
        ticket.lineTotal,
      createdAt:
        toExcelDate(
          ticket.createdAt,
        ),
      paidAt:
        toExcelDate(
          ticket.paidAt,
        ),
    });
  }

  applyWorksheetBaseStyle(
    worksheet,
  );

  styleDataRows(
    worksheet,
  );

  setAutoFilter(
    worksheet,
  );

  applyDateFormat(
    worksheet,
    [
      "createdAt",
      "paidAt",
    ],
  );

  for (const key of [
    "unitPrice",
    "lineSubtotal",
    "linePlatformFee",
    "lineTotal",
  ]) {
    applyCurrencyFormat({
      worksheet,
      data,
      amountKey:
        key,
      currencyKey:
        "currency",
    });
  }

  return worksheet;
}

function createCustomersWorksheet({
  workbook,
  data,
}: {
  workbook: ExcelJS.Workbook;
  data: ExportOrdersDataResult;
}): ExcelJS.Worksheet {
  const worksheet =
    workbook.addWorksheet(
      "Clients",
      {
        properties: {
          tabColor: {
            argb:
              COLORS.amber,
          },
        },
      },
    );

  addColumns(
    worksheet,
    [
      {
        header: "ID client",
        key: "id",
        width: 28,
      },
      {
        header: "Nom",
        key: "name",
        width: 26,
      },
      {
        header: "E-mail",
        key: "email",
        width: 30,
      },
      {
        header: "Téléphone",
        key: "phone",
        width: 20,
      },
      {
        header: "Pays",
        key: "country",
        width: 18,
      },
      {
        header: "Code pays",
        key: "countryCode",
        width: 12,
      },
      {
        header: "Client invité",
        key: "isGuest",
        width: 14,
      },
      {
        header: "Commandes",
        key: "ordersCount",
        width: 14,
      },
      {
        header: "Commandes payées",
        key: "paidOrdersCount",
        width: 18,
      },
      {
        header: "Billets",
        key: "ticketsCount",
        width: 14,
      },
      {
        header: "Devise",
        key: "currency",
        width: 12,
      },
      {
        header: "Total facturé",
        key: "total",
        width: 18,
      },
      {
        header: "Net organisateur",
        key: "organizerNet",
        width: 20,
      },
    ],
  );

  for (
    const customer of
    data.customers
  ) {
    const totals =
      customer.totalsByCurrency.length >
      0
        ? customer.totalsByCurrency
        : [
            {
              currency:
                "" as never,
              total:
                0,
              totalFormatted:
                "",
              organizerNet:
                0,
              organizerNetFormatted:
                "",
            },
          ];

    for (const total of totals) {
      worksheet.addRow({
        id:
          customer.id,
        name:
          safeCellText(
            customer.name,
          ),
        email:
          safeCellText(
            customer.email,
          ),
        phone:
          safeCellText(
            customer.phone,
          ),
        country:
          safeCellText(
            customer.country,
          ),
        countryCode:
          safeCellText(
            customer.countryCode,
          ),
        isGuest:
          customer.isGuest
            ? "Oui"
            : "Non",
        ordersCount:
          customer.ordersCount,
        paidOrdersCount:
          customer.paidOrdersCount,
        ticketsCount:
          customer.ticketsCount,
        currency:
          total.currency,
        total:
          total.total,
        organizerNet:
          total.organizerNet,
      });
    }
  }

  applyWorksheetBaseStyle(
    worksheet,
  );

  styleDataRows(
    worksheet,
  );

  setAutoFilter(
    worksheet,
  );

  for (const key of [
    "total",
    "organizerNet",
  ]) {
    applyCurrencyFormat({
      worksheet,
      data,
      amountKey:
        key,
      currencyKey:
        "currency",
    });
  }

  return worksheet;
}

function addStatusConditionalFormatting(
  worksheet: ExcelJS.Worksheet,
): void {
  const statusColumn =
    worksheet.getColumn(
      "status",
    );

  if (
    !statusColumn.number
  ) {
    return;
  }

  const range =
    `${statusColumn.letter}2:${statusColumn.letter}${Math.max(
      worksheet.rowCount,
      2,
    )}`;

  worksheet.addConditionalFormatting({
    ref: range,
    rules: [
      {
        type: "containsText",
        operator: "containsText",
        text: "Payée",
        priority: 1,
        style: {
          fill: {
            type: "pattern",
            pattern: "solid",
            bgColor: {
              argb:
                COLORS.greenDark,
            },
            fgColor: {
              argb:
                COLORS.greenDark,
            },
          },
          font: {
            color: {
              argb:
                COLORS.green,
            },
            bold: true,
          },
        },
      },
      {
        type: "containsText",
        operator: "containsText",
        text: "En attente",
        priority: 2,
        style: {
          fill: {
            type: "pattern",
            pattern: "solid",
            bgColor: {
              argb:
                COLORS.amberDark,
            },
            fgColor: {
              argb:
                COLORS.amberDark,
            },
          },
          font: {
            color: {
              argb:
                COLORS.amber,
            },
            bold: true,
          },
        },
      },
      {
        type: "containsText",
        operator: "containsText",
        text: "Échouée",
        priority: 3,
        style: {
          fill: {
            type: "pattern",
            pattern: "solid",
            bgColor: {
              argb:
                COLORS.redDark,
            },
            fgColor: {
              argb:
                COLORS.redDark,
            },
          },
          font: {
            color: {
              argb:
                COLORS.red,
            },
            bold: true,
          },
        },
      },
      {
        type: "containsText",
        operator: "containsText",
        text: "Remboursée",
        priority: 4,
        style: {
          fill: {
            type: "pattern",
            pattern: "solid",
            bgColor: {
              argb:
                COLORS.violetDark,
            },
            fgColor: {
              argb:
                COLORS.violetDark,
            },
          },
          font: {
            color: {
              argb:
                COLORS.violet,
            },
            bold: true,
          },
        },
      },
    ],
  });
}

export async function createOrdersExcel(
  data: ExportOrdersDataResult,
  options: CreateOrdersExcelOptions = {},
): Promise<CreateOrdersExcelResult> {
  if (!data) {
    throw new CreateOrdersExcelError({
      code:
        "EXPORT_DATA_REQUIRED",
      status:
        400,
      message:
        "Les données d’export des commandes sont obligatoires.",
    });
  }

  const includeSummary =
    options.includeSummary !== false;

  const includeOrders =
    options.includeOrders !== false;

  const includeItems =
    options.includeItems !== false;

  const includeTickets =
    options.includeTickets !== false;

  const includeCustomers =
    options.includeCustomers !== false;

  try {
    const workbook =
      new ExcelJS.Workbook();

    addWorkbookProperties({
      workbook,
      data,
    });

    const worksheets: string[] = [];

    if (includeSummary) {
      const worksheet =
        createSummaryWorksheet({
          workbook,
          data,
        });

      worksheets.push(
        worksheet.name,
      );
    }

    if (includeOrders) {
      const worksheet =
        createOrdersWorksheet({
          workbook,
          data,
        });

      addStatusConditionalFormatting(
        worksheet,
      );

      worksheets.push(
        worksheet.name,
      );
    }

    if (includeItems) {
      const worksheet =
        createItemsWorksheet({
          workbook,
          data,
        });

      worksheets.push(
        worksheet.name,
      );
    }

    if (includeTickets) {
      const worksheet =
        createTicketsWorksheet({
          workbook,
          data,
        });

      worksheets.push(
        worksheet.name,
      );
    }

    if (includeCustomers) {
      const worksheet =
        createCustomersWorksheet({
          workbook,
          data,
        });

      worksheets.push(
        worksheet.name,
      );
    }

    if (
      workbook.worksheets.length === 0
    ) {
      throw new CreateOrdersExcelError({
        code:
          "NO_WORKSHEET_SELECTED",
        status:
          400,
        message:
          "Au moins une feuille Excel doit être activée.",
      });
    }

    const arrayBuffer =
      await workbook.xlsx.writeBuffer();

    const buffer =
      Buffer.from(
        arrayBuffer,
      );

    const organizerName =
      data.organizer.businessName ??
      data.organizer.name;

    const filename =
      [
        "tikemia",
        "commandes",
        sanitizeFilenamePart(
          organizerName,
          "organisateur",
        ),
        formatFilenameDate(
          data.generatedAt,
        ),
      ].join("-") +
      ".xlsx";

    return {
      buffer,
      filename,
      mimeType:
        EXCEL_MIME_TYPE,
      worksheets,
    };
  } catch (error) {
    if (
      error instanceof
      CreateOrdersExcelError
    ) {
      throw error;
    }

    console.error(
      "[CREATE_ORDERS_EXCEL_ERROR]",
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

    throw new CreateOrdersExcelError({
      code:
        "CREATE_ORDERS_EXCEL_FAILED",
      status:
        500,
      message:
        "Impossible de créer le fichier Excel des commandes pour le moment.",
    });
  }
}