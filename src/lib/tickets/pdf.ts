import { formatMinorMoney } from "@/i18n/config";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";

import { getPlatformPrisma } from "@/lib/payments/fulfillment";

import {
  regenerateTicketQr,
  generateTicketQrPng,
} from "@/lib/tickets/qr";

/**
 * ============================================================
 * TIKEMIA — GÉNÉRATION DES BILLETS PDF
 * ============================================================
 *
 * Fichier :
 * src/lib/tickets/pdf.ts
 *
 * Fonctionnalités :
 *
 * - Billet PDF individuel
 * - Logo officiel TIKEMIA
 * - Image réelle de l'événement
 * - Nom de l'événement
 * - Date et heure
 * - Lieu de l'événement
 * - Catégorie du billet
 * - Titulaire : nom si disponible
 * - Adresse email
 * - Numéro de téléphone
 * - QR code sécurisé unique
 * - Numéro de billet unique
 * - Message de contrôle d'accès
 * - Français et anglais
 *
 * Sécurité :
 *
 * - Exécution côté serveur
 * - Vérification de la commande PAID
 * - Vérification du billet
 * - QR identique à celui enregistré
 * - Aucun billet fictif
 * - Aucun paiement déclenché ici
 * - Aucun changement de statut
 *
 * Le PDF est retourné sous forme de Buffer.
 *
 * L'envoi par email sera géré séparément
 * par src/lib/email/send.ts.
 * ============================================================
 */

/* ============================================================
   CONSTANTES
============================================================ */

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const MAX_TICKETS_PER_BATCH = 100;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COLORS = {
  white: rgb(1, 1, 1),

  navy: rgb(0.055, 0.10, 0.19),

  text: rgb(0.10, 0.17, 0.25),

  secondary: rgb(0.36, 0.43, 0.49),

  green: rgb(0.015, 0.56, 0.13),

  greenDark: rgb(0.0, 0.37, 0.10),

  greenBright: rgb(0.04, 0.78, 0.08),

  greenLight: rgb(0.91, 0.98, 0.90),

  grayLight: rgb(0.955, 0.965, 0.965),

  grayBorder: rgb(0.85, 0.89, 0.86),

  black: rgb(0, 0, 0),
};

const CONTENT_X = 28;
const CONTENT_WIDTH = PAGE_WIDTH - 56;

/* ============================================================
   TYPES
============================================================ */

export type TicketPdfLocale = "fr" | "en";

export type TicketImageLoader = (
  storageKey: string
) => Promise<Uint8Array | Buffer | null>;

export type TicketPdfOptions = {
  locale?: TicketPdfLocale;

  /**
   * Charge une image déjà enregistrée
   * dans le stockage privé du projet.
   *
   * La clé provient de EventImage.storageKey,
   * jamais directement d'une requête client.
   *
   * Le code appelant doit fournir un chargeur
   * adapté au stockage réellement utilisé.
   */
  loadEventImage?: TicketImageLoader;

  /**
   * Le PDF peut être généré sans image de
   * couverture si celle-ci est indisponible.
   */
  requireEventImage?: boolean;
};

export type GeneratedTicketPdf = {
  ticketId: string;

  ticketNumber: string;

  orderId: string;

  eventId: string;

  filename: string;

  mimeType: "application/pdf";

  buffer: Buffer;

  size: number;
};

type TicketDetails = {
  id: string;
  number: string;
  orderId: string;
  eventId: string;

  status: string;

  eventTitle: string;
  eventTimeZone: string;

  startsAt: Date;

  venue: string;

  category: string;
  unitPriceMinor: string;
  currency: string;

  holderName: string | null;
  holderEmail: string;
  holderPhone: string;

  eventImageKey: string | null;
  issuedAt: Date;
};

type TicketFonts = {
  regular: PDFFont;
  bold: PDFFont;
};

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export class TicketPdfError extends Error {
  constructor(
    public readonly code: string
  ) {
    super(code);
    this.name = "TicketPdfError";
  }
}

/* ============================================================
   TRADUCTIONS
============================================================ */

