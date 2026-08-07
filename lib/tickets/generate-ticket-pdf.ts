import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

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
  type RGB,
} from "pdf-lib";
import * as QRCode from "qrcode";

import {
  PaymentError,
  PaymentValidationError,
} from "@/lib/payments/payment-errors";
import { prisma } from "@/lib/prisma";
import {
  verifyTicketQrValue,
} from "@/lib/tickets/generate-order-tickets";

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
    coverImage: string | null;

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

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

const PAGE_MARGIN = 36;
const QR_SIZE = 180;

const BRAND_GREEN = rgb(
  0.2,
  0.78,
  0.45,
);

const BRAND_LIME = rgb(
  0.64,
  0.9,
  0.2,
);

const BRAND_ORANGE = rgb(
  0.98,
  0.55,
  0.12,
);

const COLOR_DARK = rgb(
  0.02,
  0.04,
  0.05,
);

const COLOR_PANEL = rgb(
  0.04,
  0.08,
  0.1,
);

const COLOR_PANEL_ALT = rgb(
  0.07,
  0.11,
  0.13,
);

const COLOR_WHITE = rgb(
  1,
  1,
  1,
);

const COLOR_MUTED = rgb(
  0.68,
  0.72,
  0.74,
);

const COLOR_LINE = rgb(
  0.16,
  0.21,
  0.23,
);

function normalizeText(
  value: string | null | undefined,
): string {
  return (
    value
      ?.replace(/\s+/g, " ")
      .trim() ?? ""
  );
}

function normalizeIdentifier({
  value,
  field,
}: {
  value: string;
  field: string;
}): string {
  const normalized =
    normalizeText(value);

  if (!normalized) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        `${field} est obligatoire.`,

      status: 400,

      details: {
        field,
      },
    });
  }

  return normalized;
}

function validateGeneratedAt(
  value: Date,
): Date {
  if (
    !(value instanceof Date) ||
    Number.isNaN(value.getTime())
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_INVALID_REQUEST",

      message:
        "La date de génération du PDF est invalide.",

      status: 400,
    });
  }

  return value;
}

function decimalToFixed(
  value: Prisma.Decimal,
): string {
  return value
    .toDecimalPlaces(
      2,
      Prisma.Decimal.ROUND_HALF_UP,
    )
    .toFixed(2);
}

function divideAmount({
  amount,
  quantity,
  orderId,
  orderItemId,
}: {
  amount: Prisma.Decimal;
  quantity: number;
  orderId: string;
  orderItemId: string;
}): Prisma.Decimal {
  if (
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "La quantité de billets est invalide.",

      status: 500,

      retryable: false,

      exposeMessage: false,

      orderId,

      details: {
        orderItemId,
        quantity,
      },
    });
  }

  return amount
    .div(quantity)
    .toDecimalPlaces(
      2,
      Prisma.Decimal.ROUND_HALF_UP,
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
    Number.parseFloat(amount);

  const normalizedCurrency =
    normalizeText(currency)
      .toUpperCase() || "XOF";

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",

        currency:
          normalizedCurrency,

        minimumFractionDigits:
          normalizedCurrency === "XOF"
            ? 0
            : 2,

        maximumFractionDigits:
          normalizedCurrency === "XOF"
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
  if (
    Number.isNaN(value.getTime())
  ) {
    return "Date indisponible";
  }

  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(value);
}

/**
 * Les polices standard PDF utilisent un encodage limité.
 * Cette normalisation empêche les erreurs d'encodage avec certains
 * caractères copiés depuis un formulaire ou une source externe.
 */
