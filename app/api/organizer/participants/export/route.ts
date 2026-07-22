import { createHash } from "node:crypto";

import ExcelJS from "exceljs";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  getOrganizerParticipants,
  GetOrganizerParticipantsError,
  ORGANIZER_PARTICIPANTS_SORTS,
  type GetOrganizerParticipantsResult,
  type OrganizerParticipantListItem,
  type OrganizerParticipantsSort,
} from "@/lib/organizer/get-organizer-participants";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportFormat = "csv" | "xlsx" | "pdf";

type ConnectedOrganizer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  businessName: string | null;
};

const SESSION_COOKIE_FALLBACK_NAME = "tikemia_session";
const MAX_EXPORT_PARTICIPANTS = 50_000;
const MAX_PDF_PARTICIPANTS = 1_000;

const CSV_MIME_TYPE = "text/csv; charset=utf-8";
const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PDF_MIME_TYPE = "application/pdf";

const UTF8_BOM = "\uFEFF";
const CSV_SEPARATOR = ";";
const CSV_LINE_BREAK = "\r\n";

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const PAGE_MARGIN_X = 28;
const PAGE_MARGIN_TOP = 30;
const PAGE_MARGIN_BOTTOM = 30;

const PDF_COLORS = {
  background: rgb(0.027, 0.063, 0.078),
  panel: rgb(0.047, 0.094, 0.114),
  panelSoft: rgb(0.065, 0.118, 0.137),
  border: rgb(0.15, 0.22, 0.24),
  white: rgb(1, 1, 1),
  text: rgb(0.84, 0.88, 0.9),
  muted: rgb(0.48, 0.55, 0.58),
  green: rgb(0.52, 0.8, 0.086),
  orange: rgb(0.976, 0.451, 0.086),
  blue: rgb(0.22, 0.74, 0.97),
  red: rgb(0.97, 0.44, 0.44),
  violet: rgb(0.75, 0.52, 0.98),
} as const;

class OrganizerParticipantsExportRouteError extends Error {
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
    this.name = "OrganizerParticipantsExportRouteError";
    this.code = code;
    this.status = status;
  }
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeFormat(value: string | null): ExportFormat {
  const normalized = value?.trim().toLowerCase();

  if (
    normalized === "csv" ||
    normalized === "xlsx" ||
    normalized === "pdf"
  ) {
    return normalized;
  }

  return "csv";
}

function normalizeOptionalText(value: string | null): string | undefined {
  const normalized = value?.trim() ?? "";
  return normalized || undefined;
}

function normalizeSort(value: string | null): OrganizerParticipantsSort {
  const normalized = value?.trim().toUpperCase();

  if (
    normalized &&
    ORGANIZER_PARTICIPANTS_SORTS.includes(
      normalized as OrganizerParticipantsSort,
    )
  ) {
    return normalized as OrganizerParticipantsSort;
  }

  return "NEWEST";
}

