import { createHash } from "node:crypto";

import ExcelJS from "exceljs";
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";
import { cookies } from "next/headers";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  GetOrganizerPaymentsError,
  getOrganizerPayments,
  type GetOrganizerPaymentsParams,
  type OrganizerPaymentListItem,
  type OrganizerPaymentsData,
  type OrganizerPaymentsSort,
  type OrganizerPayoutListItem,
} from "@/lib/organizer/get-organizer-payments";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const EXPORT_PAGE_SIZE = 100;
const MAX_EXPORT_PAYMENTS = 10_000;

const CSV_MIME_TYPE =
  "text/csv; charset=utf-8";

const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const PDF_MIME_TYPE =
  "application/pdf";

type ExportFormat =
  | "csv"
  | "xlsx"
  | "pdf";

type ExportScope =
  | "all"
  | "payments"
  | "payouts";

type ConnectedOrganizer = {
  id: string;
  email: string;
  displayName: string;
};

type ExportDataset = {
  generatedAt: string;
  organizer: ConnectedOrganizer;
  data: OrganizerPaymentsData;
  payments: OrganizerPaymentListItem[];
  payouts: OrganizerPayoutListItem[];
  scope: ExportScope;
  truncated: boolean;
};

class PaymentsExportRouteError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor({
    code,
    message,
    status = 500,
    details,
  }: {
    code: string;
    message: string;
    status?: number;
    details?: unknown;
  }) {
    super(message);

    this.name =
      "PaymentsExportRouteError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function createErrorResponse({
  code,
  message,
  status,
  details,
}: {
  code: string;
  message: string;
  status: number;
  details?: unknown;
}) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details === undefined
          ? {}
          : {
              details,
            }),
      },
    },
    {
      status,
      headers: {
        "Cache-Control":
          "no-store",
        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

function hashSessionToken(
  token: string,
): string {
  return createHash(
    "sha256",
  )
    .update(token)
    .digest("hex");
}

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value?.trim() ?? "";
}

function normalizeOptionalText(
  value:
    | string
    | null
    | undefined,
): string | null {
  const normalized =
    normalizeText(value);

  return normalized || null;
}

function getFirstSearchParam(
  params: URLSearchParams,
  name: string,
): string | null {
  return normalizeOptionalText(
    params.get(name),
  );
}

function normalizeFormat(
  value: string | null,
): ExportFormat {
  const normalized =
    normalizeText(value)
      .toLowerCase();

  if (
    normalized === "xlsx" ||
    normalized === "pdf"
  ) {
    return normalized;
  }

  return "csv";
}

function normalizeScope(
  value: string | null,
): ExportScope {
  const normalized =
    normalizeText(value)
      .toLowerCase();

  if (
    normalized === "payments" ||
    normalized === "payouts"
  ) {
    return normalized;
  }

  return "all";
}

function normalizePositiveInteger(
  value: string | null,
  fallback: number,
  maximum: number,
): number {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    return fallback;
  }

  return Math.min(
    Math.trunc(parsed),
    maximum,
  );
}

function normalizeSort(
  value: string | null,
): OrganizerPaymentsSort {
  if (
    value === "OLDEST" ||
    value === "AMOUNT_HIGH" ||
    value === "AMOUNT_LOW"
  ) {
    return value;
  }

  return "NEWEST";
}

function sanitizeFilenamePart(
  value: string,
): string {
  return value
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
      /-+/g,
      "-",
    )
    .replace(
      /^-|-$|_/g,
      "")
    .toLowerCase() ||
    "tikemia";
}

function buildFilename({
  organizer,
  format,
  scope,
  generatedAt,
}: {
  organizer: ConnectedOrganizer;
  format: ExportFormat;
  scope: ExportScope;
  generatedAt: string;
}): string {
  const date =
    generatedAt.slice(
      0,
      10,
    );

  return [
    "tikemia",
    scope,
    sanitizeFilenamePart(
      organizer.displayName,
    ),
    date,
  ].join("-") +
    `.${format}`;
}