function sanitizePdfText(
  value: string | null | undefined,
): string {
  return normalizeText(value)
    .normalize("NFC")
    .replace(
      /[\u2010-\u2015]/g,
      "-",
    )
    .replace(
      /[\u2018\u2019]/g,
      "'",
    )
    .replace(
      /[\u201C\u201D]/g,
      '"',
    )
    .replace(
      /\u2026/g,
      "...",
    )
    .replace(
      /\u00A0/g,
      " ",
    )
    .replace(
      /[^\u0020-\u007E\u00A0-\u00FF]/g,
      "",
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
    sanitizePdfText(text);

  if (
    font.widthOfTextAtSize(
      normalized,
      size,
    ) <= maxWidth
  ) {
    return normalized;
  }

  const suffix = "...";

  let candidate =
    normalized;

  while (
    candidate.length > 0 &&
    font.widthOfTextAtSize(
      `${candidate}${suffix}`,
      size,
    ) > maxWidth
  ) {
    candidate =
      candidate.slice(0, -1);
  }

  return `${candidate}${suffix}`;
}

function splitLongWord({
  word,
  font,
  size,
  maxWidth,
}: {
  word: string;
  font: PDFFont;
  size: number;
  maxWidth: number;
}): string[] {
  if (
    font.widthOfTextAtSize(
      word,
      size,
    ) <= maxWidth
  ) {
    return [word];
  }

  const segments: string[] = [];
  let current = "";

  for (const character of word) {
    const candidate =
      `${current}${character}`;

    if (
      current &&
      font.widthOfTextAtSize(
        candidate,
        size,
      ) > maxWidth
    ) {
      segments.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }

  if (current) {
    segments.push(current);
  }

  return segments;
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
  const rawWords =
    sanitizePdfText(text)
      .split(" ")
      .filter(Boolean);

  if (rawWords.length === 0) {
    return [""];
  }

  const words =
    rawWords.flatMap((word) =>
      splitLongWord({
        word,
        font,
        size,
        maxWidth,
      }),
    );

  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate =
      currentLine
        ? `${currentLine} ${word}`
        : word;

    if (
      font.widthOfTextAtSize(
        candidate,
        size,
      ) <= maxWidth
    ) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
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
  color?: RGB;
  maxLines?: number;
}): number {
  const allLines =
    wrapText({
      text,
      font,
      size,
      maxWidth,
    });

  const visibleLines =
    maxLines === undefined
      ? allLines
      : allLines.slice(
          0,
          maxLines,
        );

  visibleLines.forEach(
    (line, index) => {
      const mustTruncate =
        maxLines !== undefined &&
        index ===
          visibleLines.length - 1 &&
        allLines.length >
          visibleLines.length;

      page.drawText(
        mustTruncate
          ? truncateText({
              text: line,
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
    visibleLines.length *
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
      size: 7.5,
      font: boldFont,
      color: COLOR_MUTED,
    },
  );

  page.drawText(
    truncateText({
      text:
        value || "Non renseigné",

      font:
        regularFont,

      size: 10.5,
      maxWidth: width,
    }),
    {
      x,
      y: y - 15,
      size: 10.5,
      font: regularFont,
      color: COLOR_WHITE,
    },
  );
}

async function generateQrPng(
  qrValue: string,
): Promise<Buffer> {
  const normalizedQrValue =
    normalizeText(qrValue);

  if (!normalizedQrValue) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Le QR code du billet est vide.",

      status: 500,

      retryable: false,

      exposeMessage: false,
    });
  }

  try {
    const qrBuffer =
      await QRCode.toBuffer(
        normalizedQrValue,
        {
          type: "png",
          width: 720,
          margin: 3,

          errorCorrectionLevel:
            "M",

          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        },
      );

    if (
      !qrBuffer ||
      qrBuffer.byteLength === 0
    ) {
      throw new Error(
        "Le fichier QR généré est vide.",
      );
    }

    return qrBuffer;
  } catch (error) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Impossible de générer l’image QR du billet.",

      status: 500,

      retryable: true,

      exposeMessage: false,

      cause: error,
    });
  }
}

