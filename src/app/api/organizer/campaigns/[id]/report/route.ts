import { getPlatformPrisma } from "@/lib/payments/fulfillment";
import { currencyDecimals, currencySymbol } from "@/i18n/config";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createHash,
} from "node:crypto";

import {
  PrismaClient,
} from "@/generated/prisma/client";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
} from "pdf-lib";

/* ============================================
   TIKEMIA — RAPPORT PDF DES CAGNOTTES

   GET /api/organizer/campaigns/[id]/report

   Contenu :
   - Informations de la cagnotte
   - Montant objectif
   - Montant collecté confirmé
   - Reste à collecter
   - Pourcentage atteint
   - Nombre de contributions
   - Historique des contributions
   - Date de génération

   Sécurité :
   - Session organisateur obligatoire
   - Rôle ORGANIZER
   - Organisation propriétaire
   - Dons confirmés uniquement
   - Aucune donnée personnelle des donateurs
   - Pas de mise en cache
   - PDF généré côté serveur
============================================ */




/* ============================================
   TYPES
============================================ */

type Language = "fr" | "en";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ReportContribution = {
  id: string;
  amount: bigint;
  createdAt: Date;
};

type ReportData = {
  id: string;
  title: string;
  description: string;
  status: string;
  country: string;
  city: string;
  currency: string;
  goalAmount: bigint;
  collectedAmount: bigint;
  remainingAmount: bigint;
  progress: number;
  contributionCount: number;
  createdAt: Date;
  contributions: ReportContribution[];
};

type ErrorKey =
  | "unauthorized"
  | "forbidden"
  | "invalidId"
  | "notFound"
  | "currencyMismatch"
  | "tooManyContributions"
  | "serverError";

/* ============================================
   CONFIGURATION
============================================ */

const SESSION_COOKIE =
  "tikemia_organizer_session";

const ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PAGE_WIDTH = 595.28;

const PAGE_HEIGHT = 841.89;

const MARGIN = 42;

const CONTENT_WIDTH =
  PAGE_WIDTH - MARGIN * 2;

const MAX_CONTRIBUTIONS = 5000;

const QUERY_BATCH_SIZE = 500;

/* ============================================
   TRADUCTIONS
============================================ */

const TEXT = {
  fr: {
    unauthorized:
      "Veuillez vous connecter à votre espace organisateur.",

    forbidden:
      "Vous n'avez pas accès à ce rapport.",

    invalidId:
      "Identifiant de cagnotte invalide.",

    notFound:
      "Cagnotte introuvable.",

    currencyMismatch:
      "Les contributions contiennent des devises incompatibles avec la cagnotte.",

    tooManyContributions:
      "Le rapport contient trop de contributions pour cette génération PDF.",

    serverError:
      "Impossible de générer le rapport PDF.",

    reportTitle:
      "RAPPORT DE CAGNOTTE",

    organizerSpace:
      "ESPACE ORGANISATEUR",

    generatedAt:
      "Rapport généré le",

    information:
      "INFORMATIONS DE LA CAGNOTTE",

    campaignName:
      "Nom de la cagnotte",

    status:
      "Statut",

    location:
      "Localisation",

    createdAt:
      "Date de création",

    description:
      "DESCRIPTION",

    finance:
      "BILAN DE LA COLLECTE",

    goal:
      "Objectif de la cagnotte",

    collected:
      "Montant collecté confirmé",

    remaining:
      "Reste à collecter",

    progress:
      "Progression",

    contributions:
      "Contributions confirmées",

    history:
      "HISTORIQUE DES CONTRIBUTIONS",

    date:
      "Date",

    amount:
      "Montant",

    number:
      "N°",

    noContributions:
      "Aucune contribution confirmée.",

    financialNote:
      "Ce rapport comptabilise uniquement les contributions dont le paiement est confirmé. Les paiements en attente, échoués ou remboursés ne sont pas inclus.",

    privacyNote:
      "Les informations personnelles des donateurs ne figurent pas dans ce document.",

    page:
      "Page",

    of:
      "sur",

    noValue:
      "Non renseigné",
  },

  en: {
    unauthorized:
      "Please sign in to your organizer account.",

    forbidden:
      "You do not have access to this report.",

    invalidId:
      "Invalid fundraiser identifier.",

    notFound:
      "Fundraiser not found.",

    currencyMismatch:
      "Contributions contain currencies that do not match the fundraiser.",

    tooManyContributions:
      "This report contains too many contributions for PDF generation.",

    serverError:
      "Unable to generate the PDF report.",

    reportTitle:
      "FUNDRAISER REPORT",

    organizerSpace:
      "ORGANIZER SPACE",

    generatedAt:
      "Report generated on",

    information:
      "FUNDRAISER INFORMATION",

    campaignName:
      "Fundraiser name",

    status:
      "Status",

    location:
      "Location",

    createdAt:
      "Creation date",

    description:
      "DESCRIPTION",

    finance:
      "FUNDRAISING SUMMARY",

    goal:
      "Fundraising goal",

    collected:
      "Confirmed amount collected",

    remaining:
      "Remaining amount",

    progress:
      "Progress",

    contributions:
      "Confirmed contributions",

    history:
      "CONTRIBUTION HISTORY",

    date:
      "Date",

    amount:
      "Amount",

    number:
      "No.",

    noContributions:
      "No confirmed contributions.",

    financialNote:
      "This report includes confirmed payments only. Pending, failed or refunded contributions are excluded.",

    privacyNote:
      "Personal information about donors is not included in this document.",

    page:
      "Page",

    of:
      "of",

    noValue:
      "Not specified",
  },
} as const;

