import "server-only";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import {
  AdminPaymentError,
} from "@/lib/admin/payments/admin-payment-errors";
import {
  getAdminPaymentStatistics,
} from "@/lib/admin/payments/get-admin-payment-statistics";
import {
  getAdminPayments,
  type AdminPaymentListItem,
  type GetAdminPaymentsInput,
} from "@/lib/admin/payments/get-admin-payments";

export type ExportPaymentsPdfInput =
  Readonly<
    GetAdminPaymentsInput & {
      generatedAt?: Date;
    }
  >;

export type ExportPaymentsPdfResult =
  Readonly<{
    bytes: Uint8Array;
    fileName: string;
    mimeType: "application/pdf";
    generatedAt: Date;
    paymentsCount: number;
  }>;

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 28;
const ROW_HEIGHT = 22;

const COLORS = {
  dark: rgb(0.025, 0.055, 0.065),
  panel: rgb(0.055, 0.095, 0.11),
  border: rgb(0.16, 0.22, 0.24),
  white: rgb(1, 1, 1),
  text: rgb(0.83, 0.87, 0.89),
  muted: rgb(0.48, 0.55, 0.58),
  green: rgb(0.18, 0.78, 0.45),
  lime: rgb(0.64, 0.9, 0.2),
  orange: rgb(1, 0.47, 0.08),
  red: rgb(0.95, 0.32, 0.32),
} as const;

type PdfFonts = {
  regular: PDFFont;
  bold: PDFFont;
};

function normalizeGeneratedAt(
  value: Date | undefined,
): Date {
  const generatedAt =
    value ??
    new Date();

  if (
    Number.isNaN(
      generatedAt.getTime(),
    )
  ) {
    throw new AdminPaymentError({
      code:
        "ADMIN_PAYMENT_EXPORT_FAILED",
      message:
        "La date de génération du rapport est invalide.",
      status: 400,
    });
  }

  return generatedAt;
}

function sanitizeFileName(
  value: string,
): string {
  const sanitized =
    value
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        "-",
      )
      .replace(
        /-+/g,
        "-",
      )
      .replace(
        /^[-.]+|[-.]+$/g,
        "");

  return (
    sanitized ||
    "rapport-paiements-tikemia"
  );
}

function truncateText(
  value: string,
  maxLength: number,
): string {
  const normalized =
    value
      .replace(/\s+/g, " ")
      .trim();

  if (
    normalized.length <=
    maxLength
  ) {
    return normalized;
  }

  return `${normalized.slice(
    0,
    Math.max(
      0,
      maxLength - 3,
    ),
  )}...`;
}

function formatDateTime(
  value: Date | null,
): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone:
        process.env.APP_TIMEZONE?.trim() ||
        "Africa/Porto-Novo",
    },
  ).format(value);
}

function formatMoney(
  amount: string,
  currency: string,
): string {
  const numeric =
    Number(amount);

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return `0 ${currency}`;
  }

  return `${new Intl.NumberFormat(
    "fr-FR",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
  ).format(numeric)} ${currency}`;
}

function drawHeader({
  page,
  fonts,
  generatedAt,
}: {
  page: PDFPage;
  fonts: PdfFonts;
  generatedAt: Date;
}): number {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: COLORS.dark,
  });

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 8,
    width: PAGE_WIDTH / 3,
    height: 8,
    color: COLORS.green,
  });

  page.drawRectangle({
    x: PAGE_WIDTH / 3,
    y: PAGE_HEIGHT - 8,
    width: PAGE_WIDTH / 3,
    height: 8,
    color: COLORS.lime,
  });

  page.drawRectangle({
    x: (PAGE_WIDTH / 3) * 2,
    y: PAGE_HEIGHT - 8,
    width: PAGE_WIDTH / 3,
    height: 8,
    color: COLORS.orange,
  });

  page.drawText(
    "TIKEMIA",
    {
      x: MARGIN,
      y: PAGE_HEIGHT - 43,
      size: 22,
      font: fonts.bold,
      color: COLORS.lime,
    },
  );

  page.drawText(
    "RAPPORT DES PAIEMENTS",
    {
      x: MARGIN,
      y: PAGE_HEIGHT - 69,
      size: 17,
      font: fonts.bold,
      color: COLORS.white,
    },
  );

  page.drawText(
    `Genere le ${formatDateTime(
      generatedAt,
    )}`,
    {
      x: PAGE_WIDTH - 220,
      y: PAGE_HEIGHT - 43,
      size: 8,
      font: fonts.regular,
      color: COLORS.muted,
    },
  );

  return PAGE_HEIGHT - 92;
}

