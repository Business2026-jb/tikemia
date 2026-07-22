import { createHash } from "node:crypto";

import ExcelJS from "exceljs";
import { cookies } from "next/headers";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getOrganizerOrderDetails,
  GetOrganizerOrderDetailsError,
  type OrganizerOrderDetails,
} from "@/lib/organizer/get-organizer-order-details";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ExportFormat =
  | "csv"
  | "xlsx"
  | "pdf";

type ConnectedOrganizer = {
  id: string;
  email: string;
};

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const CSV_MIME_TYPE =
  "text/csv; charset=utf-8";

const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const UTF8_BOM =
  "\uFEFF";

const CSV_SEPARATOR =
  ";";

const CSV_LINE_BREAK =
  "\r\n";

class OrganizerOrderExportRouteError extends Error {
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

    this.name =
      "OrganizerOrderExportRouteError";

    this.code =
      code;

    this.status =
      status;
  }
}

function hashSessionToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function normalizeFormat(
  value: string | null,
): ExportFormat {
  const normalized =
    value?.trim().toLowerCase() ?? "";

  if (
    normalized === "xlsx" ||
    normalized === "pdf"
  ) {
    return normalized;
  }

  return "csv";
}

function normalizeText(
  value:
    | string
    | null
    | undefined,
  fallback = "",
): string {
  const normalized =
    value
      ?.replace(/\u0000/g, "")
      .replace(/\s+/g, " ")
      .trim() ??
    "";

  return normalized || fallback;
}

function formatDateTime(
  value: string | null,
): string {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

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
      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",

      second:
        "2-digit",

      hour12:
        false,

      timeZone:
        "UTC",
    },
  ).format(date);
}

function formatStatus(
  value:
    | string
    | null,
): string {
  const labels: Record<
    string,
    string
  > = {
    PENDING:
      "En attente",

    PAID:
      "Payée",

    CANCELLED:
      "Annulée",

    REFUNDED:
      "Remboursée",

    FAILED:
      "Échouée",

    SUCCESS:
      "Réussi",

    VALID:
      "Valide",

    USED:
      "Utilisé",
  };

  if (!value) {
    return "";
  }

  return labels[value] ?? value;
}

function sanitizeFilenamePart(
  value: string,
  fallback: string,
): string {
  const normalized =
    value
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .replace(
        /[^a-zA-Z0-9_-]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      )
      .replace(
        /-{2,}/g,
        "-",
      )
      .toLowerCase();

  return normalized || fallback;
}

