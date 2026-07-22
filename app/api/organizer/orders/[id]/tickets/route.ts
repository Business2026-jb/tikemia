import { createHash } from "node:crypto";

import JSZip from "jszip";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import QRCode from "qrcode";
import { cookies } from "next/headers";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getOrganizerOrderDetails,
  GetOrganizerOrderDetailsError,
  type OrganizerOrderDetailTicket,
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

type TicketPdfFonts = {
  regular: PDFFont;
  bold: PDFFont;
};

const SESSION_COOKIE_FALLBACK_NAME =
  "tikemia_session";

const PDF_MIME_TYPE =
  "application/pdf";

const ZIP_MIME_TYPE =
  "application/zip";

const PAGE_WIDTH =
  595.28;

const PAGE_HEIGHT =
  841.89;

const MARGIN_X =
  42;

const MARGIN_TOP =
  42;

const MARGIN_BOTTOM =
  42;

const COLORS = {
  background: rgb(
    0.027,
    0.063,
    0.078,
  ),

  panel: rgb(
    0.047,
    0.094,
    0.114,
  ),

  panelSoft: rgb(
    0.065,
    0.118,
    0.137,
  ),

  border: rgb(
    0.15,
    0.22,
    0.24,
  ),

  white: rgb(
    1,
    1,
    1,
  ),

  black: rgb(
    0,
    0,
    0,
  ),

  text: rgb(
    0.84,
    0.88,
    0.9,
  ),

  muted: rgb(
    0.48,
    0.55,
    0.58,
  ),

  green: rgb(
    0.52,
    0.8,
    0.086,
  ),

  orange: rgb(
    0.976,
    0.451,
    0.086,
  ),

  blue: rgb(
    0.22,
    0.74,
    0.97,
  ),

  red: rgb(
    0.97,
    0.44,
    0.44,
  ),

  violet: rgb(
    0.75,
    0.52,
    0.98,
  ),

  amber: rgb(
    0.98,
    0.75,
    0.14,
  ),
} as const;

class OrganizerOrderTicketsRouteError extends Error {
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
      "OrganizerOrderTicketsRouteError";

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
  timezone?: string,
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

  try {
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

        ...(timezone
          ? {
              timeZone:
                timezone,
            }
          : {
              timeZone:
                "UTC",
            }),
      },
    ).format(date);
  } catch {
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
      },
    ).format(date);
  }
}

function formatTicketStatus(
  status: OrganizerOrderDetailTicket["status"],
): string {
  const labels = {
    VALID:
      "Valide",

    USED:
      "Utilisé",

    CANCELLED:
      "Annulé",

    REFUNDED:
      "Remboursé",
  } as const;

  return labels[status];
}