function createDownloadHeaders({
  filename,
  mimeType,
  contentLength,
}: {
  filename: string;
  mimeType: string;
  contentLength: number;
}) {
  const encodedFilename =
    encodeURIComponent(
      filename,
    );

  return {
    "Content-Type":
      mimeType,
    "Content-Disposition":
      `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
    "Content-Length":
      String(
        contentLength,
      ),
    "Cache-Control":
      "private, no-store, max-age=0",
    "X-Content-Type-Options":
      "nosniff",
  };
}

function escapeCsvCell(
  value: unknown,
): string {
  const text =
    value === null ||
    value === undefined
      ? ""
      : String(value);

  if (
    /[;"\r\n]/.test(
      text,
    )
  ) {
    return `"${text.replace(
      /"/g,
      '""',
    )}"`;
  }

  return text;
}

function createCsvSection(
  title: string,
  headers: string[],
  rows: unknown[][],
): string[] {
  return [
    title,
    headers
      .map(
        escapeCsvCell,
      )
      .join(";"),
    ...rows.map(
      (row) =>
        row
          .map(
            escapeCsvCell,
          )
          .join(";"),
    ),
    "",
  ];
}

function formatDateTime(
  value:
    | string
    | null,
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
      dateStyle:
        "short",
      timeStyle:
        "short",
      hour12:
        false,
    },
  ).format(date);
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
      dateStyle:
        "medium",
    },
  ).format(date);
}

function formatMoney(
  value: number,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style:
          "currency",
        currency,
        maximumFractionDigits:
          currency === "XOF" ||
          currency === "XAF"
            ? 0
            : 2,
      },
    ).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

function paymentRows(
  payments: OrganizerPaymentListItem[],
): unknown[][] {
  return payments.map(
    (payment) => [
      payment.id,
      payment.providerReference ??
        "",
      payment.order.reference,
      payment.status,
      payment.method,
      payment.provider,
      payment.amount,
      payment.currency,
      payment.financials.subtotal,
      payment.financials.platformFee,
      payment.financials.organizerNet,
      payment.order.customerName,
      payment.order.customerEmail,
      payment.order.customerPhone,
      payment.event.title,
      payment.event.city,
      payment.event.country,
      formatDateTime(
        payment.paidAt,
      ),
      formatDateTime(
        payment.createdAt,
      ),
      payment.failureReason ??
        "",
    ],
  );
}

function payoutRows(
  payouts: OrganizerPayoutListItem[],
): unknown[][] {
  return payouts.map(
    (payout) => [
      payout.id,
      payout.reference ??
        "",
      payout.status,
      payout.amount,
      payout.fee,
      payout.netAmount,
      payout.currency,
      formatDateTime(
        payout.requestedAt,
      ),
      formatDateTime(
        payout.processedAt,
      ),
      payout.note ??
        "",
    ],
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
    throw new PaymentsExportRouteError({
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
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            emailVerified: true,
            isActive: true,
            organizerProfile: {
              select: {
                businessName:
                  true,
              },
            },
          },
        },
      },
    });

  if (!session) {
    throw new PaymentsExportRouteError({
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
            "[PAYMENTS_EXPORT_EXPIRED_SESSION_DELETE_ERROR]",
            error instanceof Error
              ? error.message
              : error,
          );
        },
      );

    throw new PaymentsExportRouteError({
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
    throw new PaymentsExportRouteError({
      code:
        "FORBIDDEN",
      status:
        403,
      message:
        "Ce compte n’est pas autorisé à exporter les paiements.",
    });
  }

  const fullName =
    `${organizer.firstName} ${organizer.lastName}`
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

  return {
    id:
      organizer.id,
    email:
      organizer.email,
    displayName:
      organizer.organizerProfile
        ?.businessName
        ?.trim() ||
      fullName ||
      "Organisateur Tikemia",
  };
}

