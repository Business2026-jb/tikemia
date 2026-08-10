import "server-only";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import {
  AdminPayoutError,
} from "@/lib/admin/payouts/admin-payout-errors";
import {
  getAdminPayoutStatistics,
} from "@/lib/admin/payouts/get-admin-payout-statistics";
import {
  getAdminPayouts,
  type AdminPayoutListItem,
  type GetAdminPayoutsInput,
} from "@/lib/admin/payouts/get-admin-payouts";

export type ExportPayoutsPdfInput =
  Readonly<
    GetAdminPayoutsInput & {
      generatedAt?: Date;
    }
  >;

export type ExportPayoutsPdfResult =
  Readonly<{
    bytes: Uint8Array;
    fileName: string;
    mimeType: "application/pdf";
    generatedAt: Date;
    payoutsCount: number;
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
    throw new AdminPayoutError({
      code:
        "ADMIN_PAYOUT_EXPORT_FAILED",
      message:
        "La date de génération du rapport est invalide.",
      status: 400,
    });
  }

  return generatedAt;
}

function formatDate(
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
      maximumFractionDigits: 2,
    },
  ).format(numeric)} ${currency}`;
}

function truncate(
  value: string,
  max: number,
): string {
  const normalized =
    value
      .replace(/\s+/g, " ")
      .trim();

  if (
    normalized.length <=
    max
  ) {
    return normalized;
  }

  return `${normalized.slice(
    0,
    Math.max(
      0,
      max - 3,
    ),
  )}...`;
}

function drawPageHeader({
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
    "RAPPORT DES RETRAITS ORGANISATEURS",
    {
      x: MARGIN,
      y: PAGE_HEIGHT - 69,
      size: 16,
      font: fonts.bold,
      color: COLORS.white,
    },
  );

  page.drawText(
    `Genere le ${formatDate(
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
        typeof getAdminPayoutStatistics
      >
    >;
}): number {
  const width =
    (PAGE_WIDTH -
      MARGIN * 2 -
      18) /
    4;

  const cards = [
    {
      label: "Demandes",
      value:
        String(
          statistics.totalRequests,
        ),
    },
    {
      label: "En attente",
      value:
        String(
          statistics.pendingRequests,
        ),
    },
    {
      label: "En traitement",
      value:
        String(
          statistics.processingRequests,
        ),
    },
    {
      label: "Payees",
      value:
        String(
          statistics.paidRequests,
        ),
    },
  ];

  cards.forEach(
    (card, index) => {
      const x =
        MARGIN +
        index *
          (width + 6);

      page.drawRectangle({
        x,
        y: y - 52,
        width,
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
    [MARGIN + 7, "Reference"],
    [MARGIN + 112, "Organisateur"],
    [MARGIN + 275, "Methode"],
    [MARGIN + 395, "Montant"],
    [MARGIN + 505, "Net"],
    [MARGIN + 595, "Statut"],
    [MARGIN + 675, "Demande"],
  ] as const;

  for (
    const [
      x,
      label,
    ] of columns
  ) {
    page.drawText(
      label,
      {
        x,
        y: y - 15,
        size: 7.5,
        font: fonts.bold,
        color: COLORS.white,
      },
    );
  }

  return y - ROW_HEIGHT;
}

function drawRow({
  page,
  fonts,
  payout,
  y,
  odd,
}: {
  page: PDFPage;
  fonts: PdfFonts;
  payout: AdminPayoutListItem;
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

  const organizer =
    payout.organizer
      .businessName ??
    payout.organizer.fullName;

  const cells = [
    [
      MARGIN + 7,
      truncate(
        payout.reference ??
          payout.id,
        17,
      ),
    ],
    [
      MARGIN + 112,
      truncate(
        organizer,
        23,
      ),
    ],
    [
      MARGIN + 275,
      truncate(
        payout.destinationType ??
          "-",
        18,
      ),
    ],
    [
      MARGIN + 395,
      truncate(
        formatMoney(
          payout.amount,
          payout.currency,
        ),
        17,
      ),
    ],
    [
      MARGIN + 505,
      truncate(
        formatMoney(
          payout.netAmount,
          payout.currency,
        ),
        15,
      ),
    ],
    [
      MARGIN + 595,
      truncate(
        payout.status,
        12,
      ),
    ],
    [
      MARGIN + 675,
      formatDate(
        payout.requestedAt,
      ),
    ],
  ] as const;

  for (
    const [
      x,
      value,
    ] of cells
  ) {
    page.drawText(
      value,
      {
        x,
        y: y - 15,
        size: 7,
        font: fonts.regular,
        color: COLORS.text,
      },
    );
  }

  return y - ROW_HEIGHT;
}

export async function exportPayoutsPdf(
  input: ExportPayoutsPdfInput = {},
): Promise<ExportPayoutsPdfResult> {
  const generatedAt =
    normalizeGeneratedAt(
      input.generatedAt,
    );

  try {
    const [
      payoutsResult,
      statistics,
    ] =
      await Promise.all([
        getAdminPayouts({
          ...input,
          page: 1,
          pageSize: 5000,
        }),

        getAdminPayoutStatistics(
          input,
        ),
      ]);

    const pdf =
      await PDFDocument.create();

    pdf.setTitle(
      "Rapport des retraits Tikemia",
    );
    pdf.setAuthor(
      "Tikemia",
    );
    pdf.setSubject(
      "Rapport administratif des retraits organisateurs",
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
      drawPageHeader({
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

    payoutsResult.payouts.forEach(
      (
        payout,
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
            drawPageHeader({
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
          drawRow({
            page,
            fonts,
            payout,
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
        `rapport-retraits-tikemia-${datePart}.pdf`,
      mimeType:
        "application/pdf",
      generatedAt,
      payoutsCount:
        payoutsResult
          .payouts.length,
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
        "ADMIN_PAYOUT_EXPORT_FAILED",
      message:
        "Impossible de générer le rapport PDF des retraits.",
      status: 500,
      cause: error,
    });
  }
}
