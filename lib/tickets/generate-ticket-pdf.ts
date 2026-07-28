import "server-only";

import {
  createHash,
} from "node:crypto";
import {
  readFile,
} from "node:fs/promises";
import {
  join,
} from "node:path";

import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  TicketStatus,
} from "@prisma/client";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import * as QRCode from "qrcode";

import {
  PaymentError,
  PaymentValidationError,
} from "@/lib/payments/payment-errors";
import { prisma } from "@/lib/prisma";

type DatabaseClient =
  | Prisma.TransactionClient
  | typeof prisma;

export type GenerateTicketPdfOptions = {
  ticketId: string;

  transaction?: Prisma.TransactionClient;

  logoPath?: string;

  generatedAt?: Date;
};

export type GeneratedTicketPdf = {
  ticketId: string;
  ticketCode: string;

  fileName: string;
  mimeType: "application/pdf";

  bytes: Uint8Array;
  buffer: Buffer;

  fileSize: number;
  checksum: string;

  metadata: {
    orderId: string;
    orderReference: string;

    eventId: string;
    eventTitle: string;

    ticketTypeId: string;
    ticketCategory: string;

    unitPrice: string;
    platformFeePerTicket: string;
    totalPerTicket: string;
    currency: string;

    holderName: string;
    holderEmail: string;

    qrVersion: number;
    generatedAt: string;
  };
};

export type GenerateOrderTicketPdfsOptions = {
  orderId: string;

  transaction?: Prisma.TransactionClient;

  logoPath?: string;

  generatedAt?: Date;
};

export type GeneratedOrderTicketPdfs = {
  orderId: string;
  orderReference: string;

  tickets: GeneratedTicketPdf[];

  generatedCount: number;
};

type TicketPdfData = {
  id: string;
  code: string;

  qrCodeValue: string;
  qrVersion: number;

  status: TicketStatus;

  holderName: string;
  holderEmail: string;
  holderPhone: string | null;

  issuedAt: Date;

  order: {
    id: string;
    reference: string;
    status: OrderStatus;
    currency: string;

    customerName: string;
    customerEmail: string;

    payment: {
      status: PaymentStatus;
    } | null;
  };

  event: {
    id: string;
    title: string;
    slug: string;

    venueName: string;
    address: string;
    city: string;
    country: string;

    startsAt: Date;
    endsAt: Date | null;
  };

  ticketType: {
    id: string;
    name: string;
    description: string | null;
  };

  orderItem: {
    id: string;
    quantity: number;

    unitPrice: Prisma.Decimal;
    platformFee: Prisma.Decimal;
    total: Prisma.Decimal;
  };
};

const A4_WIDTH =
  595.28;

const A4_HEIGHT =
  841.89;

const PAGE_MARGIN =
  36;

const QR_SIZE =
  180;

const BRAND_GREEN =
  rgb(
    0.20,
    0.78,
    0.45,
  );

const BRAND_LIME =
  rgb(
    0.64,
    0.90,
    0.20,
  );

const BRAND_ORANGE =
  rgb(
    0.98,
    0.55,
    0.12,
  );

const COLOR_DARK =
  rgb(
    0.02,
    0.04,
    0.05,
  );

const COLOR_PANEL =
  rgb(
    0.04,
    0.08,
    0.10,
  );

const COLOR_PANEL_ALT =
  rgb(
    0.07,
    0.11,
    0.13,
  );

const COLOR_WHITE =
  rgb(
    1,
    1,
    1,
  );

const COLOR_MUTED =
  rgb(
    0.68,
    0.72,
    0.74,
  );

const COLOR_LINE =
  rgb(
    0.16,
    0.21,
    0.23,
  );

function normalizeText(
  value:
    | string
    | null
    | undefined,
): string {
  return value
    ?.replace(
      /\s+/g,
      " ",
    )
    .trim() ?? "";
}

function normalizeIdentifier({
  value,
  field,
}: {
  value: string;
  field: string;
}): string {
  const normalized =
    normalizeText(
      value,
    );

  if (!normalized) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        `${field} est obligatoire.`,

      status:
        400,

      details: {
        field,
      },
    });
  }

  return normalized;
}