const TEXT = {
  fr: {
    electronicTicket: "Billet électronique",
    validTicket: "Billet valide",

    eventDate: "Date de l'événement",
    time: "Heure",
    venue: "Lieu",
    category: "Catégorie",

    holder: "Titulaire",
    email: "Email",
    phone: "Téléphone",

    validForOneScan: "Valable pour un seul scan",
    entryMessage:
      "Présentez ce billet à l'entrée",

    brandMessage:
      "Vivez vos événements autrement",

    dateUnavailable: "Date à confirmer",
    venueUnavailable: "Lieu à confirmer",
    nameUnavailable: "Titulaire du billet",
  },

  en: {
    electronicTicket: "Electronic ticket",
    validTicket: "Valid ticket",

    eventDate: "Event date",
    time: "Time",
    venue: "Venue",
    category: "Category",

    holder: "Ticket holder",
    email: "Email",
    phone: "Phone",

    validForOneScan: "Valid for one scan only",
    entryMessage:
      "Present this ticket at the entrance",

    brandMessage:
      "Experience events differently",

    dateUnavailable: "Date to be confirmed",
    venueUnavailable: "Venue to be confirmed",
    nameUnavailable: "Ticket holder",
  },
} as const;

/* ============================================================
   VALIDATIONS
============================================================ */

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function normalizeLocale(
  locale: TicketPdfLocale | undefined
): TicketPdfLocale {
  return locale === "en" ? "en" : "fr";
}

function requireText(
  value: string | null | undefined,
  code: string
): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new TicketPdfError(code);
  }

  return value.trim();
}

/* ============================================================
   TEXTE COMPATIBLE AVEC LES POLICES PDF
============================================================ */

/**
 * Les polices standard PDF ne couvrent pas
 * tous les caractères Unicode.
 *
 * Cette fonction évite les erreurs
 * d'encodage sans altérer les données
 * enregistrées dans PostgreSQL.
 *
 * Les caractères non pris en charge
 * peuvent être remplacés dans le rendu.
 *
 * Pour une prise en charge Unicode complète,
 * on pourra embarquer ultérieurement
 * une police Unicode autorisée.
 */

function printable(
  font: PDFFont,
  value: string
): string {
  const normalized = value
    .normalize("NFC")
    .replace(/\r?\n/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  let result = "";

  for (const character of normalized) {
    try {
      font.encodeText(character);
      result += character;
    } catch {
      result += "?";
    }
  }

  return result;
}

/* ============================================================
   LIMITATION DU TEXTE
============================================================ */

function fitText(
  font: PDFFont,
  value: string,
  size: number,
  maxWidth: number
): string {
  const text = printable(font, value);

  if (
    font.widthOfTextAtSize(text, size) <=
    maxWidth
  ) {
    return text;
  }

  const suffix = "...";

  let result = text;

  while (
    result.length > 0 &&
    font.widthOfTextAtSize(
      result + suffix,
      size
    ) > maxWidth
  ) {
    result = result.slice(0, -1);
  }

  return result + suffix;
}

/* ============================================================
   DESSINER DU TEXTE
============================================================ */

function drawText(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    size: number;
    font: PDFFont;
    color?: ReturnType<typeof rgb>;
    maxWidth?: number;
  }
): void {
  const safeText =
    options.maxWidth !== undefined
      ? fitText(
          options.font,
          text,
          options.size,
          options.maxWidth
        )
      : printable(
          options.font,
          text
        );

  if (!safeText) return;

  page.drawText(safeText, {
    x: options.x,
    y: options.y,
    size: options.size,
    font: options.font,
    color:
      options.color ?? COLORS.text,
  });
}

function centeredText(
  page: PDFPage,
  text: string,
  y: number,
  size: number,
  font: PDFFont,
  color = COLORS.text,
  centerX = PAGE_WIDTH / 2,
  maxWidth = CONTENT_WIDTH
): void {
  const safeText =
    fitText(
      font,
      text,
      size,
      maxWidth
    );

  const width =
    font.widthOfTextAtSize(
      safeText,
      size
    );

  drawText(page, safeText, {
    x: centerX - width / 2,
    y,
    size,
    font,
    color,
  });
}

/* ============================================================
   RECTANGLE ARRONDI
============================================================ */

/**
 * Dessine un rectangle arrondi sans dépendre
 * de SVG externes ou de fonctions non prises
 * en charge par pdf-lib.
 */

function roundedRect(
  page: PDFPage,
  box: Box,
  radius: number,
  color: ReturnType<typeof rgb>
): void {
  const r = Math.max(
    0,
    Math.min(
      radius,
      box.width / 2,
      box.height / 2
    )
  );

  if (r === 0) {
    page.drawRectangle({
      ...box,
      color,
    });
    return;
  }

  page.drawRectangle({
    x: box.x + r,
    y: box.y,
    width: box.width - 2 * r,
    height: box.height,
    color,
  });

  page.drawRectangle({
    x: box.x,
    y: box.y + r,
    width: box.width,
    height: box.height - 2 * r,
    color,
  });

  const corners = [
    [box.x + r, box.y + r],
    [box.x + box.width - r, box.y + r],
    [box.x + r, box.y + box.height - r],
    [
      box.x + box.width - r,
      box.y + box.height - r,
    ],
  ];

  for (const [x, y] of corners) {
    page.drawCircle({
      x,
      y,
      size: r,
      color,
    });
  }
}

