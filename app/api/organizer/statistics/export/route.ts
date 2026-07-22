import { createHash } from "node:crypto";

import ExcelJS from "exceljs";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { cookies } from "next/headers";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  GetOrganizerStatisticsError,
  getOrganizerStatistics,
  type OrganizerStatisticsData,
  type StatisticsDistributionItem,
  type StatisticsEventPerformance,
  type StatisticsPaymentMethodItem,
} from "@/lib/organizer/get-organizer-statistics";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_organizer_session";

const CSV_MIME_TYPE =
  "text/csv; charset=utf-8";

const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const PDF_MIME_TYPE =
  "application/pdf";

const UTF8_BOM = "\uFEFF";

type ExportFormat =
  | "csv"
  | "xlsx"
  | "pdf";

type ConnectedOrganizer = {
  id: string;
  email: string;
};

type ExportFile = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
};

class OrganizerStatisticsExportRouteError extends Error {
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
      "OrganizerStatisticsExportRouteError";
    this.code = code;
    this.status = status;
  }
}

function hashSessionToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function normalizeText(
  value: string | null | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeFormat(
  value: string | null,
): ExportFormat {
  const normalized =
    normalizeText(value).toLowerCase();

  if (
    normalized === "csv" ||
    normalized === "xlsx" ||
    normalized === "pdf"
  ) {
    return normalized;
  }

  return "csv";
}

function parseOptionalInteger(
  value: string | null,
): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed)
    ? parsed
    : undefined;
}

function safeNumber(
  value: number,
): number {
  return Number.isFinite(value)
    ? value
    : 0;
}

function formatNumber(
  value: number,
): string {
  return new Intl.NumberFormat(
    "fr-FR",
    {
      maximumFractionDigits: 0,
    },
  ).format(
    safeNumber(value),
  );
}

function formatPercentage(
  value: number,
): string {
  const safeValue =
    Number.isFinite(value)
      ? value
      : 0;

  return `${new Intl.NumberFormat(
    "fr-FR",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    },
  ).format(safeValue)} %`;
}

function formatMoney(
  value: number,
  currency: string,
): string {
  const safeValue =
    safeNumber(value);

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency,
        maximumFractionDigits:
          currency === "XOF" ||
          currency === "XAF"
            ? 0
            : 2,
      },
    ).format(safeValue);
  } catch {
    return `${formatNumber(
      safeValue,
    )} ${currency}`;
  }
}

function formatDate(
  value: string,
): string {
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
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  ).format(date);
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
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
  ).format(date);
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
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      )
      .slice(0, 80);

  return normalized || fallback;
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
    return "";
  }

  const text =
    String(value);

  if (
    text.includes(";") ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r")
  ) {
    return `"${text.replaceAll(
      '"',
      '""',
    )}"`;
  }

  return text;
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
          .map(
            escapeCsvCell,
          )
          .join(";"),
    )
    .join("\r\n");
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
    `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(
      filename,
    )}`,
  );

  headers.set(
    "Content-Length",
    String(contentLength),
  );

  headers.set(
    "Cache-Control",
    "private, no-store, max-age=0",
  );

  headers.set(
    "Pragma",
    "no-cache",
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
      success: false,
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

async function getConnectedOrganizer(): Promise<ConnectedOrganizer> {
  const cookieStore =
    await cookies();

  const sessionCookieName =
    process.env
      .SESSION_COOKIE_NAME
      ?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;

  const sessionToken =
    cookieStore.get(
      sessionCookieName,
    )?.value;

  if (!sessionToken) {
    throw new OrganizerStatisticsExportRouteError({
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
        id: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            emailVerified: true,
            isActive: true,
          },
        },
      },
    });

  if (!session) {
    throw new OrganizerStatisticsExportRouteError({
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
            "[STATISTICS_EXPORT_EXPIRED_SESSION_DELETE_ERROR]",
            error instanceof Error
              ? error.message
              : error,
          );
        },
      );

    throw new OrganizerStatisticsExportRouteError({
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
    throw new OrganizerStatisticsExportRouteError({
      code:
        "FORBIDDEN",
      status:
        403,
      message:
        "Ce compte n’est pas autorisé à exporter les statistiques.",
    });
  }

  return {
    id:
      organizer.id,
    email:
      organizer.email,
  };
}

function buildStatisticsFilename({
  statistics,
  extension,
}: {
  statistics: OrganizerStatisticsData;
  extension: string;
}): string {
  const event =
    statistics.filters.eventId
      ? statistics.events.find(
          (item) =>
            item.id ===
            statistics.filters.eventId,
        )
      : null;

  const scope =
    event?.title ??
    "tous-evenements";

  return [
    "tikemia",
    "statistiques",
    sanitizeFilenamePart(
      scope,
      "evenements",
    ),
    sanitizeFilenamePart(
      formatDate(
        statistics.period.start,
      ),
      "debut",
    ),
    sanitizeFilenamePart(
      formatDate(
        statistics.period.end,
      ),
      "fin",
    ),
  ].join("-") +
    `.${extension}`;
}

function buildCsvRows(
  statistics: OrganizerStatisticsData,
): Array<
  Array<
    | string
    | number
    | boolean
    | null
    | undefined
  >