function decimalToFixed(
  value: Prisma.Decimal,
): string {
  return value
    .toDecimalPlaces(
      2,
      Prisma.Decimal
        .ROUND_HALF_UP,
    )
    .toFixed(
      2,
    );
}

function divideAmount({
  amount,
  quantity,
}: {
  amount: Prisma.Decimal;
  quantity: number;
}): Prisma.Decimal {
  if (
    !Number.isInteger(
      quantity,
    ) ||
    quantity <=
      0
  ) {
    return new Prisma.Decimal(
      0,
    );
  }

  return amount
    .div(
      quantity,
    )
    .toDecimalPlaces(
      2,
      Prisma.Decimal
        .ROUND_HALF_UP,
    );
}

function formatMoney({
  amount,
  currency,
}: {
  amount: string;
  currency: string;
}): string {
  const numericAmount =
    Number.parseFloat(
      amount,
    );

  const normalizedCurrency =
    normalizeText(
      currency,
    ).toUpperCase() ||
    "XOF";

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style:
          "currency",

        currency:
          normalizedCurrency,

        maximumFractionDigits:
          normalizedCurrency ===
          "XOF"
            ? 0
            : 2,
      },
    ).format(
      Number.isFinite(
        numericAmount,
      )
        ? numericAmount
        : 0,
    );
  } catch {
    return `${amount} ${normalizedCurrency}`;
  }
}

function formatDateTime(
  value: Date,
): string {
  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      weekday:
        "long",

      day:
        "2-digit",

      month:
        "long",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",
    },
  ).format(
    value,
  );
}

function sanitizePdfText(
  value:
    | string
    | null
    | undefined,
): string {
  return normalizeText(
    value,
  )
    .replace(
      /[\u2010-\u2015]/g,
      "-",
    )
    .replace(
      /\u00A0/g,
      " ",
    );
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
  const normalized =
    sanitizePdfText(
      text,
    );

  if (
    font.widthOfTextAtSize(
      normalized,
      size,
    ) <=
    maxWidth
  ) {
    return normalized;
  }

  const suffix =
    "...";

  let candidate =
    normalized;

  while (
    candidate.length >
      0 &&
    font.widthOfTextAtSize(
      `${candidate}${suffix}`,
      size,
    ) >
      maxWidth
  ) {
    candidate =
      candidate.slice(
        0,
        -1,
      );
  }

  return `${candidate}${suffix}`;
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
  const words =
    sanitizePdfText(
      text,
    )
      .split(
        " ",
      )
      .filter(
        Boolean,
      );

  if (
    words.length ===
      0
  ) {
    return [
      "",
    ];
  }

  const lines:
    string[] =
    [];

  let currentLine =
    "";

  for (
    const word of
    words
  ) {
    const candidate =
      currentLine
        ? `${currentLine} ${word}`
        : word;

    if (
      font.widthOfTextAtSize(
        candidate,
        size,
      ) <=
      maxWidth
    ) {
      currentLine =
        candidate;

      continue;
    }

    if (
      currentLine
    ) {
      lines.push(
        currentLine,
      );
    }

    currentLine =
      word;
  }

  if (
    currentLine
  ) {
    lines.push(
      currentLine,
    );
  }

  return lines;
}

function drawWrappedText({
  page,
  text,
  font,
  size,
  x,
  y,
  maxWidth,
  lineHeight,
  color = COLOR_WHITE,
  maxLines,
}: {
  page: PDFPage;
  text: string;
  font: PDFFont;
  size: number;
  x: number;
  y: number;
  maxWidth: number;
  lineHeight: number;
  color?: ReturnType<
    typeof rgb
  >;
  maxLines?: number;
}): number {
  const allLines =
    wrapText({
      text,
      font,
      size,
      maxWidth,
    });

  const lines =
    maxLines
      ? allLines.slice(
          0,
          maxLines,
        )
      : allLines;

  lines.forEach(
    (
      line,
      index,
    ) => {
      const isLastVisibleLine =
        maxLines !==
          undefined &&
        index ===
          lines.length -
            1 &&
        allLines.length >
          lines.length;

      page.drawText(
        isLastVisibleLine
          ? truncateText({
              text:
                line,
              font,
              size,
              maxWidth,
            })
          : line,
        {
          x,
          y:
            y -
            index *
              lineHeight,

          size,
          font,
          color,
        },
      );
    },
  );

  return (
    y -
    lines.length *
      lineHeight
  );
}