/* ============================================================
   ICÔNE DE VALIDATION
============================================================ */

function drawCheck(
  page: PDFPage,
  x: number,
  y: number,
  size: number,
  color = COLORS.white
): void {
  page.drawLine({
    start: {
      x: x - size * 0.40,
      y,
    },
    end: {
      x: x - size * 0.10,
      y: y - size * 0.28,
    },
    thickness: Math.max(2, size * 0.12),
    color,
  });

  page.drawLine({
    start: {
      x: x - size * 0.10,
      y: y - size * 0.28,
    },
    end: {
      x: x + size * 0.46,
      y: y + size * 0.36,
    },
    thickness: Math.max(2, size * 0.12),
    color,
  });
}

/* ============================================================
   IMAGES
============================================================ */

function detectImage(
  bytes: Uint8Array
): "png" | "jpg" {
  if (
    bytes.length >= 8 &&
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71
  ) {
    return "png";
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  ) {
    return "jpg";
  }

  throw new TicketPdfError(
    "UNSUPPORTED_IMAGE_FORMAT"
  );
}

async function embedImage(
  pdf: PDFDocument,
  bytes: Uint8Array
): Promise<PDFImage> {
  if (
    bytes.length === 0 ||
    bytes.length > MAX_IMAGE_BYTES
  ) {
    throw new TicketPdfError(
      "IMAGE_SIZE_INVALID"
    );
  }

  const format = detectImage(bytes);

  if (format === "png") {
    return pdf.embedPng(bytes);
  }

  return pdf.embedJpg(bytes);
}

/* ============================================================
   CHARGEMENT DU LOGO
============================================================ */

/**
 * Le logo utilisé est celui déjà présent :
 *
 * public/logo/logo.png
 *
 * Aucun logo n'est redessiné.
 */

async function loadOfficialLogo(
  pdf: PDFDocument
): Promise<PDFImage> {
  const logoPath = path.join(
    process.cwd(),
    "public",
    "logo",
    "logo.png"
  );

  let bytes: Buffer;

  try {
    bytes =
      await readFile(logoPath);
  } catch {
    throw new TicketPdfError(
      "OFFICIAL_LOGO_MISSING"
    );
  }

  return embedImage(pdf, bytes);
}

/* ============================================================
   IMAGE DE L'ÉVÉNEMENT
============================================================ */

async function loadEventPicture(
  pdf: PDFDocument,
  key: string | null,
  options: TicketPdfOptions
): Promise<PDFImage | null> {
  if (!key) {
    if (options.requireEventImage) {
      throw new TicketPdfError(
        "EVENT_IMAGE_MISSING"
      );
    }

    return null;
  }

  if (!options.loadEventImage) {
    if (options.requireEventImage) {
      throw new TicketPdfError(
        "IMAGE_LOADER_NOT_CONFIGURED"
      );
    }

    return null;
  }

  try {
    const bytes =
      await options.loadEventImage(key);

    if (!bytes) {
      throw new TicketPdfError(
        "EVENT_IMAGE_NOT_FOUND"
      );
    }

    return await embedImage(
      pdf,
      bytes
    );
  } catch (error) {
    if (options.requireEventImage) {
      throw error;
    }

    return null;
  }
}

/* ============================================================
   DATE DE L'ÉVÉNEMENT
============================================================ */

function eventDateParts(
  date: Date,
  timeZone: string,
  locale: TicketPdfLocale
): {
  dateText: string;
  timeText: string;
} {
  try {
    const localeCode =
      locale === "fr"
        ? "fr-FR"
        : "en-GB";

    const dateText =
      new Intl.DateTimeFormat(
        localeCode,
        {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone,
        }
      ).format(date);

    const timeText =
      new Intl.DateTimeFormat(
        localeCode,
        {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone,
        }
      ).format(date);

    return {
      dateText,
      timeText,
    };
  } catch {
    throw new TicketPdfError(
      "INVALID_EVENT_TIMEZONE"
    );
  }
}

/* ============================================================
   RÉCUPÉRATION DU BILLET EN BASE
============================================================ */