function parsePositiveInteger({
  value,
  fallback,
  maximum,
}: {
  value: string | null;
  fallback: number;
  maximum: number;
}): number {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

function sanitizeFilenamePart(value: string, fallback: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .toLowerCase();

  return normalized || fallback;
}

function createContentDisposition(filename: string): string {
  const safeFilename = filename.replace(/[\r\n"]/g, "").trim();

  const asciiFilename =
    safeFilename
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, "")
      .replace(/[\\/:*?<>|]/g, "-") || "tikemia-participants";

  const encodedFilename = encodeURIComponent(safeFilename).replace(
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
  const headers = new Headers();

  headers.set("Content-Type", mimeType);
  headers.set("Content-Disposition", createContentDisposition(filename));
  headers.set("Content-Length", String(contentLength));
  headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate, max-age=0",
  );
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  headers.set("X-Content-Type-Options", "nosniff");

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
      success: false,
      error: { code, message },
    },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function normalizeText(value: string | null | undefined): string {
  return (
    value
      ?.replace(/\u0000/g, "")
      .replace(/\r\n|\r|\n/g, " ")
      .replace(/\s+/g, " ")
      .trim() ?? ""
  );
}

function protectSpreadsheetFormula(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function escapeCsvCell(
  value: string | number | boolean | null | undefined,
): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let normalized: string;

  if (typeof value === "boolean") {
    normalized = value ? "Oui" : "Non";
  } else if (typeof value === "number") {
    normalized = Number.isFinite(value)
      ? String(value).replace(".", ",")
      : "";
  } else {
    normalized = protectSpreadsheetFormula(normalizeText(value));
  }

  return `"${normalized.replace(/"/g, '""')}"`;
}

function serializeCsvRows(
  rows: Array<Array<string | number | boolean | null | undefined>>,
): string {
  return rows
    .map((row) => row.map(escapeCsvCell).join(CSV_SEPARATOR))
    .join(CSV_LINE_BREAK);
}

function formatDateTime(value: string | null, timezone?: string): string {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }
}

function formatTicketStatus(
  status: OrganizerParticipantListItem["status"],
): string {
  switch (status) {
    case "VALID": return "Valide";
    case "USED": return "Utilisé";
    case "CANCELLED": return "Annulé";
    case "REFUNDED": return "Remboursé";
    default: return status;
  }
}

function formatOrderStatus(
  status: OrganizerParticipantListItem["order"]["status"],
): string {
  switch (status) {
    case "PENDING": return "En attente";
    case "PAID": return "Payée";
    case "CANCELLED": return "Annulée";
    case "REFUNDED": return "Remboursée";
    case "FAILED": return "Échouée";
    default: return status;
  }
}

function formatPaymentStatus(
  status:
    | NonNullable<OrganizerParticipantListItem["order"]["payment"]>["status"]
    | null
    | undefined,
): string {
  switch (status) {
    case "PENDING": return "En attente";
    case "SUCCESS": return "Réussi";
    case "FAILED": return "Échoué";
    case "REFUNDED": return "Remboursé";
    default: return "Non renseigné";
  }
}

function createOrganizerLabel(organizer: ConnectedOrganizer): string {
  return (
    organizer.businessName ||
    `${organizer.firstName} ${organizer.lastName}`.trim() ||
    organizer.email
  );
}

async function getConnectedOrganizer(): Promise<ConnectedOrganizer> {
  const cookieStore = await cookies();
  const sessionCookieName =
    process.env.SESSION_COOKIE_NAME?.trim() ||
    SESSION_COOKIE_FALLBACK_NAME;
  const sessionToken = cookieStore.get(sessionCookieName)?.value;

  if (!sessionToken) {
    throw new OrganizerParticipantsExportRouteError({
      code: "UNAUTHENTICATED",
      status: 401,
      message:
        "Votre session organisateur est introuvable. Veuillez vous reconnecter.",
    });
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(sessionToken) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          emailVerified: true,
          isActive: true,
          organizerProfile: {
            select: { businessName: true },
          },
        },
      },
    },
  });

  if (!session) {
    throw new OrganizerParticipantsExportRouteError({
      code: "SESSION_NOT_FOUND",
      status: 401,
      message: "Votre session n’est plus valide. Veuillez vous reconnecter.",
    });
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session
      .delete({ where: { id: session.id } })
      .catch((error: unknown) => {
        console.error(
          "[PARTICIPANTS_EXPORT_EXPIRED_SESSION_DELETE_ERROR]",
          error instanceof Error ? error.message : error,
        );
      });

    throw new OrganizerParticipantsExportRouteError({
      code: "SESSION_EXPIRED",
      status: 401,
      message: "Votre session a expiré. Veuillez vous reconnecter.",
    });
  }

  const organizer = session.user;

  if (
    organizer.role !== "ORGANIZER" ||
    !organizer.emailVerified ||
    !organizer.isActive
  ) {
    throw new OrganizerParticipantsExportRouteError({
      code: "FORBIDDEN",
      status: 403,
      message: "Ce compte n’est pas autorisé à exporter les participants.",
    });
  }

  return {
    id: organizer.id,
    email: organizer.email,
    firstName: organizer.firstName,
    lastName: organizer.lastName,
    businessName: organizer.organizerProfile?.businessName ?? null,
  };
}