> {
  const rows: Array<
    Array<
      | string
      | number
      | boolean
      | null
      | undefined
    >
  > = [];

  rows.push(
    [
      "STATISTIQUES TIKEMIA",
    ],
    [
      "Généré le",
      formatDateTime(
        statistics.generatedAt,
      ),
    ],
    [
      "Période",
      formatDate(
        statistics.period.start,
      ),
      formatDate(
        statistics.period.end,
      ),
    ],
    [
      "Devise",
      statistics.currency,
    ],
    [],
    [
      "RÉSUMÉ GÉNÉRAL",
    ],
    [
      "Indicateur",
      "Valeur",
    ],
    [
      "Chiffre d’affaires brut",
      statistics.summary.grossRevenue,
    ],
    [
      "Commissions Tikemia",
      statistics.summary.platformFees,
    ],
    [
      "Revenu net",
      statistics.summary.netRevenue,
    ],
    [
      "Montant remboursé",
      statistics.summary.refundedRevenue,
    ],
    [
      "Commandes payées",
      statistics.summary.paidOrders,
    ],
    [
      "Commandes en attente",
      statistics.summary.pendingOrders,
    ],
    [
      "Commandes échouées",
      statistics.summary.failedOrders,
    ],
    [
      "Commandes annulées",
      statistics.summary.cancelledOrders,
    ],
    [
      "Commandes remboursées",
      statistics.summary.refundedOrders,
    ],
    [
      "Billets vendus",
      statistics.summary.ticketsSold,
    ],
    [
      "Billets valides",
      statistics.summary.validTickets,
    ],
    [
      "Billets utilisés",
      statistics.summary.usedTickets,
    ],
    [
      "Billets annulés",
      statistics.summary.cancelledTickets,
    ],
    [
      "Billets remboursés",
      statistics.summary.refundedTickets,
    ],
    [
      "Participants uniques",
      statistics.summary.participants,
    ],
    [
      "Participants présents",
      statistics.summary.checkedInParticipants,
    ],
    [
      "Participants attendus",
      statistics.summary.expectedParticipants,
    ],
    [
      "Taux de présence",
      statistics.summary.attendanceRate,
    ],
    [
      "Panier moyen",
      statistics.summary.averageOrderValue,
    ],
    [
      "Prix moyen du billet",
      statistics.summary.averageTicketPrice,
    ],
    [
      "Événements actifs",
      statistics.summary.activeEvents,
    ],
    [
      "Événements total",
      statistics.summary.totalEvents,
    ],
    [
      "Places restantes",
      statistics.summary.remainingPlaces,
    ],
    [],
    [
      "ÉVOLUTION JOURNALIÈRE",
    ],
    [
      "Date",
      "Revenu brut",
      "Commissions",
      "Revenu net",
      "Billets vendus",
      "Commandes payées",
      "Participants",
      "Entrées validées",
    ],
    ...statistics.salesChart.map(
      (point) => [
        point.date,
        point.grossRevenue,
        point.platformFees,
        point.netRevenue,
        point.ticketsSold,
        point.paidOrders,
        point.participants,
        point.checkedInParticipants,
      ],
    ),
    [],
    [
      "PERFORMANCE DES ÉVÉNEMENTS",
    ],
    [
      "Événement",
      "Catégorie",
      "Statut",
      "Date",
      "Ville",
      "Pays",
      "Capacité",
      "Billets vendus",
      "Places restantes",
      "Taux de remplissage",
      "Revenu brut",
      "Commissions",
      "Revenu net",
      "Commandes payées",
      "Panier moyen",
      "Participants",
      "Présents",
      "Taux de présence",
    ],
    ...statistics.eventPerformance.map(
      (event) => [
        event.title,
        event.categoryName,
        event.status,
        formatDateTime(
          event.startsAt,
        ),
        event.city,
        event.country,
        event.capacity,
        event.ticketsSold,
        event.remainingPlaces,
        event.occupancyRate,
        event.grossRevenue,
        event.platformFees,
        event.netRevenue,
        event.paidOrders,
        event.averageOrderValue,
        event.participants,
        event.checkedInParticipants,
        event.attendanceRate,
      ],
    ),
    [],
    [
      "PERFORMANCE PAR CATÉGORIE",
    ],
    [
      "Catégorie",
      "Commandes",
      "Billets",
      "Revenu brut",
      "Revenu net",
      "Part",
    ],
    ...statistics.revenueByCategory.map(
      (item) => [
        item.label,
        item.count,
        item.ticketsSold,
        item.grossRevenue,
        item.netRevenue,
        item.percentage,
      ],
    ),
    [],
    [
      "PERFORMANCE PAR PAYS",
    ],
    [
      "Pays",
      "Commandes",
      "Billets",
      "Revenu brut",
      "Revenu net",
      "Part",
    ],
    ...statistics.revenueByCountry.map(
      (item) => [
        item.label,
        item.count,
        item.ticketsSold,
        item.grossRevenue,
        item.netRevenue,
        item.percentage,
      ],
    ),
    [],
    [
      "MOYENS DE PAIEMENT",
    ],
    [
      "Méthode",
      "Prestataire",
      "Paiements",
      "Réussis",
      "Échoués",
      "Remboursés",
      "Montant",
      "Part",
    ],
    ...statistics.paymentMethods.map(
      (item) => [
        item.method,
        item.provider,
        item.payments,
        item.successfulPayments,
        item.failedPayments,
        item.refundedPayments,
        item.amount,
        item.percentage,
      ],
    ),
  );

  return rows;
}

function createStatisticsCsv(
  statistics: OrganizerStatisticsData,
): ExportFile {
  const content =
    `${UTF8_BOM}${serializeCsvRows(
      buildCsvRows(
        statistics,
      ),
    )}`;

  const buffer =
    Buffer.from(
      content,
      "utf8",
    );

  return {
    buffer,
    filename:
      buildStatisticsFilename({
        statistics,
        extension:
          "csv",
      }),
    mimeType:
      CSV_MIME_TYPE,
  };
}