function drawLabelValue({
  page,
  label,
  value,
  x,
  y,
  width,
  regularFont,
  boldFont,
}: {
  page: PDFPage;
  label: string;
  value: string;
  x: number;
  y: number;
  width: number;
  regularFont: PDFFont;
  boldFont: PDFFont;
}): void {
  page.drawText(
    sanitizePdfText(
      label,
    ).toUpperCase(),
    {
      x,
      y,

      size:
        7.5,

      font:
        boldFont,

      color:
        COLOR_MUTED,
    },
  );

  page.drawText(
    truncateText({
      text:
        value,

      font:
        regularFont,

      size:
        10.5,

      maxWidth:
        width,
    }),
    {
      x,
      y:
        y -
        15,

      size:
        10.5,

      font:
        regularFont,

      color:
        COLOR_WHITE,
    },
  );
}

async function generateQrPng(
  qrValue: string,
): Promise<Buffer> {
  try {
    return await QRCode.toBuffer(
      qrValue,
      {
        type:
          "png",

        width:
          720,

        margin:
          3,

        errorCorrectionLevel:
          "M",

        color: {
          dark:
            "#000000",

          light:
            "#FFFFFF",
        },
      },
    );
  } catch (
    error
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Impossible de générer l’image QR du billet.",

      status:
        500,

      retryable:
        true,

      exposeMessage:
        false,

      cause:
        error,
    });
  }
}

async function loadOptionalLogo(
  pdfDocument:
    PDFDocument,
  logoPath:
    string | undefined,
): Promise<PDFImage | null> {
  const candidatePath =
    normalizeText(
      logoPath,
    ) ||
    join(
      process.cwd(),
      "public",
      "logo.png",
    );

  try {
    const file =
      await readFile(
        candidatePath,
      );

    if (
      candidatePath
        .toLowerCase()
        .endsWith(
          ".jpg",
        ) ||
      candidatePath
        .toLowerCase()
        .endsWith(
          ".jpeg",
        )
    ) {
      return await pdfDocument
        .embedJpg(
          file,
        );
    }

    return await pdfDocument
      .embedPng(
        file,
      );
  } catch {
    return null;
  }
}

function assertTicketCanBeRendered(
  ticket:
    TicketPdfData,
): void {
  if (
    ticket.order.status !==
      OrderStatus.PAID ||
    ticket.order.payment
      ?.status !==
      PaymentStatus.SUCCESS
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_ORDER_NOT_PAYABLE",

      message:
        "Le PDF du billet ne peut être généré qu’après confirmation du paiement.",

      status:
        409,

      orderId:
        ticket.order.id,
    });
  }

  if (
    ticket.status ===
      TicketStatus.CANCELLED ||
    ticket.status ===
      TicketStatus.REFUNDED ||
    ticket.status ===
      TicketStatus.REVOKED
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_ORDER_NOT_PAYABLE",

      message:
        "Ce billet ne peut plus être généré.",

      status:
        409,

      orderId:
        ticket.order.id,

      details: {
        ticketId:
          ticket.id,

        ticketStatus:
          ticket.status,
      },
    });
  }

  if (
    !normalizeText(
      ticket.qrCodeValue,
    )
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Le billet ne possède pas de QR code.",

      status:
        500,

      retryable:
        false,

      exposeMessage:
        false,

      orderId:
        ticket.order.id,
    });
  }
}

