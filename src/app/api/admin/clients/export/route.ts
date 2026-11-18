import { unstable_rethrow } from "next/navigation";

import "server-only";

import { createHash } from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import {
  getPlatformPrisma,
} from "@/lib/payments/fulfillment";

/**
 * ============================================================
 * TIKEMIA — EXPORT PDF DES CLIENTS
 * ============================================================
 *
 * FICHIER :
 * src/app/api/admin/clients/export/route.ts
 *
 * ENDPOINT :
 * GET /api/admin/clients/export
 *
 * PARAMÈTRE OPTIONNEL :
 * ?search=...
 *
 * OBJECTIF :
 *
 * Générer un PDF avec :
 *
 * - Tous les clients inscrits
 * - Les clients ayant effectué des commandes
 * - Les acheteurs invités
 * - Les informations disponibles
 * - Nom
 * - Email
 * - Téléphone
 *
 * Les doublons sont regroupés par email.
 *
 * Le PDF contient tous les clients qui
 * correspondent à la recherche.
 *
 * AUCUNE pagination de 20 clients.
 * AUCUNE donnée fictive.
 * AUCUNE modification PostgreSQL.
 *
 * SÉCURITÉ :
 *
 * - ADMIN / SUPER_ADMIN uniquement
 * - Session PostgreSQL vérifiée
 * - Document généré côté serveur
 * - Aucun fichier public
 * - Aucun stockage externe obligatoire
 * - Aucun cache HTTP
 *
 * PRÉREQUIS :
 *
 * npm install pdf-lib
 *
 * ============================================================
 */


/* ============================================================
   CONSTANTES
============================================================ */

const SESSION_COOKIE_NAME =
  "tikemia_admin_session";

const MAX_SEARCH_LENGTH = 100;

const DATABASE_BATCH_SIZE = 500;

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

const PAGE_MARGIN = 42;

const TABLE_TOP = 680;
const TABLE_BOTTOM = 75;

const HEADER_HEIGHT = 34;

const ROW_PADDING = 9;

const FONT_SIZE = 9;

const LINE_HEIGHT = 12.5;

/* ============================================================
   COULEURS TIKEMIA
============================================================ */

const COLORS = {
  navy: rgb(0.063, 0.149, 0.239),

  navyLight: rgb(0.105, 0.222, 0.337),

  green: rgb(0.031, 0.478, 0.196),

  greenLight: rgb(0.915, 0.973, 0.929),

  white: rgb(1, 1, 1),

  background: rgb(0.969, 0.98, 0.973),

  text: rgb(0.169, 0.235, 0.306),

  muted: rgb(0.447, 0.51, 0.569),

  border: rgb(0.871, 0.91, 0.886),
};

/* ============================================================
   TYPES
============================================================ */

type ApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_REQUEST"
  | "EXPORT_FAILED"
  | "DATABASE_ERROR";

type AdminIdentity = {
  id: string;
  role: "ADMIN" | "SUPER_ADMIN";
};

type ClientRow = {
  id: string;

  name: string;

  email: string;

  phoneE164: string | null;

  source: "REGISTERED" | "GUEST";

  registeredAt: Date | null;
};

type PdfContext = {
  document: PDFDocument;

  font: PDFFont;
  boldFont: PDFFont;

  page: PDFPage;

  y: number;

  pageNumber: number;

  pages: PDFPage[];

  generatedAt: Date;

  search: string;

  totalClients: number;
};

/* ============================================================
   ERREURS
============================================================ */

class ExportError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly statusCode: number
  ) {
    super(code);

    this.name = "ExportError";
  }
}

/* ============================================================
   RÉPONSES
============================================================ */

function jsonError(
  code: ApiErrorCode,
  status: number
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      code,
    },
    {
      status,

      headers: {
        "Cache-Control": "private, no-store",

        "X-Content-Type-Options": "nosniff",

        "Referrer-Policy": "no-referrer",

        Vary: "Cookie",
      },
    }
  );
}

/* ============================================================
   AUTHENTIFICATION ADMINISTRATEUR
============================================================ */

