import "server-only";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import {
  AdminSubscriptionError,
} from "@/lib/admin/subscriptions/admin-subscription-errors";
import {
  getAdminSubscriptions,
  type AdminSubscriptionListItem,
  type GetAdminSubscriptionsInput,
} from "@/lib/admin/subscriptions/get-admin-subscriptions";
import {
  getAdminSubscriptionStatistics,
} from "@/lib/admin/subscriptions/get-admin-subscription-statistics";

export type ExportSubscriptionsPdfInput =
  Readonly<
    GetAdminSubscriptionsInput & {
      generatedAt?: Date;
    }
  >;

export type ExportSubscriptionsPdfResult =
  Readonly<{
    bytes: Uint8Array;
    fileName: string;
    mimeType: "application/pdf";
    generatedAt: Date;
    subscriptionsCount: number;
  }>;

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 28;
const ROW_HEIGHT = 22;

const COLORS = {
  background:
    rgb(
      0.02,
      0.04,
      0.05,
    ),
  panel:
    rgb(
      0.04,
      0.08,
      0.10,
    ),
  border:
    rgb(
      0.14,
      0.20,
      0.23,
    ),
  white:
    rgb(
      1,
      1,
      1,
    ),
  text:
    rgb(
      0.82,
      0.87,
      0.89,
    ),
  muted:
    rgb(
      0.48,
      0.55,
      0.58,
    ),
  green:
    rgb(
      0.16,
      0.78,
      0.45,
    ),
  lime:
    rgb(
      0.64,
      0.90,
      0.20,
    ),
  orange:
    rgb(
      1,
      0.47,
      0.08,
    ),
} as const;

type Fonts = {
  regular: PDFFont;
  bold: PDFFont;
};

function formatDate(
  value:
    | Date
    | null,
): string {
  if (!value) {
    return "-";
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
    },
  ).format(
    value,
  );
}

function formatMoney(
  amount: string,
  currency: string,
): string {
  const numeric =
    Number(
      amount,
    );

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return `${amount} ${currency}`;
  }

  return `${numeric.toLocaleString(
    "fr-FR",
    {
      maximumFractionDigits:
        2,
    },
  )} ${currency}`;
}

function truncate(
  value: string,
  max: number,
): string {
  const normalized =
    value
      .replace(
        /\s+/g,
        " ",
      )
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

function drawHeader({
  page,
  fonts,
  generatedAt,
}: {
  page: PDFPage;
  fonts: Fonts;
  generatedAt: Date;
}): number {
  page.drawRectangle({
    x:
      0,
    y:
      0,
    width:
      PAGE_WIDTH,
    height:
      PAGE_HEIGHT,
    color:
      COLORS.background,
  });

  page.drawRectangle({
    x:
      0,
    y:
      PAGE_HEIGHT -
      8,
    width:
      PAGE_WIDTH /
      3,
    height:
      8,
    color:
      COLORS.green,
  });

  page.drawRectangle({
    x:
      PAGE_WIDTH /
      3,
    y:
      PAGE_HEIGHT -
      8,
    width:
      PAGE_WIDTH /
      3,
    height:
      8,
    color:
      COLORS.lime,
  });

  page.drawRectangle({
    x:
      (PAGE_WIDTH /
        3) *
      2,
    y:
      PAGE_HEIGHT -
      8,
    width:
      PAGE_WIDTH /
      3,
    height:
      8,
    color:
      COLORS.orange,
  });

  page.drawText(
    "TIKEMIA",
    {
      x:
        MARGIN,
      y:
        PAGE_HEIGHT -
        42,
      size:
        22,
      font:
        fonts.bold,
      color:
        COLORS.lime,
    },
  );

  page.drawText(
    "RAPPORT DES ABONNEMENTS ORGANISATEURS",
    {
      x:
        MARGIN,
      y:
        PAGE_HEIGHT -
        67,
      size:
        15,
      font:
        fonts.bold,
      color:
        COLORS.white,
    },
  );

  page.drawText(
    `Genere le ${formatDate(
      generatedAt,
    )}`,
    {
      x:
        PAGE_WIDTH -
        180,
      y:
        PAGE_HEIGHT -
        42,
      size:
        8,
      font:
        fonts.regular,
      color:
        COLORS.muted,
    },
  );

  return (
    PAGE_HEIGHT -
    88
  );
}

function drawSummary({
  page,
  fonts,
  y,
  statistics,
}: {
  page: PDFPage;
  fonts: Fonts;
  y: number;
  statistics:
    Awaited<
      ReturnType<
        typeof getAdminSubscriptionStatistics
      >
    >;
}): number {
  const width =
    (PAGE_WIDTH -
      MARGIN *
        2 -
      18) /
    4;

  const cards = [
    [
      "Total",
      String(
        statistics.totalSubscriptions,
      ),
    ],
    [
      "Actifs",
      String(
        statistics.activeSubscriptions,
      ),
    ],
    [
      "Suspendus",
      String(
        statistics.pausedSubscriptions,
      ),
    ],
    [
      "Expirent bientot",
      String(
        statistics.endingSoonSubscriptions,
      ),
    ],
  ] as const;

  cards.forEach(
    (
      [
        label,
        value,
      ],
      index,
    ) => {
      const x =
        MARGIN +
        index *
          (width +
            6);

      page.drawRectangle({
        x,
        y:
          y -
          50,
        width,
        height:
          46,
        color:
          COLORS.panel,
        borderColor:
          COLORS.border,
        borderWidth:
          0.7,
      });

      page.drawText(
        label,
        {
          x:
            x +
            9,
          y:
            y -
            20,
          size:
            8,
          font:
            fonts.regular,
          color:
            COLORS.muted,
        },
      );

      page.drawText(
        value,
        {
          x:
            x +
            9,
          y:
            y -
            39,
          size:
            16,
          font:
            fonts.bold,
          color:
            COLORS.white,
        },
      );
    },
  );

  return (
    y -
    64
  );
}

function drawTableHeader({
  page,
  fonts,
  y,
}: {
  page: PDFPage;
  fonts: Fonts;
  y: number;
}): number {
  page.drawRectangle({
    x:
      MARGIN,
    y:
      y -
      ROW_HEIGHT,
    width:
      PAGE_WIDTH -
      MARGIN *
        2,
    height:
      ROW_HEIGHT,
    color:
      COLORS.panel,
    borderColor:
      COLORS.border,
    borderWidth:
      0.7,
  });

  const columns = [
    [
      MARGIN +
        7,
      "Organisateur",
    ],
    [
      MARGIN +
        185,
      "Plan",
    ],
    [
      MARGIN +
        310,
      "Prix",
    ],
    [
      MARGIN +
        405,
      "Statut",
    ],
    [
      MARGIN +
        500,
      "Debut",
    ],
    [
      MARGIN +
        590,
      "Fin",
    ],
    [
      MARGIN +
        680,
      "Renouv.",
    ],
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
        y:
          y -
          15,
        size:
          7.5,
        font:
          fonts.bold,
        color:
          COLORS.white,
      },
    );
  }

  return (
    y -
    ROW_HEIGHT
  );
}