/* ============================================
   COULEURS TIKEMIA
============================================ */

const COLORS = {
  navy: rgb(
    0.035,
    0.10,
    0.22
  ),

  darkGreen: rgb(
    0.02,
    0.39,
    0.16
  ),

  green: rgb(
    0.05,
    0.67,
    0.14
  ),

  lime: rgb(
    0.55,
    0.86,
    0.05
  ),

  yellow: rgb(
    0.98,
    0.77,
    0.08
  ),

  white: rgb(
    1,
    1,
    1
  ),

  text: rgb(
    0.09,
    0.16,
    0.25
  ),

  muted: rgb(
    0.38,
    0.44,
    0.52
  ),

  light: rgb(
    0.96,
    0.98,
    0.97
  ),

  border: rgb(
    0.87,
    0.90,
    0.92
  ),
};

/* ============================================
   PRISMA ORM 7
============================================ */



const getPrisma = getPlatformPrisma;

/* ============================================
   LANGUE
============================================ */

function getLanguage(
  request: NextRequest
): Language {
  const query =
    request.nextUrl.searchParams.get(
      "locale"
    );

  if (
    query === "fr" ||
    query === "en"
  ) {
    return query;
  }

  const header =
    request.headers.get(
      "accept-language"
    ) ?? "";

  return header
    .toLowerCase()
    .startsWith("en")
    ? "en"
    : "fr";
}

/* ============================================
   RÉPONSES D'ERREUR
============================================ */

function errorResponse(
  language: Language,
  key: ErrorKey,
  status: number
) {
  return NextResponse.json(
    {
      success: false,
      message:
        TEXT[language][key],
    },
    {
      status,

      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",

        "X-Content-Type-Options":
          "nosniff",

        Vary: "Cookie",
      },
    }
  );
}

/* ============================================
   AUTHENTIFICATION ORGANISATEUR
============================================ */

