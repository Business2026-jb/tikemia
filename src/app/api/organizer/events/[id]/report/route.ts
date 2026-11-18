import { getPlatformPrisma } from "@/lib/payments/fulfillment";
import { currencyDecimals, currencySymbol } from "@/i18n/config";

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";

import { PrismaClient } from "@/generated/prisma/client";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
} from "pdf-lib";

/* ============================================
   TIKEMIA — RAPPORT PDF D'UN ÉVÉNEMENT

   GET /api/organizer/events/[id]/report

   Le rapport contient :
   - Informations de l'événement
   - Capacité totale
   - Nombre de commandes payées
   - Nombre de billets vendus
   - Nombre de places restantes
   - Chiffre d'affaires brut
   - Ventes par catégorie de billets
   - Date de génération

   Sécurité :
   - Session organisateur obligatoire
   - Session active et non révoquée
   - Email vérifié
   - Rôle ORGANIZER
   - Vérification de la propriété
   - Données provenant de PostgreSQL
   - Aucun acheteur nominatif
   - Aucun résultat fictif

   Format :
   - PDF A4
   - Plusieurs pages si nécessaire
   - Téléchargement PC et mobile
============================================ */


/* ============================================
   CONFIGURATION
============================================ */

const SESSION_COOKIE = "tikemia_organizer_session";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const BATCH_SIZE = 1000;

type Language = "fr" | "en";

type Context = {
  params: Promise<{
    id: string;
  }>;
};

type ReportCategory = {
  id: string;
  name: string;
  price: string;
  capacity: number;
  sold: number;
  remaining: number;
  revenue: bigint;
};

type ReportData = {
  title: string;
  category: string;
  status: string;
  country: string;
  city: string;
  venue: string;
  address: string;
  startDate: Date | null;
  endDate: Date | null;
  currency: string;
  capacity: number;
  orderCount: number;
  ticketsSold: number;
  remaining: number;
  revenue: bigint;
  categories: ReportCategory[];
};

type ErrorKey =
  | "unauthorized"
  | "forbidden"
  | "invalidId"
  | "notFound"
  | "serverError";

const TEXT = {
  fr: {
    unauthorized: "Connexion requise.",
    forbidden: "Accès non autorisé.",
    invalidId: "Identifiant invalide.",
    notFound: "Événement introuvable.",
    serverError: "Impossible de générer le rapport.",

    report: "RAPPORT DE L'ÉVÉNEMENT",
    generated: "Généré le",
    information: "INFORMATIONS DE L'ÉVÉNEMENT",
    location: "Lieu",
    category: "Catégorie",
    status: "Statut",
    startDate: "Début",
    endDate: "Fin",

    summary: "RÉSUMÉ DES VENTES",
    orders: "Commandes payées",
    tickets: "Billets vendus",
    capacity: "Capacité totale",
    remaining: "Places restantes",
    revenue: "Chiffre d'affaires brut",

    breakdown: "VENTES PAR CATÉGORIE",
    ticketName: "Catégorie",
    price: "Prix",
    sold: "Vendus",
    available: "Restants",
    total: "TOTAL",

    note:
      "Ce rapport présente les commandes payées et les ventes enregistrées dans TIKEMIA.",
    financialNote:
      "Les montants représentent des ventes brutes, hors remboursements partiels, frais et retraits.",
    page: "Page",
    noDate: "Non renseignée",
  },

  en: {
    unauthorized: "Authentication required.",
    forbidden: "Access denied.",
    invalidId: "Invalid identifier.",
    notFound: "Event not found.",
    serverError: "Unable to generate the report.",

    report: "EVENT REPORT",
    generated: "Generated on",
    information: "EVENT INFORMATION",
    location: "Location",
    category: "Category",
    status: "Status",
    startDate: "Start",
    endDate: "End",

    summary: "SALES SUMMARY",
    orders: "Paid orders",
    tickets: "Tickets sold",
    capacity: "Total capacity",
    remaining: "Remaining seats",
    revenue: "Gross revenue",

    breakdown: "SALES BY TICKET CATEGORY",
    ticketName: "Category",
    price: "Price",
    sold: "Sold",
    available: "Remaining",
    total: "TOTAL",

    note:
      "This report presents paid orders and recorded ticket sales in TIKEMIA.",
    financialNote:
      "Amounts represent gross sales, excluding partial refunds, fees and withdrawals.",
    page: "Page",
    noDate: "Not specified",
  },
} as const;