function drawRow({
  page,
  fonts,
  subscription,
  y,
  odd,
}: {
  page: PDFPage;
  fonts: Fonts;
  subscription:
    AdminSubscriptionListItem;
  y: number;
  odd: boolean;
}): number {
  if (odd) {
    page.drawRectangle({
      x:
        MARGIN,
      y:
        y -
        ROW_HEIGHT,
      width:
        PAGE_WIDTH -
        MARGIN *
          2,
      height:
        ROW_HEIGHT,
      color:
        rgb(
          0.03,
          0.065,
          0.075,
        ),
    });
  }

  const organizer =
    subscription.organizer
      .businessName ??
    subscription.organizer
      .fullName;

  const cells = [
    [
      MARGIN +
        7,
      truncate(
        organizer,
        25,
      ),
    ],
    [
      MARGIN +
        185,
      truncate(
        subscription.plan.name,
        18,
      ),
    ],
    [
      MARGIN +
        310,
      truncate(
        formatMoney(
          subscription.plan.price,
          subscription.plan.currency,
        ),
        15,
      ),
    ],
    [
      MARGIN +
        405,
      subscription.status,
    ],
    [
      MARGIN +
        500,
      formatDate(
        subscription.startsAt,
      ),
    ],
    [
      MARGIN +
        590,
      formatDate(
        subscription.endsAt,
      ),
    ],
    [
      MARGIN +
        680,
      subscription.autoRenew
        ? "Oui"
        : "Non",
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
        y:
          y -
          15,
        size:
          7,
        font:
          fonts.regular,
        color:
          COLORS.text,
      },
    );
  }

  return (
    y -
    ROW_HEIGHT
  );
}

export async function exportSubscriptionsPdf(
  input:
    ExportSubscriptionsPdfInput = {},
): Promise<ExportSubscriptionsPdfResult> {
  const generatedAt =
    input.generatedAt ??
    new Date();

  try {
    const [
      result,
      statistics,
    ] =
      await Promise.all([
        getAdminSubscriptions({
          ...input,
          page:
            1,
          pageSize:
            5000,
        }),
        getAdminSubscriptionStatistics(
          input,
        ),
      ]);

    const pdf =
      await PDFDocument.create();

    pdf.setTitle(
      "Rapport des abonnements Tikemia",
    );

    pdf.setAuthor(
      "Tikemia",
    );

    const fonts: Fonts = {
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

    result.subscriptions.forEach(
      (
        subscription,
        index,
      ) => {
        if (
          y -
            ROW_HEIGHT <
          MARGIN +
            18
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
          drawRow({
            page,
            fonts,
            subscription,
            y,
            odd:
              index %
                2 ===
              1,
          });
      },
    );

    const pages =
      pdf.getPages();

    pages.forEach(
      (
        current,
        index,
      ) => {
        current.drawText(
          `Page ${index + 1} / ${pages.length}`,
          {
            x:
              PAGE_WIDTH -
              MARGIN -
              70,
            y:
              14,
            size:
              7,
            font:
              fonts.regular,
            color:
              COLORS.muted,
          },
        );

        current.drawText(
          "Document administratif Tikemia",
          {
            x:
              MARGIN,
            y:
              14,
            size:
              7,
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
        useObjectStreams:
          true,
        addDefaultPage:
          false,
      });

    return {
      bytes:
        Uint8Array.from(
          bytes,
        ),
      fileName:
        `rapport-abonnements-tikemia-${generatedAt
          .toISOString()
          .slice(
            0,
            10,
          )}.pdf`,
      mimeType:
        "application/pdf",
      generatedAt,
      subscriptionsCount:
        result.subscriptions.length,
    };
  } catch (error) {
    if (
      error instanceof
      AdminSubscriptionError
    ) {
      throw error;
    }

    throw new AdminSubscriptionError({
      code:
        "ADMIN_SUBSCRIPTION_EXPORT_FAILED",
      message:
        "Impossible de générer le rapport PDF des abonnements.",
      status:
        500,
      cause:
        error,
    });
  }
}