async function getTicketDetails(
  ticketId: string
): Promise<TicketDetails> {
  if (!isUuid(ticketId)) {
    throw new TicketPdfError(
      "INVALID_TICKET_ID"
    );
  }

  const prisma =
    getPlatformPrisma();

  const ticket =
    await prisma.ticket.findUnique({
      where: {
        id: ticketId,
      },

      include: {
        orderLine: { select: { unitPrice: true, currency: true, categoryName: true } },
        owner: { select: { email: true, phoneE164: true } },
        transfers: { where: { status: "ACCEPTED" }, orderBy: [{ acceptedAt: "desc" }, { id: "desc" }], take: 1, select: { recipientEmail: true } },
        order: {
          include: {
            buyer: {
              select: {
                fullName: true,
                email: true,
                phoneE164: true,
              },
            },

            payments: {
              select: {
                status: true,
                paidAt: true,
              },
            },
          },
        },

        event: {
          include: {
            venue: true,

            images: {
              orderBy: [
                {
                  isPrimary: "desc",
                },
                {
                  position: "asc",
                },
              ],

              take: 1,
            },

            schedules: {
              orderBy: {
                startsAt: "asc",
              },

              take: 2,
            },
          },
        },

        category: {
          select: {
            name: true,
          },
        },

        schedule: {
          select: {
            startsAt: true,
          },
        },
      },
    });

  if (!ticket) {
    throw new TicketPdfError(
      "TICKET_NOT_FOUND"
    );
  }

  /* ========================================================
     VÉRIFICATION DE LA COMMANDE
  ======================================================== */

  if (
    ticket.order.status !== "PAID" ||
    !ticket.order.paidAt
  ) {
    throw new TicketPdfError(
      "ORDER_NOT_PAID"
    );
  }

  /* ========================================================
     VÉRIFICATION DU PAIEMENT
  ======================================================== */

  const confirmedPayment =
    ticket.order.payments.some(
      (payment) =>
        payment.status === "SUCCEEDED" &&
        payment.paidAt !== null
    );

  if (!confirmedPayment) {
    throw new TicketPdfError(
      "PAYMENT_NOT_CONFIRMED"
    );
  }

  /* ========================================================
     STATUT DU BILLET
  ======================================================== */

  if (
    ticket.status !== "VALID" ||
    ticket.usedAt !== null
  ) {
    throw new TicketPdfError(
      "TICKET_NOT_VALID"
    );
  }

  /* ========================================================
     IDENTITÉ DU TITULAIRE
  ======================================================== */

  const email =
    ticket.owner?.email?.trim() ||
    ticket.transfers[0]?.recipientEmail?.trim() ||
    ticket.guestEmail?.trim() ||
    ticket.order.guestEmail?.trim() ||
    ticket.order.buyer?.email?.trim() ||
    "";

  const phone =
    ticket.owner?.phoneE164?.trim() ||
    (ticket.transfers.length ? "" : ticket.order.guestPhoneE164?.trim()) ||
    (ticket.transfers.length ? "" : ticket.order.buyer?.phoneE164?.trim()) ||
    "";

  /*
   * Le titulaire est le propriétaire actuel.
   * Après transfert, ne jamais afficher le numéro de l'acheteur initial.
   */

  requireText(
    email,
    "TICKET_HOLDER_EMAIL_MISSING"
  );



  /* ========================================================
     DATE DU BILLET
  ======================================================== */

  let startsAt =
    ticket.schedule?.startsAt ?? null;

  /*
   * Pour un événement à une date unique,
   * on peut utiliser cette date si le billet
   * n'a pas de scheduleId.
   *
   * Pour un événement à plusieurs dates,
   * il faut obligatoirement une séance
   * associée au billet.
   */

  if (!startsAt) {
    if (
      ticket.event.schedules.length !== 1
    ) {
      throw new TicketPdfError(
        "TICKET_SCHEDULE_AMBIGUOUS"
      );
    }

    startsAt =
      ticket.event.schedules[0].startsAt;
  }

  const venue =
    ticket.event.venue;

  const venueText = venue
    ? [
        venue.name,
        venue.address,
        venue.city,
        venue.country,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  return {
    id:
      ticket.id,

    number:
      ticket.number,

    orderId:
      ticket.orderId,

    eventId:
      ticket.eventId,

    status:
      ticket.status,

    eventTitle:
      ticket.event.title,

    eventTimeZone:
      ticket.event.timeZone,

    startsAt,

    venue:
      venueText,

    category:
      ticket.orderLine.categoryName,
    unitPriceMinor: ticket.orderLine.unitPrice.toString(),
    currency: ticket.orderLine.currency,

    issuedAt: ticket.issuedAt,
    holderName: null,

    holderEmail:
      email,

    holderPhone:
      phone,

    eventImageKey:
      ticket.event.images[0]
        ?.storageKey ?? null,
  };
}

/* ============================================================
   EN-TÊTE TIKEMIA
============================================================ */

function drawHeader(
  page: PDFPage,
  logo: PDFImage,
  fonts: TicketFonts,
  locale: TicketPdfLocale
): void {
  const t = TEXT[locale];

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 116,
    width: PAGE_WIDTH,
    height: 116,
    color: COLORS.white,
  });

  const logoWidth = 238;

  const logoHeight =
    logoWidth * (logo.height / logo.width);

  page.drawImage(logo, {
    x: CONTENT_X,
    y: PAGE_HEIGHT - 28 - logoHeight,
    width: logoWidth,
    height: logoHeight,
  });

  drawText(page, t.electronicTicket, {
    x: CONTENT_X + 100,
    y: PAGE_HEIGHT - 100,
    size: 17,
    font: fonts.bold,
    color: COLORS.navy,
    maxWidth: 260,
  });

  roundedRect(
    page,
    {
      x: PAGE_WIDTH - 181,
      y: PAGE_HEIGHT - 75,
      width: 153,
      height: 41,
    },
    20,
    COLORS.green
  );

  page.drawCircle({
    x: PAGE_WIDTH - 160,
    y: PAGE_HEIGHT - 54.5,
    size: 12,
    color: COLORS.white,
  });

  drawCheck(
    page,
    PAGE_WIDTH - 160,
    PAGE_HEIGHT - 54.5,
    13,
    COLORS.green
  );

  drawText(page, t.validTicket, {
    x: PAGE_WIDTH - 142,
    y: PAGE_HEIGHT - 60,
    size: 12.5,
    font: fonts.bold,
    color: COLORS.white,
    maxWidth: 108,
  });

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 119,
    width: PAGE_WIDTH,
    height: 3,
    color: COLORS.greenBright,
  });
}