/* ============================================
   COULEURS TIKEMIA
============================================ */

const COLORS = {
  navy: rgb(0.025, 0.12, 0.22),
  green: rgb(0.015, 0.48, 0.12),
  brightGreen: rgb(0.12, 0.74, 0.09),
  yellow: rgb(1, 0.79, 0.05),
  text: rgb(0.08, 0.15, 0.23),
  muted: rgb(0.38, 0.44, 0.51),
  light: rgb(0.96, 0.98, 0.97),
  white: rgb(1, 1, 1),
  line: rgb(0.86, 0.89, 0.9),
};

/* ============================================
   PRISMA 7
============================================ */



const getPrisma = getPlatformPrisma;

/* ============================================
   LANGUE ET ERREURS
============================================ */

function getLanguage(request: NextRequest): Language {
  const query = request.nextUrl.searchParams.get(
    "locale"
  );

  if (query === "fr" || query === "en") {
    return query;
  }

  const header =
    request.headers.get("accept-language") ?? "";

  return header.toLowerCase().startsWith("en")
    ? "en"
    : "fr";
}

function errorResponse(
  language: Language,
  key: ErrorKey,
  status: number
) {
  return NextResponse.json(
    {
      success: false,
      message: TEXT[language][key],
    },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}

/* ============================================
   AUTHENTIFICATION

   Le cookie contient le jeton brut.
   PostgreSQL stocke son SHA-256.
============================================ */

async function getOrganizerId(
  request: NextRequest,
  prisma: PrismaClient
): Promise<string | null> {
  const token = request.cookies.get(
    SESSION_COOKIE
  )?.value;

  if (
    !token ||
    !/^[a-f0-9]{64}$/i.test(token)
  ) {
    return null;
  }

  const tokenHash = createHash("sha256")
    .update(token, "utf8")
    .digest("hex");

  const session = await prisma.session.findUnique({
    where: {
      tokenHash,
    },
    select: {
      userId: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt <= new Date()
  ) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.userId,
    },
    select: {
      id: true,
      isActive: true,
      isBlocked: true,
      emailVerifiedAt: true,
      roles: {
        where: {
          role: "ORGANIZER",
        },
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });

  if (
    !user ||
    !user.isActive ||
    user.isBlocked ||
    !user.emailVerifiedAt ||
    user.roles.length === 0
  ) {
    return null;
  }

  return user.id;
}

/* ============================================
   FORMATAGE
============================================ */

function formatNumber(
  value: number,
  language: Language
): string {
  return new Intl.NumberFormat(
    language === "fr" ? "fr-FR" : "en-US"
  ).format(value);
}

function asBigInt(value: unknown): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  const raw = String(value ?? "0");

  // Compatible avec les montants entiers
  // ou les Decimal sans fraction.
  if (!/^-?\d+(?:\.0+)?$/.test(raw)) {
    throw new Error("INVALID_MONEY_VALUE");
  }

  return BigInt(raw.split(".")[0]);
}

function formatMoney(
  value: bigint,
  currency: string,
  language: Language
): string {
  if (value === null) return "\u2014";
  try {
    const amount = BigInt(value);
    const decimals = currencyDecimals(currency);
    const factor = decimals ? 100n : 1n;
    const absolute = amount < 0n ? -amount : amount;
    const whole = new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US").format(absolute / factor);
    const fraction = decimals ? (language === "fr" ? "," : ".") + String(absolute % factor).padStart(2, "0") : "";
    return (amount < 0n ? "-" : "") + whole + fraction + " " + (currencySymbol(currency));
  } catch { return "\u2014"; }
}

function formatDate(
  value: Date | null,
  language: Language
): string {
  if (!value) {
    return TEXT[language].noDate;
  }

  return new Intl.DateTimeFormat(
    language === "fr" ? "fr-FR" : "en-GB",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }
  ).format(value);
}