function createParticipantsCsv({
  data,
  organizer,
}: {
  data: GetOrganizerParticipantsResult;
  organizer: ConnectedOrganizer;
}): { content: string; filename: string } {
  const rows: Array<Array<string | number | boolean | null | undefined>> = [
    ["EXPORT PARTICIPANTS TIKEMIA"],
    ["Organisateur", createOrganizerLabel(organizer)],
    ["E-mail organisateur", organizer.email],
    ["Généré le", formatDateTime(data.generatedAt)],
    [],
    ["RÉSUMÉ"],
    ["Billets", data.summary.totalTickets],
    ["Participants attendus", data.summary.expectedParticipants],
    ["Présents", data.summary.checkedInParticipants],
    ["Non enregistrés", data.summary.notCheckedInParticipants],
    ["Billets annulés", data.summary.cancelledTickets],
    ["Billets remboursés", data.summary.refundedTickets],
    ["Participants uniques", data.summary.uniqueParticipants],
    ["Achats invités", data.summary.guestParticipants],
    ["Comptes enregistrés", data.summary.registeredParticipants],
    ["Taux de présence (%)", data.summary.attendanceRate],
    [],
    [
      "ID billet",
      "Code billet",
      "Nom participant",
      "E-mail participant",
      "Téléphone participant",
      "Pays",
      "Code pays",
      "Type de billet",
      "Statut billet",
      "Présent",
      "Date de scan",
      "Événement",
      "Date événement",
      "Lieu",
      "Ville",
      "Pays événement",
      "Commande",
      "Statut commande",
      "Paiement",
      "Méthode",
      "Prestataire",
      "Référence paiement",
      "Achat invité",
      "Créé le",
    ],
    ...data.participants.map((participant) => [
      participant.id,
      participant.code,
      participant.holder.name,
      participant.holder.email,
      participant.holder.phone,
      participant.holder.country,
      participant.holder.countryCode,
      participant.ticketType.name,
      formatTicketStatus(participant.status),
      participant.checkedIn,
      formatDateTime(participant.usedAt, participant.event.timezone),
      participant.event.title,
      formatDateTime(participant.event.startsAt, participant.event.timezone),
      participant.event.venueName,
      participant.event.city,
      participant.event.country,
      participant.order.reference,
      formatOrderStatus(participant.order.status),
      formatPaymentStatus(participant.order.payment?.status),
      participant.order.payment?.method,
      participant.order.payment?.provider,
      participant.order.payment?.providerReference,
      participant.isGuestPurchase,
      formatDateTime(participant.createdAt),
    ]),
  ];

  const filename = [
    "tikemia",
    "participants",
    sanitizeFilenamePart(createOrganizerLabel(organizer), "organisateur"),
    new Date().toISOString().slice(0, 10),
  ].join("-") + ".csv";

  return {
    content: `${UTF8_BOM}${serializeCsvRows(rows)}`,
    filename,
  };
}

function styleExcelHeader(row: ExcelJS.Row): void {
  row.height = 28;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF071014" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF25333A" } },
    };
  });
}

function styleExcelDataRows(
  worksheet: ExcelJS.Worksheet,
  startRow = 2,
): void {
  for (let rowIndex = startRow; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    row.eachCell((cell) => {
      cell.font = { color: { argb: "FFD6DEE2" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: rowIndex % 2 === 0 ? "FF0B151B" : "FF101B21",
        },
      };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = {
        bottom: { style: "hair", color: { argb: "FF25333A" } },
      };
    });
  }
}

function addExcelTitle({
  worksheet,
  title,
  columnCount,
}: {
  worksheet: ExcelJS.Worksheet;
  title: string;
  columnCount: number;
}): void {
  worksheet.mergeCells(1, 1, 1, columnCount);
  const cell = worksheet.getCell(1, 1);
  cell.value = title;
  cell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF071014" },
  };
  cell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 34;
}