/**
 * Contrat des API administrateur TIKEMIA :
 *
 * Cookie : tikemia_session
 *
 * Session.tokenHash = SHA-256(token)
 *
 * Utilisateur actif et non bloqué.
 *
 * Rôle ADMIN ou SUPER_ADMIN.
 *
 * Si la route de connexion a changé,
 * réutiliser son mécanisme réel de session.
 */

async function authenticateAdmin(
  request: NextRequest
): Promise<AdminIdentity | null> {
  const token = request.cookies.get(
    SESSION_COOKIE_NAME
  )?.value;

  if (
    !token ||
    !/^[a-f0-9]{64}$/.test(token)
  ) {
    return null;
  }

  const tokenHash = createHash("sha256")
    .update(Buffer.from(token, "hex"))
    .digest("hex");

  const prisma = getPlatformPrisma();

  const session = await prisma.session.findUnique({
    where: {
      tokenHash,
    },

    select: {
      expiresAt: true,
      revokedAt: true,

      user: {
        select: {
          id: true,
          isActive: true,
          isBlocked: true,

          roles: {
            where: {
              role: {
                in: [
                  "ADMIN",
                  "SUPER_ADMIN",
                ],
              },
            },

            select: {
              role: true,
            },
          },
        },
      },
    },
  });

  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }

  const user = session.user;

  if (
    !user ||
    !user.isActive ||
    user.isBlocked
  ) {
    return null;
  }

  if (
    user.roles.some(
      (role) => role.role === "SUPER_ADMIN"
    )
  ) {
    return {
      id: user.id,
      role: "SUPER_ADMIN",
    };
  }

  if (
    user.roles.some(
      (role) => role.role === "ADMIN"
    )
  ) {
    return {
      id: user.id,
      role: "ADMIN",
    };
  }

  return null;
}

/* ============================================================
   VALIDATION DE RECHERCHE
============================================================ */

function parseSearch(
  request: NextRequest
): string {
  const params = request.nextUrl.searchParams;

  for (const key of params.keys()) {
    if (
      key !== "search" ||
      params.getAll(key).length !== 1
    ) {
      throw new ExportError(
        "INVALID_REQUEST",
        400
      );
    }
  }

  const search = (
    params.get("search") ?? ""
  ).trim();

  if (
    search.length > MAX_SEARCH_LENGTH ||
    /[\u0000-\u001F\u007F]/.test(search)
  ) {
    throw new ExportError(
      "INVALID_REQUEST",
      400
    );
  }

  return search;
}

/* ============================================================
   NORMALISATION CLIENT
============================================================ */

function normalizeEmail(
  email: string
): string {
  return email.trim().toLowerCase();
}

function normalizePhone(
  phone: string | null | undefined
): string | null {
  if (
    typeof phone !== "string"
  ) {
    return null;
  }

  const clean = phone.trim();

  return clean || null;
}

function cleanName(
  value: string | null | undefined
): string {
  const name =
    typeof value === "string"
      ? value.trim()
      : "";

  return name || "Non renseigné";
}

/* ============================================================
   CHARGEMENT DES CLIENTS POSTGRESQL
============================================================ */

/**
 * L'export reprend :
 *
 * 1. Les comptes ayant le rôle CLIENT.
 *
 * 2. Les utilisateurs ayant effectué
 *    une commande ou un don, même si
 *    leur rôle principal est différent.
 *
 * 3. Les commandes invitées (buyerId null).
 *
 * Une adresse email correspond à une
 * entrée dans le PDF.
 *
 * Les données d'un compte inscrit
 * sont prioritaires sur celles
 * d'une commande invitée.
 *
 * Aucun nombre limite de 20 ou 50 clients.
 */