function safeFileName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 55) || "evenement";
}

/* ============================================
   TEXTE COMPATIBLE AVEC LES POLICES PDF

   Les polices standard PDF ne prennent
   pas en charge tous les caractères
   Unicode, notamment certains emoji.
============================================ */

function pdfSafeText(
  value: unknown,
  font: PDFFont
): string {
  const input = String(value ?? "");

  let output = "";

  for (const character of input) {
    if (
      character === "\n" ||
      character === "\r" ||
      character === "\t"
    ) {
      output += " ";
      continue;
    }

    try {
      font.encodeText(character);
      output += character;
    } catch {
      output += "?";
    }
  }

  return output;
}

/* ============================================
   CONSTRUCTION DU RAPPORT
============================================ */

async function createReportPDF(
  report: ReportData,
  language: Language
): Promise<Uint8Array> {
  const t = TEXT[language];

  const document = await PDFDocument.create();

  document.setTitle(
    `TIKEMIA - ${report.title}`
  );

  document.setAuthor("TIKEMIA");
  document.setSubject("Rapport de ventes");
  document.setCreator("TIKEMIA");

  const regular = await document.embedFont(
    StandardFonts.Helvetica
  );

  const bold = await document.embedFont(
    StandardFonts.HelveticaBold
  );

  let cursorY = PAGE_HEIGHT - MARGIN;
  let page: PDFPage = addPage();

  function addPage() {
    const nextPage = document.addPage([
      PAGE_WIDTH,
      PAGE_HEIGHT,
    ]);

    cursorY = PAGE_HEIGHT - MARGIN;

    nextPage.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 9,
      width: PAGE_WIDTH,
      height: 9,
      color: COLORS.green,
    });

    nextPage.drawRectangle({
      x: PAGE_WIDTH - 108,
      y: PAGE_HEIGHT - 9,
      width: 108,
      height: 9,
      color: COLORS.yellow,
    });
    return nextPage;
  }

  function ensureSpace(height: number) {
    if (cursorY - height < MARGIN + 24) {
      page = addPage();
    }
  }

  function textLine(
    text: string,
    options: {
      size?: number;
      strong?: boolean;
      color?: ReturnType<typeof rgb>;
      x?: number;
      y?: number;
    } = {}
  ) {
    const size = options.size ?? 10;
    const font = options.strong ? bold : regular;

    const safeText = pdfSafeText(
      text,
      font
    );

    page.drawText(safeText, {
      x: options.x ?? MARGIN,
      y: options.y ?? cursorY,
      size,
      font,
      color: options.color ?? COLORS.text,
    });
  }

  function wrapText(
    text: string,
    maxWidth: number,
    size: number,
    font: PDFFont
  ): string[] {
    const safe = pdfSafeText(text, font);
    const words = safe.split(/\s+/).filter(Boolean);

    const lines: string[] = [];
    let current = "";

    for (const word of words) {
      const candidate = current
        ? `${current} ${word}`
        : word;

      if (
        font.widthOfTextAtSize(
          candidate,
          size
        ) <= maxWidth
      ) {
        current = candidate;
        continue;
      }

      if (current) {
        lines.push(current);
        current = "";
      }

      let remaining = word;

      while (
        font.widthOfTextAtSize(
          remaining,
          size
        ) > maxWidth
      ) {
        let length = 1;

        while (
          length < remaining.length &&
          font.widthOfTextAtSize(
            remaining.slice(0, length + 1),
            size
          ) <= maxWidth
        ) {
          length++;
        }

        lines.push(
          remaining.slice(0, length)
        );

        remaining = remaining.slice(length);
      }

      current = remaining;
    }

    if (current) {
      lines.push(current);
    }

    return lines.length > 0 ? lines : [""];
  }

  function paragraph(
    text: string,
    options: {
      size?: number;
      strong?: boolean;
      color?: ReturnType<typeof rgb>;
      spacing?: number;
    } = {}
  ) {
    const size = options.size ?? 10;
    const font = options.strong ? bold : regular;

    const lines = wrapText(
      text,
      CONTENT_WIDTH,
      size,
      font
    );

    const lineHeight = size + 5;

    for (const line of lines) {
      ensureSpace(lineHeight);

      textLine(line, {
        size,
        strong: options.strong,
        color: options.color,
      });

      cursorY -= lineHeight;
    }

    cursorY -= options.spacing ?? 5;
  }

  function sectionTitle(text: string) {
    ensureSpace(42);

    cursorY -= 12;

    page.drawRectangle({
      x: MARGIN,
      y: cursorY - 8,
      width: 4,
      height: 19,
      color: COLORS.brightGreen,
    });

    textLine(text, {
      size: 12,
      strong: true,
      x: MARGIN + 12,
      color: COLORS.navy,
    });

    cursorY -= 26;
  }

  function infoRow(
    label: string,
    value: string
  ) {
    const lines = wrapText(
      value,
      CONTENT_WIDTH - 158,
      10,
      regular
    );

    const rowHeight = Math.max(
      24,
      lines.length * 15 + 7
    );

    ensureSpace(rowHeight);

    page.drawRectangle({
      x: MARGIN,
      y: cursorY - rowHeight + 8,
      width: CONTENT_WIDTH,
      height: rowHeight,
      color: COLORS.light,
    });

    textLine(label, {
      x: MARGIN + 12,
      y: cursorY - 10,
      size: 9,
      strong: true,
      color: COLORS.muted,
    });

    let lineY = cursorY - 10;

    for (const line of lines) {
      textLine(line, {
        x: MARGIN + 158,
        y: lineY,
        size: 10,
        color: COLORS.text,
      });

      lineY -= 15;
    }

    cursorY -= rowHeight + 3;
  }

  function summaryCard(
    label: string,
    value: string
  ) {
    const rowHeight = 38;

    ensureSpace(rowHeight);

    page.drawRectangle({
      x: MARGIN,
      y: cursorY - 28,
      width: CONTENT_WIDTH,
      height: rowHeight,
      color: COLORS.light,
      borderColor: COLORS.line,
      borderWidth: 0.5,
    });

    textLine(label, {
      x: MARGIN + 12,
      y: cursorY - 8,
      size: 10,
      color: COLORS.text,
    });

    const safeValue = pdfSafeText(value, bold);

    const valueWidth = bold.widthOfTextAtSize(
      safeValue,
      11
    );

    textLine(safeValue, {
      x:
        MARGIN +
        CONTENT_WIDTH -
        valueWidth -
        12,
      y: cursorY - 8,
      size: 11,
      strong: true,
      color: COLORS.green,
    });

    cursorY -= rowHeight + 6;
  }

  function tableHeader() {
    ensureSpace(35);

    page.drawRectangle({
      x: MARGIN,
      y: cursorY - 28,
      width: CONTENT_WIDTH,
      height: 32,
      color: COLORS.navy,
    });

    textLine(t.ticketName, {
      x: MARGIN + 10,
      y: cursorY - 16,
      size: 9,
      strong: true,
      color: COLORS.white,
    });

    textLine(t.price, {
      x: MARGIN + 230,
      y: cursorY - 16,
      size: 9,
      strong: true,
      color: COLORS.white,
    });

    textLine(t.sold, {
      x: MARGIN + 350,
      y: cursorY - 16,
      size: 9,
      strong: true,
      color: COLORS.white,
    });

    textLine(t.available, {
      x: MARGIN + 420,
      y: cursorY - 16,
      size: 9,
      strong: true,
      color: COLORS.white,
    });

    cursorY -= 33;
  }

  function categoryRow(
    item: ReportCategory,
    index: number
  ) {
    if (cursorY - 35 < MARGIN + 24) {
      page = addPage();
      tableHeader();
    }

    const rowY = cursorY - 28;

    page.drawRectangle({
      x: MARGIN,
      y: rowY,
      width: CONTENT_WIDTH,
      height: 32,
      color:
        index % 2 === 0
          ? COLORS.light
          : COLORS.white,
    });

    const safeName = pdfSafeText(
      item.name,
      regular
    );

    const nameWidth = 210;

    let visibleName = safeName;

    while (
      visibleName.length > 1 &&
      regular.widthOfTextAtSize(
        visibleName,
        9
      ) > nameWidth
    ) {
      visibleName = visibleName.slice(0, -1);
    }

    textLine(visibleName, {
      x: MARGIN + 10,
      y: cursorY - 16,
      size: 9,
    });

    textLine(
      formatMoney(
        asBigInt(item.price),
        report.currency,
        language
      ),
      {
        x: MARGIN + 230,
        y: cursorY - 16,
        size: 8,
      }
    );

    textLine(
      formatNumber(item.sold, language),
      {
        x: MARGIN + 350,
        y: cursorY - 16,
        size: 9,
        strong: true,
      }
    );

    textLine(
      formatNumber(item.remaining, language),
      {
        x: MARGIN + 420,
        y: cursorY - 16,
        size: 9,
        strong: true,
      }
    );

    cursorY -= 33;
  }

  /* ========================================
     PREMIÈRE PAGE
  ======================================== */


  /* ========================================
     MARQUE
  ======================================== */

  textLine("TIKEMIA", {
    size: 28,
    strong: true,
    color: COLORS.green,
  });

  cursorY -= 30;

  page.drawRectangle({
    x: MARGIN,
    y: cursorY,
    width: CONTENT_WIDTH,
    height: 2,
    color: COLORS.yellow,
  });

  cursorY -= 28;

  textLine(t.report, {
    size: 17,
    strong: true,
    color: COLORS.navy,
  });

  cursorY -= 27;

  paragraph(report.title, {
    size: 15,
    strong: true,
    color: COLORS.green,
    spacing: 8,
  });

  paragraph(
    `${t.generated} : ${formatDate(
      new Date(),
      language
    )}`,
    {
      size: 9,
      color: COLORS.muted,
    }
  );

  /* ========================================
     INFORMATIONS
  ======================================== */

  sectionTitle(t.information);

  infoRow(t.category, report.category);
  infoRow(t.status, report.status);

  infoRow(
    t.location,
    [
      report.venue,
      report.address,
      report.city,
      report.country,
    ]
      .filter(Boolean)
      .join(", ")
  );

  infoRow(
    t.startDate,
    formatDate(report.startDate, language)
  );

  infoRow(
    t.endDate,
    formatDate(report.endDate, language)
  );

  /* ========================================
     RÉSUMÉ FINANCIER
  ======================================== */

  sectionTitle(t.summary);

  summaryCard(
    t.orders,
    formatNumber(report.orderCount, language)
  );

  summaryCard(
    t.tickets,
    formatNumber(report.ticketsSold, language)
  );

  summaryCard(
    t.capacity,
    formatNumber(report.capacity, language)
  );

  summaryCard(
    t.remaining,
    formatNumber(report.remaining, language)
  );

  summaryCard(
    t.revenue,
    formatMoney(
      report.revenue,
      report.currency,
      language
    )
  );

  /* ========================================
     CATÉGORIES DE BILLETS
  ======================================== */

  sectionTitle(t.breakdown);

  tableHeader();

  report.categories.forEach(
    (category, index) => {
      categoryRow(category, index);
    }
  );

  cursorY -= 14;

  paragraph(
    `${t.total} : ${formatNumber(
      report.ticketsSold,
      language
    )} ${t.tickets.toLowerCase()} - ${formatMoney(
      report.revenue,
      report.currency,
      language
    )}`,
    {
      strong: true,
      color: COLORS.green,
      spacing: 10,
    }
  );

  /* ========================================
     NOTES
  ======================================== */

  paragraph(t.note, {
    size: 9,
    color: COLORS.muted,
  });

  paragraph(t.financialNote, {
    size: 9,
    color: COLORS.muted,
  });

  /* ========================================
     PIED DE PAGE
  ======================================== */

  const pages = document.getPages();

  pages.forEach((currentPage, index) => {
    currentPage.drawLine({
      start: {
        x: MARGIN,
        y: 48,
      },
      end: {
        x: PAGE_WIDTH - MARGIN,
        y: 48,
      },
      thickness: 0.7,
      color: COLORS.line,
    });

    const footerText =
      `TIKEMIA  |  ${t.page} ${
        index + 1
      } / ${pages.length}`;

    currentPage.drawText(
      pdfSafeText(footerText, regular),
      {
        x: MARGIN,
        y: 32,
        size: 8,
        font: regular,
        color: COLORS.muted,
      }
    );
  });

  return document.save();
}

