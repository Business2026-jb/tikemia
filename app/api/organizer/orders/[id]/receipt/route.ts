import { createHash } from "node:crypto";

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
  formatMoney,
} from "@/lib/localization/format-money";
import {
  getOrganizerOrderDetails,
  GetOrganizerOrderDetailsError,
  type OrganizerOrderDetails,
} from "@/lib/organizer/get-organizer-order-details";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ConnectedOrganizer = {
  id: string;
  email: string;
};

type ReceiptFonts = {
  regular: PDFFont;
  bold: PDFFont;
};

type ReceiptContext = {
  document: PDFDocument;
  page: PDFPage;
  fonts: ReceiptFonts;
  order: OrganizerOrderDetails;
  currentY: number;
  pageNumber: number;
};

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const PDF_MIME_TYPE =
  "application/pdf";

const PAGE_WIDTH =
  595.28;

const PAGE_HEIGHT =
  841.89;

const MARGIN_X =
  42;

const MARGIN_TOP =
  42;

const MARGIN_BOTTOM =
  44;

const HEADER_HEIGHT =
  78;

const FOOTER_HEIGHT =
  28;

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

class OrganizerOrderReceiptRouteError extends Error {
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
      "OrganizerOrderReceiptRouteError";

    this.code =
      code;

    this.status =
      status;
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
  value:
    | string
    | null
    | undefined,
  fallback = "",
): string {
  const normalized =
    value
      ?.replace(/\u0000/g, "")
      .replace(/\s+/g, " ")
      .trim() ??
    "";

  return normalized || fallback;
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
        "long",

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
  ).format(date);
}

function formatStatus(
  value: string,
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

  return labels[value] ?? value;
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

  return normalized || fallback;
}