async function loadAllClients():
  Promise<ClientRow[]> {
  const prisma =
    getPlatformPrisma();

  const clientsByEmail =
    new Map<string, ClientRow>();

  /* ----------------------------------------------------------
     1. CLIENTS INSCRITS
  ---------------------------------------------------------- */

  let userCursor:
    string | undefined;

  while (true) {
    const users =
      await prisma.user.findMany({
        where: {
          OR: [
            {
              roles: {
                some: {
                  role: "CLIENT",
                },
              },
            },
            {
              orders: {
                some: {},
              },
            },
            {
              donations: {
                some: {},
              },
            },
          ],
        },

        take: DATABASE_BATCH_SIZE,

        ...(userCursor
          ? {
              skip: 1,
              cursor: {
                id: userCursor,
              },
            }
          : {}),

        orderBy: {
          id: "asc",
        },

        select: {
          id: true,
          fullName: true,
          email: true,
          phoneE164: true,
          createdAt: true,
        },
      });

    if (users.length === 0) {
      break;
    }

    for (const user of users) {
      const email =
        normalizeEmail(user.email);

      if (!email) continue;

      clientsByEmail.set(email, {
        id: user.id,

        name: cleanName(
          user.fullName
        ),

        email: user.email.trim(),

        phoneE164: normalizePhone(
          user.phoneE164
        ),

        source: "REGISTERED",

        registeredAt: user.createdAt,
      });
    }

    userCursor =
      users[users.length - 1].id;

    if (
      users.length < DATABASE_BATCH_SIZE
    ) {
      break;
    }
  }

  /* ----------------------------------------------------------
     2. ACHETEURS INVITÉS
  ---------------------------------------------------------- */

  let orderCursor:
    string | undefined;

  while (true) {
    const orders =
      await prisma.order.findMany({
        where: {
          buyerId: null,
        },

        take: DATABASE_BATCH_SIZE,

        ...(orderCursor
          ? {
              skip: 1,
              cursor: {
                id: orderCursor,
              },
            }
          : {}),

        orderBy: {
          id: "asc",
        },

        select: {
          id: true,
          guestEmail: true,
          guestPhoneE164: true,
          createdAt: true,
        },
      });

    if (
      orders.length === 0
    ) {
      break;
    }

    for (const order of orders) {
      const email =
        normalizeEmail(
          order.guestEmail
        );

      if (!email) continue;

      const phone =
        normalizePhone(
          order.guestPhoneE164
        );

      const existing =
        clientsByEmail.get(email);

      if (existing) {
        /*
         * Un client déjà connu ne doit
         * pas être ajouté une seconde fois.
         *
         * Si aucun téléphone n'est renseigné
         * dans le compte, on utilise celui
         * de la commande invitée.
         */

        if (
          !existing.phoneE164 &&
          phone
        ) {
          existing.phoneE164 = phone;
        }

        continue;
      }

      clientsByEmail.set(email, {
        id: order.id,

        name: "Client invité",

        email: order.guestEmail.trim(),

        phoneE164: phone,

        source: "GUEST",

        registeredAt: order.createdAt,
      });
    }

    orderCursor =
      orders[orders.length - 1].id;

    if (
      orders.length <
      DATABASE_BATCH_SIZE
    ) {
      break;
    }
  }

  return Array.from(
    clientsByEmail.values()
  );
}

/* ============================================================
   FILTRER LES CLIENTS
============================================================ */

/**
 * Même recherche fonctionnelle :
 *
 * - Nom
 * - Email
 * - Téléphone
 *
 * Le filtre s'applique à tous les
 * clients, pas à une seule page.
 */

function filterClients(
  clients: ClientRow[],
  search: string
): ClientRow[] {
  const query =
    search.trim().toLocaleLowerCase(
      "fr"
    );

  if (!query) {
    return clients;
  }

  return clients.filter(
    (client) => {
      const fields = [
        client.name,
        client.email,
        client.phoneE164 ?? "",
      ];

      return fields.some(
        (field) =>
          field
            .toLocaleLowerCase("fr")
            .includes(query)
      );
    }
  );
}

/* ============================================================
   NETTOYAGE TEXTE POUR LES POLICES PDF
============================================================ */

/**
 * Les polices standards de pdf-lib
 * utilisent l'encodage WinAnsi.
 *
 * Les caractères non pris en charge
 * sont remplacés pour éviter qu'un
 * seul nom ne bloque tout l'export.
 *
 * Cette normalisation peut simplifier
 * certains noms comportant des
 * caractères non latins.
 */