/* ============================================================
   BANNIÈRE ÉVÉNEMENT
============================================================ */

function drawEventBanner(
  page: PDFPage,
  fonts: TicketFonts,
  details: TicketDetails,
  picture: PDFImage | null
): void {
  const box: Box = {
    x: CONTENT_X,
    y: 551,
    width: CONTENT_WIDTH,
    height: 165,
  };

  roundedRect(
    page,
    box,
    15,
    COLORS.navy
  );

  if (picture) {
    /*
     * Le bandeau est rempli proportionnellement.
     * Un voile sombre assure la lisibilité
     * du titre sur les photographies.
     */

    page.drawImage(picture, {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    });

    page.drawRectangle({
      ...box,
      color: COLORS.navy,
      opacity: 0.46,
    });
  } else {
    /*
     * Si aucune image n'est disponible,
     * le titre reste visible sur un fond
     * aux couleurs de TIKEMIA.
     */

    page.drawRectangle({
      x: box.x,
      y: box.y,
      width: box.width,
      height: 8,
      color: COLORS.green,
    });
  }

  const maxTitleWidth =
    box.width - 44;

  let titleSize = 28;

  while (
    titleSize > 17 &&
    fonts.bold.widthOfTextAtSize(
      printable(
        fonts.bold,
        details.eventTitle
      ),
      titleSize
    ) > maxTitleWidth
  ) {
    titleSize -= 1;
  }

  centeredText(
    page,
    details.eventTitle,
    box.y + 63,
    titleSize,
    fonts.bold,
    COLORS.white,
    PAGE_WIDTH / 2,
    maxTitleWidth
  );
}

/* ============================================================
   DATE ET HEURE
============================================================ */

function drawDateAndTime(
  page: PDFPage,
  fonts: TicketFonts,
  details: TicketDetails,
  locale: TicketPdfLocale
): void {
  const t = TEXT[locale];

  roundedRect(
    page,
    {
      x: CONTENT_X,
      y: 469,
      width: CONTENT_WIDTH,
      height: 70,
    },
    15,
    COLORS.grayLight
  );

  const date =
    eventDateParts(
      details.startsAt,
      details.eventTimeZone,
      locale
    );

  page.drawCircle({
    x: 57,
    y: 504,
    size: 17,
    color: COLORS.greenLight,
  });

  drawText(page, "20", {
    x: 48,
    y: 497,
    size: 13,
    font: fonts.bold,
    color: COLORS.greenDark,
  });

  drawText(page, t.eventDate, {
    x: 85,
    y: 515,
    size: 12,
    font: fonts.regular,
    color: COLORS.text,
  });

  drawText(page, date.dateText, {
    x: 85,
    y: 490,
    size: 17,
    font: fonts.bold,
    color: COLORS.navy,
    maxWidth: 290,
  });

  page.drawLine({
    start: {
      x: 396,
      y: 480,
    },

    end: {
      x: 396,
      y: 529,
    },

    thickness: 1,
    color: COLORS.grayBorder,
  });

  drawText(page, t.time, {
    x: 418,
    y: 515,
    size: 12,
    font: fonts.regular,
  });

  drawText(page, date.timeText, {
    x: 418,
    y: 489,
    size: 20,
    font: fonts.bold,
    color: COLORS.navy,
  });
}