async function createParticipantsExcel({
  data,
  organizer,
}: {
  data: GetOrganizerParticipantsResult;
  organizer: ConnectedOrganizer;
}): Promise<{ buffer: Buffer; filename: string }> {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Tikemia";
  workbook.lastModifiedBy = "Tikemia";
  workbook.company = "Tikemia";
  workbook.title = "Export participants Tikemia";
  workbook.subject = "Participants des événements Tikemia";
  workbook.created = new Date();
  workbook.modified = new Date();

  const summary = workbook.addWorksheet("Résumé", {
    properties: { tabColor: { argb: "FF84CC16" } },
  });
  summary.views = [{ showGridLines: false }];
  summary.columns = [{ width: 34 }, { width: 28 }];

  addExcelTitle({
    worksheet: summary,
    title: "PARTICIPANTS TIKEMIA",
    columnCount: 2,
  });

  const summaryRows: Array<[string, string | number]> = [
    ["Organisateur", createOrganizerLabel(organizer)],
    ["E-mail", organizer.email],
    ["Généré le", formatDateTime(data.generatedAt)],
    ["Billets", data.summary.totalTickets],
    ["Participants attendus", data.summary.expectedParticipants],
    ["Présents", data.summary.checkedInParticipants],
    ["Non enregistrés", data.summary.notCheckedInParticipants],
    ["Billets annulés", data.summary.cancelledTickets],
    ["Billets remboursés", data.summary.refundedTickets],
    ["Participants uniques", data.summary.uniqueParticipants],
    ["Achats invités", data.summary.guestParticipants],
    ["Comptes enregistrés", data.summary.registeredParticipants],
    ["Taux de présence (%)", data.summary.attendanceRate],
  ];

  for (const row of summaryRows) summary.addRow(row);
  styleExcelDataRows(summary, 2);

  const participants = workbook.addWorksheet("Participants", {
    properties: { tabColor: { argb: "FF38BDF8" } },
  });

  participants.columns = [
    { header: "ID billet", key: "id", width: 28 },
    { header: "Code billet", key: "code", width: 22 },
    { header: "Participant", key: "holderName", width: 26 },
    { header: "E-mail", key: "holderEmail", width: 30 },
    { header: "Téléphone", key: "holderPhone", width: 20 },
    { header: "Pays", key: "country", width: 18 },
    { header: "Type de billet", key: "ticketType", width: 24 },
    { header: "Statut billet", key: "ticketStatus", width: 16 },
    { header: "Présent", key: "checkedIn", width: 12 },
    { header: "Date de scan", key: "usedAt", width: 20 },
    { header: "Événement", key: "eventTitle", width: 32 },
    { header: "Date événement", key: "eventDate", width: 20 },
    { header: "Lieu", key: "venue", width: 24 },
    { header: "Ville", key: "city", width: 18 },
    { header: "Pays événement", key: "eventCountry", width: 18 },
    { header: "Commande", key: "orderReference", width: 20 },
    { header: "Statut commande", key: "orderStatus", width: 18 },
    { header: "Paiement", key: "paymentStatus", width: 16 },
    { header: "Méthode", key: "paymentMethod", width: 18 },
    { header: "Prestataire", key: "paymentProvider", width: 18 },
    { header: "Référence paiement", key: "paymentReference", width: 24 },
    { header: "Achat invité", key: "isGuest", width: 14 },
    { header: "Créé le", key: "createdAt", width: 20 },
  ];

  for (const participant of data.participants) {
    participants.addRow({
      id: participant.id,
      code: participant.code,
      holderName: participant.holder.name,
      holderEmail: participant.holder.email,
      holderPhone: participant.holder.phone,
      country: participant.holder.country,
      ticketType: participant.ticketType.name,
      ticketStatus: formatTicketStatus(participant.status),
      checkedIn: participant.checkedIn ? "Oui" : "Non",
      usedAt: participant.usedAt ? new Date(participant.usedAt) : null,
      eventTitle: participant.event.title,
      eventDate: new Date(participant.event.startsAt),
      venue: participant.event.venueName,
      city: participant.event.city,
      eventCountry: participant.event.country,
      orderReference: participant.order.reference,
      orderStatus: formatOrderStatus(participant.order.status),
      paymentStatus: formatPaymentStatus(participant.order.payment?.status),
      paymentMethod: participant.order.payment?.method ?? "",
      paymentProvider: participant.order.payment?.provider ?? "",
      paymentReference: participant.order.payment?.providerReference ?? "",
      isGuest: participant.isGuestPurchase ? "Oui" : "Non",
      createdAt: new Date(participant.createdAt),
    });
  }

  styleExcelHeader(participants.getRow(1));
  styleExcelDataRows(participants, 2);
  participants.views = [{ state: "frozen", ySplit: 1, showGridLines: false }];
  participants.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: participants.columnCount },
  };
  participants.getColumn("usedAt").numFmt = "dd/mm/yyyy hh:mm";
  participants.getColumn("eventDate").numFmt = "dd/mm/yyyy hh:mm";
  participants.getColumn("createdAt").numFmt = "dd/mm/yyyy hh:mm";

  const filters = workbook.addWorksheet("Filtres", {
    properties: { tabColor: { argb: "FFF97316" } },
  });
  filters.columns = [{ width: 28 }, { width: 38 }];
  addExcelTitle({ worksheet: filters, title: "FILTRES APPLIQUÉS", columnCount: 2 });

  const filterRows: Array<[string, string]> = [
    ["Recherche", data.appliedFilters.search || "Aucune"],
    ["Événement", data.appliedFilters.eventId || "Tous"],
    ["Type de billet", data.appliedFilters.ticketTypeId || "Tous"],
    ["Statut", data.appliedFilters.status || "Tous"],
    ["Présence", data.appliedFilters.attendance || "Toutes"],
    ["Pays", data.appliedFilters.country || "Tous"],
    ["Date de début", data.appliedFilters.dateFrom || "Aucune"],
    ["Date de fin", data.appliedFilters.dateTo || "Aucune"],
    ["Tri", data.appliedFilters.sort],
  ];

  for (const row of filterRows) filters.addRow(row);
  styleExcelDataRows(filters, 2);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const filename = [
    "tikemia",
    "participants",
    sanitizeFilenamePart(createOrganizerLabel(organizer), "organisateur"),
    new Date().toISOString().slice(0, 10),
  ].join("-") + ".xlsx";

  return { buffer: Buffer.from(arrayBuffer), filename };
}

