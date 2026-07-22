import "server-only";

import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
} from "pdf-lib";

import type {
  ExportOrdersDataResult,
  OrganizerOrdersExportOrder,
} from "@/lib/organizer/orders/export-orders-data";

const PDF_MIME_TYPE =
  "application/pdf";

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;

const MARGIN_X = 38;
const MARGIN_TOP = 38;
const MARGIN_BOTTOM = 34;

const HEADER_HEIGHT = 62;
const FOOTER_HEIGHT = 24;

const CONTENT_TOP =
  PAGE_HEIGHT -
  MARGIN_TOP -
  HEADER_HEIGHT;

const CONTENT_BOTTOM =
  MARGIN_BOTTOM +
  FOOTER_HEIGHT;

const COLORS = {
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

  red:
    rgb(
      0.97,
      0.44,
      0.44,
    ),

  violet:
    rgb(
      0.75,
      0.52,
      0.98,
    ),

  amber:
    rgb(
      0.98,
      0.75,
      0.14,
    ),

  black:
    rgb(
      0,
      0,
      0,
    ),
} as const;

export type CreateOrdersPdfOptions = {
  includeSummary?: boolean;
  includeFilters?: boolean;
  includeOrders?: boolean;
  maximumOrders?: number;
};

export type CreateOrdersPdfResult = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  pageCount: number;
  exportedOrders: number;
  truncated: boolean;
};

export class CreateOrdersPdfError extends Error {
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
      "CreateOrdersPdfError";

    this.code =
      code;

    this.status =
      status;
  }
}

type PdfFonts = {
  regular: PDFFont;
  bold: PDFFont;
};

type PdfContext = {
  document: PDFDocument;
  fonts: PdfFonts;
  data: ExportOrdersDataResult;
  pages: PDFPage[];
  currentPage: PDFPage;
  currentY: number;
};

type PdfTextOptions = {
  size?: number;
  color?: ReturnType<
    typeof rgb
  >;
  font?: PDFFont;
  maxWidth?: number;
  lineHeight?: number;
};

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

  return (
    normalized ||
    fallback
  );
}

function formatFilenameDate(
  value: string,
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return new Date()
      .toISOString()
      .slice(
        0,
        10,
      );
  }

  return date
    .toISOString()
    .slice(
      0,
      10,
    );
}

function normalizeMaximumOrders(
  value:
    | number
    | undefined,
): number {
  if (
    typeof value !==
      "number" ||
    !Number.isFinite(
      value,
    )
  ) {
    return 300;
  }

  return Math.min(
    Math.max(
      Math.trunc(
        value,
      ),
      1,
    ),
    1_000,
  );
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
      ?.replace(
        /\u0000/g,
        "",
      )
      .replace(
        /\s+/g,
        " ",
      )
      .trim() ??
    "";

  return (
    normalized ||
    fallback
  );
}

function formatDateTime(
  value:
    | string
    | null,
): string {
  if (!value) {
    return "Non renseigné";
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

      hour12:
        false,

      timeZone:
        "UTC",
    },
  ).format(
    date,
  );
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
    return "Non renseigné";
  }

  return (
    labels[value] ??
    value
  );
}

function getStatusColor(
  status: string,
) {
  if (
    status === "PAID" ||
    status === "SUCCESS" ||
    status === "VALID"
  ) {
    return COLORS.green;
  }

  if (
    status === "PENDING"
  ) {
    return COLORS.amber;
  }

  if (
    status === "REFUNDED"
  ) {
    return COLORS.violet;
  }

  if (
    status === "FAILED" ||
    status === "CANCELLED"
  ) {
    return COLORS.red;
  }

  return COLORS.muted;
}