async function getTicketPdfData({
  database,
  ticketId,
}: {
  database: DatabaseClient;
  ticketId: string;
}): Promise<TicketPdfData> {
  const ticket =
    await database
      .ticket
      .findUnique({
        where: {
          id:
            ticketId,
        },

        select: {
          id:
            true,

          code:
            true,

          qrCodeValue:
            true,

          qrVersion:
            true,

          status:
            true,

          holderName:
            true,

          holderEmail:
            true,

          holderPhone:
            true,

          issuedAt:
            true,

          order: {
            select: {
              id:
                true,

              reference:
                true,

              status:
                true,

              currency:
                true,

              customerName:
                true,

              customerEmail:
                true,

              payment: {
                select: {
                  status:
                    true,
                },
              },
            },
          },

          event: {
            select: {
              id:
                true,

              title:
                true,

              slug:
                true,

              venueName:
                true,

              address:
                true,

              city:
                true,

              country:
                true,

              startsAt:
                true,

              endsAt:
                true,
            },
          },

          ticketType: {
            select: {
              id:
                true,

              name:
                true,

              description:
                true,
            },
          },

          orderItem: {
            select: {
              id:
                true,

              quantity:
                true,

              unitPrice:
                true,

              platformFee:
                true,

              total:
                true,
            },
          },
        },
      });

  if (
    !ticket
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_ORDER_NOT_FOUND",

      message:
        "Le billet est introuvable.",

      status:
        404,

      details: {
        ticketId,
      },
    });
  }

  assertTicketCanBeRendered(
    ticket,
  );

  return ticket;
}