async function getOrganizer(
  request: NextRequest,
  prisma: PrismaClient
): Promise<{
  userId: string;
  organizationIds: string[];
} | null> {
  const token =
    request.cookies.get(
      SESSION_COOKIE
    )?.value;

  if (
    !token ||
    !/^[a-f0-9]{64}$/i.test(token)
  ) {
    return null;
  }

  const tokenHash =
    createHash("sha256")
      .update(token, "utf8")
      .digest("hex");

  const session =
    await prisma.session.findFirst({
      where: {
        tokenHash,

        revokedAt: null,

        expiresAt: {
          gt: new Date(),
        },
      },

      select: {
        userId: true,
      },
    });

  if (!session) {
    return null;
  }

  const user =
    await prisma.user.findUnique({
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

  const organizations =
    await prisma.organization.findMany({
      where: {
        ownerId: user.id,

        isActive: true,
      },

      select: {
        id: true,
      },
    });

  if (
    organizations.length === 0
  ) {
    return null;
  }

  return {
    userId: user.id,

    organizationIds:
      organizations.map(
        (organization) =>
          organization.id
      ),
  };
}

/* ============================================
   MONTANTS ENTIERS

   Ne jamais utiliser de valeurs
   flottantes pour les calculs financiers.
============================================ */

function toBigInt(
  value: unknown
): bigint {
  if (
    typeof value === "bigint"
  ) {
    return value;
  }

  if (
    typeof value === "number" &&
    Number.isSafeInteger(value)
  ) {
    return BigInt(value);
  }

  const raw =
    String(value ?? "");

  if (
    !/^-?\d+$/.test(raw)
  ) {
    throw new Error(
      "INVALID_FINANCIAL_AMOUNT"
    );
  }

  return BigInt(raw);
}

/* ============================================
   FORMATAGE
============================================ */

function formatInteger(
  value: number | bigint,
  language: Language
): string {
  return new Intl.NumberFormat(
    language === "fr"
      ? "fr-FR"
      : "en-US"
  ).format(value);
}

function formatMoney(
  amount: bigint,
  currency: string,
  language: Language
): string {
  if (amount === null) return "\u2014";
  try {
    const minorAmount = BigInt(amount);
    const decimals = currencyDecimals(currency);
    const factor = decimals ? 100n : 1n;
    const absolute = minorAmount < 0n ? -minorAmount : minorAmount;
    const whole = new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US").format(absolute / factor);
    const fraction = decimals ? (language === "fr" ? "," : ".") + String(absolute % factor).padStart(2, "0") : "";
    return (minorAmount < 0n ? "-" : "") + whole + fraction + " " + (currencySymbol(currency));
  } catch { return "\u2014"; }
}

function formatDate(
  date: Date,
  language: Language
): string {
  return new Intl.DateTimeFormat(
    language === "fr"
      ? "fr-FR"
      : "en-GB",
    {
      day: "2-digit",

      month: "long",

      year: "numeric",

      hour: "2-digit",

      minute: "2-digit",

      timeZone: "UTC",
    }
  ).format(date);
}

function formatPercentage(
  value: number,
  language: Language
): string {
  return (
    new Intl.NumberFormat(
      language === "fr"
        ? "fr-FR"
        : "en-US",
      {
        maximumFractionDigits: 2,
      }
    ).format(value) + " %"
  );
}

function safeFileName(
  title: string
): string {
  const normalized =
    title
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      )
      .slice(0, 55);

  return normalized ||
    "cagnotte";
}

/* ============================================
   TEXTE COMPATIBLE PDF

   pdf-lib avec Helvetica standard
   ne prend pas en charge tous les
   caractères Unicode et les emoji.
============================================ */

function pdfText(
  value: unknown,
  font: PDFFont
): string {
  let result = "";

  const input =
    String(value ?? "");

  for (
    const character of input
  ) {
    if (
      character === "\n" ||
      character === "\r" ||
      character === "\t"
    ) {
      result += " ";
      continue;
    }

    try {
      font.encodeText(
        character
      );

      result += character;
    } catch {
      result += "?";
    }
  }

  return result;
}

/* ============================================
   CALCUL EXACT DU POURCENTAGE

   On évite Number(bigint) directement
   pour les grosses sommes.

   Résultat borné à 2 décimales.
   Le pourcentage peut dépasser 100 %
   si l'objectif est dépassé.
============================================ */

function calculateProgress(
  collected: bigint,
  goal: bigint
): number {
  if (
    goal <= 0n
  ) {
    return 0;
  }

  const scaled =
    (collected * 10000n) /
    goal;

  const bounded =
    scaled >
    BigInt(Number.MAX_SAFE_INTEGER)
      ? BigInt(Number.MAX_SAFE_INTEGER)
      : scaled;

  return Number(bounded) / 100;
}

/* ============================================
   CRÉATION DU DOCUMENT PDF
============================================ */

async function generatePdf(
  report: ReportData,
  language: Language
): Promise<Uint8Array> {
  const t = TEXT[language];

  const document =
    await PDFDocument.create();

  document.setTitle(
    `TIKEMIA - ${report.title}`
  );

  document.setAuthor(
    "TIKEMIA"
  );

  document.setCreator(
    "TIKEMIA"
  );

  document.setSubject(
    "Fundraising report"
  );

  const regular =
    await document.embedFont(
      StandardFonts.Helvetica
    );

  const bold =
    await document.embedFont(
      StandardFonts.HelveticaBold
    );

  let cursorY = PAGE_HEIGHT - MARGIN;
  let page: PDFPage = addPage();

  /* ========================================
     NOUVELLE PAGE
  ======================================== */

  function addPage() {
    const nextPage = document.addPage([
        PAGE_WIDTH,
        PAGE_HEIGHT,
      ]);

    cursorY =
      PAGE_HEIGHT - MARGIN;

    nextPage.drawRectangle({
      x: 0,

      y:
        PAGE_HEIGHT - 9,

      width:
        PAGE_WIDTH,

      height: 9,

      color:
        COLORS.darkGreen,
    });

    nextPage.drawRectangle({
      x:
        PAGE_WIDTH - 125,

      y:
        PAGE_HEIGHT - 9,

      width: 125,

      height: 9,

      color:
        COLORS.yellow,
    });
    return nextPage;
  }

  /* ========================================
     PROTÉGER L'ESPACE EN BAS
  ======================================== */

  function ensureSpace(
    required: number
  ) {
    if (
      cursorY - required <
      MARGIN + 20
    ) {
      page = addPage();
    }
  }

  /* ========================================
     ÉCRIRE UNE LIGNE
  ======================================== */

  function drawText(
    content: string,
    options: {
      x?: number;
      y?: number;
      size?: number;
      strong?: boolean;
      color?: ReturnType<
        typeof rgb
      >;
    } = {}
  ) {
    const font =
      options.strong
        ? bold
        : regular;

    page.drawText(
      pdfText(
        content,
        font
      ),
      {
        x:
          options.x ??
          MARGIN,

        y:
          options.y ??
          cursorY,

        size:
          options.size ??
          10,

        font,

        color:
          options.color ??
          COLORS.text,
      }
    );
  }

  /* ========================================
     DÉCOUPAGE DES TEXTES LONGS
  ======================================== */

  function wrapText(
    content: string,
    maximumWidth: number,
    size: number,
    font: PDFFont
  ): string[] {
    const normalized =
      pdfText(
        content,
        font
      );

    const words =
      normalized
        .split(/\s+/)
        .filter(Boolean);

    const lines:
      string[] = [];

    let current = "";

    for (
      const word of words
    ) {
      const candidate =
        current
          ? `${current} ${word}`
          : word;

      if (
        font.widthOfTextAtSize(
          candidate,
          size
        ) <= maximumWidth
      ) {
        current =
          candidate;

        continue;
      }

      if (current) {
        lines.push(
          current
        );

        current = "";
      }

      let remaining =
        word;

      while (
        remaining.length > 0 &&
        font.widthOfTextAtSize(
          remaining,
          size
        ) >
          maximumWidth
      ) {
        let length = 1;

        while (
          length <
            remaining.length &&
          font.widthOfTextAtSize(
            remaining.slice(
              0,
              length + 1
            ),
            size
          ) <=
            maximumWidth
        ) {
          length++;
        }

        lines.push(
          remaining.slice(
            0,
            length
          )
        );

        remaining =
          remaining.slice(
            length
          );
      }

      current =
        remaining;
    }

    if (current) {
      lines.push(
        current
      );
    }

    return lines.length
      ? lines
      : [""];
  }

  /* ========================================
     PARAGRAPHE MULTILIGNE
  ======================================== */

  function paragraph(
    content: string,
    options: {
      size?: number;
      strong?: boolean;
      color?: ReturnType<
        typeof rgb
      >;
      spacing?: number;
    } = {}
  ) {
    const size =
      options.size ?? 10;

    const font =
      options.strong
        ? bold
        : regular;

    const lines =
      wrapText(
        content,
        CONTENT_WIDTH,
        size,
        font
      );

    for (
      const line of lines
    ) {
      ensureSpace(
        size + 7
      );

      drawText(
        line,
        {
          size,

          strong:
            options.strong,

          color:
            options.color,
        }
      );

      cursorY -=
        size + 6;
    }

    cursorY -=
      options.spacing ?? 6;
  }

  /* ========================================
     TITRE DE SECTION
  ======================================== */

  function section(
    title: string
  ) {
    ensureSpace(48);

    cursorY -= 12;

    page.drawRectangle({
      x: MARGIN,

      y:
        cursorY - 8,

      width: 4,

      height: 19,

      color:
        COLORS.green,
    });

    drawText(
      title,
      {
        x:
          MARGIN + 13,

        size: 12,

        strong: true,

        color:
          COLORS.navy,
      }
    );

    cursorY -= 29;
  }

  /* ========================================
     LIGNE D'INFORMATION
  ======================================== */

  function infoRow(
    label: string,
    value: string
  ) {
    const lines =
      wrapText(
        value ||
          t.noValue,
        CONTENT_WIDTH - 170,
        9,
        regular
      );

    const height =
      Math.max(
        30,
        lines.length * 15 + 10
      );

    ensureSpace(
      height + 4
    );

    page.drawRectangle({
      x: MARGIN,

      y:
        cursorY -
        height +
        6,

      width:
        CONTENT_WIDTH,

      height,

      color:
        COLORS.light,
    });

    drawText(
      label,
      {
        x:
          MARGIN + 11,

        y:
          cursorY - 10,

        size: 9,

        strong: true,

        color:
          COLORS.muted,
      }
    );

    let lineY =
      cursorY - 10;

    for (
      const line of lines
    ) {
      drawText(
        line,
        {
          x:
            MARGIN + 168,

          y: lineY,

          size: 9,
        }
      );

      lineY -= 15;
    }

    cursorY -=
      height + 5;
  }

  /* ========================================
     LIGNE FINANCIÈRE
  ======================================== */

  function moneyRow(
    label: string,
    value: string
  ) {
    const height = 40;

    ensureSpace(
      height + 5
    );

    page.drawRectangle({
      x: MARGIN,

      y:
        cursorY - 28,

      width:
        CONTENT_WIDTH,

      height,

      borderColor:
        COLORS.border,

      borderWidth: 0.6,

      color:
        COLORS.light,
    });

    drawText(
      label,
      {
        x:
          MARGIN + 12,

        y:
          cursorY - 8,

        size: 9,

        color:
          COLORS.text,
      }
    );

    const safeValue =
      pdfText(
        value,
        bold
      );

    const availableWidth =
      CONTENT_WIDTH - 225;

    let fontSize = 11;

    while (
      fontSize > 7 &&
      bold.widthOfTextAtSize(
        safeValue,
        fontSize
      ) > availableWidth
    ) {
      fontSize -= 0.5;
    }

    const textWidth =
      bold.widthOfTextAtSize(
        safeValue,
        fontSize
      );

    drawText(
      safeValue,
      {
        x:
          MARGIN +
          CONTENT_WIDTH -
          textWidth -
          12,

        y:
          cursorY - 8,

        size:
          fontSize,

        strong: true,

        color:
          COLORS.darkGreen,
      }
    );

    cursorY -=
      height + 7;
  }

  /* ========================================
     BARRE DE PROGRESSION
  ======================================== */

  function progressBar(
    percentage: number
  ) {
    ensureSpace(52);

    const width =
      CONTENT_WIDTH;

    const fill =
      Math.max(
        0,
        Math.min(
          100,
          percentage
        )
      );

    page.drawRectangle({
      x: MARGIN,

      y:
        cursorY - 9,

      width,

      height: 13,

      color:
        COLORS.border,
    });

    if (fill > 0) {
      page.drawRectangle({
        x: MARGIN,

        y:
          cursorY - 9,

        width:
          (width * fill) /
          100,

        height: 13,

        color:
          COLORS.green,
      });
    }

    cursorY -= 31;
  }

  /* ========================================
     HISTORIQUE DES CONTRIBUTIONS
  ======================================== */

  function tableHeader() {
    ensureSpace(37);

    page.drawRectangle({
      x: MARGIN,

      y:
        cursorY - 28,

      width:
        CONTENT_WIDTH,

      height: 33,

      color:
        COLORS.navy,
    });

    drawText(
      t.number,
      {
        x:
          MARGIN + 12,

        y:
          cursorY - 16,

        size: 9,

        strong: true,

        color:
          COLORS.white,
      }
    );

    drawText(
      t.date,
      {
        x:
          MARGIN + 68,

        y:
          cursorY - 16,

        size: 9,

        strong: true,

        color:
          COLORS.white,
      }
    );

    drawText(
      t.amount,
      {
        x:
          MARGIN + 350,

        y:
          cursorY - 16,

        size: 9,

        strong: true,

        color:
          COLORS.white,
      }
    );

    cursorY -= 34;
  }

  function tableRow(
    contribution: ReportContribution,
    index: number
  ) {
    if (
      cursorY - 35 <
      MARGIN + 25
    ) {
      page = addPage();
      tableHeader();
    }

    page.drawRectangle({
      x: MARGIN,

      y:
        cursorY - 28,

      width:
        CONTENT_WIDTH,

      height: 32,

      color:
        index % 2 === 0
          ? COLORS.light
          : COLORS.white,
    });

    drawText(
      String(index + 1),
      {
        x:
          MARGIN + 12,

        y:
          cursorY - 16,

        size: 9,
      }
    );

    drawText(
      formatDate(
        contribution.createdAt,
        language
      ),
      {
        x:
          MARGIN + 68,

        y:
          cursorY - 16,

        size: 8,
      }
    );

    const money =
      formatMoney(
        contribution.amount,
        report.currency,
        language
      );

    let size = 9;

    while (
      size > 7 &&
      regular.widthOfTextAtSize(
        pdfText(
          money,
          regular
        ),
        size
      ) > 150
    ) {
      size -= 0.5;
    }

    drawText(
      money,
      {
        x:
          MARGIN + 350,

        y:
          cursorY - 16,

        size,
      }
    );

    cursorY -= 33;
  }

  /* ========================================
     PAGE DE COUVERTURE
  ======================================== */



  drawText(
    "TIKEMIA",
    {
      size: 29,

      strong: true,

      color:
        COLORS.darkGreen,
    }
  );

  cursorY -= 25;

  drawText(
    t.organizerSpace,
    {
      size: 9,

      strong: true,

      color:
        COLORS.muted,
    }
  );

  cursorY -= 20;

  page.drawRectangle({
    x: MARGIN,

    y: cursorY,

    width:
      CONTENT_WIDTH,

    height: 2,

    color:
      COLORS.yellow,
  });

  cursorY -= 32;

  paragraph(
    t.reportTitle,
    {
      size: 17,

      strong: true,

      color:
        COLORS.navy,

      spacing: 12,
    }
  );

  paragraph(
    report.title,
    {
      size: 15,

      strong: true,

      color:
        COLORS.darkGreen,

      spacing: 10,
    }
  );

  paragraph(
    `${t.generatedAt} : ${formatDate(
      new Date(),
      language
    )} UTC`,
    {
      size: 9,

      color:
        COLORS.muted,
    }
  );

  /* ========================================
     INFORMATIONS DE LA CAGNOTTE
  ======================================== */

  section(
    t.information
  );

  infoRow(
    t.campaignName,
    report.title
  );

  infoRow(
    t.status,
    report.status
  );

  infoRow(
    t.location,
    [
      report.city,
      report.country,
    ]
      .filter(Boolean)
      .join(", ")
  );

  infoRow(
    t.createdAt,
    formatDate(
      report.createdAt,
      language
    )
  );

  /* ========================================
     DESCRIPTION
  ======================================== */

  section(
    t.description
  );

  paragraph(
    report.description,
    {
      size: 10,

      color:
        COLORS.text,

      spacing: 10,
    }
  );

  /* ========================================
     BILAN FINANCIER
  ======================================== */

  section(
    t.finance
  );

  moneyRow(
    t.goal,
    formatMoney(
      report.goalAmount,
      report.currency,
      language
    )
  );

  moneyRow(
    t.collected,
    formatMoney(
      report.collectedAmount,
      report.currency,
      language
    )
  );

  moneyRow(
    t.remaining,
    formatMoney(
      report.remainingAmount,
      report.currency,
      language
    )
  );

  moneyRow(
    t.contributions,
    formatInteger(
      report.contributionCount,
      language
    )
  );

  moneyRow(
    t.progress,
    formatPercentage(
      report.progress,
      language
    )
  );

  progressBar(
    report.progress
  );

  /* ========================================
     HISTORIQUE
  ======================================== */

  section(
    t.history
  );

  if (
    report.contributions.length === 0
  ) {
    paragraph(
      t.noContributions,
      {
        size: 10,
        color:
          COLORS.muted,
      }
    );
  } else {
    tableHeader();

    report.contributions.forEach(
      (
        contribution,
        index
      ) => {
        tableRow(
          contribution,
          index
        );
      }
    );
  }

  /* ========================================
     NOTES
  ======================================== */

  cursorY -= 15;

  paragraph(
    t.financialNote,
    {
      size: 9,

      color:
        COLORS.muted,
    }
  );

  paragraph(
    t.privacyNote,
    {
      size: 9,

      color:
        COLORS.muted,
    }
  );

  /* ========================================
     PIED DE PAGE
  ======================================== */

  const pages =
    document.getPages();

  pages.forEach(
    (
      currentPage,
      index
    ) => {
      currentPage.drawLine({
        start: {
          x: MARGIN,
          y: 48,
        },

        end: {
          x:
            PAGE_WIDTH - MARGIN,
          y: 48,
        },

        thickness: 0.7,

        color:
          COLORS.border,
      });

      currentPage.drawText(
        pdfText(
          `TIKEMIA  |  ${t.page} ${
            index + 1
          } ${t.of} ${pages.length}`,
          regular
        ),
        {
          x: MARGIN,

          y: 32,

          size: 8,

          font:
            regular,

          color:
            COLORS.muted,
        }
      );
    }
  );

  return document.save();
}

/* ============================================
   GET — TÉLÉCHARGEMENT DU RAPPORT
============================================ */

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const language =
    getLanguage(request);

  try {
    /* ----------------------------------------
       1. VÉRIFIER LA SESSION
    ---------------------------------------- */

    const prisma =
      getPrisma();

    const organizer =
      await getOrganizer(
        request,
        prisma
      );

    if (!organizer) {
      return errorResponse(
        language,
        "unauthorized",
        401
      );
    }

    /* ----------------------------------------
       2. IDENTIFIANT DE LA CAGNOTTE
    ---------------------------------------- */

    const {
      id,
    } = await context.params;

    if (
      !id ||
      !ID_PATTERN.test(id)
    ) {
      return errorResponse(
        language,
        "invalidId",
        400
      );
    }

    /* ----------------------------------------
       3. CONTRÔLER LA PROPRIÉTÉ

       Aucune cagnotte appartenant
       à un autre organisateur
       ne peut être consultée.
    ---------------------------------------- */

    const campaign =
      await prisma.campaign.findFirst({
        where: {
          id,

          organizationId: {
            in:
              organizer.organizationIds,
          },
        },

        select: {
          id: true,

          title: true,

          description: true,

          status: true,

          country: true,

          city: true,

          currency: true,

          goalAmount: true,

          createdAt: true,
        },
      });

    if (!campaign) {
      return errorResponse(
        language,
        "notFound",
        404
      );
    }

    /* ----------------------------------------
       4. LIRE UNIQUEMENT LES DONS CONFIRMÉS

       Cette implémentation utilise
       Donation.status = CONFIRMED.

       Les dons en attente ou refusés
       n'entrent pas dans les calculs.

       Aucune donnée nominative
       des donateurs n'est chargée.
    ---------------------------------------- */

    const contributions:
      ReportContribution[] = [];

    let cursor:
      string | undefined;

    let collectedAmount =
      BigInt(0);

    let contributionCount = 0;

    while (true) {
      const batch =
        await prisma.donation.findMany({
          where: {
            campaignId:
              campaign.id,

            status:
              "CONFIRMED",
          },

          select: {
            id: true,

            amount: true,

            currency: true,

            createdAt: true,
          },

          orderBy: {
            id: "asc",
          },

          take:
            QUERY_BATCH_SIZE,

          ...(cursor
            ? {
                cursor: {
                  id: cursor,
                },

                skip: 1,
              }
            : {}),
        });

      if (
        batch.length === 0
      ) {
        break;
      }

      for (
        const donation of batch
      ) {
        /* ----------------------------------
           Ne jamais additionner
           deux devises différentes.
        ---------------------------------- */

        if (
          donation.currency !==
          campaign.currency
        ) {
          return errorResponse(
            language,
            "currencyMismatch",
            409
          );
        }

        const amount =
          toBigInt(
            donation.amount
          );

        if (amount < 0n) {
          throw new Error(
            "NEGATIVE_DONATION_AMOUNT"
          );
        }

        collectedAmount +=
          amount;

        contributionCount++;

        contributions.push({
          id:
            donation.id,

          amount,

          createdAt:
            donation.createdAt,
        });

        /* ----------------------------------
           Limiter le travail de génération.

           Pour un volume supérieur,
           prévoir un export asynchrone
           côté serveur.
        ---------------------------------- */

        if (
          contributions.length >
          MAX_CONTRIBUTIONS
        ) {
          return errorResponse(
            language,
            "tooManyContributions",
            413
          );
        }
      }

      cursor =
        batch[
          batch.length - 1
        ].id;

      if (
        batch.length <
        QUERY_BATCH_SIZE
      ) {
        break;
      }
    }

    /* ----------------------------------------
       5. CALCUL DU BILAN

       Montants exacts en BigInt.
    ---------------------------------------- */

    const goalAmount =
      toBigInt(
        campaign.goalAmount
      );

    if (goalAmount <= 0n) {
      throw new Error(
        "INVALID_CAMPAIGN_GOAL"
      );
    }

    const remainingAmount =
      collectedAmount >=
      goalAmount
        ? BigInt(0)
        : goalAmount -
          collectedAmount;

    const progress =
      calculateProgress(
        collectedAmount,
        goalAmount
      );

    /* ----------------------------------------
       6. CONSTRUIRE LE RAPPORT
    ---------------------------------------- */

    const report: ReportData = {
      id:
        campaign.id,

      title:
        campaign.title,

      description:
        campaign.description,

      status:
        String(
          campaign.status
        ),

      country:
        campaign.country ?? "",

      city:
        campaign.city ?? "",

      currency:
        campaign.currency,

      goalAmount,

      collectedAmount,

      remainingAmount,

      progress,

      contributionCount,

      createdAt:
        campaign.createdAt,

      contributions,
    };

    /* ----------------------------------------
       7. GÉNÉRATION PDF
    ---------------------------------------- */

    const pdfBytes =
      await generatePdf(
        report,
        language
      );

    /* ----------------------------------------
       8. NOM DU DOCUMENT
    ---------------------------------------- */

    const filename =
      `TIKEMIA-cagnotte-${safeFileName(
        campaign.title
      )}.pdf`;

    /* ----------------------------------------
       9. TÉLÉCHARGEMENT SÉCURISÉ
    ---------------------------------------- */

    return new NextResponse(
      new Uint8Array(
        pdfBytes
      ),
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `attachment; filename="${filename}"`,

          "Content-Length":
            String(
              pdfBytes.length
            ),

          "Cache-Control":
            "private, no-store, max-age=0",

          "X-Content-Type-Options":
            "nosniff",

          "Content-Security-Policy":
            "default-src 'none'; sandbox",

          Vary:
            "Cookie",
        },
      }
    );
  } catch (error) {
    console.error(
      "[TIKEMIA CAMPAIGN REPORT]",
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