/* ============================================================
   TITULAIRE
============================================================ */

function drawHolder(
  page: PDFPage,
  fonts: TicketFonts,
  details: TicketDetails,
  locale: TicketPdfLocale
): void {
  const t = TEXT[locale];

  roundedRect(
    page,
    {
      x: CONTENT_X,
      y: 370,
      width: CONTENT_WIDTH,
      height: 87,
    },
    18,
    COLORS.greenLight
  );

  page.drawCircle({
    x: 61,
    y: 420,
    size: 12,
    color: COLORS.green,
  });

  page.drawCircle({
    x: 61,
    y: 424,
    size: 5,
    color: COLORS.white,
  });

  roundedRect(
    page,
    {
      x: 44,
      y: 387,
      width: 34,
      height: 21,
    },
    10,
    COLORS.green
  );

  drawText(page, t.holder, {
    x: 92,
    y: 431,
    size: 17,
    font: fonts.bold,
    color: COLORS.greenDark,
  });

  if (details.holderName) {
    drawText(
      page,
      details.holderName,
      {
        x: 192,
        y: 432,
        size: 11,
        font: fonts.bold,
        maxWidth: 340,
        color: COLORS.text,
      }
    );
  }

  drawText(page, t.email + " :", {
    x: 92,
    y: 410,
    size: 11,
    font: fonts.bold,
    color: COLORS.text,
  });

  drawText(
    page,
    details.holderEmail,
    {
      x: 162,
      y: 410,
      size: 11,
      font: fonts.regular,
      maxWidth: 370,
    }
  );

  drawText(page, t.phone + " :", {
    x: 92,
    y: 390,
    size: 11,
    font: fonts.bold,
    color: COLORS.text,
  });

  drawText(
    page,
    details.holderPhone,
    {
      x: 162,
      y: 390,
      size: 12,
      font: fonts.bold,
      color: COLORS.navy,
      maxWidth: 370,
    }
  );
}

/* ============================================================
   LIEU ET CATÉGORIE
============================================================ */

function drawTicketDetails(
  page: PDFPage,
  fonts: TicketFonts,
  details: TicketDetails,
  locale: TicketPdfLocale
): void {
  const t = TEXT[locale];

  drawText(page, t.venue + " :", {
    x: CONTENT_X + 5,
    y: 351,
    size: 10.5,
    font: fonts.bold,
    color: COLORS.greenDark,
  });

  drawText(
    page,
    details.venue || t.venueUnavailable,
    {
      x: CONTENT_X + 55,
      y: 351,
      size: 10.5,
      font: fonts.regular,
      maxWidth: 455,
    }
  );

  drawText(
    page,
    t.category + " :",
    {
      x: CONTENT_X + 5,
      y: 334,
      size: 10.5,
      font: fonts.bold,
      color: COLORS.greenDark,
    }
  );

  drawText(
    page,
    details.category,
    {
      x: CONTENT_X + 73,
      y: 334,
      size: 10.5,
      font: fonts.regular,
      maxWidth: 260,
    }
  );
  drawText(page, formatMinorMoney(details.unitPriceMinor, details.currency, locale), { x: CONTENT_X + 340, y: 334, size: 12, font: fonts.bold, color: COLORS.greenDark, maxWidth: 175 });

}

/* ============================================================
   QR CODE CENTRAL
============================================================ */

function drawQrSection(
  page: PDFPage,
  fonts: TicketFonts,
  qrImage: PDFImage,
  details: TicketDetails
): void {
  const qrSize = 210;

  const x =
    (PAGE_WIDTH - qrSize) / 2;

  const y = 113;

  /*
   * Fond blanc nécessaire pour garantir
   * un excellent contraste à la lecture.
   */

  roundedRect(
    page,
    {
      x: x - 10,
      y: y - 9,
      width: qrSize + 20,
      height: qrSize + 18,
    },
    15,
    COLORS.white
  );

  /*
   * Décoration verte en périphérie.
   *
   * Elle ne masque aucun module du QR.
   */

  page.drawRectangle({
    x: x - 12,
    y: y + 3,
    width: 4,
    height: qrSize - 6,
    color: COLORS.greenBright,
  });

  page.drawRectangle({
    x: x + qrSize + 8,
    y: y + 3,
    width: 4,
    height: qrSize - 6,
    color: COLORS.greenBright,
  });

  page.drawImage(qrImage, {
    x,
    y,
    width: qrSize,
    height: qrSize,
  });

  /*
   * Le numéro figure sous le QR.
   * Il n'est pas utilisé comme seule
   * preuve d'authenticité.
   */

  roundedRect(
    page,
    {
      x: 175,
      y: 89,
      width: 245,
      height: 34,
    },
    16,
    COLORS.green
  );

  centeredText(
    page,
    details.number,
    101,
    13,
    fonts.bold,
    COLORS.white,
    PAGE_WIDTH / 2,
    220
  );
}