function styleWorksheetHeader(
  row: ExcelJS.Row,
): void {
  row.height = 28;

  row.eachCell(
    (cell) => {
      cell.font = {
        bold: true,
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

function styleWorksheetRows(
  worksheet: ExcelJS.Worksheet,
  startRow = 2,
): void {
  for (
    let rowIndex =
      startRow;
    rowIndex <=
    worksheet.rowCount;
    rowIndex += 1
  ) {
    const row =
      worksheet.getRow(
        rowIndex,
      );

    row.eachCell(
      (cell) => {
        cell.font = {
          color: {
            argb:
              "FFD6DEE2",
          },
        };

        cell.fill = {
          type:
            "pattern",
          pattern:
            "solid",
          fgColor: {
            argb:
              rowIndex % 2 === 0
                ? "FF0B151B"
                : "FF101B21",
          },
        };

        cell.alignment = {
          vertical:
            "middle",
          wrapText:
            true,
        };

        cell.border = {
          bottom: {
            style:
              "hair",
            color: {
              argb:
                "FF25333A",
            },
          },
        };
      },
    );
  }
}

function addWorksheetTitle({
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

  cell.value = title;

  cell.font = {
    bold: true,
    size: 16,
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

  worksheet.getRow(
    1,
  ).height = 34;
}

function addSummaryWorksheet(
  workbook: ExcelJS.Workbook,
  statistics: OrganizerStatisticsData,
): void {
  const worksheet =
    workbook.addWorksheet(
      "Résumé",
      {
        views: [
          {
            showGridLines:
              false,
          },
        ],
      },
    );

  worksheet.columns = [
    {
      width: 34,
    },
    {
      width: 24,
    },
    {
      width: 34,
    },
    {
      width: 24,
    },
  ];

  addWorksheetTitle({
    worksheet,
    title:
      "STATISTIQUES TIKEMIA",
    columnCount:
      4,
  });

  const rows = [
    [
      "Période",
      `${formatDate(
        statistics.period.start,
      )} - ${formatDate(
        statistics.period.end,
      )}`,
      "Devise",
      statistics.currency,
    ],
    [
      "Chiffre d’affaires brut",
      statistics.summary.grossRevenue,
      "Commissions Tikemia",
      statistics.summary.platformFees,
    ],
    [
      "Revenu net",
      statistics.summary.netRevenue,
      "Montant remboursé",
      statistics.summary.refundedRevenue,
    ],
    [
      "Commandes payées",
      statistics.summary.paidOrders,
      "Billets vendus",
      statistics.summary.ticketsSold,
    ],
    [
      "Participants uniques",
      statistics.summary.participants,
      "Taux de présence",
      statistics.summary.attendanceRate / 100,
    ],
    [
      "Panier moyen",
      statistics.summary.averageOrderValue,
      "Prix moyen du billet",
      statistics.summary.averageTicketPrice,
    ],
    [
      "Événements actifs",
      statistics.summary.activeEvents,
      "Places restantes",
      statistics.summary.remainingPlaces,
    ],
  ];

  for (
    const row of rows
  ) {
    worksheet.addRow(
      row,
    );
  }

  styleWorksheetRows(
    worksheet,
    2,
  );

  for (
    const cellAddress of [
      "B3",
      "D3",
      "B4",
      "D4",
      "B7",
      "D7",
    ]
  ) {
    worksheet.getCell(
      cellAddress,
    ).numFmt =
      statistics.currency === "XOF" ||
      statistics.currency === "XAF"
        ? '#,##0 "FCFA"'
        : '#,##0.00';
  }

  worksheet.getCell(
    "D6",
  ).numFmt =
    "0.0%";
}

function addSalesWorksheet(
  workbook: ExcelJS.Workbook,
  statistics: OrganizerStatisticsData,
): void {
  const worksheet =
    workbook.addWorksheet(
      "Évolution",
      {
        views: [
          {
            showGridLines:
              false,
            state:
              "frozen",
            ySplit:
              2,
          },
        ],
      },
    );

  worksheet.columns = [
    {
      header: "Date",
      key: "date",
      width: 16,
    },
    {
      header: "Revenu brut",
      key: "grossRevenue",
      width: 20,
    },
    {
      header: "Commissions",
      key: "platformFees",
      width: 18,
    },
    {
      header: "Revenu net",
      key: "netRevenue",
      width: 20,
    },
    {
      header: "Billets vendus",
      key: "ticketsSold",
      width: 16,
    },
    {
      header: "Commandes",
      key: "paidOrders",
      width: 15,
    },
    {
      header: "Participants",
      key: "participants",
      width: 16,
    },
    {
      header: "Entrées validées",
      key: "checkedInParticipants",
      width: 18,
    },
  ];

  worksheet.insertRow(
    1,
    [],
  );

  addWorksheetTitle({
    worksheet,
    title:
      "ÉVOLUTION JOURNALIÈRE",
    columnCount:
      8,
  });

  styleWorksheetHeader(
    worksheet.getRow(
      2,
    ),
  );

  for (
    const point of
    statistics.salesChart
  ) {
    worksheet.addRow({
      date:
        point.date,
      grossRevenue:
        point.grossRevenue,
      platformFees:
        point.platformFees,
      netRevenue:
        point.netRevenue,
      ticketsSold:
        point.ticketsSold,
      paidOrders:
        point.paidOrders,
      participants:
        point.participants,
      checkedInParticipants:
        point.checkedInParticipants,
    });
  }

  styleWorksheetRows(
    worksheet,
    3,
  );

  for (
    const columnIndex of [
      2,
      3,
      4,
    ]
  ) {
    worksheet.getColumn(
      columnIndex,
    ).numFmt =
      statistics.currency === "XOF" ||
      statistics.currency === "XAF"
        ? '#,##0 "FCFA"'
        : '#,##0.00';
  }

  worksheet.autoFilter = {
    from: {
      row: 2,
      column: 1,
    },
    to: {
      row: 2,
      column: 8,
    },
  };
}

function addEventsWorksheet(
  workbook: ExcelJS.Workbook,
  statistics: OrganizerStatisticsData,
): void {
  const worksheet =
    workbook.addWorksheet(
      "Événements",
      {
        views: [
          {
            showGridLines:
              false,
            state:
              "frozen",
            ySplit:
              2,
          },
        ],
      },
    );

  worksheet.columns = [
    {
      header: "Événement",
      key: "title",
      width: 32,
    },
    {
      header: "Catégorie",
      key: "category",
      width: 22,
    },
    {
      header: "Statut",
      key: "status",
      width: 16,
    },
    {
      header: "Date",
      key: "startsAt",
      width: 20,
    },
    {
      header: "Ville",
      key: "city",
      width: 18,
    },
    {
      header: "Pays",
      key: "country",
      width: 18,
    },
    {
      header: "Capacité",
      key: "capacity",
      width: 14,
    },
    {
      header: "Billets vendus",
      key: "ticketsSold",
      width: 16,
    },
    {
      header: "Places restantes",
      key: "remainingPlaces",
      width: 17,
    },
    {
      header: "Remplissage",
      key: "occupancyRate",
      width: 15,
    },
    {
      header: "Revenu brut",
      key: "grossRevenue",
      width: 20,
    },
    {
      header: "Commissions",
      key: "platformFees",
      width: 18,
    },
    {
      header: "Revenu net",
      key: "netRevenue",
      width: 20,
    },
    {
      header: "Commandes",
      key: "paidOrders",
      width: 15,
    },
    {
      header: "Panier moyen",
      key: "averageOrderValue",
      width: 18,
    },
    {
      header: "Participants",
      key: "participants",
      width: 16,
    },
    {
      header: "Présents",
      key: "checkedInParticipants",
      width: 14,
    },
    {
      header: "Présence",
      key: "attendanceRate",
      width: 14,
    },
  ];

  worksheet.insertRow(
    1,
    [],
  );

  addWorksheetTitle({
    worksheet,
    title:
      "PERFORMANCE DES ÉVÉNEMENTS",
    columnCount:
      18,
  });

  styleWorksheetHeader(
    worksheet.getRow(
      2,
    ),
  );

  for (
    const event of
    statistics.eventPerformance
  ) {
    worksheet.addRow({
      title:
        event.title,
      category:
        event.categoryName,
      status:
        event.status,
      startsAt:
        formatDateTime(
          event.startsAt,
        ),
      city:
        event.city,
      country:
        event.country,
      capacity:
        event.capacity,
      ticketsSold:
        event.ticketsSold,
      remainingPlaces:
        event.remainingPlaces,
      occupancyRate:
        event.occupancyRate / 100,
      grossRevenue:
        event.grossRevenue,
      platformFees:
        event.platformFees,
      netRevenue:
        event.netRevenue,
      paidOrders:
        event.paidOrders,
      averageOrderValue:
        event.averageOrderValue,
      participants:
        event.participants,
      checkedInParticipants:
        event.checkedInParticipants,
      attendanceRate:
        event.attendanceRate / 100,
    });
  }

  styleWorksheetRows(
    worksheet,
    3,
  );

  for (
    const columnIndex of [
      11,
      12,
      13,
      15,
    ]
  ) {
    worksheet.getColumn(
      columnIndex,
    ).numFmt =
      statistics.currency === "XOF" ||
      statistics.currency === "XAF"
        ? '#,##0 "FCFA"'
        : '#,##0.00';
  }

  worksheet.getColumn(
    10,
  ).numFmt =
    "0.0%";

  worksheet.getColumn(
    18,
  ).numFmt =
    "0.0%";

  worksheet.autoFilter = {
    from: {
      row: 2,
      column: 1,
    },
    to: {
      row: 2,
      column: 18,
    },
  };
}

function addDistributionWorksheet({
  workbook,
  name,
  title,
  data,
  statistics,
}: {
  workbook: ExcelJS.Workbook;
  name: string;
  title: string;
  data: StatisticsDistributionItem[];
  statistics: OrganizerStatisticsData;
}): void {
  const worksheet =
    workbook.addWorksheet(
      name,
      {
        views: [
          {
            showGridLines:
              false,
            state:
              "frozen",
            ySplit:
              2,
          },
        ],
      },
    );

  worksheet.columns = [
    {
      header: "Libellé",
      key: "label",
      width: 28,
    },
    {
      header: "Commandes",
      key: "count",
      width: 14,
    },
    {
      header: "Billets vendus",
      key: "ticketsSold",
      width: 16,
    },
    {
      header: "Revenu brut",
      key: "grossRevenue",
      width: 20,
    },
    {
      header: "Revenu net",
      key: "netRevenue",
      width: 20,
    },
    {
      header: "Part",
      key: "percentage",
      width: 14,
    },
  ];

  worksheet.insertRow(
    1,
    [],
  );

  addWorksheetTitle({
    worksheet,
    title,
    columnCount:
      6,
  });

  styleWorksheetHeader(
    worksheet.getRow(
      2,
    ),
  );

  for (
    const item of data
  ) {
    worksheet.addRow({
      label:
        item.label,
      count:
        item.count,
      ticketsSold:
        item.ticketsSold,
      grossRevenue:
        item.grossRevenue,
      netRevenue:
        item.netRevenue,
      percentage:
        item.percentage / 100,
    });
  }

  styleWorksheetRows(
    worksheet,
    3,
  );

  for (
    const columnIndex of [
      4,
      5,
    ]
  ) {
    worksheet.getColumn(
      columnIndex,
    ).numFmt =
      statistics.currency === "XOF" ||
      statistics.currency === "XAF"
        ? '#,##0 "FCFA"'
        : '#,##0.00';
  }

  worksheet.getColumn(
    6,
  ).numFmt =
    "0.0%";
}

function addPaymentsWorksheet(
  workbook: ExcelJS.Workbook,
  statistics: OrganizerStatisticsData,
): void {
  const worksheet =
    workbook.addWorksheet(
      "Paiements",
      {
        views: [
          {
            showGridLines:
              false,
            state:
              "frozen",
            ySplit:
              2,
          },
        ],
      },
    );

  worksheet.columns = [
    {
      header: "Méthode",
      key: "method",
      width: 24,
    },
    {
      header: "Prestataire",
      key: "provider",
      width: 24,
    },
    {
      header: "Paiements",
      key: "payments",
      width: 14,
    },
    {
      header: "Réussis",
      key: "successfulPayments",
      width: 14,
    },
    {
      header: "Échoués",
      key: "failedPayments",
      width: 14,
    },
    {
      header: "Remboursés",
      key: "refundedPayments",
      width: 14,
    },
    {
      header: "Montant",
      key: "amount",
      width: 20,
    },
    {
      header: "Part",
      key: "percentage",
      width: 14,
    },
  ];

  worksheet.insertRow(
    1,
    [],
  );

  addWorksheetTitle({
    worksheet,
    title:
      "MOYENS DE PAIEMENT",
    columnCount:
      8,
  });

  styleWorksheetHeader(
    worksheet.getRow(
      2,
    ),
  );

  for (
    const item of
    statistics.paymentMethods
  ) {
    worksheet.addRow({
      method:
        item.method,
      provider:
        item.provider,
      payments:
        item.payments,
      successfulPayments:
        item.successfulPayments,
      failedPayments:
        item.failedPayments,
      refundedPayments:
        item.refundedPayments,
      amount:
        item.amount,
      percentage:
        item.percentage / 100,
    });
  }

  styleWorksheetRows(
    worksheet,
    3,
  );

  worksheet.getColumn(
    7,
  ).numFmt =
    statistics.currency === "XOF" ||
    statistics.currency === "XAF"
      ? '#,##0 "FCFA"'
      : '#,##0.00';

  worksheet.getColumn(
    8,
  ).numFmt =
    "0.0%";
}

async function createStatisticsExcel(
  statistics: OrganizerStatisticsData,
): Promise<ExportFile> {
  const workbook =
    new ExcelJS.Workbook();

  workbook.creator =
    "Tikemia";
  workbook.lastModifiedBy =
    "Tikemia";
  workbook.company =
    "Tikemia";
  workbook.title =
    "Statistiques organisateur Tikemia";
  workbook.subject =
    "Export des statistiques organisateur";
  workbook.created =
    new Date();
  workbook.modified =
    new Date();

  addSummaryWorksheet(
    workbook,
    statistics,
  );

  addSalesWorksheet(
    workbook,
    statistics,
  );

  addEventsWorksheet(
    workbook,
    statistics,
  );

  addDistributionWorksheet({
    workbook,
    name:
      "Catégories",
    title:
      "PERFORMANCE PAR CATÉGORIE",
    data:
      statistics.revenueByCategory,
    statistics,
  });

  addDistributionWorksheet({
    workbook,
    name:
      "Pays",
    title:
      "PERFORMANCE PAR PAYS",
    data:
      statistics.revenueByCountry,
    statistics,
  });

  addDistributionWorksheet({
    workbook,
    name:
      "Villes",
    title:
      "PERFORMANCE PAR VILLE",
    data:
      statistics.revenueByCity,
    statistics,
  });

  addDistributionWorksheet({
    workbook,
    name:
      "Types de billets",
    title:
      "PERFORMANCE DES TYPES DE BILLETS",
    data:
      statistics.salesByTicketType,
    statistics,
  });

  addPaymentsWorksheet(
    workbook,
    statistics,
  );

  const arrayBuffer =
    await workbook.xlsx.writeBuffer();

  return {
    buffer:
      Buffer.from(
        arrayBuffer,
      ),
    filename:
      buildStatisticsFilename({
        statistics,
        extension:
          "xlsx",
      }),
    mimeType:
      XLSX_MIME_TYPE,
  };
}

const PDF_COLORS = {
  background:
    rgb(
      0.027,
      0.063,
      0.078,
    ),
  panel:
    rgb(
      0.047,
      0.094,
      0.114,
    ),
  panelSoft:
    rgb(
      0.065,
      0.118,
      0.137,
    ),
  border:
    rgb(
      0.15,
      0.22,
      0.24,
    ),
  white:
    rgb(
      1,
      1,
      1,
    ),
  text:
    rgb(
      0.84,
      0.88,
      0.9,
    ),
  muted:
    rgb(
      0.48,
      0.55,
      0.58,
    ),
  green:
    rgb(
      0.52,
      0.8,
      0.086,
    ),
  orange:
    rgb(
      0.976,
      0.451,
      0.086,
    ),
  blue:
    rgb(
      0.22,
      0.74,
      0.97,
    ),
  violet:
    rgb(
      0.75,
      0.52,
      0.98,
    ),
  red:
    rgb(
      0.97,
      0.44,
      0.44,
    ),
} as const;

type PdfContext = {
  document: PDFDocument;
  page: PDFPage;
  regularFont: PDFFont;
  boldFont: PDFFont;
  y: number;
};

function addPdfPage(
  context: PdfContext,
): void {
  context.page =
    context.document.addPage([
      842,
      595,
    ]);

  context.page.drawRectangle({
    x: 0,
    y: 0,
    width: 842,
    height: 595,
    color:
      PDF_COLORS.background,
  });

  context.y = 555;
}

function ensurePdfSpace(
  context: PdfContext,
  requiredHeight: number,
): void {
  if (
    context.y -
      requiredHeight <
    36
  ) {
    addPdfPage(
      context,
    );
  }
}

function drawPdfText(
  context: PdfContext,
  text: string,
  {
    x,
    y,
    size = 10,
    color =
      PDF_COLORS.text,
    bold = false,
    maxWidth,
  }: {
    x: number;
    y: number;
    size?: number;
    color?: ReturnType<typeof rgb>;
    bold?: boolean;
    maxWidth?: number;
  },
): void {
  const font =
    bold
      ? context.boldFont
      : context.regularFont;

  let rendered =
    text;

  if (
    maxWidth &&
    font.widthOfTextAtSize(
      rendered,
      size,
    ) > maxWidth
  ) {
    while (
      rendered.length > 3 &&
      font.widthOfTextAtSize(
        `${rendered}…`,
        size,
      ) > maxWidth
    ) {
      rendered =
        rendered.slice(
          0,
          -1,
        );
    }

    rendered =
      `${rendered}…`;
  }

  context.page.drawText(
    rendered,
    {
      x,
      y,
      size,
      font,
      color,
    },
  );
}

function drawPdfSectionTitle(
  context: PdfContext,
  title: string,
): void {
  ensurePdfSpace(
    context,
    34,
  );

  context.page.drawRectangle({
    x: 32,
    y:
      context.y - 23,
    width: 778,
    height: 28,
    color:
      PDF_COLORS.panel,
    borderColor:
      PDF_COLORS.border,
    borderWidth:
      1,
  });

  drawPdfText(
    context,
    title,
    {
      x: 44,
      y:
        context.y - 14,
      size: 12,
      bold: true,
      color:
        PDF_COLORS.white,
    },
  );

  context.y -= 42;
}

function drawPdfMetricGrid(
  context: PdfContext,
  items: Array<{
    label: string;
    value: string;
    color?: ReturnType<typeof rgb>;
  }>,
): void {
  const cardWidth =
    185;
  const cardHeight =
    56;
  const gap =
    12;

  for (
    let index = 0;
    index < items.length;
    index += 1
  ) {
    if (
      index % 4 === 0
    ) {
      ensurePdfSpace(
        context,
        cardHeight + 12,
      );
    }

    const column =
      index % 4;

    const x =
      32 +
      column *
        (
          cardWidth +
          gap
        );

    const y =
      context.y -
      cardHeight;

    context.page.drawRectangle({
      x,
      y,
      width:
        cardWidth,
      height:
        cardHeight,
      color:
        PDF_COLORS.panel,
      borderColor:
        PDF_COLORS.border,
      borderWidth:
        1,
    });

    drawPdfText(
      context,
      items[index].label,
      {
        x:
          x + 10,
        y:
          y + 36,
        size:
          8,
        color:
          PDF_COLORS.muted,
        maxWidth:
          cardWidth - 20,
      },
    );

    drawPdfText(
      context,
      items[index].value,
      {
        x:
          x + 10,
        y:
          y + 15,
        size:
          12,
        bold:
          true,
        color:
          items[index].color ??
          PDF_COLORS.white,
        maxWidth:
          cardWidth - 20,
      },
    );

    if (
      column === 3 ||
      index ===
        items.length - 1
    ) {
      context.y -=
        cardHeight +
        gap;
    }
  }
}

function drawPdfTable({
  context,
  headers,
  rows,
  widths,
}: {
  context: PdfContext;
  headers: string[];
  rows: string[][];
  widths: number[];
}): void {
  const rowHeight =
    24;
  const tableWidth =
    widths.reduce(
      (sum, width) =>
        sum + width,
      0,
    );

  const drawHeader = () => {
    ensurePdfSpace(
      context,
      rowHeight,
    );

    let x = 32;

    headers.forEach(
      (
        header,
        index,
      ) => {
        context.page.drawRectangle({
          x,
          y:
            context.y -
            rowHeight,
          width:
            widths[index],
          height:
            rowHeight,
          color:
            PDF_COLORS.panelSoft,
          borderColor:
            PDF_COLORS.border,
          borderWidth:
            0.5,
        });

        drawPdfText(
          context,
          header,
          {
            x:
              x + 5,
            y:
              context.y - 16,
            size:
              7,
            bold:
              true,
            color:
              PDF_COLORS.white,
            maxWidth:
              widths[index] - 10,
          },
        );

        x +=
          widths[index];
      },
    );

    context.y -=
      rowHeight;
  };

  drawHeader();

  rows.forEach(
    (
      row,
      rowIndex,
    ) => {
      if (
        context.y -
          rowHeight <
        36
      ) {
        addPdfPage(
          context,
        );

        drawHeader();
      }

      let x = 32;

      row.forEach(
        (
          value,
          columnIndex,
        ) => {
          context.page.drawRectangle({
            x,
            y:
              context.y -
              rowHeight,
            width:
              widths[columnIndex],
            height:
              rowHeight,
            color:
              rowIndex % 2 === 0
                ? PDF_COLORS.background
                : PDF_COLORS.panel,
            borderColor:
              PDF_COLORS.border,
            borderWidth:
              0.35,
          });

          drawPdfText(
            context,
            value,
            {
              x:
                x + 5,
              y:
                context.y - 16,
              size:
                7,
              color:
                PDF_COLORS.text,
              maxWidth:
                widths[columnIndex] - 10,
            },
          );

          x +=
            widths[columnIndex];
        },
      );

      context.y -=
        rowHeight;
    },
  );

  context.page.drawLine({
    start: {
      x: 32,
      y:
        context.y,
    },
    end: {
      x:
        32 + tableWidth,
      y:
        context.y,
    },
    thickness:
      0.5,
    color:
      PDF_COLORS.border,
  });

  context.y -= 16;
}

async function createStatisticsPdf(
  statistics: OrganizerStatisticsData,
): Promise<ExportFile> {
  const document =
    await PDFDocument.create();

  const regularFont =
    await document.embedFont(
      StandardFonts.Helvetica,
    );

  const boldFont =
    await document.embedFont(
      StandardFonts.HelveticaBold,
    );

  const firstPage =
    document.addPage([
      842,
      595,
    ]);

  firstPage.drawRectangle({
    x: 0,
    y: 0,
    width: 842,
    height: 595,
    color:
      PDF_COLORS.background,
  });

  const context: PdfContext = {
    document,
    page:
      firstPage,
    regularFont,
    boldFont,
    y: 555,
  };

  drawPdfText(
    context,
    "TIKEMIA",
    {
      x: 32,
      y: 548,
      size: 22,
      bold: true,
      color:
        PDF_COLORS.green,
    },
  );

  drawPdfText(
    context,
    "Rapport statistique organisateur",
    {
      x: 32,
      y: 524,
      size: 16,
      bold: true,
      color:
        PDF_COLORS.white,
    },
  );

  drawPdfText(
    context,
    `${formatDate(
      statistics.period.start,
    )} - ${formatDate(
      statistics.period.end,
    )} • ${statistics.currency}`,
    {
      x: 32,
      y: 505,
      size: 9,
      color:
        PDF_COLORS.muted,
    },
  );

  drawPdfText(
    context,
    `Généré le ${formatDateTime(
      statistics.generatedAt,
    )}`,
    {
      x: 610,
      y: 548,
      size: 8,
      color:
        PDF_COLORS.muted,
      maxWidth:
        200,
    },
  );

  context.y = 470;

  drawPdfSectionTitle(
    context,
    "Résumé général",
  );

  drawPdfMetricGrid(
    context,
    [
      {
        label:
          "Chiffre d’affaires brut",
        value:
          formatMoney(
            statistics.summary.grossRevenue,
            statistics.currency,
          ),
        color:
          PDF_COLORS.green,
      },
      {
        label:
          "Commissions Tikemia",
        value:
          formatMoney(
            statistics.summary.platformFees,
            statistics.currency,
          ),
        color:
          PDF_COLORS.orange,
      },
      {
        label:
          "Revenu net",
        value:
          formatMoney(
            statistics.summary.netRevenue,
            statistics.currency,
          ),
        color:
          PDF_COLORS.green,
      },
      {
        label:
          "Montant remboursé",
        value:
          formatMoney(
            statistics.summary.refundedRevenue,
            statistics.currency,
          ),
        color:
          PDF_COLORS.violet,
      },
      {
        label:
          "Billets vendus",
        value:
          formatNumber(
            statistics.summary.ticketsSold,
          ),
        color:
          PDF_COLORS.orange,
      },
      {
        label:
          "Commandes payées",
        value:
          formatNumber(
            statistics.summary.paidOrders,
          ),
        color:
          PDF_COLORS.blue,
      },
      {
        label:
          "Participants uniques",
        value:
          formatNumber(
            statistics.summary.participants,
          ),
        color:
          PDF_COLORS.blue,
      },
      {
        label:
          "Taux de présence",
        value:
          formatPercentage(
            statistics.summary.attendanceRate,
          ),
        color:
          PDF_COLORS.green,
      },
      {
        label:
          "Panier moyen",
        value:
          formatMoney(
            statistics.summary.averageOrderValue,
            statistics.currency,
          ),
      },
      {
        label:
          "Prix moyen du billet",
        value:
          formatMoney(
            statistics.summary.averageTicketPrice,
            statistics.currency,
          ),
      },
      {
        label:
          "Événements actifs",
        value:
          formatNumber(
            statistics.summary.activeEvents,
          ),
      },
      {
        label:
          "Places restantes",
        value:
          formatNumber(
            statistics.summary.remainingPlaces,
          ),
      },
    ],
  );

  drawPdfSectionTitle(
    context,
    "Performance des événements",
  );

  drawPdfTable({
    context,
    headers: [
      "Événement",
      "Date",
      "Billets",
      "Rempl.",
      "Brut",
      "Net",
      "Présents",
      "Présence",
    ],
    widths: [
      190,
      90,
      65,
      65,
      105,
      105,
      70,
      88,
    ],
    rows:
      statistics.eventPerformance
        .slice(
          0,
          25,
        )
        .map(
          (event) => [
            event.title,
            formatDate(
              event.startsAt,
            ),
            formatNumber(
              event.ticketsSold,
            ),
            formatPercentage(
              event.occupancyRate,
            ),
            formatMoney(
              event.grossRevenue,
              statistics.currency,
            ),
            formatMoney(
              event.netRevenue,
              statistics.currency,
            ),
            formatNumber(
              event.checkedInParticipants,
            ),
            formatPercentage(
              event.attendanceRate,
            ),
          ],
        ),
  });

  drawPdfSectionTitle(
    context,
    "Performance par catégorie",
  );

  drawPdfTable({
    context,
    headers: [
      "Catégorie",
      "Commandes",
      "Billets",
      "Revenu brut",
      "Revenu net",
      "Part",
    ],
    widths: [
      220,
      90,
      90,
      140,
      140,
      98,
    ],
    rows:
      statistics.revenueByCategory.map(
        (item) => [
          item.label,
          formatNumber(
            item.count,
          ),
          formatNumber(
            item.ticketsSold,
          ),
          formatMoney(
            item.grossRevenue,
            statistics.currency,
          ),
          formatMoney(
            item.netRevenue,
            statistics.currency,
          ),
          formatPercentage(
            item.percentage,
          ),
        ],
      ),
  });

  drawPdfSectionTitle(
    context,
    "Performance par pays",
  );

  drawPdfTable({
    context,
    headers: [
      "Pays",
      "Commandes",
      "Billets",
      "Revenu brut",
      "Revenu net",
      "Part",
    ],
    widths: [
      220,
      90,
      90,
      140,
      140,
      98,
    ],
    rows:
      statistics.revenueByCountry.map(
        (item) => [
          item.label,
          formatNumber(
            item.count,
          ),
          formatNumber(
            item.ticketsSold,
          ),
          formatMoney(
            item.grossRevenue,
            statistics.currency,
          ),
          formatMoney(
            item.netRevenue,
            statistics.currency,
          ),
          formatPercentage(
            item.percentage,
          ),
        ],
      ),
  });

  drawPdfSectionTitle(
    context,
    "Moyens de paiement",
  );

  drawPdfTable({
    context,
    headers: [
      "Méthode",
      "Prestataire",
      "Paiements",
      "Réussis",
      "Échoués",
      "Remb.",
      "Montant",
    ],
    widths: [
      150,
      150,
      85,
      75,
      75,
      70,
      173,
    ],
    rows:
      statistics.paymentMethods.map(
        (item) => [
          item.method,
          item.provider,
          formatNumber(
            item.payments,
          ),
          formatNumber(
            item.successfulPayments,
          ),
          formatNumber(
            item.failedPayments,
          ),
          formatNumber(
            item.refundedPayments,
          ),
          formatMoney(
            item.amount,
            statistics.currency,
          ),
        ],
      ),
  });

  const pages =
    document.getPages();

  pages.forEach(
    (
      page,
      index,
    ) => {
      page.drawText(
        `Tikemia • Statistiques organisateur • Page ${
          index + 1
        } / ${pages.length}`,
        {
          x: 32,
          y: 18,
          size: 7,
          font:
            regularFont,
          color:
            PDF_COLORS.muted,
        },
      );
    },
  );

  const pdfBytes =
    await document.save();

  return {
    buffer:
      Buffer.from(
        pdfBytes,
      ),
    filename:
      buildStatisticsFilename({
        statistics,
        extension:
          "pdf",
      }),
    mimeType:
      PDF_MIME_TYPE,
  };
}

async function createExportFile({
  format,
  statistics,
}: {
  format: ExportFormat;
  statistics: OrganizerStatisticsData;
}): Promise<ExportFile> {
  if (
    format === "xlsx"
  ) {
    return createStatisticsExcel(
      statistics,
    );
  }

  if (
    format === "pdf"
  ) {
    return createStatisticsPdf(
      statistics,
    );
  }

  return createStatisticsCsv(
    statistics,
  );
}

export async function GET(
  request: NextRequest,
) {
  try {
    const organizer =
      await getConnectedOrganizer();

    const searchParams =
      request.nextUrl.searchParams;

    const format =
      normalizeFormat(
        searchParams.get(
          "format",
        ),
      );

    const statistics =
      await getOrganizerStatistics({
        organizerId:
          organizer.id,
        currency:
          searchParams.get(
            "currency",
          ),
        periodDays:
          parseOptionalInteger(
            searchParams.get(
              "periodDays",
            ),
          ),
        timeZone:
          searchParams.get(
            "timeZone",
          ),
        eventId:
          searchParams.get(
            "eventId",
          ),
        dateFrom:
          searchParams.get(
            "dateFrom",
          ),
        dateTo:
          searchParams.get(
            "dateTo",
          ),
      });

    const exportedFile =
      await createExportFile({
        format,
        statistics,
      });

    return new Response(
      new Uint8Array(
        exportedFile.buffer,
      ),
      {
        status: 200,
        headers:
          createDownloadHeaders({
            filename:
              exportedFile.filename,
            mimeType:
              exportedFile.mimeType,
            contentLength:
              exportedFile.buffer.byteLength,
          }),
      },
    );
  } catch (error) {
    if (
      error instanceof
      OrganizerStatisticsExportRouteError
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
      GetOrganizerStatisticsError
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
      "[ORGANIZER_STATISTICS_EXPORT_ROUTE_ERROR]",
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
        "STATISTICS_EXPORT_FAILED",
      status:
        500,
      message:
        "Impossible de générer l’export des statistiques pour le moment.",
    });
  }
}