function truncateText({
  text,
  font,
  size,
  maxWidth,
}: {
  text: string;
  font: PDFFont;
  size: number;
  maxWidth: number;
}): string {
  if (
    font.widthOfTextAtSize(
      text,
      size,
    ) <=
    maxWidth
  ) {
    return text;
  }

  const suffix =
    "...";

  let output =
    text;

  while (
    output.length >
      0 &&
    font.widthOfTextAtSize(
      `${output}${suffix}`,
      size,
    ) >
      maxWidth
  ) {
    output =
      output.slice(
        0,
        -1,
      );
  }

  return (
    output
      ? `${output}${suffix}`
      : suffix
  );
}

function wrapText({
  text,
  font,
  size,
  maxWidth,
}: {
  text: string;
  font: PDFFont;
  size: number;
  maxWidth: number;
}): string[] {
  const normalized =
    normalizeText(
      text,
    );

  if (!normalized) {
    return [
      "",
    ];
  }

  const words =
    normalized.split(
      " ",
    );

  const lines: string[] = [];

  let line =
    "";

  for (
    const word of
    words
  ) {
    const candidate =
      line
        ? `${line} ${word}`
        : word;

    if (
      font.widthOfTextAtSize(
        candidate,
        size,
      ) <=
      maxWidth
    ) {
      line =
        candidate;

      continue;
    }

    if (line) {
      lines.push(
        line,
      );
    }

    if (
      font.widthOfTextAtSize(
        word,
        size,
      ) <=
      maxWidth
    ) {
      line =
        word;

      continue;
    }

    let fragment =
      "";

    for (
      const character of
      word
    ) {
      const fragmentCandidate =
        `${fragment}${character}`;

      if (
        font.widthOfTextAtSize(
          fragmentCandidate,
          size,
        ) <=
        maxWidth
      ) {
        fragment =
          fragmentCandidate;
      } else {
        if (fragment) {
          lines.push(
            fragment,
          );
        }

        fragment =
          character;
      }
    }

    line =
      fragment;
  }

  if (line) {
    lines.push(
      line,
    );
  }

  return lines;
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  {
    size = 10,
    color = COLORS.text,
    font,
    maxWidth,
  }: PdfTextOptions,
): void {
  const selectedFont =
    font;

  if (!selectedFont) {
    throw new Error(
      "Une police PDF est obligatoire.",
    );
  }

  const safeText =
    maxWidth
      ? truncateText({
          text:
            normalizeText(
              text,
            ),

          font:
            selectedFont,

          size,

          maxWidth,
        })
      : normalizeText(
          text,
        );

  page.drawText(
    safeText,
    {
      x,
      y,
      size,
      font:
        selectedFont,
      color,
    },
  );
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  {
    size = 10,
    color = COLORS.text,
    font,
    maxWidth = 300,
    lineHeight = 13,
  }: PdfTextOptions,
): number {
  const selectedFont =
    font;

  if (!selectedFont) {
    throw new Error(
      "Une police PDF est obligatoire.",
    );
  }

  const lines =
    wrapText({
      text,
      font:
        selectedFont,
      size,
      maxWidth,
    });

  lines.forEach(
    (
      line,
      index,
    ) => {
      page.drawText(
        line,
        {
          x,
          y:
            y -
            index *
              lineHeight,

          size,
          font:
            selectedFont,
          color,
        },
      );
    },
  );

  return (
    lines.length *
    lineHeight
  );
}

function drawRoundedPanel({
  page,
  x,
  y,
  width,
  height,
  fill = COLORS.panel,
  border = COLORS.border,
}: {
  page: PDFPage;
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: ReturnType<
    typeof rgb
  >;
  border?: ReturnType<
    typeof rgb
  >;
}): void {
  page.drawRectangle({
    x,
    y:
      y -
      height,
    width,
    height,
    color:
      fill,
    borderColor:
      border,
    borderWidth:
      0.8,
  });
}