function buildPaymentsParams({
  organizerId,
  searchParams,
  page,
  pageSize,
}: {
  organizerId: string;
  searchParams: URLSearchParams;
  page: number;
  pageSize: number;
}): GetOrganizerPaymentsParams {
  return {
    organizerId,
    page,
    pageSize,
    search:
      getFirstSearchParam(
        searchParams,
        "search",
      ),
    eventId:
      getFirstSearchParam(
        searchParams,
        "eventId",
      ),
    currency:
      getFirstSearchParam(
        searchParams,
        "currency",
      ),
    paymentStatus:
      getFirstSearchParam(
        searchParams,
        "paymentStatus",
      ),
    paymentMethod:
      getFirstSearchParam(
        searchParams,
        "paymentMethod",
      ),
    paymentProvider:
      getFirstSearchParam(
        searchParams,
        "paymentProvider",
      ),
    payoutStatus:
      getFirstSearchParam(
        searchParams,
        "payoutStatus",
      ),
    periodDays:
      normalizePositiveInteger(
        searchParams.get(
          "periodDays",
        ),
        30,
        3650,
      ),
    dateFrom:
      getFirstSearchParam(
        searchParams,
        "dateFrom",
      ),
    dateTo:
      getFirstSearchParam(
        searchParams,
        "dateTo",
      ),
    timeZone:
      getFirstSearchParam(
        searchParams,
        "timeZone",
      ),
    sort:
      normalizeSort(
        searchParams.get(
          "sort",
        ),
      ),
  };
}

async function loadExportDataset({
  organizer,
  searchParams,
  scope,
}: {
  organizer: ConnectedOrganizer;
  searchParams: URLSearchParams;
  scope: ExportScope;
}): Promise<ExportDataset> {
  const firstPage =
    await getOrganizerPayments(
      buildPaymentsParams({
        organizerId:
          organizer.id,
        searchParams,
        page: 1,
        pageSize:
          EXPORT_PAGE_SIZE,
      }),
    );

  const paymentLimit =
    Math.min(
      firstPage.pagination
        .totalItems,
      MAX_EXPORT_PAYMENTS,
    );

  const totalPagesToLoad =
    Math.max(
      Math.ceil(
        paymentLimit /
          EXPORT_PAGE_SIZE,
      ),
      1,
    );

  const payments:
    OrganizerPaymentListItem[] =
    scope === "payouts"
      ? []
      : [
          ...firstPage.payments,
        ];

  if (
    scope !== "payouts"
  ) {
    for (
      let page = 2;
      page <=
      totalPagesToLoad;
      page += 1
    ) {
      const result =
        await getOrganizerPayments(
          buildPaymentsParams({
            organizerId:
              organizer.id,
            searchParams,
            page,
            pageSize:
              EXPORT_PAGE_SIZE,
          }),
        );

      payments.push(
        ...result.payments,
      );

      if (
        payments.length >=
        paymentLimit
      ) {
        break;
      }
    }
  }

  return {
    generatedAt:
      new Date().toISOString(),
    organizer,
    data:
      firstPage,
    payments:
      payments.slice(
        0,
        paymentLimit,
      ),
    payouts:
      scope === "payments"
        ? []
        : firstPage.payouts,
    scope,
    truncated:
      firstPage.pagination
        .totalItems >
      paymentLimit,
  };
}