/* ============================================================
   VALIDITÉ ET PIED DE PAGE
============================================================ */

function drawFooter(
  page: PDFPage,
  fonts: TicketFonts,
  locale: TicketPdfLocale
): void {
  const t = TEXT[locale];

  roundedRect(
    page,
    {
      x: CONTENT_X,
      y: 43,
      width: CONTENT_WIDTH,
      height: 39,
    },
    16,
    COLORS.greenLight
  );

  page.drawCircle({
    x: 63,
    y: 62,
    size: 13,
    color: COLORS.green,
  });

  drawCheck(
    page,
    63,
    62,
    15
  );

  drawText(
    page,
    t.validForOneScan,
    {
      x: 91,
      y: 62,
      size: 13,
      font: fonts.bold,
      color: COLORS.greenDark,
      maxWidth: 430,
    }
  );

  drawText(
    page,
    t.entryMessage,
    {
      x: 91,
      y: 48,
      size: 9,
      font: fonts.regular,
      color: COLORS.text,
      maxWidth: 430,
    }
  );

  /*
   * Bandeau vert TIKEMIA.
   */

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: 33,
    color: COLORS.greenDark,
  });

  drawText(
    page,
    "TIKEMIA",
    {
      x: 28,
      y: 10,
      size: 16,
      font: fonts.bold,
      color: COLORS.white,
    }
  );

  drawText(
    page,
    t.brandMessage,
    {
      x: 310,
      y: 12,
      size: 10,
      font: fonts.regular,
      color: COLORS.white,
      maxWidth: 250,
    }
  );
}

/* ============================================================
   GÉNÉRATION DU PDF
============================================================ */

/**
 * Génère un PDF individuel.
 *
 * Le ticketId correspond à Ticket.id.
 *
 * Le PDF est produit uniquement après
 * les vérifications de la commande,
 * du paiement et du QR sécurisé.
 *
 * Exemple :
 *
 * const pdf = await generateTicketPdf(ticketId);
 *
 * pdf.buffer contient les octets PDF.
 */

export async function generateTicketPdf(
  ticketId: string,
  options: TicketPdfOptions = {}
): Promise<GeneratedTicketPdf> {
  if (!isUuid(ticketId)) {
    throw new TicketPdfError(
      "INVALID_TICKET_ID"
    );
  }

  const locale =
    normalizeLocale(options.locale);

  /* ========================================================
     VÉRIFIER LE BILLET EN BASE
  ======================================================== */

  const details =
    await getTicketDetails(ticketId);

  /* ========================================================
     RECONSTRUIRE LE QR AUTHENTIQUE
  ======================================================== */

  const qr =
    await regenerateTicketQr(
      details.id
    );

  /*
   * Le token retourné est celui correspondant
   * au hash stocké dans PostgreSQL.
   */

  const qrPng =
    await generateTicketQrPng(
      qr.token,
      {
        width: 900,
        margin: 4,
        darkColor: "#000000",
        lightColor: "#FFFFFF",
      }
    );

  /* ========================================================
     DOCUMENT PDF
  ======================================================== */

  const pdf =
    await PDFDocument.create();
  pdf.setCreationDate(details.issuedAt);
  pdf.setModificationDate(details.issuedAt);

  pdf.setTitle(
    `TIKEMIA - ${details.eventTitle}`
  );

  pdf.setAuthor("TIKEMIA");

  pdf.setCreator("TIKEMIA");

  pdf.setProducer("TIKEMIA");

  pdf.setSubject(
    `Billet ${details.number}`
  );

  pdf.setKeywords([
    "TIKEMIA",
    "ticket",
    "billet",
    "QR",
    details.number,
  ]);

  /* ========================================================
     POLICES
  ======================================================== */

  const fonts: TicketFonts = {
    regular:
      await pdf.embedFont(
        StandardFonts.Helvetica
      ),

    bold:
      await pdf.embedFont(
        StandardFonts.HelveticaBold
      ),
  };

  /* ========================================================
     IMAGES
  ======================================================== */

  const logo =
    await loadOfficialLogo(pdf);

  const eventPicture =
    await loadEventPicture(
      pdf,
      details.eventImageKey,
      options
    );

  const qrImage =
    await pdf.embedPng(qrPng);

  /* ========================================================
     PAGE
  ======================================================== */

  const page =
    pdf.addPage([
      PAGE_WIDTH,
      PAGE_HEIGHT,
    ]);

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: COLORS.white,
  });

  /* ========================================================
     CONSTRUCTION VISUELLE
  ======================================================== */

  drawHeader(
    page,
    logo,
    fonts,
    locale
  );

  drawEventBanner(
    page,
    fonts,
    details,
    eventPicture
  );

  drawDateAndTime(
    page,
    fonts,
    details,
    locale
  );

  drawHolder(
    page,
    fonts,
    details,
    locale
  );

  drawTicketDetails(
    page,
    fonts,
    details,
    locale
  );

  drawQrSection(
    page,
    fonts,
    qrImage,
    details
  );

  drawFooter(
    page,
    fonts,
    locale
  );

  /* ========================================================
     EXPORT PDF
  ======================================================== */

  const bytes =
    await pdf.save({
      useObjectStreams: true,
    });

  const buffer =
    Buffer.from(bytes);

  const filename =
    `TIKEMIA-${details.number.replace(
      /[^a-zA-Z0-9_-]/g,
      ""
    )}.pdf`;

  return {
    ticketId:
      details.id,

    ticketNumber:
      details.number,

    orderId:
      details.orderId,

    eventId:
      details.eventId,

    filename,

    mimeType:
      "application/pdf",

    buffer,

    size:
      buffer.length,
  };
}