function drawHeader({
  page,
  fonts,
  data,
}: {
  page: PDFPage;
  fonts: PdfFonts;
  data: ExportOrdersDataResult;
}): void {
  page.drawRectangle({
    x:
      0,
    y:
      PAGE_HEIGHT -
      HEADER_HEIGHT -
      MARGIN_TOP +
      10,
    width:
      PAGE_WIDTH,
    height:
      HEADER_HEIGHT +
      MARGIN_TOP,
    color:
      COLORS.background,
  });

  page.drawRectangle({
    x:
      MARGIN_X,
    y:
      PAGE_HEIGHT -
      MARGIN_TOP -
      11,
    width:
      34,
    height:
      4,
    color:
      COLORS.green,
  });

  drawText(
    page,
    "TIKEMIA",
    MARGIN_X,
    PAGE_HEIGHT -
      MARGIN_TOP -
      30,
    {
      font:
        fonts.bold,
      size:
        18,
      color:
        COLORS.white,
    },
  );

  drawText(
    page,
    "Rapport professionnel des commandes",
    MARGIN_X +
      106,
    PAGE_HEIGHT -
      MARGIN_TOP -
      27,
    {
      font:
        fonts.bold,
      size:
        12,
      color:
        COLORS.text,
      maxWidth:
        360,
    },
  );

  drawText(
    page,
    data.organizer.businessName ??
      data.organizer.name,
    MARGIN_X +
      106,
    PAGE_HEIGHT -
      MARGIN_TOP -
      43,
    {
      font:
        fonts.regular,
      size:
        8.5,
      color:
        COLORS.muted,
      maxWidth:
        360,
    },
  );

  const generatedLabel =
    `Généré le ${formatDateTime(
      data.generatedAt,
    )}`;

  const labelWidth =
    fonts.regular.widthOfTextAtSize(
      generatedLabel,
      8,
    );

  drawText(
    page,
    generatedLabel,
    PAGE_WIDTH -
      MARGIN_X -
      labelWidth,
    PAGE_HEIGHT -
      MARGIN_TOP -
      30,
    {
      font:
        fonts.regular,
      size:
        8,
      color:
        COLORS.muted,
    },
  );
}

function drawFooter({
  page,
  fonts,
  pageNumber,
  totalPages,
}: {
  page: PDFPage;
  fonts: PdfFonts;
  pageNumber: number;
  totalPages: number;
}): void {
  page.drawLine({
    start: {
      x:
        MARGIN_X,
      y:
        MARGIN_BOTTOM +
        FOOTER_HEIGHT -
        2,
    },

    end: {
      x:
        PAGE_WIDTH -
        MARGIN_X,
      y:
        MARGIN_BOTTOM +
        FOOTER_HEIGHT -
        2,
    },

    thickness:
      0.7,

    color:
      COLORS.border,
  });

  drawText(
    page,
    "Document confidentiel — Espace organisateur Tikemia",
    MARGIN_X,
    MARGIN_BOTTOM +
      7,
    {
      font:
        fonts.regular,
      size:
        7.5,
      color:
        COLORS.muted,
    },
  );

  const pageLabel =
    `Page ${pageNumber} sur ${totalPages}`;

  const pageLabelWidth =
    fonts.regular.widthOfTextAtSize(
      pageLabel,
      7.5,
    );

  drawText(
    page,
    pageLabel,
    PAGE_WIDTH -
      MARGIN_X -
      pageLabelWidth,
    MARGIN_BOTTOM +
      7,
    {
      font:
        fonts.regular,
      size:
        7.5,
      color:
        COLORS.muted,
    },
  );
}

function createPage(
  context: PdfContext,
): PDFPage {
  const page =
    context.document.addPage([
      PAGE_WIDTH,
      PAGE_HEIGHT,
    ]);

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

  context.pages.push(
    page,
  );

  context.currentPage =
    page;

  context.currentY =
    CONTENT_TOP;

  drawHeader({
    page,
    fonts:
      context.fonts,
    data:
      context.data,
  });

  return page;
}

function ensureSpace(
  context: PdfContext,
  requiredHeight: number,
): void {
  if (
    context.currentY -
      requiredHeight <
    CONTENT_BOTTOM
  ) {
    createPage(
      context,
    );
  }
}