/* ============================================
   GET — TÉLÉCHARGER LE RAPPORT
============================================ */

export async function GET(
  request: NextRequest,
  context: Context
) {
  const language = getLanguage(request);

  try {
    /* --------------------------------------
       1. SESSION
    -------------------------------------- */

    const prisma = getPrisma();

    const organizerId = await getOrganizerId(
      request,
      prisma
    );

    if (!organizerId) {
      return errorResponse(
        language,
        "unauthorized",
        401
      );
    }

    /* --------------------------------------
       2. IDENTIFIANT
    -------------------------------------- */

    const { id } = await context.params;

    if (
      !id ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      return errorResponse(
        language,
        "invalidId",
        400
      );
    }

    /* --------------------------------------
       3. CHARGER L'ÉVÉNEMENT

       Vérifier simultanément :
       - Identifiant
       - Organisation propriétaire
       - Compte organisateur
    -------------------------------------- */

    const event = await prisma.event.findFirst({
      where: {
        id,

        organization: {
          ownerId: organizerId,
        },
      },

      select: {
        id: true,
        title: true,
        category: true,
        status: true,
        capacity: true,
        currency: true,

        venue: {
          select: {
            name: true,
            address: true,
            city: true,
            country: true,
          },
        },

        schedules: {
          orderBy: {
            startsAt: "asc",
          },
          select: {
            startsAt: true,
            endsAt: true,
          },
          take: 1,
        },

        categories: {
          select: {
            id: true,
            name: true,
            price: true,
            capacity: true,
          },
          orderBy: {
            name: "asc",
          },
        },
      },
    });

    if (!event) {
      return errorResponse(
        language,
        "notFound",
        404
      );
    }

    /* --------------------------------------
       4. LIRE LES VENTES PAYÉES

       Le rapport couvre toutes les
       ventes payées depuis la création
       de l'événement.

       Les commandes non payées sont
       exclues.

       Le traitement se fait par lots
       pour éviter une seule requête
       contenant toutes les lignes.
    -------------------------------------- */

    const soldByCategory =
      new Map<string, {
        quantity: number;
        revenue: bigint;
      }>();

    const uniqueOrderIds =
      new Set<string>();

    let ticketsSold = 0;
    let revenue = BigInt(0);

    let cursor: string | undefined;

    while (true) {
      const lines = await prisma.orderLine.findMany({
        where: {
          eventId: event.id,
          currency: event.currency,

          order: {
            status: "PAID",
            currency: event.currency,
          },
        },

        take: BATCH_SIZE,

        ...(cursor
          ? {
              cursor: {
                id: cursor,
              },
              skip: 1,
            }
          : {}),

        orderBy: {
          id: "asc",
        },

        select: {
          id: true,
          orderId: true,
          ticketCategoryId: true,
          quantity: true,
          subtotal: true,
        },
      });

      if (lines.length === 0) {
        break;
      }

      for (const line of lines) {
        const quantity = line.quantity;

        if (
          !Number.isSafeInteger(quantity) ||
          quantity < 0
        ) {
          throw new Error(
            "INVALID_TICKET_QUANTITY"
          );
        }

        const amount = asBigInt(
          line.subtotal
        );

        uniqueOrderIds.add(
          line.orderId
        );

        ticketsSold += quantity;
        revenue += amount;

        if (
          !Number.isSafeInteger(ticketsSold)
        ) {
          throw new Error(
            "TICKET_COUNT_OVERFLOW"
          );
        }

        const categoryId =
          line.ticketCategoryId ?? "";

        const previous =
          soldByCategory.get(categoryId) ?? {
            quantity: 0,
            revenue: BigInt(0),
          };

        soldByCategory.set(
          categoryId,
          {
            quantity:
              previous.quantity + quantity,

            revenue:
              previous.revenue + amount,
          }
        );
      }

      cursor =
        lines[lines.length - 1].id;

      if (lines.length < BATCH_SIZE) {
        break;
      }
    }

    /* --------------------------------------
       5. CATÉGORIES DES BILLETS
    -------------------------------------- */

    const categories: ReportCategory[] =
      event.categories.map(
        (category) => {
          const sales =
            soldByCategory.get(
              category.id
            );

          const sold =
            sales?.quantity ?? 0;

          return {
            id: category.id,
            name: category.name,
            price: String(category.price),
            capacity: category.capacity,
            sold,
            remaining: Math.max(
              0,
              category.capacity - sold
            ),
            revenue:
              sales?.revenue ?? BigInt(0),
          };
        }
      );

    /* --------------------------------------
       6. CONSTRUIRE LE RAPPORT

       Les places restantes correspondent
       ici à la capacité moins les billets
       payés, sans intégrer les réservations
       temporaires.
    -------------------------------------- */

    const report: ReportData = {
      title: event.title,
      category: event.category,
      status: event.status,

      country:
        event.venue?.country ?? "",

      city:
        event.venue?.city ?? "",

      venue:
        event.venue?.name ?? "",

      address:
        event.venue?.address ?? "",

      startDate:
        event.schedules[0]?.startsAt ??
        null,

      endDate:
        event.schedules[0]?.endsAt ??
        null,

      currency: event.currency,
      capacity: event.capacity,

      orderCount:
        uniqueOrderIds.size,

      ticketsSold,

      remaining: Math.max(
        0,
        event.capacity - ticketsSold
      ),

      revenue,

      categories,
    };

    /* --------------------------------------
       7. GÉNÉRER LE PDF
    -------------------------------------- */

    const pdfBytes = await createReportPDF(
      report,
      language
    );

    /* --------------------------------------
       8. NOM DU FICHIER
    -------------------------------------- */

    const filename =
      `TIKEMIA-rapport-${safeFileName(
        event.title
      )}.pdf`;

    /* --------------------------------------
       9. TÉLÉCHARGEMENT SÉCURISÉ
    -------------------------------------- */

    return new NextResponse(
      new Uint8Array(pdfBytes),
      {
        status: 200,

        headers: {
          "Content-Type": "application/pdf",

          "Content-Disposition":
            `attachment; filename="${filename}"`,

          "Content-Length":
            String(pdfBytes.length),

          "Cache-Control":
            "private, no-store, max-age=0",

          "X-Content-Type-Options":
            "nosniff",

          "Vary": "Cookie",
        },
      }
    );
  } catch (error) {
    console.error(
      "[TIKEMIA EVENT REPORT]",
      error instanceof Error
        ? error.message
        : "Unknown error"
    );

    return errorResponse(
      language,
      "serverError",
      503
    );
  }
}