async function loadOptionalLogo(
  pdfDocument: PDFDocument,
  logoPath: string | undefined,
): Promise<PDFImage | null> {
  const candidatePath =
    normalizeText(logoPath) ||
    join(
      process.cwd(),
      "public",
      "logo.png",
    );

  try {
    const file =
      await readFile(candidatePath);

    if (file.byteLength === 0) {
      return null;
    }

    const extension =
      extname(candidatePath)
        .toLowerCase();

    if (
      extension === ".jpg" ||
      extension === ".jpeg"
    ) {
      return await pdfDocument.embedJpg(
        file,
      );
    }

    if (extension === ".png") {
      return await pdfDocument.embedPng(
        file,
      );
    }

    return null;
  } catch {
    return null;
  }
}


const MAX_EVENT_IMAGE_BYTES =
  8 * 1024 * 1024;

const EVENT_IMAGE_TIMEOUT_MS =
  8_000;

function isHttpUrl(
  value: string,
): boolean {
  return (
    value.startsWith(
      "https://",
    ) ||
    value.startsWith(
      "http://",
    )
  );
}

function resolveLocalPublicImagePath(
  value: string,
): string | null {
  const normalized =
    normalizeText(
      value,
    );

  if (
    !normalized ||
    isHttpUrl(
      normalized,
    )
  ) {
    return null;
  }

  const relativePath =
    normalized
      .replace(
        /^\/+/,
        "",
      )
      .replace(
        /\\/g,
        "/",
      );

  if (
    !relativePath ||
    relativePath.includes(
      "..",
    )
  ) {
    return null;
  }

  return join(
    process.cwd(),
    "public",
    relativePath,
  );
}

function detectImageFormat({
  contentType,
  source,
  bytes,
}: {
  contentType: string;
  source: string;
  bytes: Uint8Array;
}): "png" | "jpg" | null {
  const normalizedContentType =
    contentType
      .split(
        ";",
      )[0]
      ?.trim()
      .toLowerCase() ?? "";

  if (
    normalizedContentType ===
    "image/png"
  ) {
    return "png";
  }

  if (
    normalizedContentType ===
      "image/jpeg" ||
    normalizedContentType ===
      "image/jpg"
  ) {
    return "jpg";
  }

  const extension =
    extname(
      source,
    )
      .toLowerCase();

  if (
    extension ===
    ".png"
  ) {
    return "png";
  }

  if (
    extension ===
      ".jpg" ||
    extension ===
      ".jpeg"
  ) {
    return "jpg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "jpg";
  }

  return null;
}

async function readEventImageBytes(
  source: string,
): Promise<{
  bytes: Uint8Array;
  contentType: string;
} | null> {
  const normalizedSource =
    normalizeText(
      source,
    );

  if (!normalizedSource) {
    return null;
  }

  if (
    isHttpUrl(
      normalizedSource,
    )
  ) {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        EVENT_IMAGE_TIMEOUT_MS,
      );

    try {
      const response =
        await fetch(
          normalizedSource,
          {
            signal:
              controller.signal,

            cache:
              "no-store",

            headers: {
              Accept:
                "image/png,image/jpeg",
            },
          },
        );

      if (!response.ok) {
        return null;
      }

      const declaredLength =
        Number(
          response.headers.get(
            "content-length",
          ),
        );

      if (
        Number.isFinite(
          declaredLength,
        ) &&
        declaredLength >
          MAX_EVENT_IMAGE_BYTES
      ) {
        return null;
      }

      const arrayBuffer =
        await response.arrayBuffer();

      if (
        arrayBuffer.byteLength === 0 ||
        arrayBuffer.byteLength >
          MAX_EVENT_IMAGE_BYTES
      ) {
        return null;
      }

      return {
        bytes:
          new Uint8Array(
            arrayBuffer,
          ),

        contentType:
          response.headers.get(
            "content-type",
          ) ?? "",
      };
    } catch {
      return null;
    } finally {
      clearTimeout(
        timeout,
      );
    }
  }

  const localPath =
    resolveLocalPublicImagePath(
      normalizedSource,
    );

  if (!localPath) {
    return null;
  }

  try {
    const file =
      await readFile(
        localPath,
      );

    if (
      file.byteLength === 0 ||
      file.byteLength >
        MAX_EVENT_IMAGE_BYTES
    ) {
      return null;
    }

    return {
      bytes:
        file,

      contentType:
        "",
    };
  } catch {
    return null;
  }
}