function getTicketStatusColor(
  status: OrganizerOrderDetailTicket["status"],
) {
  if (status === "VALID") {
    return COLORS.green;
  }

  if (status === "USED") {
    return COLORS.blue;
  }

  if (status === "REFUNDED") {
    return COLORS.violet;
  }

  return COLORS.red;
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
    "tikemia-billets";

  const encodedFilename =
    encodeURIComponent(
      safeFilename,
    ).replace(
      /['()]/g,
      escape,
    );

  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`;
}

function createDownloadHeaders({
  filename,
  mimeType,
  contentLength,
}: {
  filename: string;
  mimeType: string;
  contentLength: number;
}): Headers {
  const headers =
    new Headers();

  headers.set(
    "Content-Type",
    mimeType,
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
      contentLength,
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

  return headers;
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

function drawLabelValue({
  page,
  fonts,
  label,
  value,
  x,
  y,
  width,
  valueColor = COLORS.text,
}: {
  page: PDFPage;
  fonts: TicketPdfFonts;
  label: string;
  value: string;
  x: number;
  y: number;
  width: number;
  valueColor?: ReturnType<
    typeof rgb
  >;
}): void {
  drawText({
    page,
    text:
      label,
    x,
    y,
    font:
      fonts.regular,
    size:
      7.5,
    color:
      COLORS.muted,
    maxWidth:
      width,
  });

  drawText({
    page,
    text:
      value,
    x,
    y:
      y -
      15,
    font:
      fonts.bold,
    size:
      9,
    color:
      valueColor,
    maxWidth:
      width,
  });
}

async function createQrImage({
  document,
  qrCodeValue,
}: {
  document: PDFDocument;
  qrCodeValue: string;
}): Promise<PDFImage> {
  const qrDataUrl =
    await QRCode.toDataURL(
      qrCodeValue,
      {
        errorCorrectionLevel:
          "H",

        margin:
          2,

        width:
          520,

        color: {
          dark:
            "#000000",

          light:
            "#FFFFFF",
        },
      },
    );

  const base64 =
    qrDataUrl.split(",")[1];

  if (!base64) {
    throw new OrganizerOrderTicketsRouteError({
      code:
        "QR_GENERATION_FAILED",

      status:
        500,

      message:
        "Impossible de générer le QR code du billet.",
    });
  }

  return document.embedPng(
    Buffer.from(
      base64,
      "base64",
    ),
  );
}

async function createTicketPdf({
  order,
  ticket,
}: {
  order: OrganizerOrderDetails;
  ticket: OrganizerOrderDetailTicket;
}): Promise<Buffer> {
  const document =
    await PDFDocument.create();

  const fonts: TicketPdfFonts = {
    regular:
      await document.embedFont(
        StandardFonts.Helvetica,
      ),

    bold:
      await document.embedFont(
        StandardFonts.HelveticaBold,
      ),
  };

  const page =
    document.addPage([
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

  const qrImage =
    await createQrImage({
      document,
      qrCodeValue:
        ticket.qrCodeValue,
    });

  document.setTitle(
    `Billet Tikemia — ${ticket.code}`,
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
    `Billet pour ${order.event.title}`,
  );

  document.setKeywords([
    "Tikemia",
    "billet",
    "événement",
    "QR code",
    ticket.code,
  ]);

  const top =
    PAGE_HEIGHT -
    MARGIN_TOP;

  page.drawRectangle({
    x:
      MARGIN_X,
    y:
      top -
      4,
    width:
      42,
    height:
      5,
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
      top -
      31,
    font:
      fonts.bold,
    size:
      22,
    color:
      COLORS.white,
  });

  drawText({
    page,
    text:
      "Billet électronique officiel",
    x:
      MARGIN_X +
      135,
    y:
      top -
      24,
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
      135,
    y:
      top -
      43,
    font:
      fonts.regular,
    size:
      8.5,
    color:
      COLORS.muted,
  });

  const statusLabel =
    formatTicketStatus(
      ticket.status,
    );

  const statusWidth =
    fonts.bold.widthOfTextAtSize(
      statusLabel,
      9,
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
      top -
      26,
    font:
      fonts.bold,
    size:
      9,
    color:
      getTicketStatusColor(
        ticket.status,
      ),
  });

  const heroY =
    top -
    78;

  const heroHeight =
    142;

  drawPanel({
    page,
    x:
      MARGIN_X,
    y:
      heroY,
    width:
      PAGE_WIDTH -
      MARGIN_X *
        2,
    height:
      heroHeight,
    fill:
      COLORS.panelSoft,
  });

  drawText({
    page,
    text:
      order.event.title,
    x:
      MARGIN_X +
      18,
    y:
      heroY -
      30,
    font:
      fonts.bold,
    size:
      18,
    color:
      COLORS.white,
    maxWidth:
      PAGE_WIDTH -
      MARGIN_X *
        2 -
      36,
  });

  drawText({
    page,
    text:
      ticket.ticketType.name,
    x:
      MARGIN_X +
      18,
    y:
      heroY -
      58,
    font:
      fonts.bold,
    size:
      11,
    color:
      COLORS.orange,
    maxWidth:
      PAGE_WIDTH -
      MARGIN_X *
        2 -
      36,
  });

  drawText({
    page,
    text:
      `Date : ${formatDateTime(
        order.event.startsAt,
        order.event.timezone,
      )}`,
    x:
      MARGIN_X +
      18,
    y:
      heroY -
      86,
    font:
      fonts.regular,
    size:
      9,
    color:
      COLORS.text,
    maxWidth:
      PAGE_WIDTH -
      MARGIN_X *
        2 -
      36,
  });

  drawText({
    page,
    text:
      `Lieu : ${order.event.venueName}, ${order.event.city}, ${order.event.country}`,
    x:
      MARGIN_X +
      18,
    y:
      heroY -
      108,
    font:
      fonts.regular,
    size:
      9,
    color:
      COLORS.muted,
    maxWidth:
      PAGE_WIDTH -
      MARGIN_X *
        2 -
      36,
  });

  const detailsY =
    heroY -
    heroHeight -
    22;

  const gap =
    12;

  const detailsWidth =
    PAGE_WIDTH -
    MARGIN_X *
      2 -
    190 -
    gap;

  const detailsHeight =
    190;

  drawPanel({
    page,
    x:
      MARGIN_X,
    y:
      detailsY,
    width:
      detailsWidth,
    height:
      detailsHeight,
  });

  drawText({
    page,
    text:
      "Informations du billet",
    x:
      MARGIN_X +
      14,
    y:
      detailsY -
      22,
    font:
      fonts.bold,
    size:
      10,
    color:
      COLORS.green,
  });

  drawLabelValue({
    page,
    fonts,
    label:
      "Détenteur",
    value:
      ticket.holder.name,
    x:
      MARGIN_X +
      14,
    y:
      detailsY -
      48,
    width:
      detailsWidth -
      28,
  });

  drawLabelValue({
    page,
    fonts,
    label:
      "E-mail",
    value:
      normalizeText(
        ticket.holder.email,
        "Non renseigné",
      ),
    x:
      MARGIN_X +
      14,
    y:
      detailsY -
      87,
    width:
      detailsWidth -
      28,
  });

  drawLabelValue({
    page,
    fonts,
    label:
      "Téléphone",
    value:
      normalizeText(
        ticket.holder.phone,
        "Non renseigné",
      ),
    x:
      MARGIN_X +
      14,
    y:
      detailsY -
      126,
    width:
      detailsWidth -
      28,
  });

  drawLabelValue({
    page,
    fonts,
    label:
      "Code du billet",
    value:
      ticket.code,
    x:
      MARGIN_X +
      14,
    y:
      detailsY -
      165,
    width:
      detailsWidth -
      28,
    valueColor:
      COLORS.white,
  });

  const qrPanelX =
    MARGIN_X +
    detailsWidth +
    gap;

  drawPanel({
    page,
    x:
      qrPanelX,
    y:
      detailsY,
    width:
      190,
    height:
      detailsHeight,
    fill:
      COLORS.white,
    border:
      COLORS.green,
  });

  const qrSize =
    150;

  page.drawImage(
    qrImage,
    {
      x:
        qrPanelX +
        (
          190 -
          qrSize
        ) /
          2,
      y:
        detailsY -
        18 -
        qrSize,
      width:
        qrSize,
      height:
        qrSize,
    },
  );

  drawText({
    page,
    text:
      "Présentez ce QR code à l’entrée",
    x:
      qrPanelX +
      16,
    y:
      detailsY -
      176,
    font:
      fonts.bold,
    size:
      7.5,
    color:
      COLORS.black,
    maxWidth:
      158,
  });

  const securityY =
    detailsY -
    detailsHeight -
    22;

  const securityHeight =
    108;

  drawPanel({
    page,
    x:
      MARGIN_X,
    y:
      securityY,
    width:
      PAGE_WIDTH -
      MARGIN_X *
        2,
    height:
      securityHeight,
    fill:
      rgb(
        0.05,
        0.13,
        0.07,
      ),
    border:
      COLORS.green,
  });

  drawText({
    page,
    text:
      "Consignes de sécurité",
    x:
      MARGIN_X +
      14,
    y:
      securityY -
      22,
    font:
      fonts.bold,
    size:
      10,
    color:
      COLORS.green,
  });

  const securityLines = [
    "• Ce billet est personnel et ne doit pas être partagé publiquement.",
    "• Le QR code ne peut être validé qu’une seule fois, sauf règle particulière de l’événement.",
    "• Une copie, une modification ou une revente non autorisée peut entraîner l’annulation du billet.",
    "• Une pièce d’identité peut être demandée à l’entrée.",
  ];

  securityLines.forEach(
    (
      line,
      index,
    ) => {
      drawText({
        page,
        text:
          line,
        x:
          MARGIN_X +
          14,
        y:
          securityY -
          43 -
          index *
            16,
        font:
          fonts.regular,
        size:
          7.8,
        color:
          COLORS.text,
        maxWidth:
          PAGE_WIDTH -
          MARGIN_X *
            2 -
          28,
      });
    },
  );

  const footerY =
    MARGIN_BOTTOM +
    12;

  page.drawLine({
    start: {
      x:
        MARGIN_X,
      y:
        footerY +
        16,
    },

    end: {
      x:
        PAGE_WIDTH -
        MARGIN_X,
      y:
        footerY +
        16,
    },

    thickness:
      0.7,

    color:
      COLORS.border,
  });

  drawText({
    page,
    text:
      `Billet généré le ${formatDateTime(
        ticket.createdAt,
      )}`,
    x:
      MARGIN_X,
    y:
      footerY,
    font:
      fonts.regular,
    size:
      7.2,
    color:
      COLORS.muted,
  });

  const footerRight =
    "tikemia.com";

  const footerRightWidth =
    fonts.bold.widthOfTextAtSize(
      footerRight,
      7.2,
    );

  drawText({
    page,
    text:
      footerRight,
    x:
      PAGE_WIDTH -
      MARGIN_X -
      footerRightWidth,
    y:
      footerY,
    font:
      fonts.bold,
    size:
      7.2,
    color:
      COLORS.green,
  });

  const bytes =
    await document.save({
      useObjectStreams:
        true,

      addDefaultPage:
        false,

      updateFieldAppearances:
        false,
    });

  return Buffer.from(
    bytes,
  );
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
    throw new OrganizerOrderTicketsRouteError({
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
    throw new OrganizerOrderTicketsRouteError({
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
            "[ORDER_TICKETS_EXPIRED_SESSION_DELETE_ERROR]",
            error instanceof Error
              ? error.message
              : error,
          );
        },
      );

    throw new OrganizerOrderTicketsRouteError({
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
    throw new OrganizerOrderTicketsRouteError({
      code:
        "FORBIDDEN",

      status:
        403,

      message:
        "Ce compte n’est pas autorisé à télécharger les billets de cette commande.",
    });
  }

  return {
    id:
      organizer.id,

    email:
      organizer.email,
  };
}

function assertOrderCanDownloadTickets(
  order: OrganizerOrderDetails,
): void {
  if (
    order.status !== "PAID"
  ) {
    throw new OrganizerOrderTicketsRouteError({
      code:
        "ORDER_NOT_PAID",

      status:
        409,

      message:
        "Les billets ne peuvent être téléchargés que pour une commande payée.",
    });
  }

  if (
    order.tickets.length === 0
  ) {
    throw new OrganizerOrderTicketsRouteError({
      code:
        "NO_TICKETS_FOUND",

      status:
        404,

      message:
        "Aucun billet n’a été généré pour cette commande.",
    });
  }
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
      throw new OrganizerOrderTicketsRouteError({
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

    assertOrderCanDownloadTickets(
      order,
    );

    const organizerLabel =
      order.organizer.profile
        ?.businessName ??
      order.organizer.fullName;

    if (
      order.tickets.length ===
      1
    ) {
      const ticket =
        order.tickets[0];

      const pdfBuffer =
        await createTicketPdf({
          order,
          ticket,
        });

      const filename =
        [
          "tikemia",
          "billet",
          sanitizeFilenamePart(
            ticket.code,
            "ticket",
          ),
          sanitizeFilenamePart(
            order.event.title,
            "evenement",
          ),
        ].join("-") +
        ".pdf";

      return new Response(
        new Uint8Array(
          pdfBuffer,
        ),
        {
          status:
            200,

          headers:
            createDownloadHeaders({
              filename,

              mimeType:
                PDF_MIME_TYPE,

              contentLength:
                pdfBuffer.byteLength,
            }),
        },
      );
    }

    const zip =
      new JSZip();

    const folder =
      zip.folder(
        "billets",
      );

    if (!folder) {
      throw new OrganizerOrderTicketsRouteError({
        code:
          "ZIP_FOLDER_CREATION_FAILED",

        status:
          500,

        message:
          "Impossible de préparer l’archive des billets.",
      });
    }

    for (
      const ticket of
      order.tickets
    ) {
      const pdfBuffer =
        await createTicketPdf({
          order,
          ticket,
        });

      const ticketFilename =
        [
          "billet",
          sanitizeFilenamePart(
            ticket.code,
            "ticket",
          ),
          sanitizeFilenamePart(
            ticket.ticketType.name,
            "categorie",
          ),
        ].join("-") +
        ".pdf";

      folder.file(
        ticketFilename,
        pdfBuffer,
        {
          binary:
            true,

          date:
            new Date(
              ticket.createdAt,
            ),
        },
      );
    }

    zip.file(
      "README.txt",
      [
        "TIKEMIA — BILLETS DE COMMANDE",
        "",
        `Commande : ${order.reference}`,
        `Événement : ${order.event.title}`,
        `Organisateur : ${organizerLabel}`,
        `Nombre de billets : ${order.tickets.length}`,
        `Date de génération : ${formatDateTime(
          new Date().toISOString(),
        )}`,
        "",
        "Chaque billet est personnel et contient un QR code unique.",
        "Ne partagez pas publiquement les fichiers contenus dans cette archive.",
      ].join("\r\n"),
    );

    const zipBuffer =
      await zip.generateAsync({
        type:
          "nodebuffer",

        compression:
          "DEFLATE",

        compressionOptions: {
          level:
            9,
        },

        platform:
          "DOS",

        streamFiles:
          true,
      });

    const filename =
      [
        "tikemia",
        "billets",
        sanitizeFilenamePart(
          order.reference,
          "commande",
        ),
        sanitizeFilenamePart(
          order.event.title,
          "evenement",
        ),
      ].join("-") +
      ".zip";

    return new Response(
      new Uint8Array(
        zipBuffer,
      ),
      {
        status:
          200,

        headers:
          createDownloadHeaders({
            filename,

            mimeType:
              ZIP_MIME_TYPE,

            contentLength:
              zipBuffer.byteLength,
          }),
      },
    );
  } catch (error) {
    if (
      error instanceof
      OrganizerOrderTicketsRouteError
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
      "[ORGANIZER_ORDER_TICKETS_ROUTE_ERROR]",
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
        "ORGANIZER_ORDER_TICKETS_FAILED",

      status:
        500,

      message:
        "Impossible de générer les billets de cette commande pour le moment.",
    });
  }
}