/* ============================================================
   GÉNÉRER TOUS LES BILLETS D'UNE COMMANDE
============================================================ */

/**
 * Une commande de 4 billets produit
 * 4 fichiers PDF individuels.
 *
 * Les billets sont chargés depuis la base.
 *
 * Aucun ticket supplémentaire n'est créé.
 *
 * Cette fonction sera appelée par le
 * worker d'envoi des emails.
 */

export async function generateOrderTicketPdfs(
  orderId: string,
  options: TicketPdfOptions = {}
): Promise<GeneratedTicketPdf[]> {
  if (!isUuid(orderId)) {
    throw new TicketPdfError(
      "INVALID_ORDER_ID"
    );
  }

  const prisma =
    getPlatformPrisma();

  const order =
    await prisma.order.findUnique({
      where: {
        id: orderId,
      },

      select: {
        id: true,
        status: true,
        paidAt: true,

        lines: {
          select: {
            quantity: true,
          },
        },

        tickets: {
          orderBy: {
            issuedAt: "asc",
          },

          select: {
            id: true,
          },
        },
      },
    });

  if (
    !order ||
    order.status !== "PAID" ||
    !order.paidAt
  ) {
    throw new TicketPdfError(
      "ORDER_NOT_PAID"
    );
  }

  const expectedQuantity =
    order.lines.reduce(
      (total, line) =>
        total + line.quantity,
      0
    );

  if (
    expectedQuantity <= 0 ||
    expectedQuantity >
      MAX_TICKETS_PER_BATCH ||
    order.tickets.length !==
      expectedQuantity
  ) {
    throw new TicketPdfError(
      "ORDER_TICKETS_INCOMPLETE"
    );
  }

  const documents:
    GeneratedTicketPdf[] = [];

  for (const ticket of order.tickets) {
    const document =
      await generateTicketPdf(
        ticket.id,
        options
      );

    documents.push(document);
  }

  return documents;
}

export async function loadStoredEventImage(storageKey: string): Promise<Buffer | null> {
  if (!/^[a-zA-Z0-9_/-]+\.(?:jpe?g|png|webp)$/i.test(storageKey) || storageKey.startsWith("/") || storageKey.split("/").includes("..")) throw new TicketPdfError("INVALID_IMAGE_KEY");
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new TicketPdfError("IMAGE_LOADER_NOT_CONFIGURED");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(15000) }) } });
  const bucket = client.storage.from(process.env.SUPABASE_EVENT_BUCKET || "event-images");
  const info = await bucket.info(storageKey);
  if (info.error || !info.data || !info.data.size || info.data.size > MAX_IMAGE_BYTES) throw new TicketPdfError("EVENT_IMAGE_NOT_FOUND");
  const { data, error } = await bucket.download(storageKey);
  if (error || !data || data.size > MAX_IMAGE_BYTES) throw new TicketPdfError("EVENT_IMAGE_NOT_FOUND");
  return sharp(Buffer.from(await data.arrayBuffer()), { limitInputPixels: 25000000 }).rotate().resize({ width: 1400, height: 800, fit: "cover", withoutEnlargement: true }).png().toBuffer();
}