async function buildTicketPdf({
  ticket,
  logoPath,
  generatedAt,
}: {
  ticket: TicketPdfData;
  logoPath?: string;
  generatedAt: Date;
}): Promise<GeneratedTicketPdf> {
  const pdfDocument =
    await PDFDocument.create();

  pdfDocument.setTitle(
    `Billet Tikemia - ${ticket.code}`,
  );

  pdfDocument.setAuthor(
    "Tikemia",
  );

  pdfDocument.setSubject(
    `${ticket.event.title} - ${ticket.ticketType.name}`,
  );

  pdfDocument.setKeywords([
    "Tikemia",
    "billet",
    "ticket",
    ticket.event.title,
    ticket.ticketType.name,
    ticket.code,
  ]);

  pdfDocument.setCreator(
    "Tikemia",
  );

  pdfDocument.setProducer(
    "Tikemia Ticketing Platform",
  );

  pdfDocument.setCreationDate(
    generatedAt,
  );

  pdfDocument.setModificationDate(
    generatedAt,
  );

  const regularFont =
    await pdfDocument.embedFont(
      StandardFonts.Helvetica,
    );

  const boldFont =
    await pdfDocument.embedFont(
      StandardFonts.HelveticaBold,
    );

  const logo =
    await loadOptionalLogo(
      pdfDocument,
      logoPath,
    );

  const qrPng =
    await generateQrPng(
      ticket.qrCodeValue,
    );

  const qrImage =
    await pdfDocument.embedPng(
      qrPng,
    );

  const page =
    pdfDocument.addPage([
      A4_WIDTH,
      A4_HEIGHT,
    ]);

  page.drawRectangle({
    x:
      0,

    y:
      0,

    width:
      A4_WIDTH,

    height:
      A4_HEIGHT,

    color:
      COLOR_DARK,
  });

  page.drawRectangle({
    x:
      0,

    y:
      A4_HEIGHT -
      12,

    width:
      A4_WIDTH /
      3,

    height:
      12,

    color:
      BRAND_GREEN,
  });

  page.drawRectangle({
    x:
      A4_WIDTH /
      3,

    y:
      A4_HEIGHT -
      12,

    width:
      A4_WIDTH /
      3,

    height:
      12,

    color:
      BRAND_LIME,
  });

  page.drawRectangle({
    x:
      (
        A4_WIDTH /
        3
      ) *
      2,

    y:
      A4_HEIGHT -
      12,

    width:
      A4_WIDTH /
      3,

    height:
      12,

    color:
      BRAND_ORANGE,
  });

  const headerTop =
    A4_HEIGHT -
    42;

  if (
    logo
  ) {
    const dimensions =
      logo.scale(
        1,
      );

    const maxWidth =
      125;

    const maxHeight =
      42;

    const scale =
      Math.min(
        maxWidth /
          dimensions.width,

        maxHeight /
          dimensions.height,
      );

    page.drawImage(
      logo,
      {
        x:
          PAGE_MARGIN,

        y:
          headerTop -
          dimensions.height *
          scale,

        width:
          dimensions.width *
          scale,

        height:
          dimensions.height *
          scale,
      },
    );
  } else {
    page.drawText(
      "TIKEMIA",
      {
        x:
          PAGE_MARGIN,

        y:
          headerTop -
          23,

        size:
          24,

        font:
          boldFont,

        color:
          BRAND_LIME,
      },
    );
  }

  page.drawText(
    "BILLET OFFICIEL",
    {
      x:
        A4_WIDTH -
        PAGE_MARGIN -
        118,

      y:
        headerTop -
        10,

      size:
        8,

      font:
        boldFont,

      color:
        COLOR_MUTED,
    },
  );

  page.drawText(
    ticket.code,
    {
      x:
        A4_WIDTH -
        PAGE_MARGIN -
        190,

      y:
        headerTop -
        30,

      size:
        13,

      font:
        boldFont,

      color:
        COLOR_WHITE,
    },
  );

  const eventPanelY =
    560;

  page.drawRectangle({
    x:
      PAGE_MARGIN,

    y:
      eventPanelY,

    width:
      A4_WIDTH -
      PAGE_MARGIN *
      2,

    height:
      190,

    color:
      COLOR_PANEL,

    borderColor:
      COLOR_LINE,

    borderWidth:
      1,
  });

  page.drawText(
    "EVENEMENT",
    {
      x:
        PAGE_MARGIN +
        20,

      y:
        eventPanelY +
        160,

      size:
        8,

      font:
        boldFont,

      color:
        BRAND_LIME,
    },
  );

  drawWrappedText({
    page,

    text:
      ticket.event.title,

    font:
      boldFont,

    size:
      22,

    x:
      PAGE_MARGIN +
      20,

    y:
      eventPanelY +
      135,

    maxWidth:
      A4_WIDTH -
      PAGE_MARGIN *
      2 -
      40,

    lineHeight:
      25,

    maxLines:
      2,
  });

  drawLabelValue({
    page,

    label:
      "Date",

    value:
      formatDateTime(
        ticket.event
          .startsAt,
      ),

    x:
      PAGE_MARGIN +
      20,

    y:
      eventPanelY +
      75,

    width:
      235,

    regularFont,

    boldFont,
  });

  drawLabelValue({
    page,

    label:
      "Lieu",

    value:
      [
        ticket.event
          .venueName,
        ticket.event.city,
        ticket.event.country,
      ]
        .filter(
          Boolean,
        )
        .join(
          ", ",
        ),

    x:
      PAGE_MARGIN +
      290,

    y:
      eventPanelY +
      75,

    width:
      220,

    regularFont,

    boldFont,
  });

  drawLabelValue({
    page,

    label:
      "Adresse",

    value:
      ticket.event.address,

    x:
      PAGE_MARGIN +
      20,

    y:
      eventPanelY +
      30,

    width:
      A4_WIDTH -
      PAGE_MARGIN *
      2 -
      40,

    regularFont,

    boldFont,
  });

  const detailsPanelY =
    330;

  page.drawRectangle({
    x:
      PAGE_MARGIN,

    y:
      detailsPanelY,

    width:
      A4_WIDTH -
      PAGE_MARGIN *
      2,

    height:
      205,

    color:
      COLOR_PANEL_ALT,

    borderColor:
      COLOR_LINE,

    borderWidth:
      1,
  });

  const leftColumnX =
    PAGE_MARGIN +
    20;

  const rightColumnX =
    PAGE_MARGIN +
    300;

  page.drawText(
    "INFORMATIONS DU BILLET",
    {
      x:
        leftColumnX,

      y:
        detailsPanelY +
        175,

      size:
        8,

      font:
        boldFont,

      color:
        BRAND_LIME,
    },
  );

  drawLabelValue({
    page,

    label:
      "Categorie",

    value:
      ticket.ticketType
        .name,

    x:
      leftColumnX,

    y:
      detailsPanelY +
      145,

    width:
      245,

    regularFont,

    boldFont,
  });

  drawLabelValue({
    page,

    label:
      "Titulaire",

    value:
      ticket.holderName,

    x:
      leftColumnX,

    y:
      detailsPanelY +
      100,

    width:
      245,

    regularFont,

    boldFont,
  });

  drawLabelValue({
    page,

    label:
      "Email",

    value:
      ticket.holderEmail,

    x:
      leftColumnX,

    y:
      detailsPanelY +
      55,

    width:
      245,

    regularFont,

    boldFont,
  });

  page.drawText(
    "TARIFICATION",
    {
      x:
        rightColumnX,

      y:
        detailsPanelY +
        175,

      size:
        8,

      font:
        boldFont,

      color:
        BRAND_ORANGE,
    },
  );

  const feePerTicket =
    divideAmount({
      amount:
        ticket.orderItem
          .platformFee,

      quantity:
        ticket.orderItem
          .quantity,
    });

  const totalPerTicket =
    divideAmount({
      amount:
        ticket.orderItem
          .total,

      quantity:
        ticket.orderItem
          .quantity,
    });

  const unitPrice =
    decimalToFixed(
      ticket.orderItem
        .unitPrice,
    );

  const fee =
    decimalToFixed(
      feePerTicket,
    );

  const total =
    decimalToFixed(
      totalPerTicket,
    );

  drawLabelValue({
    page,

    label:
      "Prix du billet",

    value:
      formatMoney({
        amount:
          unitPrice,

        currency:
          ticket.order
            .currency,
      }),

    x:
      rightColumnX,

    y:
      detailsPanelY +
      145,

    width:
      220,

    regularFont,

    boldFont,
  });

  drawLabelValue({
    page,

    label:
      "Frais par billet",

    value:
      formatMoney({
        amount:
          fee,

        currency:
          ticket.order
            .currency,
      }),

    x:
      rightColumnX,

    y:
      detailsPanelY +
      100,

    width:
      220,

    regularFont,

    boldFont,
  });

  page.drawText(
    "TOTAL",
    {
      x:
        rightColumnX,

      y:
        detailsPanelY +
        50,

      size:
        8,

      font:
        boldFont,

      color:
        COLOR_MUTED,
    },
  );

  page.drawText(
    formatMoney({
      amount:
        total,

      currency:
        ticket.order
          .currency,
    }),
    {
      x:
        rightColumnX,

      y:
        detailsPanelY +
        22,

      size:
        18,

      font:
        boldFont,

      color:
        BRAND_LIME,
    },
  );

  const qrPanelY =
    70;

  page.drawRectangle({
    x:
      PAGE_MARGIN,

    y:
      qrPanelY,

    width:
      A4_WIDTH -
      PAGE_MARGIN *
      2,

    height:
      230,

    color:
      COLOR_PANEL,

    borderColor:
      COLOR_LINE,

    borderWidth:
      1,
  });

  page.drawImage(
    qrImage,
    {
      x:
        PAGE_MARGIN +
        22,

      y:
        qrPanelY +
        24,

      width:
        QR_SIZE,

      height:
        QR_SIZE,
    },
  );

  const qrTextX =
    PAGE_MARGIN +
    QR_SIZE +
    50;

  page.drawText(
    "CONTROLE D'ACCES",
    {
      x:
        qrTextX,

      y:
        qrPanelY +
        190,

      size:
        8,

      font:
        boldFont,

      color:
        BRAND_LIME,
    },
  );

  drawWrappedText({
    page,

    text:
      "Présentez ce QR code à l'entrée. Il contient une signature Tikemia vérifiable et les références du billet, de l'événement, de la catégorie et du prix.",

    font:
      regularFont,

    size:
      10,

    x:
      qrTextX,

    y:
      qrPanelY +
      165,

    maxWidth:
      295,

    lineHeight:
      14,

    color:
      COLOR_MUTED,

    maxLines:
      5,
  });

  drawLabelValue({
    page,

    label:
      "Reference de commande",

    value:
      ticket.order
        .reference,

    x:
      qrTextX,

    y:
      qrPanelY +
      86,

    width:
      295,

    regularFont,

    boldFont,
  });

  drawLabelValue({
    page,

    label:
      "Version QR",

    value:
      String(
        ticket.qrVersion,
      ),

    x:
      qrTextX,

    y:
      qrPanelY +
      42,

    width:
      295,

    regularFont,

    boldFont,
  });

  page.drawText(
    "Ce billet est personnel. Toute duplication ou modification peut entraîner son refus au contrôle.",
    {
      x:
        PAGE_MARGIN,

      y:
        40,

      size:
        7.5,

      font:
        regularFont,

      color:
        COLOR_MUTED,
    },
  );

  const bytes =
    await pdfDocument.save({
      useObjectStreams:
        true,

      addDefaultPage:
        false,

      objectsPerTick:
        50,
    });

  const buffer =
    Buffer.from(
      bytes,
    );

  const checksum =
    createHash(
      "sha256",
    )
      .update(
        buffer,
      )
      .digest(
        "hex",
      );

  return {
    ticketId:
      ticket.id,

    ticketCode:
      ticket.code,

    fileName:
      `${ticket.code}.pdf`,

    mimeType:
      "application/pdf",

    bytes,

    buffer,

    fileSize:
      buffer.byteLength,

    checksum,

    metadata: {
      orderId:
        ticket.order.id,

      orderReference:
        ticket.order
          .reference,

      eventId:
        ticket.event.id,

      eventTitle:
        ticket.event.title,

      ticketTypeId:
        ticket.ticketType.id,

      ticketCategory:
        ticket.ticketType
          .name,

      unitPrice,

      platformFeePerTicket:
        fee,

      totalPerTicket:
        total,

      currency:
        ticket.order.currency,

      holderName:
        ticket.holderName,

      holderEmail:
        ticket.holderEmail,

      qrVersion:
        ticket.qrVersion,

      generatedAt:
        generatedAt.toISOString(),
    },
  };
}