function createContentDisposition(
  filename: string,
): string {
  const safeFilename =
    filename
      .replace(/[\r\n"]/g, "")
      .trim();

  const asciiFilename =
    safeFilename
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .replace(
        /[^\x20-\x7E]/g,
        "",
      )
      .replace(
        /[\\/:*?<>|]/g,
        "-",
      ) ||
    "tikemia-commande";

  const encodedFilename =
    encodeURIComponent(
      safeFilename,
    ).replace(
      /['()]/g,
      escape,
    );

  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`;
}

function createDownloadHeaders({
  filename,
  mimeType,
  contentLength,
}: {
  filename: string;
  mimeType: string;
  contentLength: number;
}): Headers {
  const headers =
    new Headers();

  headers.set(
    "Content-Type",
    mimeType,
  );

  headers.set(
    "Content-Disposition",
    createContentDisposition(
      filename,
    ),
  );

  headers.set(
    "Content-Length",
    String(
      contentLength,
    ),
  );

  headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate, max-age=0",
  );

  headers.set(
    "Pragma",
    "no-cache",
  );

  headers.set(
    "Expires",
    "0",
  );

  headers.set(
    "X-Content-Type-Options",
    "nosniff",
  );

  return headers;
}

function createErrorResponse({
  code,
  message,
  status,
}: {
  code: string;
  message: string;
  status: number;
}) {
  return NextResponse.json(
    {
      success:
        false,

      error: {
        code,
        message,
      },
    },
    {
      status,

      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
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
  value:
    | string
    | number
    | boolean
    | null
    | undefined,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return '""';
  }

  let normalized: string;

  if (
    typeof value === "boolean"
  ) {
    normalized =
      value
        ? "Oui"
        : "Non";
  } else if (
    typeof value === "number"
  ) {
    normalized =
      Number.isFinite(value)
        ? String(value).replace(".", ",")
        : "";
  } else {
    normalized =
      protectSpreadsheetFormula(
        value
          .replace(/\u0000/g, "")
          .replace(/\r\n|\r|\n/g, " ")
          .trim(),
      );
  }

  return `"${normalized.replace(/"/g, '""')}"`;
}

function serializeCsvRows(
  rows: Array<
    Array<
      | string
      | number
      | boolean
      | null
      | undefined
    >
  >,
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

function createSingleOrderCsv(
  order: OrganizerOrderDetails,
): {
  content: string;
  filename: string;
} {
  const organizerName =
    order.organizer.profile
      ?.businessName ??
    order.organizer.fullName;

  const rows: Array<
    Array<
      | string
      | number
      | boolean
      | null
      | undefined
    >
  > = [
    [
      "EXPORT COMMANDE TIKEMIA",
    ],

    [
      "Référence",
      order.reference,
    ],

    [
      "Statut",
      formatStatus(
        order.status,
      ),
    ],

    [
      "Créée le",
      formatDateTime(
        order.createdAt,
      ),
    ],

    [
      "Payée le",
      formatDateTime(
        order.paidAt,
      ),
    ],

    [
      "Devise",
      order.currency,
    ],

    [
      "Organisateur",
      organizerName,
    ],

    [
      "E-mail organisateur",
      order.organizer.email,
    ],

    [],

    [
      "CLIENT",
    ],

    [
      "Nom",
      order.customer.name,
    ],

    [
      "E-mail",
      order.customer.email,
    ],

    [
      "Téléphone",
      order.customer.phone,
    ],

    [
      "Pays",
      order.customer.country,
    ],

    [
      "Client invité",
      order.customer.isGuest,
    ],

    [],

    [
      "ÉVÉNEMENT",
    ],

    [
      "Titre",
      order.event.title,
    ],

    [
      "Catégorie",
      order.event.category?.name,
    ],

    [
      "Début",
      formatDateTime(
        order.event.startsAt,
      ),
    ],

    [
      "Fin",
      formatDateTime(
        order.event.endsAt,
      ),
    ],

    [
      "Lieu",
      order.event.venueName,
    ],

    [
      "Adresse",
      order.event.address,
    ],

    [
      "Ville",
      order.event.city,
    ],

    [
      "Pays",
      order.event.country,
    ],

    [],

    [
      "ARTICLES",
    ],

    [
      "ID article",
      "Type de billet",
      "Quantité",
      "Prix unitaire",
      "Sous-total",
      "Commission",
      "Total",
      "Devise",
    ],

    ...order.items.map(
      (item) => [
        item.id,
        item.ticketTypeName,
        item.quantity,
        item.unitPrice,
        item.subtotal,
        item.platformFee,
        item.total,
        order.currency,
      ],
    ),

    [],

    [
      "PAIEMENT",
    ],

    [
      "Prestataire",
      order.payment?.provider,
    ],

    [
      "Référence",
      order.payment?.providerReference,
    ],

    [
      "Moyen",
      order.payment?.method,
    ],

    [
      "Statut",
      formatStatus(
        order.payment?.status ??
          null,
      ),
    ],

    [
      "Montant",
      order.payment?.amount,
    ],

    [
      "Devise",
      order.payment?.currency,
    ],

    [
      "Payé le",
      formatDateTime(
        order.payment?.paidAt ??
          null,
      ),
    ],

    [],

    [
      "BILLETS",
    ],

    [
      "ID billet",
      "Code",
      "Type de billet",
      "Détenteur",
      "E-mail",
      "Téléphone",
      "Statut",
      "Utilisé le",
    ],

    ...order.tickets.map(
      (ticket) => [
        ticket.id,
        ticket.code,
        ticket.ticketType.name,
        ticket.holder.name,
        ticket.holder.email,
        ticket.holder.phone,
        formatStatus(
          ticket.status,
        ),
        formatDateTime(
          ticket.usedAt,
        ),
      ],
    ),

    [],

    [
      "RÉSUMÉ FINANCIER",
    ],

    [
      "Sous-total",
      order.subtotal,
      order.currency,
    ],

    [
      "Commission Tikemia",
      order.platformFee,
      order.currency,
    ],

    [
      "Total facturé",
      order.total,
      order.currency,
    ],

    [
      "Net organisateur",
      order.organizerNet,
      order.currency,
    ],

    [],

    [
      "CONTRÔLE D’INTÉGRITÉ",
    ],

    [
      "Devise commande / événement",
      order.integrity
        .orderCurrencyMatchesEvent,
    ],

    [
      "Devise paiement / commande",
      order.integrity
        .paymentCurrencyMatchesOrder,
    ],

    [
      "Montant paiement / total",
      order.integrity
        .paymentAmountMatchesOrderTotal,
    ],

    [
      "Quantités / billets",
      order.integrity
        .itemQuantitiesMatchTickets,
    ],

    [
      "Incohérence détectée",
      order.integrity
        .hasFinancialInconsistency,
    ],
  ];

  const filename =
    [
      "tikemia",
      "commande",
      sanitizeFilenamePart(
        order.reference,
        "commande",
      ),
      sanitizeFilenamePart(
        organizerName,
        "organisateur",
      ),
    ].join("-") +
    ".csv";

  return {
    content:
      `${UTF8_BOM}${serializeCsvRows(rows)}`,

    filename,
  };
}

function styleHeaderRow(
  row: ExcelJS.Row,
): void {
  row.height =
    28;

  row.eachCell(
    (cell) => {
      cell.font = {
        bold:
          true,

        color: {
          argb:
            "FFFFFFFF",
        },
      };

      cell.fill = {
        type:
          "pattern",

        pattern:
          "solid",

        fgColor: {
          argb:
            "FF071014",
        },
      };

      cell.alignment = {
        vertical:
          "middle",

        horizontal:
          "center",

        wrapText:
          true,
      };

      cell.border = {
        bottom: {
          style:
            "thin",

          color: {
            argb:
              "FF25333A",
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
    const row = worksheet.getRow(rowIndex);

    row.eachCell((cell) => {
      cell.font = {
        color: {
          argb: "FFD6DEE2",
        },
      };

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb:
            rowIndex % 2 === 0
              ? "FF0B151B"
              : "FF101B21",
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
            argb: "FF25333A",
          },
        },
      };
    });
  }
}

function addTitleRow({
  worksheet,
  title,
  columnCount,
}: {
  worksheet: ExcelJS.Worksheet;
  title: string;
  columnCount: number;
}): void {
  worksheet.mergeCells(
    1,
    1,
    1,
    columnCount,
  );

  const cell =
    worksheet.getCell(
      1,
      1,
    );

  cell.value =
    title;

  cell.font = {
    bold:
      true,

    size:
      16,

    color: {
      argb:
        "FFFFFFFF",
    },
  };

  cell.fill = {
    type:
      "pattern",

    pattern:
      "solid",

    fgColor: {
      argb:
        "FF071014",
    },
  };

  cell.alignment = {
    horizontal:
      "center",

    vertical:
      "middle",
  };

  worksheet.getRow(1).height =
    34;
}

async function createSingleOrderExcel(
  order: OrganizerOrderDetails,
): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const workbook =
    new ExcelJS.Workbook();

  const organizerName =
    order.organizer.profile
      ?.businessName ??
    order.organizer.fullName;

  workbook.creator =
    "Tikemia";

  workbook.lastModifiedBy =
    "Tikemia";

  workbook.company =
    "Tikemia";

  workbook.title =
    `Commande ${order.reference}`;

  workbook.subject =
    "Export détaillé d’une commande Tikemia";

  workbook.created =
    new Date();

  workbook.modified =
    new Date();

  const summary =
    workbook.addWorksheet(
      "Résumé",
      {
        properties: {
          tabColor: {
            argb:
              "FF84CC16",
          },
        },
      },
    );

  summary.views = [
    {
      showGridLines:
        false,
    },
  ];

  summary.columns = [
    {
      width:
        30,
    },
    {
      width:
        38,
    },
    {
      width:
        24,
    },
    {
      width:
        26,
    },
  ];

  addTitleRow({
    worksheet:
      summary,

    title:
      `COMMANDE TIKEMIA — ${order.reference}`,

    columnCount:
      4,
  });

  const summaryRows = [
    [
      "Organisateur",
      organizerName,
      "E-mail",
      order.organizer.email,
    ],

    [
      "Statut",
      formatStatus(
        order.status,
      ),
      "Devise",
      order.currency,
    ],

    [
      "Créée le",
      new Date(
        order.createdAt,
      ),
      "Payée le",
      order.paidAt
        ? new Date(
            order.paidAt,
          )
        : null,
    ],

    [
      "Client",
      order.customer.name,
      "Client invité",
      order.customer.isGuest
        ? "Oui"
        : "Non",
    ],

    [
      "E-mail client",
      order.customer.email,
      "Téléphone",
      order.customer.phone,
    ],

    [
      "Événement",
      order.event.title,
      "Lieu",
      `${order.event.venueName}, ${order.event.city}`,
    ],

    [
      "Sous-total",
      order.subtotal,
      "Commission",
      order.platformFee,
    ],

    [
      "Total facturé",
      order.total,
      "Net organisateur",
      order.organizerNet,
    ],
  ];

  for (
    const row of
    summaryRows
  ) {
    summary.addRow(
      row,
    );
  }

  summary.getColumn(2).alignment = {
    wrapText:
      true,

    vertical:
      "middle",
  };

  summary.getColumn(4).alignment = {
    wrapText:
      true,

    vertical:
      "middle",
  };

  summary.getCell(
    "B4",
  ).numFmt =
    "dd/mm/yyyy hh:mm";

  summary.getCell(
    "D4",
  ).numFmt =
    "dd/mm/yyyy hh:mm";

  for (
  let rowIndex = 2;
  rowIndex <= summary.rowCount;
  rowIndex += 1
) {
  const row = summary.getRow(rowIndex);

  row.eachCell((cell, columnNumber) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb:
          rowIndex % 2 === 0
            ? "FF0B151B"
            : "FF101B21",
      },
    };

    cell.font = {
      color: {
        argb: "FFD6DEE2",
      },
      bold:
        columnNumber === 1 ||
        columnNumber === 3,
    };

    cell.border = {
      bottom: {
        style: "hair",
        color: {
          argb: "FF25333A",
        },
      },
    };

    cell.alignment = {
      vertical: "middle",
      wrapText: true,
    };
  });
}

  const items =
    workbook.addWorksheet(
      "Articles",
      {
        properties: {
          tabColor: {
            argb:
              "FFF97316",
          },
        },
      },
    );

  items.columns = [
    {
      header:
        "ID article",

      key:
        "id",

      width:
        28,
    },

    {
      header:
        "Type de billet",

      key:
        "ticketType",

      width:
        28,
    },

    {
      header:
        "Description",

      key:
        "description",

      width:
        36,
    },

    {
      header:
        "Quantité",

      key:
        "quantity",

      width:
        12,
    },

    {
      header:
        "Devise",

      key:
        "currency",

      width:
        12,
    },

    {
      header:
        "Prix unitaire",

      key:
        "unitPrice",

      width:
        18,
    },

    {
      header:
        "Sous-total",

      key:
        "subtotal",

      width:
        18,
    },

    {
      header:
        "Commission",

      key:
        "platformFee",

      width:
        18,
    },

    {
      header:
        "Total",

      key:
        "total",

      width:
        18,
    },
  ];

  for (
    const item of
    order.items
  ) {
    items.addRow({
      id:
        item.id,

      ticketType:
        item.ticketTypeName,

      description:
        item.ticketTypeDescription,

      quantity:
        item.quantity,

      currency:
        order.currency,

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

  styleHeaderRow(
    items.getRow(1),
  );

  styleDataRows(
    items,
  );

  items.views = [
    {
      state:
        "frozen",

      ySplit:
        1,

      showGridLines:
        false,
    },
  ];

  items.autoFilter = {
    from: {
      row:
        1,

      column:
        1,
    },

    to: {
      row:
        1,

      column:
        items.columnCount,
    },
  };

  for (const key of [
    "unitPrice",
    "subtotal",
    "platformFee",
    "total",
  ]) {
    items.getColumn(
      key,
    ).numFmt =
      order.currency === "XOF" ||
      order.currency === "XAF"
        ? "#,##0"
        : "#,##0.00";
  }

  const tickets =
    workbook.addWorksheet(
      "Billets",
      {
        properties: {
          tabColor: {
            argb:
              "FF38BDF8",
          },
        },
      },
    );

  tickets.columns = [
    {
      header:
        "ID billet",

      key:
        "id",

      width:
        28,
    },

    {
      header:
        "Code",

      key:
        "code",

      width:
        24,
    },

    {
      header:
        "Type de billet",

      key:
        "ticketType",

      width:
        26,
    },

    {
      header:
        "Détenteur",

      key:
        "holderName",

      width:
        26,
    },

    {
      header:
        "E-mail",

      key:
        "holderEmail",

      width:
        30,
    },

    {
      header:
        "Téléphone",

      key:
        "holderPhone",

      width:
        20,
    },

    {
      header:
        "Statut",

      key:
        "status",

      width:
        16,
    },

    {
      header:
        "Utilisé le",

      key:
        "usedAt",

      width:
        20,
    },

    {
      header:
        "Créé le",

      key:
        "createdAt",

      width:
        20,
    },
  ];

  for (
    const ticket of
    order.tickets
  ) {
    tickets.addRow({
      id:
        ticket.id,

      code:
        ticket.code,

      ticketType:
        ticket.ticketType.name,

      holderName:
        ticket.holder.name,

      holderEmail:
        ticket.holder.email,

      holderPhone:
        ticket.holder.phone,

      status:
        formatStatus(
          ticket.status,
        ),

      usedAt:
        ticket.usedAt
          ? new Date(
              ticket.usedAt,
            )
          : null,

      createdAt:
        new Date(
          ticket.createdAt,
        ),
    });
  }

  styleHeaderRow(
    tickets.getRow(1),
  );

  styleDataRows(
    tickets,
  );

  tickets.views = [
    {
      state:
        "frozen",

      ySplit:
        1,

      showGridLines:
        false,
    },
  ];

  tickets.autoFilter = {
    from: {
      row:
        1,

      column:
        1,
    },

    to: {
      row:
        1,

      column:
        tickets.columnCount,
    },
  };

  tickets.getColumn(
    "usedAt",
  ).numFmt =
    "dd/mm/yyyy hh:mm";

  tickets.getColumn(
    "createdAt",
  ).numFmt =
    "dd/mm/yyyy hh:mm";

  const payment =
    workbook.addWorksheet(
      "Paiement",
      {
        properties: {
          tabColor: {
            argb:
              "FFC084FC",
          },
        },
      },
    );

  payment.columns = [
    {
      width:
        28,
    },

    {
      width:
        40,
    },
  ];

  addTitleRow({
    worksheet:
      payment,

    title:
      "PAIEMENT DE LA COMMANDE",

    columnCount:
      2,
  });

  const paymentRows = [
    [
      "Statut",
      formatStatus(
        order.payment?.status ??
          null,
      ),
    ],

    [
      "Prestataire",
      order.payment?.provider ??
        "",
    ],

    [
      "Référence",
      order.payment
        ?.providerReference ??
        "",
    ],

    [
      "Moyen",
      order.payment?.method ??
        "",
    ],

    [
      "Montant",
      order.payment?.amount ??
        0,
    ],

    [
      "Devise",
      order.payment?.currency ??
        order.currency,
    ],

    [
      "Payé le",
      order.payment?.paidAt
        ? new Date(
            order.payment.paidAt,
          )
        : null,
    ],

    [
      "Motif d’échec",
      order.payment
        ?.failureReason ??
        "",
    ],
  ];

  for (
    const row of
    paymentRows
  ) {
    payment.addRow(
      row,
    );
  }

  payment.getCell(
    "B7",
  ).numFmt =
    order.currency === "XOF" ||
    order.currency === "XAF"
      ? "#,##0"
      : "#,##0.00";

  payment.getCell(
    "B9",
  ).numFmt =
    "dd/mm/yyyy hh:mm";

  styleDataRows(
    payment,
    2,
  );

  const integrity =
    workbook.addWorksheet(
      "Intégrité",
      {
        properties: {
          tabColor: {
            argb:
              order.integrity
                .hasFinancialInconsistency
                ? "FFF87171"
                : "FF84CC16",
          },
        },
      },
    );

  integrity.columns = [
    {
      width:
        40,
    },

    {
      width:
        24,
    },
  ];

  addTitleRow({
    worksheet:
      integrity,

    title:
      "CONTRÔLE D’INTÉGRITÉ",

    columnCount:
      2,
  });

  const integrityRows = [
    [
      "Devise commande / événement",
      order.integrity
        .orderCurrencyMatchesEvent,
    ],

    [
      "Devise paiement / commande",
      order.integrity
        .paymentCurrencyMatchesOrder,
    ],

    [
      "Montant paiement / total",
      order.integrity
        .paymentAmountMatchesOrderTotal,
    ],

    [
      "Quantités / billets",
      order.integrity
        .itemQuantitiesMatchTickets,
    ],

    [
      "Incohérence détectée",
      order.integrity
        .hasFinancialInconsistency,
    ],
  ];

  for (
    const row of
    integrityRows
  ) {
    integrity.addRow([
      row[0],

      row[1] === null
        ? "Non applicable"
        : row[1]
          ? "Oui"
          : "Non",
    ]);
  }

  styleDataRows(
    integrity,
    2,
  );

  const arrayBuffer =
    await workbook.xlsx.writeBuffer();

  const filename =
    [
      "tikemia",
      "commande",
      sanitizeFilenamePart(
        order.reference,
        "commande",
      ),
      sanitizeFilenamePart(
        organizerName,
        "organisateur",
      ),
    ].join("-") +
    ".xlsx";

  return {
    buffer:
      Buffer.from(
        arrayBuffer,
      ),

    filename,
  };
}

async function getConnectedOrganizer(): Promise<ConnectedOrganizer> {
  const cookieStore =
    await cookies();

  const sessionCookieName =
    process.env.SESSION_COOKIE_NAME?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;

  const sessionToken =
    cookieStore.get(
      sessionCookieName,
    )?.value;

  if (!sessionToken) {
    throw new OrganizerOrderExportRouteError({
      code:
        "UNAUTHENTICATED",

      status:
        401,

      message:
        "Votre session organisateur est introuvable. Veuillez vous reconnecter.",
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
        id:
          true,

        expiresAt:
          true,

        user: {
          select: {
            id:
              true,

            email:
              true,

            role:
              true,

            emailVerified:
              true,

            isActive:
              true,
          },
        },
      },
    });

  if (!session) {
    throw new OrganizerOrderExportRouteError({
      code:
        "SESSION_NOT_FOUND",

      status:
        401,

      message:
        "Votre session n’est plus valide. Veuillez vous reconnecter.",
    });
  }

  if (
    session.expiresAt.getTime() <=
    Date.now()
  ) {
    await prisma.session
      .delete({
        where: {
          id:
            session.id,
        },
      })
      .catch(
        (
          error: unknown,
        ) => {
          console.error(
            "[ORDER_EXPORT_EXPIRED_SESSION_DELETE_ERROR]",
            error instanceof Error
              ? error.message
              : error,
          );
        },
      );

    throw new OrganizerOrderExportRouteError({
      code:
        "SESSION_EXPIRED",

      status:
        401,

      message:
        "Votre session a expiré. Veuillez vous reconnecter.",
    });
  }

  const organizer =
    session.user;

  if (
    organizer.role !==
      "ORGANIZER" ||
    !organizer.emailVerified ||
    !organizer.isActive
  ) {
    throw new OrganizerOrderExportRouteError({
      code:
        "FORBIDDEN",

      status:
        403,

      message:
        "Ce compte n’est pas autorisé à exporter cette commande.",
    });
  }

  return {
    id:
      organizer.id,

    email:
      organizer.email,
  };
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const organizer =
      await getConnectedOrganizer();

    const {
      id,
    } =
      await context.params;

    const orderId =
      id?.trim();

    if (!orderId) {
      throw new OrganizerOrderExportRouteError({
        code:
          "ORDER_ID_REQUIRED",

        status:
          400,

        message:
          "L’identifiant de la commande est obligatoire.",
      });
    }

    const format =
      normalizeFormat(
        request.nextUrl.searchParams.get(
          "format",
        ),
      );

    if (
      format === "pdf"
    ) {
      const receiptUrl =
        new URL(
          `/api/organizer/orders/${encodeURIComponent(
            orderId,
          )}/receipt`,
          request.url,
        );

      return NextResponse.redirect(
        receiptUrl,
        {
          status:
            307,
        },
      );
    }

    const {
      order,
    } =
      await getOrganizerOrderDetails({
        organizerId:
          organizer.id,

        orderId,
      });

    if (
      format === "xlsx"
    ) {
      const excel =
        await createSingleOrderExcel(
          order,
        );

      return new Response(
        new Uint8Array(
          excel.buffer,
        ),
        {
          status:
            200,

          headers:
            createDownloadHeaders({
              filename:
                excel.filename,

              mimeType:
                XLSX_MIME_TYPE,

              contentLength:
                excel.buffer.byteLength,
            }),
        },
      );
    }

    const csv =
      createSingleOrderCsv(
        order,
      );

    const csvBuffer =
      Buffer.from(
        csv.content,
        "utf8",
      );

    return new Response(
      new Uint8Array(
        csvBuffer,
      ),
      {
        status:
          200,

        headers:
          createDownloadHeaders({
            filename:
              csv.filename,

            mimeType:
              CSV_MIME_TYPE,

            contentLength:
              csvBuffer.byteLength,
          }),
      },
    );
  } catch (error) {
    if (
      error instanceof
      OrganizerOrderExportRouteError
    ) {
      return createErrorResponse({
        code:
          error.code,

        message:
          error.message,

        status:
          error.status,
      });
    }

    if (
      error instanceof
      GetOrganizerOrderDetailsError
    ) {
      return createErrorResponse({
        code:
          error.code,

        message:
          error.message,

        status:
          error.status,
      });
    }

    console.error(
      "[ORGANIZER_ORDER_EXPORT_ROUTE_ERROR]",
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

    return createErrorResponse({
      code:
        "ORGANIZER_ORDER_EXPORT_FAILED",

      status:
        500,

      message:
        "Impossible d’exporter cette commande pour le moment.",
    });
  }
}