function drawSummary({
  page,
  fonts,
  y,
  statistics,
}: {
  page: PDFPage;
  fonts: PdfFonts;
  y: number;
  statistics:
    Awaited<
      ReturnType<
        typeof getAdminPaymentStatistics
      >
    >;
}): number {
  const cardWidth =
    (PAGE_WIDTH -
      MARGIN * 2 -
      18) /
    4;

  const cards = [
    {
      label: "Transactions",
      value:
        String(
          statistics
            .totalTransactions,
        ),
    },
    {
      label: "Reussies",
      value:
        String(
          statistics
            .successfulTransactions,
        ),
    },
    {
      label: "En attente",
      value:
        String(
          statistics
            .pendingTransactions +
            statistics
              .processingTransactions,
        ),
    },
    {
      label: "Echecs",
      value:
        String(
          statistics
            .failedTransactions,
        ),
    },
  ];

  cards.forEach(
    (card, index) => {
      const x =
        MARGIN +
        index *
          (cardWidth + 6);

      page.drawRectangle({
        x,
        y: y - 52,
        width: cardWidth,
        height: 48,
        color: COLORS.panel,
        borderColor: COLORS.border,
        borderWidth: 0.7,
      });

      page.drawText(
        card.label,
        {
          x: x + 10,
          y: y - 21,
          size: 8,
          font: fonts.regular,
          color: COLORS.muted,
        },
      );

      page.drawText(
        card.value,
        {
          x: x + 10,
          y: y - 41,
          size: 16,
          font: fonts.bold,
          color: COLORS.white,
        },
      );
    },
  );

  return y - 66;
}

function drawTableHeader({
  page,
  fonts,
  y,
}: {
  page: PDFPage;
  fonts: PdfFonts;
  y: number;
}): number {
  page.drawRectangle({
    x: MARGIN,
    y: y - ROW_HEIGHT,
    width:
      PAGE_WIDTH -
      MARGIN * 2,
    height: ROW_HEIGHT,
    color: COLORS.panel,
    borderColor: COLORS.border,
    borderWidth: 0.7,
  });

  const columns = [
    {
      x: MARGIN + 7,
      label: "Reference",
    },
    {
      x: MARGIN + 112,
      label: "Client",
    },
    {
      x: MARGIN + 248,
      label: "Evenement",
    },
    {
      x: MARGIN + 408,
      label: "Prestataire",
    },
    {
      x: MARGIN + 505,
      label: "Montant",
    },
    {
      x: MARGIN + 607,
      label: "Statut",
    },
    {
      x: MARGIN + 684,
      label: "Date",
    },
  ];

  for (
    const column of columns
  ) {
    page.drawText(
      column.label,
      {
        x: column.x,
        y: y - 15,
        size: 7.5,
        font: fonts.bold,
        color: COLORS.white,
      },
    );
  }

  return y - ROW_HEIGHT;
}

function drawPaymentRow({
  page,
  fonts,
  payment,
  y,
  odd,
}: {
  page: PDFPage;
  fonts: PdfFonts;
  payment: AdminPaymentListItem;
  y: number;
  odd: boolean;
}): number {
  if (odd) {
    page.drawRectangle({
      x: MARGIN,
      y: y - ROW_HEIGHT,
      width:
        PAGE_WIDTH -
        MARGIN * 2,
      height: ROW_HEIGHT,
      color: rgb(
        0.038,
        0.073,
        0.085,
      ),
    });
  }

  const organizerLabel =
    payment.organizer
      .businessName ??
    payment.organizer
      .fullName;

  const client =
    truncateText(
      payment.order.customerName,
      20,
    );

  const event =
    truncateText(
      payment.event.title,
      24,
    );

  const provider =
    truncateText(
      payment.provider,
      14,
    );

  const status =
    truncateText(
      payment.status,
      13,
    );

  const row = [
    {
      x: MARGIN + 7,
      value: truncateText(
        payment.order.reference,
        17,
      ),
    },
    {
      x: MARGIN + 112,
      value: client,
    },
    {
      x: MARGIN + 248,
      value: event,
    },
    {
      x: MARGIN + 408,
      value: provider,
    },
    {
      x: MARGIN + 505,
      value: truncateText(
        formatMoney(
          payment.amount,
          payment.currency,
        ),
        17,
      ),
    },
    {
      x: MARGIN + 607,
      value: status,
    },
    {
      x: MARGIN + 684,
      value: formatDateTime(
        payment.paidAt ??
        payment.createdAt,
      ),
    },
  ];

  for (
    const cell of row
  ) {
    page.drawText(
      cell.value,
      {
        x: cell.x,
        y: y - 15,
        size: 7,
        font: fonts.regular,
        color: COLORS.text,
      },
    );
  }

  return y - ROW_HEIGHT;
}