function truncatePdfText({
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
  const normalized = normalizeText(text);
  if (font.widthOfTextAtSize(normalized, size) <= maxWidth) return normalized;

  const suffix = "...";
  let output = normalized;
  while (
    output.length > 0 &&
    font.widthOfTextAtSize(`${output}${suffix}`, size) > maxWidth
  ) {
    output = output.slice(0, -1);
  }
  return output ? `${output}${suffix}` : suffix;
}

function drawPdfText({
  page,
  text,
  x,
  y,
  font,
  size = 8,
  color = PDF_COLORS.text,
  maxWidth,
}: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  font: PDFFont;
  size?: number;
  color?: ReturnType<typeof rgb>;
  maxWidth?: number;
}): void {
  const safeText = maxWidth
    ? truncatePdfText({ text, font, size, maxWidth })
    : normalizeText(text);
  page.drawText(safeText, { x, y, font, size, color });
}

function drawPdfHeader({
  page,
  fonts,
  organizer,
  generatedAt,
  pageNumber,
}: {
  page: PDFPage;
  fonts: { regular: PDFFont; bold: PDFFont };
  organizer: ConnectedOrganizer;
  generatedAt: string;
  pageNumber: number;
}): void {
  drawPdfText({
    page,
    text: "TIKEMIA",
    x: PAGE_MARGIN_X,
    y: PAGE_HEIGHT - PAGE_MARGIN_TOP,
    font: fonts.bold,
    size: 18,
    color: PDF_COLORS.white,
  });
  drawPdfText({
    page,
    text: "Rapport des participants",
    x: PAGE_MARGIN_X + 110,
    y: PAGE_HEIGHT - PAGE_MARGIN_TOP + 1,
    font: fonts.bold,
    size: 12,
  });
  drawPdfText({
    page,
    text: createOrganizerLabel(organizer),
    x: PAGE_MARGIN_X + 110,
    y: PAGE_HEIGHT - PAGE_MARGIN_TOP - 15,
    font: fonts.regular,
    size: 8,
    color: PDF_COLORS.muted,
    maxWidth: 300,
  });

  const pageLabel = `Page ${pageNumber}`;
  drawPdfText({
    page,
    text: pageLabel,
    x: PAGE_WIDTH - PAGE_MARGIN_X - fonts.regular.widthOfTextAtSize(pageLabel, 8),
    y: PAGE_HEIGHT - PAGE_MARGIN_TOP,
    font: fonts.regular,
    size: 8,
    color: PDF_COLORS.muted,
  });
  drawPdfText({
    page,
    text: formatDateTime(generatedAt),
    x: PAGE_WIDTH - PAGE_MARGIN_X - 120,
    y: PAGE_HEIGHT - PAGE_MARGIN_TOP - 15,
    font: fonts.regular,
    size: 8,
    color: PDF_COLORS.muted,
    maxWidth: 120,
  });

  page.drawLine({
    start: { x: PAGE_MARGIN_X, y: PAGE_HEIGHT - PAGE_MARGIN_TOP - 26 },
    end: { x: PAGE_WIDTH - PAGE_MARGIN_X, y: PAGE_HEIGHT - PAGE_MARGIN_TOP - 26 },
    thickness: 0.8,
    color: PDF_COLORS.border,
  });
}