function createCsv(
  dataset: ExportDataset,
): Buffer {
  const lines: string[] = [
    "TIKEMIA — RAPPORT DES PAIEMENTS",
    `Organisateur;${escapeCsvCell(
      dataset.organizer
        .displayName,
    )}`,
    `E-mail;${escapeCsvCell(
      dataset.organizer
        .email,
    )}`,
    `Généré le;${escapeCsvCell(
      formatDateTime(
        dataset.generatedAt,
      ),
    )}`,
    `Devise;${escapeCsvCell(
      dataset.data.currency,
    )}`,
    `Période;${escapeCsvCell(
      `${formatDate(
        dataset.data.period
          .start,
      )} - ${formatDate(
        dataset.data.period
          .end,
      )}`,
    )}`,
    "",
    ...createCsvSection(
      "SYNTHÈSE",
      [
        "Indicateur",
        "Valeur",
      ],
      [
        [
          "Revenu brut",
          dataset.data.summary
            .grossRevenue,
        ],
        [
          "Commissions Tikemia",
          dataset.data.summary
            .platformFees,
        ],
        [
          "Revenu net organisateur",
          dataset.data.summary
            .organizerNet,
        ],
        [
          "Remboursements",
          dataset.data.summary
            .refundedAmount,
        ],
        [
          "Solde disponible",
          dataset.data.summary
            .availableBalance,
        ],
        [
          "Solde réservé",
          dataset.data.summary
            .reservedBalance,
        ],
        [
          "Total versé",
          dataset.data.summary
            .totalPaidOut,
        ],
        [
          "Taux de réussite",
          `${dataset.data.summary.paymentSuccessRate}%`,
        ],
      ],
    ),
  ];

  if (
    dataset.scope !==
    "payouts"
  ) {
    lines.push(
      ...createCsvSection(
        "PAIEMENTS",
        [
          "ID paiement",
          "Référence prestataire",
          "Référence commande",
          "Statut",
          "Méthode",
          "Prestataire",
          "Montant",
          "Devise",
          "Sous-total",
          "Commission Tikemia",
          "Net organisateur",
          "Client",
          "E-mail",
          "Téléphone",
          "Événement",
          "Ville",
          "Pays",
          "Payé le",
          "Créé le",
          "Motif échec",
        ],
        paymentRows(
          dataset.payments,
        ),
      ),
    );
  }

  if (
    dataset.scope !==
    "payments"
  ) {
    lines.push(
      ...createCsvSection(
        "RETRAITS",
        [
          "ID retrait",
          "Référence",
          "Statut",
          "Montant",
          "Frais",
          "Montant net",
          "Devise",
          "Demandé le",
          "Traité le",
          "Note",
        ],
        payoutRows(
          dataset.payouts,
        ),
      ),
    );
  }

  if (
    dataset.truncated
  ) {
    lines.push(
      "AVERTISSEMENT",
      `L’export des paiements a été limité à ${MAX_EXPORT_PAYMENTS} lignes.`,
    );
  }

  return Buffer.from(
    `\uFEFF${lines.join(
      "\r\n",
    )}`,
    "utf8",
  );
}

function styleWorksheet(
  worksheet: ExcelJS.Worksheet,
) {
  worksheet.views = [
    {
      state:
        "frozen",
      ySplit:
        1,
    },
  ];

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

  const header =
    worksheet.getRow(1);

  header.height = 24;
  header.font = {
    bold: true,
    color: {
      argb:
        "FFFFFFFF",
    },
  };
  header.fill = {
    type:
      "pattern",
    pattern:
      "solid",
    fgColor: {
      argb:
        "FF071014",
    },
  };
  header.alignment = {
    vertical:
      "middle",
  };

  worksheet.eachRow(
    {
      includeEmpty:
        false,
    },
    (
      row,
      rowNumber,
    ) => {
      if (
        rowNumber % 2 ===
          0 &&
        rowNumber >
          1
      ) {
        row.fill = {
          type:
            "pattern",
          pattern:
            "solid",
          fgColor: {
            argb:
              "FFF4F7F8",
          },
        };
      }

      row.alignment = {
        vertical:
          "middle",
      };
    },
  );
}