function drawSectionTitle({
  context,
  title,
  subtitle,
}: {
  context: PdfContext;
  title: string;
  subtitle?: string;
}): void {
  ensureSpace(
    context,
    subtitle
      ? 38
      : 24,
  );

  context.currentPage.drawRectangle({
    x:
      MARGIN_X,
    y:
      context.currentY -
      3,
    width:
      4,
    height:
      16,
    color:
      COLORS.green,
  });

  drawText(
    context.currentPage,
    title,
    MARGIN_X +
      12,
    context.currentY,
    {
      font:
        context.fonts.bold,
      size:
        13,
      color:
        COLORS.white,
    },
  );

  context.currentY -=
    18;

  if (subtitle) {
    drawWrappedText(
      context.currentPage,
      subtitle,
      MARGIN_X +
        12,
      context.currentY,
      {
        font:
          context.fonts.regular,
        size:
          8.5,
        lineHeight:
          11,
        color:
          COLORS.muted,
        maxWidth:
          PAGE_WIDTH -
          MARGIN_X *
            2 -
          12,
      },
    );

    context.currentY -=
      20;
  } else {
    context.currentY -=
      8;
  }
}

function drawSummaryCards(
  context: PdfContext,
): void {
  drawSectionTitle({
    context,
    title:
      "Résumé général",
    subtitle:
      "Vue synthétique des commandes, billets et acheteurs correspondant aux filtres appliqués.",
  });

  const cardGap =
    10;

  const cardWidth =
    (
      PAGE_WIDTH -
      MARGIN_X *
        2 -
      cardGap *
        3
    ) /
    4;

  const cardHeight =
    66;

  const cards = [
    {
      label:
        "Commandes",
      value:
        context.data.summary.totalOrders.toLocaleString(
          "fr-FR",
        ),
      color:
        COLORS.white,
    },
    {
      label:
        "Payées",
      value:
        context.data.summary.paidOrders.toLocaleString(
          "fr-FR",
        ),
      color:
        COLORS.green,
    },
    {
      label:
        "Billets",
      value:
        context.data.summary.totalTickets.toLocaleString(
          "fr-FR",
        ),
      color:
        COLORS.blue,
    },
    {
      label:
        "Clients uniques",
      value:
        context.data.summary.uniqueCustomers.toLocaleString(
          "fr-FR",
        ),
      color:
        COLORS.violet,
    },
  ];

  ensureSpace(
    context,
    cardHeight +
      10,
  );

  cards.forEach(
    (
      card,
      index,
    ) => {
      const x =
        MARGIN_X +
        index *
          (
            cardWidth +
            cardGap
          );

      drawRoundedPanel({
        page:
          context.currentPage,
        x,
        y:
          context.currentY,
        width:
          cardWidth,
        height:
          cardHeight,
      });

      drawText(
        context.currentPage,
        card.label,
        x +
          12,
        context.currentY -
          18,
        {
          font:
            context.fonts.regular,
          size:
            8,
          color:
            COLORS.muted,
          maxWidth:
            cardWidth -
            24,
        },
      );

      drawText(
        context.currentPage,
        card.value,
        x +
          12,
        context.currentY -
          44,
        {
          font:
            context.fonts.bold,
          size:
            18,
          color:
            card.color,
          maxWidth:
            cardWidth -
            24,
        },
      );
    },
  );

  context.currentY -=
    cardHeight +
    18;
}