function drawPdfSummary({
  page,
  fonts,
  data,
  startY,
}: {
  page: PDFPage;
  fonts: { regular: PDFFont; bold: PDFFont };
  data: GetOrganizerParticipantsResult;
  startY: number;
}): number {
  const cards = [
    ["Billets", data.summary.totalTickets, PDF_COLORS.white],
    ["Attendus", data.summary.expectedParticipants, PDF_COLORS.orange],
    ["Présents", data.summary.checkedInParticipants, PDF_COLORS.green],
    ["Uniques", data.summary.uniqueParticipants, PDF_COLORS.blue],
    ["Taux", `${data.summary.attendanceRate}%`, PDF_COLORS.violet],
  ] as const;

  const gap = 8;
  const width =
    (PAGE_WIDTH - PAGE_MARGIN_X * 2 - gap * (cards.length - 1)) /
    cards.length;
  const height = 54;

  cards.forEach((card, index) => {
    const x = PAGE_MARGIN_X + index * (width + gap);
    page.drawRectangle({
      x,
      y: startY - height,
      width,
      height,
      color: PDF_COLORS.panel,
      borderColor: PDF_COLORS.border,
      borderWidth: 0.6,
    });
    drawPdfText({
      page,
      text: card[0],
      x: x + 9,
      y: startY - 18,
      font: fonts.regular,
      size: 7.5,
      color: PDF_COLORS.muted,
      maxWidth: width - 18,
    });
    drawPdfText({
      page,
      text: String(card[1]),
      x: x + 9,
      y: startY - 39,
      font: fonts.bold,
      size: 13,
      color: card[2],
      maxWidth: width - 18,
    });
  });

  return startY - height - 18;
}