function createContentDisposition(
  filename: string,
): string {
  const safeFilename =
    filename
      .replace(/[\r\n"]/g, "")
      .trim();

  const asciiFilename =
    safeFilename
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .replace(
        /[^\x20-\x7E]/g,
        "",
      )
      .replace(
        /[\\/:*?<>|]/g,
        "-",
      ) ||
    "tikemia-recu-commande.pdf";

  const encodedFilename =
    encodeURIComponent(
      safeFilename,
    ).replace(
      /['()]/g,
      escape,
    );

  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`;
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
      success:
        false,

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
    output.length > 0 &&
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

  return output
    ? `${output}${suffix}`
    : suffix;
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
    normalizeText(text);

  if (!normalized) {
    return [""];
  }

  const words =
    normalized.split(" ");

  const lines: string[] = [];

  let line =
    "";

  for (const word of words) {
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
      lines.push(line);
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
      const character of word
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
          lines.push(fragment);
        }

        fragment =
          character;
      }
    }

    line =
      fragment;
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

function drawText({
  page,
  text,
  x,
  y,
  font,
  size = 9,
  color = COLORS.text,
  maxWidth,
}: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  font: PDFFont;
  size?: number;
  color?: ReturnType<
    typeof rgb
  >;
  maxWidth?: number;
}): void {
  const normalized =
    normalizeText(text);

  const safeText =
    maxWidth
      ? truncateText({
          text:
            normalized,
          font,
          size,
          maxWidth,
        })
      : normalized;

  page.drawText(
    safeText,
    {
      x,
      y,
      font,
      size,
      color,
    },
  );
}

function drawWrappedText({
  page,
  text,
  x,
  y,
  font,
  size = 9,
  color = COLORS.text,
  maxWidth,
  lineHeight = 12,
}: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  font: PDFFont;
  size?: number;
  color?: ReturnType<
    typeof rgb
  >;
  maxWidth: number;
  lineHeight?: number;
}): number {
  const lines =
    wrapText({
      text,
      font,
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
          font,
          size,
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

function drawPanel({
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

function drawHeader(
  context: ReceiptContext,
): void {
  const {
    page,
    fonts,
    order,
  } = context;

  page.drawRectangle({
    x:
      0,
    y:
      PAGE_HEIGHT -
      HEADER_HEIGHT -
      MARGIN_TOP +
      12,
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

  drawText({
    page,
    text:
      "TIKEMIA",
    x:
      MARGIN_X,
    y:
      PAGE_HEIGHT -
      MARGIN_TOP -
      32,
    font:
      fonts.bold,
    size:
      20,
    color:
      COLORS.white,
  });

  drawText({
    page,
    text:
      "Reçu de commande",
    x:
      MARGIN_X +
      116,
    y:
      PAGE_HEIGHT -
      MARGIN_TOP -
      28,
    font:
      fonts.bold,
    size:
      13,
    color:
      COLORS.text,
  });

  drawText({
    page,
    text:
      order.reference,
    x:
      MARGIN_X +
      116,
    y:
      PAGE_HEIGHT -
      MARGIN_TOP -
      45,
    font:
      fonts.regular,
    size:
      8.5,
    color:
      COLORS.muted,
  });

  const statusLabel =
    formatStatus(
      order.status,
    );

  const statusWidth =
    fonts.bold.widthOfTextAtSize(
      statusLabel,
      8.5,
    );

  drawText({
    page,
    text:
      statusLabel,
    x:
      PAGE_WIDTH -
      MARGIN_X -
      statusWidth,
    y:
      PAGE_HEIGHT -
      MARGIN_TOP -
      28,
    font:
      fonts.bold,
    size:
      8.5,
    color:
      getStatusColor(
        order.status,
      ),
  });

  const generatedLabel =
    `Généré le ${formatDateTime(
      new Date().toISOString(),
    )}`;

  const generatedWidth =
    fonts.regular.widthOfTextAtSize(
      generatedLabel,
      7.5,
    );

  drawText({
    page,
    text:
      generatedLabel,
    x:
      PAGE_WIDTH -
      MARGIN_X -
      generatedWidth,
    y:
      PAGE_HEIGHT -
      MARGIN_TOP -
      45,
    font:
      fonts.regular,
    size:
      7.5,
    color:
      COLORS.muted,
  });
}

function drawFooter(
  context: ReceiptContext,
): void {
  const {
    page,
    fonts,
    pageNumber,
  } = context;

  page.drawLine({
    start: {
      x:
        MARGIN_X,
      y:
        MARGIN_BOTTOM +
        FOOTER_HEIGHT -
        3,
    },

    end: {
      x:
        PAGE_WIDTH -
        MARGIN_X,
      y:
        MARGIN_BOTTOM +
        FOOTER_HEIGHT -
        3,
    },

    thickness:
      0.7,

    color:
      COLORS.border,
  });

  drawText({
    page,
    text:
      "Document confidentiel — Espace organisateur Tikemia",
    x:
      MARGIN_X,
    y:
      MARGIN_BOTTOM +
      7,
    font:
      fonts.regular,
    size:
      7.5,
    color:
      COLORS.muted,
  });

  const pageLabel =
    `Page ${pageNumber}`;

  const pageWidth =
    fonts.regular.widthOfTextAtSize(
      pageLabel,
      7.5,
    );

  drawText({
    page,
    text:
      pageLabel,
    x:
      PAGE_WIDTH -
      MARGIN_X -
      pageWidth,
    y:
      MARGIN_BOTTOM +
      7,
    font:
      fonts.regular,
    size:
      7.5,
    color:
      COLORS.muted,
  });
}

function createPage(
  context: ReceiptContext,
): void {
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

  context.page =
    page;

  context.pageNumber +=
    1;

  context.currentY =
    CONTENT_TOP;

  drawHeader(
    context,
  );
}

function ensureSpace(
  context: ReceiptContext,
  requiredHeight: number,
): void {
  if (
    context.currentY -
      requiredHeight <
    CONTENT_BOTTOM
  ) {
    drawFooter(
      context,
    );

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
  context: ReceiptContext;
  title: string;
  subtitle?: string;
}): void {
  ensureSpace(
    context,
    subtitle
      ? 38
      : 24,
  );

  context.page.drawRectangle({
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

  drawText({
    page:
      context.page,
    text:
      title,
    x:
      MARGIN_X +
      12,
    y:
      context.currentY,
    font:
      context.fonts.bold,
    size:
      12.5,
    color:
      COLORS.white,
  });

  context.currentY -=
    18;

  if (subtitle) {
    drawWrappedText({
      page:
        context.page,
      text:
        subtitle,
      x:
        MARGIN_X +
        12,
      y:
        context.currentY,
      font:
        context.fonts.regular,
      size:
        8,
      color:
        COLORS.muted,
      maxWidth:
        PAGE_WIDTH -
        MARGIN_X *
          2 -
        12,
      lineHeight:
        10,
    });

    context.currentY -=
      20;
  } else {
    context.currentY -=
      8;
  }
}

function drawOrderOverview(
  context: ReceiptContext,
): void {
  const {
    order,
    page,
    fonts,
  } = context;

  drawSectionTitle({
    context,
    title:
      "Résumé de la commande",
    subtitle:
      "Informations principales de la transaction.",
  });

  const gap =
    10;

  const cardWidth =
    (
      PAGE_WIDTH -
      MARGIN_X *
        2 -
      gap *
        2
    ) /
    3;

  const cardHeight =
    64;

  const cards = [
    {
      label:
        "Statut",
      value:
        formatStatus(
          order.status,
        ),
      color:
        getStatusColor(
          order.status,
        ),
    },
    {
      label:
        "Total facturé",
      value:
        formatMoney({
          amount:
            order.total,
          currency:
            order.currency,
        }),
      color:
        COLORS.white,
    },
    {
      label:
        "Net organisateur",
      value:
        formatMoney({
          amount:
            order.organizerNet,
          currency:
            order.currency,
        }),
      color:
        COLORS.green,
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
            gap
          );

      drawPanel({
        page,
        x,
        y:
          context.currentY,
        width:
          cardWidth,
        height:
          cardHeight,
      });

      drawText({
        page,
        text:
          card.label,
        x:
          x +
          12,
        y:
          context.currentY -
          18,
        font:
          fonts.regular,
        size:
          8,
        color:
          COLORS.muted,
        maxWidth:
          cardWidth -
          24,
      });

      drawText({
        page,
        text:
          card.value,
        x:
          x +
          12,
        y:
          context.currentY -
          43,
        font:
          fonts.bold,
        size:
          13,
        color:
          card.color,
        maxWidth:
          cardWidth -
          24,
      });
    },
  );

  context.currentY -=
    cardHeight +
    18;
}

function drawPartyInformation(
  context: ReceiptContext,
): void {
  const {
    order,
    page,
    fonts,
  } = context;

  drawSectionTitle({
    context,
    title:
      "Parties concernées",
  });

  const gap =
    12;

  const panelWidth =
    (
      PAGE_WIDTH -
      MARGIN_X *
        2 -
      gap
    ) /
    2;

  const panelHeight =
    118;

  ensureSpace(
    context,
    panelHeight +
      8,
  );

  drawPanel({
    page,
    x:
      MARGIN_X,
    y:
      context.currentY,
    width:
      panelWidth,
    height:
      panelHeight,
  });

  drawText({
    page,
    text:
      "Organisateur",
    x:
      MARGIN_X +
      12,
    y:
      context.currentY -
      18,
    font:
      fonts.bold,
    size:
      9,
    color:
      COLORS.green,
  });

  const organizerName =
    order.organizer.profile
      ?.businessName ??
    order.organizer.fullName;

  drawText({
    page,
    text:
      organizerName,
    x:
      MARGIN_X +
      12,
    y:
      context.currentY -
      38,
    font:
      fonts.bold,
    size:
      10,
    color:
      COLORS.white,
    maxWidth:
      panelWidth -
      24,
  });

  drawText({
    page,
    text:
      order.organizer.email,
    x:
      MARGIN_X +
      12,
    y:
      context.currentY -
      56,
    font:
      fonts.regular,
    size:
      8,
    color:
      COLORS.text,
    maxWidth:
      panelWidth -
      24,
  });

  drawText({
    page,
    text:
      "Plateforme : Tikemia",
    x:
      MARGIN_X +
      12,
    y:
      context.currentY -
      74,
    font:
      fonts.regular,
    size:
      8,
    color:
      COLORS.muted,
  });

  drawText({
    page,
    text:
      "Reçu généré depuis l’espace organisateur",
    x:
      MARGIN_X +
      12,
    y:
      context.currentY -
      92,
    font:
      fonts.regular,
    size:
      7.5,
    color:
      COLORS.muted,
    maxWidth:
      panelWidth -
      24,
  });

  const customerX =
    MARGIN_X +
    panelWidth +
    gap;

  drawPanel({
    page,
    x:
      customerX,
    y:
      context.currentY,
    width:
      panelWidth,
    height:
      panelHeight,
  });

  drawText({
    page,
    text:
      "Acheteur",
    x:
      customerX +
      12,
    y:
      context.currentY -
      18,
    font:
      fonts.bold,
    size:
      9,
    color:
      COLORS.blue,
  });

  drawText({
    page,
    text:
      normalizeText(
        order.customer.name,
        "Acheteur Tikemia",
      ),
    x:
      customerX +
      12,
    y:
      context.currentY -
      38,
    font:
      fonts.bold,
    size:
      10,
    color:
      COLORS.white,
    maxWidth:
      panelWidth -
      24,
  });

  drawText({
    page,
    text:
      normalizeText(
        order.customer.email,
        "E-mail non renseigné",
      ),
    x:
      customerX +
      12,
    y:
      context.currentY -
      56,
    font:
      fonts.regular,
    size:
      8,
    color:
      COLORS.text,
    maxWidth:
      panelWidth -
      24,
  });

  drawText({
    page,
    text:
      normalizeText(
        order.customer.phone,
        "Téléphone non renseigné",
      ),
    x:
      customerX +
      12,
    y:
      context.currentY -
      74,
    font:
      fonts.regular,
    size:
      8,
    color:
      COLORS.text,
    maxWidth:
      panelWidth -
      24,
  });

  drawText({
    page,
    text:
      order.customer.country
        ? `${order.customer.country}${
            order.customer.countryCode
              ? ` (${order.customer.countryCode})`
              : ""
          }`
        : order.customer.isGuest
          ? "Client invité"
          : "Pays non renseigné",
    x:
      customerX +
      12,
    y:
      context.currentY -
      92,
    font:
      fonts.regular,
    size:
      8,
    color:
      COLORS.muted,
    maxWidth:
      panelWidth -
      24,
  });

  context.currentY -=
    panelHeight +
    18;
}

function drawEventInformation(
  context: ReceiptContext,
): void {
  const {
    order,
    page,
    fonts,
  } = context;

  drawSectionTitle({
    context,
    title:
      "Événement",
  });

  const panelHeight =
    112;

  ensureSpace(
    context,
    panelHeight +
      8,
  );

  drawPanel({
    page,
    x:
      MARGIN_X,
    y:
      context.currentY,
    width:
      PAGE_WIDTH -
      MARGIN_X *
        2,
    height:
      panelHeight,
  });

  drawText({
    page,
    text:
      order.event.title,
    x:
      MARGIN_X +
      14,
    y:
      context.currentY -
      20,
    font:
      fonts.bold,
    size:
      11,
    color:
      COLORS.white,
    maxWidth:
      PAGE_WIDTH -
      MARGIN_X *
        2 -
      28,
  });

  drawText({
    page,
    text:
      `Début : ${formatDateTime(
        order.event.startsAt,
      )}`,
    x:
      MARGIN_X +
      14,
    y:
      context.currentY -
      42,
    font:
      fonts.regular,
    size:
      8.5,
    color:
      COLORS.text,
    maxWidth:
      PAGE_WIDTH -
      MARGIN_X *
        2 -
      28,
  });

  drawText({
    page,
    text:
      `Fin : ${formatDateTime(
        order.event.endsAt,
      )}`,
    x:
      MARGIN_X +
      14,
    y:
      context.currentY -
      60,
    font:
      fonts.regular,
    size:
      8.5,
    color:
      COLORS.text,
    maxWidth:
      PAGE_WIDTH -
      MARGIN_X *
        2 -
      28,
  });

  drawText({
    page,
    text:
      `Lieu : ${order.event.venueName}, ${order.event.address}, ${order.event.city}, ${order.event.country}`,
    x:
      MARGIN_X +
      14,
    y:
      context.currentY -
      78,
    font:
      fonts.regular,
    size:
      8.5,
    color:
      COLORS.muted,
    maxWidth:
      PAGE_WIDTH -
      MARGIN_X *
        2 -
      28,
  });

  drawText({
    page,
    text:
      `Devise : ${order.currency}`,
    x:
      MARGIN_X +
      14,
    y:
      context.currentY -
      96,
    font:
      fonts.bold,
    size:
      8.5,
    color:
      COLORS.orange,
  });

  context.currentY -=
    panelHeight +
    18;
}

function drawItemsTableHeader(
  context: ReceiptContext,
): void {
  const columns = [
    {
      label:
        "Type de billet",
      width:
        190,
    },
    {
      label:
        "Qté",
      width:
        42,
    },
    {
      label:
        "Prix unitaire",
      width:
        88,
    },
    {
      label:
        "Commission",
      width:
        88,
    },
    {
      label:
        "Total",
      width:
        105,
    },
  ];

  let x =
    MARGIN_X;

  const height =
    25;

  columns.forEach(
    (
      column,
    ) => {
      context.page.drawRectangle({
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

      drawText({
        page:
          context.page,
        text:
          column.label,
        x:
          x +
          6,
        y:
          context.currentY -
          16,
        font:
          context.fonts.bold,
        size:
          7.5,
        color:
          COLORS.text,
        maxWidth:
          column.width -
          12,
      });

      x +=
        column.width;
    },
  );

  context.currentY -=
    height;
}

function drawItems(
  context: ReceiptContext,
): void {
  const {
    order,
  } = context;

  drawSectionTitle({
    context,
    title:
      "Articles de la commande",
    subtitle:
      "Détail des billets achetés et des montants associés.",
  });

  drawItemsTableHeader(
    context,
  );

  const columns = [
    190,
    42,
    88,
    88,
    105,
  ];

  order.items.forEach(
    (
      item,
      index,
    ) => {
      const rowHeight =
        34;

      ensureSpace(
        context,
        rowHeight +
          26,
      );

      if (
        context.currentY ===
        CONTENT_TOP
      ) {
        drawSectionTitle({
          context,
          title:
            "Articles de la commande",
          subtitle:
            "Suite du détail des billets.",
        });

        drawItemsTableHeader(
          context,
        );
      }

      const values = [
        item.ticketTypeName,
        item.quantity.toLocaleString(
          "fr-FR",
        ),
        formatMoney({
          amount:
            item.unitPrice,
          currency:
            order.currency,
        }),
        formatMoney({
          amount:
            item.platformFee,
          currency:
            order.currency,
        }),
        formatMoney({
          amount:
            item.total,
          currency:
            order.currency,
        }),
      ];

      let x =
        MARGIN_X;

      values.forEach(
        (
          value,
          columnIndex,
        ) => {
          context.page.drawRectangle({
            x,
            y:
              context.currentY -
              rowHeight,
            width:
              columns[
                columnIndex
              ],
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

          drawText({
            page:
              context.page,
            text:
              value,
            x:
              x +
              6,
            y:
              context.currentY -
              21,
            font:
              columnIndex ===
                4
                ? context.fonts.bold
                : context.fonts.regular,
            size:
              7.7,
            color:
              columnIndex ===
                3
                ? COLORS.orange
                : columnIndex ===
                    4
                  ? COLORS.green
                  : COLORS.text,
            maxWidth:
              columns[
                columnIndex
              ] -
              12,
          });

          x +=
            columns[
              columnIndex
            ];
        },
      );

      context.currentY -=
        rowHeight;
    },
  );

  context.currentY -=
    16;
}

function drawPaymentAndTotals(
  context: ReceiptContext,
): void {
  const {
    order,
    page,
    fonts,
  } = context;

  drawSectionTitle({
    context,
    title:
      "Paiement et totaux",
  });

  const gap =
    12;

  const panelWidth =
    (
      PAGE_WIDTH -
      MARGIN_X *
        2 -
      gap
    ) /
    2;

  const panelHeight =
    150;

  ensureSpace(
    context,
    panelHeight +
      8,
  );

  drawPanel({
    page,
    x:
      MARGIN_X,
    y:
      context.currentY,
    width:
      panelWidth,
    height:
      panelHeight,
  });

  drawText({
    page,
    text:
      "Paiement",
    x:
      MARGIN_X +
      12,
    y:
      context.currentY -
      18,
    font:
      fonts.bold,
    size:
      9,
    color:
      COLORS.blue,
  });

  const paymentRows = order.payment
    ? [
        [
          "Statut",
          formatStatus(
            order.payment.status,
          ),
        ],
        [
          "Prestataire",
          normalizeText(
            order.payment.provider,
            "Non renseigné",
          ),
        ],
        [
          "Moyen",
          normalizeText(
            order.payment.method,
            "Non renseigné",
          ),
        ],
        [
          "Référence",
          normalizeText(
            order.payment.providerReference,
            "Non disponible",
          ),
        ],
        [
          "Montant",
          formatMoney({
            amount:
              order.payment.amount,
            currency:
              order.payment.currency,
          }),
        ],
        [
          "Payé le",
          formatDateTime(
            order.payment.paidAt,
          ),
        ],
      ]
    : [
        [
          "Statut",
          "Aucun paiement associé",
        ],
      ];

  paymentRows.forEach(
    (
      row,
      index,
    ) => {
      drawText({
        page,
        text:
          row[0],
        x:
          MARGIN_X +
          12,
        y:
          context.currentY -
          42 -
          index *
            18,
        font:
          fonts.regular,
        size:
          7.5,
        color:
          COLORS.muted,
        maxWidth:
          76,
      });

      drawText({
        page,
        text:
          row[1],
        x:
          MARGIN_X +
          94,
        y:
          context.currentY -
          42 -
          index *
            18,
        font:
          fonts.bold,
        size:
          7.5,
        color:
          index ===
            0 &&
          order.payment
            ? getStatusColor(
                order.payment.status,
              )
            : COLORS.text,
        maxWidth:
          panelWidth -
          106,
      });
    },
  );

  const totalsX =
    MARGIN_X +
    panelWidth +
    gap;

  drawPanel({
    page,
    x:
      totalsX,
    y:
      context.currentY,
    width:
      panelWidth,
    height:
      panelHeight,
  });

  drawText({
    page,
    text:
      "Totaux",
    x:
      totalsX +
      12,
    y:
      context.currentY -
      18,
    font:
      fonts.bold,
    size:
      9,
    color:
      COLORS.green,
  });

  const totalsRows = [
    [
      "Sous-total",
      formatMoney({
        amount:
          order.subtotal,
        currency:
          order.currency,
      }),
      COLORS.text,
    ],
    [
      "Commission Tikemia",
      formatMoney({
        amount:
          order.platformFee,
        currency:
          order.currency,
      }),
      COLORS.orange,
    ],
    [
      "Total facturé",
      formatMoney({
        amount:
          order.total,
        currency:
          order.currency,
      }),
      COLORS.white,
    ],
    [
      "Net organisateur",
      formatMoney({
        amount:
          order.organizerNet,
        currency:
          order.currency,
      }),
      COLORS.green,
    ],
  ] as const;

  totalsRows.forEach(
    (
      row,
      index,
    ) => {
      const y =
        context.currentY -
        45 -
        index *
          25;

      drawText({
        page,
        text:
          row[0],
        x:
          totalsX +
          12,
        y,
        font:
          index ===
            totalsRows.length -
              1
            ? fonts.bold
            : fonts.regular,
        size:
          8,
        color:
          COLORS.muted,
        maxWidth:
          100,
      });

      const valueWidth =
        fonts.bold.widthOfTextAtSize(
          row[1],
          index ===
            totalsRows.length -
              1
            ? 10
            : 8.5,
        );

      drawText({
        page,
        text:
          row[1],
        x:
          totalsX +
          panelWidth -
          12 -
          valueWidth,
        y,
        font:
          fonts.bold,
        size:
          index ===
            totalsRows.length -
              1
            ? 10
            : 8.5,
        color:
          row[2],
      });
    },
  );

  context.currentY -=
    panelHeight +
    18;
}

function drawIntegrityNotice(
  context: ReceiptContext,
): void {
  const {
    order,
    page,
    fonts,
  } = context;

  const isValid =
    !order.integrity
      .hasFinancialInconsistency;

  const panelHeight =
    60;

  ensureSpace(
    context,
    panelHeight +
      8,
  );

  drawPanel({
    page,
    x:
      MARGIN_X,
    y:
      context.currentY,
    width:
      PAGE_WIDTH -
      MARGIN_X *
        2,
    height:
      panelHeight,
    fill:
      isValid
        ? rgb(
            0.05,
            0.13,
            0.07,
          )
        : rgb(
            0.16,
            0.06,
            0.05,
          ),
    border:
      isValid
        ? COLORS.green
        : COLORS.red,
  });

  drawText({
    page,
    text:
      isValid
        ? "Contrôle d’intégrité conforme"
        : "Vérification interne requise",
    x:
      MARGIN_X +
      12,
    y:
      context.currentY -
      20,
    font:
      fonts.bold,
    size:
      9,
    color:
      isValid
        ? COLORS.green
        : COLORS.red,
  });

  drawWrappedText({
    page,
    text:
      isValid
        ? "La devise de l’événement, la devise du paiement, le montant payé et les quantités de billets sont cohérents avec la commande."
        : "Une différence a été détectée entre la commande, le paiement, l’événement ou les billets. Une vérification est recommandée.",
    x:
      MARGIN_X +
      12,
    y:
      context.currentY -
      38,
    font:
      fonts.regular,
    size:
      7.7,
    color:
      COLORS.text,
    maxWidth:
      PAGE_WIDTH -
      MARGIN_X *
        2 -
      24,
    lineHeight:
      10,
  });

  context.currentY -=
    panelHeight +
    14;
}

async function getConnectedOrganizer(): Promise<ConnectedOrganizer> {
  const cookieStore =
    await cookies();

  const sessionCookieName =
    process.env.SESSION_COOKIE_NAME?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;

  const sessionToken =
    cookieStore.get(
      sessionCookieName,
    )?.value;

  if (!sessionToken) {
    throw new OrganizerOrderReceiptRouteError({
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
        id:
          true,

        expiresAt:
          true,

        user: {
          select: {
            id:
              true,

            email:
              true,

            role:
              true,

            emailVerified:
              true,

            isActive:
              true,
          },
        },
      },
    });

  if (!session) {
    throw new OrganizerOrderReceiptRouteError({
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
            "[ORDER_RECEIPT_EXPIRED_SESSION_DELETE_ERROR]",
            error instanceof Error
              ? error.message
              : error,
          );
        },
      );

    throw new OrganizerOrderReceiptRouteError({
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
    throw new OrganizerOrderReceiptRouteError({
      code:
        "FORBIDDEN",

      status:
        403,

      message:
        "Ce compte n’est pas autorisé à télécharger ce reçu.",
    });
  }

  return {
    id:
      organizer.id,

    email:
      organizer.email,
  };
}

async function createReceiptPdf(
  order: OrganizerOrderDetails,
): Promise<{
  buffer: Buffer;
  pageCount: number;
}> {
  const document =
    await PDFDocument.create();

  const fonts: ReceiptFonts = {
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
    `Reçu Tikemia — ${order.reference}`,
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
    "Reçu de commande organisateur",
  );

  document.setKeywords([
    "Tikemia",
    "commande",
    "reçu",
    "billets",
    "paiement",
  ]);

  document.setCreationDate(
    new Date(),
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

  const context: ReceiptContext = {
    document,
    page:
      firstPage,
    fonts,
    order,
    currentY:
      CONTENT_TOP,
    pageNumber:
      1,
  };

  drawHeader(
    context,
  );

  drawOrderOverview(
    context,
  );

  drawPartyInformation(
    context,
  );

  drawEventInformation(
    context,
  );

  drawItems(
    context,
  );

  drawPaymentAndTotals(
    context,
  );

  drawIntegrityNotice(
    context,
  );

  drawFooter(
    context,
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

  return {
    buffer:
      Buffer.from(
        bytes,
      ),

    pageCount:
      context.pageNumber,
  };
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const organizer =
      await getConnectedOrganizer();

    const {
      id,
    } =
      await context.params;

    const orderId =
      id?.trim();

    if (!orderId) {
      throw new OrganizerOrderReceiptRouteError({
        code:
          "ORDER_ID_REQUIRED",

        status:
          400,

        message:
          "L’identifiant de la commande est obligatoire.",
      });
    }

    const {
      order,
    } =
      await getOrganizerOrderDetails({
        organizerId:
          organizer.id,

        orderId,
      });

    const receipt =
      await createReceiptPdf(
        order,
      );

    const organizerLabel =
      order.organizer.profile
        ?.businessName ??
      order.organizer.fullName;

    const filename =
      [
        "tikemia",
        "recu",
        sanitizeFilenamePart(
          order.reference,
          "commande",
        ),
        sanitizeFilenamePart(
          organizerLabel,
          "organisateur",
        ),
      ].join("-") +
      ".pdf";

    const headers =
      new Headers();

    headers.set(
      "Content-Type",
      PDF_MIME_TYPE,
    );

    headers.set(
      "Content-Disposition",
      createContentDisposition(
        filename,
      ),
    );

    headers.set(
      "Content-Length",
      String(
        receipt.buffer.byteLength,
      ),
    );

    headers.set(
      "Cache-Control",
      "private, no-store, no-cache, must-revalidate, max-age=0",
    );

    headers.set(
      "Pragma",
      "no-cache",
    );

    headers.set(
      "Expires",
      "0",
    );

    headers.set(
      "X-Content-Type-Options",
      "nosniff",
    );

    return new Response(
      new Uint8Array(
        receipt.buffer,
      ),
      {
        status:
          200,

        headers,
      },
    );
  } catch (error) {
    if (
      error instanceof
      OrganizerOrderReceiptRouteError
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
      GetOrganizerOrderDetailsError
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
      "[ORGANIZER_ORDER_RECEIPT_ROUTE_ERROR]",
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
        "ORGANIZER_ORDER_RECEIPT_FAILED",

      status:
        500,

      message:
        "Impossible de générer le reçu de cette commande pour le moment.",
    });
  }
}