function drawCurrencySummary(
  context: PdfContext,
): void {
  drawSectionTitle({
    context,
    title:
      "Revenus par devise",
    subtitle:
      "Les monnaies restent séparées. Aucun montant de devises différentes n’est additionné.",
  });

  if (
    context.data.summary
      .totalsByCurrency
      .length ===
    0
  ) {
    ensureSpace(
      context,
      44,
    );

    drawRoundedPanel({
      page:
        context.currentPage,
      x:
        MARGIN_X,
      y:
        context.currentY,
      width:
        PAGE_WIDTH -
        MARGIN_X *
          2,
      height:
        40,
    });

    drawText(
      context.currentPage,
      "Aucun revenu payé n’est disponible pour cette sélection.",
      MARGIN_X +
        12,
      context.currentY -
        24,
      {
        font:
          context.fonts.regular,
        size:
          9,
        color:
          COLORS.muted,
      },
    );

    context.currentY -=
      52;

    return;
  }

  const columns = [
    {
      label:
        "Devise",
      width:
        72,
    },
    {
      label:
        "Commandes",
      width:
        74,
    },
    {
      label:
        "Billets",
      width:
        66,
    },
    {
      label:
        "Sous-total",
      width:
        130,
    },
    {
      label:
        "Commission",
      width:
        130,
    },
    {
      label:
        "Net organisateur",
      width:
        145,
    },
  ];

  const tableWidth =
    columns.reduce(
      (
        total,
        column,
      ) =>
        total +
        column.width,
      0,
    );

  const headerHeight =
    25;

  const rowHeight =
    28;

  ensureSpace(
    context,
    headerHeight +
      rowHeight *
        Math.min(
          context.data.summary
            .totalsByCurrency
            .length,
          5,
        ) +
      10,
  );

  let x =
    MARGIN_X;

  columns.forEach(
    (
      column,
    ) => {
      context.currentPage.drawRectangle({
        x,
        y:
          context.currentY -
          headerHeight,
        width:
          column.width,
        height:
          headerHeight,
        color:
          COLORS.panelSoft,
        borderColor:
          COLORS.border,
        borderWidth:
          0.6,
      });

      drawText(
        context.currentPage,
        column.label,
        x +
          6,
        context.currentY -
          16,
        {
          font:
            context.fonts.bold,
          size:
            7.5,
          color:
            COLORS.text,
          maxWidth:
            column.width -
            12,
        },
      );

      x +=
        column.width;
    },
  );

  context.currentY -=
    headerHeight;

  for (
    const total of
    context.data.summary
      .totalsByCurrency
  ) {
    ensureSpace(
      context,
      rowHeight,
    );

    const values = [
      total.currency,
      total.paidOrdersCount.toLocaleString(
        "fr-FR",
      ),
      total.ticketsCount.toLocaleString(
        "fr-FR",
      ),
      total.subtotalFormatted,
      total.platformFeesFormatted,
      total.organizerNetFormatted,
    ];

    x =
      MARGIN_X;

    values.forEach(
      (
        value,
        index,
      ) => {
        const column =
          columns[index];

        context.currentPage.drawRectangle({
          x,
          y:
            context.currentY -
            rowHeight,
          width:
            column.width,
          height:
            rowHeight,
          color:
            index ===
              5
              ? rgb(
                  0.06,
                  0.14,
                  0.08,
                )
              : COLORS.panel,
          borderColor:
            COLORS.border,
          borderWidth:
            0.45,
        });

        drawText(
          context.currentPage,
          String(
            value,
          ),
          x +
            6,
          context.currentY -
            18,
          {
            font:
              index ===
                0 ||
              index ===
                5
                ? context.fonts.bold
                : context.fonts.regular,

            size:
              7.6,

            color:
              index ===
                5
                ? COLORS.green
                : index ===
                    4
                  ? COLORS.orange
                  : COLORS.text,

            maxWidth:
              column.width -
              12,
          },
        );

        x +=
          column.width;
      },
    );

    context.currentY -=
      rowHeight;
  }

  context.currentY -=
    16;

  void tableWidth;
}