async function loadOptionalEventImage(
  pdfDocument: PDFDocument,
  source: string | null | undefined,
): Promise<PDFImage | null> {
  const normalizedSource =
    normalizeText(
      source,
    );

  if (!normalizedSource) {
    return null;
  }

  const imageData =
    await readEventImageBytes(
      normalizedSource,
    );

  if (!imageData) {
    return null;
  }

  const format =
    detectImageFormat({
      contentType:
        imageData.contentType,

      source:
        normalizedSource,

      bytes:
        imageData.bytes,
    });

  try {
    if (
      format ===
      "png"
    ) {
      return await pdfDocument.embedPng(
        imageData.bytes,
      );
    }

    if (
      format ===
      "jpg"
    ) {
      return await pdfDocument.embedJpg(
        imageData.bytes,
      );
    }

    return null;
  } catch {
    return null;
  }
}

function drawContainedImage({
  page,
  image,
  x,
  y,
  width,
  height,
}: {
  page: PDFPage;
  image: PDFImage;
  x: number;
  y: number;
  width: number;
  height: number;
}): void {
  const original =
    image.scale(
      1,
    );

  const scale =
    Math.min(
      width /
        original.width,

      height /
        original.height,
    );

  const renderedWidth =
    original.width *
    scale;

  const renderedHeight =
    original.height *
    scale;

  page.drawImage(
    image,
    {
      x:
        x +
        (
          width -
          renderedWidth
        ) /
          2,

      y:
        y +
        (
          height -
          renderedHeight
        ) /
          2,

      width:
        renderedWidth,

      height:
        renderedHeight,
    },
  );
}