export async function generateTicketPdf({
  ticketId: rawTicketId,
  transaction,
  logoPath,
  generatedAt = new Date(),
}: GenerateTicketPdfOptions): Promise<
  GeneratedTicketPdf
> {
  const ticketId =
    normalizeIdentifier({
      value:
        rawTicketId,

      field:
        "ticketId",
    });

  const database:
    DatabaseClient =
    transaction ??
    prisma;

  const ticket =
    await getTicketPdfData({
      database,
      ticketId,
    });

  return buildTicketPdf({
    ticket,
    logoPath,
    generatedAt,
  });
}

export async function generateOrderTicketPdfs({
  orderId: rawOrderId,
  transaction,
  logoPath,
  generatedAt = new Date(),
}: GenerateOrderTicketPdfsOptions): Promise<
  GeneratedOrderTicketPdfs
> {
  const orderId =
    normalizeIdentifier({
      value:
        rawOrderId,

      field:
        "orderId",
    });

  const database:
    DatabaseClient =
    transaction ??
    prisma;

  const order =
    await database
      .order
      .findUnique({
        where: {
          id:
            orderId,
        },

        select: {
          id:
            true,

          reference:
            true,

          status:
            true,

          payment: {
            select: {
              status:
                true,
            },
          },

          items: {
            select: {
              quantity:
                true,

              tickets: {
                select: {
                  id:
                    true,
                },
              },
            },
          },
        },
      });

  if (
    !order
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_ORDER_NOT_FOUND",

      message:
        "La commande est introuvable.",

      status:
        404,

      orderId,
    });
  }

  if (
    order.status !==
      OrderStatus.PAID ||
    order.payment?.status !==
      PaymentStatus.SUCCESS
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_ORDER_NOT_PAYABLE",

      message:
        "Les PDF ne peuvent être générés qu’après confirmation du paiement.",

      status:
        409,

      orderId:
        order.id,
    });
  }

  const expectedTickets =
    order.items.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.quantity,
      0,
    );

  const ticketIds =
    order.items.flatMap(
      (
        item,
      ) =>
        item.tickets.map(
          (
            ticket,
          ) =>
            ticket.id,
        ),
    );

  if (
    ticketIds.length !==
    expectedTickets
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Tous les billets de la commande ne sont pas encore disponibles.",

      status:
        409,

      retryable:
        true,

      exposeMessage:
        false,

      orderId:
        order.id,

      details: {
        expectedTickets,

        availableTickets:
          ticketIds.length,
      },
    });
  }

  const tickets:
    GeneratedTicketPdf[] =
    [];

  for (
    const ticketId of
    ticketIds
  ) {
    tickets.push(
      await generateTicketPdf({
        ticketId,

        transaction,

        logoPath,

        generatedAt,
      }),
    );
  }

  return {
    orderId:
      order.id,

    orderReference:
      order.reference,

    tickets,

    generatedCount:
      tickets.length,
  };
}