function drawFilters(
  context: PdfContext,
): void {
  drawSectionTitle({
    context,
    title:
      "Filtres appliqués",
  });

  const filters = [
    [
      "Recherche",
      context.data.filters.search ||
        "Aucune",
    ],
    [
      "Événement",
      context.data.filters.eventId ||
        "Tous",
    ],
    [
      "Statut commande",
      formatStatus(
        context.data.filters.status,
      ),
    ],
    [
      "Devise",
      context.data.filters.currency ||
        "Toutes",
    ],
    [
      "Statut paiement",
      formatStatus(
        context.data.filters.paymentStatus,
      ),
    ],
    [
      "Moyen paiement",
      context.data.filters.paymentMethod ||
        "Tous",
    ],
    [
      "Date début",
      formatDateTime(
        context.data.filters.dateFrom,
      ),
    ],
    [
      "Date fin",
      formatDateTime(
        context.data.filters.dateTo,
      ),
    ],
  ];

  const columnGap =
    10;

  const boxWidth =
    (
      PAGE_WIDTH -
      MARGIN_X *
        2 -
      columnGap
    ) /
    2;

  for (
    let index = 0;
    index <
    filters.length;
    index += 2
  ) {
    ensureSpace(
      context,
      42,
    );

    [
      filters[index],
      filters[
        index + 1
      ],
    ].forEach(
      (
        filter,
        columnIndex,
      ) => {
        if (!filter) {
          return;
        }

        const x =
          MARGIN_X +
          columnIndex *
            (
              boxWidth +
              columnGap
            );

        drawRoundedPanel({
          page:
            context.currentPage,
          x,
          y:
            context.currentY,
          width:
            boxWidth,
          height:
            34,
          fill:
            COLORS.panel,
        });

        drawText(
          context.currentPage,
          filter[0],
          x +
            10,
          context.currentY -
            12,
          {
            font:
              context.fonts.regular,
            size:
              7,
            color:
              COLORS.muted,
            maxWidth:
              boxWidth -
              20,
          },
        );

        drawText(
          context.currentPage,
          filter[1],
          x +
            10,
          context.currentY -
            25,
          {
            font:
              context.fonts.bold,
            size:
              8,
            color:
              COLORS.text,
            maxWidth:
              boxWidth -
              20,
          },
        );
      },
    );

    context.currentY -=
      42;
  }

  context.currentY -=
    8;
}

function drawOrderTableHeader(
  context: PdfContext,
): void {
  const columns = [
    {
      label:
        "Référence",
      width:
        93,
    },
    {
      label:
        "Client",
      width:
        135,
    },
    {
      label:
        "Événement",
      width:
        157,
    },
    {
      label:
        "Statut",
      width:
        75,
    },
    {
      label:
        "Billets",
      width:
        48,
    },
    {
      label:
        "Total",
      width:
        103,
    },
    {
      label:
        "Net",
      width:
        103,
    },
  ];

  let x =
    MARGIN_X;

  const height =
    24;

  columns.forEach(
    (
      column,
    ) => {
      context.currentPage.drawRectangle({
        x,
        y:
          context.currentY -
          height,
        width:
          column.width,
        height,
        color:
          COLORS.panelSoft,
        borderColor:
          COLORS.border,
        borderWidth:
          0.6,
      });

      drawText(
        context.currentPage,
        column.label,
        x +
          5,
        context.currentY -
          16,
        {
          font:
            context.fonts.bold,
          size:
            7.2,
          color:
            COLORS.text,
          maxWidth:
            column.width -
            10,
        },
      );

      x +=
        column.width;
    },
  );

  context.currentY -=
    height;
}