async function createExcel(
  dataset: ExportDataset,
): Promise<Buffer> {
  const workbook =
    new ExcelJS.Workbook();

  workbook.creator =
    "Tikemia";
  workbook.company =
    "Tikemia";
  workbook.created =
    new Date(
      dataset.generatedAt,
    );

  const summary =
    workbook.addWorksheet(
      "Synthèse",
    );

  summary.columns = [
    {
      header:
        "Indicateur",
      key:
        "label",
      width:
        34,
    },
    {
      header:
        "Valeur",
      key:
        "value",
      width:
        26,
    },
  ];

  [
    [
      "Organisateur",
      dataset.organizer
        .displayName,
    ],
    [
      "E-mail",
      dataset.organizer
        .email,
    ],
    [
      "Généré le",
      formatDateTime(
        dataset.generatedAt,
      ),
    ],
    [
      "Devise",
      dataset.data.currency,
    ],
    [
      "Revenu brut",
      dataset.data.summary
        .grossRevenue,
    ],
    [
      "Commissions Tikemia",
      dataset.data.summary
        .platformFees,
    ],
    [
      "Revenu net",
      dataset.data.summary
        .organizerNet,
    ],
    [
      "Remboursements",
      dataset.data.summary
        .refundedAmount,
    ],
    [
      "Solde disponible",
      dataset.data.summary
        .availableBalance,
    ],
    [
      "Solde réservé",
      dataset.data.summary
        .reservedBalance,
    ],
    [
      "Total versé",
      dataset.data.summary
        .totalPaidOut,
    ],
    [
      "Paiements",
      dataset.data.summary
        .totalPayments,
    ],
    [
      "Taux de réussite",
      dataset.data.summary
        .paymentSuccessRate,
    ],
  ].forEach(
    (
      [
        label,
        value,
      ],
    ) => {
      summary.addRow({
        label,
        value,
      });
    },
  );

  styleWorksheet(
    summary,
  );

  if (
    dataset.scope !==
    "payouts"
  ) {
    const payments =
      workbook.addWorksheet(
        "Paiements",
      );

    payments.columns = [
      {
        header:
          "ID paiement",
        key:
          "id",
        width:
          28,
      },
      {
        header:
          "Référence prestataire",
        key:
          "providerReference",
        width:
          24,
      },
      {
        header:
          "Commande",
        key:
          "orderReference",
        width:
          22,
      },
      {
        header:
          "Statut",
        key:
          "status",
        width:
          14,
      },
      {
        header:
          "Méthode",
        key:
          "method",
        width:
          18,
      },
      {
        header:
          "Prestataire",
        key:
          "provider",
        width:
          18,
      },
      {
        header:
          "Montant",
        key:
          "amount",
        width:
          16,
      },
      {
        header:
          "Devise",
        key:
          "currency",
        width:
          10,
      },
      {
        header:
          "Commission",
        key:
          "platformFee",
        width:
          16,
      },
      {
        header:
          "Net organisateur",
        key:
          "organizerNet",
        width:
          18,
      },
      {
        header:
          "Client",
        key:
          "customerName",
        width:
          25,
      },
      {
        header:
          "E-mail",
        key:
          "customerEmail",
        width:
          30,
      },
      {
        header:
          "Téléphone",
        key:
          "customerPhone",
        width:
          20,
      },
      {
        header:
          "Événement",
        key:
          "event",
        width:
          32,
      },
      {
        header:
          "Ville",
        key:
          "city",
        width:
          18,
      },
      {
        header:
          "Payé le",
        key:
          "paidAt",
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
      {
        header:
          "Motif échec",
        key:
          "failureReason",
        width:
          32,
      },
    ];

    dataset.payments.forEach(
      (payment) => {
        payments.addRow({
          id:
            payment.id,
          providerReference:
            payment.providerReference,
          orderReference:
            payment.order.reference,
          status:
            payment.status,
          method:
            payment.method,
          provider:
            payment.provider,
          amount:
            payment.amount,
          currency:
            payment.currency,
          platformFee:
            payment.financials.platformFee,
          organizerNet:
            payment.financials.organizerNet,
          customerName:
            payment.order.customerName,
          customerEmail:
            payment.order.customerEmail,
          customerPhone:
            payment.order.customerPhone,
          event:
            payment.event.title,
          city:
            payment.event.city,
          paidAt:
            formatDateTime(
              payment.paidAt,
            ),
          createdAt:
            formatDateTime(
              payment.createdAt,
            ),
          failureReason:
            payment.failureReason,
        });
      },
    );

    styleWorksheet(
      payments,
    );
  }

  if (
    dataset.scope !==
    "payments"
  ) {
    const payouts =
      workbook.addWorksheet(
        "Retraits",
      );

    payouts.columns = [
      {
        header:
          "ID retrait",
        key:
          "id",
        width:
          28,
      },
      {
        header:
          "Référence",
        key:
          "reference",
        width:
          24,
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
          "Montant",
        key:
          "amount",
        width:
          16,
      },
      {
        header:
          "Frais",
        key:
          "fee",
        width:
          14,
      },
      {
        header:
          "Montant net",
        key:
          "netAmount",
        width:
          16,
      },
      {
        header:
          "Devise",
        key:
          "currency",
        width:
          10,
      },
      {
        header:
          "Demandé le",
        key:
          "requestedAt",
        width:
          20,
      },
      {
        header:
          "Traité le",
        key:
          "processedAt",
        width:
          20,
      },
      {
        header:
          "Note",
        key:
          "note",
        width:
          40,
      },
    ];

    dataset.payouts.forEach(
      (payout) => {
        payouts.addRow({
          id:
            payout.id,
          reference:
            payout.reference,
          status:
            payout.status,
          amount:
            payout.amount,
          fee:
            payout.fee,
          netAmount:
            payout.netAmount,
          currency:
            payout.currency,
          requestedAt:
            formatDateTime(
              payout.requestedAt,
            ),
          processedAt:
            formatDateTime(
              payout.processedAt,
            ),
          note:
            payout.note,
        });
      },
    );

    styleWorksheet(
      payouts,
    );
  }

  const output =
    await workbook.xlsx.writeBuffer();

  return Buffer.from(
    output,
  );
}

function truncatePdfText(
  value: string,
  maximumLength: number,
): string {
  if (
    value.length <=
    maximumLength
  ) {
    return value;
  }

  return `${value.slice(
    0,
    maximumLength -
      1,
  )}…`;
}

async function createPdf(
  dataset: ExportDataset,
): Promise<Buffer> {
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

  const pageSize: [
    number,
    number,
  ] = [
    841.89,
    595.28,
  ];

  let page =
    document.addPage(
      pageSize,
    );

  let y =
    page.getHeight() -
    42;

  const margin =
    38;

  const drawHeader =
    () => {
      page.drawText(
        "TIKEMIA — RAPPORT DES PAIEMENTS",
        {
          x:
            margin,
          y,
          size:
            18,
          font:
            boldFont,
          color:
            rgb(
              0.08,
              0.75,
              0.43,
            ),
        },
      );

      y -= 24;

      page.drawText(
        `${dataset.organizer.displayName} • ${dataset.organizer.email}`,
        {
          x:
            margin,
          y,
          size:
            9,
          font:
            regularFont,
          color:
            rgb(
              0.3,
              0.34,
              0.37,
            ),
        },
      );

      y -= 15;

      page.drawText(
        `Période : ${formatDate(
          dataset.data.period.start,
        )} — ${formatDate(
          dataset.data.period.end,
        )} • Devise : ${dataset.data.currency}`,
        {
          x:
            margin,
          y,
          size:
            9,
          font:
            regularFont,
        },
      );

      y -= 24;
    };

  const ensureSpace =
    (
      height: number,
    ) => {
      if (
        y - height >
        36
      ) {
        return;
      }

      page =
        document.addPage(
          pageSize,
        );

      y =
        page.getHeight() -
        42;

      drawHeader();
    };

  const drawSectionTitle =
    (
      title: string,
    ) => {
      ensureSpace(
        28,
      );

      page.drawText(
        title,
        {
          x:
            margin,
          y,
          size:
            12,
          font:
            boldFont,
          color:
            rgb(
              0.08,
              0.18,
              0.21,
            ),
        },
      );

      y -= 19;
    };

  drawHeader();

  drawSectionTitle(
    "Synthèse financière",
  );

  const summaryRows = [
    [
      "Revenu brut",
      formatMoney(
        dataset.data.summary
          .grossRevenue,
        dataset.data.currency,
      ),
    ],
    [
      "Commissions Tikemia",
      formatMoney(
        dataset.data.summary
          .platformFees,
        dataset.data.currency,
      ),
    ],
    [
      "Revenu net",
      formatMoney(
        dataset.data.summary
          .organizerNet,
        dataset.data.currency,
      ),
    ],
    [
      "Remboursements",
      formatMoney(
        dataset.data.summary
          .refundedAmount,
        dataset.data.currency,
      ),
    ],
    [
      "Solde disponible",
      formatMoney(
        dataset.data.summary
          .availableBalance,
        dataset.data.currency,
      ),
    ],
    [
      "Solde réservé",
      formatMoney(
        dataset.data.summary
          .reservedBalance,
        dataset.data.currency,
      ),
    ],
    [
      "Total versé",
      formatMoney(
        dataset.data.summary
          .totalPaidOut,
        dataset.data.currency,
      ),
    ],
  ];

  summaryRows.forEach(
    (
      [
        label,
        value,
      ],
      index,
    ) => {
      ensureSpace(
        20,
      );

      const rowY =
        y;

      if (
        index % 2 ===
        0
      ) {
        page.drawRectangle({
          x:
            margin,
          y:
            rowY -
            4,
          width:
            page.getWidth() -
            margin *
              2,
          height:
            17,
          color:
            rgb(
              0.96,
              0.97,
              0.98,
            ),
        });
      }

      page.drawText(
        label,
        {
          x:
            margin +
            6,
          y:
            rowY,
          size:
            9,
          font:
            regularFont,
        },
      );

      page.drawText(
        value,
        {
          x:
            520,
          y:
            rowY,
          size:
            9,
          font:
            boldFont,
        },
      );

      y -= 18;
    },
  );

  if (
    dataset.scope !==
    "payouts"
  ) {
    y -= 12;
    drawSectionTitle(
      `Paiements (${dataset.payments.length})`,
    );

    dataset.payments.forEach(
      (
        payment,
        index,
      ) => {
        ensureSpace(
          21,
        );

        if (
          index % 2 ===
          0
        ) {
          page.drawRectangle({
            x:
              margin,
            y:
              y -
              4,
            width:
              page.getWidth() -
              margin *
                2,
            height:
              18,
            color:
              rgb(
                0.97,
                0.98,
                0.98,
              ),
          });
        }

        page.drawText(
          truncatePdfText(
            payment.order.reference,
            18,
          ),
          {
            x:
              margin +
              5,
            y,
            size:
              7.5,
            font:
              boldFont,
          },
        );

        page.drawText(
          truncatePdfText(
            payment.event.title,
            32,
          ),
          {
            x:
              155,
            y,
            size:
              7.5,
            font:
              regularFont,
          },
        );

        page.drawText(
          truncatePdfText(
            payment.order.customerName,
            24,
          ),
          {
            x:
              365,
            y,
            size:
              7.5,
            font:
              regularFont,
          },
        );

        page.drawText(
          payment.status,
          {
            x:
              530,
            y,
            size:
              7.5,
            font:
              regularFont,
          },
        );

        page.drawText(
          formatMoney(
            payment.amount,
            payment.currency,
          ),
          {
            x:
              625,
            y,
            size:
              7.5,
            font:
              boldFont,
          },
        );

        y -= 18;
      },
    );
  }

  if (
    dataset.scope !==
    "payments"
  ) {
    y -= 12;
    drawSectionTitle(
      `Retraits (${dataset.payouts.length})`,
    );

    dataset.payouts.forEach(
      (
        payout,
        index,
      ) => {
        ensureSpace(
          21,
        );

        if (
          index % 2 ===
          0
        ) {
          page.drawRectangle({
            x:
              margin,
            y:
              y -
              4,
            width:
              page.getWidth() -
              margin *
                2,
            height:
              18,
            color:
              rgb(
                0.97,
                0.98,
                0.98,
              ),
          });
        }

        page.drawText(
          truncatePdfText(
            payout.reference ??
              payout.id,
            24,
          ),
          {
            x:
              margin +
              5,
            y,
            size:
              7.5,
            font:
              boldFont,
          },
        );

        page.drawText(
          payout.status,
          {
            x:
              245,
            y,
            size:
              7.5,
            font:
              regularFont,
          },
        );

        page.drawText(
          formatMoney(
            payout.amount,
            payout.currency,
          ),
          {
            x:
              370,
            y,
            size:
              7.5,
            font:
              regularFont,
          },
        );

        page.drawText(
          formatMoney(
            payout.netAmount,
            payout.currency,
          ),
          {
            x:
              520,
            y,
            size:
              7.5,
            font:
              boldFont,
          },
        );

        page.drawText(
          formatDateTime(
            payout.requestedAt,
          ),
          {
            x:
              650,
            y,
            size:
              7,
            font:
              regularFont,
          },
        );

        y -= 18;
      },
    );
  }

  const pages =
    document.getPages();

  pages.forEach(
    (
      currentPage,
      index,
    ) => {
      currentPage.drawText(
        `Tikemia • Page ${index + 1} / ${pages.length}`,
        {
          x:
            margin,
          y:
            18,
          size:
            7,
          font:
            regularFont,
          color:
            rgb(
              0.45,
              0.48,
              0.5,
            ),
        },
      );
    },
  );

  const bytes =
    await document.save();

  return Buffer.from(
    bytes,
  );
}

export async function GET(
  request: NextRequest,
) {
  try {
    const organizer =
      await getConnectedOrganizer();

    const format =
      normalizeFormat(
        request.nextUrl.searchParams.get(
          "format",
        ),
      );

    const scope =
      normalizeScope(
        request.nextUrl.searchParams.get(
          "scope",
        ),
      );

    const dataset =
      await loadExportDataset({
        organizer,
        searchParams:
          request.nextUrl.searchParams,
        scope,
      });

    const filename =
      buildFilename({
        organizer,
        format,
        scope,
        generatedAt:
          dataset.generatedAt,
      });

    if (
      format === "xlsx"
    ) {
      const buffer =
        await createExcel(
          dataset,
        );

      return new Response(
        new Uint8Array(
          buffer,
        ),
        {
          status: 200,
          headers:
            createDownloadHeaders({
              filename,
              mimeType:
                XLSX_MIME_TYPE,
              contentLength:
                buffer.byteLength,
            }),
        },
      );
    }

    if (
      format === "pdf"
    ) {
      const buffer =
        await createPdf(
          dataset,
        );

      return new Response(
        new Uint8Array(
          buffer,
        ),
        {
          status: 200,
          headers:
            createDownloadHeaders({
              filename,
              mimeType:
                PDF_MIME_TYPE,
              contentLength:
                buffer.byteLength,
            }),
        },
      );
    }

    const buffer =
      createCsv(
        dataset,
      );

    return new Response(
      new Uint8Array(
        buffer,
      ),
      {
        status: 200,
        headers:
          createDownloadHeaders({
            filename,
            mimeType:
              CSV_MIME_TYPE,
            contentLength:
              buffer.byteLength,
          }),
      },
    );
  } catch (error) {
    if (
      error instanceof
      PaymentsExportRouteError
    ) {
      return createErrorResponse({
        code:
          error.code,
        message:
          error.message,
        status:
          error.status,
        details:
          error.details,
      });
    }

    if (
      error instanceof
      GetOrganizerPaymentsError
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
      "[ORGANIZER_PAYMENTS_EXPORT_ERROR]",
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
        "INTERNAL_ERROR",
      status:
        500,
      message:
        "Impossible de générer l’export des paiements pour le moment.",
    });
  }
}