function drawPdfTableHeader({
  page,
  fonts,
  y,
}: {
  page: PDFPage;
  fonts: { regular: PDFFont; bold: PDFFont };
  y: number;
}): void {
  const columns = [
    { label: "Participant", width: 150 },
    { label: "Événement", width: 175 },
    { label: "Billet", width: 95 },
    { label: "Statut", width: 70 },
    { label: "Commande", width: 95 },
    { label: "Présence", width: 85 },
    { label: "Date", width: 115 },
  ];

  let x = PAGE_MARGIN_X;
  columns.forEach((column) => {
    page.drawRectangle({
      x,
      y: y - 24,
      width: column.width,
      height: 24,
      color: PDF_COLORS.panelSoft,
      borderColor: PDF_COLORS.border,
      borderWidth: 0.5,
    });
    drawPdfText({
      page,
      text: column.label,
      x: x + 5,
      y: y - 15,
      font: fonts.bold,
      size: 7,
      maxWidth: column.width - 10,
    });
    x += column.width;
  });
}

function drawPdfParticipantRow({
  page,
  fonts,
  participant,
  y,
  odd,
}: {
  page: PDFPage;
  fonts: { regular: PDFFont; bold: PDFFont };
  participant: OrganizerParticipantListItem;
  y: number;
  odd: boolean;
}): void {
  const columns = [
    { value: `${participant.holder.name} — ${participant.holder.email}`, width: 150 },
    { value: participant.event.title, width: 175 },
    { value: `${participant.ticketType.name} — ${participant.code}`, width: 95 },
    { value: formatTicketStatus(participant.status), width: 70 },
    { value: participant.order.reference, width: 95 },
    { value: participant.checkedIn ? "Présent" : "Attendu", width: 85 },
    {
      value: formatDateTime(participant.event.startsAt, participant.event.timezone),
      width: 115,
    },
  ];

  let x = PAGE_MARGIN_X;
  const rowHeight = 30;

  columns.forEach((column, index) => {
    page.drawRectangle({
      x,
      y: y - rowHeight,
      width: column.width,
      height: rowHeight,
      color: odd ? PDF_COLORS.panel : PDF_COLORS.panelSoft,
      borderColor: PDF_COLORS.border,
      borderWidth: 0.35,
    });

    drawPdfText({
      page,
      text: column.value,
      x: x + 5,
      y: y - 18,
      font: index === 3 || index === 5 ? fonts.bold : fonts.regular,
      size: 6.7,
      color:
        index === 3
          ? participant.status === "VALID"
            ? PDF_COLORS.green
            : participant.status === "USED"
              ? PDF_COLORS.blue
              : participant.status === "REFUNDED"
                ? PDF_COLORS.violet
                : PDF_COLORS.red
          : index === 5
            ? participant.checkedIn
              ? PDF_COLORS.green
              : PDF_COLORS.orange
            : PDF_COLORS.text,
      maxWidth: column.width - 10,
    });

    x += column.width;
  });
}

async function createParticipantsPdf({
  data,
  organizer,
}: {
  data: GetOrganizerParticipantsResult;
  organizer: ConnectedOrganizer;
}): Promise<{ buffer: Buffer; filename: string }> {
  const document = await PDFDocument.create();
  const fonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
  };

  document.setTitle("Rapport des participants Tikemia");
  document.setAuthor("Tikemia");
  document.setCreator("Tikemia");
  document.setProducer("Tikemia");
  document.setSubject("Participants des événements Tikemia");
  document.setCreationDate(new Date());
  document.setModificationDate(new Date());

  let pageNumber = 0;
  let page: PDFPage;
  let currentY = 0;

  function createPage(): void {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageNumber += 1;
    page.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      color: PDF_COLORS.background,
    });
    drawPdfHeader({ page, fonts, organizer, generatedAt: data.generatedAt, pageNumber });
    currentY = PAGE_HEIGHT - PAGE_MARGIN_TOP - 42;
  }

  createPage();
  currentY = drawPdfSummary({ page: page!, fonts, data, startY: currentY });
  drawPdfTableHeader({ page: page!, fonts, y: currentY });
  currentY -= 24;

  data.participants.forEach((participant, index) => {
    const rowHeight = 30;
    if (currentY - rowHeight < PAGE_MARGIN_BOTTOM + 18) {
      createPage();
      drawPdfTableHeader({ page: page!, fonts, y: currentY });
      currentY -= 24;
    }
    drawPdfParticipantRow({
      page: page!,
      fonts,
      participant,
      y: currentY,
      odd: index % 2 === 0,
    });
    currentY -= rowHeight;
  });

  const bytes = await document.save({
    useObjectStreams: true,
    addDefaultPage: false,
    updateFieldAppearances: false,
  });

  const filename = [
    "tikemia",
    "participants",
    sanitizeFilenamePart(createOrganizerLabel(organizer), "organisateur"),
    new Date().toISOString().slice(0, 10),
  ].join("-") + ".pdf";

  return { buffer: Buffer.from(bytes), filename };
}