function drawOrderRow(
  context: PdfContext,
  order: OrganizerOrdersExportOrder,
  index: number,
): void {
  const columns = [
    {
      value:
        order.reference,
      width:
        93,
      color:
        COLORS.white,
      bold:
        true,
    },
    {
      value:
        order.customer.name,
      width:
        135,
      color:
        COLORS.text,
      bold:
        false,
    },
    {
      value:
        order.event.title,
      width:
        157,
      color:
        COLORS.text,
      bold:
        false,
    },
    {
      value:
        formatStatus(
          order.status,
        ),
      width:
        75,
      color:
        getStatusColor(
          order.status,
        ),
      bold:
        true,
    },
    {
      value:
        order.ticketsCount.toLocaleString(
          "fr-FR",
        ),
      width:
        48,
      color:
        COLORS.blue,
      bold:
        true,
    },
    {
      value:
        order.totalFormatted,
      width:
        103,
      color:
        COLORS.text,
      bold:
        true,
    },
    {
      value:
        order.organizerNetFormatted,
      width:
        103,
      color:
        COLORS.green,
      bold:
        true,
    },
  ];

  const rowHeight =
    31;

  ensureSpace(
    context,
    rowHeight +
      24,
  );

  if (
    context.currentY ===
    CONTENT_TOP
  ) {
    drawSectionTitle({
      context,
      title:
        "Liste des commandes",
      subtitle:
        "Suite du tableau des commandes exportées.",
    });

    drawOrderTableHeader(
      context,
    );
  }

  let x =
    MARGIN_X;

  columns.forEach(
    (
      column,
    ) => {
      context.currentPage.drawRectangle({
        x,
        y:
          context.currentY -
          rowHeight,
        width:
          column.width,
        height:
          rowHeight,
        color:
          index % 2 ===
          0
            ? COLORS.panel
            : COLORS.panelSoft,
        borderColor:
          COLORS.border,
        borderWidth:
          0.4,
      });

      drawText(
        context.currentPage,
        normalizeText(
          String(
            column.value,
          ),
          "-",
        ),
        x +
          5,
        context.currentY -
          19,
        {
          font:
            column.bold
              ? context.fonts.bold
              : context.fonts.regular,

          size:
            7.1,

          color:
            column.color,

          maxWidth:
            column.width -
            10,
        },
      );

      x +=
        column.width;
    },
  );

  context.currentY -=
    rowHeight;
}

function drawOrders(
  context: PdfContext,
  orders: OrganizerOrdersExportOrder[],
): void {
  drawSectionTitle({
    context,
    title:
      "Liste des commandes",
    subtitle:
      "Les montants sont affichés dans la devise propre à chaque commande.",
  });

  if (
    orders.length ===
    0
  ) {
    ensureSpace(
      context,
      44,
    );

    drawRoundedPanel({
      page:
        context.currentPage,
      x:
        MARGIN_X,
      y:
        context.currentY,
      width:
        PAGE_WIDTH -
        MARGIN_X *
          2,
      height:
        40,
    });

    drawText(
      context.currentPage,
      "Aucune commande ne correspond aux filtres appliqués.",
      MARGIN_X +
        12,
      context.currentY -
        24,
      {
        font:
          context.fonts.regular,
        size:
          9,
        color:
          COLORS.muted,
      },
    );

    context.currentY -=
      48;

    return;
  }

  drawOrderTableHeader(
    context,
  );

  orders.forEach(
    (
      order,
      index,
    ) => {
      drawOrderRow(
        context,
        order,
        index,
      );
    },
  );
}

function drawExportNotice(
  context: PdfContext,
  exportedOrders: number,
  totalMatchingOrders: number,
): void {
  if (
    exportedOrders >=
    totalMatchingOrders
  ) {
    return;
  }

  ensureSpace(
    context,
    52,
  );

  drawRoundedPanel({
    page:
      context.currentPage,
    x:
      MARGIN_X,
    y:
      context.currentY,
    width:
      PAGE_WIDTH -
      MARGIN_X *
        2,
    height:
      44,
    fill:
      rgb(
        0.18,
        0.08,
        0.03,
      ),
    border:
      COLORS.orange,
  });

  drawText(
    context.currentPage,
    "Export partiel",
    MARGIN_X +
      12,
    context.currentY -
      15,
    {
      font:
        context.fonts.bold,
      size:
        9,
      color:
        COLORS.orange,
    },
  );

  drawText(
    context.currentPage,
    `${exportedOrders.toLocaleString(
      "fr-FR",
    )} commande(s) exportée(s) sur ${totalMatchingOrders.toLocaleString(
      "fr-FR",
    )} correspondante(s).`,
    MARGIN_X +
      12,
    context.currentY -
      31,
    {
      font:
        context.fonts.regular,
      size:
        8,
      color:
        COLORS.text,
      maxWidth:
        PAGE_WIDTH -
        MARGIN_X *
          2 -
        24,
    },
  );

  context.currentY -=
    54;
}