export async function exportPaymentsPdf(
  input: ExportPaymentsPdfInput = {},
): Promise<ExportPaymentsPdfResult> {
  const generatedAt =
    normalizeGeneratedAt(
      input.generatedAt,
    );

  try {
    const [
      paymentsResult,
      statistics,
    ] =
      await Promise.all([
        getAdminPayments({
          ...input,
          page: 1,
          pageSize: 5000,
        }),

        getAdminPaymentStatistics(
          input,
        ),
      ]);

    const pdf =
      await PDFDocument.create();

    pdf.setTitle(
      "Rapport des paiements Tikemia",
    );
    pdf.setAuthor(
      "Tikemia",
    );
    pdf.setSubject(
      "Rapport administratif des paiements",
    );
    pdf.setCreator(
      "Tikemia",
    );
    pdf.setProducer(
      "Tikemia Ticketing Platform",
    );
    pdf.setCreationDate(
      generatedAt,
    );
    pdf.setModificationDate(
      generatedAt,
    );

    const fonts: PdfFonts = {
      regular:
        await pdf.embedFont(
          StandardFonts.Helvetica,
        ),
      bold:
        await pdf.embedFont(
          StandardFonts.HelveticaBold,
        ),
    };

    let page =
      pdf.addPage([
        PAGE_WIDTH,
        PAGE_HEIGHT,
      ]);

    let y =
      drawHeader({
        page,
        fonts,
        generatedAt,
      });

    y =
      drawSummary({
        page,
        fonts,
        y,
        statistics,
      });

    y =
      drawTableHeader({
        page,
        fonts,
        y,
      });

    paymentsResult.payments.forEach(
      (
        payment,
        index,
      ) => {
        if (
          y - ROW_HEIGHT <
          MARGIN + 18
        ) {
          page =
            pdf.addPage([
              PAGE_WIDTH,
              PAGE_HEIGHT,
            ]);

          y =
            drawHeader({
              page,
              fonts,
              generatedAt,
            });

          y =
            drawTableHeader({
              page,
              fonts,
              y,
            });
        }

        y =
          drawPaymentRow({
            page,
            fonts,
            payment,
            y,
            odd:
              index % 2 === 1,
          });
      },
    );

    const pages =
      pdf.getPages();

    pages.forEach(
      (
        currentPage,
        index,
      ) => {
        currentPage.drawText(
          `Page ${index + 1} / ${pages.length}`,
          {
            x:
              PAGE_WIDTH -
              MARGIN -
              70,
            y: 14,
            size: 7,
            font:
              fonts.regular,
            color:
              COLORS.muted,
          },
        );

        currentPage.drawText(
          "Document administratif Tikemia",
          {
            x: MARGIN,
            y: 14,
            size: 7,
            font:
              fonts.regular,
            color:
              COLORS.muted,
          },
        );
      },
    );

    const bytes =
      await pdf.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 50,
      });

    const datePart =
      generatedAt
        .toISOString()
        .slice(0, 10);

    return {
      bytes:
        Uint8Array.from(
          bytes,
        ),
      fileName:
        `${sanitizeFileName(
          `rapport-paiements-tikemia-${datePart}`,
        )}.pdf`,
      mimeType:
        "application/pdf",
      generatedAt,
      paymentsCount:
        paymentsResult
          .payments.length,
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
        "ADMIN_PAYMENT_EXPORT_FAILED",
      message:
        "Impossible de générer le rapport PDF des paiements.",
      status: 500,
      cause: error,
    });
  }
}