export async function GET(request: NextRequest) {
  try {
    const organizer = await getConnectedOrganizer();
    const searchParams = request.nextUrl.searchParams;
    const format = normalizeFormat(searchParams.get("format"));

    const maxParticipants = parsePositiveInteger({
      value: searchParams.get("maxParticipants"),
      fallback:
        format === "pdf" ? MAX_PDF_PARTICIPANTS : MAX_EXPORT_PARTICIPANTS,
      maximum:
        format === "pdf" ? MAX_PDF_PARTICIPANTS : MAX_EXPORT_PARTICIPANTS,
    });

    const data = await getOrganizerParticipants({
      organizerId: organizer.id,
      page: 1,
      pageSize: maxParticipants,
      search: normalizeOptionalText(searchParams.get("search")),
      eventId: normalizeOptionalText(searchParams.get("eventId")),
      ticketTypeId: normalizeOptionalText(searchParams.get("ticketTypeId")),
      status: normalizeOptionalText(searchParams.get("status")),
      attendance: normalizeOptionalText(searchParams.get("attendance")),
      country: normalizeOptionalText(searchParams.get("country")),
      dateFrom: normalizeOptionalText(searchParams.get("dateFrom")),
      dateTo: normalizeOptionalText(searchParams.get("dateTo")),
      sort: normalizeSort(searchParams.get("sort")),
    });

    if (format === "xlsx") {
      const excel = await createParticipantsExcel({ data, organizer });
      return new Response(new Uint8Array(excel.buffer), {
        status: 200,
        headers: createDownloadHeaders({
          filename: excel.filename,
          mimeType: XLSX_MIME_TYPE,
          contentLength: excel.buffer.byteLength,
        }),
      });
    }

    if (format === "pdf") {
      const pdf = await createParticipantsPdf({ data, organizer });
      return new Response(new Uint8Array(pdf.buffer), {
        status: 200,
        headers: createDownloadHeaders({
          filename: pdf.filename,
          mimeType: PDF_MIME_TYPE,
          contentLength: pdf.buffer.byteLength,
        }),
      });
    }

    const csv = createParticipantsCsv({ data, organizer });
    const csvBuffer = Buffer.from(csv.content, "utf8");

    return new Response(new Uint8Array(csvBuffer), {
      status: 200,
      headers: createDownloadHeaders({
        filename: csv.filename,
        mimeType: CSV_MIME_TYPE,
        contentLength: csvBuffer.byteLength,
      }),
    });
  } catch (error) {
    if (
      error instanceof OrganizerParticipantsExportRouteError ||
      error instanceof GetOrganizerParticipantsError
    ) {
      return createErrorResponse({
        code: error.code,
        message: error.message,
        status: error.status,
      });
    }

    console.error(
      "[ORGANIZER_PARTICIPANTS_EXPORT_ROUTE_ERROR]",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack:
              process.env.NODE_ENV === "development" ? error.stack : undefined,
          }
        : error,
    );

    return createErrorResponse({
      code: "ORGANIZER_PARTICIPANTS_EXPORT_FAILED",
      status: 500,
      message:
        "Impossible de générer l’export des participants pour le moment.",
    });
  }
}