function assertTicketCanBeRendered(
  ticket: TicketPdfData,
): void {
  if (
    ticket.order.status !==
      OrderStatus.PAID ||
    ticket.order.payment?.status !==
      PaymentStatus.SUCCESS
  ) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_ORDER_NOT_PAYABLE",

      message:
        "Le PDF du billet ne peut être généré qu’après confirmation du paiement.",

      status: 409,

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

      status: 409,

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

      status: 500,

      retryable: false,

      exposeMessage: false,

      orderId:
        ticket.order.id,
    });
  }

  const verifiedQr =
    verifyTicketQrValue(
      ticket.qrCodeValue,
    );

  if (
    verifiedQr.payload.ticketCode !==
      ticket.code ||
    verifiedQr.payload.orderReference !==
      ticket.order.reference ||
    verifiedQr.payload.eventId !==
      ticket.event.id ||
    verifiedQr.payload.ticketTypeId !==
      ticket.ticketType.id
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Les informations du QR code ne correspondent pas au billet.",

      status: 500,

      retryable: false,

      exposeMessage: false,

      orderId:
        ticket.order.id,

      details: {
        ticketId:
          ticket.id,
      },
    });
  }

  if (
    ticket.qrVersion !==
    verifiedQr.payload.version
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "La version du QR code ne correspond pas au billet.",

      status: 500,

      retryable: false,

      exposeMessage: false,

      orderId:
        ticket.order.id,

      details: {
        ticketId:
          ticket.id,

        storedQrVersion:
          ticket.qrVersion,

        payloadQrVersion:
          verifiedQr.payload.version,
      },
    });
  }

  if (
    !Number.isInteger(
      ticket.orderItem.quantity,
    ) ||
    ticket.orderItem.quantity <= 0
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "La quantité liée au billet est invalide.",

      status: 500,

      retryable: false,

      exposeMessage: false,

      orderId:
        ticket.order.id,

      details: {
        ticketId:
          ticket.id,

        orderItemId:
          ticket.orderItem.id,

        quantity:
          ticket.orderItem.quantity,
      },
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
    await database.ticket.findUnique({
      where: {
        id: ticketId,
      },

      select: {
        id: true,
        code: true,
        qrCodeValue: true,
        qrVersion: true,
        status: true,
        holderName: true,
        holderEmail: true,
        holderPhone: true,
        issuedAt: true,

        order: {
          select: {
            id: true,
            reference: true,
            status: true,
            currency: true,
            customerName: true,
            customerEmail: true,

            payment: {
              select: {
                status: true,
              },
            },
          },
        },

        event: {
          select: {
            id: true,
            title: true,
            slug: true,
            coverImage: true,
            venueName: true,
            address: true,
            city: true,
            country: true,
            startsAt: true,
            endsAt: true,
          },
        },

        ticketType: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },

        orderItem: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            platformFee: true,
            total: true,
          },
        },
      },
    });

  if (!ticket) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_ORDER_NOT_FOUND",

      message:
        "Le billet est introuvable.",

      status: 404,

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
    sanitizePdfText(
      `Billet Tikemia - ${ticket.code}`,
    ),
  );

  pdfDocument.setAuthor(
    "Tikemia",
  );

  pdfDocument.setSubject(
    sanitizePdfText(
      `${ticket.event.title} - ${ticket.ticketType.name}`,
    ),
  );

  pdfDocument.setKeywords([
    "Tikemia",
    "billet",
    "ticket",
    sanitizePdfText(
      ticket.event.title,
    ),
    sanitizePdfText(
      ticket.ticketType.name,
    ),
    sanitizePdfText(
      ticket.code,
    ),
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

  const eventImage =
    await loadOptionalEventImage(
      pdfDocument,
      ticket.event.coverImage,
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
    x: 0,
    y: 0,
    width: A4_WIDTH,
    height: A4_HEIGHT,
    color: COLOR_DARK,
  });

  page.drawRectangle({
    x: 0,
    y: A4_HEIGHT - 12,
    width: A4_WIDTH / 3,
    height: 12,
    color: BRAND_GREEN,
  });

  page.drawRectangle({
    x: A4_WIDTH / 3,
    y: A4_HEIGHT - 12,
    width: A4_WIDTH / 3,
    height: 12,
    color: BRAND_LIME,
  });

  page.drawRectangle({
    x:
      (A4_WIDTH / 3) * 2,

    y:
      A4_HEIGHT - 12,

    width:
      A4_WIDTH / 3,

    height: 12,
    color: BRAND_ORANGE,
  });

  const headerTop =
    A4_HEIGHT - 42;

  if (logo) {
    const dimensions =
      logo.scale(1);

    const maxWidth = 125;
    const maxHeight = 42;

    const scale =
      Math.min(
        maxWidth /
          dimensions.width,

        maxHeight /
          dimensions.height,
      );

    page.drawImage(logo, {
      x: PAGE_MARGIN,

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
    });
  } else {
    page.drawText(
      "TIKEMIA",
      {
        x: PAGE_MARGIN,
        y: headerTop - 23,
        size: 24,
        font: boldFont,
        color: BRAND_LIME,
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
        headerTop - 10,

      size: 8,
      font: boldFont,
      color: COLOR_MUTED,
    },
  );

  page.drawText(
    truncateText({
      text:
        ticket.code,

      font:
        boldFont,

      size: 13,

      maxWidth: 190,
    }),
    {
      x:
        A4_WIDTH -
        PAGE_MARGIN -
        190,

      y:
        headerTop - 30,

      size: 13,
      font: boldFont,
      color: COLOR_WHITE,
    },
  );

  const eventPanelY =
    535;

  const eventPanelHeight =
    215;

  page.drawRectangle({
    x:
      PAGE_MARGIN,

    y:
      eventPanelY,

    width:
      A4_WIDTH -
      PAGE_MARGIN * 2,

    height:
      eventPanelHeight,

    color:
      COLOR_PANEL,

    borderColor:
      COLOR_LINE,

    borderWidth:
      1,
  });

  const eventContentX =
    PAGE_MARGIN + 20;

  const eventImageX =
    PAGE_MARGIN + 318;

  const eventImageY =
    eventPanelY + 22;

  const eventImageWidth =
    A4_WIDTH -
    PAGE_MARGIN -
    20 -
    eventImageX;

  const eventImageHeight =
    eventPanelHeight - 44;

  page.drawText(
    "EVENEMENT",
    {
      x:
        eventContentX,

      y:
        eventPanelY + 183,

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
      20,

    x:
      eventContentX,

    y:
      eventPanelY + 157,

    maxWidth:
      240,

    lineHeight:
      23,

    maxLines:
      2,
  });

  drawLabelValue({
    page,

    label:
      "Date",

    value:
      formatDateTime(
        ticket.event.startsAt,
      ),

    x:
      eventContentX,

    y:
      eventPanelY + 96,

    width:
      240,

    regularFont,
    boldFont,
  });

  drawLabelValue({
    page,

    label:
      "Lieu",

    value: [
      ticket.event.venueName,
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
      eventContentX,

    y:
      eventPanelY + 51,

    width:
      240,

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
      eventContentX,

    y:
      eventPanelY + 23,

    width:
      240,

    regularFont,
    boldFont,
  });

  page.drawRectangle({
    x:
      eventImageX,

    y:
      eventImageY,

    width:
      eventImageWidth,

    height:
      eventImageHeight,

    color:
      COLOR_DARK,

    borderColor:
      COLOR_LINE,

    borderWidth:
      1,
  });

  if (eventImage) {
    drawContainedImage({
      page,

      image:
        eventImage,

      x:
        eventImageX + 1,

      y:
        eventImageY + 1,

      width:
        eventImageWidth - 2,

      height:
        eventImageHeight - 2,
    });
  } else {
    page.drawText(
      "IMAGE DE L'EVENEMENT",
      {
        x:
          eventImageX + 18,

        y:
          eventImageY +
          eventImageHeight /
            2,

        size:
          8,

        font:
          boldFont,

        color:
          COLOR_MUTED,
      },
    );
  }

  const detailsPanelY =
    315;

  const detailsPanelHeight =
    195;

  page.drawRectangle({
    x:
      PAGE_MARGIN,

    y:
      detailsPanelY,

    width:
      A4_WIDTH -
      PAGE_MARGIN * 2,

    height:
      detailsPanelHeight,

    color:
      COLOR_PANEL_ALT,

    borderColor:
      COLOR_LINE,

    borderWidth:
      1,
  });

  const leftColumnX =
    PAGE_MARGIN + 20;

  const rightColumnX =
    PAGE_MARGIN + 300;

  page.drawText(
    "INFORMATIONS DU BILLET",
    {
      x:
        leftColumnX,

      y:
        detailsPanelY + 165,

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
      ticket.ticketType.name,

    x:
      leftColumnX,

    y:
      detailsPanelY + 135,

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
      detailsPanelY + 90,

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
      detailsPanelY + 45,

    width:
      245,

    regularFont,
    boldFont,
  });

  const feePerTicket =
    divideAmount({
      amount:
        ticket.orderItem
          .platformFee,

      quantity:
        ticket.orderItem
          .quantity,

      orderId:
        ticket.order.id,

      orderItemId:
        ticket.orderItem.id,
    });

  const totalPerTicket =
    divideAmount({
      amount:
        ticket.orderItem.total,

      quantity:
        ticket.orderItem
          .quantity,

      orderId:
        ticket.order.id,

      orderItemId:
        ticket.orderItem.id,
    });

  const unitPrice =
    decimalToFixed(
      ticket.orderItem
        .unitPrice,
    );

  /*
   * Ces valeurs restent uniquement dans les métadonnées
   * techniques pour préserver la compatibilité avec le
   * reste du système. Elles ne sont jamais affichées sur
   * le billet PDF.
   */
  const fee =
    decimalToFixed(
      feePerTicket,
    );

  const total =
    decimalToFixed(
      totalPerTicket,
    );

  page.drawText(
    "PRIX DU BILLET",
    {
      x:
        rightColumnX,

      y:
        detailsPanelY + 165,

      size:
        8,

      font:
        boldFont,

      color:
        BRAND_ORANGE,
    },
  );

  page.drawText(
    sanitizePdfText(
      formatMoney({
        amount:
          unitPrice,

        currency:
          ticket.order.currency,
      }),
    ),
    {
      x:
        rightColumnX,

      y:
        detailsPanelY + 120,

      size:
        24,

      font:
        boldFont,

      color:
        BRAND_LIME,
    },
  );

  drawWrappedText({
    page,

    text:
      "Montant propre du billet. Les frais de service regles lors de la commande ne figurent pas sur le billet.",

    font:
      regularFont,

    size:
      9,

    x:
      rightColumnX,

    y:
      detailsPanelY + 83,

    maxWidth:
      210,

    lineHeight:
      13,

    color:
      COLOR_MUTED,

    maxLines:
      4,
  });

  const qrPanelY = 70;

  page.drawRectangle({
    x: PAGE_MARGIN,
    y: qrPanelY,

    width:
      A4_WIDTH -
      PAGE_MARGIN * 2,

    height: 230,
    color: COLOR_PANEL,
    borderColor: COLOR_LINE,
    borderWidth: 1,
  });

  page.drawImage(qrImage, {
    x:
      PAGE_MARGIN + 22,

    y:
      qrPanelY + 24,

    width: QR_SIZE,
    height: QR_SIZE,
  });

  const qrTextX =
    PAGE_MARGIN +
    QR_SIZE +
    50;

  page.drawText(
    "CONTROLE D'ACCES",
    {
      x: qrTextX,

      y:
        qrPanelY + 190,

      size: 8,
      font: boldFont,
      color: BRAND_LIME,
    },
  );

  drawWrappedText({
    page,

    text:
      "Presentez ce QR code a l'entree. Il contient une signature Tikemia verifiable et les references du billet, de l'evenement et de la categorie.",

    font: regularFont,
    size: 10,
    x: qrTextX,

    y:
      qrPanelY + 165,

    maxWidth: 295,
    lineHeight: 14,
    color: COLOR_MUTED,
    maxLines: 5,
  });

  drawLabelValue({
    page,

    label:
      "Reference de commande",

    value:
      ticket.order.reference,

    x: qrTextX,

    y:
      qrPanelY + 86,

    width: 295,
    regularFont,
    boldFont,
  });

  drawLabelValue({
    page,
    label: "Version QR",

    value:
      String(
        ticket.qrVersion,
      ),

    x: qrTextX,

    y:
      qrPanelY + 42,

    width: 295,
    regularFont,
    boldFont,
  });

  page.drawText(
    sanitizePdfText(
      "Ce billet est personnel. Toute duplication ou modification peut entrainer son refus au controle.",
    ),
    {
      x: PAGE_MARGIN,
      y: 40,
      size: 7.5,
      font: regularFont,
      color: COLOR_MUTED,
    },
  );

  let bytes: Uint8Array;

  try {
    bytes =
      await pdfDocument.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 50,
      });
  } catch (error) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Impossible de produire le fichier PDF du billet.",

      status: 500,

      retryable: true,

      exposeMessage: false,

      orderId:
        ticket.order.id,

      cause: error,
    });
  }

  const buffer =
    Buffer.from(bytes);

  if (
    buffer.byteLength === 0
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Le fichier PDF généré est vide.",

      status: 500,

      retryable: true,

      exposeMessage: false,

      orderId:
        ticket.order.id,
    });
  }

  const checksum =
    createHash("sha256")
      .update(buffer)
      .digest("hex");

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
        ticket.order.reference,

      eventId:
        ticket.event.id,

      eventTitle:
        ticket.event.title,

      ticketTypeId:
        ticket.ticketType.id,

      ticketCategory:
        ticket.ticketType.name,

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
      value: rawTicketId,
      field: "ticketId",
    });

  const validGeneratedAt =
    validateGeneratedAt(
      generatedAt,
    );

  const database: DatabaseClient =
    transaction ?? prisma;

  const ticket =
    await getTicketPdfData({
      database,
      ticketId,
    });

  return buildTicketPdf({
    ticket,
    logoPath,

    generatedAt:
      validGeneratedAt,
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
      value: rawOrderId,
      field: "orderId",
    });

  const validGeneratedAt =
    validateGeneratedAt(
      generatedAt,
    );

  const database: DatabaseClient =
    transaction ?? prisma;

  const order =
    await database.order.findUnique({
      where: {
        id: orderId,
      },

      select: {
        id: true,
        reference: true,
        status: true,

        payment: {
          select: {
            status: true,
          },
        },

        items: {
          orderBy: {
            id: "asc",
          },

          select: {
            id: true,
            quantity: true,

            tickets: {
              orderBy: {
                createdAt: "asc",
              },

              select: {
                id: true,
              },
            },
          },
        },
      },
    });

  if (!order) {
    throw new PaymentValidationError({
      code:
        "PAYMENT_ORDER_NOT_FOUND",

      message:
        "La commande est introuvable.",

      status: 404,

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

      status: 409,

      orderId:
        order.id,
    });
  }

  if (
    order.items.length === 0
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "La commande ne contient aucun billet.",

      status: 500,

      retryable: false,

      exposeMessage: false,

      orderId:
        order.id,
    });
  }

  const expectedTickets =
    order.items.reduce(
      (total, item) => {
        if (
          !Number.isInteger(
            item.quantity,
          ) ||
          item.quantity <= 0
        ) {
          throw new PaymentError({
            code:
              "PAYMENT_TICKET_ISSUANCE_FAILED",

            message:
              "Une quantité de billet est invalide.",

            status: 500,

            retryable: false,

            exposeMessage: false,

            orderId:
              order.id,

            details: {
              orderItemId:
                item.id,

              quantity:
                item.quantity,
            },
          });
        }

        if (
          item.tickets.length >
          item.quantity
        ) {
          throw new PaymentError({
            code:
              "PAYMENT_TICKET_ISSUANCE_FAILED",

            message:
              "Le nombre de billets dépasse la quantité commandée.",

            status: 500,

            retryable: false,

            exposeMessage: false,

            orderId:
              order.id,

            details: {
              orderItemId:
                item.id,

              expected:
                item.quantity,

              available:
                item.tickets.length,
            },
          });
        }

        return (
          total +
          item.quantity
        );
      },
      0,
    );

  const ticketIds =
    order.items.flatMap(
      (item) =>
        item.tickets.map(
          (ticket) =>
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

      status: 409,

      retryable: true,

      exposeMessage: false,

      orderId:
        order.id,

      details: {
        expectedTickets,

        availableTickets:
          ticketIds.length,
      },
    });
  }

  const uniqueTicketIds =
    new Set(ticketIds);

  if (
    uniqueTicketIds.size !==
    ticketIds.length
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "La commande contient des références de billets en double.",

      status: 500,

      retryable: false,

      exposeMessage: false,

      orderId:
        order.id,
    });
  }

  const tickets:
    GeneratedTicketPdf[] = [];

  for (
    const ticketId of ticketIds
  ) {
    tickets.push(
      await generateTicketPdf({
        ticketId,
        transaction,
        logoPath,

        generatedAt:
          validGeneratedAt,
      }),
    );
  }

  if (
    tickets.length !==
    expectedTickets
  ) {
    throw new PaymentError({
      code:
        "PAYMENT_TICKET_ISSUANCE_FAILED",

      message:
        "Le nombre de PDF générés ne correspond pas à la commande.",

      status: 500,

      retryable: true,

      exposeMessage: false,

      orderId:
        order.id,

      details: {
        expectedTickets,

        generatedPdfs:
          tickets.length,
      },
    });
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