export async function createOrdersPdf(
  data: ExportOrdersDataResult,
  options: CreateOrdersPdfOptions = {},
): Promise<CreateOrdersPdfResult> {
  if (!data) {
    throw new CreateOrdersPdfError({
      code:
        "EXPORT_DATA_REQUIRED",
      status:
        400,
      message:
        "Les données d’export des commandes sont obligatoires.",
    });
  }

  const includeSummary =
    options.includeSummary !==
    false;

  const includeFilters =
    options.includeFilters !==
    false;

  const includeOrders =
    options.includeOrders !==
    false;

  const maximumOrders =
    normalizeMaximumOrders(
      options.maximumOrders,
    );

  const orders =
    data.orders.slice(
      0,
      maximumOrders,
    );

  try {
    const document =
      await PDFDocument.create();

    const fonts: PdfFonts = {
      regular:
        await document.embedFont(
          StandardFonts.Helvetica,
        ),

      bold:
        await document.embedFont(
          StandardFonts.HelveticaBold,
        ),
    };

    document.setTitle(
      `Rapport commandes Tikemia — ${
        data.organizer.businessName ??
        data.organizer.name
      }`,
    );

    document.setAuthor(
      "Tikemia",
    );

    document.setCreator(
      "Tikemia",
    );

    document.setProducer(
      "Tikemia",
    );

    document.setSubject(
      "Rapport professionnel des commandes organisateur",
    );

    document.setKeywords([
      "Tikemia",
      "commandes",
      "billets",
      "paiements",
      "organisateur",
    ]);

    document.setCreationDate(
      new Date(
        data.generatedAt,
      ),
    );

    document.setModificationDate(
      new Date(),
    );

    const firstPage =
      document.addPage([
        PAGE_WIDTH,
        PAGE_HEIGHT,
      ]);

    firstPage.drawRectangle({
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

    const context: PdfContext = {
      document,
      fonts,
      data,
      pages: [
        firstPage,
      ],
      currentPage:
        firstPage,
      currentY:
        CONTENT_TOP,
    };

    drawHeader({
      page:
        firstPage,
      fonts,
      data,
    });

    if (includeSummary) {
      drawSummaryCards(
        context,
      );

      drawCurrencySummary(
        context,
      );
    }

    if (includeFilters) {
      drawFilters(
        context,
      );
    }

    if (includeOrders) {
      drawOrders(
        context,
        orders,
      );
    }

    drawExportNotice(
      context,
      orders.length,
      data.metadata.totalMatchingOrders,
    );

    const totalPages =
      context.pages.length;

    context.pages.forEach(
      (
        page,
        index,
      ) => {
        drawFooter({
          page,
          fonts,
          pageNumber:
            index +
            1,
          totalPages,
        });
      },
    );

    const bytes =
      await document.save({
        useObjectStreams:
          true,
        addDefaultPage:
          false,
        updateFieldAppearances:
          false,
      });

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
      ".pdf";

    return {
      buffer:
        Buffer.from(
          bytes,
        ),

      filename,

      mimeType:
        PDF_MIME_TYPE,

      pageCount:
        totalPages,

      exportedOrders:
        orders.length,

      truncated:
        data.metadata.truncated ||
        data.orders.length >
          orders.length,
    };
  } catch (error) {
    if (
      error instanceof
      CreateOrdersPdfError
    ) {
      throw error;
    }

    console.error(
      "[CREATE_ORDERS_PDF_ERROR]",
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

    throw new CreateOrdersPdfError({
      code:
        "CREATE_ORDERS_PDF_FAILED",
      status:
        500,
      message:
        "Impossible de créer le rapport PDF des commandes pour le moment.",
    });
  }
}