function pdfSafeText(
  input: string | null | undefined
): string {
  if (!input) {
    return "Non renseigne";
  }

  const substitutions:
    Record<string, string> = {
      "\u2018": "'",
      "\u2019": "'",
      "\u201C": '"',
      "\u201D": '"',
      "\u2013": "-",
      "\u2014": "-",
      "\u2026": "...",
      "\u00A0": " ",
      "\u0152": "OE",
      "\u0153": "oe",
      "\u0141": "L",
      "\u0142": "l",
    };

  const replaced =
    input.replace(
      /[\u2018\u2019\u201C\u201D\u2013\u2014\u2026\u00A0\u0152\u0153\u0141\u0142]/g,
      (character) =>
        substitutions[character] ??
        character
    );

  const normalized =
    replaced
      .normalize("NFKD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      );

  return Array.from(normalized)
    .map((character) => {
      const code =
        character.codePointAt(0) ?? 0;

      if (
        code === 9 ||
        code === 10 ||
        code === 13
      ) {
        return " ";
      }

      if (
        code >= 32 &&
        code <= 126
      ) {
        return character;
      }

      if (
        code >= 160 &&
        code <= 255
      ) {
        return character;
      }

      return "?";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim() || "Non renseigne";
}

/* ============================================================
   AJUSTER LE TEXTE DANS UNE COLONNE
============================================================ */

function fitText(
  input: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string {
  const safe =
    pdfSafeText(input);

  if (
    font.widthOfTextAtSize(
      safe,
      size
    ) <= maxWidth
  ) {
    return safe;
  }

  const ellipsis = "...";

  let low = 0;
  let high = safe.length;

  while (
    low < high
  ) {
    const middle =
      Math.ceil(
        (low + high) / 2
      );

    const candidate =
      safe.slice(0, middle) +
      ellipsis;

    if (
      font.widthOfTextAtSize(
        candidate,
        size
      ) <= maxWidth
    ) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return (
    safe.slice(0, low) +
    ellipsis
  );
}

/* ============================================================
   DATE DU DOCUMENT
============================================================ */

function formatDate(
  value: Date
): string {
  return new Intl.DateTimeFormat(
    "fr-FR",
    {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "UTC",
    }
  ).format(value) + " UTC";
}

/* ============================================================
   CRÉATION D'UNE PAGE PDF
============================================================ */

function createPage(
  context: PdfContext
): void {
  const page =
    context.document.addPage([
      PAGE_WIDTH,
      PAGE_HEIGHT,
    ]);

  context.page = page;

  context.pageNumber += 1;

  context.pages.push(page);

  /* ----------------------------------------------------------
     BANDEAU SUPERIEUR
  ---------------------------------------------------------- */

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 104,

    width: PAGE_WIDTH,
    height: 104,

    color: COLORS.navy,
  });

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 109,

    width: PAGE_WIDTH,
    height: 5,

    color: COLORS.green,
  });

  /* ----------------------------------------------------------
     IDENTITÉ TIKEMIA
  ---------------------------------------------------------- */

  page.drawText(
    "TIKEMIA",
    {
      x: PAGE_MARGIN,
      y: PAGE_HEIGHT - 48,

      size: 24,
      font: context.boldFont,

      color: COLORS.white,
    }
  );

  page.drawText(
    "ADMINISTRATION",
    {
      x: PAGE_MARGIN,
      y: PAGE_HEIGHT - 69,

      size: 9,
      font: context.font,

      color: rgb(
        0.75,
        0.87,
        0.8
      ),
    }
  );

  page.drawText(
    "Liste des clients",
    {
      x: PAGE_MARGIN,
      y: PAGE_HEIGHT - 92,

      size: 12,
      font: context.boldFont,

      color: COLORS.white,
    }
  );

  /* ----------------------------------------------------------
     DATE ET DESCRIPTION
  ---------------------------------------------------------- */

  page.drawText(
    `Genere le : ${pdfSafeText(
      formatDate(context.generatedAt)
    )}`,
    {
      x: PAGE_MARGIN,
      y: PAGE_HEIGHT - 139,

      size: 9,
      font: context.font,

      color: COLORS.muted,
    }
  );

  page.drawText(
    `Nombre total de clients : ${context.totalClients}`,
    {
      x: PAGE_MARGIN,
      y: PAGE_HEIGHT - 159,

      size: 11,
      font: context.boldFont,

      color: COLORS.navy,
    }
  );

  if (
    context.search
  ) {
    page.drawText(
      `Recherche : ${fitText(
        context.search,
        context.font,
        9,
        PAGE_WIDTH - PAGE_MARGIN * 2 - 70
      )}`,
      {
        x: PAGE_MARGIN,
        y: PAGE_HEIGHT - 178,

        size: 9,
        font: context.font,

        color: COLORS.muted,
      }
    );
  }

  /* ----------------------------------------------------------
     TITRE DU TABLEAU
  ---------------------------------------------------------- */

  page.drawText(
    "COORDONNEES DES CLIENTS",
    {
      x: PAGE_MARGIN,
      y: TABLE_TOP + 31,

      size: 10,
      font: context.boldFont,

      color: COLORS.navy,
    }
  );

  /* ----------------------------------------------------------
     EN-TÊTE TABLEAU
  ---------------------------------------------------------- */

  const tableWidth =
    PAGE_WIDTH -
    PAGE_MARGIN * 2;

  page.drawRectangle({
    x: PAGE_MARGIN,
    y: TABLE_TOP - HEADER_HEIGHT,

    width: tableWidth,
    height: HEADER_HEIGHT,

    color: COLORS.navyLight,
  });

  const columns =
    getTableColumns();

  page.drawText(
    "CLIENT",
    {
      x: columns.name.x + 8,
      y: TABLE_TOP - 22,

      size: 9,
      font: context.boldFont,

      color: COLORS.white,
    }
  );

  page.drawText(
    "EMAIL",
    {
      x: columns.email.x + 8,
      y: TABLE_TOP - 22,

      size: 9,
      font: context.boldFont,

      color: COLORS.white,
    }
  );

  page.drawText(
    "TELEPHONE",
    {
      x: columns.phone.x + 8,
      y: TABLE_TOP - 22,

      size: 9,
      font: context.boldFont,

      color: COLORS.white,
    }
  );

  context.y =
    TABLE_TOP -
    HEADER_HEIGHT;
}

/* ============================================================
   LARGEUR DES COLONNES
============================================================ */

function getTableColumns() {
  const tableWidth =
    PAGE_WIDTH -
    PAGE_MARGIN * 2;

  const nameWidth =
    tableWidth * 0.30;

  const emailWidth =
    tableWidth * 0.43;

  const phoneWidth =
    tableWidth -
    nameWidth -
    emailWidth;

  return {
    name: {
      x: PAGE_MARGIN,
      width: nameWidth,
    },

    email: {
      x: PAGE_MARGIN +
        nameWidth,

      width: emailWidth,
    },

    phone: {
      x: PAGE_MARGIN +
        nameWidth +
        emailWidth,

      width: phoneWidth,
    },
  };
}

/* ============================================================
   DESSINER UNE LIGNE CLIENT
============================================================ */

function drawClientRow(
  context: PdfContext,
  client: ClientRow,
  index: number
): void {
  const rowHeight =
    LINE_HEIGHT +
    ROW_PADDING * 2;

  if (
    context.y - rowHeight <
    TABLE_BOTTOM
  ) {
    createPage(context);
  }

  const page =
    context.page;

  const topY =
    context.y;

  const bottomY =
    topY - rowHeight;

  const tableWidth =
    PAGE_WIDTH -
    PAGE_MARGIN * 2;

  /* ----------------------------------------------------------
     ALTERNANCE DES LIGNES
  ---------------------------------------------------------- */

  if (
    index % 2 === 0
  ) {
    page.drawRectangle({
      x: PAGE_MARGIN,
      y: bottomY,

      width: tableWidth,
      height: rowHeight,

      color: COLORS.background,
    });
  }

  /* ----------------------------------------------------------
     BORDURE INFERIEURE
  ---------------------------------------------------------- */

  page.drawLine({
    start: {
      x: PAGE_MARGIN,
      y: bottomY,
    },

    end: {
      x:
        PAGE_WIDTH -
        PAGE_MARGIN,
      y: bottomY,
    },

    thickness: 0.5,

    color: COLORS.border,
  });

  const columns =
    getTableColumns();

  const textY =
    topY -
    ROW_PADDING -
    FONT_SIZE;

  /* ----------------------------------------------------------
     NOM
  ---------------------------------------------------------- */

  page.drawText(
    fitText(
      client.name,
      context.boldFont,
      FONT_SIZE,
      columns.name.width - 16
    ),
    {
      x: columns.name.x + 8,
      y: textY,

      size: FONT_SIZE,

      font:
        context.boldFont,

      color:
        COLORS.text,
    }
  );

  /* ----------------------------------------------------------
     EMAIL
  ---------------------------------------------------------- */

  page.drawText(
    fitText(
      client.email,
      context.font,
      FONT_SIZE,
      columns.email.width - 16
    ),
    {
      x: columns.email.x + 8,
      y: textY,

      size: FONT_SIZE,

      font: context.font,

      color: COLORS.text,
    }
  );

  /* ----------------------------------------------------------
     TELEPHONE
  ---------------------------------------------------------- */

  page.drawText(
    fitText(
      client.phoneE164 ??
        "Non renseigne",
      context.font,
      FONT_SIZE,
      columns.phone.width - 16
    ),
    {
      x: columns.phone.x + 8,
      y: textY,

      size: FONT_SIZE,

      font: context.font,

      color: COLORS.text,
    }
  );

  context.y =
    bottomY;
}

/* ============================================================
   PIED DE PAGE
============================================================ */

function drawFooter(
  context: PdfContext
): void {
  const totalPages =
    context.pages.length;

  for (
    let index = 0;
    index < totalPages;
    index++
  ) {
    const page =
      context.pages[index];

    page.drawLine({
      start: {
        x: PAGE_MARGIN,
        y: 54,
      },

      end: {
        x:
          PAGE_WIDTH -
          PAGE_MARGIN,
        y: 54,
      },

      thickness: 0.8,

      color: COLORS.border,
    });

    page.drawText(
      "TIKEMIA - Document administratif confidentiel",
      {
        x: PAGE_MARGIN,
        y: 37,

        size: 8,
        font: context.font,

        color: COLORS.muted,
      }
    );

    const pageLabel =
      `Page ${index + 1} / ${totalPages}`;

    const labelWidth =
      context.font.widthOfTextAtSize(
        pageLabel,
        8
      );

    page.drawText(
      pageLabel,
      {
        x:
          PAGE_WIDTH -
          PAGE_MARGIN -
          labelWidth,

        y: 37,

        size: 8,
        font: context.font,

        color: COLORS.muted,
      }
    );
  }
}

/* ============================================================
   CONSTRUIRE LE DOCUMENT PDF
============================================================ */

async function generateClientsPdf(
  clients: ClientRow[],
  search: string
): Promise<Uint8Array> {
  const document =
    await PDFDocument.create();

  document.setTitle(
    "TIKEMIA - Liste des clients"
  );

  document.setAuthor(
    "TIKEMIA"
  );

  document.setSubject(
    "Export administratif des clients"
  );

  document.setCreator(
    "Administration TIKEMIA"
  );

  document.setProducer(
    "TIKEMIA"
  );

  const font =
    await document.embedFont(
      StandardFonts.Helvetica
    );

  const boldFont =
    await document.embedFont(
      StandardFonts.HelveticaBold
    );

  const initialPage =
    document.addPage([
      PAGE_WIDTH,
      PAGE_HEIGHT,
    ]);

  const context: PdfContext = {
    document,

    font,
    boldFont,

    page: initialPage,

    y: TABLE_TOP,

    pageNumber: 0,

    pages: [],

    generatedAt:
      new Date(),

    search,

    totalClients:
      clients.length,
  };

  /*
   * createPage crée la première
   * vraie page du document.
   *
   * Supprimer la page temporaire.
   */

  document.removePage(0);

  createPage(context);

  /* ----------------------------------------------------------
     CAS : AUCUN CLIENT
  ---------------------------------------------------------- */

  if (
    clients.length === 0
  ) {
    context.page.drawText(
      "Aucun client ne correspond aux criteres.",
      {
        x: PAGE_MARGIN + 10,
        y: context.y - 25,

        size: 11,
        font: context.font,

        color: COLORS.muted,
      }
    );
  }

  /* ----------------------------------------------------------
     LIGNES DES CLIENTS
  ---------------------------------------------------------- */

  clients.forEach(
    (client, index) => {
      drawClientRow(
        context,
        client,
        index
      );
    }
  );

  /* ----------------------------------------------------------
     PAGINATION DES PAGES PDF
  ---------------------------------------------------------- */

  drawFooter(context);

  /* ----------------------------------------------------------
     ENREGISTRER EN MÉMOIRE
  ---------------------------------------------------------- */

  return document.save({
    useObjectStreams: true,
  });
}

/* ============================================================
   GET — TÉLÉCHARGEMENT PDF
============================================================ */

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  try {
    /* --------------------------------------------------------
       1. SESSION ADMINISTRATEUR
    -------------------------------------------------------- */

    const admin =
      await authenticateAdmin(
        request
      );

    if (!admin) {
      return jsonError(
        "UNAUTHORIZED",
        401
      );
    }

    /* --------------------------------------------------------
       2. RECHERCHE
    -------------------------------------------------------- */

    const search =
      parseSearch(request);

    /* --------------------------------------------------------
       3. CHARGER TOUS LES CLIENTS
    -------------------------------------------------------- */

    const allClients =
      await loadAllClients();

    /* --------------------------------------------------------
       4. FILTRER LES CLIENTS
    -------------------------------------------------------- */

    const filteredClients =
      filterClients(
        allClients,
        search
      );

    /* --------------------------------------------------------
       5. TRIER
    -------------------------------------------------------- */

    filteredClients.sort(
      (a, b) => {
        const byName =
          a.name.localeCompare(
            b.name,
            "fr",
            {
              sensitivity: "base",
            }
          );

        if (
          byName !== 0
        ) {
          return byName;
        }

        return a.email.localeCompare(
          b.email,
          "fr",
          {
            sensitivity: "base",
          }
        );
      }
    );

    /* --------------------------------------------------------
       6. GÉNÉRER LE PDF
    -------------------------------------------------------- */

    const pdfBytes =
      await generateClientsPdf(
        filteredClients,
        search
      );

    /* --------------------------------------------------------
       7. NOM DU DOCUMENT
    -------------------------------------------------------- */

    const date =
      new Date()
        .toISOString()
        .slice(0, 10);

    const filename =
      `tikemia-clients-${date}.pdf`;

    /* --------------------------------------------------------
       8. RÉPONSE PDF
    -------------------------------------------------------- */

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
              pdfBytes.byteLength
            ),

          "Cache-Control":
            "private, no-store, no-cache, must-revalidate",

          Pragma:
            "no-cache",

          Expires:
            "0",

          "X-Content-Type-Options":
            "nosniff",

          "Referrer-Policy":
            "no-referrer",

          "Content-Security-Policy":
            "sandbox",

          Vary:
            "Cookie",
        },
      }
    );
  } catch (error) {
    unstable_rethrow(error);
    if (
      error instanceof ExportError
    ) {
      return jsonError(
        error.code,
        error.statusCode
      );
    }

    console.error(
      "[TIKEMIA_ADMIN_CLIENTS_EXPORT]",
      error instanceof Error
        ? error.name
        : "UNKNOWN_ERROR"
    );

    return jsonError(
      "EXPORT_FAILED",
      503
    );
  }
}

/* ============================================================
   MÉTHODES NON AUTORISÉES
============================================================ */

function methodNotAllowed():
  NextResponse {
  return new NextResponse(
    null,
    {
      status: 405,

      headers: {
        Allow:
          "GET, HEAD",

        "Cache-Control":
          "private, no-store",
      },
    }
  );
}

export async function POST():
  Promise<NextResponse> {
  return methodNotAllowed();
}

export async function PUT():
  Promise<NextResponse> {
  return methodNotAllowed();
}

export async function PATCH():
  Promise<NextResponse> {
  return methodNotAllowed();
}

export async function DELETE():
  Promise<NextResponse> {
  return methodNotAllowed();
}
